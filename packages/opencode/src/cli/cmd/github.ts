import path from "path"
import { exec } from "child_process"
import { Buffer } from "node:buffer"
import { setTimeout as sleep } from "node:timers/promises"
import { Filesystem } from "../../util/filesystem"
import * as prompts from "@clack/prompts"
import { map, pipe, sortBy, values } from "remeda"
import { Octokit } from "@octokit/rest"
import { graphql } from "@octokit/graphql"
import * as core from "@actions/core"
import * as github from "@actions/github"
import type { Context } from "@actions/github/lib/context"
import type { IssueCommentEvent, PullRequestReviewCommentEvent } from "@octokit/webhooks-types"
import { UI } from "../ui"
import { cmd } from "./cmd"
import { ModelsDev } from "../../provider/models"
import { Instance } from "@/project/instance"
import { bootstrap } from "../bootstrap"
import { Session } from "../../session"
import { Identifier } from "../../id/id"
import { Bus } from "../../bus"
import { MessageV2 } from "../../session/message-v2"
import { SessionPrompt } from "@/session/prompt"
import { Process } from "@/util/process"
import { git } from "@/util/git"
import { createGithubApi, exchangeForAppToken, getOidcToken, revokeAppToken } from "./github/api"
import { createBranch } from "./github/branch"
import {
  normalizeModel,
  normalizeOidcBaseUrl,
  normalizeRunId,
  normalizeShare,
  normalizeUseGithubToken,
} from "./github/env"
import { runEventFlow } from "./github/execute"
import {
  getCommentType,
  getEventFlags,
  getIssueId,
  getTriggerCommentId,
  getUserPrompt,
  isIssueCommentEvent,
} from "./github/prompt"
import { createReaction } from "./github/reaction"
import { AGENT_USERNAME, SUPPORTED_EVENTS, type GithubPayload, type PromptFile } from "./github/shared"
import { extractResponseText, formatPromptTooLargeError, parseGitHubRemote } from "./github/util"

const WORKFLOW_FILE = ".github/workflows/opencode.yml"

export { extractResponseText, formatPromptTooLargeError, parseGitHubRemote }

export const GithubCommand = cmd({
  command: "github",
  describe: "manage GitHub agent",
  builder: (yargs) => yargs.command(GithubInstallCommand).command(GithubRunCommand).demandCommand(),
  async handler() {},
})

export const GithubInstallCommand = cmd({
  command: "install",
  describe: "install the GitHub agent",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Install GitHub agent")
        const app = await getAppInfo()
        await installGitHubApp()

        const providers = await ModelsDev.get().then((p) => {
          delete p["github-copilot"]
          return p
        })

        const provider = await promptProvider()
        const model = await promptModel()

        await addWorkflowFiles()
        printNextSteps()

        function printNextSteps() {
          let step2
          if (provider === "amazon-bedrock") {
            step2 =
              "Configure OIDC in AWS - https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services"
          } else {
            step2 = [
              `    2. Add the following secrets in org or repo (${app.owner}/${app.repo}) settings`,
              "",
              ...providers[provider].env.map((e) => `       - ${e}`),
            ].join("\n")
          }

          prompts.outro(
            [
              "Next steps:",
              "",
              `    1. Commit the \`${WORKFLOW_FILE}\` file and push`,
              step2,
              "",
              "    3. Go to a GitHub issue and comment `/oc summarize` to see the agent in action",
              "",
              "   Learn more about the GitHub agent - https://opencode.ai/docs/github/#usage-examples",
            ].join("\n"),
          )
        }

        async function getAppInfo() {
          const project = Instance.project
          if (project.vcs !== "git") {
            prompts.log.error(`Could not find git repository. Please run this command from a git repository.`)
            throw new UI.CancelledError()
          }

          const info = (await git(["remote", "get-url", "origin"], { cwd: Instance.worktree })).text().trim()
          const parsed = parseGitHubRemote(info)
          if (!parsed) {
            prompts.log.error(`Could not find git repository. Please run this command from a git repository.`)
            throw new UI.CancelledError()
          }
          return { owner: parsed.owner, repo: parsed.repo, root: Instance.worktree }
        }

        async function promptProvider() {
          const priority: Record<string, number> = {
            opencode: 0,
            anthropic: 1,
            openai: 2,
            google: 3,
          }
          const provider = await prompts.select({
            message: "Select provider",
            maxItems: 8,
            options: pipe(
              providers,
              values(),
              sortBy(
                (x) => priority[x.id] ?? 99,
                (x) => x.name ?? x.id,
              ),
              map((x) => ({
                label: x.name,
                value: x.id,
                hint: priority[x.id] === 0 ? "recommended" : undefined,
              })),
            ),
          })

          if (prompts.isCancel(provider)) throw new UI.CancelledError()
          return provider
        }

        async function promptModel() {
          const data = providers[provider]!
          const model = await prompts.select({
            message: "Select model",
            maxItems: 8,
            options: pipe(
              data.models,
              values(),
              sortBy((x) => x.name ?? x.id),
              map((x) => ({
                label: x.name ?? x.id,
                value: x.id,
              })),
            ),
          })

          if (prompts.isCancel(model)) throw new UI.CancelledError()
          return model
        }

        async function installGitHubApp() {
          const s = prompts.spinner()
          s.start("Installing GitHub app")

          const installation = await getInstallation()
          if (installation) return s.stop("GitHub app already installed")

          const url = "https://github.com/apps/opencode-agent"
          const command =
            process.platform === "darwin"
              ? `open "${url}"`
              : process.platform === "win32"
                ? `start "" "${url}"`
                : `xdg-open "${url}"`

          exec(command, (error) => {
            if (error) {
              prompts.log.warn(`Could not open browser. Please visit: ${url}`)
            }
          })

          s.message("Waiting for GitHub app to be installed")
          const MAX_RETRIES = 120
          let retries = 0
          do {
            const installation = await getInstallation()
            if (installation) break

            if (retries > MAX_RETRIES) {
              s.stop(
                `Failed to detect GitHub app installation. Make sure to install the app for the \`${app.owner}/${app.repo}\` repository.`,
              )
              throw new UI.CancelledError()
            }

            retries++
            await sleep(1000)
          } while (true)

          s.stop("Installed GitHub app")

          async function getInstallation() {
            return await fetch(
              `https://api.opencode.ai/get_github_app_installation?owner=${app.owner}&repo=${app.repo}`,
            )
              .then((res) => res.json())
              .then((data) => data.installation)
          }
        }

        async function addWorkflowFiles() {
          const envStr =
            provider === "amazon-bedrock"
              ? ""
              : `\n        env:${providers[provider].env.map((e) => `\n          ${e}: \${{ secrets.${e} }}`).join("")}`

          await Filesystem.write(
            path.join(app.root, WORKFLOW_FILE),
            `name: opencode

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  opencode:
    if: |
      contains(github.event.comment.body, ' /oc') ||
      startsWith(github.event.comment.body, '/oc') ||
      contains(github.event.comment.body, ' /opencode') ||
      startsWith(github.event.comment.body, '/opencode')
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      pull-requests: read
      issues: read
    steps:
      - name: Checkout repository
        uses: actions/checkout@v6
        with:
          persist-credentials: false

      - name: Run opencode
        uses: anomalyco/opencode/github@latest${envStr}
        with:
          model: ${provider}/${model}`,
          )

          prompts.log.success(`Added workflow file: "${WORKFLOW_FILE}"`)
        }
      },
    })
  },
})

export const GithubRunCommand = cmd({
  command: "run",
  describe: "run the GitHub agent",
  builder: (yargs) =>
    yargs
      .option("event", {
        type: "string",
        describe: "GitHub mock event to run the agent for",
      })
      .option("token", {
        type: "string",
        describe: "GitHub personal access token (github_pat_********)",
      }),
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      const isMock = Boolean(args.token || args.event)
      const context = isMock ? (JSON.parse(args.event!) as Context) : github.context
      if (!SUPPORTED_EVENTS.includes(context.eventName as (typeof SUPPORTED_EVENTS)[number])) {
        core.setFailed(`Unsupported event type: ${context.eventName}`)
        process.exit(1)
      }

      const flags = getEventFlags(context)
      const { providerID, modelID } = normalizeModel()
      const variant = process.env["VARIANT"] || undefined
      const runId = normalizeRunId()
      const share = normalizeShare()
      const oidcBaseUrl = normalizeOidcBaseUrl()
      const useGithubToken = normalizeUseGithubToken()
      const { owner, repo } = context.repo
      const payload = context.payload as GithubPayload
      const issueEvent = isIssueCommentEvent(payload) ? payload : undefined
      const actor = flags.isScheduleEvent ? undefined : context.actor
      const issueId = getIssueId({ context, payload, isRepoEvent: flags.isRepoEvent })
      const triggerCommentId = getTriggerCommentId({ payload, isCommentEvent: flags.isCommentEvent })
      const commentType = getCommentType({ context, isCommentEvent: flags.isCommentEvent })
      const runUrl = `/${owner}/${repo}/actions/runs/${runId}`
      const shareBaseUrl = isMock ? "https://dev.opencode.ai" : "https://opencode.ai"

      let appToken = ""
      let octoRest: Octokit | undefined
      let octoGraph: typeof graphql | undefined
      let session: { id: string; title: string; version: string } | undefined
      let shareId: string | undefined
      let gitCfg: string | undefined
      let exitCode = 0

      const gitText = async (args: string[]) => {
        const result = await git(args, { cwd: Instance.worktree })
        if (result.exitCode !== 0) {
          throw new Process.RunFailedError(["git", ...args], result.exitCode, result.stdout, result.stderr)
        }
        return result.text().trim()
      }
      const gitRun = async (args: string[]) => {
        const result = await git(args, { cwd: Instance.worktree })
        if (result.exitCode !== 0) {
          throw new Process.RunFailedError(["git", ...args], result.exitCode, result.stdout, result.stderr)
        }
        return result
      }
      const gitStatus = (args: string[]) => git(args, { cwd: Instance.worktree })

      try {
        if (useGithubToken) {
          const token = process.env["GITHUB_TOKEN"]
          if (!token) {
            throw new Error(
              "GITHUB_TOKEN environment variable is not set. When using use_github_token, you must provide GITHUB_TOKEN.",
            )
          }
          appToken = token
        } else {
          const token = isMock ? args.token! : await getOidcToken()
          appToken = await exchangeForAppToken({ token, oidcBaseUrl, owner, repo })
        }

        octoRest = new Octokit({ auth: appToken })
        octoGraph = graphql.defaults({
          headers: { authorization: `token ${appToken}` },
        })

        const prompt = await getUserPrompt({
          context,
          payload,
          isRepoEvent: flags.isRepoEvent,
          isIssuesEvent: flags.isIssuesEvent,
          isCommentEvent: flags.isCommentEvent,
          appToken,
        })

        if (!useGithubToken) {
          gitCfg = await configureGit({ run: gitRun, status: gitStatus, isMock, appToken })
        }

        const reaction = createReaction({
          octoRest,
          owner,
          repo,
          actor,
          issueId,
          triggerCommentId,
        })
        if (flags.isUserEvent) {
          await reaction.assertPermissions()
          await reaction.addReaction(commentType)
        }

        const api = createGithubApi({
          octoRest,
          octoGraph,
          owner,
          repo,
          issueId,
        })
        const repoData = await api.fetchRepo()

        session = await Session.create({
          permission: [
            {
              permission: "question",
              action: "deny",
              pattern: "*",
            },
          ],
        })
        const sid = session.id
        subscribeSessionEvents(sid)
        shareId = await (async () => {
          if (share === false) return
          if (!share && repoData.data.private) return
          await Session.share(sid)
          return sid.slice(-8)
        })()
        console.log("opencode session", sid)

        const branch = createBranch({
          git: {
            text: gitText,
            run: gitRun,
            status: gitStatus,
          },
          issueId,
          actor,
          owner,
          repo,
          octoRest,
        })

        const runChat = (message: string, files: PromptFile[] = []) =>
          chat({
            sessionID: sid,
            message,
            files,
            variant,
            providerID,
            modelID,
          })

        await runEventFlow({
          context,
          actor,
          issueId,
          triggerCommentId,
          shareBaseUrl,
          shareId,
          runUrl,
          session,
          providerID,
          modelID,
          isRepoEvent: flags.isRepoEvent,
          isScheduleEvent: flags.isScheduleEvent,
          isWorkflowDispatchEvent: flags.isWorkflowDispatchEvent,
          issueEvent,
          userPrompt: prompt.userPrompt,
          promptFiles: prompt.promptFiles,
          defaultBranch: repoData.data.default_branch,
          checkoutNewBranch: branch.checkoutNewBranch,
          checkoutLocalBranch: branch.checkoutLocalBranch,
          checkoutForkBranch: branch.checkoutForkBranch,
          branchIsDirty: branch.branchIsDirty,
          pushToNewBranch: branch.pushToNewBranch,
          pushToLocalBranch: branch.pushToLocalBranch,
          pushToForkBranch: branch.pushToForkBranch,
          createPR: branch.createPR,
          fetchPR: api.fetchPR,
          fetchIssue: api.fetchIssue,
          createComment: reaction.createComment,
          removeReaction: reaction.removeReaction,
          gitText,
          summarize: (response) => summarize(response, runChat, issueEvent, payload),
          chat: runChat,
          commentType,
        })
      } catch (e: any) {
        exitCode = 1
        console.error(e instanceof Error ? e.message : String(e))
        let msg = e
        if (e instanceof Process.RunFailedError) {
          msg = e.stderr.toString()
        } else if (e instanceof Error) {
          msg = e.message
        }
        if (flags.isUserEvent && octoRest) {
          const reaction = createReaction({
            octoRest,
            owner,
            repo,
            actor,
            issueId,
            triggerCommentId,
          })
          await reaction.createComment(`${msg}${footer({ runUrl, shareBaseUrl, shareId })}`)
          await reaction.removeReaction(commentType)
        }
        core.setFailed(msg)
      } finally {
        if (!useGithubToken) {
          await restoreGitConfig({ run: gitRun, gitCfg: gitCfg })
          await revokeAppToken(appToken)
        }
      }

      process.exit(exitCode)
    })
  },
})

type ChatInput = {
  sessionID: string
  message: string
  files?: PromptFile[]
  variant?: string
  providerID: string
  modelID: string
}

async function chat(input: ChatInput): Promise<string> {
  console.log("Sending message to opencode...")
  const files = input.files || []
  const result = await SessionPrompt.prompt({
    sessionID: input.sessionID,
    messageID: Identifier.ascending("message"),
    variant: input.variant,
    model: {
      providerID: input.providerID,
      modelID: input.modelID,
    },
    parts: [
      {
        id: Identifier.ascending("part"),
        type: "text",
        text: input.message,
      },
      ...files.flatMap((f) => [
        {
          id: Identifier.ascending("part"),
          type: "file" as const,
          mime: f.mime,
          url: `data:${f.mime};base64,${f.content}`,
          filename: f.filename,
          source: {
            type: "file" as const,
            text: {
              value: f.replacement,
              start: f.start,
              end: f.end,
            },
            path: f.filename,
          },
        },
      ]),
    ],
  })

  if (result.info.role === "assistant" && result.info.error) {
    const err = result.info.error
    console.error("Agent error:", err)
    if (err.name === "ContextOverflowError") {
      throw new Error(formatPromptTooLargeError(files))
    }
    throw new Error(`${err.name}: ${err.data?.message || ""}`)
  }

  const text = extractResponseText(result.parts)
  if (text) return text

  console.log("Requesting summary from agent...")
  const summary = await SessionPrompt.prompt({
    sessionID: input.sessionID,
    messageID: Identifier.ascending("message"),
    variant: input.variant,
    model: {
      providerID: input.providerID,
      modelID: input.modelID,
    },
    tools: { "*": false },
    parts: [
      {
        id: Identifier.ascending("part"),
        type: "text",
        text: "Summarize the actions (tool calls & reasoning) you did for the user in 1-2 sentences.",
      },
    ],
  })

  if (summary.info.role === "assistant" && summary.info.error) {
    const err = summary.info.error
    console.error("Summary agent error:", err)
    if (err.name === "ContextOverflowError") {
      throw new Error(formatPromptTooLargeError(files))
    }
    throw new Error(`${err.name}: ${err.data?.message || ""}`)
  }

  const textSummary = extractResponseText(summary.parts)
  if (!textSummary) {
    throw new Error("Failed to get summary from agent")
  }
  return textSummary
}

async function summarize(
  response: string,
  run: (message: string, files?: PromptFile[]) => Promise<string>,
  issueEvent: IssueCommentEvent | undefined,
  payload: GithubPayload,
) {
  try {
    return await run(`Summarize the following in less than 40 characters:\n\n${response}`)
  } catch {
    const title = issueEvent ? issueEvent.issue.title : (payload as PullRequestReviewCommentEvent).pull_request.title
    return `Fix issue: ${title}`
  }
}

async function configureGit(input: {
  run: (args: string[]) => Promise<unknown>
  status: (args: string[]) => Promise<{ exitCode: number; stdout: Buffer }>
  isMock: boolean
  appToken: string
}) {
  if (input.isMock) return undefined

  console.log("Configuring git...")
  const config = "http.https://github.com/.extraheader"
  const ret = await input.status(["config", "--local", "--get", config])
  const gitCfg = ret.exitCode === 0 ? ret.stdout.toString().trim() : undefined
  if (gitCfg) {
    await input.run(["config", "--local", "--unset-all", config])
  }

  const auth = Buffer.from(`x-access-token:${input.appToken}`, "utf8").toString("base64")
  await input.run(["config", "--local", config, `AUTHORIZATION: basic ${auth}`])
  await input.run(["config", "--global", "user.name", AGENT_USERNAME])
  await input.run(["config", "--global", "user.email", `${AGENT_USERNAME}@users.noreply.github.com`])
  return gitCfg
}

async function restoreGitConfig(input: { run: (args: string[]) => Promise<unknown>; gitCfg?: string }) {
  if (!input.gitCfg) return
  await input.run(["config", "--local", "http.https://github.com/.extraheader", input.gitCfg])
}

function footer(input: { runUrl: string; shareBaseUrl: string; shareId?: string }) {
  const share = input.shareId
    ? `[opencode session](${input.shareBaseUrl}/s/${input.shareId})&nbsp;&nbsp;|&nbsp;&nbsp;`
    : ""
  return `\n\n${share}[github run](${input.runUrl})`
}

function subscribeSessionEvents(sessionID: string) {
  const TOOL: Record<string, [string, string]> = {
    todowrite: ["Todo", UI.Style.TEXT_WARNING_BOLD],
    todoread: ["Todo", UI.Style.TEXT_WARNING_BOLD],
    bash: ["Bash", UI.Style.TEXT_DANGER_BOLD],
    edit: ["Edit", UI.Style.TEXT_SUCCESS_BOLD],
    glob: ["Glob", UI.Style.TEXT_INFO_BOLD],
    grep: ["Grep", UI.Style.TEXT_INFO_BOLD],
    list: ["List", UI.Style.TEXT_INFO_BOLD],
    read: ["Read", UI.Style.TEXT_HIGHLIGHT_BOLD],
    write: ["Write", UI.Style.TEXT_SUCCESS_BOLD],
    websearch: ["Search", UI.Style.TEXT_DIM_BOLD],
  }

  function print(color: string, type: string, title: string) {
    UI.println(
      color + `|`,
      UI.Style.TEXT_NORMAL + UI.Style.TEXT_DIM + ` ${type.padEnd(7, " ")}`,
      "",
      UI.Style.TEXT_NORMAL + title,
    )
  }

  let text = ""
  Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
    if (evt.properties.part.sessionID !== sessionID) return
    const part = evt.properties.part

    if (part.type === "tool" && part.state.status === "completed") {
      const [tool, color] = TOOL[part.tool] ?? [part.tool, UI.Style.TEXT_INFO_BOLD]
      const title =
        part.state.title || Object.keys(part.state.input).length > 0 ? JSON.stringify(part.state.input) : "Unknown"
      console.log()
      print(color, tool, title)
    }

    if (part.type === "text") {
      text = part.text
      if (part.time?.end) {
        UI.empty()
        UI.println(UI.markdown(text))
        UI.empty()
        text = ""
      }
    }
  })
}

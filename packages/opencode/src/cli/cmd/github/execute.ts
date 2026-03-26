import type { Context } from "@actions/github/lib/context"
import { Buffer } from "node:buffer"
import { buildPromptDataForIssue, buildPromptDataForPR } from "./prompt"
import type { GitHubIssue, GitHubPullRequest, PromptFile } from "./shared"

type Input = {
  context: Context
  actor?: string
  issueId?: number
  triggerCommentId?: number
  shareBaseUrl: string
  shareId?: string
  runUrl: string
  session: { title: string; version: string }
  providerID: string
  modelID: string
  isRepoEvent: boolean
  isScheduleEvent: boolean
  isWorkflowDispatchEvent: boolean
  issueEvent?: { issue: { pull_request?: unknown } }
  userPrompt: string
  promptFiles: PromptFile[]
  defaultBranch: string
  checkoutNewBranch: (type: "issue" | "schedule" | "dispatch") => Promise<string>
  checkoutLocalBranch: (pr: GitHubPullRequest) => Promise<void>
  checkoutForkBranch: (pr: GitHubPullRequest) => Promise<string>
  branchIsDirty: (
    head: string,
    branch: string,
  ) => Promise<{ dirty: boolean; uncommittedChanges: boolean; switched: boolean }>
  pushToNewBranch: (summary: string, branch: string, commit: boolean, isSchedule: boolean) => Promise<void>
  pushToLocalBranch: (summary: string, commit: boolean) => Promise<void>
  pushToForkBranch: (summary: string, pr: GitHubPullRequest, commit: boolean) => Promise<void>
  createPR: (base: string, branch: string, title: string, body: string) => Promise<number | null>
  fetchPR: () => Promise<GitHubPullRequest>
  fetchIssue: () => Promise<GitHubIssue>
  createComment: (body: string) => Promise<unknown>
  removeReaction: (type?: "issue" | "pr_review") => Promise<unknown>
  gitText: (args: string[]) => Promise<string>
  summarize: (response: string) => Promise<string>
  chat: (prompt: string, files?: PromptFile[]) => Promise<string>
  commentType?: "issue" | "pr_review"
}

export async function runEventFlow(input: Input) {
  if (input.isRepoEvent) {
    return runRepo(input)
  }
  if (
    ["pull_request", "pull_request_review_comment"].includes(input.context.eventName) ||
    input.issueEvent?.issue.pull_request
  ) {
    return runPr(input)
  }
  return runIssue(input)
}

async function runRepo(input: Input) {
  if (input.isWorkflowDispatchEvent && input.actor) {
    console.log(`Triggered by: ${input.actor}`)
  }
  const prefix = input.isWorkflowDispatchEvent ? "dispatch" : "schedule"
  const branch = await input.checkoutNewBranch(prefix)
  const head = await input.gitText(["rev-parse", "HEAD"])
  const response = await input.chat(input.userPrompt, input.promptFiles)
  const state = await input.branchIsDirty(head, branch)
  if (state.switched) {
    console.log("Agent managed its own branch, skipping infrastructure push/PR")
    console.log("Response:", response)
    return
  }
  if (!state.dirty) {
    console.log("Response:", response)
    return
  }

  const summary = await input.summarize(response)
  await input.pushToNewBranch(summary, branch, state.uncommittedChanges, input.isScheduleEvent)
  const type = input.isWorkflowDispatchEvent ? "workflow_dispatch" : "scheduled workflow"
  const pr = await input.createPR(
    input.defaultBranch,
    branch,
    summary,
    `${response}\n\nTriggered by ${type}${footer(input, { image: true })}`,
  )
  if (pr) {
    console.log(`Created PR #${pr}`)
    return
  }
  console.log("Skipped PR creation (no new commits)")
}

async function runPr(input: Input) {
  const pr = await input.fetchPR()
  const data = buildPromptDataForPR(pr, input.triggerCommentId)
  if (pr.headRepository.nameWithOwner === pr.baseRepository.nameWithOwner) {
    await input.checkoutLocalBranch(pr)
    const head = await input.gitText(["rev-parse", "HEAD"])
    const response = await input.chat(`${input.userPrompt}\n\n${data}`, input.promptFiles)
    const state = await input.branchIsDirty(head, pr.headRefName)
    if (state.switched) {
      console.log("Agent managed its own branch, skipping infrastructure push")
    }
    if (state.dirty && !state.switched) {
      const summary = await input.summarize(response)
      await input.pushToLocalBranch(summary, state.uncommittedChanges)
    }
    const has = pr.comments.nodes.some((c) => c.body.includes(`${input.shareBaseUrl}/s/${input.shareId}`))
    await input.createComment(`${response}${footer(input, { image: !has })}`)
    await input.removeReaction(input.commentType)
    return
  }

  const branch = await input.checkoutForkBranch(pr)
  const head = await input.gitText(["rev-parse", "HEAD"])
  const response = await input.chat(`${input.userPrompt}\n\n${data}`, input.promptFiles)
  const state = await input.branchIsDirty(head, branch)
  if (state.switched) {
    console.log("Agent managed its own branch, skipping infrastructure push")
  }
  if (state.dirty && !state.switched) {
    const summary = await input.summarize(response)
    await input.pushToForkBranch(summary, pr, state.uncommittedChanges)
  }
  const has = pr.comments.nodes.some((c) => c.body.includes(`${input.shareBaseUrl}/s/${input.shareId}`))
  await input.createComment(`${response}${footer(input, { image: !has })}`)
  await input.removeReaction(input.commentType)
}

async function runIssue(input: Input) {
  const branch = await input.checkoutNewBranch("issue")
  const head = await input.gitText(["rev-parse", "HEAD"])
  const issue = await input.fetchIssue()
  const data = buildPromptDataForIssue(issue, input.triggerCommentId)
  const response = await input.chat(`${input.userPrompt}\n\n${data}`, input.promptFiles)
  const state = await input.branchIsDirty(head, branch)
  if (state.switched) {
    await input.createComment(`${response}${footer(input, { image: true })}`)
    await input.removeReaction(input.commentType)
    return
  }
  if (state.dirty) {
    const summary = await input.summarize(response)
    await input.pushToNewBranch(summary, branch, state.uncommittedChanges, false)
    const pr = await input.createPR(
      input.defaultBranch,
      branch,
      summary,
      `${response}\n\nCloses #${input.issueId}${footer(input, { image: true })}`,
    )
    if (pr) {
      await input.createComment(`Created PR #${pr}${footer(input, { image: true })}`)
    } else {
      await input.createComment(`${response}${footer(input, { image: true })}`)
    }
    await input.removeReaction(input.commentType)
    return
  }
  await input.createComment(`${response}${footer(input, { image: true })}`)
  await input.removeReaction(input.commentType)
}

function footer(input: Input, opts?: { image?: boolean }) {
  const image = (() => {
    if (!input.shareId || !opts?.image) return ""

    const titleAlt = encodeURIComponent(input.session.title.substring(0, 50))
    const title64 = Buffer.from(input.session.title.substring(0, 700), "utf8").toString("base64")

    return `<a href="${input.shareBaseUrl}/s/${input.shareId}"><img width="200" alt="${titleAlt}" src="https://social-cards.sst.dev/openxd-share/${title64}.png?model=${input.providerID}/${input.modelID}&version=${input.session.version}&id=${input.shareId}" /></a>\n`
  })()

  const share = input.shareId
    ? `[opencode session](${input.shareBaseUrl}/s/${input.shareId})&nbsp;&nbsp;|&nbsp;&nbsp;`
    : ""
  return `\n\n${image}${share}[github run](${input.runUrl})`
}

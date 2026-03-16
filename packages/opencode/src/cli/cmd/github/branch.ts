import type { GitHubPullRequest } from "./shared"
import type { Octokit } from "@octokit/rest"
import { withRetry } from "./util"

type GitOps = {
  text: (args: string[]) => Promise<string>
  run: (args: string[]) => Promise<unknown>
  status: (args: string[]) => Promise<{ exitCode: number; stdout: Buffer }>
}

type BranchInput = {
  git: GitOps
  issueId?: number
  actor?: string
  owner: string
  repo: string
  octoRest: Octokit
}

export function createBranch(input: BranchInput) {
  const commitChanges = async (summary: string, actor?: string) => {
    const args = ["commit", "-m", summary]
    if (actor) args.push("-m", `Co-authored-by: ${actor} <${actor}@users.noreply.github.com>`)
    await input.git.run(args)
  }

  const checkoutNewBranch = async (type: "issue" | "schedule" | "dispatch") => {
    console.log("Checking out new branch...")
    const branch = generateBranchName(type)
    await input.git.run(["checkout", "-b", branch])
    return branch
  }

  const checkoutLocalBranch = async (pr: GitHubPullRequest) => {
    console.log("Checking out local branch...")

    const branch = pr.headRefName
    const depth = Math.max(pr.commits.totalCount, 20)

    await input.git.run(["fetch", "origin", `--depth=${depth}`, branch])
    await input.git.run(["checkout", branch])
  }

  const checkoutForkBranch = async (pr: GitHubPullRequest) => {
    console.log("Checking out fork branch...")

    const remoteBranch = pr.headRefName
    const localBranch = generateBranchName("pr")
    const depth = Math.max(pr.commits.totalCount, 20)

    await input.git.run(["remote", "add", "fork", `https://github.com/${pr.headRepository.nameWithOwner}.git`])
    await input.git.run(["fetch", "fork", `--depth=${depth}`, remoteBranch])
    await input.git.run(["checkout", "-b", localBranch, `fork/${remoteBranch}`])
    return localBranch
  }

  const pushToNewBranch = async (summary: string, branch: string, commit: boolean, isSchedule: boolean) => {
    console.log("Pushing to new branch...")
    if (commit) {
      await input.git.run(["add", "."])
      await commitChanges(summary, isSchedule ? undefined : input.actor)
    }
    await input.git.run(["push", "-u", "origin", branch])
  }

  const pushToLocalBranch = async (summary: string, commit: boolean) => {
    console.log("Pushing to local branch...")
    if (commit) {
      await input.git.run(["add", "."])
      await commitChanges(summary, input.actor)
    }
    await input.git.run(["push"])
  }

  const pushToForkBranch = async (summary: string, pr: GitHubPullRequest, commit: boolean) => {
    console.log("Pushing to fork branch...")

    const remoteBranch = pr.headRefName
    if (commit) {
      await input.git.run(["add", "."])
      await commitChanges(summary, input.actor)
    }
    await input.git.run(["push", "fork", `HEAD:${remoteBranch}`])
  }

  const branchIsDirty = async (head: string, branch: string) => {
    console.log("Checking if branch is dirty...")
    const current = await input.git.text(["rev-parse", "--abbrev-ref", "HEAD"])
    if (current !== branch) {
      console.log(`Branch changed during chat: expected ${branch}, now on ${current}`)
      return { dirty: true, uncommittedChanges: false, switched: true }
    }

    const ret = await input.git.status(["status", "--porcelain"])
    const status = ret.stdout.toString().trim()
    if (status.length > 0) {
      return { dirty: true, uncommittedChanges: true, switched: false }
    }
    const next = await input.git.text(["rev-parse", "HEAD"])
    return {
      dirty: next !== head,
      uncommittedChanges: false,
      switched: false,
    }
  }

  const createPR = async (base: string, branch: string, title: string, body: string): Promise<number | null> => {
    console.log("Creating pull request...")

    try {
      const existing = await withRetry(() =>
        input.octoRest.rest.pulls.list({
          owner: input.owner,
          repo: input.repo,
          head: `${input.owner}:${branch}`,
          base,
          state: "open",
        }),
      )

      if (existing.data.length > 0) {
        console.log(`PR #${existing.data[0].number} already exists for branch ${branch}`)
        return existing.data[0].number
      }
    } catch (e) {
      console.log(`Failed to check for existing PR: ${e}`)
    }

    if (!(await hasNewCommits(base, branch))) {
      console.log(`No commits between ${base} and ${branch}, skipping PR creation`)
      return null
    }

    try {
      const pr = await withRetry(() =>
        input.octoRest.rest.pulls.create({
          owner: input.owner,
          repo: input.repo,
          head: branch,
          base,
          title,
          body,
        }),
      )
      return pr.data.number
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("No commits between")) {
        console.log(`GitHub rejected PR: ${e.message}`)
        return null
      }
      throw e
    }
  }

  const generateBranchName = (type: "issue" | "pr" | "schedule" | "dispatch") => {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:-]/g, "")
      .replace(/\.\d{3}Z/, "")
      .split("T")
      .join("")
    if (type === "schedule" || type === "dispatch") {
      const hex = crypto.randomUUID().slice(0, 6)
      return `opencode/${type}-${hex}-${timestamp}`
    }
    return `opencode/${type}${input.issueId}-${timestamp}`
  }

  const hasNewCommits = async (base: string, head: string) => {
    const result = await input.git.status(["rev-list", "--count", `${base}..${head}`])
    if (result.exitCode !== 0) {
      console.log(`rev-list failed, fetching origin/${base}...`)
      await input.git.status(["fetch", "origin", base, "--depth=1"])
      const retry = await input.git.status(["rev-list", "--count", `origin/${base}..${head}`])
      if (retry.exitCode !== 0) return true
      return Number.parseInt(retry.stdout.toString().trim()) > 0
    }
    return Number.parseInt(result.stdout.toString().trim()) > 0
  }

  return {
    branchIsDirty,
    checkoutForkBranch,
    checkoutLocalBranch,
    checkoutNewBranch,
    createPR,
    pushToForkBranch,
    pushToLocalBranch,
    pushToNewBranch,
  }
}

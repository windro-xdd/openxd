import type { Octokit } from "@octokit/rest"
import { AGENT_REACTION, AGENT_USERNAME } from "./shared"

type Input = {
  octoRest: Octokit
  owner: string
  repo: string
  actor?: string
  issueId?: number
  triggerCommentId?: number
}

export function createReaction(input: Input) {
  const assertPermissions = async () => {
    console.log(`Asserting permissions for user ${input.actor}...`)

    let permission: string
    try {
      const response = await input.octoRest.repos.getCollaboratorPermissionLevel({
        owner: input.owner,
        repo: input.repo,
        username: input.actor!,
      })
      permission = response.data.permission
      console.log(`  permission: ${permission}`)
    } catch (e) {
      console.error(`Failed to check permissions: ${e}`)
      throw new Error(`Failed to check permissions for user ${input.actor}: ${e}`)
    }

    if (!["admin", "write"].includes(permission)) {
      throw new Error(`User ${input.actor} does not have write permissions`)
    }
  }

  const addReaction = async (type?: "issue" | "pr_review") => {
    console.log("Adding reaction...")
    if (input.triggerCommentId) {
      if (type === "pr_review") {
        return input.octoRest.rest.reactions.createForPullRequestReviewComment({
          owner: input.owner,
          repo: input.repo,
          comment_id: input.triggerCommentId,
          content: AGENT_REACTION,
        })
      }
      return input.octoRest.rest.reactions.createForIssueComment({
        owner: input.owner,
        repo: input.repo,
        comment_id: input.triggerCommentId,
        content: AGENT_REACTION,
      })
    }
    return input.octoRest.rest.reactions.createForIssue({
      owner: input.owner,
      repo: input.repo,
      issue_number: input.issueId!,
      content: AGENT_REACTION,
    })
  }

  const removeReaction = async (type?: "issue" | "pr_review") => {
    console.log("Removing reaction...")
    if (input.triggerCommentId) {
      if (type === "pr_review") {
        const reactions = await input.octoRest.rest.reactions.listForPullRequestReviewComment({
          owner: input.owner,
          repo: input.repo,
          comment_id: input.triggerCommentId,
          content: AGENT_REACTION,
        })

        const eyes = reactions.data.find((r) => r.user?.login === AGENT_USERNAME)
        if (!eyes) return

        return input.octoRest.rest.reactions.deleteForPullRequestComment({
          owner: input.owner,
          repo: input.repo,
          comment_id: input.triggerCommentId,
          reaction_id: eyes.id,
        })
      }

      const reactions = await input.octoRest.rest.reactions.listForIssueComment({
        owner: input.owner,
        repo: input.repo,
        comment_id: input.triggerCommentId,
        content: AGENT_REACTION,
      })

      const eyes = reactions.data.find((r) => r.user?.login === AGENT_USERNAME)
      if (!eyes) return

      return input.octoRest.rest.reactions.deleteForIssueComment({
        owner: input.owner,
        repo: input.repo,
        comment_id: input.triggerCommentId,
        reaction_id: eyes.id,
      })
    }

    const reactions = await input.octoRest.rest.reactions.listForIssue({
      owner: input.owner,
      repo: input.repo,
      issue_number: input.issueId!,
      content: AGENT_REACTION,
    })
    const eyes = reactions.data.find((r) => r.user?.login === AGENT_USERNAME)
    if (!eyes) return

    await input.octoRest.rest.reactions.deleteForIssue({
      owner: input.owner,
      repo: input.repo,
      issue_number: input.issueId!,
      reaction_id: eyes.id,
    })
  }

  const createComment = async (body: string) => {
    console.log("Creating comment...")
    return input.octoRest.rest.issues.createComment({
      owner: input.owner,
      repo: input.repo,
      issue_number: input.issueId!,
      body,
    })
  }

  return {
    addReaction,
    assertPermissions,
    createComment,
    removeReaction,
  }
}

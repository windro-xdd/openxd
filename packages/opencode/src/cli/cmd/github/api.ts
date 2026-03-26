import * as core from "@actions/core"
import type { Octokit } from "@octokit/rest"
import type { graphql } from "@octokit/graphql"
import type { IssueQueryResponse, PullRequestQueryResponse } from "./shared"

type Input = {
  octoRest: Octokit
  octoGraph: typeof graphql
  owner: string
  repo: string
  issueId?: number
}

export async function getOidcToken() {
  try {
    return await core.getIDToken("openxd-github-action")
  } catch (e) {
    console.error("Failed to get OIDC token:", e instanceof Error ? e.message : e)
    throw new Error("Could not fetch an OIDC token. Make sure to add `id-token: write` to your workflow permissions.")
  }
}

export async function exchangeForAppToken(input: { token: string; oidcBaseUrl: string; owner: string; repo: string }) {
  const response = input.token.startsWith("github_pat_")
    ? await fetch(`${input.oidcBaseUrl}/exchange_github_app_token_with_pat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.token}`,
        },
        body: JSON.stringify({ owner: input.owner, repo: input.repo }),
      })
    : await fetch(`${input.oidcBaseUrl}/exchange_github_app_token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.token}`,
        },
      })

  if (!response.ok) {
    const body = (await response.json()) as { error?: string }
    throw new Error(`App token exchange failed: ${response.status} ${response.statusText} - ${body.error}`)
  }

  const body = (await response.json()) as { token: string }
  return body.token
}

export function createGithubApi(input: Input) {
  const fetchRepo = () => input.octoRest.rest.repos.get({ owner: input.owner, repo: input.repo })

  const fetchIssue = async () => {
    console.log("Fetching prompt data for issue...")
    const result = await input.octoGraph<IssueQueryResponse>(
      `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      title
      body
      author {
        login
      }
      createdAt
      state
      comments(first: 100) {
        nodes {
          id
          databaseId
          body
          author {
            login
          }
          createdAt
        }
      }
    }
  }
}`,
      {
        owner: input.owner,
        repo: input.repo,
        number: input.issueId,
      },
    )

    const issue = result.repository.issue
    if (!issue) throw new Error(`Issue #${input.issueId} not found`)
    return issue
  }

  const fetchPR = async () => {
    console.log("Fetching prompt data for PR...")
    const result = await input.octoGraph<PullRequestQueryResponse>(
      `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      title
      body
      author {
        login
      }
      baseRefName
      headRefName
      headRefOid
      createdAt
      additions
      deletions
      state
      baseRepository {
        nameWithOwner
      }
      headRepository {
        nameWithOwner
      }
      commits(first: 100) {
        totalCount
        nodes {
          commit {
            oid
            message
            author {
              name
              email
            }
          }
        }
      }
      files(first: 100) {
        nodes {
          path
          additions
          deletions
          changeType
        }
      }
      comments(first: 100) {
        nodes {
          id
          databaseId
          body
          author {
            login
          }
          createdAt
        }
      }
      reviews(first: 100) {
        nodes {
          id
          databaseId
          author {
            login
          }
          body
          state
          submittedAt
          comments(first: 100) {
            nodes {
              id
              databaseId
              body
              path
              line
              author {
                login
              }
              createdAt
            }
          }
        }
      }
    }
  }
}`,
      {
        owner: input.owner,
        repo: input.repo,
        number: input.issueId,
      },
    )

    const pr = result.repository.pullRequest
    if (!pr) throw new Error(`PR #${input.issueId} not found`)
    return pr
  }

  return {
    fetchIssue,
    fetchPR,
    fetchRepo,
  }
}

export async function revokeAppToken(token?: string) {
  if (!token) return
  await fetch("https://api.github.com/installation/token", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })
}

import os from "os"
import { createGitLab, VERSION as GITLAB_PROVIDER_VERSION } from "@gitlab/gitlab-ai-provider"
import { fromNodeProviderChain } from "@aws-sdk/credential-providers"
import { GoogleAuth } from "google-auth-library"
import { createAmazonBedrock, type AmazonBedrockProviderSettings } from "@ai-sdk/amazon-bedrock"

import { Config } from "../config/config"
import { Auth } from "../auth"
import { Env } from "../env"
import { iife } from "@/util/iife"
import { Installation } from "../installation"
import type { Provider } from "./provider"
import { resolveBedrockModelID, shouldUseCopilotResponsesApi } from "./model-select"

export type CustomModelLoader = (sdk: any, modelID: string, options?: Record<string, any>) => Promise<any>
type CustomLoader = (provider: Provider.Info) => Promise<{
  autoload: boolean
  getModel?: CustomModelLoader
  options?: Record<string, any>
}>

export const CUSTOM_LOADERS: Record<string, CustomLoader> = {
  async anthropic() {
    return {
      autoload: false,
      options: {
        headers: {
          "anthropic-beta":
            "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
        },
      },
    }
  },
  async opencode(input) {
    const hasKey = await (async () => {
      const env = Env.all()
      if (input.env.some((item) => env[item])) return true
      if (await Auth.get(input.id)) return true
      const cfg = await Config.get()
      if (cfg.provider?.["openxd"]?.options?.apiKey) return true
      return false
    })()

    if (!hasKey) {
      for (const [key, value] of Object.entries(input.models)) {
        if (value.cost.input === 0) continue
        delete input.models[key]
      }
    }

    return {
      autoload: Object.keys(input.models).length > 0,
      options: hasKey ? {} : { apiKey: "public" },
    }
  },
  openai: async () => {
    return {
      autoload: false,
      async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
        return sdk.responses(modelID)
      },
      options: {},
    }
  },
  "github-copilot": async () => {
    return {
      autoload: false,
      async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
        if (sdk.responses === undefined && sdk.chat === undefined) return sdk.languageModel(modelID)
        return shouldUseCopilotResponsesApi(modelID) ? sdk.responses(modelID) : sdk.chat(modelID)
      },
      options: {},
    }
  },
  "github-copilot-enterprise": async () => {
    return {
      autoload: false,
      async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
        if (sdk.responses === undefined && sdk.chat === undefined) return sdk.languageModel(modelID)
        return shouldUseCopilotResponsesApi(modelID) ? sdk.responses(modelID) : sdk.chat(modelID)
      },
      options: {},
    }
  },
  azure: async () => {
    return {
      autoload: false,
      async getModel(sdk: any, modelID: string, options?: Record<string, any>) {
        if (options?.["useCompletionUrls"]) return sdk.chat(modelID)
        return sdk.responses(modelID)
      },
      options: {},
    }
  },
  "azure-cognitive-services": async () => {
    const name = Env.get("AZURE_COGNITIVE_SERVICES_RESOURCE_NAME")
    return {
      autoload: false,
      async getModel(sdk: any, modelID: string, options?: Record<string, any>) {
        if (options?.["useCompletionUrls"]) return sdk.chat(modelID)
        return sdk.responses(modelID)
      },
      options: {
        baseURL: name ? `https://${name}.cognitiveservices.azure.com/openai` : undefined,
      },
    }
  },
  "amazon-bedrock": async () => {
    const cfg = await Config.get()
    const provider = cfg.provider?.["amazon-bedrock"]
    const auth = await Auth.get("amazon-bedrock")
    const cfgRegion = provider?.options?.region
    const envRegion = Env.get("AWS_REGION")
    const defaultRegion = cfgRegion ?? envRegion ?? "us-east-1"
    const cfgProfile = provider?.options?.profile
    const envProfile = Env.get("AWS_PROFILE")
    const profile = cfgProfile ?? envProfile
    const key = Env.get("AWS_ACCESS_KEY_ID")

    const bearer = iife(() => {
      const token = process.env.AWS_BEARER_TOKEN_BEDROCK
      if (token) return token
      if (auth?.type === "api") {
        process.env.AWS_BEARER_TOKEN_BEDROCK = auth.key
        return auth.key
      }
      return undefined
    })

    const web = Env.get("AWS_WEB_IDENTITY_TOKEN_FILE")
    const container = Boolean(
      process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI,
    )
    if (!profile && !key && !bearer && !web && !container) return { autoload: false }

    const options: AmazonBedrockProviderSettings = { region: defaultRegion }
    if (!bearer) {
      options.credentialProvider = fromNodeProviderChain(profile ? { profile } : {})
    }

    const endpoint = provider?.options?.endpoint ?? provider?.options?.baseURL
    if (endpoint) options.baseURL = endpoint

    return {
      autoload: true,
      options,
      async getModel(sdk: ReturnType<typeof createAmazonBedrock>, modelID: string, input?: Record<string, any>) {
        return sdk.languageModel(resolveBedrockModelID(modelID, input, defaultRegion))
      },
    }
  },
  openrouter: async () => {
    return {
      autoload: false,
      options: {
        headers: {
          "HTTP-Referer": "https://openxd.ai/",
          "X-Title": "openxd",
        },
      },
    }
  },
  vercel: async () => {
    return {
      autoload: false,
      options: {
        headers: {
          "http-referer": "https://openxd.ai/",
          "x-title": "openxd",
        },
      },
    }
  },
  "google-vertex": async (provider) => {
    const project =
      provider.options?.project ??
      Env.get("GOOGLE_CLOUD_PROJECT") ??
      Env.get("GCP_PROJECT") ??
      Env.get("GCLOUD_PROJECT")
    const location =
      provider.options?.location ?? Env.get("GOOGLE_CLOUD_LOCATION") ?? Env.get("VERTEX_LOCATION") ?? "us-central1"

    if (!project) return { autoload: false }

    return {
      autoload: true,
      options: {
        project,
        location,
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const auth = new GoogleAuth()
          const client = await auth.getApplicationDefault()
          const token = await client.credential.getAccessToken()
          const headers = new Headers(init?.headers)
          headers.set("Authorization", `Bearer ${token.token}`)
          return fetch(input, { ...init, headers })
        },
      },
      async getModel(sdk: any, modelID: string) {
        return sdk.languageModel(String(modelID).trim())
      },
    }
  },
  "google-vertex-anthropic": async () => {
    const project = Env.get("GOOGLE_CLOUD_PROJECT") ?? Env.get("GCP_PROJECT") ?? Env.get("GCLOUD_PROJECT")
    const location = Env.get("GOOGLE_CLOUD_LOCATION") ?? Env.get("VERTEX_LOCATION") ?? "global"
    if (!project) return { autoload: false }
    return {
      autoload: true,
      options: { project, location },
      async getModel(sdk: any, modelID: string) {
        return sdk.languageModel(String(modelID).trim())
      },
    }
  },
  "sap-ai-core": async () => {
    const auth = await Auth.get("sap-ai-core")
    const key = iife(() => {
      const env = process.env.AICORE_SERVICE_KEY
      if (env) return env
      if (auth?.type === "api") {
        process.env.AICORE_SERVICE_KEY = auth.key
        return auth.key
      }
      return undefined
    })

    const deploymentId = process.env.AICORE_DEPLOYMENT_ID
    const resourceGroup = process.env.AICORE_RESOURCE_GROUP

    return {
      autoload: !!key,
      options: key ? { deploymentId, resourceGroup } : {},
      async getModel(sdk: any, modelID: string) {
        return sdk(modelID)
      },
    }
  },
  zenmux: async () => {
    return {
      autoload: false,
      options: {
        headers: {
          "HTTP-Referer": "https://openxd.ai/",
          "X-Title": "openxd",
        },
      },
    }
  },
  gitlab: async (input) => {
    const instanceUrl = Env.get("GITLAB_INSTANCE_URL") || "https://gitlab.com"
    const auth = await Auth.get(input.id)
    const apiKey = await (async () => {
      if (auth?.type === "oauth") return auth.access
      if (auth?.type === "api") return auth.key
      return Env.get("GITLAB_TOKEN")
    })()

    const cfg = await Config.get()
    const provider = cfg.provider?.["gitlab"]

    const aiGatewayHeaders = {
      "User-Agent": `opencode/${Installation.VERSION} gitlab-ai-provider/${GITLAB_PROVIDER_VERSION} (${os.platform()} ${os.release()}; ${os.arch()})`,
      "anthropic-beta": "context-1m-2025-08-07",
      ...(provider?.options?.aiGatewayHeaders || {}),
    }

    return {
      autoload: !!apiKey,
      options: {
        instanceUrl,
        apiKey,
        aiGatewayHeaders,
        featureFlags: {
          duo_agent_platform_agentic_chat: true,
          duo_agent_platform: true,
          ...(provider?.options?.featureFlags || {}),
        },
      },
      async getModel(sdk: ReturnType<typeof createGitLab>, modelID: string) {
        return sdk.agenticChat(modelID, {
          aiGatewayHeaders,
          featureFlags: {
            duo_agent_platform_agentic_chat: true,
            duo_agent_platform: true,
            ...(provider?.options?.featureFlags || {}),
          },
        })
      },
    }
  },
  "cloudflare-workers-ai": async (input) => {
    const accountId = Env.get("CLOUDFLARE_ACCOUNT_ID")
    if (!accountId) return { autoload: false }

    const apiKey = await iife(async () => {
      const token = Env.get("CLOUDFLARE_API_KEY")
      if (token) return token
      const auth = await Auth.get(input.id)
      if (auth?.type === "api") return auth.key
      return undefined
    })

    return {
      autoload: !!apiKey,
      options: {
        apiKey,
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
      },
      async getModel(sdk: any, modelID: string) {
        return sdk.languageModel(modelID)
      },
    }
  },
  "cloudflare-ai-gateway": async (input) => {
    const accountId = Env.get("CLOUDFLARE_ACCOUNT_ID")
    const gateway = Env.get("CLOUDFLARE_GATEWAY_ID")
    if (!accountId || !gateway) return { autoload: false }

    const apiToken = await (async () => {
      const envToken = Env.get("CLOUDFLARE_API_TOKEN") || Env.get("CF_AIG_TOKEN")
      if (envToken) return envToken
      const auth = await Auth.get(input.id)
      if (auth?.type === "api") return auth.key
      return undefined
    })()

    if (!apiToken) {
      throw new Error(
        "CLOUDFLARE_API_TOKEN (or CF_AIG_TOKEN) is required for Cloudflare AI Gateway. " +
          "Set it via environment variable or run `opencode auth cloudflare-ai-gateway`.",
      )
    }

    const { createAiGateway } = await import("ai-gateway-provider")
    const { createUnified } = await import("ai-gateway-provider/providers/unified")

    const metadata = iife(() => {
      if (input.options?.metadata) return input.options.metadata
      try {
        return JSON.parse(input.options?.headers?.["cf-aig-metadata"])
      } catch {
        return undefined
      }
    })

    const opts = {
      metadata,
      cacheTtl: input.options?.cacheTtl,
      cacheKey: input.options?.cacheKey,
      skipCache: input.options?.skipCache,
      collectLog: input.options?.collectLog,
    }

    const aigateway = createAiGateway({
      accountId,
      gateway,
      apiKey: apiToken,
      ...(Object.values(opts).some((item) => item !== undefined) ? { options: opts } : {}),
    })

    const unified = createUnified()

    return {
      autoload: true,
      async getModel(_sdk: any, modelID: string, _options?: Record<string, any>) {
        return aigateway(unified(modelID))
      },
      options: {},
    }
  },
  cerebras: async () => {
    return {
      autoload: false,
      options: {
        headers: {
          "X-Cerebras-3rd-Party-Integration": "openxd",
        },
      },
    }
  },
  kilo: async () => {
    return {
      autoload: false,
      options: {
        headers: {
          "HTTP-Referer": "https://openxd.ai/",
          "X-Title": "openxd",
        },
      },
    }
  },
}

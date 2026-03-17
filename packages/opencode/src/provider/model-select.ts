export function isGpt5OrLater(modelID: string): boolean {
  const match = /^gpt-(\d+)/.exec(modelID)
  if (!match) return false
  return Number(match[1]) >= 5
}

export function shouldUseCopilotResponsesApi(modelID: string): boolean {
  return isGpt5OrLater(modelID) && !modelID.startsWith("gpt-5-mini")
}

const CROSS_REGION_PREFIX = ["global.", "us.", "eu.", "jp.", "apac.", "au."]

export function resolveBedrockModelID(modelID: string, options?: Record<string, any>, defaultRegion = "us-east-1") {
  if (CROSS_REGION_PREFIX.some((prefix) => modelID.startsWith(prefix))) return modelID

  const region = options?.region ?? defaultRegion
  let prefix = region.split("-")[0]

  switch (prefix) {
    case "us": {
      const needs = ["nova-micro", "nova-lite", "nova-pro", "nova-premier", "nova-2", "claude", "deepseek"].some(
        (item) => modelID.includes(item),
      )
      const gov = region.startsWith("us-gov")
      if (needs && !gov) return `${prefix}.${modelID}`
      return modelID
    }
    case "eu": {
      const regionNeeds = [
        "eu-west-1",
        "eu-west-2",
        "eu-west-3",
        "eu-north-1",
        "eu-central-1",
        "eu-south-1",
        "eu-south-2",
      ].some((item) => region.includes(item))
      const modelNeeds = ["claude", "nova-lite", "nova-micro", "llama3", "pixtral"].some((item) =>
        modelID.includes(item),
      )
      if (regionNeeds && modelNeeds) return `${prefix}.${modelID}`
      return modelID
    }
    case "ap": {
      const au = ["ap-southeast-2", "ap-southeast-4"].includes(region)
      const jp = region === "ap-northeast-1"
      if (au && ["anthropic.claude-sonnet-4-5", "anthropic.claude-haiku"].some((item) => modelID.includes(item))) {
        return `au.${modelID}`
      }
      if (jp) {
        const needs = ["claude", "nova-lite", "nova-micro", "nova-pro"].some((item) => modelID.includes(item))
        if (needs) return `jp.${modelID}`
        return modelID
      }
      const needs = ["claude", "nova-lite", "nova-micro", "nova-pro"].some((item) => modelID.includes(item))
      if (needs) return `apac.${modelID}`
      return modelID
    }
    default:
      return modelID
  }
}

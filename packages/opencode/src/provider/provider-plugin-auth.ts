import type { Hooks } from "@opencode-ai/plugin"
import { Auth } from "../auth"
import type { Provider } from "./provider"

type Loader = NonNullable<NonNullable<Hooks["auth"]>["loader"]>
type LoaderAuth = Parameters<Loader>[0]

function auth(providerID: string): LoaderAuth {
  return async () => (await Auth.get(providerID)) as Auth.Info
}

export async function runPluginAuthLoader(loader: Loader, providerID: string, provider: Provider.Info) {
  return (await loader(auth(providerID), provider)) ?? {}
}

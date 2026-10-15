import type { PluginClientContext } from "@getpaseo/plugin/client";
import { signInAgainRpc, signInStateRpc } from "../shared/contracts";

// Item 1 of the next update: the house plugin's Citizens page offers "Sign in again" when the house's Claude sign-in has
// run out. The probe and the browser sign-in live here, in setup; Paseo lets a plugin call only its own server, so this
// plugin lends the two calls to the house plugin in the same app, as the house plugin lends it the Life map.
export const SIGN_IN_BRIDGE = "__agenticPocketsSignIn";
export function addSignInBridge(client: PluginClientContext): () => void {
  const bridge = { state: () => client.rpc(signInStateRpc, {}), again: () => client.rpc(signInAgainRpc, {}) };
  const g = globalThis as Record<string, unknown>;
  g[SIGN_IN_BRIDGE] = bridge;
  return () => { if (g[SIGN_IN_BRIDGE] === bridge) delete g[SIGN_IN_BRIDGE]; };
}

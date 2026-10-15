// Item 1 of the next update: which Claude sign-in the house's desks use, for the Citizens page's "Sign in again" (the
// house plugin reaches it through this plugin, client/sign-in-bridge.ts). "house": the clean profile, the house's own
// Claude folder (server/profile.ts); "own": the user's own Claude; null: no desk runs on Claude.
export type SignInTarget = "house" | "own" | null;
export function signInTarget(record: unknown): SignInTarget {
  const desks = (record as { desks?: Record<string, { provider?: unknown }> } | null)?.desks ?? {};
  const providers = Object.values(desks).map((d) => String(d?.provider ?? ""));
  if (providers.includes("claude-house")) return "house";
  return providers.some((p) => p === "claude" || p.startsWith("claude")) ? "own" : null;
}

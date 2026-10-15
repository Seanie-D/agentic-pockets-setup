// The Setup / Help button in each citizen's workspace (the owner, 2026-10-15: setup must be reachable with the sidebar
// off; "Lets add the Setup button"). Paseo lets a plugin open only its own screens, so setup carries its own button.
// It goes on every workspace the house record names for a citizen, and says Setup until the tutorial is complete, then
// Help, as the sidebar row does. Pure; test/help-button.test.ts.
export function helpButton(record: unknown, complete: boolean): { workspaceIds: string[]; label: "Setup" | "Help" } {
  const desks = (record as { desks?: Record<string, { workspaceId?: unknown }> } | null)?.desks ?? {};
  const ids = new Set<string>();
  for (const row of Object.values(desks)) if (typeof row?.workspaceId === "string" && row.workspaceId) ids.add(row.workspaceId);
  return { workspaceIds: [...ids], label: complete ? "Help" : "Setup" };
}

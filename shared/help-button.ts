// The Setup / Help button in each citizen's workspace (the owner, 2026-10-15: setup must be reachable with the sidebar
// off; "Lets add the Setup button"). Paseo lets a plugin open only its own screens, so setup carries its own button.
// It goes on every workspace the house record names for a citizen, and on every other live workspace whose folder is
// exactly that citizen's (TH5, 2026-10-15: a second workspace in a pocket had the Life map button and no Setup), and
// says Setup until setup is done (the record's setupDone) or the tutorial is complete, then "Help!" (the owner, 2026-10-15,
// 12:41 and 13:08 CDT). Pure; test/help-button.test.ts.
export interface WorkspaceRecord { workspaceId: string; cwd?: string; archivedAt?: string | null }

// Slashes one way, no trailing slash; a Windows path (a drive letter) in one case, since Windows ignores case.
const norm = (p: string) => { const s = p.replace(/\\/g, "/").replace(/\/+$/, ""); return /^[a-z]:\//i.test(s) ? s.toLowerCase() : s; };

export function helpButton(record: unknown, complete: boolean, root?: string, workspaces: WorkspaceRecord[] = []): { workspaceIds: string[]; label: "Setup" | "Help!" } {
  const desks = (record as { desks?: Record<string, { workspaceId?: unknown }> } | null)?.desks ?? {};
  const ids = new Set<string>();
  for (const row of Object.values(desks)) if (typeof row?.workspaceId === "string" && row.workspaceId) ids.add(row.workspaceId);
  if (root) {
    const pockets = new Set(Object.keys(desks).map((c) => norm(`${root}/Pockets/${c}`)));
    for (const w of workspaces) if (w?.workspaceId && !w.archivedAt && w.cwd && pockets.has(norm(w.cwd))) ids.add(w.workspaceId);
  }
  const done = (record as { setupDone?: unknown } | null)?.setupDone === true;
  return { workspaceIds: [...ids], label: complete || done ? "Help!" : "Setup" };
}

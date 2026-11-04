// A citizen's workspace on one computer (one house on two computers): the desk row's map entry for that computer, else
// its one old field. A word-for-word copy of the house plugin's workspaceOf (plugins/agentic-pockets/server/two-computers.ts),
// pinned by that plugin's test/two-computers.test.ts. No host: the old field, as a house on one computer reads it.
type Row = { workspaceId?: unknown; workspaces?: Record<string, unknown> } | undefined | null;

export function workspaceOf(row: Row, host?: string): string | undefined {
  if (!row) return undefined;
  const id = row.workspaces && host ? row.workspaces[host] : row.workspaceId;
  return typeof id === "string" && id ? id : undefined;
}

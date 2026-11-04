import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

// A citizen's workspace on one computer (one house on two computers): the desk row's map entry for that computer, else
// its one old field. Computers are known by computerId, not by network name. A word-for-word copy of the house plugin's workspaceOf (plugins/agentic-pockets/server/two-computers.ts),
// pinned by that plugin's test/two-computers.test.ts. No host: the old field, as a house on one computer reads it.
type Row = { workspaceId?: unknown; workspaces?: Record<string, unknown> } | undefined | null;

export function workspaceOf(row: Row, host?: string): string | undefined {
  if (!row) return undefined;
  const id = row.workspaces && host ? row.workspaces[host] : row.workspaceId;
  return typeof id === "string" && id ? id : undefined;
}

export function computerId({ home = os.homedir(), env = process.env }: { home?: string; env?: Record<string, string | undefined> } = {}): string {
  if (env.AGENTIC_POCKETS_COMPUTER_ID) return env.AGENTIC_POCKETS_COMPUTER_ID;
  const f = path.join(home, ".config", "agentic-pockets", "computer-id");
  try { const id = fs.readFileSync(f, "utf8").trim(); if (id) return id; } catch { /* first read on this computer */ }
  const id = randomUUID();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, id + "\n");
  return id;
}

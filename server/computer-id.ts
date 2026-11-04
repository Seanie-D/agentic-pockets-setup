import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

// This computer's id, made once and kept in the user's settings folder, outside the house (one house on two computers).
// A word-for-word copy of the house plugin's computerId (plugins/agentic-pockets/server/two-computers.ts), pinned by that
// plugin's test/two-computers.test.ts. In server/, not shared/: it reads the disk.
export function computerId({ home = os.homedir(), env = process.env }: { home?: string; env?: Record<string, string | undefined> } = {}): string {
  if (env.AGENTIC_POCKETS_COMPUTER_ID) return env.AGENTIC_POCKETS_COMPUTER_ID;
  const f = path.join(home, ".config", "agentic-pockets", "computer-id");
  try { const id = fs.readFileSync(f, "utf8").trim(); if (id) return id; } catch { /* first read on this computer */ }
  const id = randomUUID();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, id + "\n");
  return id;
}

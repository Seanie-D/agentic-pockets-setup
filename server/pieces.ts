// A release piece's hash, in a house (the update system, ticket 01): the same hashing as the release build
// (Commons/skills/records/house-update/pieces.mjs, where the pieces are named). Both tests pin one fixture and
// the same hashes. A pocket's session logs, tasks and inbox, and Claude Code's per-house .claude/settings.local.json,
// are the house's own and in no piece; a pack's shipped memory is its own piece, memory:<Name>.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const OWN = ["session-logs", "tasks", "inbox"];
const LOCAL = ".claude/settings.local.json";

export function pieceRoot(id: string): { dir: string; skip: string[] } {
  if (id === "core") return { dir: "Pockets/_Template/core", skip: [] };
  if (id === "template") return { dir: "Pockets/_Template", skip: ["core"] };
  if (id.startsWith("pack:")) return { dir: `Pockets/${id.slice(5)}`, skip: ["core", "memory", ...OWN, LOCAL] };
  if (id.startsWith("memory:")) return { dir: `Pockets/${id.slice(7)}/memory`, skip: [] };
  if (id.startsWith("commons:")) return { dir: `Commons/${id.slice(8)}`, skip: [] };
  if (id.startsWith("plugin:")) return { dir: `plugins/${id.slice(7)}`, skip: ["node_modules"] };   // built in the house
  if (id.startsWith("house:")) return { dir: id.slice(6), skip: [] };
  throw new Error(`not a piece: ${id}`);
}

// sha256 over each file's path inside the piece and its own sha256, in path order; a link counts by its target.
export function pieceHash(root: string, id: string): string | null {
  const { dir, skip } = pieceRoot(id);
  const top = path.join(root, dir);
  if (!fs.existsSync(top)) return null;
  const lines: string[] = [];
  const walk = (rel: string) => {
    if (skip.includes(rel)) return;
    const abs = path.join(top, rel);
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) lines.push(`${rel}\0->${fs.readlinkSync(abs)}`);
    else if (st.isDirectory()) for (const e of fs.readdirSync(abs).sort()) walk(rel ? `${rel}/${e}` : e);
    else lines.push(`${rel}\0${crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex")}`);
  };
  walk("");
  return crypto.createHash("sha256").update(lines.join("\n")).digest("hex");
}

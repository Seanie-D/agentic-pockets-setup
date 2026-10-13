// A release piece's hash, in a house (the update system, ticket 01): the same hashing as the release build
// (Pockets/Jarvis/builds/first-run/publish/pieces.mjs, where the pieces are named). Both tests pin the same two hashes.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// A pocket's own: what its citizen writes, never part of a release piece.
const OWN = new Set(["core", "memory", "session-logs", "tasks", "inbox"]);

export function pieceRoot(id: string): { dir: string; skip: Set<string> } {
  if (id === "core") return { dir: "Pockets/_Template/core", skip: new Set() };
  if (id === "template") return { dir: "Pockets/_Template", skip: OWN };
  if (id.startsWith("pack:")) return { dir: `Pockets/${id.slice(5)}`, skip: OWN };
  if (id.startsWith("commons:")) return { dir: `Commons/${id.slice(8)}`, skip: new Set() };
  if (id.startsWith("plugin:")) return { dir: `plugins/${id.slice(7)}`, skip: new Set() };
  if (id.startsWith("house:")) return { dir: id.slice(6), skip: new Set() };
  throw new Error(`not a piece: ${id}`);
}

// sha256 over each file's path inside the piece and its own sha256, in path order; a link counts by its target.
export function pieceHash(root: string, id: string): string | null {
  const { dir, skip } = pieceRoot(id);
  const top = path.join(root, dir);
  if (!fs.existsSync(top)) return null;
  const lines: string[] = [];
  const walk = (rel: string) => {
    const abs = path.join(top, rel);
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) lines.push(`${rel}\0->${fs.readlinkSync(abs)}`);
    else if (st.isDirectory()) {
      for (const e of fs.readdirSync(abs).sort()) if (!(rel === "" && skip.has(e))) walk(rel ? `${rel}/${e}` : e);
    } else lines.push(`${rel}\0${crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex")}`);
  };
  walk("");
  return crypto.createHash("sha256").update(lines.join("\n")).digest("hex");
}

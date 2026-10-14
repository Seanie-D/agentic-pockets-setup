// The update system, ticket 01: a house hashes a release piece exactly as the release build does (publish/pieces.mjs
// pins the same fixture and the same two hashes), so the compare sees only real changes.
//   node --test test/pieces.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pieceHash } from "../server/pieces.ts";

test("the pinned hashes, shared with the release build", () => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "pin-"));
  const w = (f: string, b: string) => { fs.mkdirSync(path.dirname(path.join(r, f)), { recursive: true }); fs.writeFileSync(path.join(r, f), b); };
  w("Pockets/_Template/core/VERSION", "0.1.26\n"); w("Pockets/_Template/AGENTS.md", "# T\n"); w("Pockets/_Template/memory/log.md", "blank\n");
  w("Pockets/Verro/a.txt", "A\n"); w("Pockets/Verro/sub/b.txt", "B\n"); w("Pockets/Verro/memory/x.md", "mine\n");
  w("Pockets/Verro/.claude/settings.local.json", "{}\n"); w("Pockets/Verro/inbox/m.md", "mail\n"); w("Commons/tenets.md", "T\n");
  fs.symlinkSync("../../../Commons/tenets.md", path.join(r, "Pockets/Verro/sub/link.md"));
  const pins: Record<string, string> = {
    core: "9528aaa3f56f42eb71a8313febd9fa0817840ffedb3b587dc21825ac58ca1ad1",
    template: "34b067d18c98dccd05bcff7047a1fa1b83a1399f48d036df6667a0258f5cc0cb",
    "pack:Verro": "36d46af101f09ee776bd60236bbe630cd21aa0a8929e5005436b7b0ca78df921",
    "memory:Verro": "6c3eea93fbac299089f561e2d45818c7decd3c35ba885acd079f7815e3366217",
    "commons:tenets.md": "f3a12a12bf40b7f91e767347b059bcf0bf5c9d3b822ddd4e12774c23b3c44cf6",
  };
  for (const [id, h] of Object.entries(pins)) assert.equal(pieceHash(r, id), h, id);
  assert.equal(pieceHash(r, "pack:Nobody"), null);
});

// Beautiful Pockets (2026-10-14) is built in the house: its node_modules is no part of the piece, as in pieces.mjs.
test("a plugin's node_modules, built in the house, is no part of its piece's hash", () => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "pin-"));
  fs.mkdirSync(path.join(r, "plugins", "chat"), { recursive: true });
  fs.writeFileSync(path.join(r, "plugins", "chat", "index.ts"), "x\n");
  const before = pieceHash(r, "plugin:chat");
  fs.mkdirSync(path.join(r, "plugins", "chat", "node_modules", "y"), { recursive: true });
  fs.writeFileSync(path.join(r, "plugins", "chat", "node_modules", "y", "i.js"), "built\n");
  assert.equal(pieceHash(r, "plugin:chat"), before);
});

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
  w("Pockets/Verro/a.txt", "A\n"); w("Pockets/Verro/sub/b.txt", "B\n"); w("Pockets/Verro/memory/x.md", "mine\n"); w("Commons/tenets.md", "T\n");
  assert.equal(pieceHash(r, "pack:Verro"), "43761656f493d71c9d292ab24d50a66ce929b4e17f066c2d4b3f0f10b0ce5365");
  assert.equal(pieceHash(r, "commons:tenets.md"), "f3a12a12bf40b7f91e767347b059bcf0bf5c9d3b822ddd4e12774c23b3c44cf6");
  assert.equal(pieceHash(r, "pack:Nobody"), null);
});

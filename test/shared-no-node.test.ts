// Paseo builds shared/ into the screen's bundle too, and refuses a file there that loads a Node module (Austin's
// house, 2026-11-04 11:45 CST, on release 1.8: shared/workspace-here.ts imported node:fs, and setup did not build).
// Anything that reads the disk lives in server/.
//   node --test test/shared-no-node.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("no file in shared/ imports a Node module", () => {
  const dir = path.join(import.meta.dirname, "..", "shared");
  const bad = fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f))
    .filter((f) => /from\s+["'](node:|fs["']|os["']|path["']|crypto["']|child_process["'])/.test(fs.readFileSync(path.join(dir, f), "utf8")));
  assert.deepEqual(bad, []);
});

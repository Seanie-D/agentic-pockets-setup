// The house is the owner's alone, and the tenets load whole (Andrew Dempsey's two fixes, 2026-11-23).
//   node --test test/guard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { linkTenets, lockToOwner } from "../server/setup.ts";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "setup-guard-"));

test("the house folder is locked to its owner, except on Windows", () => {
  const d = tmp(); fs.chmodSync(d, 0o755);
  lockToOwner(d, "win32"); assert.equal(fs.statSync(d).mode & 0o777, 0o755);
  lockToOwner(d, "darwin"); assert.equal(fs.statSync(d).mode & 0o777, 0o700);
  lockToOwner(path.join(d, "none"), "darwin");   // not there yet: no throw
});

test("Pockets/CLAUDE.md links to the tenets; the owner's own file stays", () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, "Commons")); fs.mkdirSync(path.join(root, "Pockets"));
  fs.writeFileSync(path.join(root, "Commons", "tenets.md"), "# Tenets\n");
  linkTenets(root); linkTenets(root);
  const link = path.join(root, "Pockets", "CLAUDE.md");
  assert.equal(fs.readlinkSync(link), path.join("..", "Commons", "tenets.md"));
  assert.equal(fs.readFileSync(link, "utf8"), "# Tenets\n");
  fs.unlinkSync(link); fs.writeFileSync(link, "mine\n");
  linkTenets(root);
  assert.equal(fs.readFileSync(link, "utf8"), "mine\n");
});

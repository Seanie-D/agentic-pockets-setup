// The clean profile's sign-in (ticket 004): a new Claude folder is signed out, so the user signs in once before the house
// is placed. `claude auth status --json` with that folder says whether they have.
//   node --test test/profile.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { profileDir, signedIn, signedInTo } from "../server/profile.ts";

test("the house's own Claude folder sits beside its key, and sign-in is read from claude auth status in that folder", () => {
  assert.equal(profileDir("/Users/nick"), path.join("/Users/nick", ".agentic-pockets", "claude"));
  const seen: string[] = [];
  const exec = (out: string, status = 0) => (cmd: string, args: string[], o?: { env?: Record<string, string> }) => { seen.push(`${cmd} ${args.join(" ")} ${o?.env?.CLAUDE_CONFIG_DIR}`); return { status, stdout: out, stderr: "" }; };
  assert.equal(signedIn(exec('{ "loggedIn": true, "authMethod": "claude.ai" }'), "/Users/nick"), true);
  assert.equal(seen[0], `claude auth status --json ${path.join("/Users/nick", ".agentic-pockets", "claude")}`);
  assert.equal(signedIn(exec('{ "loggedIn": false }'), "/Users/nick"), false);
  assert.equal(signedIn(exec("", 127), "/Users/nick"), false, "no claude yet");
});

// Sean, from Friday's Mac walk, 2026-10-13 13:47 CDT: after setup installs Claude Code it never offered the sign-in.
// Every user now signs in to their own Claude right after the tools, read the same way with no folder set.
test("the user's own Claude: sign-in is read from claude auth status with no folder of the house's", () => {
  const seen: (string | undefined)[] = [];
  const exec = (out: string) => (_c: string, _a: string[], o?: { env?: Record<string, string> }) => { seen.push(o?.env?.CLAUDE_CONFIG_DIR); return { status: 0, stdout: out, stderr: "" }; };
  assert.equal(signedInTo(exec('{ "loggedIn": true }'), null), true);
  assert.equal(seen[0], undefined, "no CLAUDE_CONFIG_DIR: the user's own ~/.claude");
  assert.equal(signedInTo(exec('{ "loggedIn": false }'), null), false);
});

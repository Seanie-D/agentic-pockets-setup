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

// Friday's re-walk 3, 2026-10-14 14:06Z: the Mac kept yesterday's ~/.claude, so claude auth status read loggedIn, and the
// first desk failed with "OAuth session expired and could not be refreshed". auth status reads that credentials exist,
// not that they work, so a signed-in reading is proved by one small call to Claude before the screen says signed in.
const EXPIRED = '{ "is_error": true, "result": "Failed to authenticate: OAuth session expired and could not be refreshed" }';
const world = (probeStatus: number, out = probeStatus === 0 ? "{}" : EXPIRED, err = "") => {
  const calls: { args: string[]; dir?: string; timeout?: number }[] = [];
  const exec = (_c: string, args: string[], o?: { env?: Record<string, string>; timeout?: number }) => {
    calls.push({ args, dir: o?.env?.CLAUDE_CONFIG_DIR, timeout: o?.timeout });
    return args[0] === "auth" ? { status: 0, stdout: '{ "loggedIn": true }', stderr: "" } : { status: probeStatus, stdout: out, stderr: err };
  };
  return { exec, calls, probes: () => calls.filter((c) => c.args[0] === "-p") };
};

test("a login that auth status reads but Claude refuses is not signed in, and the probe runs in the same folder", () => {
  const w = world(1);
  assert.equal(signedInTo(w.exec, "/tmp/stale-a", 0), false);
  assert.equal(w.probes().length, 1);
  assert.equal(w.probes()[0].dir, "/tmp/stale-a");
  assert.ok(w.probes()[0].args.includes("--no-session-persistence"), "the probe leaves no session behind");
  assert.ok(!w.probes()[0].args.includes("--bare"), "--bare skips the keychain, where a Mac keeps the login");
  assert.ok(!w.probes()[0].args.includes("--setting-sources"), "a login may come from the user's settings (env, apiKeyHelper)");
  assert.ok(w.probes()[0].timeout! <= 25_000, "a hung probe must not hold the plugin server");
  assert.equal(signedInTo(world(1, '{ "is_error": true, "result": "Not logged in · Please run /login" }').exec, "/tmp/out-a2", 0), false);
  assert.equal(signedIn(world(0).exec, "/Users/fresh"), true, "a login Claude accepts is signed in");
});

test("the screen asks every 3 s, so a refused probe waits 10 s before it runs again, and a passed one 10 minutes", () => {
  const bad = world(1);
  signedInTo(bad.exec, "/tmp/stale-b", 0);
  signedInTo(bad.exec, "/tmp/stale-b", 9_000);
  assert.equal(bad.probes().length, 1, "no second probe inside 10 s");
  signedInTo(bad.exec, "/tmp/stale-b", 10_001);
  assert.equal(bad.probes().length, 2, "the user may have signed in again since");
  const good = world(0);
  signedInTo(good.exec, "/tmp/good-c", 0);
  assert.equal(signedInTo(good.exec, "/tmp/good-c", 599_000), true);
  assert.equal(good.probes().length, 1);
  signedInTo(good.exec, "/tmp/good-c", 600_001);
  assert.equal(good.probes().length, 2);
});

test("a signed-out reading runs no probe at all", () => {
  const calls: string[][] = [];
  const exec = (_c: string, args: string[]) => { calls.push(args); return { status: 0, stdout: '{ "loggedIn": false }', stderr: "" }; };
  assert.equal(signedInTo(exec, "/tmp/out-d", 0), false);
  assert.equal(calls.length, 1);
});

// The review, 2026-10-14: only an auth answer means signed out. A busy Claude, a usage limit, no network or a timeout
// says nothing about the login, so it reads signed in, as auth status did, and is not kept: the next ask probes again.
// Round 2: only the answer's own text is read (a number such as "duration_ms": 401 is not a refusal), and an unknown
// answer is kept 30 s, so an offline Mac is probed twice a minute, not on every 3 s ask.
test("a probe that fails for a reason other than the login reads signed in, and is kept only 30 s", () => {
  const busy = world(1, '{ "is_error": true, "duration_ms": 401, "result": "API Error: 529 Overloaded" }');
  assert.equal(signedInTo(busy.exec, "/tmp/busy-e", 0), true);
  signedInTo(busy.exec, "/tmp/busy-e", 29_000);
  assert.equal(busy.probes().length, 1, "no second probe inside 30 s");
  signedInTo(busy.exec, "/tmp/busy-e", 30_001);
  assert.equal(busy.probes().length, 2);
  assert.equal(signedInTo(world(127, "", "spawnSync claude ETIMEDOUT").exec, "/tmp/hung-f", 0), true);
});

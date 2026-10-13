// Friday's Mac walk, 2026-10-13: setup found Claude Code in ~/.local/bin, but Paseo's own PATH never holds that folder,
// so the first desk failed with "Provider 'claude' is not available". Setup now gives Paseo Claude's full path, only
// when Paseo cannot find it itself, and never over a command the user set.
//   node --test test/claude-path.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { findCommand, pinClaude, pinNode } from "../shared/claude-path.ts";

const files = new Set(["/Users/ada/.local/bin/claude", "C:\\Users\\ada\\WinGet\\claude.exe"]);
const isFile = (p: string) => files.has(p);

test("Claude is found in the first folder that holds it, by any of its names", () => {
  assert.equal(findCommand(["/usr/bin", "/Users/ada/.local/bin"], ["claude"], "/", isFile), "/Users/ada/.local/bin/claude");
  assert.equal(findCommand(["C:\\Windows", "C:\\Users\\ada\\WinGet\\"], ["claude.exe", "claude.cmd"], "\\", isFile), "C:\\Users\\ada\\WinGet\\claude.exe");
  assert.equal(findCommand(["/usr/bin", "/bin"], ["claude"], "/", isFile), null);
});

test("Paseo is given Claude's full path when only setup can find it, keeping the rest of its claude settings", () => {
  assert.deepEqual(pinClaude({ goose: { command: ["goose", "acp"] } }, "/Users/ada/.local/bin/claude", null),
    { goose: { command: ["goose", "acp"] }, claude: { command: ["/Users/ada/.local/bin/claude"] } });
  assert.deepEqual(pinClaude({ claude: { label: "Claude (Work)" } }, "/Users/ada/.local/bin/claude", null),
    { claude: { label: "Claude (Work)", command: ["/Users/ada/.local/bin/claude"] } });
});

test("nothing changes when Paseo finds Claude itself, when the user set a command, or when Claude is not found", () => {
  assert.equal(pinClaude({}, "/Users/ada/.local/bin/claude", "/usr/local/bin/claude"), null);
  assert.equal(pinClaude({ claude: { command: ["/opt/my/claude"] } }, "/Users/ada/.local/bin/claude", null), null);
  assert.equal(pinClaude({}, null, null), null);
});

// Friday's read of Sean's 15:51 walk, 2026-10-13: setup found Node in /opt/homebrew/bin and said Ready, but a desk's
// PATH never holds that folder, so the boot and clock hooks (node core/tools/okf.mjs …) could not run. Setup now gives
// each Claude provider of the house a PATH that starts with Node's folder, when Paseo's own PATH lacks it.
test("each Claude provider of the house is given Node's folder at the front of Paseo's own PATH", () => {
  const paseoPath = "/Applications/Paseo.app/Contents/Resources/bin:/usr/bin:/bin";
  assert.deepEqual(pinNode({ goose: { command: ["goose"] }, "claude-house": { extends: "claude", env: { CLAUDE_CONFIG_DIR: "/h" } } }, ["claude", "claude-house"], "/opt/homebrew/bin", paseoPath, ":"), {
    goose: { command: ["goose"] },
    claude: { env: { PATH: `/opt/homebrew/bin:${paseoPath}` } },
    "claude-house": { extends: "claude", env: { CLAUDE_CONFIG_DIR: "/h", PATH: `/opt/homebrew/bin:${paseoPath}` } },
  });
  assert.deepEqual(pinNode({}, ["claude"], "C:\\Program Files\\nodejs", "C:\\Windows", ";"), { claude: { env: { PATH: "C:\\Program Files\\nodejs;C:\\Windows" } } });
});

test("no PATH is given when Paseo's PATH has Node's folder, when the user set one, or when Node was not found", () => {
  assert.equal(pinNode({}, ["claude"], "/usr/local/bin", "/usr/local/bin:/usr/bin", ":"), null);
  assert.equal(pinNode({ claude: { env: { PATH: "/mine" } } }, ["claude"], "/opt/homebrew/bin", "/usr/bin", ":"), null);
  assert.equal(pinNode({}, ["claude"], null, "/usr/bin", ":"), null);
  assert.equal(pinNode({}, ["claude-house"], "/opt/homebrew/bin", "/usr/bin", ":"), null, "a provider the house does not have is not made");
});

// Review, 2026-10-13: on Windows the variable is "Path"; a provider env named "PATH" beside it is two keys for one.
test("on Windows the PATH goes under the name the system uses, and a folder already there is found in any case", () => {
  assert.deepEqual(pinNode({}, ["claude"], "C:\\Program Files\\nodejs", "C:\\Windows", ";", "Path"), { claude: { env: { Path: "C:\\Program Files\\nodejs;C:\\Windows" } } });
  assert.equal(pinNode({}, ["claude"], "C:\\Program Files\\nodejs", "c:\\program files\\nodejs;C:\\Windows", ";", "Path"), null);
  assert.equal(pinNode({ claude: { env: { path: "C:\\mine" } } }, ["claude"], "C:\\Program Files\\nodejs", "C:\\Windows", ";", "Path"), null);
});

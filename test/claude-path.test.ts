// Friday's Mac walk, 2026-10-13: setup found Claude Code in ~/.local/bin, but Paseo's own PATH never holds that folder,
// so the first desk failed with "Provider 'claude' is not available". Setup now gives Paseo Claude's full path, only
// when Paseo cannot find it itself, and never over a command the user set.
//   node --test test/claude-path.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { findCommand, pinClaude } from "../shared/claude-path.ts";

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

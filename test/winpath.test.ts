// Friday's Windows walk, 2026-10-13: winget installed Claude Code and wrote its folder into the user's PATH in the
// registry, but the running Paseo kept the PATH it started with, so setup said "Claude is still missing". Setup now
// reads PATH from the registry for every check and every command. And "How to get it" opens the Quickstart page.
//   node --test test/winpath.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { registryPath, joinPath } from "../shared/winpath.ts";
import { HELP } from "../shared/help-links.ts";

const HKCU = `
HKEY_CURRENT_USER\\Environment
    Path    REG_EXPAND_SZ    %USERPROFILE%\\AppData\\Local\\Microsoft\\WindowsApps;C:\\Users\\ada\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Anthropic.ClaudeCode_x;

`;
const HKLM = `
HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment
    Path    REG_EXPAND_SZ    C:\\Windows\\system32;%SystemRoot%;C:\\Program Files\\nodejs\\
`;

test("the registry's PATH is read from reg query, machine first, with %VARS% expanded", () => {
  const env = { USERPROFILE: "C:\\Users\\ada", SystemRoot: "C:\\Windows" };
  assert.deepEqual(registryPath(HKLM, HKCU, env), [
    "C:\\Windows\\system32", "C:\\Windows", "C:\\Program Files\\nodejs\\",
    "C:\\Users\\ada\\AppData\\Local\\Microsoft\\WindowsApps", "C:\\Users\\ada\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Anthropic.ClaudeCode_x",
  ]);
  assert.deepEqual(registryPath("", "ERROR: The system was unable to find the specified registry key or value.", env), []);
});

test("a tool installed after Paseo started is found: the registry's folders join the PATH, each once", () => {
  const got = joinPath(";", "C:\\Windows\\system32;C:\\old", ["C:\\Windows\\system32", "C:\\Users\\ada\\WinGet\\Claude"], ["C:\\extra"]);
  assert.equal(got, "C:\\Windows\\system32;C:\\old;C:\\Users\\ada\\WinGet\\Claude;C:\\extra");
});

test("How to get it for Claude opens the Quickstart page, not Advanced setup", () => {
  assert.equal(HELP.claude, "https://code.claude.com/docs/en/quickstart");
});

// Review round 1: Windows names it `Path`; a copy of process.env plus a new `PATH` key gives the child both, and which
// wins is not sure. The PATH is set under the name the environment already uses, once.
import { withPath } from "../shared/winpath.ts";
test("the PATH is set under the environment's own name for it, and only once", () => {
  assert.deepEqual(withPath({ Path: "C:\\old", TEMP: "x" }, "C:\\new"), { Path: "C:\\new", TEMP: "x" });
  assert.deepEqual(withPath({ PATH: "/usr/bin" }, "/new"), { PATH: "/new" });
  assert.deepEqual(withPath({ Path: "a", PATH: "b" }, "c"), { Path: "c" });
  assert.deepEqual(withPath({ HOME: "/h" }, "/p"), { HOME: "/h", PATH: "/p" });
});

// Friday's Mac walk, 2026-10-13: setup found Claude Code in ~/.local/bin, but Paseo's own PATH never holds that folder,
// so the first desk failed with "Provider 'claude' is not available". Setup gives Paseo the full path of a good copy when
// Paseo cannot find one itself or runs an old one (item 7a, choosePin below), and never over a command the user set.
//   node --test test/claude-path.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { findCommand, pinNode } from "../shared/claude-path.ts";

const files = new Set(["/Users/ada/.local/bin/claude", "C:\\Users\\ada\\WinGet\\claude.exe"]);
const isFile = (p: string) => files.has(p);

test("Claude is found in the first folder that holds it, by any of its names", () => {
  assert.equal(findCommand(["/usr/bin", "/Users/ada/.local/bin"], ["claude"], "/", isFile), "/Users/ada/.local/bin/claude");
  assert.equal(findCommand(["C:\\Windows", "C:\\Users\\ada\\WinGet\\"], ["claude.exe", "claude.cmd"], "\\", isFile), "C:\\Users\\ada\\WinGet\\claude.exe");
  assert.equal(findCommand(["/usr/bin", "/bin"], ["claude"], "/", isFile), null);
});

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

// Item 7a of the next update (the owner, Ultron's desk, 2026-10-15 16:15 CDT: "our tool to make sure it can adapt to any
// possible weird which-way that someone has their Claude Code installed"): each copy's origin, from where its command
// really lives; the newest copy new enough is picked; Paseo is told to use it when the copy it would run is not good.
import { originOf, pickClaude, choosePin, updateRoute } from "../shared/claude-path.ts";
test("each copy's origin is read from where it really lives", () => {
  const cases: [string, string | null][] = [
    ["/Users/n/.local/share/claude/versions/2.1.290", "Anthropic's installer"],
    ["C:\\Users\\n\\.local\\bin\\claude.exe", "Anthropic's installer"],
    ["/opt/homebrew/Caskroom/claude-code/2.1.300/claude", "Homebrew"],
    ["/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js", "npm"],
    ["/Users/n/.nvm/versions/node/v20.1.0/lib/node_modules/@anthropic-ai/claude-code/cli.js", "npm under nvm"],
    ["/Users/n/.volta/tools/image/packages/@anthropic-ai/claude-code/bin/claude", "Volta"],
    ["C:\\Users\\n\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Anthropic.ClaudeCode_x\\claude.exe", "winget"],
    ["/Applications/Claude Code.app/Contents/MacOS/claude", "an app"],
    ["/usr/bin/claude", null],
  ];
  for (const [p, o] of cases) assert.equal(originOf(p), o, p);
});

test("the newest copy new enough is picked; none new enough, none", () => {
  const copies = [{ at: "/a", version: "2.1.220", from: null }, { at: "/b", version: "2.1.300", from: null }, { at: "/c", version: "2.1.290", from: null }, { at: "/d", version: null, from: null }];
  assert.equal(pickClaude(copies, "2.1.280")?.at, "/b");
  assert.equal(pickClaude(copies.slice(0, 1), "2.1.280"), null);
});

test("Paseo is told to use the good copy when the one it runs is old or missing, or its own command is old; never when it already runs a good one", () => {
  const NEED = "2.1.280";
  const old = { at: "/usr/local/bin/claude", version: "2.1.140", from: "npm" as const }, good = { at: "/Users/n/.local/bin/claude", version: "2.1.300", from: "Anthropic's installer" as const };
  assert.deepEqual(choosePin({ claude: { env: { A: "1" } } }, [old, good], old.at, NEED), { claude: { env: { A: "1" }, command: [good.at] } }, "the old copy runs first");
  assert.deepEqual(choosePin({}, [good], null, NEED), { claude: { command: [good.at] } }, "only setup can find it");
  assert.equal(choosePin({}, [good, old], good.at, NEED), null, "Paseo already runs a good copy");
  assert.deepEqual(choosePin({ claude: { command: [old.at] } }, [old, good], old.at, NEED), { claude: { command: [good.at] } }, "its command names an old copy");
  assert.equal(choosePin({ claude: { command: ["/my/claude-wrapper"] } }, [old, good], old.at, NEED), null, "a command setup cannot read is the user's own, and kept");
  assert.equal(choosePin({}, [old], old.at, NEED), null, "no copy is new enough: nothing to point at");
});

test("each origin's own update route; an app, or a copy from nowhere known, has none", () => {
  assert.deepEqual(updateRoute({ at: "/Users/n/.local/bin/claude", version: "1", from: "Anthropic's installer" }, "darwin"), ["/Users/n/.local/bin/claude", "update"]);
  assert.deepEqual(updateRoute({ at: "/opt/homebrew/bin/claude", version: "1", from: "Homebrew" }, "darwin"), ["brew", "upgrade", "--cask", "claude-code"]);
  assert.deepEqual(updateRoute({ at: "/Users/n/.nvm/versions/node/v20/bin/claude", version: "1", from: "npm under nvm" }, "darwin"), ["/Users/n/.nvm/versions/node/v20/bin/npm", "install", "-g", "@anthropic-ai/claude-code@latest"]);
  assert.deepEqual(updateRoute({ at: "/Users/n/.volta/bin/claude", version: "1", from: "Volta" }, "darwin"), ["volta", "install", "@anthropic-ai/claude-code@latest"]);
  assert.deepEqual(updateRoute({ at: "C:\\x\\claude.exe", version: "1", from: "winget" }, "win32"), ["winget", "upgrade", "--id", "Anthropic.ClaudeCode", "--exact", "--silent", "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"]);
  assert.equal(updateRoute({ at: "/Applications/Claude Code.app/Contents/MacOS/claude", version: "1", from: "an app" }, "darwin"), null);
  assert.equal(updateRoute({ at: "/usr/bin/claude", version: "1", from: null }, "linux"), null);
});

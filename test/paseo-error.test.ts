// Sean's re-walk, 2026-10-13 16:43 CDT: Beautiful Chat failed on the Mac and setup's log said only "}" — the last line
// of Paseo's --json answer. The reason a Paseo command failed is its JSON error's message, or else its whole output.
//   node --test test/paseo-error.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { paseoError } from "../server/paseo-error.ts";

const json = `{\n  "error": {\n    "name": "DaemonRpcError",\n    "code": "handler_error",\n    "message": "Request failed: Plugin build command failed to start: \\"npm\\" \\"ci\\" \\"--include=dev\\": spawn npm ENOENT"\n  }\n}\n`;
const trust = "Trusting plugin code: server code and preparation commands run unsandboxed on the daemon host.\n";

const git = `{ "error": { "message": "Request failed: Git command failed: git clone --no-checkout -- https://x/nope.git (exit code: 128)\\nfatal: repository not found" } }`;

test("a failed --json command: the reason is the error's message, from either stream", () => {
  assert.equal(paseoError({ stdout: git, stderr: trust }), "Request failed: Git command failed: git clone --no-checkout -- https://x/nope.git (exit code: 128) fatal: repository not found");
  assert.equal(paseoError({ stdout: "", stderr: trust + git }), "Request failed: Git command failed: git clone --no-checkout -- https://x/nope.git (exit code: 128) fatal: repository not found");
});

// The Mac walk's cause: Paseo, opened from the Dock, has no Homebrew folder on its PATH, so a plugin's build step
// cannot start npm. Said in plain words, naming the command.
test("a command Paseo could not start is named in plain words", () => {
  assert.equal(paseoError({ stdout: json, stderr: trust }), "Paseo could not find the npm command: it is not in the folders Paseo looks in (spawn npm ENOENT)");
});

test("output that is not JSON: the whole of it, trimmed and capped, never one line alone", () => {
  assert.equal(paseoError({ stdout: "", stderr: "first reason\nsecond line\n" }), "first reason second line");
  assert.equal(paseoError({ stdout: "x".repeat(900), stderr: "" }).length, 400);
  assert.equal(paseoError({ stdout: "", stderr: "" }), "the Paseo command was not found");
});

// The tool check (ticket 004 Q2, Q7, Q8; the owner's yes to the test, 2026-10-12): it says what the machine has, what is too
// old and what is missing, lists the user-wide extras, and changes nothing that was already there.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkTools, listExtras } from "../server/tools.ts";

const fakeRun = (have: Record<string, string>) => {
  const calls: string[] = [];
  const run = (cmd: string, args: string[]) => {
    calls.push([cmd, ...args].join(" "));
    return cmd in have ? { status: 0, stdout: have[cmd] } : { status: 127, stdout: "" };
  };
  return { run, calls };
};

test("a machine with everything new enough: all ok", () => {
  const { run } = fakeRun({ node: "v24.16.0\n", git: "git version 2.43.0\n", claude: "2.1.270 (Claude Code)\n", paseo: "0.11.2\n" });
  assert.deepEqual(checkTools(run).map((t) => [t.name, t.state]), [["node", "ok"], ["git", "ok"], ["claude", "ok"], ["paseo", "ok"]]);
});

test("old and missing tools are named, with what is needed", () => {
  const { run } = fakeRun({ node: "v18.19.0\n", paseo: "0.10.4\n" });
  const r = checkTools(run);
  assert.deepEqual(r.map((t) => [t.name, t.state]), [["node", "old"], ["git", "missing"], ["claude", "missing"], ["paseo", "old"]]);
  assert.equal(r[0].have, "18.19.0"); assert.equal(r[0].need, "22.0.0");
});

test("the check only asks for versions: it runs nothing that could change the machine", () => {
  const { run, calls } = fakeRun({ node: "v24.0.0", git: "git version 2.40.0", claude: "2.1.0 (Claude Code)", paseo: "0.11.2" });
  checkTools(run);
  for (const c of calls) assert.match(c, /(--version|version)$/, `not a version query: ${c}`);
});

test("user-wide extras are listed by kind and name, and nothing is touched", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "home-"));
  const w = (f: string, body = "x") => { fs.mkdirSync(path.dirname(path.join(home, f)), { recursive: true }); fs.writeFileSync(path.join(home, f), body); };
  w(".claude/settings.json", JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "caveman" }] }] } }));
  w(".claude/skills/caveman/SKILL.md"); w(".claude/agents/cairn.md"); w(".claude/commands/startday.md");
  w("myPKA/old-project/notes.md", "Nick's old setup");
  const before = fs.readFileSync(path.join(home, ".claude/settings.json"), "utf8");
  const extras = listExtras(home);
  assert.deepEqual(extras.map((e) => `${e.kind}:${e.name}`).sort(), ["agent:cairn", "command:startday", "hook:SessionStart caveman", "skill:caveman"]);
  assert.equal(fs.readFileSync(path.join(home, ".claude/settings.json"), "utf8"), before);
  assert.equal(fs.readFileSync(path.join(home, "myPKA/old-project/notes.md"), "utf8"), "Nick's old setup");
});

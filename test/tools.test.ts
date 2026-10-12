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

// Install or update (ticket 004 Q7: "kept if new enough, updated if old, installed if missing"). A pretend machine:
// it answers the version and package-manager questions, and an install or upgrade changes what it answers next.
import { installTools } from "../server/tools.ts";

const machine = (o: { have: Record<string, string>; brew?: boolean; winget?: boolean; managed?: string[]; userScope?: string[] }) => {
  const have = { ...o.have }; const managed = new Set(o.managed ?? []); const calls: string[] = [];
  const LATEST: Record<string, string> = { node: "26.11.1", "OpenJS.NodeJS.LTS": "24.20.0", git: "2.55.0", "Git.Git": "2.55.0",
    "claude-code": "2.1.287", "Anthropic.ClaudeCode": "2.1.292" };
  const TOOL: Record<string, string> = { node: "node", "OpenJS.NodeJS.LTS": "node", git: "git", "Git.Git": "git", "claude-code": "claude", "Anthropic.ClaudeCode": "claude" };
  const ok = (stdout = "") => ({ status: 0, stdout }), no = { status: 1, stdout: "" };
  const run = (cmd: string, args: string[]) => {
    calls.push([cmd, ...args].join(" "));
    if (args[0] === "--version" && cmd in have) return ok(cmd === "git" ? `git version ${have[cmd]}\n` : `${have[cmd]}\n`);
    if (args[0] === "--version" && ((cmd === "brew" && o.brew) || (cmd === "winget" && o.winget))) return ok("1.0.0\n");
    if (args[0] === "--version") return { status: 127, stdout: "" };
    const pkg = args.find((a) => a in LATEST) ?? "";
    if (cmd === "brew" && args[0] === "list") return managed.has(pkg) ? ok(`${pkg} 1.0.0`) : no;
    if (cmd === "winget" && args[0] === "list") return managed.has(pkg) ? ok(pkg) : no;
    if ((cmd === "brew" && args[0] === "install") || (cmd === "winget" && args[0] === "install")) {
      if (cmd === "winget" && args.includes("--scope") && !(o.userScope ?? []).includes(pkg)) return { status: 1, stdout: "No applicable installer found; see logs for more details." };
      have[TOOL[pkg]] = LATEST[pkg]; managed.add(pkg); return ok();
    }
    if (args[0] === "upgrade") { if (!managed.has(pkg)) return no; have[TOOL[pkg]] = LATEST[pkg]; return ok(); }
    return no;
  };
  return { run, calls, have };
};

test("Mac: a missing tool is installed with Homebrew, Claude Code as its cask", () => {
  const m = machine({ have: { git: "2.39.5", paseo: "0.11.2" }, brew: true });
  const r = installTools(m.run, "darwin");
  assert.ok(m.calls.includes("brew install node"));
  assert.ok(m.calls.includes("brew install --cask claude-code"));
  assert.deepEqual(r.map((t) => [t.name, t.action, t.state]), [["node", "installed", "ok"], ["git", "kept", "ok"], ["claude", "installed", "ok"], ["paseo", "kept", "ok"]]);
});

test("a tool that is new enough is kept: nothing is installed or upgraded", () => {
  const m = machine({ have: { node: "24.1.0", git: "2.43.0", claude: "2.1.270", paseo: "0.11.2" }, brew: true });
  installTools(m.run, "darwin");
  assert.deepEqual(m.calls.filter((c) => / (install|upgrade) /.test(c)), []);
});

test("Mac: an old tool Homebrew manages is upgraded; an old one from elsewhere gets Homebrew's copy", () => {
  const m = machine({ have: { node: "18.19.0", git: "2.20.1", claude: "2.1.270", paseo: "0.11.2" }, brew: true, managed: ["node"] });
  const r = installTools(m.run, "darwin");
  assert.ok(m.calls.includes("brew upgrade node"));
  assert.ok(m.calls.includes("brew install git"));
  assert.deepEqual(r.slice(0, 2).map((t) => [t.name, t.action, t.state, t.have]), [["node", "updated", "ok", "26.11.1"], ["git", "updated", "ok", "2.55.0"]]);
});

test("Mac without Homebrew: nothing is run, and the tool says Homebrew comes first", () => {
  const m = machine({ have: { git: "2.39.5", paseo: "0.11.2" } });
  const r = installTools(m.run, "darwin");
  assert.deepEqual(m.calls.filter((c) => / (install|upgrade) /.test(c)), []);
  assert.equal(r[0].state, "missing"); assert.match(r[0].message ?? "", /Homebrew/);
});

test("Windows: a missing tool is installed with winget for this user only, quietly, with the agreements accepted", () => {
  const m = machine({ have: { node: "v24.1.0", paseo: "0.11.2" }, winget: true, userScope: ["Git.Git", "Anthropic.ClaudeCode"] });
  const r = installTools(m.run, "win32");
  assert.ok(m.calls.includes("winget install --id Git.Git --exact --scope user --silent --accept-package-agreements --accept-source-agreements --disable-interactivity"));
  assert.ok(m.calls.some((c) => c.startsWith("winget install --id Anthropic.ClaudeCode --exact --scope user")));
  assert.deepEqual(r.map((t) => [t.name, t.action, t.state]), [["node", "kept", "ok"], ["git", "installed", "ok"], ["claude", "installed", "ok"], ["paseo", "kept", "ok"]]);
});

test("Windows: when a tool has no installer for one user, winget tries again for the whole computer", () => {
  const m = machine({ have: { git: "2.45.0", claude: "2.1.270", paseo: "0.11.2" }, winget: true });
  const r = installTools(m.run, "win32");
  const node = m.calls.filter((c) => c.startsWith("winget install --id OpenJS.NodeJS.LTS"));
  assert.equal(node.length, 2); assert.ok(!node[1].includes("--scope"));
  assert.equal(r[0].action, "installed");
});

test("Windows: an old tool winget manages is upgraded", () => {
  const m = machine({ have: { node: "20.11.0", git: "2.45.0", claude: "2.1.270", paseo: "0.11.2" }, winget: true, managed: ["OpenJS.NodeJS.LTS"] });
  const r = installTools(m.run, "win32");
  assert.ok(m.calls.some((c) => c.startsWith("winget upgrade --id OpenJS.NodeJS.LTS --exact")));
  assert.deepEqual([r[0].action, r[0].have], ["updated", "24.20.0"]);
});

test("Windows without winget: nothing is run, and the tool names App Installer", () => {
  const m = machine({ have: { paseo: "0.11.2" } });
  const r = installTools(m.run, "win32");
  assert.deepEqual(m.calls.filter((c) => / (install|upgrade) /.test(c)), []);
  assert.match(r[0].message ?? "", /App Installer/);
});

test("Paseo is never installed by the plugin it hosts, and no command asks for admin", () => {
  for (const os of ["darwin", "win32"] as const) {
    const m = machine({ have: {}, brew: true, winget: true, userScope: ["Git.Git", "Anthropic.ClaudeCode"] });
    const r = installTools(m.run, os);
    assert.ok(!m.calls.some((c) => /paseo/i.test(c) && / (install|upgrade) /.test(c)));
    assert.ok(!m.calls.some((c) => /^sudo |runas|-Verb RunAs/.test(c)));
    assert.equal(r[3].action, "not done"); assert.match(r[3].message ?? "", /paseo\.sh/);
  }
});

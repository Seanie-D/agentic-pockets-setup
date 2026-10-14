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
  const { run } = fakeRun({ node: "v24.16.0\n", git: "git version 2.43.0\n", claude: "2.1.285 (Claude Code)\n", paseo: "0.11.2\n" });
  assert.deepEqual(checkTools(run).map((t) => [t.name, t.state]), [["node", "ok"], ["git", "ok"], ["claude", "ok"], ["paseo", "ok"]]);
});

// Friday's Windows walk, 2026-10-12 21:21Z: the app's own command is not on PATH (Program Files\Paseo\resources\bin on
// Windows, the app bundle on a Mac, /opt/Paseo on Linux), and the check called Paseo "Missing" while this plugin ran in it.
test("Paseo with no command on PATH is not missing: this plugin runs inside it, and Paseo enforces its 0.11.2 minimum", () => {
  const { run } = fakeRun({ node: "v24.16.0\n", git: "git version 2.43.0\n", claude: "2.1.285 (Claude Code)\n" });
  const p = checkTools(run).find((t) => t.name === "paseo")!;
  assert.equal(p.state, "ok"); assert.equal(p.have, "running");
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

const machine = (o: { have: Record<string, string>; brew?: boolean; winget?: boolean; managed?: string[]; userScope?: string[]; netDown?: boolean }) => {
  const have = { ...o.have }; const managed = new Set(o.managed ?? []); const calls: string[] = [];
  const LATEST: Record<string, string> = { node: "26.11.1", "OpenJS.NodeJS.LTS": "24.20.0", git: "2.55.0", "Git.Git": "2.55.0",
    "claude-code": "2.1.287", "Anthropic.ClaudeCode": "2.1.292" };
  const TOOL: Record<string, string> = { node: "node", "OpenJS.NodeJS.LTS": "node", git: "git", "Git.Git": "git", "claude-code": "claude", "Anthropic.ClaudeCode": "claude" };
  const ok = (stdout = "") => ({ status: 0, stdout }), no = { status: 1, stdout: "" };
  const run = (cmd: string, args: string[]) => {
    calls.push([cmd, ...args].join(" "));
    if (args[0] === "--version" && cmd in have) return ok(cmd === "git" ? `git version ${have[cmd]}\n` : `${have[cmd]}\n`);
    if (args[0] === "--version" && ((cmd === "brew" && o.brew) || (cmd === "winget" && o.winget))) return ok("1.0.0\n");
    if (cmd === "brew" && args[0] === "--prefix" && o.brew) return ok("/opt/homebrew\n");
    if (args[0] === "--version") return { status: 127, stdout: "" };
    const pkg = args.find((a) => a in LATEST) ?? "";
    if (cmd === "brew" && args[0] === "list") return managed.has(pkg) ? ok(`${pkg} 1.0.0`) : no;
    if (cmd === "winget" && args[0] === "list") return managed.has(pkg) ? ok(pkg) : no;
    if ((cmd === "brew" && args[0] === "install") || (cmd === "winget" && args[0] === "install")) {
      if (cmd === "winget" && o.netDown) return { status: 1, stdout: "Failed when searching source: winget\nAn unexpected error occurred while executing the command: InternetOpenUrl() failed." };
      if (cmd === "winget" && args.includes("--scope") && !(o.userScope ?? []).includes(pkg)) return { status: 1, stdout: "No applicable installer found; see logs for more details." };
      have[TOOL[pkg]] = LATEST[pkg]; managed.add(pkg); return ok();
    }
    if (args[0] === "upgrade") { if (!managed.has(pkg)) return no; have[TOOL[pkg]] = LATEST[pkg]; return ok(); }
    // The Mac route without Homebrew: the official downloads, for this user; Apple's tools window answers at once.
    if (cmd === "sh" && /nodejs\.org\/dist/.test(args[1] ?? "")) { have.node = "24.21.0"; return ok(); }
    if (cmd === "sh" && /claude\.ai\/install\.sh/.test(args[1] ?? "")) { have.claude = "2.1.290"; return ok(); }
    if (cmd === "xcode-select" && args[0] === "--install") return ok();
    return no;
  };
  return { run, calls, have };
};

test("Mac: a missing tool is installed with Homebrew, Claude Code as its cask", () => {
  const m = machine({ have: { git: "2.39.5", paseo: "0.11.2" }, brew: true });
  const r = installTools(m.run, "darwin", () => true);
  assert.ok(m.calls.includes("brew install node"));
  assert.ok(m.calls.includes("brew install --cask claude-code"));
  assert.deepEqual(r.map((t) => [t.name, t.action, t.state]), [["node", "installed", "ok"], ["git", "kept", "ok"], ["claude", "installed", "ok"], ["paseo", "kept", "ok"]]);
});

test("a tool that is new enough is kept: nothing is installed or upgraded", () => {
  const m = machine({ have: { node: "24.1.0", git: "2.43.0", claude: "2.1.285", paseo: "0.11.2" }, brew: true });
  installTools(m.run, "darwin", () => true);
  assert.deepEqual(m.calls.filter((c) => / (install|upgrade) /.test(c)), []);
});

test("Mac: an old tool Homebrew manages is upgraded; an old one from elsewhere gets Homebrew's copy", () => {
  const m = machine({ have: { node: "18.19.0", git: "2.20.1", claude: "2.1.285", paseo: "0.11.2" }, brew: true, managed: ["node"] });
  const r = installTools(m.run, "darwin", () => true);
  assert.ok(m.calls.includes("brew upgrade node"));
  assert.ok(m.calls.includes("brew install git"));
  assert.deepEqual(r.slice(0, 2).map((t) => [t.name, t.action, t.state, t.have]), [["node", "updated", "ok", "26.11.1"], ["git", "updated", "ok", "2.55.0"]]);
});

// The Mac route without Homebrew (the owner's yes to its three test points, 2026-10-12 14:40 CDT): used when Homebrew is
// missing or belongs to another user; a user's own Homebrew still comes first.
const noBrewRoute = (m: ReturnType<typeof machine>, r: ReturnType<typeof installTools>) => {
  const node = m.calls.find((c) => c.startsWith("sh -c") && c.includes("nodejs.org/dist"));
  assert.ok(node, "Node from its official package");
  assert.match(node!, /darwin-/); assert.match(node!, /\$HOME\/\.local/); assert.doesNotMatch(node!, /sudo/);
  assert.equal(r[0].action, "installed");
  const claude = m.calls.find((c) => c.startsWith("sh -c") && c.includes("https://claude.ai/install.sh"));
  assert.ok(claude, "Claude Code from Anthropic's installer"); assert.doesNotMatch(claude!, /sudo/);
  assert.equal(r[2].action, "installed");
  assert.ok(!m.calls.some((c) => c.startsWith("brew install") || c.startsWith("brew upgrade")), "no Homebrew");
};

test("Mac without Homebrew: Node and Claude Code from their official installers into the user's own folder, no password", () => {
  const m = machine({ have: { git: "2.39.5", paseo: "0.11.2" } });
  noBrewRoute(m, installTools(m.run, "darwin", () => true));
});

test("Mac without git: Apple's developer tools window opens, and the screen says what to click", () => {
  const m = machine({ have: { node: "24.16.0", claude: "2.1.285", paseo: "0.11.2" } });
  const r = installTools(m.run, "darwin", () => true);
  assert.ok(m.calls.includes("xcode-select --install"));
  assert.equal(r[1].action, "not done");
  assert.match(r[1].message ?? "", /Apple's developer tools window/); assert.match(r[1].message ?? "", /press Install again/); assert.match(r[1].message ?? "", /admin/);
});

test("Windows: a missing tool is installed with winget for this user only, quietly, with the agreements accepted", () => {
  const m = machine({ have: { node: "v24.1.0", paseo: "0.11.2" }, winget: true, userScope: ["Git.Git", "Anthropic.ClaudeCode"] });
  const r = installTools(m.run, "win32");
  assert.ok(m.calls.includes("winget install --id Git.Git --exact --scope user --silent --accept-package-agreements --accept-source-agreements --disable-interactivity"));
  assert.ok(m.calls.some((c) => c.startsWith("winget install --id Anthropic.ClaudeCode --exact --scope user")));
  assert.deepEqual(r.map((t) => [t.name, t.action, t.state]), [["node", "kept", "ok"], ["git", "installed", "ok"], ["claude", "installed", "ok"], ["paseo", "kept", "ok"]]);
});

test("Windows: when a tool has no installer for one user, winget tries again for the whole computer", () => {
  const m = machine({ have: { git: "2.45.0", claude: "2.1.285", paseo: "0.11.2" }, winget: true });
  const r = installTools(m.run, "win32");
  const node = m.calls.filter((c) => c.startsWith("winget install --id OpenJS.NodeJS.LTS"));
  assert.equal(node.length, 2); assert.ok(!node[1].includes("--scope"));
  assert.equal(r[0].action, "installed");
});

test("Windows: an old tool winget manages is upgraded", () => {
  const m = machine({ have: { node: "20.11.0", git: "2.45.0", claude: "2.1.285", paseo: "0.11.2" }, winget: true, managed: ["OpenJS.NodeJS.LTS"] });
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
    assert.equal(r[3].action, "kept", "Paseo is running this plugin, so it is kept, never installed");
  }
});

// The extras switch (ticket 004 Q8, settled (b)): each user-wide extra can be switched off for the new house only.
// Nothing in ~/.claude or ~/.paseo changes; the house's own pockets carry the switch.
import { applyExtrasOff } from "../server/tools.ts";

const homeWith = () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "home-"));
  const w = (f: string, body = "x") => { fs.mkdirSync(path.dirname(path.join(home, f)), { recursive: true }); fs.writeFileSync(path.join(home, f), body); };
  w(".claude/settings.json", JSON.stringify({ enabledPlugins: { "caveman@caveman": true, "old@shop": false },
    hooks: { UserPromptSubmit: [{ hooks: [{ type: "command", command: "/usr/local/bin/notify-me --loud" }] }] } }));
  w(".claude/plugins/installed_plugins.json", "{}"); w(".claude/plugins/cache/x/y.json"); w(".claude/plugins/marketplaces/caveman/z");
  w(".claude/skills/startday/SKILL.md"); w(".claude/agents/cairn.md", "---\nname: Cairn the Builder\ndescription: d\n---\nbody");
  w(".claude/commands/eod.md"); w(".claude/CLAUDE.md", "Always talk like a pirate.");
  w(".claude.json", JSON.stringify({ mcpServers: { todoist: { command: "npx" } } }));
  w(".paseo/config.json", JSON.stringify({ daemon: { appendSystemPrompt: "Be brief." }, plugins: { gruvbox: { enabled: true }, off: { enabled: false } } }));
  return home;
};

test("the extras list names what really reaches the house, and says which can be switched off for it alone", () => {
  const home = homeWith();
  const got = listExtras(home).map((e) => `${e.kind}:${e.name}:${e.switchable ? "switch" : "fixed"}`).sort();
  assert.deepEqual(got, [
    "agent:Cairn the Builder:switch", "command:eod:switch", "hook:UserPromptSubmit notify-me:fixed", "instructions:~/.claude/CLAUDE.md:switch",
    "mcp:todoist:switch", "paseo:gruvbox:fixed", "paseo:system prompt for every agent:fixed", "plugin:caveman@caveman:switch", "skill:startday:switch"]);
});

test("switching extras off writes only the house's own pockets, merged with what they hold, and leaves the user's files alone", () => {
  const home = homeWith(); const root = fs.mkdtempSync(path.join(os.tmpdir(), "house-"));
  for (const p of ["Verro", "Ultron", "_Template"]) fs.mkdirSync(path.join(root, "Pockets", p), { recursive: true });
  fs.mkdirSync(path.join(root, "Pockets", "Verro", ".claude"));
  fs.writeFileSync(path.join(root, "Pockets", "Verro", ".claude", "settings.local.json"), JSON.stringify({ permissions: { deny: ["Bash(rm -rf *)"] }, theme: "dark" }));
  const userFiles = [".claude/settings.json", ".claude.json", ".paseo/config.json", ".claude/CLAUDE.md"].map((f) => fs.readFileSync(path.join(home, f), "utf8"));
  const extras = listExtras(home);
  const off = extras.filter((e) => e.kind !== "skill").map((e) => e.id);
  const r = applyExtrasOff(root, extras, off);

  const verro = JSON.parse(fs.readFileSync(path.join(root, "Pockets", "Verro", ".claude", "settings.local.json"), "utf8"));
  assert.equal(verro.theme, "dark");
  assert.deepEqual(verro.permissions.deny.sort(), ["Agent(Cairn the Builder)", "Bash(rm -rf *)", "mcp__todoist"]);
  assert.deepEqual(verro.skillOverrides, { eod: "off" });
  assert.deepEqual(verro.enabledPlugins, { "caveman@caveman": false });
  assert.deepEqual(verro.claudeMdExcludes, [path.join(home, ".claude", "CLAUDE.md")]);
  for (const p of ["Ultron", "_Template"]) assert.ok(fs.existsSync(path.join(root, "Pockets", p, ".claude", "settings.local.json")));
  assert.deepEqual(r.fixed.map((e) => e.kind).sort(), ["hook", "paseo", "paseo"]);
  assert.deepEqual([".claude/settings.json", ".claude.json", ".paseo/config.json", ".claude/CLAUDE.md"].map((f) => fs.readFileSync(path.join(home, f), "utf8")), userFiles);

  // Run twice (a pocket added later): nothing doubles.
  applyExtrasOff(root, extras, off);
  const again = JSON.parse(fs.readFileSync(path.join(root, "Pockets", "Verro", ".claude", "settings.local.json"), "utf8"));
  assert.equal(again.permissions.deny.length, 3);
});

test("extras are named as a person would know them: a hook by its script, only real skills, not the house's own plugins", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "home-"));
  const w = (f: string, body = "x") => { fs.mkdirSync(path.dirname(path.join(home, f)), { recursive: true }); fs.writeFileSync(path.join(home, f), body); };
  w(".claude/settings.json", JSON.stringify({ hooks: { SessionStart: [{ hooks: [
    { type: "command", command: "node /home/u/.claude/hooks/caveman-activate.js" },
    { type: "command", command: "node \"${CLAUDE_PLUGIN_ROOT}/hooks/cache-heal.mjs\"" }] }] } }));
  w(".claude/skills/eod/SKILL.md"); w(".claude/skills/synced/notes.txt");
  w(".paseo/config.json", JSON.stringify({ plugins: { "agentic-pockets": { enabled: true }, "agentic-pockets-setup": { enabled: true }, gruvbox: { enabled: true } } }));
  assert.deepEqual(listExtras(home).map((e) => e.id).sort(),
    ["hook:SessionStart cache-heal.mjs", "hook:SessionStart caveman-activate.js", "paseo:gruvbox", "skill:eod"]);
});

test("Windows: a per-user install that fails for another reason is not retried for the whole computer, and says why", () => {
  const m = machine({ have: { git: "2.45.0", claude: "2.1.285", paseo: "0.11.2" }, winget: true, netDown: true });
  const r = installTools(m.run, "win32");
  assert.equal(m.calls.filter((c) => c.startsWith("winget install --id OpenJS.NodeJS.LTS")).length, 1, "no admin prompt for a network failure");
  assert.equal(r[0].action, "not done"); assert.match(r[0].message ?? "", /InternetOpenUrl|could not reach|internet/i);
});

test("Windows: a tool installed for the whole computer says so, so the user knows why Windows asked to allow changes", () => {
  const m = machine({ have: { git: "2.45.0", claude: "2.1.285", paseo: "0.11.2" }, winget: true });
  const r = installTools(m.run, "win32");
  assert.equal(r[0].action, "installed"); assert.match(r[0].message ?? "", /whole computer/);
});

test("Mac: Homebrew that belongs to another user is left alone, and the route without Homebrew installs for this user", () => {
  const m = machine({ have: { git: "2.39.5", paseo: "0.11.2" }, brew: true });
  noBrewRoute(m, installTools(m.run, "darwin", () => false));
});

// An invitee on 1.0, 2026-10-14 14:53 CDT: Claude Code 2.1.140 passed the old 2.1.0 floor, and the first desk failed with
// "API Error: 400 Claude Code 2.1.140 does not support this model; version 2.1.280 or newer is required." The floor is
// what the release's models need, so setup offers the update before any desk opens.
test("a Claude Code too old for the release's models is old, so setup offers the update", () => {
  const { run } = fakeRun({ node: "v24.16.0\n", git: "git version 2.43.0\n", claude: "2.1.140 (Claude Code)\n", paseo: "0.11.2\n" });
  const c = checkTools(run).find((t) => t.name === "claude")!;
  assert.equal(c.state, "old"); assert.equal(c.have, "2.1.140"); assert.equal(c.need, "2.1.280");
});

// Nick's setup on 1.0.1, 2026-10-14 15:52 CDT: Claude Code 2.1.220 read too old, Install ran, and the check said
// "claude is still too old after the install": the installer's new copy went to ~/.local/bin, and an old npm copy in
// /usr/local/bin still ran first. Setup now names every copy, the one that runs first and where it came from, and how
// to remove it; it removes nothing itself.
test("Claude Code still too old after the install: setup names the old copy that runs first and how to remove it", () => {
  const OLD = "/usr/local/bin/claude", NEW = "/Users/nick/.local/bin/claude";
  const real: Record<string, string> = { [OLD]: "/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js", [NEW]: "/Users/nick/.local/share/claude/versions/2.1.290" };
  const VER: Record<string, string> = { claude: "2.1.220", [OLD]: "2.1.220", [NEW]: "2.1.290", node: "24.16.0", git: "2.43.0", paseo: "0.11.2" };
  const run = (cmd: string, args: string[]) => {
    if (args[0] === "--version" && cmd in VER) return { status: 0, stdout: `${VER[cmd]} (x)\n` };
    if (cmd === "which" && args.join(" ") === "-a claude") return { status: 0, stdout: `${OLD}\n${NEW}\n` };
    if (cmd === "sh") return { status: 0, stdout: "" };   // the installer runs, and the old copy still runs first
    return { status: 1, stdout: "" };
  };
  const r = installTools(run, "darwin", () => true, (p) => real[p] ?? p).find((t) => t.name === "claude")!;
  assert.equal(r.action, "not done");
  assert.match(r.message!, /\/usr\/local\/bin\/claude \(2\.1\.220, an npm install\) runs first/);
  assert.match(r.message!, /\/Users\/nick\/\.local\/bin\/claude \(2\.1\.290\)/);
  assert.match(r.message!, /sudo npm uninstall -g @anthropic-ai\/claude-code/);
  assert.match(r.message!, /quit Paseo, open it again, and press Check again/);
});

// Nick's real case (Sean's photo, 15:55 CDT): the copy that ran first was Anthropic's own install in ~/.local/bin, at
// 2.1.220; Homebrew's copy came after it. `claude update` fixed it. Setup now runs that copy's own update itself.
test("Claude Code still too old because Anthropic's own older install runs first: setup updates that copy itself", () => {
  const LOCAL = "/Users/nickloux/.local/bin/claude", BREW = "/opt/homebrew/bin/claude";
  const real: Record<string, string> = { [LOCAL]: "/Users/nickloux/.local/share/claude/versions/2.1.220", [BREW]: "/opt/homebrew/Caskroom/claude-code/2.1.300/claude" };
  const VER: Record<string, string> = { claude: "2.1.220", [LOCAL]: "2.1.220", [BREW]: "2.1.300", node: "24.16.0", git: "2.43.0", paseo: "0.11.2", brew: "4.0.0" };
  const calls: string[] = [];
  const run = (cmd: string, args: string[]) => {
    calls.push([cmd, ...args].join(" "));
    if (args[0] === "--version" && cmd in VER) return { status: 0, stdout: `${VER[cmd]} (x)\n` };
    if (cmd === "brew" && args[0] === "--prefix") return { status: 0, stdout: "/opt/homebrew\n" };
    if (cmd === "brew" && args[0] === "list") return { status: 0, stdout: "claude-code 2.1.300" };
    if (cmd === "brew") return { status: 0, stdout: "" };
    if (cmd === "which" && args.join(" ") === "-a claude") return { status: 0, stdout: `${LOCAL}\n${BREW}\n${BREW}\n` };
    if (cmd === LOCAL && args[0] === "update") { VER[LOCAL] = VER.claude = "2.1.300"; return { status: 0, stdout: "Successfully updated from 2.1.220 to version 2.1.300\n" }; }
    return { status: 1, stdout: "" };
  };
  const r = installTools(run, "darwin", () => true, (p) => real[p] ?? p).find((t) => t.name === "claude")!;
  assert.ok(calls.includes(`${LOCAL} update`), calls.join("\n"));
  assert.equal(r.state, "ok"); assert.equal(r.action, "updated"); assert.equal(r.have, "2.1.300");
  assert.equal(r.message, undefined);
});

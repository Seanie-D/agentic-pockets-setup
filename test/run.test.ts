// A full setup run against a fake doorman and a fake Paseo (ticket 004 Resolution steps 3–5; Sean's yes to the test,
// 2026-10-12): it makes the house key, uses the invite, downloads the house, creates a workspace with its icon for each
// picked citizen, and opens the first desk.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runSetup, type Deps } from "../server/setup.ts";

function upstream() {
  const u = fs.mkdtempSync(path.join(os.tmpdir(), "upstream-"));
  const w = (f: string, body = "x") => { fs.mkdirSync(path.dirname(path.join(u, f)), { recursive: true }); fs.writeFileSync(path.join(u, f), body); };
  w("Commons/tenets.md", "11. **Scripts flag, {{USER_NAME}} decides.**\n"); w("Commons/skills/x/SKILL.md", "Fill {{SKIPS}} here; {{USER_NAME}} owns it.\n"); w("Pockets/_Template/core/VERSION", "0.1.22");
  w("plugins/agentic-pockets/paseo-plugin.json", '{ "id": "agentic-pockets" }');
  for (const n of ["Ultron", "Jarvis", "Verro", "Vision", "Friday", "MissMinutes"]) { w(`Pockets/${n}/AGENTS.md`, `# ${n}`); w(`Pockets/${n}/face.png`, `png-${n}`); }
  return u;
}
function world(opts: { claim?: number; cafeFails?: boolean; chatFails?: boolean; installed?: string[] } = {}) {
  const up = upstream(); const home = fs.mkdtempSync(path.join(os.tmpdir(), "home-")); const root = path.join(home, "agentic-pockets");
  const log: string[] = []; const posts: any[] = [];
  const deps: Deps = {
    exec: (cmd, args, o) => {
      log.push(`${cmd} ${args.join(" ")}${o?.env?.GIT_SSH_COMMAND ? ` [ssh: ${o.env.GIT_SSH_COMMAND}]` : ""}`);
      if (cmd === "ssh-keygen") { const f = args[args.indexOf("-f") + 1]; fs.writeFileSync(f, "PRIVATE"); fs.writeFileSync(`${f}.pub`, "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHouseKeyHouseKeyHouseKeyHouseKeyHouseKe house"); return { status: 0, stdout: "", stderr: "" }; }
      if (cmd === "git" && args[0] === "clone") { fs.cpSync(up, args[args.length - 1], { recursive: true }); return { status: 0, stdout: "", stderr: "" }; }
      if (cmd === "git") return { status: 0, stdout: "", stderr: "" };
      if (cmd === "claude") { log[log.length - 1] += ` @${path.basename(o?.cwd ?? "?")}`; return { status: 0, stdout: "", stderr: "" }; }
      return { status: 1, stdout: "", stderr: `unexpected ${cmd}` };
    },
    fetch: async (url, init) => {
      posts.push({ url, body: JSON.parse(String(init?.body)) });
      const s = opts.claim ?? 200;
      return new Response(JSON.stringify(s === 200 ? { repo: "git@github.com:Seanie-D/agentic-pockets.git" } : { error: "this invite has already been used" }), { status: s });
    },
    ops: {
      createWorkspace: async ({ dir, title }) => { log.push(`workspace ${title} ${dir}`); return { workspaceId: `wks_${title}`, projectId: `prj_${title}` }; },
      setIcon: async (projectId, png) => { log.push(`icon ${projectId} ${fs.readFileSync(png, "utf8")}`); },
      addPlugin: async (id, dir) => { log.push(`plugin ${id} ${dir}`); return { running: true }; },
      addProvider: async (id, configDir) => { log.push(`provider ${id} ${configDir}`); },
      installGitPlugin: async (source, ref) => { log.push(`gitplugin ${source}${ref ? ` @${ref}` : ""}`); if (source.includes("paseo-cafe") ? opts.cafeFails : opts.chatFails) throw new Error("no paseo command"); },
      hasPlugin: async (id) => (opts.installed ?? []).includes(id),
      welcome: async (agentId, citizen) => { log.push(`welcome ${agentId} ${citizen}`); },
      openDesk: async (o) => { log.push(`desk ${o.title} ${o.provider}/${o.model} ${JSON.stringify(o.labels)} cwd=${o.cwd}`); return { agentId: "agent-1" }; },
    },
    hostname: () => "Nicks-MacBook", doorman: "https://doorman.example", now: () => "2026-10-14T13:00:00.000Z",
  };
  return { deps, home, root, log, posts };
}
const accounts = { Ultron: "claude", Verro: "claude", Vision: "claude" };

test("a full run: key, invite, house, a workspace and face per citizen, the first desk on Ultron", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Ultron", "Verro", "Vision"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  const key = path.join(w.home, ".agentic-pockets", "keys", "house_ed25519");
  assert.ok(w.log.some((l) => l.startsWith(`ssh-keygen -t ed25519`) && l.includes(key)));
  assert.equal((fs.statSync(path.join(w.home, ".agentic-pockets", "keys")).mode & 0o777), 0o700);
  assert.deepEqual(w.posts[0], { url: "https://doorman.example/claim", body: { code: "INVITE-CODE-123456789", publicKey: fs.readFileSync(`${key}.pub`, "utf8").trim(), house: "Nicks-MacBook" } });
  assert.ok(w.log.some((l) => l.startsWith("git clone") && l.includes("git@github.com:Seanie-D/agentic-pockets.git") && l.includes(`-i ${key}`)), "cloned with the house key");
  for (const n of ["Ultron", "Verro", "Vision"]) assert.ok(fs.existsSync(path.join(w.root, "Pockets", n, "AGENTS.md")), `${n} is in the house`);
  assert.ok(!fs.existsSync(path.join(w.root, "Pockets", "Friday")), "a citizen not picked stays out");
  assert.ok(fs.existsSync(path.join(w.root, "Commons", "tenets.md")) && fs.existsSync(path.join(w.root, "Pockets", "_Template", "core", "VERSION")));
  assert.deepEqual(w.log.filter((l) => l.startsWith("workspace")).map((l) => l.split(" ")[1]), ["Ultron", "Verro", "Vision", "Jarvis"]);
  assert.deepEqual(w.log.filter((l) => l.startsWith("icon")), ["icon prj_Ultron png-Ultron", "icon prj_Verro png-Verro", "icon prj_Vision png-Vision", "icon prj_Jarvis png-Jarvis"]);
  const desks = w.log.filter((l) => l.startsWith("desk"));
  assert.equal(desks.length, 1); assert.match(desks[0], /^desk Ultron — desk claude\/\S+ \{"role":"desk"\} cwd=.*Pockets\/Ultron$/);
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.citizens, ["Jarvis", "Ultron", "Verro", "Vision"]); assert.equal(rec.setupDone, false);
});

test("one citizen alone: its own desk is the first desk", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.match(w.log.find((l) => l.startsWith("desk"))!, /^desk Verro — desk/);
});

test("a used invite stops the run before anything is downloaded, and says so plainly", async () => {
  const w = world({ claim: 409 });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, false); assert.match(r.message, /already been used/);
  assert.ok(!w.log.some((l) => l.startsWith("git clone")) && !fs.existsSync(w.root));
});

test("an existing pocket of the user's is never overwritten on a second run", async () => {
  const w = world();
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  fs.writeFileSync(path.join(w.root, "Pockets", "Verro", "AGENTS.md"), "# Verro, as the user changed it");
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro", "Vision"], accounts: { Verro: "claude", Vision: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(fs.readFileSync(path.join(w.root, "Pockets", "Verro", "AGENTS.md"), "utf8"), "# Verro, as the user changed it");
  assert.ok(fs.existsSync(path.join(w.root, "Pockets", "Vision", "AGENTS.md")));
});

test("the user's own name fills the tenets' slot when the house is placed, and is kept in the house record", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.equal(fs.readFileSync(path.join(w.root, "Commons", "tenets.md"), "utf8"), "11. **Scripts flag, Nick decides.**\n");
  assert.equal(fs.readFileSync(path.join(w.root, "Commons", "skills", "x", "SKILL.md"), "utf8"), "Fill {{SKIPS}} here; Nick owns it.\n", "only the name slot is filled");
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8")).userName, "Nick");
});

test("no name, no run: setup asks for it before anything is placed", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "  ", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, false); assert.match(r.message, /name/i);
  assert.ok(!fs.existsSync(w.root));
});

test("the house record keeps each citizen's desk row (account, model, workspace), so the house plugin can open its desks", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Ultron", "Verro"], accounts: { Ultron: "claude", Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.desks, {
    Ultron: { provider: "claude", model: "claude-opus-5-5", workspaceId: "wks_Ultron" },
    Verro: { provider: "claude", model: "claude-opus-5-5", workspaceId: "wks_Verro" },
    Jarvis: { provider: "claude", model: "claude-opus-5-5", workspaceId: "wks_Jarvis" },
  });
});

test("the extras the user switched off are in every new pocket before its first desk opens, and kept in the house record", async () => {
  const w = world();
  let seenAtOpen: any = null;
  const open = w.deps.ops.openDesk;
  w.deps.ops.openDesk = async (o) => { try { seenAtOpen = JSON.parse(fs.readFileSync(path.join(o.cwd, ".claude", "settings.local.json"), "utf8")); } catch { seenAtOpen = "missing"; } return open(o); };
  const extras = [{ id: "skill:caveman", kind: "skill" as const, name: "caveman", where: "~/.claude/skills/caveman", switchable: true }];
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home, extras, extrasOff: ["skill:caveman"] }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(seenAtOpen?.skillOverrides, { caveman: "off" }, "the first desk starts with the extra already off");
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.extrasOff, ["skill:caveman"]);
  assert.deepEqual(rec.extrasSettings, { skillOverrides: { caveman: "off" } }, "the settings a citizen added later gets (the Citizens tab)");
});

test("Jarvis comes with every house: his pocket, workspace and desk row on the first citizen's account, but not the first desk", async () => {
  // Ticket 004 Q16, ruled 2026-10-12: Jarvis joins "At setup, always"; he does not count toward Ultron's two or more.
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "codex" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.equal(fs.readFileSync(path.join(w.root, "Pockets", "Jarvis", "AGENTS.md"), "utf8"), "---\ntier: on-call\n---\n# Jarvis", "his pack, with the house's tier");
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.citizens, ["Jarvis", "Verro"]);
  assert.deepEqual(rec.desks.Jarvis, { provider: "codex", model: rec.desks.Verro.model, workspaceId: "wks_Jarvis" });
  assert.deepEqual(w.log.filter((l) => l.startsWith("desk")).map((l) => l.split(" — ")[0]), ["desk Verro"]);
  assert.equal(r.firstDesk?.citizen, "Verro");
});

// The seasonings (Friday's recipe, Deliverables/2026-10-12-friday-seans-seasonings-recipe.md; ruled 2026-10-12 13:50 CDT:
// house only): caveman at level full and context-mode, switched on for each citizen's folder, plus four settings.
const settingsOf = (root: string, n: string) => JSON.parse(fs.readFileSync(path.join(root, "Pockets", n, ".claude", "settings.json"), "utf8"));

test("seasonings: caveman and context-mode switched on in every citizen's folder, with the four settings, and kept in the house record", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  for (const n of ["Verro", "Jarvis"]) {
    for (const [plugin, repo] of [["caveman@caveman", "JuliusBrussee/caveman"], ["context-mode@context-mode", "mksglu/context-mode"]]) {
      assert.ok(w.log.includes(`claude plugin marketplace add ${repo} --scope project @${n}`), `${repo} known in ${n}`);
      assert.ok(w.log.includes(`claude plugin install ${plugin} --scope project @${n}`), `${plugin} on in ${n}`);
    }
    const s = settingsOf(w.root, n);
    assert.equal(s.autoCompactEnabled, false); assert.equal(s.autoMemoryEnabled, false);
    assert.deepEqual(s.env, { BASH_MAX_OUTPUT_LENGTH: "150000", CAVEMAN_DEFAULT_MODE: "full" });
  }
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.seasonSettings.enabledPlugins, { "caveman@caveman": true, "context-mode@context-mode": true });
  assert.deepEqual(rec.seasonSettings.extraKnownMarketplaces.caveman, { source: { source: "github", repo: "JuliusBrussee/caveman" } });
  assert.equal(rec.seasonSettings.autoMemoryEnabled, false);
});

test("seasonings: one the user already has in their own Claude is left to theirs, so it never runs twice", async () => {
  const w = world();
  fs.mkdirSync(path.join(w.home, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(w.home, ".claude", "settings.json"), JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "node ~/.claude/hooks/caveman-activate.js" }] }] } }));
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.ok(!w.log.some((l) => l.includes("caveman")), "no caveman install");
  assert.ok(w.log.includes("claude plugin install context-mode@context-mode --scope project @Verro"));
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.seasonSettings.enabledPlugins, { "context-mode@context-mode": true });
  assert.ok(r.steps.some((s) => /Left caveman to your own Claude/.test(s)));
});

// Ticket 004 Q2: the house plugin travels with setup. It holds the house's machinery (the Mailman, the nightly clock-out,
// the save point) and its views, so setup places it in the house and adds it to Paseo before the first desk opens.
test("the house plugin is placed in the house and added to Paseo before the first desk opens", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  const dir = path.join(w.root, "plugins", "agentic-pockets");
  assert.ok(fs.existsSync(path.join(dir, "paseo-plugin.json")), "placed in the house");
  const at = w.log.findIndex((l) => l === `plugin agentic-pockets ${dir}`);
  assert.ok(at >= 0, "added to Paseo"); assert.ok(at < w.log.findIndex((l) => l.startsWith("desk")), "before the first desk");
});

test("when Paseo will not add the house plugin, setup goes on and says so plainly", async () => {
  const w = world();
  w.deps.ops.addPlugin = async () => { throw new Error("plugins are switched off in Paseo"); };
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.ok(r.steps.some((s) => s.includes("could not add the house plugin") && s.includes("plugins are switched off in Paseo")), r.steps.join(" | "));
});

// Proven 2026-10-12 on a test Paseo: Paseo keeps a plugin added through its config, but starts it only at its next start or
// on a reload. When setup cannot reload it, the user is told the one thing to do.
test("when the house plugin is added but not started, setup tells the user to open Paseo again", async () => {
  const w = world();
  w.deps.ops.addPlugin = async () => ({ running: false });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.ok(r.steps.includes("Added the house plugin to Paseo. It starts the next time Paseo starts: quit Paseo and open it again."), r.steps.join(" | "));
});

// Ticket 004, the clean profile (the owner, via Ultron 2026-10-12 17:43Z: "it intelligently detects the user's other hooks"):
// when the user has hooks of their own and picks it, the house runs Claude from its own folder, as a Paseo provider.
test("a clean profile: the house's own Claude provider is added, and every Claude desk uses it", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Ultron", "Verro"], accounts: { Ultron: "claude", Verro: "opencode" }, root: w.root, home: w.home, cleanProfile: true }, w.deps);
  assert.equal(r.ok, true, r.message);
  const at = w.log.indexOf(`provider claude-house ${path.join(w.home, ".agentic-pockets", "claude")}`);
  assert.ok(at >= 0 && at < w.log.findIndex((l) => l.startsWith("desk")), "added before the first desk");
  assert.match(w.log.find((l) => l.startsWith("desk"))!, /^desk Ultron — desk claude-house\//);
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.equal(rec.desks.Ultron.provider, "claude-house"); assert.equal(rec.desks.Jarvis.provider, "claude-house");
  assert.equal(rec.desks.Verro.provider, "opencode", "another provider is left as picked");
});

test("without the clean profile nothing changes: no provider is added", async () => {
  const w = world();
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Ultron"], accounts: { Ultron: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.ok(!w.log.some((l) => l.startsWith("provider")));
  assert.match(w.log.find((l) => l.startsWith("desk"))!, /^desk Ultron — desk claude\//);
});

// The welcome in the first desk chat (the owner via Ultron, 2026-10-12 21:31Z): a row the plugin puts at the top of the
// first desk's chat, once, right after the desk opens. Off until the owner has read its text.
test("with the welcome on, the first desk's chat gets one welcome row naming its citizen, right after it opens", async () => {
  const w = world();
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Ultron", "Verro"], accounts, root: w.root, home: w.home, welcome: true }, w.deps);
  const rows = w.log.filter((l) => l.startsWith("welcome"));
  assert.deepEqual(rows, ["welcome agent-1 Ultron"]);
  assert.equal(w.log.indexOf(rows[0]), w.log.findIndex((l) => l.startsWith("desk")) + 1);
});

test("with the welcome off, no row is added; it is on by default since the owner approved its text", async () => {
  const w = world();
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home, welcome: false }, w.deps);
  assert.ok(!w.log.some((l) => l.startsWith("welcome")));
  const on = world();
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: on.root, home: on.home }, on.deps);
  assert.deepEqual(on.log.filter((l) => l.startsWith("welcome")), ["welcome agent-1 Verro"]);
});

// How the citizens run (ticket 004 Q11): "On-demand is the default; always-on is a choice." The choice is each placed
// citizen's contract tier (the one source the house plugin and the boot read), and the house record keeps it.
const tierIn = (root: string, n: string) => /^tier: (\S+)$/m.exec(fs.readFileSync(path.join(root, "Pockets", n, "AGENTS.md"), "utf8"))?.[1];
test("on demand by default: every placed citizen's contract says tier on-call, and the house record says on-demand", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Ultron", "Verro", "Vision"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  for (const n of ["Ultron", "Verro", "Vision", "Jarvis"]) assert.equal(tierIn(w.root, n), "on-call", n);
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8")).mode, "on-demand");
});

test("always on, when the user picks it: tier standing, and a pocket the user had before setup keeps its own tier", async () => {
  const w = world();
  fs.mkdirSync(path.join(w.root, "Pockets", "Verro"), { recursive: true });
  fs.writeFileSync(path.join(w.root, "Pockets", "Verro", "AGENTS.md"), "---\ntier: on-call\n---\n# Verro, the user's own");
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro", "Vision"], accounts, root: w.root, home: w.home, mode: "always-on" }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.equal(tierIn(w.root, "Vision"), "standing");
  assert.equal(tierIn(w.root, "Verro"), "on-call", "the user's own, untouched");
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8")).mode, "always-on");
});

test("the house record lists the pockets setup placed, and a second run that picks always on moves them all, not the user's own", async () => {
  const w = world();
  fs.mkdirSync(path.join(w.root, "Pockets", "Vision"), { recursive: true });
  fs.writeFileSync(path.join(w.root, "Pockets", "Vision", "AGENTS.md"), "---\ntier: on-call\n---\n# Vision, the user's own");
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro", "Vision"], accounts, root: w.root, home: w.home }, w.deps);
  let rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.placedCitizens, ["Jarvis", "Verro"]);
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro", "Ultron"], accounts, root: w.root, home: w.home, mode: "always-on" }, w.deps);
  rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.placedCitizens, ["Jarvis", "Ultron", "Verro"]);
  for (const n of ["Jarvis", "Ultron", "Verro"]) assert.equal(tierIn(w.root, n), "standing", n);
  assert.equal(tierIn(w.root, "Vision"), "on-call", "the user's own pocket");
  assert.equal(rec.mode, "always-on");
});

test("a run with no mode keeps the house's mode", async () => {
  const w = world();
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home, mode: "always-on" }, w.deps);
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro", "Vision"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8")).mode, "always-on");
  assert.equal(tierIn(w.root, "Vision"), "standing");
});

test("a first run that fails after placing the pockets keeps their tiers and the record of them, so a retry is right", async () => {
  const w = world();
  const failing = { ...w.deps, ops: { ...w.deps.ops, openDesk: async () => { throw new Error("the daemon went away"); } } };
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Ultron", "Verro", "Vision"], accounts, root: w.root, home: w.home }, failing).catch(() => {});
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.placedCitizens, ["Jarvis", "Ultron", "Verro", "Vision"]);
  assert.equal(rec.mode, "on-demand"); assert.equal(rec.setupDone, false);
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Ultron", "Verro", "Vision"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  for (const n of ["Ultron", "Verro", "Vision", "Jarvis"]) assert.equal(tierIn(w.root, n), "on-call", n);
});

// The Paseo Cafe (ticket 009, settled 2026-10-12 15:18 CDT): setup offers it, default off; the tutorial's Cafe page shows
// only when it is in Paseo.
test("the Paseo Cafe: added only when the user ticks it, from its own Git source", async () => {
  let w = world();
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.ok(!w.log.some((l) => l.startsWith("gitplugin") && l.includes("paseo-cafe")), "default off");
  w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home, cafe: true }, w.deps);
  assert.ok(w.log.includes("gitplugin git:https://github.com/paseo-cafe/paseo-cafe.git:plugin"));
  assert.ok(r.steps.includes("Added the Paseo Cafe to Paseo."));
});

test("the Paseo Cafe: when it cannot be added, setup goes on and says where to add it by hand", async () => {
  const w = world({ cafeFails: true });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home, cafe: true }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.ok(r.steps.some((x) => x.includes("Settings, Plugins") && x.includes("git:https://github.com/paseo-cafe/paseo-cafe.git:plugin")));
});

test("a citizen not in this release stops the run before any pocket is placed", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro", "Nobody"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, false);
  assert.ok(!fs.existsSync(path.join(w.root, "Pockets", "Verro")), "nothing placed");
});

// Beautiful Chat in every house (ticket 022; Sean, 2026-10-13 09:52 CDT: "integrating Beautiful Chat as part of its install").
// Always installed, from its Git source pinned to the commit we reviewed, so neither the official directory nor the
// Cafe's auto-update can move it before Friday walks the move.
test("Beautiful Chat: always added, from its Git source, pinned to the reviewed commit", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.ok(w.log.includes("gitplugin git:https://github.com/ABorakati/beautiful-chat.git @42b61d8301b5400a67821bbbfcf99fa8b681dc37"), w.log.join("\n"));
  assert.ok(r.steps.includes("Added Beautiful Chat to Paseo: a cleaner look for every chat."));
});

test("Beautiful Chat: a copy already in Paseo is kept, not installed again", async () => {
  const w = world({ installed: ["beautiful-chat"] });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.ok(!w.log.some((l) => l.includes("beautiful-chat.git")));
  assert.ok(r.steps.includes("Beautiful Chat is already in Paseo; setup kept yours."));
});

test("Beautiful Chat: when it cannot be added, setup goes on and says where to add it by hand", async () => {
  const w = world({ chatFails: true });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true);
  assert.ok(r.steps.some((x) => x.startsWith("Setup could not add Beautiful Chat") && x.includes("Settings, Plugins") && x.includes("git:https://github.com/ABorakati/beautiful-chat.git")), r.steps.join("\n"));
});

test("a citizen's Paseo workspace is titled with its display name: Miss Minutes, not MissMinutes", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["MissMinutes"], accounts: { MissMinutes: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.ok(w.log.some((l) => l.startsWith("workspace Miss Minutes ")), w.log.filter((l) => l.startsWith("workspace")).join("\n"));
});

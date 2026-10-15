// A full setup run against a fake doorman and a fake Paseo (ticket 004 Resolution steps 3–5; Sean's yes to the test,
// 2026-10-12): it makes the house key, uses the invite, downloads the house, creates a workspace with its icon for each
// picked citizen, and opens the first desk.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runSetup, setMode, type Deps } from "../server/setup.ts";
import { pieceHash } from "../server/pieces.ts";

function upstream() {
  const u = fs.mkdtempSync(path.join(os.tmpdir(), "upstream-"));
  const w = (f: string, body = "x") => { fs.mkdirSync(path.dirname(path.join(u, f)), { recursive: true }); fs.writeFileSync(path.join(u, f), body); };
  w("Commons/tenets.md", "11. **Scripts flag, {{USER_NAME}} decides.**\n"); w("Commons/skills/x/SKILL.md", "Fill {{SKIPS}} here; {{USER_NAME}} owns it.\n"); w("Pockets/_Template/core/VERSION", "0.1.22");
  w("plugins/agentic-pockets/paseo-plugin.json", '{ "id": "agentic-pockets" }');
  w("plugins/beautiful-pockets/paseo-plugin.json", '{ "id": "beautiful-pockets", "build": [["npm", "ci", "--include=dev"]] }');
  for (const n of ["Ultron", "Jarvis", "Verro", "Vision", "Friday", "MissMinutes"]) { w(`Pockets/${n}/AGENTS.md`, `# ${n}`); w(`Pockets/${n}/face.png`, `png-${n}`); }
  return u;
}
function world(opts: { repo?: string; claim?: number; cafeFails?: boolean; chatFails?: boolean; installed?: string[]; pin?: () => Promise<string | null>; pinNode?: (ids: string[]) => Promise<string | null>; deskOf?: (cwd: string) => Promise<string | null>; release?: object } = {}) {
  const up = upstream();
  if (opts.release) fs.writeFileSync(path.join(up, "RELEASE.json"), JSON.stringify(opts.release));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "home-")); const root = path.join(home, "agentic-pockets");
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
      return new Response(JSON.stringify(s === 200 ? { repo: opts.repo ?? "git@github.com:Seanie-D/agentic-pockets.git" } : { error: "this invite has already been used" }), { status: s });
    },
    ops: {
      createWorkspace: async ({ dir, title }) => { log.push(`workspace ${title} ${dir}`); return { workspaceId: `wks_${title}`, projectId: `prj_${title}` }; },
      setIcon: async (projectId, png) => { log.push(`icon ${projectId} ${fs.readFileSync(png, "utf8")}`); },
      addPlugin: async (id, dir) => { log.push(`plugin ${id} ${dir}`); return { running: true }; },
      addProvider: async (id, configDir) => { log.push(`provider ${id} ${configDir}`); },
      pinClaude: opts.pin ?? (async () => null),
      pinNode: opts.pinNode ?? (async () => null),
      deskOf: opts.deskOf ?? (async () => null),
      installGitPlugin: async (source, ref) => { log.push(`gitplugin ${source}${ref ? ` @${ref}` : ""}`); if (source.includes("paseo-cafe") ? opts.cafeFails : opts.chatFails) throw new Error("no paseo command"); },
      buildPlugin: async (dir, steps) => { log.push(`built ${path.basename(dir)} ${steps.map((x) => x.join(" ")).join(" && ")}`); if (opts.chatFails) throw new Error("could not build it: npm was not found"); },
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
  assert.ok(w.log.some((l) => l.startsWith("git clone") && l.includes("git@github.com:Seanie-D/agentic-pockets.git") && l.includes(`-i '${key}'`)), "cloned with the house key");
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

// Item 7 of the next update: the invite service's answer is outside text, and on Windows the clone runs through cmd, where
// % and a quote with & would expand or run. Only a plain git address goes to git.
test("a strange download address from the invite service is refused before anything is downloaded", async () => {
  for (const repo of ['git@github.com:x/y.git" & calc & "', "https://github.com/x/%PATH%.git", "git@github.com:x/y.git\nrm -rf ~", "--upload-pack=touch /tmp/x", "ext::sh -c touch% /tmp/pwned", "-oProxyCommand=calc@host:x.git", "git@-oProxyCommand=x:y.git", "git@github.com:-x/y.git"]) {
    const w = world({ repo });
    const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
    assert.equal(r.ok, false, repo);
    assert.match(r.message, /download address .* not one setup can trust/, repo);
    assert.ok(!w.log.some((l) => l.startsWith("git clone")), `no clone for ${repo}`);
  }
  for (const repo of ["git@github.com:Seanie-D/agentic-pockets.git", "https://github.com/Seanie-D/agentic-pockets.git", "ssh://git@github.com/Seanie-D/agentic-pockets.git"]) {
    const w = world({ repo });
    assert.equal((await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps)).ok, true, repo);
  }
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

// Sean, 2026-10-14 10:23 CDT, go on his idea (walk 3): "let the user simply start with Jarvis if they want a truly single
// agent setup that can scale up later." No pick is a house of Jarvis alone, and his desk is the first desk.
test("no pick starts a house of Jarvis alone, with Jarvis's desk the first desk", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: [], accounts: {}, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(r.firstDesk, { citizen: "Jarvis", agentId: "agent-1" });
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.citizens, ["Jarvis"]);
  assert.equal(rec.desks.Jarvis.provider, "claude", "the house's first account");
  assert.ok(!fs.existsSync(path.join(w.root, "Pockets", "Ultron")), "no Ultron with no one to coordinate");
  // The review: with no pick the screen sends Jarvis's own account, so his desk is on an account the user has.
  const o = world();
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: [], accounts: { Jarvis: "claude-work" }, root: o.root, home: o.home }, o.deps);
  assert.equal(JSON.parse(fs.readFileSync(path.join(o.root, "house.json"), "utf8")).desks.Jarvis.provider, "claude-work");
});

test("no name, no run: setup asks for it before anything is placed", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "  ", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, false); assert.match(r.message, /name/i);
  assert.ok(!fs.existsSync(w.root));
});

// Every desk in Auto, as the first desk is (Sean's re-walk, 2026-10-13 16:43 CDT: "I would love if every citizen could
// start in Auto mode also on first start").
test("the house record keeps each citizen's desk row (account, model, workspace, Auto mode), so the house plugin can open its desks", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Ultron", "Verro"], accounts: { Ultron: "claude", Verro: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.desks, {
    Ultron: { provider: "claude", model: "claude-opus-5-5", workspaceId: "wks_Ultron", mode: "auto" },
    Verro: { provider: "claude", model: "claude-opus-5-5", workspaceId: "wks_Verro", mode: "auto" },
    Jarvis: { provider: "claude", model: "claude-opus-5-5", workspaceId: "wks_Jarvis", mode: "auto" },
  });
});

// Sean, re-walk 3, 2026-10-14 09:30 CDT: "Can we make sure Vision opens in Sonnet 5.5 by default on users' setups?"
// The release names a citizen's model (RELEASE.json `models`, from release.json); it is kept for a Claude account only.
test("a citizen the release names a model for gets it in its desk row and its first desk, on a Claude account", async () => {
  const w = world({ release: { id: "r1", models: { Vision: "claude-sonnet-5-5" } } });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Vision"], accounts: { Vision: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.equal(rec.desks.Vision.model, "claude-sonnet-5-5");
  assert.equal(rec.desks.Jarvis.model, "claude-opus-5-5", "a citizen the release names no model for keeps the default");
  assert.ok(w.log.some((l) => l.startsWith("desk Vision — desk claude/claude-sonnet-5-5")), w.log.filter((l) => l.startsWith("desk")).join("\n"));
  const o = world({ release: { id: "r1", models: { Vision: "claude-sonnet-5-5" } } });
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Vision"], accounts: { Vision: "codex" }, root: o.root, home: o.home }, o.deps);
  assert.equal(JSON.parse(fs.readFileSync(path.join(o.root, "house.json"), "utf8")).desks.Vision.model, "default", "not a Claude account: the provider default");
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

// Beautiful Pockets in every house: our own copy of Beautiful Chat with tool cards closed (Sean, 2026-10-14 09:35 CDT,
// option A 10:03 CDT). It ships in the release beside the house plugin, as a folder, so neither the official directory
// nor the Cafe can move it; setup builds it with its own PATH (Paseo builds no folder plugin, and on a Mac opened from
// the Dock its PATH has no npm).
test("Beautiful Pockets: placed from the release, built in its folder with its own build step, and added", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  const dir = path.join(w.root, "plugins", "beautiful-pockets");
  assert.ok(fs.existsSync(path.join(dir, "paseo-plugin.json")));
  const i = w.log.indexOf("built beautiful-pockets npm ci --include=dev");
  assert.ok(i >= 0 && w.log.indexOf(`plugin beautiful-pockets ${dir}`) > i, w.log.join("\n"));
  assert.ok(r.steps.includes("Added Beautiful Pockets to Paseo: a cleaner look for every chat, with tool cards closed until you open them."), r.steps.join("\n"));
  assert.ok(!w.log.some((l) => l.includes("beautiful-chat")), "Beautiful Chat itself is no longer installed");
  assert.ok(!w.log.some((l) => l.startsWith("built agentic-pockets")), "a plugin with no build step is not built");
});

test("Beautiful Pockets: with Beautiful Chat already in Paseo, setup keeps the user's and adds no second chat look", async () => {
  const w = world({ installed: ["beautiful-chat"] });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.ok(!w.log.some((l) => l.includes("beautiful-pockets")), w.log.join("\n"));
  assert.ok(r.steps.includes("Beautiful Chat is already in Paseo; setup kept yours and added no second chat look."), r.steps.join("\n"));
});

test("Beautiful Pockets: when it cannot be built, setup goes on, names why, and the house plugin is still added", async () => {
  const w = world({ chatFails: true });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true);
  assert.ok(r.steps.includes("Setup could not add Beautiful Pockets (could not build it: npm was not found). Your house works without it; Jarvis can add it later."), r.steps.join("\n"));
  assert.ok(!w.log.some((l) => l.startsWith("plugin beautiful-pockets")), "not added half-built");
  assert.ok(w.log.some((l) => l.startsWith("plugin agentic-pockets")));
});

test("Beautiful Pockets: a folder already built is not built again; a half-built one is", async () => {
  const half = world();
  fs.mkdirSync(path.join(half.root, "plugins", "beautiful-pockets", "node_modules"), { recursive: true });
  fs.writeFileSync(path.join(half.root, "plugins", "beautiful-pockets", "paseo-plugin.json"), '{ "id": "beautiful-pockets", "build": [["npm", "ci"]] }');
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: half.root, home: half.home }, half.deps);
  assert.ok(half.log.some((l) => l.startsWith("built beautiful-pockets")), "node_modules with no built mark: a build that was cut off");
  const w = world();
  fs.mkdirSync(path.join(w.root, "plugins", "beautiful-pockets", "node_modules"), { recursive: true });
  fs.writeFileSync(path.join(w.root, "plugins", "beautiful-pockets", "node_modules", ".pockets-built"), "");
  fs.writeFileSync(path.join(w.root, "plugins", "beautiful-pockets", "paseo-plugin.json"), '{ "id": "beautiful-pockets", "build": [["npm", "ci"]] }');
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.ok(!w.log.some((l) => l.startsWith("built beautiful-pockets")), w.log.join("\n"));
  assert.ok(w.log.some((l) => l.startsWith("plugin beautiful-pockets")));
});

test("a citizen's Paseo workspace is titled with its display name: Miss Minutes, not MissMinutes", async () => {
  const w = world();
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["MissMinutes"], accounts: { MissMinutes: "claude" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.ok(w.log.some((l) => l.startsWith("workspace Miss Minutes ")), w.log.filter((l) => l.startsWith("workspace")).join("\n"));
});

// Friday's Mac walk, 2026-10-13: Paseo could not start Claude from ~/.local/bin. Setup shows it the path, and says so;
// when that fails, the step names why, so the desk's "not available" is not the only clue.
test("setup says when it showed Paseo where Claude is, and why it could not", async () => {
  const ok = world({ pin: async () => "/Users/nick/.local/bin/claude" });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: ok.root, home: ok.home }, ok.deps);
  assert.ok(r.steps.includes("Showed Paseo where Claude Code is: /Users/nick/.local/bin/claude."), r.steps.join("\n"));
  const bad = world({ pin: async () => { throw new Error("config.patch refused"); } });
  const r2 = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: bad.root, home: bad.home }, bad.deps);
  assert.ok(r2.steps.includes("Could not show Paseo where Claude Code is: config.patch refused."), r2.steps.join("\n"));
});

// Friday's read of the owner's 15:51 walk, 2026-10-13: a Mac desk had no Node, so its hooks never ran. Setup gives
// every Claude provider the house uses the folder Node is in, and says so; a failure is named, not hidden.
test("setup shows the house's Claude providers where Node is, and why it could not", async () => {
  const asked: string[][] = [];
  const ok = world({ pinNode: async (ids: string[]) => { asked.push(ids); return "/opt/homebrew/bin"; } });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: ok.root, home: ok.home, cleanProfile: true }, ok.deps);
  assert.ok(r.steps.includes("Showed your citizens where Node is: /opt/homebrew/bin."), r.steps.join("\n"));
  assert.deepEqual(asked, [["claude", "claude-house"]], "Paseo's claude and every account a desk uses");
  const bad = world({ pinNode: async () => { throw new Error("config.patch refused"); } });
  const r2 = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: bad.root, home: bad.home }, bad.deps);
  assert.ok(r2.steps.includes("Could not show your citizens where Node is: config.patch refused."), r2.steps.join("\n"));
});

// The owner's 15:51 walk, 2026-10-13 (Windows): a second install run opened a second Ultron desk. A citizen that already
// has a desk keeps it; setup opens none beside it.
test("a run after a desk is already open opens no second desk", async () => {
  const w = world({ deskOf: async (cwd: string) => (cwd.endsWith("Ultron") ? "agent-ultron-1" : null) });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Ultron", "Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.equal(w.log.filter((l) => l.startsWith("desk ")).length, 0, w.log.join("\n"));
  assert.deepEqual(r.firstDesk, { citizen: "Ultron", agentId: "agent-ultron-1" });
  assert.ok(r.steps.includes("Ultron's desk was already open."), r.steps.join("\n"));
});

// The update system, ticket 06: setup changes only through the house's offer, so the Cafe never updates it.
test("with the Cafe added, or already in Paseo, setup is on the Cafe's opt-out list", async () => {
  for (const o of [{ cafe: true, installed: [] as string[] }, { cafe: false, installed: ["paseo-cafe"] }]) {
    const w = world({ installed: o.installed });
    const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home, cafe: o.cafe }, w.deps);
    assert.equal(r.ok, true, r.message);
    const f = path.join(w.home, ".paseo", "plugin-settings", "paseo-cafe", "directory-settings.json");
    assert.deepEqual(JSON.parse(fs.readFileSync(f, "utf8")).values.autoUpdateOptOuts, ["agentic-pockets-setup"], "Paseo keeps no pin, so the opt-out is what holds setup; Beautiful Pockets is a folder the Cafe never updates");
  }
  const bad = world({ installed: ["paseo-cafe"] });
  const bf = path.join(bad.home, ".paseo", "plugin-settings", "paseo-cafe", "directory-settings.json");
  fs.mkdirSync(path.dirname(bf), { recursive: true }); fs.writeFileSync(bf, "{ not json");
  const rb = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: bad.root, home: bad.home }, bad.deps);
  assert.equal(fs.readFileSync(bf, "utf8"), "{ not json", "a Cafe file setup cannot read is never written over");
  assert.ok(rb.steps.some((x) => x.startsWith("Setup could not keep the Paseo Cafe from updating it")));
  const none = world();
  await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: none.root, home: none.home }, none.deps);
  assert.ok(!fs.existsSync(path.join(none.home, ".paseo", "plugin-settings", "paseo-cafe")), "no Cafe: nothing written");
});

// The update system, ticket 01: the house keeps the release it was built from, with each piece's hash as released and
// as placed (placing fills in the owner's name), so a later compare tells our changes from the house's own.
test("the house record names its base release, and each piece's hash as released and as placed", async () => {
  const release = { format: 1, id: "r1base", setup: { ref: "abc1234" }, pieces: {
    core: { hash: "h-core", depends: [] }, "pack:Verro": { hash: "h-verro", depends: ["core"] }, "pack:Vision": { hash: "h-vision", depends: ["core"] },
    "commons:tenets.md": { hash: "h-tenets", depends: [] } } };
  const w = world({ release });
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.equal(rec.release.id, "r1base"); assert.equal(rec.release.setupRef, "abc1234");
  assert.equal(rec.release.pieces["pack:Verro"].hash, "h-verro");
  assert.equal(rec.release.pieces["pack:Verro"].placed, pieceHash(w.root, "pack:Verro"));
  assert.equal(rec.release.pieces["commons:tenets.md"].placed, pieceHash(w.root, "commons:tenets.md"));
  assert.equal(rec.release.pieces["pack:Vision"].hash, "h-vision");
  assert.equal(rec.release.pieces["pack:Vision"].placed, undefined, "not picked: released, not placed");
  assert.equal(rec.release.pieces["pack:Verro"].release, "r1base", "each piece names the release it came from");
  // The tier set while setup is unfinished is placement too: the record follows it.
  fs.writeFileSync(path.join(w.root, "Pockets/Verro/AGENTS.md"), "---\ntier: on-call\n---\n# Verro\n");
  setMode(w.root, "always-on");
  const after = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.equal(after.release.pieces["pack:Verro"].placed, pieceHash(w.root, "pack:Verro"));
});

// Sean's re-walk, 2026-10-13 16:43 CDT: the house folders of a release (Deliverables, Inbox) were never placed, so the
// update system read them as new in every house. Setup places them like the Commons; a folder the user has is kept.
// Item 4 of the next update: a new house knows its own number from the start, as the update ledger writes it
// (house-update update.mjs: updates.line), not only after its first update.
test("a new house records the release's number as its line; a second run keeps a line already there", async () => {
  const release = { format: 1, id: "r11", number: "1.1", setup: { ref: "abc1234" }, pieces: { core: { hash: "h-core", depends: [] } } };
  const w = world({ release });
  const input = { code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts: { Verro: "claude" }, root: w.root, home: w.home };
  assert.equal((await runSetup(input, w.deps)).ok, true);
  const file = path.join(w.root, "house.json");
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).updates.line, "1.1");
  const rec = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ ...rec, updates: { ...rec.updates, line: "1.2a" } }));
  assert.equal((await runSetup(input, w.deps)).ok, true);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).updates.line, "1.2a", "an update's line is never set back");
  const old = world({ release: { ...release, number: undefined } });
  await runSetup({ ...input, root: old.root, home: old.home }, old.deps);
  assert.equal(JSON.parse(fs.readFileSync(path.join(old.root, "house.json"), "utf8")).updates.line, "r11", "a release with no number gives its id, as the ledger does");
});

test("the release's house folders, Deliverables and Inbox, are placed and recorded as placed; a folder the user has is kept", async () => {
  const release = { format: 1, id: "r1base", pieces: { "house:Deliverables": { hash: "h-del", depends: [] }, "house:Inbox": { hash: "h-in", depends: [] } } };
  const w = world({ release });
  const clone = w.deps.exec;
  w.deps.exec = (cmd, args, o) => {
    const r = clone(cmd, args, o);
    if (cmd === "git" && args[0] === "clone") for (const d of ["Deliverables", "Inbox", "docs"]) { const t = path.join(args[args.length - 1], d); fs.mkdirSync(t, { recursive: true }); fs.writeFileSync(path.join(t, "README.md"), `${d} for {{USER_NAME}}`); }
    return r;
  };
  fs.mkdirSync(path.join(w.root, "Inbox"), { recursive: true }); fs.writeFileSync(path.join(w.root, "Inbox", "mine.md"), "the user's own");
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.equal(fs.readFileSync(path.join(w.root, "Deliverables", "README.md"), "utf8"), "Deliverables for Nick");
  assert.deepEqual(fs.readdirSync(path.join(w.root, "Inbox")), ["mine.md"], "the user's own folder is untouched");
  assert.equal(fs.existsSync(path.join(w.root, "docs")), false, "a folder the release names as no piece stays out");
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.equal(rec.release.pieces["house:Deliverables"].placed, pieceHash(w.root, "house:Deliverables"));
});

// Sean's re-walk, 2026-10-13 16:43 CDT: every citizen still said setup was not finished after it was. The first desk's
// line says where to read whether setup is done, so a later answer is from the house record, not from this line.
test("the first desk's line names house.json and its setupDone, so the citizen checks before it says setup is unfinished", async () => {
  const w = world();
  let line = "";
  const open = w.deps.ops.openDesk;
  w.deps.ops.openDesk = async (o) => { line = o.firstLine; return open(o); };
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro"], accounts, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.ok(line.includes(path.join(w.root, "house.json")) && line.includes("setupDone"), line);
});

// Auto is Claude's mode alone: Codex and OpenCode have none of that name, so their desks keep their own default.
test("Auto mode on a Claude account only: the first desk opens in it, and a Codex desk row names no mode", async () => {
  const w = world();
  let mode: string | undefined = "unset";
  const open = w.deps.ops.openDesk;
  w.deps.ops.openDesk = async (o) => { mode = o.mode; return open(o); };
  const r = await runSetup({ code: "INVITE-CODE-123456789", userName: "Nick", citizens: ["Verro", "Vision"], accounts: { Verro: "claude-house", Vision: "codex" }, root: w.root, home: w.home }, w.deps);
  assert.equal(r.ok, true, r.message);
  assert.equal(mode, "auto");
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.equal(rec.desks.Verro.mode, "auto");
  assert.equal("mode" in rec.desks.Vision, false);
});

// Walk 4 item 12, and walk 5 (Sean, 2026-10-14 10:48 CDT): "I dont want a user to be misled to feel that they MUST complete
// the tutorial". The first desk's hello was "Setup is not finished yet", read after Finish setup. The line asks for a
// hello to a house that is ready, and still tells the citizen to read setupDone before it says anything about setup.
test("the first desk's line asks for a hello to a ready house, not a setup reminder", async () => {
  const { setupLine } = await import("../server/setup.ts");
  const l = setupLine("/Users/nick/agentic-pockets/house.json");
  assert.doesNotMatch(l, /not finished|send them back|finish it/i, l);
  assert.match(l, /^\[SETUP\] /); assert.match(l, /Say hello in one or two plain sentences/); assert.match(l, /setupDone/);
});

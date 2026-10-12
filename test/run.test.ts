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
  for (const n of ["Ultron", "Verro", "Vision", "Friday", "MissMinutes"]) { w(`Pockets/${n}/AGENTS.md`, `# ${n}`); w(`Pockets/${n}/face.png`, `png-${n}`); }
  return u;
}
function world(opts: { claim?: number } = {}) {
  const up = upstream(); const home = fs.mkdtempSync(path.join(os.tmpdir(), "home-")); const root = path.join(home, "agentic-pockets");
  const log: string[] = []; const posts: any[] = [];
  const deps: Deps = {
    exec: (cmd, args, o) => {
      log.push(`${cmd} ${args.join(" ")}${o?.env?.GIT_SSH_COMMAND ? ` [ssh: ${o.env.GIT_SSH_COMMAND}]` : ""}`);
      if (cmd === "ssh-keygen") { const f = args[args.indexOf("-f") + 1]; fs.writeFileSync(f, "PRIVATE"); fs.writeFileSync(`${f}.pub`, "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHouseKeyHouseKeyHouseKeyHouseKeyHouseKe house"); return { status: 0, stdout: "", stderr: "" }; }
      if (cmd === "git" && args[0] === "clone") { fs.cpSync(up, args[args.length - 1], { recursive: true }); return { status: 0, stdout: "", stderr: "" }; }
      if (cmd === "git") return { status: 0, stdout: "", stderr: "" };
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
  assert.deepEqual(w.log.filter((l) => l.startsWith("workspace")).map((l) => l.split(" ")[1]), ["Ultron", "Verro", "Vision"]);
  assert.deepEqual(w.log.filter((l) => l.startsWith("icon")), ["icon prj_Ultron png-Ultron", "icon prj_Verro png-Verro", "icon prj_Vision png-Vision"]);
  const desks = w.log.filter((l) => l.startsWith("desk"));
  assert.equal(desks.length, 1); assert.match(desks[0], /^desk Ultron — desk claude\/\S+ \{"role":"desk"\} cwd=.*Pockets\/Ultron$/);
  const rec = JSON.parse(fs.readFileSync(path.join(w.root, "house.json"), "utf8"));
  assert.deepEqual(rec.citizens, ["Ultron", "Verro", "Vision"]); assert.equal(rec.setupDone, false);
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

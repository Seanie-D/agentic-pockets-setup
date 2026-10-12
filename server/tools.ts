// The tool check, the install, and the user-wide extras (ticket 004 Q2, Q7, Q8). The check and the list only read.
// installTools runs only when the user asks: kept if new enough, updated if old, installed if missing.
import fs from "node:fs";
import path from "node:path";

export type Run = (cmd: string, args: string[]) => { status: number | null; stdout: string };
export interface Tool { name: string; state: "ok" | "old" | "missing"; have: string | null; need: string; why: string }

const NEED: { name: string; args: string[]; need: string; why: string }[] = [
  { name: "node", args: ["--version"], need: "22.0.0", why: "runs the house's scripts and the memory tool" },
  { name: "git", args: ["--version"], need: "2.30.0", why: "downloads the house and its updates" },
  { name: "claude", args: ["--version"], need: "2.1.0", why: "Claude Code, the engine most citizens run on" },
  { name: "paseo", args: ["--version"], need: "0.11.2", why: "the app every citizen lives in" },
];
const ver = (s: string) => (s.match(/(\d+)\.(\d+)\.(\d+)/) || [])[0] ?? null;
const older = (a: string, b: string) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };

export function checkTools(run: Run): Tool[] {
  return NEED.map((t) => checkOne(run, t));
}
function checkOne(run: Run, t: (typeof NEED)[number]): Tool {
  const r = run(t.name, t.args);
  const have = r.status === 0 ? ver(r.stdout) : null;
  return { name: t.name, need: t.need, why: t.why, have, state: !have ? "missing" : older(have, t.need) ? "old" : "ok" };
}

// Where each tool comes from: Homebrew on a Mac, winget on Windows (Ultron's brief, 2026-10-12). Names checked that day
// against formulae.brew.sh and microsoft/winget-pkgs. Paseo is not here: this plugin runs inside Paseo, which already
// requires 0.11.2, and an app cannot safely replace itself while it runs.
const BREW: Record<string, string[]> = { node: ["node"], git: ["git"], claude: ["--cask", "claude-code"] };
const WINGET: Record<string, string> = { node: "OpenJS.NodeJS.LTS", git: "Git.Git", claude: "Anthropic.ClaudeCode" };
const QUIET = ["--silent", "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"];

export interface Installed extends Tool { action: "kept" | "installed" | "updated" | "not done"; message?: string }

const lastLine = (out: string) => out.trim().split(/\r?\n/).filter(Boolean).pop()?.slice(0, 200) ?? "";

// Homebrew on a Mac belongs to the user who installed it; a second user of that Mac cannot write to it (the first-run test
// is a new macOS user on the JHS MacBook).
const canWrite = (dir: string) => { try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch { return false; } };

export function installTools(run: Run, platform: NodeJS.Platform, writable: (dir: string) => boolean = canWrite): Installed[] {
  const brew = platform === "darwin" && run("brew", ["--version"]).status === 0;
  const brewPrefix = brew ? run("brew", ["--prefix"]).stdout.trim() : "";
  const brewTheirs = brew && !!brewPrefix && !writable(brewPrefix);
  const winget = platform === "win32" && run("winget", ["--version"]).status === 0;
  return NEED.map((t) => {
    const before = checkOne(run, t);
    if (before.state === "ok") return { ...before, action: "kept" };
    if (t.name === "paseo") return { ...before, action: "not done", message: "Update Paseo from its own menu, or from paseo.sh." };
    const pkg = BREW[t.name];
    let why = "", wholeComputer = false;
    if (platform === "darwin") {
      if (!brew) return { ...before, action: "not done", message: "Homebrew comes first: it installs the other tools. Get it from brew.sh (it asks for your Mac password once), then press Install again." };
      if (brewTheirs) return { ...before, action: "not done", message: `Homebrew on this Mac belongs to another user, so it cannot install for you. Ask the person who set up this Mac to install ${t.name} for everyone, or set up the Agentic Pockets on their account.` };
      const managed = before.state === "old" && run("brew", ["list", "--versions", ...pkg]).status === 0;
      run("brew", [managed ? "upgrade" : "install", ...pkg]);
    } else if (platform === "win32") {
      if (!winget) return { ...before, action: "not done", message: "winget comes first: it installs the other tools. Get App Installer from the Microsoft Store, then press Install again." };
      const id = ["--id", WINGET[t.name], "--exact"];
      const managed = before.state === "old" && run("winget", ["list", ...id, "--accept-source-agreements"]).status === 0;
      // This user only, so no admin prompt. Only a tool with no per-user installer falls back to the whole computer,
      // which shows Windows' own "allow changes" prompt for the user to click; any other failure stops with its reason.
      if (managed) { const u = run("winget", ["upgrade", ...id, ...QUIET]); if (u.status !== 0) why = lastLine(u.stdout); }
      else {
        const u = run("winget", ["install", ...id, "--scope", "user", ...QUIET]);
        if (u.status !== 0 && /No applicable installer/i.test(u.stdout)) { wholeComputer = true; const m = run("winget", ["install", ...id, ...QUIET]); if (m.status !== 0) why = lastLine(m.stdout); }
        else if (u.status !== 0) why = lastLine(u.stdout);
      }
    } else return { ...before, action: "not done", message: `Install ${t.name} ${t.need} or newer with your system's package manager.` };
    const after = checkOne(run, t);
    const action = after.state !== "ok" ? "not done" : before.state === "missing" ? "installed" : "updated";
    if (after.state !== "ok") return { ...after, action, message: `${t.name} is still ${after.state === "old" ? "too old" : "missing"} after the install.${why ? ` The installer said: ${why}` : ""}` };
    return { ...after, action, ...(wholeComputer ? { message: `${t.name} has no installer for one user, so it was installed for the whole computer. That is why Windows asked you to allow changes.` } : {}) };
  });
}

// What a project can switch off for itself, from the Claude Code docs (2026-10-12): a skill or command by `skillOverrides`
// "off"; a subagent by a `permissions.deny` rule `Agent(name)` (its frontmatter name); an MCP server by `mcp__<server>`;
// a plugin by `enabledPlugins` false; the user's CLAUDE.md by `claudeMdExcludes`. A hook cannot be switched off alone
// ("There is no way to disable an individual hook while keeping it in the configuration"), and Paseo's plugins and its
// system prompt are app-wide; those are listed as fixed.
export type ExtraKind = "hook" | "skill" | "agent" | "command" | "plugin" | "mcp" | "instructions" | "paseo";
export interface Extra { id: string; kind: ExtraKind; name: string; where: string; switchable: boolean; file?: string }

const readJson = (f: string) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const frontmatterName = (f: string) => { try { return fs.readFileSync(f, "utf8").match(/^---\n[\s\S]*?^name:\s*(.+?)\s*$/m)?.[1] ?? null; } catch { return null; } };

// The house's own Paseo plugins are not outside extras.
const HOUSE_PLUGINS = ["agentic-pockets", "agentic-pockets-setup"];
// A hook is known by its script ("node …/caveman-activate.js" is caveman-activate.js), else by its program.
const hookName = (cmd: string) => {
  const parts = cmd.split(/\s+/).map((x) => x.replace(/^["']|["']$/g, "")).filter(Boolean);
  const script = parts.slice(1).find((x) => /[\\/]|\.(m?js|ts|py|sh|ps1)$/.test(x));
  return (script ?? parts[0] ?? "").split(/[\\/]/).pop() ?? "";
};

export function listExtras(home: string): Extra[] {
  const c = path.join(home, ".claude"); const out: Extra[] = [];
  const add = (kind: ExtraKind, name: string, where: string, switchable = true, file?: string) => out.push({ id: `${kind}:${name}`, kind, name, where, switchable, ...(file ? { file } : {}) });
  const names = (d: string) => { try { return fs.readdirSync(path.join(c, d)).filter((n) => !n.startsWith(".")); } catch { return []; } };
  for (const n of names("skills")) if (fs.existsSync(path.join(c, "skills", n, "SKILL.md"))) add("skill", n, `~/.claude/skills/${n}`);
  for (const n of names("agents")) add("agent", frontmatterName(path.join(c, "agents", n)) ?? n.replace(/\.md$/, ""), `~/.claude/agents/${n}`);
  for (const n of names("commands")) add("command", n.replace(/\.md$/, ""), `~/.claude/commands/${n}`);
  const s = readJson(path.join(c, "settings.json")) ?? {};
  for (const [id, on] of Object.entries(s.enabledPlugins ?? {})) if (on === true) add("plugin", id, "~/.claude/settings.json");
  for (const [ev, groups] of Object.entries<{ hooks?: { command?: string }[] }[]>(s.hooks ?? {}))
    for (const g of groups) for (const h of g.hooks ?? []) add("hook", `${ev} ${hookName(String(h.command ?? ""))}`, "~/.claude/settings.json", false);
  for (const n of Object.keys(readJson(path.join(home, ".claude.json"))?.mcpServers ?? {})) add("mcp", n, "~/.claude.json");
  if (fs.existsSync(path.join(c, "CLAUDE.md"))) add("instructions", "~/.claude/CLAUDE.md", "~/.claude/CLAUDE.md", true, path.join(c, "CLAUDE.md"));
  const p = readJson(path.join(home, ".paseo", "config.json")) ?? {};
  for (const [n, v] of Object.entries<{ enabled?: boolean }>(p.plugins ?? {})) if (v?.enabled !== false && !HOUSE_PLUGINS.includes(n)) add("paseo", n, "Paseo, Settings, Plugins", false);
  if (String(p.daemon?.appendSystemPrompt ?? "").trim()) add("paseo", "system prompt for every agent", "Paseo, Settings", false);
  return out;
}

// Switch the chosen extras off in every pocket of the house, in its own `.claude/settings.local.json` (local, never
// sent upstream), merged with what is there. Run again when a pocket is added; nothing doubles.
export function applyExtrasOff(root: string, extras: Extra[], off: string[]): { pockets: string[]; switched: Extra[]; fixed: Extra[] } {
  const chosen = extras.filter((e) => off.includes(e.id));
  const switched = chosen.filter((e) => e.switchable), fixed = chosen.filter((e) => !e.switchable);
  const pocketsDir = path.join(root, "Pockets");
  const pockets = fs.existsSync(pocketsDir) ? fs.readdirSync(pocketsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name) : [];
  for (const p of pockets) {
    const f = path.join(pocketsDir, p, ".claude", "settings.local.json");
    const cur = readJson(f) ?? {};
    const deny = new Set<string>(cur.permissions?.deny ?? []);
    const skills = { ...(cur.skillOverrides ?? {}) }, plugins = { ...(cur.enabledPlugins ?? {}) };
    const excl = new Set<string>(cur.claudeMdExcludes ?? []);
    for (const e of switched) {
      if (e.kind === "skill" || e.kind === "command") skills[e.name] = "off";
      else if (e.kind === "agent") deny.add(`Agent(${e.name})`);
      else if (e.kind === "mcp") deny.add(`mcp__${e.name}`);
      else if (e.kind === "plugin") plugins[e.name] = false;
      else if (e.kind === "instructions" && e.file) excl.add(e.file);
    }
    const next = { ...cur };
    if (deny.size) next.permissions = { ...(cur.permissions ?? {}), deny: [...deny] };
    if (Object.keys(skills).length) next.skillOverrides = skills;
    if (Object.keys(plugins).length) next.enabledPlugins = plugins;
    if (excl.size) next.claudeMdExcludes = [...excl];
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(next, null, 2) + "\n");
  }
  return { pockets, switched, fixed };
}

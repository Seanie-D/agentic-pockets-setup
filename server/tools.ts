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

export function installTools(run: Run, platform: NodeJS.Platform): Installed[] {
  const brew = platform === "darwin" && run("brew", ["--version"]).status === 0;
  const winget = platform === "win32" && run("winget", ["--version"]).status === 0;
  return NEED.map((t) => {
    const before = checkOne(run, t);
    if (before.state === "ok") return { ...before, action: "kept" };
    if (t.name === "paseo") return { ...before, action: "not done", message: "Update Paseo from its own menu, or from paseo.sh." };
    const pkg = BREW[t.name];
    if (platform === "darwin") {
      if (!brew) return { ...before, action: "not done", message: "Homebrew comes first: it installs the other tools. Get it from brew.sh (it asks for your Mac password once), then press Install again." };
      const managed = before.state === "old" && run("brew", ["list", "--versions", ...pkg]).status === 0;
      run("brew", [managed ? "upgrade" : "install", ...pkg]);
    } else if (platform === "win32") {
      if (!winget) return { ...before, action: "not done", message: "winget comes first: it installs the other tools. Get App Installer from the Microsoft Store, then press Install again." };
      const id = ["--id", WINGET[t.name], "--exact"];
      const managed = before.state === "old" && run("winget", ["list", ...id, "--accept-source-agreements"]).status === 0;
      // This user only, so no admin prompt; a tool with no per-user installer falls back to the whole computer,
      // which may show Windows' own "allow changes" prompt for the user to click.
      if (managed) run("winget", ["upgrade", ...id, ...QUIET]);
      else if (run("winget", ["install", ...id, "--scope", "user", ...QUIET]).status !== 0) run("winget", ["install", ...id, ...QUIET]);
    } else return { ...before, action: "not done", message: `Install ${t.name} ${t.need} or newer with your system's package manager.` };
    const after = checkOne(run, t);
    const action = after.state !== "ok" ? "not done" : before.state === "missing" ? "installed" : "updated";
    return { ...after, action, ...(after.state !== "ok" ? { message: `${t.name} is still ${after.state === "old" ? "too old" : "missing"} after the install.` } : {}) };
  });
}

export interface Extra { kind: "hook" | "skill" | "agent" | "command" | "plugin"; name: string; where: string }
export function listExtras(home: string): Extra[] {
  const c = path.join(home, ".claude"); const out: Extra[] = [];
  const names = (d: string) => { try { return fs.readdirSync(path.join(c, d)).filter((n) => !n.startsWith(".")); } catch { return []; } };
  for (const n of names("skills")) out.push({ kind: "skill", name: n, where: `~/.claude/skills/${n}` });
  for (const n of names("agents")) out.push({ kind: "agent", name: n.replace(/\.md$/, ""), where: `~/.claude/agents/${n}` });
  for (const n of names("commands")) out.push({ kind: "command", name: n.replace(/\.md$/, ""), where: `~/.claude/commands/${n}` });
  for (const n of names("plugins")) if (!/\.json$/.test(n)) out.push({ kind: "plugin", name: n, where: `~/.claude/plugins/${n}` });
  try {
    const s = JSON.parse(fs.readFileSync(path.join(c, "settings.json"), "utf8"));
    for (const [ev, groups] of Object.entries<{ hooks?: { command?: string }[] }[]>(s.hooks ?? {}))
      for (const g of groups) for (const h of g.hooks ?? []) out.push({ kind: "hook", name: `${ev} ${String(h.command ?? "").split(/\s+/)[0].split("/").pop()}`, where: "~/.claude/settings.json" });
  } catch { /* no user settings */ }
  return out;
}

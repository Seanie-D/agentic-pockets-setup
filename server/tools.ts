// The tool check and the user-wide extras list (ticket 004 Q2, Q7, Q8). Both only read: the check asks each tool for
// its version, and the list reads ~/.claude. Installing or switching anything off is a separate, asked-for step.
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
  return NEED.map((t) => {
    const r = run(t.name, t.args);
    const have = r.status === 0 ? ver(r.stdout) : null;
    return { name: t.name, need: t.need, why: t.why, have, state: !have ? "missing" : older(have, t.need) ? "old" : "ok" };
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

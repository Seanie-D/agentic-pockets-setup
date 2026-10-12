// The seasonings: the Claude Code extras the house is tuned with (Friday's recipe, 2026-10-12; ruled the same day:
// house only). Each one is switched on for each citizen's own folder with Claude Code's project-scope install, so the
// user's Claude outside the house stays as it was. A seasoning the user already has in their own Claude is left to
// theirs, so nothing runs twice. What the house gets is kept in house.json (seasonSettings), so the house plugin's
// Citizens tab seasons a citizen added later the same way.
import fs from "node:fs";
import path from "node:path";
import { listExtras } from "./tools.ts";
import type { Exec } from "./setup.ts";

export const SEASONINGS = [
  { plugin: "caveman@caveman", marketplace: "caveman", repo: "JuliusBrussee/caveman", mine: /caveman/i },
  { plugin: "context-mode@context-mode", marketplace: "context-mode", repo: "mksglu/context-mode", mine: /context-mode/i },
];
// No automatic compaction (a full desk hands off), no Claude memory (the pocket's memory/ is the one memory),
// long command output, and caveman's level written out.
export const SEASON_SETTINGS = { autoCompactEnabled: false, autoMemoryEnabled: false, env: { BASH_MAX_OUTPUT_LENGTH: "150000", CAVEMAN_DEFAULT_MODE: "full" } };

const readJson = (f: string) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

// Merge a settings fragment into a pocket's .claude/settings.json; objects merge one level down, so env and the
// plugin lists keep what is already there.
export function mergeSettings(pocket: string, add: Record<string, any>) {
  const f = path.join(pocket, ".claude", "settings.json");
  const s = readJson(f) ?? {};
  for (const [k, v] of Object.entries(add)) s[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...(s[k] ?? {}), ...v } : v;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n");
}

export function season(pockets: string[], home: string, exec: Exec): { added: string[]; theirs: string[]; failed: string[]; settings: Record<string, any> } {
  const extras = listExtras(home);
  const theirs = SEASONINGS.filter((x) => extras.some((e) => (e.kind === "plugin" || e.kind === "hook" || e.kind === "mcp") && x.mine.test(e.name)));
  const added: string[] = [], failed: string[] = [];
  const settings: Record<string, any> = { ...SEASON_SETTINGS, enabledPlugins: {}, extraKnownMarketplaces: {} };
  for (const x of SEASONINGS.filter((s) => !theirs.includes(s))) {
    let ok = true;
    for (const cwd of pockets) {
      const a = exec("claude", ["plugin", "marketplace", "add", x.repo, "--scope", "project"], { cwd });
      const b = a.status === 0 ? exec("claude", ["plugin", "install", x.plugin, "--scope", "project"], { cwd }) : a;
      if (b.status !== 0) ok = false;
    }
    (ok ? added : failed).push(x.marketplace);
    settings.enabledPlugins[x.plugin] = true;
    settings.extraKnownMarketplaces[x.marketplace] = { source: { source: "github", repo: x.repo } };
  }
  for (const cwd of pockets) mergeSettings(cwd, SEASON_SETTINGS);
  return { added, theirs: theirs.map((x) => x.marketplace), failed, settings };
}

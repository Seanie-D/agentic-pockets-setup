// Item 4b of the next update: after setup ends, the setup page shows whether setup finished every step, as the
// house-check skill's seven lines (Commons/skills/records/house-check/SKILL.md), each with a tick or what is missing.
// houseStatus decides from what was read; readHouseInputs below reads it, with the Paseo handle passed in.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { BEAUTIFUL_CHAT, BEAUTIFUL_POCKETS, BUILT } from "../shared/beautiful-pockets.ts";
import { checkTools } from "./tools.ts";
import type { Exec } from "./setup.ts";   // a type only, so no import cycle at run time

// unknown: the line could not be checked (its source could not be read), so it is neither a tick nor a fault.
export interface StatusLine { what: string; ok: boolean; detail: string; unknown?: true }
export interface PocketFacts { contract: boolean; version: boolean; settings: boolean; hook: boolean; tier: string | null }
export interface StatusInput {
  tools: { name: string; state: "ok" | "old" | "missing"; have: string | null }[];
  npm: boolean;
  record: Record<string, unknown> | null;
  pockets: Record<string, PocketFacts>;
  plugins: { id: string; running: boolean | null }[];   // running null: Paseo could not say
  beautifulPockets: { folder: boolean; built: boolean };
  workspaces: string[] | null;                          // the live workspace ids Paseo has; null: its list could not be read
}

const NEED_CLAUDE = "2.1.280";
const show = (n: string) => n.replace(/([a-z])([A-Z])/g, "$1 $2");
const line = (what: string, problems: string[], okDetail = "As it should be."): StatusLine =>
  ({ what, ok: problems.length === 0, detail: problems.length ? problems.join(" ") : okDetail });

export function houseStatus(i: StatusInput): StatusLine[] {
  const tool = (n: string) => i.tools.find((t) => t.name === n);
  const rec = (i.record ?? {}) as { setupDone?: unknown; userName?: unknown; release?: { id?: unknown; setupRef?: unknown }; citizens?: unknown; placedCitizens?: unknown; mode?: unknown; desks?: Record<string, { workspaceId?: unknown }> };
  const placed = Array.isArray(rec.placedCitizens) ? (rec.placedCitizens as string[]) : [];
  const desks = rec.desks ?? {};
  const out: StatusLine[] = [];

  // 1. Claude Code: the copy that runs first is new enough (the check runs `claude`, so it is the first one).
  const claude = tool("claude");
  out.push(line("Claude Code", !claude || claude.state === "missing" ? ["Claude Code does not answer."]
    : claude.state === "old" ? [`Claude Code ${claude.have} runs first; ${NEED_CLAUDE} or newer is needed.`] : [], claude?.have ? `Claude Code ${claude.have} runs first.` : "Claude Code runs."));

  // 2. Node, npm and Paseo.
  const node = tool("node"), paseo = tool("paseo");
  out.push(line("Node, npm and Paseo", [
    ...(node?.state === "ok" ? [] : [node?.state === "old" ? `Node ${node.have} is older than 22.` : "Node does not answer."]),
    ...(i.npm ? [] : ["npm does not answer."]),
    ...(paseo?.state === "ok" ? [] : ["Paseo's command does not answer."]),
  ]));

  // 3. The house record.
  // The keys house-check's line 3 names, one list, so the two cannot drift.
  const REQUIRED: [string, unknown][] = [["userName", rec.userName], ["release.id", rec.release?.id], ["release.setupRef", rec.release?.setupRef], ["citizens", rec.citizens], ["placedCitizens", rec.placedCitizens], ["mode", rec.mode]];
  const missingKeys = REQUIRED.filter(([, v]) => v === undefined || v === null || v === "").map(([k]) => k);
  out.push(line("The house record", i.record === null ? ["house.json cannot be read."] : [
    ...(rec.setupDone === true ? [] : ["Setup is not marked finished."]),
    ...(missingKeys.length ? [`It lacks ${missingKeys.join(", ")}.`] : []),
    ...placed.filter((n) => !desks[n]?.workspaceId).map((n) => `${show(n)} has no desk row.`),
  ]));

  // 4. Each placed citizen's pocket: its files, and its tier as the house's mode says.
  const tier = rec.mode === "always-on" ? "standing" : "on-call";
  const pocketProblems = placed.flatMap((n) => {
    const p = i.pockets[n];
    if (!p) return [`${show(n)}: the pocket is missing.`];
    const miss = [...(p.contract ? [] : ["AGENTS.md is missing"]), ...(p.version ? [] : ["core/VERSION is missing"]), ...(p.settings ? [] : ["its .claude/settings.json is missing"]),
      ...(p.hook ? [] : ["the hook house-tools.mjs is missing"]), ...(p.tier === tier ? [] : [`the tier is ${p.tier ?? "not set"}, but this house runs ${rec.mode === "always-on" ? "always on" : "on demand"}`])];
    return miss.length ? [`${show(n)}: ${miss.join("; ")}.`] : [];
  });
  out.push(line("Each citizen's pocket", pocketProblems));

  // 5. Paseo's plugins: the house plugin running, setup present, and one chat look (Beautiful Chat counts in its place).
  const plug = (id: string) => i.plugins.find((p) => p.id === id);
  const chat = plug(BEAUTIFUL_POCKETS) ?? plug(BEAUTIFUL_CHAT);
  out.push(line("Paseo's plugins", [
    ...(!plug("agentic-pockets") ? ["The house plugin, agentic-pockets, is not in Paseo."] : plug("agentic-pockets")!.running === false ? ["agentic-pockets is not running."] : []),
    ...(plug("agentic-pockets-setup") ? [] : ["Setup, agentic-pockets-setup, is not in Paseo."]),
    ...(!chat ? ["Beautiful Pockets is not in Paseo."] : chat.running === false ? [`${chat.id} is not running.`] : []),
  ]));

  // 6. Beautiful Pockets built, unless this Paseo keeps Beautiful Chat.
  if (plug(BEAUTIFUL_CHAT) && !plug(BEAUTIFUL_POCKETS)) out.push({ what: "Beautiful Pockets built", ok: true, detail: "Not needed: this Paseo keeps Beautiful Chat." });
  else out.push(line("Beautiful Pockets built", !i.beautifulPockets.folder ? ["Its folder, plugins/beautiful-pockets, is missing."] : i.beautifulPockets.built ? [] : ["Its build did not finish."]));

  // 7. The workspaces: each desk row's workspace is still in Paseo. A list that cannot be read is not checked.
  if (i.workspaces === null) out.push({ what: "The workspaces", ok: true, unknown: true, detail: "Not checked: Paseo's list of workspaces could not be read." });
  else { const live = i.workspaces; out.push(line("The workspaces", placed.filter((n) => desks[n]?.workspaceId && !live.includes(String(desks[n].workspaceId))).map((n) => `${show(n)}'s workspace is missing.`))); }
  return out;
}

// What the seven lines are read from, in the house folder and Paseo's own record.
export function readPocket(root: string, name: string): PocketFacts {
  const p = path.join(root, "Pockets", name);
  let tier: string | null = null;
  try { tier = fs.readFileSync(path.join(p, "AGENTS.md"), "utf8").match(/^tier:\s*["']?([\w-]+)/m)?.[1] ?? null; } catch { /* no contract */ }
  return { contract: fs.existsSync(path.join(p, "AGENTS.md")), version: fs.existsSync(path.join(p, "core", "VERSION")), settings: fs.existsSync(path.join(p, ".claude", "settings.json")),
    hook: fs.existsSync(path.join(p, ".claude", "hooks", "house-tools.mjs")), tier };
}
export function readBeautifulPockets(root: string) {
  const dir = path.join(root, "plugins", BEAUTIFUL_POCKETS);
  return { folder: fs.existsSync(dir), built: fs.existsSync(path.join(dir, "node_modules", BUILT)) };
}

// Everything houseStatus reads: the tools (the Claude copy Paseo is set to, claudeAt), npm, house.json, each placed pocket,
// Paseo's plugins (its own list says which run; when its command cannot be asked, its settings say which are there,
// configPlugins), Beautiful Pockets' folder, and Paseo's record of its workspaces.
export async function readHouseInputs(root: string, exec: Exec, claudeAt: string | null, configPlugins: () => Promise<string[]>): Promise<StatusInput> {
  let record: Record<string, unknown> | null = null;
  try { record = JSON.parse(fs.readFileSync(path.join(root, "house.json"), "utf8")); } catch { /* unreadable: line 3 says so */ }
  const placed = Array.isArray(record?.placedCitizens) ? (record!.placedCitizens as string[]) : [];
  let plugins: StatusInput["plugins"];
  const ls = exec("paseo", ["plugin", "ls", "--json"], { timeout: 20_000 });
  try { plugins = (JSON.parse(ls.stdout.slice(ls.stdout.search(/[[{]/))) as { id?: string; name?: string; status?: string }[]).map((p) => ({ id: String(p.id ?? p.name), running: p.status ? p.status === "running" : null })); }
  catch { plugins = (await configPlugins().catch(() => [] as string[])).map((id) => ({ id, running: null })); }
  let workspaces: string[] | null = null;
  try {
    const w = JSON.parse(fs.readFileSync(path.join(process.env.PASEO_HOME || path.join(os.homedir(), ".paseo"), "projects", "workspaces.json"), "utf8"));
    const all = (Array.isArray(w) ? w : Object.values(w.workspaces ?? w)) as { workspaceId?: string; archivedAt?: string | null }[];
    workspaces = all.filter((x) => x && !x.archivedAt && x.workspaceId).map((x) => String(x.workspaceId));
  } catch { /* unreadable: line 7 is not checked */ }
  return { tools: checkTools(exec, claudeAt), npm: exec("npm", ["--version"], { timeout: 20_000 }).status === 0, record,
    pockets: Object.fromEntries(placed.map((n) => [n, readPocket(root, n)])), plugins, beautifulPockets: readBeautifulPockets(root), workspaces };
}

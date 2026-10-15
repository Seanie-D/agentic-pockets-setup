// Item 4b of the next update (the owner, Ultron's desk, 2026-10-15 15:45 CDT; the shape approved at 16:18 CDT): after
// setup ends, the setup page shows whether setup finished every step, as the house-check skill's seven lines
// (Commons/skills/records/house-check/SKILL.md), each with a tick or what is missing. This decides from what was read;
// readHouseStatus below reads it. Kept free of Paseo so its tests run in plain Node.
import fs from "node:fs";
import path from "node:path";
import { BEAUTIFUL_CHAT, BEAUTIFUL_POCKETS, BUILT } from "../shared/beautiful-pockets.ts";

export interface StatusLine { what: string; ok: boolean; detail: string }
export interface PocketFacts { contract: boolean; version: boolean; settings: boolean; hook: boolean; tier: string | null }
export interface StatusInput {
  tools: { name: string; state: "ok" | "old" | "missing"; have: string | null }[];
  npm: boolean;
  record: Record<string, unknown> | null;
  pockets: Record<string, PocketFacts>;
  plugins: { id: string; running: boolean | null }[];   // running null: Paseo could not say
  beautifulPockets: { folder: boolean; built: boolean };
  workspaces: string[];                                 // the live workspace ids Paseo has
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
    : claude.state === "old" ? [`Claude Code ${claude.have} runs first; ${NEED_CLAUDE} or newer is needed.`] : [], `Claude Code ${claude?.have ?? ""} runs first.`.replace("  ", " ")));

  // 2. Node, npm and Paseo.
  const node = tool("node"), paseo = tool("paseo");
  out.push(line("Node, npm and Paseo", [
    ...(node?.state === "ok" ? [] : [node?.state === "old" ? `Node ${node.have} is older than 22.` : "Node does not answer."]),
    ...(i.npm ? [] : ["npm does not answer."]),
    ...(paseo?.state === "ok" ? [] : ["Paseo's command does not answer."]),
  ]));

  // 3. The house record.
  const missingKeys = [["userName", rec.userName], ["release", rec.release?.id], ["citizens", rec.citizens], ["placedCitizens", rec.placedCitizens], ["mode", rec.mode]]
    .filter(([, v]) => v === undefined || v === null || v === "").map(([k]) => k as string);
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

  // 7. The workspaces: each desk row's workspace is still in Paseo.
  out.push(line("The workspaces", placed.filter((n) => desks[n]?.workspaceId && !i.workspaces.includes(String(desks[n].workspaceId))).map((n) => `${show(n)}'s workspace is missing.`)));
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

// The tutorial's frame (ticket 009). The checklist is the house's own (Commons/tutorial/items.json). Each citizen writes
// its own ticks in its own pocket (tutorial/ticks.json: item id → when), one writer per folder, and this adds them up.
// At 100 % the lead citizen (Ultron when he is in the house) leaves its drawing, as shapes, in tutorial/reward.json.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drawingSchema, type Drawing } from "../shared/reward.ts";

export const LABEL_DURING = "Agentic Pockets Setup";   // the owner, Q1c 2026-10-12: Setup until complete, then Help
export const LABEL_AFTER = "Agentic Pockets Help";

export interface Line { text: string; needs?: string }
export interface Bubble { from: "you" | "citizen"; text: string }
export interface Item { id: string; icon?: string; title: string; body: string; lines?: Line[]; example?: Bubble[]; done: { at: string; by: string } | null }
interface RawItem { id: string; icon?: string; title: string; body: string; lines?: Line[]; example?: Bubble[]; needs?: string; exampleNeeds?: string; tickedBy?: string }
// What this house has (`needs`: "janitor", "desk-handoff", "cafe") and what is already true (`tickedBy`: "paseo", "house",
// "first-message"). Injected so the tests can set both; realProbe reads the machine.
export interface Probe { has(need: string): boolean; state(key: string): boolean }
export interface Tutorial { items: Item[]; seen: string[]; lead: string | null; percent: number; complete: boolean; label: string; reward: { citizen: string; drawing: Drawing | null } | null }

const readJson = (f: string) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

// The citizen who leads the tutorial: Ultron when he is in the house, else the first citizen the user picked.
export function leadOf(root: string): string | null {
  if (fs.existsSync(path.join(root, "Pockets", "Ultron"))) return "Ultron";
  const citizens = (readJson(path.join(root, "house.json"))?.citizens ?? []) as string[];
  // A house of Jarvis alone (Sean, 2026-10-14): Jarvis leads.
  return citizens.find((n) => n !== "Jarvis") ?? (citizens.includes("Jarvis") ? "Jarvis" : null);
}

export function readTutorial(root: string, probe: Probe = realProbe(root)): Tutorial {
  // A house with the JHS skills adds their own items (Commons/skills/jhs/tutorial-items.json), so JHS words stay in that folder.
  const list = [...(readJson(path.join(root, "Commons", "tutorial", "items.json")) ?? []), ...(readJson(path.join(root, "Commons", "skills", "jhs", "tutorial-items.json")) ?? [])] as RawItem[];
  // The owner, ticket 009: "If the plugin was not installed as part of setup, or does not otherwise exist on Paseo, then the
  // tutorial does not mention it." The same rule hides a line or an example.
  const items: Item[] = list.filter((i) => !i.needs || probe.has(i.needs)).map(({ id, icon, title, body, lines, example, exampleNeeds }) => ({
    id, ...(icon ? { icon } : {}), title, body,
    ...(lines ? { lines: lines.filter((l) => !l.needs || probe.has(l.needs)).map(({ text }) => ({ text })) } : {}),
    ...(example && (!exampleNeeds || probe.has(exampleNeeds)) ? { example } : {}),
    done: null,
  }));
  const pockets = path.join(root, "Pockets");
  let names: string[] = []; try { names = fs.readdirSync(pockets).filter((n) => !n.startsWith(".") && !n.startsWith("_")); } catch { /* no house yet */ }
  for (const by of names) {
    const ticks = readJson(path.join(pockets, by, "tutorial", "ticks.json")) ?? {};
    for (const i of items) {
      const at = ticks[i.id];
      if (typeof at === "string" && (!i.done || at < i.done.at)) i.done = { at, by };
    }
  }
  // The setup items, ticked from the real state when the tutorial opened (stateTicks), kept in the house record.
  const setup = readJson(path.join(root, "house.json"))?.tutorialTicks ?? {};
  for (const i of items) { const at = setup[i.id]; if (typeof at === "string" && (!i.done || at < i.done.at)) i.done = { at, by: "setup" }; }
  // The machinery's Jev ticks at close (house plugin, ticket 009 Q2 with Jev): its own file, never a citizen's pocket.
  const jev = readJson(path.join(root, ".machinery", "jev-ticks.json")) ?? {};
  for (const i of items) {
    const j = jev[i.id];
    if (j && typeof j.at === "string" && typeof j.by === "string" && (!i.done || j.at < i.done.at)) i.done = { at: j.at, by: j.by };
  }
  const done = items.filter((i) => i.done).length;
  const complete = items.length > 0 && done === items.length;
  const lead = leadOf(root);
  let reward: Tutorial["reward"] = null;
  if (complete && lead) {
    const r = drawingSchema.safeParse(readJson(path.join(pockets, lead, "tutorial", "reward.json")));
    reward = { citizen: lead, drawing: r.success ? r.data : null };
  }
  const seen = ((readJson(path.join(root, "house.json"))?.tutorialSeen ?? []) as string[]).filter((s) => typeof s === "string");
  return { items, seen, lead, percent: items.length ? Math.round((done / items.length) * 100) : 0, complete, label: complete ? LABEL_AFTER : LABEL_DURING, reward };
}

// The owner on Q3a, ticket 009: tick a setup item "only if the setup is actually done when the tutorial starts". Each
// opening checks the state of every unticked `tickedBy` item; a true one is ticked now, in house.json, and stays.
export function stateTicks(root: string, probe: Probe, now: string): void {
  const file = path.join(root, "house.json");
  const rec = readJson(file); if (!rec) return;
  const ticks: Record<string, string> = { ...(rec.tutorialTicks ?? {}) };
  const list = (readJson(path.join(root, "Commons", "tutorial", "items.json")) ?? []) as RawItem[];
  let changed = false;
  for (const i of list) if (i.tickedBy && !ticks[i.id] && probe.state(i.tickedBy)) { ticks[i.id] = now; changed = true; }
  if (changed) fs.writeFileSync(file, JSON.stringify({ ...rec, tutorialTicks: ticks }, null, 2) + "\n");
}

// The pages the user has opened, in house.json (`tutorialSeen`), so an example plays bubble by bubble only once.
export function markSeen(root: string, id: string): void {
  const file = path.join(root, "house.json");
  const rec = readJson(file); if (!rec) return;
  const seen: string[] = Array.isArray(rec.tutorialSeen) ? rec.tutorialSeen : [];
  if (!seen.includes(id)) fs.writeFileSync(file, JSON.stringify({ ...rec, tutorialSeen: [...seen, id] }, null, 2) + "\n");
}

// The machine as it is. Paseo's own record (PASEO_HOME, else ~/.paseo) lists its plugins; a house's skills are folders.
export function realProbe(root: string): Probe {
  const paseoHome = process.env.PASEO_HOME || path.join(os.homedir(), ".paseo");
  const plugin = (id: string) => { const p = readJson(path.join(paseoHome, "config.json"))?.plugins?.[id]; return !!p && p.enabled !== false; };
  const skill = (name: string) => {
    const dirs = [path.join(root, "Commons", "skills")];
    try { for (const s of fs.readdirSync(path.join(root, "Commons", "skills"))) dirs.push(path.join(root, "Commons", "skills", s)); } catch { /* none */ }
    try { for (const p of fs.readdirSync(path.join(root, "Pockets"))) dirs.push(path.join(root, "Pockets", p, ".claude", "skills")); } catch { /* none */ }
    return dirs.some((d) => fs.existsSync(path.join(d, name, "SKILL.md")));
  };
  return {
    // The Janitor runs where the house plugin runs: its machinery clocks the desks out each night.
    has: (n) => n === "janitor" ? plugin("agentic-pockets") : n === "cafe" ? plugin("paseo-cafe") : skill(n),
    state: (k) => k === "paseo" ? true   // this runs inside Paseo
      : k === "house" ? fs.existsSync(path.join(root, "house.json"))
      // A desk in this house with a message after its first: setup's own first line arrives as the desk opens.
      : k === "first-message" ? deskRecords(paseoHome).some((r) => r.labels?.role === "desk" && typeof r.cwd === "string" && path.resolve(r.cwd).startsWith(path.resolve(root, "Pockets") + path.sep)
        && !!r.lastUserMessageAt && !!r.createdAt && Date.parse(r.lastUserMessageAt) - Date.parse(r.createdAt) > 120_000)
      : false,
  };
}

interface DeskRecord { cwd?: string; labels?: Record<string, string>; createdAt?: string; lastUserMessageAt?: string }
function deskRecords(paseoHome: string): DeskRecord[] {
  const dir = path.join(paseoHome, "agents"); const out: DeskRecord[] = [];
  let groups: string[] = []; try { groups = fs.readdirSync(dir); } catch { return out; }
  for (const g of groups) { let files: string[] = []; try { files = fs.readdirSync(path.join(dir, g)).filter((f) => f.endsWith(".json")); } catch { continue; }
    for (const f of files) { const r = readJson(path.join(dir, g, f)); if (r) out.push(r); } }
  return out;
}

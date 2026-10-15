// "Discuss this page" (ticket 009): the lead citizen's desk gets one line naming the tutorial item, and the screen opens
// that desk. No desk: one is opened with that line first, from the citizen's row in house.json. The citizen explains
// the item and ticks it (core 0.1.23).
import fs from "node:fs";
import path from "node:path";
import { leadOf, readTutorial } from "./tutorial.ts";
import { MODES, type Mode } from "../shared/mode.ts";

export interface AgentRecord { id: string; cwd?: string; labels?: Record<string, string>; archivedAt?: string | null }
export interface DeskRow { provider: string; model: string; workspaceId: string; mode?: string }
export interface DiscussDeps {
  records(): AgentRecord[];
  send(agentId: string, text: string): Promise<void>;
  open(row: DeskRow, citizen: string, firstLine: string): Promise<string>;
}

// A citizen's live desk: labelled role=desk, not archived, in its own pocket.
export function deskOf(root: string, citizen: string, records: AgentRecord[]): string | null {
  const pocket = path.resolve(root, "Pockets", citizen);
  return records.find((r) => r.labels?.role === "desk" && !r.archivedAt && r.cwd && path.resolve(r.cwd) === pocket)?.id ?? null;
}

export function discussLine(item: { id: string; title: string; body: string }): string {
  return `[TUTORIAL] The user pressed "Discuss this page" on the tutorial item "${item.title}": ${item.body} Explain it to them in plain words, in your own way, and answer what they ask. Once they have it, tick it: \`node core/tools/okf.mjs tick ${item.id}\`.`;
}

// A citizen's desk gets the line; no desk: one is opened with it first, from the citizen's row in house.json. One path for
// "Discuss this page", "Ask about this" and Help.
export async function reach(root: string, citizen: string, line: string, deps: DiscussDeps): Promise<{ agentId: string } | { error: string }> {
  const desk = deskOf(root, citizen, deps.records());
  if (desk) { await deps.send(desk, line); return { agentId: desk }; }
  let row: DeskRow | undefined; try { row = JSON.parse(fs.readFileSync(path.join(root, "house.json"), "utf8")).desks?.[citizen]; } catch { /* no record */ }
  if (!row?.workspaceId) return { error: `${citizen} has no desk row in the house record, so no desk can be opened.` };
  return { agentId: await deps.open(row, citizen, line) };
}

async function toLead(root: string, line: string, what: string, deps: DiscussDeps, to: string | null = leadOf(root)): Promise<{ ok: boolean; agentId?: string; citizen?: string; message: string }> {
  const lead = to;
  if (!lead) return { ok: false, message: "This house has no citizen to talk to yet. Finish setup first." };
  const r = await reach(root, lead, line, deps);
  if ("error" in r) return { ok: false, message: r.error };
  return { ok: true, agentId: r.agentId, citizen: lead, message: `${lead} has ${what}.` };
}

export async function discuss(root: string, itemId: string, deps: DiscussDeps): Promise<{ ok: boolean; agentId?: string; citizen?: string; message: string }> {
  const item = readTutorial(root).items.find((i) => i.id === itemId);
  if (!item) return { ok: false, message: `"${itemId}" is not on this house's tutorial checklist.` };
  return toLead(root, discussLine(item), `the page "${item.title}"`, deps);
}

// "Ask about this" on a setup choice (ticket 004 Q11: on every selection, once the first citizen is up). The topic is a
// key, never the screen's text, so only the words below reach the citizen.
const TOPICS: Record<string, { title: string; body: () => string }> = {
  mode: { title: "How your citizens run", body: () => (Object.keys(MODES) as Mode[]).map((m) => `${MODES[m].label}: ${MODES[m].text}`).join(" ") },
};
export function askLine(topic: string): string {
  const t = TOPICS[topic];
  return `[SETUP] The user pressed "Ask about this" on "${t.title}" in Agentic Pockets Setup. The choices: ${t.body()} Explain it to them in plain words, in your own way, help them pick, and answer what they ask.`;
}
export async function ask(root: string, topic: string, deps: DiscussDeps): Promise<{ ok: boolean; agentId?: string; citizen?: string; message: string }> {
  if (!Object.hasOwn(TOPICS, topic)) return { ok: false, message: `"${topic}" is not a setup choice.` };
  return toLead(root, askLine(topic), `your question about "${TOPICS[topic].title}"`, deps);
}

// Item 4b of the next update (the owner, 2026-10-15; shape approved "as is"): "Repair my setup" on the setup page sends
// Jarvis's desk (else the lead citizen's) one line asking it to run house-check as the owner's request.
export const repairLine = `[SETUP] The user pressed "Repair my setup" in Agentic Pockets Setup. Run the house-check skill as their request: check each line, show them what you found in plain words, and repair what they say yes to.`;
export async function repair(root: string, deps: DiscussDeps): Promise<{ ok: boolean; agentId?: string; citizen?: string; message: string }> {
  const jarvis = fs.existsSync(path.join(root, "Pockets", "Jarvis")) ? "Jarvis" : leadOf(root);
  return toLead(root, repairLine, "your request to repair the setup", deps, jarvis);
}

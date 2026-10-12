// "Discuss this page" (ticket 009): the lead citizen's desk gets one line naming the tutorial item, and the screen opens
// that desk. No desk: one is opened with that line first, from the citizen's row in house.json. The citizen explains
// the item and ticks it (core 0.1.23).
import fs from "node:fs";
import path from "node:path";
import { leadOf, readTutorial } from "./tutorial.ts";

export interface AgentRecord { id: string; cwd?: string; labels?: Record<string, string>; archivedAt?: string | null }
export interface DeskRow { provider: string; model: string; workspaceId: string }
export interface DiscussDeps {
  records(): AgentRecord[];
  send(agentId: string, text: string): Promise<void>;
  open(row: DeskRow, citizen: string, firstLine: string): Promise<string>;
}

export function discussLine(item: { id: string; title: string; body: string }): string {
  return `[TUTORIAL] The user pressed "Discuss this page" on the tutorial item "${item.title}": ${item.body} Explain it to them in plain words, in your own way, and answer what they ask. Once they have it, tick it: \`node core/tools/okf.mjs tick ${item.id}\`.`;
}

export async function discuss(root: string, itemId: string, deps: DiscussDeps): Promise<{ ok: boolean; agentId?: string; citizen?: string; message: string }> {
  const item = readTutorial(root).items.find((i) => i.id === itemId);
  if (!item) return { ok: false, message: `"${itemId}" is not on this house's tutorial checklist.` };
  const lead = leadOf(root);
  if (!lead) return { ok: false, message: "This house has no citizen to talk to yet. Finish setup first." };
  const line = discussLine(item);
  const pocket = path.resolve(root, "Pockets", lead);
  const desk = deps.records().find((r) => r.labels?.role === "desk" && !r.archivedAt && r.cwd && path.resolve(r.cwd) === pocket);
  if (desk) {
    await deps.send(desk.id, line);
    return { ok: true, agentId: desk.id, citizen: lead, message: `${lead} has the page "${item.title}".` };
  }
  let row: DeskRow | undefined; try { row = JSON.parse(fs.readFileSync(path.join(root, "house.json"), "utf8")).desks?.[lead]; } catch { /* no record */ }
  if (!row?.workspaceId) return { ok: false, message: `${lead} has no desk row in the house record, so no desk can be opened.` };
  const agentId = await deps.open(row, lead, line);
  return { ok: true, agentId, citizen: lead, message: `${lead} has the page "${item.title}".` };
}

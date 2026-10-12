// The reward (ticket 009): at 100 % the lead citizen's desk is told, once, to draw it; when its drawing lands in
// tutorial/reward.json the plugin shows it in that chat, once. What was done is kept in house.json (`reward`).
import fs from "node:fs";
import path from "node:path";
import { readTutorial } from "./tutorial.ts";
import { deskOf, type DiscussDeps } from "./discuss.ts";
import { REWARD_KIND } from "../shared/reward.ts";

export interface RewardDeps extends DiscussDeps {
  append(agentId: string, item: { type: "plugin"; id: string; kind: string; version: number; data: unknown }): Promise<void>;
}

export function rewardLine(user: string): string {
  return `[TUTORIAL] ${user} has finished the tutorial: every page is explained. Draw their reward now, per the tutorial-reward skill, and tell them in this chat.`;
}

const readJson = (f: string) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

export async function rewardPass(root: string, deps: RewardDeps, now: string): Promise<void> {
  const t = readTutorial(root);
  if (!t.complete || !t.lead) return;
  const file = path.join(root, "house.json");
  const rec = readJson(file); if (!rec) return;
  const reward = { ...(rec.reward ?? {}) };
  const user = String(rec.userName || "you");
  const save = () => fs.writeFileSync(file, JSON.stringify({ ...readJson(file), reward }, null, 2) + "\n");
  const desk = deskOf(root, t.lead, deps.records());
  if (!reward.askedAt) {
    const line = rewardLine(user);
    if (desk) await deps.send(desk, line);
    else {
      const row = rec.desks?.[t.lead];
      if (!row?.workspaceId) return;
      await deps.open(row, t.lead, line);
    }
    reward.askedAt = now; save();
    return;
  }
  if (reward.shownAt || !desk) return;
  const drawing = t.reward?.drawing;
  if (!drawing) return;
  await deps.append(desk, { type: "plugin", id: "tutorial-reward", kind: REWARD_KIND, version: 1, data: { user, citizen: t.lead, ...drawing } });
  reward.shownAt = now; save();
}

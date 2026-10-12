// The tutorial's frame (ticket 009). The checklist is the house's own (Commons/tutorial/items.json). Each citizen writes
// its own ticks in its own pocket (tutorial/ticks.json: item id → when), one writer per folder, and this adds them up.
// At 100 % the lead citizen (Ultron when he is in the house) leaves its drawing and its line in tutorial/ beside its ticks.
import fs from "node:fs";
import path from "node:path";

export const LABEL_DURING = "Agentic Pockets Setup";   // the owner, Q1c 2026-10-12: Setup until complete, then Help
export const LABEL_AFTER = "Agentic Pockets Help";

export interface Item { id: string; title: string; body: string; done: { at: string; by: string } | null }
export interface Tutorial { items: Item[]; lead: string | null; percent: number; complete: boolean; label: string; reward: { citizen: string; image: string | null; line: string | null } | null }

const readJson = (f: string) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

// The citizen who leads the tutorial: Ultron when he is in the house, else the first citizen the user picked.
export function leadOf(root: string): string | null {
  if (fs.existsSync(path.join(root, "Pockets", "Ultron"))) return "Ultron";
  return ((readJson(path.join(root, "house.json"))?.citizens ?? []) as string[]).find((n) => n !== "Jarvis") ?? null;
}

export function readTutorial(root: string): Tutorial {
  // A house with the JHS skills adds their own items (Commons/skills/jhs/tutorial-items.json), so JHS words stay in that folder.
  const list = [...(readJson(path.join(root, "Commons", "tutorial", "items.json")) ?? []), ...(readJson(path.join(root, "Commons", "skills", "jhs", "tutorial-items.json")) ?? [])] as Omit<Item, "done">[];
  const items: Item[] = list.map((i) => ({ ...i, done: null }));
  const pockets = path.join(root, "Pockets");
  let names: string[] = []; try { names = fs.readdirSync(pockets).filter((n) => !n.startsWith(".") && !n.startsWith("_")); } catch { /* no house yet */ }
  for (const by of names) {
    const ticks = readJson(path.join(pockets, by, "tutorial", "ticks.json")) ?? {};
    for (const i of items) {
      const at = ticks[i.id];
      if (typeof at === "string" && (!i.done || at < i.done.at)) i.done = { at, by };
    }
  }
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
    const dir = path.join(pockets, lead, "tutorial");
    const image = path.join(dir, "reward.png");
    let line: string | null = null; try { line = fs.readFileSync(path.join(dir, "reward.md"), "utf8").trim() || null; } catch { /* still drawing */ }
    reward = { citizen: lead, image: fs.existsSync(image) ? image : null, line };
  }
  return { items, lead, percent: items.length ? Math.round((done / items.length) * 100) : 0, complete, label: complete ? LABEL_AFTER : LABEL_DURING, reward };
}

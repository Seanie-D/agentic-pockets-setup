// The tutorial's frame (ticket 009: Q1b, the tutorial lives in the setup plugin; Q2, each citizen writes its own ticks in its
// own pocket and the tutorial adds them up; 100 % gives the lead citizen's drawing). Built on Ultron's brief, 2026-10-12 19:41Z.
//   node --test test/tutorial.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readTutorial, LABEL_DURING, LABEL_AFTER } from "../server/tutorial.ts";

function house(o: { jhs?: boolean } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "house-"));
  const w = (f: string, body: string) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), body); };
  w("Commons/tutorial/items.json", JSON.stringify([
    { id: "desk", title: "One desk per citizen", body: "Talk to Brandon where he is." },
    { id: "lifemap", title: "The Life Map", body: "Every citizen is a bubble." },
    { id: "mail", title: "Mail between citizens", body: "The Mailman wakes a citizen." },
  ]));
  if (o.jhs) w("Commons/skills/jhs/tutorial-items.json", JSON.stringify([{ id: "jhs", title: "The JHS brain", body: "A library." }]));
  for (const n of ["Ultron", "Verro", "_Template"]) w(`Pockets/${n}/AGENTS.md`, `# ${n}`);
  w("house.json", JSON.stringify({ citizens: ["Ultron", "Verro"] }));
  return { root, w };
}

test("the checklist comes from the house, and the JHS items join it only in a house that has the JHS skills", () => {
  assert.deepEqual(readTutorial(house().root).items.map((i) => i.id), ["desk", "lifemap", "mail"]);
  assert.deepEqual(readTutorial(house({ jhs: true }).root).items.map((i) => i.id), ["desk", "lifemap", "mail", "jhs"]);
});

test("ticks from every citizen's own pocket are added up; the first tick of an item counts, with who ticked it", () => {
  const h = house();
  h.w("Pockets/Ultron/tutorial/ticks.json", JSON.stringify({ desk: "2026-10-14T10:00:00Z", lifemap: "2026-10-14T11:00:00Z" }));
  h.w("Pockets/Verro/tutorial/ticks.json", JSON.stringify({ desk: "2026-10-14T09:00:00Z", nosuch: "2026-10-14T09:00:00Z" }));
  h.w("Pockets/_Template/tutorial/ticks.json", JSON.stringify({ mail: "2026-10-14T09:00:00Z" }));
  const t = readTutorial(h.root);
  assert.deepEqual(t.items.map((i) => [i.id, i.done?.by ?? null]), [["desk", "Verro"], ["lifemap", "Ultron"], ["mail", null]]);
  assert.equal(t.percent, 67); assert.equal(t.complete, false); assert.equal(t.label, LABEL_DURING); assert.equal(t.reward, null);
});

test("100 % gives the reward from the lead citizen (Ultron when he is in the house), and the sidebar label changes", () => {
  const h = house();
  h.w("Pockets/Verro/tutorial/ticks.json", JSON.stringify({ desk: "2026-10-14T09:00:00Z", lifemap: "2026-10-14T09:00:00Z", mail: "2026-10-14T09:00:00Z" }));
  let t = readTutorial(h.root);
  assert.equal(t.complete, true); assert.equal(t.percent, 100); assert.equal(t.label, LABEL_AFTER);
  assert.deepEqual(t.reward, { citizen: "Ultron", image: null, line: null }, "the drawing is on its way");
  h.w("Pockets/Ultron/tutorial/reward.png", "png"); h.w("Pockets/Ultron/tutorial/reward.md", "I made this beautiful art piece in honor of our friendship.\n");
  t = readTutorial(h.root);
  assert.equal(t.reward?.image, path.join(h.root, "Pockets/Ultron/tutorial/reward.png"));
  assert.equal(t.reward?.line, "I made this beautiful art piece in honor of our friendship.");
});

test("a house with no checklist yet shows none and is not complete", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "house-"));
  const t = readTutorial(root);
  assert.deepEqual(t.items, []); assert.equal(t.complete, false); assert.equal(t.percent, 0);
});

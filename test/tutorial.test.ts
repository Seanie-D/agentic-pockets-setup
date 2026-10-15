// The tutorial's frame (ticket 009: Q1b, the tutorial lives in the setup plugin; Q2, each citizen writes its own ticks in its
// own pocket and the tutorial adds them up; 100 % gives the lead citizen's drawing). Built on Ultron's brief, 2026-10-12 19:41Z.
//   node --test test/tutorial.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readTutorial, stateTicks, markSeen, gotIt, LABEL_DURING, LABEL_AFTER } from "../server/tutorial.ts";

function house(o: { jhs?: boolean } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "house-"));
  const w = (f: string, body: string) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), body); };
  w("Commons/tutorial/items.json", JSON.stringify([
    { id: "desk", icon: "💬", title: "One desk per citizen", body: "Talk to Brandon where he is." },
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

// Sean's 15:51 walk, 2026-10-13: the tutorial lacked the prototype's emojis. An item's icon travels to the screen.
test("an item's icon reaches the screen; an item with none has none", () => {
  const items = readTutorial(house().root).items;
  assert.equal(items[0].icon, "💬");
  assert.equal(items[1].icon, undefined);
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
  assert.deepEqual(t.reward, { citizen: "Ultron", drawing: null }, "the drawing is on its way");
  const drawing = { line: "I made this beautiful art piece in honor of our friendship.", shapes: [{ t: "blob", x: 80, y: 100, w: 70, h: 90 }] };
  h.w("Pockets/Ultron/tutorial/reward.json", JSON.stringify(drawing));
  t = readTutorial(h.root);
  assert.deepEqual(t.reward, { citizen: "Ultron", drawing }, "drawn as shapes, by the lead (the owner, 2026-10-12: no pre-made image)");
});

test("a house with no checklist yet shows none and is not complete", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "house-"));
  const t = readTutorial(root);
  assert.deepEqual(t.items, []); assert.equal(t.complete, false); assert.equal(t.percent, 0);
});

test("the machinery's Jev ticks (.machinery/jev-ticks.json) count too, with the citizen whose chat Jev read", () => {
  const h = house();
  h.w(".machinery/jev-ticks.json", JSON.stringify({ mail: { at: "2026-10-14T08:00:00Z", by: "Verro" }, nosuch: { at: "2026-10-14T08:00:00Z", by: "Verro" } }));
  h.w("Pockets/Ultron/tutorial/ticks.json", JSON.stringify({ mail: "2026-10-14T09:00:00Z" }));
  assert.deepEqual(readTutorial(h.root).items.find((i) => i.id === "mail")?.done, { at: "2026-10-14T08:00:00Z", by: "Verro" });
});

// Draft 4 (Ultron, 2026-10-12 20:35Z; the owner's rulings on ticket 009, Session state): `needs` hides what this house
// does not have — the Cafe page, the Janitor line, the /desk-handoff line and example; `tickedBy` ticks the three setup
// items from the real state when the tutorial opens, never by default.
const probe = (has: string[] = [], state: Record<string, boolean> = {}) => ({ has: (n: string) => has.includes(n), state: (k: string) => state[k] === true });
function draft4() {
  const h = house();
  h.w("Commons/tutorial/items.json", JSON.stringify([
    { id: "setup-paseo", title: "Paseo installed", body: "b", tickedBy: "paseo" },
    { id: "setup-first", title: "You met your first citizen", body: "b", tickedBy: "first-message" },
    { id: "scripts", title: "What keeps your house running", body: "b", lines: [{ text: "hooks" }, { needs: "janitor", text: "the Janitor" }], note: "for authors" },
    { id: "close", title: "Saving and closing", body: "b", lines: [{ needs: "desk-handoff", text: "/desk-handoff" }], exampleNeeds: "desk-handoff", example: [{ from: "you", text: "/desk-handoff" }] },
    { id: "cafe", title: "Make it look like yours", body: "b", needs: "cafe" },
  ]));
  return h;
}

test("needs: an item, a line or an example that needs what this house lacks is not shown", () => {
  const h = draft4();
  let t = readTutorial(h.root, probe());
  assert.deepEqual(t.items.map((i) => i.id), ["setup-paseo", "setup-first", "scripts", "close"]);
  assert.deepEqual(t.items.find((i) => i.id === "scripts")?.lines, [{ text: "hooks" }]);
  assert.deepEqual(t.items.find((i) => i.id === "close")?.lines, []);
  assert.equal(t.items.find((i) => i.id === "close")?.example, undefined);
  t = readTutorial(h.root, probe(["janitor", "desk-handoff", "cafe"]));
  assert.deepEqual(t.items.map((i) => i.id), ["setup-paseo", "setup-first", "scripts", "close", "cafe"]);
  assert.deepEqual(t.items.find((i) => i.id === "scripts")?.lines?.map((l) => l.text), ["hooks", "the Janitor"]);
  assert.deepEqual(t.items.find((i) => i.id === "close")?.example, [{ from: "you", text: "/desk-handoff" }]);
});

test("tickedBy: a setup item is ticked when the tutorial opens only if its state is true, and the tick stays", () => {
  const h = draft4();
  stateTicks(h.root, probe([], { paseo: true, "first-message": false }), "2026-10-14T09:00:00Z");
  let t = readTutorial(h.root, probe());
  assert.deepEqual(t.items.find((i) => i.id === "setup-paseo")?.done, { at: "2026-10-14T09:00:00Z", by: "setup" });
  assert.equal(t.items.find((i) => i.id === "setup-first")?.done, null, "never by default");
  stateTicks(h.root, probe([], { paseo: false, "first-message": true }), "2026-10-14T10:00:00Z");
  t = readTutorial(h.root, probe());
  assert.equal(t.items.find((i) => i.id === "setup-paseo")?.done?.at, "2026-10-14T09:00:00Z", "a tick, once set, stays");
  assert.equal(t.items.find((i) => i.id === "setup-first")?.done?.at, "2026-10-14T10:00:00Z");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(h.root, "house.json"), "utf8")).citizens, ["Ultron", "Verro"], "the rest of the house record is kept");
});

test("a page opened once is remembered, so its example plays one bubble at a time only the first time (the owner, 15:29 CDT)", () => {
  const h = draft4();
  assert.deepEqual(readTutorial(h.root, probe()).seen, []);
  markSeen(h.root, "close"); markSeen(h.root, "close"); markSeen(h.root, "scripts");
  assert.deepEqual(readTutorial(h.root, probe()).seen, ["close", "scripts"]);
});

// The owner, 2026-10-14 13:19 CDT (Friday's session): "Just needs a 'got it' button". His 2026-10-08 requirement on ticket
// 009: an item is checked off when explained in chat "or read in the plugin's own description of it". The user's own
// tick lives in house.json beside the setup ticks; no citizen's pocket is written.
test("Got it: the user ticks a page they have read, it counts, and it is the user's own", () => {
  const h = house();
  assert.equal(readTutorial(h.root).percent, 0);
  gotIt(h.root, "lifemap", "2026-10-14T18:30:00Z");
  gotIt(h.root, "lifemap", "2026-10-14T18:40:00Z");   // a second press keeps the first
  gotIt(h.root, "nosuch", "2026-10-14T18:30:00Z");    // not an item of this house: nothing written
  const t = readTutorial(h.root);
  assert.deepEqual(t.items.find((i) => i.id === "lifemap")!.done, { at: "2026-10-14T18:30:00Z", by: "you" });
  assert.equal(t.percent, 33);
  const rec = JSON.parse(fs.readFileSync(path.join(h.root, "house.json"), "utf8"));
  assert.deepEqual(rec.tutorialGotIt, { lifemap: "2026-10-14T18:30:00Z" });
  assert.deepEqual(rec.citizens, ["Ultron", "Verro"], "the rest of the record is kept");
  assert.ok(!fs.existsSync(path.join(h.root, "Pockets", "Ultron", "tutorial")), "no citizen's pocket is written");
});

test("Got it and a citizen's explanation: the first one counts", () => {
  const h = house();
  h.w("Pockets/Verro/tutorial/ticks.json", JSON.stringify({ desk: "2026-10-14T09:00:00Z" }));
  gotIt(h.root, "desk", "2026-10-14T18:30:00Z");
  assert.deepEqual(readTutorial(h.root).items.find((i) => i.id === "desk")!.done, { at: "2026-10-14T09:00:00Z", by: "Verro" });
});

// The owner, 2026-10-15 13:08 CDT: once install is done the sidebar says "Agentic Pockets Help", tutorial or not.
test("the sidebar label says Help once setup is done, before the tutorial is complete", () => {
  const h = house();
  h.w("house.json", JSON.stringify({ setupDone: true }));
  const t = readTutorial(h.root);
  assert.equal(t.complete, false); assert.equal(t.label, LABEL_AFTER);
});

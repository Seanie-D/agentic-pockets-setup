// The reward (ticket 009; the owner, 2026-10-12 15:02 CDT, relayed by Ultron 20:03Z): at 100 % the lead citizen is told the
// tutorial is complete and draws it in that moment: "even crappier. Two little blob guys, hand drawn smiley on each, one on
// the left being like 'name of user' and the other on the right being 'name of citizen that drew it'", with the sincere
// line. No pre-made image. The citizen writes its drawing as shapes (tutorial/reward.json); the plugin shows it in its chat.
//   node --test test/reward.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { rewardPass, rewardLine } from "../server/reward.ts";

function house(done: boolean) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "house-"));
  const w = (f: string, body: string) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), body); };
  w("Commons/tutorial/items.json", JSON.stringify([{ id: "desk", title: "One desk", body: "b" }, { id: "mail", title: "Mail", body: "b" }]));
  w("Pockets/Ultron/AGENTS.md", "# Ultron");
  w("Pockets/Ultron/tutorial/ticks.json", JSON.stringify(done ? { desk: "2026-10-14T09:00:00Z", mail: "2026-10-14T09:00:00Z" } : { desk: "2026-10-14T09:00:00Z" }));
  w("house.json", JSON.stringify({ userName: "Nick", citizens: ["Ultron"], desks: { Ultron: { provider: "claude", model: "m", workspaceId: "wks_u" } } }));
  return { root, w, rec: () => JSON.parse(fs.readFileSync(path.join(root, "house.json"), "utf8")) };
}
const drawing = { line: "I made this beautiful art piece in honor of our friendship.", shapes: [
  { t: "blob", x: 80, y: 110, w: 70, h: 90, fill: "#f4c542" }, { t: "smile", x: 80, y: 115, r: 18 }, { t: "text", x: 40, y: 175, text: "Nick" },
  { t: "blob", x: 240, y: 105, w: 80, h: 85 }, { t: "line", x1: 120, y1: 110, x2: 200, y2: 108 }, { t: "text", x: 200, y: 175, text: "Ultron" } ] };
const fake = () => {
  const log: string[] = [];
  return { log, deps: { records: () => [{ id: "u-desk", cwd: "", labels: { role: "desk" } }],
    send: async (id: string, text: string) => { log.push(`send ${id} ${text}`); },
    open: async () => { log.push("open"); return "new-desk"; },
    append: async (id: string, item: any) => { log.push(`append ${id} ${item.kind} ${JSON.stringify(item.data)}`); } } };
};

test("before 100 % nothing happens", async () => {
  const h = house(false); const f = fake();
  await rewardPass(h.root, f.deps, "2026-10-14T10:00:00Z");
  assert.deepEqual(f.log, []);
});

test("at 100 % the lead's desk is told once to draw the reward; when the drawing lands it is shown in that chat once", async () => {
  const h = house(true); const f = fake();
  f.deps.records = () => [{ id: "u-desk", cwd: path.join(h.root, "Pockets", "Ultron"), labels: { role: "desk" } }];
  await rewardPass(h.root, f.deps, "2026-10-14T10:00:00Z");
  await rewardPass(h.root, f.deps, "2026-10-14T10:01:00Z");
  assert.deepEqual(f.log, [`send u-desk ${rewardLine("Nick")}`], "asked once");
  assert.equal(h.rec().reward.askedAt, "2026-10-14T10:00:00Z");
  h.w("Pockets/Ultron/tutorial/reward.json", JSON.stringify(drawing));
  await rewardPass(h.root, f.deps, "2026-10-14T10:02:00Z");
  await rewardPass(h.root, f.deps, "2026-10-14T10:03:00Z");
  assert.equal(f.log.length, 2, "shown once");
  assert.equal(f.log[1], `append u-desk tutorial-reward ${JSON.stringify({ user: "Nick", citizen: "Ultron", ...drawing })}`);
  assert.equal(h.rec().reward.shownAt, "2026-10-14T10:02:00Z");
  assert.deepEqual(h.rec().citizens, ["Ultron"], "the rest of the house record is kept");
});

test("a drawing that is not shapes is not shown, and the house waits for a good one", async () => {
  const h = house(true); const f = fake();
  f.deps.records = () => [{ id: "u-desk", cwd: path.join(h.root, "Pockets", "Ultron"), labels: { role: "desk" } }];
  await rewardPass(h.root, f.deps, "2026-10-14T10:00:00Z");
  h.w("Pockets/Ultron/tutorial/reward.json", JSON.stringify({ line: "hi", shapes: [{ t: "svg", d: "M0 0" }] }));
  await rewardPass(h.root, f.deps, "2026-10-14T10:01:00Z");
  assert.equal(f.log.length, 1); assert.equal(h.rec().reward.shownAt, undefined);
});

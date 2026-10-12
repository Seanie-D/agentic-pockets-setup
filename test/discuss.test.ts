// "Discuss this page" (ticket 009; the owner, 2026-10-08: "it opens it back up with Ultron or whichever is the main citizen
// involved in the tutorial"; Ultron's order of 2026-10-12 19:45Z, step 2): the lead citizen's desk gets one line naming
// the item, and the screen opens that desk. No desk: one is opened with that line first.
//   node --test test/discuss.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discuss, discussLine } from "../server/discuss.ts";

function house(citizens: string[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "house-"));
  fs.mkdirSync(path.join(root, "Commons", "tutorial"), { recursive: true });
  fs.writeFileSync(path.join(root, "Commons", "tutorial", "items.json"), JSON.stringify([{ id: "lifemap", title: "The Life Map", body: "Every citizen is a bubble." }]));
  for (const n of citizens) fs.mkdirSync(path.join(root, "Pockets", n), { recursive: true });
  fs.writeFileSync(path.join(root, "house.json"), JSON.stringify({ citizens, desks: Object.fromEntries(citizens.map((n) => [n, { provider: "claude", model: "claude-opus-5-5", workspaceId: `wks_${n}` }])) }));
  return root;
}
const fake = (records: any[]) => {
  const log: string[] = [];
  return { log, deps: { records: () => records, send: async (id: string, text: string) => { log.push(`send ${id} ${text}`); },
    open: async (row: any, citizen: string, text: string) => { log.push(`open ${citizen} ${row.workspaceId} ${text}`); return "new-desk"; } } };
};

test("the lead citizen's desk gets one line naming the item, and its id comes back for the screen to open", async () => {
  const root = house(["Ultron", "Verro", "Jarvis"]);
  const f = fake([
    { id: "old", cwd: path.join(root, "Pockets", "Ultron"), labels: { role: "desk" }, archivedAt: "2026-10-13T00:00:00Z" },
    { id: "peer", cwd: path.join(root, "Pockets", "Ultron"), labels: {} },
    { id: "u-desk", cwd: path.join(root, "Pockets", "Ultron"), labels: { role: "desk" } },
    { id: "v-desk", cwd: path.join(root, "Pockets", "Verro"), labels: { role: "desk" } },
  ]);
  const r = await discuss(root, "lifemap", f.deps);
  assert.deepEqual(r, { ok: true, agentId: "u-desk", citizen: "Ultron", message: "Ultron has the page \"The Life Map\"." });
  assert.deepEqual(f.log, [`send u-desk ${discussLine({ id: "lifemap", title: "The Life Map", body: "Every citizen is a bubble." })}`]);
});

test("in a house without Ultron, the one citizen leads; with no desk, a desk is opened with the line first", async () => {
  const root = house(["Verro", "Jarvis"]);
  const f = fake([]);
  const r = await discuss(root, "lifemap", f.deps);
  assert.equal(r.agentId, "new-desk"); assert.equal(r.citizen, "Verro");
  assert.match(f.log[0], /^open Verro wks_Verro \[TUTORIAL\]/);
});

test("the line names the item, asks for plain words, and asks for the tick afterwards", () => {
  const l = discussLine({ id: "lifemap", title: "The Life Map", body: "Every citizen is a bubble." });
  assert.match(l, /^\[TUTORIAL\] /); assert.match(l, /"The Life Map"/); assert.match(l, /Every citizen is a bubble\./);
  assert.match(l, /okf\.mjs tick lifemap/);
});

test("an item not on the checklist is refused plainly", async () => {
  const r = await discuss(house(["Ultron"]), "nosuch", fake([]).deps);
  assert.equal(r.ok, false); assert.match(r.message, /not on/);
});

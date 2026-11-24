// "What to ask" (Andrew's idea, 2026-11-23; the owner's cards 2026-11-23 3:02 PM, 2026-11-24 1:57 PM, 2:22 PM and 3:17 PM CST):
// a Help tab with each citizen's own example questions, "Try it" on each, and the citizens the house can add under
// "Citizens you can add". Seams agreed with the owner, 2026-11-24 3:59 PM CST: the list reader and "Try it" finding the chat.
//   node --test test/what-to-ask.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { whatToAsk } from "../server/what-to-ask.ts";

const PNG = Buffer.from("89504e470d0a1a0a", "hex");
function house(inHouse: string[], upstream: string[], faces: string[] = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "house-"));
  for (const n of inHouse) { fs.mkdirSync(path.join(root, "Pockets", n), { recursive: true }); fs.writeFileSync(path.join(root, "Pockets", n, "AGENTS.md"), "# contract\n"); }
  for (const n of upstream) { fs.mkdirSync(path.join(root, ".upstream", "Pockets", n), { recursive: true }); fs.writeFileSync(path.join(root, ".upstream", "Pockets", n, "AGENTS.md"), "# contract\n"); }
  for (const n of faces) fs.writeFileSync(path.join(root, fs.existsSync(path.join(root, "Pockets", n)) ? "Pockets" : ".upstream/Pockets", n, "face.png"), PNG);
  return root;
}

test("a house with four of the six shows them with their questions, and the two it lacks under the ones it can add", () => {
  const root = house(["Ultron", "MissMinutes", "Friday", "Jarvis"], ["Ultron", "MissMinutes", "Verro", "Vision", "Friday", "Jarvis"]);
  const r = whatToAsk(root);
  assert.deepEqual(r.inHouse.map((c) => c.name), ["Ultron", "Miss Minutes", "Friday", "Jarvis"]);
  assert.deepEqual(r.canAdd.map((c) => c.name), ["Verro", "Vision"]);
  const minnie = r.inHouse.find((c) => c.pocket === "MissMinutes")!;
  assert.equal(minnie.title, "Keeps your time and your tasks");
  assert.deepEqual(minnie.asks, ["What is waiting on me today?", "Plan my week: what matters most?", "What is on my calendar tomorrow?", "Remind me to call the dentist on Friday."]);
  assert.equal(r.canAdd[0]!.asks[0], "Make a first cut of this footage.");
});

test("a citizen the house made itself shows with no examples; Ultron and Jarvis are never offered, since they join on their own", () => {
  const root = house(["Verro", "Gardener"], ["Ultron", "MissMinutes", "Verro", "Vision", "Friday", "Jarvis"]);
  const r = whatToAsk(root);
  assert.deepEqual(r.inHouse.map((c) => [c.name, c.asks.length]), [["Verro", 4], ["Gardener", 0]]);
  assert.deepEqual(r.canAdd.map((c) => c.name), ["Miss Minutes", "Vision", "Friday"]);
});

test("a citizen only offered when the release holds it; a folder with no contract is not a citizen", () => {
  const root = house(["Jarvis"], ["MissMinutes"]);
  fs.mkdirSync(path.join(root, "Pockets", "Scratch"), { recursive: true });
  const r = whatToAsk(root);
  assert.deepEqual(r.inHouse.map((c) => c.name), ["Jarvis"]);
  assert.deepEqual(r.canAdd.map((c) => c.name), ["Miss Minutes"]);
});

test("a face comes from the citizen's face.png, in the house or in the release; none is null", () => {
  const root = house(["Friday"], ["Friday", "Vision", "Verro"], ["Friday", "Vision"]);
  const r = whatToAsk(root);
  assert.equal(r.inHouse[0]!.face, `data:image/png;base64,${PNG.toString("base64")}`);
  assert.equal(r.canAdd.find((c) => c.pocket === "Vision")!.face, `data:image/png;base64,${PNG.toString("base64")}`);
  assert.equal(r.canAdd.find((c) => c.pocket === "Verro")!.face, null);
});

// "Try it": the citizen's chat opens with the question in its message box, not sent. The server's part is the chat:
// its desk, or a new desk opened with the house's clock-in line (the line every desk the house opens starts with).
import { tryIt, CLOCK_IN } from "../server/what-to-ask.ts";

function withDesks(inHouse: string[]) {
  const root = house(inHouse, []);
  fs.writeFileSync(path.join(root, "house.json"), JSON.stringify({ citizens: inHouse, desks: Object.fromEntries(inHouse.map((n) => [n, { provider: "claude", model: "claude-opus-5-5", workspaceId: `wks_${n}` }])) }));
  return root;
}
const fake = (records: any[]) => {
  const log: string[] = [];
  return { log, deps: { records: () => records, send: async (id: string, text: string) => { log.push(`send ${id} ${text}`); },
    open: async (row: any, citizen: string, text: string) => { log.push(`open ${citizen} ${row.workspaceId} ${text}`); return "new-desk"; } } };
};

test("Try it on a citizen with a desk gives that desk, and sends it nothing", async () => {
  const root = withDesks(["Friday", "Jarvis"]);
  const f = fake([
    { id: "f-old", cwd: path.join(root, "Pockets", "Friday"), labels: { role: "desk" }, archivedAt: "2026-11-01T00:00:00Z" },
    { id: "f-peer", cwd: path.join(root, "Pockets", "Friday"), labels: {} },
    { id: "f-desk", cwd: path.join(root, "Pockets", "Friday"), labels: { role: "desk" } },
  ]);
  assert.deepEqual(await tryIt(root, "Friday", f.deps), { ok: true, agentId: "f-desk" });
  assert.deepEqual(f.log, []);
});

test("Try it on a citizen with no desk opens one with the clock-in line, once", async () => {
  const root = withDesks(["Friday", "Jarvis"]);
  const f = fake([]);
  assert.deepEqual(await tryIt(root, "Jarvis", f.deps), { ok: true, agentId: "new-desk" });
  assert.deepEqual(f.log, [`open Jarvis wks_Jarvis ${CLOCK_IN}`]);
  assert.equal(CLOCK_IN, "[JANITOR] Clock in. Read your boot per your contract.");
});

test("Try it on a citizen the house does not have opens nothing and says so", async () => {
  const root = withDesks(["Friday"]);
  const f = fake([]);
  assert.deepEqual(await tryIt(root, "Verro", f.deps), { ok: false, message: "Verro is not in this house yet. Add Verro first, in the Citizens view." });
  assert.deepEqual(f.log, []);
});

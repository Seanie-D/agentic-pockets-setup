// How the citizens run (ticket 004 Q11, the owner 2026-10-08: "On-demand is the default; always-on is a choice", with a
// plain warning on always-on and "Ask about this" on every selection once the first citizen is up).
//   node --test test/mode.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MODES, withTier } from "../shared/mode.ts";
import { setMode } from "../server/setup.ts";
import { ask, askLine } from "../server/discuss.ts";

test("withTier: replaces the tier line, adds one to a frontmatter without it, and adds a frontmatter to a file without one", () => {
  assert.equal(withTier("---\nname: V\ntier: standing\nvoice: x\n---\n# V\n", "on-call"), "---\nname: V\ntier: on-call\nvoice: x\n---\n# V\n");
  assert.equal(withTier("---\nname: V\n---\n# V\n", "standing"), "---\nname: V\ntier: standing\n---\n# V\n");
  assert.equal(withTier("# V\n", "on-call"), "---\ntier: on-call\n---\n# V\n");
  assert.equal(withTier("---\r\nname: V\r\ntier: standing\r\n---\r\n# V\r\n", "on-call"), "---\r\nname: V\r\ntier: on-call\r\n---\r\n# V\r\n");
});

test("the always-on choice carries the owner's warning, word for word; on demand is the default", () => {
  assert.equal(MODES["always-on"].warning, "If you're confused by what this means, do not click it.");
  assert.equal(MODES["on-demand"].warning, undefined);
});

function house(citizens: string[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "house-"));
  for (const n of citizens) { fs.mkdirSync(path.join(root, "Pockets", n), { recursive: true }); fs.writeFileSync(path.join(root, "Pockets", n, "AGENTS.md"), `---\nname: ${n}\ntier: on-call\n---\n# ${n}\n`); }
  fs.writeFileSync(path.join(root, "house.json"), JSON.stringify({ citizens, placedCitizens: citizens, mode: "on-demand", desks: Object.fromEntries(citizens.map((n) => [n, { provider: "claude", model: "m", workspaceId: `wks_${n}` }])) }));
  return root;
}

test("setMode after setup: every citizen in the house record changes tier, and the record keeps the mode", () => {
  const root = house(["Verro", "Jarvis"]);
  assert.deepEqual(setMode(root, "always-on").changed, ["Jarvis", "Verro"]);
  for (const n of ["Verro", "Jarvis"]) assert.match(fs.readFileSync(path.join(root, "Pockets", n, "AGENTS.md"), "utf8"), /^tier: standing$/m);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "house.json"), "utf8")).mode, "always-on");
  assert.deepEqual(setMode(root, "always-on").changed, [], "nothing to change the second time");
});

test("Ask about this: the lead's desk gets one line naming the choice and its words; an unknown topic is refused", async () => {
  const root = house(["Verro", "Jarvis"]);
  const log: string[] = [];
  const deps = { records: () => [{ id: "v-desk", cwd: path.join(root, "Pockets", "Verro"), labels: { role: "desk" } }],
    send: async (id: string, text: string) => { log.push(`send ${id} ${text}`); }, open: async () => "new" };
  const r = await ask(root, "mode", deps);
  assert.equal(r.ok, true); assert.equal(r.agentId, "v-desk");
  assert.deepEqual(log, [`send v-desk ${askLine("mode")}`]);
  assert.match(askLine("mode"), /^\[SETUP\] The user pressed "Ask about this" on "How your citizens run"/);
  assert.ok(askLine("mode").includes(MODES["always-on"].text) && askLine("mode").includes(MODES["on-demand"].text));
  assert.equal((await ask(root, "nonsense", deps)).ok, false);
});

test("withTier: the line ending comes from the first line; an empty frontmatter takes the tier", () => {
  assert.equal(withTier("---\nname: V\n---\n# V\r\nbody\r\n", "on-call"), "---\nname: V\ntier: on-call\n---\n# V\r\nbody\r\n");
  assert.equal(withTier("---\n---\n# V\n", "standing"), "---\ntier: standing\n---\n# V\n");
});

test("setMode changes only the pockets setup placed; a pocket the user already had keeps its tier", () => {
  const root = house(["Verro", "Jarvis"]);
  const rec = JSON.parse(fs.readFileSync(path.join(root, "house.json"), "utf8"));
  fs.writeFileSync(path.join(root, "house.json"), JSON.stringify({ ...rec, placedCitizens: ["Jarvis"] }));
  assert.deepEqual(setMode(root, "always-on").changed, ["Jarvis"]);
  assert.match(fs.readFileSync(path.join(root, "Pockets", "Verro", "AGENTS.md"), "utf8"), /^tier: on-call$/m);
});

test("setMode in a house with no record says so, and changes nothing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nohouse-"));
  const r = setMode(root, "always-on");
  assert.equal(r.ok, false); assert.deepEqual(r.changed, []);
});

test("Ask about this: a topic that is a name on every object is still refused", async () => {
  const root = house(["Verro"]);
  const deps = { records: () => [], send: async () => {}, open: async () => "x" };
  for (const t of ["constructor", "toString", "__proto__"]) assert.equal((await ask(root, t, deps)).ok, false, t);
});

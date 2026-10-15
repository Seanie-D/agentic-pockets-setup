// Item 4b of the next update (the owner, Ultron's desk, 2026-10-15 15:45 CDT; shape approved 16:18 CDT, "Approve as is"):
// after setup ends, the setup page shows house-check's seven lines, each with a tick or what is missing.
//   node --test test/house-status.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { houseStatus, type StatusInput } from "../server/house-status.ts";

const good = (): StatusInput => ({
  tools: [{ name: "node", state: "ok", have: "22.4.0" }, { name: "git", state: "ok", have: "2.44.0" }, { name: "claude", state: "ok", have: "2.1.290" }, { name: "paseo", state: "ok", have: "0.11.2" }],
  npm: true,
  record: { setupDone: true, userName: "Nick", release: { id: "r1", setupRef: "abc" }, citizens: ["Verro"], placedCitizens: ["Verro", "Jarvis"], mode: "on-demand",
    desks: { Verro: { workspaceId: "w1" }, Jarvis: { workspaceId: "w2" } } },
  pockets: { Verro: { contract: true, version: true, settings: true, hook: true, tier: "on-call" }, Jarvis: { contract: true, version: true, settings: true, hook: true, tier: "on-call" } },
  plugins: [{ id: "agentic-pockets", running: true }, { id: "agentic-pockets-setup", running: true }, { id: "beautiful-pockets", running: true }],
  beautifulPockets: { folder: true, built: true },
  workspaces: ["w1", "w2", "w9"],
});

test("a whole house reads seven ticks, in house-check's order", () => {
  const lines = houseStatus(good());
  assert.deepEqual(lines.map((l) => l.what), ["Claude Code", "Node, npm and Paseo", "The house record", "Each citizen's pocket", "Paseo's plugins", "Beautiful Pockets built", "The workspaces"]);
  assert.ok(lines.every((l) => l.ok), JSON.stringify(lines.filter((l) => !l.ok)));
});

test("each missing piece is named in plain words", () => {
  const i = good();
  i.tools[2] = { name: "claude", state: "old", have: "2.1.140" };
  i.npm = false;
  i.record = { ...i.record, setupDone: false, desks: { Verro: { workspaceId: "w1" } } };
  i.pockets.Verro = { ...i.pockets.Verro, hook: false, tier: "standing" };
  i.plugins = [{ id: "agentic-pockets", running: false }, { id: "agentic-pockets-setup", running: true }];
  i.beautifulPockets = { folder: true, built: false };
  i.workspaces = ["w9"];
  const by = Object.fromEntries(houseStatus(i).map((l) => [l.what, l]));
  assert.equal(by["Claude Code"].detail, "Claude Code 2.1.140 runs first; 2.1.280 or newer is needed.");
  assert.equal(by["Node, npm and Paseo"].detail, "npm does not answer.");
  assert.equal(by["The house record"].detail, "Setup is not marked finished. Jarvis has no desk row.");
  assert.equal(by["Each citizen's pocket"].detail, "Verro: the hook house-tools.mjs is missing; the tier is standing, but this house runs on demand.");
  assert.equal(by["Paseo's plugins"].detail, "agentic-pockets is not running. Beautiful Pockets is not in Paseo.");
  assert.equal(by["Beautiful Pockets built"].detail, "Its build did not finish.");
  assert.equal(by["The workspaces"].detail, "Verro's workspace is missing.");
  assert.ok(Object.values(by).every((l) => !l.ok));
});

test("Beautiful Chat in Beautiful Pockets' place is fine, and then the build line is not asked", () => {
  const i = good();
  i.plugins = [{ id: "agentic-pockets", running: true }, { id: "agentic-pockets-setup", running: true }, { id: "beautiful-chat", running: true }];
  i.beautifulPockets = { folder: false, built: false };
  const by = Object.fromEntries(houseStatus(i).map((l) => [l.what, l]));
  assert.equal(by["Paseo's plugins"].ok, true);
  assert.deepEqual([by["Beautiful Pockets built"].ok, by["Beautiful Pockets built"].detail], [true, "Not needed: this Paseo keeps Beautiful Chat."]);
});

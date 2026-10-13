// The update system, ticket 06 (Sean, 2026-10-13: a house is offered updates, never forced). The Paseo Cafe updates
// every plugin that tracks a branch every six hours, setup included; the app's Plugin source box takes no commit, so
// setup puts itself on the Cafe's own opt-out list when it adds the Cafe, keeping everything else the Cafe holds.
//   node --test test/cafe-optout.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { withOptOut } from "../shared/cafe.ts";

test("setup joins the Cafe's opt-out list and keeps the rest of the Cafe's settings", () => {
  assert.deepEqual(withOptOut({ version: 5, values: { registryUrl: "https://plugins.paseo.sh", autoUpdateOptOuts: ["muted"] } }, "agentic-pockets-setup"),
    { version: 5, values: { registryUrl: "https://plugins.paseo.sh", autoUpdateOptOuts: ["muted", "agentic-pockets-setup"] } });
});

test("no settings yet: a file with only the opt-out; already on it: unchanged", () => {
  assert.deepEqual(withOptOut(null, "agentic-pockets-setup"), { version: 5, values: { autoUpdateOptOuts: ["agentic-pockets-setup"] } });
  const on = { version: 5, values: { autoUpdateOptOuts: ["agentic-pockets-setup"] } };
  assert.deepEqual(withOptOut(on, "agentic-pockets-setup"), on);
});

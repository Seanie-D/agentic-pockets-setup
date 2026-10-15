// The Setup / Help button in each citizen's workspace (the owner, 2026-10-15: setup must be reachable with the sidebar
// off; "Lets add the Setup button"): which workspaces get it, and what it says.
//   node --test test/help-button.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { helpButton } from "../shared/help-button.ts";

test("every citizen's workspace in the house record gets the button, each once", () => {
  const b = helpButton({ desks: { Jarvis: { workspaceId: "w-j" }, Ultron: { workspaceId: "w-u" }, Verro: { workspaceId: "w-j" } } }, false);
  assert.deepEqual(b.workspaceIds.sort(), ["w-j", "w-u"]);
});

test("no house record, no desks, or a row with no workspace: no button", () => {
  assert.deepEqual(helpButton(null, false).workspaceIds, []);
  assert.deepEqual(helpButton({}, false).workspaceIds, []);
  assert.deepEqual(helpButton({ desks: { Jarvis: {}, Ultron: { workspaceId: "" }, Vision: { workspaceId: 7 } } }, false).workspaceIds, []);
});

test("it says Setup until the tutorial is complete, then Help", () => {
  assert.equal(helpButton({}, false).label, "Setup");
  assert.equal(helpButton({}, true).label, "Help");
});

// TH5, 2026-10-15 (Friday): Verro and Vision each had a second workspace that house.json does not name. The Life map
// button follows every workspace in a citizen's folder; the Setup button now does too.
test("a citizen's other live workspaces in its own folder get the button too; another folder, an archived one, or no citizen does not", () => {
  const root = "/Users/t/agentic-pockets";
  const b = helpButton({ desks: { Verro: { workspaceId: "w-1" }, Vision: { workspaceId: "w-3" } } }, false, root, [
    { workspaceId: "w-2", cwd: `${root}/Pockets/Verro` },
    { workspaceId: "w-old", cwd: `${root}/Pockets/Verro`, archivedAt: "2026-10-01T00:00:00Z" },
    { workspaceId: "w-sub", cwd: `${root}/Pockets/Verro/sub` },
    { workspaceId: "w-root", cwd: root },
    { workspaceId: "w-nobody", cwd: `${root}/Pockets/Nobody` },
  ]);
  assert.deepEqual(b.workspaceIds.sort(), ["w-1", "w-2", "w-3"]);
});

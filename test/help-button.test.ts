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

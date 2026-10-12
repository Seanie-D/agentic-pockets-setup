// The welcome take-over (Sean, 14:23 CDT, via Ultron's mail 19:24Z and ticket 009): the moment the setup plugin loads,
// the welcome opens once; "set up later, leave my Paseo alone!" or starting setup means it never takes over again.
//   node --test test/welcome.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { welcomeSeen, markWelcomeSeen } from "../server/welcome.ts";
import { takeOver, WELCOME_LINE, LEAVE_ME_ALONE } from "../shared/welcome.ts";

test("the welcome is unseen on a new computer, and seen for good once dismissed", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "home-"));
  assert.equal(welcomeSeen(home), false);
  markWelcomeSeen(home, "2026-10-14T13:00:00.000Z");
  assert.equal(welcomeSeen(home), true);
  assert.ok(fs.existsSync(path.join(home, ".agentic-pockets", "welcome.json")), "kept beside the house key, outside any house");
});

test("the sidebar item takes the screen over once: only while unseen, and only once per app session", () => {
  assert.equal(takeOver({ seen: false, openedThisSession: false }), true);
  assert.equal(takeOver({ seen: true, openedThisSession: false }), false, "dismissed or started: never again");
  assert.equal(takeOver({ seen: false, openedThisSession: true }), false, "a reload does not reopen it");
  assert.equal(takeOver({ seen: undefined, openedThisSession: false }), false, "still reading the flag: wait");
});

test("the words are Sean's, verbatim", () => {
  assert.equal(WELCOME_LINE, "Welcome to Sean's Agentic Pockets! Let's walk through setting up your agents.");
  assert.equal(LEAVE_ME_ALONE, "set up later, leave my Paseo alone!");
});

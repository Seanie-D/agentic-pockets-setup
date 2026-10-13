// The welcome take-over (ticket 009, asked 2026-10-12): the moment the setup plugin loads,
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

test("the words are the owner's, verbatim", () => {
  assert.equal(WELCOME_LINE, "Welcome to Sean's Agentic Pockets! Let's walk through setting up your agents.");
  assert.equal(LEAVE_ME_ALONE, "set up later, leave my Paseo alone!");
});

// Ticket 18 (Sean, 2026-10-13 08:34 CDT, via Ultron): "set up later" shows where setup lives.
test("the line after 'set up later' is the owner's, verbatim", async () => {
  const { LEFT_ALONE_LINE } = await import("../shared/welcome.ts");
  assert.equal(LEFT_ALONE_LINE, "Got it! You can start setup again any time you want by clicking the plugin over here.");
});

test("'set up later' asks the sidebar row to point once, and the row takes the ask once", async () => {
  const { askToPoint, takePoint, onPoint } = await import("../shared/pointer.ts");
  assert.equal(takePoint(), false, "nothing to take before the ask");
  let heard = 0;
  const off = onPoint(() => { heard += 1; });
  askToPoint();
  assert.equal(heard, 1, "a mounted row hears the ask at once");
  assert.equal(takePoint(), true);
  assert.equal(takePoint(), false, "taken once: a second render, or a reload, points at nothing");
  off();
  askToPoint();
  assert.equal(heard, 1, "a row that has gone hears nothing");
  assert.equal(takePoint(), true, "a row that mounts later still finds the ask");
});

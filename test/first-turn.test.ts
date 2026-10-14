// Sean, re-walk 3, 2026-10-14 09:14 CDT: "You're good to go!" said the first citizen had said hello, when its first turn
// had failed (OAuth). The page now says only what Paseo's record of that desk shows.
//   node --test test/first-turn.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { firstTurn } from "../server/first-turn.ts";

test("a desk still working is starting; a finished first turn is done; an error is shown in its own words", () => {
  assert.deepEqual(firstTurn(undefined), { state: "starting" }, "no record yet");
  assert.deepEqual(firstTurn({ lastStatus: "running", attentionReason: null }), { state: "starting" });
  assert.deepEqual(firstTurn({ lastStatus: "idle", attentionReason: "finished", lastError: null }), { state: "done" });
  assert.deepEqual(firstTurn({ lastStatus: "idle", attentionReason: null }), { state: "starting" }, "a new desk is idle before its first turn runs");
  // Paseo clears attentionReason once the user opens the desk, which the page asks them to do.
  assert.deepEqual(firstTurn({ lastStatus: "idle", attentionReason: null, lastUserMessageAt: "2026-10-14T14:00:00Z", lastActivityAt: "2026-10-14T14:00:09Z" }), { state: "done" }, "answered, then opened");
  assert.deepEqual(firstTurn({ lastStatus: "closed", lastUserMessageAt: "2026-10-14T14:00:00Z", lastActivityAt: "2026-10-14T14:00:09Z" }), { state: "done" });
  assert.deepEqual(firstTurn({ lastStatus: "idle", lastUserMessageAt: "2026-10-14T14:00:00Z", lastActivityAt: "2026-10-14T14:00:00Z" }), { state: "starting" }, "nothing after the first message yet");
  assert.deepEqual(firstTurn({ lastStatus: "running", lastUserMessageAt: "2026-10-14T14:00:00Z", lastActivityAt: "2026-10-14T14:00:09Z" }), { state: "starting" });
  assert.deepEqual(firstTurn({ lastStatus: "idle", lastError: '{"name":"APIError","data":{"message":"OAuth session expired"}}' }), { state: "failed", message: "OAuth session expired" });
  assert.deepEqual(firstTurn({ lastStatus: "error", lastError: "Failed to authenticate" }), { state: "failed", message: "Failed to authenticate" });
  assert.deepEqual(firstTurn({ lastStatus: "error" }), { state: "failed", message: "The first message did not run." });
  const long = firstTurn({ lastStatus: "idle", lastError: "x".repeat(900) });
  assert.ok(long.state === "failed" && long.message.length <= 300, "kept short");
});

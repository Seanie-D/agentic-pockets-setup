// Item 1 of the next update: after setup, when a Claude sign-in runs
// out, the house plugin's Citizens page says so and offers Sign in again. Setup holds the sign-in; this names which one.
//   node --test test/sign-in-again.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { signInTarget } from "../shared/sign-in-again.ts";

test("the house's own Claude folder when any desk runs on it, else the user's own Claude, else none", () => {
  assert.equal(signInTarget({ desks: { Ultron: { provider: "claude-house" }, Verro: { provider: "codex" } } }), "house");
  assert.equal(signInTarget({ desks: { Ultron: { provider: "claude" } } }), "own");
  assert.equal(signInTarget({ desks: { Verro: { provider: "codex" } } }), null);
  assert.equal(signInTarget({}), null);
  assert.equal(signInTarget(null), null);
});

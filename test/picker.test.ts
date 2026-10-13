// The picker rule (ticket 004 Q5; the owner's yes to the test, 2026-10-12): ticking two or more citizens ticks Ultron and
// greys him out; going back to one unticks him and leaves him free.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPick, modeAfterSetup, toggle, view } from "../shared/picker.ts";

test("one citizen: Ultron is free, and unticked", () => {
  const v = view(toggle(emptyPick(), "Verro"));
  assert.deepEqual(v.citizens, ["Verro"]); assert.equal(v.ultron, "free-off");
});
test("two citizens: Ultron is ticked and locked", () => {
  const v = view(toggle(toggle(emptyPick(), "Verro"), "Vision"));
  assert.deepEqual(v.citizens, ["Ultron", "Verro", "Vision"]); assert.equal(v.ultron, "locked-on");
});
test("back to one: Ultron is unticked and free again", () => {
  const s = toggle(toggle(toggle(emptyPick(), "Verro"), "Vision"), "Vision");
  const v = view(s); assert.deepEqual(v.citizens, ["Verro"]); assert.equal(v.ultron, "free-off");
});
test("with one citizen, Ultron may be ticked by hand; a locked Ultron cannot be unticked", () => {
  const one = toggle(toggle(emptyPick(), "Verro"), "Ultron");
  assert.deepEqual(view(one).citizens, ["Ultron", "Verro"]); assert.equal(view(one).ultron, "free-on");
  const two = toggle(toggle(emptyPick(), "Verro"), "Vision");
  assert.deepEqual(view(toggle(two, "Ultron")).citizens, ["Ultron", "Verro", "Vision"]);
});
test("only the four offered packs and Ultron can be ticked", () => {
  assert.deepEqual(view(toggle(emptyPick(), "Butler")).citizens, []);
});

// Sean's Mac re-walk, 2026-10-13 16:43 CDT: "You're good to go!" with one citizen still showed "How your citizens run"
// at the bottom, "which is weird". With one citizen the choice stays on its step; with two or more it is offered again.
test("the good-to-go screen offers how the citizens run only for two or more citizens", () => {
  assert.equal(modeAfterSetup(toggle(emptyPick(), "Verro")), false, "one citizen");
  assert.equal(modeAfterSetup(toggle(toggle(emptyPick(), "Verro"), "Ultron")), true, "a citizen and Ultron by hand");
  assert.equal(modeAfterSetup(toggle(toggle(emptyPick(), "Verro"), "Vision")), true, "two, and Ultron with them");
});

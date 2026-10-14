// The picker rule (ticket 004 Q5; the owner's yes to the test, 2026-10-12): ticking two or more citizens ticks Ultron and
// greys him out; going back to one unticks him and leaves him free.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPick, pickFrom, toggle, view } from "../shared/picker.ts";

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

// Sean, re-walk 3, 2026-10-14 09:14 CDT: "If a failed start up install happens, we need to keep the citizens that were
// toggled previously still checked." The citizens a Start sent are kept by the server; the picker is rebuilt from them.
test("the picker is rebuilt from the citizens a Start sent, Ultron by hand only when one was picked", () => {
  for (const p of [toggle(emptyPick(), "Verro"), toggle(toggle(emptyPick(), "Verro"), "Ultron"), toggle(toggle(emptyPick(), "Vision"), "Verro")])
    assert.deepEqual(view(pickFrom(view(p).citizens)).citizens, view(p).citizens);
  assert.equal(pickFrom(["Ultron", "Verro"]).ultronByHand, true);
  assert.equal(pickFrom(["Ultron", "Verro", "Vision"]).ultronByHand, false, "locked on, not by hand");
  assert.deepEqual(pickFrom(["Jarvis", "Butler"]).packs, [], "only the offered packs");
});

import "./scratch-tmp.mjs"; // first: this file's temp folders are removed when it ends
// Help's three box topics (the "Ours" build, ticket 04) and the tab Beautiful Pockets asks for. Run: node --test test/box-help.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { BOX_HELP, BOXES, TICKET_HELP, TICKET_LINK } from "../shared/box-help.ts";
import { askBox, askedBox, askedTab, askTab, onTabAsked } from "../shared/help-tab.ts";

test("each box has a topic, and every box name in it is in quotes and capitalized", () => {
  assert.deepEqual(BOXES, ["yours", "ours", "mine"]);
  for (const b of BOXES) {
    const all = `${BOX_HELP[b].name} ${BOX_HELP[b].holds} ${BOX_HELP[b].how}`;
    assert.ok(!/(?<!")\b(Yours|Ours|Mine)\b(?!")/.test(all), `${b}: a bare box name in "${all}"`);
  }
});

test("asking for a box opens the boxes tab once, at that box", () => {
  const seen: string[] = [];
  const off = onTabAsked((t) => seen.push(t));
  askBox("ours");
  off();
  assert.deepEqual(seen, ["boxes"]);
  assert.equal(askedTab(), "boxes");
  assert.equal(askedBox(), "ours");
  assert.equal(askedBox(), null, "taken once");
});

// Help's ticket page (release 1.19): the owner's words, and each box named in quotes.
test("the ticket page says what a ticket is, box by box, in the owner's words", () => {
  const all = [TICKET_HELP.intro, ...BOXES.map((b) => TICKET_HELP.boxes[b]), TICKET_HELP.tail, TICKET_LINK].join(" ");
  assert.ok(!/(?<!")\b(Yours|Ours|Mine)\b(?!")/.test(all), `a bare box name in "${all}"`);
  assert.match(TICKET_HELP.intro, /anything not yet finished or addressed/);
  assert.match(TICKET_HELP.boxes.yours, /^"Yours": the ball is in your court\./);
  assert.match(TICKET_HELP.boxes.ours, /^"Ours": the two of you work it out together\./);
  assert.match(TICKET_HELP.boxes.mine, /The Work through tasks button in "Mine" is that nudge\.$/);
  assert.match(TICKET_HELP.tail, /holds smaller tickets of its own/);
});

test("a box topic's ticket link opens the Tickets tab", () => {
  const seen: string[] = [];
  const off = onTabAsked((t) => seen.push(t));
  askTab("tickets");
  off();
  assert.deepEqual(seen, ["tickets"]);
  assert.equal(askedTab(), "tickets");
});

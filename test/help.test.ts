// Agentic Pockets Help (ticket 009 Q1c, the owner 2026-10-12 14:44 CDT): after the tutorial is complete the Help view
// holds the pages to re-read, the glossary, a /wait-what reminder, and "Ask Ultron about this". The glossary is the
// house's own `Commons/reference/rules/glossary.md`, read at run time; the ask goes to the lead citizen's desk.
//   node --test test/help.test.ts
import "./scratch-tmp.mjs"; // first: this file's temp folders are removed when it ends
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { askHelp, readGlossary } from "../server/help.ts";

const GLOSSARY = `---
type: reference
title: The words of the Pockets
changes:
  - 2026-09-14 — seeded with every word
---

# The words of the Pockets

One line per word: **word** — what it means; *not:* the word it is confused with; *rule:* where the
long form lives.

- **desk** — the one session of a citizen labelled \`role=desk\`, which everyone addresses. *not:* a peer, which is any other session of the same citizen. *rule:* your contract, *Your day*.
- **Minnie** — *name the owner uses* for **Miss Minutes**. *not:* a citizen of its own. *rule:* the last line of \`Commons/tenets.md\`.
- **pocket** — one folder that is one citizen's whole mind. *rule:* tenet 1.
`;

function house(citizens: string[], glossary: string | null = GLOSSARY) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "house-"));
  fs.mkdirSync(path.join(root, "Commons", "reference", "rules"), { recursive: true });
  fs.mkdirSync(path.join(root, "Commons", "tutorial"), { recursive: true });
  if (glossary !== null) fs.writeFileSync(path.join(root, "Commons", "reference", "rules", "glossary.md"), glossary);
  fs.writeFileSync(path.join(root, "Commons", "tutorial", "items.json"), JSON.stringify([{ id: "lifemap", title: "The Life Map", body: "Every citizen is a bubble." }]));
  for (const n of citizens) fs.mkdirSync(path.join(root, "Pockets", n), { recursive: true });
  fs.writeFileSync(path.join(root, "house.json"), JSON.stringify({ citizens, desks: Object.fromEntries(citizens.map((n) => [n, { provider: "claude", model: "claude-opus-5-5", workspaceId: `wks_${n}` }])) }));
  return root;
}

test("the glossary is the house's own file: each word with its meaning and what it is not, in plain text, and no file paths", () => {
  assert.deepEqual(readGlossary(house(["Ultron"])), [
    { word: "desk", meaning: "the one session of a citizen labelled role=desk, which everyone addresses.", not: "a peer, which is any other session of the same citizen." },
    { word: "Minnie", meaning: "name the owner uses for Miss Minutes.", not: "a citizen of its own." },
    { word: "pocket", meaning: "one folder that is one citizen's whole mind." },
  ]);
});

// A house that has not taken release 1.19 still keeps its glossary at the reference folder's top.
test("a house whose glossary is still at the old place gets its words too", () => {
  const root = house(["Ultron"], null);
  fs.writeFileSync(path.join(root, "Commons", "reference", "glossary.md"), GLOSSARY);
  assert.equal(readGlossary(root).length, 3);
});

test("a house with no glossary file has no words, and nothing breaks", () => {
  assert.deepEqual(readGlossary(house(["Ultron"], null)), []);
});

const fake = (records: any[]) => {
  const log: string[] = [];
  return { log, deps: { records: () => records, send: async (id: string, text: string) => { log.push(`send ${id} ${text}`); },
    open: async (row: any, citizen: string, text: string) => { log.push(`open ${citizen} ${row.workspaceId} ${text}`); return "new-desk"; } } };
};

test("Ask about a word: Ultron's desk gets one line with the word and its meaning, and its id comes back for the screen to open", async () => {
  const root = house(["Ultron", "Verro"]);
  const f = fake([
    { id: "v-desk", cwd: path.join(root, "Pockets", "Verro"), labels: { role: "desk" } },
    { id: "u-desk", cwd: path.join(root, "Pockets", "Ultron"), labels: { role: "desk" } },
  ]);
  const r = await askHelp(root, { kind: "term", id: "desk" }, f.deps);
  assert.deepEqual(r, { ok: true, agentId: "u-desk", citizen: "Ultron", message: "Ultron has the word \"desk\"." });
  assert.equal(f.log.length, 1);
  assert.match(f.log[0], /^send u-desk \[HELP\] /);
  assert.match(f.log[0], /"desk"/);
  assert.match(f.log[0], /the one session of a citizen labelled role=desk/);
});

test("in a house without Ultron the lead citizen gets it; with no desk, its desk is opened with the line first", async () => {
  const f = fake([]);
  const r = await askHelp(house(["Verro", "Jarvis"]), { kind: "term", id: "pocket" }, f.deps);
  assert.equal(r.ok, true); assert.equal(r.agentId, "new-desk"); assert.equal(r.citizen, "Verro");
  assert.equal(f.log.length, 1);
  assert.match(f.log[0], /^open Verro wks_Verro \[HELP\] .*"pocket"/);
});

test("Ask about a page: the line names the tutorial page and its text, and asks for no tick (the tutorial is done)", async () => {
  const root = house(["Ultron"]);
  const f = fake([{ id: "u-desk", cwd: path.join(root, "Pockets", "Ultron"), labels: { role: "desk" } }]);
  const r = await askHelp(root, { kind: "page", id: "lifemap" }, f.deps);
  assert.deepEqual(r, { ok: true, agentId: "u-desk", citizen: "Ultron", message: "Ultron has the page \"The Life Map\"." });
  assert.match(f.log[0], /^send u-desk \[HELP\] .*"The Life Map": Every citizen is a bubble\. /);
  assert.doesNotMatch(f.log[0], /tick/);
});

test("a word not in the glossary, or a page not on the checklist, is refused plainly and nothing is sent", async () => {
  const f = fake([]);
  const w = await askHelp(house(["Ultron"]), { kind: "term", id: "nosuch" }, f.deps);
  assert.equal(w.ok, false); assert.match(w.message, /"nosuch" is not in this house's glossary/);
  const p = await askHelp(house(["Ultron"]), { kind: "page", id: "nosuch" }, f.deps);
  assert.equal(p.ok, false); assert.match(p.message, /"nosuch" is not on this house's tutorial/);
  assert.deepEqual(f.log, []);
});

test("a house with no citizen yet is told to finish setup, and nothing is sent", async () => {
  const f = fake([]);
  const r = await askHelp(house([]), { kind: "term", id: "desk" }, f.deps);
  assert.equal(r.ok, false); assert.match(r.message, /no citizen/);
  assert.deepEqual(f.log, []);
});

// Ticket 022 (Ultron's yes, 2026-10-13): Help says what Beautiful Chat does to a pasted picture, in the approved words.
test("Help's line on pasted pictures, word for word", async () => {
  const { PICTURE_TIP } = await import("../shared/beautiful-pockets.ts");
  assert.equal(PICTURE_TIP, "Pasted a picture and cannot see it in your message? Your citizen still got it. To see it, turn off Settings → Beautiful Pockets → Enhanced prompt bubble.");
});

// Verro's three-courts loop on Help's Tickets tab: read from the house's Commons as a data URI, and nothing when missing.
test("the Tickets tab's loop is read from the house's Commons, and a missing loop draws nothing", async () => {
  const { readLoop } = await import("../server/help.ts");
  const { TICKET_LOOP } = await import("../shared/box-help.ts");
  const root = house(["Ultron"]);
  assert.equal(readLoop(root, TICKET_LOOP.loop), null);
  fs.mkdirSync(path.join(root, "Commons", "reference", "house", "media"), { recursive: true });
  fs.writeFileSync(path.join(root, "Commons", "reference", "house", "media", "three-courts-loop.gif"), Buffer.from("GIF89a"));
  assert.match(readLoop(root, TICKET_LOOP.loop) ?? "", /^data:image\/gif;base64,/);
  assert.equal(readLoop(root, "../../Commons/notes.txt"), null, "only an image");
});

test("the loop the release ships is in this house's Commons and under the chat's 3 MB image limit", () => {
  for (const f of ["three-courts-loop.gif", "three-courts-loop.webp", "three-courts-still.png"]) {
    const at = path.join(import.meta.dirname, "..", "..", "..", "..", "..", "..", "Commons", "reference", "house", "media", f);
    if (!fs.existsSync(at)) continue; // a copy of the plugin outside this house
    assert.ok(fs.statSync(at).size < 3 * 1024 * 1024, `${f} is under 3 MB`);
  }
});

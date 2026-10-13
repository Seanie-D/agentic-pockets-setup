// Friday's Mac walk, 2026-10-13: each citizen's card on "Who would you like to start with?" showed its hello page raw,
// "#" and "**" on screen (Sean, 13:25 CDT). The card now draws the page's headings, bold, italics and lists.
//   node --test test/hello.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { helloBlocks } from "../shared/hello.ts";

test("a hello page becomes headings, paragraphs and list items, with no markdown marks left", () => {
  const md = `# Hello, my name is Verro

I edit in **DaVinci Resolve Studio**, on *your* timeline.

## What I do

- I build the first cuts.
- I sync many cameras,
  then I render.
* I read the [manual](https://example.com) first.
`;
  assert.deepEqual(helloBlocks(md), [
    { kind: "heading", spans: [{ text: "Hello, my name is Verro" }] },
    { kind: "paragraph", spans: [{ text: "I edit in " }, { text: "DaVinci Resolve Studio", bold: true }, { text: ", on " }, { text: "your", italic: true }, { text: " timeline." }] },
    { kind: "heading", spans: [{ text: "What I do" }] },
    { kind: "item", spans: [{ text: "I build the first cuts." }] },
    { kind: "item", spans: [{ text: "I sync many cameras, then I render." }] },
    { kind: "item", spans: [{ text: "I read the manual first." }] },
  ]);
});

test("an empty page draws nothing", () => {
  assert.deepEqual(helloBlocks("  \n\n"), []);
});

test("a line that is all bold is a heading of its own, not run into the line below", () => {
  assert.deepEqual(helloBlocks("**How I talk**\nShort and plain."), [
    { kind: "heading", spans: [{ text: "How I talk" }] },
    { kind: "paragraph", spans: [{ text: "Short and plain." }] },
  ]);
});

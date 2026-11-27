// Which Help tab opens next: "What to ask" when a link asked for it (the lead citizen's first-boot link, next piece),
// else the tutorial. The asked tab is taken once, by the next Help screen that opens, or by the one already open.
// "boxes": the three boxes under each chat (the "Ours" build, ticket 04), opened at one box by Beautiful Pockets.
// "tickets": what a ticket is (release 1.19), linked from each box's topic.
export type HelpTab = "tutorial" | "ask" | "tickets" | "boxes";
let asked: HelpTab | null = null;
const listeners = new Set<(t: HelpTab) => void>();
export function askTab(t: HelpTab) { asked = t; listeners.forEach((l) => l(t)); }
export function askedTab(): HelpTab | null { const t = asked; asked = null; return t; }
export function onTabAsked(l: (t: HelpTab) => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
// Which box the "boxes" tab opens at, asked with it: taken once, as the tab is.
import type { Box } from "./box-help";
let box: Box | null = null;
export function askBox(b: Box) { box = b; askTab("boxes"); }
export function askedBox(): Box | null { const b = box; box = null; return b; }

// Which Help tab opens next: "What to ask" when a link asked for it (the lead citizen's first-boot link, next piece),
// else the tutorial. The asked tab is taken once, by the next Help screen that opens, or by the one already open.
export type HelpTab = "tutorial" | "ask";
let asked: HelpTab | null = null;
const listeners = new Set<(t: HelpTab) => void>();
export function askTab(t: HelpTab) { asked = t; listeners.forEach((l) => l(t)); }
export function askedTab(): HelpTab | null { const t = asked; asked = null; return t; }
export function onTabAsked(l: (t: HelpTab) => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }

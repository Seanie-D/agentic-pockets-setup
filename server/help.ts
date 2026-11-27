// Agentic Pockets Help (ticket 009 Q1c, the owner 2026-10-12 14:44 CDT: after 100 % the setup plugin is "Agentic Pockets
// Help", with the tutorial pages to re-read, the glossary, a /wait-what reminder, and "Ask Ultron about this").
// The glossary is the house's own Commons/reference/rules/glossary.md, read when the view opens, so it is always that house's words.
import fs from "node:fs";
import path from "node:path";
import { reach, type DiscussDeps } from "./discuss.ts";
import { leadOf, readTutorial } from "./tutorial.ts";

export interface Asked { ok: boolean; agentId?: string; citizen?: string; message: string }
export interface Term { word: string; meaning: string; not?: string }

// Markdown marks off, for a screen that shows plain text: **bold**, *italic*, `code`.
const plain = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\s+/g, " ").trim();

// One line per word: `- **word** — meaning. *not:* … *rule:* …`. The rule names a file for citizens, so the user does not see it.
export function readGlossary(root: string): Term[] {
  // rules/ since the reference was grouped (release 1.19); the old place is read for a house that has not taken it yet.
  let text = "";
  for (const at of [["rules", "glossary.md"], ["glossary.md"]]) { try { text = fs.readFileSync(path.join(root, "Commons", "reference", ...at), "utf8"); break; } catch { /* next */ } }
  if (!text) return [];
  const out: Term[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^- \*\*(.+?)\*\* — (.*)$/); if (!m) continue;
    const [body] = m[2].split(/\s*\*rule:\*/);
    const [meaning, not] = body.split(/\s*\*not:\*\s*/);
    out.push({ word: plain(m[1]), meaning: plain(meaning), ...(not ? { not: plain(not) } : {}) });
  }
  return out;
}

// "Ask Ultron about this": the subject is a glossary word or a tutorial page.
export type Subject = { kind: "term"; id: string } | { kind: "page"; id: string };

export function helpLine(what: { kind: "term" | "page"; name: string; text: string }): string {
  const label = what.kind === "term" ? "the word" : "the tutorial page";
  return `[HELP] The user pressed "Ask about this" in Agentic Pockets Help, on ${label} "${what.name}": ${what.text} Explain it to them in plain words, in your own way, and answer what they ask.`;
}


export async function askHelp(root: string, subject: Subject, deps: DiscussDeps): Promise<Asked> {
  const found = subject.kind === "term"
    ? readGlossary(root).filter((t) => t.word === subject.id).map((t) => ({ name: t.word, text: t.meaning, noun: "word" }))[0]
    : readTutorial(root).items.filter((i) => i.id === subject.id).map((i) => ({ name: i.title, text: i.body, noun: "page" }))[0];
  if (!found) return { ok: false, message: subject.kind === "term" ? `"${subject.id}" is not in this house's glossary.` : `"${subject.id}" is not on this house's tutorial checklist.` };
  const lead = leadOf(root);
  if (!lead) return { ok: false, message: "This house has no citizen to talk to yet. Finish setup first." };
  const r = await reach(root, lead, helpLine({ kind: subject.kind, name: found.name, text: found.text }), deps);
  if ("error" in r) return { ok: false, message: r.error };
  return { ok: true, agentId: r.agentId, citizen: lead, message: `${lead} has the ${found.noun} "${found.name}".` };
}

// The three-courts loop for Help's Tickets tab (job 2026-11-27-three-courts-explainer): its path is written from a
// citizen's pocket, two folders below the house root, so the root plus that path less "../../" finds it.
export function readLoop(root: string, rel: string): string | null {
  const kind = rel.slice(rel.lastIndexOf(".") + 1).toLowerCase();
  const mime = kind === "webp" ? "image/webp" : kind === "png" ? "image/png" : kind === "gif" ? "image/gif" : null;
  if (!mime) return null;
  try { return `data:${mime};base64,${fs.readFileSync(path.join(root, rel.replace(/^(\.\.\/)+/, ""))).toString("base64")}`; } catch { return null; }
}

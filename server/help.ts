// Agentic Pockets Help (ticket 009 Q1c, the owner 2026-10-12 14:44 CDT: after 100 % the setup plugin is "Agentic Pockets
// Help", with the tutorial pages to re-read, the glossary, a /wait-what reminder, and "Ask Ultron about this").
// The glossary is the house's own Commons/reference/glossary.md, read when the view opens, so it is always that house's words.
import fs from "node:fs";
import path from "node:path";
import { deskOf, type DeskRow, type DiscussDeps } from "./discuss.ts";
import { leadOf, readTutorial } from "./tutorial.ts";

export interface Asked { ok: boolean; agentId?: string; citizen?: string; message: string }
export interface Term { word: string; meaning: string; not?: string }

// Markdown marks off, for a screen that shows plain text: **bold**, *italic*, `code`.
const plain = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\s+/g, " ").trim();

// One line per word: `- **word** — meaning. *not:* … *rule:* …`. The rule names a file for citizens, so the user does not see it.
export function readGlossary(root: string): Term[] {
  let text = ""; try { text = fs.readFileSync(path.join(root, "Commons", "reference", "glossary.md"), "utf8"); } catch { return []; }
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

// The line goes to the lead citizen (Ultron when he is in the house): its live desk, found as "Discuss this page" finds it;
// no desk, one is opened with the line first, from the citizen's row in house.json, as "Discuss this page" opens it.
export async function reach(root: string, citizen: string, line: string, deps: DiscussDeps): Promise<{ agentId: string } | { error: string }> {
  const desk = deskOf(root, citizen, deps.records());
  if (desk) { await deps.send(desk, line); return { agentId: desk }; }
  let row: DeskRow | undefined; try { row = JSON.parse(fs.readFileSync(path.join(root, "house.json"), "utf8")).desks?.[citizen]; } catch { /* no record */ }
  if (!row?.workspaceId) return { error: `${citizen} has no desk row in the house record, so no desk can be opened.` };
  return { agentId: await deps.open(row, citizen, line) };
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

// "What to ask": which citizens the house has, each with its example questions, and which offered citizens it can add.
// A citizen is in the house when Pockets/<Name>/AGENTS.md exists, and can be added when the release holds it,
// .upstream/Pockets/<Name>/AGENTS.md (the house plugin's roster reads the same two places). Faces: face.png in either.
import fs from "node:fs";
import path from "node:path";
import { ASKS, JOIN_ON_THEIR_OWN, type AskCitizen, type WhatToAsk } from "../shared/what-to-ask.ts";
import { deskOf, reach, type DiscussDeps } from "./discuss.ts";
import { nameOf } from "../shared/desk-welcome.ts";

const dirsIn = (d: string) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_")).map((e) => e.name); } catch { return []; } };
const face = (dir: string): string | null => { try { return `data:image/png;base64,${fs.readFileSync(path.join(dir, "face.png")).toString("base64")}`; } catch { return null; } };

export function whatToAsk(root: string): WhatToAsk {
  const pockets = path.join(root, "Pockets"), up = path.join(root, ".upstream", "Pockets");
  const isIn = (n: string) => fs.existsSync(path.join(pockets, n, "AGENTS.md"));
  const known = new Set(ASKS.map((a) => a.pocket));
  const inHouse: AskCitizen[] = [
    ...ASKS.filter((a) => isIn(a.pocket)).map((a) => ({ ...a, asks: [...a.asks], face: face(path.join(pockets, a.pocket)) })),
    ...dirsIn(pockets).filter((n) => !known.has(n) && isIn(n)).sort().map((n) => ({ pocket: n, name: n, title: "", asks: [], face: face(path.join(pockets, n)) })),
  ];
  const canAdd = ASKS.filter((a) => !isIn(a.pocket) && !JOIN_ON_THEIR_OWN.has(a.pocket) && fs.existsSync(path.join(up, a.pocket, "AGENTS.md")))
    .map((a) => ({ ...a, asks: [...a.asks], face: face(path.join(up, a.pocket)) }));
  return { inHouse, canAdd };
}

// "Try it": the chat the question goes into. The client fills that chat's message box and sends nothing; the server
// only finds the desk, or opens one with the house's clock-in line, the line every desk the house opens starts with
// (the house plugin's CLOCK_IN, server/citizens.ts).
export const CLOCK_IN = "[JANITOR] Clock in. Read your boot per your contract.";

export async function tryIt(root: string, pocket: string, deps: DiscussDeps): Promise<{ ok: true; agentId: string } | { ok: false; message: string }> {
  if (!fs.existsSync(path.join(root, "Pockets", pocket, "AGENTS.md"))) { const n = nameOf(pocket); return { ok: false, message: `${n} is not in this house yet. Add ${n} first, in the Citizens view.` }; }
  const desk = deskOf(root, pocket, deps.records());
  if (desk) return { ok: true, agentId: desk };
  const r = await reach(root, pocket, CLOCK_IN, deps);
  return "error" in r ? { ok: false, message: r.error } : { ok: true, agentId: r.agentId };
}

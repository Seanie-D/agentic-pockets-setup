// How the first desk's first turn went, from Paseo's own record of that desk (Sean, re-walk 3, 2026-10-14 09:14 CDT: the
// good-to-go page said the citizen had said hello when its first turn had failed). Only what the record shows is said.
export interface DeskRecord { lastStatus?: string | null; attentionReason?: string | null; lastError?: unknown; lastUserMessageAt?: string | null; lastActivityAt?: string | null }
export type FirstTurn = { state: "starting" | "done" } | { state: "failed"; message: string };

const words = (e: unknown): string => {
  if (typeof e !== "string") return e && typeof e === "object" ? words(JSON.stringify(e)) : "";
  try { const j = JSON.parse(e); return String(j?.data?.message ?? j?.message ?? e); } catch { return e; }
};

export function firstTurn(r: DeskRecord | undefined): FirstTurn {
  if (!r) return { state: "starting" };
  const said = words(r.lastError).trim();
  if (said) return { state: "failed", message: said.slice(0, 300) };
  if (r.lastStatus === "error") return { state: "failed", message: "The first message did not run." };
  // A new desk is idle before its first turn runs, so idle alone is not done: a turn Paseo marks finished is, and so is
  // an idle desk with activity after the first message (Paseo clears attentionReason once the user opens the desk).
  if (r.attentionReason === "finished") return { state: "done" };
  const after = r.lastUserMessageAt && r.lastActivityAt && Date.parse(r.lastActivityAt) > Date.parse(r.lastUserMessageAt);
  if ((r.lastStatus === "idle" || r.lastStatus === "closed") && after) return { state: "done" };
  return { state: "starting" };
}

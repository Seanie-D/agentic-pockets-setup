// "Who would you like to start with?" (ticket 004 Q5, Q16). Four packs are offered; Ultron, the orchestrator, ticks
// himself and is greyed out when two or more are picked, and is unticked and free again when it goes back to one.
export const PACKS = ["Verro", "MissMinutes", "Vision", "Friday"] as const;
export const ORCHESTRATOR = "Ultron";

export interface Pick { packs: readonly string[]; ultronByHand: boolean }
export const emptyPick = (): Pick => ({ packs: [], ultronByHand: false });

export function toggle(s: Pick, name: string): Pick {
  if (name === ORCHESTRATOR) {
    if (s.packs.length >= 2) return s;   // locked on
    return { ...s, ultronByHand: !s.ultronByHand };
  }
  if (!(PACKS as readonly string[]).includes(name)) return s;
  const packs = s.packs.includes(name) ? s.packs.filter((p) => p !== name) : [...s.packs, name];
  // Leaving the two-or-more state unticks Ultron, whatever was set by hand before.
  const ultronByHand = s.packs.length >= 2 && packs.length < 2 ? false : s.ultronByHand;
  return { packs, ultronByHand };
}

export type UltronState = "locked-on" | "free-on" | "free-off";
export function view(s: Pick): { citizens: string[]; ultron: UltronState } {
  const ultron: UltronState = s.packs.length >= 2 ? "locked-on" : s.ultronByHand ? "free-on" : "free-off";
  const order = (PACKS as readonly string[]).filter((p) => s.packs.includes(p));
  return { citizens: [...(ultron === "free-off" ? [] : [ORCHESTRATOR]), ...order.sort((a, b) => a.localeCompare(b))], ultron };
}

// The picker as a Start left it, from the citizens it sent (Sean, re-walk 3, 2026-10-14: keep the picks after a failed
// start). Ultron counts as ticked by hand only when fewer than two packs were picked; with two or more he is locked on.
export function pickFrom(citizens: readonly string[]): Pick {
  const packs = (PACKS as readonly string[]).filter((p) => citizens.includes(p));
  return { packs, ultronByHand: packs.length < 2 && citizens.includes(ORCHESTRATOR) };
}

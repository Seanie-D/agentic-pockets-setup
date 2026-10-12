// The welcome take-over (Sean, 2026-10-12 14:23 CDT; ticket 009). No install hook opens a screen, so the setup plugin's
// sidebar item opens the welcome when it first renders: once, while unseen, and once per app session.

export const WELCOME_LINE = "Welcome to Sean's Agentic Pockets! Let's walk through setting up your agents.";
export const LEAVE_ME_ALONE = "set up later, leave my Paseo alone!";

export function takeOver(s: { seen: boolean | undefined; openedThisSession: boolean }): boolean {
  return s.seen === false && !s.openedThisSession;
}

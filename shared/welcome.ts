// The welcome take-over (ticket 009, asked 2026-10-12). No install hook opens a screen, so the setup plugin's
// sidebar item opens the welcome when it first renders: once, while unseen, and once per app session.

export const WELCOME_LINE = "Welcome to Sean's Agentic Pockets! Let's walk through setting up your agents.";
export const LEAVE_ME_ALONE = "set up later, leave my Paseo alone!";
// What "set up later" shows (ticket 18, the owner's words 2026-10-13); the sidebar row then points at itself.
export const LEFT_ALONE_LINE = "Got it! You can start setup again any time you want by clicking the plugin over here.";

export function takeOver(s: { seen: boolean | undefined; openedThisSession: boolean }): boolean {
  return s.seen === false && !s.openedThisSession;
}

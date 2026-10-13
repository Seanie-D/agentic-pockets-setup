// The clean profile (ticket 004; the owner, 2026-10-12): when the user has Claude hooks of their own, which reach every
// project and cannot be switched off for one, the house can run Claude from its own folder. A new folder is signed out,
// so the user signs in once, in their browser, before the house is placed.
import path from "node:path";
import type { Exec } from "./setup.ts";   // a type only, so no import cycle at run time

export const PROFILE_PROVIDER = "claude-house";
export const profileDir = (home: string) => path.join(home, ".agentic-pockets", "claude");

// Signed in to Claude in a folder, or, with null, in the user's own (~/.claude): every user signs in to their own Claude
// right after the tools (Sean, from Friday's Mac walk, 2026-10-13: setup installed Claude and never offered it).
export function signedInTo(exec: Exec, configDir: string | null): boolean {
  const r = exec("claude", ["auth", "status", "--json"], configDir ? { env: { CLAUDE_CONFIG_DIR: configDir } } : undefined);
  if (r.status !== 0) return false;
  try { return JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).loggedIn === true; } catch { return false; }
}
export const signedIn = (exec: Exec, home: string) => signedInTo(exec, profileDir(home));

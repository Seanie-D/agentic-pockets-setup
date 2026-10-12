// The clean profile (ticket 004; the owner, 2026-10-12): when the user has Claude hooks of their own, which reach every
// project and cannot be switched off for one, the house can run Claude from its own folder. A new folder is signed out,
// so the user signs in once, in their browser, before the house is placed.
import path from "node:path";
import type { Exec } from "./setup.ts";   // a type only, so no import cycle at run time

export const PROFILE_PROVIDER = "claude-house";
export const profileDir = (home: string) => path.join(home, ".agentic-pockets", "claude");

export function signedIn(exec: Exec, home: string): boolean {
  const r = exec("claude", ["auth", "status", "--json"], { env: { CLAUDE_CONFIG_DIR: profileDir(home) } });
  if (r.status !== 0) return false;
  try { return JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).loggedIn === true; } catch { return false; }
}

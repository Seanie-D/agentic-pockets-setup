// The clean profile (ticket 004; the owner, 2026-10-12): when the user has Claude hooks of their own, which reach every
// project and cannot be switched off for one, the house can run Claude from its own folder. A new folder is signed out,
// so the user signs in once, in their browser, before the house is placed.
import path from "node:path";
import type { Exec } from "./setup.ts";   // a type only, so no import cycle at run time

export const PROFILE_PROVIDER = "claude-house";
export const profileDir = (home: string) => path.join(home, ".agentic-pockets", "claude");

// Signed in to Claude in a folder, or, with null, in the user's own (~/.claude): every user signs in to their own Claude
// right after the tools (Sean, from Friday's Mac walk, 2026-10-13: setup installed Claude and never offered it).
// auth status reads that credentials exist, not that they work (Friday's re-walk 3, 2026-10-14: an expired login read
// loggedIn and the first desk failed), so a signed-in reading is proved by one small call to Claude. No --bare: it skips
// the keychain, where a Mac keeps the login; the user's settings stay, since a login may come from them. Only an auth
// answer means signed out, read from the answer's own text: a busy Claude, a usage limit, no network or a timeout says
// nothing about the login, so it reads signed in, as auth status did. The screen asks every 3 s, so each answer is kept.
const PROBE = ["-p", "Reply with the one word: ok", "--model", "haiku", "--tools", "", "--strict-mcp-config",
  "--no-session-persistence", "--output-format", "json"];
const AUTH_REFUSED = /not logged in|failed to authenticate|oauth|invalid api key|please run \/login|\b401\b/i;
const KEEP_MS = { pass: 600_000, refused: 10_000, unknown: 30_000 };
const probes = new Map<string, { kind: keyof typeof KEEP_MS; at: number }>();
const answer = (stdout: string, stderr: string) => {
  try { return String(JSON.parse(stdout.slice(stdout.indexOf("{"))).result ?? "") + "\n" + stderr; } catch { return stdout + "\n" + stderr; }
};

export function signedInTo(exec: Exec, configDir: string | null, now = Date.now()): boolean {
  const o = configDir ? { env: { CLAUDE_CONFIG_DIR: configDir } } : undefined;
  const r = exec("claude", ["auth", "status", "--json"], o);
  if (r.status !== 0) return false;
  try { if (JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).loggedIn !== true) return false; } catch { return false; }
  const key = configDir ?? "", last = probes.get(key);
  if (last && now - last.at <= KEEP_MS[last.kind]) return last.kind !== "refused";
  const p = exec("claude", PROBE, { ...o, timeout: 25_000 });
  const kind = p.status === 0 ? "pass" : AUTH_REFUSED.test(answer(p.stdout, p.stderr)) ? "refused" : "unknown";
  probes.set(key, { kind, at: now });
  return kind !== "refused";
}
export const signedIn = (exec: Exec, home: string) => signedInTo(exec, profileDir(home));

// The owner's own TypeSafe key for Jev, taken at setup's step 2 (the Jev switch, ticket 03). One yes/no call tests it;
// a key that passes is saved on this computer only, in the file and form the house's secret-intake tool writes and every
// Jev script reads. The key is never put in a message, a step, a log or the house record.
import fs from "node:fs";
import path from "node:path";

// Jev's address and question shape, as Commons/skills/thinking/jev/jev.mjs sends them.
export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
// Jev answers in about 0.2 s; a call this slow is no answer.
export const JEV_TEST_MS = 10_000;
export type KeyTest = "pass" | "bad" | "no-credits" | "no-answer";

export const JEV_SAYS: Record<Exclude<KeyTest, "pass">, string> = {
  bad: "Jev did not accept that key. Check it and paste it again, or empty the field to go on without Jev.",
  "no-credits": "That key is right, but its TypeSafe account has no credits left. Top it up and try again, or empty the field to go on without Jev.",
  "no-answer": "Jev did not answer, so setup could not test your key. Try again, or empty the field to go on without Jev.",
};

// The Jev scripts read the key as one word (jev.mjs), so a key with a space or a quote in it is refused with no call.
export async function testJevKey(key: string, fetch: typeof globalThis.fetch, ms = JEV_TEST_MS): Promise<KeyTest> {
  if (!/^[^\s'"]+$/.test(key)) return "bad";
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), ms);
  try {
    const res = await fetch(JEV_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "jev-latest", state: "Agentic Pockets setup is testing this key.", questions: { q: { type: "noul", instructions: "Is this a test?" } } }),
      signal: stop.signal,
    });
    if (res.ok) return "pass";
    if (res.status === 402) return "no-credits";   // the TypeSafe account's credits ran out (seen 2026-10)
    return res.status === 401 || res.status === 403 ? "bad" : "no-answer";
  } catch { return "no-answer"; }
  finally { clearTimeout(timer); }
}

// <home>/.config/pockets/jev.env: folder 700, file 600, a comment line, then JEV_API_KEY='<key>' (secret-intake's form).
export function saveJevKey(home: string, key: string, now: string): string {
  const dir = path.join(home, ".config", "pockets");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700);
  const file = path.join(dir, "jev.env");
  const quoted = key.replace(/'/g, "'\\''");
  fs.rmSync(file, { force: true });   // a file already here may be readable by others; the new one is made 600
  fs.writeFileSync(file, `# jev — the owner's TypeSafe key. Placed ${now} by Agentic Pockets setup. Load per run; never print.\nJEV_API_KEY='${quoted}'\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

// The version a clone holds: `jev` when git checked out the release's jev branch, else null (the version without Jev).
export function clonedBuild(upstream: string): "jev" | null {
  try { return fs.readFileSync(path.join(upstream, ".git", "HEAD"), "utf8").trim() === "ref: refs/heads/jev" ? "jev" : null; }
  catch { return null; }
}

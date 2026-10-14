// What a Start sent and what it made, kept by the server until Finish setup (Sean, re-walk 3, 2026-10-14 09:14 CDT: after
// a failed start the picks were gone). The screen can be rebuilt while the first desk opens beside it, and a rebuilt
// screen starts empty, so it reads these back: the same picks, and "You're good to go!" when the house was made.
import fs from "node:fs";
import path from "node:path";
import type { SetupResult } from "./setup.ts";   // a type only, so no import cycle at run time

export interface StartForm { userName: string; citizens: string[]; accounts: Record<string, string>; extrasOff: string[]; cleanProfile: boolean; mode: "on-demand" | "always-on"; cafe: boolean }
const file = (home: string) => path.join(home, ".agentic-pockets", "setup-form.json");

export function readForm(home: string): { form: StartForm; result: SetupResult | null } | null {
  try { const j = JSON.parse(fs.readFileSync(file(home), "utf8")); return j?.form ? { form: j.form, result: j.result ?? null } : null; } catch { return null; }
}
// The screen asks one press again until it is done (shared/job.ts), so the same form keeps the result it has.
export function saveForm(home: string, form: StartForm): void {
  if (JSON.stringify(readForm(home)?.form) === JSON.stringify(form)) return;
  fs.mkdirSync(path.dirname(file(home)), { recursive: true });
  fs.writeFileSync(file(home), JSON.stringify({ form, result: null }, null, 2) + "\n");
}
export function saveResult(home: string, result: SetupResult): void {
  const was = readForm(home); if (!was) return;
  fs.writeFileSync(file(home), JSON.stringify({ form: was.form, result }, null, 2) + "\n");
}
export function clearForm(home: string): void { fs.rmSync(file(home), { force: true }); }

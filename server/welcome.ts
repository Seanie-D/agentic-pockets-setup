// Whether this computer has seen the welcome (ticket 009): a flag beside the house key in ~/.agentic-pockets/, outside
// any house, so it holds before a house exists. Set when the user leaves Paseo alone or starts setup.
import fs from "node:fs";
import path from "node:path";

const file = (home: string) => path.join(home, ".agentic-pockets", "welcome.json");

export function welcomeSeen(home: string): boolean { return fs.existsSync(file(home)); }

export function markWelcomeSeen(home: string, now: string) {
  fs.mkdirSync(path.dirname(file(home)), { recursive: true });
  if (!welcomeSeen(home)) fs.writeFileSync(file(home), JSON.stringify({ seenAt: now }) + "\n");
}

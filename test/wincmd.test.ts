// Friday's Windows walk, 2026-10-13: "Connect my house" failed with ssh-keygen "Too many arguments". On Windows setup
// runs each command through cmd, and Node joined the arguments without quotes: `-N ""` lost its empty password and the
// comment "agentic-pockets <host>" split at the space. Setup now quotes each argument itself.
//   node --test test/wincmd.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { cmdLine } from "../shared/winpath.ts";
import { sshCommand } from "../server/setup.ts";

test("the house key's command keeps its empty password and its spaced comment and path, each one argument", () => {
  assert.equal(
    cmdLine("ssh-keygen", ["-t", "ed25519", "-N", "", "-C", "agentic-pockets FLUMPH PC", "-f", "C:\\Users\\Ada Lovelace\\.ssh\\pockets"]),
    `ssh-keygen -t ed25519 -N "" -C "agentic-pockets FLUMPH PC" -f "C:\\Users\\Ada Lovelace\\.ssh\\pockets"`,
  );
});

test("a quote inside an argument, and a backslash before the closing quote, survive", () => {
  assert.equal(cmdLine("git", ['say "hi"', "C:\\Program Files\\x\\"]), `git "say \\"hi\\"" "C:\\Program Files\\x\\\\"`);
});

test("plain arguments pass unquoted, so a short command reads as typed", () => {
  assert.equal(cmdLine("paseo", ["plugin", "reload", "agentic-pockets"]), "paseo plugin reload agentic-pockets");
});

// Git runs its ssh line through sh, so an unquoted Windows key path lost its backslashes and split at a space; the
// download would have failed right after the key was made (review of the fix above).
test("git's ssh line names the house key as one word sh keeps, with forward slashes", () => {
  assert.equal(sshCommand("C:\\Users\\Ada Lovelace\\.agentic-pockets\\keys\\house_ed25519"),
    "ssh -i 'C:/Users/Ada Lovelace/.agentic-pockets/keys/house_ed25519' -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new");
  assert.equal(sshCommand("/Users/o'neil/.agentic-pockets/keys/house_ed25519"),
    "ssh -i '/Users/o'\\''neil/.agentic-pockets/keys/house_ed25519' -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new");
});

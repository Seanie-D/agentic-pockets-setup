// Sean, re-walk 3, 2026-10-14 09:14 CDT: after a failed start the picks were gone, and the screen went back to the steps
// page though the house was made. The screen can be rebuilt (a desk opens beside it), so the server keeps what a Start
// sent and what it made, until Finish setup.
//   node --test test/form.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { clearForm, readForm, saveForm, saveResult } from "../server/form.ts";

const form = { userName: "Nick", citizens: ["Ultron", "Verro", "Vision"], accounts: { Ultron: "claude" }, extrasOff: ["hook:x"], cleanProfile: false, mode: "on-demand" as const, cafe: false };

test("a Start's form is kept in the user's own .agentic-pockets folder, with what it made, until Finish clears it", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "form-"));
  try {
    assert.equal(readForm(home), null, "nothing yet");
    saveForm(home, form);
    assert.ok(fs.existsSync(path.join(home, ".agentic-pockets", "setup-form.json")));
    assert.deepEqual(readForm(home), { form, result: null });
    const result = { ok: true, message: "Ultron is ready.", steps: ["Opened Ultron's desk."], firstDesk: { citizen: "Ultron", agentId: "a1" } };
    saveResult(home, result);
    assert.deepEqual(readForm(home), { form, result });
    saveForm(home, { ...form });
    assert.deepEqual(readForm(home)!.result, result, "the screen asks a press again while it runs: the same form keeps its result");
    saveForm(home, { ...form, userName: "Nik" });
    assert.equal(readForm(home)!.result, null, "a new Start forgets the last one's result");
    clearForm(home);
    assert.equal(readForm(home), null);
    fs.writeFileSync(path.join(home, ".agentic-pockets", "setup-form.json"), "{ not json");
    assert.equal(readForm(home), null, "a broken file is no form");
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

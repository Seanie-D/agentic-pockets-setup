// Every test file here imports this first: its temp folders go under one folder of its own, removed when the
// process ends, so a run leaves nothing in /tmp. Child processes a test starts inherit it through TMPDIR.
// The house's rule: memory/workflows/house-tests-must-remove-their-tmp-folders.md (Jarvis, 2026-11-25).
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const scratch = mkdtempSync(path.join(os.tmpdir(), "test-scratch-"));
process.env.TMPDIR = process.env.TMP = process.env.TEMP = scratch;
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

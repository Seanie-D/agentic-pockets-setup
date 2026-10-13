// Friday's read of the Windows seat, 2026-10-13 16:25 CDT: Paseo makes a second workspace for a folder that already has
// one, so two install runs left two workspaces per citizen. Setup now uses the folder's own workspace when it has one.
//   node --test test/workspace.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceFor } from "../shared/workspace.ts";

const ws = (id: string, dir: string, extra: Record<string, unknown> = {}) => ({ id, projectId: `prj_${id}`, projectRootPath: dir, workspaceDirectory: dir, ...extra });

test("a folder's own workspace is found, so none is made beside it", () => {
  assert.deepEqual(workspaceFor([ws("a", "/h/Pockets/Verro"), ws("b", "/h/Pockets/Ultron")], "/h/Pockets/Ultron", false), { workspaceId: "b", projectId: "prj_b" });
  assert.equal(workspaceFor([ws("a", "/h/Pockets/Verro")], "/h/Pockets/Ultron", false), null);
});

test("an archived workspace is not used; on Windows the folder matches in any case", () => {
  assert.equal(workspaceFor([ws("a", "/h/Pockets/Ultron", { archivingAt: "2026-10-13T20:00:00Z" })], "/h/Pockets/Ultron", false), null);
  assert.deepEqual(workspaceFor([ws("w", "C:\\Users\\Ada\\agentic-pockets\\Pockets\\Ultron")], "c:\\users\\ada\\agentic-pockets\\pockets\\ultron", true), { workspaceId: "w", projectId: "prj_w" });
  assert.equal(workspaceFor([ws("w", "/h/Pockets/ultron")], "/h/Pockets/Ultron", false), null);
});

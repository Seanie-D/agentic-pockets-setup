// Sean's 15:51 walk, 2026-10-13 (Friday's read of the Windows seat): install outlived Paseo's 30-second plugin call,
// the screen said "handler_error" while the server kept working, and a second press started a second install: two
// Ultron desks. A long step now runs as one job: a call waits a while, then answers "still working"; a call while it
// runs joins it; the call after it ends gets its result.
//   node --test test/job.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { joinable, untilDone } from "../shared/job.ts";

const later = <T>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));

test("a quick job answers at once with its result", async () => {
  const job = joinable<string>(200);
  assert.equal(await job(() => later(10, "done"), "busy"), "done");
});

test("a slow job answers busy, a second call joins it, and the call after it ends gets its result", async () => {
  const job = joinable<string>(30);
  let starts = 0;
  const run = () => { starts++; return later(120, `run ${starts}`); };
  assert.equal(await job(run, "busy"), "busy");
  assert.equal(await job(run, "busy"), "busy");
  await later(150, null);
  assert.equal(await job(run, "busy"), "run 1");
  assert.equal(starts, 1, "the second press joined; it started nothing");
  assert.equal(await job(run, "busy"), "busy", "after a result is handed over, the next call starts a new job");
  assert.equal(starts, 2);
});

test("a job that fails hands its error to the call that collects it, once", async () => {
  const job = joinable<string>(30);
  assert.equal(await job(() => later(60, null).then(() => { throw new Error("winget refused"); }), "busy"), "busy");
  await later(90, null);
  await assert.rejects(job(() => later(1, "fresh"), "busy"), /winget refused/);
  assert.equal(await job(() => later(1, "fresh"), "busy"), "fresh");
});

test("the screen calls again while the job is still running, and returns the first answer that is not", async () => {
  const answers = [{ running: true, n: 1 }, { running: true, n: 2 }, { running: false, n: 3 }];
  let calls = 0;
  const r = await untilDone(async () => answers[calls++], 1)({});
  assert.equal(r.n, 3);
  assert.equal(calls, 3);
});

test("a call that times out is asked again (the job goes on in the server), up to a limit", async () => {
  let calls = 0;
  const flaky = async () => { calls++; if (calls < 3) throw new Error("Plugin RPC timed out: agentic-pockets-setup.invoke"); return { running: false, n: calls }; };
  assert.equal((await untilDone(flaky, 1)({})).n, 3);
  let n = 0;
  await assert.rejects(untilDone(async () => { n++; throw new Error("handler_error"); }, 1, 20)({}), /handler_error/);
  assert.ok(n >= 2, "it kept asking until the limit");
});

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
  assert.equal(await job("p", () => later(10, "done"), "busy"), "done");
});

test("a slow job answers busy, a second press joins it, and the call after it ends gets its result", async () => {
  const job = joinable<string>(30);
  let starts = 0;
  const run = () => { starts++; return later(120, `run ${starts}`); };
  assert.equal(await job("p1", run, "busy"), "busy");
  assert.equal(await job("p2", run, "busy"), "busy");
  await later(150, null);
  assert.equal(await job("p1", run, "busy"), "run 1");
  assert.equal(starts, 1, "the second press joined; it started nothing");
});

test("a job that fails hands its error to its own press; a new press runs fresh", async () => {
  const job = joinable<string>(30);
  assert.equal(await job("p1", () => later(60, null).then(() => { throw new Error("winget refused"); }), "busy"), "busy");
  await later(90, null);
  await assert.rejects(job("p1", () => later(1, "fresh"), "busy"), /winget refused/);
  assert.equal(await job("p2", () => later(1, "fresh"), "busy"), "fresh");
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

test("the result is kept for its own press: a call that timed out loses nothing, and a new press starts a new run", async () => {
  const job = joinable<string>(20);
  let starts = 0;
  const run = () => { starts++; return later(100, `run ${starts}`); };
  assert.equal(await job("press-1", run, "busy"), "busy");
  await later(130, null);
  assert.equal(await job("press-1", run, "busy"), "run 1", "the call that timed out never received it; the next call of the same press does");
  assert.equal(await job("press-1", run, "busy"), "run 1", "asked again, the same press still gets its result");
  assert.equal(starts, 1);
  assert.equal(await job("press-2", run, "busy"), "busy", "a new press starts a new run");
  assert.equal(starts, 2);
  assert.equal(await job("press-3", run, "busy"), "busy", "a press while one runs joins it");
  assert.equal(starts, 2);
});

test("only a call that timed out is asked again; any other error is shown at once", async () => {
  let n = 0;
  await assert.rejects(untilDone(async () => { n++; throw new Error("Invalid input: userName"); }, 1, 1000)({}), /Invalid input/);
  assert.equal(n, 1);
});

test("a press that joined a running job gets that job's result when it ends; it never starts a second run", async () => {
  const job = joinable<string>(10);
  let starts = 0;
  const run = () => { starts++; return later(40, `run ${starts}`); };
  assert.equal(await job("first", run, "busy"), "busy");
  assert.equal(await job("second", run, "busy"), "busy");
  await later(60, null);
  assert.equal(await job("second", run, "busy"), "run 1");
  assert.equal(await job("first", run, "busy"), "run 1");
  assert.equal(starts, 1);
});

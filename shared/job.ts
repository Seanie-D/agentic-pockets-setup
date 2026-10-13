// One long setup step as a joinable job (the owner's 15:51 walk, 2026-10-13: install outlived Paseo's 30-second plugin
// call, the screen showed an error while the server kept working, and a second press made a second install). Each press
// on the screen carries its own run id. A call starts the job when none runs, else joins the running one; it waits up
// to waitMs, then answers `busy`. The ended job's result (or error) stays with every press that started or joined it,
// so a call that Paseo timed out loses nothing: the next call of that press gets it. A new press, with nothing
// running, starts a new job. No imports.
export function joinable<R>(waitMs: number) {
  // runs: every press that started or joined this job; the result belongs to each of them.
  let running: { runs: Set<string>; done: Promise<void> } | null = null;
  let ended: { runs: Set<string>; ok: true; value: R } | { runs: Set<string>; ok: false; error: unknown } | null = null;
  const give = (): R => { const e = ended!; if (!e.ok) throw e.error; return e.value; };
  return async (run: string, start: () => Promise<R>, busy: R): Promise<R> => {
    if (!running && ended?.runs.has(run)) return give();
    if (running) running.runs.add(run);
    else {
      const r = { runs: new Set([run]), done: Promise.resolve() };
      r.done = start().then((value) => { ended = { runs: r.runs, ok: true, value }; }, (error) => { ended = { runs: r.runs, ok: false, error }; })
        .finally(() => { if (running === r) running = null; });
      running = r;
    }
    const mine = running;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([mine.done, new Promise<void>((r) => { timer = setTimeout(r, waitMs); })]);
    clearTimeout(timer);
    return running !== mine && ended?.runs === mine.runs ? give() : busy;
  };
}

// Paseo's own words when a plugin call outlives its 30 seconds: on the daemon "Plugin RPC timed out", on the screen
// "handler_error" (Friday's read of the Windows seat, 2026-10-13). Only these are asked again.
const TIMED_OUT = /timed out|handler_error/i;

// The screen's half: one press, one run id; call again while the answer says the job is still running, and when Paseo
// timed the call out (the job goes on in the server), until limitMs. Any other error is shown at once. The server hands
// a job's own failure back as an answer, never as an error.
export function untilDone<I extends object, R extends { running?: boolean }>(call: (input: I & { run: string }) => Promise<R>, pauseMs = 1500, limitMs = 15 * 60_000) {
  return async (input: I): Promise<R> => {
    const run = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const until = Date.now() + limitMs;
    for (;;) {
      try { const r = await call({ ...input, run }); if (!r.running) return r; }
      catch (e) { if (!TIMED_OUT.test(String((e as Error)?.message ?? e)) || Date.now() >= until) throw e; }
      if (Date.now() >= until) throw new Error("setup is still working after 15 minutes; quit and reopen Paseo, then press the button again");
      await new Promise((ok) => setTimeout(ok, pauseMs));
    }
  };
}

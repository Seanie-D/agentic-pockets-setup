// One long setup step as a joinable job (the owner's 15:51 walk, 2026-10-13: install outlived Paseo's 30-second plugin
// call, the screen showed an error while the server kept working, and a second press made a second install). A call
// starts the job when none runs, else joins the running one; it waits up to waitMs, then answers `busy`. The call
// after the job ends gets its result (or its error), once; the call after that starts a new job. No imports.
export function joinable<R>(waitMs: number) {
  let running: Promise<void> | null = null;
  let ended: { ok: true; value: R } | { ok: false; error: unknown } | null = null;
  const collect = (): R => {
    const e = ended!; ended = null; running = null;
    if (!e.ok) throw e.error;
    return e.value;
  };
  return async (start: () => Promise<R>, busy: R): Promise<R> => {
    if (ended) return collect();
    if (!running) running = start().then((value) => { ended = { ok: true, value }; }, (error) => { ended = { ok: false, error }; });
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([running, new Promise<void>((r) => { timer = setTimeout(r, waitMs); })]);
    clearTimeout(timer);
    return ended ? collect() : busy;
  };
}

// The screen's half: call again while the answer says the job is still running, so a long step reads as one press. A
// call that fails (Paseo's 30-second timeout while one step blocks the server) is asked again too, until limitMs: the
// job goes on in the server, and the server hands a job's own failure back as an answer, never as an error.
export function untilDone<I, R extends { running?: boolean }>(call: (input: I) => Promise<R>, pauseMs = 1500, limitMs = 15 * 60_000) {
  return async (input: I): Promise<R> => {
    const until = Date.now() + limitMs;
    for (;;) {
      try { const r = await call(input); if (!r.running) return r; }
      catch (e) { if (Date.now() >= until) throw e; }
      if (Date.now() >= until) throw new Error("setup is still working after 15 minutes; quit and reopen Paseo, then press the button again");
      await new Promise((ok) => setTimeout(ok, pauseMs));
    }
  };
}

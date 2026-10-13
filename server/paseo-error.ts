// Why a Paseo command failed, for the step the user sees and for the log. With --json, Paseo prints a multi-line JSON
// object, so its last line is a lone "}": take the error's message, or else the whole output, trimmed and capped.
export function paseoError(r: { stdout: string; stderr: string }): string {
  for (const s of [r.stdout, r.stderr]) {
    const i = s.indexOf("{");
    if (i < 0) continue;
    let m: unknown;
    try { m = JSON.parse(s.slice(i))?.error?.message; } catch { /* not JSON */ }
    if (typeof m !== "string" || !m.trim()) continue;
    // A command Paseo's service could not start: on the Mac, Paseo opened from the Dock lacks Homebrew's folder.
    const missing = m.match(/spawn (\S+) ENOENT/);
    if (missing) return `Paseo could not find the ${missing[1]} command: it is not in the folders Paseo looks in (${missing[0]})`;
    return m.replace(/\s+/g, " ").trim().slice(0, 400);
  }
  return `${r.stderr}\n${r.stdout}`.replace(/\s+/g, " ").trim().slice(0, 400) || "the Paseo command was not found";
}

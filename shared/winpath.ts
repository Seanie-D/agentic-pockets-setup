// Windows only. winget writes a new tool's folder into PATH in the registry, and a process already running (Paseo, this
// plugin) keeps the PATH it started with, so a tool installed a moment ago is not found (Friday's Windows walk,
// 2026-10-13). So the PATH for every check and command is rebuilt from the registry: the machine's, then the user's.
// No imports, so the tests run in plain Node.

// The `Path` value out of `reg query <key> /v Path`, split, with %VARS% expanded from the environment.
function values(out: string, env: Record<string, string | undefined>): string[] {
  const m = /^\s*Path\s+REG_(?:EXPAND_)?SZ\s+(.*)$/im.exec(out);
  if (!m) return [];
  const expand = (p: string) => p.replace(/%([^%]+)%/g, (all, k: string) => {
    const hit = Object.keys(env).find((e) => e.toLowerCase() === k.toLowerCase());
    return hit ? (env[hit] ?? all) : all;
  });
  return m[1].split(";").map((p) => expand(p.trim())).filter(Boolean);
}
export function registryPath(machineOut: string, userOut: string, env: Record<string, string | undefined>): string[] {
  return [...values(machineOut, env), ...values(userOut, env)];
}

// The PATH to run with: the one the process has, then each registry folder and each extra folder not already in it.
export function joinPath(sep: string, current: string, registry: string[], extra: string[]): string {
  const key = (p: string) => p.toLowerCase().replace(/[\\/]+$/, "");
  const out = current.split(sep).filter(Boolean);
  const seen = new Set(out.map(key));
  for (const p of [...registry, ...extra]) {
    const k = key(p);
    if (!seen.has(k)) { seen.add(k); out.push(p); }
  }
  return out.join(sep);
}

// A copy of the environment with PATH set once, under the name it already has (`Path` on Windows), so a child process
// never gets two PATH keys and an unsure winner.
export function withPath<T extends Record<string, string | undefined>>(env: T, value: string): T {
  const keys = Object.keys(env).filter((k) => k.toLowerCase() === "path");
  const out: Record<string, string | undefined> = { ...env };
  for (const k of keys) delete out[k];
  out[keys[0] ?? "PATH"] = value;
  return out as T;
}

// The one line cmd runs. Node joins a shell command's arguments without quotes, so an empty argument vanished and a
// spaced one split (ssh-keygen's `-N ""`, Friday's Windows walk, 2026-10-13). Each argument that needs it is quoted
// by the C runtime's rules: a quote becomes \", and the backslashes before a quote or the closing quote are doubled.
export function cmdLine(cmd: string, args: string[]): string {
  const quote = (a: string) => a !== "" && !/[\s"&|<>^()]/.test(a) ? a
    : `"${a.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1")}"`;
  return [cmd, ...args].map(quote).join(" ");
}

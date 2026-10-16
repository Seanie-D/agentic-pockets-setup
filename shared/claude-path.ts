// Setup looks for Claude Code in more folders than Paseo does (~/.local/bin, winget's folder: real.ts EXTRA_PATH), so it
// can find a Claude that Paseo cannot start: "Provider 'claude' is not available" (Friday's Mac walk, 2026-10-13). Then
// setup gives Paseo's claude provider the full path; a provider built on claude takes it too. No imports: plain Node tests.

// The first folder that holds one of the names, as a full path.
export function findCommand(dirs: string[], names: string[], sep: string, isFile: (p: string) => boolean): string | null {
  for (const d of dirs) for (const n of names) {
    const p = `${d.replace(/[\\/]+$/, "")}${sep}${n}`;
    if (isFile(p)) return p;
  }
  return null;
}

type Providers = Record<string, Record<string, unknown> | undefined>;

// Paseo's Claude providers given a PATH that starts with the folder setup found Node in (Friday's read of the owner's
// 15:51 walk, 2026-10-13: Node in /opt/homebrew/bin, a desk's PATH without it, so no boot or clock hook ran). `claude`
// is Paseo's own and always there; any other id is changed only when the house has it. null when nothing should
// change: Node was not found, Paseo's own PATH has its folder, or every provider already has a PATH of the user's.
// key: the name the system gives the variable ("Path" on Windows, whose names ignore case, so a folder or a user's own
// PATH is matched in any case there).
export function pinNode(providers: Providers, ids: string[], nodeDir: string | null, paseoPath: string, delim: string, key = "PATH"): Providers | null {
  const anyCase = key !== "PATH";
  const same = (a: string, b: string) => (anyCase ? a.toLowerCase() === b.toLowerCase() : a === b);
  if (!nodeDir || paseoPath.split(delim).some((d) => same(d.replace(/[\\/]+$/, ""), nodeDir.replace(/[\\/]+$/, "")))) return null;
  const out: Providers = { ...providers };
  let changed = false;
  for (const id of ids) {
    const p = providers[id];
    const env = (p?.env as Record<string, unknown> | undefined) ?? {};
    if ((!p && id !== "claude") || Object.keys(env).some((k) => same(k, key))) continue;
    out[id] = { ...(p ?? {}), env: { ...env, [key]: [nodeDir, paseoPath].filter(Boolean).join(delim) } };
    changed = true;
  }
  return changed ? out : null;
}

// Item 7a of the next update: setup adapts to any way Claude Code is installed. It finds every copy in Paseo's own PATH
// order, knows where each came from, picks the newest one new enough, and tells Paseo to use it, so nobody removes or updates anything by hand. An old
// copy is updated only by its own route.
export type Origin = "Anthropic's installer" | "Homebrew" | "npm" | "npm under nvm" | "Volta" | "winget" | "an app";
export interface ClaudeCopy { at: string; version: string | null; from: Origin | null }

// Where a copy came from, read from where its command really lives (its link followed).
export function originOf(real: string): Origin | null {
  const p = real.replace(/\\/g, "/");
  if (/\/\.?volta\//i.test(p)) return "Volta";
  if (/node_modules\/@anthropic-ai\/claude-code/.test(p)) return /\/\.nvm\//.test(p) ? "npm under nvm" : "npm";
  // Windows: npm's global shim (its real path is itself), and nvm-windows' version folders.
  if (/\/AppData\/Roaming\/nvm\/[^/]+\/claude(\.cmd|\.ps1)?$/i.test(p)) return "npm under nvm";
  if (/\/AppData\/Roaming\/npm\/claude(\.cmd|\.ps1)?$/i.test(p)) return "npm";
  if (/\/(Caskroom|Cellar)\//.test(p)) return "Homebrew";
  if (/\/\.local\/share\/claude\//.test(p) || /\/\.local\/bin\/claude\.exe$/i.test(p)) return "Anthropic's installer";
  if (/\/WinGet\/(Packages|Links)\//i.test(p)) return "winget";
  if (/\.app\/Contents\//.test(p)) return "an app";
  return null;
}

const newer = (a: string, b: string) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
export const goodEnough = (v: string | null, need: string): v is string => !!v && !newer(need, v);

// The newest copy new enough; the first such one in Paseo's order when two have the same version.
export function pickClaude(copies: ClaudeCopy[], need: string): ClaudeCopy | null {
  let best: ClaudeCopy | null = null;
  for (const c of copies) if (goodEnough(c.version, need) && (!best || newer(c.version!, best.version!))) best = c;
  return best;
}

// Paseo's providers with claude's command set to the good copy; null when nothing should change: Paseo already runs a good
// copy (paseoRuns: the copy Paseo's own PATH finds first), its command already names a good copy, its command is one setup
// cannot read (the user's own wrapper), or no copy is new enough.
export function choosePin(providers: Providers, copies: ClaudeCopy[], paseoRuns: string | null, need: string): Providers | null {
  const good = pickClaude(copies, need);
  if (!good) return null;
  const set = (providers.claude?.command as string[] | undefined)?.[0];
  if (set) {
    const known = copies.find((c) => c.at === set);
    if (!known || goodEnough(known.version, need)) return null;
  } else if (paseoRuns && goodEnough(copies.find((c) => c.at === paseoRuns)?.version ?? null, need)) return null;
  return { ...providers, claude: { ...(providers.claude ?? {}), command: [good.at] } };
}

// How an old copy updates, by its own route only: Anthropic's copy updates itself; Homebrew, npm (the npm beside that copy,
// so an nvm copy is updated in its own Node), Volta and winget each by their own command. An app, or a copy from nowhere
// known, has none: setup names it instead.
export function updateRoute(c: ClaudeCopy, platform: string): string[] | null {
  const dir = c.at.replace(/[\\/][^\\/]+$/, ""), sep = platform === "win32" ? "\\" : "/";
  switch (c.from) {
    case "Anthropic's installer": return [c.at, "update"];
    case "Homebrew": return ["brew", "upgrade", "--cask", "claude-code"];
    // npm's own Windows shim folder holds no npm: the npm on the PATH is the one that put it there.
    case "npm": if (platform === "win32" && /[\\/]AppData[\\/]Roaming[\\/]npm$/i.test(dir)) return ["npm", "install", "-g", "@anthropic-ai/claude-code@latest"];
    // falls through: elsewhere the npm beside the copy is its own
    case "npm under nvm": return [`${dir}${sep}npm${platform === "win32" ? ".cmd" : ""}`, "install", "-g", "@anthropic-ai/claude-code@latest"];
    case "Volta": return ["volta", "install", "@anthropic-ai/claude-code@latest"];
    case "winget": return ["winget", "upgrade", "--id", "Anthropic.ClaudeCode", "--exact", "--silent", "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"];
    default: return null;
  }
}

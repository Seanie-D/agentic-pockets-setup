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
// Paseo's providers with claude's command set to the path setup found; null when nothing should change: Paseo finds
// Claude itself, the user already set a command, or setup found no Claude.
export function pinClaude(providers: Providers, found: string | null, paseoFinds: string | null): Providers | null {
  if (!found || paseoFinds || providers.claude?.command) return null;
  return { ...providers, claude: { ...(providers.claude ?? {}), command: [found] } };
}

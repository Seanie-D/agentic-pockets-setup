// The real outside world for the setup run, inside Paseo: processes, the doorman, and Paseo itself.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import type { PaseoApi } from "@getpaseo/client";
import type { Deps, Exec, Ops } from "./setup";

export const DOORMAN = "https://pockets-doorman.sank-junior-purple.workers.dev";

// Tools live in odd places on a new machine: Homebrew, the Paseo app's own CLI, Claude Code's installer folder.
const EXTRA_PATH = process.platform === "win32"
  // winget changes PATH for new windows only, so a tool installed a moment ago is found here (Node, Git, winget's links, Claude).
  ? [`${process.env.ProgramFiles ?? "C:\\Program Files"}\\nodejs`, `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Git\\cmd`,
    `${process.env.LOCALAPPDATA ?? ""}\\Programs\\Git\\cmd`, `${process.env.LOCALAPPDATA ?? ""}\\Microsoft\\WinGet\\Links`, `${os.homedir()}\\.local\\bin`]
  : ["/opt/homebrew/bin", "/usr/local/bin", `${os.homedir()}/.local/bin`, `${os.homedir()}/.claude/local`,
    "/Applications/Paseo.app/Contents/Resources/bin"];
export const pathEnv = () => [process.env.PATH ?? "", ...EXTRA_PATH].filter(Boolean).join(process.platform === "win32" ? ";" : ":");

export const exec: Exec = (cmd, args, o) => {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: pathEnv(), ...(o?.env ?? {}) };
  delete env.PASEO_AGENT_ID; delete env.PASEO_AGENT_CWD;
  const r = spawnSync(cmd, args, { env, encoding: "utf8", timeout: 300_000, shell: process.platform === "win32" });
  return { status: r.error ? 127 : r.status, stdout: r.stdout ?? "", stderr: (r.stderr ?? "") + (r.error ? String(r.error.message) : "") };
};

// A project's face: the SDK has no icon call, so this borrows the daemon client the CLI uses, when it can be loaded.
async function setProjectIcon(projectId: string, png: string): Promise<void> {
  const mod = await import("@getpaseo/client/internal/daemon-client" as string).catch(() => null) as { DaemonClient?: new (o: unknown) => { connect(): Promise<void>; close(): Promise<void>; setProjectIcon(id: string, icon: unknown): Promise<unknown> } } | null;
  if (!mod?.DaemonClient) throw new Error("faces are set later by your citizen");
  const Ws = (globalThis as { WebSocket?: new (u: string, p?: string | string[]) => unknown }).WebSocket;
  if (!Ws) throw new Error("no WebSocket in this Node");
  const port = (() => { try { return JSON.parse(fs.readFileSync(`${os.homedir()}/.paseo/config.json`, "utf8")).port ?? 6767; } catch { return 6767; } })();
  const c = new mod.DaemonClient({ url: `ws://127.0.0.1:${port}/ws`, clientId: "agentic-pockets-setup", clientType: "cli", reconnect: { enabled: false }, connectTimeoutMs: 10_000,
    webSocketFactory: (u: string, o?: { protocols?: string | string[] }) => new Ws(u, o?.protocols) });
  await c.connect();
  try { await c.setProjectIcon(projectId, { type: "upload", data: fs.readFileSync(png).toString("base64") }); } finally { await c.close().catch(() => {}); }
}

export function ops(paseo: PaseoApi): Ops {
  const handles = new Map<string, Awaited<ReturnType<PaseoApi["workspaces"]["create"]>>>();
  return {
    async createWorkspace({ dir, title }) {
      const w = await paseo.workspaces.create({ source: { kind: "directory", path: dir }, title });
      handles.set(w.id, w);
      return { workspaceId: w.id, projectId: w.projectId };
    },
    setIcon: setProjectIcon,
    async openDesk(o) {
      const w = handles.get(o.workspaceId);
      if (!w) throw new Error("the workspace was not made in this run");
      const a = await w.agents.create({ config: { provider: `${o.provider}/${o.model}`, modeId: "auto" }, title: o.title, labels: o.labels, prompt: o.firstLine });
      return { agentId: a.id };
    },
  };
}

export function deps(paseo: PaseoApi): Deps {
  return { exec, fetch: globalThis.fetch, ops: ops(paseo), hostname: () => os.hostname().replace(/\.local$/, ""), doorman: DOORMAN, now: () => new Date().toISOString() };
}

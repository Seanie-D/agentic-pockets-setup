// The real outside world for the setup run, inside Paseo: processes, the doorman, and Paseo itself.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
// The SDK names the Paseo handle in its handler context, so no outside package is needed in a clean install.
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
type PaseoApi = PluginHandlerContext["paseo"];
import path from "node:path";
import type { Deps, Exec, Ops } from "./setup";
import type { AgentRecord, DiscussDeps } from "./discuss";
import type { RewardDeps } from "./reward";
import { WELCOME_KIND } from "../shared/desk-welcome";
import { cmdLine, joinPath, registryPath, withPath } from "../shared/winpath";
import { findCommand, pinClaude } from "../shared/claude-path";

export const DOORMAN = "https://pockets-doorman.sank-junior-purple.workers.dev";

// Tools live in odd places on a new machine: Homebrew, the Paseo app's own CLI, Claude Code's installer folder.
const EXTRA_PATH = process.platform === "win32"
  // winget changes PATH for new windows only, so a tool installed a moment ago is found here (Node, Git, winget's links, Claude).
  ? [`${process.env.ProgramFiles ?? "C:\\Program Files"}\\nodejs`, `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Git\\cmd`,
    `${process.env.LOCALAPPDATA ?? ""}\\Programs\\Git\\cmd`, `${process.env.LOCALAPPDATA ?? ""}\\Microsoft\\WinGet\\Links`, `${os.homedir()}\\.local\\bin`,
    // Paseo's own command, inside the app (machine-wide or per user); not on PATH (Friday's Windows walk, 2026-10-12).
    `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Paseo\\resources\\bin`, `${process.env.LOCALAPPDATA ?? ""}\\Programs\\Paseo\\resources\\bin`]
  : ["/opt/homebrew/bin", "/usr/local/bin", `${os.homedir()}/.local/bin`, `${os.homedir()}/.claude/local`,
    "/Applications/Paseo.app/Contents/Resources/bin", "/opt/Paseo/resources/bin"];
// On Windows the registry's PATH joins too, read fresh each time, so a tool winget just installed is found at once.
// Kept two seconds, so a run of commands reads the registry once, and a check after an install still reads it fresh.
let regCache: { at: number; dirs: string[] } = { at: 0, dirs: [] };
const reg = (key: string) => spawnSync("reg", ["query", key, "/v", "Path"], { encoding: "utf8", windowsHide: true, timeout: 10_000 }).stdout ?? "";
const registryDirs = () => {
  if (Date.now() - regCache.at > 2000) regCache = { at: Date.now(), dirs: registryPath(reg("HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"), reg("HKCU\\Environment"), process.env) };
  return regCache.dirs;
};
export const pathEnv = () => process.platform === "win32"
  ? joinPath(";", process.env.PATH ?? "", registryDirs(), EXTRA_PATH)
  : [process.env.PATH ?? "", ...EXTRA_PATH].filter(Boolean).join(":");

export const exec: Exec = (cmd, args, o) => {
  const env: NodeJS.ProcessEnv = { ...withPath({ ...process.env }, pathEnv()), ...(o?.env ?? {}) };
  delete env.PASEO_AGENT_ID; delete env.PASEO_AGENT_CWD;
  // On Windows cmd runs it, so a .cmd shim (paseo, claude, npm) is found; the line is built here, each argument quoted where it needs it.
  const win = process.platform === "win32";
  const r = spawnSync(win ? cmdLine(cmd, args) : cmd, win ? [] : args, { env, cwd: o?.cwd, encoding: "utf8", timeout: 300_000, shell: win });
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
    // The welcome: a plugin-owned row in the first desk's chat, drawn by the client's desk-welcome renderer.
    async welcome(agentId, citizen) {
      await paseo.agents.ref(agentId).timeline.append({ type: "plugin", id: "desk-welcome", kind: WELCOME_KIND, version: 1, data: { citizen } });
    },
    // The clean profile: a provider that is Claude with the house's own folder (as Paseo's own docs build a second account).
    async addProvider(id, configDir) {
      const { config } = await paseo.config.get();
      const providers = { ...((config as { providers?: Record<string, unknown> }).providers ?? {}), [id]: { extends: "claude", label: "Claude (Agentic Pockets)", env: { CLAUDE_CONFIG_DIR: configDir } } };
      await paseo.config.patch({ providers } as Parameters<PaseoApi["config"]["patch"]>[0]);
    },
    // Paseo's own config, through the SDK: the plugin is one more directory source, enabled. No command line is needed.
    async addPlugin(id, dir) {
      const { config } = await paseo.config.get();
      const plugins = { ...((config as { plugins?: Record<string, unknown> }).plugins ?? {}), [id]: { source: "directory", path: dir, enabled: true } };
      await paseo.config.patch({ plugins } as Parameters<PaseoApi["config"]["patch"]>[0]);
      // Paseo keeps it, but starts it only at its next start or on a reload (proven 2026-10-12); the SDK has no reload,
      // so the Paseo command does it where it is found (the Mac app ships it; see EXTRA_PATH).
      return { running: exec("paseo", ["plugin", "reload", id]).status === 0 };
    },
    // Whether Paseo already has a plugin of this id, from any source (the official directory, Git, a folder).
    async hasPlugin(id) {
      const { config } = await paseo.config.get();
      return !!(config as { plugins?: Record<string, unknown> }).plugins?.[id];
    },
    // A plugin from Git: Paseo's own command clones it and starts it (proven on a test Paseo, 2026-10-12); the SDK has no
    // install call. No command found: the caller tells the user where to add it by hand.
    async installGitPlugin(source, ref) {
      const r = exec("paseo", ["plugin", "install", source, ...(ref ? ["--ref", ref] : []), "--json"]);
      if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim().split("\n").pop()?.slice(0, 160) || "the Paseo command was not found");
    },
    async pinClaude() {
      const win = process.platform === "win32";
      const names = win ? ["claude.exe"] : ["claude"];
      const isFile = (p: string) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
      const sep = win ? ";" : ":";
      const found = findCommand(pathEnv().split(sep), names, path.sep, isFile);
      const paseoFinds = findCommand((process.env.PATH ?? "").split(sep), names, path.sep, isFile);
      const { config } = await paseo.config.get();
      const providers = pinClaude((config as { providers?: Record<string, Record<string, unknown>> }).providers ?? {}, found, paseoFinds);
      if (!providers) return null;
      await paseo.config.patch({ providers } as Parameters<PaseoApi["config"]["patch"]>[0]);
      exec("paseo", ["reload"]);   // proven to apply it at once; the patch may already have
      return found;
    },
    async openDesk(o) {
      const w = handles.get(o.workspaceId);
      if (!w) throw new Error("the workspace was not made in this run");
      const a = await w.agents.create({ config: { provider: `${o.provider}/${o.model}`, modeId: "auto" }, title: o.title, labels: o.labels, prompt: o.firstLine });
      return { agentId: a.id };
    },
  };
}

// "Discuss this page": the desks Paseo knows, read from its own agent records (PASEO_HOME, else ~/.paseo), and the
// lead citizen's desk reached or opened through the SDK.
export function discussDeps(paseo: PaseoApi): DiscussDeps {
  return {
    records() {
      const dir = path.join(process.env.PASEO_HOME || path.join(os.homedir(), ".paseo"), "agents");
      const out: AgentRecord[] = [];
      let groups: string[] = []; try { groups = fs.readdirSync(dir); } catch { return out; }
      for (const g of groups) {
        let files: string[] = []; try { files = fs.readdirSync(path.join(dir, g)).filter((f) => f.endsWith(".json")); } catch { continue; }
        for (const f of files) try { out.push(JSON.parse(fs.readFileSync(path.join(dir, g, f), "utf8"))); } catch { /* half-written */ }
      }
      return out;
    },
    async send(agentId, text) { await paseo.agents.ref(agentId).send(text); },
    async open(row, citizen, firstLine) {
      const a = await paseo.workspaces.ref(row.workspaceId).agents.create({ config: { provider: `${row.provider}/${row.model}`, modeId: "auto" }, title: `${citizen} — desk`, labels: { role: "desk" }, prompt: firstLine });
      return a.id;
    },
  };
}

// The reward's chat row: a plugin-owned row in the lead citizen's timeline, drawn by the client's tutorial-reward renderer.
export function rewardDeps(paseo: PaseoApi): RewardDeps {
  return { ...discussDeps(paseo), async append(agentId, item) { await paseo.agents.ref(agentId).timeline.append(item as Parameters<ReturnType<PaseoApi["agents"]["ref"]>["timeline"]["append"]>[0]); } };
}

export function deps(paseo: PaseoApi): Deps {
  return { exec, fetch: globalThis.fetch, ops: ops(paseo), hostname: () => os.hostname().replace(/\.local$/, ""), doorman: DOORMAN, now: () => new Date().toISOString() };
}

// The clean profile's browser sign-in: `claude auth login` with the house's folder, left running on its own; Claude opens
// the browser, and the screen asks claude auth status until it reads signed in. It has no terminal, so nothing waits on it.
export function startSignIn(configDir: string): { started: boolean; message: string } {
  try {
    const env: NodeJS.ProcessEnv = { ...withPath({ ...process.env }, pathEnv()), CLAUDE_CONFIG_DIR: configDir };
    delete env.PASEO_AGENT_ID; delete env.PASEO_AGENT_CWD;
    const c = spawn("claude", ["auth", "login"], { env, detached: true, stdio: "ignore", shell: process.platform === "win32" });
    c.on("error", () => { /* reported by the status check: still signed out */ });
    c.unref();
    return { started: true, message: "Your browser opens to sign in to Claude. Come back here when it says you are signed in." };
  } catch (e) { return { started: false, message: `The sign-in did not start: ${String((e as Error)?.message ?? e).slice(0, 160)}` }; }
}

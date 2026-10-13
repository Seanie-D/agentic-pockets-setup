// The setup run (ticket 004 Resolution, steps 3–5): the house key, the invite, the download, a workspace with its face
// per picked citizen, and the first desk. Every outside effect goes through `deps`, so the same code runs for real
// inside Paseo and against fakes in the tests. Built by Jarvis, 2026-10-12.
import fs from "node:fs";
import path from "node:path";
import { PROFILE_PROVIDER, profileDir } from "./profile.ts";
import { DESK_WELCOME_ON, nameOf } from "../shared/desk-welcome.ts";
import { season } from "./seasonings.ts";
import { applyExtrasOff, type Extra } from "./tools.ts";
import { DEFAULT_MODE, tierFor, withTier, type Mode } from "../shared/mode.ts";
import { CAFE, withOptOut } from "../shared/cafe.ts";
const SETUP_ID = "agentic-pockets-setup";   // this plugin's own Paseo id (paseo-plugin.json)
import { BEAUTIFUL_CHAT } from "../shared/beautiful-chat.ts";

export interface Exec { (cmd: string, args: string[], o?: { env?: Record<string, string>; cwd?: string }): { status: number | null; stdout: string; stderr: string } }
export interface Ops {
  createWorkspace(o: { dir: string; title: string }): Promise<{ workspaceId: string; projectId: string | null }>;
  setIcon(projectId: string, pngPath: string): Promise<void>;
  addPlugin(id: string, dir: string): Promise<{ running: boolean }>;
  addProvider(id: string, configDir: string): Promise<void>;
  // Gives Paseo Claude's full path when Paseo cannot find Claude itself; the path, or null when nothing changed.
  pinClaude(): Promise<string | null>;
  installGitPlugin(source: string, ref?: string): Promise<void>;
  hasPlugin(id: string): Promise<boolean>;
  welcome(agentId: string, citizen: string): Promise<void>;
  openDesk(o: { workspaceId: string; cwd: string; provider: string; model: string; title: string; labels: Record<string, string>; firstLine: string }): Promise<{ agentId: string | null }>;
}
export interface Deps { exec: Exec; fetch: typeof fetch; ops: Ops; hostname: () => string; doorman: string; now: () => string }
export interface SetupInput { paseoHome?: string; code: string; userName: string; extras?: Extra[]; extrasOff?: string[]; citizens: string[]; accounts: Record<string, string>; root: string; home: string; models?: Record<string, string>; cleanProfile?: boolean; welcome?: boolean; mode?: Mode; cafe?: boolean }
export interface SetupResult { ok: boolean; message: string; steps: string[]; firstDesk?: { citizen: string; agentId: string | null } }

// The first line of the first desk (ticket 004 Q11): setup is not finished, so the citizen says hello, sends the user
// back to finish, and says they can ask it anything at any time.
export const SETUP_LINE = "[SETUP] Setup has just started and is not finished yet. Say hello in one or two plain sentences, tell the user they can ask you anything at any time, and send them back to the Agentic Pockets setup screen to finish it.";
const DEFAULT_MODEL: Record<string, string> = { claude: "claude-opus-5-5", "claude-house": "claude-opus-5-5" };
const HOUSE_MANAGER = "Jarvis";

// The whole run, as the tests drive it: connect, then install.
export async function runSetup(input: SetupInput, deps: Deps): Promise<SetupResult> {
  if (!input.userName?.trim()) return { ok: false, message: "Tell us your name first. Your citizens use it.", steps: [] };
  if (!input.citizens.length) return { ok: false, message: "Pick at least one citizen to start with.", steps: [] };
  const c = await connect(input, deps);
  if (!c.ok) return c;
  const i = await install(input, deps);
  return { ...i, steps: [...c.steps, ...i.steps] };
}

// What the picker shows: each pack in the downloaded house, with its hello page (ticket 004 Q16).
export function packsIn(root: string): { name: string; hello: string }[] {
  const dir = path.join(root, ".upstream", "Pockets");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => !n.startsWith("_") && !n.startsWith(".")).map((name) => {
    let hello = ""; try { hello = fs.readFileSync(path.join(dir, name, "hello.md"), "utf8"); } catch { /* no page yet */ }
    return { name, hello };
  });
}

// Git's ssh line for the house key. Git runs it through sh, also on Windows, so the path is one quoted word with
// forward slashes: sh dropped the backslashes and split at a space.
export const sshCommand = (key: string) =>
  `ssh -i '${key.replace(/\\/g, "/").replace(/'/g, "'\\''")}' -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;

// Steps 1–3: the house key, the invite, the download (or an update, when the house is already here).
export async function connect(input: Pick<SetupInput, "code" | "root" | "home">, deps: Deps): Promise<SetupResult> {
  const steps: string[] = [];
  const fail = (message: string): SetupResult => ({ ok: false, message, steps });
  const keys = path.join(input.home, ".agentic-pockets", "keys");
  const key = path.join(keys, "house_ed25519");
  const upstream = path.join(input.root, ".upstream");
  const ssh = sshCommand(key);

  // 1. The house's own key: made once, kept in the user's home, readable by the user alone.
  fs.mkdirSync(keys, { recursive: true, mode: 0o700 }); fs.chmodSync(keys, 0o700);
  if (!fs.existsSync(key)) {
    const r = deps.exec("ssh-keygen", ["-t", "ed25519", "-N", "", "-C", `agentic-pockets ${deps.hostname()}`, "-f", key]);
    if (r.status !== 0) return fail(`Making the house key failed: ${r.stderr.trim().slice(0, 200)}`);
    steps.push("Made this house's own key.");
  }

  // 2 + 3. The invite and the download. A house already downloaded skips the invite and updates instead.
  if (!fs.existsSync(path.join(upstream, ".git")) && !fs.existsSync(path.join(upstream, "Pockets"))) {
    const publicKey = fs.readFileSync(`${key}.pub`, "utf8").trim();
    let res: Response;
    try { res = await deps.fetch(`${deps.doorman}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: input.code.trim(), publicKey, house: deps.hostname() }) }); }
    catch (e) { return fail(`Could not reach the invite service. Check the internet connection and try again. (${String((e as Error).message).slice(0, 120)})`); }
    const body = await res.json().catch(() => ({})) as { repo?: string; error?: string };
    if (!res.ok || !body.repo) return fail(res.status === 409 ? "This invite has already been used. Ask the person who invited you for a new one." : res.status === 404 ? "That invite code is not known. Check it, or ask for a new one." : `The invite was not accepted: ${body.error ?? res.status}`);
    steps.push("Your invite was accepted.");
    fs.mkdirSync(input.root, { recursive: true });
    const r = deps.exec("git", ["clone", "--depth", "50", body.repo, upstream], { env: { GIT_SSH_COMMAND: ssh } });
    if (r.status !== 0) return fail(`Downloading the house failed: ${r.stderr.trim().slice(0, 200)}`);
    deps.exec("git", ["-C", upstream, "config", "core.sshCommand", ssh]);
    steps.push("Downloaded the house.");
  } else {
    const r = deps.exec("git", ["-C", upstream, "pull", "--ff-only"]);
    steps.push(r.status === 0 ? "Updated the house." : "Could not update the house; using the copy already here.");
  }
  return { ok: true, message: "Connected.", steps };
}

function setTier(pocket: string, mode: Mode): boolean {
  const f = path.join(pocket, "AGENTS.md");
  let md: string; try { md = fs.readFileSync(f, "utf8"); } catch { return false; }
  const out = withTier(md, tierFor(mode));
  if (out === md) return false;
  fs.writeFileSync(f, out);
  return true;
}

// The same choice after setup: every pocket setup placed takes it, and the record keeps it.
export function setMode(root: string, mode: Mode): { ok: boolean; changed: string[]; message?: string } {
  const recFile = path.join(root, "house.json");
  let rec: Record<string, unknown>;
  try { rec = JSON.parse(fs.readFileSync(recFile, "utf8")); } catch { return { ok: false, changed: [], message: "This house has no house record yet. Finish setup first." }; }
  const changed = ((rec.placedCitizens as string[]) ?? []).filter((n) => setTier(path.join(root, "Pockets", n), mode)).sort();
  fs.writeFileSync(recFile, JSON.stringify({ ...rec, mode, updatedAt: new Date().toISOString() }, null, 2) + "\n");
  return { ok: true, changed };
}

function fillName(dir: string, name: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) fillName(f, name);
    else if (e.isFile() && /\.md$/.test(e.name)) { const t = fs.readFileSync(f, "utf8"); if (t.includes("{{USER_NAME}}")) fs.writeFileSync(f, t.replaceAll("{{USER_NAME}}", name)); }
  }
}

// Steps 4–5: place the picked citizens, a workspace with its face for each, and the first desk.
export async function install(input: SetupInput, deps: Deps): Promise<SetupResult> {
  const steps: string[] = [];
  const fail = (message: string): SetupResult => ({ ok: false, message, steps });
  const name = input.userName?.trim();
  if (!name) return fail("Tell us your name first. Your citizens use it.");
  if (!input.citizens.length) return fail("Pick at least one citizen to start with.");
  const upstream = path.join(input.root, ".upstream");
  // Jarvis comes with every house, beside the picked citizens, on the first one's account; the first desk stays theirs
  // (ticket 004 Q16, ruled 2026-10-12: "At setup, always"). He does not count toward Ultron's two or more: that is the picker's.
  const picked = input.citizens;
  if (!picked.includes(HOUSE_MANAGER) && fs.existsSync(path.join(upstream, "Pockets", HOUSE_MANAGER)))
    input = { ...input, citizens: [...picked, HOUSE_MANAGER], accounts: { [HOUSE_MANAGER]: input.accounts[picked[0]] ?? "claude", ...input.accounts } };

  // 4. The house itself: the Commons, the template, and each picked citizen. A pocket already here is the user's, untouched.
  // A newly placed folder gets the user's own name in its {{USER_NAME}} slots (the tenets, Q6); a folder already here is not touched.
  const placedNow: string[] = [];
  const put = (rel: string) => { const to = path.join(input.root, rel); if (!fs.existsSync(to)) { fs.cpSync(path.join(upstream, rel), to, { recursive: true, verbatimSymlinks: true }); fillName(to, name); placedNow.push(to); } };
  const missing = input.citizens.find((n) => !fs.existsSync(path.join(upstream, "Pockets", n)));
  if (missing) return fail(`${missing} is not in this release of the house.`);   // before anything is placed
  for (const rel of ["Commons", path.join("Pockets", "_Template")]) if (fs.existsSync(path.join(upstream, rel))) put(rel);
  for (const n of input.citizens) put(path.join("Pockets", n));
  steps.push(`Placed ${input.citizens.join(", ")} in ${input.root}.`);
  // How the citizens run (Q11): on demand unless the user picked always on; a run that names no mode keeps the house's.
  // A pocket placed now takes it; one setup placed in an earlier run takes it only when the mode changes; a pocket the user
  // had before setup stays as it is.
  let before: Record<string, unknown> = {}; try { before = JSON.parse(fs.readFileSync(path.join(input.root, "house.json"), "utf8")); } catch { /* first run */ }
  const mode: Mode = input.mode ?? (before.mode === "always-on" ? "always-on" : DEFAULT_MODE);
  const earlier = (before.placedCitizens as string[]) ?? [];
  const now = input.citizens.filter((n) => placedNow.includes(path.join(input.root, "Pockets", n)));
  const placedCitizens = [...new Set([...earlier, ...now])].sort();
  for (const n of mode === before.mode ? now : placedCitizens) setTier(path.join(input.root, "Pockets", n), mode);
  // Kept at once, before any step that can fail, so a retry knows which pockets are setup's and which mode they took.
  fs.writeFileSync(path.join(input.root, "house.json"), JSON.stringify({ setupDone: false, ...before, placedCitizens, mode }, null, 2) + "\n");

  // Ticket 004 Q2: the house plugin travels with setup. It holds the house's machinery (the Mailman, the nightly clock-out,
  // the save point) and its views, so it is placed in the house and added to Paseo before any desk opens. A folder already
  // here is kept; Paseo is told again, which changes nothing when it already has it.
  let plugins: string[] = []; try { plugins = fs.readdirSync(path.join(upstream, "plugins")); } catch { /* a release without plugins */ }
  for (const id of plugins) {
    const to = path.join(input.root, "plugins", id);
    if (!fs.existsSync(to)) fs.cpSync(path.join(upstream, "plugins", id), to, { recursive: true, verbatimSymlinks: true });
    try {
      const { running } = await deps.ops.addPlugin(id, to);
      steps.push(running ? "Added the house plugin to Paseo." : "Added the house plugin to Paseo. It starts the next time Paseo starts: quit Paseo and open it again.");
    }
    catch (e) { steps.push(`Setup could not add the house plugin to Paseo (${String((e as Error)?.message ?? e).slice(0, 160)}). Your citizens work without it, but nothing wakes them on mail or closes them at night until it is added.`); }
  }

  // Beautiful Chat, in every house (ticket 022). A copy the user already has is theirs to keep.
  if (await deps.ops.hasPlugin(BEAUTIFUL_CHAT.id).catch(() => false)) steps.push("Beautiful Chat is already in Paseo; setup kept yours.");
  else {
    try { await deps.ops.installGitPlugin(BEAUTIFUL_CHAT.source, BEAUTIFUL_CHAT.ref); steps.push("Added Beautiful Chat to Paseo: a cleaner look for every chat."); }
    catch (e) { steps.push(`Setup could not add Beautiful Chat (${String((e as Error)?.message ?? e).slice(0, 160)}). Your house works without it. You can add it in Paseo: Settings, Plugins, Plugin source: ${BEAUTIFUL_CHAT.source}`); }
  }

  // The Paseo Cafe, only when the user ticked it; the house works without it. With the Cafe in Paseo, setup goes on its
  // opt-out list first, before the Cafe's first update run: setup changes only through the house's offer (ticket 06).
  if (input.cafe || await deps.ops.hasPlugin(CAFE.id)) {
    const f = path.join(input.paseoHome ?? path.join(input.home, ".paseo"), "plugin-settings", CAFE.id, "directory-settings.json");
    let cur = null; try { cur = JSON.parse(fs.readFileSync(f, "utf8")); } catch { /* none yet */ }
    try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(withOptOut(cur, SETUP_ID))); }
    catch (e) { steps.push(`Setup could not keep the Paseo Cafe from updating it (${String((e as Error)?.message ?? e).slice(0, 120)}).`); }
  }
  if (input.cafe) {
    try { await deps.ops.installGitPlugin(CAFE.source); steps.push("Added the Paseo Cafe to Paseo."); }
    catch (e) { steps.push(`Setup could not add the Paseo Cafe (${String((e as Error)?.message ?? e).slice(0, 160)}). You can add it in Paseo: Settings, Plugins, Plugin source: ${CAFE.source}`); }
  }

  // Ticket 004 Q8: the extras the user switched off, for this house only, written before any desk starts (Claude Code reads
  // its settings when a session starts). Kept in house.json so a pocket added later gets them too.
  const off = input.extrasOff ?? [];
  let extrasSettingsOut: Record<string, unknown> = {};
  if (off.length) {
    const x = applyExtrasOff(input.root, input.extras ?? [], off);
    extrasSettingsOut = x.settings;
    if (x.switched.length) steps.push(`Switched off for this house: ${x.switched.map((e) => e.name).join(", ")}.`);
  }

  // The seasonings, in each placed citizen's own folder (house only); kept in house.json for citizens added later.
  const placed = input.citizens.map((n) => path.join(input.root, "Pockets", n));
  const sz = season(placed, input.home, deps.exec);
  if (sz.added.length) steps.push(`Seasoned the house with ${sz.added.join(" and ")}.`);
  if (sz.theirs.length) steps.push(`Left ${sz.theirs.join(" and ")} to your own Claude, which already has it.`);
  if (sz.failed.length) steps.push(`Could not add ${sz.failed.join(" and ")}. The house works without it; Jarvis can add it later.`);

  // The clean profile: the house's own Claude folder, as its own Paseo provider; every Claude desk of the house uses it.
  if (input.cleanProfile) {
    await deps.ops.addProvider(PROFILE_PROVIDER, profileDir(input.home));
    input = { ...input, accounts: Object.fromEntries(input.citizens.map((n) => [n, (input.accounts[n] ?? "claude") === "claude" ? PROFILE_PROVIDER : input.accounts[n]])) };
    steps.push("Gave the house its own Claude profile. Your own hooks stay in your other projects.");
  }

  // Paseo must be able to start Claude before any desk opens (Friday's Mac walk, 2026-10-13: ~/.local/bin is not on its PATH).
  try { const at = await deps.ops.pinClaude(); if (at) steps.push(`Showed Paseo where Claude Code is: ${at}.`); }
  catch (e) { steps.push(`Could not show Paseo where Claude Code is: ${String((e as Error).message).slice(0, 160)}.`); }

  // 5. A Paseo workspace with its face per citizen, then the first desk: Ultron's when he is there, else the one citizen's.
  const spaces: Record<string, string> = {};
  for (const n of input.citizens) {
    const dir = path.join(input.root, "Pockets", n);
    const w = await deps.ops.createWorkspace({ dir, title: nameOf(n) });   // the display name, as the welcome card says it
    spaces[n] = w.workspaceId;
    const face = path.join(dir, "face.png");
    if (w.projectId && fs.existsSync(face)) await deps.ops.setIcon(w.projectId, face).catch(() => { /* a face is nice, not needed */ });
  }
  steps.push("Made a Paseo workspace for each citizen.");
  // Each citizen's desk row: what the house plugin opens a desk with (its Mailman and clock-in).
  const desks: Record<string, { provider: string; model: string; workspaceId: string }> = {};
  for (const n of input.citizens) {
    const provider = input.accounts[n] ?? "claude";
    desks[n] = { provider, model: input.models?.[n] ?? DEFAULT_MODEL[provider] ?? "default", workspaceId: spaces[n] };
  }
  const first = input.citizens.includes("Ultron") ? "Ultron" : input.citizens[0];
  const provider = desks[first].provider;
  const desk = await deps.ops.openDesk({ workspaceId: spaces[first], cwd: path.join(input.root, "Pockets", first), provider, model: desks[first].model,
    title: `${first} — desk`, labels: { role: "desk" }, firstLine: SETUP_LINE });
  steps.push(`Opened ${first}'s desk.`);
  // The welcome row at the top of the first desk's chat; a chat works without it, so a failure is only skipped.
  if ((input.welcome ?? DESK_WELCOME_ON) && desk.agentId) await deps.ops.welcome(desk.agentId, first).catch(() => {});

  // The house record (ticket 004 Q4): what this house has, read by every citizen and by the plugin's screens.
  const recFile = path.join(input.root, "house.json");
  let rec: Record<string, unknown> = {}; try { rec = JSON.parse(fs.readFileSync(recFile, "utf8")); } catch { /* first run */ }
  const citizens = [...new Set([...((rec.citizens as string[]) ?? []), ...input.citizens])].sort();
  fs.writeFileSync(recFile, JSON.stringify({ ...rec, userName: name, ...(off.length ? { extrasOff: off, extrasSettings: extrasSettingsOut } : {}), seasonSettings: sz.settings, desks: { ...(rec.desks as object ?? {}), ...desks }, citizens, placedCitizens, mode, accounts: { ...(rec.accounts as object ?? {}), ...input.accounts }, createdAt: rec.createdAt ?? deps.now(), updatedAt: deps.now(), setupDone: false }, null, 2) + "\n");
  return { ok: true, message: `${first} is ready. Finish setup here, then say hello.`, steps, firstDesk: { citizen: first, agentId: desk.agentId } };
}

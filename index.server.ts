import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { connect, install, packsIn, setMode } from "./server/setup";
import { checkTools, installTools, listExtras } from "./server/tools";
import { deps, discussDeps, exec, rewardDeps, startSignIn } from "./server/real";
import { profileDir, signedIn, signedInTo } from "./server/profile";
import { ask, discuss } from "./server/discuss";
import { connectRpc, finishRpc, installRpc, installToolsRpc, status, tutorialDiscussRpc, tutorialReadRpc, tutorialSeenRpc, tutorialGotItRpc, profileStatusRpc, profileSignInRpc, claudeStatusRpc, claudeSignInRpc, welcomeDismissRpc, welcomeReadRpc, modeSetRpc, askRpc, firstTurnRpc, helpButtonRpc } from "./shared/contracts";
import { helpButton, type WorkspaceRecord } from "./shared/help-button";
import { markWelcomeSeen, welcomeSeen } from "./server/welcome";
import { gotIt, markSeen, readTutorial, realProbe, stateTicks } from "./server/tutorial";
import { rewardPass } from "./server/reward";
import { askHelp, readGlossary } from "./server/help";
import { helpAskRpc, helpGlossaryRpc, signInAgainRpc, signInStateRpc, houseStatusRpc, repairRpc } from "./shared/contracts";
import { houseStatus, readBeautifulPockets, readPocket } from "./server/house-status";
import { repair } from "./server/discuss";
import { signInTarget } from "./shared/sign-in-again";
import { joinable } from "./shared/job";
import { clearForm, readForm, saveForm, saveResult } from "./server/form";
import { firstTurn, type DeskRecord } from "./server/first-turn";

// The house goes in the user's home folder, beside anything they already have (ticket 004 Q7: earlier projects untouched).
const ROOT = path.join(os.homedir(), "agentic-pockets");
const record = () => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "house.json"), "utf8")); } catch { return {}; } };

// Paseo gives a plugin call 30 seconds; installing tools, connecting and installing the house can take longer on a slow
// Windows seat (the owner's 15:51 walk, 2026-10-13: two installs, two Ultron desks). Each runs as one joinable job.
// This start of the plugin's server: the welcome opens once per start, so a plugin added again opens it again.
const SERVER_START = `${process.pid}-${Date.now()}`;
const WAIT_MS = 20_000;
const BUSY = { ok: false, message: "Still working…", steps: [] as string[], running: true };
// A job's own failure is an answer, so the screen's repeat calls (shared/job.ts untilDone) never start a second run.
const failed = (e: unknown) => ({ ok: false, message: `Setup stopped: ${String((e as Error)?.message ?? e).slice(0, 300)}`, steps: [] as string[] });

// The last Start's form, and what it made only while that house is still here (a house deleted before Finish is not good to go).
const started = () => { const f = readForm(os.homedir()); return f && !fs.existsSync(path.join(ROOT, "house.json")) ? { ...f, result: null } : f; };

export default function contribute(server: PluginServerContext) {
  const toolsJob = joinable<{ tools: ReturnType<typeof installTools>; running?: boolean; failed?: string }>(WAIT_MS);
  const connectJob = joinable<Awaited<ReturnType<typeof connect>> & { running?: boolean }>(WAIT_MS);
  const installJob = joinable<Awaited<ReturnType<typeof install>> & { running?: boolean }>(WAIT_MS);
  // The reward: once the tutorial is complete, the lead citizen is asked to draw it, and its drawing is shown in its chat.
  // Ticks and drawings land in a citizen's turn, so each turn's end (and each opening of the tutorial) runs the pass.
  let busy = false;
  const reward = (paseo: Parameters<typeof rewardDeps>[0]) => {
    if (busy) return; busy = true;
    rewardPass(ROOT, rewardDeps(paseo), new Date().toISOString())
      .catch((e) => console.error(`tutorial reward: ${String(e?.message ?? e).slice(0, 200)}`)).finally(() => { busy = false; });
  };
  server.handle(status, async (_i, { paseo }) => {
    const accounts = await paseo.providers.listAvailable().then((r) => ((r as { providers?: { provider?: string; id?: string; available?: boolean }[] }).providers ?? [])
      .filter((p) => p.available !== false).map((p) => String(p.provider ?? p.id))).catch(() => ["claude"]);
    return { tools: checkTools(exec), extras: listExtras(os.homedir()), root: ROOT, connected: fs.existsSync(path.join(ROOT, ".upstream")),
      packs: packsIn(ROOT), accounts: accounts.length ? accounts : ["claude"], setupDone: record().setupDone === true,
      mode: record().mode === "always-on" ? "always-on" as const : "on-demand" as const,
      cafe: await paseo.config.get().then(({ config }) => !!(config as { plugins?: Record<string, unknown> }).plugins?.["paseo-cafe"]).catch(() => false),
      installing: installJob.running(), started: record().setupDone === true ? null : started() };
  });
  server.handle(welcomeReadRpc, async () => ({ seen: welcomeSeen(os.homedir()), server: SERVER_START }));
  server.handle(welcomeDismissRpc, async () => { markWelcomeSeen(os.homedir(), new Date().toISOString()); return { seen: true }; });
  server.handle(tutorialReadRpc, async (_i, { paseo }) => {
    stateTicks(ROOT, realProbe(ROOT), new Date().toISOString());   // the setup items, from the state as the tutorial opens
    reward(paseo);
    return readTutorial(ROOT);
  });
  server.handle(helpButtonRpc, async () => {
    let rec: unknown = null; try { rec = JSON.parse(fs.readFileSync(path.join(ROOT, "house.json"), "utf8")); } catch { /* no house yet */ }
    // Paseo's own record of every workspace, read only: a citizen's second workspace gets the button too.
    let ws: unknown[] = [];
    try { const w = JSON.parse(fs.readFileSync(path.join(process.env.PASEO_HOME || path.join(os.homedir(), ".paseo"), "projects", "workspaces.json"), "utf8")); ws = Array.isArray(w) ? w : Object.values(w.workspaces ?? w); } catch { /* none readable */ }
    return helpButton(rec, rec ? readTutorial(ROOT).complete : false, ROOT, ws.filter((x): x is WorkspaceRecord => !!x && typeof x === "object"));
  });
  server.handle(tutorialSeenRpc, async ({ id }) => { markSeen(ROOT, id); return { ok: true }; });
  server.handle(tutorialGotItRpc, async ({ id }) => { gotIt(ROOT, id, new Date().toISOString()); return { ok: true }; });
  server.handle(tutorialDiscussRpc, async ({ itemId }, { paseo }) => discuss(ROOT, itemId, discussDeps(paseo)));
  server.handle(installToolsRpc, async ({ run }) => toolsJob(run, async () => { try { return { tools: installTools(exec, process.platform) }; } catch (e) { return { tools: [], failed: String((e as Error)?.message ?? e).slice(0, 300) }; } }, { tools: [], running: true }));
  server.handle(connectRpc, async ({ code, run }, { paseo }) => connectJob(run, () => connect({ code, root: ROOT, home: os.homedir() }, deps(paseo)).catch(failed), BUSY));
  server.handle(profileStatusRpc, async () => ({ signedIn: signedIn(exec, os.homedir()) }));
  server.handle(profileSignInRpc, async () => startSignIn(profileDir(os.homedir())));
  server.handle(claudeStatusRpc, async () => ({ signedIn: signedInTo(exec, null) }));
  server.handle(claudeSignInRpc, async () => startSignIn(null));
  // Item 4b: house-check's seven lines, read on the setup page after setup ends, and its Repair my setup.
  server.handle(houseStatusRpc, async (_i, { paseo }) => {
    const rec = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "house.json"), "utf8")); } catch { return null; } })();
    const placed: string[] = Array.isArray(rec?.placedCitizens) ? rec.placedCitizens : [];
    // Paseo's own plugin list says which run; when its command cannot be asked, its settings say which are there.
    let plugins: { id: string; running: boolean | null }[] = [];
    const ls = exec("paseo", ["plugin", "ls", "--json"], { timeout: 20_000 });
    try { plugins = (JSON.parse(ls.stdout.slice(ls.stdout.search(/[[{]/))) as { id?: string; name?: string; status?: string }[]).map((p) => ({ id: String(p.id ?? p.name), running: p.status ? p.status === "running" : null })); }
    catch { plugins = await paseo.config.get().then(({ config }) => Object.keys((config as { plugins?: Record<string, unknown> }).plugins ?? {}).map((id) => ({ id, running: null }))).catch(() => []); }
    let ws: { workspaceId?: string; archivedAt?: string | null }[] = [];
    try { const w = JSON.parse(fs.readFileSync(path.join(process.env.PASEO_HOME || path.join(os.homedir(), ".paseo"), "projects", "workspaces.json"), "utf8")); ws = Array.isArray(w) ? w : Object.values(w.workspaces ?? w); } catch { /* none readable */ }
    return { lines: houseStatus({
      tools: checkTools(exec), npm: exec("npm", ["--version"], { timeout: 20_000 }).status === 0, record: rec,
      pockets: Object.fromEntries(placed.map((n) => [n, readPocket(ROOT, n)])), plugins, beautifulPockets: readBeautifulPockets(ROOT),
      workspaces: ws.filter((w) => w && !w.archivedAt && w.workspaceId).map((w) => String(w.workspaceId)),
    }) };
  });
  server.handle(repairRpc, async (_i, { paseo }) => repair(ROOT, discussDeps(paseo)));
  // Item 1: the sign-in the house's desks use, read and started again from the house plugin's Citizens page.
  server.handle(signInStateRpc, async () => {
    const target = signInTarget(record());
    return { target, signedIn: target === null ? true : signedInTo(exec, target === "house" ? profileDir(os.homedir()) : null) };
  });
  server.handle(signInAgainRpc, async () => {
    const target = signInTarget(record());
    return target === null ? { started: false, message: "No citizen in this house runs on Claude." } : startSignIn(target === "house" ? profileDir(os.homedir()) : null);
  });
  server.handle(modeSetRpc, async ({ mode }) => setMode(ROOT, mode));
  server.handle(askRpc, async ({ topic }, { paseo }) => ask(ROOT, topic, discussDeps(paseo)));
  server.handle(installRpc, async ({ userName, citizens, accounts, extrasOff, cleanProfile, mode, cafe, run }, { paseo }) => {
    // Kept before the sign-in check, so a refused Start keeps its picks too (Sean, re-walk 3, 2026-10-14 09:14 CDT).
    saveForm(os.homedir(), { userName, citizens, accounts, extrasOff, cleanProfile, mode, cafe });
    // Claude must be signed in first, the user's own or the clean profile's: a signed-out one greets the user with "Not logged in".
    if (!cleanProfile && !signedInTo(exec, null)) return { ok: false, message: "Sign in to Claude first: step 1, after the tools.", steps: [] };
    if (cleanProfile && !signedIn(exec, os.homedir())) return { ok: false, message: "Sign in to Claude for your house first, or switch the clean profile off.", steps: [] };
    return installJob(run, () => install({ paseoHome: process.env.PASEO_HOME, code: "", userName, citizens, accounts, extras: listExtras(os.homedir()), extrasOff, cleanProfile, mode, cafe, root: ROOT, home: os.homedir() }, deps(paseo))
      .then((r) => { if (r.ok) saveResult(os.homedir(), r); return r; }).catch(failed), BUSY);
  });
  server.handle(firstTurnRpc, async ({ agentId }, { paseo }) => firstTurn(discussDeps(paseo).records().find((r) => r.id === agentId) as DeskRecord | undefined));
  server.handle(finishRpc, async () => {
    const rec = record(); fs.writeFileSync(path.join(ROOT, "house.json"), JSON.stringify({ ...rec, setupDone: true, updatedAt: new Date().toISOString() }, null, 2) + "\n");
    clearForm(os.homedir());
    return { ok: true };
  });
  server.handle(helpGlossaryRpc, async () => ({ terms: readGlossary(ROOT) }));
  server.handle(helpAskRpc, async (subject, { paseo }) => askHelp(ROOT, subject, discussDeps(paseo)));
  server.on("agent.turn_ended", (_e, { paseo }) => reward(paseo));
  return () => {};
}

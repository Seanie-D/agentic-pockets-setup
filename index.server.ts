import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { connect, install, packsIn } from "./server/setup";
import { checkTools, installTools, listExtras } from "./server/tools";
import { deps, discussDeps, exec, rewardDeps } from "./server/real";
import { discuss } from "./server/discuss";
import { connectRpc, finishRpc, installRpc, installToolsRpc, status, tutorialDiscussRpc, tutorialReadRpc, tutorialSeenRpc, welcomeDismissRpc, welcomeReadRpc } from "./shared/contracts";
import { markWelcomeSeen, welcomeSeen } from "./server/welcome";
import { markSeen, readTutorial, realProbe, stateTicks } from "./server/tutorial";
import { rewardPass } from "./server/reward";

// The house goes in the user's home folder, beside anything they already have (ticket 004 Q7: earlier projects untouched).
const ROOT = path.join(os.homedir(), "agentic-pockets");
const record = () => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "house.json"), "utf8")); } catch { return {}; } };

export default function contribute(server: PluginServerContext) {
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
      packs: packsIn(ROOT), accounts: accounts.length ? accounts : ["claude"], setupDone: record().setupDone === true };
  });
  server.handle(welcomeReadRpc, async () => ({ seen: welcomeSeen(os.homedir()) }));
  server.handle(welcomeDismissRpc, async () => { markWelcomeSeen(os.homedir(), new Date().toISOString()); return { seen: true }; });
  server.handle(tutorialReadRpc, async (_i, { paseo }) => {
    stateTicks(ROOT, realProbe(ROOT), new Date().toISOString());   // the setup items, from the state as the tutorial opens
    reward(paseo);
    return readTutorial(ROOT);
  });
  server.handle(tutorialSeenRpc, async ({ id }) => { markSeen(ROOT, id); return { ok: true }; });
  server.handle(tutorialDiscussRpc, async ({ itemId }, { paseo }) => discuss(ROOT, itemId, discussDeps(paseo)));
  server.handle(installToolsRpc, async () => ({ tools: installTools(exec, process.platform) }));
  server.handle(connectRpc, async ({ code }, { paseo }) => connect({ code, root: ROOT, home: os.homedir() }, deps(paseo)));
  server.handle(installRpc, async ({ userName, citizens, accounts, extrasOff }, { paseo }) => {
    return install({ code: "", userName, citizens, accounts, extras: listExtras(os.homedir()), extrasOff, root: ROOT, home: os.homedir() }, deps(paseo));
  });
  server.handle(finishRpc, async () => {
    const rec = record(); fs.writeFileSync(path.join(ROOT, "house.json"), JSON.stringify({ ...rec, setupDone: true, updatedAt: new Date().toISOString() }, null, 2) + "\n");
    return { ok: true };
  });
  server.on("agent.turn_ended", (_e, { paseo }) => reward(paseo));
  return () => {};
}

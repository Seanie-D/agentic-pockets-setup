import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { connect, install, packsIn } from "./server/setup";
import { checkTools, installTools, listExtras } from "./server/tools";
import { deps, discussDeps, exec } from "./server/real";
import { discuss } from "./server/discuss";
import { connectRpc, finishRpc, installRpc, installToolsRpc, status, tutorialDiscussRpc, tutorialReadRpc, welcomeDismissRpc, welcomeReadRpc } from "./shared/contracts";
import { markWelcomeSeen, welcomeSeen } from "./server/welcome";
import { readTutorial } from "./server/tutorial";

// The house goes in the user's home folder, beside anything they already have (ticket 004 Q7: earlier projects untouched).
const ROOT = path.join(os.homedir(), "agentic-pockets");
const record = () => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "house.json"), "utf8")); } catch { return {}; } };

export default function contribute(server: PluginServerContext) {
  server.handle(status, async (_i, { paseo }) => {
    const accounts = await paseo.providers.listAvailable().then((r) => ((r as { providers?: { provider?: string; id?: string; available?: boolean }[] }).providers ?? [])
      .filter((p) => p.available !== false).map((p) => String(p.provider ?? p.id))).catch(() => ["claude"]);
    return { tools: checkTools(exec), extras: listExtras(os.homedir()), root: ROOT, connected: fs.existsSync(path.join(ROOT, ".upstream")),
      packs: packsIn(ROOT), accounts: accounts.length ? accounts : ["claude"], setupDone: record().setupDone === true };
  });
  server.handle(welcomeReadRpc, async () => ({ seen: welcomeSeen(os.homedir()) }));
  server.handle(welcomeDismissRpc, async () => { markWelcomeSeen(os.homedir(), new Date().toISOString()); return { seen: true }; });
  server.handle(tutorialReadRpc, async () => {
    const t = readTutorial(ROOT);
    // A screen cannot read a file path, so the drawing travels as data.
    const image = t.reward?.image ? `data:image/png;base64,${fs.readFileSync(t.reward.image).toString("base64")}` : null;
    return { ...t, items: t.items.map(({ id, title, body, done }) => ({ id, title, body, done })), reward: t.reward ? { ...t.reward, image } : null };
  });
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
  return () => {};
}

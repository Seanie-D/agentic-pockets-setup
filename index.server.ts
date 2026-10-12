import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { connect, install, packsIn } from "./server/setup";
import { applyExtrasOff, checkTools, installTools, listExtras } from "./server/tools";
import { deps, exec } from "./server/real";
import { connectRpc, finishRpc, installRpc, installToolsRpc, status } from "./shared/contracts";

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
  server.handle(installToolsRpc, async () => ({ tools: installTools(exec, process.platform) }));
  server.handle(connectRpc, async ({ code }, { paseo }) => connect({ code, root: ROOT, home: os.homedir() }, deps(paseo)));
  server.handle(installRpc, async ({ userName, citizens, accounts, extrasOff }, { paseo }) => {
    const r = await install({ code: "", userName, citizens, accounts, root: ROOT, home: os.homedir() }, deps(paseo));
    if (!r.ok || !extrasOff.length) return r;
    // Ticket 004 Q8: the extras the user switched off, for this house only; kept in house.json so a pocket added later gets them too.
    const x = applyExtrasOff(ROOT, listExtras(os.homedir()), extrasOff);
    const rec = record(); fs.writeFileSync(path.join(ROOT, "house.json"), JSON.stringify({ ...rec, extrasOff, updatedAt: new Date().toISOString() }, null, 2) + "\n");
    return { ...r, steps: [...r.steps, ...(x.switched.length ? [`Switched off for this house: ${x.switched.map((e) => e.name).join(", ")}.`] : [])] };
  });
  server.handle(finishRpc, async () => {
    const rec = record(); fs.writeFileSync(path.join(ROOT, "house.json"), JSON.stringify({ ...rec, setupDone: true, updatedAt: new Date().toISOString() }, null, 2) + "\n");
    return { ok: true };
  });
  return () => {};
}

// The setup plugin's calls between the screen and the daemon half (ticket 004 Resolution, steps 2–5).
import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const Tool = z.object({ name: z.string(), state: z.enum(["ok", "old", "missing"]), have: z.string().nullable(), need: z.string(), why: z.string() });
const Installed = Tool.extend({ action: z.enum(["kept", "installed", "updated", "not done"]), message: z.string().optional() });
const Extra = z.object({ id: z.string(), kind: z.enum(["hook", "skill", "agent", "command", "plugin", "mcp", "instructions", "paseo"]), name: z.string(), where: z.string(),
  switchable: z.boolean(), file: z.string().optional() });
const Result = z.object({ ok: z.boolean(), message: z.string(), steps: z.array(z.string()) });

export const status = defineRpc({
  name: "setup.status",
  input: z.object({}),
  output: z.object({ tools: z.array(Tool), extras: z.array(Extra), root: z.string(), connected: z.boolean(),
    packs: z.array(z.object({ name: z.string(), hello: z.string() })), accounts: z.array(z.string()), setupDone: z.boolean() }),
});
export const installToolsRpc = defineRpc({ name: "setup.tools.install", input: z.object({}), output: z.object({ tools: z.array(Installed) }) });
export const connectRpc = defineRpc({ name: "setup.connect", input: z.object({ code: z.string().min(8) }), output: Result });
export const installRpc = defineRpc({
  name: "setup.install",
  input: z.object({ userName: z.string().min(1), citizens: z.array(z.string()).min(1), accounts: z.record(z.string(), z.string()),
    extrasOff: z.array(z.string()).default([]) }),
  output: Result.extend({ firstDesk: z.object({ citizen: z.string(), agentId: z.string().nullable() }).optional() }),
});
export const finishRpc = defineRpc({ name: "setup.finish", input: z.object({}), output: z.object({ ok: z.boolean() }) });

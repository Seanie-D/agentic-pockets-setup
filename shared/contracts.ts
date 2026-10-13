// The setup plugin's calls between the screen and the daemon half (ticket 004 Resolution, steps 2–5).
import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { drawingSchema } from "./reward.ts";

const Tool = z.object({ name: z.string(), state: z.enum(["ok", "old", "missing"]), have: z.string().nullable(), need: z.string(), why: z.string() });
const Installed = Tool.extend({ action: z.enum(["kept", "installed", "updated", "not done"]), message: z.string().optional() });
const Extra = z.object({ id: z.string(), kind: z.enum(["hook", "skill", "agent", "command", "plugin", "mcp", "instructions", "paseo"]), name: z.string(), where: z.string(),
  switchable: z.boolean(), file: z.string().optional() });
// running: the step is still at work (shared/job.ts); the screen calls again, and the same job answers.
const Result = z.object({ ok: z.boolean(), message: z.string(), steps: z.array(z.string()), running: z.boolean().optional() });

export const status = defineRpc({
  name: "setup.status",
  input: z.object({}),
  output: z.object({ tools: z.array(Tool), extras: z.array(Extra), root: z.string(), connected: z.boolean(),
    packs: z.array(z.object({ name: z.string(), hello: z.string() })), accounts: z.array(z.string()), setupDone: z.boolean(), mode: z.enum(["on-demand", "always-on"]), cafe: z.boolean() }),
});
export const installToolsRpc = defineRpc({ name: "setup.tools.install", input: z.object({}), output: z.object({ tools: z.array(Installed), running: z.boolean().optional(), failed: z.string().optional() }) });
export const connectRpc = defineRpc({ name: "setup.connect", input: z.object({ code: z.string().min(8) }), output: Result });
export const installRpc = defineRpc({
  name: "setup.install",
  input: z.object({ userName: z.string().min(1), citizens: z.array(z.string()).min(1), accounts: z.record(z.string(), z.string()),
    extrasOff: z.array(z.string()).default([]), cleanProfile: z.boolean().default(false), mode: z.enum(["on-demand", "always-on"]).default("on-demand"), cafe: z.boolean().default(false) }),
  output: Result.extend({ firstDesk: z.object({ citizen: z.string(), agentId: z.string().nullable() }).optional() }),
});
// The welcome take-over (ticket 009): whether this computer has seen it, and marking it seen.
export const welcomeReadRpc = defineRpc({ name: "setup.welcome.read", input: z.object({}), output: z.object({ seen: z.boolean() }) });
export const welcomeDismissRpc = defineRpc({ name: "setup.welcome.dismiss", input: z.object({}), output: z.object({ seen: z.boolean() }) });
// The tutorial (ticket 009): the house's checklist with each item's tick, the percent, the sidebar label, the reward.
export const tutorialReadRpc = defineRpc({ name: "setup.tutorial.read", input: z.object({}), output: z.object({
  items: z.array(z.object({ id: z.string(), title: z.string(), body: z.string(), done: z.object({ at: z.string(), by: z.string() }).nullable(),
    lines: z.array(z.object({ text: z.string() })).optional(), example: z.array(z.object({ from: z.enum(["you", "citizen"]), text: z.string() })).optional() })),
  seen: z.array(z.string()), lead: z.string().nullable(), percent: z.number(), complete: z.boolean(), label: z.string(),
  reward: z.object({ citizen: z.string(), drawing: drawingSchema.nullable() }).nullable() }) });
// A page of the tutorial was opened: its example plays bubble by bubble only the first time.
export const tutorialSeenRpc = defineRpc({ name: "setup.tutorial.seen", input: z.object({ id: z.string() }), output: z.object({ ok: z.boolean() }) });
export const tutorialDiscussRpc = defineRpc({ name: "setup.tutorial.discuss", input: z.object({ itemId: z.string() }),
  output: z.object({ ok: z.boolean(), agentId: z.string().optional(), citizen: z.string().optional(), message: z.string() }) });
export const finishRpc = defineRpc({ name: "setup.finish", input: z.object({}), output: z.object({ ok: z.boolean() }) });
// The clean profile's sign-in (ticket 004): is the house's own Claude folder signed in, and start the browser sign-in.
export const profileStatusRpc = defineRpc({ name: "setup.profile.status", input: z.object({}), output: z.object({ signedIn: z.boolean() }) });
export const profileSignInRpc = defineRpc({ name: "setup.profile.signin", input: z.object({}), output: z.object({ started: z.boolean(), message: z.string() }) });
// The user's own Claude, signed in right after the tools (Sean, 2026-10-13).
export const claudeStatusRpc = defineRpc({ name: "setup.claude.status", input: z.object({}), output: z.object({ signedIn: z.boolean() }) });
export const claudeSignInRpc = defineRpc({ name: "setup.claude.signin", input: z.object({}), output: z.object({ started: z.boolean(), message: z.string() }) });
// How the citizens run, changed after setup (ticket 004 Q11), and "Ask about this" on a setup choice: the lead's desk.
export const modeSetRpc = defineRpc({ name: "setup.mode.set", input: z.object({ mode: z.enum(["on-demand", "always-on"]) }), output: z.object({ ok: z.boolean(), changed: z.array(z.string()), message: z.string().optional() }) });
export const askRpc = defineRpc({ name: "setup.ask", input: z.object({ topic: z.enum(["mode"]) }),
  output: z.object({ ok: z.boolean(), agentId: z.string().optional(), citizen: z.string().optional(), message: z.string() }) });
// Agentic Pockets Help (ticket 009 Q1c): the house's glossary, and "Ask Ultron about this" on a word or a page.
export const helpGlossaryRpc = defineRpc({ name: "setup.help.glossary", input: z.object({}),
  output: z.object({ terms: z.array(z.object({ word: z.string(), meaning: z.string(), not: z.string().optional() })) }) });
export const helpAskRpc = defineRpc({ name: "setup.help.ask", input: z.object({ kind: z.enum(["term", "page"]), id: z.string() }),
  output: z.object({ ok: z.boolean(), agentId: z.string().optional(), citizen: z.string().optional(), message: z.string() }) });

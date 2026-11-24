// The browser half of the "What to ask" check (seam 3, agreed with the owner 2026-11-24 3:59 PM CST): the tab drawn with
// react-native-web in headless Chromium from test data, a real press on "Try it", and a picture. Built and run by
// test/what-to-ask.render.mjs, which reads the lines written into <pre id="result">.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { WhatToAskView } from "../client/what-to-ask";

const light = { surface0: "#ffffff", surface1: "#f4f4f5", surface2: "#e4e4e7", border: "#d4d4d8", foreground: "#18181b", foregroundMuted: "#71717a", accent: "#3b6ef5", accentForeground: "#fff", statusSuccess: "#16a34a" };
const c = light;
const s = {
  h1: { color: c.foreground, fontSize: 26, fontWeight: "600" }, h2: { color: c.foreground, fontSize: 17, fontWeight: "600" },
  p: { color: c.foreground, fontSize: 15, lineHeight: 22 }, muted: { color: c.foregroundMuted, fontSize: 14, lineHeight: 20 },
  good: { color: c.statusSuccess, fontSize: 14 }, quiet: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: c.border },
  quietText: { color: c.foreground, fontSize: 13 }, button: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, backgroundColor: c.accent },
  buttonText: { color: c.accentForeground, fontSize: 14, fontWeight: "600" },
};
const ask = (pocket: string, name: string, title: string, asks: string[]) => ({ pocket, name, title, asks, face: null });
const data = {
  inHouse: [ask("Ultron", "Ultron", "Orchestrator", ["I have a big idea. Help me plan it."]), ask("Friday", "Friday", "Keeps your computers healthy", ["Is my computer healthy today?", "Why is my laptop running slow?"]), ask("Gardener", "Gardener", "", [])],
  canAdd: [ask("Verro", "Verro", "Edits video beside you", ["Make a first cut of this footage."])],
};
const lines: string[] = [];
const g = globalThis as any;
g.__calls = [];
const boxes: string[] = [];
g.__composers = ({ agentId }: { agentId: string }) => [{ setPrompt: (t: string) => boxes.push(`${agentId} prompt ${t}`), focus: async () => { boxes.push(`${agentId} focus`); } }];
g.__fixtures = { "setup.help.asks": () => data, "setup.help.try": ({ pocket }: { pocket: string }) => ({ ok: true, agentId: `${pocket.toLowerCase()}-desk` }) };
const opened: string[] = [];
const navigation = { openAgent: ({ agentId }: { agentId: string }) => opened.push(agentId) };

async function main() {
  const check = (ok: boolean, what: string) => lines.push(`${ok ? "PASS" : "FAIL"} ${what}`);
  const tick = (ms = 200) => new Promise((r) => setTimeout(r, ms));
  const text = () => document.body.textContent ?? "";
  const host = document.createElement("div");
  host.style.cssText = "width: 720px; padding: 24px; font-family: system-ui, sans-serif; background: #fff";
  document.body.style.margin = "0";
  document.body.appendChild(host);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  createRoot(host).render(<QueryClientProvider client={qc}><WhatToAskView s={s as any} theme={{ colors: c } as any} navigation={navigation as any} /></QueryClientProvider>);
  await tick(400);
  check(text().includes("Is my computer healthy today?") && text().includes("I have a big idea. Help me plan it."), "the house's citizens show with their questions");
  check(text().includes("Citizens you can add") && text().includes("Make a first cut of this footage."), "a citizen the house can add shows under Citizens you can add, with its questions");
  check(text().includes("No examples yet. Ask Gardener what it can do for you."), "a citizen the house made itself says it has no examples yet");
  const tries = [...document.querySelectorAll('[role="button"]')].filter((b) => b.textContent?.trim() === "Try it");
  check(tries.length === 3, `Try it on each in-house question, none on a citizen the house can add (found ${tries.length})`);
  if (new URLSearchParams(location.search).has("shot")) return;
  (tries[1] as HTMLElement).click();
  await tick(600);
  check(boxes.join(" | ") === "friday-desk prompt Is my computer healthy today? | friday-desk focus", `Try it fills Friday's message box and brings it up, sending nothing (${boxes.join(" | ")})`);
  check(!g.__calls.some((x: any) => x.name !== "setup.help.asks" && x.name !== "setup.help.try"), "nothing else is called");
  check(text().includes("The question is in Friday's message box."), "the card says where the question went");
  check(opened.length === 0, "the chat is brought up by the message box itself, not opened a second time");
}
main().catch((e) => lines.push(`FAIL the page threw: ${e?.message ?? e}`)).finally(() => {
  if (new URLSearchParams(location.search).has("shot")) return;
  const pre = document.createElement("pre"); pre.id = "result"; pre.textContent = lines.join("\n"); document.body.appendChild(pre);
});

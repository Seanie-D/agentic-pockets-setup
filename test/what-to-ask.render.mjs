#!/usr/bin/env node
// "What to ask" in a real browser: builds test/what-to-ask.page.tsx with the house plugin's render kit (react-native-web,
// its fake plugin client), runs the presses in headless Chromium, and saves the picture beside the task's notes.
//   node test/what-to-ask.render.mjs [picture.png]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const kit = path.resolve(here, "../../../../plugins/agentic-pockets");
const { build } = await import(path.join(kit, "node_modules", "esbuild", "lib", "main.js"));
const out = fs.mkdtempSync(path.join(os.tmpdir(), "what-to-ask-"));
let failed = 0;
try {
  await build({
    entryPoints: [path.join(here, "what-to-ask.page.tsx")], outfile: path.join(out, "page.js"), bundle: true, format: "iife", platform: "browser",
    jsx: "automatic", logLevel: "error", loader: { ".js": "jsx" }, define: { "process.env.NODE_ENV": '"development"', global: "globalThis" },
    alias: { react: path.join(kit, "node_modules", "react"), "react-dom": path.join(kit, "node_modules", "react-dom"), "react-native": path.join(kit, "node_modules", "react-native-web"),
      "@tanstack/react-query": path.join(kit, "node_modules", "@tanstack", "react-query"), "@getpaseo/plugin/client": path.join(kit, "test", "fake-client.tsx") },
  });
  fs.writeFileSync(path.join(out, "page.html"), '<!doctype html><html><body><script src="page.js"></script></body></html>');
  const pw = path.join(os.homedir(), ".cache", "ms-playwright");
  const chrome = (fs.existsSync(pw) ? fs.readdirSync(pw) : []).filter((d) => d.startsWith("chromium_headless_shell-")).sort()
    .map((d) => path.join(pw, d, "chrome-headless-shell-linux64", "chrome-headless-shell")).filter((f) => fs.existsSync(f)).pop();
  if (!chrome) throw new Error("no headless Chromium (npx playwright install chromium-headless-shell)");
  const dom = execFileSync(chrome, ["--no-sandbox", "--disable-gpu", "--virtual-time-budget=20000", "--dump-dom", `file://${path.join(out, "page.html")}`], { encoding: "utf8", timeout: 90_000, stdio: ["ignore", "pipe", "ignore"] });
  const result = dom.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'") ?? "FAIL the page wrote no result";
  for (const line of result.split("\n").filter(Boolean)) { console.log(line); if (!line.startsWith("PASS")) failed++; }
  const shot = process.argv[2];
  if (shot) execFileSync(chrome, ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=5000", "--window-size=770,900", `--screenshot=${path.resolve(shot)}`, `file://${path.join(out, "page.html")}?shot`], { stdio: "ignore", timeout: 90_000 });
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}
console.log(failed ? `RENDER: FAIL (${failed})` : "RENDER: PASS");
process.exitCode = failed ? 1 : 0;

// What a clean install from Git needs (Friday's walk, 2026-10-12 19:14Z: "Build failed … unable to resolve a type
// dependency"). Paseo builds a Git source with no node_modules, so server code may import only Node's own modules,
// Paseo's plugin SDK, and its own files; and Paseo refuses an RPC name that is not lowercase words joined by dots.
//   node --test test/install.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as contracts from "../shared/contracts.ts";

const here = path.dirname(new URL(import.meta.url).pathname);
const files = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []);

test("every RPC name is lowercase words joined by dots, as Paseo requires", () => {
  const names = Object.values<any>(contracts).filter((c) => typeof c?.name === "string").map((c) => c.name);
  assert.ok(names.length >= 5);
  for (const n of names) assert.match(n, /^[a-z]+(\.[a-z]+)+$/, n);
});

test("server code imports only Node, Paseo's plugin SDK, its declared dependencies and its own files; an optional import must fail soft", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(here, "..", "package.json"), "utf8"));
  const declared = Object.keys(pkg.dependencies ?? {});
  const root = path.join(here, "..");
  for (const f of [path.join(root, "index.server.ts"), ...files(path.join(root, "server")), ...files(path.join(root, "shared"))]) {
    for (const line of fs.readFileSync(f, "utf8").split("\n")) for (const m of line.matchAll(/\bfrom\s+"([^"]+)"|\bimport\(\s*"([^"]+)"/g)) {
      const spec = m[1] ?? m[2];
      if (m[2] && line.includes(".catch(")) continue;   // an optional import that fails soft (the faces) is allowed
      const ok = spec.startsWith(".") || spec.startsWith("node:") || spec.startsWith("@getpaseo/plugin") || spec === "zod" || declared.some((d) => spec === d || spec.startsWith(`${d}/`));
      assert.ok(ok, `${path.relative(root, f)} imports "${spec}", which a clean install does not have`);
    }
  }
});

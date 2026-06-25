#!/usr/bin/env -S pnpm tsx
// TODO: implement watching
import react from "@vitejs/plugin-react";
import { globSync } from "glob";
import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { build } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import vitePluginVfsImport from "./vite-plugin-vfs-import.ts";

const execFileAsync = promisify(execFile);

const entries = Object.fromEntries(
  globSync("src/apps/*").map(f => [
    f.replace("src/apps/", ""),
    resolve(import.meta.dirname, f),
  ]),
);
const input = Object.entries(entries).map(x => `${x[1]}/${x[0]}.tsx`);

const outDir = resolve(import.meta.dirname, "dist/apps");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const builds = input.map(file =>
  build({
    plugins: [
      react(),
      cssInjectedByJsPlugin(),
      vitePluginVfsImport(),
    ],
    resolve: {
      alias: {
        "react/jsx-runtime": resolve(import.meta.dirname, "app-shims/jsx-runtime-shim.ts"),
        "react": resolve(import.meta.dirname, "app-shims/react-shim.ts"),
      },
    },
    build: {
      outDir,
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
      lib: { entry: file, formats: ["es"] },
      minify: true,
      rolldownOptions: {
        input: file,
        output: { entryFileNames: "[name].js", codeSplitting: false },
        platform: "browser",
      },
      emptyOutDir: false, // already cleared above
      target: ["chrome103", "edge146", "firefox140", "opera127", "safari18.5"],
      sourcemap: true,
      reportCompressedSize: false,
    },
    configFile: false,
  })
);

await Promise.all(builds);

const outputFiles = globSync(`${outDir}/**/*`, { nodir: true })
  .filter(f => !f.endsWith(".gz"));

await Promise.all(
  outputFiles.map(f => execFileAsync("gzip", [f])), // gzip deletes the original by default
);

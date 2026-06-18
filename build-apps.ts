#!/usr/bin/env -S pnpm tsx

// TODO: implement watching
import react from "@vitejs/plugin-react";
import { globSync } from "glob";
import { resolve } from "node:path";
import { build } from "vite";
import viteCompression from "vite-plugin-compression";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

const entries = Object.fromEntries(
  globSync("src/apps/*").map(f => [
    f.replace("src/apps/", ""),
    resolve(import.meta.dirname, f),
  ]),
);

const input = Object.entries(entries).map(x => `${x[1]}/${x[0]}.tsx`);

for (const file of input) {
  const first = file === input[0];
  const promise = build({
    plugins: [
      react(),
      cssInjectedByJsPlugin(),
      viteCompression({ deleteOriginFile: true, threshold: 0, filter: (file) => !file.endsWith(".gz") }),
    ],
    resolve: {
      alias: {
        "react/jsx-runtime": resolve(import.meta.dirname, "app-shims/jsx-runtime-shim.ts"),
        "react": resolve(import.meta.dirname, "app-shims/react-shim.ts"),
      },
    },
    build: {
      outDir: "dist/apps/",
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
      lib: { entry: file, formats: ["es"] },
      minify: true,
      rolldownOptions: {
        input: file,
        output: { entryFileNames: "[name].js" },
        platform: "browser",
      },
      emptyOutDir: first,
      target: ["chrome103", "edge146", "firefox140", "opera127", "safari18.5"],
      sourcemap: true,
    },
    configFile: false,
  });
  if (first) await promise;
}

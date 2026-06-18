#!/usr/bin/env -S pnpm tsx

// TODO: implement watching
import react from "@vitejs/plugin-react";
import { globSync } from "glob";
import { resolve } from "node:path";
import { build } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

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
    plugins: [react(), viteSingleFile()],
    resolve: {
      alias: {
        "react/jsx-runtime": resolve(import.meta.dirname, "app-shims/jsx-runtime-shim.ts"),
        "react": resolve(import.meta.dirname, "app-shims/react-shim.ts"),
      },
    },
    build: {
      outDir: "dist/apps/",
      lib: { entry: file, formats: ["es"] },
      cssCodeSplit: false,
      rolldownOptions: { input: file, output: { entryFileNames: "[name].js" } },
      emptyOutDir: first,
    },
  });
  if (first) await promise;
}

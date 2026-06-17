#!/usr/bin/env -S pnpm tsx

import react from "@vitejs/plugin-react";
import { globSync } from "glob";
import { resolve } from "node:path";
import { build } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const entries = Object.fromEntries(
  globSync("src/extra-apps/*").map(f => [
    f.replace("src/extra-apps/", ""),
    resolve(import.meta.dirname, f),
  ]),
);

const input = Object.entries(entries).map(x => `${x[1]}/${x[0]}.tsx`);
console.log(input);

for (const file of input) {
  build({
    plugins: [react(), viteSingleFile()],
    resolve: {
      alias: {
        "react/jsx-runtime": resolve(import.meta.dirname, "extra-app-shims/jsx-runtime-shim.ts"),
        "react": resolve(import.meta.dirname, "extra-app-shims/react-shim.ts"),
      },
    },
    build: {
      outDir: "dist/extra-apps/",
      lib: { entry: file, formats: ["es"] },
      cssCodeSplit: false,
      rolldownOptions: { input: file, output: { entryFileNames: "[name].js" } },
    },
  });
}

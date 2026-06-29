#!/usr/bin/env -S pnpm tsx
// TODO: watching
import react from "@vitejs/plugin-react";
import { zipSync } from "fflate";
import { globSync } from "glob";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import vitePluginVfsImport from "./vite-plugin-vfs-import.ts";

const outDir = resolve(import.meta.dirname, "dist/packages");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const packages = globSync("src/packages/*").map(f => {
  const name = f.replace("src/packages/", "");
  const dir = resolve(import.meta.dirname, f);
  return {
    name,
    dir,
    hasApp: existsSync(`${dir}/${name}.tsx`),
    hasService: existsSync(`${dir}/service.ts`),
  };
});

const appBuilds = packages
  .filter(p => p.hasApp)
  .map(({ name, dir }) =>
    build({
      plugins: [react(), cssInjectedByJsPlugin(), vitePluginVfsImport()],
      resolve: {
        alias: {
          "react/jsx-runtime": resolve(import.meta.dirname, "app-shims/jsx-runtime-shim.ts"),
          "react": resolve(import.meta.dirname, "app-shims/react-shim.ts"),
        },
      },
      build: {
        outDir: resolve(outDir, name),
        assetsInlineLimit: 100_000_000,
        cssCodeSplit: false,
        lib: { entry: `${dir}/${name}.tsx`, formats: ["es"] },
        minify: true,
        rolldownOptions: {
          input: `${dir}/${name}.tsx`,
          output: { entryFileNames: "[name].js", codeSplitting: false },
          platform: "browser",
        },
        emptyOutDir: false,
        target: ["chrome103", "edge146", "firefox140", "opera127", "safari18.5"],
        sourcemap: "inline",
        reportCompressedSize: false,
      },
      configFile: false,
    })
  );

const serviceBuilds = packages
  .filter(p => p.hasService)
  .map(({ name, dir }) =>
    build({
      plugins: [vitePluginVfsImport()],
      build: {
        outDir: resolve(outDir, name),
        lib: { entry: `${dir}/service.ts`, formats: ["es"] },
        minify: true,
        rolldownOptions: {
          input: `${dir}/service.ts`,
          output: { entryFileNames: "service.js", codeSplitting: false },
          platform: "browser",
        },
        emptyOutDir: false,
        target: ["chrome103", "edge146", "firefox140", "opera127", "safari18.5"],
        sourcemap: "inline",
        reportCompressedSize: false,
      },
      configFile: false,
    })
  );

await Promise.all([...appBuilds, ...serviceBuilds]);

await Promise.all(
  packages.map(async ({ name }) => {
    const pkgDir = resolve(outDir, name);
    const files = globSync(`${pkgDir}/**/*`, { nodir: true });
    if (files.length === 0) return;

    const entries: Record<string, Uint8Array> = Object.fromEntries(
      await Promise.all(
        files.map(async f => [f.slice(pkgDir.length + 1), [await readFile(f), { mtime: new Date("1980-01-01") }]]),
      ),
    );

    await writeFile(resolve(outDir, `${name}.zip`), zipSync(entries));
    await rm(pkgDir, { recursive: true });
  }),
);

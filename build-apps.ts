#!/usr/bin/env -S pnpm tsx
// TODO: watching
// TODO: run package builds in batches of cpu cores
import react from "@vitejs/plugin-react";
import { zipSync } from "fflate";
import { globSync } from "glob";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { build } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import vitePluginVfsImport from "./vite-plugin-vfs-import.ts";
const outDir = resolve(import.meta.dirname, "dist/packages");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const packages = [...globSync("src/packages/*"), ...globSync("src/private-packages/*")].map(f => {
  const name = f.replace(/src\/(private\-)?packages\//, "");
  const dir = resolve(import.meta.dirname, f);
  const icons = globSync(`${dir}/icon.*`);
  if (icons.length > 1) throw `More than one icon in app ${dir}`;

  return {
    name,
    dir,
    hasApp: existsSync(`${dir}/${name}.tsx`),
    hasService: existsSync(`${dir}/service.ts`),
    icon: icons[0],
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
        assetsInlineLimit: Number.MAX_SAFE_INTEGER,
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
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
        process: JSON.stringify({ env: {} }),
      },
      mode: "production",
    })
  );

const serviceBuilds = packages
  .filter(p => p.hasService)
  .map(({ name, dir }) =>
    build({
      plugins: [vitePluginVfsImport()],
      resolve: {
        alias: {
          "react/jsx-runtime": resolve(import.meta.dirname, "app-shims/jsx-runtime-shim.ts"),
          "react": resolve(import.meta.dirname, "app-shims/react-shim.ts"),
        },
      },
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
      mode: "production",
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
        process: JSON.stringify({ env: {} }),
      },
    })
  );

await Promise.all([...appBuilds, ...serviceBuilds]);

await Promise.all(
  packages.map(async ({ name, icon }) => {
    const pkgDir = resolve(outDir, name);

    if (icon) {
      await mkdir(pkgDir, { recursive: true });
      await copyFile(icon, resolve(pkgDir, `icon${extname(icon)}`));
    }

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

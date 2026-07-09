#!/usr/bin/env -S pnpm tsx
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { build } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import vitePluginPackDir from "./vite-plugin-packdir.ts";
import vitePluginVfsImport from "./vite-plugin-vfs-import.ts";

await import("./build-apps.ts");

execSync("rm -rf ./dist/full-vendor/");
execSync("cp -r ./src/vendor/ ./dist/full-vendor/");
execSync("cp -r ./dist/packages/ ./dist/full-vendor/bundled-packages");

await build({
  plugins: [
    react(),
    viteSingleFile(),
    vitePluginPackDir("vendor:vendor.zip", "./dist/full-vendor"),
    vitePluginVfsImport(),
  ],
  server: {
    host: "127.0.0.1",
  },
  build: {
    target: ["chrome103", "edge146", "firefox140", "opera127", "safari18.5"],
    assetsInlineLimit: Number.MAX_SAFE_INTEGER, // inline everything, including fonts/images
    cssCodeSplit: false,
    minify: true,
    rolldownOptions: { output: { dir: "dist/full" } },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    process: JSON.stringify({ env: {} }),
  },
  mode: "production",
  configFile: false,
});

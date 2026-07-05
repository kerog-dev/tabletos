import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import vitePluginPackDir from "./vite-plugin-packdir.ts";
import vitePluginVfsImport from "./vite-plugin-vfs-import.ts";

export default defineConfig(({ mode }) => ({
  plugins: [react(), viteSingleFile(), vitePluginPackDir("vendor:vendor.zip", "./src/vendor"), vitePluginVfsImport()],
  server: {
    host: "127.0.0.1",
  },
  build: {
    target: ["chrome103", "edge146", "firefox140", "opera127", "safari18.5"],
    assetsInlineLimit: 100_000_000, // inline everything, including fonts/images
    cssCodeSplit: false,
    minify: true,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode),
    process: JSON.stringify({ env: {} }),
  },
}));

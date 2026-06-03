import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const commitHash = execSync("git rev-parse --short HEAD").toString().trim();

export default defineConfig({
  plugins: [react(), viteSingleFile()],
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
    __COMMIT_HASH__: `"${commitHash}"`,
  },
});

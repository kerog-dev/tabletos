import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/_relay_": { target: "ws://192.168.1.31:8085", ws: true },
    },
  },
  build: {
    target: ["chrome103", "edge146", "firefox140", "opera127", "safari18.5"],
    assetsInlineLimit: 100_000_000, // inline everything, including fonts/images
    cssCodeSplit: false,
    minify: true,
  },
});

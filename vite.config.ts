import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: [
      "chrome103",
      "edge146",
      "firefox140",
      "ios11",
      "opera127",
      "safari18.5",
    ],
    assetsInlineLimit: 100_000_000, // inline everything, including fonts/images
    cssCodeSplit: false,
    minify: true,
  },
});

import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import fs from "fs";
import path from "path";

// Read the generated manifest.json (created by prepare-manifest.js in dist/)
const manifestPath = path.resolve(process.cwd(), "dist/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: "chrome138",
    minify: false,
  },
});

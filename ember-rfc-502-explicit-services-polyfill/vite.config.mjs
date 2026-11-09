import { defineConfig } from "vite";
import { ember } from "@nullvoxpopuli/ember-vite";

export default defineConfig({
  build: { outDir: "dist-tests" },
  plugins: [ember({ babel: { configFile: "./config/test/babel.config.js" } })],
});

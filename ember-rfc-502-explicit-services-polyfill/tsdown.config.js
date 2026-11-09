import { defineConfig } from "tsdown";
import { ember } from "@nullvoxpopuli/ember-rolldown";

export default defineConfig({
  entry: ["./src/index.ts", "./src/owner.ts"],
  plugins: [ember()],
  publint: true,
  tsconfig: "./config/tsconfig.publish.json",
});

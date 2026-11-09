import { defineConfig } from "vite";
import { ember } from "@nullvoxpopuli/ember-vite";

export default defineConfig({
  plugins: [
    ember({
      babel: {
        include: {
          whenImporting: [
            "@ember/service",
            "@ember/application",
            "@ember/owner",
            "ember-qunit",
            "@ember/test-helpers",
          ],
        },
      },
    }),
  ],
});

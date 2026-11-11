import { defineConfig } from "vite";
import { ember } from "@nullvoxpopuli/ember-vite";

export default defineConfig({
  plugins: [
    ember({
      babel: {
        include: {
          whenImporting: ["@ember/service", "ember-rfc-502-explicit-services-polyfill"],
          whenMatching: [/\.(lookup|register|unregister|hasRegistration)\(/],
        },
      },
    }),
  ],
});

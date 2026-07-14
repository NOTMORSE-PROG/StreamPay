/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { metaCsp } from "./src/lib/csp.ts";

// Inject the Content-Security-Policy meta tag into the PRODUCTION index.html
// only (T-038). Dev must stay untouched: @vitejs/plugin-react injects an
// inline react-refresh preamble script that script-src 'self' would block.
// frame-ancestors rides the vercel.json header instead (a meta CSP ignores it
// by spec). The policy itself lives in src/lib/csp.ts, unit-tested there.
function cspMetaTag(): Plugin {
  return {
    name: "streampay-csp-meta",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: metaCsp(),
          },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cspMetaTag()],
  test: {
    // jsdom for component tests; globals stay off so the strict tsconfig needs no
    // extra ambient types (tests import describe/it/expect from "vitest").
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
  },
});

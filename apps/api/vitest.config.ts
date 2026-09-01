import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/index.ts",
      miniflare: {
        compatibilityDate: "2026-08-27",
        compatibilityFlags: ["nodejs_compat"],
        bindings: {
          AUTH_SECRET: "test-secret-that-is-long-enough-for-hs256",
          ENVIRONMENT: "test",
          GOOGLE_WEB_CLIENT_ID: "test.apps.googleusercontent.com",
          EXPO_PUSH_ENDPOINT: "https://exp.host/--/api/v2/push/send",
        },
      },
    }),
  ],
  test: {
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ["pg"],
          rolldownOptions: {
            external: [
              "crypto",
              "dns",
              "events",
              "fs",
              "net",
              "path",
              "stream",
              "string_decoder",
              "tls",
              "util",
              "util/types",
            ],
          },
        },
      },
    },
  },
});

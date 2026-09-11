import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    // Proxy API calls to the Go backend during local dev.
    proxy: {
      "/api":
        loadEnv(mode, ".", "BEHOLDR_DEV_").BEHOLDR_DEV_API_URL ??
        "http://127.0.0.1:8000",
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
}));

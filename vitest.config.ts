import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    globals: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "app",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
          globals: true,
        },
      },
      {
        test: {
          name: "build-win",
          environment: "node",
          include: ["scripts/build-win/**/*.test.mjs"],
          globals: true,
        },
      },
    ],
  },
});

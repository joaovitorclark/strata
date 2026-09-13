import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function resolveApiPort(): number {
  if (process.env.API_PORT) return Number(process.env.API_PORT);
  const metaPath = path.resolve(".localdrawdb-dev.json");
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
        apiPort?: number;
        instances?: Array<{ slug: string | null; apiPort: number; webPort: number }>;
      };
      if (meta.instances && meta.instances.length > 0 && meta.instances[0].apiPort) {
        return meta.instances[0].apiPort;
      }
      if (meta.apiPort) return meta.apiPort;
    } catch {
      /* fallback */
    }
  }
  return Number(process.env.PORT ?? 5174);
}

const apiPort = resolveApiPort();

// Dev: Vite (8080) proxies /api → Fastify on the same clone (API_PORT / PORT).
// Production: Fastify serves dist/ and the API on one port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT ?? 8080),
    strictPort: true,
    proxy: {
      "/api": `http://127.0.0.1:${apiPort}`,
    },
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});

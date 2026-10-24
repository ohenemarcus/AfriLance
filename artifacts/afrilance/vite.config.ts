import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT ?? "5173");
const basePath = process.env.BASE_PATH ?? "/";
const apiPort = process.env.API_PORT ?? "8080";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    https: false,
    origin: `http://localhost:${port}`,
    allowedHosts: true,
    fs: { strict: true },
    proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

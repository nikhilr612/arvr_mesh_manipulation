import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    target: "esnext",
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
  },
  esbuild: {
    target: "esnext",
  },
  optimizeDeps: {
    include: ["three", "three/webgpu", "three/tsl"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === "development"),
  },
});

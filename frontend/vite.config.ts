import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/recharts")) {
            return "charts";
          }

          if (id.includes("node_modules/monaco-editor")) {
            return "editor-monaco";
          }

          if (
            id.includes("node_modules/monaco-yaml") ||
            id.includes("node_modules/yaml") ||
            id.includes("node_modules/jsonc-parser") ||
            id.includes("node_modules/monaco-languageserver-types") ||
            id.includes("node_modules/monaco-marker-data-provider") ||
            id.includes("node_modules/monaco-worker-manager") ||
            id.includes("node_modules/vscode-jsonrpc") ||
            id.includes("node_modules/vscode-languageserver-protocol") ||
            id.includes("node_modules/vscode-languageserver-textdocument") ||
            id.includes("node_modules/vscode-languageserver-types") ||
            id.includes("node_modules/vscode-uri") ||
            id.includes("node_modules/path-browserify") ||
            id.includes("node_modules/prettier")
          ) {
            return "editor-yaml";
          }

          if (id.includes("node_modules/@monaco-editor/react")) {
            return "editor-react";
          }

          return undefined;
        },
      },
    },
  },
}));

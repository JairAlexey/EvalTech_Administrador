import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["src/setupTests.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/services/**", "src/contexts/**"],
      exclude: ["**/__tests__/**", "**/*.d.ts"],
    },
  },
  define: {
    "import.meta.env": {
      VITE_API_URL: "http://localhost:8000",
    },
  },
});

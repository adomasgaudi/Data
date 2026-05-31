import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // Inline JS/CSS/data into a single dist/index.html that opens with no server.
  plugins: [viteSingleFile()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

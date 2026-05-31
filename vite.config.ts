import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // Inline JS/CSS/data into a single dist/index.html that opens with no server.
  plugins: [viteSingleFile()],
  // Expose the dev server on the local network so a phone on the same Wi-Fi can
  // open it. `host: true` binds every interface and prints the current Network
  // URL on each `npm run dev`, so it keeps working when the Wi-Fi/IP changes.
  server: {
    host: true,
    port: 5173,
    // HMR off: don't auto-reload the phone while editing. Refresh manually to see changes.
    hmr: false,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

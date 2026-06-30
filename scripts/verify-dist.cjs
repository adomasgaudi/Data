#!/usr/bin/env node
/** Fail CI when dist/index.html is not a real single-file production build. */
const fs = require("fs");
const path = "dist/index.html";
if (!fs.existsSync(path)) {
  console.error("missing dist/index.html — run npm run build");
  process.exit(1);
}
const html = fs.readFileSync(path, "utf8");
const size = Buffer.byteLength(html);
if (size < 500_000) {
  console.error(`dist/index.html too small (${size} bytes) — expected inlined single-file build`);
  process.exit(1);
}
if (html.includes('href="/src/styles.css"') || html.includes('src="/src/main.ts"')) {
  console.error("dist/index.html still references dev /src/ paths");
  process.exit(1);
}
console.log(`OK: dist/index.html ${(size / 1e6).toFixed(2)} MB`);

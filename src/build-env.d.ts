// Ambient declarations for the few build-time Node bits we touch — the project has
// no @types/node (tsconfig `types` is locked to vite/client), so rather than pull in
// the whole package we type just what vite.config.ts uses, plus the build-time
// constant vite `define` injects.

/** The build branch, baked in by vite.config's `define` (e.g. "opus-4.8"). */
declare const __BUILD_BRANCH__: string;

declare const process: { env: Record<string, string | undefined> };

declare module "node:child_process" {
  export function execSync(command: string): { toString(): string };
}

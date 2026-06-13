/**
 * The MODEL working a branch, shown next to the title version. Each model has its
 * own deploy branch (opus-4.8, sonnet-4.6, haiku-4.5, fable-5.0); this turns that
 * branch name into a clean display label. Non-model branches (main, claude/*) get
 * "" so the tag stays hidden there.
 */
export function modelLabelFor(branch: string): string {
  const m = branch.toLowerCase().match(/\b(opus|sonnet|haiku|fable)[-/_ ]?v?(\d+(?:\.\d+)?)/);
  if (!m) return "";
  const name = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1);
  return `${name} ${m[2]}`;
}

/**
 * HTML-safety helper, extracted from main.ts so it can be unit-tested in
 * isolation. main.ts builds the whole UI from template strings, so any text that
 * could contain an exercise/athlete name or a note must flow through escapeHtml
 * before interpolation.
 */

/** Escape the five HTML-significant characters so user text is safe to interpolate. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

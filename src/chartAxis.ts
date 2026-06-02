/**
 * Time-axis gridline maths, kept pure (no DOM / Chart.js) so it can be unit
 * tested. The charts use a numeric (linear, milliseconds) x-axis rather than a
 * date scale — no date-adapter dependency — and draw their own calendar-anchored
 * vertical gridlines from these timestamps.
 */

export const MS_DAY = 86_400_000;

/**
 * Calendar-anchored vertical-gridline timestamps spanning [min, max], with the
 * granularity chosen by how wide the range is so the line count stays sensible:
 *   • ≤ ~16 weeks  → Mondays
 *   • ≤ ~3 years   → the 1st of each month
 *   • otherwise    → Jan 1 of each year
 *
 * Everything is in UTC to match the ISO date keys. Because the lines sit on real
 * calendar boundaries (not arbitrary axis positions), recomputing them from the
 * live visible range every frame is stable — they never jitter while panning,
 * they just slide with the data and get denser/sparser as you zoom.
 */
export function calendarGridlines(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const span = max - min;
  const out: number[] = [];
  const d = new Date(min);

  if (span <= 16 * 7 * MS_DAY) {
    // Weekly: the first Monday at or after `min`, then every 7 days.
    const day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const dow = new Date(day0).getUTCDay(); // 0=Sun..6=Sat
    const toMonday = (8 - (dow === 0 ? 7 : dow)) % 7;
    for (let t = day0 + toMonday * MS_DAY; t <= max; t += 7 * MS_DAY) out.push(t);
  } else if (span <= 3 * 365 * MS_DAY) {
    // Monthly: the 1st at or after `min`, then each following month's 1st.
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    if (t < min) t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    while (t <= max) {
      out.push(t);
      const n = new Date(t);
      t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1);
    }
  } else {
    // Yearly: Jan 1 at or after `min`, then each following Jan 1.
    let y = d.getUTCFullYear();
    if (Date.UTC(y, 0, 1) < min) y++;
    for (let t = Date.UTC(y, 0, 1); t <= max; y++, t = Date.UTC(y, 0, 1)) out.push(t);
  }
  return out;
}

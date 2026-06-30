/**
 * Pure display + date formatting helpers, extracted from main.ts so they can be
 * unit-tested in isolation (no DOM, no app state). Every kg/volume/1RM number,
 * percentage, bodyweight-multiple, and date label in the UI flows through here so
 * the whole app reads consistently.
 */

/** Display a number at no more than 3 significant figures: 2 by default, but 3
 * when the leading digit is 1–3 (those read wrong with only 2). */
export const fmt = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  const lead = Math.floor(abs / 10 ** Math.floor(Math.log10(abs))); // first significant digit, 1–9
  const sf = lead <= 3 ? 3 : 2;
  return Number(n.toPrecision(sf)).toLocaleString();
};

/** A 0..1 fraction as a whole-number percent, e.g. 0.6 → "60%". One place so
 * every percentage (coefficients, percentile, body fat, training mix) reads the
 * same way across the app. */
export const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`;

/** A bodyweight-multiple, always 2 dp, e.g. "1.25 BW". Single source so the
 * leaderboard, per-athlete detail and Test tab agree. */
export const bwMult = (ratio: number): string => `${ratio.toFixed(2)} BW`;

/** Weight with reps as a superscript, e.g. 100⁵. Unit (kg) lives in the header.
 * When there's no (added) weight — bodyweight reps, holds — show "0" as the base
 * (owner: always write 0 when no weight was added), with the reps as the superscript.
 * Truly empty (no weight AND no reps) stays "—". Negative (assisted) weights keep theirs. */
export const wr = (weight: number | null, reps: number | null): string =>
  weight === null || weight === 0
    ? (reps === null ? "—" : `0<sup>${reps}</sup>`)
    : `${fmt(weight)}${reps === null ? "" : `<sup>${reps}</sup>`}`;

/** "2026-05-02" -> "May 2" (abbreviated month + day without leading zero). */
export const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export const shortDate = (iso: string): string => {
  const [, m, d] = iso.split("-");
  const mon = MONTH_ABBR[Number(m) - 1];
  return mon && d ? `${mon} ${Number(d)}` : iso;
};

/** One/two-letter weekday for an ISO day: M T W Th F Sa Su (UTC, to match keys). */
export const DOW_ABBR = ["Su", "M", "T", "W", "Th", "F", "Sa"]; // index = getUTCDay()
export const dowLetter = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "" : (DOW_ABBR[new Date(t).getUTCDay()] ?? "");
};

/** Full weekday name for an ISO day (UTC). index = getUTCDay(). */
export const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Monday-start week index (whole weeks since the epoch's Monday) for an ISO date, so
 * two dates in the SAME Mon–Sun week share an index. 1970-01-01 was a Thursday; +3
 * shifts so a Monday starts each block. null on an unparseable date. */
const mondayWeekIndex = (iso: string): number | null => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const days = Math.floor(t / 86_400_000); // whole UTC days since epoch (Thursday)
  return Math.floor((days + 3) / 7);
};
/** A friendly day label relative to `today` (both "YYYY-MM-DD"): today → "Today"; any
 * OTHER day in this Mon–Sun week → its full weekday ("Monday"…); a day in LAST week →
 * "Last Monday"…; anything older falls back to the compact "T Jun 2" form. Pure. */
export const relativeDayLabel = (iso: string, today: string): string => {
  if (iso === today) return "Today";
  const wi = mondayWeekIndex(iso), tw = mondayWeekIndex(today);
  const t = Date.parse(iso);
  if (wi !== null && tw !== null && !Number.isNaN(t)) {
    const wd = WEEKDAY_FULL[new Date(t).getUTCDay()] ?? "";
    if (wd) {
      if (wi === tw) return wd; // this week
      if (wi === tw - 1) return `Last ${wd}`; // last week
    }
  }
  return `${dowLetter(iso)} ${shortDate(iso)}`; // older — compact "T Jun 2"
};

/** The workout-day header split into parts for the history list (owner request): a big
 * relative phrase (`Today` / `Monday` / `Last Thursday` / else the plain weekday for
 * older days), the smaller month-day (`May 12`), and the full `year` (shown only when the
 * day is expanded). Both args are "YYYY-MM-DD". Pure. */
export const dayHeaderParts = (iso: string, today: string): { rel: string; md: string; year: string } => {
  const t = Date.parse(iso);
  const weekday = Number.isNaN(t) ? "" : (WEEKDAY_FULL[new Date(t).getUTCDay()] ?? "");
  let rel: string;
  if (iso === today) rel = "Today";
  else {
    const wi = mondayWeekIndex(iso), tw = mondayWeekIndex(today);
    rel = wi !== null && tw !== null && wi === tw - 1 ? `Last ${weekday}` : weekday; // last week → "Last X", else weekday
  }
  const mon = MONTH_ABBR[Number(iso.slice(5, 7)) - 1] ?? "";
  return { rel, md: `${mon} ${Number(iso.slice(8, 10))}`, year: iso.slice(0, 4) };
};

/**
 * ISO-8601 week number (1–53) for a "YYYY-MM-DD" date: weeks start Monday and
 * week 1 is the one containing the year's first Thursday. Matches the app's
 * Monday-start weeks, so an exercise's weekly rows can be labelled "Week 15"
 * instead of a date. Returns 0 only on an unparseable input.
 */
export const isoWeekNumber = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return 0;
  // Shift to the Thursday of this week, then count weeks from Jan 1.
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - day + 3); // move to Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
};

/** Today as an ISO YYYY-MM-DD string — the reference point for "this week" and
 * the trailing-window sets-per-week averages. */
export const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** Elapsed training time from first to last logged date, in the unit that reads
 * cleanest at that scale: days under 2 weeks, weeks under ~2 months, months
 * under 2 years, otherwise years. */
export const trainingDuration = (firstIso: string, lastIso: string): string => {
  const days = Math.max(0, Math.round((Date.parse(lastIso) - Date.parse(firstIso)) / 86_400_000));
  const unit = (n: number, u: string) => `${n} ${u}${n === 1 ? "" : "s"}`;
  if (days < 14) return unit(days, "day");
  if (days < 60) return unit(Math.round(days / 7), "week");
  if (days < 730) return unit(Math.round(days / 30.44), "month");
  return `${(days / 365.25).toFixed(1)} years`;
};

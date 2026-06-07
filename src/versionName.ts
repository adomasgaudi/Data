/**
 * Version CODE-NAMES (owner's scheme — Bleach zanpakutō).
 *
 * The internal version string stays `b.MAJOR.MINOR.PATCH` (the single source of
 * truth for SP totals and the changelog tree). This layer only decides WHAT THE
 * VERSION IS CALLED ON SCREEN — it never changes the numbers themselves.
 *
 * Rules:
 *  - The MINOR (the digit after the major — owner-bumped only) is shown as a
 *    code-name, NOT a number.
 *  - MAJOR 2 → Espada zanpakutō (resurrección) names, in REVERSE Espada rank:
 *    minor 0 = the 9th (weakest) Espada, climbing up… EXCEPT the final minor (9),
 *    which is AIZEN's Kyōka Suigetsu — the mastermind above the Espada, the v2
 *    finale before the captains take over.
 *  - MAJOR 3 → Gotei-13 captain zanpakutō, reverse squad order (minor 0 = squad 13).
 *  - The PATCH (the 3rd digit — the ONLY one AIs bump, plus the optional 4th tweak
 *    digit) shows as "v.N".
 */

/** MAJOR 2 minors → Espada zanpakutō, reverse rank; minor 9 = Aizen (the finale). */
export const ESPADA_NAMES: readonly string[] = [
  "Glotonería", //     minor 0 · Espada 9 — Aaroniero
  "Fornicarás", //     minor 1 · Espada 8 — Szayelaporro
  "Brujería", //       minor 2 · Espada 7 — Zommari
  "Pantera", //        minor 3 · Espada 6 — Grimmjow
  "Santa Teresa", //   minor 4 · Espada 5 — Nnoitra
  "Murciélago", //     minor 5 · Espada 4 — Ulquiorra
  "Tiburón", //        minor 6 · Espada 3 — Harribel
  "Arrogante", //      minor 7 · Espada 2 — Baraggan
  "Los Lobos", //      minor 8 · Espada 1 — Starrk
  "Kyōka Suigetsu", // minor 9 · AIZEN — above the Espada, the v2 finale
];

/** MAJOR 3 minors → Gotei-13 captain zanpakutō, reverse squad order (13 → 1). */
export const CAPTAIN_NAMES: readonly string[] = [
  "Sōgyo no Kotowari", // minor 0 · squad 13 — Ukitake
  "Ashisogi Jizō", //     minor 1 · squad 12 — Kurotsuchi
  "Nozarashi", //         minor 2 · squad 11 — Kenpachi
  "Hyōrinmaru", //        minor 3 · squad 10 — Hitsugaya
  "Tachikaze", //         minor 4 · squad 9 — Kensei
  "Katen Kyōkotsu", //    minor 5 · squad 8 — Kyōraku
  "Tenken", //            minor 6 · squad 7 — Komamura
  "Senbonzakura", //      minor 7 · squad 6 — Byakuya
  "Sakanade", //          minor 8 · squad 5 — Hirako
  "Minazuki", //          minor 9 · squad 4 — Unohana
  "Kinshara", //          minor 10 · squad 3 — Rose
  "Suzumebachi", //       minor 11 · squad 2 — Soi Fon
  "Ryūjin Jakka", //      minor 12 · squad 1 — Yamamoto
];

export interface VersionParts {
  /** The code-name for this MAJOR.MINOR. */
  name: string;
  /** The patch label ("v.8" / "v.8.3"), or "" for a name-only (era) version. */
  patch: string;
}

/** Pick the code-name table for a major (2 = Espada, 3+ = captains, else none). */
function tableFor(major: number): readonly string[] | null {
  if (major === 2) return ESPADA_NAMES;
  if (major >= 3) return CAPTAIN_NAMES;
  return null;
}

/** Parse one version ("b.2.7.8", "b.2.7.8.3" or the era "b.2.7") into its
 *  on-screen code-name + patch label. Returns null for pre-v2 / non-matching
 *  labels (e.g. "b.1.hi", "0.x"), so the caller can keep them as-is. */
export function versionParts(version: string): VersionParts | null {
  const m = version.match(/^b\.(\d+)\.(\d+)(?:\.(\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const table = tableFor(major);
  if (!table) return null;
  const name = table[minor] ?? `${major}.${minor}`;
  return { name, patch: m[3] ? `v.${m[3]}` : "" };
}

const fmt = (p: VersionParts): string => (p.patch ? `${p.name} ${p.patch}` : p.name);

/** A full on-screen label for any changelog version string, including the span
 *  ranges the history tree builds (e.g. "b.2.7.1–b.2.7.8"). Falls back to the raw
 *  string for pre-v2 eras the scheme doesn't cover. */
export function displayVersion(version: string): string {
  if (version.includes("–")) {
    const [aRaw, bRaw] = version.split("–");
    const a = aRaw ? versionParts(aRaw.trim()) : null;
    const b = bRaw ? versionParts(bRaw.trim()) : null;
    if (a && b) {
      // Same code-name → "Name v.1–v.8"; spanning a name bump → "Name v.x – Name v.y".
      if (a.name === b.name) return b.patch ? `${fmt(a)}–${b.patch}` : fmt(a);
      return `${fmt(a)} – ${fmt(b)}`;
    }
    return version;
  }
  const p = versionParts(version);
  return p ? fmt(p) : version;
}

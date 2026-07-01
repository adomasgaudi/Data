import i18n from "i18next";
import { initReactI18next } from "react-i18next";

/** i18next dictionaries (replaces the legacy DOM-walking translator). English is
 * the source; Lithuanian mirrors the site's existing LT coverage. */
export const resources = {
  en: {
    translation: {
      app_title: "Colosseum",
      nav_leaderboard: "Leaderboard",
      nav_health: "Data Health",
      col_athlete: "Athlete",
      col_exercise: "Exercise",
      col_weight: "Weight",
      col_reps: "Reps",
      total_sets: "Total sets",
      distinct_exercises: "Distinct exercises",
      about: "About this data",
      about_body: "Parsed from the bundled set log with PapaParse.",
    },
  },
  lt: {
    translation: {
      app_title: "Koliziejus",
      nav_leaderboard: "Lyderių lentelė",
      nav_health: "Duomenų būklė",
      col_athlete: "Sportininkas",
      col_exercise: "Pratimas",
      col_weight: "Svoris",
      col_reps: "Pakartojimai",
      total_sets: "Iš viso serijų",
      distinct_exercises: "Skirtingi pratimai",
      about: "Apie šiuos duomenis",
      about_body: "Nuskaityta iš įtraukto serijų žurnalo su PapaParse.",
    },
  },
} as const;

const stored = (() => {
  try {
    return localStorage.getItem("colosseum.lang");
  } catch {
    return null;
  }
})();

i18n.use(initReactI18next).init({
  resources,
  lng: stored === "lt" ? "lt" : "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;

/**
 * Lightweight whole-site Lithuanian translation.
 *
 * Strategy: the app renders in English; when the language is set to LT we swap
 * known English strings for Lithuanian by walking the DOM's TEXT NODES (and a few
 * attributes) and replacing exact dictionary matches. A MutationObserver keeps
 * doing this as the app re-renders, so dynamically-built UI is translated too.
 *
 * It's idempotent: once a node holds Lithuanian it no longer matches an English
 * key, so re-running (including on our own mutations) changes nothing — no loops.
 * Switching language just reloads the page (clean, avoids un-translating).
 *
 * The dictionary covers the visible chrome and labels; add entries here to extend
 * coverage. Numbers, kilograms and exercise names are data, so they're left as-is.
 */
export type Lang = "en" | "lt";

const LANG_KEY = "colosseum.lang";

export function getLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "lt" ? "lt" : "en";
  } catch {
    return "en";
  }
}

export function setLang(l: Lang): void {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  location.reload();
}

/** English → Lithuanian. Keys are matched against the trimmed text of a node. */
const LT: Record<string, string> = {
  // ---- Bottom nav + top chrome ----
  "Analysis": "Analizė",
  "S-Analysis": "S-Analizė",
  "More": "Daugiau",
  "Filter": "Filtras",
  "Exercises": "Pratimai",
  "Guide": "Vadovas",
  "Settings": "Nustatymai",
  // ---- "More" menu ----
  "Group view": "Grupių rodinys",
  "Stats view": "Statistikos rodinys",
  "Add a set": "Pridėti seriją",
  "Index": "Rodyklė",
  // ---- Page titles (top bar shows the current page name) ----
  "Athlete": "Sportininkas",
  "Stats": "Statistika",
  "Group": "Grupė",
  "Add": "Pridėti",
  "Exercise codes": "Pratimų kodai",
  "Athletes": "Sportininkai",
  "Data": "Duomenys",
  "Formulas": "Formulės",
  "Site map": "Svetainės žemėlapis",
  // ---- Settings ----
  "Calculations & display": "Skaičiavimai ir rodymas",
  "1RM formula": "1RM formulė",
  "Nuzzo (bench curve)": "Nuzzo (spaudimo kreivė)",
  "Current strength (fade with time off)": "Dabartinė jėga (mažėja be treniruočių)",
  "Show “Legs (all)” category in lists": "Rodyti „Kojos (visos)“ kategoriją sąrašuose",
  "Mark “trained alone” days on the calendar": "Žymėti „treniravosi vienas“ dienas kalendoriuje",
  "Exercise names shown as": "Pratimų pavadinimai rodomi kaip",
  "Code": "Kodas",
  "Short": "Trumpas",
  "Full": "Pilnas",
  "Simplified view (S-Analysis)": "Supaprastintas rodinys (S-Analizė)",
  "Backup & restore": "Atsarginė kopija ir atkūrimas",
  "Log out": "Atsijungti",
  "Log in": "Prisijungti",
  "Tasks & roadmap": "Užduotys ir planas",
  "The cleanup backlog and feature roadmap, shown straight from the docs/ files.": "Tvarkymo darbų sąrašas ir funkcijų planas, rodomi tiesiai iš docs/ failų.",
  "Language": "Kalba",
  "Back to Colosseum": "Atgal į Colosseum",
  // ---- Quick view switcher (short toggle labels) ----
  "Admin": "Admin",
  "User": "Vart.",
  "Spec": "Žiūr.",
  "Simple": "Papr.",
  "Adv": "Išpl.",
  // ---- Athletes (stats editor) ----
  "average": "vidurkis",
  "auto": "automatiškai",
  // ---- Landing / login ----
  "Enter": "Įeiti",
  "Sign in": "Prisijungimas",
  "Strength leaderboards for you and your friends — track every lift, see your estimated 1RMs, and climb the ranks.":
    "Jėgos lyderių lentelės tau ir tavo draugams — fiksuok kiekvieną pakėlimą, matyk apytiksles 1RM ir kopk lentelėje.",
  "Password": "Slaptažodis",
  "Wrong password.": "Neteisingas slaptažodis.",
  // ---- Body stats card ----
  "Body stats": "Kūno rodikliai",
  "Body fat": "Kūno riebalai",
  "Lean": "Liesoji masė",
  "Lean weight": "Liesoji masė",
  "Fat": "Riebalai",
  "Fat mass": "Riebalų masė",
  "Natural potential (est.)": "Natūralus potencialas (apytiksl.)",
  "Lean cap": "Liesosios riba",
  "Cali wt": "Kalist. svoris",
  "Power wt": "Jėgos svoris",
  "✎ Edit": "✎ Redaguoti",
  "Edit": "Redaguoti",
  "No profile on file.": "Profilio nėra.",
  "No profile on file": "Profilio nėra",
  "Muscle map": "Raumenų žemėlapis",
  // Simplified-card explanations (exact sentences rendered by the app).
  "The share of your bodyweight that's fat — shown as a likely range because it's only an estimate. Lower is leaner, though very low isn't always healthier.":
    "Kūno svorio dalis, kuri yra riebalai — rodoma kaip tikėtinas intervalas, nes tai tik įvertis. Mažiau reiškia liesesnį kūną, tačiau labai mažai ne visada sveikiau.",
  "Everything that isn't fat — muscle, bone, organs, water. More lean weight generally means more strength.":
    "Viskas, kas nėra riebalai — raumenys, kaulai, organai, vanduo. Daugiau liesosios masės paprastai reiškia daugiau jėgos.",
  "The actual kilograms of fat you carry — your weight times your body-fat %.":
    "Tikri riebalų kilogramai, kuriuos nešioji — tavo svoris padaugintas iš kūno riebalų %.",
  "A muscle-for-your-height score — like BMI but counting only lean mass. Roughly: ~18 untrained, ~22 well-trained, ~25 the natural ceiling.":
    "Raumeningumo pagal ūgį rodiklis — kaip KMI, bet skaičiuojama tik liesoji masė. Apytiksliai: ~18 netreniruotas, ~22 gerai treniruotas, ~25 natūrali riba.",
  // ⓘ math-popover labels (complex Body stats).
  "lean": "liesoji",
  "spread": "sklaida",
  "body fat": "kūno riebalai",
  "50% band": "50% intervalas",
  "95% band": "95% intervalas",
  "ceiling": "riba",
  "lean cap": "liesosios riba",
  "carry at": "esant",
  "ideal wt": "idealus svoris",
  "50% / 95% come from your body-fat band": "50% / 95% kyla iš tavo kūno riebalų intervalo",
  "your estimate — edit on the Athletes page": "tavo įvertis — keisk Sportininkų puslapyje",
  // ---- Graph options ----
  "Opacity": "Permatomumas",
  "Right axis ↕": "Dešinė ašis ↕",
  // ---- Workouts (incl. S-ANL history) ----
  "Workouts": "Treniruotės",
  "Tags": "Žymos",
  "Filter by exercise…": "Filtruoti pagal pratimą…",
  "No workouts.": "Treniruočių nėra.",
  "No workouts for that filter.": "Nėra treniruočių pagal šį filtrą.",
  "⚙ Display options": "⚙ Rodymo parinktys",
  "alone": "vienas",
  "+ set": "+ serija",
  "+ exercise": "+ pratimas",
  "training": "treniruotės",
  "per week": "per savaitę",
  // ---- Index / groups ----
  "Merged exercises": "Sujungti pratimai",
  "Bodyweight parts": "Kūno svorio dalys",
  "Shown as": "Rodoma kaip",
  "Combined from": "Sujungta iš",
  "Group by": "Grupuoti pagal",
  "Sub-group by": "Pogrupis pagal",
  "Discipline": "Disciplina",
  "Muscle group": "Raumenų grupė",
  "Body part": "Kūno dalis",
  "Show app-wide": "Rodyti visoje programoje",
  "show all": "rodyti visus",
  "only these": "tik šiuos",
  "hidden": "paslėpti",
  // ---- Leaderboard ----
  "Personal records": "Asmeniniai rekordai",
  "Best set": "Geriausia serija",
  "Exercise": "Pratimas",
  "Everyone": "Visi",
  "Men only": "Tik vyrai",
  "Women only": "Tik moterys",
  "Exclude dropsets": "Neįtraukti dropsetų",
  // ---- Command bar ----
  "Search exercises…   or type . for commands": "Ieškoti pratimų…   arba įvesk . komandoms",
};

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE", "PRE"]);
const ATTRS = ["placeholder", "title", "aria-label"];

/** Translate one string if it's an exact (trimmed) dictionary hit, preserving the
 * node's surrounding whitespace. Returns null when there's nothing to change. */
function tr(s: string): string | null {
  const key = s.trim();
  if (!key) return null;
  const hit = LT[key];
  if (hit === undefined || hit === key) return null;
  return s.replace(key, hit);
}

function translateAttrs(el: Element): void {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v) { const out = tr(v); if (out !== null) el.setAttribute(a, out); }
  }
}

function translateTextNode(n: Text): void {
  const out = tr(n.nodeValue ?? "");
  if (out !== null) n.nodeValue = out;
}

/** Walk + translate every text node and known attribute under `root`. */
function translateTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) { translateTextNode(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  // Leave SVG internals and form controls alone.
  if (SKIP_TAGS.has(el.tagName) || el instanceof SVGElement) return;
  translateAttrs(el);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = (n as Text).parentElement;
      if (!p || SKIP_TAGS.has(p.tagName) || p instanceof SVGElement) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
  for (const t of texts) translateTextNode(t);
  for (const child of el.querySelectorAll("*")) {
    if (!(child instanceof SVGElement) && !SKIP_TAGS.has(child.tagName)) translateAttrs(child);
  }
}

/** Turn on Lithuanian: translate the current DOM, then keep translating as the app
 * re-renders. No-op when the language is English. Safe to call once at startup. */
export function initI18n(): void {
  if (getLang() !== "lt") return;
  translateTree(document.body);
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") translateTextNode(m.target as Text);
      else if (m.type === "attributes" && m.target instanceof Element) translateAttrs(m.target);
      else for (const n of m.addedNodes) translateTree(n);
    }
  });
  obs.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ATTRS,
  });
}

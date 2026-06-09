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
  // ---- Live coaching page ----
  "Live": "Gyvai",
  "Train today": "Šiandien treniruok",
  "Planned today": "Šiandienos planas",
  "Antagonist supersets": "Antagonistų supersetai",
  "Warm-ups": "Apšilimas",
  "Watch-outs": "Atsargiai",
  "Goals & cautions": "Tikslai ir atsargumas",
  "Goals": "Tikslai",
  "Style": "Stilius",
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
  "World records": "Pasaulio rekordai",
  "Version history": "Versijų istorija",
  // ---- Coach calculator (Formulas tab) ----
  "Coach — working weight & warm-up": "Treneris — darbinis svoris ir apšilimas",
  "From a client's 1RM: the hard-set load and a full warm-up ramp up to it.":
    "Pagal kliento 1RM: sunkaus sakinio svoris ir pilnas apšilimas iki jo.",
  "Target: reps + RIR": "Tikslas: pakartojimai + RIR",
  "Target: % of 1RM": "Tikslas: % nuo 1RM",
  "Reps": "Pakartojimai",
  "% of 1RM": "% nuo 1RM",
  "Formula": "Formulė",
  "Plates (kg)": "Blynai (kg)",
  "Work set": "Darbinis sakinys",
  "Warm-up": "Apšilimas",
  "reps": "pak.",
  "Enter a 1RM to see the prescription.": "Įveskite 1RM, kad pamatytumėte programą.",
  // ---- World records page ----
  "Each lifter's optimal weight class — from their height, natural muscle ceiling and ideal bodyweight — and the powerlifting world record there.":
    "Kiekvieno sportininko optimali svorio kategorija — pagal ūgį, natūralią raumenų ribą ir idealų kūno svorį — ir to lygio jėgos trikovės pasaulio rekordas.",
  "Optimal weight class from each lifter's height → natural nFFMI ceiling → lean mass → power bodyweight, then that class's world record.":
    "Optimali svorio kategorija pagal ūgį → natūralią nFFMI ribą → liesąją masę → jėgos kūno svorį, tada tos kategorijos pasaulio rekordas.",
  "⚠ provisional": "⚠ negalutiniai",
  "source": "šaltinis",
  "Class": "Kategorija",
  "See an example in this lift's workout history": "Žiūrėti pavyzdį šio pratimo treniruočių istorijoje",
  "Show the Stats section": "Rodyti statistikos skiltį",
  "Hide the Stats section": "Slėpti statistikos skiltį",
  "No athletes with a height & sex on file to place in a weight class.":
    "Nėra sportininkų su įrašytu ūgiu ir lytimi, kad būtų galima priskirti svorio kategoriją.",
  "Every released version, newest first — the same log as the git history.": "Kiekviena išleista versija, naujausia viršuje — tas pats sąrašas kaip git istorijoje.",
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
  // ---- Graph selector: group-by special modes ----
  "Best lifts": "Geriausi kėlimai",
  "Frequency": "Dažnis",
  "Effectiveness": "Efektyvumas",
  "Sort: Effectiveness": "Rūšiuoti: efektyvumas",
  "Sort: Sets": "Rūšiuoti: serijos",
  "Sort: Tier": "Rūšiuoti: lygmuo",
  "Sort: Name": "Rūšiuoti: pavadinimas",
  "Sets": "Serijos",
  "Hard sets": "Sunkios serijos",
  "1 week": "1 savaitė",
  "1 month": "1 mėnuo",
  "3 months": "3 mėnesiai",
  "1 year": "1 metai",
  "all time": "visą laiką",
  "None of the three powerlifting lifts are logged for this athlete.": "Šiam sportininkui neįrašytas nė vienas iš trijų jėgos trikovės kėlimų.",
  "No sets logged in this period.": "Šiuo laikotarpiu serijų neįrašyta.",
  "Select all": "Pažymėti visus",
  "Deselect all": "Atžymėti visus",
  "OK": "Gerai",
  "Cancel": "Atšaukti",
  "New athlete's name:": "Naujo atleto vardas:",
  "Name for the merged lift:": "Sujungto pratimo pavadinimas:",
  "↺ Default": "↺ Numatyta",
  "Hidden lifts": "Paslėpti pratimai",
  "Unhide all": "Atslėpti visus",
  "No hidden lifts.": "Paslėptų pratimų nėra.",
  "Show hidden in the list (don't unhide)": "Rodyti paslėptus sąraše (neatslepiant)",
  "Did you mean…?": "Ar turėjote omenyje…?",
  "None": "Nėra",
  "Ugly": "Bjaurus",
  "Vertical pull": "Vertikalus traukimas",
  "Horizontal pull": "Horizontalus traukimas",
  "Vertical push": "Vertikalus stūmimas",
  "Horizontal push": "Horizontalus stūmimas",
  "Core": "Liemuo",
  "ⓘ Info": "ⓘ Informacija",
  "⊕ Combine": "⊕ Sujungti",
  "⇄ Compare": "⇄ Palyginti",
  "⊕ Merged": "⊕ Sujungta",
  "⇄ Separated": "⇄ Atskirai",
  "✕ Remove": "✕ Pašalinti",
  // ---- Add-set variation pickers (dimension labels + levels) ----
  "support": "atrama",
  "ROM": "amplitudė",
  "fwd lean": "pasvirimas",
  "tempo": "tempas",
  "band": "guma",
  "position": "padėtis",
  "free": "laisvai",
  "front-to-wall": "veidu į sieną",
  "back-to-wall": "nugara į sieną",
  "ladder": "kopėčios",
  "paused": "su pauze",
  "uninterrupted": "be pauzės",
  "no band": "be gumos",
  "band 1": "guma 1",
  "band 2": "guma 2",
  "band 3": "guma 3",
  "band 4": "guma 4",
  "band 5": "guma 5",
  "band 6": "guma 6",
  "floor (on feet)": "ant kojų",
  "on knees": "ant kelių",
  "🧪 Testing": "🧪 Testavimas",
  "The cleanup backlog and feature roadmap, shown straight from the docs/ files.": "Tvarkymo darbų sąrašas ir funkcijų planas, rodomi tiesiai iš docs/ failų.",
  "Language": "Kalba",
  "Back to Colosseum": "Atgal į Colosseum",
  "Back": "Atgal",
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
  // ---- Stats card (body + training) — title "Stats" reuses the existing entry ----
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
  "＋ Add athlete": "＋ Pridėti sportininką",
  "No profile on file.": "Profilio nėra.",
  "No profile on file": "Profilio nėra",
  "Muscle map": "Raumenų žemėlapis",
  "Maintenance": "Priežiūra",
  "Declining": "Krenta",
  "Holding": "Išlaiko",
  "Improving": "Auga",
  "ideal fat": "ideali riebalų norma",
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
  // ---- Exercise selector (identity includes) ----
  "Original": "Originalūs",
  "Dissolved": "Išskaidyti",
  "Combined": "Sujungti",
  "Comparison groups": "Palyginimo grupės",
  // ---- Combine-group display mode (More info) ----
  "Show in picker": "Rodyti rinkiklyje",
  "Combined only": "Tik sujungtą",
  "Members only": "Tik narius",
  "Show both": "Rodyti abu",
  // ---- Momentum trend period ----
  "/wk": "/sav.",
  "/mo": "/mėn.",
  "/3mo": "/3mėn.",
  // ---- Graph options ----
  "Lines & filter": "Linijos ir filtras",
  "Bars & axes": "Stulpeliai ir ašys",
  "Prediction": "Prognozė",
  "Decay": "Nykimas",
  "Hard sets only": "Tik sunkios serijos",
  "Opacity": "Permatomumas",
  "Right axis ↕": "Dešinė ašis ↕",
  "Bar girth": "Stulpelių storis",
  "Spread": "Išsklaidymas",
  "Volume shift": "Tūrio poslinkis",
  "All graphs": "Visi grafikai",
  "Approved only": "Tik patvirtinti",
  "Match graph": "Atitikti grafiką",
  "Compare": "Palyginti",
  "Match history": "Atitikti istoriją",
  "Graph lifts": "Grafiko pratimai",
  "History lifts": "Istorijos pratimai",
  // ---- Create variant / group form (Index) ----
  "Search exercises…": "Ieškoti pratimų…",
  "None picked yet — tap an exercise below.": "Dar nieko nepasirinkta — bakstelėk pratimą žemiau.",
  "Your variants & groups": "Tavo variantai ir grupės",
  "Hide missing": "Slėpti trūkstamus",
  "Show missing": "Rodyti trūkstamus",
  // ---- Allowed-graphs review (per exercise) ----
  "Allowed graphs": "Leidžiami grafikai",
  "Tap to cycle: no → 1 experimental → 2 confirmed → 3 certain. Any level ≥ 1 shows the graph for this lift.": "Spustelėkite keisti: ne → 1 eksperimentinis → 2 patvirtintas → 3 tikras. Bet koks lygis ≥ 1 rodo šio pratimo grafiką.",
  "All certain": "Visi tikri",
  "Block all": "Blokuoti visus",
  // ---- Workouts (incl. S-ANL history) ----
  "Workouts": "Treniruotės",
  "Horizontal history": "Horizontali istorija",
  "experimental": "eksperimentinis",
  "developing": "kuriama",
  "Training calendar": "Treniruočių kalendorius",
  "— rows ordered by recent activity, aligned across time": "— eilutės surikiuotos pagal naujausią aktyvumą, sulygiuotos laike",
  "No workouts to show.": "Nėra treniruočių.",
  "Tags": "Žymos",
  "Filter by exercise…": "Filtruoti pagal pratimą…",
  "No workouts.": "Treniruočių nėra.",
  "No workouts for that filter.": "Nėra treniruočių pagal šį filtrą.",
  "rest days": "poilsio dienų",
  "Show all": "Rodyti visus",
  "Hide them": "Slėpti juos",
  "Hidden": "Paslėpti",
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
  "BW part": "KS dalis",
  "＋ keep": "＋ palikti",
  "✓ kept": "✓ palikta",
  "clear all exceptions": "išvalyti visas išimtis",
  "Auto-organised because this group is large — tap the menu to change": "Sutvarkyta automatiškai, nes grupė didelė — keisk meniu",
  "Discipline": "Disciplina",
  "Statics": "Statika",
  "Strength": "Jėga",
  "Muscle group": "Raumenų grupė",
  "Body part": "Kūno dalis",
  "Joint": "Sąnarys",
  "Movement": "Judesys",
  "Plane": "Plokštuma",
  "Function": "Funkcija",
  "Equipment": "Įranga",
  "Difficulty": "Sudėtingumas",
  "Load type": "Apkrovos tipas",
  "Unilateral/Bilateral": "Vienpusis/Dvipusis",
  "Tier": "Lygis",
  "Muscle": "Raumuo",
  "Category": "Kategorija",
  "Primary": "Pirminis",
  "Secondary": "Antrinis",
  "Tertiary": "Tretinis",
  "clear filters": "išvalyti filtrus",
  "no values": "nėra reikšmių",
  "Show app-wide": "Rodyti visoje programoje",
  "Restrict the whole app (every list, graph, leaderboard). Three layers stack (AND): a frequency tier, any taxonomy filters below, and a group's “only these” button. “Show all” clears every layer at once.": "Apriboti visą programą (kiekvieną sąrašą, grafiką, lentelę). Trys sluoksniai derinami (IR): dažnumo lygis, žemiau esantys filtrai ir grupės mygtukas „tik šiuos“. „Rodyti visus“ iškart išvalo visus sluoksnius.",
  "show all": "rodyti visus",
  "only these": "tik šiuos",
  "hidden": "paslėpti",
  // ---- Leaderboard ----
  "Personal records": "Asmeniniai rekordai",
  "Best set": "Geriausia serija",
  "Exercise": "Pratimas",
  "Type": "Tipas",
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

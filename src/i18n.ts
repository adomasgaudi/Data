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
  "exercises": "pratimai",
  "Guide": "Vadovas",
  "Settings": "Nustatymai",
  // ---- "More" menu ----
  "Clients": "Klientai",
  "Coach": "Treneris",
  "Group view": "Grupių rodinys",
  "Stats view": "Statistikos rodinys",
  "Add a set": "Pridėti seriją",
  // ---- Add-set / add-exercise popup ----
  "Add set": "Pridėti seriją",
  "Add exercise": "Pridėti pratimą",
  "Suggested": "Siūloma",
  "Note": "Užrašas",
  "Variant": "Variacija",
  "optional note": "neprivalomas užrašas",
  "Weight · reps · sets": "Svoris · kart. · serijos",
  "Weight · reps": "Svoris · kart.",
  "search exercise…": "ieškoti pratimo…",
  "Index": "Rodyklė",
  // ---- Live coaching page ----
  "Live": "Gyvai",
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
  // ---- Plan overlay (the 📋 button; was "Priorities") ----
  "📋 Plan": "📋 Planas",
  "🧮 Formulas": "🧮 Formulės",
  "Plan": "Planas",
  "Focus lifts": "Svarbiausi pratimai",
  "↕ Top": "↕ Viršus",
  "↕ Effort": "↕ Pastanga",
  "↕ Drag": "↕ Tempti",
  "🎯 Goal": "🎯 Tikslas",
  "no 1RM yet": "dar nėra 1RM",
  "Max effort": "Maks. pastanga",
  "Active": "Aktyvus",
  "Passive": "Pasyvus",
  "Maintain": "Palaikyti",
  "Third": "Trečias",
  // Set-intensity (effort) pill in the expanded focus-lift panel.
  "intensity": "intensyvumas",
  "Hard": "Sunkios",
  "Mid": "Vidut.",
  "Half": "Pusė",
  "near failure": "iki ribos",
  "½ max reps": "½ maks. kart.",
  "target": "tikslas",
  // ---- "How to train" lift brief ----
  "Calculate": "Skaičiuoti",
  "1RM — fit to your lifts": "1RM — pritaikyk prie savo kėlimų",
  "type a set to calc": "įveskite seriją skaičiavimui",
  "Working weights": "Darbiniai svoriai",
  "Warmup": "Apšilimas",
  "Reps → %1RM (Nuzzo)": "Kartojimai → %1RM (Nuzzo)",
  "%1RM → reps (Nuzzo)": "%1RM → kartojimai (Nuzzo)",
  "Real lifts on the graph": "Tikri kėliniai grafike",
  "hard sets (≤3 RIR)": "sunkios serijos (≤3 RIR)",
  "Curve": "Kreivė",
  "Map": "Žemėlapis",
  "Sets per weight range": "Serijos pagal svorį",
  "Drag to rotate · ↔ weight · ↕ reps · height = sets · darker = heavier": "Sukite pirštu · ↔ svoris · ↕ kartojimai · aukštis = serijos · tamsesnė = sunkesnė",
  "Drag to rotate · the Curve laid flat · pin height = sets done there over time": "Sukite pirštu · kreivė paguldyta · smaigalio aukštis = ten atliktos serijos",
  "reps: each": "kart.: kiekvienas",
  "reps: by 3": "kart.: po 3",
  "reps: by 10": "kart.: po 10",
  "tall: sets": "aukštis: serijos",
  "tall: reps": "aukštis: kart.",
  "Setup notes": "Pasiruošimo užrašai",
  "Pair with": "Derinti su",
  "⇄ Pair flags": "⇄ Derinimo žymės",
  "Search to flag…": "Ieškoti žymėjimui…",
  "No pair flags yet — flag exercises in their info card or search below.": "Dar nėra žymių — pažymėkite pratimus jų informacijos kortelėje arba ieškokite žemiau.",
  "👥 Gym": "👥 Salė",
  "👤 Just me": "👤 Tik man",
  "Super": "Super",
  "Good": "Gerai",
  "Neutral": "Neutralu",
  "Difficult": "Sunku",
  "No way": "Niekada",
  "✎ Index entry — code, tags, groups & data": "✎ Rodyklės įrašas — kodas, žymos, grupės ir duomenys",
  // ---- Mini stats carousel ----
  "More ▾": "Daugiau ▾",
  "~22 trained · ~25 natural ceiling": "~22 treniruotas · ~25 natūrali riba",
  "muscle to your natural cap": "raumenų iki natūralios ribos",
  "lean mass": "liesa masė",
  "muscle, bone, organs, water": "raumenys, kaulai, organai, vanduo",
  "bodyweight": "kūno svoris",
  "× bodyweight": "× kūno svoris",
  "fat mass": "riebalų masė",
  "years old": "metų",
  "height": "ūgis",
  "sessions / week": "treniruotės / sav.",
  "No stats yet.": "Kol kas nėra statistikos.",
  "Group": "Grupė",
  "Add": "Pridėti",
  "Exercise codes": "Pratimų kodai",
  "Athletes": "Sportininkai",
  "Data": "Duomenys",
  "Formulas": "Formulės",
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
  "Plates": "Blynai",
  "Your 1RM": "Tavo 1RM",
  "Warm-up to your set": "Apšilimas iki tavo serijos",
  "Top 10 sets by 1RM": "10 geriausių serijų pagal 1RM",
  "No sets with a usable 1RM yet.": "Dar nėra serijų su tinkamu 1RM.",
  "enter weight & reps": "įvesk svorį ir pakartojimus",
  "Enter a weight & reps to see the warm-up.": "Įvesk svorį ir pakartojimus, kad pamatytum apšilimą.",
  "Work set": "Darbinis sakinys",
  "Work sets": "Darbinės serijos",
  "Entered": "Įvesta",
  "work": "darbinė",
  "Strength 5×5": "Jėga 5×5",
  "Strength 3×5": "Jėga 3×5",
  "Power 5×3": "Galia 5×3",
  "Peaking 3·2·1": "Pikas 3·2·1",
  "Hypertrophy 3×8": "Hipertrofija 3×8",
  "Volume 4×10": "Apimtis 4×10",
  "Pump 3×20": "Pampas 3×20",
  "Endurance 2×30": "Ištvermė 2×30",
  "Custom": "Savas",
  "Quick": "Greitas",
  "Standard": "Standartinis",
  "Heavy": "Sunkus",
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
  "Graph": "Grafikas",
  "↗ Over time": "↗ Pagal laiką",
  "✦ Reps × kg": "✦ Kart. × kg",
  // Custom graph dashboard (CHART-160) — per-bubble controls + reel.
  "Single": "Vienas",
  "Multi": "Keli",
  "⇆ Lifts": "⇆ Pratimai",
  "＋ Bubble": "＋ Burbulas",
  // Tab long-press menu (CHART-164) + bubble menu (CHART-165).
  "✎ Rename": "✎ Pervadinti",
  "＋ Add tab": "＋ Pridėti skirtuką",
  "✕ Delete": "✕ Ištrinti",
  "⧉ Duplicate": "⧉ Dubliuoti",
  "History": "Istorija",
  "Sessions": "Treniruotės",
  "By exercise": "Pagal pratimą",
  "By week": "Pagal savaitę",
  "By month": "Pagal mėnesį",
  "Close options": "Uždaryti parinktis",
  "Show the Graph section": "Rodyti grafiko skiltį",
  "Hide the Graph section": "Slėpti grafiko skiltį",
  "Show the History section": "Rodyti istorijos skiltį",
  "Hide the History section": "Slėpti istorijos skiltį",
  "Show the Plan section": "Rodyti plano skiltį",
  "Hide the Plan section": "Slėpti plano skiltį",
  "Horizontal": "Horizontali",
  "Calendar": "Kalendorius",
  "soon": "netrukus",
  "Show the Horizontal history section": "Rodyti horizontalios istorijos skiltį",
  "Hide the Horizontal history section": "Slėpti horizontalios istorijos skiltį",
  "Show the Calendar section": "Rodyti kalendoriaus skiltį",
  "Hide the Calendar section": "Slėpti kalendoriaus skiltį",
  "No athletes with a height & sex on file to place in a weight class.":
    "Nėra sportininkų su įrašytu ūgiu ir lytimi, kad būtų galima priskirti svorio kategoriją.",
  // ---- Strength-percentile panel ----
  "Strength percentiles": "Jėgos procentiliai",
  "Total has no single standard — showing Squat. Tap Squat / Bench / Deadlift above to switch.":
    "Bendras neturi atskiro standarto — rodomas Pritūpimas. Spustelėkite Pritūpimą / Spaudimą / Mirties trauką viršuje, kad pakeistumėte.",
  "≈ est": "≈ įvert.",
  "1RM as ×bodyweight at each percentile, by population.":
    "1RM kaip ×kūno svoris kiekviename procentilyje, pagal populiaciją.",
  "Population": "Populiacija",
  "General": "Bendra",
  "Gym (StrengthLevel)": "Salė (StrengthLevel)",
  "Professional": "Profesionalai",
  // ---- Personal benchmarks ----
  "Your benchmarks": "Jūsų etalonai",
  "Benchmarks": "Etalonai",
  "Select an exercise": "Pasirinkite pratimą",
  "+ add": "+ pridėti",
  "No benchmarks yet — set your own targets for this lift.":
    "Dar nėra etalonų — nustatykite savo tikslus šiam pratimui.",
  "Label": "Pavadinimas",
  "Benchmark label": "Etalono pavadinimas",
  "Benchmark value": "Etalono reikšmė",
  "Add a benchmark for this lift": "Pridėti etaloną šiam pratimui",
  "Toggle unit — ×bodyweight or kg": "Keisti vienetą — ×kūno svoris arba kg",
  "Remove this benchmark": "Pašalinti šį etaloną",
  "Where this lift sits as 1RM ×bodyweight across populations (estimated), your placement, and your own benchmarks.":
    "Kur šis pratimas yra kaip 1RM ×kūno svoris tarp populiacijų (įvertinta), jūsų vieta ir jūsų etalonai.",
  "Every released version, newest first — the same log as the git history.": "Kiekviena išleista versija, naujausia viršuje — tas pats sąrašas kaip git istorijoje.",
  // ---- Settings ----
  "Calculations & display": "Skaičiavimai ir rodymas",
  "1RM formula": "1RM formulė",
  "App-wide 1RM formula": "Visos programos 1RM formulė",
  "Compare formulas & breakdown": "Palyginti formules ir skaičiavimą",
  "Nuzzo (bench curve)": "Nuzzo (spaudimo kreivė)",
  "Exercise names shown as": "Pratimų pavadinimai rodomi kaip",
  "Code": "Kodas",
  "Short": "Trumpas",
  "Full": "Pilnas",
  "Backup & restore": "Atsarginė kopija ir atkūrimas",
  "Log out": "Atsijungti",
  "Log in": "Prisijungti",
  "🌐 Public profile": "🌐 Viešas profilis",
  "Sync with Supabase": "Sinchronizacija su Supabase",
  "Catch up": "Atnaujinti",
  "Import historical data": "Importuoti istorinius duomenis",
  "First time? Upload your StrengthLevel CSV export to seed your data into Supabase. Safe to re-run — duplicate sets are ignored.": "Pirmas kartas? Įkelkite StrengthLevel CSV failą — duomenys bus išsaugoti Supabase. Pakartotinis paleidimas saugus — dublikatai ignoruojami.",
  "⬆ Choose CSV": "⬆ Pasirinkti CSV",
  "Wrong username or password.": "Neteisingas vartotojo vardas arba slaptažodis.",
  "Select a user.": "Pasirinkite vartotoją.",
  "Enter your password.": "Įveskite slaptažodį.",
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
  // ---- Command bar ----
  "Switch to this page": "Pereiti į šį puslapį",
  "Undo": "Atšaukti",
  // ---- Customisable sets-table columns ----
  "Show in this column": "Rodyti šiame stulpelyje",
  "Weight × reps": "Svoris × pakartojimai",
  "Rep-max (1RM)": "Pakartojimų maks. (1RM)",
  "Volume": "Apimtis",
  "Predicted RIR": "Numatomas RIR",
  "Logged RIR": "Įrašytas RIR",
  // ---- Collapsed-history golden summary picker ----
  "Show in the history": "Rodyti istorijoje",
  "Best rep-max (1RM)": "Geriausias pakartojimų maks. (1RM)",
  "Total volume": "Bendra apimtis",
  "Top weight": "Didžiausias svoris",
  "Total reps": "Iš viso pakartojimų",
  "Set count": "Serijų skaičius",
  "Select all": "Pažymėti visus",
  "Deselect all": "Atžymėti visus",
  "📈 Graph": "📈 Grafikas",
  "Add to multi view": "Pridėti į bendrą rodinį",
  "Replace the multi/overlaid graph with the matches": "Pakeisti bendrą grafiką atitikmenimis",
  "Keep what's plotted, add the matches": "Palikti esamus, pridėti atitikmenis",
  "The single-lift graph view": "Vieno pratimo grafiko rodinys",
  "OK": "Gerai",
  "Cancel": "Atšaukti",
  "New athlete's name:": "Naujo atleto vardas:",
  "Name for the merged lift:": "Sujungto pratimo pavadinimas:",
  "↺ Default": "↺ Numatyta",
  "Hidden lifts": "Paslėpti pratimai",
  "Tap a setting to see what it does.": "Bakstelėkite nustatymą, kad pamatytumėte, ką jis daro.",
  "⧉ Duplicate set": "⧉ Dubliuoti seriją",
  "✎ Change variant": "✎ Keisti variantą",
  "＋1 rep": "＋1 pakartojimas",
  "＋2.5 kg": "＋2.5 kg",
  "−10% back-off": "−10% lengvesnė",
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
  "Updating…": "Atnaujinama…",
  "✋ Free order": "✋ Laisva tvarka",
  "by effort · drag to customise": "pagal pastangą · tempk, kad pakeistum",
  // ---- Add-set variation pickers (dimension labels + levels) ----
  "support": "atrama",
  "Default ROM": "Numatyta amplitudė",
  "% of full ROM": "% nuo pilnos amplitudės",
  "Machine weight": "Mašinos svoris",
  "kg base": "kg bazė",
  "Range of motion": "Judesio amplitudė",
  "backrest": "nugaros atrama",
  "back rest": "nugaros atrama",
  "obstacle": "kliūtis",
  "hanging": "kabantis",
  "dips_bar": "lygiagretės",
  "dips bar": "lygiagretės",
  "30cm rest": "30cm atrama",
  "yoga S (6cm)": "joga S (6cm)",
  "yoga M (15cm)": "joga M (15cm)",
  "yoga L (23cm)": "joga L (23cm)",
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
  "banded": "su guma",
  "shoulders": "pečiai",
  "back support": "nugaros atrama",
  "⇄ unilateral": "⇄ vienpusis",
  "⇄ unilateral?": "⇄ vienpusis?",
  "⌁ assisted ½": "⌁ su pagalba ½",
  "⌁ assisted?": "⌁ su pagalba?",
  "⚖ cable": "⚖ trosas",
  "⚖ gravity": "⚖ gravitacija",
  "Machine assist (kg)": "Treniruoklio pagalba (kg)",
  "machine": "treniruoklis",
  "real": "tikras",
  "Assist: real ½": "Pagalba: tikra ½",
  "Assist: logged ×2": "Pagalba: įrašyta ×2",
  "0cm (wall)": "0cm (siena)",
  "blue 6cm": "mėlynas 6cm",
  "📷 photo": "📷 nuotrauka",
  "✏️ diagram": "✏️ schema",
  "Blue block = 6cm: the shoulders sit 6cm off the wall.": "Mėlynas blokas = 6cm: pečiai 6cm nuo sienos.",
  "band 1": "guma 1",
  "band 2": "guma 2",
  "band 3": "guma 3",
  "band 4": "guma 4",
  "band 5": "guma 5",
  "band 6": "guma 6",
  "floor (on feet)": "ant kojų",
  "on knees": "ant kelių",
  "Data health": "Duomenų būklė",
  "The cleanup backlog and feature roadmap, shown straight from the docs/ files.": "Tvarkymo darbų sąrašas ir funkcijų planas, rodomi tiesiai iš docs/ failų.",
  "Language": "Kalba",
  "Back to Colosseum": "Atgal į Colosseum",
  "Back": "Atgal",
  // ---- Quick view switcher (short toggle labels) ----
  "Admin": "Admin",
  "User": "Vart.",
  "Spec": "Žiūr.",
  "spectator": "žiūrovas",
  "Simple": "Papr.",
  "Adv": "Išpl.",
  // ---- Athletes (stats editor) ----
  "average": "vidurkis",
  "auto": "automatiškai",
  // ---- Landing / login ----
  "spectate": "stebėti",
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
  "Composed of": "Sudaryta iš",
  "— merged 1:1 into this lift": "— sujungta 1:1 į šį pratimą",
  "— scaled onto this lift's curve": "— priderinta prie šio pratimo kreivės",
  // ---- Momentum trend period ----
  "/wk": "/sav.",
  "/mo": "/mėn.",
  "/3mo": "/3mėn.",
  // ---- Graph info popup (ℹ button per graph bubble) ----
  "Graph info": "Grafiko informacija",
  "About this graph": "Apie šį grafiką",
  "This graph": "Šis grafikas",
  "Metrics — what each shows": "Rodikliai — ką kiekvienas rodo",
  "Weight": "Svoris",
  "Volume & frequency": "Apimtis ir dažnis",
  "Over time": "Pagal laiką",
  "Reps × kg": "Kart. × kg",
  "Metrics tracked across dates": "Rodikliai stebimi pagal datas",
  "Every set plotted as weight × reps": "Kiekviena serija kaip svoris × kart.",
  "One lift shown": "Rodomas vienas pratimas",
  "All picked lifts overlaid": "Visi pasirinkti pratimai uždengti",
  "Values shown in kg": "Reikšmės rodomos kilogramais",
  "Values shown ÷ bodyweight": "Reikšmės rodomos ÷ kūno svorį",
  "Estimated 1RM of every set": "Apskaičiuotas kiekvienos serijos 1RM",
  "Each set's weight up to its 1RM, banded per rep": "Serijos svoris iki jos 1RM, juostomis pagal kart.",
  "Your 1RM as a fraction of the world record": "Tavo 1RM kaip pasaulio rekordo dalis",
  "Your best 1RM so far (running max)": "Tavo geriausias 1RM iki šiol (bėgantis maks.)",
  "Strength fading during time off training": "Jėga krenta nesitreniruojant",
  "Weight × reps summed per interval (bars)": "Svoris × kart. sumuota per laikotarpį (stulp.)",
  "Total reps done per interval (bars)": "Visi kartojimai per laikotarpį (stulp.)",
  "Number of sets per interval (bars)": "Serijų skaičius per laikotarpį (stulp.)",
  "Sessions per week (rolling cadence)": "Treniruotės per savaitę (slankusis tempas)",
  "Off — forecast curve toward your ceiling": "Išjungta — prognozės kreivė link tavo ribos",
  "Tip: drag ⟵⟶ to set the fit window · pinch / drag the chart to zoom & pan": "Patarimas: tempk ⟵⟶ pritaikymo langui · pellk / tempk grafiką mastelio ir naršymo keitimui",
  // ---- Graph options ----
  "Lines & filter": "Linijos ir filtras",
  "Bars & axes": "Stulpeliai ir ašys",
  "Prediction": "Prognozė",
  "Projection": "Projekcija",
  "Show forecast line": "Rodyti prognozės liniją",
  "Ahead": "Į priekį",
  "Fit": "Pritaikyta",
  "Records": "Rekordai",
  "All sets": "Visos serijos",
  "drag the ⟵ ⟶ lines to set the fit window": "tempk ⟵ ⟶ linijas, kad nustatytum pritaikymo langą",
  "Window: custom ✕": "Langas: pasirinktas ✕",
  "Potential (log)": "Potencialas (log)",
  "Log to potential": "Log iki potencialo",
  "Native log (exp.)": "Natyvus log (eksp.)",
  "Ceiling (kg)": "Riba (kg)",
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
  "Options": "Parinktys",
  "Picker & settings": "Rinkiklis ir nustatymai",
  "Pick": "Rinktis",
  "Exercise picker — drag the note out, or tap": "Pratimų rinkiklis — ištempk lapelį arba bakstelėk",
  "Open exercise picker & settings": "Atidaryti pratimų rinkiklį ir nustatymus",
  "all exercises": "visi pratimai",
  "All Exercises": "Visi pratimai",
  "⊕ Combinable group": "⊕ Sujungiama grupė",
  "⇄ Comparable group": "⇄ Palyginama grupė",
  "Exercises in this group": "Pratimai šioje grupėje",
  "＋ Add exercise…": "＋ Pridėti pratimą…",
  "No exercises in this group yet.": "Šioje grupėje dar nėra pratimų.",
  "Suggested (same muscle)": "Siūloma (tas pats raumuo)",
  "All exercises": "Visi pratimai",
  "Set the reference lift to ×1 and each other lift to how much LESS it moves for the same effort (e.g. 0.8 = 80%). Each lift's 1RM is divided by its weight so they sit on one curve.": "Nustatykite atskaitos pratimą į ×1, o kitus — kiek MAŽIAU jie pajuda tam pačiam pastangų lygiui (pvz., 0,8 = 80%). Kiekvieno pratimo 1RM dalijamas iš jo svorio, kad sutaptų vienoje kreivėje.",
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
  "Workout history": "Treniruočių istorija",
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
  "Prio": "Prior.",
  "priority": "prioritetas",
  "period": "laikotarpis",
  "vs group": "ar grupė",
  "per page": "puslapyje",
  "rep max": "kart. maks.",
  "add set": "pridėti seriją",
  "edit variant": "keisti variantą",
  "mult": "daugiklis",
  "day tags": "dienų žymos",
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
  "Tap ✕ to split a spelling into its own lift; tap ＋ to merge one back.": "Bakstelėkite ✕, kad atskirtumėte rašybą į atskirą pratimą; bakstelėkite ＋, kad sujungtumėte atgal.",
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
  // ---- StrengthLevel sync page ----
  "StrengthLevel sync": "StrengthLevel sinchronizavimas",
  "Open GitHub Action ↗": "Atidaryti GitHub Action ↗",
};

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE", "PRE"]);
const ATTRS = ["placeholder", "title", "aria-label", "data-sub"];

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

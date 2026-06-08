/**
 * App entry point. Thin glue only: load + validate data, read control state,
 * call the pure compute functions, and paint the DOM. No business logic lives
 * here — it's all in metrics.ts / aggregate.ts where it is tested.
 */
import { niceTicks } from "./chartAxis";
import {
  fmt, pct, bwMult, wr, MONTH_ABBR, shortDate, dowLetter,
  isoWeekNumber, todayIso, trainingDuration,
} from "./format";
import { hashHueHex, cellBgColor, cellBgGradient, heatLevel } from "./colorScale";
import { escapeHtml } from "./html";
// Tasks & roadmap (Settings overlay) are shown straight from the docs/ markdown,
// imported as raw text so the panel is always a projection of the files and can
// never drift from them (single source of truth).
import cleanupBacklogMd from "../docs/cleanup-backlog.md?raw";
import roadmapMd from "../docs/roadmap.md?raw";
import { loadJsonObject, saveJson } from "./storage";
import { FREQ_TIERS, frequencyTier } from "./frequencyTier";
import { S, type HeatColorDim, type IndexGroupMode } from "./appState";
import { mountSvgChart, getTimeCompact, setTimeCompact, type SvgChart, type SvgSeries, type SvgChartConfig, type SvgPoint } from "./svgChart";
import { loadData, type LoadedData } from "./dataSource";
import { parseCsvRows } from "./csv";
import {
  distinctExercises,
  selectableExercises,
  distinctUsers,
  exerciseCountsForUser,
  setsForUserExercise,
  setsByWeek,
  weeklySetStats,
  workoutsForUser,
  workoutsWithRestDays,
  periodsForUser,
  periodsWithRest,
  type HistoryPeriod,
  exerciseProgressByWeek,
  addedWeight1RM,
  effectiveE1RM,
  filterRecords,
  leaderboard,
  personalRecords,
  athleteSummary,
  withSyntheticGroups,
  buildActiveExerciseSet,
  decayedStrengthSeries,
  type SyntheticGroupDef,
  type PersonalRecord,
  type WorkoutDay,
  type ExerciseCount,
} from "./aggregate";
import {
  epley1RM,
  brzycki1RM,
  nuzzo1RM,
  benchPctForReps,
  benchRepsAtPct,
  BENCH_REPS_STUDY,
  estimate1RM,
  weightForReps,
  repsForWeight,
  predictedRir,
  effortClass,
  type EffortClass,
  setVolume,
  effectiveLoad,
  MAX_1RM_REPS,
  strengthRetention,
  grownStability,
  STRENGTH_DECAY,
  type OneRepMaxFormula,
} from "./metrics";
import { levelLabel, levelKey, defaultLevelScale, isInclineLevelExercise, levelInclineCm, inclineScale, type LevelDim } from "./variants";
import { resolveNote } from "./variationModel";
import { familyOf as baseFamilyOf, FAMILIES, defaultLeanTable } from "./variationConfig";
import { frontMuscles, backMuscles, type MusclePath } from "./muscleMapData";
import { mountPoseScene, type PoseScene } from "./poseScene";
import { mountPoseDraw, type PoseDraw } from "./poseDraw";
import { POSE_FRAMES } from "./poseFrames";
import type { SetRecord } from "./domain";
import { exerciseIdentity, type ExerciseIdentity } from "./domain";
import { FILTER_DIMS, FILTER_DIM_LABELS, filterExercises, type ExerciseFilterDim } from "./exerciseFilter";
import { exerciseMetaValues, movementDisplay, equipmentForExercise, JOINTS, MOVEMENTS, PLANES, type UserAssignments } from "./exerciseMeta";
import { classifyMixed, GRAVITY_MULT, type MachineMode, type MachineVerdict } from "./machine";
import { GRAPH_METRICS, graphCompatibilityNotes } from "./graphMetrics";
import { initI18n, getLang, setLang, type Lang } from "./i18n";
import { renderAnalyticsGraph } from "./analyticsGraph";
import { renderTestGraph, type TestPoint } from "./testGraph";
import { WORLD_RECORDS_SEED, scaleWr, type WrRef } from "./worldRecords";
import { duplicateAudit, relationshipAudit, type RelationshipDef } from "./exerciseAudit";
import { DEFAULT_GRAPH_CONFIG, type GraphConfig } from "./graphConfig";
import {
  type GraphPermissions,
  type GraphLevel,
  GRAPH_LEVEL_LABEL,
  MAX_GRAPH_LEVEL,
  ALL_GRAPH_METRIC_IDS,
  allowedMetricsFor,
  isMetricAllowed,
  levelOf,
  metricsAllowedForScope,
  exercisesBlockingMetric,
  normalizePermissions,
  cycleMetricLevel as cyclePermLevel,
  setAllMetrics as setAllPermMetrics,
} from "./graphPermissions";
import {
  ATHLETES,
  type AthleteProfile,
  EXERCISE_BW_COEFF,
  type BodyFatDist,
  defaultBodyFatDist,
  normalizeBodyFatDist,
  nffmiRange,
  bodyMassRanges,
  bodyComposition,
  naturalPotential,
  defaultBwCoeff,
  realPullupWeight,
  exerciseCategory,
  exerciseCategories,
  muscleGroup,
  COMBINABLE_GROUPS,
  COMPARABLE_GROUPS,
  tagsForExercise,
  membersOfGroup,
  type RegistryTag,
  LIST_CATEGORIES,
  exerciseCode,
  exerciseCodesFor,
  exerciseTier,
  TRAINING_CATEGORIES,
  type TrainingCategory,
  type MuscleGroup,
  type ExerciseTier,
  DISCIPLINES,
  type Discipline,
  exerciseDiscipline,
  exerciseDisciplines,
} from "./profile";
import { DEFAULT_FORMULA } from "./config";
import { CHANGELOG, CURRENT_VERSION, WEBSITE_SP, WEBSITE_EXACT_SP, TOTAL_LOG_SP, COMPONENTS, fibSp, countReleases, buildSpTimeline, categoryBreakdown, type Release } from "./changelog";
import { versionParts, displayVersion } from "./versionName";
import { collectBackup, parseBackup, applyBackup, backupToText, backupFilename, clearCache } from "./backup";
import defaultCache from "./data/defaultCache.json";

// Bundled "global cache" — the owner's baseline setup (overrides, world records,
// difficulty factors, manual/edited sets…). On any FRESH browser (or one missing a
// key) we seed it in; existing keys are left untouched, so a device's own later
// edits always win. Runs before any colosseum.* loader below reads storage.
(function seedDefaultCache() {
  try {
    for (const [k, v] of Object.entries(defaultCache as Record<string, string>))
      if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
  } catch {
    /* storage may be unavailable (e.g. private mode) */
  }
})();

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const els = {
  status: $("status"),
  settingsBtn: $<HTMLButtonElement>("settingsBtn"),
  themeBtn: $<HTMLButtonElement>("themeBtn"),
  viewAsSelect: $<HTMLSelectElement>("viewAsSelect"),
  authBtn: $<HTMLButtonElement>("authBtn"),
  showLegsAll: $<HTMLInputElement>("showLegsAll"),
  showAloneRings: $<HTMLInputElement>("showAloneRings"),
  decayStrength: $<HTMLInputElement>("decayStrength"),
  simplifiedToggle: $<HTMLInputElement>("simplifiedToggle"),
  sAnalysis: $("sAnalysis"),
  settingsPanel: $("settingsPanel"),
  exercise: $<HTMLSelectElement>("exercise"),
  rank: $<HTMLSelectElement>("rank"),
  sexFilter: $<HTMLSelectElement>("sexFilter"),
  bwMin: $<HTMLInputElement>("bwMin"),
  bwMax: $<HTMLInputElement>("bwMax"),
  axisMin: $<HTMLInputElement>("axisMin"),
  axisMax: $<HTMLInputElement>("axisMax"),
  axisReset: $<HTMLButtonElement>("axisReset"),
  formula: $<HTMLSelectElement>("formula"),
  excludeDropsets: $<HTMLInputElement>("excludeDropsets"),
  lbTitle: $("lbTitle"),
  lbTable: $<HTMLTableElement>("lbTable"),
  prTable: $<HTMLTableElement>("prTable"),
  prCount: $("prCount"),
  health: $("health"),
  backupNowBtn: $<HTMLButtonElement>("backupNowBtn"),
  restoreBtn: $<HTMLButtonElement>("restoreBtn"),
  clearCacheBtn: $<HTMLButtonElement>("clearCacheBtn"),
  restoreFile: $<HTMLInputElement>("restoreFile"),
  autoBackupToggle: $<HTMLInputElement>("autoBackupToggle"),
  autoBackupHint: $("autoBackupHint"),
  healthBtn: $<HTMLButtonElement>("healthBtn"),
  healthBadge: $("healthBadge"),
  healthPage: $("healthPage"),
  healthClose: $<HTMLButtonElement>("healthClose"),
  changelogBtn: $<HTMLButtonElement>("changelogBtn"),
  changelogVer: $("changelogVer"),
  changelog: $("changelog"),
  backlogBtn: $<HTMLButtonElement>("backlogBtn"),
  backlogPage: $("backlogPage"),
  backlogClose: $<HTMLButtonElement>("backlogClose"),
  backlog: $("backlog"),
  testingBtn: $<HTMLButtonElement>("testingBtn"),
  testingPage: $("testingPage"),
  testingClose: $<HTMLButtonElement>("testingClose"),
  testGraphChart: $("testGraphChart"),
  modelBtn: $<HTMLButtonElement>("modelBtn"),
  modelPage: $("modelPage"),
  modelClose: $<HTMLButtonElement>("modelClose"),
  modelEditor: $("modelEditor"),
  modelResetAll: $<HTMLButtonElement>("modelResetAll"),
  exInfoPage: $("exInfoPage"),
  exInfoTitle: $("exInfoTitle"),
  exInfoBack: $<HTMLButtonElement>("exInfoBack"),
  exInfoGotoIndex: $<HTMLButtonElement>("exInfoGotoIndex"),
  exInfoGotoAnl: $<HTMLButtonElement>("exInfoGotoAnl"),
  exInfoBody: $("exInfoBody"),
  athlete: $<HTMLSelectElement>("athlete"),
  athleteChips: $("athleteChips"),
  athleteSexFilter: $("athleteSexFilter"),
  athleteProfile: $("athleteProfile"),
  bodyStatsSummary: $("bodyStatsSummary"),
  athleteStats: $("athleteStats"),
  momentum: $("momentum"),
  trainBreakdown: $("trainBreakdown"),
  muscleMapBody: $("muscleMapBody"),
  athleteTitle: $("athleteTitle"),
  athleteTable: $<HTMLTableElement>("athleteTable"),
  exerciseRecord: $("exerciseRecord"),
  exerciseTopSets: $("exerciseTopSets"),
  exerciseWeekly: $("exerciseWeekly"),
  exerciseTargets: $("exerciseTargets"),
  exerciseStats: $<HTMLDetailsElement>("exerciseStats"),
  exerciseCalc: $<HTMLDetailsElement>("exerciseCalc"),
  ecalcBasis: $("ecalcBasis"),
  ecalcRows: $<HTMLTableSectionElement>("ecalcRows"),
  ecalcAddRow: $<HTMLButtonElement>("ecalcAddRow"),
  ecalcNote: $("ecalcNote"),
  exCombineBar: $("exCombineBar"),
  exLevels: $("exLevels"),
  exerciseFilter: $("exerciseFilter"),
  exercisesTabs: $("exercisesTabs"),
  exFiltersBtn: $<HTMLButtonElement>("exFiltersBtn"),
  exCatBar: $("exCatBar"),
  exSearchBar: $("exSearchBar"),
  exerciseCompare: $("exerciseCompare"),
  compareChips: $("compareChips"),
  compareSearch: $<HTMLInputElement>("compareSearch"),
  compareSelCount: $("compareSelCount"),
  compareCats: $("compareCats"),
  compareTiers: $("compareTiers"),
  compareClear: $<HTMLButtonElement>("compareClear"),
  compareNote: $("compareNote"),
  compareSets: $("compareSets"),
  exerciseSearch: $<HTMLInputElement>("exerciseSearch"),
  exerciseNotTrained: $<HTMLInputElement>("exerciseNotTrained"),
  exerciseShowThird: $<HTMLInputElement>("exerciseShowThird"),
  exerciseRange: $<HTMLDetailsElement>("exerciseRange"),
  exPeriodBar: $("exPeriodBar"),
  exerciseSort: $("exerciseSort"),
  exercisesPager: $("exercisesPager"),
  workoutsTitle: $("workoutsTitle"),
  workoutCalendar: $("workoutCalendar"),
  workoutsTable: $<HTMLTableElement>("workoutsTable"),
  workoutsPager: $("workoutsPager"),
  workoutViewToggle: $<HTMLButtonElement>("workoutViewToggle"),
  workoutShowToggle: $<HTMLButtonElement>("workoutShowToggle"),
  workoutGrouping: $<HTMLSelectElement>("workoutGrouping"),
  workoutsPageBtn: $<HTMLButtonElement>("workoutsPageBtn"),
  restToggle: $<HTMLButtonElement>("restToggle"),
  addSetsToggle: $<HTMLButtonElement>("addSetsToggle"),
  aloneTagToggle: $<HTMLButtonElement>("aloneTagToggle"),
  woShowAllToggle: $<HTMLButtonElement>("woShowAllToggle"),
  aloneFilter: $<HTMLButtonElement>("aloneFilter"),
  addAthlete: $<HTMLSelectElement>("addAthlete"),
  addExercise: $<HTMLInputElement>("addExercise"),
  addExerciseList: $("addExerciseList"),
  addArmPos: $<HTMLSelectElement>("addArmPos"),
  addArmPosField: $("addArmPosField"),
  addVariant: $<HTMLInputElement>("addVariant"),
  addVariantField: $("addVariantField"),
  addVariantLabel: $("addVariantLabel"),
  addNote: $<HTMLInputElement>("addNote"),
  addWeight: $<HTMLInputElement>("addWeight"),
  addReps: $<HTMLInputElement>("addReps"),
  addSets: $<HTMLInputElement>("addSets"),
  addDate: $<HTMLInputElement>("addDate"),
  addSubmit: $<HTMLButtonElement>("addSubmit"),
  addHint: $("addHint"),
  addCount: $("addCount"),
  addTable: $<HTMLTableElement>("addTable"),
  addExport: $<HTMLButtonElement>("addExport"),
  addImport: $<HTMLButtonElement>("addImport"),
  addImportFile: $<HTMLInputElement>("addImportFile"),
  summariseBtn: $<HTMLButtonElement>("summariseBtn"),
  summaryOut: $("summaryOut"),
  bwTitle: $("bwTitle"),
  activeSetBar: $("activeSetBar"),
  bwGroupBar: $("bwGroupBar"),
  bwGroups: $("bwGroups"),
  statsEditBody: $("statsEditBody"),
  mergeList: $("mergeList"),
  calcWeight: $<HTMLInputElement>("calcWeight"),
  calcReps: $<HTMLInputElement>("calcReps"),
  calcBw: $<HTMLInputElement>("calcBw"),
  calcCoeff: $<HTMLInputElement>("calcCoeff"),
  calcOut: $("calcOut"),
  calcCurveNote: $("calcCurveNote"),
  decayCurveNote: $("decayCurveNote"),
  testAthlete: $<HTMLSelectElement>("testAthlete"),
  testExercise: $<HTMLSelectElement>("testExercise"),
  testPickHint: $("testPickHint"),
  calcTabs: $("calcTabs"),
  dataTableWrap: $("dataTableWrap"),
  dataPager: $("dataPager"),
  refreshStatus: $("refreshStatus"),
  refreshStatusBtn: $<HTMLButtonElement>("refreshStatusBtn"),
  dataSearch: $<HTMLInputElement>("dataSearch"),
  dataExercise: $<HTMLSelectElement>("dataExercise"),
  dataUser: $<HTMLSelectElement>("dataUser"),
  otherSheet: $("otherSheet"),
  groupsAthlete: $<HTMLSelectElement>("groupsAthlete"),
  groupsBody: $("groupsBody"),
  teamChips: $("teamChips"),
  teamBody: $("teamBody"),
};

let data: LoadedData;
let calcCurveSvg: SvgChart | null = null; // Test-tab weight-vs-reps diagram (SVG engine)
let decayCurveSvg: SvgChart | null = null; // Test-tab strength-fade diagram (SVG engine)
let compareSvg: SvgChart | null = null; // Exercises list multi-exercise overlay (SVG engine)
const compareSelected = new Set<string>(); // exercises ticked for the overlay graph
let compareChipQuery = ""; // search box text filtering the compare chips
let compareView: "trend" | "perset" = "trend"; // 1RM-trend lines vs per-set weight→1RM bars

const PAGE_SIZE = 50; // List & stats page size

/** Flip the light/dark theme and remember it. The charts re-theme automatically
 * (their structural colours are CSS-variable-backed classes), so no re-render. */
function setTheme(dark: boolean) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  try { localStorage.setItem("colosseum.theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  els.themeBtn.textContent = dark ? "☀ Light mode" : "🌙 Dark mode";
  els.themeBtn.setAttribute("aria-pressed", String(dark));
}

/** Which view the dashboard is showing: "admin" (the default, full access) or
 * "user". Admin sees every "Other" destination; user sees only the Guide. */
// Three view types (none enforced yet): "admin" (full access), "user" (locked to
// a chosen athlete) and "loggedout" (not signed in → Adomas only).
type ViewMode = "admin" | "user" | "loggedout";
let viewMode: ViewMode = (() => {
  try { const v = localStorage.getItem("colosseum.viewMode"); return v === "user" || v === "loggedout" ? v : "admin"; }
  catch { return "admin"; }
})();
/** In user view, which athlete the dashboard is locked to (their username), as
 * chosen in Settings → "View as". null = not yet chosen → falls back to Adomas. */
let viewUser: string | null = (() => {
  try { return localStorage.getItem("colosseum.viewUser.v1"); } catch { return null; }
})();
/** Top-tab panels a non-admin is allowed to see; everything else in the "Other"
 * sheet is hidden for them, leaving just the Guide. */
// Both analysis pages are allowed in non-admin views; the Simplified-view toggle
// (defaulting ON outside admin) decides which one the Analysis button opens.
const USER_VIEW_TABS = new Set(["analysis", "s-analysis", "athlete", "guide"]);
/** Which analysis page the bottom "Analysis" button opens: simplified S-ANL when the
 * Simplified-view toggle is on, else the full ANL. */
function analysisTabName(): string {
  return simplifiedView ? "s-analysis" : "analysis";
}
function setViewMode(mode: ViewMode) {
  viewMode = mode;
  try { localStorage.setItem("colosseum.viewMode", mode); } catch { /* ignore */ }
  const locked = lockedUsername(); // null in admin, else the locked athlete
  // The mode toggle in the header shows the current view; the Settings dropdown +
  // auth button mirror it.
  els.viewAsSelect.value = mode === "admin" ? "admin" : mode === "loggedout" ? "loggedout" : (locked ?? "admin");
  els.authBtn.textContent = mode === "loggedout" ? "Log in" : "Log out";
  // The "Other" sheet: non-admin keeps only the Guide; admin shows everything.
  for (const item of els.otherSheet.querySelectorAll<HTMLButtonElement>(".other-item")) {
    item.hidden = mode !== "admin" && item.dataset.tab !== "guide";
  }
  // Outside admin, lock the athlete to the locked user (only their chip is
  // pressable, see syncAthleteChips) and force the selection there.
  if (mode !== "admin") {
    if (locked && els.athlete.value !== locked) { els.athlete.value = locked; renderAthlete(); }
    // If we entered a restricted view from an admin-only panel, drop back to the
    // athlete (Workouts) view so nothing restricted stays on screen.
    const current = (document.querySelector<HTMLElement>(".tab-panel:not([hidden])")?.id ?? "").replace(/^tab-/, "");
    if (!USER_VIEW_TABS.has(current)) {
      switchTopTab(analysisTabName()); // analysis home (simplified by default outside admin)
    }
  }
  syncAthleteChips(); // lock the other athletes' chips outside admin (unlock in admin)
  renderViewSwitch(); // reflect the new mode in the quick switcher
}

/** Switch the Simplified ⇄ Advanced detail level (the analysis home + bottom-nav
 * label), keep the Settings checkbox + the quick switcher in sync. */
function setSimplified(on: boolean): void {
  simplifiedView = on;
  try { localStorage.setItem("colosseum.simplifiedView", on ? "1" : "0"); } catch { /* ignore */ }
  if (els.simplifiedToggle) els.simplifiedToggle.checked = on;
  const current = (document.querySelector<HTMLElement>(".tab-panel:not([hidden])")?.id ?? "").replace(/^tab-/, "");
  if (current === "analysis" || current === "s-analysis") switchTopTab(analysisTabName());
  updateBottomNav();
  renderViewSwitch();
}

/** Build the quick view switcher: TWO compact cycling toggles — one for the mode
 * (Admin → User → Spectator) and one for the detail level (Simplified ⇄ Advanced).
 * Each shows its current value and advances on tap. Soft, owner-facing switch. */
function renderViewSwitch(): void {
  const box = document.getElementById("viewSwitch");
  if (!box) return;
  const modeLabel = viewMode === "admin" ? "Admin" : viewMode === "user" ? "User" : "Spec";
  const detailLabel = simplifiedView ? "Simple" : "Adv";
  box.innerHTML =
    `<button type="button" class="vs-toggle" data-vcycle="mode" title="Switch view: Admin · User · Spectator">${modeLabel}</button>` +
    `<button type="button" class="vs-toggle" data-vcycle="detail" title="Switch detail: Simplified · Advanced">${detailLabel}</button>`;
}

/** The "Colosseum" title acts as a Back-to-home button (jumps to the analysis
 * page; on home it just re-lands there). Click or Enter/Space. */
function goHome(): void { switchTopTab(analysisTabName()); }
function setupBrandTitle(): void {
  const el = document.getElementById("brandTitle");
  el?.addEventListener("click", goHome);
  el?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") { e.preventDefault(); goHome(); }
  });
}

/** Wire the quick switcher (delegated, survives re-renders). */
function setupViewSwitch(): void {
  setupBrandTitle();
  document.getElementById("viewSwitch")?.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".vs-toggle");
    if (!b) return;
    if (b.dataset.vcycle === "detail") {
      // Decide from the page ACTUALLY shown (not the saved flag, which can drift),
      // so one tap always flips simplified ⇄ full — never a wasted first tap.
      const onSimplified = document.getElementById("tab-s-analysis")?.hidden === false;
      const onFull = document.getElementById("tab-analysis")?.hidden === false;
      setSimplified(onSimplified ? false : onFull ? true : !simplifiedView);
      return;
    }
    // Mode toggle cycles admin → user → spectator → admin.
    if (viewMode === "admin") setViewAs(els.athlete.value || adomasUsername() || "");
    else if (viewMode === "user") setViewAs("loggedout");
    else setViewAs("admin");
  });
}

/** Settings → "View as": admin (everything), logged out (Adomas), or lock to one athlete. */
function setViewAs(value: string) {
  if (value === "admin") return setViewMode("admin");
  if (value === "loggedout") return setViewMode("loggedout");
  viewUser = value;
  try { localStorage.setItem("colosseum.viewUser.v1", value); } catch { /* ignore */ }
  setViewMode("user");
}

/** The athlete the current view is locked to: null in admin, the chosen user in
 * user view, Adomas when logged out. */
function lockedUsername(): string | null {
  if (viewMode === "admin") return null;
  return viewMode === "loggedout" ? adomasUsername() : userViewUsername();
}

/** Adomas's username, resolved from the loaded options (the logged-out default). */
function adomasUsername(): string | null {
  const opts = [...els.athlete.options];
  const a = opts.find((o) => o.value.toLowerCase().includes("adomas") || o.text.toLowerCase().includes("adomas"));
  return a?.value ?? opts[0]?.value ?? null;
}

/** The athlete a "user" view is locked to: the one chosen in Settings if it's a
 * real athlete, else Adomas as the default. */
function userViewUsername(): string | null {
  const opts = [...els.athlete.options];
  if (viewUser && opts.some((o) => o.value === viewUser)) return viewUser;
  return adomasUsername();
}

/** Display name for an athlete username (from the loaded options). */
function nameForUsername(username: string | null): string {
  return [...els.athlete.options].find((o) => o.value === username)?.text ?? "User";
}

/* ---- Decorative auth (NOT enforced): log in / log out + the login page ----
 * Logging in just enters admin view; logging out drops to the logged-out view
 * (Adomas only). The login page (the gate) can be re-opened any time. The
 * `signedIn` flag only governs the one-time first-visit gate, never the view. */
function showLoginPage(): void {
  document.documentElement.classList.remove("signed-in"); // override the "always hide" rule
  populateLoginAthletes(); // refresh the name picker from the loaded roster
  const gate = document.getElementById("loginGate");
  if (gate) gate.hidden = false;
  const err = document.getElementById("loginErr");
  if (err) err.hidden = true; // clear any stale "wrong password"
  const pass = document.getElementById("loginPass") as HTMLInputElement | null;
  if (pass) pass.value = ""; // clear any stale password
  document.body.classList.add("locked");
  (document.getElementById("loginUser") as HTMLSelectElement | null)?.focus();
}
function hideLoginPage(): void {
  const gate = document.getElementById("loginGate");
  if (gate) gate.hidden = true;
  document.body.classList.remove("locked");
  try { localStorage.setItem("colosseum.signedIn", "1"); } catch { /* ignore */ }
  document.documentElement.classList.add("signed-in"); // stays hidden from now on
}
/** Admin password. NOTE: client-side only — the site is public and this code is
 * readable, so it's a soft gate, not real security. */
const ADMIN_PASSWORD = "ag";
/** Fill the login screen's name picker with "Admin" + every athlete, mirroring
 * the loaded #athlete options. Safe to call repeatedly (keeps the selection). */
function populateLoginAthletes(): void {
  const sel = document.getElementById("loginUser") as HTMLSelectElement | null;
  if (!sel) return;
  const keep = sel.value;
  sel.innerHTML =
    `<option value="admin">Admin — everything</option>` +
    [...els.athlete.options].map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.text)}</option>`).join("");
  if (keep && [...sel.options].some((o) => o.value === keep)) sel.value = keep;
}
/** The password expected for a login choice: the admin password for "admin",
 * else the first two letters of that athlete's name, lower-cased. */
function expectedLoginPass(choice: string): string {
  if (choice === "admin") return ADMIN_PASSWORD;
  return nameForUsername(choice).trim().slice(0, 2).toLowerCase();
}
/** "Log in" — checks the chosen name's password (first two letters of the name;
 * admin uses its own). On a match, enter that athlete's user view (or admin). */
function logIn(): void {
  const choice = (document.getElementById("loginUser") as HTMLSelectElement | null)?.value ?? "admin";
  const pass = (document.getElementById("loginPass") as HTMLInputElement | null)?.value ?? "";
  const err = document.getElementById("loginErr");
  if (pass.trim().toLowerCase() !== expectedLoginPass(choice)) {
    if (err) err.hidden = false; // show "wrong password"
    (document.getElementById("loginPass") as HTMLInputElement | null)?.focus();
    return;
  }
  if (err) err.hidden = true;
  hideLoginPage();
  if (choice === "admin") setViewMode("admin");
  else setViewAs(choice); // lock the dashboard to that athlete's user view
}
/** "View as spectator" — leave the sign-in screen into the logged-out (Adomas-only) view. */
function viewAsSpectator(): void { hideLoginPage(); setViewMode("loggedout"); }

// Number / date / weekday display helpers (fmt, pct, bwMult, wr, shortDate,
// dowLetter, isoWeekNumber, todayIso, trainingDuration) are pure and live in
// ./format so they can be unit-tested without the DOM. Imported at the top.

// "Current strength" mode: when on, 1RM achievements fade with time off the lift
// (detraining model in metrics.ts) instead of showing the all-time peak. Toggled
// in Settings and remembered on this device.
let decayStrength = localStorage.getItem("colosseum.decayStrength") === "1";
/** Reference date for the detraining model — today's date when "current
 * strength" is on, otherwise undefined (keep all-time peaks). Passed into the
 * leaderboard / personal-record aggregators. */
const strengthAsOf = (): string | undefined => (decayStrength ? todayIso() : undefined);

function currentFormula(): OneRepMaxFormula {
  const v = els.formula.value;
  return v === "brzycki" || v === "nuzzo" ? v : "epley";
}

/** Read a number input, returning null when empty or unparseable (negatives kept). */
function numInput(el: HTMLInputElement): number | null {
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : null;
}

/**
 * Coliseum athlete filter: keep an athlete only if they match the chosen sex
 * (Everyone / Men / Women) and fall inside the bodyweight range, when set. An
 * athlete with no profile is dropped as soon as any of these filters is active,
 * since we can't confirm they match.
 */
function athletePassesColiseum(username: string): boolean {
  const sex = els.sexFilter.value; // "all" | "m" | "f"
  const bwMin = numInput(els.bwMin);
  const bwMax = numInput(els.bwMax);
  if (sex === "all" && bwMin === null && bwMax === null) return true;
  const p = athProfile(username);
  if (!p) return false; // a filter is active but we have nothing to match on
  if (sex !== "all" && p.sex !== sex) return false;
  if (bwMin !== null && p.weight < bwMin) return false;
  if (bwMax !== null && p.weight > bwMax) return false;
  return true;
}

/** Short human label for the active Coliseum filters, for the subtitle (or ""). */
function coliseumFilterNote(): string {
  const parts: string[] = [];
  if (els.sexFilter.value === "m") parts.push("men only");
  else if (els.sexFilter.value === "f") parts.push("women only");
  const bwMin = numInput(els.bwMin);
  const bwMax = numInput(els.bwMax);
  if (bwMin !== null || bwMax !== null) {
    parts.push(`${bwMin ?? "…"}–${bwMax ?? "…"} kg`);
  }
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

// ---- Bodyweight coefficients: the single source of truth, editable + saved ----
// Starts from the profile.ts defaults; user edits are layered on top and stored
// in the browser so they survive reloads. coeffFor() is read everywhere.
const COEFF_STORE_KEY = "colosseum.bwCoeffs.v1";
const COEFF_RANGE_KEY = "colosseum.bwCoeffRange.v1";
const coeffOverrides: Record<string, number> = loadCoeffOverrides();
// The bodyweight part can be set as a RANGE (a lift's leverage varies by variation);
// the value actually used in the 1RM is the average of min & max. A single-value
// edit (the Index table) and a range edit are mutually exclusive — the last one wins.
const coeffRanges: Record<string, { min: number; max: number }> = loadCoeffRanges();

function loadCoeffOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COEFF_STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}
function loadCoeffRanges(): Record<string, { min: number; max: number }> {
  try {
    const raw = localStorage.getItem(COEFF_RANGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { min: number; max: number }>) : {};
  } catch {
    return {};
  }
}

/** The base (non-range) bodyweight part: the owner's single pin, else the heuristic. */
function coeffBase(exerciseName: string): number {
  if (Object.prototype.hasOwnProperty.call(coeffOverrides, exerciseName)) return coeffOverrides[exerciseName]!;
  return EXERCISE_BW_COEFF[exerciseName] ?? defaultBwCoeff(exerciseName);
}

/** The bodyweight part used everywhere — the average of the range if one is set. */
function coeffFor(exerciseName: string): number {
  const r = coeffRanges[exerciseName];
  if (r) return Math.round(((r.min + r.max) / 2) * 1000) / 1000;
  return coeffBase(exerciseName);
}

/** The min/max to show in the editor — the override range, else the base as both. */
function coeffRangeFor(exerciseName: string): { min: number; max: number } {
  const r = coeffRanges[exerciseName];
  if (r) return r;
  const b = coeffBase(exerciseName);
  return { min: b, max: b };
}

function setCoeff(exerciseName: string, value: number) {
  coeffOverrides[exerciseName] = value;
  delete coeffRanges[exerciseName]; // a single value supersedes any range
  saveCoeffs();
}

/** Set the bodyweight-part range (min/max). The average is what the 1RM uses. */
function setCoeffRange(exerciseName: string, min: number, max: number) {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  coeffRanges[exerciseName] = { min: lo, max: hi };
  delete coeffOverrides[exerciseName]; // a range supersedes a single pin
  saveCoeffs();
}

function saveCoeffs() {
  try {
    localStorage.setItem(COEFF_STORE_KEY, JSON.stringify(coeffOverrides));
    localStorage.setItem(COEFF_RANGE_KEY, JSON.stringify(coeffRanges));
  } catch {
    /* storage may be unavailable (e.g. private mode) — edits still apply this session */
  }
}

// ---- Metadata overrides: Category / Muscle group / Tier, editable + saved ----
// Same layering as the coefficient: profile.ts derives a default from the lift's
// name; the owner's per-lift edits are stored here and win. catFor/mgFor/tierFor
// are the read points used across the app so an edit shows everywhere.
const META_OVERRIDE_KEY = "colosseum.metaOverrides.v1";
type MetaKind = "cat" | "mg" | "tier" | "disc";
// An exercise can fit SEVERAL disciplines / muscle groups / tiers, so each override
// is a LIST. The legacy single maps are kept in sync with each list's first (primary)
// value, so older backups and every single-value reader keep working. ("cat" is the
// old internal training-category dimension; "disc" is the owner-facing Discipline.)
type MetaOverrides = {
  cat?: Record<string, string>; mg?: Record<string, string>; tier?: Record<string, string>; disc?: Record<string, string>;
  catSet?: Record<string, string[]>; mgSet?: Record<string, string[]>; tierSet?: Record<string, string[]>; discSet?: Record<string, string[]>;
  /** Per-exercise MUSCLE INVOLVEMENT level 0–4 per muscle group: 0 none · 1 tendons ·
   * 2 maintain muscle · 3 counts as exercise (the level needed to appear in that
   * muscle's category) · 4 top exercise. Absent muscles fall to a derived default. */
  mgLevel?: Record<string, Record<string, number>>;
};
const metaOverrides: MetaOverrides = (() => {
  const empty = (): MetaOverrides => ({ cat: {}, mg: {}, tier: {}, disc: {}, catSet: {}, mgSet: {}, tierSet: {}, discSet: {}, mgLevel: {} });
  try {
    const raw = localStorage.getItem(META_OVERRIDE_KEY);
    const o = raw ? (JSON.parse(raw) as MetaOverrides) : {};
    const m: MetaOverrides = { cat: o.cat ?? {}, mg: o.mg ?? {}, tier: o.tier ?? {}, disc: o.disc ?? {}, catSet: o.catSet ?? {}, mgSet: o.mgSet ?? {}, tierSet: o.tierSet ?? {}, discSet: o.discSet ?? {}, mgLevel: o.mgLevel ?? {} };
    // Migrate any legacy single override into its list form (once).
    for (const k of ["cat", "mg", "tier", "disc"] as MetaKind[]) {
      const single = m[k]!, set = m[`${k}Set` as const]!;
      for (const [name, v] of Object.entries(single)) if (v && !set[name]?.length) set[name] = [v];
    }
    // The "Skill" discipline was removed (it's just Calisthenics) — rewrite any saved
    // Skill discipline overrides so old backups don't show a dangling Skill group.
    const fixDisc = (v: string) => (v === "Skill" ? "Calisthenics" : v);
    for (const [name, v] of Object.entries(m.disc!)) m.disc![name] = fixDisc(v);
    for (const [name, arr] of Object.entries(m.discSet!)) m.discSet![name] = [...new Set(arr.map(fixDisc))];
    return m;
  } catch {
    return empty();
  }
})();
function saveMetaOverrides() {
  saveJson(META_OVERRIDE_KEY, metaOverrides);
}
/** The owner's full override LIST for one dimension, or null if none is set. */
function metaSet(kind: MetaKind, name: string): string[] | null {
  const arr = metaOverrides[`${kind}Set` as const]![name];
  return arr && arr.length ? arr : null;
}
/** All training categories a lift belongs to — the owner's list, else the single default. */
function catsFor(name: string): TrainingCategory[] {
  return (metaSet("cat", name) as TrainingCategory[]) ?? [exerciseCategory(name)];
}
/** This lift's MUSCLE INVOLVEMENT level (0–4) for one muscle: explicit override, else
 * derived from the legacy membership (primary muscle → 4 top, other members → 3
 * counts, non-members → 0). 0 none · 1 tendons · 2 maintain · 3 counts · 4 top. */
function mgLevelOf(name: string, muscle: MuscleGroup): number {
  const lv = metaOverrides.mgLevel?.[name];
  if (lv && muscle in lv) return lv[muscle]!;
  const base = (metaSet("mg", name) as MuscleGroup[]) ?? [muscleGroup(name)];
  return base.includes(muscle) ? (muscle === base[0] ? 4 : 3) : 0;
}
/** Muscle groups a lift COUNTS toward (level ≥ 3), top-first — the membership every
 * grouping/category uses. Falls back to the primary so a lift is never group-less. */
function mgsFor(name: string): MuscleGroup[] {
  // Fast path: no per-muscle levels set → the legacy override list (or auto default).
  if (!metaOverrides.mgLevel?.[name]) return (metaSet("mg", name) as MuscleGroup[]) ?? [muscleGroup(name)];
  const mem = MUSCLE_GROUPS.filter((m) => mgLevelOf(name, m) >= 3).sort((a, b) => mgLevelOf(name, b) - mgLevelOf(name, a));
  if (mem.length) return mem;
  const base = (metaSet("mg", name) as MuscleGroup[]) ?? [muscleGroup(name)];
  return [base[0] ?? muscleGroup(name)];
}
/** Set one muscle's involvement level (0–4); persists + keeps it in the backup. */
function setMgLevel(name: string, muscle: MuscleGroup, level: number) {
  const all = metaOverrides.mgLevel ?? (metaOverrides.mgLevel = {});
  (all[name] ?? (all[name] = {}))[muscle] = level;
  saveMetaOverrides();
}
/** Clear this lift's muscle-level overrides (back to the automatic guess). */
function resetMgLevel(name: string) {
  if (metaOverrides.mgLevel) delete metaOverrides.mgLevel[name];
  saveMetaOverrides();
}
/** All tiers a lift belongs to — the owner's list, else the single default. */
function tiersFor(name: string): ExerciseTier[] {
  return (metaSet("tier", name) as ExerciseTier[]) ?? [exerciseTier(name)];
}
/** All disciplines a lift belongs to — the owner's list, else the single default. */
function discsFor(name: string): Discipline[] {
  return (metaSet("disc", name) as Discipline[]) ?? exerciseDisciplines(name);
}
/** Primary (first) of each dimension — what every single-value reader uses. */
function catFor(name: string): TrainingCategory { return catsFor(name)[0]!; }
function mgFor(name: string): MuscleGroup { return mgsFor(name)[0]!; }
function tierFor(name: string): ExerciseTier { return tiersFor(name)[0]!; }
/** The auto-default value for a dimension (used when seeding a fresh toggle). */
function metaDefault(kind: MetaKind, name: string): string {
  return kind === "cat" ? exerciseCategory(name) : kind === "mg" ? muscleGroup(name) : kind === "disc" ? exerciseDiscipline(name) : exerciseTier(name);
}
/** Replace the whole override list for one dimension (empty → back to auto default). */
function setMetaSet(kind: MetaKind, name: string, values: string[]) {
  const set = metaOverrides[`${kind}Set` as const]!, single = metaOverrides[kind]!;
  if (!values.length) { delete set[name]; delete single[name]; }
  else { set[name] = values; single[name] = values[0]!; }
  saveMetaOverrides();
}
/** Toggle one value in a dimension's list (starting from whatever is shown now). */
function toggleMetaOverride(kind: MetaKind, name: string, value: string) {
  if (!value || value === "auto") { setMetaSet(kind, name, []); return; } // ↺ reset to default
  const effective = metaSet(kind, name) ?? [metaDefault(kind, name)];
  const next = new Set(effective);
  if (next.has(value)) next.delete(value); else next.add(value);
  setMetaSet(kind, name, [...next]);
}
/** All muscle-group choices for the editor dropdown. */
const MUSCLE_GROUPS: MuscleGroup[] = [
  "Quads", "Hamstrings", "Glutes", "Abductors", "Adductors", "Calves", "Lower back", "Upper back", "Lats",
  "Chest", "Shoulders", "Biceps", "Triceps", "Forearms", "Core",
];
const TIER_LABELS: Record<ExerciseTier, string> = { main: "Primary", second: "Secondary", third: "Tertiary" };

// ---- "Not comparable" NOTES (owner-marked, per note — not whole exercises) ----
// A specific variation can be unmeasurable by 1RM/volume — e.g. a static
// handstand push-up where you push against the floor and nothing moves. Marking
// that NOTE drops 1RM & volume on the sets carrying it (those numbers are
// meaningless) while their REPS and SETS still count. Other sets of the same lift
// are untouched. Keyed exercise|normNote (defined where normNote is). Saved here.
const NOT_COMPARABLE_KEY = "colosseum.notComparableNotes.v1";
const notComparableNotes: Set<string> = (() => {
  try {
    const a = JSON.parse(localStorage.getItem(NOT_COMPARABLE_KEY) ?? "[]");
    return new Set<string>(Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set<string>();
  }
})();
function isNoteNotComparable(exerciseName: string, note: string): boolean {
  return notComparableNotes.has(`${exerciseName}|${normNote(note)}`);
}
function setNoteNotComparable(exerciseName: string, note: string, on: boolean): void {
  const k = `${exerciseName}|${normNote(note)}`;
  if (on) notComparableNotes.add(k);
  else notComparableNotes.delete(k);
  saveJson(NOT_COMPARABLE_KEY, [...notComparableNotes]);
}

// ---- Exercise code overrides (the short codes shown in lists/tooltips) ----
// Same layering as the coefficients: profile.ts derives a default code, the
// owner's edits in the Codes tab are stored here and win. codeFor() is the single
// read point; exerciseCodesFor(names, codeFor) resolves any code clashes.
const CODE_STORE_KEY = "colosseum.exerciseCodes.v1";
const codeOverrides: Record<string, string> = loadCodeOverrides();

function loadCodeOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CODE_STORE_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

/** The code shown for an exercise: the owner's override if set, else the default. */
function codeFor(exerciseName: string): string {
  const o = codeOverrides[exerciseName];
  return o && o.trim() ? o : exerciseCode(exerciseName);
}

function saveCodeOverrides() {
  saveJson(CODE_STORE_KEY, codeOverrides);
}

/** Set or clear (blank → back to default) one exercise's code override. */
function setCodeOverride(exerciseName: string, code: string) {
  const trimmed = code.trim();
  if (!trimmed || trimmed === exerciseCode(exerciseName)) delete codeOverrides[exerciseName];
  else codeOverrides[exerciseName] = trimmed;
  saveCodeOverrides();
}

// ---- Exercise SHORT names (a middle tier between the tiny code and the full
// name) ----. Same layering as codes: the default short name is just the
// exercise's effective code (so a common lift reads as its code), but the owner
// can type a longer, friendlier short name per lift (a rare lift can be as long
// as its full name). shortFor() is the single read point.
const SHORT_STORE_KEY = "colosseum.exerciseShortNames.v1";
const shortOverrides: Record<string, string> = loadShortOverrides();

function loadShortOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SHORT_STORE_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

/** The default short name for an exercise: its effective CODE, so "short" mode
 * actually reads short (the tiny code) until the owner types a friendlier short
 * name for a lift. */
function defaultShort(exerciseName: string): string {
  return codeFor(exerciseName);
}

/** The short name shown for an exercise: the owner's override if set, else the
 * default (the code). */
function shortFor(exerciseName: string): string {
  const o = shortOverrides[exerciseName];
  return o && o.trim() ? o : defaultShort(exerciseName);
}

function saveShortOverrides() {
  saveJson(SHORT_STORE_KEY, shortOverrides);
}

/** Set or clear (blank or equal to the default code → back to default) one
 * exercise's short-name override. */
function setShortOverride(exerciseName: string, short: string) {
  const trimmed = short.trim();
  if (!trimmed || trimmed === defaultShort(exerciseName)) delete shortOverrides[exerciseName];
  else shortOverrides[exerciseName] = trimmed;
  saveShortOverrides();
}

// ---- GLOBAL exercise-name display mode (ONE switch for the WHOLE site) ----
// Every place that prints an exercise name reads displayName(), which follows
// this single setting: "code" = the tiny code (HS-PU), "short" = the owner's
// short name, "full" = the full logged name. Default is "short". Changing it
// re-labels every view in lockstep — no per-view name toggles.
type NameMode = "code" | "short" | "full";
const NAME_MODE_KEY = "colosseum.nameMode.v1";
let nameMode: NameMode = (() => {
  try { const v = localStorage.getItem(NAME_MODE_KEY); return v === "code" || v === "full" ? v : "short"; } catch { return "short"; }
})();
function setNameMode(m: NameMode): void {
  nameMode = m;
  try { localStorage.setItem(NAME_MODE_KEY, m); } catch { /* ignore */ }
}
/** The exercise name to SHOW anywhere on the site, per the global name mode. */
function displayName(exerciseName: string): string {
  return nameMode === "code" ? codeFor(exerciseName) : nameMode === "full" ? exerciseName : shortFor(exerciseName);
}
/** Re-render every view after the global name mode changes — names appear across
 * all of them. Scroll preserved so the page doesn't jump. */
function applyNameModeChange(): void {
  const y = window.scrollY;
  syncWorkoutToggles();
  syncNameModeButtons();
  populateExercisePicker();
  renderAll();
  if (document.getElementById("workoutsTable")) renderWorkoutsPage();
  if (document.getElementById("tab-analysis")?.hidden === false) renderWorkoutAnalysis();
  refreshExerciseInfo();
  window.scrollTo(0, y);
}
/** Light up the active name-mode button in the Settings picker. */
function syncNameModeButtons(): void {
  for (const b of document.querySelectorAll<HTMLElement>("#nameModeRow .name-mode-opt"))
    b.classList.toggle("is-on", b.dataset.namemode === nameMode);
}

// ---- Per-LEVEL technique scaling factors (the squat-rack holes), editable ----
// A hole (a push-up at squat-rack hole 8) doesn't change the real weight or its
// 1RM — those stay as logged. Each (exercise, hole) instead carries a plain
// SCALING FACTOR (default 1): the set's "scaled effort 1RM" = its real 1RM × this
// factor, so equal-effort holes can be lined up for comparison. Saved on device.
const LEVEL_SCALE_STORE_KEY = "colosseum.levelScales.v1";
const levelScaleOverrides: Record<string, number> = (() => {
  try {
    const raw = localStorage.getItem(LEVEL_SCALE_STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
})();

// INCLINE scales are GLOBAL — exercise-independent — because the incline (how high
// the hands are) is a physical property shared by every push-up variant, not a
// per-name thing. Keyed by "<dim>|<value>" ("sq|8", "smith|3", "cm|20"). Edited in
// one place (Settings → Difficulty multipliers → incline, and the set popover), so
// there's a single source of truth for "SQ8 = ×0.4" across all push-ups.
const INCLINE_SCALE_STORE_KEY = "colosseum.inclineScales.v1";
const inclineScaleOverrides: Record<string, number> = (() => {
  try {
    const raw = localStorage.getItem(INCLINE_SCALE_STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
})();
// One-time migration: fold any LEGACY per-exercise incline override (set before the
// scale went global) into the global store, so an existing "Push Up|sq|8 = 0.4" is
// preserved as "sq|8 = 0.4" and both the popover and the editor agree.
for (const [k, v] of Object.entries(levelScaleOverrides)) {
  const parts = k.split("|");
  const ex = parts[0], dim = parts[1], val = parts[2];
  if (ex && dim && val !== undefined && isInclineLevelExercise(ex)) {
    const ik = `${dim}|${val}`;
    if (!(ik in inclineScaleOverrides)) inclineScaleOverrides[ik] = v;
  }
}
const inclineKey = (dim: LevelDim, value: number): string => `${dim}|${value}`;
/** The incline scale for a level (override, else the seeded cm-incline formula). */
function inclineScaleFor(dim: LevelDim, value: number): number {
  const ik = inclineKey(dim, value);
  if (Object.prototype.hasOwnProperty.call(inclineScaleOverrides, ik)) return inclineScaleOverrides[ik]!;
  return inclineScale(levelInclineCm(dim, value));
}
function setInclineScale(dim: LevelDim, value: number, v: number): void {
  inclineScaleOverrides[inclineKey(dim, value)] = v;
  try {
    localStorage.setItem(INCLINE_SCALE_STORE_KEY, JSON.stringify(inclineScaleOverrides));
  } catch {
    /* storage may be unavailable — edits still apply this session */
  }
}

/** Technique scaling factor for one set's level: the owner's override, else the
 * seeded default (×1 at the floor/neutral, easier levels scaled down). For the
 * push-up family the level is an INCLINE: cm / squat-rack hole / Smith notch all
 * convert to one cm height, and a higher incline reads easier (a floor push-up at
 * 0cm is the ×1 reference) — so a Smith-machine incline push-up lines up with a
 * floor one. Incline scales are GLOBAL (tuned in ⚙ Difficulty multipliers / the set
 * popover); other levels keep a per-exercise override. */
function levelScaleFor(exerciseName: string, dim: LevelDim, value: number): number {
  if (isInclineLevelExercise(exerciseName)) return inclineScaleFor(dim, value);
  const key = levelKey(exerciseName, dim, value);
  if (Object.prototype.hasOwnProperty.call(levelScaleOverrides, key)) return levelScaleOverrides[key]!;
  return defaultLevelScale(dim, value);
}

function setLevelScale(key: string, value: number) {
  levelScaleOverrides[key] = value;
  try {
    localStorage.setItem(LEVEL_SCALE_STORE_KEY, JSON.stringify(levelScaleOverrides));
  } catch {
    /* storage may be unavailable — edits still apply this session */
  }
}

/** The technique scaling factor for a set: per-set override × squat-rack-hole
 * factor × per-note variation factor (LIFT-DM2 — all multiplicative now, each
 * defaulting to ×1, so they compose instead of one replacing the others). */
function scaleForRecord(r: SetRecord): number {
  const o = setOverrides[setId(r)];
  const perSet = o?.scale ?? 1;
  const level = r.levelDim !== undefined && r.levelValue !== undefined ? levelScaleFor(r.exerciseName, r.levelDim, r.levelValue) : 1;
  return perSet * level * noteVariationScale(r);
}

// ---- Per-NOTE variation difficulty (the owner tags meaningful notes) ----
// A logged note can be a real variation ("incline", "knee") that changes how hard
// the set is, OR just a thought/condition. The owner reviews each distinct note
// and sets its RELATIVE DIFFICULTY (×1 = no effect). Like the squat-rack holes,
// this never changes the real weight/1RM or splits the lift into many exercises —
// it only scales a separate "effort" value so easier/harder variations line up.
const VARIATION_SCALE_KEY = "colosseum.variationScales.v1";
const variationScaleOverrides: Record<string, number> = (() => {
  try {
    const raw = localStorage.getItem(VARIATION_SCALE_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
})();
/** Normalised note → key part (trim, lowercase, collapse whitespace). Different
 * spellings stay distinct on purpose — the owner reviews each. */
const normNote = (note: string): string => note.trim().toLowerCase().replace(/\s+/g, " ");
const variationKey = (exerciseName: string, note: string): string => `${exerciseName}|${normNote(note)}`;
/** Notes that LOOK like a difficulty-changing variation (vs a passing thought),
 * used only to flag "review needed" until the owner sets a difficulty. */
const VARIATION_HINT = /\b(incline|incl|decline|decl|knee|knees|diamond|wide|narrow|close|archer|deficit|pike|assist|assisted|band|banded|pause|paused|tempo|slow|explosive|elevated|raised|feet|weighted|weight|ring|rings|clap|pseudo|planche|negative|eccentric|deep|spoto|pin|deload|single|one\s*arm|1\s*arm)\b/i;
// Per-note ATTRIBUTE-VECTOR overrides (LIFT-DM3): for a lift with a difficulty
// model, the owner picks each dimension's level (how far from the wall, how deep
// the range, what band…) instead of a number; we store only the dims they change,
// layered on top of what the note's tokens resolved to. Keyed exercise|normNote.
const VARIATION_VEC_KEY = "colosseum.variationVecs.v1";
const variationVecOverrides: Record<string, Record<string, string>> = (() => {
  try {
    const raw = localStorage.getItem(VARIATION_VEC_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, Record<string, string>>) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
})();
function noteVecOverride(exerciseName: string, note: string): Record<string, string> {
  return variationVecOverrides[variationKey(exerciseName, note)] ?? {};
}
function noteHasVecOverride(exerciseName: string, note: string): boolean {
  return Object.keys(noteVecOverride(exerciseName, note)).length > 0;
}
function saveVariationVecs(): void {
  saveJson(VARIATION_VEC_KEY, variationVecOverrides);
}
function setNoteVecDim(exerciseName: string, note: string, dim: string, level: string): void {
  const k = variationKey(exerciseName, note);
  const cur = variationVecOverrides[k] ?? {};
  cur[dim] = level;
  variationVecOverrides[k] = cur;
  saveVariationVecs();
}
function clearNoteVec(exerciseName: string, note: string): void {
  delete variationVecOverrides[variationKey(exerciseName, note)];
  saveVariationVecs();
}
// Per-note DISPLAY RENAME: relabel a cryptic logged note (e.g. "guma 4") to a
// readable name. Keyed exercise|normNote(original) and applied wherever the note
// is SHOWN — it does NOT change the note's identity, so its difficulty /
// not-comparable / attribute settings (all keyed by the original note) stay
// attached. Blank, or a value equal to the original, clears the rename.
const NOTE_RENAME_KEY = "colosseum.noteRenames.v1";
const noteRenames: Record<string, string> = (() => {
  try {
    const raw = localStorage.getItem(NOTE_RENAME_KEY);
    const o = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
})();
function saveNoteRenames(): void {
  saveJson(NOTE_RENAME_KEY, noteRenames);
}
/** The owner's readable label for a note, or the note itself when unrenamed. */
function displayNote(exerciseName: string, note: string): string {
  if (!note) return note;
  return noteRenames[variationKey(exerciseName, note)] ?? note;
}
/** Rename a note for display. Blank, or text equal to the original, clears it. */
function setNoteRename(exerciseName: string, originalNote: string, text: string): void {
  const k = variationKey(exerciseName, originalNote);
  const trimmed = text.trim();
  if (!trimmed || trimmed === originalNote.trim()) delete noteRenames[k];
  else noteRenames[k] = trimmed;
  saveNoteRenames();
}

// ---- Editable difficulty-model factors ----. The handstand model's per-level
// ×factors (Band 5 = ×0.56, depth +25cm = ×0.56, …) live in FAMILIES, but the
// owner can re-tune any of them here; overrides are keyed family→dim→level and
// layered over the defaults by famLevels(), the single read point. Saved on device.
const FAM_FACTORS_KEY = "colosseum.famFactors.v1";
const famFactorOverrides = loadJsonObject<Record<string, Record<string, Record<string, number>>>>(FAM_FACTORS_KEY);
/** A family dimension's levels with any owner factor overrides layered on (base
 * key order preserved, so the pad axis stays consistent). */
// ---- Band assistance: ONE knob, measured in KILOGRAMS ----.
// A band removes a roughly constant force, so its help is a kg amount SUBTRACTED
// from the load (not a multiplier). The levels still compound by the owner's rule
// "2× band-k = band-(k+2)" → kg doubles every 2 levels → kg(k) = A·√2^(k-1), where
// the single knob A is band-1's assistance in kg. none = 0 kg.
const BAND_RATIO = Math.SQRT2;
function defaultBandKnob(family: string): number {
  return FAMILIES[family]?.dims.band ? 5 : 0; // band-1 ≈ 5 kg by default; owner tunes it
}
function bandKnob(family: string): number {
  return famFactorOverrides[family]?.["bandKnob"]?.["a"] ?? defaultBandKnob(family);
}
/** Band assistance for one level, in kg: a(k)=A·√2^(k-1); none/unknown = 0. */
function bandAssistKg(family: string, level: string): number {
  const k = Number(level);
  if (level === "none" || !Number.isFinite(k)) return 0;
  return Math.round(bandKnob(family) * Math.pow(BAND_RATIO, k - 1) * 10) / 10;
}

// ---- Per-exercise difficulty MODEL assignment ----. The built-in map only knows
// a few exact names; this lets the owner attach a model (e.g. HSPU) to ANY lift —
// a hand-created handstand, a renamed one — so it gets the editable multipliers.
// "" = explicitly no model. Saved on device + in the backup.
/** Which difficulty-variation model a lift uses — purely AUTO-DETECTED from its
 * name (HSPU for every handstand push-up, PUSHUP for push-ups). The name is the
 * single source of truth: no per-exercise picker, so every handstand push-up is
 * always editable with variations and none can drift to a different/none model. */
function familyOf(exerciseName: string): string | null {
  return baseFamilyOf(exerciseName);
}
// ---- World-record reference per exercise (for "% of world record") ----. Seed
// (WORLD_RECORDS_SEED) layered with owner edits; each is a kg at a reference
// bodyweight, scaled allometrically to the viewed athlete's bodyweight. Saved.
const WR_KEY = "colosseum.worldRecords.v1";
const worldRecordOverrides = loadJsonObject<Record<string, { m?: WrRef; f?: WrRef }>>(WR_KEY);
/** The record reference for an exercise + sex (owner edit wins over the seed). */
function worldRecordRef(exerciseName: string, sex: "m" | "f"): WrRef | null {
  return worldRecordOverrides[exerciseName]?.[sex] ?? WORLD_RECORDS_SEED[exerciseName]?.[sex] ?? null;
}
/** Best bodyweight-inclusive 1RM ever logged for an exercise by a lifter of the
 * given sex, with that lifter's bodyweight — the basis for a record guesstimate. */
function bestLoggedE1RM(exerciseName: string, sex: "m" | "f"): { e1rm: number; bw: number } | null {
  const formula = currentFormula();
  let best: { e1rm: number; bw: number } | null = null;
  for (const r of computedRecords()) {
    if (r.exerciseName !== exerciseName) continue;
    const prof = athProfile(r.username);
    if (prof?.sex && (prof.sex === "f" ? "f" : "m") !== sex) continue;
    const e = effectiveE1RM(r, formula);
    if (e == null || e <= 0) continue;
    if (!best || e > best.e1rm) best = { e1rm: e, bw: prof?.weight ?? (sex === "f" ? 60 : 80) };
  }
  return best;
}
/** How far the best logged effort sits below a real record, LEARNED from the lifts
 * that already have a record set (median ratio). Falls back to ~1.6× when none. */
function wrHeadroom(sex: "m" | "f"): number {
  const ratios: number[] = [];
  for (const ex of new Set([...Object.keys(worldRecordOverrides), ...Object.keys(WORLD_RECORDS_SEED)])) {
    const ref = worldRecordRef(ex, sex);
    const best = ref && bestLoggedE1RM(ex, sex);
    if (!ref || !best || best.e1rm <= 0) continue;
    const ratio = (best.bw ? scaleWr(ref, best.bw) : ref.kg) / best.e1rm;
    if (Number.isFinite(ratio) && ratio > 0) ratios.push(ratio);
  }
  if (!ratios.length) return 1.6;
  ratios.sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length / 2)]!;
}
/** A GUESSTIMATED record for a lift with no explicit value — the best logged effort
 * scaled up by the learned headroom. null when nothing's been logged for it. */
function guessWorldRecord(exerciseName: string, sex: "m" | "f"): WrRef | null {
  const best = bestLoggedE1RM(exerciseName, sex);
  if (!best) return null;
  return { kg: Math.round(best.e1rm * wrHeadroom(sex)), bw: Math.round(best.bw) };
}
/** Explicit record if the owner set one, else the guesstimate (used by graph + editor). */
function worldRecordRefEffective(exerciseName: string, sex: "m" | "f"): WrRef | null {
  return worldRecordRef(exerciseName, sex) ?? guessWorldRecord(exerciseName, sex);
}
/** The world record (kg) scaled to a bodyweight; uses the guesstimate when unset. */
function worldRecordKg(exerciseName: string, sex: "m" | "f", bodyweight: number | null): number | null {
  const ref = worldRecordRefEffective(exerciseName, sex);
  if (!ref || !bodyweight || bodyweight <= 0) return ref ? ref.kg : null;
  return scaleWr(ref, bodyweight);
}
/** Set or clear (blank → remove) a world-record field for an exercise/sex. */
function setWorldRecord(exerciseName: string, sex: "m" | "f", kg: number | null, bw: number | null): void {
  const cur = (worldRecordOverrides[exerciseName] ??= {});
  if (kg === null || !Number.isFinite(kg) || kg <= 0 || bw === null || !Number.isFinite(bw) || bw <= 0) delete cur[sex];
  else cur[sex] = { kg: Math.round(kg * 10) / 10, bw: Math.round(bw * 10) / 10 };
  if (!cur.m && !cur.f) delete worldRecordOverrides[exerciseName];
  saveJson(WR_KEY, worldRecordOverrides);
}


function famLevels(family: string, dim: string): Record<string, number> {
  // Per-support lean tables ("lean:back_to_wall", …): start from that support's
  // default (b2w = 15cm-graced, others = base) then layer any owner overrides.
  if (dim.startsWith("lean:")) {
    const base = defaultLeanTable(family, dim.slice(5));
    const ov = famFactorOverrides[family]?.[dim];
    return ov ? { ...base, ...ov } : base;
  }
  const base = FAMILIES[family]?.dims[dim] ?? {};
  const ov = famFactorOverrides[family]?.[dim];
  return ov ? { ...base, ...ov } : base;
}
/** Lean's effect depends on support (back- vs front-to-wall differ), so a
 * "lean:<support>" override wins over the shared base lean. */
function leanFactorFor(family: string, support: string, level: string): number {
  return famLevels(family, `lean:${support}`)[level] ?? famLevels(family, "lean")[level] ?? 1;
}
function saveFamFactors(): void {
  saveJson(FAM_FACTORS_KEY, famFactorOverrides);
}
/** Set or clear (value === default → clear) one model factor. */
function setFamFactor(family: string, dim: string, level: string, value: number): void {
  const def = FAMILIES[family]?.dims[dim]?.[level]
    ?? (dim.startsWith("lean:") ? defaultLeanTable(family, dim.slice(5))[level] : undefined)
    ?? (dim === "bandKnob" && level === "a" ? defaultBandKnob(family) : undefined);
  const fam = (famFactorOverrides[family] ??= {});
  const d = (fam[dim] ??= {});
  if (def !== undefined && Math.abs(value - def) < 1e-9) {
    delete d[level];
    if (Object.keys(d).length === 0) delete fam[dim];
    if (Object.keys(fam).length === 0) delete famFactorOverrides[family];
  } else {
    d[level] = value;
  }
  saveFamFactors();
}

/** The product of a vector's per-dimension factors for a family. */
function scalarFromVec(family: string, vec: Record<string, string>): number {
  const fam = FAMILIES[family];
  if (!fam) return 1;
  let s = 1;
  for (const dim of Object.keys(fam.dims)) {
    // The ladder grip / height only apply when the support is actually "ladder";
    // ignore any stale value otherwise so they don't skew a non-ladder setup.
    if ((dim === "ladderGrip" || dim === "ladderH") && vec.support !== "ladder") continue;
    if (dim === "band") continue; // band is a kg subtraction (assistKg), not a multiplier
    if (dim === "lean") {
      // Lean applies to ALL supports (most sets just use 0 = ×1). Its factor is
      // support-specific — free, back-to-wall and front-to-wall can each differ.
      s *= leanFactorFor(family, vec.support ?? "free", vec.lean ?? "");
      continue;
    }
    const f = famLevels(family, dim)[vec[dim] ?? ""];
    if (typeof f === "number") s *= f;
  }
  return Math.round(s * 1e6) / 1e6;
}
/** The owner's PINNED scalar for a note (non-model lifts), or undefined. */
function notePin(exerciseName: string, note: string): number | undefined {
  const k = variationKey(exerciseName, note);
  return Object.prototype.hasOwnProperty.call(variationScaleOverrides, k) ? variationScaleOverrides[k] : undefined;
}
/** resolveNote, but a SYNTHETIC per-set note ("__set:…", which carries no readable
 * tokens) resolves to the family's neutral defaults rather than being parsed — so a
 * hand-added set starts from a clean form the owner then tunes. */
function rNote(family: string, note: string) {
  return resolveNote(family, note.startsWith("__set:") ? "" : note);
}
/** This note's EFFECTIVE relative-difficulty factor. Model lift → product of the
 * resolved-plus-picked attribute vector; otherwise the pin, else 1. */
function variationScaleFor(exerciseName: string, note: string): number {
  const fam = familyOf(exerciseName);
  if (fam) return scalarFromVec(fam, { ...rNote(fam, note).vec, ...noteVecOverride(exerciseName, note) });
  return notePin(exerciseName, note) ?? 1;
}
/** Whether the owner has reviewed this note: pinned a number (non-model) or picked
 * any attribute (model lift). */
function variationReviewed(exerciseName: string, note: string): boolean {
  return notePin(exerciseName, note) !== undefined || noteHasVecOverride(exerciseName, note);
}
/** The note used for a set's variation lookup: its real note, or — for a family
 * lift logged WITHOUT a note (unspecified from StrengthLevel) — a per-set synthetic
 * key, so EVERY such set carries the family's IMPLIED default variation (free / full
 * ROM / no band → ×1) and is always editable with its own banded/lean/ROM form. */
function variationNote(r: SetRecord): string {
  const note = (r.notes ?? "").trim();
  if (note) return note;
  const fam = familyOf(r.exerciseName);
  if (!fam) return "";
  return `__set:${setId(r)}`; // implied default variation for an unspecified model-lift set
}
/** A set's note-variation factor (1 when it has no note/per-set variation). */
function noteVariationScale(r: SetRecord): number {
  const note = variationNote(r);
  return note ? variationScaleFor(r.exerciseName, note) : 1;
}
/** A set's band assistance in kg (0 when no model/note/band). */
function noteAssistKg(r: SetRecord): number {
  const fam = familyOf(r.exerciseName);
  const note = variationNote(r);
  if (!fam || !note) return 0;
  const vec = { ...rNote(fam, note).vec, ...noteVecOverride(r.exerciseName, note) };
  return bandAssistKg(fam, vec.band ?? "none");
}
function saveVariationScales(): void {
  saveJson(VARIATION_SCALE_KEY, variationScaleOverrides);
}
function setVariationScale(exerciseName: string, note: string, value: number): void {
  variationScaleOverrides[variationKey(exerciseName, note)] = value;
  saveVariationScales();
}
function clearVariationScale(exerciseName: string, note: string): void {
  delete variationScaleOverrides[variationKey(exerciseName, note)];
  saveVariationScales();
}

// ---- Editable athlete stats (height / weight / age / sex / body-fat band) ----
// Stored on this device, layered over the profile.ts ATHLETES baseline. Body fat
// is kept as a 5-point distribution so any value derived from it (nFFMI) carries
// equal error margins. athProfile() is the single accessor every view reads.
interface AthleteStatsOverride {
  weight?: number;
  height?: number;
  age?: number | null;
  sex?: "m" | "f";
  bf?: BodyFatDist;
}
const ATHLETE_STATS_KEY = "colosseum.athleteStats.v1";
const athleteOverrides: Record<string, AthleteStatsOverride> = (() => {
  try {
    const raw = localStorage.getItem(ATHLETE_STATS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AthleteStatsOverride>) : {};
  } catch {
    return {};
  }
})();
function saveAthleteOverrides() {
  saveJson(ATHLETE_STATS_KEY, athleteOverrides);
}

// Manually-added athletes (admin "＋ Add athlete"): users who aren't in the scraped
// StrengthLevel data — so you can set their stats / hand-log sets. Saved on device
// (and in the backup, under the colosseum.* prefix).
const MANUAL_ATHLETES_KEY = "colosseum.manualAthletes.v1";
let manualAthletes: { username: string; user: string }[] = (() => {
  try { const a = JSON.parse(localStorage.getItem(MANUAL_ATHLETES_KEY) ?? "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
})();
function saveManualAthletes(): void { saveJson(MANUAL_ATHLETES_KEY, manualAthletes); }
/** The full athlete roster: everyone in the scraped data PLUS any manually-added
 * users, deduped by username and sorted by display name. The single source of the
 * athlete list for every picker (replaces bare distinctUsers(data.records)). */
function rosterUsers(): { username: string; user: string }[] {
  const map = new Map<string, string>();
  for (const u of distinctUsers(data.records)) map.set(u.username, u.user);
  for (const u of manualAthletes) if (!map.has(u.username)) map.set(u.username, u.user);
  return [...map].map(([username, user]) => ({ username, user })).sort((a, b) => a.user.localeCompare(b.user));
}

/** Effective profile for an athlete: the ATHLETES baseline with any on-device
 * edits layered on top. bodyFat is the band's average when a band is set. */
function athProfile(username: string): AthleteProfile | undefined {
  const base = ATHLETES[username];
  const ov = athleteOverrides[username];
  if (!base && !ov) return undefined;
  return {
    height: ov?.height ?? base?.height ?? 0,
    weight: ov?.weight ?? base?.weight ?? 0,
    bodyFat: ov?.bf?.avg ?? base?.bodyFat ?? 0,
    age: ov && "age" in ov ? (ov.age ?? null) : (base?.age ?? null),
    sex: ov?.sex ?? base?.sex ?? "m",
  };
}

/** The body-fat distribution for an athlete: their edited band, else a sensible
 * symmetric default around the baseline estimate. */
function bfDistFor(username: string): BodyFatDist {
  const ov = athleteOverrides[username];
  if (ov?.bf) return ov.bf;
  return defaultBodyFatDist(athProfile(username)?.bodyFat ?? 0);
}

// ---- Last picked athlete: remembered across reloads ----
const ATHLETE_STORE_KEY = "colosseum.lastAthlete.v1";

function loadLastAthlete(): string | null {
  try {
    return localStorage.getItem(ATHLETE_STORE_KEY);
  } catch {
    return null;
  }
}

function saveLastAthlete(username: string) {
  try {
    localStorage.setItem(ATHLETE_STORE_KEY, username);
  } catch {
    /* storage may be unavailable — selection still applies this session */
  }
}

// ---- Group view: which people were picked, remembered across reloads ----
const TEAM_STORE_KEY = "colosseum.teamPicks.v1";

function loadTeamPicks(): string[] {
  try {
    const raw = localStorage.getItem(TEAM_STORE_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveTeamPicks(usernames: string[]) {
  try {
    localStorage.setItem(TEAM_STORE_KEY, JSON.stringify(usernames));
  } catch {
    /* storage may be unavailable — selection still applies this session */
  }
}

// ---- "Done alone" workout tags: per (athlete, day), remembered across reloads.
const ALONE_STORE_KEY = "colosseum.aloneTags.v1";
let aloneTags = new Set<string>();
// Calendar 2× zoom: a ⚙-settings toggle that doubles every heatmap cell (same
// layout/colours, still horizontally scrollable). Session-only, like the other
// heat flags — driven purely by a `cal-zoom` class on the calendar container.
let calZoom = false;
// The red "trained alone" rings on the calendar are OFF by default — a Settings
// toggle shows them. While actively tagging (paint mode) they always show so you
// can see what you're marking.
let showAloneRings = (() => { try { return localStorage.getItem("colosseum.showAloneRings") === "1"; } catch { return false; } })();
const aloneRingsVisible = (): boolean => showAloneRings || S.aloneTagMode;

/** Stable tag key for a workout: the athlete + the session's ISO day. */
const aloneKey = (date: string): string => `${els.athlete.value}|${date}`;

function loadAlone() {
  try {
    const raw = localStorage.getItem(ALONE_STORE_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    aloneTags = new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    aloneTags = new Set();
  }
}

function saveAlone() {
  try {
    localStorage.setItem(ALONE_STORE_KEY, JSON.stringify([...aloneTags]));
  } catch {
    /* storage may be unavailable — tags still apply this session */
  }
}

// ---- Per-set difficulty grade (RIR — Reps In Reserve), saved on this device.
// The source CSV has no difficulty column, so the owner can grade how many reps
// were left in the tank on each set and it persists across reloads, keyed by
// athlete|exercise|date|setNumber. Grades are stored as a band id (a range
// string like "0.5-1.3"), not a single number, because the owner grades how it
// FELT and that maps to a band, not an exact rep count.
//
// RIR ladder — the single source of truth. `id` is the stored value and also
// the range shown in the cell; `word` is a one-word feel for the closed picker
// button; `desc` is the full plain-language feel shown in the open list. Bands
// run hardest (almost no reps left) → easiest (many reps in reserve).
// Contiguous, non-overlapping.
const RIR_BANDS: ReadonlyArray<{ id: string; word: string; desc: string }> = [
  { id: "0.1–0.3", word: "max", desc: "almost impossible — elite powerlifter grinding ~10s" },
  { id: "0.3–0.5", word: "brutal", desc: "extremely difficult — trained person, 2–4s grind" },
  { id: "0.5–1.3", word: "difficult", desc: "difficult — 1–2s grind, a 2nd rep seems improbable" },
  { id: "1.3–1.5", word: "very hard", desc: "maybe one more rep, but very hard" },
  { id: "1.5–1.8", word: "hard", desc: "could do another rep, but hard" },
  { id: "1.8–2.5", word: "1–2 left", desc: "1 RIR for sure, maybe 2" },
  { id: "2.5–4", word: "2–3 left", desc: "2–3 reps in reserve" },
  { id: "4–8", word: "easy", desc: "4–8 reps in reserve" },
  { id: "8–15", word: "very easy", desc: "8–15 reps in reserve" },
  { id: "15–30", word: "light", desc: "15–30 reps in reserve" },
  { id: "30–100", word: "warm-up", desc: "30–100 reps in reserve (warm-up light)" },
];
/** Look up a band by its stored id. */
const rirBand = (id: string | undefined) => RIR_BANDS.find((b) => b.id === id);
const RIR_IDS = new Set(RIR_BANDS.map((b) => b.id));
/** Representative RIR for a logged band id ("2.5–4" → 3.25), or null if unknown. */
function rirBandMid(id: string | undefined): number | null {
  if (!id) return null;
  const [lo, hi] = id.split(/[–-]/).map((n) => parseFloat(n));
  return lo !== undefined && Number.isFinite(lo) ? (hi !== undefined && Number.isFinite(hi) ? (lo + hi) / 2 : lo) : null;
}
/** Big compound leg lifts (squat / deadlift patterns, leg press) fatigue more, so
 * they get the wider "mid" effort band — see effortClass(). */
function isBigLegsLift(name: string): boolean {
  const cats = exerciseCategories(name);
  return cats.includes("Squat pattern") || cats.includes("Deadlift pattern") || /leg press|hack squat/i.test(name);
}
/** Effort class of a set from its RIR: prefer the logged grade, else the predicted
 * RIR. Null when there's no RIR signal at all. */
function setEffortClass(s: SetRecord, predRir: number | null): EffortClass | null {
  const rir = rirBandMid(rpeFor(s)) ?? predRir;
  return rir === null ? null : effortClass(rir, isBigLegsLift(s.exerciseName));
}
// "Hard sets only" lens (persisted): drop easy / warm-up sets (high reps in
// reserve) from the graphs AND the training calendar, keeping only hard working
// sets — plus sets with no RIR signal at all, which we can't call easy.
let waHardOnly = (() => { try { return localStorage.getItem("colosseum.hardSetsOnly") === "1"; } catch { return false; } })();
function saveHardOnly() { try { localStorage.setItem("colosseum.hardSetsOnly", waHardOnly ? "1" : "0"); } catch { /* ignore */ } }
/** Set-ids the effort model classifies as easy (mid / warm-up), built once from
 * the computed records. Hard sets and sets with no RIR signal are NOT included. */
function easySetIds(): Set<string> {
  const ids = new Set<string>();
  const formula = currentFormula();
  const sm = currentStrengthByUserExercise(formula);
  for (const r of computedRecords()) {
    const eff = setEffortClass(r, predictedRir(currentStrengthFor(sm, r), r.weight, r.reps, formula));
    if (eff === "mid" || eff === "warmup") ids.add(setId(r));
  }
  return ids;
}
/** Apply the "hard sets only" lens to a record list (no-op when off). Keyed by
 * setId, so it works identically on raw or computed records. */
function applyHardSetsFilter<T extends SetRecord>(records: readonly T[], easy?: Set<string>): T[] {
  if (!waHardOnly) return [...records];
  const e = easy ?? easySetIds();
  return records.filter((r) => !e.has(setId(r)));
}
const RPE_STORE_KEY = "colosseum.rir.v1";
let rpeGrades: Record<string, string> = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(RPE_STORE_KEY) ?? "{}");
    return o && typeof o === "object" ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
})();
/** Stable id for one set. */
const setId = (r: SetRecord): string => `${r.username}|${r.exerciseName}|${r.date}|${r.setNumber}`;
const rpeFor = (r: SetRecord): string | undefined => rpeGrades[setId(r)];

// ---- On-device "deleted" (hidden) sets ----. A bad logged set can be hidden
// across the WHOLE app without touching the source CSV: its setId is stored here
// and activeRecords() filters it out everywhere. Reversible (restore in Data
// health) and carried in the backup. CSV re-imports bring the set back unless it's
// still listed here.
const DELETED_SETS_KEY = "colosseum.deletedSets.v1";
const deletedSets: Set<string> = (() => {
  try { const a = JSON.parse(localStorage.getItem(DELETED_SETS_KEY) ?? "[]"); return new Set(Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : []); }
  catch { return new Set(); }
})();
function saveDeletedSets(): void {
  saveJson(DELETED_SETS_KEY, [...deletedSets]);
}
function setDeleted(id: string, on: boolean): void {
  if (on) deletedSets.add(id); else deletedSets.delete(id);
  saveDeletedSets();
}

// ---- Per-set "not comparable" ----. The variations editor marks a whole NOTE
// not comparable; this marks ONE specific set (by id) — reachable right from the
// in-workout set editor. Either path drops the set's 1RM & volume (reps/sets still
// count). Saved on device + in the backup.
const NC_SETS_KEY = "colosseum.notComparableSets.v1";
const notComparableSets: Set<string> = (() => {
  try { const a = JSON.parse(localStorage.getItem(NC_SETS_KEY) ?? "[]"); return new Set(Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : []); }
  catch { return new Set(); }
})();
function setSetNotComparable(id: string, on: boolean): void {
  if (on) notComparableSets.add(id); else notComparableSets.delete(id);
  saveJson(NC_SETS_KEY, [...notComparableSets]);
}
function setRpe(id: string, v: string | null) {
  if (v === null || !RIR_IDS.has(v)) delete rpeGrades[id];
  else rpeGrades[id] = v;
  saveJson(RPE_STORE_KEY, rpeGrades);
}

// ---- Per-set edits (weight / reps / bodyweight / scaling factor) -------------
// Any set can be tweaked on this device without touching the read-only Strength-
// Level data: an override keyed by setId is layered on at load. Bodyweight here
// is JUST for that set (overrides the profile default); scale is the per-set
// technique factor (beats the per-hole one). RIR keeps its own store above.
interface SetOverride { weight?: number; reps?: number; bodyweight?: number; scale?: number; notes?: string; }
const SET_OVR_KEY = "colosseum.setOverrides.v1";
let setOverrides: Record<string, SetOverride> = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(SET_OVR_KEY) ?? "{}");
    return o && typeof o === "object" ? (o as Record<string, SetOverride>) : {};
  } catch { return {}; }
})();
const saveSetOverrides = () => {
  saveJson(SET_OVR_KEY, setOverrides);
  clearMachineCache(); // per-set edits change a set's e1RM → mixed verdicts may shift
};

// ---- Machine type (gravity vs cable), e.g. Lat Pulldown ---------------------
// Per-exercise choice saved on device: "cable" (default, weights as-logged),
// "gravity" (every set ×0.6 for strength), or "mixed" (classify each set — see
// src/machine.ts). The gravity scaling is applied in computeRecordBase, keeping
// the logged weight in origWeight for display (like assisted pull-ups).
const MACHINE_MODE_KEY = "colosseum.machineMode.v1";
const machineModes: Record<string, MachineMode> = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(MACHINE_MODE_KEY) ?? "{}");
    return o && typeof o === "object" ? (o as Record<string, MachineMode>) : {};
  } catch { return {}; }
})();
/** The machine mode for an exercise (defaults to "cable" = no change). */
function machineModeFor(exerciseName: string): MachineMode {
  return machineModes[exerciseName] ?? "cable";
}
function setMachineMode(exerciseName: string, mode: MachineMode) {
  if (mode === "cable") delete machineModes[exerciseName];
  else machineModes[exerciseName] = mode;
  saveJson(MACHINE_MODE_KEY, machineModes);
  clearMachineCache();
}

// ---- Per-exercise GRAPH PERMISSIONS (the "allowed graphs" review system) ----
// Each exercise carries an allow-list of which graph metrics it may plot. Default
// is BLOCK EVERYTHING: an exercise absent from this map shows no graphs until it's
// reviewed (in More info → "Allowed graphs") and individual metrics switched on.
// Pure logic lives in graphPermissions.ts; this is the on-device store + glue.
const GRAPH_PERMS_KEY = "colosseum.allowedGraphs.v1";
let graphPerms: GraphPermissions = (() => {
  try {
    return normalizePermissions(JSON.parse(localStorage.getItem(GRAPH_PERMS_KEY) ?? "{}"));
  } catch { return {}; }
})();
function saveGraphPerms() {
  try { localStorage.setItem(GRAPH_PERMS_KEY, JSON.stringify(graphPerms)); } catch { /* storage may be unavailable */ }
}
// Global master override: when ON, EVERY graph draws for every exercise,
// ignoring the per-exercise approval levels (a quick "show me everything"). When
// OFF, only the approved (level ≥ 1) graphs draw. The per-exercise levels are
// kept either way — this just bypasses them for drawing.
const ALL_GRAPHS_KEY = "colosseum.allGraphsAllowed";
let allGraphsAllowed: boolean = (() => {
  try { return localStorage.getItem(ALL_GRAPHS_KEY) === "1"; } catch { return false; }
})();
function setAllGraphsAllowed(on: boolean) {
  allGraphsAllowed = on;
  try { localStorage.setItem(ALL_GRAPHS_KEY, on ? "1" : "0"); } catch { /* storage may be unavailable */ }
  renderWaGraph();
}
/** Cycle one metric's approval level (no → 1 → 2 → 3 → no) for one exercise,
 * then refresh the review UI + every graph. */
function cycleGraphPerm(name: string, metricId: string) {
  graphPerms = cyclePermLevel(graphPerms, name, metricId);
  saveGraphPerms();
  afterGraphPermChange(name);
}
/** Set every metric for an exercise to a level (0 clears), then refresh. */
function setGraphPermAll(name: string, level: GraphLevel) {
  graphPerms = setAllPermMetrics(graphPerms, name, level);
  saveGraphPerms();
  afterGraphPermChange(name);
}
function afterGraphPermChange(name: string) {
  void name;
  refreshExerciseInfo(); // the exercise-settings overlay, if it's open
  renderWaGraph();        // universal graph (single + auto overview)
}
// Mixed-mode verdicts are memoised per (athlete|exercise); cleared when anything
// that changes a set's estimated 1RM does (mode, per-set edits, formula, data).
let machineVerdictCache = new Map<string, Map<string, MachineVerdict>>();
let machineCacheFormula: OneRepMaxFormula | null = null;
function clearMachineCache() { machineVerdictCache = new Map(); machineCacheFormula = null; }
/** The mixed-mode verdict for one set, building (and caching) the whole exercise's
 * classification on first touch. Uses the LOGGED weight's estimated 1RM. */
function mixedVerdictFor(r: SetRecord): MachineVerdict {
  const formula = currentFormula();
  if (machineCacheFormula !== formula) { machineVerdictCache = new Map(); machineCacheFormula = formula; }
  const key = `${r.username}|${r.exerciseName}`;
  let map = machineVerdictCache.get(key);
  if (!map) {
    // All this athlete's logged sets for the exercise, in a stable order.
    const sets = data.records.filter((x) => x.username === r.username && x.exerciseName === r.exerciseName);
    const e1rms: number[] = [];
    const ids: string[] = [];
    for (const x of sets) {
      const w = applySetOverride(x).weight;
      const e = estimate1RM(w, x.reps, formula);
      ids.push(setId(x));
      e1rms.push(e ?? 0);
    }
    const verdicts = classifyMixed(e1rms);
    map = new Map();
    for (let i = 0; i < ids.length; i++) map.set(ids[i]!, verdicts[i]!);
    machineVerdictCache.set(key, map);
  }
  return map.get(setId(r)) ?? "cable";
}
/** Apply the exercise's machine mode to a computed record: gravity sets scale to
 * their cable-equivalent (×0.6) keeping the logged weight in origWeight; review
 * sets are flagged only. Cable / unconfigured exercises pass through untouched. */
function applyMachineMode(out: SetRecord): SetRecord {
  const mode = machineModeFor(out.exerciseName);
  if (mode === "cable") return out;
  const verdict: MachineVerdict = mode === "gravity" ? "gravity" : mixedVerdictFor(out);
  if (verdict === "gravity") {
    const logged = out.origWeight ?? out.weight; // preserve what to set on the machine
    return { ...out, weight: out.weight === null ? null : out.weight * GRAVITY_MULT, origWeight: logged, machineType: "gravity" };
  }
  if (verdict === "review") return { ...out, machineType: "review" };
  return { ...out, machineType: "cable" };
}
/** Layer a set's on-device edits over the logged weight / reps / bodyweight. */
function applySetOverride(r: SetRecord): SetRecord {
  const o = setOverrides[setId(r)];
  if (!o) return r;
  return {
    ...r,
    weight: o.weight !== undefined ? o.weight : r.weight,
    reps: o.reps !== undefined ? o.reps : r.reps,
    bodyweight: o.bodyweight !== undefined ? o.bodyweight : r.bodyweight,
    notes: o.notes !== undefined ? o.notes : r.notes,
  };
}
/** Set or clear the note-text override for a set (empty string clears it back to
 * the original CSV note). Kept separate from the numeric fields above. */
function setSetOverrideNote(id: string, value: string, originalNote: string): void {
  const o = setOverrides[id] ?? {};
  const trimmed = value.trim();
  // Storing the original verbatim is pointless — only keep a genuine change.
  if (trimmed === originalNote.trim()) delete o.notes;
  else o.notes = trimmed;
  if (Object.keys(o).length === 0) delete setOverrides[id];
  else setOverrides[id] = o;
  saveSetOverrides();
}
/** Set or clear one numeric override field for a set (empty/NaN clears just it). */
function setSetOverrideField(id: string, field: "weight" | "reps" | "bodyweight" | "scale", value: number | null) {
  const o = setOverrides[id] ?? {};
  if (value === null || !Number.isFinite(value)) delete o[field];
  else o[field] = value;
  if (Object.keys(o).length === 0) delete setOverrides[id];
  else setOverrides[id] = o;
  saveSetOverrides();
}

/**
 * Records with the bodyweight-lifted load baked into `weight`, so the existing
 * leaderboard / PR / progress maths produce bodyweight-aware estimated 1RMs.
 * The chosen bodyweight source (profile table vs the value logged per set) is a
 * Setting. Exercises with coefficient 0 are returned untouched.
 */
/**
 * Fold the bodyweight share into ONE record exactly as computedRecords does, so
 * any view can get the same bodyweight-aware numbers the leaderboard/PRs use.
 * `weight` becomes the effective (bw-inclusive) load; `origWeight` keeps the
 * logged bar weight for display. The single source of truth for this transform.
 */
/** Public computeRecord: the bodyweight-aware compute, then tag the owner's
 * "not comparable" mark so every 1RM/volume path drops it (reps/sets still count). */
function computeRecord(r: SetRecord): SetRecord {
  const base = computeRecordBase(r);
  // Stamp the per-NOTE variation difficulty so the 1RM (addedWeight1RM) scales the
  // load by it — an easier variation reports a lower / negative 1RM. ×1 → unstamped.
  const mult = noteVariationScale(base);
  const kg = noteAssistKg(base); // band assistance (kg) subtracted from the load
  let out = base;
  if (mult !== 1) out = { ...out, difficultyMult: mult };
  if (kg > 0) out = { ...out, assistKg: kg };
  // Not comparable if THIS set is marked (per-set), or its NOTE is (per-note).
  const nc = notComparableSets.has(setId(out)) || (!!out.notes && isNoteNotComparable(out.exerciseName, out.notes));
  return nc ? { ...out, notComparable: true } : out;
}
function computeRecordBase(r: SetRecord): SetRecord {
  // Synthetic group records (SQ mix, DL pattern…) already carry the bodyweight-
  // inclusive, ratio-scaled load — re-folding bodyweight would double-count it.
  if (r.syntheticGroupId) return r;
  // The exercise's base bodyweight-part — a squat-rack hole NO LONGER changes the
  // real load/1RM (it only scales a separate "effort" 1RM, see scaleForRecord).
  const coeff = coeffFor(r.exerciseName);
  // Assisted pull-ups: the logged weight is the machine dial value, which over-
  // reads ~2x. Use the halved real assistance for all strength maths, but keep
  // the logged value as origWeight so the displayed set still tells you what to
  // set on the machine.
  const realAdded = realPullupWeight(r.exerciseName, r.weight);
  if (coeff <= 0) {
    const base = realAdded === r.weight ? r : { ...r, weight: realAdded, origWeight: r.weight };
    return applyMachineMode(base);
  }
  // Always use the bodyweight recorded with the set; fall back to the profile
  // default only when the set didn't record one.
  const bw = r.bodyweight ?? athProfile(r.username)?.weight ?? null;
  // weight = bodyweight-inclusive load (for the 1RM calc); origWeight = what to display.
  return applyMachineMode({ ...r, weight: effectiveLoad(realAdded, bw, coeff), origWeight: r.weight });
}

// ---- Owner-editable combinable/comparable membership ------------------------
// The built-in groups (COMBINABLE_GROUPS / COMPARABLE_GROUPS) define a base member
// list; the owner can ADD lifts (with a ratio for comparable) or REMOVE base ones,
// per group, saved here. Every read goes through the "effective" helpers below so
// the edits flow into grouping, the info panel AND the synthetic combine/compare
// computation.
const GROUP_MEMBER_KEY = "colosseum.groupMembers.v1";
type GroupMemberOverride = { add?: Record<string, number>; remove?: string[] };
const groupMemberOverrides = loadJsonObject<Record<string, GroupMemberOverride>>(GROUP_MEMBER_KEY);
function saveGroupMembers() { saveJson(GROUP_MEMBER_KEY, groupMemberOverrides); }
/** A registry group with the owner's member add/remove overrides applied. */
function withMemberOverrides(g: RegistryTag): RegistryTag {
  const ov = groupMemberOverrides[g.id];
  if (!ov || (!ov.add && !ov.remove)) return g;
  const removed = new Set(ov.remove ?? []);
  const base = (g.members ?? []).filter((m) => !removed.has(m.exerciseName));
  const baseNames = new Set(base.map((m) => m.exerciseName));
  const added = Object.entries(ov.add ?? {})
    .filter(([ex]) => !removed.has(ex) && !baseNames.has(ex))
    .map(([exerciseName, ratio]) => ({ exerciseName, ratio }));
  return { ...g, members: [...base, ...added] };
}
const effectiveCombinableGroups = (): RegistryTag[] => COMBINABLE_GROUPS.map(withMemberOverrides);
const effectiveComparableGroups = (): RegistryTag[] => COMPARABLE_GROUPS.map(withMemberOverrides);
const combinableGroupsForEx = (name: string): RegistryTag[] => effectiveCombinableGroups().filter((g) => g.members?.some((m) => m.exerciseName === name));
const comparableGroupsForEx = (name: string): RegistryTag[] => effectiveComparableGroups().filter((g) => g.members?.some((m) => m.exerciseName === name));
/** Toggle one exercise in/out of a group (default ratio 1; comparable editable after). */
function toggleGroupMembership(groupId: string, exName: string): void {
  const g = [...COMBINABLE_GROUPS, ...COMPARABLE_GROUPS].find((x) => x.id === groupId);
  if (!g) return;
  const inBase = (g.members ?? []).some((m) => m.exerciseName === exName);
  const isMember = (withMemberOverrides(g).members ?? []).some((m) => m.exerciseName === exName);
  const ov = (groupMemberOverrides[groupId] ??= {});
  if (isMember) {
    if (ov.add) delete ov.add[exName];
    if (inBase) ov.remove = [...new Set([...(ov.remove ?? []), exName])];
  } else {
    ov.remove = (ov.remove ?? []).filter((x) => x !== exName);
    (ov.add ??= {})[exName] = 1;
  }
  if (ov.add && !Object.keys(ov.add).length) delete ov.add;
  if (ov.remove && !ov.remove.length) delete ov.remove;
  if (!ov.add && !ov.remove) delete groupMemberOverrides[groupId];
  saveGroupMembers();
}
/** Set the comparable ratio for an owner-added member. */
function setGroupRatio(groupId: string, exName: string, ratio: number): void {
  const ov = (groupMemberOverrides[groupId] ??= {});
  (ov.add ??= {})[exName] = Math.min(2, Math.max(0.05, ratio));
  saveGroupMembers();
}

// ---- Per-group DISPLAY mode (Combined / Members / Both), editable ----------
// A merge/compare group makes a synthetic combined lift AND keeps its members. The
// display mode chooses what's shown in the picker: "combined" hides the members
// (the default for 1:1 combine groups — they're one lift), "members" hides the
// synthetic, "both" shows all. Saved on device; the registry's defaultDisplay seeds it.
type GroupDisplay = "combined" | "members" | "both";
const GROUP_DISPLAY_KEY = "colosseum.groupDisplay.v1";
const groupDisplayOverrides: Record<string, GroupDisplay> = (() => {
  try { return JSON.parse(localStorage.getItem(GROUP_DISPLAY_KEY) ?? "{}") as Record<string, GroupDisplay>; } catch { return {}; }
})();
function groupDisplayDefault(id: string): GroupDisplay {
  const g = [...COMBINABLE_GROUPS, ...COMPARABLE_GROUPS].find((x) => x.id === id);
  return g?.defaultDisplay ?? "both";
}
function groupDisplayFor(id: string): GroupDisplay {
  return groupDisplayOverrides[id] ?? groupDisplayDefault(id);
}
function setGroupDisplay(id: string, mode: GroupDisplay): void {
  if (mode === groupDisplayDefault(id)) delete groupDisplayOverrides[id];
  else groupDisplayOverrides[id] = mode;
  try { localStorage.setItem(GROUP_DISPLAY_KEY, JSON.stringify(groupDisplayOverrides)); } catch { /* ignore */ }
}
/** Exercise NAMES hidden from the picker by the per-group display mode: a
 * "combined" group hides its member lifts (only the merged one shows); a "members"
 * group hides the synthetic merged lift. */
function groupDisplayHiddenNames(): Set<string> {
  const hidden = new Set<string>();
  for (const g of [...effectiveCombinableGroups(), ...effectiveComparableGroups()]) {
    const mode = groupDisplayFor(g.id);
    if (mode === "combined") for (const m of g.members ?? []) hidden.add(m.exerciseName);
    else if (mode === "members") hidden.add(g.derivedName ?? g.label);
  }
  return hidden;
}

/** The combinable + comparable registry groups (with owner member edits applied),
 * in the shape withSyntheticGroups wants (id, derivedName, member→quotient map). */
function syntheticGroupDefs(): SyntheticGroupDef[] {
  return [...effectiveCombinableGroups(), ...effectiveComparableGroups()].map(
    (t: RegistryTag): SyntheticGroupDef => ({
      id: t.id,
      derivedName: t.derivedName ?? t.label,
      members: Object.fromEntries((t.members ?? []).map((m) => [m.exerciseName, m.ratio])),
    }),
  );
}

/** User "combined" defs as synthetic-group defs (quotient 1 = a pure merge, no
 * scaling). Feeding these to withSyntheticGroups makes a user-merged lift behave
 * as ONE lift across EVERY view — picker, leaderboard, Estimated-1RM graph,
 * calendar, PRs — exactly like the built-in combinable groups. (Before, a
 * "combined" def only TAGGED its members, so the merge showed in the workouts
 * list but the graph/calendar still saw separate lifts.) */
function userCombinedGroupDefs(): SyntheticGroupDef[] {
  return userExerciseDefs
    .filter((d) => d.identity === "combined" && d.members && d.members.length > 0)
    .map((d) => ({
      id: `combine.user:${d.name}`,
      derivedName: d.name,
      members: Object.fromEntries(d.members!.map((m) => [m, 1])),
    }));
}

/* ---- Global "active exercise set" filter (app-wide) ----------------------
 * Restrict the WHOLE app to a chosen subset of exercises: a frequency-tier
 * cutoff (S/A/B/C/D by instance count) plus manual include/exclude overrides,
 * all set in the Index page and saved on this device. `activeSet` is null when
 * the filter is OFF (the default — nothing hidden); otherwise it's the set of
 * allowed exercise names. activeRecords() is the single choke point every view
 * reads through; the synthetic group lifts are filtered too (each pure member is
 * judged on its own count, see buildActiveExerciseSet). */
const ACTIVE_CUTOFF_KEY = "colosseum.activeSet.cutoff.v1";
const ACTIVE_INCLUDE_KEY = "colosseum.activeSet.include.v1";
const ACTIVE_EXCLUDE_KEY = "colosseum.activeSet.exclude.v1";
const loadJsonArray = (key: string): string[] => {
  try { const a = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : []; }
  catch { return []; }
};
const ACTIVE_SOLO_KEY = "colosseum.activeSet.solo.v1";
let activeCutoff: string | null = (() => { try { const v = localStorage.getItem(ACTIVE_CUTOFF_KEY); return v && v !== "none" ? v : null; } catch { return null; } })();
let activeInclude = new Set<string>(loadJsonArray(ACTIVE_INCLUDE_KEY));
let activeExclude = new Set<string>(loadJsonArray(ACTIVE_EXCLUDE_KEY));
// "Solo" = show ONLY these exercises app-wide (a group's "Only these" action). When
// set it replaces the tier cutoff as the base; include/exclude still apply on top.
let activeSolo: Set<string> | null = (() => { const a = loadJsonArray(ACTIVE_SOLO_KEY); return a.length ? new Set(a) : null; })();
// App-wide TAXONOMY filters: a value-set per dimension (discipline, muscle, …).
// They AND together (and with the tier cutoff) — OR within one dimension — so you
// can keep e.g. only S-tier AND only calisthenics. Empty/absent dim = inactive.
const ACTIVE_META_KEY = "colosseum.activeSet.meta.v1";
let activeMetaFilters: Partial<Record<ExerciseFilterDim, string[]>> = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(ACTIVE_META_KEY) ?? "{}");
    return o && typeof o === "object" ? (o as Partial<Record<ExerciseFilterDim, string[]>>) : {};
  } catch { return {}; }
})();
// Which dimension's value pills are currently shown in the app-wide filter UI
// (display-only; the active values across ALL dims still apply). Default first dim.
let activeFilterDim: ExerciseFilterDim = "discipline";
/** The taxonomy filters that are actually active (have ≥1 chosen value). */
function activeMetaFilterList(): { dim: ExerciseFilterDim; values: string[] }[] {
  return FILTER_DIMS.map((d) => ({ dim: d, values: activeMetaFilters[d] ?? [] })).filter((f) => f.values.length > 0);
}
/** The allowed-exercise set, or null when the filter is off. Rebuilt by refreshActiveSet(). */
let activeSet: Set<string> | null = null;

/** Recompute activeSet from the cutoff + overrides against the current data. Call
 * after data loads or any active-set control changes, then re-render. */
function refreshActiveSet(): void {
  const metaFilters = activeMetaFilterList();
  if (!activeCutoff && activeInclude.size === 0 && activeExclude.size === 0 && !activeSolo && metaFilters.length === 0) {
    activeSet = null; // filter fully off → no filtering at all
    return;
  }
  // Solo mode shows exactly its set as the base; otherwise the tier cutoff does.
  let base = activeSolo
    ? new Set(activeSolo)
    : buildActiveExerciseSet(data.records, activeCutoff, [...activeInclude], [...activeExclude], FREQ_TIERS);
  // Taxonomy filters narrow the base further (AND across dimensions).
  if (metaFilters.length) base = new Set(filterExercises([...base], metaFilters, waMeta));
  // Manual overrides are the final word: force-in beats every filter, force-out
  // beats everything. (Re-applied here so they also override the taxonomy filters.)
  for (const n of activeInclude) base.add(n);
  for (const n of activeExclude) base.delete(n);
  activeSet = base;
}

/** Persist the active-set controls to localStorage. */
function saveActiveSet(): void {
  try {
    localStorage.setItem(ACTIVE_CUTOFF_KEY, activeCutoff ?? "none");
    localStorage.setItem(ACTIVE_INCLUDE_KEY, JSON.stringify([...activeInclude]));
    localStorage.setItem(ACTIVE_EXCLUDE_KEY, JSON.stringify([...activeExclude]));
    localStorage.setItem(ACTIVE_SOLO_KEY, JSON.stringify(activeSolo ? [...activeSolo] : []));
    localStorage.setItem(ACTIVE_META_KEY, JSON.stringify(activeMetaFilters));
  } catch { /* storage may be unavailable */ }
}

/** Apply a group's "Only / Hide / Show" filter to the app-wide active set. */
function applyGroupFilter(mode: string, names: string[]): void {
  if (mode === "only") {
    activeSolo = new Set(names);
    for (const n of names) activeExclude.delete(n);
  } else if (mode === "hide") {
    for (const n of names) { activeExclude.add(n); activeInclude.delete(n); activeSolo?.delete(n); }
  } else { // "show" — clear any hiding of these, and drop solo so nothing's restricted to others
    for (const n of names) activeExclude.delete(n);
    activeSolo = null;
  }
  saveActiveSet();
  scheduleRender();
}

/** A group's current app-wide filter state, for the single cycling toggle:
 * "only" (restricted to these), "hide" (these hidden), or "off" (neither). */
function groupFilterState(names: string[]): "only" | "hide" | "off" {
  if (names.length === 0) return "off";
  if (names.every((n) => activeExclude.has(n))) return "hide";
  if (activeSolo && names.every((n) => activeSolo!.has(n))) return "only";
  return "off";
}
/** The next state in the cycle off → only → hide → off, as a grpfilter mode. */
const GROUP_FILTER_NEXT: Record<"only" | "hide" | "off", string> = { off: "only", only: "hide", hide: "show" };

/** Raw logged records, filtered to the active exercise set (or all, if off). The
 * single choke point every view/graph/list reads instead of data.records. */
/** All records minus on-device "deleted" sets, BEFORE the app-wide active-set
 * filter. Used where a view wants every lift regardless of the Index filter. */
function liveRecords(): SetRecord[] {
  return deletedSets.size ? data.records.filter((r) => !deletedSets.has(setId(r))) : data.records;
}
function activeRecords(): SetRecord[] {
  // Hidden (on-device "deleted") sets drop out everywhere; then the active-set
  // exercise filter, if on.
  const live = liveRecords();
  if (!activeSet) return live;
  const allow = activeSet;
  return live.filter((r) => allow.has(r.exerciseName));
}
/** How many of one athlete's logged lifts the app-wide Index filter is hiding
 * (0 when the filter is off). Lets a view flag that some lifts aren't shown. */
function hiddenByIndexCount(username: string): number {
  if (!activeSet) return 0;
  const allow = activeSet;
  const hidden = new Set<string>();
  for (const r of liveRecords())
    if (r.username === username && r.exerciseName && !allow.has(r.exerciseName)) hidden.add(r.exerciseName);
  return hidden.size;
}
/** Total distinct lifts this athlete has logged (the denominator for "H/T"). */
function totalLiftsCount(username: string): number {
  const all = new Set<string>();
  for (const r of liveRecords()) if (r.username === username && r.exerciseName) all.add(r.exerciseName);
  return all.size;
}

/** User-created exercise definitions (TASKS 13–15), saved on this device: a
 * "dissolved" variant (one parent), a "combined" group or a "comparison_group"
 * (each with member lifts). A def makes its NAME selectable and tags any logged
 * sets of that name with the right identity + relationship, so it behaves like a
 * normal exercise everywhere. The parent / member lifts are never changed. */
interface UserExerciseDef {
  name: string;
  identity: ExerciseIdentity; // "dissolved" | "combined" | "comparison_group"
  parent?: string; // dissolved → parentExerciseId
  members?: string[]; // combined / comparison_group → includedExerciseIds
}
let userExerciseDefs: UserExerciseDef[] = (() => {
  try { return JSON.parse(localStorage.getItem("colosseum.userExercises") ?? "[]") as UserExerciseDef[]; } catch { return []; }
})();
function saveUserExerciseDefs(): void {
  try { localStorage.setItem("colosseum.userExercises", JSON.stringify(userExerciseDefs)); } catch { /* ignore */ }
}
// "Create variant / group" form (Index page) — members are now picked with a
// pill/chip selector (same design as the graph selector), so the state lives here
// and survives the form's re-renders. createVariantMsg is a confirmation that
// outlasts the renderAll() rebuild so the user sees their new def was made.
let createVariantMembers: string[] = [];
let createVariantSearch = "";
let createVariantMsg = "";
/** Tag a logged record belonging to a user-defined exercise with its identity +
 * relationship fields (so its sets carry the parent/members and read as that
 * type). Plain records pass through untouched. */
function tagUserExerciseDef(r: SetRecord, byName: Map<string, UserExerciseDef>): SetRecord {
  const d = byName.get(r.exerciseName);
  if (!d) return r;
  if (d.identity === "dissolved")
    return { ...r, identity: "dissolved", parentExerciseId: d.parent ?? "", relationshipType: "dissolved_into" };
  if (d.identity === "combined")
    return { ...r, identity: "combined", includedExerciseIds: d.members ?? [], relationshipType: "combined_from" };
  if (d.identity === "comparison_group")
    return { ...r, identity: "comparison_group", includedExerciseIds: d.members ?? [], relationshipType: "comparison_of" };
  return r;
}

let computedRecordsCache: SetRecord[] | null = null;
function computedRecords(): SetRecord[] {
  // Memoised within the current synchronous pass only. A single render
  // (list + calendar + graph + chips) calls this ~10×, each time re-deriving the
  // whole record set (override → 1RM → identity-tag → synthetic groups) over every
  // logged set — the dominant cost behind tap lag. Cache it and clear on the next
  // microtask, so within one render they share one compute, but any edit on a
  // later task always recomputes fresh — no staleness (CLAUDE.md #prune).
  if (computedRecordsCache) return computedRecordsCache;
  // Active-filtered logged records with bodyweight folded in (and tagged with any
  // user exercise-def identity), PLUS the synthetic combinable/comparable group
  // records derived from those computed loads. Pure source lifts are never mutated.
  const byDef = new Map(userExerciseDefs.map((d) => [d.name, d]));
  const pure = activeRecords().map(applySetOverride).map(computeRecord).map((r) => tagUserExerciseDef(r, byDef));
  computedRecordsCache = [...pure, ...withSyntheticGroups(pure, [...syntheticGroupDefs(), ...userCombinedGroupDefs()])];
  queueMicrotask(() => { computedRecordsCache = null; });
  return computedRecordsCache;
}

/**
 * Fill the Colosseum exercise picker with every distinct logged lift, each on its
 * own (no scaling, no groups). Re-runnable: keeps the current selection if it
 * still exists, else picks the first option.
 */
function populateExercisePicker(): void {
  const prev = els.exercise.value;
  const pure = distinctExercises(activeRecords()); // pure lifts, most-logged first (active set)
  // The synthetic combinable/comparable lifts (SQ mix, DL pattern) whose members
  // are present — surfaced in a labelled group at the TOP so they're easy to find.
  const synth = availableSyntheticNames(pure);
  const opt = (e: string) => `<option value="${escapeHtml(e)}">${escapeHtml(displayName(e))}</option>`;
  const synthGroup = synth.length
    ? `<optgroup label="✦ Combined lifts">${synth.map(opt).join("")}</optgroup>`
    : "";
  els.exercise.innerHTML = synthGroup + pure.map(opt).join("");
  const all = [...synth, ...pure];
  // Default to the most-trained real lift (not a synthetic), keeping any prior pick.
  els.exercise.value = all.includes(prev) ? prev : (pure[0] ?? synth[0] ?? "");
}

/** Synthetic group derived-names (SQ mix, DL pattern) whose group has ≥1 member
 * among `presentNames` — i.e. they exist in computedRecords and can be picked. */
function availableSyntheticNames(presentNames: Iterable<string>): string[] {
  const present = new Set(presentNames);
  const out: string[] = [];
  for (const t of [...COMBINABLE_GROUPS, ...COMPARABLE_GROUPS]) {
    if ((t.members ?? []).some((m) => present.has(m.exerciseName))) out.push(t.derivedName ?? t.label);
  }
  return out;
}

/** Per-athlete exercise list for the Compare picker: their logged lifts plus any
 * synthetic group lifts they have (≥1 member trained), so synthetics are pickable. */
function compareExerciseNames(username: string): string[] {
  const names = exerciseCountsForUser(activeRecords(), username).map((c) => c.exerciseName);
  return [...names, ...availableSyntheticNames(names)];
}

// Groups/scaling were removed — every exercise is its own lift. These helpers
// stay as thin pass-throughs so their many call sites don't need touching.
function selectionRecords(records: SetRecord[], _selection: string): SetRecord[] {
  return records;
}

// ---- "Where this name came from" indicator, shared by every view -------------
// Only one kind of combine carries an origin note now: merged spellings — e.g.
// "Pull Ups" was also logged as "Chin Ups". exerciseOrigin() returns those source
// spellings so the "(also: …)" badge can be shown wherever the name appears.
let mergeVariantsCache: Map<string, string[]> | null = null;

/** canonical display name → the other raw spellings folded into it (from merges). */
function mergeVariantsFor(name: string): string[] {
  if (!mergeVariantsCache) {
    mergeVariantsCache = new Map();
    for (const m of data.merges) mergeVariantsCache.set(m.canonical, m.variants);
  }
  return mergeVariantsCache.get(name) ?? [];
}

/** The other spellings folded into a merged name, or [] for a plain lift. */
function exerciseOrigin(name: string): string[] {
  // Spelling variants auto-folded into this name, PLUS the member lifts of a
  // user-defined merge (so a merged lift's title/badge lists what it contains).
  const def = userExerciseDefs.find((d) => d.name === name && d.identity === "combined");
  return def?.members?.length ? [...mergeVariantsFor(name), ...def.members] : mergeVariantsFor(name);
}

/** Inline "(also: A, B)" badge for a name, or "" when there's nothing to note.
 * `plain` returns un-escaped text (for chart labels / titles); default is HTML. */
function originBadge(name: string, plain = false): string {
  const origin = exerciseOrigin(name).filter((n) => n !== name);
  if (origin.length === 0) return "";
  const list = origin.join(", ");
  if (plain) return ` (also: ${list})`;
  return ` <span class="origin-note" title="Combined from: ${escapeHtml(list)}">(also: ${escapeHtml(list)})</span>`;
}

function renderStatus() {
  const users = distinctUsers(data.records).length;
  let latest: string | null = null;
  for (const r of data.records) if (r.date && (latest === null || r.date > latest)) latest = r.date;

  let html = `${data.records.length.toLocaleString()} sets · ${users} athletes`;
  if (latest) html += ` · latest ${latest}`;
  // The badges open the Data-health page (which lists each issue/warning).
  if (data.issues.length)
    html += ` <button type="button" class="badge warn badge-link">${data.issues.length} parse issues</button>`;
  if (data.warnings.length)
    html += ` <button type="button" class="badge warn badge-link">${data.warnings.length} sanity warnings</button>`;
  els.status.innerHTML = html;
}

/** Open the data-health overlay (from Settings or the status-bar badges). */
function openHealth() {
  setSettingsOpen(false);
  els.healthPage.hidden = false;
}

/** Open the version-history overlay from Settings. */
function openChangelog() {
  setSettingsOpen(false);
  setOtherSheetOpen(false);
  switchTopTab("changelog");
}

/** Minimal Markdown → HTML for the docs/ task files. Supports just what those
 * files use: headings, **bold**, `code`, bullet lists, GitHub tables, `---`
 * rules and paragraphs. Text is HTML-escaped first, so the docs can't inject. */
function mdToHtml(md: string): string {
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => {
    if (list.length) { out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`); list = []; }
  };
  const cells = (row: string) =>
    row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  let i = 0;
  while (i < lines.length) {
    const t = (lines[i] ?? "").trim();
    if (t.startsWith("|") && /^\|[\s:|-]+\|$/.test((lines[i + 1] ?? "").trim())) {
      flushPara(); flushList();
      const head = cells(t);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) { body.push(cells((lines[i] ?? "").trim())); i++; }
      out.push(
        `<table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>` +
        `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
      );
      continue;
    }
    if (t === "") { flushPara(); flushList(); i++; continue; }
    if (/^---+$/.test(t)) { flushPara(); flushList(); out.push("<hr>"); i++; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) { flushPara(); flushList(); const lvl = h[1]!.length; out.push(`<h${lvl}>${inline(h[2]!)}</h${lvl}>`); i++; continue; }
    const li = /^[-*]\s+(.*)$/.exec(t);
    if (li) { flushPara(); list.push(li[1]!); i++; continue; }
    flushList(); para.push(t); i++;
  }
  flushPara(); flushList();
  return out.join("\n");
}

/** A parsed task item from a docs/ backlog/roadmap file. */
interface TaskItem { sev: string; code: string; part: string; sp: number; detail: string; done: boolean; }
interface TaskSection { heading: string; prose: string[]; items: TaskItem[]; }
interface TaskDoc { title: string; intro: string[]; sections: TaskSection[]; }

// "- 🟠 **CODE** [part] (SP:n) — detail" — severity, part and SP are all optional.
const TASK_ITEM_RE = /^-\s*(✅|🔴|🟠|🟢)?\s*\*\*(.+?)\*\*\s*(?:\[(.+?)\])?\s*(?:\(SP:([\d.]+)\))?\s*[—-]\s*([\s\S]*)$/;

/** Parse a cleanup-backlog / roadmap markdown file into doc → sections → items. */
function parseTaskDoc(md: string): TaskDoc {
  const doc: TaskDoc = { title: "", intro: [], sections: [] };
  let sec: TaskSection | null = null;
  let item: TaskItem | null = null;
  for (const raw of md.replace(/\r\n/g, "\n").split("\n")) {
    const t = raw.trim();
    const h1 = /^#\s+(.*)$/.exec(t);
    if (h1) { doc.title = h1[1]!; item = null; continue; }
    const h2 = /^##\s+(.*)$/.exec(t);
    if (h2) { sec = { heading: h2[1]!, prose: [], items: [] }; doc.sections.push(sec); item = null; continue; }
    const m = sec ? TASK_ITEM_RE.exec(t) : null;
    if (m && sec) {
      item = { sev: m[1] ?? "", code: m[2]!, part: m[3] ?? "", sp: m[4] ? parseFloat(m[4]) : 0, detail: m[5]!.trim(), done: m[1] === "✅" };
      sec.items.push(item);
      continue;
    }
    if (t === "") { item = null; continue; }
    // A wrapped continuation line of the current item, else section/intro prose.
    if (item && !t.startsWith("- ") && !t.startsWith("#")) { item.detail += " " + t; continue; }
    if (sec) sec.prose.push(t); else doc.intro.push(t);
  }
  return doc;
}

/** Render a parsed task doc as a Version-history-style nested <details> tree:
 * doc (open) → sections → items, each item carrying part + SP chips. Reuses the
 * changelog (`cl-*`, `cv-chip`) styling so it matches Version history. */
function renderTaskDoc(doc: TaskDoc): string {
  const fmt = (n: number) => String(Math.round(n * 10) / 10);
  const sumSp = (its: TaskItem[]) => its.reduce((a, it) => a + it.sp, 0);
  const docSp = doc.sections.reduce((a, s) => a + sumSp(s.items), 0);
  const short = (s: string) => (s.length > 90 ? s.slice(0, 88) + "…" : s);
  const itemRow = (it: TaskItem) =>
    `<details class="cl-row cl-d2 bk-item${it.done ? " bk-done" : ""}">` +
    `<summary class="cl-sum">` +
    `<span class="cl-ver">${it.sev ? it.sev + " " : ""}${escapeHtml(it.code)}</span>` +
    `<span class="cl-mid"><span class="cl-title">${escapeHtml(short(it.detail))}</span></span>` +
    (it.part ? `<span class="cv-chip"><span class="cv-name">${escapeHtml(it.part)}</span></span>` : "") +
    (it.sp ? `<span class="cl-sp" title="${fmt(it.sp)} story points">SP ${fmt(it.sp)}</span>` : "") +
    `<span class="cl-caret">▾</span>` +
    `</summary>` +
    `<div class="cl-body"><p class="cl-bodynote">${escapeHtml(it.detail)}</p></div>` +
    `</details>`;
  const sectionRow = (s: TaskSection) => {
    const sp = sumSp(s.items);
    const prose = s.prose.length ? mdToHtml(s.prose.join("\n")) : "";
    return `<details class="cl-row cl-d1">` +
      `<summary class="cl-sum">` +
      `<span class="cl-mid"><span class="cl-title">${escapeHtml(s.heading)}</span></span>` +
      (s.items.length ? `<span class="bk-count muted">${s.items.length}</span>` : "") +
      (sp ? `<span class="cl-sp" title="${fmt(sp)} story points">SP ${fmt(sp)}</span>` : "") +
      `<span class="cl-caret">▾</span>` +
      `</summary>` +
      `<div class="cl-body">${prose}${s.items.map(itemRow).join("")}</div>` +
      `</details>`;
  };
  const intro = doc.intro.length ? `<p class="muted">${escapeHtml(doc.intro.join(" "))}</p>` : "";
  return `<details class="cl-row cl-d0" open>` +
    `<summary class="cl-sum">` +
    `<span class="cl-mid"><span class="cl-title">${escapeHtml(doc.title)}</span></span>` +
    `<span class="cl-sp" title="${fmt(docSp)} story points">SP ${fmt(docSp)}</span>` +
    `<span class="cl-caret">▾</span>` +
    `</summary>` +
    `<div class="cl-body">${intro}${doc.sections.map(sectionRow).join("")}</div>` +
    `</details>`;
}

/** Open the tasks/roadmap overlay from Settings (parsed from the docs/ md). */
function openBacklog() {
  setSettingsOpen(false);
  els.backlog.innerHTML =
    `<p class="cl-summary muted">Cleanup backlog + roadmap, straight from the docs/ files. SP are AI estimates — open Version history to see what an SP actually buys.</p>` +
    renderTaskDoc(parseTaskDoc(cleanupBacklogMd)) +
    renderTaskDoc(parseTaskDoc(roadmapMd));
  els.backlogPage.hidden = false;
}

/** Settings → 🧪 Testing: render the current exercise selection as a NON-interactive
 * graph (no drag-pan / pinch-zoom gesture capture) so the owner can check whether a
 * static old-style chart lets the page scroll freely on a phone. Same data + engine
 * as the main analysis graph, just `interactive: false`. */
const TEST_GRAPH_COLORS = ["#5ab0ff", "#ff7a59", "#5fd17a", "#ffc24b", "#c08bff", "#4fd6d6", "#ff6fae", "#9bd14f"];
function openTesting() {
  setSettingsOpen(false);
  const ath = els.athlete.value;
  const recs = applyHardSetsFilter(computedRecords().filter((r) => r.username === ath));
  const formula = currentFormula();
  // Build plain {x,y} series here (DATA only) and hand them to the brand-new,
  // listener-free renderTestGraph — no svgChart/analyticsGraph involved.
  const series = waSelected.slice(0, 8).map((ex, i) => {
    const points = recs
      .filter((r) => r.exerciseName === ex)
      .map((r) => ({ x: Date.parse(r.date), y: effectiveE1RM(r, formula) }))
      .filter((p): p is TestPoint => Number.isFinite(p.x) && p.y != null && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);
    return { label: displayName(ex), color: TEST_GRAPH_COLORS[i % TEST_GRAPH_COLORS.length]!, points };
  });
  renderTestGraph(els.testGraphChart, series);
  els.testingPage.hidden = false;
}

// ---- Exercise "More info" — now an inline, expandable dropdown on the Index
// page (no separate overlay). Each Index row expands to the same details +
// note-variation difficulty editor; the helpers below keep open panels fresh. ----
// The exercise inspector is a card that FLOATS on top of the Index page (dimmed
// backdrop, the full list behind it) — not a full-screen page and not an inline
// row that pushes the table down. So it's unmistakably "this one exercise's
// settings, in the context of the Index". `currentExInfo` is the lift it shows.
let currentExInfo: string | null = null;
/** Open one exercise's settings: bring the Index (the all-exercises list) up as
 * the backdrop, reveal + scroll to that lift's row, then float the settings card
 * on top — filled from the single-source `exerciseInfoHtml`. */
/** The currently-visible top-tab id (the one un-hidden .tab-panel). */
function currentTopTab(): string {
  const panel = document.querySelector<HTMLElement>(".tab-panel:not([hidden])");
  return panel ? panel.id.replace(/^tab-/, "") : "bwparts";
}
/** Where the exercise-settings overlay was opened from, so its Back button can
 * return there (Analysis or Index). Captured only on a fresh open. */
let exInfoOrigin = "bwparts";
function openExerciseInfo(name: string): void {
  // Remember the view we came from (only on a fresh open — opening another lift
  // while the overlay is up keeps the original origin).
  if (els.exInfoPage.hidden) exInfoOrigin = currentTopTab();
  currentExInfo = name;
  switchTopTab("bwparts"); // the Index is the backdrop, scrolled to this lift
  const row = els.bwGroups.querySelector<HTMLTableRowElement>(`tr[data-exrow="${CSS.escape(name)}"]`);
  if (row) {
    openAncestorDetails(row); // its group + "Show hidden" sub-dropdown if filtered out
    requestAnimationFrame(() => row.scrollIntoView({ behavior: "auto", block: "center" }));
  }
  els.exInfoTitle.textContent = name;
  els.exInfoBody.innerHTML = exerciseInfoHtml(name);
  els.exInfoPage.hidden = false;
  refreshPoseViz();
  els.exInfoBody.parentElement?.scrollTo(0, 0); // reset the card's own scroll
}
/** Back button: return to wherever the overlay was opened from. */
function closeExerciseInfo(): void {
  const name = currentExInfo;
  currentExInfo = null;
  els.exInfoPage.hidden = true;
  // Came from Analysis (or S-Analysis) → go back there, scoped to this lift.
  if (exInfoOrigin === "analysis" || exInfoOrigin === "s-analysis") {
    if (name) openWorkoutAnalysis({ exercises: [name] });
    else switchTopTab(exInfoOrigin);
    return;
  }
  // Index backdrop: flash the row so closing leaves your eye where you are.
  if (!name) return;
  const row = els.bwGroups.querySelector<HTMLTableRowElement>(`tr[data-exrow="${CSS.escape(name)}"]`);
  if (!row) return;
  row.scrollIntoView({ behavior: "auto", block: "center" });
  row.classList.add("wo-flash");
  window.setTimeout(() => row.classList.remove("wo-flash"), 1200);
}
/** Overlay header "Index" button: close it and land on the Index, on this lift. */
function gotoIndexFromInfo(): void {
  const name = currentExInfo;
  currentExInfo = null;
  els.exInfoPage.hidden = true;
  switchTopTab("bwparts");
  if (!name) return;
  const row = els.bwGroups.querySelector<HTMLTableRowElement>(`tr[data-exrow="${CSS.escape(name)}"]`);
  if (!row) return;
  openAncestorDetails(row);
  requestAnimationFrame(() => {
    row.scrollIntoView({ behavior: "auto", block: "center" });
    row.classList.add("wo-flash");
    window.setTimeout(() => row.classList.remove("wo-flash"), 1200);
  });
}
/** Overlay header "Analysis" button: close it and open the Analysis view on
 * this lift (single mode). */
function gotoAnlFromInfo(): void {
  const name = currentExInfo;
  currentExInfo = null;
  els.exInfoPage.hidden = true;
  openWorkoutAnalysis(name ? { exercises: [name] } : {});
}
/** Re-render the open exercise-settings overlay (after an edit anywhere in it),
 * so it stays in sync without closing. No-op when the overlay is closed. */
function refreshExerciseInfo(): void {
  if (currentExInfo === null || els.exInfoPage.hidden) return;
  els.exInfoBody.innerHTML = exerciseInfoHtml(currentExInfo);
  refreshPoseViz();
}
/** From a note's "who & when" entry: switch to that athlete, open the Analysis
 * view for this lift (single mode), and scroll to that date in the history. */
function gotoNoteSet(username: string, exName: string, date: string): void {
  if (els.athlete.value !== username) {
    els.athlete.value = username;
    renderAthlete(); // rebuilds athleteWorkouts for the new athlete
  }
  openWorkoutAnalysis({ exercises: [exName] }); // single mode → workout history for this lift
  requestAnimationFrame(() => jumpToWorkoutDate(date)); // opens the fold + scrolls to the day
}

/** Render the version-history list (newest first) into the overlay. Each release
 * is an expandable row: version + SP + one-line note collapsed; bullet details
 * when opened. */
function renderChangelog() {
  // Show SP without a binary floating-point tail (e.g. 83.3, not 83.30000000001).
  const fmtSp = (n: number): string => String(Math.round(n * 10) / 10);
  // Count actual released versions (a grouped minor counts its sub-versions;
  // planned "soon" entries aren't shipped yet, so they don't count).
  const releaseCount = CHANGELOG.reduce((n, r) => n + countReleases(r), 0);
  const header =
    `<p class="cl-summary muted">${releaseCount} releases · <strong>${fmtSp(TOTAL_LOG_SP)} SP</strong> logged in total ` +
    `<span class="cl-effort-note">· whole-site effort grade ${WEBSITE_EXACT_SP} (≈ ${WEBSITE_SP})</span></p>` +
    `<div class="cl-spchart-wrap"><div class="cl-sections-lbl muted">Story points over time (cumulative, by day)</div>` +
    `<div id="spHistoryChart"></div></div>`;
  // Effort per part — exact SP and the Fibonacci grade it snaps to.
  const sections =
    `<details class="cl-sections cl-effort-fold"><summary class="cl-sections-lbl muted">Effort per task code — exact SP (≈ Fibonacci)</summary>` +
    `<div class="cl-sections-row">` +
    COMPONENTS.map(
      (c) => `<span class="cv-chip"><span class="cv-name">${escapeHtml(c.name)}</span>` +
        `<span class="cv-ver">${c.sp}<span class="cv-fib">≈${fibSp(c.sp)}</span></span></span>`,
    ).join("") +
    `</div></details>`;
  // Render the tree recursively. Every node is a <details> that starts CLOSED,
  // so the page opens as a short list of chapters; the one-line note and any
  // nested groups/releases only show once you expand a row. `depth` drives the
  // left indent so the nesting reads at a glance.
  const renderNode = (r: Release, depth: number): string => {
    const spOrTag = r.soon
      ? `<span class="cl-soon">soon</span>`
      : `<span class="cl-sp" title="${fmtSp(r.sp)} story points">SP ${fmtSp(r.sp)}</span>`;
    const body =
      `<div class="cl-body">` +
      (r.note ? `<p class="cl-bodynote">${escapeHtml(r.note)}</p>` : "") +
      (r.details?.length
        ? `<ul class="cl-details">${r.details.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`
        : "") +
      (r.children?.length
        ? `<div class="cl-sections-row cl-catbd">` +
          categoryBreakdown(r).map((b) => `<span class="cv-chip"><span class="cv-name">${escapeHtml(b.name)}</span>` +
            `<span class="cv-ver">${fmtSp(b.sp)}</span></span>`).join("") + `</div>`
        : "") +
      (r.children?.length ? r.children.map((c) => renderNode(c, depth + 1)).join("") : "") +
      `</div>`;
    return (
      `<details class="cl-row cl-d${depth}${r.soon ? " is-soon" : ""}">` +
      `<summary class="cl-sum">` +
      `<span class="cl-ver">${escapeHtml(displayVersion(r.version))}</span>` +
      `<span class="cl-mid"><span class="cl-title">${escapeHtml(r.title)}</span></span>` +
      spOrTag +
      `<span class="cl-caret">▾</span>` +
      `</summary>` +
      body +
      `</details>`
    );
  };
  const rows = CHANGELOG.map((r) => renderNode(r, 0)).join("");
  els.changelog.innerHTML = header + sections + rows;

  // SP-over-time line: cumulative story points across every release,
  // derived from the CHANGELOG tree -- updates automatically when a release is
  // added, no external script needed. Evenly spaced (one slot per release).
  const spBox = document.getElementById("spHistoryChart");
  const timeline = buildSpTimeline();
  if (spBox && timeline.length) {
    const PALETTE = ["#c0392b", "#e67e22", "#16a085", "#2980b9", "#8e44ad", "#27ae60", "#d35400", "#c2185b", "#00838f", "#558b2f", "#6d4c41", "#1565c0", "#ad1457", "#b7950b", "#34495e", "#7f8c8d"];
    const eraName = (v: string): string => {
      const p = versionParts(v);
      return p ? p.name : v.startsWith("b.1") ? "Pre-v2 era" : "0.x era";
    };
    const eraColor = (v: string): string => {
      const mm = v.match(/^b\.2\.(\d+)/);
      if (mm) return PALETTE[Number(mm[1]) % PALETTE.length]!;
      return v.startsWith("b.1") ? "#95a5a6" : "#bdc3c7";
    };
    // Cumulative total, COLOURED per zanpakutō era — contiguous segments join into one line.
    const eraSeries: SvgSeries[] = [];
    const seenEra = new Set<string>();
    let i0 = 0;
    for (let i = 1; i <= timeline.length; i++) {
      if (i < timeline.length && eraName(timeline[i]!.version) === eraName(timeline[i0]!.version)) continue;
      const era = eraName(timeline[i0]!.version);
      const pts: SvgPoint[] = [];
      if (i0 > 0) { const pp = timeline[i0 - 1]!; pts.push({ x: Date.parse(pp.date), y: pp.cumulative }); }
      for (let k = i0; k < i; k++) {
        const p = timeline[k]!;
        pts.push({ x: Date.parse(p.date), y: p.cumulative, meta: `${displayVersion(p.version)} · ${p.date} · ${fmtSp(p.cumulative)} SP` });
      }
      const repeat = seenEra.has(era); seenEra.add(era);
      eraSeries.push({ name: era, color: eraColor(timeline[i0]!.version), type: "line", points: pts, noLegend: repeat });
      i0 = i;
    }
    // Per-tag cumulative lines (top 10 task codes) — hidden by default; toggle in the legend.
    const totalByCat = new Map<string, number>();
    for (const p of timeline) totalByCat.set(p.cat ?? "?", (totalByCat.get(p.cat ?? "?") ?? 0) + p.sp);
    const topTags = [...totalByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map((e) => e[0]);
    const tagSeries: SvgSeries[] = topTags.map((tag, idx) => {
      let cc = 0; const pts: SvgPoint[] = [];
      for (const p of timeline) if ((p.cat ?? "?") === tag) {
        cc = Math.round((cc + p.sp) * 10) / 10;
        pts.push({ x: Date.parse(p.date), y: cc, meta: `${tag} · ${p.date} · ${fmtSp(cc)} SP` });
      }
      return { name: tag, color: PALETTE[(idx + 2) % PALETTE.length]!, type: "line" as const, points: pts, hidden: true };
    });
    mountSvgChart(spBox, {
      series: [...eraSeries, ...tagSeries],
      xKind: "time", compactable: false, yBeginAtZero: true, yUnit: "SP", insideLabels: true, height: 240,
    });
  }
}

// ---- Site map (mind map of the whole app) ----------------------------------
interface MapNode { label: string; children?: MapNode[]; }

const SITE_MAP: MapNode = {
  label: "Colosseum",
  children: [
    { label: "Colosseum / Leaderboards", children: [
      { label: "Exercise picker" },
      { label: "Best per rep band" },
      { label: "Rank: total / ×bodyweight" },
      { label: "Filters: sex · bodyweight" },
    ] },
    { label: "Athlete", children: [
      { label: "Profile & training stats" },
      { label: "Training mix" },
      { label: "Momentum (weekly trend)" },
      { label: "Body composition (FFMI)" },
    ] },
    { label: "Exercises", children: [
      { label: "List: by category / tier" },
      { label: "Search · category show/hide" },
      { label: "Drill-in: records · best sets" },
      { label: "Weekly · targets" },
      { label: "1RM trend chart" },
      { label: "Per-set range (time axis, dashed reps)" },
      { label: "Reps↔weight calculator" },
      { label: "Compare graph + sets behind it" },
    ] },
    { label: "Workouts", children: [
      { label: "By day / by week" },
      { label: "Muscle-group view" },
      { label: "Rest days · trained-alone tag" },
      { label: "Calendar + sets chart" },
    ] },
    { label: "Stats / Group", children: [
      { label: "Per-category leaderboards" },
      { label: "Group view (compare people)" },
    ] },
    { label: "Data", children: [
      { label: "Refresh from StrengthLevel (+ status)" },
      { label: "Original CSV vs Processed table" },
    ] },
    { label: "Add", children: [
      { label: "Hand-log a set" },
      { label: "Export / import" },
    ] },
    { label: "Formulas", children: [
      { label: "Weight↔reps curve" },
    ] },
    { label: "Settings", children: [
      { label: "1RM formula · bodyweight source" },
      { label: "Dark mode" },
      { label: "Data health" },
      { label: "Version history + SP-over-time" },
    ] },
  ],
};

const SITE_MAP_COLORS = ["#284e86", "#2e7d52", "#b8902f", "#6c4ab0", "#1f6f8b", "#c0563b", "#3a4a86", "#7a8b2e", "#a8447a"];

/** Draw the site map as a tidy horizontal mind-map tree (root → tabs → features),
 * laying leaves on their own rows and centring each parent on its children. */
function renderSiteMap() {
  const box = document.getElementById("siteMapBox");
  if (!box) return;
  const NODE_W = 210, NODE_H = 26, ROW_H = 34, GAP_X = 56, PAD = 14;
  type Placed = { label: string; x: number; y: number; color: string };
  const placed: Placed[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
  let row = 0;
  let maxDepth = 0;

  const layout = (node: MapNode, depth: number, color: string): number => {
    maxDepth = Math.max(maxDepth, depth);
    const x = PAD + depth * (NODE_W + GAP_X);
    let cy: number;
    if (node.children?.length) {
      const centers = node.children.map((c, i) =>
        layout(c, depth + 1, depth === 0 ? SITE_MAP_COLORS[i % SITE_MAP_COLORS.length]! : color),
      );
      cy = (centers[0]! + centers[centers.length - 1]!) / 2;
      const childX = PAD + (depth + 1) * (NODE_W + GAP_X);
      node.children.forEach((_, i) =>
        edges.push({ x1: x + NODE_W, y1: cy, x2: childX, y2: centers[i]!, color: depth === 0 ? SITE_MAP_COLORS[i % SITE_MAP_COLORS.length]! : color }),
      );
    } else {
      cy = PAD + row * ROW_H + NODE_H / 2;
      row++;
    }
    placed.push({ label: node.label, x, y: cy - NODE_H / 2, color });
    return cy;
  };
  layout(SITE_MAP, 0, "#888");

  const totalW = PAD * 2 + (maxDepth + 1) * NODE_W + maxDepth * GAP_X;
  const totalH = PAD * 2 + row * ROW_H;
  const edgesSvg = edges
    .map((e) => {
      const mx = (e.x1 + e.x2) / 2;
      return `<path d="M${e.x1} ${e.y1} C${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}" fill="none" stroke="${e.color}" stroke-width="1.5" opacity="0.55"/>`;
    })
    .join("");
  const nodesSvg = placed
    .map(
      (p) =>
        `<g transform="translate(${p.x},${p.y})">` +
        `<rect class="sm-node" width="${NODE_W}" height="${NODE_H}" rx="6" stroke="${p.color}" stroke-width="1.5"/>` +
        `<text class="sm-text" x="9" y="${NODE_H / 2 + 4}" font-size="11.5">${escapeHtml(p.label)}</text>` +
        `</g>`,
    )
    .join("");
  box.innerHTML =
    `<svg class="sitemap-svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" role="img" aria-label="Site structure mind map">` +
    edgesSvg + nodesSvg +
    `</svg>`;
}

function renderHealth() {
  const merges = data.merges;
  const total = data.issues.length + data.warnings.length;
  els.healthBadge.textContent = total === 0 ? "✓ clear" : `⚠ ${total}`;

  const lines: string[] = [];
  // Hidden (on-device "deleted") sets — listed with a per-set restore and a
  // restore-all, so a delete is never permanent.
  if (deletedSets.size) {
    lines.push(`<h3 class="health-section">Hidden sets (${deletedSets.size}) <button type="button" class="health-restore-all">Restore all</button></h3>`);
    lines.push(`<p class="muted" style="margin:0 0 0.5rem;font-size:0.8rem">These sets are hidden from the whole site (your source data is unchanged). Restore any to bring it back.</p>`);
    for (const id of [...deletedSets].slice(0, 80)) {
      const [user, ex, date, setNo] = id.split("|");
      lines.push(
        `<div class="health-item dup"><span>${escapeHtml(user ?? "")} — ${escapeHtml(displayName(ex ?? ""))} <span class="muted">${escapeHtml(date ?? "")} · set ${escapeHtml(setNo ?? "")}</span></span> ` +
        `<button type="button" class="health-restore" data-restoreset="${escapeHtml(id)}">↺ Restore</button></div>`,
      );
    }
  }
  for (const issue of data.issues.slice(0, 50))
    lines.push(`<div class="health-item warn">Row ${issue.index}: ${escapeHtml(issue.message)}</div>`);
  for (const w of data.warnings.slice(0, 50))
    lines.push(
      `<div class="health-item warn">${escapeHtml(w.record.user)} — ${escapeHtml(w.record.exerciseName)}: ${w.field} = ${w.value} (out of plausible range)</div>`,
    );

  // Exercise names auto-merged in the app (variant spellings of one lift). The
  // original names are kept on the data; this just shows what was folded.
  if (merges.length) {
    lines.push(`<h3 class="health-section">Exercise names auto-merged (${merges.length})</h3>`);
    lines.push(
      `<p class="muted" style="margin:0 0 0.5rem;font-size:0.8rem">Variant spellings of the same lift are combined automatically for cleaner stats, so re-imports stay tidy without editing the source. Original names are preserved.</p>`,
    );
    for (const m of merges.slice(0, 40))
      lines.push(
        `<div class="health-item dup"><strong>${escapeHtml(m.canonical)}</strong> <span class="muted">←</span> ${m.variants
          .map((n) => escapeHtml(n))
          .join(", ")} <span class="muted">(${m.sets} sets)</span></div>`,
      );
  }

  // TASK 61 — duplicate REVIEW list. Look-alike names to eyeball; nothing is
  // merged automatically here (that stays an owner-confirmed act).
  const dupes = duplicateAudit(data.records);
  if (dupes.length) {
    lines.push(`<h3 class="health-section">Possible duplicates to review (${dupes.length})</h3>`);
    lines.push(
      `<p class="muted" style="margin:0 0 0.5rem;font-size:0.8rem">These names look like the same lift. Nothing is changed automatically — this is just a list to check. If two really are the same, tell me and I'll fold them.</p>`,
    );
    for (const c of dupes.slice(0, 40))
      lines.push(
        `<div class="health-item dup"><strong>${escapeHtml(c.suggested)}</strong> <span class="muted">?</span> ${c.names
          .map((n) => escapeHtml(n))
          .join(", ")} <span class="muted">(${c.sets} sets)</span></div>`,
      );
  }

  // TASK 62 — relationship validation. Broken/empty custom-exercise links.
  const relDefs: RelationshipDef[] = userExerciseDefs.map((d) => ({
    name: d.name,
    identity: d.identity,
    ...(d.parent ? { parent: d.parent } : {}),
    ...(d.members ? { members: d.members } : {}),
  }));
  const relIssues = relationshipAudit(relDefs, selectableExercises(data.records));
  if (relIssues.length) {
    lines.push(`<h3 class="health-section">Custom-exercise links to fix (${relIssues.length})</h3>`);
    for (const i of relIssues.slice(0, 40))
      lines.push(`<div class="health-item warn">${escapeHtml(i.detail)}</div>`);
  }

  if (lines.length === 0) {
    els.health.innerHTML = `<p class="muted">No issues — every row validated cleanly, no duplicate names, and every custom-exercise link is valid.</p>`;
    return;
  }
  els.health.innerHTML = lines.join("");
}

interface LbRow {
  user: string;
  username: string;
  value: number; // the ranked number (kg, or BW)
  valueText: string; // formatted for the table
  best: string; // "weight×reps"
  date: string;
  e1rm: number; // added-weight estimated 1RM (kg)
  ratio: number | null; // est 1RM ÷ bodyweight, null if no bodyweight on file
}
let lbRows: LbRow[] = []; // current leaderboard order, for the expandable detail rows

function renderLeaderboard() {
  const exercise = els.exercise.value;
  const formula = currentFormula();
  const rel = els.rank.value === "rel";
  const comp = selectionRecords(computedRecords(), exercise);
  const filtered = filterRecords(comp, {
    excludeDropsets: els.excludeDropsets.checked,
    requireWeightAndReps: true,
  });
  const entries = leaderboard(filtered, exercise, formula, strengthAsOf());
  const perBw = (username: string, e1rm: number): number | null => {
    const bw = athProfile(username)?.weight;
    return bw ? e1rm / bw : null;
  };

  let rows: LbRow[];
  if (rel) {
    // Bodyweight-lifted ranking: estimated 1RM divided by the athlete's bodyweight.
    rows = entries
      .map((e): LbRow | null => {
        const ratio = perBw(e.username, e.e1rm);
        if (ratio === null) return null; // can't rank without a bodyweight on file
        return { user: e.user, username: e.username, value: ratio, valueText: bwMult(ratio), best: wr(e.weight, e.reps), date: e.date, e1rm: e.e1rm, ratio };
      })
      .filter((r): r is LbRow => r !== null)
      .sort((a, b) => b.value - a.value);
  } else {
    rows = entries.map((e) => ({
      user: e.user,
      username: e.username,
      value: e.e1rm,
      valueText: fmt(e.e1rm),
      best: wr(e.weight, e.reps),
      date: e.date,
      e1rm: e.e1rm,
      ratio: perBw(e.username, e.e1rm),
    }));
  }

  // Sex / bodyweight filter: keep only the athletes being compared. The chart
  // and table both iterate `rows`, so trimming here is all that's needed.
  rows = rows.filter((r) => athletePassesColiseum(r.username));

  lbRows = rows;
  // Per rep-band best 1RM for each athlete (grouped bars, NOT summed): each band's
  // value is the theoretical 1RM from sets whose reps fall only in that band.
  const bandData = REP_BANDS.map((band) => {
    const f = filterRecords(comp, {
      excludeDropsets: els.excludeDropsets.checked,
      requireWeightAndReps: true,
      minReps: band.min,
      ...(band.max !== undefined ? { maxReps: band.max } : {}),
    });
    const byUser = new Map<string, number>();
    for (const e of leaderboard(f, exercise, formula, strengthAsOf())) {
      const v = rel ? perBw(e.username, e.e1rm) : e.e1rm;
      if (v !== null) byUser.set(e.username, v);
    }
    return { label: band.label, byUser };
  });

  const metricNote = rel ? "per bodyweight" : `est. 1RM, ${formula}`;
  // Groups are scaled cross-exercise estimates — label them clearly so a grouped
  // number is never mistaken for a real single-exercise lift.
  els.lbTitle.textContent = `${displayName(exercise)}${originBadge(exercise, true)} · ${metricNote} · best per rep band${coliseumFilterNote()}`;
  renderLeaderboardTable(rows, rel);
  renderLeaderboardChart(rows, bandData, rel);
}

function renderLeaderboardTable(rows: LbRow[], rel: boolean) {
  const valueHead = rel ? "Per BW" : "Est. 1RM (kg)";
  const head = `<thead><tr><th>Athlete</th><th class="num">${valueHead}</th><th class="num">Best set (kg)</th></tr></thead>`;
  const body = rows
    .map(
      (r, i) =>
        `<tr class="lb-row" data-index="${i}"><td class="${i === 0 ? "rank-1" : ""}">` +
        `<span class="caret">▸</span>${escapeHtml(r.user)}</td>` +
        `<td class="num">${r.valueText}</td><td class="num">${r.best}</td></tr>`,
    )
    .join("");
  els.lbTable.innerHTML =
    head + `<tbody>${body || `<tr><td colspan="3" class="muted">No data for this exercise.</td></tr>`}</tbody>`;
}

/** Expand a leaderboard row to show the date and the other metric. */
function onLeaderboardRowClick(e: MouseEvent) {
  const row = (e.target as HTMLElement).closest("tr.lb-row") as HTMLTableRowElement | null;
  if (!row) return;
  if (toggleCollapse(row)) return;
  const r = lbRows[Number(row.dataset.index)];
  if (!r) return;
  const item = (label: string, val: string) =>
    `<div class="lb-detail-item"><span class="muted">${label}</span><strong>${val}</strong></div>`;
  const detail =
    `<div class="lb-detail">` +
    item("Best set", r.best) +
    item("Est. 1RM", `${fmt(r.e1rm)} kg`) +
    item("Per bodyweight", r.ratio === null ? "—" : bwMult(r.ratio)) +
    item("Achieved", shortDate(r.date)) +
    `</div>`;
  insertDetail(row, 3, detail);
}

// Blue-and-gold band scale, ordered low reps → high reps: the 1–3 band is
// gold (the heaviest, headline lifts), the 4–6 band is a blue/gold blend, and
// the higher-rep bands run blue fading toward grey. Legible on white.
const BAND_COLORS = ["#b8902f", "#7d7a52", "#284e86", "#5a7299", "#8b97a8", "#aab0b8"];

/** Leaderboard dot-plot, drawn as a themed SVG (no Chart.js): each athlete is a
 * horizontal track, with one coloured dot per rep band at that band's est 1RM. */
function renderLeaderboardChart(
  rows: LbRow[],
  bandData: { label: string; byUser: Map<string, number> }[],
  rel: boolean,
) {
  const box = document.getElementById("lbChart");
  if (!box) return;
  if (rows.length === 0) { box.innerHTML = `<p class="muted">No data for this exercise.</p>`; return; }
  const round = (n: number) => Math.round(n * 100) / 100;
  const clip = (s: string) => (s.length > 15 ? s.slice(0, 14) + "…" : s);

  // X (weight) range: From/To inputs override; else span the data (from 0).
  let dataMin = Infinity, dataMax = -Infinity;
  for (const band of bandData) for (const v of band.byUser.values()) { if (v < dataMin) dataMin = v; if (v > dataMax) dataMax = v; }
  if (!Number.isFinite(dataMin)) { dataMin = 0; dataMax = 1; }
  const xMinIn = numInput(els.axisMin);
  const xMaxIn = numInput(els.axisMax);
  const xMin = xMinIn !== null ? xMinIn : Math.min(0, dataMin);
  const xMax = xMaxIn !== null ? xMaxIn : (dataMax * 1.04 || 1);

  const W = Math.max(280, Math.round(box.clientWidth || 320));
  const rowH = 24;
  const M = { l: 96, r: 14, t: 8, b: 26 };
  const plotW = W - M.l - M.r;
  const plotH = rows.length * rowH;
  const H = M.t + plotH + M.b;
  const xPix = (v: number) => M.l + ((v - xMin) / (xMax - xMin || 1)) * plotW;
  const rowY = (i: number) => M.t + i * rowH + rowH / 2;

  let grid = "";
  let xLabels = "";
  for (const t of niceTicks(xMin, xMax, 6)) {
    const px = xPix(t);
    if (px < M.l - 0.5 || px > W - M.r + 0.5) continue;
    grid += `<line class="svgc-grid" x1="${px.toFixed(1)}" y1="${M.t}" x2="${px.toFixed(1)}" y2="${M.t + plotH}" stroke-width="1"/>`;
    xLabels += `<text class="svgc-axislabel" x="${px.toFixed(1)}" y="${H - M.b + 16}" text-anchor="middle" font-size="11">${fmt(t)}</text>`;
  }

  let body = "";
  let names = "";
  rows.forEach((r, i) => {
    const y = rowY(i);
    body += `<line class="svgc-grid" x1="${M.l}" y1="${y.toFixed(1)}" x2="${W - M.r}" y2="${y.toFixed(1)}" stroke-width="1" opacity="0.45"/>`;
    names += `<text class="svgc-axislabel${i === 0 ? " lb-rank1" : ""}" x="${M.l - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11">${escapeHtml(clip(r.user))}</text>`;
    bandData.forEach((band, bi) => {
      const v = band.byUser.get(r.username);
      if (v === undefined) return;
      const color = BAND_COLORS[bi % BAND_COLORS.length];
      body += `<circle cx="${xPix(v).toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}" stroke="var(--panel)" stroke-width="1">` +
        `<title>${escapeHtml(r.user)} · ${escapeHtml(band.label)} reps: ${round(v)} ${rel ? "BW" : "kg"}</title></circle>`;
    });
  });

  const legend = bandData
    .map((band, bi) => `<span class="svgc-key"><span class="svgc-dot" style="background:${BAND_COLORS[bi % BAND_COLORS.length]}"></span>${escapeHtml(band.label)} reps</span>`)
    .join("");

  box.innerHTML =
    `<div class="svgc-legend">${legend}</div>` +
    `<svg class="svgc-svg lb-svg" width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Leaderboard">` +
    grid + body + names + xLabels +
    `</svg>`;
}

// Which note-variation editors are expanded in the More-info page. Empty by
// default (all collapsed); keyed by variationKey so an edit (which re-renders the
// page) keeps the one you're working in open instead of snapping it shut.
const openVarNotes = new Set<string>();

function renderPersonalRecords() {
  const formula = currentFormula();
  const exercise = els.exercise.value;
  const base = selectionRecords(computedRecords(), exercise);
  const filtered = filterRecords(base, { excludeDropsets: els.excludeDropsets.checked });
  // Personal records for the currently selected exercise/group only (one row per
  // athlete), honouring the same sex/bodyweight comparison filter as the chart.
  const prs = personalRecords(filtered, formula, strengthAsOf())
    .filter((p) => p.exerciseName === exercise)
    .filter((p) => athletePassesColiseum(p.username));
  prs.sort((a, b) => b.bestE1rm.e1rm - a.bestE1rm.e1rm);

  els.prCount.textContent = `— ${exercise} (${prs.length})`;
  const head = `<thead><tr><th>Athlete</th><th class="num">Top weight (kg)</th><th class="num">Best 1RM (kg)</th><th class="num">Date</th></tr></thead>`;
  const rows = prs
    .map(
      (p: PersonalRecord) =>
        `<tr><td>${escapeHtml(p.user)}</td>` +
        `<td class="num">${wr(p.topWeight.weight, p.topWeight.reps)}</td>` +
        `<td class="num">${fmt(p.bestE1rm.e1rm)}</td><td class="num">${p.bestE1rm.date}</td></tr>`,
    )
    .join("");
  els.prTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="4" class="muted">No records for this exercise.</td></tr>`}</tbody>`;
}

// State for the currently shown athlete. The displayed-order arrays let the
// (delegated) click handlers map a clicked row back to its data.
// Exercises shown in the (date-filtered) list, in display order — what the
// exercises row click handler maps an index back to.
let exercisesView: string[] = [];
let selectedExercise: string | null = null; // null = exercise list; set = drill-in detail
let lastSingleExercise: string | null = null; // last drilled-in lift, so the "Single" tab can return to it
// Extra exercises folded into the current drill-in so several lifts (e.g. Squat
// + Smith Machine Squat) are viewed together as one. Reset on each new drill-in.
let combinedWith: string[] = [];
/** Relabel the combined exercises to the primary so all the existing per-exercise
 * drill-in logic treats them as one lift. A no-op when nothing is combined. */
function remapCombined(recs: SetRecord[]): SetRecord[] {
  if (combinedWith.length === 0 || selectedExercise === null) return recs;
  const extra = new Set(combinedWith);
  const primary = selectedExercise;
  return recs.map((r) => (extra.has(r.exerciseName) ? { ...r, exerciseName: primary } : r));
}
let athleteWorkouts: WorkoutDay[] = [];

// A row in the Workouts list: a day or a week (or an empty rest day).
interface WorkoutGroup {
  label: string;
  date: string; // ISO day (day view) or week-start (week view) — lets the calendar jump here
  totalSets: number;
  exercises: ExerciseCount[];
  sets: SetRecord[];
  rest: boolean;
  /** A collapsed run of rest days: this single row stands in for `gap` empty days
   * (a long stretch of nothing is shown as 10 slivers · "N more" · 10 slivers). */
  gap?: number;
}
let workoutGroups: WorkoutGroup[] = [];
// Workouts-list view state lives on S (appState). The two localStorage-backed
// flags get their initial values right here so behaviour matches the previous
// `let x = localStorage.getItem(…)` form.
S.showAddSets = localStorage.getItem("colosseum.showAddSets") === "1";
S.showAloneTags = localStorage.getItem("colosseum.showAloneTags") === "1";
// When on, the workout history ignores the Index app-wide filter and shows EVERY
// lift this athlete logged (the lifts the filter hides come back), so you can see
// a hidden lift's sets without disabling the whole-app filter.
let woShowAllExercises = localStorage.getItem("colosseum.woShowAll") === "1";
// Short labels for the compact "Alone filter" DJ button (cycles through these).
const ALONE_FILTER_SHORT: Record<AloneFilter, string> = { both: "All", alone: "Alone", notAlone: "Not" };
/** Reflect every workout display toggle on its single button: the label shows the
 * current value, and on/off toggles light up. The grouping select + name button
 * only apply to their relevant mode. */
function syncWorkoutToggles(): void {
  els.workoutViewToggle.textContent = WO_VIEW_LABEL[S.workoutViewMode];
  els.workoutShowToggle.textContent = S.workoutShowMode === "exercises" ? "Exer" : "Group";
  // The group-dimension dropdown only applies to GROUP mode. It's been enhanced into
  // a .xdd twin, so hide BOTH the <select> and its twin (hiding the select alone left
  // the visible dropdown showing in exercise mode).
  setEnhancedSelectHidden(els.workoutGrouping, S.workoutShowMode !== "groups");
  // (Name mode — Code / Short / Full — now lives ONLY in the exercise selector's
  // "Show as" toggle; the redundant history-console button was removed.)
  els.workoutsPageBtn.textContent = String(S.workoutsPageSize);
  els.restToggle.hidden = false; // rest periods now apply to day AND the period modes
  els.restToggle.classList.toggle("is-active", S.showRestDays);
  els.restToggle.setAttribute("aria-pressed", S.showRestDays ? "true" : "false");
  els.addSetsToggle.classList.toggle("is-active", S.showAddSets);
  els.addSetsToggle.setAttribute("aria-pressed", S.showAddSets ? "true" : "false");
  els.aloneTagToggle.classList.toggle("is-active", S.showAloneTags);
  els.aloneTagToggle.setAttribute("aria-pressed", S.showAloneTags ? "true" : "false");
  // The "Hidden" control sits in the head row next to the ⚙. Label shows the
  // counts: OFF → "⚑ hidden H/T" (some lifts hidden by the Index filter); ON →
  // "hide H/T". Hidden entirely when nothing is hidden and we're not revealing.
  const hid = hiddenByIndexCount(els.athlete.value);
  const tot = totalLiftsCount(els.athlete.value);
  els.woShowAllToggle.hidden = hid === 0 && !woShowAllExercises;
  els.woShowAllToggle.textContent = woShowAllExercises ? `hide ${hid}/${tot}` : `⚑ hidden ${hid}/${tot}`;
  els.woShowAllToggle.classList.toggle("is-active", woShowAllExercises);
  els.woShowAllToggle.setAttribute("aria-pressed", woShowAllExercises ? "true" : "false");
  els.aloneFilter.textContent = ALONE_FILTER_SHORT[aloneFilter];
  els.aloneFilter.title = ALONE_FILTER_LABEL[aloneFilter] + " — tap to cycle";
}
// How the Exercises list is ordered: "sets" = flat, most-trained first;
// "category" = grouped by muscle/movement category (categories ordered by total
// sets), and within each category still by sets.
let exerciseSort: "sets" | "category" | "tier" = "category";
// "Legs (all)" is a broad umbrella that overlaps the narrower leg splits, so it's
// hidden from the By-category list by default; a Settings toggle brings it back.
let showLegsAll = (() => { try { return localStorage.getItem("colosseum.legsAll") === "1"; } catch { return false; } })();
// Simplified view: when on, the bottom "Analysis" button opens the S-ANL page.
// Defaults ON outside admin (spectator/user), OFF for admin — until explicitly set.
let simplifiedView = (() => {
  try {
    const v = localStorage.getItem("colosseum.simplifiedView");
    if (v === "1") return true;
    if (v === "0") return false;
  } catch { /* ignore */ }
  return viewMode !== "admin";
})();
// Which Exercises in-page tab is showing: the records-style list, or the compare graph.
let exercisesTab: "list" | "compare" = "list";
// Editable rep-max columns for the List & stats tab (the working weight for N reps
// off the best 1RM in the selected period). The owner can change the rep counts.
let repMaxCols: number[] = [1];
// Live search filter for the exercises list (substring on the exercise name).
let exerciseSearch = "";
// When true, append exercises this athlete has never logged (greyed) so gaps
// in their training are visible instead of being an empty search result.
let exerciseShowNotTrained = false;
// When false (default), 3rd-tier exercises (cardio / mobility / warm-ups — not
// really strength) are folded out of the list; the toggle reveals them.
let exerciseShowThird = false;
// In category mode, which category headers are EXPANDED (tapped open). Empty by
// default, so every category starts collapsed — the list opens as a tidy set of
// category headers you tap to open.
const expandedExCats = new Set<string>();
// Same idea for the By-tier sort: which frequency tiers (S/A/B/C/D) are expanded.
const expandedExTiers = new Set<string>();
// Categories the owner has chosen to HIDE from the By-category list (picker chips).
const hiddenExCats = new Set<string>((() => {
  try { return JSON.parse(localStorage.getItem("colosseum.hiddenCats") ?? "[]") as string[]; } catch { return []; }
})());
// Which exercise categories are expanded in the Exercises tab. null = first paint
// (open them all); a Set afterwards = the user's remembered open/closed choices.
// S.bwOpenCats lives on S (appState).

// How the Index page groups its exercise rows. "discipline" is the training style
// (multi-membership — a lift can sit under several); the others slice the same lifts
// by fine muscle, by functional movement pattern, or by combinable / comparable
// synthetic-group membership.
// IndexGroupMode now imported from appState; S.bwGroupMode lives on S.
const INDEX_GROUP_MODES: { mode: IndexGroupMode; label: string }[] = [
  // Shared core (matches the picker + calendar) …
  { mode: "discipline", label: "Discipline" },
  { mode: "muscleGroup", label: "Muscle group" },
  { mode: "function", label: "Function" },
  { mode: "tier", label: "Tier" },
  // … then the Index-only extra taxonomy dims …
  { mode: "bodyPart", label: "Body part" },
  { mode: "joint", label: "Joint" },
  { mode: "movement", label: "Movement" },
  { mode: "plane", label: "Plane" },
  { mode: "difficulty", label: "Difficulty" },
  { mode: "equipment", label: "Equipment" },
  // … and the merge/comparison groupings.
  { mode: "combinable", label: "Combinable" },
  { mode: "comparable", label: "Comparable" },
];
// Fine muscle groups in display order, with a colour (legs/arms split off the
// CATEGORY_COLORS shades; the rest reuse them).
const INDEX_MUSCLES: MuscleGroup[] = [
  "Quads", "Hamstrings", "Glutes", "Abductors", "Adductors", "Calves",
  "Lower back", "Upper back", "Lats",
  "Chest", "Shoulders", "Biceps", "Triceps", "Forearms",
  "Core", "Other",
];
const muscleColor = (m: MuscleGroup): string =>
  (({
    Quads: "#284e86", Hamstrings: "#3a5fa0", Glutes: "#4f78bd", Abductors: "#5a83c6", Adductors: "#6a90cd", Calves: "#6f93cf",
    "Lower back": "#3b66a6", "Upper back": "#4f79b8", Lats: "#5f86c2",
    Biceps: "#9c5bb8", Triceps: "#b07fc9", Forearms: "#c79fd8",
  } as Record<string, string>)[m]) ??
  CATEGORY_COLORS[m as TrainingCategory] ?? CATEGORY_COLORS.Other;

// Discipline (training-style) colours for the Index "By discipline" grouping.
const DISCIPLINE_COLORS: Record<Discipline, string> = {
  "Strength": "#284e86", Calisthenics: "#2e7d52", Statics: "#5e708a", Mobility: "#1f8a8a",
  Dynamic: "#c0603a", Posture: "#6c4ab0", Cardio: "#a23b3b",
  Balance: "#3a7d9b", Parkour: "#8a6d3b", Climbing: "#7a6f9b",
};
const disciplineColor = (d: Discipline): string => DISCIPLINE_COLORS[d] ?? "#777";
// The two "main" disciplines shown at the Index top level; the rest nest under "Other".
const MAJOR_DISCIPLINES: Discipline[] = ["Strength", "Calisthenics"];
// Inside the big "Strength" discipline, slice its lifts further by muscle or function.
let strengthSubMode: "muscleGroup" | "function" = "muscleGroup";

interface IndexRow { name: string; coeff: number; count: number; }
interface IndexBucket { key: string; label: string; color: string; rows: IndexRow[]; }

/** Split the Index exercise rows into ordered, labelled buckets for the chosen
 * grouping mode. "function" is multi-membership (one lift can appear in several
 * pattern buckets); "combinable"/"comparable" show each synthetic group's members
 * plus a trailing bucket for everything not in such a group. */
function indexBuckets(rows: IndexRow[], mode: IndexGroupMode): IndexBucket[] {
  // A lift can sit in SEVERAL muscle groups / categories, so it appears under each.
  const groupByMulti = <K extends string>(keys: (r: IndexRow) => readonly K[]): Map<K, IndexRow[]> => {
    const by = new Map<K, IndexRow[]>();
    for (const r of rows) for (const k of keys(r)) { const list = by.get(k); if (list) list.push(r); else by.set(k, [r]); }
    return by;
  };
  if (mode === "combinable" || mode === "comparable") {
    const groups = mode === "combinable" ? effectiveCombinableGroups() : effectiveComparableGroups();
    const buckets: IndexBucket[] = groups
      .map((g) => ({ key: g.id, label: g.label, color: "#1f6f8b", rows: rows.filter((r) => g.members?.some((m) => m.exerciseName === r.name)) }))
      .filter((b) => b.rows.length);
    const grouped = new Set(buckets.flatMap((b) => b.rows.map((r) => r.name)));
    const rest = rows.filter((r) => !grouped.has(r.name));
    if (rest.length)
      buckets.push({ key: "__ungrouped", label: mode === "combinable" ? "Not in a combinable group" : "Not in a comparable group", color: CATEGORY_COLORS.Other, rows: rest });
    return buckets;
  }
  // Every other mode is a metadata dimension resolved the SAME way as the picker
  // and calendar (shared resolver). Discipline & muscle group keep their curated
  // colours + display order; the rest hash a hue and sort alphabetically.
  const valuesFor = (name: string): string[] =>
    mode === "discipline" ? discsFor(name)
    : mode === "muscleGroup" ? mgsFor(name)
    : waMeta(name, mode as ExerciseFilterDim);
  const by = groupByMulti((r) => valuesFor(r.name));
  const order: string[] =
    mode === "discipline" ? DISCIPLINES.filter((d) => by.has(d))
    : mode === "muscleGroup" ? INDEX_MUSCLES.filter((m) => by.has(m))
    : [...by.keys()].sort((a, b) => a.localeCompare(b));
  const colorFor = (k: string): string =>
    mode === "discipline" ? disciplineColor(k as Discipline)
    : mode === "muscleGroup" ? muscleColor(k as MuscleGroup)
    : hashHueHex(k);
  return order.map((k) => ({ key: k, label: k, color: colorFor(k), rows: by.get(k)! }));
}

/** Build the custom athlete chip row from the (hidden) select's options. */
function buildAthleteChips() {
  els.athleteChips.innerHTML = [...els.athlete.options]
    .map(
      (o) =>
        `<button type="button" class="athlete-chip" role="radio" data-username="${escapeHtml(o.value)}">${escapeHtml(o.text)}</button>`,
    )
    .join("");
  syncAthleteChips();
}

// Athlete-picker sex filter: always "m" OR "f" (no "both"/all). It auto-switches
// to the selected athlete's sex, and tapping M/W narrows the chips to that sex.
let athleteSexFilter: "m" | "f" = "m";
/** The single M/W toggle shows the current sex and cycles on tap. */
function syncSexToggle() {
  const btn = els.athleteSexFilter;
  btn.textContent = athleteSexFilter === "m" ? "M" : "W";
  btn.dataset.athsex = athleteSexFilter;
  btn.classList.toggle("is-women", athleteSexFilter === "f");
  btn.title = athleteSexFilter === "m" ? "Showing men — tap for women" : "Showing women — tap for men";
}

/** Mark the chip matching the selected athlete active (chips mirror the select).
 * In user view every chip but Adomas's is disabled, so the user can only pick him.
 * The Men/Women filter additionally hides chips of the other sex. */
function syncAthleteChips() {
  const active = els.athlete.value;
  const locked = lockedUsername(); // null in admin; the locked athlete otherwise
  // In a locked (user/spectator) view you only ever see yourself: hide the M/W sex
  // menu and every other athlete's chip entirely (not just disable them), and drop
  // the full-bleed sticky-bar styling so the lone chip isn't an empty white band.
  els.athleteSexFilter.hidden = locked !== null;
  els.athleteChips.closest(".ath-row")?.classList.toggle("ath-row--solo", locked !== null);
  for (const btn of els.athleteChips.querySelectorAll<HTMLButtonElement>(".athlete-chip")) {
    const on = btn.dataset.username === active;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-checked", on ? "true" : "false");
    if (locked !== null) {
      // Locked view: show ONLY the locked user's chip; no sex filtering, no lock-out
      // styling on others (they're gone), nothing else selectable.
      btn.hidden = btn.dataset.username !== locked;
      btn.disabled = false;
      btn.classList.remove("is-sexhidden", "is-locked");
      if (on) btn.scrollIntoView({ block: "nearest", inline: "nearest" });
      continue;
    }
    // Admin: every chip is selectable; the M/W filter hides the other sex (the
    // active one stays visible so you can always see who's currently selected).
    btn.hidden = false;
    btn.disabled = false;
    btn.classList.remove("is-locked");
    const sex = athProfile(btn.dataset.username ?? "")?.sex;
    btn.classList.toggle("is-sexhidden", sex !== athleteSexFilter && !on);
    if (on) btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

/** Re-render every athlete sub-page for the selected athlete (resets paging). */
function renderAthlete() {
  saveLastAthlete(els.athlete.value); // remember across reloads
  // The M/W toggle auto-follows whoever is selected (it's always Men or Women).
  const sex = athProfile(els.athlete.value)?.sex;
  if (sex === "m" || sex === "f") athleteSexFilter = sex;
  syncSexToggle();
  syncAthleteChips();
  S.workoutsPage = 0;
  selectedExercise = null;
  athleteWorkouts = workoutsForUser(activeRecords(), els.athlete.value);
  els.summaryOut.textContent = ""; // clear last athlete's AI summary
  initHeatYear();
  renderAthleteProfile();
  renderSAnalysis();
  renderAthleteStats();
  renderMomentum();
  renderTrainBreakdown();
  renderMuscleMap();
  renderExercisesPage();
  renderWorkoutCalendar();
  renderWorkoutsPage();
  // Analysis hosts the legacy panels via relocation, but its OWN UI (the
  // exercise selector, mode readout, etc.) needs an athlete-aware refresh too.
  if (typeof renderWorkoutAnalysis === "function") renderWorkoutAnalysis();
}

// ---- Athlete Records sub-page: this athlete's PRs across all exercises ----
/** Build one body-stat "value chip" for the compact line (label + number, plus a
 * tappable ⓘ that toggles its math panel) and the matching hidden panel. */
// Body-stats lean/fat mass bar: show the split in kg or as a % of bodyweight.
let bcMassUnit: "kg" | "pct" = (() => {
  try { return localStorage.getItem("colosseum.bcMassUnit") === "pct" ? "pct" : "kg"; } catch { return "kg"; }
})();
function bcChip(id: string, label: string, valueStr: string): string {
  return (
    `<span class="bc-chip"><span class="bc-c-lbl muted">${escapeHtml(label)}</span> <b class="bc-c-val">${valueStr}</b>` +
    `<button type="button" class="bc-info" data-bcinfo="${id}" aria-label="How ${escapeHtml(label)} is calculated" title="How this is calculated">ⓘ</button></span>`
  );
}
const bcPanel = (id: string, deriveHtml: string): string => `<div class="bc-panel" data-bcpanel="${id}" hidden>${deriveHtml}</div>`;
/** Profile line for the selected athlete: a lead nFFMI badge (computed from
 * weight / height / body fat) followed by the raw specs it's built from. */
function renderAthleteProfile() {
  const username = els.athlete.value;
  const p = athProfile(username);
  // The collapsed "Body stats" summary shows a compact mini-dashboard of the
  // headline numbers (bodyweight · bf · age · height · nFFMI) on a line under the
  // title. Each is a small value+unit cell.
  const setStatsSummary = (cellsHtml: string) => { if (els.bodyStatsSummary) els.bodyStatsSummary.innerHTML = cellsHtml; };
  const bsCell = (val: string, unit: string) => `<span class="bs-cell"><b>${escapeHtml(val)}</b><span class="bs-u">${escapeHtml(unit)}</span></span>`;
  // Training-summary cells appended after the body stats: how long they've trained
  // (the span, e.g. "14 months") and the average sessions per week.
  const ts = athleteSummary(activeRecords(), username);
  const trainCells: string[] = [];
  if (ts.sets > 0) {
    if (ts.firstDate && ts.lastDate) {
      const dur = trainingDuration(ts.firstDate, ts.lastDate); // "14 months" / "1.2 years" / …
      const sp = dur.indexOf(" ");
      trainCells.push(sp > 0 ? bsCell(dur.slice(0, sp), dur.slice(sp + 1)) : bsCell(dur, ""));
    }
    trainCells.push(bsCell(ts.sessionsPerWeek.toFixed(1), "/wk"));
  }
  const editBtn = `<div class="profile-edit-row"><button type="button" class="profile-edit" data-editstats="${escapeHtml(username)}" title="Edit these stats">✎ Edit</button></div>`;
  if (!p) {
    setStatsSummary(trainCells.join("")); // no body profile → still show training stats
    els.athleteProfile.innerHTML = `<span class="muted">No profile on file</span> ${editBtn}`;
    return;
  }
  // Body fat is a band, not a point. It no longer sits on the spec line — it's
  // shown as its own row in the derived-values list below (with the same 50/95 ±
  // margins as nFFMI / lean / fat), so all the uncertain values read together.
  const dist = bfDistFor(username);
  const specs = [`${p.weight} kg`, `${p.height} cm`];
  if (p.age != null) specs.push(`age ${p.age}`);
  const specLine = `<span class="profile-specs">${specs.join("  ·  ")}</span>`;
  // Compact collapsed-summary cells: bodyweight · bf · age · height (· nFFMI added below).
  const sumCells = [bsCell(`${p.weight}`, "kg"), bsCell(`${Math.round(dist.avg * 100)}%`, "bf")];
  if (p.age != null) sumCells.push(bsCell(`${p.age}`, "y"));
  sumCells.push(bsCell(`${p.height}`, "cm"));

  const range = nffmiRange(p.weight, p.height, dist);
  if (!range) {
    setStatsSummary([...sumCells, ...trainCells].join(""));
    els.athleteProfile.innerHTML = specLine + " " + editBtn;
    return;
  }
  setStatsSummary([...sumCells, bsCell(range.avg.toFixed(1), "nFFMI"), ...trainCells].join(""));
  const f1 = (n: number) => n.toFixed(1);
  const f1s = (n: number) => (Math.round(n * 10) / 10).toString();
  // nFFMI badge — headline number only; the detail lives in the line + ⓘ math.
  const badge =
    `<span class="nffmi-badge" title="Normalised fat-free mass index (lean mass ÷ height², scaled to 1.8 m). ~22 trained, ~25 natural ceiling.">` +
    `<span class="nffmi-val">${range.avg.toFixed(1)}</span>` +
    `<span class="nffmi-lbl">nFFMI</span>` +
    `</span>`;
  // Body-composition ranges derived from the body-fat band: lean mass and fat
  // mass (kg), each as a predicted value ± with a little 50/95 range bar — the
  // same uncertainty the nFFMI carries, made visual.
  const mass = bodyMassRanges(p.weight, dist);
  // ---- ℹ derivations: how each value is calculated, in the same math style as
  // the workouts list's 1RM (rm-derive / rm-step). ----
  const hM = p.height / 100;
  const comp = bodyComposition({ weight: p.weight, height: p.height, bodyFat: dist.avg });
  const bfPct = (n: number) => `${f1(n * 100)}%`;
  const dstep = (lbl: string, eq: string) => `<div class="rm-step"><span class="rm-lbl">${lbl}</span><span class="rm-eq">${eq}</span></div>`;
  const derive = (steps: string[]) => `<div class="rm-derive">${steps.filter(Boolean).join("")}</div>`;
  const nffmiDerive = derive([
    dstep("lean", `${p.weight} kg × (1 − ${bfPct(dist.avg)}) = <b>${f1(range.leanAvg)} kg</b>`),
    comp ? dstep("FFMI", `${f1(range.leanAvg)} ÷ ${f1(hM)}² = <b>${f1(comp.ffmi)}</b>`) : "",
    dstep("nFFMI", `FFMI + 6.1 × (1.8 − ${f1(hM)}) = <b class="rm-result">${f1(range.avg)}</b>`),
    dstep("spread", `50% / 95% come from your body-fat band`),
  ]);
  const leanDerive = derive([dstep("lean", `${p.weight} kg × (1 − ${bfPct(dist.avg)}) = <b class="rm-result">${f1(mass.lean.avg)} kg</b>`)]);
  const fatDerive = derive([dstep("fat", `${p.weight} kg × ${bfPct(dist.avg)} = <b class="rm-result">${f1(mass.fat.avg)} kg</b>`)]);
  const bfDerive = derive([
    dstep("body fat", `your estimate — edit on the Athletes page`),
    dstep("50% band", `${bfPct(dist.low50)} – ${bfPct(dist.high50)}`),
    dstep("95% band", `${bfPct(dist.low95)} – ${bfPct(dist.high95)}`),
  ]);
  // Compact numbers line (no bars / ranges / ±). Each value carries a ⓘ that
  // toggles its math panel, shown below the line.
  const sep = ` <span class="bc-sep">·</span> `;
  const bodyComp =
    `<div class="bodycomp"><div class="bc-line">` +
    [
      bcChip("bf", "Body fat", bfPct(dist.avg)),
      bcChip("lean", "Lean", `${f1s(mass.lean.avg)} kg`),
      bcChip("fat", "Fat", `${f1s(mass.fat.avg)} kg`),
      bcChip("nffmi", "nFFMI", f1(range.avg)),
    ].join(sep) +
    `</div>` +
    bcPanel("bf", bfDerive) + bcPanel("lean", leanDerive) + bcPanel("fat", fatDerive) + bcPanel("nffmi", nffmiDerive) +
    `</div>`;
  // Likely lifetime NATURAL potential: the drug-free lean ceiling at this height,
  // and the ideal bodyweight to carry it at each sport's typical body fat.
  const pot = p.sex ? naturalPotential(p.height, p.sex) : null;
  const potBlock = pot
    ? (() => {
        const sexLbl = p.sex === "f" ? "women" : "men";
        const capDerive = derive([
          dstep("ceiling", `natural nFFMI ≈ ${pot.ceilingNffmi} (${sexLbl}, Kouri et al.)`),
          dstep("lean cap", `(${pot.ceilingNffmi} − 6.1 × (1.8 − ${f1(hM)})) × ${f1(hM)}² = <b class="rm-result">${f1(pot.leanLimit.avg)} kg</b>`),
        ]);
        const wtDerive = (bf: number, ideal: number, sport: string) => derive([
          dstep("carry at", `${Math.round(bf * 100)}% body fat (${sport})`),
          dstep("ideal wt", `${f1(pot.leanLimit.avg)} ÷ (1 − ${Math.round(bf * 100)}%) = <b class="rm-result">${f1(ideal)} kg</b>`),
        ]);
        return (
          `<div class="bodycomp bodycomp-pot">` +
          `<div class="bc-head muted" title="Likely lifetime natural ceiling at nFFMI ≈ ${pot.ceilingNffmi} for ${sexLbl} (Kouri et al.), at this height. Ideal weights put that lean ceiling at a sport-typical body fat: calisthenics ${Math.round(pot.caliBf * 100)}%, power/weightlifting ${Math.round(pot.powerBf * 100)}%. Estimates — genetics & frame vary.">Natural potential (est.)</div>` +
          `<div class="bc-line">` +
          [
            bcChip("leancap", "Lean cap", `${f1s(pot.leanLimit.avg)} kg`),
            bcChip("cali", "Cali wt", `${f1s(pot.idealCalisthenics.avg)} kg`),
            bcChip("power", "Power wt", `${f1s(pot.idealPower.avg)} kg`),
          ].join(sep) +
          `</div>` +
          bcPanel("leancap", capDerive) +
          bcPanel("cali", wtDerive(pot.caliBf, pot.idealCalisthenics.avg, "calisthenics")) +
          bcPanel("power", wtDerive(pot.powerBf, pot.idealPower.avg, "power")) +
          `</div>`
        );
      })()
    : "";
  // Proportional lean/fat MASS BAR: a vertical stacked column (fat on top, lean
  // below) sized by each share of bodyweight, with a kg ⇄ % toggle. The rest of
  // the body-comp info sits to its right.
  const totalMass = mass.lean.avg + mass.fat.avg || p.weight || 1;
  const leanPct = (mass.lean.avg / totalMass) * 100;
  const fatPct = (mass.fat.avg / totalMass) * 100;
  const leanLbl = bcMassUnit === "kg" ? `${f1s(mass.lean.avg)} kg` : `${Math.round(leanPct)}%`;
  const fatLbl = bcMassUnit === "kg" ? `${f1s(mass.fat.avg)} kg` : `${Math.round(fatPct)}%`;
  const seg = (cls: string, pct: number, name: string, val: string) =>
    `<div class="bc-seg ${cls}" style="height:${pct.toFixed(1)}%" title="${name}: ${val}">` +
    `<span class="bc-seg-name">${name}</span><span class="bc-seg-val">${val}</span></div>`;
  const massBar =
    `<div class="bc-massbar" title="Body composition — lean vs fat mass" aria-label="Lean ${leanLbl}, Fat ${fatLbl}">` +
    seg("bc-seg-fat", fatPct, "Fat", fatLbl) +
    seg("bc-seg-lean", leanPct, "Lean", leanLbl) +
    `</div>` +
    `<button type="button" class="bc-unit-toggle" data-bcunit="1" aria-pressed="${bcMassUnit === "pct"}" title="Show the split in kilograms or as a percent of bodyweight">${bcMassUnit === "kg" ? "kg" : "%"}</button>`;
  const massView =
    `<div class="bc-massview">` +
    `<div class="bc-masscol">${massBar}</div>` +
    `<div class="bc-massside">${badge} ${specLine}${bodyComp}${potBlock}</div>` +
    `</div>`;
  els.athleteProfile.innerHTML = editBtn + massView;
}

// ===========================================================================
// Simplified analysis page (S-ANL). Built from scratch (CLAUDE.md rule 12) — it
// uses the shared PURE data helpers (athProfile, workoutsForUser…) but none of
// the full-ANL rendering code. Two sections so far: Body stats + Workouts.
// ===========================================================================

/** Free-text exercise filter for the S-ANL workouts list ("" = all). */
let sAnlExFilter = "";

/** Render the whole S-ANL page: the explained Body-stats card, then a fresh
 * Workouts history with an exercise filter. */
function renderSAnalysis() {
  if (!els.sAnalysis) return;
  els.sAnalysis.innerHTML = sBodyStatsHtml() + sWorkoutsHtml();
  renderSWoList();
}

/** S-ANL Body stats: explained, fewer numbers (50% likely ranges), no muscle
 * map / momentum. Height·age·weight sit small + unexplained up top. */
function sBodyStatsHtml(): string {
  const username = els.athlete.value;
  const p = athProfile(username);
  if (!p) return `<p class="muted">No profile on file.</p>`;
  const dist = bfDistFor(username);
  const range = nffmiRange(p.weight, p.height, dist);
  const mass = bodyMassRanges(p.weight, dist);
  const f1s = (n: number) => (Math.round(n * 10) / 10).toString();
  const specs = [`${p.weight} kg`, `${p.height} cm`];
  if (p.age != null) specs.push(`age ${p.age}`);
  const item = (name: string, value: string, exp: string) =>
    `<div class="s-bs-item"><div class="s-bs-row"><span class="s-bs-name">${name}</span><span class="s-bs-val">${value}</span></div>` +
    `<p class="s-bs-exp muted">${exp}</p></div>`;
  // Everything below derives from the body-fat estimate, so each is shown as its
  // 50% (likely) range — same confidence band as the body-fat figure above.
  const items = [
    item("Body fat", `${Math.round(dist.low50 * 100)}–${Math.round(dist.high50 * 100)}%`, "The share of your bodyweight that's fat — shown as a likely range because it's only an estimate. Lower is leaner, though very low isn't always healthier."),
    item("Lean weight", `${f1s(mass.lean.lo50)}–${f1s(mass.lean.hi50)} kg`, "Everything that isn't fat — muscle, bone, organs, water. More lean weight generally means more strength."),
    item("Fat mass", `${f1s(mass.fat.lo50)}–${f1s(mass.fat.hi50)} kg`, "The actual kilograms of fat you carry — your weight times your body-fat %."),
  ];
  if (range) items.push(item("nFFMI", `${range.lo50.toFixed(1)}–${range.hi50.toFixed(1)}`, "A muscle-for-your-height score — like BMI but counting only lean mass. Roughly: ~18 untrained, ~22 well-trained, ~25 the natural ceiling."));
  return (
    `<details class="s-bodystats" open><summary class="s-bodystats-sum">Stats</summary>` +
    `<div class="s-bs-body"><div class="s-bs-specs muted">${specs.join("  ·  ")}</div>` +
    items.join("") +
    `</div></details>`
  );
}

/** S-ANL Workouts shell: a filter box + an (initially empty) list filled by
 * renderSWoList — so typing in the filter only re-renders the list, not the box. */
function sWorkoutsHtml(): string {
  return (
    `<details class="s-wo" open><summary class="s-bodystats-sum">Workouts</summary>` +
    `<div class="s-wo-body">` +
    `<input type="search" class="s-wo-search" placeholder="Filter by exercise…" aria-label="Filter workouts by exercise" value="${escapeHtml(sAnlExFilter)}" />` +
    `<div id="sWoList" class="s-wo-list"></div>` +
    `</div></details>`
  );
}

/** Fill the S-ANL workouts list: one row per training day (newest first), each
 * with its exercises and set counts, narrowed to the exercise filter. */
function renderSWoList(): void {
  const box = document.getElementById("sWoList");
  if (!box) return;
  const username = els.athlete.value;
  const q = sAnlExFilter.trim().toLowerCase();
  const matchEx = (name: string): boolean =>
    !q || displayName(name).toLowerCase().includes(q) || name.toLowerCase().includes(q);
  const days = workoutsForUser(activeRecords(), username)
    .filter((d) => d.totalSets > 0)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const rows: string[] = [];
  for (const d of days) {
    const exes = d.exercises.filter((e) => matchEx(e.exerciseName));
    if (exes.length === 0) continue;
    const line = exes
      .map((e) => {
        const n = d.sets.filter((s) => s.exerciseName === e.exerciseName).length;
        return `${escapeHtml(displayName(e.exerciseName))} <span class="muted">×${n}</span>`;
      })
      .join(" · ");
    rows.push(`<div class="s-wo-day"><span class="s-wo-date">${escapeHtml(shortDate(d.date))}</span><span class="s-wo-did">${line}</span></div>`);
  }
  box.innerHTML = rows.join("") || `<p class="muted">${q ? "No workouts for that filter." : "No workouts."}</p>`;
}

/** Wire the S-ANL filter input (delegated, so it survives re-renders). */
function setupSAnalysis(): void {
  els.sAnalysis?.addEventListener("input", (e) => {
    const inp = (e.target as HTMLElement).closest<HTMLInputElement>(".s-wo-search");
    if (inp) { sAnlExFilter = inp.value; renderSWoList(); }
  });
}

// Category palette for the training breakdown (warm-to-cool, distinct hues).
const CATEGORY_COLORS: Record<TrainingCategory, string> = {
  Legs: "#284e86",
  Chest: "#2f7d6b",
  Back: "#3b66a6",
  Shoulders: "#b8902f",
  Arms: "#9c5bb8",
  Core: "#c0603a",
  Dynamic: "#d98326",
  Skill: "#5b8c3a",
  Mobility: "#7fa1d4",
  Posture: "#9aa7bd",
  Cardio: "#6b7280",
  Other: "#cbd5e1",
};

/** Colour for a LIST_CATEGORIES bucket (the new multi-category set used by the
 * By-category list, Group view and compare picks). Muscle groups reuse
 * CATEGORY_COLORS; the pattern/leg-split buckets get their own shades. */
const LIST_CATEGORY_COLORS: Record<string, string> = {
  "Squat pattern": "#1f6f8b",
  "Deadlift pattern": "#3a4a86",
  "Deadlift accessory": "#7a6cae",
  "Legs (all)": "#284e86",
  "Legs (quads/glutes/hams)": "#2f6fb0",
};
const listCatColor = (c: string): string =>
  LIST_CATEGORY_COLORS[c] ?? CATEGORY_COLORS[c as TrainingCategory] ?? CATEGORY_COLORS.Other;

/** Compact "what they've been doing" stat chips for the selected athlete. */
function renderAthleteStats() {
  const s = athleteSummary(activeRecords(), els.athlete.value);
  if (s.sets === 0) {
    els.athleteStats.innerHTML = "";
    return;
  }
  const chip = (label: string, value: string) =>
    `<span class="stat-chip"><span class="stat-val">${value}</span><span class="stat-lbl">${label}</span></span>`;
  const chips = [
    chip("training", s.firstDate && s.lastDate ? trainingDuration(s.firstDate, s.lastDate) : "—"),
    chip("per week", s.sessionsPerWeek.toFixed(1)),
  ];
  els.athleteStats.innerHTML = chips.join("");
}

/**
 * Momentum row: for the athlete's most-trained lifts, a chip showing how much the
 * estimated 1RM has moved OVER THE CHOSEN WINDOW (last week / month / 3 months),
 * as a percent of the 1RM at the start of that window. Lifts not trained inside
 * the window are dropped — so a lift you stopped years ago shows no momentum.
 */
/** Momentum window: the last week / month / 3 months. */
type MomentumPeriod = "wk" | "mo" | "3mo";
let momentumPeriod: MomentumPeriod = "wk";
const MO_PERIOD_WEEKS: Record<MomentumPeriod, number> = { wk: 1, mo: 4.345, "3mo": 13.04 };
const MO_PERIOD_NEXT: Record<MomentumPeriod, MomentumPeriod> = { wk: "mo", mo: "3mo", "3mo": "wk" };
function renderMomentum() {
  const username = els.athlete.value;
  const formula = currentFormula();
  const recs = filterRecords(computedRecords(), { excludeDropsets: els.excludeDropsets.checked });
  // Consider the athlete's most-trained exercises, then keep those moving lately.
  const top = exerciseCountsForUser(activeRecords(), username).slice(0, 24);
  const windowStart = Date.now() - MO_PERIOD_WEEKS[momentumPeriod] * 7 * 86_400_000;
  // % change of the est. 1RM across the window: latest vs the value entering it.
  const chips: { name: string; pct: number }[] = [];
  for (const c of top) {
    const pts = exerciseProgressByWeek(recs, username, c.exerciseName, formula).filter((p) => p.bestE1rm !== null);
    if (pts.length < 2) continue;
    const recent = pts[pts.length - 1]!; // most recent week with data
    if (Date.parse(recent.date) < windowStart) continue; // not trained in the window → skip
    // The 1RM as the window began: the last point before it, else the earliest point.
    let past = pts[0]!;
    for (const p of pts) if (Date.parse(p.date) <= windowStart) past = p;
    if (past === recent) continue; // only one point in range → no change to show
    const base = past.bestE1rm!;
    if (base <= 0) continue; // % is meaningless off a zero/negative base
    chips.push({ name: c.exerciseName, pct: ((recent.bestE1rm! - base) / base) * 100 });
  }
  if (chips.length === 0) {
    els.momentum.innerHTML = "";
    return;
  }
  // Most movement first (by absolute rate); show the top 6 so the row stays tidy.
  chips.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const per = `/${momentumPeriod}`;
  const windowName = momentumPeriod === "wk" ? "week" : momentumPeriod === "mo" ? "month" : "3 months";
  const body = chips
    .slice(0, 6)
    .map((m) => {
      const up = m.pct > 0.05;
      const down = m.pct < -0.05;
      const cls = up ? "mo-up" : down ? "mo-down" : "mo-flat";
      const arrow = up ? "▲" : down ? "▼" : "▪";
      const rate = `${m.pct >= 0 ? "+" : ""}${m.pct.toFixed(1)}%`;
      return (
        `<span class="mo-chip ${cls}" title="${escapeHtml(m.name)}: ${rate} est-1RM change over the last ${windowName}">` +
        `<span class="mo-arrow">${arrow}</span> ${escapeHtml(m.name)} ` +
        `<span class="mo-rate">${rate}<span class="mo-per">${per}</span></span></span>`
      );
    })
    .join("");
  // Period toggle (cycles wk → mo → 3mo) sits in the header — one pill, not a row.
  const periodBtn = `<button type="button" class="mo-period" data-moperiod="1" title="Trend period — tap to change">${per}</button>`;
  els.momentum.innerHTML = `<div class="mo-lead muted">Momentum <span class="mo-sub">(est. 1RM trend)</span> ${periodBtn}</div><div class="mo-chips">${body}</div>`;
}

/** "What they train": a proportional bar of sets per muscle/movement category. */
function renderTrainBreakdown() {
  const counts = exerciseCountsForUser(activeRecords(), els.athlete.value);
  const byCat = new Map<TrainingCategory, number>();
  let total = 0;
  for (const c of counts) {
    const cat = catFor(c.exerciseName);
    byCat.set(cat, (byCat.get(cat) ?? 0) + c.count);
    total += c.count;
  }
  if (total === 0) {
    els.trainBreakdown.innerHTML = "";
    return;
  }
  const cats = TRAINING_CATEGORIES.filter((c) => byCat.get(c));
  const pct = (c: TrainingCategory) => (byCat.get(c)! / total) * 100;
  // Labels live on the bar itself (no separate legend). Only segments wide
  // enough to fit text are labelled; the rest still show their share on hover.
  const bar = cats
    .map((c) => {
      const p = pct(c);
      const label = p >= 11 ? `${c} ${p.toFixed(0)}%` : p >= 6 ? `${p.toFixed(0)}%` : "";
      return (
        `<span class="tb-seg" style="flex:${p.toFixed(2)};background:${CATEGORY_COLORS[c]}" ` +
        `title="${c}: ${byCat.get(c)} sets (${p.toFixed(0)}%)">` +
        `${label ? `<span class="tb-seg-lbl">${escapeHtml(label)}</span>` : ""}</span>`
      );
    })
    .join("");
  els.trainBreakdown.innerHTML =
    `<div class="tb-title muted">What ${escapeHtml(athleteLabel())} trains <span class="tb-sub">(${total.toLocaleString()} sets)</span></div>` +
    `<div class="tb-bar">${bar}</div>`;
}

/**
 * Front/back muscle map: simplified body silhouettes whose regions are shaded by
 * how STRONG the athlete is in the matching category — their best StrengthLevel
 * strength percentile (0..100, vs the population) among that category's lifts.
 * So a darker muscle means "stronger here", not "trained more". Untrained or
 * unscored regions show light grey. Hover a region for the percentile.
 */
/** Each muscle region is read off a specific STRENGTH FEAT (the owner's choice):
 * the region's shade and number come from the athlete's best estimated 1RM on
 * that lift. names[] lists the lifts that count for the region (best of any). */
const MUSCLE_FEATS: { cat: TrainingCategory; label: string; feat: string; names: string[] }[] = [
  { cat: "Legs", label: "Quads", feat: "Squat", names: ["Squat", "Smith Machine Squat", "Front Squat"] },
  { cat: "Legs", label: "Glutes", feat: "Squat", names: ["Squat", "Smith Machine Squat", "Hip Thrust"] },
  { cat: "Legs", label: "Hamstrings / lower back", feat: "Deadlift", names: ["Deadlift", "Romanian Deadlift", "Stiff Leg Deadlift"] },
  { cat: "Back", label: "Back (lats)", feat: "Pull Ups", names: ["Pull Ups", "Chin Ups", "Lat Pulldown"] },
  { cat: "Chest", label: "Chest", feat: "Push Ups", names: ["Push Ups", "Bench Press"] },
  { cat: "Shoulders", label: "Shoulders", feat: "Shoulder Press", names: ["Shoulder Press", "Seated Shoulder Press", "Dumbbell Shoulder Press", "Overhead Press", "Military Press"] },
  { cat: "Arms", label: "Triceps", feat: "Dips", names: ["Dips", "Seated Dip Machine"] },
  { cat: "Arms", label: "Biceps", feat: "Pull Ups", names: ["Pull Ups", "Chin Ups", "Barbell Curl"] },
  { cat: "Core", label: "Core (abs)", feat: "Decline Sit Ups", names: ["Decline Sit Up", "Decline Sit Ups", "Sit Ups", "Hanging Leg Raise"] },
];

function renderMuscleMap() {
  const username = els.athlete.value;
  // Best estimated 1RM per exercise for this athlete, then the best for each
  // region's feat list. Drives both the shade and the kg shown.
  const prByEx = new Map<string, number>();
  for (const pr of personalRecords(
    filterRecords(computedRecords(), { usernames: [username], excludeDropsets: true }),
    currentFormula(),
    strengthAsOf(),
  )) prByEx.set(pr.exerciseName, pr.bestE1rm.e1rm);
  const best1rm = (names: string[]): number | null => {
    let best: number | null = null;
    for (const n of names) { const v = prByEx.get(n); if (v != null && (best === null || v > best)) best = v; }
    return best;
  };
  const byLabel = new Map<string, number | null>();
  for (const f of MUSCLE_FEATS) byLabel.set(f.label, best1rm(f.names));
  const maxFeat = Math.max(0, ...[...byLabel.values()].filter((v): v is number => v != null));
  if (maxFeat === 0) {
    els.muscleMapBody.innerHTML = `<p class="muted">No 1RM on the key lifts yet (squat, deadlift, pull-ups, push-ups, dips, shoulder press, decline sit-ups).</p>`;
    return;
  }
  // Map each detailed anatomical muscle (by its id) to one of the strength-feat
  // regions above, by keyword, so the real muscle shapes tint by your data.
  // Muscles with no tracked feat (forearms, calves, neck, hands…) → neutral grey.
  const featForMuscle = (id: string): string | null => {
    if (id.includes("chest")) return "Chest";
    if (id.includes("shoulder") || id.includes("deltoid") || id.includes("traps")) return "Shoulders";
    if (id.includes("biceps")) return "Biceps";
    if (id.includes("triceps")) return "Triceps";
    if (id.includes("abs") || id.includes("obliques") || id.includes("serratus")) return "Core (abs)";
    if (id.includes("lats")) return "Back (lats)";
    if (id.includes("lower-back") || id.includes("erectors") || id.includes("-ql") || id === "spine") return "Hamstrings / lower back";
    if (id.includes("hamstrings")) return "Hamstrings / lower back";
    if (id.includes("quads")) return "Quads";
    if (id.includes("glute")) return "Glutes";
    return null; // forearms, calves, tibialis, knees, hip-flexor, head, neck, hands, feet
  };
  const featCat = new Map(MUSCLE_FEATS.map((f) => [f.label, f.cat] as const));
  const fillFor = (feat: string): string => {
    const v = byLabel.get(feat);
    if (v == null) return `fill:#d9d7d0`; // tracked region, nothing logged → light grey
    const op = 0.2 + 0.8 * Math.max(0, Math.min(1, v / maxFeat));
    return `fill:${CATEGORY_COLORS[featCat.get(feat)!]};fill-opacity:${op.toFixed(2)}`;
  };
  // One <path> per muscle: tinted by its feat's best 1RM, or neutral grey if untracked.
  const muscleSvg = (data: MusclePath[], label: string): string => {
    const body = data
      .map((m) => {
        const feat = featForMuscle(m.id);
        if (feat) {
          const v = byLabel.get(feat);
          const t = v == null ? `${m.name} (${feat}): no key lift logged` : `${m.name} — ${feat} best 1RM ${fmt(v)} kg`;
          return `<path d="${m.path}" style="${fillFor(feat)}"><title>${escapeHtml(t)}</title></path>`;
        }
        return `<path d="${m.path}" style="fill:#d9d7d0"><title>${escapeHtml(m.name)}</title></path>`;
      })
      .join("");
    return `<svg viewBox="0 0 35 93" class="body-svg" role="img" aria-label="${label}">${body}</svg>`;
  };
  const front = muscleSvg(frontMuscles, "Front muscle map");
  const back = muscleSvg(backMuscles, "Back muscle map");

  // Legend: each region's feat + best 1RM, strongest first.
  const legend = MUSCLE_FEATS
    .filter((f) => byLabel.get(f.label) != null)
    .sort((a, b) => (byLabel.get(b.label) ?? 0) - (byLabel.get(a.label) ?? 0))
    .map(
      (f) =>
        `<span class="mm-leg"><span class="mm-swatch" style="background:${CATEGORY_COLORS[f.cat]}"></span>` +
        `${escapeHtml(f.label)} <span class="muted">${f.feat} ${fmt(byLabel.get(f.label)!)}kg</span></span>`,
    )
    .join("");

  els.muscleMapBody.innerHTML =
    `<div class="mm-views"><figure><figcaption class="muted">Front</figcaption>${front}</figure>` +
    `<figure><figcaption class="muted">Back</figcaption>${back}</figure></div>` +
    `<div class="mm-legend">${legend}</div>` +
    `<p class="muted mm-note">Shaded by your best estimated 1RM on each muscle's key lift — squat (quads/glutes), deadlift (hams/lower back), pull-ups (back), push-ups (chest), shoulder press, dips (triceps), decline sit-ups (core). Darker = stronger; hover a region for the kg.</p>`;
}

/** Compact, data-only block about the selected athlete for the AI to summarise. */
function athleteContext(): string {
  const username = els.athlete.value;
  const p = athProfile(username);
  const counts = exerciseCountsForUser(activeRecords(), username);
  const workouts = workoutsForUser(activeRecords(), username);
  const totalSets = counts.reduce((s, c) => s + c.count, 0);
  const prs = personalRecords(
    filterRecords(computedRecords(), { usernames: [username], excludeDropsets: true }),
    currentFormula(),
    strengthAsOf(),
  );
  const topLifts = [...prs].sort((a, b) => b.bestE1rm.e1rm - a.bestE1rm.e1rm).slice(0, 8);

  return [
    `Athlete: ${athleteLabel()}`,
    p
      ? `Body: ${p.weight} kg, ${p.height} cm, ${pct(p.bodyFat)} body fat${p.age != null ? `, age ${p.age}` : ""}`
      : "Body: not on file",
    `Training: ${workouts.length} sessions, ${totalSets} sets, latest ${workouts[0]?.date ?? "n/a"}`,
    `Most-trained: ${counts.slice(0, 6).map((c) => `${c.exerciseName} (${c.count} sets)`).join(", ") || "none"}`,
    `Top bodyweight-adjusted est. 1RMs (${currentFormula()}): ` +
      (topLifts.map((l) => `${l.exerciseName} ${Math.round(l.bestE1rm.e1rm)} kg`).join(", ") || "none"),
  ].join("\n");
}

/** Ask the serverless function (Gemini) for a short summary of this athlete. */
async function runSummary() {
  if (location.protocol === "file:") {
    els.summaryOut.textContent =
      "AI summary works on the published website, not the local file. Open the deployed link.";
    return;
  }
  els.summariseBtn.disabled = true;
  els.summaryOut.textContent = "Thinking…";
  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: athleteContext() }),
    });
    const payload = (await res.json()) as { summary?: string; error?: string };
    els.summaryOut.textContent = res.ok ? (payload.summary ?? "No summary.") : (payload.error ?? "Failed.");
  } catch {
    els.summaryOut.textContent = "Couldn't reach the AI service.";
  } finally {
    els.summariseBtn.disabled = false;
  }
}

function athleteLabel(): string {
  return els.athlete.options[els.athlete.selectedIndex]?.text ?? els.athlete.value;
}

/** Prev / range / Next controls for a paginated list. `size` defaults to the
 * app-wide PAGE_SIZE but callers (e.g. the workouts list) can pass their own. */
function pagerHtml(page: number, total: number, size: number = PAGE_SIZE): string {
  if (total <= size) return "";
  const pages = Math.ceil(total / size);
  const from = page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  return (
    `<button class="page-btn" data-page="${page - 1}" ${page <= 0 ? "disabled" : ""}>‹ Prev</button>` +
    `<span class="muted">${from}–${to} of ${total}</span>` +
    `<button class="page-btn" data-page="${page + 1}" ${page >= pages - 1 ? "disabled" : ""}>Next ›</button>`
  );
}

/** Page boundaries for the workout list where REST-DAY slivers count only 1/10 of
 * a real session toward the page size — so a page fills with ~`size` actual
 * sessions, not slivers. Returns each page's START index into `groups`. */
function workoutPageStarts(groups: WorkoutGroup[], size: number): number[] {
  const starts = [0];
  let w = 0;
  for (let i = 0; i < groups.length; i++) {
    w += groups[i]!.rest ? 0.1 : 1;
    if (w >= size && i + 1 < groups.length) { starts.push(i + 1); w = 0; }
  }
  return starts;
}
/** Which weighted page contains group index `idx`. */
function workoutPageOf(idx: number, starts: number[]): number {
  let p = 0;
  for (let i = 0; i < starts.length; i++) if (idx >= starts[i]!) p = i; else break;
  return p;
}
/** Prev / range / Next for the workout list, numbered by REAL sessions/weeks (rest
 * slivers aren't counted), with weighted page boundaries from {@link workoutPageStarts}. */
function workoutsPagerHtml(page: number, starts: number[], groups: WorkoutGroup[], byPeriod: boolean): string {
  const pages = starts.length;
  if (pages <= 1) return "";
  const startIdx = starts[page] ?? 0;
  const endIdx = starts[page + 1] ?? groups.length;
  const isReal = (g: WorkoutGroup) => !g.rest;
  const total = groups.filter(isReal).length;
  const before = groups.slice(0, startIdx).filter(isReal).length;
  const inPage = groups.slice(startIdx, endIdx).filter(isReal).length;
  const from = inPage ? before + 1 : before;
  const to = before + inPage;
  return (
    `<button class="page-btn" data-page="${page - 1}" ${page <= 0 ? "disabled" : ""}>‹ Prev</button>` +
    `<span class="muted">${from}–${to} of ${total} ${byPeriod ? "periods" : "sessions"}</span>` +
    `<button class="page-btn" data-page="${page + 1}" ${page >= pages - 1 ? "disabled" : ""}>Next ›</button>`
  );
}

/** Period options for the exercises list. `days` of 0 means "all time"; every
 * other entry is a rolling window counted back from today. Single source of
 * truth for both the dropdown menu and the cutoff/label helpers below. */
const EXERCISE_PERIODS: { days: number; label: string }[] = [
  { days: 0, label: "All time" },
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 2 weeks" },
  { days: 30, label: "Last month" },
  { days: 90, label: "Last 3 months" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last year" },
  { days: 730, label: "Last 2 years" },
];

/** Currently-selected period, in days (0 = all time). Defaults to the last 3
 * months so the List & stats view opens on recent strength, not all-time. */
let exerciseRangeDays = 90;

/** Cutoff ISO date for the chosen period (e.g. last 90 days), or null for all
 * time. Anchored to today so "last month" means recent calendar time. */
function exerciseRangeCutoff(): string | null {
  if (exerciseRangeDays <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - exerciseRangeDays);
  return d.toISOString().slice(0, 10);
}

/** Human label for the active period, e.g. "Last 3 months". */
function exerciseRangeLabel(): string {
  return EXERCISE_PERIODS.find((p) => p.days === exerciseRangeDays)?.label ?? "All time";
}

/** Build the custom Period dropdown's options and wire selection. Picking an
 * option updates the value label, closes the menu, and re-renders the list. */
function setupExerciseRange(): void {
  const menu = els.exerciseRange.querySelector<HTMLElement>(".period-dd-menu")!;
  const valueEl = els.exerciseRange.querySelector<HTMLElement>(".period-dd-value")!;
  const paint = () => {
    valueEl.textContent = exerciseRangeLabel();
    for (const o of menu.querySelectorAll<HTMLElement>(".period-dd-opt"))
      o.classList.toggle("is-active", o.dataset.days === String(exerciseRangeDays));
  };
  menu.innerHTML = EXERCISE_PERIODS.map(
    (p) =>
      `<button type="button" class="period-dd-opt" role="option" data-days="${p.days}">` +
      `${escapeHtml(p.label)}</button>`,
  ).join("");
  paint();

  menu.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".period-dd-opt");
    if (!btn) return;
    exerciseRangeDays = Number(btn.dataset.days) || 0;
    els.exerciseRange.open = false; // close the dropdown after a pick
    paint();
    selectedExercise = null;
    renderExercisesPage();
  });

  // Close when clicking anywhere outside the dropdown (native <details> stays
  // open otherwise).
  document.addEventListener("click", (e) => {
    if (els.exerciseRange.open && !els.exerciseRange.contains(e.target as Node))
      els.exerciseRange.open = false;
  });
}

/** Wire the By-sets / By-category sort toggle for the exercises list. Picking a
 * mode updates {@link exerciseSort}, resets paging, and re-renders. */
function setupExerciseSort(): void {
  els.exerciseSort.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".ex-sort-btn");
    if (!btn) return;
    const d = btn.dataset.sort;
    const mode = d === "category" ? "category" : d === "tier" ? "tier" : "sets";
    if (mode === exerciseSort) return;
    exerciseSort = mode;
    for (const b of els.exerciseSort.querySelectorAll<HTMLElement>(".ex-sort-btn"))
      b.classList.toggle("is-active", b.dataset.sort === mode);
    selectedExercise = null;
    renderExercisesPage();
  });
}

/** Wire the exercises search box and the "Show not-trained" toggle. Both reset
 * paging and re-render the list. */
function setupExerciseSearch(): void {
  els.exerciseSearch.addEventListener("input", () => {
    exerciseSearch = els.exerciseSearch.value;
    selectedExercise = null;
    renderExercisesPage();
  });
  els.exerciseNotTrained.addEventListener("change", () => {
    exerciseShowNotTrained = els.exerciseNotTrained.checked;
    selectedExercise = null;
    renderExercisesPage();
  });
  els.exerciseShowThird.addEventListener("change", () => {
    exerciseShowThird = els.exerciseShowThird.checked;
    selectedExercise = null;
    renderExercisesPage();
  });
}

/**
 * Re-order an exercise-count list for the active {@link exerciseSort}. In
 * "sets" mode the input order (most-trained first) is kept as-is. In "category"
 * mode exercises are bucketed by {@link exerciseCategory}, the categories are
 * ordered by their combined set count (busiest category first), and within each
 * category the most-trained exercise stays on top. Input order is preserved
 * within buckets, so the per-category sort matches the incoming sets order.
 */
function orderedExerciseCounts<T extends ExerciseCount>(counts: T[]): (T & { _cat?: string })[] {
  if (exerciseSort === "tier") {
    // Tier mode is just most-trained-first; the tier headers are emitted during
    // render as the set count crosses each threshold.
    return [...counts].sort((a, b) => b.count - a.count);
  }
  if (exerciseSort !== "category") return counts;
  // Multi-membership: a lift is repeated once under EACH category it belongs to
  // (deadlift shows under Legs, Back and Core). Each copy carries `_cat` so the
  // render emits the right header and the click→exercise map still lines up.
  const buckets = new Map<string, (T & { _cat?: string })[]>();
  for (const c of counts)
    for (const cat of exerciseCategories(c.exerciseName)) {
      if (cat === "Legs (all)" && !showLegsAll) continue; // hidden unless toggled on in Settings
      if (hiddenExCats.has(cat)) continue; // hidden via the category picker
      (buckets.get(cat) ?? buckets.set(cat, []).get(cat)!).push({ ...c, _cat: cat });
    }
  // Busiest category first; within LIST_CATEGORIES order for ties.
  return [...buckets.entries()]
    .sort((a, b) =>
      sumCounts(b[1]) - sumCounts(a[1]) ||
      LIST_CATEGORIES.indexOf(a[0]) - LIST_CATEGORIES.indexOf(b[0]),
    )
    .flatMap(([, items]) => items);
}

/** Frequency tiers by how many times an exercise has been logged (set count),
 * like a tier list: S = a staple, down to D = barely touched. Thresholds are
 * set-count cutoffs; an untrained (count 0) exercise has no tier. */
function sumCounts(items: readonly ExerciseCount[]): number {
  return items.reduce((s, c) => s + c.count, 0);
}

// Distinct colours for the overlay lines (cycled if more exercises are picked).
const COMPARE_COLORS = [
  "#284e86", "#b8902f", "#2e7d52", "#a23b3b", "#6c4ab0", "#1f8a99", "#c46a1f", "#8a8d2f",
];

/**
 * Exercises-list "compare on one graph" tool: quick-pick rows to add a whole
 * category or frequency-tier of exercises at once, individual chips to fine-tune,
 * and an overlaid estimated-1RM trend line per selected exercise. Defaults to the
 * athlete's top two exercises the first time.
 */
function renderCompareSection() {
  const username = els.athlete.value;
  const counts = exerciseCountsForUser(activeRecords(), username);
  const exercises = compareExerciseNames(username); // pure lifts + available synthetics

  // Drop any previous picks that this athlete doesn't have; seed with top 2.
  for (const name of [...compareSelected]) if (!exercises.includes(name)) compareSelected.delete(name);
  if (compareSelected.size === 0) for (const name of exercises.slice(0, 2)) compareSelected.add(name);

  // Category quick-picks: the same multi-membership buckets as the By-category
  // list (Squat pattern, Legs (all), …), only those this athlete trains, busiest
  // first. A button toggles every exercise in that bucket at once.
  const catSets = new Map<string, number>();
  for (const c of counts)
    for (const cat of exerciseCategories(c.exerciseName))
      catSets.set(cat, (catSets.get(cat) ?? 0) + c.count);
  const cats = LIST_CATEGORIES.filter((c) => catSets.has(c)).sort((a, b) => (catSets.get(b) ?? 0) - (catSets.get(a) ?? 0));
  els.compareCats.innerHTML = cats
    .map((c) => {
      const members = exercises.filter((e) => exerciseCategories(e).includes(c));
      const on = members.length > 0 && members.every((e) => compareSelected.has(e));
      return `<button type="button" class="compare-group${on ? " is-active" : ""}" data-cat="${escapeHtml(c)}" ` +
        `style="--gc:${listCatColor(c)}">${escapeHtml(c)}</button>`;
    })
    .join("");

  // Tier quick-picks: S/A/B/C/D by how often each exercise is logged.
  els.compareTiers.innerHTML = FREQ_TIERS.map((t) => {
    const members = counts.filter((c) => (frequencyTier(c.count)?.tier ?? null) === t.tier).map((c) => c.exerciseName);
    if (members.length === 0) return "";
    const on = members.every((e) => compareSelected.has(e));
    return `<button type="button" class="compare-group tier-pick${on ? " is-active" : ""}" data-tier="${t.tier}" ` +
      `title="${escapeHtml(t.label)}"><span class="tier-badge tier-${t.tier}">${t.tier}</span> ${members.length}</button>`;
  }).join("");

  renderCompareChips();
  renderCompareChart();
}

/**
 * Compare-graph exercise picker. To avoid a wall of pills: by DEFAULT it shows
 * only the SELECTED lifts (tap to remove, colour-matched to the chart), and you
 * SEARCH to add more — typing lists matches as add chips. Bulk category/tier
 * quick-picks live in a collapsible below.
 */
function renderCompareChips() {
  const username = els.athlete.value;
  const exercises = compareExerciseNames(username); // pure lifts + available synthetics
  const q = compareChipQuery.trim().toLowerCase();
  // Colour per selected exercise, matching the chart's line/legend colours.
  const selOrder = exercises.filter((e) => compareSelected.has(e));
  const colorOf = (name: string) => COMPARE_COLORS[selOrder.indexOf(name) % COMPARE_COLORS.length] ?? "#6b7280";

  let html: string;
  if (q) {
    // Search mode: matches to add/remove (selected ones marked).
    const matches = exercises.filter((e) => e.toLowerCase().includes(q)).slice(0, 40);
    html = matches.length
      ? matches
          .map((name) => {
            const on = compareSelected.has(name);
            return `<button type="button" class="compare-chip${on ? " is-active" : ""}" data-ex="${escapeHtml(name)}">` +
              `${on ? "✓ " : "+ "}${escapeHtml(name)}</button>`;
          })
          .join("")
      : `<span class="compare-empty muted">No exercise matches “${escapeHtml(compareChipQuery.trim())}”.</span>`;
  } else {
    // Default: just the selected lifts as removable, colour-matched chips.
    html = selOrder.length
      ? selOrder
          .map(
            (name) =>
              `<button type="button" class="compare-chip is-chosen" data-ex="${escapeHtml(name)}" style="--cc:${colorOf(name)}">` +
              `<span class="cc-dot" style="background:${colorOf(name)}"></span>${escapeHtml(name)} <span class="cc-x">✕</span></button>`,
          )
          .join("")
      : `<span class="compare-empty muted">No lifts selected — search above to add, or use Quick add.</span>`;
  }
  els.compareChips.innerHTML = html;
  els.compareSelCount.textContent = `${compareSelected.size} selected`;
}

/** Toggle every exercise in a category in/out of the compare selection. If they're
 * all already in, remove them; otherwise add the missing ones. Re-renders chips. */
function compareToggleCategory(cat: string) {
  const username = els.athlete.value;
  const members = exerciseCountsForUser(activeRecords(), username)
    .map((c) => c.exerciseName)
    .filter((e) => exerciseCategories(e).includes(cat));
  const allOn = members.length > 0 && members.every((e) => compareSelected.has(e));
  for (const e of members) {
    if (allOn) compareSelected.delete(e);
    else compareSelected.add(e);
  }
  renderCompareSection();
}

/** Toggle every exercise in a frequency tier in/out of the compare selection. */
function compareToggleTier(tier: string) {
  const username = els.athlete.value;
  const members = exerciseCountsForUser(activeRecords(), username)
    .filter((c) => (frequencyTier(c.count)?.tier ?? null) === tier)
    .map((c) => c.exerciseName);
  const allOn = members.length > 0 && members.every((e) => compareSelected.has(e));
  for (const e of members) {
    if (allOn) compareSelected.delete(e);
    else compareSelected.add(e);
  }
  renderCompareSection();
}

/** Build the compare overlay's series + note for a set of picks: one estimated-1RM
 * line per exercise (trend view), or one floating weight→1RM bar per set (per-set
 * view). Shared by the legacy Compare tab and the Analysis compare dropdown. */
function compareSeriesFor(
  picks: string[],
  username: string,
  recs: SetRecord[],
  formula: OneRepMaxFormula,
  view: "trend" | "perset",
): { series: SvgSeries[]; note: string } {
  const ts = (d: string) => Date.parse(d);
  if (view === "perset") {
    const series = picks.map((name, i) => {
      const color = COMPARE_COLORS[i % COMPARE_COLORS.length]!;
      const points = recs
        .filter((r) => r.username === username && r.exerciseName === name)
        .map((s) => {
          const e1rm = addedWeight1RM(s, formula);
          if (e1rm === null) return null;
          const added = s.origWeight !== undefined ? (s.origWeight ?? 0) : (s.weight ?? 0);
          const dLines = [s.date, `${added}kg × ${s.reps ?? 0}`, `1RM ${Math.round(e1rm * 10) / 10} kg`];
          if (s.notes?.trim()) dLines.push(s.notes.trim());
          return { x: ts(s.date), lo: added, hi: e1rm, meta: `×${s.reps ?? 0}`, detail: dLines.join("\n") };
        })
        .filter((p): p is { x: number; lo: number; hi: number; meta: string; detail: string } => p !== null);
      return { name, color, type: "range" as const, points };
    });
    return { series, note: `Every set's weight → its own estimated 1RM (${formula}), one bar per set. Drag to pan · wheel to zoom · tap a bar for its details.` };
  }
  const series = picks.map((name, i) => {
    const color = COMPARE_COLORS[i % COMPARE_COLORS.length]!;
    const raw = exerciseProgressByWeek(recs, username, name, formula)
      .filter((p) => p.bestE1rm !== null)
      .map((p) => ({ x: ts(p.date), y: Math.round(p.bestE1rm! * 10) / 10 }));
    // Current strength = best est. 1RM reached so far, then faded for time off
    // the lift (sags through layoffs, pops back up when you train).
    return { name, color, type: "line" as const, points: decayingStrengthPoints(raw) };
  });
  return { series, note: `Current strength — best estimated 1RM (${formula}) reached up to each date, faded for time off the lift (sags during breaks, recovers when you train). Drag to pan · wheel to zoom · tap a point for its details.` };
}

/** Draw the overlay on the SVG engine: one estimated-1RM line per ticked exercise
 * (trend view), or one floating weight→1RM bar per set (per-set view). */
function renderCompareChart() {
  const box = document.getElementById("compareChart");
  if (!box) return;

  const username = els.athlete.value;
  const formula = currentFormula();
  const recs = filterRecords(computedRecords(), { excludeDropsets: els.excludeDropsets.checked });
  const picks = [...compareSelected];

  if (picks.length === 0) {
    els.compareNote.textContent = "Tick one or more exercises above to overlay them.";
    els.compareSets.innerHTML = "";
    if (compareSvg) compareSvg.update({ series: [] });
    return;
  }

  const { series, note } = compareSeriesFor(picks, username, recs, formula, compareView === "perset" ? "perset" : "trend");
  els.compareNote.textContent = note;
  const config = { series, xKind: "time" as const, compactable: true, yBeginAtZero: true, yUnit: "kg", insideLabels: true, height: 320 };
  if (!compareSvg) compareSvg = mountSvgChart(box, config);
  else compareSvg.update(config);

  renderCompareSets(picks, username, recs, formula);
}

/** The list of actual sets the compare graph is built from, newest first, one
 * row per logged set with a colour dot matching its line on the chart. */
function renderCompareSets(picks: string[], username: string, recs: SetRecord[], formula: OneRepMaxFormula) {
  type Row = { date: string; name: string; color: string; added: number; reps: number; e1rm: number | null };
  const rows: Row[] = [];
  picks.forEach((name, i) => {
    const color = COMPARE_COLORS[i % COMPARE_COLORS.length]!;
    for (const s of recs.filter((r) => r.username === username && r.exerciseName === name)) {
      const added = s.origWeight !== undefined ? (s.origWeight ?? 0) : (s.weight ?? 0);
      rows.push({ date: s.date, name, color, added, reps: s.reps ?? 0, e1rm: addedWeight1RM(s, formula) });
    }
  });
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (rows.length === 0) {
    els.compareSets.innerHTML = `<div class="cmp-sets-lbl muted">No logged sets for the selected exercises.</div>`;
    return;
  }
  const head = `<thead><tr><th>Date</th><th>Exercise</th><th class="num">Set</th><th class="num">est 1RM</th></tr></thead>`;
  const body = rows
    .map(
      (r) =>
        `<tr><td class="muted">${shortDate(r.date)}</td>` +
        `<td><span class="cmp-setdot" style="background:${r.color}"></span>${escapeHtml(r.name)}</td>` +
        `<td class="num">${fmt(r.added)}×${r.reps}</td>` +
        `<td class="num">${r.e1rm === null ? "—" : `${fmt(r.e1rm)}<sup class="onerm-sup">1</sup>`}</td></tr>`,
    )
    .join("");
  els.compareSets.innerHTML =
    `<div class="cmp-sets-lbl muted">The ${rows.length} sets behind the graph (newest first)</div>` +
    `<div class="cmp-sets-scroll"><table class="data-table">${head}<tbody>${body}</tbody></table></div>`;
}

/** Which of the four athlete-view tabs is currently showing, derived from state:
 * the Workouts sub-panel, the single-exercise drill-in, or the list/compare. */
function activeExerciseTab(): "workouts" | "list" | "compare" | "single" {
  if (document.getElementById("sub-workouts")?.hidden === false) return "workouts";
  if (selectedExercise !== null) return "single";
  return exercisesTab === "compare" ? "compare" : "list";
}

/** Light up the matching tab button. Called after any state change that moves
 * between Workouts / list / compare / drill-in. */
function syncExerciseTabs() {
  const active = activeExerciseTab();
  for (const b of els.exercisesTabs.querySelectorAll<HTMLElement>(".ex-tab"))
    b.classList.toggle("is-active", b.dataset.extab === active);
}

/** Switch the athlete view to one of the four tabs. */
function selectExerciseTab(t: string) {
  if (t === "workouts") {
    showSubtab("workouts");
    return;
  }
  showSubtab("exercises");
  if (t === "single") {
    // The drill-in needs an exercise: reopen the last one viewed, else the
    // most-trained lift.
    if (selectedExercise === null) {
      const ranked = exerciseCountsForUser(activeRecords(), els.athlete.value).map((c) => c.exerciseName);
      const pick = lastSingleExercise && ranked.includes(lastSingleExercise) ? lastSingleExercise : ranked[0];
      if (pick) { selectedExercise = pick; combinedWith = []; }
    }
  } else {
    selectedExercise = null;
    exercisesTab = t === "compare" ? "compare" : "list";
  }
  renderExercisesPage();
}

// ---- Exercises page: a list that drills into one exercise (like a tab change) ----
function renderExercisesPage() {
  syncExerciseTabs();
  if (selectedExercise !== null) {
    lastSingleExercise = selectedExercise; // remember for the "Single" tab
    // Drill-in: hide the list-view chrome (filters, search, compare).
    els.exFiltersBtn.hidden = true;
    els.exerciseFilter.hidden = true;
    els.exSearchBar.hidden = true;
    els.exerciseCompare.hidden = true;
    els.exCatBar.hidden = true;
    els.exPeriodBar.hidden = true;
    renderExerciseDetail(selectedExercise);
    return;
  }
  // List view: the in-page tab (list vs compare) decides what shows.
  const onCompare = exercisesTab === "compare";
  els.exCombineBar.hidden = true; // drill-in only
  els.exFiltersBtn.hidden = onCompare; // filters/search only apply to the list
  els.exSearchBar.hidden = onCompare;
  // The period is always shown in the list view so it's never a hidden surprise.
  els.exPeriodBar.hidden = onCompare;
  // Category picker only in By-category list mode.
  els.exCatBar.hidden = onCompare || exerciseSort !== "category";
  els.exerciseFilter.hidden = true; // the kebab menu starts closed
  els.exerciseCompare.hidden = !onCompare;
  els.athleteTable.hidden = onCompare;
  els.exercisesPager.hidden = onCompare;
  els.exerciseStats.hidden = onCompare;
  els.exerciseCalc.hidden = true; // single-exercise calculator: drill-in only
  if (onCompare) {
    renderCompareSection();
    els.athleteTitle.innerHTML = "";
    return;
  }
  // Everything in the Stats block (record, best-sets, weekly, targets) and the
  // reps↔weight Calculator are about ONE exercise, so they only belong in a
  // drill-in — hide the whole lot on the multi-exercise list.
  els.exerciseStats.hidden = true;
  els.exerciseCalc.hidden = true;
  els.exerciseRecord.hidden = true;
  els.exerciseTopSets.hidden = true;
  els.exerciseWeekly.hidden = true;
  els.exerciseTargets.hidden = true;
  const cutoff = exerciseRangeCutoff();
  const base = activeRecords(); // honour the app-wide active exercise set
  const scoped = cutoff ? base.filter((r) => r.date && r.date >= cutoff) : base;
  const username = els.athlete.value;

  // The displayed list: the athlete's trained exercises, plus — when "Show
  // not-trained" is on — every other exercise in the whole dataset that this
  // athlete has never logged, marked so the gaps are obvious instead of being
  // an empty search result.
  type ExItem = ExerciseCount & { trained: boolean };
  let items: ExItem[] = exerciseCountsForUser(scoped, username).map((c) => ({ ...c, trained: true }));
  if (exerciseShowNotTrained) {
    const trainedEver = new Set(exerciseCountsForUser(base, username).map((c) => c.exerciseName));
    for (const name of distinctExercises(base))
      if (!trainedEver.has(name)) items.push({ exerciseName: name, count: 0, trained: false });
  }
  // Fold out 3rd-tier (cardio / mobility / warm-up) exercises unless the toggle
  // is on — they're not really strength, so they just clutter the list.
  if (!exerciseShowThird) items = items.filter((it) => tierFor(it.exerciseName) !== "third");
  // Search filter (case-insensitive substring on the exercise name).
  const q = exerciseSearch.trim().toLowerCase();
  if (q) items = items.filter((it) => it.exerciseName.toLowerCase().includes(q));

  // "sets" keeps the most-trained order; "category" clusters by category. Either
  // way not-trained items (count 0) sort to the bottom of their group.
  const ordered = orderedExerciseCounts(items);
  exercisesView = ordered.map((it) => it.exerciseName);

  // Category picker: chips for every category this athlete has, tap to show/hide.
  if (exerciseSort === "category") {
    const present = new Set<string>();
    for (const it of items)
      for (const cat of exerciseCategories(it.exerciseName)) {
        if (cat === "Legs (all)" && !showLegsAll) continue;
        present.add(cat);
      }
    const cats = LIST_CATEGORIES.filter((c) => present.has(c));
    els.exCatBar.innerHTML =
      `<span class="ex-cat-bar-lbl muted">Show:</span>` +
      cats
        .map((c) => `<button type="button" class="ex-cat-chip${hiddenExCats.has(c) ? " is-off" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
        .join("");
  }

  // List view: no title. The athlete chips above already name the athlete.
  els.athleteTitle.innerHTML = "";

  // Records-style rep-max columns: the working weight for each chosen rep count
  // off the exercise's best 1RM in the SELECTED PERIOD (so "Last 3 months" shows
  // recent strength). Rep counts are editable (repMaxCols).
  const formula = currentFormula();
  const prBasis = cutoff ? computedRecords().filter((r) => r.date && r.date >= cutoff) : computedRecords();
  const prByEx = new Map<string, PersonalRecord>();
  for (const p of personalRecords(
    filterRecords(prBasis, { usernames: [username], excludeDropsets: els.excludeDropsets.checked }),
    formula,
    strengthAsOf(),
  ))
    prByEx.set(p.exerciseName, p);
  const rm = (oneRm: number, reps: number): string => {
    const w = reps === 1 ? oneRm : weightForReps(oneRm, reps, formula);
    return w === null ? "—" : fmt(w);
  };
  // 3-letter codes (unique across this athlete's whole list) keep rows from
  // wrapping; the full name sits on a muted, ellipsised subline.
  const codes = exerciseCodesFor(ordered.map((it) => it.exerciseName), codeFor);
  const nCols = repMaxCols.length;
  const rmCells = (name: string): string => {
    const oneRm = prByEx.get(name)?.bestE1rm.e1rm;
    return repMaxCols
      .map((reps) => `<td class="num">${oneRm === undefined ? "—" : rm(oneRm, reps)}</td>`)
      .join("");
  };
  // The actual best set behind that 1RM (real weight×reps), over the same period
  // — so the list shows genuine lifts next to the computed rep-max.
  const bestSetCell = (name: string): string => {
    const pr = prByEx.get(name);
    return `<td class="num ex-bestset">${pr ? wr(pr.bestE1rm.weight, pr.bestE1rm.reps) : "—"}</td>`;
  };
  const exCell = (name: string): string =>
    `<span class="ex-code">${escapeHtml(codes.get(name) ?? codeFor(name))}</span>` +
    `<span class="ex-name-sub muted">${escapeHtml(name)}${originBadge(name)}</span>`;

  const head =
    `<thead><tr><th>Exercise</th>` +
    // The rep-max column header is editable: type the rep count right in the head.
    repMaxCols
      .map((n) => `<th class="num rm-col-head"><input class="rm-col-input" type="number" min="1" max="30" step="1" value="${n}" inputmode="numeric" aria-label="Rep-max reps" />RM</th>`)
      .join("") +
    `<th class="num">Best set</th>` +
    `</tr></thead>`;
  const colspan = nCols + 2;
  // No pagination: the whole (date-scoped) list renders in one scroll. The Period
  // filter is what keeps it short — there's no page boundary to track.
  const start = 0;
  const prevItem = start > 0 ? ordered[start - 1] : undefined;
  let prevCat = exerciseSort === "category" && prevItem ? (prevItem._cat ?? null) : null;
  // Tier mode: track the previous row's tier so a header is emitted when it
  // changes (and not dropped at a page boundary).
  let prevTier =
    exerciseSort === "tier" && prevItem ? (frequencyTier(prevItem.count)?.tier ?? null) : null;
  const emptyCells = repMaxCols.map(() => `<td class="num">—</td>`).join("") + `<td class="num">—</td>`;
  const rowHtml = (it: ExItem, abs: number, rankCls: string) => {
    // Not-trained rows are greyed, non-clickable (no `ex-row` class / data-index).
    if (!it.trained)
      return (
        `<tr class="ex-missing-row"><td class="ex-name-cell">${exCell(it.exerciseName)}` +
        `<div class="ex-wk">not trained</div></td>${emptyCells}</tr>`
      );
    return (
      `<tr class="ex-row" data-index="${abs}"><td class="ex-name-cell ${rankCls}">` +
      `${exCell(it.exerciseName)} <span class="go-chevron">›</span></td>${rmCells(it.exerciseName)}${bestSetCell(it.exerciseName)}</tr>`
    );
  };
  const rows = ordered
    .map((it, i) => {
      const abs = start + i;
      if (exerciseSort === "tier") {
        // Emit a collapsible tier banner when the tier changes; tiers start
        // collapsed (expandedExTiers empty), so the list opens as tidy banners.
        const ft = frequencyTier(it.count);
        const tier = ft?.tier ?? null;
        let header = "";
        if (tier !== prevTier) {
          const collapsed = tier !== null && !expandedExTiers.has(tier);
          header = ft
            ? `<tr class="ex-tier-row${collapsed ? " is-collapsed" : ""}" data-tier="${ft.tier}"><td colspan="${colspan}"><span class="caret">▸</span> <span class="tier-badge tier-${ft.tier}">${ft.tier}</span> ${escapeHtml(ft.label)}</td></tr>`
            : "";
          prevTier = tier;
        }
        const tierHidden = tier !== null && !expandedExTiers.has(tier);
        return header + (tierHidden ? "" : rowHtml(it, abs, ""));
      }
      if (exerciseSort !== "category") return rowHtml(it, abs, abs === 0 && it.trained ? "rank-1" : "");
      // Category mode: emit a collapsible sub-header when the category changes;
      // a row under a collapsed category is skipped (its abs is unchanged, so the
      // click→exercise mapping still lines up when reopened). `_cat` is the bucket
      // this copy was placed in (a lift can appear under several categories).
      const cat = it._cat ?? catFor(it.exerciseName);
      let header = "";
      if (cat !== prevCat) {
        const collapsed = !expandedExCats.has(cat);
        header =
          `<tr class="ex-cat-row${collapsed ? " is-collapsed" : ""}" data-cat="${escapeHtml(cat)}">` +
          `<td colspan="${colspan}"><span class="caret">▸</span>${escapeHtml(cat)}</td></tr>`;
        prevCat = cat;
      }
      return header + (expandedExCats.has(cat) ? rowHtml(it, abs, "") : "");
    })
    .join("");
  const emptyMsg = q
    ? `No exercises match “${escapeHtml(exerciseSearch.trim())}”.`
    : "No exercises trained in this period.";
  els.athleteTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="${colspan}" class="muted">${emptyMsg}</td></tr>`}</tbody>`;
  els.exercisesPager.innerHTML = ""; // no pagination — the Period filter scopes the list
}

/** Drill-in view for one exercise: a back link + its sets grouped by week. */
function renderExerciseDetail(exName: string) {
  // Bodyweight part = how much of the athlete's bodyweight this lift loads
  // (the coefficient). Shown at the very top so it's clear before any numbers.
  const coeff = coeffFor(exName);
  const bwPart =
    coeff > 0
      ? `<span class="ex-bwpart">Bodyweight part: ${pct(coeff)}</span>`
      : `<span class="ex-bwpart ex-bwpart--none">No bodyweight part (added weight only)</span>`;
  // The exercise name is a dropdown: tap it to switch to another of this
  // athlete's lifts without leaving the Single view (most-trained first).
  const trainedForSwitch = exerciseCountsForUser(activeRecords(), els.athlete.value).map((c) => c.exerciseName);
  const switchMenu = (trainedForSwitch.includes(exName) ? trainedForSwitch : [exName, ...trainedForSwitch])
    .map((n) => `<button type="button" class="xdd-opt${n === exName ? " is-active" : ""}" role="option" data-switchex="${escapeHtml(n)}">${escapeHtml(n)}</button>`)
    .join("");
  els.athleteTitle.innerHTML =
    `<button type="button" class="back-btn">‹ Back</button> ` +
    `<span class="xdd ex-switch-dd">` +
    `<button type="button" class="xdd-btn ex-switch-btn" title="Tap to switch exercise">${escapeHtml(exName)}<span class="xdd-caret">▾</span></button>` +
    `<div class="xdd-menu" hidden role="listbox">${switchMenu}</div>` +
    `</span>${originBadge(exName)} ${bwPart}` +
    ` <button type="button" class="ex-info-btn" data-exinfo="${escapeHtml(exName)}" title="See this exercise's merges & data (all athletes)">ℹ Exercise info</button>`;
  els.exercisesPager.innerHTML = "";
  const username = els.athlete.value;
  const pr = personalRecords(
    filterRecords(remapCombined(computedRecords()), { usernames: [username], excludeDropsets: els.excludeDropsets.checked }),
    currentFormula(),
    strengthAsOf(),
  ).find((p) => p.exerciseName === exName);
  renderCombineBar(exName, username);
  renderExerciseLevels(exName, username);
  // Stats start collapsed on every drill-in (the <details> persists across
  // exercises, so reset it). renderExerciseWeekly always fills the chips, so the
  // dropdown always has content to show.
  els.exerciseStats.open = false;
  renderExerciseRecord(pr);
  renderExerciseTopSets(exName);
  renderExerciseWeekly(exName);
  renderExerciseTargets(pr);
  renderExerciseCalc(pr);
  const weeks = setsByWeek(setsForUserExercise(remapCombined(data.records), username, exName));
  const head = `<thead><tr><th>Week</th><th class="num">Sets</th></tr></thead>`;
  // Label each row by its ISO week-of-year number (e.g. "w15"), with the start
  // date kept as a muted hint so the number can still be placed in time.
  const rows = weeks
    .map(
      (w) =>
        `<tr class="wk-row" data-wk="${w.weekStart}">` +
        `<td><span class="caret">▸</span>w${isoWeekNumber(w.weekStart)} ` +
        `<span class="muted wk-date-hint">${shortDate(w.weekStart)}</span></td>` +
        `<td class="num">${w.sets.length}</td></tr>`,
    )
    .join("");
  els.athleteTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="2" class="muted">No sets.</td></tr>`}</tbody>`;

  // Expand the first (most recent) week by default, so the newest sets show
  // without a tap. Same mechanism a manual click on the week row uses.
  const firstWeek = weeks[0];
  const firstRow = els.athleteTable.querySelector<HTMLTableRowElement>("tr.wk-row");
  if (firstWeek && firstRow) insertDetail(firstRow, 2, setsByDateTableHtml(firstWeek.sets));
}

/** Drill-in "combine with" bar: chips for the exercises folded in (removable) +
 * a picker to add another of this athlete's lifts, so e.g. Squat + Smith Machine
 * Squat are viewed as one. */
function renderCombineBar(exName: string, username: string) {
  const trained = exerciseCountsForUser(activeRecords(), username).map((c) => c.exerciseName);
  const addable = trained.filter((n) => n !== exName && !combinedWith.includes(n));
  const chips = combinedWith
    .map((n) => `<button type="button" class="ex-combine-chip" data-remove="${escapeHtml(n)}" title="Remove">${escapeHtml(n)} ✕</button>`)
    .join("");
  // Custom HTML/CSS dropdown (the app's .xdd style), not a native <select>, so it
  // looks the same on every phone/browser. Toggled + selected via delegated
  // handlers on exCombineBar.
  const menu = addable.length
    ? addable.map((n) => `<button type="button" class="xdd-opt" role="option" data-combineadd="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join("")
    : `<div class="xdd-group">No other lifts to combine</div>`;
  const picker =
    `<div class="xdd ex-combine-dd">` +
    `<button type="button" class="xdd-btn ex-combine-btn">＋ combine with…<span class="xdd-caret">▾</span></button>` +
    `<div class="xdd-menu" hidden role="listbox">${menu}</div>` +
    `</div>`;
  // Persist the current "viewing together" set as ONE permanent merged lift
  // (a user "combined" def). Once saved it merges everywhere — graph, calendar,
  // leaderboard, PRs — not just this drill-in.
  const alreadyMerged = userExerciseDefs.some((d) => d.identity === "combined" && d.name === exName);
  const saveBtn =
    combinedWith.length && !alreadyMerged
      ? `<button type="button" class="ex-combine-save" title="Save these as one permanent merged lift (applies everywhere)">✓ Save as one lift</button>`
      : "";
  els.exCombineBar.hidden = false;
  els.exCombineBar.innerHTML =
    `<span class="ex-combine-lbl muted">Viewing together:</span>` +
    `<span class="ex-combine-chip is-primary">${escapeHtml(exName)}</span>` +
    chips +
    picker +
    saveBtn;
}

/** Persist the current drill-in "viewing together" set as a permanent merged
 * lift. Asks for a name (defaults to "<primary> (merged)"), saves a user
 * "combined" def, and selects it so every view shows the one merged lift. */
function saveCurrentCombine(): void {
  if (selectedExercise === null || combinedWith.length === 0) return;
  const members = [selectedExercise, ...combinedWith];
  const fallback = `${selectedExercise} (merged)`;
  const name = (window.prompt("Name for the merged lift:", fallback) ?? "").trim() || fallback;
  // Guard against clashing with an existing lift/def name.
  if (selectableExercises(data.records).includes(name) || userExerciseDefs.some((d) => d.name === name)) {
    window.alert(`“${name}” already exists — pick another name.`);
    return;
  }
  userExerciseDefs.push({ name, identity: "combined", members });
  saveUserExerciseDefs();
  combinedWith = [];
  selectedExercise = name; // jump straight to the new merged lift
  populateExercisePicker();
  renderAll();
  renderExerciseDetail(name);
}

/** Pull one member back out of a merged lift. If fewer than two remain it's no
 * longer a merge, so the whole def is dropped. */
function separateMergeMember(mergeName: string, member: string): void {
  const def = userExerciseDefs.find((d) => d.name === mergeName && d.identity === "combined");
  if (!def?.members) return;
  def.members = def.members.filter((m) => m !== member);
  if (def.members.length < 2) {
    userExerciseDefs = userExerciseDefs.filter((d) => d !== def);
    if (selectedExercise === mergeName) selectedExercise = null;
  }
  saveUserExerciseDefs();
  populateExercisePicker();
  refreshAfterDifficultyEdit();
}

/** Un-merge a lift entirely: drop its user "combined" def. Originals are untouched. */
function dissolveMerge(mergeName: string): void {
  userExerciseDefs = userExerciseDefs.filter((d) => !(d.name === mergeName && d.identity === "combined"));
  if (selectedExercise === mergeName) selectedExercise = null;
  saveUserExerciseDefs();
  populateExercisePicker();
  refreshAfterDifficultyEdit();
}

/**
 * Drill-in "Squat-rack holes" panel. When this lift has sets logged at different
 * holes, list each hole with its best set, its effort (bodyweight-inclusive est.
 * 1RM — what should LINE UP across holes of equal effort when the scaling is
 * right) and an EDITABLE bodyweight-% so the owner can compare the heights and
 * tune each % on the spot. Hidden when the lift has no leveled sets. */
function renderExerciseLevels(exName: string, username: string): void {
  const formula = currentFormula();
  // Best set per LEVEL (squat-rack hole or cm) by its REAL added-weight 1RM.
  const byLevel = new Map<string, { dim: LevelDim; value: number; label: string; best: SetRecord; oneRm: number }>();
  for (const r of computedRecords()) {
    if (r.username !== username || r.exerciseName !== exName || r.levelDim === undefined || r.levelValue === undefined) continue;
    const rm = addedWeight1RM(r, formula);
    if (rm === null) continue;
    const k = levelKey(exName, r.levelDim, r.levelValue);
    const cur = byLevel.get(k);
    if (!cur || rm > cur.oneRm)
      byLevel.set(k, { dim: r.levelDim, value: r.levelValue, label: r.levelLabel ?? levelLabel(r.levelDim, r.levelValue), best: r, oneRm: rm });
  }
  if (byLevel.size === 0) { els.exLevels.hidden = true; return; }
  const rows = [...byLevel.values()]
    .sort((a, b) => (a.dim === b.dim ? a.value - b.value : a.dim < b.dim ? -1 : 1))
    .map((v) => {
      const scale = levelScaleFor(exName, v.dim, v.value);
      const dispW = v.best.origWeight === undefined ? v.best.weight : (v.best.origWeight ?? 0);
      // Incline scale is GLOBAL (data-incdim/-incval); other levels per-exercise.
      const incline = isInclineLevelExercise(exName);
      const scaleAttrs = incline
        ? `data-incdim="${v.dim}" data-incval="${v.value}"`
        : `data-levelkey="${escapeHtml(levelKey(exName, v.dim, v.value))}"`;
      return (
        `<tr>` +
        `<td><strong>${escapeHtml(v.label)}</strong></td>` +
        `<td class="num">${wr(dispW, v.best.reps)}</td>` +
        `<td class="num">${fmt(v.oneRm)}</td>` +
        `<td class="num"><strong>${fmt(v.oneRm * scale)}</strong></td>` +
        `<td class="num"><input class="bw-input exl-scale" type="number" step="0.05" min="0" max="5" value="${scale}" ` +
        `${scaleAttrs} aria-label="Scaling factor for ${escapeHtml(v.label)}" /></td>` +
        `</tr>`
      );
    })
    .join("");
  els.exLevels.hidden = false;
  // Tucked into a collapsed "settings" disclosure — it's scaling configuration,
  // not day-to-day stats, so it shouldn't sit inline in the List & stats view.
  els.exLevels.innerHTML =
    `<details class="exl-settings">` +
    `<summary class="exl-settings-sum">⚙ Technique scaling <span class="muted">(${byLevel.size} level${byLevel.size === 1 ? "" : "s"})</span></summary>` +
    `<div class="exl-settings-body">` +
    `<div class="exl-head muted">For levels logged in the note — a height (43cm), a squat-rack hole (SQ8) or a Smith notch (Smith 3). On push-ups all three read as one incline (higher = easier; a floor push-up is the ×1 reference). Real weight and 1RM stay as logged; tune each Scale so equal-effort levels show the same Effort.</div>` +
    `<table class="data-table exl-table"><thead><tr>` +
    `<th>Level</th><th class="num">Best</th>` +
    `<th class="num" title="The real estimated 1RM from the logged weight — unchanged by the level">1RM</th>` +
    `<th class="num" title="Scaled effort 1RM = 1RM × Scale. Tune Scale so equal-effort levels line up here.">Effort</th>` +
    `<th class="num" title="Technique scaling factor for this level — only affects the Effort column, never the real 1RM. Easier setup = smaller.">Scale</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>` +
    `</div></details>`;
}

/** Sets-per-week chips for the drilled-in exercise: the busiest week ever, this
 * week so far, and the trailing 1-month / 3-month average sets per week. */
function renderExerciseWeekly(exName: string) {
  const stats = weeklySetStats(setsForUserExercise(remapCombined(data.records), els.athlete.value, exName), todayIso());
  const chip = (label: string, value: string) =>
    `<div class="wk-chip"><span class="wk-val">${value}</span><span class="wk-lbl">${label}</span></div>`;
  els.exerciseWeekly.hidden = false;
  els.exerciseWeekly.innerHTML =
    `<div class="wk-lead muted">Sets per week</div>` +
    `<div class="wk-chips">` +
    chip("peak", String(stats.peakPerWeek)) +
    chip("this week", String(stats.thisWeek)) +
    chip("1-mo avg", stats.monthAvgPerWeek.toFixed(1)) +
    chip("3-mo avg", stats.threeMonthAvgPerWeek.toFixed(1)) +
    `</div>`;
}

/** Top-record card shown above the weeks list when an exercise is drilled into. */
function renderExerciseRecord(pr: PersonalRecord | undefined) {
  if (!pr) {
    els.exerciseRecord.hidden = true;
    els.exerciseRecord.innerHTML = "";
    return;
  }
  els.exerciseRecord.hidden = false;
  els.exerciseRecord.innerHTML =
    `<div class="record-item"><span class="record-label">Best 1RM</span>` +
    `<span class="record-value">${fmt(pr.bestE1rm.e1rm)} kg</span>` +
    `<span class="record-meta">${wr(pr.bestE1rm.weight, pr.bestE1rm.reps)} · ${shortDate(pr.bestE1rm.date)}</span></div>` +
    `<div class="record-item"><span class="record-label">Top weight</span>` +
    `<span class="record-value">${wr(pr.topWeight.weight, pr.topWeight.reps)} kg</span>` +
    `<span class="record-meta">${shortDate(pr.topWeight.date)}</span></div>`;
}

/**
 * The actual 5 best sets (by estimated 1RM) from the last 3 calendar months —
 * the real weight×reps lifted, not a computed rep-max. Shown under the record
 * card in a drill-in so the owner sees genuine recent top sets at a glance.
 */
function renderExerciseTopSets(exName: string) {
  const formula = currentFormula();
  const username = els.athlete.value;
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  const cutoff = d.toISOString().slice(0, 10);
  const scored = remapCombined(computedRecords())
    .filter((r) => r.username === username && r.exerciseName === exName && r.date && r.date >= cutoff)
    .map((s) => ({ s, e1rm: addedWeight1RM(s, formula) }))
    .filter((x): x is { s: SetRecord; e1rm: number } => x.e1rm !== null)
    .sort((a, b) => b.e1rm - a.e1rm)
    .slice(0, 5);
  if (scored.length === 0) {
    els.exerciseTopSets.hidden = true;
    els.exerciseTopSets.innerHTML = "";
    return;
  }
  els.exerciseTopSets.hidden = false;
  const rows = scored
    .map((x) => {
      const added = x.s.origWeight !== undefined ? x.s.origWeight : x.s.weight;
      return (
        `<tr><td>${wr(added, x.s.reps)}</td>` +
        `<td class="num">${fmt(x.e1rm)}<sup class="onerm-sup">1</sup></td>` +
        `<td class="num muted">${x.s.date ? shortDate(x.s.date) : "—"}</td></tr>`
      );
    })
    .join("");
  els.exerciseTopSets.innerHTML =
    `<div class="ts-lead muted">Best sets · last 3 months</div>` +
    `<table class="data-table ts-table"><thead><tr><th>Set</th><th class="num">est 1RM</th><th class="num">when</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`;
}

/** Reps for which we show a target working weight under the record card. */
const TARGET_REPS = [5, 10, 15] as const;

/**
 * Rep-max targets derived from the athlete's best estimated 1RM: the load they
 * should be able to lift for 5, 10 and 15 reps under the active formula. These
 * are added-weight (bar) numbers, matching how "Best 1RM" is shown above.
 */
function renderExerciseTargets(pr: PersonalRecord | undefined) {
  const oneRm = pr?.bestE1rm.e1rm ?? null;
  if (oneRm === null || oneRm <= 0) {
    els.exerciseTargets.hidden = true;
    els.exerciseTargets.innerHTML = "";
    return;
  }
  const formula = currentFormula();
  const chips = TARGET_REPS.map((reps) => {
    const w = weightForReps(oneRm, reps, formula);
    return (
      `<div class="target-chip"><span class="target-reps">${reps}RM</span>` +
      `<span class="target-weight">${w === null ? "—" : `${fmt(w)} kg`}</span></div>`
    );
  }).join("");
  els.exerciseTargets.hidden = false;
  els.exerciseTargets.innerHTML =
    `<div class="target-lead muted">Estimated working weights (×${TARGET_REPS.join(", ×")} reps)</div>` +
    `<div class="target-chips">${chips}</div>`;
}

// Anchor 1RM the drill-in calculator converts against (the athlete's best for
// the open exercise). null when the exercise has no usable record → calc hidden.
let ecalcOneRm: number | null = null;

// The calculator's editable rows. Each is an independent weight↔reps pair; the
// cell the user last edited drives the other. Seeded with a spread of reps so it
// opens as a useful table (1, 3, 5, 8, 10, 12 reps) rather than a single cell.
interface EcalcRow {
  weight: number | null;
  reps: number | null;
}
const ECALC_SEED_REPS = [1, 3, 5, 8, 10, 12] as const;
let ecalcRowsState: EcalcRow[] = [];

/**
 * Build the reps↔weight calculator table for the drilled-in exercise. The
 * athlete's best estimated 1RM is the anchor; each row converts in added-weight
 * space off the added 1RM — the SAME basis as the target chips — so the numbers
 * line up. Seeded with one row per ECALC_SEED_REPS so it's a table from the off.
 */
function renderExerciseCalc(pr: PersonalRecord | undefined) {
  ecalcOneRm = pr?.bestE1rm.e1rm ?? null;
  if (ecalcOneRm === null || ecalcOneRm <= 0) {
    els.exerciseCalc.hidden = true;
    return;
  }
  els.exerciseCalc.hidden = false;
  els.exerciseCalc.open = false; // collapsed by default on every drill-in
  els.ecalcBasis.textContent = ` · anchored on ${fmt(ecalcOneRm)} kg best 1RM`;
  const formula = currentFormula();
  // Seed each row from a rep count → its predicted weight off the 1RM.
  ecalcRowsState = ECALC_SEED_REPS.map((reps) => ({
    reps,
    weight: weightForReps(ecalcOneRm!, reps, formula),
  }));
  ecalcRenderRows();
  ecalcUpdateNote();
}

/** Round reps for display: whole numbers, never below 0, "" if not finite. */
function ecalcFmtReps(r: number | null): string {
  if (r === null || !Number.isFinite(r)) return "";
  return String(Math.max(0, Math.round(r)));
}

/** Round a weight for display: 1 dp, "" if not finite. */
function ecalcFmtWeight(w: number | null): string {
  if (w === null || !Number.isFinite(w)) return "";
  return String(Math.round(w * 10) / 10);
}

/** Paint the current calculator rows into the table body. */
function ecalcRenderRows() {
  els.ecalcRows.innerHTML = ecalcRowsState
    .map(
      (row, i) =>
        `<tr class="ecalc-row" data-index="${i}">` +
        `<td><input type="number" class="ecalc-input ecalc-cell-weight" step="0.5" inputmode="decimal" ` +
        `value="${ecalcFmtWeight(row.weight)}" aria-label="Weight in kg" /></td>` +
        `<td><input type="number" class="ecalc-input ecalc-cell-reps" step="1" min="1" inputmode="numeric" ` +
        `value="${ecalcFmtReps(row.reps)}" aria-label="Reps" /></td>` +
        `<td class="num"><button type="button" class="ecalc-del" aria-label="Remove row" title="Remove row">×</button></td></tr>`,
    )
    .join("");
}

/** Refresh the explanatory note under the calculator table. */
function ecalcUpdateNote() {
  if (ecalcOneRm === null) return;
  els.ecalcNote.textContent =
    `Estimates use the ${currentFormula()} formula. Edit any cell: change a weight ` +
    `to get its reps, or reps to get the weight. Lighter weight → more reps.`;
}

/**
 * Recompute the partner cell in ONE row when the user edits a cell. `source` is
 * the cell just typed in, so we never overwrite what they're typing. Out-of-range
 * values are shown raw, not clamped — a weight above the 1RM yields ~0 reps.
 */
function onExerciseCalcInput(index: number, source: "weight" | "reps") {
  if (ecalcOneRm === null) return;
  const tr = els.ecalcRows.querySelector<HTMLTableRowElement>(`tr[data-index="${index}"]`);
  const row = ecalcRowsState[index];
  if (!tr || !row) return;
  const formula = currentFormula();
  const weightInput = tr.querySelector<HTMLInputElement>(".ecalc-cell-weight")!;
  const repsInput = tr.querySelector<HTMLInputElement>(".ecalc-cell-reps")!;

  if (source === "weight") {
    const w = parseFloat(weightInput.value);
    if (!Number.isFinite(w) || w <= 0) {
      row.weight = null;
      row.reps = null;
      repsInput.value = "";
      return;
    }
    row.weight = w;
    row.reps = repsForWeight(ecalcOneRm, w, formula);
    repsInput.value = ecalcFmtReps(row.reps);
  } else {
    const r = Math.round(parseFloat(repsInput.value));
    if (!Number.isFinite(r) || r < 1) {
      row.weight = null;
      row.reps = null;
      weightInput.value = "";
      return;
    }
    row.reps = r;
    row.weight = weightForReps(ecalcOneRm, r, formula); // reps===1 ⇒ the 1RM
    weightInput.value = ecalcFmtWeight(row.weight);
  }
}

/** Add a blank editable row to the calculator. */
function ecalcAddRow() {
  ecalcRowsState.push({ weight: null, reps: null });
  ecalcRenderRows();
  // Focus the new row's weight cell for immediate typing.
  const last = els.ecalcRows.querySelector<HTMLTableRowElement>("tr.ecalc-row:last-child");
  last?.querySelector<HTMLInputElement>(".ecalc-cell-weight")?.focus();
}

/** Remove a calculator row by index. */
function ecalcRemoveRow(index: number) {
  if (index < 0 || index >= ecalcRowsState.length) return;
  ecalcRowsState.splice(index, 1);
  ecalcRenderRows();
}

/** "Current strength" line for a chart, faded for time off the lift — pure
 * builder lives in aggregate.ts (decayedStrengthSeries); this wraps it with the
 * app's "today". */
function decayingStrengthPoints<T extends { x: number; y: number }>(points: T[]): { x: number; y: number }[] {
  return decayedStrengthSeries(points, Date.parse(todayIso()));
}
const CURRENT_STRENGTH_COLOR = "#2e7d52";



/** Clicks within the Exercises panel: drill into an exercise, expand a week, or go back. */
function onExerciseRowClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest(".xdd-rpe") && onSetRpeClick(target)) return; // the RIR picker handles itself
  if (toggleScaleEditor(target)) return; // a set's ×chip → floating modifier editor
  if (resetSetEdit(target)) return; // "Reset set" in the edit row
  if (deleteSetEdit(target)) return; // "Delete set" — hide it everywhere (on-device)
  if (toggleSetNotComparable(target)) return; // "⊘ not comparable" in the set editor
  if (toggleE1rmFormula(target)) return; // a 1RM cell → show its formula
  if (togglePrirFormula(target)) return; // a pRIR cell → show how it was estimated
  if (toggleSetNote(target)) return; // a set's note toggle, deepest level
  if (toggleSetEdit(target)) return; // tap the set row → open/close its edit panel (runs last)

  // Category mode: tapping a category header collapses/expands its exercises.
  const catRow = target.closest("tr.ex-cat-row") as HTMLTableRowElement | null;
  if (catRow) {
    const cat = catRow.dataset.cat ?? "";
    if (expandedExCats.has(cat)) expandedExCats.delete(cat);
    else expandedExCats.add(cat);
    renderExercisesPage();
    return;
  }

  // Tier mode: tapping a tier banner collapses/expands its exercises.
  const tierRow = target.closest("tr.ex-tier-row") as HTMLTableRowElement | null;
  if (tierRow) {
    const tier = tierRow.dataset.tier ?? "";
    if (expandedExTiers.has(tier)) expandedExTiers.delete(tier);
    else expandedExTiers.add(tier);
    renderExercisesPage();
    return;
  }

  // Inside the drill-in view: a week -> expand to that week's sets (by date).
  const wkRow = target.closest("tr.wk-row") as HTMLTableRowElement | null;
  if (wkRow) {
    if (toggleCollapse(wkRow)) return;
    if (selectedExercise === null) return;
    const week = setsByWeek(setsForUserExercise(data.records, els.athlete.value, selectedExercise)).find(
      (w) => w.weekStart === wkRow.dataset.wk,
    );
    if (!week) return;
    insertDetail(wkRow, 2, setsByDateTableHtml(week.sets));
    return;
  }

  // List view: tapping an exercise switches to its detail (no inline dropdown).
  const row = target.closest("tr.ex-row") as HTMLTableRowElement | null;
  if (!row) return;
  const exName = exercisesView[Number(row.dataset.index)];
  if (exName === undefined) return;
  selectedExercise = exName;
  combinedWith = []; // fresh drill-in: not combined with anything yet
  renderExercisesPage();
}

// ---- Workouts page (one row per day or week, 20/page, expandable) ----
// The "alone" filter cycles three ways: show every session, only the ones the
// user tagged trained-alone, or only the ones they didn't. Rest days carry no
// tag, so they're dropped by both the alone-only and not-alone filters.
type AloneFilter = "both" | "alone" | "notAlone";
const ALONE_FILTER_LABEL: Record<AloneFilter, string> = {
  both: "Alone: Both",
  alone: "Alone: Only alone",
  notAlone: "Alone: Not alone",
};
const ALONE_FILTER_NEXT: Record<AloneFilter, AloneFilter> = {
  both: "alone",
  alone: "notAlone",
  notAlone: "both",
};
let aloneFilter: AloneFilter = "both";

function buildWorkoutGroups(): WorkoutGroup[] {
  // Filter on the "alone" tag: both (no filter), only tagged, or only untagged.
  const keep = (g: WorkoutGroup): boolean => {
    if (aloneFilter === "both") return true;
    if (g.rest) return false; // rest days are never tagged either way
    const tagged = aloneTags.has(aloneKey(g.date));
    return aloneFilter === "alone" ? tagged : !tagged;
  };
  // "Show all" (the history's "Hidden" toggle) bypasses the Index app-wide filter
  // for this list only, so lifts the filter hides reappear here.
  const recs = woShowAllExercises ? liveRecords() : activeRecords();
  const period = historyPeriod(S.workoutViewMode);
  if (period) {
    // Period grouping (week / 2-week / month / 3-month). Inactive periods show as
    // rest slivers (like rest days) when "Rest" is on.
    const groups = periodsForUser(recs, els.athlete.value, period);
    const withRest = S.showRestDays ? periodsWithRest(groups, period) : groups;
    return collapseRestRuns(scopeWorkoutGroups(
      withRest
        .map((w) => ({
          label: w.totalSets === 0 ? "" : periodGroupLabel(w.periodStart, period),
          date: w.periodStart,
          totalSets: w.totalSets,
          exercises: w.exercises,
          sets: w.sets,
          rest: w.totalSets === 0,
        }))
        .filter(keep),
    ), WO_REST_UNIT[S.workoutViewMode]);
  }
  const base = woShowAllExercises ? workoutsForUser(recs, els.athlete.value) : athleteWorkouts;
  const days = S.showRestDays ? workoutsWithRestDays(base) : base;
  return collapseRestRuns(scopeWorkoutGroups(
    days
      .map((d) => ({
        label: d.date === todayIso() ? "Today" : `${dowLetter(d.date)} ${shortDate(d.date)}`,
        date: d.date,
        totalSets: d.totalSets,
        exercises: d.exercises,
        sets: d.sets,
        rest: d.totalSets === 0,
      }))
      .filter(keep),
  ), WO_REST_UNIT.day);
}

// History view modes (the ⚙ "Day/Week/…" toggle cycles these). A non-"day" mode
// groups sessions into a period; the toggle label + rest-run unit come from here.
const WO_VIEW_MODES = ["day", "week", "2week", "month", "3month"] as const;
const WO_VIEW_LABEL: Record<(typeof WO_VIEW_MODES)[number], string> = {
  day: "Day", week: "Week", "2week": "2 wks", month: "Month", "3month": "3 mo",
};
const WO_REST_UNIT: Record<(typeof WO_VIEW_MODES)[number], string> = {
  day: "rest days", week: "rest weeks", "2week": "rest 2-wks", month: "rest months", "3month": "rest 3-mos",
};
/** The grouping period for a view mode (null = per-day). */
function historyPeriod(mode: typeof S.workoutViewMode): HistoryPeriod | null {
  return mode === "day" ? null : mode;
}
/** Header label for one period group (e.g. "Week of May 25", "May 2025", "Apr–Jun 2025"). */
function periodGroupLabel(start: string, period: HistoryPeriod): string {
  const mon = MONTH_ABBR[Number(start.slice(5, 7)) - 1] ?? "";
  if (period === "month") return `${mon} ${start.slice(0, 4)}`;
  if (period === "3month") { const m0 = Number(start.slice(5, 7)); return `${MONTH_ABBR[m0 - 1]}–${MONTH_ABBR[m0 + 1]} ${start.slice(0, 4)}`; }
  if (period === "2week") return `2 wks of ${shortDate(start)}`;
  return `Week of ${shortDate(start)}`;
}

/** A long stretch of empty/rest days is a giant gray void (especially when the
 * history is scoped to a rarely-trained lift). Collapse any run of MORE than 20
 * consecutive rest slivers into the first 10 · a "N rest days" break labelled with
 * the run's TOTAL · the last 10 — a discontinuous, broken-axis look so the whole
 * gap reads at a glance without scrolling past hundreds of empty rows. */
function collapseRestRuns(groups: WorkoutGroup[], unit = "rest days"): WorkoutGroup[] {
  const CAP = 20, HEAD = 10, TAIL = 10;
  const out: WorkoutGroup[] = [];
  for (let i = 0; i < groups.length; ) {
    if (!groups[i]!.rest) { out.push(groups[i]!); i++; continue; }
    let j = i;
    while (j < groups.length && groups[j]!.rest) j++; // the whole consecutive rest run
    const run = groups.slice(i, j);
    if (run.length > CAP) {
      out.push(...run.slice(0, HEAD));
      out.push({ label: `${run.length} ${unit}`, date: run[HEAD]!.date, totalSets: 0, exercises: [], sets: [], rest: true, gap: run.length });
      out.push(...run.slice(run.length - TAIL));
    } else {
      out.push(...run);
    }
    i = j;
  }
  return out;
}

/** Narrow each group's sets/exercises to {@link waListExerciseFilter} (when set,
 * in Analysis compare mode) and drop groups left with no matching sets — so the
 * workout history reads as "every past set of just the picked lifts". */
function scopeWorkoutGroups(groups: WorkoutGroup[]): WorkoutGroup[] {
  if (waListExerciseFilter.length === 0) return groups;
  const keepEx = new Set(waListExerciseFilter);
  const out: WorkoutGroup[] = [];
  for (const g of groups) {
    if (g.rest) { out.push(g); continue; } // keep the rest-day slivers when scoped
    const sets = g.sets.filter((s) => keepEx.has(s.exerciseName));
    if (sets.length === 0) {
      // Trained that day, but nothing in the current selection → from the
      // selection's point of view it's a gap. Show it as a rest sliver when rest
      // days are on (so the gaps between selected sessions read), else drop it.
      if (S.showRestDays) out.push({ ...g, rest: true, sets: [], exercises: [], totalSets: 0 });
      continue;
    }
    const exercises = g.exercises.filter((e) => keepEx.has(e.exerciseName));
    out.push({ ...g, sets, exercises, totalSets: sets.length });
  }
  return out;
}

// ---- Workouts overview: a per-year heatmap of training days ----
// Heatmap state lives on S (appState): S.heatYear (year in single mode), S.heatScope
// (ribbon/single/all), S.heatFilters (multi-select; empty = all), S.heatFiltersSaved
// (parked all-mode filter while the Analysis selection scopes the calendar),
// S.aloneTagMode (tap-to-tag paint mode), S.heatColorBy.

/** The workout days the heatmap (year analysis) draws from: the athlete's full
 * history, or — when the "Hard sets only" lens is on — a rebuild that drops easy
 * / warm-up sets so the calendar reflects only hard training. The Workouts
 * session list keeps using the unfiltered athleteWorkouts. */
function heatWorkoutDays(): WorkoutDay[] {
  if (!waHardOnly) return athleteWorkouts;
  const easy = easySetIds();
  return workoutsForUser(activeRecords().filter((r) => !easy.has(setId(r))), els.athlete.value);
}

/** Map of this athlete's training dates (ISO) → total sets that day (respecting
 * the Hard-sets lens). Used for the list of years; colouring uses {@link filteredDayCounts}. */
function trainingDays(): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of heatWorkoutDays()) if (d.totalSets > 0) m.set(d.date, d.totalSets);
  return m;
}

/** Sets on a day matching one specific filter string. */
function filterMatchSets(d: WorkoutDay, filter: string): number {
  if (filter === "all" || filter === "") return d.totalSets;
  const sep = filter.indexOf(":");
  const kind = filter.slice(0, sep);
  const val = filter.slice(sep + 1);
  const match = (name: string): boolean => {
    if (kind === "cat") return catFor(name) === val;
    if (kind === "mus") return mgFor(name) === val;
    if (kind === "fun") return tagsForExercise(name).some((t) => t.kind === "functional-pattern" && t.label === val);
    if (kind === "ex") return name === val;
    return false;
  };
  return d.exercises.reduce((s, e) => (match(e.exerciseName) ? s + e.count : s), 0);
}

/** Hex color for a filter value (uses the category palette). */
function filterColor(filter: string): string | null {
  if (!filter || filter === "all") return null;
  const i = filter.indexOf(":");
  const kind = filter.slice(0, i);
  const val = filter.slice(i + 1);
  if (kind === "cat") return CATEGORY_COLORS[val as TrainingCategory] ?? null;
  if (kind === "ex") return CATEGORY_COLORS[catFor(val) as TrainingCategory] ?? null;
  return null;
}

// "Colour by" for the all-exercises calendar (only when no filter is active):
// paint each day by the dominant group in a chosen dimension; the day's set count
// still drives the intensity (opacity). "none" = the classic single-colour scale.
// S.heatColorBy (HeatColorDim) lives on S (appState); HeatColorDim imported at top.
const HEAT_COLOR_DIMS: HeatColorDim[] = ["none", "discipline", "muscleGroup", "function", "tier", "ex"];
const HEAT_COLOR_LABELS: Record<HeatColorDim, string> = {
  none: "One colour", discipline: "Discipline", muscleGroup: "Muscle group", function: "Function", tier: "Tier", ex: "Exercise",
};

/** The group value an exercise falls under for a colour dimension (or null). The
 * core dims reuse the shared metadata resolver so the calendar matches the picker
 * and Index; "ex" colours each exercise on its own. */
function exerciseGroupValue(name: string, dim: HeatColorDim): string | null {
  if (dim === "none") return null;
  if (dim === "ex") return name;
  return waMeta(name, dim as ExerciseFilterDim)[0] ?? null;
}
/** The current athlete's exercises that fall in one group value (a calendar pill).
 * Used to sync a pill tap with the analysis selection (waSelected). */
function exercisesInGroup(dim: HeatColorDim, val: string): string[] {
  return exerciseCountsForUser(activeRecords(), els.athlete.value)
    .map((e) => e.exerciseName)
    .filter((n) => exerciseGroupValue(n, dim) === val);
}
/** A stable #rrggbb colour for a group value: the category palette for body parts,
 * otherwise a hash-derived hue so every value gets its own distinct colour. */
function heatGroupColor(dim: HeatColorDim, value: string): string | null {
  if (!value) return null;
  if (dim === "discipline") return disciplineColor(value as Discipline);
  if (dim === "muscleGroup") return muscleColor(value as MuscleGroup);
  return hashHueHex(value);
}
/** One day's heatmap paint: total sets, the dominant category colour/label, and
 * (in colour-by mode) the proportional category SEGMENTS that split the square. */
type HeatDayEntry = { sets: number; catHex: string | null; label?: string | null; segments?: { hex: string; frac: number }[] };
/** Training dates → { sets, catHex } honouring the active S.heatFilters. */
function filteredDayCounts(): Map<string, HeatDayEntry> {
  const m = new Map<string, HeatDayEntry>();
  for (const d of heatWorkoutDays()) {
    if (S.heatFilters.length === 0) {
      if (d.totalSets <= 0) continue;
      if (S.heatColorBy === "none") { m.set(d.date, { sets: d.totalSets, catHex: null }); continue; }
      // No filter but a colour dimension is chosen: split the square across EVERY
      // group trained that day, proportional to its sets — e.g. a legs+shoulders
      // day reads half blue, half gold — with the dominant group as the fallback
      // solid colour / label (intensity still = total sets).
      const tally = new Map<string, number>();
      for (const e of d.exercises) {
        const v = exerciseGroupValue(e.exerciseName, S.heatColorBy);
        if (v) tally.set(v, (tally.get(v) ?? 0) + e.count);
      }
      const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const tot = ranked.reduce((n, [, c]) => n + c, 0) || 1;
      const segments = ranked.map(([v, c]) => ({ hex: heatGroupColor(S.heatColorBy, v) ?? "#1e4fa3", frac: c / tot }));
      const domV = ranked[0]?.[0] ?? "";
      m.set(d.date, { sets: d.totalSets, catHex: domV ? heatGroupColor(S.heatColorBy, domV) : null, label: domV || null, segments });
      continue;
    }
    // Filters (pills) active: split the square across the SELECTED filters by their
    // share of the day, with the rest of the day's training left as a transparent
    // (empty) remainder — so the square is PART-FILLED by how much of that day was
    // the picked category(ies), just like the all-view splits across every group.
    const matched: { f: string; n: number }[] = [];
    let totalSets = 0, dominantFilter = "", dominantSets = 0;
    for (const f of S.heatFilters) {
      const n = filterMatchSets(d, f);
      if (n > 0) { matched.push({ f, n }); totalSets += n; }
      if (n > dominantSets) { dominantSets = n; dominantFilter = f; }
    }
    if (totalSets > 0) {
      matched.sort((a, b) => b.n - a.n || a.f.localeCompare(b.f));
      const denom = Math.max(d.totalSets, totalSets); // the WHOLE day (matched can overlap)
      const segments = matched.map((c) => ({ hex: filterColor(c.f) ?? "#1e4fa3", frac: c.n / denom }));
      const rest = Math.max(0, denom - totalSets) / denom;
      if (rest > 0.005) segments.push({ hex: "transparent", frac: rest });
      m.set(d.date, { sets: totalSets, catHex: filterColor(dominantFilter), label: dominantFilter || null, segments });
    }
  }
  return m;
}

/** Open the heatmap on the athlete's most recent training year, with the filter
 * reset to Legs (the default view). A previous athlete's *exercise* filter won't
 * carry over; categories like Legs are common to everyone, so we land on it. */
function initHeatYear() {
  const latest = athleteWorkouts.find((d) => d.totalSets > 0)?.date ?? athleteWorkouts[0]?.date;
  const y = Number(latest?.slice(0, 4));
  if (Number.isFinite(y)) S.heatYear = y;
  S.heatFilters = []; // default to all exercises (coloured by body part)
  S.heatFiltersSaved = null; // don't carry a parked filter across athletes
  S.aloneTagMode = false; // start each athlete in normal tap-to-jump mode
}

/** The years (descending) that have any training, for the ‹ › year nav. */
function dataYears(trained: Map<string, number>): number[] {
  const years = [...new Set([...trained.keys()].map((d) => Number(d.slice(0, 4))))].sort((a, b) => b - a);
  return years.length ? years : [S.heatYear];
}

/** One year drawn as a single continuous heatmap (weeks as columns, Mon→Sun
 * rows) — weeks are never broken mid-column — with month labels along the top
 * aligned to the week each month begins. `counts` is the filtered day→sets map. */
function yearGridHtml(year: number, counts: Map<string, HeatDayEntry>): { html: string; days: number; totalSets: number } {
  const daysInYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  const startDow = (new Date(year, 0, 1).getDay() + 6) % 7; // Mon-first offset of Jan 1
  const numWeeks = Math.ceil((startDow + daysInYear) / 7);
  const cells: string[] = [];
  for (let i = 0; i < startDow; i++) cells.push(`<div class="hm-cell empty"></div>`);
  let days = 0;
  let totalSets = 0;
  const weekSets: number[] = Array(numWeeks).fill(0);
  const weekCatHex: (string | null)[] = Array(numWeeks).fill(null);
  const weekCatMax: number[] = Array(numWeeks).fill(0);
  for (let doy = 0; doy < daysInYear; doy++) {
    const d = new Date(year, 0, 1 + doy);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = counts.get(iso);
    const sets = entry?.sets ?? 0;
    const catHex = entry?.catHex ?? null;
    const lbl = entry?.label ?? null;
    if (sets) {
      days++;
      totalSets += sets;
      const wi = Math.floor((startDow + doy) / 7);
      weekSets[wi] = (weekSets[wi] ?? 0) + sets;
      if (catHex && sets > (weekCatMax[wi] ?? 0)) { weekCatMax[wi] = sets; weekCatHex[wi] = catHex; }
    }
    const isToday = iso === todayIso();
    // Days the athlete tagged "trained alone" get a red outline on the heatmap.
    const isAlone = sets > 0 && aloneTags.has(aloneKey(iso));
    // Tint alternating months so each month's squares read as a distinct band.
    const mOdd = d.getMonth() % 2 === 1 ? " hm-modd" : "";
    const title = `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}, ${year}${isToday ? " (today)" : ""}${sets ? ` — ${sets} sets${lbl ? ` · ${escapeHtml(lbl)}` : ""}${isAlone ? " — trained alone" : ""} — tap to jump` : " — rest"}`;
    const lvl = heatLevel(sets);
    const bgStyle = lvl > 0 ? ` style="background:${entry?.segments && entry.segments.length > 1 ? cellBgGradient(lvl, entry.segments) : cellBgColor(lvl, catHex)}"` : "";
    cells.push(
      `<div class="hm-cell lvl-${lvl}${isToday ? " is-today" : ""}${isAlone && aloneRingsVisible() ? " hm-alone" : ""}${mOdd}"${bgStyle}${sets ? ` data-date="${iso}"` : ""} title="${title}"><span class="hm-dom">${d.getDate()}</span></div>`,
    );
  }

  // Month labels: place each at the week-column where its 1st falls.
  const labels = Array.from({ length: 12 }, (_, m) => {
    const doyStart = Math.round((Date.UTC(year, m, 1) - Date.UTC(year, 0, 1)) / 86_400_000);
    const col = Math.floor((startDow + doyStart) / 7) + 1; // 1-based grid column
    return `<span class="hm-mlabel" style="grid-column-start:${col}">${MONTH_ABBR[m]}</span>`;
  }).join("");

  const weekRow = weekSets.map((wSets, wi) => {
    const lvl = heatLevel(wSets);
    const bgStyle = lvl > 0 ? ` style="background:${cellBgColor(lvl, weekCatHex[wi] ?? null)}"` : "";
    return `<div class="hm-cell hm-wcell lvl-${lvl}"${bgStyle} title="Week ${wi + 1}: ${wSets} sets"></div>`;
  }).join("");

  const html =
    `<div class="hm-year"><div class="hm-cal">` +
    `<div class="hm-months" style="grid-template-columns:repeat(${numWeeks},var(--hm-col))">${labels}</div>` +
    `<div class="hm-grid">${cells.join("")}</div>` +
    `<div class="hm-wrow" style="grid-template-columns:repeat(${numWeeks},var(--hm-col))">${weekRow}</div>` +
    `</div></div>`;
  return { html, days, totalSets };
}

/** The whole training history as ONE continuous heatmap that flows across year
 * boundaries (weeks as columns, Mon→Sun rows) — no year breaks. Month labels run
 * along the top; January (and the very first month) carry the year so you can see
 * where each year begins. `counts` is the filtered day→sets map. The strip runs
 * from the Monday on/before the first training day to the Sunday on/after the
 * later of the last training day and today, so it always reaches the present. */
function ribbonGridHtml(counts: Map<string, HeatDayEntry>): { html: string; days: number; totalSets: number } {
  const dates = [...trainingDays().keys()].sort(); // full range, filter-independent
  if (dates.length === 0) {
    return { html: `<div class="hm-empty muted">No training logged yet.</div>`, days: 0, totalSets: 0 };
  }
  const mk = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  };
  const start = mk(dates[0]!);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to the Monday of that week
  const lastIso = dates[dates.length - 1]!;
  const end = mk(lastIso > todayIso() ? lastIso : todayIso());
  end.setDate(end.getDate() + (6 - ((end.getDay() + 6) % 7))); // forward to the Sunday of that week
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const numWeeks = Math.ceil(totalDays / 7);

  const cells: string[] = [];
  const labels: string[] = [];
  let days = 0;
  let totalSets = 0;
  let prevMonth = -1;
  const weekSets: number[] = Array(numWeeks).fill(0);
  const weekCatHex: (string | null)[] = Array(numWeeks).fill(null);
  const weekCatMax: number[] = Array(numWeeks).fill(0);
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const wi = Math.floor(i / 7); // 0-based week index
    const col = wi + 1; // 1-based grid column (start is a Monday, so weeks align)
    const month = d.getMonth();
    if (month !== prevMonth) {
      // Show the year on January and on the first label so each year's start is clear.
      const withYear = month === 0 || labels.length === 0;
      const text = withYear ? `${MONTH_ABBR[month]} ${d.getFullYear()}` : MONTH_ABBR[month]!;
      labels.push(`<span class="hm-mlabel${month === 0 ? " hm-yr" : ""}" style="grid-column-start:${col}">${text}</span>`);
      prevMonth = month;
    }
    const iso = `${d.getFullYear()}-${String(month + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = counts.get(iso);
    const sets = entry?.sets ?? 0;
    const catHex = entry?.catHex ?? null;
    const lbl = entry?.label ?? null;
    if (sets) {
      days++;
      totalSets += sets;
      weekSets[wi] = (weekSets[wi] ?? 0) + sets;
      if (catHex && sets > (weekCatMax[wi] ?? 0)) { weekCatMax[wi] = sets; weekCatHex[wi] = catHex; }
    }
    const isToday = iso === todayIso();
    const isAlone = sets > 0 && aloneTags.has(aloneKey(iso));
    const mOdd = month % 2 === 1 ? " hm-modd" : "";
    const title = `${MONTH_ABBR[month]} ${d.getDate()}, ${d.getFullYear()}${isToday ? " (today)" : ""}${sets ? ` — ${sets} sets${lbl ? ` · ${escapeHtml(lbl)}` : ""}${isAlone ? " — trained alone" : ""} — tap to jump` : " — rest"}`;
    const lvl = heatLevel(sets);
    const bgStyle = lvl > 0 ? ` style="background:${entry?.segments && entry.segments.length > 1 ? cellBgGradient(lvl, entry.segments) : cellBgColor(lvl, catHex)}"` : "";
    cells.push(
      `<div class="hm-cell lvl-${lvl}${isToday ? " is-today" : ""}${isAlone && aloneRingsVisible() ? " hm-alone" : ""}${mOdd}"${bgStyle}${sets ? ` data-date="${iso}"` : ""} title="${title}"><span class="hm-dom">${d.getDate()}</span></div>`,
    );
  }
  const weekRow = weekSets.map((wSets, wi) => {
    const lvl = heatLevel(wSets);
    const bgStyle = lvl > 0 ? ` style="background:${cellBgColor(lvl, weekCatHex[wi] ?? null)}"` : "";
    return `<div class="hm-cell hm-wcell lvl-${lvl}"${bgStyle} title="Week ${wi + 1}: ${wSets} sets"></div>`;
  }).join("");
  const html =
    `<div class="hm-year"><div class="hm-cal">` +
    `<div class="hm-months" style="grid-template-columns:repeat(${numWeeks},var(--hm-col))">${labels.join("")}</div>` +
    `<div class="hm-grid">${cells.join("")}</div>` +
    `<div class="hm-wrow" style="grid-template-columns:repeat(${numWeeks},var(--hm-col))">${weekRow}</div>` +
    `</div></div>`;
  return { html, days, totalSets };
}

/** Interactive under-calendar controls: a "Group by" picker, an "All" reset, and
 * a clickable colour pill for every group in the current colour dimension
 * (most-trained first, capped). Tapping a pill filters the calendar to just that
 * group; tapping "All" (or the active pill again) clears back to everything. This
 * is the primary way to slice the calendar — the old dropdown is retired. */
function heatPillControls(): string {
  const groupBy =
    `<label class="hm-groupby">Group by <select class="hm-groupby-sel">` +
    HEAT_COLOR_DIMS.map((k) => `<option value="${k}"${S.heatColorBy === k ? " selected" : ""}>${escapeHtml(HEAT_COLOR_LABELS[k])}</option>`).join("") +
    `</select></label>`;
  // Pills now mirror the analysis SELECTION (waSelected) — they are one and the
  // same filter for the whole page. "All" is on when nothing's selected.
  const selectedSet = new Set(waSelected);
  const allOn = waSelected.length === 0;
  const allPill = `<button type="button" class="hm-pill hm-pill-all${allOn ? " is-on" : ""}" data-heatall="1">All</button>`;
  if (S.heatColorBy === "none")
    return `<div class="hm-pills">${groupBy}${allPill}<span class="muted hm-pill-hint">· one colour, lighter = fewer sets</span></div>`;
  // Tally the groups present for this athlete, most-trained first.
  const tally = new Map<string, number>();
  for (const d of athleteWorkouts) for (const e of d.exercises) {
    const v = exerciseGroupValue(e.exerciseName, S.heatColorBy);
    if (v) tally.set(v, (tally.get(v) ?? 0) + e.count);
  }
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  const cap = 16;
  const shown = sorted.slice(0, cap);
  const pill = (v: string) => {
    const val = `${S.heatColorBy}:${v}`;
    // A group pill is "on" when every one of its lifts is in the selection (or, for
    // the Exercise dimension, when that lift is selected).
    const on = S.heatColorBy === "ex"
      ? selectedSet.has(v)
      : (() => { const exs = exercisesInGroup(S.heatColorBy, v); return exs.length > 0 && exs.every((e) => selectedSet.has(e)); })();
    const col = heatGroupColor(S.heatColorBy, v) ?? "#888";
    return `<button type="button" class="hm-pill${on ? " is-on" : ""}" data-heatpill="${escapeHtml(val)}" style="--pc:${col}"><span class="hm-pill-dot"></span>${escapeHtml(v)}</button>`;
  };
  const more = sorted.length > cap ? `<span class="muted hm-pill-hint">+${sorted.length - cap} more</span>` : "";
  return `<div class="hm-pills">${groupBy}${allPill}${shown.map(pill).join("")}${more}</div>`;
}

/** Workouts overview: a GitHub-style heatmap. Single-year (‹ › to change) or all
 * years stacked; filterable to one category or exercise. Tap a day to jump. */
function renderWorkoutCalendar() {
  const years = dataYears(trainingDays()); // year list from ALL training (filter-independent)
  if (!years.includes(S.heatYear)) S.heatYear = years[0]!;
  els.workoutCalendar.classList.toggle("cal-zoom", calZoom); // 2× cell size (class persists across innerHTML rebuilds)
  const counts = filteredDayCounts(); // colouring honours the filter
  // Scope (Timeline / Year / All) + the Tag-alone arm button live in ONE compact
  // ⚙ settings dropdown BELOW the calendar — a tight DJ-console row of tiny toggle
  // buttons, no explanatory text. Its open state survives the full re-render.
  const calSettingsOpen = els.workoutCalendar.querySelector<HTMLDetailsElement>(".cal-settings")?.open ?? false;
  const scopeBtns = ([["ribbon", "Time"], ["single", "Year"], ["all", "All"]] as const)
    .map(([s, l]) =>
      `<button type="button" class="wo-dj-btn cal-mode-btn${S.heatScope === s ? " is-active" : ""}" data-heat-scope="${s}" ` +
      `title="${s === "ribbon" ? "Timeline — one continuous strip" : s === "single" ? "Single year" : "All years stacked"}">${l}</button>`)
    .join("");
  const tagDjBtn =
    `<button type="button" class="wo-dj-btn cal-tagmode${S.aloneTagMode ? " is-active" : ""}" data-tagmode="alone" ` +
    `title="${S.aloneTagMode ? "Done tagging" : "Tag days as trained-alone, then tap days"}">${S.aloneTagMode ? "Done" : "Tag"}</button>`;
  const zoomDjBtn =
    `<button type="button" class="wo-dj-btn cal-zoom-btn${calZoom ? " is-active" : ""}" data-calzoom="1" ` +
    `title="${calZoom ? "Back to normal size" : "Zoom calendar 2×"}">${calZoom ? "1×" : "2×"}</button>`;
  const calSettings =
    `<details class="wo-controls-fold cal-settings"${calSettingsOpen ? " open" : ""}><summary class="wo-controls-sum">⚙</summary>` +
    `<div class="wo-controls wo-dj">${scopeBtns}${tagDjBtn}${zoomDjBtn}</div></details>`;
  // Interactive pills (Group by · All · one pill per group) are the calendar's
  // slicer now — colour by body part by default, tap a part to see only it. The
  // ⚙ settings button rides on the same bottom row as the pills.
  const legend = `<div class="cal-bottom">${heatPillControls()}${calSettings}</div>`;
  const count = (g: { days: number; totalSets: number }) =>
    `<span class="cal-count muted">${g.days} day${g.days === 1 ? "" : "s"} · ${g.totalSets.toLocaleString()} sets</span>`;

  if (S.heatScope === "ribbon") {
    const g = ribbonGridHtml(counts);
    // No header line here — the calendar sits right at the top (the year span +
    // day/set count were redundant clutter).
    els.workoutCalendar.innerHTML = g.html + legend;
    els.workoutCalendar.classList.toggle("cal-tagging", S.aloneTagMode);
    scrollHeatmapToEnd();
    return;
  }

  if (S.heatScope === "all") {
    const blocks = years
      .map((y) => {
        const g = yearGridHtml(y, counts);
        return `<div class="hm-block"><div class="cal-head"><strong>${y}</strong>${count(g)}</div>${g.html}</div>`;
      })
      .join("");
    els.workoutCalendar.innerHTML = blocks + legend;
    els.workoutCalendar.classList.toggle("cal-tagging", S.aloneTagMode);
    scrollHeatmapToEnd();
    return;
  }

  const g = yearGridHtml(S.heatYear, counts);
  const idx = years.indexOf(S.heatYear);
  const olderExists = idx < years.length - 1; // a smaller (older) year exists
  const newerExists = idx > 0; // a larger (newer) year exists
  els.workoutCalendar.innerHTML =
    `<div class="cal-head">` +
    `<button type="button" class="cal-nav" data-heat="prev" aria-label="Previous year"${olderExists ? "" : " disabled"}>‹</button>` +
    `<strong>${S.heatYear}</strong>` +
    `<button type="button" class="cal-nav" data-heat="next" aria-label="Next year"${newerExists ? "" : " disabled"}>›</button>` +
    count(g) +
    `</div>` +
    g.html +
    legend;
  els.workoutCalendar.classList.toggle("cal-tagging", S.aloneTagMode);
  scrollHeatmapToEnd();
}

/** Scroll every .hm-year container to its right edge so the most recent weeks are visible. */
function scrollHeatmapToEnd() {
  requestAnimationFrame(() => {
    for (const el of els.workoutCalendar.querySelectorAll<HTMLElement>(".hm-year")) {
      el.scrollLeft = el.scrollWidth;
    }
  });
}

/** Step the heatmap to an adjacent year that has data (‹ older / › newer). */
function shiftHeatYear(delta: number) {
  const years = dataYears(trainingDays()); // descending
  const idx = years.indexOf(S.heatYear);
  const next = years[idx - delta]; // -1 = older (later in list), +1 = newer
  if (next !== undefined) {
    S.heatYear = next;
    renderWorkoutCalendar();
  }
}

/** Tapping a training day in the calendar: jump to that day in the list and open it. */
function jumpToWorkoutDate(iso: string) {
  if (S.workoutViewMode !== "day") { S.workoutViewMode = "day"; syncWorkoutToggles(); } // calendar is per-day
  const groups = buildWorkoutGroups();
  const idx = groups.findIndex((g) => g.date === iso && !g.rest);
  if (idx < 0) return;
  S.workoutsPage = workoutPageOf(idx, workoutPageStarts(groups, S.workoutsPageSize));
  renderWorkoutsPage();
  const row = els.workoutsTable.querySelector<HTMLTableRowElement>(`tr.wo-row[data-index="${idx}"]`);
  const grp = workoutGroups[idx];
  if (!row || !grp) return;
  // Open any collapsed <details> ancestors (e.g. the Analysis "Workout history"
  // fold) so the jumped-to row is actually visible, then expand + flash it.
  for (let el: HTMLElement | null = row; el; el = el.parentElement)
    if (el instanceof HTMLDetailsElement) el.open = true;
  insertDetail(row, 2, workoutGroupHtml(grp)); // expand it like a tap would
  row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  row.classList.add("wo-flash");
  window.setTimeout(() => row.classList.remove("wo-flash"), 1600);
}

/**
 * Workouts view "Sets over time": every logged set across ALL the athlete's
 * exercises as a weight → own-1RM bar on the calendar time axis, coloured per
 * exercise. The athlete's top exercises get distinct colours; the long tail is
 * lumped into a grey "Other" so the legend stays readable. Same per-set range
 * idea as the compare graph, but mixing every exercise. Collapsed by default.
 */
// renderWorkoutSetsChart() warehoused (CUT-2): warehouse/2026-06-07-cut2-workout-sets-chart/


/** Sum a session's exercise set-counts into the chosen grouping dimension
 * (muscle / functional pattern / combined / comparable), biggest first. An
 * exercise with no group in that dimension is simply omitted; functional
 * patterns are multi-membership, so a lift can add to more than one. */
function groupSessionCounts(exercises: readonly ExerciseCount[], dim: string): [string, number][] {
  const counts = new Map<string, number>();
  for (const e of exercises) {
    let labels: string[];
    if (dim === "muscles") labels = [mgFor(e.exerciseName)];
    else if (dim === "functional") labels = tagsForExercise(e.exerciseName).filter((t) => t.kind === "functional-pattern").map((t) => t.label);
    else if (dim === "combined") labels = combinableGroupsForEx(e.exerciseName).map((t) => t.label);
    else if (dim === "compared") labels = comparableGroupsForEx(e.exerciseName).map((t) => t.label);
    else labels = [];
    for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + e.count);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** One set's display for the Workouts session line: weight^reps, except a
 * bodyweight/placeholder load (0 or 1 — StrengthLevel sometimes forbids 0) that
 * carries a note shows the NOTE as the base (it's really the difficulty/variation)
 * with the reps as a superscript. */
/** Compact chips summarising a set's resolved variation (support, band, lean) for
 * model lifts — so the workout history shows b2w / f2w / ladder / free / band at a
 * glance, not just the ×multiplier. Empty for non-model lifts or noteless sets. */
function variationChipsHtml(r: SetRecord): string {
  const fam = familyOf(r.exerciseName);
  const note = (r.notes ?? "").trim();
  if (!fam || !note) return "";
  const vec = { ...rNote(fam, note).vec, ...noteVecOverride(r.exerciseName, note) };
  const SUP: Record<string, string> = { free: "free", back_to_wall: "b2w", front_to_wall: "f2w", ladder: "ladder" };
  const chips: string[] = [];
  const sup = String(vec.support ?? "free");
  chips.push(`<span class="wo-var-chip wo-var-sup">${escapeHtml(SUP[sup] ?? sup)}</span>`);
  if (vec.band && vec.band !== "none") chips.push(`<span class="wo-var-chip wo-var-band">band ${escapeHtml(String(vec.band))}</span>`);
  if (vec.lean && vec.lean !== "0cm") chips.push(`<span class="wo-var-chip">lean ${escapeHtml(String(vec.lean))}</span>`);
  return `<span class="wo-var-chips">${chips.join("")}</span>`;
}

function setDisplay(raw: SetRecord): string {
  // Apply the on-device per-set edits (note text, weight, reps…) FIRST, so the
  // compact line resolves the SAME effective note — and therefore the same
  // ×multiplier — as the expanded set rows (setRowsHtml, which also does this).
  // Without it, editing a set's note (or that note's difficulty) updated the
  // expanded chip but left the collapsed compact line on the old, raw-note value.
  const s = applySetOverride(raw);
  const note = s.notes?.trim();
  const bw = s.weight === 0 || s.weight === 1;
  const chips = variationChipsHtml(s); // support / band / lean chips (model lifts)
  // A "not comparable" note (e.g. a static hold) has no meaningful multiplier —
  // show "UN" with the reps instead of a ×number.
  if (note && isNoteNotComparable(s.exerciseName, note))
    return `${chips}<span class="wo-scale wo-uncmp">UN</span>${s.reps === null ? "" : `<sup class="${bw ? "wr-bw" : ""}">${s.reps}</sup>`}`;
  // The set's final variation multiplier (note model × level × per-set override).
  const scale = scaleForRecord(s);
  const scaled = Math.abs(scale - 1) > 1e-6;
  // When a multiplier applies, show it AS the weight^reps in the compact view —
  // for a bodyweight lift it fills the empty weight slot (×0.6⁵); for a weighted
  // lift it tags onto the real weight^reps.
  if (scaled) {
    const repsSup = s.reps === null ? "" : `<sup class="${bw ? "wr-bw" : ""}">${s.reps}</sup>`;
    return bw
      ? `${chips}<span class="wo-scale">×${Math.round(scale * 100) / 100}</span>${repsSup}`
      : `${chips}${wr(s.weight, s.reps)}<span class="wo-scale"> ×${Math.round(scale * 100) / 100}</span>`;
  }
  if (bw && note)
    return `${chips}<span class="wo-note">${escapeHtml(note)}</span>${s.reps === null ? "" : `<sup>${s.reps}</sup>`}`;
  return `${chips}${wr(s.weight, s.reps)}`;
}
/** ISO date of the Monday starting the week of `iso` (week-boundary key). */
function mondayKey(iso: string): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}
/** Split a date-sorted run into consecutive groups sharing a key. */
function groupByKey<T>(items: readonly T[], keyOf: (t: T) => string): T[][] {
  const out: T[][] = [];
  let cur: string | null = null;
  for (const it of items) {
    const k = keyOf(it);
    if (k !== cur) { out.push([]); cur = k; }
    out[out.length - 1]!.push(it);
  }
  return out;
}
/** One exercise's sets as compact chips. A period bucket reads as distinct
 * sessions: week / 2-week modes tint one band per DAY; month / 3-month modes tint
 * one band per WEEK *and* split the days inside it with a faint divider — so both
 * the week and the separate days are indicated. Day mode = one session, no tint. */
function setListHtml(setsAsc: readonly SetRecord[]): string {
  const mode = S.workoutViewMode;
  // Newest-first everywhere (matches the history order): reverse the date-sorted
  // sets so the latest day/week/set leads and a session's warmup reads at the end.
  const sets = setsAsc.slice().reverse();
  if (mode === "day" || sets.length === 0) return sets.map((s) => setDisplay(s)).join(" ");
  const byWeekBand = mode === "month" || mode === "3month";
  if (!byWeekBand) {
    // Week / 2-week: one tinted band per day.
    return groupByKey(sets, (s) => s.date)
      .map((g) => `<span class="wo-sess" title="${escapeHtml(shortDate(g[0]!.date))}">${g.map((s) => setDisplay(s)).join(" ")}</span>`)
      .join(" ");
  }
  // Month / 3-month: a tinted band per WEEK, the days inside split by a thin divider.
  return groupByKey(sets, (s) => mondayKey(s.date))
    .map((wk) => {
      const inner = groupByKey(wk, (s) => s.date)
        .map((dg) => `<span class="wo-day" title="${escapeHtml(shortDate(dg[0]!.date))}">${dg.map((s) => setDisplay(s)).join(" ")}</span>`)
        .join(`<span class="wo-day-sep" aria-hidden="true"></span>`);
      return `<span class="wo-sess" title="${escapeHtml(periodGroupLabel(mondayKey(wk[0]!.date), "week"))}">${inner}</span>`;
    })
    .join(" ");
}

function renderWorkoutsPage() {
  workoutGroups = buildWorkoutGroups();
  const workoutFormula = currentFormula();
  const period = historyPeriod(S.workoutViewMode);
  const byWeek = period !== null;
  syncWorkoutToggles(); // keep the toggle labels / hidden states current
  const active = workoutGroups.filter((g) => !g.rest).length;
  els.workoutsTitle.innerHTML =
    `${escapeHtml(athleteLabel())} — workouts ` +
    `<span class="muted">(${active} ${byWeek ? "periods" : "sessions"} · tap to expand)</span>`;

  // No column header row — the "Session / Sets" labels were redundant noise above
  // a list whose rows are self-explanatory (a date + its set count).
  const head = "";
  // Weighted paging: rest-day slivers count 1/10 of a session, so a page holds ~50
  // real sessions instead of being eaten by empty rest rows.
  const pageStarts = workoutPageStarts(workoutGroups, S.workoutsPageSize);
  if (S.workoutsPage >= pageStarts.length) S.workoutsPage = pageStarts.length - 1;
  if (S.workoutsPage < 0) S.workoutsPage = 0;
  const start = pageStarts[S.workoutsPage] ?? 0;
  const end = pageStarts[S.workoutsPage + 1] ?? workoutGroups.length;
  // Per-day/week "hidden h/t" counts: how many of that day's lifts the Index filter
  // hides (and the day's total), so each day with hidden lifts can show a grayed
  // "hidden h/t" line. Only computed when the filter is actually hiding lifts and
  // we're NOT already revealing them. Independent of the current selection scope.
  const hiddenByKey = new Map<string, { total: number; hidden: number }>();
  // Each day/week's LIVE (unfiltered) exercises+sets, so a per-day "hidden N/M"
  // reveal can render JUST that day's hidden lifts inline — never a global unhide.
  const liveByKey = new Map<string, { exercises: ExerciseCount[]; sets: SetRecord[] }>();
  if (!woShowAllExercises && activeSet && hiddenByIndexCount(els.athlete.value) > 0) {
    const allow = activeSet;
    const liveBase = period
      ? periodsForUser(liveRecords(), els.athlete.value, period).map((w) => ({ key: w.periodStart, exercises: w.exercises, sets: w.sets }))
      : workoutsForUser(liveRecords(), els.athlete.value).map((d) => ({ key: d.date, exercises: d.exercises, sets: d.sets }));
    for (const d of liveBase) {
      const names = new Set(d.exercises.map((e) => e.exerciseName));
      let hidden = 0;
      for (const nm of names) if (!allow.has(nm)) hidden++;
      if (hidden > 0) { hiddenByKey.set(d.key, { total: names.size, hidden }); liveByKey.set(d.key, { exercises: d.exercises, sets: d.sets }); }
    }
  }
  const rows = workoutGroups
    .slice(start, end)
    .map((g, i) => {
      if (g.rest) {
        if (g.gap) {
          // A collapsed run of empty days: a broken-axis break showing how many
          // rest days were skipped between the slivers above and below.
          return `<tr class="rest-gap-row" title="${g.gap} rest days with nothing here"><td colspan="2"><span class="rest-gap">⋯ ${g.gap} <span class="rest-gap-lbl">rest days</span> ⋯</span></td></tr>`;
        }
        // A rest day is just a thin sliver with a separating line — count the
        // lines between sessions to see how many days passed, no text needed.
        return `<tr class="rest-row" title="${escapeHtml(g.label)} — rest"><td colspan="2"></td></tr>`;
      }
      const abs = start + i;
      // One exercise's compact line (1RM · name · sets), reused for the day's active
      // lifts AND for its hidden-lift reveal.
      const exLineHtml = (exerciseName: string, sets: readonly SetRecord[]): string => {
        const setsTxt = setListHtml(sets);
        const name = displayName(exerciseName);
        const e1rms = sets
          .map((s) => addedWeight1RM(computeRecord(applySetOverride(s)), workoutFormula))
          .filter((v): v is number => v !== null && Number.isFinite(v));
        const best = e1rms.length ? Math.max(...e1rms) : null;
        const rmTxt = best === null
          ? ""
          : ` <span class="wo-1rm" title="Best estimated 1RM this day">${fmt(best)}<sup class="onerm-sup">1</sup></span>`;
        const addBtn = S.showAddSets
          ? ` <button type="button" class="wo-addset" data-addex="${escapeHtml(exerciseName)}" data-adddate="${escapeHtml(g.date)}" title="Add more sets of ${escapeHtml(exerciseName)}">+ set</button>`
          : "";
        return `<div class="wo-ex-line">${rmTxt}<span class="wo-ex-body"><span class="wo-exname" title="${escapeHtml(exerciseName)}">${escapeHtml(name)}</span> <span class="wo-setlist">${setsTxt}</span>${addBtn}</span></div>`;
      };
      let did: string;
      if (S.workoutShowMode === "exercises") {
        // Write out every set as weight^reps (e.g. 40¹⁵), not just the set count.
        did = g.exercises.map((e) => exLineHtml(e.exerciseName, g.sets.filter((s) => s.exerciseName === e.exerciseName))).join("");
      } else {
        // Group view: sum each exercise's sets into the chosen grouping dimension.
        did = groupSessionCounts(g.exercises, els.workoutGrouping.value)
          .map(([label, c]) => `${escapeHtml(label)} <span class="muted">— ${c} set${c === 1 ? "" : "s"}</span>`)
          .join("<br>") || `<span class="muted">— none in this group</span>`;
      }
      // The lifts the Index filter hides this day/week: a button that reveals THIS
      // DAY's hidden lifts inline (pre-rendered greyed, toggled by DOM — never a
      // global unhide, and no re-render so the page doesn't jump). PB-2.
      const hc = hiddenByKey.get(g.date);
      if (hc) {
        const live = liveByKey.get(g.date);
        const hiddenLines = live && activeSet
          ? live.exercises.filter((e) => !activeSet!.has(e.exerciseName))
              .map((e) => exLineHtml(e.exerciseName, live.sets.filter((s) => s.exerciseName === e.exerciseName))).join("")
          : "";
        const lbl = `${hc.hidden}/${hc.total}`;
        did +=
          `<div class="wo-hidden-line"><button type="button" class="wo-hidden-daybtn" data-woshowday="${escapeHtml(g.date)}" data-hlabel="${lbl}" aria-expanded="false" title="Show the ${hc.hidden} lift${hc.hidden === 1 ? "" : "s"} the Index filter hides ${byWeek ? "this period" : "this day"} (just this one)">hidden ${lbl}</button>` +
          `<div class="wo-hidden-day-lines" hidden>${hiddenLines}</div></div>`;
      }
      const tagged = aloneTags.has(aloneKey(g.date));
      // Day tags ("alone") are hidden unless the "Tags" display option is on.
      const tagBtn = S.showAloneTags
        ? `<button type="button" class="wo-alone${tagged ? " is-on" : ""}" data-alone="${escapeHtml(g.date)}" ` +
          `title="${tagged ? "Trained alone — tap to untag" : "Tag as trained alone"}">alone</button>`
        : "";
      // "+ exercise" adds a brand-new exercise to this session (shown with the
      // rest of the quick-add UI).
      const addExBtn = S.showAddSets
        ? `<div class="wo-addex-wrap"><button type="button" class="wo-addex" data-adddate="${escapeHtml(g.date)}" title="Add a new exercise to this session">+ exercise</button></div>`
        : "";
      return (
        `<tr class="wo-row" data-index="${abs}"><td>` +
        `<div class="wo-date"><span class="caret">▸</span>${g.label}<span class="wo-year"> '${escapeHtml(g.date.slice(2, 4))}</span>${tagBtn}</div>` +
        `<div class="wo-did">${did}${addExBtn}</div></td>` +
        `<td class="num">${g.totalSets}</td></tr>`
      );
    })
    .join("");
  els.workoutsTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="2" class="muted">No workouts for this athlete.</td></tr>`}</tbody>`;
  els.workoutsPager.innerHTML = workoutsPagerHtml(S.workoutsPage, pageStarts, workoutGroups, byWeek);
  renderWoHiddenNote();
  renderHorizontalHistory(); // EXPERIMENTAL sideways view — reuses the same groups
}

/**
 * EXPERIMENTAL "Horizontal history": the same period buckets (built by
 * buildWorkoutGroups, so it honours grouping mode / filters / hidden / alone AND
 * the exercise selector) laid out as COLUMNS you scroll sideways through time,
 * newest at the left. Every column shows the SAME exercises in the SAME row order
 * (a fixed-height row each, blank where that period skipped the lift) so a lift's
 * volume lines up horizontally across time for at-a-glance comparison. A small
 * grouping control mirrors the vertical history's ⚙. Restore point: docs/restore-points.md.
 */
function renderHorizontalHistory(): void {
  const box = document.getElementById("waHistHoriz");
  if (!box) return;
  const formula = currentFormula();
  const groups = workoutGroups.filter((g) => !g.rest); // skip rest slivers sideways
  // Row order tracks RECENT activity, lookback scaled to the grouping: day/week →
  // last month, month → last 3 months, 3-month → last 12 months.
  const mode = S.workoutViewMode;
  const lookbackDays = mode === "3month" ? 365 : mode === "month" ? 90 : 30;
  const windowLabel = lookbackDays === 365 ? "12 months" : lookbackDays === 90 ? "3 months" : "month";
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  const cutoff = daysAgo(lookbackDays);
  const cut90 = daysAgo(90);
  const head =
    `<div class="hh-tools"><span class="muted hh-tools-lbl">Group by</span>` +
    `<button type="button" id="hhPeriod" class="wo-dj-btn" title="Day ↔ week ↔ month — same as the history ⚙ (rows sort by sets in the last ${escapeHtml(windowLabel)})">${escapeHtml(WO_VIEW_LABEL[mode])}</button>` +
    `<span class="muted hh-tools-hint">— rows ordered by recent activity, aligned across time</span></div>`;
  if (groups.length === 0) { box.innerHTML = head + `<p class="muted">No workouts to show.</p>`; return; }
  // Per-lift counts: all-time, the recent (sort) window, last 90 days, and older.
  const totalByEx = new Map<string, number>();
  const recentByEx = new Map<string, number>();
  const cnt90 = new Map<string, number>();
  const cntOld = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const g of groups) {
    for (const e of g.exercises) totalByEx.set(e.exerciseName, (totalByEx.get(e.exerciseName) ?? 0) + e.count);
    for (const s of g.sets) {
      if (s.date >= cutoff) bump(recentByEx, s.exerciseName);
      if (s.date >= cut90) bump(cnt90, s.exerciseName); else bump(cntOld, s.exerciseName);
    }
  }
  // Which lifts get a ROW. In day / week / 2-week modes, don't clutter with every
  // past lift: keep the ones trained in the window (this month) PLUS two staple
  // exceptions — a lot in the last 3 months, or even more from further back (a
  // lift trained non-stop). Month / 3-month modes show every lift (the union).
  const prune = mode === "day" || mode === "week" || mode === "2week";
  const HH_LOT_3MO = 12; // "a lot in the past 3 months" → keep as a (grey) row
  const HH_LOT_OLD = 30; // "even more, non-stop, >3 months ago" → keep as a (grey) row
  let exList = [...totalByEx.keys()];
  if (prune) {
    const kept = exList.filter((ex) =>
      (recentByEx.get(ex) ?? 0) > 0 || (cnt90.get(ex) ?? 0) >= HH_LOT_3MO || (cntOld.get(ex) ?? 0) >= HH_LOT_OLD);
    if (kept.length) exList = kept; // fall back to all if nothing qualifies
  }
  const exOrder = exList.sort((a, b) =>
    ((recentByEx.get(b) ?? 0) - (recentByEx.get(a) ?? 0)) ||
    ((totalByEx.get(b) ?? 0) - (totalByEx.get(a) ?? 0)) ||
    a.localeCompare(b));
  // ONE grid (columns = periods, rows = lifts) so each row auto-sizes to the
  // TALLEST cell across columns: same lift on the same line in every card, and
  // content is never clipped. A backing card div per column gives the card look.
  const P = groups.length;
  const E = exOrder.length;
  let cells = "";
  groups.forEach((g, ci) => {
    const col = ci + 1;
    cells += `<div class="hh-card" style="grid-column:${col};grid-row:1/-1"></div>`;
    cells += `<div class="hh-head" style="grid-column:${col};grid-row:1">${escapeHtml(g.label)} <span class="muted">${g.totalSets}</span></div>`;
    exOrder.forEach((exName, ri) => {
      const row = ri + 2;
      const sets = g.sets.filter((s) => s.exerciseName === exName);
      if (sets.length === 0) {
        cells += `<div class="hh-cell hh-cell-empty" style="grid-column:${col};grid-row:${row}"><span class="hh-rm"></span><span class="wo-ex-body"><span class="wo-exname muted">${escapeHtml(displayName(exName))}</span></span></div>`;
        return;
      }
      const e1rms = sets
        .map((s) => addedWeight1RM(computeRecord(applySetOverride(s)), formula))
        .filter((v): v is number => v !== null && Number.isFinite(v));
      const best = e1rms.length ? Math.max(...e1rms) : null;
      const rmTxt = best === null ? "" : `<span class="wo-1rm" title="Best estimated 1RM">${fmt(best)}<sup class="onerm-sup">1</sup></span>`;
      cells += `<div class="hh-cell" style="grid-column:${col};grid-row:${row}"><span class="hh-rm">${rmTxt}</span><span class="wo-ex-body"><span class="wo-exname" title="${escapeHtml(exName)}">${escapeHtml(displayName(exName))}</span> <span class="wo-setlist">${setListHtml(sets)}</span></span></div>`;
    });
  });
  box.innerHTML = head +
    `<div class="hh-grid" style="grid-template-columns:repeat(${P},var(--hh-card-w));grid-template-rows:auto repeat(${E},auto)">${cells}</div>`;
}

/** Toggle the history's "show lifts hidden by the Index filter" mode, persist it,
 * and re-render the list. Shared by the ⚙ "Hidden" button and the inline banner. */
function setWoShowAll(on: boolean): void {
  woShowAllExercises = on;
  localStorage.setItem("colosseum.woShowAll", on ? "1" : "0");
  S.workoutsPage = 0;
  renderWorkoutsPage();
}

/** The "lifts hidden by the Index filter" flag now lives as a compact button in the
 * history head row (next to the ⚙), rendered by {@link syncWorkoutToggles}. This
 * just clears any leftover old full-width banner. */
function renderWoHiddenNote(): void {
  document.getElementById("woHiddenNote")?.remove();
}

function onWorkoutRowClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest(".xdd-rpe") && onSetRpeClick(target)) return; // the RIR picker handles itself
  if (toggleScaleEditor(target)) return; // a set's ×chip → floating modifier editor
  if (resetSetEdit(target)) return; // "Reset set" in the edit row
  if (deleteSetEdit(target)) return; // "Delete set" — hide it everywhere (on-device)
  if (toggleSetNotComparable(target)) return; // "⊘ not comparable" in the set editor
  // "alone" tag toggle — tag/untag this session as trained alone, then re-render
  // (so the chip + any active "Only alone" filter update). Doesn't expand the row.
  const tagBtn = target.closest<HTMLButtonElement>(".wo-alone");
  if (tagBtn?.dataset.alone) {
    const key = aloneKey(tagBtn.dataset.alone);
    if (aloneTags.has(key)) aloneTags.delete(key);
    else aloneTags.add(key);
    saveAlone();
    renderWorkoutsPage();
    renderWorkoutCalendar(); // refresh the year map so the red "alone" ring updates live
    return;
  }
  // Inline "add set" form (shown right under an exercise). Handle its own
  // buttons here and swallow any other click inside it, so clicking the inputs
  // never bubbles up to expand/collapse the row.
  const inForm = target.closest<HTMLElement>(".wo-addform");
  if (inForm) {
    if (target.closest(".wo-af-go")) onInlineAddGo(inForm);
    else if (target.closest(".wo-af-cancel")) removeInlineAddForm(inForm);
    else {
      // Day / Today toggle — light up the tapped option.
      const seg = target.closest<HTMLElement>(".wo-af-when .seg-btn");
      if (seg)
        for (const b of inForm.querySelectorAll<HTMLElement>(".wo-af-when .seg-btn"))
          b.classList.toggle("is-active", b === seg);
    }
    return;
  }
  // "+ exercise" on a session → inline form with a searchable exercise picker,
  // to add a brand-new exercise to that day.
  const addExBtn = target.closest<HTMLButtonElement>(".wo-addex");
  if (addExBtn) {
    toggleInlineAddExerciseForm(addExBtn);
    return;
  }
  // "+ set" on an exercise → open a small inline form right here so the set is
  // logged on this screen, without leaving for the Add page.
  const addBtn = target.closest<HTMLButtonElement>(".wo-addset");
  if (addBtn?.dataset.addex) {
    toggleInlineAddForm(addBtn);
    return;
  }
  // Per-day / expanded "hidden N/M" reveal toggles itself (own document handlers,
  // PB-2) — swallow it here so it never falls through to expand/collapse the day.
  if (target.closest("[data-woshowday]") || target.closest("[data-woshowexp]")) return;
  if (toggleE1rmFormula(target)) return; // a 1RM cell → show its formula
  if (togglePrirFormula(target)) return; // a pRIR cell → show how it was estimated
  if (toggleSetNote(target)) return; // a set's note toggle, deepest level
  if (toggleSetEdit(target)) return; // tap the set row → open/close its edit panel (runs last)

  // An exercise name in an expanded day -> filter the Analysis view to just that
  // exercise (single mode), so the graph/stats/history all scope to it.
  const exLink = target.closest(".wo-exlink") as HTMLElement | null;
  if (exLink) {
    const exName = exLink.dataset.exname;
    if (exName) openWorkoutAnalysis({ exercises: [exName] });
    return;
  }

  // A day/week -> expand straight to every exercise with all its sets.
  const row = target.closest("tr.wo-row") as HTMLTableRowElement | null;
  if (!row) return;
  if (toggleCollapse(row)) return;
  const grp = workoutGroups[Number(row.dataset.index)];
  if (!grp) return;
  insertDetail(row, 2, workoutGroupHtml(grp));
}

/** Inner table for one expanded day/week: every exercise as a sub-header row
 * followed immediately by all its sets (W / 1RM / Vol) — fully expanded, no
 * second tap needed. A set with a note still toggles its own note row. */
/** The lifts the Index filter hides for one day/week (live data minus the allow
 * set), with the day's total — for the per-day / expanded "hidden N/M" reveal.
 * null when nothing's hidden, the filter is off, or we're already revealing all
 * (woShowAllExercises). `key` is the ISO day, or the period-start in a period mode. */
function hiddenLiftsForKey(key: string, period: HistoryPeriod | null): { exercises: ExerciseCount[]; sets: SetRecord[]; total: number } | null {
  if (woShowAllExercises || !activeSet) return null;
  const allow = activeSet;
  const base = period
    ? periodsForUser(liveRecords(), els.athlete.value, period).find((w) => w.periodStart === key)
    : workoutsForUser(liveRecords(), els.athlete.value).find((d) => d.date === key);
  if (!base) return null;
  const hiddenEx = base.exercises.filter((e) => !allow.has(e.exerciseName));
  if (hiddenEx.length === 0) return null;
  const names = new Set(hiddenEx.map((e) => e.exerciseName));
  return { exercises: hiddenEx, sets: base.sets.filter((s) => names.has(s.exerciseName)), total: new Set(base.exercises.map((e) => e.exerciseName)).size };
}

function workoutGroupHtml(group: WorkoutGroup): string {
  const formula = currentFormula();
  const strengthByDay = currentStrengthByUserExercise(formula);
  // A period bucket (week / month) spans many days; show a subtle divider row where
  // the DAY changes (and a stronger one where the WEEK changes in month/3-month) so
  // the expanded sets read by week and day, not one undated run. Day mode = a single
  // day → no dividers.
  const mode = S.workoutViewMode;
  const divMode: "day" | "week" | null =
    mode === "week" || mode === "2week" ? "day" : mode === "month" || mode === "3month" ? "week" : null;
  // One exercise's header + set-rows; reused for the day's active lifts AND for its
  // hidden-lift reveal so a revealed lift looks IDENTICAL to the rest.
  const exRows = (e: ExerciseCount, sets: readonly SetRecord[]): string => {
    const addBtn = S.showAddSets
      ? `<button type="button" class="wo-addset" data-addex="${escapeHtml(e.exerciseName)}" data-adddate="${escapeHtml(group.date)}" title="Add a set of ${escapeHtml(e.exerciseName)}">+ set</button>`
      : "";
    const header =
      `<tr class="set-ex-row"><td colspan="5" class="wo-exname">` +
      `<span class="wo-exlink" data-exname="${escapeHtml(e.exerciseName)}" title="${escapeHtml(e.exerciseName)}">${escapeHtml(displayName(e.exerciseName))}</span>${originBadge(e.exerciseName)} <span class="muted">${e.count}</span>` +
      `${addBtn}</td></tr>`;
    // Newest-first: reverse the date-sorted sets so the latest DAY (and within a day
    // the latest SET) leads, matching the history's newest→oldest order — so a
    // session's warmup (done first) reads at the END, not the top. The day/week
    // dividers below still fire on each date change in this reversed order.
    const exSets = sets.filter((s) => s.exerciseName === e.exerciseName).reverse();
    let lastDay: string | null = null;
    let lastWeek: string | null = null;
    const setRows = exSets
      .map((s) => {
        let div = "";
        if (divMode && s.date !== lastDay) {
          const wk = mondayKey(s.date);
          const newWeek = divMode === "week" && wk !== lastWeek;
          const label = newWeek ? `${shortDate(s.date)} · ${periodGroupLabel(wk, "week")}` : shortDate(s.date);
          div = `<tr class="set-daydiv${newWeek ? " set-weekdiv" : ""}"><td colspan="5">${escapeHtml(label)}</td></tr>`;
          lastDay = s.date;
          lastWeek = wk;
        }
        return div + setRowsHtml(s, formula, currentStrengthFor(strengthByDay, s));
      })
      .join("");
    return header + setRows;
  };
  const body = group.exercises.map((e) => exRows(e, group.sets)).join("");
  // A trailing "+ exercise" row to add a brand-new exercise to this session.
  const addExRow = S.showAddSets
    ? `<tr class="set-ex-row wo-addex-host"><td colspan="5"><button type="button" class="wo-addex" data-adddate="${escapeHtml(group.date)}" title="Add a new exercise to this session">+ exercise</button></td></tr>`
    : "";
  // Lifts the Index filter hides this day/week — shown under a "hidden N/M" toggle
  // so the EXPANDED view matches the collapsed one (reveal = full set rows). PB-2.
  let hiddenRow = "";
  const hl = hiddenLiftsForKey(group.date, historyPeriod(S.workoutViewMode));
  if (hl) {
    const hiddenBody = hl.exercises.map((e) => exRows(e, hl.sets)).join("");
    const lbl = `${hl.exercises.length}/${hl.total}`;
    hiddenRow =
      `<tr class="set-ex-row wo-hidden-exp-host"><td colspan="5">` +
      `<button type="button" class="wo-hidden-daybtn" data-woshowexp data-hlabel="${lbl}" aria-expanded="false" title="Show the ${hl.exercises.length} lift${hl.exercises.length === 1 ? "" : "s"} the Index filter hides here (just this session)">hidden ${lbl}</button>` +
      `<div class="wo-hidden-exp" hidden><table class="data-table detail-table">${SETS_HEAD}<tbody>${hiddenBody}</tbody></table></div>` +
      `</td></tr>`;
  }
  return `<table class="data-table detail-table">${SETS_HEAD}<tbody>${body}${addExRow}${hiddenRow}</tbody></table>`;
}

// ---- Shared expand/collapse helpers ----
/** If the row already has its detail open, remove it and return true. */
function toggleCollapse(row: HTMLTableRowElement): boolean {
  const next = row.nextElementSibling;
  if (next && next.classList.contains("detail-row")) {
    next.remove();
    row.classList.remove("open");
    return true;
  }
  return false;
}

function insertDetail(row: HTMLTableRowElement, colspan: number, innerHtml: string) {
  const detail = document.createElement("tr");
  detail.className = "detail-row";
  detail.innerHTML = `<td colspan="${colspan}">${innerHtml}</td>`;
  row.insertAdjacentElement("afterend", detail);
  row.classList.add("open");
}

const MS_PER_DAY_RIR = 86_400_000;
const dayNumber = (iso: string): number => Math.round(Date.parse(iso) / MS_PER_DAY_RIR);

/**
 * CURRENT-strength (faded) EFFECTIVE 1RM per athlete+exercise, by training day —
 * the anchor each set's predicted RIR is measured against. Mirrors the on-screen
 * "current strength" line (decayedStrengthSeries): between sessions a lift fades
 * on the Ebbinghaus curve, and each session grows that lift's stability (so a
 * well-drilled lift fades slower). The level kept for a day is
 * max(faded-from-the-last-session, that day's best set) — so a set is judged
 * against your ABILITY ON THAT DAY, not an all-time peak from a stronger era
 * (which made light or detrained sets read as huge reps-in-reserve).
 *
 * Effective (bodyweight-inclusive) frame and the same addedWeight1RM null-guard
 * as the displayed 1RM, so it lines up with the per-set effective load fed into
 * predictedRir. Keyed "username exerciseName" → (dayNumber → level). Built once
 * per render. */
function currentStrengthByUserExercise(formula: OneRepMaxFormula): Map<string, Map<number, number>> {
  // 1) Best effective 1RM reached on each day, per athlete+exercise.
  const byKeyDay = new Map<string, Map<number, number>>();
  for (const r of computedRecords()) {
    if (!r.date || addedWeight1RM(r, formula) === null) continue; // same guard as the displayed 1RM
    const eff = estimate1RM(r.weight, r.reps, formula); // effective (bw-inclusive) 1RM
    if (eff === null) continue;
    const key = `${r.username} ${r.exerciseName}`;
    let dm = byKeyDay.get(key);
    if (!dm) byKeyDay.set(key, (dm = new Map()));
    const d = dayNumber(r.date);
    dm.set(d, Math.max(dm.get(d) ?? -Infinity, eff));
  }
  // 2) Forward-simulate the fade + consolidation to get the current level per day.
  const out = new Map<string, Map<number, number>>();
  for (const [key, dm] of byKeyDay) {
    const days = [...dm.keys()].sort((a, b) => a - b);
    const levels = new Map<number, number>();
    let anchor = days[0]!;
    let level = dm.get(anchor)!;
    let stability: number = STRENGTH_DECAY.baseStability;
    levels.set(anchor, level);
    for (let i = 1; i < days.length; i++) {
      const d = days[i]!;
      level = Math.max(level * strengthRetention(d - anchor, stability), dm.get(d)!);
      anchor = d;
      stability = grownStability(stability); // a new session makes future decay weaker
      levels.set(d, level);
    }
    out.set(key, levels);
  }
  return out;
}

/** The current-strength (faded) effective 1RM for one set's athlete+exercise on
 * the day of that set, or null if none. */
const currentStrengthFor = (m: Map<string, Map<number, number>>, s: SetRecord): number | null =>
  (s.date ? m.get(`${s.username} ${s.exerciseName}`)?.get(dayNumber(s.date)) : undefined) ?? null;

// Compact header for the sets tables: weight / est. 1RM / volume, all in kg.
// AI-NOTE: setRowsHtml/SETS_HEAD are shared by BOTH the Workouts day→exercise
// sets table and the Exercises weekly drill-in. The compact W/1RM/Vol headers
// and the collapsible-note layout therefore apply to both views; change here
// and you change both. The note toggle is handled by toggleSetNote(), wired
// into onWorkoutRowClick and onExerciseRowClick.
const SETS_HEAD =
  `<thead><tr><th class="num">W</th><th class="num">1RM</th><th class="num">Vol</th><th class="num" title="Predicted Reps In Reserve — your current strength (best est. 1RM, faded for time off) says how many reps you should manage at this weight; pRIR is that minus the reps you did. High = the set was easy (many left); ~0 = near failure. Tap a number to see the maths.">pRIR</th><th class="num" title="Reps In Reserve — how many more reps you could have done (low = near failure)">RIR</th></tr></thead>`;

/** How many characters of a note to show inline before truncating with "…". */
const NOTE_PREVIEW_LEN = 8;

/**
 * A readable, math-paper-style derivation of a set's estimated 1RM — one step per
 * line, with a real fraction bar for the rep-curve division. Returns HTML (the
 * caller inserts it unescaped). Takes a COMPUTED record (bodyweight folded into
 * `weight`, logged bar weight in `origWeight`, difficultyMult / assistKg stamped).
 */
function oneRmFormulaText(c: SetRecord, formula: OneRepMaxFormula): string {
  const effLoad = c.weight; // bodyweight-inclusive load
  const r = c.reps;
  const wrap = (s: string) => `<div class="rm-derive">${s}</div>`;
  if (effLoad === null || r === null || effLoad <= 0 || r <= 0) return wrap(`<div class="rm-step">Needs a weight and reps to estimate a 1RM.</div>`);
  const f2 = (n: number) => (Math.round(n * 100) / 100).toString();
  const kg = (n: number) => `${f2(n)} kg`;
  const frac = (n: string, d: string) => `<span class="rm-frac"><span class="rm-num">${n}</span><span class="rm-den">${d}</span></span>`;
  const step = (lbl: string, eq: string) => `<div class="rm-step"><span class="rm-lbl">${lbl}</span><span class="rm-eq">${eq}</span></div>`;
  const added = c.origWeight === undefined ? effLoad : (c.origWeight ?? 0);
  const bodyLoad = effLoad - added;
  const hasBody = bodyLoad > 0.01;
  if (r > MAX_1RM_REPS)
    return wrap(step("reps", `${r} reps is past the ${MAX_1RM_REPS}-rep limit where a 1RM estimate is reliable — no 1RM shown.`));

  const mult = c.difficultyMult ?? 1;
  const assist = c.assistKg ?? 0;
  const scaledLoad = effLoad * mult;
  const curveLoad = scaledLoad - assist; // what the rep-curve runs on (matches addedWeight1RM)
  const eff1rm = curveLoad > 0 ? estimate1RM(curveLoad, r, formula) : curveLoad;
  const added1rm = addedWeight1RM(c, formula);

  const lines: string[] = [];
  // 1) Effective load = bar + bodyweight share.
  lines.push(step("effective load", hasBody ? `<i>L</i> = ${kg(added)} + ${kg(bodyLoad)} = <b>${kg(effLoad)}</b>` : `<i>L</i> = <b>${kg(effLoad)}</b>`));
  // 2) Variation difficulty (multiplier on the load).
  let cur = effLoad;
  if (mult !== 1) { lines.push(step("× difficulty", `${kg(effLoad)} × ${f2(mult)} = <b>${kg(scaledLoad)}</b>`)); cur = scaledLoad; }
  // 3) Band assistance (kg subtracted).
  if (assist > 0) { lines.push(step("− band", `${kg(cur)} − ${kg(assist)} = <b>${kg(curveLoad)}</b>`)); cur = curveLoad; }
  // 4) Rep curve → the 1RM of that load.
  if (curveLoad <= 0) {
    lines.push(step(formula, `load ≤ 0 — the band more than covers it, so 1RM = <b>${kg(curveLoad)}</b>`));
  } else if (r === 1) {
    lines.push(step(formula, `a single rep IS the 1RM = <b>${kg(curveLoad)}</b>`));
  } else if (formula === "brzycki") {
    lines.push(step("Brzycki", `1RM = ${frac(`${f2(curveLoad)} × 36`, `37 − ${r}`)} = <b>${eff1rm === null ? "—" : kg(eff1rm)}</b>`));
  } else if (formula === "nuzzo") {
    const pct = benchPctForReps(r);
    lines.push(step("Nuzzo curve", `1RM = ${frac(`${kg(curveLoad)}`, `${f2(pct)}%`)} = <b>${eff1rm === null ? "—" : kg(eff1rm)}</b> <span class="rm-note">(${r} reps ≈ ${f2(pct)}% of 1RM)</span>`));
  } else {
    lines.push(step("Epley", `1RM = ${f2(curveLoad)} × (1 + ${frac(`${r}`, "30")}) = <b>${eff1rm === null ? "—" : kg(eff1rm)}</b>`));
  }
  // 5) Peel the FULL bodyweight share (not scaled by difficulty) → added-weight 1RM.
  if (hasBody && eff1rm !== null) {
    lines.push(step("added-weight 1RM", `${kg(eff1rm)} − ${kg(bodyLoad)} = <b class="rm-result">${added1rm === null ? "—" : kg(added1rm)}</b>`));
  }
  return wrap(lines.join(""));
}

/**
 * Plain-text explanation of a set's predicted RIR, numbers plugged in — the
 * pRIR counterpart of oneRmFormulaText. Takes the COMPUTED record (bodyweight
 * already folded into `weight`) plus the anchor: the CURRENT-strength (faded)
 * EFFECTIVE 1RM for that lift on that day. Walks the chain: your current
 * strength → the reps the curve predicts at this load → minus the reps you
 * actually did. Returns "" when no prediction is possible (caller renders "—").
 */
function predictedRirText(c: SetRecord, anchorE1RM: number | null, formula: OneRepMaxFormula): string {
  const effLoad = c.weight;
  const r = c.reps;
  if (anchorE1RM === null || effLoad === null || r === null || effLoad <= 0 || r <= 0) return "";
  const predicted = repsForWeight(anchorE1RM, effLoad, formula);
  if (predicted === null) return "";
  const f2 = (n: number) => (Math.round(n * 100) / 100).toString();
  // Bar weight vs the body's share folded in by computeRecord (same split the
  // 1RM reveal uses), so a bodyweight lift explains its effective load too.
  const added = c.origWeight === undefined ? effLoad : (c.origWeight ?? 0);
  const bodyLoad = effLoad - added;
  const hasBody = bodyLoad > 0.01;
  const loadTxt = hasBody
    ? `effective load ${f2(effLoad)} kg (bar ${f2(added)} + bodyweight share ${f2(bodyLoad)})`
    : `${f2(effLoad)} kg`;
  const curve = formula === "brzycki" ? "Brzycki" : formula === "nuzzo" ? "Nuzzo bench" : "Epley";
  const rir = predicted - r;
  return (
    `Strength anchor: your current ${c.exerciseName} strength on this day is about a ${f2(anchorE1RM)} kg estimated 1RM` +
    `${hasBody ? " (bodyweight included)" : ""} — your best, faded for time off the lift. ` +
    `The ${curve} curve says at ${loadTxt} you should manage about ${f2(predicted)} reps; ` +
    `you did ${r}, so predicted − actual = ${f2(predicted)} − ${r} = ${f2(rir)} reps in reserve.`
  );
}

/**
 * One set as table rows: the W/1RM/Vol line. The 1RM cell is a button — tapping
 * it expands a sub-row showing the exact formula and numbers used. When the set
 * has a note (or is a dropset) a short truncated preview sits on the left of the
 * weight cell with a caret; tapping the row expands the full note. Both reveals
 * are independent sub-rows, so a set can show either or both.
 */
function setRowsHtml(raw: SetRecord, formula: OneRepMaxFormula, anchorE1RM: number | null): string {
  // 1RM must be bodyweight-aware (same as the leaderboard/PRs): fold the body
  // share in, then report the added-weight 1RM. W and Vol stay in bar weight —
  // what was actually loaded. `raw` is a raw record; apply the on-device per-set
  // edits, then compute it here so the sets tables match every other view.
  const s = applySetOverride(raw);
  const computed = computeRecord(s);
  const e1rm = addedWeight1RM(computed, formula);
  // "Not comparable" lifts keep their reps (shown in the W column) but get no
  // volume — it's as meaningless as their 1RM here.
  const vol = computed.notComparable ? null : setVolume(s.weight, s.reps);
  // Predicted RIR: what your CURRENT (faded) strength for this lift says you
  // should manage at this (effective) load, minus the reps you did. Effective
  // frame on both sides so bodyweight lifts line up.
  const predRir = predictedRir(anchorE1RM, computed.weight, s.reps, formula);
  const prirText = predictedRirText(computed, anchorE1RM, formula);
  const prirCell =
    predRir === null
      ? "—"
      : `<button type="button" class="prir-btn" title="Show how this RIR was estimated">${Math.round(predRir)}</button>`;
  const note = [s.dropset ? "dropset" : "", displayNote(s.exerciseName, s.notes ?? "")].filter(Boolean).join(" · ");
  let preview = "";
  if (note) {
    const short = note.length > NOTE_PREVIEW_LEN ? `${note.slice(0, NOTE_PREVIEW_LEN)}…` : note;
    preview =
      `<button type="button" class="set-note" title="${escapeHtml(note)}">` +
      `${escapeHtml(short)}<span class="set-note-cue">›</span></button>`;
  }
  // The 1RM is, by definition, a weight done for ONE rep — so show it as
  // value¹ (matching the weight column's weight^reps), making that explicit.
  const e1rmCell =
    e1rm === null
      ? "—"
      : `<button type="button" class="e1rm-btn" title="Estimated 1RM — the weight you could do for 1 rep. Tap for the formula.">${fmt(e1rm)}<sup class="onerm-sup">1</sup></button>`;
  const sid = setId(s);
  const rpeCell = rpeDropdownHtml(sid, rpeFor(s));
  // A technique level (squat-rack hole / cm) logged in the note — show the tag.
  const lvlTag = s.levelLabel ? `<span class="set-lvl" title="Technique level (tune its scale in the exercise's ⚙ Technique scaling)">${escapeHtml(s.levelLabel)}</span>` : "";
  // The variation difficulty multiplier applied to this set (note model × level ×
  // per-set), shown when it isn't a plain ×1 so you can see it here too.
  const scaleVal = scaleForRecord(s);
  const scaleNum = Math.round(scaleVal * 100) / 100;
  const scaleNote = (s.notes ?? "").trim();
  // The note the editor edits: a real note, or — for a difficulty-model lift with NO
  // note (e.g. a hand-added handstand) — a per-set synthetic key, so its banded/lean/
  // ROM form is editable just like a logged-note set.
  const editNote = scaleNote || (familyOf(s.exerciseName) ? `__set:${sid}` : "");
  // A "not comparable" note has no meaningful multiplier — the chip reads "UN".
  const uncmp = !!scaleNote && isNoteNotComparable(s.exerciseName, scaleNote);
  const chipLabel = uncmp ? "UN" : `×${scaleNum}`;
  // The set's incline level (smith/sq/cm) rides along as data-attrs so the popover can
  // show it as the "incline" and edit its scale beside the family variation.
  const lvlAttrs =
    s.levelDim !== undefined && s.levelValue !== undefined
      ? ` data-scaleedit-leveldim="${escapeHtml(s.levelDim)}" data-scaleedit-levelvalue="${s.levelValue}" data-scaleedit-levellabel="${escapeHtml(s.levelLabel ?? levelLabel(s.levelDim, s.levelValue))}"`
      : "";
  const scaleTag = editNote
    ? // Editable chip that opens the floating modifier editor (note OR per-set form).
      `<button type="button" class="set-scale is-editable${uncmp ? " is-uncmp" : ""}" data-scaleedit-ex="${escapeHtml(s.exerciseName)}" data-scaleedit-note="${escapeHtml(editNote)}"${lvlAttrs} title="${uncmp ? "Not comparable — tap to edit" : "Tap to set this set's variation (band, lean, range…)"}">${chipLabel} ▾</button>`
    : Math.abs(scaleVal - 1) > 1e-6
      ? `<span class="set-scale" title="Difficulty multiplier (from the level / per-set scale)">×${scaleNum}</span>`
      : "";
  // Effort tag from RIR (logged, else predicted): hard / mid / warm-up. Big leg
  // lifts get a wider "mid" band (see effortClass).
  const eff = setEffortClass(s, predRir);
  const effTag = eff
    ? `<span class="set-eff eff-${eff}" title="${eff === "hard" ? "Hard set — RIR under 3" : eff === "mid" ? `Mid set — RIR 3–${isBigLegsLift(s.exerciseName) ? 8 : 6} (working, not to failure)` : "Warm-up — well short of failure"}">${eff === "warmup" ? "Warm" : eff === "hard" ? "Hard" : "Mid"}</span>`
    : "";
  // Machine-type tag (gravity-or-cable lifts in gravity/mixed mode): "grav" means
  // this set's STRENGTH was counted at ×0.6 of the logged weight; "review" flags an
  // ambiguous mixed-mode set (a light value that might be a gravity warm-up).
  const machineTag =
    computed.machineType === "review"
      ? `<span class="set-review" title="Mixed machine: too ambiguous to trust — could be a light cable set or a gravity-machine warm-up. Check it.">⚠ review</span>`
      : computed.machineType === "gravity"
        ? `<span class="set-grav" title="Gravity machine — strength counted at ×${GRAVITY_MULT} of the logged weight">grav</span>`
        : "";
  const edited = setOverrides[sid] !== undefined;
  // The whole set row is the edit handle now — tap anywhere on it (except the
  // inner 1RM / pRIR / note / RIR controls, which keep their own taps) to open
  // this set's edit panel. No separate ✎ pencil button.
  const main =
    `<tr class="set-main${note ? " set-row has-note" : ""}${edited ? " is-edited" : ""}" data-setid="${escapeHtml(sid)}" ` +
    `title="Tap to edit this set (weight, reps, bodyweight, scale)">` +
    `<td class="num wcell">${effTag}${preview}${lvlTag}${scaleTag}${machineTag}${wr(s.weight, s.reps)}</td>` +
    `<td class="num">${e1rmCell}</td>` +
    `<td class="num">${vol === null ? "—" : fmt(vol)}</td>` +
    `<td class="num">${prirCell}</td>` +
    `<td class="num rpe-cell">${rpeCell}</td></tr>`;
  const noteRow = note
    ? `<tr class="set-note-row" hidden><td colspan="5" class="muted">${escapeHtml(note)}</td></tr>`
    : "";
  const formulaRow =
    e1rm === null
      ? ""
      : `<tr class="e1rm-formula-row" hidden><td colspan="5" class="muted">${oneRmFormulaText(computed, formula)}</td></tr>`;
  const prirRow =
    predRir === null || !prirText
      ? ""
      : `<tr class="prir-formula-row" hidden><td colspan="5" class="muted">${escapeHtml(prirText)}</td></tr>`;
  // Edit row: tweak this set's weight / reps / bodyweight / scaling factor. RIR is
  // the dropdown in the row itself. Bodyweight is just for this set (placeholder
  // shows the default). Blank a field to clear that one edit.
  const dfltBw = raw.bodyweight ?? athProfile(s.username)?.weight ?? null;
  const efld = (field: keyof SetOverride, label: string, val: number | null, step: number, ph = "") =>
    `<label class="set-edit-f">${label}<input class="set-edit-input" type="number" step="${step}" inputmode="decimal" ` +
    `data-setid="${escapeHtml(sid)}" data-field="${field}" value="${val ?? ""}"${ph ? ` placeholder="${escapeHtml(ph)}"` : ""} /></label>`;
  // Editable NOTE: the original CSV note (or your edit of it). Drives the displayed
  // text and the variation difficulty; blank it to fall back to the original.
  const noteFld =
    `<label class="set-edit-f set-edit-f-note">Note` +
    `<input class="set-edit-note" type="text" data-setid="${escapeHtml(sid)}" data-orig="${escapeHtml(raw.notes ?? "")}" value="${escapeHtml(s.notes ?? "")}" placeholder="${escapeHtml(raw.notes ?? "(no note)")}" /></label>`;
  const editRow =
    `<tr class="set-edit-row" hidden><td colspan="5"><div class="set-edit-grid">` +
    efld("weight", "Weight (kg)", s.weight, 0.5) +
    efld("reps", "Reps", s.reps, 1) +
    efld("bodyweight", "Bodyweight", setOverrides[sid]?.bodyweight ?? null, 0.5, dfltBw === null ? "" : String(dfltBw)) +
    efld("scale", "Scale ×", setOverrides[sid]?.scale ?? null, 0.05, "1") +
    noteFld +
    `<button type="button" class="set-edit-nc${notComparableSets.has(sid) ? " is-on" : ""}" data-setid="${escapeHtml(sid)}" aria-pressed="${notComparableSets.has(sid)}" title="Not comparable — keep this set's reps/sets but drop its 1RM &amp; volume (e.g. a static hold or an odd one-off)">⊘ ${notComparableSets.has(sid) ? "not comparable" : "not comparable?"}</button>` +
    `<button type="button" class="set-edit-reset" data-setid="${escapeHtml(sid)}"${edited ? "" : " hidden"}>↺ Reset set</button>` +
    `<button type="button" class="set-edit-delete" data-setid="${escapeHtml(sid)}" title="Hide this set everywhere on the site (the source data is never changed; restore in Settings → Data health)">🗑 Delete set</button>` +
    `</div></td></tr>`;
  return main + noteRow + formulaRow + prirRow + editRow;
}

/** The per-set RIR picker as a custom HTML/CSS dropdown (no native <select>, so it
 * looks the same on every device). Closed button shows "range word" (or "–" when
 * unset); the open menu lists every band with its full description, plus a Clear
 * row. Reuses the app's .xdd dropdown styling; matched to the cell width. Clicks
 * are handled by delegation in the sets-table handler (onSetRpeClick). */
function rpeDropdownHtml(sid: string, grade: string | undefined): string {
  const band = rirBand(grade);
  const label = band ? band.id : "–";
  const optHtml = (val: string, text: string, title: string, active: boolean) =>
    `<button type="button" class="xdd-opt set-rpe-opt${active ? " is-active" : ""}" data-rir="${escapeHtml(val)}" title="${escapeHtml(title)}" role="option">${escapeHtml(text)}</button>`;
  // Just the number range — no explanations (the why stays as a hover tooltip).
  const menu =
    optHtml("", "–", "Clear the grade", !band) +
    RIR_BANDS.map((b) => optHtml(b.id, b.id, b.desc, grade === b.id)).join("");
  return (
    `<div class="xdd xdd-rpe${band ? " is-set" : ""}" data-setid="${escapeHtml(sid)}">` +
    `<button type="button" class="xdd-btn set-rpe-btn" aria-label="Reps in reserve (RIR)">${escapeHtml(label)}<span class="xdd-caret">▾</span></button>` +
    `<div class="xdd-menu" hidden role="listbox">${menu}</div>` +
    `</div>`
  );
}

/** Click inside a set's RIR dropdown: toggle the menu open, or apply a picked
 * band (save it, re-render the cell, refresh the drill-in graph). Returns true if
 * it handled the click. Shared by both sets tables. */
function onSetRpeClick(target: HTMLElement): boolean {
  const dd = target.closest<HTMLElement>(".xdd-rpe");
  if (!dd?.dataset.setid) return false;
  const menu = dd.querySelector<HTMLElement>(".xdd-menu")!;
  // Tapping the closed button toggles this menu (and closes any other open one).
  if (target.closest(".set-rpe-btn")) {
    const opening = menu.hasAttribute("hidden");
    closeAllRpeMenus();
    menu.toggleAttribute("hidden", !opening);
    dd.classList.toggle("open", opening);
    return true;
  }
  // Tapping a band applies it.
  const opt = target.closest<HTMLElement>(".set-rpe-opt");
  if (opt?.dataset.rir !== undefined) {
    const v = opt.dataset.rir === "" ? null : opt.dataset.rir;
    setRpe(dd.dataset.setid, v);
    // Swap in a freshly-rendered dropdown so the button label + is-set update.
    dd.outerHTML = rpeDropdownHtml(dd.dataset.setid, v ?? undefined);
    return true;
  }
  return true; // a click inside the open menu (e.g. on a gap) — swallow it
}

/** Close every open RIR dropdown menu (used before opening one, and on outside click). */
function closeAllRpeMenus(): void {
  for (const dd of document.querySelectorAll<HTMLElement>(".xdd-rpe.open")) {
    dd.classList.remove("open");
    dd.querySelector<HTMLElement>(".xdd-menu")?.setAttribute("hidden", "");
  }
}

/** Click on a set's note preview chip (the “…›”): expand/collapse the hidden note
 * row that follows it. Returns true only when the chip itself was clicked — tapping
 * anywhere else on the row falls through to open the edit panel (which has its own
 * Note field), so a set WITH a note stays editable. Shared by both sets tables. */
function toggleSetNote(target: HTMLElement): boolean {
  const chip = target.closest<HTMLElement>(".set-note");
  if (!chip) return false;
  const row = chip.closest<HTMLElement>("tr.set-row.has-note");
  if (!row) return false;
  const noteRow = row.nextElementSibling;
  if (noteRow?.classList.contains("set-note-row")) {
    const hidden = noteRow.toggleAttribute("hidden");
    row.classList.toggle("is-open", !hidden);
  }
  return true;
}

// ---- Floating "edit this note's modifiers" popover (from a set row's ×chip) ----
let scaleEditState: { ex: string; note: string; level?: { dim: LevelDim; value: number; label: string } } | null = null;
let scaleEditDirty = false; // an edit was made while the popover was open
/** The INCLINE block for the popover: the set's smith-notch / squat-rack / cm level
 * (the real "incline" the owner logged) shown with its scale editable right here, so
 * it appears alongside the family variation (e.g. on-the-knees) it combines with —
 * instead of the popover showing only the family picker and hiding the logged SQ8. */
function scaleEditLevelBlock(): string {
  const lv = scaleEditState?.level;
  if (!lv) return "";
  const ex = scaleEditState!.ex;
  const scale = levelScaleFor(ex, lv.dim, lv.value);
  // Incline scales are GLOBAL (data-incdim/-incval → setInclineScale, shared by every
  // push-up); any other level keeps a per-exercise override (data-levelkey).
  const incline = isInclineLevelExercise(ex);
  const attrs = incline
    ? `data-incdim="${escapeHtml(lv.dim)}" data-incval="${lv.value}"`
    : `data-levelkey="${escapeHtml(levelKey(ex, lv.dim, lv.value))}"`;
  return (
    `<div class="ex-var-dim scale-edit-lvl-row"><span class="ex-var-dim-lbl">incline</span>` +
    `<div class="ex-var-selrow"><span class="set-lvl">${escapeHtml(lv.label)}</span>` +
    `<label class="ex-var-lbl">× <input class="ex-var-input scale-edit-lvl" type="number" step="0.05" min="0.1" max="5" ` +
    `value="${scale}" ${attrs} aria-label="Incline scale for ${escapeHtml(lv.label)}" /></label></div></div>`
  );
}
function renderScaleEditor(): void {
  const pop = document.getElementById("scaleEditPop");
  if (!pop || !scaleEditState) return;
  const title = scaleEditState.note.startsWith("__set:") ? "This set's variation" : scaleEditState.note;
  // The incline level (if any) multiplies into the picker's "final multiplier".
  const lv = scaleEditState.level;
  const lvlFactor = lv ? levelScaleFor(scaleEditState.ex, lv.dim, lv.value) : 1;
  pop.innerHTML =
    `<div class="scale-edit-hd"><span class="scale-edit-title">${escapeHtml(title)}</span>` +
    `<button type="button" class="scale-edit-close" aria-label="Close">✕</button></div>` +
    scaleEditLevelBlock() +
    notePickerHtml(scaleEditState.ex, scaleEditState.note, lvlFactor);
  refreshPoseViz();
}
function positionScaleEditor(anchor: HTMLElement): void {
  const pop = document.getElementById("scaleEditPop");
  if (!pop) return;
  const r = anchor.getBoundingClientRect();
  const w = Math.min(window.innerWidth - 16, 360);
  pop.style.width = `${w}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
  // Below the chip, but flip above if it would run off the bottom.
  const top = r.bottom + 6;
  pop.style.top = `${Math.min(top, window.innerHeight - 40)}px`;
}
function openScaleEditor(ex: string, note: string, anchor: HTMLElement, level?: { dim: LevelDim; value: number; label: string }): void {
  scaleEditState = level ? { ex, note, level } : { ex, note };
  let pop = document.getElementById("scaleEditPop");
  if (!pop) {
    pop = document.createElement("div");
    pop.id = "scaleEditPop";
    pop.className = "scale-edit-pop";
    document.body.appendChild(pop);
  }
  renderScaleEditor();
  pop.hidden = false;
  positionScaleEditor(anchor);
}
function closeScaleEditor(): void {
  const wasDirty = scaleEditDirty;
  scaleEditState = null;
  scaleEditDirty = false;
  const pop = document.getElementById("scaleEditPop");
  if (pop) pop.hidden = true;
  refreshPoseViz(); // tear down the visual editors now the popover is closed
  // Sync the table/graphs ONCE, on close (not on every chip tap) — including the
  // workouts list + charts so the compact ×multipliers update, scroll preserved.
  if (wasDirty) refreshAfterDifficultyEdit();
}
/** Click on a set row's editable ×chip: open/close the floating modifier editor
 * for that note. Returns true if it handled the click (so the row doesn't edit). */
function toggleScaleEditor(target: HTMLElement): boolean {
  if (target.closest(".scale-edit-close")) { closeScaleEditor(); return true; }
  const btn = target.closest<HTMLElement>(".set-scale.is-editable");
  if (!btn?.dataset.scaleeditEx || btn.dataset.scaleeditNote === undefined) return false;
  if (scaleEditState && scaleEditState.ex === btn.dataset.scaleeditEx && scaleEditState.note === btn.dataset.scaleeditNote)
    closeScaleEditor();
  else {
    // The set's incline LEVEL (smith/sq/cm) rides along on the chip so it can be shown
    // and tuned in the popover next to the family variation it combines with.
    const ld = btn.dataset.scaleeditLeveldim, lv = btn.dataset.scaleeditLevelvalue, ll = btn.dataset.scaleeditLevellabel;
    const level = ld && lv !== undefined && ll !== undefined ? { dim: ld as LevelDim, value: Number(lv), label: ll } : undefined;
    openScaleEditor(btn.dataset.scaleeditEx, btn.dataset.scaleeditNote, btn, level);
  }
  return true;
}

/** Click on a 1RM cell button: expand/collapse the formula sub-row for that set.
 * The formula row follows the set row (after the optional note row), so scan
 * forward to it. Returns true if the click was on a 1RM button. Shared by the
 * Workouts and Exercises sets tables. */
function toggleE1rmFormula(target: HTMLElement): boolean {
  const btn = target.closest<HTMLElement>(".e1rm-btn");
  if (!btn) return false;
  let sib = btn.closest("tr")?.nextElementSibling ?? null;
  while (sib && !sib.classList.contains("e1rm-formula-row")) {
    // Stop if we hit the next set's row rather than this set's formula row.
    if (sib.classList.contains("set-main") || sib.querySelector(".e1rm-btn")) break;
    sib = sib.nextElementSibling;
  }
  if (sib?.classList.contains("e1rm-formula-row")) {
    sib.toggleAttribute("hidden");
    btn.classList.toggle("is-open");
  }
  return true;
}

/** Click on a pRIR cell button: expand/collapse the predicted-RIR explanation
 * sub-row for that set. Mirrors toggleE1rmFormula — scan forward past the note /
 * 1RM-formula rows to this set's prir-formula-row. Returns true if the click was
 * on a pRIR button. Shared by the Workouts and Exercises sets tables. */
function togglePrirFormula(target: HTMLElement): boolean {
  const btn = target.closest<HTMLElement>(".prir-btn");
  if (!btn) return false;
  let sib = btn.closest("tr")?.nextElementSibling ?? null;
  while (sib && !sib.classList.contains("prir-formula-row")) {
    // Stop if we reach the next set's row rather than this set's explanation.
    if (sib.classList.contains("set-main") || sib.querySelector(".prir-btn")) break;
    sib = sib.nextElementSibling;
  }
  if (sib?.classList.contains("prir-formula-row")) {
    sib.toggleAttribute("hidden");
    btn.classList.toggle("is-open");
  }
  return true;
}

/** Tap a set's main row to expand/collapse its edit panel (weight/reps/bw/scale).
 * Runs LAST in the click flow so the inner 1RM / pRIR / note / RIR controls keep
 * their own taps. Scans forward past the note/formula/prir sub-rows to this set's
 * edit row. Shared by both sets tables. */
function toggleSetEdit(target: HTMLElement): boolean {
  const row = target.closest<HTMLElement>("tr.set-main");
  if (!row) return false;
  let sib = row.nextElementSibling;
  while (sib && !sib.classList.contains("set-edit-row")) {
    if (sib.classList.contains("set-main")) break; // reached the next set's main row
    sib = sib.nextElementSibling;
  }
  if (sib?.classList.contains("set-edit-row")) {
    sib.toggleAttribute("hidden");
    row.classList.toggle("edit-open");
  }
  return true;
}

/** Click "Reset set": drop all this set's on-device edits and re-render. */
function resetSetEdit(target: HTMLElement): boolean {
  const btn = target.closest<HTMLElement>(".set-edit-reset");
  if (!btn?.dataset.setid) return false;
  delete setOverrides[btn.dataset.setid];
  saveSetOverrides();
  scheduleRender();
  return true;
}

/** Click "Delete set": hide this set everywhere (on-device only — the source CSV
 * is untouched). Confirm first; restorable in Data health. */
function deleteSetEdit(target: HTMLElement): boolean {
  const btn = target.closest<HTMLElement>(".set-edit-delete");
  if (!btn?.dataset.setid) return false;
  if (!window.confirm("Hide this set from the whole site? Your source data isn't changed, and you can restore it later in Settings → Data health.")) return true;
  setDeleted(btn.dataset.setid, true);
  const y = window.scrollY;
  renderAll();
  if (document.getElementById("workoutsTable")) renderWorkoutsPage();
  if (document.getElementById("tab-analysis")?.hidden === false) renderWorkoutAnalysis();
  refreshExerciseInfo();
  renderHealth();
  window.scrollTo(0, y);
  return true;
}

/** Click "⊘ not comparable" in the set editor: toggle THIS set's not-comparable
 * flag (drops its 1RM & volume; reps/sets still count), then re-render. */
function toggleSetNotComparable(target: HTMLElement): boolean {
  const btn = target.closest<HTMLElement>(".set-edit-nc");
  if (!btn?.dataset.setid) return false;
  setSetNotComparable(btn.dataset.setid, !notComparableSets.has(btn.dataset.setid));
  const y = window.scrollY;
  renderAll();
  if (document.getElementById("workoutsTable")) renderWorkoutsPage();
  if (document.getElementById("tab-analysis")?.hidden === false) renderWorkoutAnalysis();
  refreshExerciseInfo();
  window.scrollTo(0, y);
  return true;
}

/** A set-edit input changed: save the override (weight/reps/bodyweight/scale) and
 * re-render so the new value flows everywhere (1RM, volume, leaderboard, graphs). */
function onSetEditInput(e: Event): void {
  // Note text field (string) — edits the original CSV note for this set.
  const noteInp = (e.target as HTMLElement).closest<HTMLInputElement>(".set-edit-note");
  if (noteInp?.dataset.setid !== undefined) {
    setSetOverrideNote(noteInp.dataset.setid, noteInp.value, noteInp.dataset.orig ?? "");
    scheduleRender();
    return;
  }
  const inp = (e.target as HTMLElement).closest<HTMLInputElement>(".set-edit-input");
  if (!inp?.dataset.setid || !inp.dataset.field) return;
  const field = inp.dataset.field as "weight" | "reps" | "bodyweight" | "scale";
  const txt = inp.value.trim();
  let v: number | null = txt === "" ? null : parseFloat(txt);
  if (v !== null && !Number.isFinite(v)) v = null;
  if (v !== null && field === "reps") v = Math.round(v);
  setSetOverrideField(inp.dataset.setid, field, v);
  scheduleRender();
}

/**
 * Sets spanning several days (one week of one exercise), grouped by day. Each
 * day is a header row above that day's sets, so the date sits "up top" instead
 * of repeating in its own column — matching the Workouts view.
 */
function setsByDateTableHtml(sets: readonly SetRecord[]): string {
  const formula = currentFormula();
  const strengthByDay = currentStrengthByUserExercise(formula);
  const byDate = new Map<string, SetRecord[]>();
  for (const s of sets) {
    const g = byDate.get(s.date);
    if (g) g.push(s);
    else byDate.set(s.date, [s]);
  }
  const body = Array.from(byDate, ([date, daySets]) => {
    const header = `<tr class="set-date-row"><td colspan="5" class="wo-date">${shortDate(date)}</td></tr>`;
    return header + daySets.map((s) => setRowsHtml(s, formula, currentStrengthFor(strengthByDay, s))).join("");
  }).join("");
  return `<table class="data-table detail-table">${SETS_HEAD}<tbody>${body}</tbody></table>`;
}

/** Best / latest / trend summary line for an exercise's day-by-day 1RM series.
 * Shown under the per-exercise drill-in chart. */




// ---- Exercises tab: which spellings were merged into one lift ----
// Documents every combine (per the owner's rule that merges must be visible),
// newest list straight from the canonicaliser. Empty state when nothing merged.
function renderMergeList() {
  const merges = data.merges;
  if (!merges.length) {
    els.mergeList.innerHTML = `<p class="muted">No exercises needed combining — every lift is logged under one name.</p>`;
    return;
  }
  const head = `<thead><tr><th>Shown as</th><th>Combined from</th><th class="num">Sets</th></tr></thead>`;
  const body = merges
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.canonical)}</td>` +
        `<td>${m.variants.map((v) => escapeHtml(v)).join(", ")}</td>` +
        `<td class="num">${m.sets.toLocaleString()}</td></tr>`,
    )
    .join("");
  els.mergeList.innerHTML = `<table class="data-table">${head}<tbody>${body}</tbody></table>`;
}

/**
 * The app-wide active-set control on the Index page: a frequency-tier cutoff that
 * hides every lift below it everywhere in the app (default None = show all). The
 * per-exercise include/exclude overrides get inline toggles in a later slice; for
 * now the cutoff is the lever, and any manual overrides are summarised + clearable.
 */
/** Every distinct value a dimension takes across all logged exercises, sorted. */
function distinctMetaValues(dim: ExerciseFilterDim): string[] {
  const seen = new Set<string>();
  for (const name of new Set(data.records.map((r) => r.exerciseName))) {
    if (!name) continue;
    for (const v of waMeta(name, dim)) if (v) seen.add(v);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

function renderActiveSetBar(totalExercises: number): void {
  const active = activeSet ? activeSet.size : totalExercises;
  const hidden = Math.max(0, totalExercises - active);
  const opt = (val: string, label: string) =>
    `<option value="${val}"${(activeCutoff ?? "none") === val ? " selected" : ""}>${label}</option>`;
  const tierOpts = FREQ_TIERS.map((t) => opt(t.tier, t.label)).join("");
  // Spell out WHY lifts are hidden (tier / a picked "only these" set / taxonomy
  // filters / manual overrides) so the filter is never a mystery, and give ONE
  // obvious escape hatch that turns the whole thing off.
  let status: string;
  let reset = "";
  if (activeSet) {
    const why: string[] = [];
    if (activeSolo) why.push("a picked “only these” set");
    if (activeCutoff) why.push(`tier ${activeCutoff}+`);
    for (const f of activeMetaFilterList()) why.push(`${FILTER_DIM_LABELS[f.dim].toLowerCase()}: ${f.values.join("/")}`);
    if (activeInclude.size) why.push(`${activeInclude.size} forced-in`);
    if (activeExclude.size) why.push(`${activeExclude.size} forced-out`);
    status =
      `<span class="as-status is-on">Showing ${active} of ${totalExercises} — <strong>${hidden} hidden</strong>` +
      (why.length ? ` <span class="as-why">(${escapeHtml(why.join(" · "))})</span>` : "") + `</span>`;
    reset = ` <button type="button" class="as-clear as-reset" data-asreset="1">Show all ${totalExercises} (turn filter off)</button>`;
  } else {
    status = `<span class="as-status muted">Showing all ${totalExercises} exercises (filter off)</span>`;
  }
  // ---- Combinable taxonomy filters (AND with the tier) ----
  // A dimension picker chooses which value pills to show; the pills (OR within the
  // dim) toggle that dimension's accepted values. All active dims AND together, so
  // you can keep e.g. only S-tier AND only calisthenics.
  const dimOpts = FILTER_DIMS
    .map((d) => `<option value="${d}"${d === activeFilterDim ? " selected" : ""}>${escapeHtml(FILTER_DIM_LABELS[d])}</option>`)
    .join("");
  const chosen = new Set(activeMetaFilters[activeFilterDim] ?? []);
  const valuePills = distinctMetaValues(activeFilterDim)
    .map((v) => `<button type="button" class="as-fpill${chosen.has(v) ? " is-on" : ""}" data-asfval="${escapeHtml(v)}" aria-pressed="${chosen.has(v)}">${escapeHtml(v)}</button>`)
    .join("");
  const pillsRow = valuePills
    ? `<div class="as-fpills">${valuePills}</div>`
    : `<div class="as-fpills muted as-fnone">no values</div>`;
  // Active-filter summary chips (across every dimension), each removable.
  const activeChips = activeMetaFilterList()
    .flatMap((f) => f.values.map((v) =>
      `<button type="button" class="as-fchip" data-asfclear-dim="${f.dim}" data-asfclear-val="${escapeHtml(v)}" title="Remove this filter">${escapeHtml(FILTER_DIM_LABELS[f.dim])}: ${escapeHtml(v)} ✕</button>`))
    .join("");
  const activeChipsRow = activeChips
    ? `<div class="as-fchips">${activeChips}<button type="button" class="as-clear" data-asfclear-all="1">clear filters</button></div>`
    : "";
  els.activeSetBar.innerHTML =
    `<label class="as-label">Show app-wide ` +
    `<select id="activeCutoff" class="subtle-select">${opt("none", "All exercises")}${tierOpts}</select>` +
    `</label> ${status}${reset}` +
    `<div class="as-filter-row"><label class="as-label">Filter ` +
    `<select id="activeFilterDim" class="subtle-select">${dimOpts}</select></label>${pillsRow}</div>` +
    activeChipsRow +
    `<p class="as-hint muted">Restrict the whole app (every list, graph, leaderboard). Three layers stack (AND): a frequency tier, any taxonomy filters below, and a group's “only these” button. “Show all” clears every layer at once.</p>`;
}

/** Cutoff dropdown changed: save + re-render the whole app. */
function onActiveCutoffChange(value: string): void {
  activeCutoff = value === "none" ? null : value;
  saveActiveSet();
  scheduleRender();
}

/** Clear all manual include/exclude overrides (keeps the tier cutoff). */
function clearActiveOverrides(): void {
  activeInclude = new Set();
  activeExclude = new Set();
  activeSolo = null;
  saveActiveSet();
  scheduleRender();
}

/** Turn the WHOLE app-wide filter OFF in one tap — tier, taxonomy filters, the
 * "only these" solo set and every manual override — so every lift shows again.
 * The one escape hatch when "where did my lift go?". */
function resetActiveSetAll(): void {
  activeCutoff = null;
  activeInclude = new Set();
  activeExclude = new Set();
  activeSolo = null;
  activeMetaFilters = {};
  saveActiveSet();
  scheduleRender();
}

/** Re-render just the app-wide active-set bar (used when only the displayed filter
 * dimension changes — no app-wide data change). */
function rerenderActiveSetBar(): void {
  const total = new Set(data.records.map((r) => r.exerciseName).filter(Boolean)).size;
  renderActiveSetBar(total);
}

/** Toggle one taxonomy value for a dimension in the app-wide filter (OR within the
 * dim, AND across dims), then re-apply app-wide. */
function toggleActiveMetaValue(dim: ExerciseFilterDim, value: string): void {
  const cur = new Set(activeMetaFilters[dim] ?? []);
  if (cur.has(value)) cur.delete(value);
  else cur.add(value);
  if (cur.size) activeMetaFilters[dim] = [...cur];
  else delete activeMetaFilters[dim];
  saveActiveSet();
  scheduleRender();
}

/** Clear every app-wide taxonomy filter (keeps the tier cutoff + overrides). */
function clearActiveMetaFilters(): void {
  activeMetaFilters = {};
  saveActiveSet();
  scheduleRender();
}

/** Toggle one exercise's force-IN (include) or force-OUT (exclude) override from
 * the Index inspector, then re-apply app-wide and re-open the inspector row. */
function toggleActiveOverride(name: string, which: "include" | "exclude"): void {
  if (which === "include") {
    if (activeInclude.has(name)) activeInclude.delete(name);
    else { activeInclude.add(name); activeExclude.delete(name); }
  } else {
    if (activeExclude.has(name)) activeExclude.delete(name);
    else { activeExclude.add(name); activeInclude.delete(name); }
  }
  saveActiveSet();
  renderAll();
  reopenIndexDetail(name);
}

/** After an app-wide re-render, keep the exercise-settings overlay in sync (it
 * lives outside the rebuilt table, so it survives — just refresh its content if
 * it's showing this lift). Used by the in-overlay edit toggles. */
function reopenIndexDetail(name: string): void {
  if (currentExInfo === name) refreshExerciseInfo();
}

/** Open every <details> ancestor of an element (so a row tucked inside the Index
 * "Show hidden" sub-dropdown becomes visible, not just its group). */
function openAncestorDetails(el: HTMLElement): void {
  for (let p = el.parentElement; p; p = p.parentElement)
    if (p instanceof HTMLDetailsElement) p.open = true;
}

// ---- BW parts tab: every exercise and its bodyweight coefficient ----
function renderBwParts() {
  renderMergeList();
  const createBox = document.getElementById("idxCreate");
  if (createBox) createBox.innerHTML = createVariantFormHtml();
  const counts = new Map<string, number>();
  for (const r of data.records) if (r.exerciseName) counts.set(r.exerciseName, (counts.get(r.exerciseName) ?? 0) + 1);

  const rows: IndexRow[] = [...counts.keys()]
    .map((name) => ({ name, coeff: coeffFor(name), count: counts.get(name)! }))
    // Most-trained first (by set count), then alphabetical - kept inside each group.
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  els.bwTitle.textContent = "Exercises";
  renderActiveSetBar(rows.length);
  renderBwGroupBar();

  // Slice the same rows into the chosen grouping (category / muscle / function /
  // combinable / comparable).
  const buckets = indexBuckets(rows, S.bwGroupMode);

  // Remember which groups the user has opened, so editing/re-rendering keeps them
  // as they were. Groups start collapsed by default (empty set on first paint);
  // afterwards we read the live open/closed state back out of the DOM.
  if (S.bwOpenCats === null) S.bwOpenCats = new Set<string>();
  else {
    S.bwOpenCats = new Set<string>();
    for (const d of els.bwGroups.querySelectorAll<HTMLDetailsElement>("details.bw-cat"))
      if (d.open && d.dataset.cat) S.bwOpenCats.add(d.dataset.cat);
  }
  const open = (cat: string) => S.bwOpenCats!.has(cat);

  const head = `<thead><tr><th>Exercise</th><th class="num">BW part</th><th class="num">Sets</th></tr></thead>`;
  // One row's <tr>, reused for both shown and (greyed) hidden-by-filter lists.
  const rowHtml = (r: IndexRow, hidden: boolean) =>
    `<tr data-exrow="${escapeHtml(r.name)}"${hidden ? ' class="bw-row-hidden"' : ""}><td>` +
    `<span class="bw-ex-name" data-exname="${escapeHtml(r.name)}"><span class="caret">▸</span>${escapeHtml(r.name)}</span>${originBadge(r.name)}` +
    ` <button type="button" class="bw-moreinfo" data-moreinfoex="${escapeHtml(r.name)}" title="More info &amp; note-variation difficulty">ℹ</button></td>` +
    `<td class="num"><input class="bw-input" type="number" step="0.05" min="0" max="2" ` +
    `value="${r.coeff}" data-ex="${escapeHtml(r.name)}" aria-label="Bodyweight part for ${escapeHtml(r.name)}" /></td>` +
    `<td class="num">${r.count.toLocaleString()}</td></tr>`;
  const table = (rs: IndexRow[], hidden: boolean) =>
    `<table class="data-table">${head}<tbody>${rs.map((r) => rowHtml(r, hidden)).join("")}</tbody></table>`;

  // Live search (from the bottom bar): show a FLAT list of every lift whose name /
  // code / short-name matches, so you find it right here in the Index instead of
  // being thrown to the Analysis view. Skips the grouping + active-set machinery.
  if (bwSearchQuery) {
    const q = bwSearchQuery.toLowerCase();
    const matches = rows.filter(
      (r) => r.name.toLowerCase().includes(q) || codeFor(r.name).toLowerCase().includes(q) || shortFor(r.name).toLowerCase().includes(q),
    );
    els.bwGroups.innerHTML = matches.length
      ? `<div class="bw-search-results"><p class="bw-search-note muted">${matches.length} match${matches.length === 1 ? "" : "es"} for “${escapeHtml(bwSearchQuery)}”</p>${table(matches, false)}</div>`
      : `<p class="bw-search-note muted">No exercise matches “${escapeHtml(bwSearchQuery)}”.</p>`;
    return;
  }

  // Per-group app-wide filter: ONE cycling toggle (show all → only these →
  // hidden → …) instead of three buttons. Its label shows the current state; the
  // members are read from the group's rows in the DOM when clicked.
  const groupFilterToggle = (names: string[]): string => {
    const st = groupFilterState(names);
    const label = st === "only" ? "only these" : st === "hide" ? "hidden" : "show all";
    return (
      `<span class="bw-cat-filter">` +
      `<button type="button" class="bw-filt bw-filt-toggle is-${st}" data-grpcycle="1" ` +
      `title="App-wide filter — tap to cycle: show all → only these → hidden">${label}</button>` +
      `</span>`
    );
  };

  // One group's collapsible <details> (a coloured title + its exercise table). The
  // active-set filter splits it: active lifts stay; the rest go under "Show hidden".
  const bucketHtml = (b: IndexBucket, sub = false): string => {
    const shown = activeSet ? b.rows.filter((r) => activeSet!.has(r.name)) : b.rows;
    const hidden = activeSet ? b.rows.filter((r) => !activeSet!.has(r.name)) : [];
    const meta = activeSet
      ? `${shown.length}${hidden.length ? ` <span class="bw-cat-hidden">${hidden.length} hidden</span>` : ""}`
      : `${b.rows.length}`;
    const shownBlock = shown.length
      ? table(shown, false)
      : `<p class="bw-allhidden muted">All ${b.rows.length} hidden by the active filter.</p>`;
    const hiddenBlock = hidden.length
      ? `<details class="bw-hidden"><summary class="bw-hidden-sum">Show ${hidden.length} hidden by filter</summary>${table(hidden, true)}</details>`
      : "";
    return (
      `<details class="bw-cat${sub ? " bw-cat-sub" : ""}" data-cat="${escapeHtml(b.key)}"${open(b.key) ? " open" : ""}>` +
      `<summary class="bw-cat-summary">` +
      `<span class="bw-cat-dot" style="background:${b.color}"></span>` +
      `<span class="bw-cat-name">${escapeHtml(b.label)}</span>` +
      `<span class="bw-cat-meta muted">${meta}</span>` +
      groupFilterToggle(b.rows.map((r) => r.name)) +
      `</summary>` +
      shownBlock +
      hiddenBlock +
      `</details>`
    );
  };

  // The big "Strength" discipline is sliced further into sub-groups by muscle or
  // function (the owner picks which). Its lifts re-run through indexBuckets in the
  // chosen sub-mode and render as nested sub-groups, with a little selector on top.
  const strengthBucketHtml = (b: IndexBucket): string => {
    const subs = indexBuckets(b.rows, strengthSubMode);
    const opt = (m: "muscleGroup" | "function", lbl: string) => `<option value="${m}"${strengthSubMode === m ? " selected" : ""}>${lbl}</option>`;
    const sel = `<div class="bw-substrat-bar">Sub-group by <select class="bw-substrat subtle-select">${opt("muscleGroup", "Muscle group")}${opt("function", "Function")}</select></div>`;
    return (
      `<details class="bw-cat" data-cat="${escapeHtml(b.key)}"${open(b.key) ? " open" : ""}>` +
      `<summary class="bw-cat-summary">` +
      `<span class="bw-cat-dot" style="background:${b.color}"></span>` +
      `<span class="bw-cat-name">${escapeHtml(b.label)}</span>` +
      `<span class="bw-cat-meta muted">${b.rows.length} exercise${b.rows.length === 1 ? "" : "s"}</span>` +
      groupFilterToggle(b.rows.map((r) => r.name)) +
      `</summary>` +
      sel +
      subs.map((s) => bucketHtml(s, true)).join("") +
      `</details>`
    );
  };

  // In Discipline mode the two MAIN disciplines (Strength, Calisthenics) sit at the
  // top level — Strength gets the muscle/function sub-grouping — and everything else
  // nests as sub-groups under one "Other" header, since it's less central.
  if (S.bwGroupMode === "discipline") {
    const major = buckets.filter((b) => MAJOR_DISCIPLINES.includes(b.key as Discipline));
    const minor = buckets.filter((b) => !MAJOR_DISCIPLINES.includes(b.key as Discipline));
    const otherNames = new Set(minor.flatMap((b) => b.rows.map((r) => r.name)));
    const otherBlock = minor.length
      ? `<details class="bw-cat bw-cat-other" data-cat="__other"${open("__other") ? " open" : ""}>` +
        `<summary class="bw-cat-summary">` +
        `<span class="bw-cat-dot" style="background:#9aa1ac"></span>` +
        `<span class="bw-cat-name">Other</span>` +
        `<span class="bw-cat-meta muted">${otherNames.size} exercise${otherNames.size === 1 ? "" : "s"} · ${minor.length} groups</span>` +
        groupFilterToggle([...otherNames]) +
        `</summary>` +
        minor.map((b) => bucketHtml(b, true)).join("") +
        `</details>`
      : "";
    const majorHtml = major.map((b) => (b.key === "Strength" ? strengthBucketHtml(b) : bucketHtml(b))).join("");
    els.bwGroups.innerHTML = majorHtml + otherBlock;
    return;
  }

  els.bwGroups.innerHTML = buckets.map((b) => bucketHtml(b)).join("");
}

/** The "Group by" picker above the Index exercise groups. */
function renderBwGroupBar(): void {
  const opts = INDEX_GROUP_MODES
    .map((m) => `<option value="${m.mode}"${m.mode === S.bwGroupMode ? " selected" : ""}>${escapeHtml(m.label)}</option>`)
    .join("");
  els.bwGroupBar.innerHTML =
    `<label class="as-label">Group by <select id="bwGroupBy" class="subtle-select">${opts}</select></label>`;
}

// ---- Edit athlete stats page ----
let statsEditUser = ""; // which athlete the editor is showing

/** Open the stats editor for one athlete (from the ✎ Edit button on the card). */
function openStatsEditor(username: string): void {
  statsEditUser = username;
  switchTopTab("statsedit");
}

/** Render the editable stats form for `statsEditUser` (defaults to the selected
 * athlete). Body-fat is five % inputs (95/50 band + average); a live nFFMI range
 * shows how the band propagates. */
function renderStatsEdit(): void {
  const users = rosterUsers();
  if (!statsEditUser || !users.some((u) => u.username === statsEditUser))
    statsEditUser = els.athlete.value || users[0]?.username || "";
  const username = statsEditUser;
  const p = athProfile(username);
  const dist = bfDistFor(username);
  const edited = !!athleteOverrides[username];
  const opt = (u: { username: string; user: string }) =>
    `<option value="${escapeHtml(u.username)}"${u.username === username ? " selected" : ""}>${escapeHtml(u.user)}</option>`;
  const num = (cls: string, label: string, value: number | null, step = "1", hint = "") =>
    `<label class="se-field"><span class="se-lbl">${label}</span>` +
    `<input class="${cls}" type="number" step="${step}" inputmode="decimal" value="${value ?? ""}" />` +
    (hint ? `<span class="se-hint muted">${hint}</span>` : "") + `</label>`;
  const bfPct = (v: number) => Math.round(v * 1000) / 10; // fraction → %
  const range = p ? nffmiRange(p.weight, p.height, dist) : null;
  const live = range
    ? `nFFMI <strong>${range.avg.toFixed(1)}</strong> <span class="muted">· 95% ${range.lo95.toFixed(1)}–${range.hi95.toFixed(1)} · 50% ${range.lo50.toFixed(1)}–${range.hi50.toFixed(1)}</span>`
    : `<span class="muted">Enter weight & height for nFFMI</span>`;

  // Admin-only "＋ Add athlete": create a user not in the scraped data.
  const addBtn = viewMode === "admin" ? `<button type="button" class="se-add settings-link">＋ Add athlete</button>` : "";
  els.statsEditBody.innerHTML =
    `<div class="se-pick-row"><label class="se-field se-pick"><span class="se-lbl">Athlete</span><select id="seAthlete">${users.map(opt).join("")}</select></label>${addBtn}</div>` +
    `<div class="se-grid">` +
    num("se-weight", "Weight (kg)", p?.weight ?? null, "0.5") +
    num("se-height", "Height (cm)", p?.height ?? null, "1") +
    num("se-age", "Age", p?.age ?? null, "1") +
    `<label class="se-field"><span class="se-lbl">Sex</span><select class="se-sex">` +
    `<option value="m"${p?.sex === "m" ? " selected" : ""}>Male</option>` +
    `<option value="f"${p?.sex === "f" ? " selected" : ""}>Female</option></select></label>` +
    `</div>` +
    `<div class="se-bf"><div class="se-bf-lead">Body fat % — a confidence band (low → high)</div><div class="se-bf-grid">` +
    num("se-bf-low95", "95% low", bfPct(dist.low95), "0.5") +
    num("se-bf-low50", "50% low", bfPct(dist.low50), "0.5") +
    // Average is auto-calculated (middle of the 95% band) — read-only, not editable.
    `<label class="se-field"><span class="se-lbl">average</span>` +
    `<output class="se-bf-avg-out" title="Auto-calculated — the middle of the 95% band">${Math.round((dist.low95 + dist.high95) / 2 * 1000) / 10}</output>` +
    `<span class="se-hint muted">auto</span></label>` +
    num("se-bf-high50", "50% high", bfPct(dist.high50), "0.5") +
    num("se-bf-high95", "95% high", bfPct(dist.high95), "0.5") +
    `</div></div>` +
    `<div class="se-live">${live}</div>` +
    `<div class="se-actions">` +
    `<button type="button" class="se-save">Save</button>` +
    `<button type="button" class="se-reset"${edited ? "" : " disabled"}>Reset to default</button>` +
    `<span class="se-msg muted">${edited ? "Edited on this device." : "Using the built-in defaults."}</span>` +
    `</div>`;
}

/** Read the form, store the override, refresh everything. */
function saveStatsEdit(): void {
  const username = statsEditUser;
  if (!username) return;
  const root = els.statsEditBody;
  const numOf = (cls: string): number | undefined => {
    const v = parseFloat(root.querySelector<HTMLInputElement>(`.${cls}`)?.value ?? "");
    return Number.isFinite(v) ? v : undefined;
  };
  const ageRaw = root.querySelector<HTMLInputElement>(".se-age")?.value ?? "";
  const ageVal = ageRaw.trim() === "" ? null : Math.round(parseFloat(ageRaw));
  const bf = (cls: string, fallback: number) => {
    const v = numOf(cls);
    return v === undefined ? fallback : v / 100; // % → fraction
  };
  const d = bfDistFor(username);
  const low95 = bf("se-bf-low95", d.low95);
  const high95 = bf("se-bf-high95", d.high95);
  const ov: AthleteStatsOverride = {
    age: ageVal,
    sex: (root.querySelector<HTMLSelectElement>(".se-sex")?.value as "m" | "f") ?? "m",
    bf: normalizeBodyFatDist({
      low95, low50: bf("se-bf-low50", d.low50),
      // Average is derived (middle of the 95% band), never typed.
      avg: (low95 + high95) / 2, high50: bf("se-bf-high50", d.high50), high95,
    }),
  };
  const w = numOf("se-weight"); if (w !== undefined) ov.weight = w;
  const h = numOf("se-height"); if (h !== undefined) ov.height = h;
  athleteOverrides[username] = ov;
  saveAthleteOverrides();
  renderStatsEdit();
  scheduleRender();
}

/** Rebuild every athlete-roster picker (#athlete + its chips, View-as, login) from
 * the current roster — used after a manual athlete is added. */
function rebuildAthleteRosters(select?: string): void {
  const users = rosterUsers();
  const keep = select ?? els.athlete.value;
  const opt = (u: { username: string; user: string }) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`;
  els.athlete.innerHTML = users.map(opt).join("");
  if (keep && users.some((u) => u.username === keep)) els.athlete.value = keep;
  buildAthleteChips();
  els.viewAsSelect.innerHTML =
    `<option value="admin">Admin — everything</option>${users.map(opt).join("")}<option value="loggedout">Logged out — Adomas only</option>`;
  populateLoginAthletes();
}

/** Admin "＋ Add athlete": add a user who isn't in the scraped StrengthLevel data,
 * so you can set their stats and hand-log sets. Saved on device + in the backup. */
function addManualAthlete(): void {
  const name = (window.prompt("New athlete's name:") ?? "").trim();
  if (!name) return;
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "user";
  const taken = new Set(rosterUsers().map((u) => u.username));
  let username = base, i = 2;
  while (taken.has(username)) username = `${base}_${i++}`;
  manualAthletes.push({ username, user: name });
  saveManualAthletes();
  rebuildAthleteRosters(username); // also sets els.athlete.value = username
  statsEditUser = username;
  renderAthlete();   // refresh the app for the (empty) new athlete
  renderStatsEdit(); // show their stats editor
}

function setupStatsEdit(): void {
  els.statsEditBody.addEventListener("change", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "seAthlete") { statsEditUser = (t as HTMLSelectElement).value; renderStatsEdit(); }
  });
  // Keep the auto-calculated average (middle of the 95% band) live as you type.
  els.statsEditBody.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (!t.classList.contains("se-bf-low95") && !t.classList.contains("se-bf-high95")) return;
    const root = els.statsEditBody;
    const out = root.querySelector<HTMLOutputElement>(".se-bf-avg-out");
    const lo = parseFloat(root.querySelector<HTMLInputElement>(".se-bf-low95")?.value ?? "");
    const hi = parseFloat(root.querySelector<HTMLInputElement>(".se-bf-high95")?.value ?? "");
    if (out && Number.isFinite(lo) && Number.isFinite(hi)) out.textContent = String(Math.round((lo + hi) / 2 * 10) / 10);
  });
  els.statsEditBody.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest(".se-add")) { addManualAthlete(); return; }
    if (t.closest(".se-save")) saveStatsEdit();
    else if (t.closest(".se-reset")) {
      delete athleteOverrides[statsEditUser];
      saveAthleteOverrides();
      renderStatsEdit();
      scheduleRender();
    }
  });
}

/** Expanded info panel for one exercise on the Index page: category / muscle /
 * tier, bodyweight part, merged spellings, total sets, who trains it, the best
 * estimated 1RM ever logged (any athlete) and the date span. */
/** The editable ×factor table for one difficulty family: every dimension's levels
 * with a number input. Shared by the per-exercise panel and the global editor. */
function familyFactorTableHtml(fam: string): string {
  if (!FAMILIES[fam]) return "";
  // One editable table for a dim (or a per-support lean table keyed "lean:<support>").
  const table = (dimKey: string, label: string): string => {
    const levels = famLevels(fam, dimKey);
    const cells = Object.keys(levels)
      .map((lvl) => {
        const ov = famFactorOverrides[fam]?.[dimKey]?.[lvl] !== undefined;
        return (
          `<label class="fac-cell${ov ? " is-ov" : ""}"><span class="fac-lvl">${escapeHtml(lvl)}</span>` +
          `<input class="fac-input" type="number" step="0.01" min="0.05" value="${levels[lvl]}" data-fac-fam="${escapeHtml(fam)}" data-fac-dim="${escapeHtml(dimKey)}" data-fac-lvl="${escapeHtml(lvl)}" aria-label="${escapeHtml(label)} ${escapeHtml(lvl)} multiplier" /></label>`
        );
      })
      .join("");
    return `<div class="fac-dim"><div class="fac-dim-h">${escapeHtml(label)}</div><div class="fac-cells">${cells}</div></div>`;
  };
  // Band is ONE knob (band-1 assistance); all 6 bands derive from it (assistance
  // doubles every 2 levels). Show the knob + a live preview of the resulting bands.
  const bandKnobTable = (): string => {
    const A = bandKnob(fam);
    const ov = famFactorOverrides[fam]?.["bandKnob"]?.["a"] !== undefined;
    return (
      `<div class="fac-dim"><div class="fac-dim-h">band assistance — kg (one knob)</div>` +
      `<div class="fac-cells"><label class="fac-cell${ov ? " is-ov" : ""}"><span class="fac-lvl">band-1 = kg</span>` +
      `<input class="fac-input" type="number" step="0.5" min="0.5" max="80" value="${A}" data-fac-fam="${escapeHtml(fam)}" data-fac-dim="bandKnob" data-fac-lvl="a" aria-label="band-1 assistance in kg" /></label></div>` +
      `<div class="ex-group-why muted">Bands assist in kg, SUBTRACTED from the load. All scale from this knob: kg doubles every 2 levels (2× a band = +2 levels). → <span class="band-knob-preview" data-fam="${escapeHtml(fam)}">${escapeHtml(bandPreviewText(fam))}</span></div></div>`
    );
  };
  // Lean is rendered once per wall support, since its effect differs (back- vs
  // front-to-wall); each starts from the shared base lean until tuned.
  const LEAN_SUPPORTS: [string, string][] = [["free", "lean — free"], ["back_to_wall", "lean — back to wall"], ["front_to_wall", "lean — front to wall"]];
  const dimTables = Object.keys(FAMILIES[fam]!.dims)
    .flatMap((dim) =>
      dim === "band" ? [bandKnobTable()] : dim === "lean" ? LEAN_SUPPORTS.map(([sup, lbl]) => table(`lean:${sup}`, lbl)) : [table(dim, dim)],
    )
    .join("");
  // Push-ups also carry an INCLINE (per-set height level) — its own global editor.
  return fam === "PUSHUP" ? dimTables + inclineLevelsEditorHtml() : dimTables;
}

/** The global INCLINE multiplier editor (push-ups): one editable cell per height —
 * squat-rack holes (SQ0–20), Smith notches (Sm0–9) and a few cm anchors. ×1 = floor
 * (hardest); higher = easier. Shared by every push-up, so SQ8 has ONE value. Each
 * row scrolls sideways (rule: dense, no wrapped block). Seeded from the cm-incline
 * formula; an edited cell is highlighted. */
function inclineLevelsEditorHtml(): string {
  const range = (a: number, b: number, step = 1): number[] => {
    const out: number[] = [];
    for (let i = a; i <= b; i += step) out.push(Math.round(i * 100) / 100);
    return out;
  };
  const row = (dim: LevelDim, label: string, values: number[]): string => {
    const cells = values
      .map((val) => {
        const ov = inclineKey(dim, val) in inclineScaleOverrides;
        const lbl = levelLabel(dim, val);
        return (
          `<label class="fac-cell inc-cell${ov ? " is-ov" : ""}"><span class="fac-lvl">${escapeHtml(lbl)}</span>` +
          `<input class="fac-input inc-input" type="number" step="0.01" min="0.05" max="3" value="${inclineScaleFor(dim, val)}" ` +
          `data-incdim="${dim}" data-incval="${val}" aria-label="${escapeHtml(lbl)} incline multiplier" /></label>`
        );
      })
      .join("");
    return `<div class="fac-dim"><div class="fac-dim-h">${escapeHtml(label)}</div><div class="fac-cells inc-cells">${cells}</div></div>`;
  };
  return (
    `<div class="fac-dim-h inc-hd">incline — × per hand height (×1 = floor, hardest; raised = easier)</div>` +
    `<div class="ex-group-why muted">Shared by every push-up (Smith / squat-rack / cm all line up on one scale). Edit any level; it applies everywhere.</div>` +
    row("sq", "squat-rack hole (SQ)", range(0, 20)) +
    row("smith", "Smith notch (Sm)", range(0, 9)) +
    row("cm", "raised height (cm)", range(0, 60, 10))
  );
}

/** "1=−5kg  2=−7.1kg  …  6=−28.3kg" — the kg the current knob produces per band. */
function bandPreviewText(fam: string): string {
  const keys = Object.keys(FAMILIES[fam]?.dims.band ?? {}).filter((k) => k !== "none");
  return keys.map((k) => `${k}=−${bandAssistKg(fam, k)}kg`).join("  ");
}

/** Editable difficulty-model factors for a family lift: every dimension's levels
 * with an editable ×factor input. Edits are shared across the whole family and
 * apply everywhere; clearing back to the default removes the override. */
function modelFactorsEditorHtml(name: string): string {
  const fam = familyOf(name);
  if (!fam || !FAMILIES[fam]) return "";
  return (
    `<details class="ex-group ex-model-fold"><summary class="ex-group-hd">⚙ Edit difficulty multipliers</summary>` +
    `<div class="ex-group-why muted">Re-tune any level's ×factor for the “${escapeHtml(fam)}” difficulty model. Changes apply to every set of this family everywhere on the site; set a value back to its default to clear the edit. (Also under Settings → ✎ Difficulty multipliers.)</div>` +
    familyFactorTableHtml(fam) +
    `</details>`
  );
}

/** Editable world record (per sex) for an exercise — a kg at a reference
 * bodyweight; scaled to each athlete's bodyweight for the "% of world record". */
function worldRecordEditorHtml(name: string): string {
  // The record scaled to the currently-selected athlete (their bodyweight).
  const prof = athProfile(els.athlete.value);
  const bw = prof?.weight ?? null;
  const row = (rowSex: "m" | "f", lbl: string) => {
    const explicit = worldRecordRef(name, rowSex);
    const ref = explicit ?? guessWorldRecord(name, rowSex); // guess fills an unset record
    const est = !explicit && !!ref;
    const inp = (field: "kg" | "bw", val: number | undefined, ph: string) =>
      `<label class="wr-field"><span class="wr-flbl">${field === "kg" ? "kg" : "@bw"}</span>` +
      `<input class="wr-input${est ? " is-guess" : ""}" type="number" step="1" min="0" inputmode="numeric" value="${val ?? ""}" data-wr-ex="${escapeHtml(name)}" data-wr-sex="${rowSex}" data-wr-f="${field}" placeholder="${ph}" /></label>`;
    const tag = est ? `<span class="wr-est" title="Estimated from your logged bests — edit either box to lock in your own value">≈est</span>` : "";
    // Show the calculation: this record scaled to the current athlete's bodyweight.
    const scaled = worldRecordKg(name, rowSex, bw);
    const calc = scaled != null && bw != null
      ? `<span class="wr-calc" title="This ${lbl.toLowerCase()} record scaled to ${escapeHtml(athleteLabel())}'s ${fmt(bw)} kg bodyweight">→ <b>${fmt(scaled)}</b> kg @ ${fmt(bw)}</span>`
      : "";
    return `<div class="wr-row"><span class="wr-sex">${lbl}</span>${inp("kg", ref?.kg, "kg")}${inp("bw", ref?.bw, "bw")}${tag}${calc}</div>`;
  };
  return (
    `<details class="ex-group ex-model-fold wr-editor"><summary class="ex-group-hd">🏆 World record</summary>` +
    `<div class="ex-group-why muted">Natty record — total 1RM (bodyweight + plate), per sex, with the bodyweight it was set at. Scaled to each athlete's bodyweight (the gold “→” value). <b>No value set?</b> We estimate one from your logged bests (faint, “≈est”) so the “% of world record” still works — edit either box to lock in your own.</div>` +
    row("m", "Men") + row("f", "Women") +
    `</details>`
  );
}

/** The global "Difficulty multipliers" overlay: every family's editable factors. */
function renderModelEditor(): void {
  els.modelEditor.innerHTML = Object.keys(FAMILIES)
    .map((fam) => `<details class="model-fam ex-model-fold" open><summary class="ex-group-hd">“${escapeHtml(fam)}” model</summary>${familyFactorTableHtml(fam)}</details>`)
    .join("");
}
function openModelEditor(): void {
  renderModelEditor();
  els.modelPage.hidden = false;
}

function exerciseInfoHtml(name: string): string {
  const formula = currentFormula();
  const recs = computedRecords().filter((r) => r.exerciseName === name);
  const coeff = coeffFor(name);
  // A user-created merge (this lift combines several exercises) vs auto spelling-merges.
  const userMergeDef = userExerciseDefs.find((d) => d.name === name && d.identity === "combined");
  const spellingVariants = mergeVariantsFor(name);

  const athletes = new Map<string, string>();
  let first = "", last = "", setCount = 0;
  let best: { e1rm: number; who: string; date: string; w: number | null; reps: number } | null = null;
  for (const r of recs) {
    setCount++;
    if (r.username) athletes.set(r.username, r.user || r.username);
    if (r.date) { if (!first || r.date < first) first = r.date; if (!last || r.date > last) last = r.date; }
    const e = addedWeight1RM(r, formula);
    if (e !== null && (!best || e > best.e1rm))
      best = { e1rm: e, who: r.user || r.username, date: r.date, w: r.weight, reps: r.reps ?? 0 };
  }
  const item = (label: string, value: string) =>
    `<div class="ex-info-item"><span class="ex-info-lbl">${escapeHtml(label)}</span><span class="ex-info-val">${value}</span></div>`;

  // Editable controls, folded straight into the info rows — there is no separate
  // "Edit this exercise" section, every value here that CAN be changed is its own
  // input/select (same classes + data-editex the change handlers already key off).
  const code = codeFor(name), short = shortFor(name);
  const codeInput = `<input class="ex-edit-code" type="text" maxlength="12" spellcheck="false" autocomplete="off" value="${escapeHtml(code)}" data-editex="${escapeHtml(name)}" aria-label="Code for ${escapeHtml(name)}" />`;
  const shortInput = `<input class="ex-edit-short" type="text" maxlength="40" spellcheck="false" autocomplete="off" value="${escapeHtml(short)}" data-editex="${escapeHtml(name)}" aria-label="Short name for ${escapeHtml(name)}" />`;
  // Discipline / Muscle group / Tier are MULTI-select: a lift can fit several at
  // once, so each is a row of toggle chips (tap to add/remove), highlighted =
  // selected. The ↺ chip clears the override back to the automatic guess.
  const metaChips = (kind: MetaKind, all: readonly string[], labelOf: (v: string) => string, sel: readonly string[]) =>
    `<span class="ex-meta-chips">` +
    all.map((v) => `<button type="button" class="ex-meta-chip${sel.includes(v) ? " is-on" : ""}" data-meta-ex="${escapeHtml(name)}" data-meta-kind="${kind}" data-meta-val="${escapeHtml(v)}">${escapeHtml(labelOf(v))}</button>`).join("") +
    (metaSet(kind, name) ? `<button type="button" class="ex-meta-reset" data-meta-ex="${escapeHtml(name)}" data-meta-kind="${kind}" data-meta-val="auto" title="Reset to the automatic guess">↺</button>` : "") +
    `</span>`;
  const discChips = metaChips("disc", DISCIPLINES, (v) => v, discsFor(name));
  // Muscle group is now a per-muscle INVOLVEMENT LEVEL 0–4 (cycling pill, rule 15):
  // 0 none · 1 tendons · 2 maintain · 3 counts as exercise (shown in that category) ·
  // 4 top exercise. Level ≥ 3 = the lift appears under that muscle's category.
  const mgLevelHint = "0 none · 1 tendons · 2 maintain · 3 counts (shown here) · 4 top";
  const mgChips =
    `<span class="ex-meta-chips">` +
    MUSCLE_GROUPS.map((m) => {
      const lv = mgLevelOf(name, m);
      const cls = lv >= 3 ? " is-on" : lv > 0 ? " is-partial" : "";
      return `<button type="button" class="ex-meta-chip ex-mglvl-chip${cls}${lv === 4 ? " is-top" : ""}" data-mglvl-ex="${escapeHtml(name)}" data-mglvl-muscle="${escapeHtml(m)}" aria-label="${escapeHtml(m)} involvement level ${lv}" title="${escapeHtml(m)} — tap to cycle: ${mgLevelHint}. Now: ${lv}">${escapeHtml(m)}${lv ? `<span class="ex-mglvl-n">${lv}</span>` : ""}</button>`;
    }).join("") +
    (metaOverrides.mgLevel?.[name] ? `<button type="button" class="ex-meta-reset ex-mglvl-reset" data-mglvl-ex="${escapeHtml(name)}" title="Reset muscle levels to the automatic guess">↺</button>` : "") +
    `</span>`;
  const tierChips = metaChips("tier", ["main", "second", "third"], (v) => TIER_LABELS[v as ExerciseTier], tiersFor(name));
  // Combinable / Comparable membership chips — tap to add/remove this lift from a
  // group (comparable also gets a ratio input when it's an owner-added member).
  const groupChips = (all: RegistryTag[], kind: "combine" | "compare") => {
    const memberIds = new Set((kind === "combine" ? combinableGroupsForEx(name) : comparableGroupsForEx(name)).map((g) => g.id));
    return (
      `<span class="ex-meta-chips">` +
      all.map((g) => {
        const on = memberIds.has(g.id);
        const added = groupMemberOverrides[g.id]?.add?.[name];
        const ratio = on && kind === "compare" && added !== undefined
          ? `<input class="ex-grp-ratio" type="number" step="0.05" min="0.05" max="2" value="${added}" data-grpratio-id="${escapeHtml(g.id)}" data-grpratio-ex="${escapeHtml(name)}" title="Ratio vs the reference lift" />`
          : "";
        return `<button type="button" class="ex-meta-chip${on ? " is-on" : ""}" data-grp-id="${escapeHtml(g.id)}" data-grp-ex="${escapeHtml(name)}">${escapeHtml(g.label)}</button>${ratio}`;
      }).join("") +
      (all.length ? "" : `<span class="muted">none</span>`) +
      `</span>`
    );
  };
  const combineChips = groupChips(COMBINABLE_GROUPS, "combine");
  const compareChips = groupChips(COMPARABLE_GROUPS, "compare");
  // Per-group DISPLAY mode for any merge/compare group this lift is part of (as a
  // member OR as the synthetic itself): a cycling pill Combined → Members → Both.
  const groupsOfName = [...effectiveCombinableGroups(), ...effectiveComparableGroups()]
    .filter((g) => (g.derivedName ?? g.label) === name || (g.members ?? []).some((m) => m.exerciseName === name));
  const DISPLAY_LABEL: Record<GroupDisplay, string> = { combined: "Combined only", members: "Members only", both: "Show both" };
  const displayChips = groupsOfName.length
    ? `<span class="ex-meta-chips">` + groupsOfName.map((g) => {
        const lbl = `${escapeHtml(g.derivedName ?? g.label)}: ${DISPLAY_LABEL[groupDisplayFor(g.id)]}`;
        return `<button type="button" class="ex-meta-chip is-on wa-grpdisp" data-grpdisp-id="${escapeHtml(g.id)}" data-grpdisp-ex="${escapeHtml(name)}" title="What shows in the picker for this group — tap to cycle Combined only → Members only → Show both">${lbl}</button>`;
      }).join("") + `</span>`
    : "";
  // Bodyweight part is a RANGE (min–max); the 1RM uses the average (shown in gold).
  const cr = coeffRangeFor(name);
  const coeffInput =
    `<span class="ex-coeff-range">` +
    `<input class="ex-edit-coeff-min" type="number" step="0.05" min="0" max="2" value="${cr.min}" data-editex="${escapeHtml(name)}" aria-label="Bodyweight part min for ${escapeHtml(name)}" />` +
    `<span class="ex-coeff-dash">–</span>` +
    `<input class="ex-edit-coeff-max" type="number" step="0.05" min="0" max="2" value="${cr.max}" data-editex="${escapeHtml(name)}" aria-label="Bodyweight part max for ${escapeHtml(name)}" />` +
    `<span class="ex-coeff-avg" title="Average of the range — this is what the 1RM uses">avg ${coeff}</span>` +
    `</span>`;

  const rows = [
    item("Code", codeInput),
    item("Short name", shortInput),
    item("Discipline", discChips),
    item("Muscle group", mgChips),
    item("Tier", tierChips),
    item("Combinable", combineChips),
    item("Comparable", compareChips),
    displayChips ? item("Show in picker", displayChips) : "",
    item("Bodyweight part", coeffInput),
    item("Total sets", setCount.toLocaleString()),
    item("Athletes", `${athletes.size} — ${escapeHtml([...athletes.values()].join(", ")) || "—"}`),
    best
      ? item("Best 1RM (anyone)", `${fmt(best.e1rm)} kg <span class="muted">(${escapeHtml(best.who)} · ${best.w === null ? "—" : fmt(best.w)}×${best.reps} · ${shortDate(best.date)})</span>`)
      : item("Best 1RM (anyone)", "—"),
    first && last ? item("Logged", `${shortDate(first)} → ${shortDate(last)}`) : "",
    // Always state merge status explicitly, so a standalone lift is confirmed as
    // such (not just silently lacking an "also logged as" line). A user-created
    // merge, an auto spelling-merge, and a plain standalone all read clearly.
    item(
      "Sources",
      userMergeDef?.members?.length
        ? `<strong>Merged lift</strong> — combines ${userMergeDef.members.length} exercises into one (see below to separate/dissolve)`
        : spellingVariants.length
          ? `<strong>Merged</strong> from ${spellingVariants.length + 1} spellings: ${escapeHtml([name, ...spellingVariants].join(", "))}`
          : `Standalone — logged under one name only`,
    ),
  ].join("");

  // Combinable / comparable group membership, with members present in the data
  // and the plain-language WHY behind the grouping.
  const presentNames = distinctExercises(data.records);
  const groups = [...combinableGroupsForEx(name), ...comparableGroupsForEx(name)];
  const groupHtml = groups
    .map((g) => {
      const members = membersOfGroup(g, presentNames);
      const memberList = members
        .map((m) => `${escapeHtml(m.exerciseName)}${m.ratio !== 1 ? ` <span class="muted">×${m.ratio}</span>` : ""}`)
        .join(", ");
      const kindNote = g.kind === "combinable-group" ? "merged 1:1 into one lift" : "scaled onto one curve";
      return (
        `<div class="ex-group"><div class="ex-group-hd">${escapeHtml(g.label)} ` +
        `<span class="muted">— ${kindNote}</span></div>` +
        `<div class="ex-group-why muted">${escapeHtml(g.why)}</div>` +
        `<div class="ex-group-members">Members: ${memberList || "—"}</div></div>`
      );
    })
    .join("");

  // User-merge controls: list the merged-in exercises, each with a "Separate"
  // (pull it back out) button, plus "Dissolve" to un-merge them all at once.
  const mergePanel = userMergeDef?.members?.length
    ? `<div class="ex-group ex-merge"><div class="ex-group-hd">Merged lift — separate or dissolve</div>` +
      `<div class="ex-group-why muted">This lift combines the exercises below into one across every view (leaderboard, graph, calendar, PRs). Separate one to pull it back out, or dissolve to un-merge them all. The original lifts are never changed.</div>` +
      `<div class="ex-merge-members">` +
      userMergeDef.members
        .map(
          (m) =>
            `<span class="ex-merge-chip">${escapeHtml(m)} <button type="button" class="ex-merge-sep" data-sepmerge="${escapeHtml(name)}" data-sepmember="${escapeHtml(m)}" title="Separate ${escapeHtml(m)} back out">✕</button></span>`,
        )
        .join("") +
      `</div>` +
      `<button type="button" class="ex-merge-dissolve" data-dissolvemerge="${escapeHtml(name)}">↺ Dissolve — un-merge all</button>` +
      `</div>`
    : "";

  // Active-set status + per-exercise force-in / force-out overrides.
  const incl = activeInclude.has(name);
  const excl = activeExclude.has(name);
  const statusTxt = !activeSet
    ? "Filter off — shown everywhere"
    : activeSet.has(name)
      ? "Active — shown app-wide"
      : "Hidden by the active-set filter";
  const statusCls = activeSet && !activeSet.has(name) ? "is-hidden" : "is-on";
  const activeHtml =
    `<div class="ex-active">` +
    `<span class="ex-active-status ${statusCls}">${statusTxt}</span>` +
    `<button type="button" class="ex-force${incl ? " is-on" : ""}" data-asinclude="${escapeHtml(name)}">${incl ? "✓ Always show" : "Always show"}</button>` +
    `<button type="button" class="ex-force${excl ? " is-off" : ""}" data-asexclude="${escapeHtml(name)}">${excl ? "✓ Always hide" : "Always hide"}</button>` +
    `</div>`;

  return `<div class="ex-info">${rows}<p class="muted ex-edit-help">Blue = editable, gold = calculated. Clear a box to reset. Saved on this device.</p>${mergePanel}${groupHtml}${modelFactorsEditorHtml(name)}${worldRecordEditorHtml(name)}${variationsEditorHtml(name, recs)}${taxonomyEditorHtml(name)}${graphPermsHtml(name)}${activeHtml}</div>`;
}

/** Review panel: which graph metrics this exercise is ALLOWED to plot. Default is
 * everything off (blocked) — the owner switches on the graphs that actually work
 * for this lift. Shown inside More info (both the Index inspector and the ℹ
 * overlay), and is where the graph's "needs review" button lands. */
function graphPermsHtml(name: string): string {
  // Each metric is a CYCLING toggle: tap to advance no → 1 → 2 → 3 → no.
  // 1 = experimental, 2 = confirmed (may change), 3 = certain. Any level ≥ 1
  // draws the graph; the number records confidence.
  const SHORT: Record<GraphLevel, string> = { 0: "", 1: "1", 2: "2", 3: "3" };
  const chips = GRAPH_METRICS.map((m) => {
    const lvl = levelOf(graphPerms, name, m.id);
    const badge = lvl > 0 ? `<span class="gp-lvl">${SHORT[lvl]}</span>` : "";
    return (
      `<button type="button" class="gp-chip gp-l${lvl}${lvl > 0 ? " is-on" : ""}" ` +
      `data-graphperm-ex="${escapeHtml(name)}" data-graphperm-id="${escapeHtml(m.id)}" ` +
      `aria-pressed="${lvl > 0}" title="${escapeHtml(m.label)} — ${GRAPH_LEVEL_LABEL[lvl]} (tap to cycle)">${escapeHtml(m.label)}${badge}</button>`
    );
  }).join("");
  const count = allowedMetricsFor(graphPerms, name).size;
  // The bulk button is itself a CYCLING toggle: each tap moves EVERY graph up one
  // level together (no → experimental → confirmed → certain → no), driven off the
  // lowest current level — so it scrolls all the graphs through the levels at once.
  const minLvl = Math.min(...GRAPH_METRICS.map((m) => levelOf(graphPerms, name, m.id))) as GraphLevel;
  const nextLvl = ((minLvl + 1) % (MAX_GRAPH_LEVEL + 1)) as GraphLevel;
  const nextLabel = nextLvl === 0 ? "off" : GRAPH_LEVEL_LABEL[nextLvl];
  return (
    `<div class="ex-graphperms" id="graphPerms-${escapeHtml(name)}">` +
    `<div class="ex-gp-head"><span class="ex-info-lbl">Allowed graphs</span>` +
    `<span class="muted ex-gp-count">${count} of ${GRAPH_METRICS.length} on</span></div>` +
    `<p class="ex-gp-hint muted">Tap to cycle: no → 1 experimental → 2 confirmed → 3 certain. Any level ≥ 1 shows the graph for this lift.</p>` +
    `<div class="ex-gp-chips">${chips}</div>` +
    `<div class="ex-gp-actions">` +
    `<button type="button" class="settings-link gp-bulk" data-graphperm-cycle="${escapeHtml(name)}" title="Move every graph up one level together (no → experimental → confirmed → certain → no)">All → ${escapeHtml(nextLabel)}</button>` +
    `<button type="button" class="settings-link gp-bulk" data-graphperm-none="${escapeHtml(name)}">Block all</button>` +
    `</div></div>`
  );
}

/** The modifier picker for one note: a row of clickable level chips per dimension
 * (model lifts) that multiply to a final ×, or a single × number input (no model).
 * Reused by the More-info editor AND the floating set-row editor, so the same
 * `.ex-var-lvl` / `.ex-var-input` handlers drive both. */
/** Chips vs Pose for the modifier editor (model lifts with a posable figure). */
let noteEditMode: "chips" | "stickman" | "photo" | "pose" = "chips";
/** A family is "posable" when it has the dimensions the stick-figure maps to. */
function familyPosable(fam: string | null): boolean {
  return !!fam && ["rom", "lean", "support"].every((d) => FAMILIES[fam]!.dims[d]);
}

function notePickerHtml(name: string, note: string, extraFactor = 1): string {
  const fam = familyOf(name);
  if (!fam) {
    const scale = variationScaleFor(name, note);
    return (
      `<div class="ex-var-picker"><label class="ex-var-lbl">× ` +
      `<input class="ex-var-input" type="number" step="0.05" min="0.1" max="5" value="${scale}" data-var-ex="${escapeHtml(name)}" data-var-note="${escapeHtml(note)}" aria-label="Difficulty for ${escapeHtml(note)}" /></label></div>`
    );
  }
  // Chips / Stickman / 3D model toggle for posable lifts: three ways to set the
  // same attributes. Chips = tap; Stickman = drag the 2-D figure; 3D model is a
  // placeholder while a separate build creates the rotatable 3-D handstand.
  const toggle = familyPosable(fam)
    ? `<div class="ex-var-mode"><button type="button" class="ex-var-mode-btn${noteEditMode === "chips" ? " is-on" : ""}" data-notemode="chips">Chips</button>` +
      `<button type="button" class="ex-var-mode-btn${noteEditMode === "stickman" ? " is-on" : ""}" data-notemode="stickman">🧍 Stickman</button>` +
      `<button type="button" class="ex-var-mode-btn${noteEditMode === "photo" ? " is-on" : ""}" data-notemode="photo">📷 Photo</button>` +
      `<button type="button" class="ex-var-mode-btn${noteEditMode === "pose" ? " is-on" : ""}" data-notemode="pose">🧊 3D model</button></div>`
    : "";
  if (familyPosable(fam) && noteEditMode === "stickman") return toggle + noteStickmanHtml(name, note);
  if (familyPosable(fam) && noteEditMode === "photo") return toggle + notePhotoHtml(name, note);
  if (familyPosable(fam) && noteEditMode === "pose") return toggle + notePoseHtml(name, note);
  const override = noteVecOverride(name, note);
  const effVec = { ...rNote(fam, note).vec, ...override };
  const scale = scalarFromVec(fam, effVec);
  // SUPPORT is a nested dropdown: a primary picker (free / f2w / b2w / ladder), and
  // when "ladder" is chosen, two sub-dropdowns appear — a leg grip and a rung
  // height — each its own multiplier. The grip/height dims are rendered here (not
  // as their own chip rows). Other dimensions stay as chip rows.
  const SUPPORT_LBL: Record<string, string> = { free: "free", front_to_wall: "f2w", back_to_wall: "b2w", ladder: "ladder" };
  const GRIP_LBL: Record<string, string> = { none: "no grip", lsit: "l-sit", hooked: "hooked" };
  const HT_LBL: Record<string, string> = { none: "any height", lad3: "lad3", lad5: "lad5", lad6: "lad6", lad9: "lad9" };
  // A custom floating CSS/HTML dropdown (the app's .xdd pattern) — NEVER a native
  // <select>. The button shows the current level; the floating menu lists options.
  const vecSelect = (dim: string, labelMap: Record<string, string>): string => {
    const levels = famLevels(fam, dim);
    const cur = String(effVec[dim] ?? "");
    const curLbl = `${labelMap[cur] ?? cur} ×${levels[cur] ?? 1}`;
    const opts = Object.keys(levels)
      .map((l) => {
        const on = l === cur;
        return `<button type="button" class="xdd-opt ex-vecopt${on ? " is-active" : ""}" role="option" data-vecdim-ex="${escapeHtml(name)}" data-vecdim-note="${escapeHtml(note)}" data-vecdim-dim="${escapeHtml(dim)}" data-vecdim-level="${escapeHtml(l)}">${escapeHtml(labelMap[l] ?? l)} ×${levels[l]}${on ? ' <span class="xdd-check">✓</span>' : ""}</button>`;
      })
      .join("");
    return (
      `<div class="xdd ex-var-xdd" data-vecdd-dim="${escapeHtml(dim)}">` +
      `<button type="button" class="xdd-btn ex-vecbtn" aria-label="${escapeHtml(dim)}">${escapeHtml(curLbl)}<span class="xdd-caret">▾</span></button>` +
      `<div class="xdd-menu" hidden role="listbox">${opts}</div></div>`
    );
  };
  const isLadder = (effVec.support ?? "free") === "ladder";
  const supPicked = override.support !== undefined || override.ladderGrip !== undefined || override.ladderH !== undefined;
  const supportBlock =
    `<div class="ex-var-dim${supPicked ? " is-picked" : ""}"><span class="ex-var-dim-lbl">support</span>` +
    `<div class="ex-var-selrow">${vecSelect("support", SUPPORT_LBL)}` +
    (isLadder ? vecSelect("ladderGrip", GRIP_LBL) + vecSelect("ladderH", HT_LBL) : "") +
    `</div></div>`;
  // ROM (depth, ↓) × LEAN (forward, →) are two directions of one body position, set
  // with a VERTICAL depth slider + a HORIZONTAL lean slider (each step = a defined
  // level, so it scales to many levels without a giant grid). The multiplier is the
  // formula depthFactor × leanFactor, recomputed live from the two slider positions.
  const romDims = famLevels(fam, "rom"), leanDims = famLevels(fam, "lean");
  const hasGrid = Object.keys(romDims).length > 0 && Object.keys(leanDims).length > 0;
  const romLeanGrid = (): string => {
    // The pad is a side-view scene. y: TOP = higher/easier (raised block, head only
    // dips to the corner), BOTTOM = deeper/harder. The fill grows UP FROM THE FLOOR
    // (bottom) to the handle — a taller fill = a higher block = easier. lean is
    // REVERSED: rightmost = no lean (less). The wall + ladder ALWAYS sit on the
    // left — front-to-wall vs back-to-wall is shown by WHERE you drag (the lean),
    // not by flipping the scene — so the pad never mirrors.
    const romKeys = Object.keys(romDims!), leanKeys = Object.keys(leanDims!);
    const romIdx = Math.max(0, romKeys.indexOf(String(effVec.rom)));
    const support = String(effVec.support ?? "free");
    // FREE handstands have no wall to lean toward → no lean, only vertical depth.
    const noLean = false; // lean now applies to every support (default 0 = no extra lean)
    const leanIdx = noLean ? 0 : Math.max(0, leanKeys.indexOf(String(effVec.lean)));
    const picked = override.rom !== undefined || (!noLean && override.lean !== undefined);
    const rk = romKeys[romIdx]!, lk = leanKeys[leanIdx]!;
    const romF = romDims![rk]!, leanF = noLean ? 1 : leanFactorFor(fam, support, lk);
    const mult = Math.round(romF * leanF * 100) / 100;
    const leanFrac = !noLean && leanKeys.length > 1 ? leanIdx / (leanKeys.length - 1) : 0;
    const depthTop = romKeys.length > 1 ? romIdx / (romKeys.length - 1) : 0; // 0 top(easy)..1 bottom(hard)
    const dotLeft = noLean ? 50 : (1 - leanFrac) * 100; // rightmost = no lean (wall is on the left)
    const dotTop = depthTop * 100;
    const fillH = 100 - dotTop; // bottom-anchored, up to the handle
    const fillW = noLean ? 100 : dotLeft; // free: full width (depth only)
    const fillSide = `left:0`;
    // Reference line where depth = 0 cm (the ×1 neutral — hands at floor height).
    const zeroIdx = romKeys.findIndex((k) => Math.abs((romDims![k] ?? 1) - 1) < 1e-9);
    const zeroTop = zeroIdx >= 0 && romKeys.length > 1 ? (zeroIdx / (romKeys.length - 1)) * 100 : null;
    // Free locks lean to the no-lean level so x-drags can't change it.
    const dataLeanKeys = noLean ? [leanKeys[0] ?? ""] : leanKeys;
    const pd =
      `data-padex="${escapeHtml(name)}" data-padnote="${escapeHtml(note)}" data-mirror="0" data-support="${escapeHtml(support)}"${noLean ? ` data-nolean="1"` : ""} ` +
      `data-romkeys="${escapeHtml(romKeys.join("|"))}" data-leankeys="${escapeHtml(dataLeanKeys.join("|"))}"`;
    const readout = noLean
      ? `depth <b class="ex-sl-rf">×${romF}</b> = <b class="ex-sl-mult">×${mult}</b> <span class="muted">(<span class="ex-sl-rk">${escapeHtml(rk)}</span>)</span>`
      : `lean <b class="ex-sl-lf">×${leanF}</b> × depth <b class="ex-sl-rf">×${romF}</b> = <b class="ex-sl-mult">×${mult}</b> <span class="muted">(<span class="ex-sl-lk">${escapeHtml(lk)}</span> · <span class="ex-sl-rk">${escapeHtml(rk)}</span>)</span>`;
    return (
      `<div class="ex-var-dim ex-pad-dim${picked ? " is-picked" : ""}${noLean ? " ex-pad-nolean" : ""}"><span class="ex-var-dim-lbl">${noLean ? "depth (free — no lean)" : "depth × lean"}</span>` +
      `<div class="ex-pad-readout">${readout}</div>` +
      `<div class="ex-pad" ${pd}>` +
      padSceneSvg(support) +
      (zeroTop !== null ? `<div class="ex-pad-zero" style="top:${zeroTop.toFixed(1)}%"><span class="ex-pad-zero-lbl">0cm</span></div>` : "") +
      `<div class="ex-pad-fill" style="${fillSide};bottom:0;width:${fillW.toFixed(1)}%;height:${fillH.toFixed(1)}%"></div>` +
      `<div class="ex-pad-dot" style="left:${dotLeft.toFixed(1)}%;top:${dotTop.toFixed(1)}%"></div>` +
      `<span class="ex-pad-ylbl ex-pad-yt muted">↑ easier</span>` +
      `<span class="ex-pad-ylbl ex-pad-yb muted">↓ harder</span>` +
      (noLean ? "" : `<span class="ex-pad-xlbl muted">lean ←</span>`) +
      `</div></div>`
    );
  };
  const dims = Object.keys(FAMILIES[fam]!.dims)
    // ladderGrip/ladderH live in the support block; lean is folded into the rom grid.
    .filter((dim) => dim !== "ladderGrip" && dim !== "ladderH" && !(hasGrid && dim === "lean"))
    .map((dim) => {
      if (dim === "support") return supportBlock;
      if (dim === "rom" && hasGrid) return romLeanGrid();
      const levels = famLevels(fam, dim)!;
      const cur = effVec[dim];
      const picked = override[dim] !== undefined;
      // Band assists in kg (subtracted), so its chips read "−Xkg"; other dims are ×factors.
      const facLabel = (l: string) => (dim === "band" ? (l === "none" ? "0kg" : `−${bandAssistKg(fam, l)}kg`) : `×${levels[l]}`);
      const chips = Object.keys(levels)
        .map(
          (l) =>
            `<button type="button" class="ex-var-lvl${l === cur ? " is-on" : ""}" data-vecdim-ex="${escapeHtml(name)}" data-vecdim-note="${escapeHtml(note)}" data-vecdim-dim="${escapeHtml(dim)}" data-vecdim-level="${escapeHtml(l)}" aria-pressed="${l === cur}">${escapeHtml(l)} <span class="ex-var-lvl-f">${facLabel(l)}</span></button>`,
        )
        .join("");
      return `<div class="ex-var-dim${picked ? " is-picked" : ""}"><span class="ex-var-dim-lbl">${escapeHtml(dim)}</span><div class="ex-var-dim-chips">${chips}</div></div>`;
    })
    .join("");
  // The "final multiplier" folds in any extra factor (the per-set incline level shown
  // above the picker in the popover), so it's the TRUE combined ×, not just the family.
  const finalMult = Math.round(scale * extraFactor * 1e6) / 1e6;
  return `${toggle}<div class="ex-var-picker">${dims}<div class="ex-var-product">= <strong>×${finalMult}</strong> <span class="muted">final multiplier</span></div></div>`;
}

/** A little side-view scene for the depth × lean pad: the floor and the wall —
 * ALWAYS on the LEFT (for back-to-wall, front-to-wall and ladder alike), with
 * rungs drawn for a ladder. Crisp boundaries (rigid look). */
function padSceneSvg(support: string): string {
  const hasWall = support !== "free";
  const isLadder = support === "ladder";
  const wx = 2; // wall rect x (width 8) — wall + ladder always on the left
  const floor = `<line x1="0" y1="97" x2="100" y2="97" class="pad-floor" />`;
  const wall = hasWall ? `<rect x="${wx}" y="2" width="8" height="95" class="pad-wall" />` : "";
  const rungs = isLadder
    ? [16, 31, 46, 61, 76].map((y) => `<line x1="${wx}" y1="${y}" x2="${wx + 8}" y2="${y}" class="pad-rung" />`).join("")
    : "";
  return `<svg class="ex-pad-scene" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${floor}${wall}${rungs}</svg>`;
}

// ---- Visual "pose" editor: a 3-D handstand mannequin (three.js) you orbit ----
const SUPPORT_LBL: Record<string, string> = {
  free: "free",
  back_to_wall: "back to wall",
  front_to_wall: "front to wall",
  ladder: "ladder",
  lsit: "L-sit",
  tucked: "tucked",
  hooked: "hooked",
  lad3: "ladder 3",
  lad5: "ladder 5",
  lad6: "ladder 6",
  lad9: "ladder 9",
};
/** The pose editor: a 3-D figure (mounted after render by refreshPose3d) plus
 * tap-to-pose control rows for the visual dimensions, and the live multiplier. */
function notePoseHtml(name: string, note: string): string {
  const fam = familyOf(name)!;
  const effVec = { ...rNote(fam, note).vec, ...noteVecOverride(name, note) };
  const scale = scalarFromVec(fam, effVec);
  const ctlRow = (dim: string): string => {
    const levels = famLevels(fam, dim);
    if (!levels) return "";
    const cur = effVec[dim];
    const chips = Object.keys(levels)
      .map((l) => {
        const lbl = dim === "support" ? SUPPORT_LBL[l] ?? l : l;
        return `<button type="button" class="pose-ctl${l === cur ? " is-on" : ""}" data-posectl-ex="${escapeHtml(name)}" data-posectl-note="${escapeHtml(note)}" data-posectl-dim="${escapeHtml(dim)}" data-posectl-level="${escapeHtml(l)}">${escapeHtml(lbl)} <span class="ex-var-lvl-f">×${levels[l]}</span></button>`;
      })
      .join("");
    return `<div class="ex-var-dim"><span class="ex-var-dim-lbl">${escapeHtml(dim)}</span><div class="ex-var-dim-chips">${chips}</div></div>`;
  };
  return (
    `<div class="ex-var-pose">` +
    `<div class="pose3d" data-poseex="${escapeHtml(name)}" data-posenote="${escapeHtml(note)}"></div>` +
    `<div class="pose-hint muted">Drag to rotate. Muscle groups are marked (the worked ones — shoulders &amp; triceps — in blue). Pick options below to pose it.</div>` +
    ctlRow("support") +
    ctlRow("rom") +
    ctlRow("lean") +
    `<div class="ex-var-product">= <strong>×${scale}</strong> <span class="muted">final multiplier</span></div>` +
    `</div>`
  );
}
/** The 2-D "stickman" view: now an ANIMATED, drawn side-view athlete (mounted
 * after render by refreshDrawn) that loops the rep — elbows bend/extend, the body
 * leans, the hands sit on the block — plus the same tap-to-pick control rows. */
function noteStickmanHtml(name: string, note: string): string {
  const fam = familyOf(name)!;
  const effVec = { ...rNote(fam, note).vec, ...noteVecOverride(name, note) };
  const scale = scalarFromVec(fam, effVec);
  const ctl = (dim: string): string => {
    const levels = famLevels(fam, dim);
    if (!levels) return "";
    const cur = effVec[dim];
    const chips = Object.keys(levels)
      .map((l) => {
        const lbl = dim === "support" ? SUPPORT_LBL[l] ?? l : l;
        return `<button type="button" class="pose-ctl${l === cur ? " is-on" : ""}" data-posectl-ex="${escapeHtml(name)}" data-posectl-note="${escapeHtml(note)}" data-posectl-dim="${escapeHtml(dim)}" data-posectl-level="${escapeHtml(l)}">${escapeHtml(lbl)} <span class="ex-var-lvl-f">×${levels[l]}</span></button>`;
      })
      .join("");
    return `<div class="ex-var-dim"><span class="ex-var-dim-lbl">${escapeHtml(dim)}</span><div class="ex-var-dim-chips">${chips}</div></div>`;
  };
  // Scrub slider: drag to "play" the figure down through the rep — where you stop
  // sets the depth (range of motion). Left = shallow (top), right = deepest.
  const romKeys = Object.keys(FAMILIES[fam]!.dims.rom ?? {});
  const curIdx = Math.max(0, romKeys.indexOf(String(effVec.rom)));
  const scrubLbl = romKeys.length ? String(effVec.rom ?? romKeys[curIdx]) : "";
  const scrub = romKeys.length > 1
    ? `<div class="pose-scrub-row"><span class="pose-scrub-cap muted">shallow</span>` +
      `<input type="range" class="pose-scrub" min="0" max="${romKeys.length - 1}" step="1" value="${curIdx}" data-scrubex="${escapeHtml(name)}" data-scrubnote="${escapeHtml(note)}" aria-label="Scrub depth" />` +
      `<span class="pose-scrub-cap muted">deep</span><span class="pose-scrub-val">${escapeHtml(scrubLbl)}</span></div>`
    : "";
  return (
    `<div class="ex-var-pose">` +
    `<div class="pose-draw" data-poseex="${escapeHtml(name)}" data-posenote="${escapeHtml(note)}"></div>` +
    `<div class="pose-hint muted">A drawn figure doing the rep — drag the slider to scrub it down to the depth you did. Worked muscles (shoulders &amp; triceps) in blue.</div>` +
    scrub +
    ctl("support") + ctl("rom") + ctl("lean") +
    `<div class="ex-var-product">= <strong>×${scale}</strong> <span class="muted">final multiplier</span></div>` +
    `</div>`
  );
}
/** The "Photo" view: scrub real frames from the owner's own handstand-push-up clip
 * (top → bottom). The slider moves through the frames (like scrubbing a video) and
 * maps its position onto the range-of-motion (depth). No mount needed — it's a
 * plain <img> whose src the slider swaps. */
function notePhotoHtml(name: string, note: string): string {
  const fam = familyOf(name)!;
  const effVec = { ...rNote(fam, note).vec, ...noteVecOverride(name, note) };
  const scale = scalarFromVec(fam, effVec);
  const romKeys = Object.keys(FAMILIES[fam]!.dims.rom ?? {});
  const N = POSE_FRAMES.length;
  const romIdx = Math.max(0, romKeys.indexOf(String(effVec.rom)));
  // Map the current depth (rom) onto the nearest frame (top→bottom).
  const frameIdx = romKeys.length > 1 ? Math.round((romIdx / (romKeys.length - 1)) * (N - 1)) : 0;
  const ctl = (dim: string): string => {
    const levels = famLevels(fam, dim);
    if (!levels) return "";
    const cur = effVec[dim];
    const chips = Object.keys(levels)
      .map((l) => {
        const lbl = dim === "support" ? SUPPORT_LBL[l] ?? l : l;
        return `<button type="button" class="pose-ctl${l === cur ? " is-on" : ""}" data-posectl-ex="${escapeHtml(name)}" data-posectl-note="${escapeHtml(note)}" data-posectl-dim="${escapeHtml(dim)}" data-posectl-level="${escapeHtml(l)}">${escapeHtml(lbl)} <span class="ex-var-lvl-f">×${levels[l]}</span></button>`;
      })
      .join("");
    return `<div class="ex-var-dim"><span class="ex-var-dim-lbl">${escapeHtml(dim)}</span><div class="ex-var-dim-chips">${chips}</div></div>`;
  };
  const slider =
    `<div class="pose-scrub-row"><span class="pose-scrub-cap muted">top</span>` +
    `<input type="range" class="pose-photo-scrub" min="0" max="${N - 1}" step="1" value="${frameIdx}" data-scrubex="${escapeHtml(name)}" data-scrubnote="${escapeHtml(note)}" aria-label="Scrub depth" />` +
    `<span class="pose-scrub-cap muted">deep</span></div>`;
  return (
    `<div class="ex-var-pose">` +
    `<img class="pose-photo" alt="Handstand push-up depth" src="${POSE_FRAMES[frameIdx]}" />` +
    `<div class="pose-hint muted">Real frames from the clip — drag the slider to scrub down to the depth you did. It sets the range of motion.</div>` +
    slider +
    ctl("support") + ctl("rom") + ctl("lean") +
    `<div class="ex-var-product">= <strong>×${scale}</strong> <span class="muted">final multiplier</span></div>` +
    `</div>`
  );
}
/** The currently-mounted 3-D scene (one at a time). */
let activePose3d: { scene: PoseScene; el: HTMLElement } | null = null;
/** Mount/dispose the 3-D scene to match the visible `.pose3d` container (called
 * after any editor render). Idempotent: a still-mounted container is left alone. */
function refreshPose3d(): void {
  const el = Array.from(document.querySelectorAll<HTMLElement>(".pose3d")).find((c) => c.isConnected && !c.closest("[hidden]")) ?? null;
  if (activePose3d && activePose3d.el === el) return;
  if (activePose3d) { activePose3d.scene.dispose(); activePose3d = null; }
  if (!el) return;
  const ex = el.dataset.poseex ?? "";
  const note = el.dataset.posenote ?? "";
  const fam = familyOf(ex);
  const vec = fam ? { ...rNote(fam, note).vec, ...noteVecOverride(ex, note) } : {};
  activePose3d = { scene: mountPoseScene(el, vec), el };
}
/** The currently-mounted drawn (2-D) figure (one at a time). */
let activeDrawn: { fig: PoseDraw; el: HTMLElement } | null = null;
/** Mount/dispose the drawn figure to match the visible `.pose-draw` container. */
function refreshDrawn(): void {
  const el = Array.from(document.querySelectorAll<HTMLElement>(".pose-draw")).find((c) => c.isConnected && !c.closest("[hidden]")) ?? null;
  if (activeDrawn && activeDrawn.el === el) return;
  if (activeDrawn) { activeDrawn.fig.dispose(); activeDrawn = null; }
  if (!el) return;
  const ex = el.dataset.poseex ?? "";
  const note = el.dataset.posenote ?? "";
  const fam = familyOf(ex);
  const vec = fam ? { ...rNote(fam, note).vec, ...noteVecOverride(ex, note) } : {};
  activeDrawn = { fig: mountPoseDraw(el, vec), el };
}
/** Sync both visual editors (3-D + drawn figure) after any editor render. */
function refreshPoseViz(): void {
  refreshPose3d();
  refreshDrawn();
}
/** The note-variation difficulty editor: every distinct note logged for this lift,
 * each with an editable relative difficulty (×1 = no effect). Notes that look like
 * a difficulty-changing variation but haven't been reviewed get a ⚠ flag. */
/** Which exercises have their note-variations fold expanded — remembered so an
 * inspector re-render (e.g. after a rename/scale edit) keeps the fold open. */
const notesFoldOpen = new Set<string>();
function variationsEditorHtml(name: string, recs: SetRecord[]): string {
  type Sess = { username: string; user: string; date: string };
  const byNote = new Map<string, { display: string; count: number; sessions: Map<string, Sess> }>();
  for (const r of recs) {
    const note = (r.notes ?? "").trim();
    if (!note) continue;
    const k = normNote(note);
    let e = byNote.get(k);
    if (!e) { e = { display: note, count: 0, sessions: new Map() }; byNote.set(k, e); }
    e.count++;
    if (r.date) {
      const sk = `${r.username}|${r.date}`;
      if (!e.sessions.has(sk)) e.sessions.set(sk, { username: r.username, user: r.user || r.username, date: r.date });
    }
  }
  const openAttr = notesFoldOpen.has(name) ? " open" : "";
  if (byNote.size === 0)
    return (
      `<details class="ex-vars ex-vars-fold" data-exvars="${escapeHtml(name)}"${openAttr}><summary class="ex-info-section-hd ex-vars-sum">Note variations &amp; difficulty</summary>` +
      `<p class="muted">No notes logged yet.</p></details>`
    );
  const fam = familyOf(name);
  const entries = [...byNote.values()].sort((a, b) => b.count - a.count);
  let needReview = 0;
  const rowsHtml = entries
    .map((e) => {
      const notCmp = isNoteNotComparable(name, e.display);
      const reviewed = variationReviewed(name, e.display); // pinned a number OR picked attributes
      const handled = reviewed || notCmp;
      const scale = variationScaleFor(name, e.display);
      const resolved = fam ? rNote(fam, e.display) : null;
      // Flags: real resolver flags (unreviewed fragments / conflicting tokens) for
      // model lifts; the keyword heuristic only for lifts without a model.
      const realFlags = (resolved?.flags ?? []).filter((f) => f.type === "unreviewed" || f.type === "conflict");
      const needsReview = fam ? realFlags.length > 0 && !handled : VARIATION_HINT.test(e.display) && !handled;
      if (needsReview) needReview++;
      const review = !needsReview
        ? ""
        : fam
          ? realFlags
              .map((f) => `<span class="ex-var-review" title="${escapeHtml(f.detail)}">⚠ ${f.type === "conflict" ? "conflict" : "review"}</span>`)
              .join(" ")
          : `<span class="ex-var-review" title="Looks like a variation — pick its attributes, or mark it not comparable.">⚠ review</span>`;
      const reset = (fam ? noteHasVecOverride(name, e.display) : reviewed) && !notCmp
        ? `<button type="button" class="ex-var-reset" data-varreset-ex="${escapeHtml(name)}" data-varreset-note="${escapeHtml(e.display)}" title="${fam ? "Clear your picks — back to what the note implies" : "Reset to ×1 (mark un-reviewed)"}">↺</button>`
        : "";
      // Each note can get a difficulty, OR be marked NOT COMPARABLE (sets keep
      // reps/sets, drop 1RM & volume).
      const ncBtn = `<button type="button" class="ex-var-nc-btn${notCmp ? " is-on" : ""}" data-nc-ex="${escapeHtml(name)}" data-nc-note="${escapeHtml(e.display)}" aria-pressed="${notCmp}" title="${notCmp ? "Comparable again — restore 1RM/volume for these sets." : "Mark not comparable — keep reps/sets, drop 1RM & volume (e.g. a static hold)."}">⊘</button>`;
      // Model lift → a row of dimension dropdowns (pick the setup); the × is the
      // resulting product, read-only. No model → the plain × number input.
      const picker = fam && !notCmp ? notePickerHtml(name, e.display) : "";
      const editArea = notCmp
        ? `<span class="ex-var-edit">${ncBtn}</span>`
        : fam
          ? `<span class="ex-var-edit"><span class="ex-var-x" title="Resulting difficulty (product of the picks)">×${scale}</span>${reset}${ncBtn}</span>`
          : `<span class="ex-var-edit"><label class="ex-var-lbl">×</label>` +
            `<input class="ex-var-input" type="number" step="0.05" min="0.1" max="5" value="${scale}" data-var-ex="${escapeHtml(name)}" data-var-note="${escapeHtml(e.display)}" aria-label="Relative difficulty for note ${escapeHtml(e.display)}" />` +
            reset + ncBtn + `</span>`;
      // Who & when: every (athlete, day) that logged this note — tap one to jump
      // to that athlete's Analysis for this lift, scrolled to that date.
      const sessions = [...e.sessions.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      const sessBtns = sessions
        .map(
          (s) =>
            `<button type="button" class="ex-var-jump" data-jumpuser="${escapeHtml(s.username)}" data-jumpex="${escapeHtml(name)}" data-jumpdate="${escapeHtml(s.date)}" title="Go to ${escapeHtml(s.user)}'s ${escapeHtml(name)} on ${escapeHtml(shortDate(s.date))}">${escapeHtml(s.user)} · ${escapeHtml(shortDate(s.date))}</button>`,
        )
        .join("");
      const sessFold = `<details class="ex-var-sessions"${needsReview ? " open" : ""}><summary class="ex-var-sessions-sum" title="Who &amp; when logged this note">👤 ${sessions.length}</summary><div class="ex-var-session-list">${sessBtns}</div></details>`;
      // The full difficulty editor (chips / pad / support / band, etc.) starts
      // COLLAPSED — tap "⚙ Edit difficulty" to open it. Open state is remembered
      // (openVarNotes) so editing, which re-renders, keeps it open.
      const editOpen = openVarNotes.has(variationKey(name, e.display));
      const ncNote = notCmp
        ? `<div class="ex-var-nc-note muted">Not comparable — reps &amp; sets still count, but no 1RM or volume for these sets.</div>`
        : picker
          ? `<details class="ex-var-edit-fold"${editOpen ? " open" : ""} data-editfold-ex="${escapeHtml(name)}" data-editfold-note="${escapeHtml(e.display)}"><summary class="ex-var-edit-sum">⚙ Edit difficulty</summary>${picker}</details>`
          : "";
      return (
        `<div class="ex-var-block${needsReview ? " needs-review" : ""}${notCmp ? " is-nc" : scale !== 1 ? " is-scaled" : ""}">` +
        `<div class="ex-var-row">` +
        `<span class="ex-var-note">` +
        `<input class="ex-var-rename" type="text" value="${escapeHtml(displayNote(name, e.display))}" data-rename-ex="${escapeHtml(name)}" data-rename-note="${escapeHtml(e.display)}" aria-label="Edit this note's text" title="Edit this note's text — applies everywhere it shows. Blank to restore the original." />` +
        ` ${review}<span class="muted ex-var-count"> · ${e.count}s</span></span>` +
        editArea +
        sessFold +
        `</div>` +
        ncNote +
        `</div>`
      );
    })
    .join("");
  const badge = needReview ? ` <span class="ex-var-needbadge">${needReview} to review</span>` : "";
  // The whole note-variations editor is a collapsible fold (default closed to keep
  // the inspector tidy); the "N to review" badge stays in the summary as a hint.
  return (
    `<details class="ex-vars ex-vars-fold" data-exvars="${escapeHtml(name)}"${openAttr}><summary class="ex-info-section-hd ex-vars-sum">Note variations &amp; difficulty${badge}</summary>` +
    `<p class="muted ex-vars-help">Tap to rename. ×N = relative difficulty. ⊘ = not comparable. ⚠ = needs review.</p>` +
    rowsHtml +
    `</details>`
  );
}

/** Open one exercise's settings — now a floating overlay, so it pops over
 * whatever you're on (no tab switch needed). The single entry point for "more
 * info" from anywhere (the Index ℹ button, the per-athlete drill-in, the
 * Analysis panel). */
function jumpToExerciseInfo(exName: string) {
  openExerciseInfo(exName);
}

/** From the graph's "needs review" prompt: open the exercise-settings overlay
 * and scroll it to the "Allowed graphs" chips. */
function reviewGraphsForExercise(exName: string) {
  openExerciseInfo(exName);
  requestAnimationFrame(() => {
    const panel = document.getElementById(`graphPerms-${exName}`);
    panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

/** Apply an edited bodyweight coefficient and refresh every dependent view. */
function onBwInputChange(e: Event) {
  const input = e.target as HTMLElement;
  // The "Sub-group by" picker inside the Strength discipline (muscle / function).
  if (input.classList.contains("bw-substrat")) {
    strengthSubMode = (input as HTMLSelectElement).value === "function" ? "function" : "muscleGroup";
    renderBwParts();
    return;
  }
  if (!input.classList.contains("bw-input")) return;
  const el = input as HTMLInputElement;
  const name = el.dataset.ex;
  if (name === undefined) return;
  let v = parseFloat(el.value);
  if (!Number.isFinite(v)) v = 0;
  v = Math.min(2, Math.max(0, v));
  el.value = String(v);
  setCoeff(name, v);
  // Recompute everything that uses the coefficient (but not the BW table itself,
  // so the row you're editing keeps its place and focus).
  renderLeaderboard();
  renderPersonalRecords();
  renderAthlete();
}

/** Fill the Test-tab exercise <select> with the chosen athlete's exercises. */
function populateTestExercises(username: string) {
  if (username === "") {
    els.testExercise.innerHTML = `<option value="">— pick an athlete first —</option>`;
    return;
  }
  const exercises = exerciseCountsForUser(activeRecords(), username);
  els.testExercise.innerHTML = exercises
    .map((e) => `<option value="${escapeHtml(e.exerciseName)}">${escapeHtml(displayName(e.exerciseName))}</option>`)
    .join("");
  // Default to Squat when this athlete has it, else their most-trained lift.
  const squat = exercises.find((e) => e.exerciseName.toLowerCase() === "squat");
  els.testExercise.value = squat?.exerciseName ?? exercises[0]?.exerciseName ?? "";
}

/** Load the picked athlete+exercise's top set (best 1RM) into the calculator inputs. */
function prefillTestFromPick() {
  const username = els.testAthlete.value;
  const exName = els.testExercise.value;
  if (username === "" || exName === "") {
    els.testPickHint.textContent = "";
    return;
  }
  const formula = currentFormula();
  // Pick the top set the SAME way the athlete page does: best bodyweight-aware
  // added-weight 1RM (honours the rep cap), not a raw estimate — so the Test tab
  // seeds the exact set the PR/leaderboard would. Display the logged bar weight.
  const sets = setsForUserExercise(data.records, username, exName);
  let best: SetRecord | null = null;
  let bestE1rm = -Infinity;
  for (const s of sets) {
    const e = addedWeight1RM(computeRecord(s), formula);
    if (e !== null && e > bestE1rm) {
      bestE1rm = e;
      best = s; // keep the raw set so we show the logged weight/reps
    }
  }
  if (!best || best.weight === null || best.reps === null) {
    els.testPickHint.textContent = "No logged sets with a usable 1RM for this exercise.";
    return;
  }
  els.calcWeight.value = String(best.weight);
  els.calcReps.value = String(best.reps);
  els.calcBw.value = String(best.bodyweight ?? athProfile(username)?.weight ?? els.calcBw.value);
  els.calcCoeff.value = String(coeffFor(exName));
  const label = els.testAthlete.selectedOptions[0]?.textContent ?? username;
  els.testPickHint.textContent =
    `Loaded ${label}'s top ${exName}: ${best.weight}kg × ${best.reps} on ${shortDate(best.date)} ` +
    `(${fmt(bestE1rm)}kg est. 1RM). Tweak any number below.`;
  renderTest();
}

// The 1RM formula shown in the Test-tab calculator (its own tab, independent of
// the dashboard-wide setting so people can compare them side by side).
let calcTab: OneRepMaxFormula = DEFAULT_FORMULA;

// ---- Test tab: live calculator showing the selected formula with the numbers ----
function renderTest() {
  const num = (el: HTMLInputElement, fallback: number) => {
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : fallback;
  };
  const weight = num(els.calcWeight, 0);
  const reps = Math.max(1, Math.round(num(els.calcReps, 1)));
  const bw = num(els.calcBw, 0);
  const coeff = num(els.calcCoeff, 0);

  // Named parts of the lift (the same names the code uses everywhere):
  const addedWeight = weight; // what's on the bar (the logged weight)
  const effLoad = effectiveLoad(weight, bw, coeff) ?? 0; // added + bodyweight share
  const bodyweightLoad = effLoad - addedWeight; // coeff × bodyweight, the body's share
  const isBodyweightLift = bodyweightLoad > 0.01;
  const vol = setVolume(weight, reps);
  const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

  // One tight line per step: "Label — formula = result".
  const line = (title: string, expr: string) =>
    `<div class="calc-row"><span class="calc-label">${title}</span><span class="calc-expr">${expr}</span></div>`;
  const res = (s: string) => `<span class="calc-result">${s}</span>`;
  const eq = (formula: string, result: string | null) => (result === null ? formula : `${formula} = ${res(result)}`);

  // 1RM of the effective load for the selected formula, then peel the bodyweight
  // share back off so the answer is added (bar) weight — comparable to logged
  // weights, and the exact number the leaderboards/PRs now use.
  let effective1RM: number | null;
  let formulaText: string;
  if (calcTab === "brzycki") {
    effective1RM = brzycki1RM(effLoad, reps);
    formulaText = reps >= 37 ? "undefined at 37+ reps" : `${f2(effLoad)} × 36 / (37 − ${reps})`;
  } else if (calcTab === "nuzzo") {
    effective1RM = nuzzo1RM(effLoad, reps);
    formulaText = reps === 1 ? "a single is the 1RM" : `${f2(effLoad)} ÷ ${f2(benchPctForReps(reps))}%`;
  } else {
    effective1RM = epley1RM(effLoad, reps);
    formulaText = `${f2(effLoad)} × (1 + ${reps}/30)`;
  }
  const addedWeight1RM = effective1RM === null ? null : effective1RM - bodyweightLoad;
  const perBw = addedWeight1RM !== null && bw > 0 ? addedWeight1RM / bw : null;
  const kg = (n: number | null) => (n === null ? null : `${f2(n)} kg`);

  const rows: string[] = [];
  if (isBodyweightLift) {
    rows.push(line("BW load", eq(`${coeff} × ${f2(bw)}`, `${f2(bodyweightLoad)} kg`)));
    rows.push(line("Effective", eq(`${f2(addedWeight)} + ${f2(bodyweightLoad)}`, `${f2(effLoad)} kg`)));
  }
  // Nuzzo divides the load by the %1RM that this many reps represents, so derive
  // that % FIRST — the 1RM line below reads "load ÷ that %", in logical order.
  if (calcTab === "nuzzo") {
    rows.push(line("Bench %1RM", `${reps} reps ≈ ${res(`${f2(benchPctForReps(reps))}%`)}`));
  }
  if (isBodyweightLift) {
    rows.push(line("Effective 1RM", eq(formulaText, kg(effective1RM))));
    rows.push(line("Added 1RM", eq(`${effective1RM === null ? "—" : f2(effective1RM)} − ${f2(bodyweightLoad)}`, kg(addedWeight1RM))));
  } else {
    rows.push(line("Est. 1RM", eq(formulaText, kg(addedWeight1RM))));
  }
  rows.push(line("Volume", eq(`${f2(weight)} × ${reps}`, vol === null ? null : f2(vol))));
  rows.push(
    line(
      "Per BW",
      addedWeight1RM === null || bw <= 0
        ? "needs 1RM & BW"
        : eq(`${f2(addedWeight1RM)} ÷ ${f2(bw)}`, perBw === null ? null : bwMult(perBw)),
    ),
  );
  els.calcOut.innerHTML = rows.join("");
  renderCalcCurve(effLoad, bodyweightLoad, reps, addedWeight, calcTab);
  renderDecayCurve();
}

/**
 * Strength-fade explainer: % of a peak 1RM still available vs days since you last
 * trained the lift (the spaced-repetition model in metrics.ts). Two curves show
 * the key idea — a freshly-hit lift fades faster than one you've drilled for
 * months, because each session grows its durability. Static (no inputs) — drawn
 * with the calculator so it sizes correctly when the Test tab is shown.
 */
function renderDecayCurve() {
  const box = document.getElementById("decayCurveChart");
  if (!box) return;
  const maxDays = 540; // ~1.5 years out — long enough to see the tail flatten
  const r1 = (n: number) => Math.round(n * 10) / 10;
  // A "well-trained" lift = stability grown by several sessions.
  let trained: number = STRENGTH_DECAY.baseStability;
  for (let i = 0; i < 4; i++) trained = grownStability(trained);
  const curve = (stability: number): SvgPoint[] => {
    const pts: SvgPoint[] = [];
    for (let d = 0; d <= maxDays; d += 2) pts.push({ x: d, y: r1(strengthRetention(d, stability) * 100) });
    return pts;
  };
  const milestones: { d: number; label: string }[] = [
    { d: STRENGTH_DECAY.graceDays, label: "2 weeks" },
    { d: 44, label: "+1 month" },
    { d: 90, label: "3 months" },
    { d: 180, label: "6 months" },
    { d: 365, label: "1 year" },
  ];
  const dots: SvgPoint[] = milestones.map((m) => {
    const pct = r1(strengthRetention(m.d) * 100);
    return { x: m.d, y: pct, meta: `${m.label}: ${pct}% kept (fresh lift)` };
  });
  const series: SvgSeries[] = [
    { name: "Fresh lift", color: "#284e86", type: "line", points: curve(STRENGTH_DECAY.baseStability) },
    { name: "Well-trained lift", color: CURRENT_STRENGTH_COLOR, type: "line", points: curve(trained) },
    { name: "Milestones (fresh)", color: "#b8902f", type: "scatter", points: dots },
  ];
  const config: SvgChartConfig = {
    series,
    xKind: "linear",
    yBeginAtZero: true,
    height: 300,
    yUnit: "%",
    formatX: (x) => `${Math.round(x)}`,
    formatTipX: (x) => `${Math.round(x)} days off`,
  };
  if (!decayCurveSvg) decayCurveSvg = mountSvgChart(box, config);
  else decayCurveSvg.update(config);
  const floorPct = Math.round(STRENGTH_DECAY.floor * 100);
  els.decayCurveNote.textContent =
    `% of your peak 1RM kept after N days without training a lift. Flat for the first ` +
    `${STRENGTH_DECAY.graceDays} days, then an exponential fade to a ${floorPct}% floor. ` +
    `The more you've trained a lift the flatter its curve — a fresh PR (blue) fades faster than a well-drilled lift (green).`;
}

/**
 * Calculator graph — the Nuzzo research chart, plotted on YOUR scale: the study's
 * bench point estimates as dots and the best-fit curve, but the x-axis is the BAR
 * WEIGHT (added kg) the curve predicts at each %1RM for your set's estimated 1RM,
 * not the bare %1RM. So it reads "at this weight on the bar you can do N reps".
 * Each %1RM p maps to bar weight = (p/100 × eff1RM) − bodyweight share; reps stay
 * on y. Your typed set is the gold dot at (added weight, reps). Same study data +
 * best-fit curve as the explainer page (public/reps-1rm.html), just on a kg axis.
 */
function renderCalcCurve(
  effLoad: number,
  bodyweightLoad: number,
  curReps: number,
  curAdded: number,
  _formula: OneRepMaxFormula,
) {
  const box = document.getElementById("calcCurveChart");
  if (!box) return;

  // The set's Nuzzo 1RM sets the weight scale (this is the Nuzzo bench chart).
  // Without a usable 1RM (e.g. no reps yet) we can't place a weight axis.
  const eff1rm = nuzzo1RM(effLoad, Math.max(1, curReps));
  if (eff1rm === null || eff1rm <= 0) {
    els.calcCurveNote.textContent = "Enter a weight and reps to see the weight↔reps curve.";
    if (calcCurveSvg) calcCurveSvg.update({ series: [] });
    return;
  }
  // %1RM → bar weight (added kg) for THIS set: peel the bodyweight share back off.
  const barAt = (pct: number) => (pct / 100) * eff1rm - bodyweightLoad;
  const r1 = (n: number) => Math.round(n * 10) / 10;

  // All 17 study points, each at its predicted bar weight.
  const studyPts: SvgPoint[] = BENCH_REPS_STUDY.map(([pct, reps]) => ({
    x: r1(barAt(pct)),
    y: r1(reps),
    meta: `${reps.toFixed(1)} reps @ ${Math.round(pct)}%`,
  }));
  // Best-fit curve sampled densely across the data span (95% → 15% of 1RM).
  const fitPts: SvgPoint[] = [];
  for (let pct = 95; pct >= 15; pct -= 0.5) {
    fitPts.push({ x: r1(barAt(pct)), y: r1(benchRepsAtPct(pct)) });
  }
  const series: SvgSeries[] = [
    { name: "Best-fit curve", color: "#284e86", type: "line", points: fitPts, noLegend: true },
    { name: "Study estimates (Nuzzo et al.)", color: "#1a1a1a", type: "scatter", points: studyPts },
  ];
  // Overlay the set you typed at its actual added weight.
  if (curReps >= 1) {
    series.push({
      name: "Your set",
      color: "#b8902f",
      type: "scatter",
      points: [{ x: r1(curAdded), y: curReps, meta: `${fmt(curAdded)} kg × ${curReps}` }],
    });
  }
  const config: SvgChartConfig = {
    series,
    xKind: "linear",
    yBeginAtZero: true,
    height: 300,
    yUnit: "reps",
    formatX: (x) => `${Math.round(x)}`,
    formatTipX: (x) => `${Math.round(x)} kg`,
  };
  if (!calcCurveSvg) calcCurveSvg = mountSvgChart(box, config);
  else calcCurveSvg.update(config);
  els.calcCurveNote.textContent =
    "Reps you can do at each bar weight (kg) for this set's Nuzzo 1RM — dots are the study data, the line is the best-fit curve (gold dot = the set you typed). Drag to pan · wheel to zoom.";
}

function renderAll() {
  refreshActiveSet(); // keep the app-wide active exercise set current before any render
  renderLeaderboard();
  renderPersonalRecords();
  renderAthlete();
  renderBwParts();
  renderTest();
}

// Coalesced, scroll-preserving renderAll for interaction handlers (CLAUDE.md
// rule 17). Instead of rebuilding all five views synchronously on a tap — which
// blocks the click's own paint and janks on rapid taps — defer the heavy render
// to the next animation frame and collapse multiple calls in the same frame into
// one. So a tap repaints its own control instantly and the app-wide refresh lags
// one frame behind. Use this where renderAll() is the LAST action of a handler;
// keep the synchronous renderAll() where following code reads the just-built DOM
// (e.g. reopenIndexDetail / renderExerciseDetail right after).
let pendingRender: (() => void) | null = null;
let renderRafQueued = false;
/** Defer ANY heavy render to the next frame, coalesced + scroll-preserving. The
 * latest fn queued in a frame is the one that runs (one render per frame), and the
 * scroll position is captured now and restored after — so a tap repaints its own
 * control first and a rebuild won't make the page jump. */
function deferRender(fn: () => void): void {
  pendingRender = fn;
  if (renderRafQueued) return;
  renderRafQueued = true;
  const y = window.scrollY;
  requestAnimationFrame(() => {
    renderRafQueued = false;
    const f = pendingRender; pendingRender = null;
    f?.();
    window.scrollTo(0, y);
    requestAnimationFrame(() => window.scrollTo(0, y)); // charts can reflow async
  });
}
function scheduleRender(after?: () => void): void {
  deferRender(() => { renderAll(); after?.(); });
}
// The exercise selector can fire many picks in a row; rebuilding the graph +
// history + filtered chips on each one is heavy enough to block the thread, so the
// next tap has to wait for it. Debounce that rebuild: the tapped pill/chip updates
// itself synchronously (instant), waSelected updates now, and the heavy analysis
// re-render only runs once you pause — so you can rip through chips and the graph
// "catches up" behind you (the closest we get to off-thread without a worker,
// which can't touch the DOM anyway). CLAUDE.md rule 17 / #prune SNAP.
let waRenderTimer: ReturnType<typeof setTimeout> | null = null;
function debounceWaRender(): void {
  if (waRenderTimer) clearTimeout(waRenderTimer);
  waRenderTimer = setTimeout(() => { waRenderTimer = null; renderWorkoutAnalysis(); }, 200);
}

/**
 * Re-render everything a difficulty / scale / note edit affects. renderAll covers
 * the leaderboard, PRs, athlete and Index views, but NOT the Analysis workouts
 * list or its charts — yet the compact "×mult" on each set there reads the same
 * scaleForRecord. Without refreshing them, an edited multiplier updates in the
 * editor but the (collapsed) workout list keeps showing the old number. Scroll is
 * preserved (and re-applied after the charts mount async) so the page won't jump.
 */
function refreshAfterDifficultyEdit(): void {
  const y = window.scrollY;
  refreshExerciseInfo();
  renderAll();
  if (document.getElementById("workoutsTable")) renderWorkoutsPage();
  window.scrollTo(0, y);
  requestAnimationFrame(() => window.scrollTo(0, y));
}

// Editing model ×factors should feel instant: each change just saves + recolours
// the one cell (no editor rebuild → focus/scroll kept), and the heavy view refresh
// (leaderboard / workouts / analysis — NOT the open editor) runs once, debounced,
// after you pause. This is what lets you edit many multipliers in a row smoothly.
let modelFactorsTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleModelFactorsApply(): void {
  if (modelFactorsTimer) clearTimeout(modelFactorsTimer);
  modelFactorsTimer = setTimeout(() => {
    modelFactorsTimer = null;
    const y = window.scrollY;
    renderAll();
    if (document.getElementById("workoutsTable")) renderWorkoutsPage();
    if (document.getElementById("tab-analysis")?.hidden === false) renderWorkoutAnalysis();
    window.scrollTo(0, y);
  }, 600);
}

/**
 * Non-overlapping rep bands for the leaderboard histogram. Each band's 1RM is
 * estimated only from sets whose reps fall in that band, so a 5-rep set counts
 * once (in 4–6), never twice.
 */
const REP_BANDS: { id: string; label: string; min: number; max?: number }[] = [
  { id: "1-3", label: "1–3", min: 1, max: 3 },
  { id: "4-6", label: "4–6", min: 4, max: 6 },
  { id: "7-10", label: "7–10", min: 7, max: 10 },
  { id: "11-15", label: "11–15", min: 11, max: 15 },
  { id: "16-20", label: "16–20", min: 16, max: 20 },
  { id: "21+", label: "21+", min: 21 },
];

function setSettingsOpen(open: boolean) {
  els.settingsPanel.hidden = !open;
  els.settingsBtn.setAttribute("aria-expanded", String(open));
}

async function init() {
  try {
    data = await loadData();
    clearMachineCache(); // fresh records → rebuild any mixed-mode verdicts
  } catch (err) {
    els.status.innerHTML = `<span class="badge warn">Failed to load data</span> ${escapeHtml(String(err))}`;
    return;
  }
  // Fold in any hand-logged sets saved on this device (the Add tab).
  csvRecordCount = data.records.length;
  mergeManualSets();
  loadAlone(); // "trained alone" workout tags saved on this device

  // Build the leaderboard exercise picker (see populateExercisePicker): every
  // distinct logged lift, each on its own.
  populateExercisePicker();
  els.rank.innerHTML =
    `<option value="abs">Total (kg)</option><option value="rel">Per bodyweight</option>`;
  els.rank.value = "abs";

  els.exercise.addEventListener("change", () => {
    renderLeaderboard();
    renderPersonalRecords(); // PRs are scoped to the selected exercise
  });
  els.rank.addEventListener("change", () => deferRender(renderLeaderboard));

  // Coliseum comparison filters: re-render both the chart and the PR table, which
  // share the sex/bodyweight filter. The axis inputs only affect the chart, but
  // re-running the whole leaderboard is cheap and keeps the wiring simple.
  const refreshColiseum = () => {
    renderLeaderboard();
    renderPersonalRecords();
  };
  els.sexFilter.addEventListener("change", refreshColiseum);
  els.bwMin.addEventListener("input", refreshColiseum);
  els.bwMax.addEventListener("input", refreshColiseum);
  els.axisMin.addEventListener("input", () => deferRender(renderLeaderboard));
  els.axisMax.addEventListener("input", () => deferRender(renderLeaderboard));
  els.axisReset.addEventListener("click", () => {
    els.axisMin.value = "";
    els.axisMax.value = "";
    renderLeaderboard();
  });

  els.formula.value = DEFAULT_FORMULA;

  // Populate athlete dropdown (alphabetical by display name) — data users + any
  // manually-added ones.
  const users = rosterUsers();
  els.athlete.innerHTML = users
    .map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`)
    .join("");
  // Pick the athlete to show on load: the one remembered from last visit if it's
  // still in the data, otherwise default to Indre.
  const remembered = loadLastAthlete();
  const rememberedUser = remembered ? users.find((u) => u.username === remembered) : undefined;
  if (rememberedUser) {
    els.athlete.value = rememberedUser.username;
  } else {
    const indre = users.find((u) => u.username.toLowerCase() === "indre_ju");
    if (indre) els.athlete.value = indre.username;
  }
  buildAthleteChips(); // custom chip row mirrors the hidden <select>

  // Settings → "View as": Admin, lock to one athlete, or logged out (Adomas only).
  els.viewAsSelect.innerHTML =
    `<option value="admin">Admin — everything</option>` +
    users.map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`).join("") +
    `<option value="loggedout">Logged out — Adomas only</option>`;
  // The login screen's name picker mirrors the same roster (Admin + athletes).
  populateLoginAthletes();

  // Test-tab pickers (native selects): choosing an athlete + exercise prefills the
  // calculator with that athlete's top set (custom numbers still work afterwards).
  // Defaults to Adomas + Squat.
  els.testAthlete.innerHTML = users
    .map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`)
    .join("");
  const adomas = users.find((u) => u.username.toLowerCase().includes("adomas") || u.user.toLowerCase().includes("adomas"));
  els.testAthlete.value = adomas?.username ?? users[0]?.username ?? "";
  populateTestExercises(els.testAthlete.value);
  els.testAthlete.addEventListener("change", () => {
    populateTestExercises(els.testAthlete.value);
    prefillTestFromPick();
  });
  els.testExercise.addEventListener("change", prefillTestFromPick);

  // Calculator formula tabs (Epley / Brzycki / Nuzzo) — independent of the setting.
  els.calcTabs.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".calc-tab");
    const f = btn?.dataset.formula;
    if (f !== "epley" && f !== "brzycki" && f !== "nuzzo") return;
    calcTab = f;
    for (const t of els.calcTabs.querySelectorAll(".calc-tab"))
      t.classList.toggle("is-active", (t as HTMLElement).dataset.formula === f);
    renderTest();
  });

  prefillTestFromPick(); // load Adomas / Squat into the calculator on first paint

  // Version label + history come from the single CHANGELOG source. The tag is
  // clickable — it opens the Version history page.
  const verEl = document.querySelector<HTMLElement>(".version");
  if (verEl) {
    // The minor shows as a Bleach code-name (Espada zanpakutō, reverse rank — see
    // versionName.ts) in small gold; the patch the AIs bump reads as a grey "v.N".
    const vp = versionParts(CURRENT_VERSION);
    verEl.innerHTML = vp
      ? `<span class="ver-name">${escapeHtml(vp.name)}</span>${vp.patch ? `<span class="ver-patch"> ${escapeHtml(vp.patch)}</span>` : ""}`
      : escapeHtml(CURRENT_VERSION);
    verEl.title = "Version history";
    verEl.style.cursor = "pointer";
    verEl.addEventListener("click", openChangelog);
  }
  els.changelogVer.textContent = displayVersion(CURRENT_VERSION);
  renderChangelog();

  const effortSummary = document.getElementById("effortSummary");
  if (effortSummary) effortSummary.textContent = `${TOTAL_LOG_SP} SP`;

  renderStatus();
  renderHealth();
  renderAll();
  // Momentum trend-period toggle (delegated; survives re-renders).
  els.momentum.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".mo-period")) { momentumPeriod = MO_PERIOD_NEXT[momentumPeriod]; renderMomentum(); }
  });
  setupTabs();
  setupDataTab();
  renderDataTab();
  setupAddTab();
  void setupBackup();
  setupStatsEdit();
  els.athleteProfile.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    // ⓘ on a value chip → toggle that value's math panel (matched by id).
    const info = target.closest<HTMLElement>(".bc-info");
    if (info) {
      const id = info.dataset.bcinfo;
      const panel = info.closest(".bodycomp")?.querySelector<HTMLElement>(`.bc-panel[data-bcpanel="${id}"]`);
      if (panel) { panel.toggleAttribute("hidden"); info.classList.toggle("is-open"); }
      return;
    }
    // kg ⇄ % toggle for the lean/fat mass bar.
    if (target.closest("[data-bcunit]")) {
      bcMassUnit = bcMassUnit === "kg" ? "pct" : "kg";
      try { localStorage.setItem("colosseum.bcMassUnit", bcMassUnit); } catch { /* ignore */ }
      renderAthleteProfile();
      return;
    }
    const btn = target.closest<HTMLElement>("[data-editstats]");
    if (btn?.dataset.editstats !== undefined) openStatsEditor(btn.dataset.editstats);
  });
  setupWorkoutAnalysis();
  setupCommandBar();
  // Redirect legacy deep-links / bookmarks into the unified view (TASKS 49–52).
  window.addEventListener("hashchange", handleAnalysisHash);
  handleAnalysisHash();
  // Analysis is the default landing panel, so render it once at boot — without
  // this, the panel shows up empty until the user taps Analysis (switchTopTab).
  renderWorkoutAnalysis();
  setupGroupsView();
  setupTeamView();
  setupChecklists();

  // Dark / light theme toggle (the saved theme is already applied in <head>).
  els.themeBtn.textContent = document.documentElement.getAttribute("data-theme") === "dark" ? "☀" : "🌙";
  els.themeBtn.addEventListener("click", () =>
    setTheme(document.documentElement.getAttribute("data-theme") !== "dark"),
  );

  // Admin / "view as a user" / logged-out picker: apply the saved choice, react to changes.
  setupViewSwitch();
  setViewMode(viewMode);
  updateBrand(); // show the current page's name in the title from the start
  els.viewAsSelect.addEventListener("change", () => setViewAs(els.viewAsSelect.value));
  // Log in / Log out both take you to the sign-in screen (where you pick admin or spectator).
  els.authBtn.addEventListener("click", showLoginPage);

  // "Legs (all)" category visibility in the By-category list (off by default).
  els.showLegsAll.checked = showLegsAll;
  els.showLegsAll.addEventListener("change", () => {
    showLegsAll = els.showLegsAll.checked;
    try { localStorage.setItem("colosseum.legsAll", showLegsAll ? "1" : "0"); } catch { /* ignore */ }
    renderExercisesPage();
  });

  // Simplified view ↔ Advanced. Switches the Analysis home (S-ANL ↔ full ANL) and
  // re-navigates immediately if you're already on an analysis page.
  els.simplifiedToggle.checked = simplifiedView;
  els.simplifiedToggle.addEventListener("change", () => setSimplified(els.simplifiedToggle.checked));

  // The red "trained alone" rings on the calendar (off by default).
  els.showAloneRings.checked = showAloneRings;
  els.showAloneRings.addEventListener("change", () => {
    showAloneRings = els.showAloneRings.checked;
    try { localStorage.setItem("colosseum.showAloneRings", showAloneRings ? "1" : "0"); } catch { /* ignore */ }
    renderWorkoutCalendar();
  });

  els.decayStrength.checked = decayStrength;
  els.decayStrength.addEventListener("change", () => {
    decayStrength = els.decayStrength.checked;
    try { localStorage.setItem("colosseum.decayStrength", decayStrength ? "1" : "0"); } catch { /* ignore */ }
    scheduleRender(); // every 1RM/leaderboard/PR view re-reads strengthAsOf()
  });

  // Settings popover (holds the 1RM formula).
  els.settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setSettingsOpen(els.settingsPanel.hidden);
  });
  document.addEventListener("click", (e) => {
    const t = e.target as Node;
    if (!els.settingsPanel.hidden && !els.settingsPanel.contains(t) && t !== els.settingsBtn)
      setSettingsOpen(false);
  });

  // Data health lives on its own overlay page, opened from Settings or by
  // tapping a parse-issues / sanity-warnings badge in the status bar.
  els.healthBtn.addEventListener("click", openHealth);
  els.status.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".badge-link")) openHealth();
  });
  // Restore hidden ("deleted") sets from the Data-health list.
  els.health.addEventListener("click", (e) => {
    const one = (e.target as HTMLElement).closest<HTMLElement>(".health-restore");
    if (one?.dataset.restoreset) { setDeleted(one.dataset.restoreset, false); renderHealth(); renderAll(); renderWorkoutsPage(); return; }
    if ((e.target as HTMLElement).closest(".health-restore-all")) {
      deletedSets.clear(); saveDeletedSets(); renderHealth(); renderAll(); renderWorkoutsPage();
    }
  });
  els.healthClose.addEventListener("click", () => {
    els.healthPage.hidden = true;
  });
  els.changelogBtn.addEventListener("click", openChangelog);
  els.backlogBtn.addEventListener("click", openBacklog);
  els.backlogClose.addEventListener("click", () => {
    els.backlogPage.hidden = true;
  });
  els.testingBtn.addEventListener("click", openTesting);
  els.testingClose.addEventListener("click", () => {
    els.testingPage.hidden = true;
  });
  // Exercise-settings overlay: ✕ closes it; Esc closes it; the per-exercise
  // active-set force-in/out buttons live inside it, so handle them here too.
  els.exInfoBack.addEventListener("click", closeExerciseInfo);
  els.exInfoGotoIndex.addEventListener("click", gotoIndexFromInfo);
  els.exInfoGotoAnl.addEventListener("click", gotoAnlFromInfo);
  els.exInfoPage.addEventListener("click", (e) => {
    // Click on the dimmed backdrop (outside the floating card) closes it.
    if (e.target === els.exInfoPage) { closeExerciseInfo(); return; }
    const inc = (e.target as HTMLElement).closest<HTMLElement>("[data-asinclude]");
    if (inc?.dataset.asinclude) { toggleActiveOverride(inc.dataset.asinclude, "include"); return; }
    const exc = (e.target as HTMLElement).closest<HTMLElement>("[data-asexclude]");
    if (exc?.dataset.asexclude) { toggleActiveOverride(exc.dataset.asexclude, "exclude"); return; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.exInfoPage.hidden) closeExerciseInfo();
  });
  // Global "Difficulty multipliers" editor (Settings → ✎ Difficulty multipliers).
  els.modelBtn.addEventListener("click", openModelEditor);
  els.modelClose.addEventListener("click", () => { els.modelPage.hidden = true; });
  els.modelResetAll.addEventListener("click", () => {
    if (!window.confirm("Reset every difficulty multiplier back to its default?")) return;
    for (const k of Object.keys(famFactorOverrides)) delete famFactorOverrides[k];
    saveFamFactors();
    renderModelEditor();
    refreshAfterDifficultyEdit();
  });
  // "More info" buttons (Index ℹ, Analysis single mode, drill-in) all open that
  // exercise's settings in the floating overlay.
  document.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-moreinfoex]");
    if (btn?.dataset.moreinfoex) {
      e.preventDefault(); // the icon lives inside a <summary> — don't toggle the fold
      jumpToExerciseInfo(btn.dataset.moreinfoex);
    }
  });
  // "Allowed graphs" review chips + bulk buttons. Delegated on document so they
  // work both in the More-info overlay and the Index page's expandable inspector.
  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const chip = t.closest<HTMLElement>("[data-graphperm-id]");
    if (chip?.dataset.graphpermEx && chip.dataset.graphpermId) {
      cycleGraphPerm(chip.dataset.graphpermEx, chip.dataset.graphpermId);
      return;
    }
    // Bulk "All →" cycles EVERY metric up one level together (off the lowest one).
    const cycleAll = t.closest<HTMLElement>("[data-graphperm-cycle]");
    if (cycleAll?.dataset.graphpermCycle) {
      const nm = cycleAll.dataset.graphpermCycle;
      const minLvl = Math.min(...GRAPH_METRICS.map((m) => levelOf(graphPerms, nm, m.id)));
      setGraphPermAll(nm, ((minLvl + 1) % (MAX_GRAPH_LEVEL + 1)) as GraphLevel);
      return;
    }
    const noneBtn = t.closest<HTMLElement>("[data-graphperm-none]");
    if (noneBtn?.dataset.graphpermNone) { setGraphPermAll(noneBtn.dataset.graphpermNone, 0); return; }
    // Global "All graphs / Approved only" master toggle (in Graph options).
    const allGraphsBtn = t.closest<HTMLElement>("[data-allgraphs]");
    if (allGraphsBtn) { setAllGraphsAllowed(!allGraphsAllowed); return; }
    // The graph's "Review in Index →" button → jump to the Index page at that lift.
    const review = t.closest<HTMLElement>("[data-graphreview]");
    if (review?.dataset.graphreview) { reviewGraphsForExercise(review.dataset.graphreview); return; }
    // "Save taxonomy" inside an exercise's Index inspector / ℹ overlay. Delegated
    // on document so it works wherever the taxonomy editor is shown.
    const taxSave = t.closest<HTMLElement>(".wa-assign-save");
    if (taxSave?.dataset.waassign) { saveTaxonomyAssignment(taxSave, taxSave.dataset.waassign); return; }
    // Categories-mode picker: a category pill opens its floating exercise dropdown;
    // the dropdown has per-exercise toggles + a Select/Deselect-all for the group.
    // Delegated on document because the dropdown lives at the body root (it floats).
    const catPill = t.closest<HTMLElement>(".wa-cat-pill");
    if (catPill?.dataset.wacat !== undefined) {
      const scope = (catPill.closest<HTMLElement>("[data-selscope]")?.dataset.selscope as SelScope) ?? "hist";
      if (waCatMenuKey === catPill.dataset.wacat) closeWaCatMenu();
      else openWaCatMenu(catPill.dataset.wacat, catPill, scope);
      return;
    }
    const catMenu = document.getElementById("waCatMenu");
    if (catMenu && !catMenu.hidden && waCatMenuKey !== null) {
      curSelScope = waCatMenuScope; // the menu edits whichever selector opened it
      if (t.closest(".wa-catclose")) { closeWaCatMenu(); return; }
      const allBtn = t.closest<HTMLElement>(".wa-catall");
      if (allBtn) {
        const turnOn = allBtn.dataset.catallon === "1";
        const set = new Set(selArr());
        for (const it of waCatItems(waCatMenuKey)) { if (turnOn) set.add(it.name); else set.delete(it.name); }
        setSelArr([...set]);
        renderWaCatMenu();   // refresh the dropdown + its all-toggle label
        renderWaChips();     // refresh the category-pill counts behind it
        debounceWaRender();  // graph / history / calendar catch up
        return;
      }
      const minfo = t.closest<HTMLElement>("[data-waexinfo]");
      if (minfo?.dataset.waexinfo && catMenu.contains(minfo)) { openExerciseInfo(minfo.dataset.waexinfo); return; }
      const mchip = t.closest<HTMLElement>(".wa-ex-chip");
      if (mchip?.dataset.waex && catMenu.contains(mchip)) {
        const n = mchip.dataset.waex;
        setSelArr(selArr().includes(n) ? selArr().filter((x) => x !== n) : [...selArr(), n]);
        const on = selArr().includes(n);
        mchip.classList.toggle("is-on", on); // instant feedback (don't rebuild the menu)
        mchip.setAttribute("aria-pressed", String(on));
        // Update just the head count + all-toggle, so the menu keeps its scroll.
        const items = waCatItems(waCatMenuKey);
        const sel = waSelCount(items);
        const allOn = items.length > 0 && sel >= items.length;
        const cnt = catMenu.querySelector<HTMLElement>(".wa-cat-menu-title .muted");
        if (cnt) cnt.textContent = `${sel}/${items.length}`;
        const allB = catMenu.querySelector<HTMLElement>(".wa-catall");
        if (allB) { allB.dataset.catallon = allOn ? "0" : "1"; allB.textContent = allOn ? "Deselect all" : "Select all"; }
        renderWaChips();     // the category-pill count behind catches up
        debounceWaRender();
        return;
      }
      if (!catMenu.contains(t)) closeWaCatMenu(); // click anywhere else closes it
    }
  });
  // Note-variation difficulty: edit (change) and reset (click). Delegated on
  // document so it works inside the Index page's expandable info dropdown.
  document.addEventListener("change", (e) => {
    // The popover's inline INCLINE scale (smith/sq/cm level) — save it (the override
    // wins over the seeded incline default) and re-render the popover so the chip
    // updates; the table/graphs sync on close.
    const lvlIn = (e.target as HTMLElement).closest<HTMLInputElement>(".scale-edit-lvl");
    if (lvlIn && (lvlIn.dataset.levelkey || lvlIn.dataset.incdim)) {
      let v = Number(lvlIn.value);
      if (!Number.isFinite(v)) v = 1;
      v = Math.min(5, Math.max(0.1, Math.round(v * 100) / 100));
      if (lvlIn.dataset.incdim) setInclineScale(lvlIn.dataset.incdim as LevelDim, Number(lvlIn.dataset.incval), v);
      else setLevelScale(lvlIn.dataset.levelkey!, v);
      if (scaleEditState) { scaleEditDirty = true; renderScaleEditor(); }
      return;
    }
    // The global INCLINE editor (Settings / exercise info → Difficulty multipliers):
    // save the level's shared scale + recolour the cell, apply app-wide debounced.
    const inc = (e.target as HTMLElement).closest<HTMLInputElement>(".inc-input");
    if (inc?.dataset.incdim && inc.dataset.incval !== undefined) {
      const v = Number(inc.value);
      if (Number.isFinite(v) && v > 0) {
        setInclineScale(inc.dataset.incdim as LevelDim, Number(inc.dataset.incval), Math.round(v * 1000) / 1000);
        inc.closest(".fac-cell")?.classList.add("is-ov");
        scheduleModelFactorsApply();
      }
      return;
    }
    // Edit a difficulty-model factor. Keep it light so you can edit many in a row:
    // save + recolour just this cell (no rebuild of the editor you're in → focus &
    // scroll stay put), and apply to the rest of the app debounced after you pause.
    // World-record inputs: read both kg + bw for that exercise/sex and save together.
    const wr = (e.target as HTMLElement).closest<HTMLInputElement>(".wr-input");
    if (wr?.dataset.wrEx && (wr.dataset.wrSex === "m" || wr.dataset.wrSex === "f")) {
      const scope = wr.closest(".fac-dim");
      const num = (f: string) => { const el = scope?.querySelector<HTMLInputElement>(`[data-wr-f="${f}"]`); return el && el.value !== "" ? Number(el.value) : null; };
      setWorldRecord(wr.dataset.wrEx, wr.dataset.wrSex, num("kg"), num("bw"));
      scheduleModelFactorsApply();
      return;
    }
    const fac = (e.target as HTMLElement).closest<HTMLInputElement>(".fac-input");
    if (fac?.dataset.facFam && fac.dataset.facDim && fac.dataset.facLvl !== undefined) {
      const v = Number(fac.value);
      if (Number.isFinite(v) && v > 0) {
        setFamFactor(fac.dataset.facFam, fac.dataset.facDim, fac.dataset.facLvl, Math.round(v * 1000) / 1000);
        const isOv = famFactorOverrides[fac.dataset.facFam]?.[fac.dataset.facDim]?.[fac.dataset.facLvl] !== undefined;
        fac.closest(".fac-cell")?.classList.toggle("is-ov", isOv);
        // The band knob drives all 6 bands — update its live preview in place.
        if (fac.dataset.facDim === "bandKnob") {
          const famEsc = fac.dataset.facFam;
          document.querySelectorAll<HTMLElement>(`.band-knob-preview[data-fam="${CSS.escape(famEsc)}"]`).forEach((el) => { el.textContent = bandPreviewText(famEsc); });
        }
        scheduleModelFactorsApply();
      }
      return;
    }
    // Rename a note (its readable label) — applies wherever the note is shown.
    const ren = (e.target as HTMLElement).closest<HTMLInputElement>(".ex-var-rename");
    if (ren?.dataset.renameEx && ren.dataset.renameNote !== undefined) {
      setNoteRename(ren.dataset.renameEx, ren.dataset.renameNote, ren.value);
      refreshAfterDifficultyEdit();
      return;
    }
    const input = (e.target as HTMLElement).closest<HTMLInputElement>(".ex-var-input");
    if (!input?.dataset.varEx || input.dataset.varNote === undefined) return;
    const v = Number(input.value);
    if (Number.isFinite(v) && v > 0) setVariationScale(input.dataset.varEx, input.dataset.varNote, Math.round(v * 100) / 100);
    if (scaleEditState) {
      scaleEditDirty = true;
      closeScaleEditor(); // a selection in the floating popover closes it
    } else {
      refreshAfterDifficultyEdit();
    }
  });
  // Close button on the floating modifier editor.
  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".scale-edit-close")) closeScaleEditor();
  });
  // Per-note ATTRIBUTE picker (model lifts): click a dimension's level chip (DM3).
  document.addEventListener("click", (e) => {
    const lvl = (e.target as HTMLElement).closest<HTMLElement>(".ex-var-lvl");
    if (!lvl?.dataset.vecdimEx || lvl.dataset.vecdimNote === undefined || !lvl.dataset.vecdimDim || lvl.dataset.vecdimLevel === undefined) return;
    setNoteVecDim(lvl.dataset.vecdimEx, lvl.dataset.vecdimNote, lvl.dataset.vecdimDim, lvl.dataset.vecdimLevel);
    if (scaleEditState) {
      // In the floating popover, a selection closes it (which syncs the table/graph).
      scaleEditDirty = true;
      closeScaleEditor();
    } else {
      refreshAfterDifficultyEdit();
    }
  });
  // Nested SUPPORT dropdowns (support / ladder grip / ladder height) — custom
  // floating .xdd menus, never native <select>. Tapping the button toggles its
  // menu; picking an option sets the dim and re-renders in place (so "ladder"
  // reveals its sub-dropdowns).
  document.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".ex-vecbtn");
    if (btn) {
      const dd = btn.closest(".ex-var-xdd");
      const menu = dd?.querySelector<HTMLElement>(".xdd-menu");
      const opening = !!menu?.hasAttribute("hidden");
      document.querySelectorAll<HTMLElement>(".ex-var-xdd .xdd-menu").forEach((m) => m.setAttribute("hidden", ""));
      document.querySelectorAll<HTMLElement>(".ex-var-xdd").forEach((d) => d.classList.remove("open"));
      if (menu && opening) { menu.removeAttribute("hidden"); dd?.classList.add("open"); }
      return;
    }
    const opt = (e.target as HTMLElement).closest<HTMLElement>(".ex-vecopt");
    if (!opt?.dataset.vecdimEx || opt.dataset.vecdimNote === undefined || !opt.dataset.vecdimDim || opt.dataset.vecdimLevel === undefined) return;
    setNoteVecDim(opt.dataset.vecdimEx, opt.dataset.vecdimNote, opt.dataset.vecdimDim, opt.dataset.vecdimLevel);
    if (scaleEditState) { scaleEditDirty = true; renderScaleEditor(); }
    else { refreshAfterDifficultyEdit(); }
  });
  // Depth × lean SQUARE pad: drag the handle anywhere to set BOTH at once. y: TOP =
  // higher/easier, BOTTOM = deeper/harder. x: rightmost = no lean (reversed). The
  // wall is always on the left (data-mirror is kept at 0), so the lean direction and
  // fill side never flip. The fill grows up from the floor to the handle; readout =
  // lean × depth; sync deferred.
  let padDrag: HTMLElement | null = null;
  const padSet = (pad: HTMLElement, clientX: number, clientY: number) => {
    const ex = pad.dataset.padex, note = pad.dataset.padnote;
    const romKeys = (pad.dataset.romkeys ?? "").split("|"), leanKeys = (pad.dataset.leankeys ?? "").split("|");
    if (!ex || note === undefined || romKeys.length === 0 || leanKeys.length === 0) return;
    const fam = familyOf(ex);
    if (!fam) return;
    const mirror = pad.dataset.mirror === "1";
    const noLean = pad.dataset.nolean === "1"; // free handstand → depth only, lean locked
    const r = pad.getBoundingClientRect();
    const xf = Math.max(0, Math.min(1, r.width ? (clientX - r.left) / r.width : 0));
    const yf = Math.max(0, Math.min(1, r.height ? (clientY - r.top) / r.height : 0));
    const leanFrac = mirror ? xf : 1 - xf; // not-mirror: rightmost = no lean
    const li = noLean ? 0 : Math.round(leanFrac * (leanKeys.length - 1));
    const di = Math.round(yf * (romKeys.length - 1)); // 0 = top = easiest
    const rk = romKeys[di]!, lk = leanKeys[li]!;
    setNoteVecDim(ex, note, "rom", rk);
    if (!noLean) setNoteVecDim(ex, note, "lean", lk);
    const romF = famLevels(fam, "rom")[rk] ?? 1, leanF = noLean ? 1 : leanFactorFor(fam, pad.dataset.support ?? "", lk);
    const mult = Math.round(romF * leanF * 100) / 100;
    const dotLeft = noLean ? 50 : xf * 100, dotTop = yf * 100;
    const wrap = pad.closest(".ex-pad-dim");
    const set = (sel: string, txt: string) => { const el = wrap?.querySelector(sel); if (el) el.textContent = txt; };
    set(".ex-sl-rk", rk); set(".ex-sl-lk", lk); set(".ex-sl-mult", `×${mult}`);
    set(".ex-sl-rf", `×${romF}`); set(".ex-sl-lf", `×${leanF}`);
    const fill = pad.querySelector<HTMLElement>(".ex-pad-fill");
    if (fill) {
      fill.style.left = mirror ? "auto" : "0"; fill.style.right = mirror ? "0" : "auto"; fill.style.bottom = "0";
      fill.style.width = `${(noLean ? 100 : mirror ? 100 - dotLeft : dotLeft).toFixed(1)}%`;
      fill.style.height = `${(100 - dotTop).toFixed(1)}%`;
    }
    const dot = pad.querySelector<HTMLElement>(".ex-pad-dot");
    if (dot) { dot.style.left = `${dotLeft.toFixed(1)}%`; dot.style.top = `${dotTop.toFixed(1)}%`; }
    wrap?.classList.add("is-picked");
    const prod = pad.closest(".ex-var-picker")?.querySelector(".ex-var-product strong");
    if (prod) prod.textContent = `×${scalarFromVec(fam, { ...rNote(fam, note).vec, ...noteVecOverride(ex, note) })}`;
    if (scaleEditState) scaleEditDirty = true;
  };
  document.addEventListener("pointerdown", (e) => {
    const pad = (e.target as HTMLElement).closest<HTMLElement>(".ex-pad");
    if (!pad) return;
    padDrag = pad;
    try { pad.setPointerCapture((e as PointerEvent).pointerId); } catch { /* ignore */ }
    padSet(pad, (e as PointerEvent).clientX, (e as PointerEvent).clientY);
    e.preventDefault();
  });
  document.addEventListener("pointermove", (e) => {
    if (padDrag) padSet(padDrag, (e as PointerEvent).clientX, (e as PointerEvent).clientY);
  });
  document.addEventListener("pointerup", () => {
    if (!padDrag) return;
    padDrag = null;
    if (!scaleEditState) refreshAfterDifficultyEdit(); // sync on release (More-info page)
  });
  // Chips / Stickman / 3D model toggle for the modifier editor.
  document.addEventListener("click", (e) => {
    const m = (e.target as HTMLElement).closest<HTMLElement>(".ex-var-mode-btn");
    if (!m?.dataset.notemode) return;
    const mode = m.dataset.notemode;
    noteEditMode = mode === "pose" ? "pose" : mode === "stickman" ? "stickman" : mode === "photo" ? "photo" : "chips";
    renderScaleEditor();
    refreshExerciseInfo();
    refreshPoseViz();
  });
  // Visual pose editor: tap a control chip below the 3-D figure to set that
  // dimension (support / rom / lean). Updates the live scene + the multiplier in
  // place, without re-rendering the whole editor (so the orbit view isn't reset).
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".pose-ctl");
    if (!b) return;
    const ex = b.dataset.posectlEx;
    const note = b.dataset.posectlNote;
    const dim = b.dataset.posectlDim;
    const level = b.dataset.posectlLevel;
    if (!ex || note === undefined || !dim || level === undefined) return;
    const fam = familyOf(ex);
    if (!fam) return;
    setNoteVecDim(ex, note, dim, level);
    const vec = { ...rNote(fam, note).vec, ...noteVecOverride(ex, note) };
    // Update the live figure(s) without remounting (keep orbit / rep loop going).
    if (activePose3d) activePose3d.scene.update(vec);
    if (activeDrawn) activeDrawn.fig.update(vec);
    // Mark just this dimension's chips as selected.
    const row = b.closest(".ex-var-dim");
    row?.querySelectorAll<HTMLElement>(".pose-ctl").forEach((c) => c.classList.toggle("is-on", c === b));
    // Update the multiplier readout beside the figure.
    const pose = b.closest(".ex-var-pose");
    const prod = pose?.querySelector(".ex-var-product strong");
    if (prod) prod.textContent = `×${scalarFromVec(fam, vec)}`;
    // Defer the heavy table/graph sync (it collapses the expanded day) to
    // popover-close, like the chips editor does.
    if (scaleEditState) {
      scaleEditDirty = true;
    } else {
      refreshExerciseInfo();
      requestAnimationFrame(renderAll);
    }
  });
  // Scrub slider under the drawn figure: drag to "play" the rep down to the depth
  // you did — it scrubs the figure live and sets the range-of-motion (rom) level.
  const onScrub = (e: Event): void => {
    const sl = (e.target as HTMLElement).closest<HTMLInputElement>(".pose-scrub");
    if (!sl?.dataset.scrubex || sl.dataset.scrubnote === undefined) return;
    const ex = sl.dataset.scrubex, note = sl.dataset.scrubnote;
    const fam = familyOf(ex);
    if (!fam) return;
    const romKeys = Object.keys(FAMILIES[fam]!.dims.rom ?? {});
    if (romKeys.length < 2) return;
    const idx = Math.max(0, Math.min(romKeys.length - 1, parseInt(sl.value, 10) || 0));
    const frac = idx / (romKeys.length - 1);
    setNoteVecDim(ex, note, "rom", romKeys[idx]!);
    const vec = { ...rNote(fam, note).vec, ...noteVecOverride(ex, note) };
    if (activeDrawn) { activeDrawn.fig.update(vec); activeDrawn.fig.scrub(frac); } // hold at this depth
    const pose = sl.closest(".ex-var-pose");
    const prod = pose?.querySelector(".ex-var-product strong");
    if (prod) prod.textContent = `×${scalarFromVec(fam, vec)}`;
    const val = pose?.querySelector(".pose-scrub-val");
    if (val) val.textContent = romKeys[idx]!;
    // Reflect on the rom chip row too, without a full re-render.
    pose?.querySelectorAll<HTMLElement>('.pose-ctl[data-posectl-dim="rom"]').forEach((c) => c.classList.toggle("is-on", c.dataset.posectlLevel === romKeys[idx]));
    // NB: don't re-render here — that would destroy the slider mid-drag. The heavy
    // table/graph sync is deferred to release (the 'change' handler below).
    scaleEditDirty = true;
  };
  document.addEventListener("input", onScrub);
  // On release: resume the rep loop and do the deferred table/graph sync.
  document.addEventListener("change", (e) => {
    if (!(e.target as HTMLElement).closest?.(".pose-scrub")) return;
    if (activeDrawn) activeDrawn.fig.scrub(null);
    if (scaleEditState) return; // popover syncs on close (scaleEditDirty already set)
    scaleEditDirty = false;
    refreshExerciseInfo();
    scheduleRender();
  });
  // Photo scrubber: drag through the real video frames (top→bottom); swaps the
  // shown frame live and maps the position onto the range-of-motion (depth).
  document.addEventListener("input", (e) => {
    const sl = (e.target as HTMLElement).closest<HTMLInputElement>(".pose-photo-scrub");
    if (!sl?.dataset.scrubex || sl.dataset.scrubnote === undefined) return;
    const ex = sl.dataset.scrubex, note = sl.dataset.scrubnote;
    const fam = familyOf(ex);
    if (!fam) return;
    const romKeys = Object.keys(FAMILIES[fam]!.dims.rom ?? {});
    const N = POSE_FRAMES.length;
    const fIdx = Math.max(0, Math.min(N - 1, parseInt(sl.value, 10) || 0));
    const pose = sl.closest(".ex-var-pose");
    const img = pose?.querySelector<HTMLImageElement>(".pose-photo");
    if (img) img.src = POSE_FRAMES[fIdx]!; // scrub the real frame
    if (romKeys.length > 1) {
      const romIdx = Math.round((fIdx / (N - 1)) * (romKeys.length - 1));
      setNoteVecDim(ex, note, "rom", romKeys[romIdx]!);
      const vec = { ...rNote(fam, note).vec, ...noteVecOverride(ex, note) };
      const prod = pose?.querySelector(".ex-var-product strong");
      if (prod) prod.textContent = `×${scalarFromVec(fam, vec)}`;
      pose?.querySelectorAll<HTMLElement>('.pose-ctl[data-posectl-dim="rom"]').forEach((c) => c.classList.toggle("is-on", c.dataset.posectlLevel === romKeys[romIdx]));
      scaleEditDirty = true;
    }
  });
  document.addEventListener("change", (e) => {
    if (!(e.target as HTMLElement).closest?.(".pose-photo-scrub")) return;
    if (scaleEditState) return;
    scaleEditDirty = false;
    refreshExerciseInfo();
    scheduleRender();
  });
  // Inline identity/model editors on the More-info page (code / short / bw part).
  document.addEventListener("change", (e) => {
    const t = e.target as HTMLElement;
    const code = t.closest<HTMLInputElement>(".ex-edit-code");
    if (code?.dataset.editex) { setCodeOverride(code.dataset.editex, code.value); renderAll(); reopenIndexDetail(code.dataset.editex); return; }
    const short = t.closest<HTMLInputElement>(".ex-edit-short");
    if (short?.dataset.editex) { setShortOverride(short.dataset.editex, short.value); refreshExerciseInfo(); return; }
    // Bodyweight part RANGE: read both ends, store the range (1RM uses the average).
    const coeffEnd = t.closest<HTMLInputElement>(".ex-edit-coeff-min, .ex-edit-coeff-max");
    if (coeffEnd?.dataset.editex) {
      const ex = coeffEnd.dataset.editex;
      const wrap = coeffEnd.closest(".ex-coeff-range");
      const clampv = (s: string | undefined) => { let v = parseFloat(s ?? ""); if (!Number.isFinite(v)) v = 0; return Math.min(2, Math.max(0, v)); };
      const mn = clampv(wrap?.querySelector<HTMLInputElement>(".ex-edit-coeff-min")?.value);
      const mx = clampv(wrap?.querySelector<HTMLInputElement>(".ex-edit-coeff-max")?.value);
      setCoeffRange(ex, mn, mx);
      scheduleRender(() => reopenIndexDetail(ex));
      return;
    }
  });
  // Category / Muscle group / Tier are multi-select chips — tap to toggle membership
  // (a lift can belong to several at once); the ↺ chip resets to the auto default.
  document.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>(".ex-meta-chip, .ex-meta-reset");
    const ex = chip?.dataset.metaEx, kind = chip?.dataset.metaKind, val = chip?.dataset.metaVal;
    if (!ex || !kind || val === undefined) return;
    toggleMetaOverride(kind as MetaKind, ex, val);
    // grouping/colours depend on it (rebuilds the Index list); defer so the pill
    // feels instant and the page keeps its scroll, then reopen the inline panel.
    scheduleRender(() => { reopenIndexDetail(ex); refreshPoseViz(); });
  });
  // Muscle INVOLVEMENT level chips: cycle 0→1→2→3→4→0 (≥3 = shown in that muscle's
  // category); the ↺ resets all of this lift's muscle levels to the auto guess.
  document.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>(".ex-mglvl-chip, .ex-mglvl-reset");
    const ex = chip?.dataset.mglvlEx;
    if (!ex) return;
    if (chip!.classList.contains("ex-mglvl-reset")) resetMgLevel(ex);
    else {
      const m = chip!.dataset.mglvlMuscle as MuscleGroup;
      setMgLevel(ex, m, (mgLevelOf(ex, m) + 1) % 5);
    }
    scheduleRender(() => { reopenIndexDetail(ex); refreshPoseViz(); });
  });
  // Combinable / Comparable membership chips — toggle this lift in/out of a group.
  document.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>(".ex-meta-chip[data-grp-id]");
    const ex = chip?.dataset.grpEx, gid = chip?.dataset.grpId;
    if (!ex || !gid) return;
    toggleGroupMembership(gid, ex);
    scheduleRender(() => { reopenIndexDetail(ex); refreshPoseViz(); });
  });
  // Per-group display mode: cycle Combined only → Members only → Show both.
  document.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>(".wa-grpdisp[data-grpdisp-id]");
    const gid = chip?.dataset.grpdispId;
    if (!gid) return;
    const cur = groupDisplayFor(gid);
    setGroupDisplay(gid, cur === "combined" ? "members" : cur === "members" ? "both" : "combined");
    const ex = chip!.dataset.grpdispEx ?? null;
    scheduleRender(() => { if (ex) reopenIndexDetail(ex); renderWorkoutAnalysis(); });
  });
  // The comparable-ratio input next to a selected comparable group chip.
  document.addEventListener("change", (e) => {
    const inp = (e.target as HTMLElement).closest<HTMLInputElement>(".ex-grp-ratio");
    const ex = inp?.dataset.grpratioEx, gid = inp?.dataset.grpratioId;
    if (!ex || !gid) return;
    const v = parseFloat(inp.value);
    if (Number.isFinite(v)) setGroupRatio(gid, ex, v);
    scheduleRender(() => reopenIndexDetail(ex));
  });
  // Per-note "not comparable" toggle in the variation review (click).
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".ex-var-nc-btn");
    if (!b?.dataset.ncEx || b.dataset.ncNote === undefined) return;
    setNoteNotComparable(b.dataset.ncEx, b.dataset.ncNote, !isNoteNotComparable(b.dataset.ncEx, b.dataset.ncNote));
    if (scaleEditState) { scaleEditDirty = true; closeScaleEditor(); return; }
    refreshAfterDifficultyEdit();
  });
  document.addEventListener("click", (e) => {
    const rb = (e.target as HTMLElement).closest<HTMLElement>(".ex-var-reset");
    if (!rb?.dataset.varresetEx || rb.dataset.varresetNote === undefined) return;
    // Model lift → clear the attribute picks; otherwise clear the number pin.
    if (familyOf(rb.dataset.varresetEx)) clearNoteVec(rb.dataset.varresetEx, rb.dataset.varresetNote);
    else clearVariationScale(rb.dataset.varresetEx, rb.dataset.varresetNote);
    if (scaleEditState) { scaleEditDirty = true; closeScaleEditor(); return; }
    refreshAfterDifficultyEdit();
  });
  // Remember which note-variation editors are expanded (the `toggle` event doesn't
  // bubble, so listen in the capture phase) — so an edit-driven re-render keeps the
  // one you're working in open.
  document.addEventListener("toggle", (e) => {
    const d = e.target as HTMLElement;
    if (!d.classList || !d.classList.contains("ex-var-edit-fold")) return;
    const ex = d.dataset.editfoldEx, note = d.dataset.editfoldNote;
    if (!ex || note === undefined) return;
    const k = variationKey(ex, note);
    if ((d as HTMLDetailsElement).open) openVarNotes.add(k); else openVarNotes.delete(k);
  }, true);
  // Merged-lift controls on the exercise info page: separate one member back out,
  // or dissolve the whole merge.
  document.addEventListener("click", (e) => {
    const sep = (e.target as HTMLElement).closest<HTMLElement>(".ex-merge-sep");
    if (sep?.dataset.sepmerge && sep.dataset.sepmember) { separateMergeMember(sep.dataset.sepmerge, sep.dataset.sepmember); return; }
    const dis = (e.target as HTMLElement).closest<HTMLElement>(".ex-merge-dissolve");
    if (dis?.dataset.dissolvemerge) { dissolveMerge(dis.dataset.dissolvemerge); return; }
  });
  // A "who & when" entry under a note: jump to that athlete's Analysis for this
  // lift, scrolled to the date where the note was logged.
  document.addEventListener("click", (e) => {
    const j = (e.target as HTMLElement).closest<HTMLElement>(".ex-var-jump");
    if (j?.dataset.jumpuser && j.dataset.jumpex && j.dataset.jumpdate)
      gotoNoteSet(j.dataset.jumpuser, j.dataset.jumpex, j.dataset.jumpdate);
  });

  els.formula.addEventListener("change", () => scheduleRender());
  els.excludeDropsets.addEventListener("change", () => scheduleRender());
  els.athlete.addEventListener("change", () => deferRender(renderAthlete));
  // Clicking a custom chip drives the hidden <select> (single source of truth).
  els.athleteSexFilter.addEventListener("click", () => {
    // Single cycling toggle: Men ⇄ Women (always one or the other, never "both").
    athleteSexFilter = athleteSexFilter === "m" ? "f" : "m";
    syncSexToggle();
    syncAthleteChips(); // re-apply the visible/hidden chip set
  });
  els.athleteChips.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".athlete-chip");
    if (!btn?.dataset.username || btn.dataset.username === els.athlete.value) return;
    // Outside admin, only the locked athlete's chip is selectable.
    const lock = lockedUsername();
    if (lock && btn.dataset.username !== lock) return;
    els.athlete.value = btn.dataset.username;
    renderAthlete();
  });
  els.workoutCalendar.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    // Custom filter dropdown: toggle its menu, or pick an option.
    if (target.closest(".xdd-heat .xdd-btn")) {
      const dd = target.closest<HTMLElement>(".xdd-heat")!;
      const menu = dd.querySelector<HTMLElement>(".xdd-menu")!;
      const opening = menu.hasAttribute("hidden");
      menu.toggleAttribute("hidden", !opening);
      dd.classList.toggle("open", opening);
      return;
    }
    if (target.closest("[data-heatclear]")) {
      S.heatFilters = [];
      // close the dropdown
      const dd = target.closest<HTMLElement>(".xdd-heat");
      dd?.querySelector<HTMLElement>(".xdd-menu")?.toggleAttribute("hidden", true);
      dd?.classList.remove("open");
      return renderWorkoutCalendar();
    }
    const heatOpt = target.closest<HTMLElement>(".xdd-heat .xdd-opt:not(.xdd-clear)");
    if (heatOpt?.dataset.heatval !== undefined) {
      const val = heatOpt.dataset.heatval;
      const idx = S.heatFilters.indexOf(val);
      if (idx >= 0) S.heatFilters.splice(idx, 1);
      else S.heatFilters.push(val);
      // Don't close the dropdown — let the user pick multiple
      return renderWorkoutCalendar();
    }
    // Under-calendar pills drive the WHOLE analysis selection (waSelected), so the
    // graph, history and calendar all move together. "All" clears the selection; a
    // group pill toggles all of that group's lifts; an exercise pill toggles itself.
    // Tapping a pill re-renders the whole analysis section (list, chart, calendar);
    // keep the page exactly where it is so it doesn't jump. Restore on the next
    // frame too, since the charts mount asynchronously and can reflow after.
    const keepScroll = (fn: () => void) => {
      const y = window.scrollY;
      fn();
      window.scrollTo(0, y);
      requestAnimationFrame(() => window.scrollTo(0, y));
    };
    if (target.closest("[data-heatall]")) {
      waSelected = [];
      keepScroll(renderWorkoutAnalysis);
      return;
    }
    const pill = target.closest<HTMLElement>("[data-heatpill]");
    if (pill?.dataset.heatpill) {
      const val = pill.dataset.heatpill;
      const sep = val.indexOf(":");
      const dim = val.slice(0, sep) as HeatColorDim;
      const v = val.slice(sep + 1);
      if (dim === "ex") {
        waSelected = waSelected.includes(v) ? waSelected.filter((x) => x !== v) : [...waSelected, v];
      } else {
        const exs = exercisesInGroup(dim, v);
        const allOn = exs.length > 0 && exs.every((e) => waSelected.includes(e));
        waSelected = allOn ? waSelected.filter((e) => !exs.includes(e)) : [...new Set([...waSelected, ...exs])];
      }
      keepScroll(renderWorkoutAnalysis);
      return;
    }
    const scopeBtn = target.closest<HTMLElement>(".cal-mode-btn");
    if (scopeBtn?.dataset.heatScope) {
      const v = scopeBtn.dataset.heatScope;
      S.heatScope = v === "all" ? "all" : v === "single" ? "single" : "ribbon";
      return renderWorkoutCalendar();
    }
    const nav = target.closest<HTMLElement>(".cal-nav");
    if (nav?.dataset.heat === "prev") return shiftHeatYear(-1); // older year
    if (nav?.dataset.heat === "next") return shiftHeatYear(1); // newer year
    // "Tag alone": arm/disarm paint mode so day taps toggle the alone tag.
    if (target.closest<HTMLElement>(".cal-tagmode")) {
      S.aloneTagMode = !S.aloneTagMode;
      return renderWorkoutCalendar();
    }
    // 2× zoom: double every heatmap cell (same colours/layout, still scrollable).
    if (target.closest<HTMLElement>(".cal-zoom-btn")) {
      calZoom = !calZoom;
      return renderWorkoutCalendar();
    }
    const cell = target.closest<HTMLElement>(".hm-cell[data-date]");
    // In paint mode, tapping a trained day toggles its "alone" tag in place
    // (no jump) so many days can be tagged quickly without scrolling the list.
    if (S.aloneTagMode && cell?.dataset.date) {
      const key = aloneKey(cell.dataset.date);
      if (aloneTags.has(key)) aloneTags.delete(key);
      else aloneTags.add(key);
      saveAlone();
      cell.classList.toggle("hm-alone", aloneTags.has(key)); // live ring, no full re-render
      return;
    }
    // Otherwise, tapping a trained day in the heatmap jumps to it in the list below.
    if (cell?.dataset.date) jumpToWorkoutDate(cell.dataset.date);
  });
  // "Group by" dimension picker under the calendar — changing it clears the
  // filter so the pills regenerate for the new grouping.
  els.workoutCalendar.addEventListener("change", (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>(".hm-groupby-sel");
    // Changing the colour/grouping dimension only re-buckets the pills + recolours;
    // it must NOT clear the shared selection (that would un-sync from the graph).
    if (sel) { S.heatColorBy = sel.value as HeatColorDim; renderWorkoutCalendar(); }
  });
  // Close the heatmap filter menu on any click outside it.
  document.addEventListener("click", (e) => {
    for (const dd of document.querySelectorAll<HTMLElement>(".xdd-heat.open"))
      if (!dd.contains(e.target as Node)) {
        dd.classList.remove("open");
        dd.querySelector<HTMLElement>(".xdd-menu")?.setAttribute("hidden", "");
      }
    // Same for any open per-set RIR dropdown.
    if (!(e.target as HTMLElement).closest(".xdd-rpe.open")) closeAllRpeMenus();
    // Close the floating modifier editor when clicking outside it (but not when
    // clicking the chip that toggles it, which is handled in the set-row handler).
    // `t.isConnected` guards against an in-popover control (Chips/Pose toggle, pose
    // wall) that just re-rendered the popover and orphaned the click target — that
    // isn't a genuine outside click, so the editor should stay open.
    const t = e.target as HTMLElement;
    if (scaleEditState && t.isConnected && !t.closest("#scaleEditPop") && !t.closest(".set-scale.is-editable")) closeScaleEditor();
  });
  els.summariseBtn.addEventListener("click", runSummary);
  // Each control is one toggle button now: tap to flip its value (no segments).
  els.workoutViewToggle.addEventListener("click", () => {
    // Cycle Day → Week → 2 wks → Month → 3 mo → Day.
    const i = WO_VIEW_MODES.indexOf(S.workoutViewMode);
    S.workoutViewMode = WO_VIEW_MODES[(i + 1) % WO_VIEW_MODES.length]!;
    S.workoutsPage = 0;
    renderWorkoutsPage();
  });
  // EXPERIMENTAL horizontal history: its grouping cycle mirrors the ⚙ toggle
  // (same shared S.workoutViewMode). Delegated since the button is re-rendered.
  document.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest("#hhPeriod")) return;
    const i = WO_VIEW_MODES.indexOf(S.workoutViewMode);
    S.workoutViewMode = WO_VIEW_MODES[(i + 1) % WO_VIEW_MODES.length]!;
    S.workoutsPage = 0;
    syncWorkoutToggles();
    renderWorkoutsPage();
  });
  els.workoutShowToggle.addEventListener("click", () => {
    S.workoutShowMode = S.workoutShowMode === "exercises" ? "groups" : "exercises";
    renderWorkoutsPage();
  });
  // Settings → "Exercise names shown as" — the global name-mode picker.
  document.getElementById("nameModeRow")?.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".name-mode-opt");
    if (!b?.dataset.namemode) return;
    setNameMode(b.dataset.namemode as NameMode);
    applyNameModeChange();
  });
  syncNameModeButtons();
  els.workoutGrouping.addEventListener("change", () => deferRender(renderWorkoutsPage));
  els.workoutsPageBtn.addEventListener("click", () => {
    S.workoutsPageSize = S.workoutsPageSize === 50 ? 20 : 50;
    S.workoutsPage = 0;
    renderWorkoutsPage();
  });
  els.restToggle.addEventListener("click", () => {
    S.showRestDays = !S.showRestDays;
    S.workoutsPage = 0;
    renderWorkoutsPage();
  });
  els.addSetsToggle.addEventListener("click", () => {
    S.showAddSets = !S.showAddSets;
    localStorage.setItem("colosseum.showAddSets", S.showAddSets ? "1" : "0");
    renderWorkoutsPage();
  });
  els.aloneTagToggle.addEventListener("click", () => {
    S.showAloneTags = !S.showAloneTags;
    localStorage.setItem("colosseum.showAloneTags", S.showAloneTags ? "1" : "0");
    renderWorkoutsPage();
  });
  els.woShowAllToggle.addEventListener("click", () => setWoShowAll(!woShowAllExercises));
  // Per-day "hidden N/M": reveal/hide JUST that day's hidden lifts, in place — a
  // pure DOM toggle (no global flag, no re-render, no scroll jump). PB-2.
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-woshowday]");
    if (!b) return;
    const lines = b.parentElement?.querySelector<HTMLElement>(".wo-hidden-day-lines");
    if (!lines) return;
    const show = lines.hasAttribute("hidden");
    lines.toggleAttribute("hidden", !show);
    b.setAttribute("aria-expanded", show ? "true" : "false");
    b.classList.toggle("is-active", show);
    b.textContent = `${show ? "hide" : "hidden"} ${b.dataset.hlabel ?? ""}`;
  });
  // Same reveal in the EXPANDED (tapped-open) day: toggle that session's hidden
  // lifts' full set-rows in place. Pure DOM, like the per-day collapsed one.
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-woshowexp]");
    if (!b) return;
    const box = b.parentElement?.querySelector<HTMLElement>(".wo-hidden-exp");
    if (!box) return;
    const show = box.hasAttribute("hidden");
    box.toggleAttribute("hidden", !show);
    b.setAttribute("aria-expanded", show ? "true" : "false");
    b.classList.toggle("is-active", show);
    b.textContent = `${show ? "hide" : "hidden"} ${b.dataset.hlabel ?? ""}`;
  });
  // Outside-click closes any open FLOATING popout <details> (a menu whose body is
  // position:absolute — the ⚙ display options, Graph options, Exercises, Legend,
  // ⚙ identity, Group, period & progress menus). Detected by computed position so
  // it covers EVERY such menu now and any added later — never per-menu wiring (the
  // recurring bug). Inline disclosures (graph/calendar sections, changelog rows)
  // push content (static position) so they're left alone. Capture phase so a
  // bubble-phase stopPropagation elsewhere can't suppress it. PB-4.
  document.addEventListener("click", (e) => {
    const t = e.target as Node;
    for (const d of document.querySelectorAll<HTMLDetailsElement>("details[open]")) {
      if (d.contains(t)) continue; // click inside the menu → leave it open
      const body = d.querySelector<HTMLElement>(":scope > :not(summary)");
      if (body && getComputedStyle(body).position === "absolute") d.open = false;
    }
  }, true);
  els.aloneFilter.addEventListener("click", () => {
    aloneFilter = ALONE_FILTER_NEXT[aloneFilter];
    els.aloneFilter.dataset.state = aloneFilter;
    S.workoutsPage = 0;
    renderWorkoutsPage();
  });

  // Expand/collapse rows.
  els.lbTable.addEventListener("click", onLeaderboardRowClick);
  els.athleteTable.addEventListener("click", onExerciseRowClick);
  // Squat-rack holes panel: editing a hole's BW % rescales every set at that
  // hole; re-render the drill-in so the effort 1RMs update live.
  els.exLevels.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    if (!el.classList.contains("exl-scale")) return;
    let v = parseFloat(el.value);
    if (!Number.isFinite(v)) v = 1;
    v = Math.min(5, Math.max(0, v));
    // Incline level → the GLOBAL incline store; any other level → per-exercise.
    if (el.dataset.incdim) setInclineScale(el.dataset.incdim as LevelDim, Number(el.dataset.incval), v);
    else if (el.dataset.levelkey !== undefined) setLevelScale(el.dataset.levelkey, v);
    else return;
    if (selectedExercise) renderExerciseDetail(selectedExercise);
  });
  // Back link in the exercise drill-in (lives in the title, outside the table).
  els.athleteTitle.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest(".back-btn")) {
      // Back to the unfiltered Workout-analysis view (clear the selection) — not
      // the old standalone Exercises list.
      selectedExercise = null;
      openWorkoutAnalysis({ exercises: [] });
      return;
    }
    // Switch-exercise dropdown: toggle the menu …
    const switchBtn = t.closest<HTMLElement>(".ex-switch-btn");
    if (switchBtn) {
      const dd = switchBtn.closest<HTMLElement>(".xdd");
      const menu = dd?.querySelector<HTMLElement>(".xdd-menu");
      if (dd && menu) {
        const opening = menu.hasAttribute("hidden");
        menu.toggleAttribute("hidden", !opening);
        dd.classList.toggle("open", opening);
      }
      return;
    }
    // … and pick a lift to switch to.
    const opt = t.closest<HTMLElement>(".xdd-opt[data-switchex]");
    if (opt?.dataset.switchex) {
      if (opt.dataset.switchex !== selectedExercise) {
        selectedExercise = opt.dataset.switchex;
        combinedWith = [];
        renderExercisesPage();
      }
      return;
    }
    const info = t.closest<HTMLElement>(".ex-info-btn");
    if (info?.dataset.exinfo) jumpToExerciseInfo(info.dataset.exinfo);
  });
  // Close the switch-exercise dropdown when clicking elsewhere.
  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".ex-switch-dd")) return;
    const menu = els.athleteTitle.querySelector<HTMLElement>(".ex-switch-dd .xdd-menu");
    if (menu && !menu.hasAttribute("hidden")) {
      menu.setAttribute("hidden", "");
      menu.closest(".xdd")?.classList.remove("open");
    }
  });
  // Combine bar: add (select) / remove (chip ✕) an exercise to view together.
  els.exCombineBar.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    // Save the current "viewing together" set as a permanent merged lift.
    if (t.closest(".ex-combine-save")) { saveCurrentCombine(); return; }
    // Toggle the custom "+ combine with…" dropdown.
    const btn = t.closest(".ex-combine-btn");
    if (btn) {
      const dd = btn.closest<HTMLElement>(".xdd");
      const menu = dd?.querySelector<HTMLElement>(".xdd-menu");
      if (dd && menu) {
        const opening = menu.hasAttribute("hidden");
        menu.toggleAttribute("hidden", !opening);
        dd.classList.toggle("open", opening);
      }
      return;
    }
    // Pick an exercise to combine in.
    const opt = t.closest<HTMLElement>("[data-combineadd]");
    if (opt?.dataset.combineadd) {
      const n = opt.dataset.combineadd;
      if (selectedExercise !== null && n !== selectedExercise && !combinedWith.includes(n)) combinedWith.push(n);
      renderExercisesPage();
      return;
    }
    // Remove a combined chip.
    const chip = t.closest<HTMLElement>(".ex-combine-chip[data-remove]");
    if (chip?.dataset.remove) {
      combinedWith = combinedWith.filter((n) => n !== chip.dataset.remove);
      renderExercisesPage();
    }
  });
  // Close the combine dropdown when clicking elsewhere.
  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".ex-combine-dd")) return;
    const menu = els.exCombineBar.querySelector<HTMLElement>(".ex-combine-dd .xdd-menu");
    if (menu && !menu.hasAttribute("hidden")) {
      menu.setAttribute("hidden", "");
      menu.closest(".xdd")?.classList.remove("open");
    }
  });
  els.workoutsTable.addEventListener("click", onWorkoutRowClick);

  // Reps↔weight calculator table in the exercise drill-in: editing a weight or
  // reps cell recomputes the other cell IN THAT ROW (delegated so it works for
  // rows added later). The source cell is the one being typed, so they don't fight.
  els.ecalcRows.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    const tr = target.closest<HTMLTableRowElement>("tr.ecalc-row");
    if (!tr) return;
    const index = Number(tr.dataset.index);
    if (target.classList.contains("ecalc-cell-weight")) onExerciseCalcInput(index, "weight");
    else if (target.classList.contains("ecalc-cell-reps")) onExerciseCalcInput(index, "reps");
  });
  // Delete-row buttons (delegated). Re-render reindexes the remaining rows.
  els.ecalcRows.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".ecalc-del");
    if (!btn) return;
    const tr = btn.closest<HTMLTableRowElement>("tr.ecalc-row");
    if (tr) ecalcRemoveRow(Number(tr.dataset.index));
  });
  els.ecalcAddRow.addEventListener("click", ecalcAddRow);

  // Period filter for the exercises list — a custom dropdown (not a native
  // select) so the menu looks the same on every OS.
  setupExerciseRange();
  setupExerciseSort();
  setupExerciseSearch();

  // Athlete-view tabs (legacy view): Workouts | List & stats | Compare | Single.
  els.exercisesTabs.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".ex-tab");
    if (btn?.dataset.extab) selectExerciseTab(btn.dataset.extab);
  });

  // Kebab (⋯) opens the filters/sort menu; click-outside closes it.
  els.exFiltersBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    els.exerciseFilter.hidden = !els.exerciseFilter.hidden;
  });
  // Rep-max reps live in the column header now: editing the header input (fires
  // on blur/Enter, so typing doesn't lose focus) recalculates the column.
  els.athleteTable.addEventListener("change", (e) => {
    if ((e.target as HTMLElement).closest(".set-edit-input, .set-edit-note")) { onSetEditInput(e); return; }
    const inp = (e.target as HTMLElement).closest<HTMLInputElement>(".rm-col-input");
    if (!inp) return;
    const n = Math.round(Number(inp.value));
    repMaxCols = Number.isFinite(n) && n >= 1 && n <= 30 ? [n] : [1];
    if (exercisesTab === "list" && selectedExercise === null) renderExercisesPage();
  });
  els.workoutsTable.addEventListener("change", onSetEditInput); // per-set edits in the Workouts sets tables
  // Category picker bar: tap a category chip to show/hide it in the list.
  els.exCatBar.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>(".ex-cat-chip");
    if (!chip?.dataset.cat) return;
    const cat = chip.dataset.cat;
    if (hiddenExCats.has(cat)) hiddenExCats.delete(cat);
    else hiddenExCats.add(cat);
    try { localStorage.setItem("colosseum.hiddenCats", JSON.stringify([...hiddenExCats])); } catch { /* ignore */ }
    renderExercisesPage();
  });
  document.addEventListener("click", (e) => {
    if (!els.exerciseFilter.hidden && !els.exerciseFilter.contains(e.target as Node) && e.target !== els.exFiltersBtn)
      els.exerciseFilter.hidden = true;
  });

  // Compare-graph chips: toggle an exercise in/out of the overlay (delegated).
  els.compareChips.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>(".compare-chip");
    if (!chip?.dataset.ex) return;
    const name = chip.dataset.ex;
    if (compareSelected.has(name)) compareSelected.delete(name);
    else compareSelected.add(name);
    renderCompareChips(); // keeps the selected count + chip states in sync
    renderCompareChart();
  });
  // Search box filters the chip list to anything matching by name.
  els.compareSearch.addEventListener("input", () => {
    compareChipQuery = els.compareSearch.value;
    renderCompareChips();
  });
  // Category / tier quick-picks add or remove a whole group at once.
  els.compareCats.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".compare-group");
    if (btn?.dataset.cat) compareToggleCategory(btn.dataset.cat);
  });
  els.compareTiers.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".compare-group");
    if (btn?.dataset.tier) compareToggleTier(btn.dataset.tier);
  });
  els.compareClear.addEventListener("click", () => {
    compareSelected.clear();
    renderCompareSection();
  });
  // Trend ↔ per-set-range view toggle for the compare graph.
  document.getElementById("compareView")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-compareview]");
    if (!btn) return;
    const v = btn.dataset.compareview === "perset" ? "perset" : "trend";
    if (v === compareView) return;
    compareView = v;
    for (const b of document.querySelectorAll<HTMLButtonElement>("#compareView [data-compareview]"))
      b.classList.toggle("is-active", b === btn);
    renderCompareChart();
  });

  // Pagination (delegated on the persistent pager containers). The exercises
  // List & stats view no longer paginates — the Period filter scopes it.
  els.workoutsPager.addEventListener("click", (e) => {
    const p = pageFromClick(e);
    if (p !== null) {
      S.workoutsPage = p;
      renderWorkoutsPage();
    }
  });
  els.bwGroups.addEventListener("change", onBwInputChange);
  // Remember the note-variations fold's open/closed state per exercise so an
  // inspector re-render (after a rename/scale edit) doesn't snap it shut. The
  // `toggle` event doesn't bubble, so listen in the capture phase.
  els.bwGroups.addEventListener("toggle", (e) => {
    const d = e.target as HTMLElement;
    if (!(d instanceof HTMLDetailsElement) || !d.classList.contains("ex-vars-fold")) return;
    const ex = d.dataset.exvars;
    if (!ex) return;
    if (d.open) notesFoldOpen.add(ex); else notesFoldOpen.delete(ex);
  }, true);
  // App-wide active-set controls (Index): tier cutoff dropdown + clear-overrides.
  els.activeSetBar.addEventListener("change", (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>("#activeCutoff");
    if (sel) { onActiveCutoffChange(sel.value); return; }
    // Taxonomy-filter dimension picker → just swap which value pills show (no
    // filter change, so re-render the bar in place rather than the whole app).
    const dimSel = (e.target as HTMLElement).closest<HTMLSelectElement>("#activeFilterDim");
    if (dimSel) { activeFilterDim = dimSel.value as ExerciseFilterDim; rerenderActiveSetBar(); return; }
  });
  els.activeSetBar.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-asreset]")) { resetActiveSetAll(); return; }
    if (t.closest("[data-asclear]")) { clearActiveOverrides(); return; }
    // Toggle one taxonomy value for the current dimension (OR within the dim).
    const pill = t.closest<HTMLElement>("[data-asfval]");
    if (pill?.dataset.asfval) { toggleActiveMetaValue(activeFilterDim, pill.dataset.asfval); return; }
    // Remove one active filter chip.
    const chip = t.closest<HTMLElement>("[data-asfclear-dim]");
    if (chip?.dataset.asfclearDim && chip.dataset.asfclearVal !== undefined) {
      toggleActiveMetaValue(chip.dataset.asfclearDim as ExerciseFilterDim, chip.dataset.asfclearVal);
      return;
    }
    if (t.closest("[data-asfclear-all]")) { clearActiveMetaFilters(); return; }
  });
  // Index "Group by" picker: re-slice the same lifts by category / muscle / etc.
  els.bwGroupBar.addEventListener("change", (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>("#bwGroupBy");
    if (!sel) return;
    S.bwGroupMode = sel.value as IndexGroupMode;
    renderBwParts();
  });
  // "Create variant / group" form (moved here from the Analysis bar) — its Create
  // button + the pill/chip member picker live in #idxCreate on the Index page.
  const idxCreate = document.getElementById("idxCreate");
  idxCreate?.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("#waNewCreate")) { createUserExerciseDef(); return; }
    const tog = t.closest<HTMLElement>("[data-vmtoggle]"); // tap an exercise chip → toggle membership
    if (tog?.dataset.vmtoggle) { toggleVariantMember(tog.dataset.vmtoggle); return; }
    const rm = t.closest<HTMLElement>("[data-vmremove]"); // ✕ on a chosen pill → remove it
    if (rm?.dataset.vmremove) { removeVariantMember(rm.dataset.vmremove); return; }
    const del = t.closest<HTMLElement>("[data-vmdeldef]"); // ✕ on a created def → delete it
    if (del?.dataset.vmdeldef) { deleteVariantDef(del.dataset.vmdeldef); return; }
  });
  // Live-filter the member chips as you type (only the chip list re-renders, so the
  // search box keeps focus). A type change re-renders so dissolved trims to 1 parent.
  idxCreate?.addEventListener("input", (e) => {
    const s = (e.target as HTMLElement).closest<HTMLInputElement>("#waNewSearch");
    if (s) { createVariantSearch = s.value; renderVariantPicker(); }
  });
  idxCreate?.addEventListener("change", (e) => {
    if (!(e.target as HTMLElement).closest("#waNewType")) return;
    if (createVariantType() === "dissolved" && createVariantMembers.length > 1)
      createVariantMembers = createVariantMembers.slice(0, 1); // dissolved = one parent
    renderVariantPicker();
  });
  // Tap an exercise name on the Index to open its settings in the floating overlay.
  els.bwGroups.addEventListener("click", (e) => {
    // Group header "only / hide / show" — read the group's lifts from its rows and
    // apply the app-wide filter. preventDefault so the <summary> doesn't also toggle.
    const filt = (e.target as HTMLElement).closest<HTMLElement>(".bw-filt");
    if (filt?.dataset.grpcycle) {
      e.preventDefault();
      const cat = filt.closest<HTMLElement>(".bw-cat");
      const names = [...new Set(cat
        ? [...cat.querySelectorAll<HTMLTableRowElement>("tr[data-exrow]")].map((tr) => tr.dataset.exrow).filter((n): n is string => !!n)
        : [])];
      applyGroupFilter(GROUP_FILTER_NEXT[groupFilterState(names)], names);
      return;
    }
    const nameEl = (e.target as HTMLElement).closest<HTMLElement>(".bw-ex-name");
    if (!nameEl?.dataset.exname) return;
    openExerciseInfo(nameEl.dataset.exname); // floating settings overlay
  });
  for (const input of [els.calcWeight, els.calcReps, els.calcBw, els.calcCoeff])
    input.addEventListener("input", () => {
      els.testPickHint.textContent = ""; // numbers are now custom, not the loaded top set
      renderTest();
    });

  setupBottomNav();

  // Replace every native <select> with a custom HTML/CSS dropdown. Done last, so
  // each select already has its options and current value. (#athlete stays hidden
  // behind its chip row; #exerciseRange is already a custom dropdown.)
  // NOTE: #viewAsSelect is intentionally NOT enhanced — it's a hidden, in-sync
  // mirror only (who you are is chosen on the login screen), so it must not get a
  // visible .xdd dropdown twin in the Settings menu.
  enhanceSelect(els.exercise, { wide: true });
  enhanceSelect(els.dataExercise, { wide: true });
  for (const sel of [
    els.formula, els.rank, els.sexFilter,
    els.workoutGrouping, els.testAthlete, els.testExercise,
    els.dataUser, els.groupsAthlete, els.addAthlete,
  ])
    enhanceSelect(sel);
  // PRUNE (DROP-1): the app has many DYNAMICALLY-rendered menus (Index Group-by /
  // Show-app-wide / sub-group, calendar Group-by, picker Group-by, graph Aggregate
  // / Interval, Create-variant type, stats editor…) that were left as native
  // <select>s and showed the OS picker. Auto-enhance every native single select —
  // those already on screen now, and (via the observer) any rendered later — so the
  // whole app uses ONE consistent .xdd dropdown and no new native picker can creep
  // in. Multi-selects + the hidden mirror selects are left alone (see enhanceSelectTree).
  enhanceSelectTree(document.body);
  new MutationObserver((muts) => {
    for (const m of muts)
      for (const n of m.addedNodes) if (n instanceof HTMLElement) enhanceSelectTree(n);
  }).observe(document.body, { childList: true, subtree: true });

  setupSAnalysis();
  // Language (EN/LT) toggle in Settings. Switching reloads; LT then applies via
  // the translation pass. Done last so the toggle reflects the saved language.
  setupLanguage();
  initI18n();
}

/** Wire the Settings language toggle: highlight the current language; a tap on the
 * other one saves it and reloads (initI18n then translates the whole site to LT). */
function setupLanguage(): void {
  const toggle = document.getElementById("langToggle");
  if (!toggle) return;
  const cur = getLang();
  for (const b of toggle.querySelectorAll<HTMLButtonElement>(".lang-opt")) {
    b.classList.toggle("is-active", b.dataset.lang === cur);
    b.addEventListener("click", () => {
      const l = b.dataset.lang as Lang;
      if (l && l !== getLang()) setLang(l);
    });
  }
}

/** Read the target page index from a pager button click, or null. */
function pageFromClick(e: MouseEvent): number | null {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button.page-btn");
  if (!btn || btn.disabled) return null;
  return Number(btn.dataset.page);
}

// ---- Data tab: see the original CSV and the processed table side by side ----
const DATA_PAGE_SIZE = 100;
// S.dataView, dataSearch live on S (appState).
let dataPage = 0;

/** A number for display: rounded to 2 dp, trailing zeros trimmed; "" for null. */
function dataNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return String(Math.round(n * 100) / 100);
}

/** One display row. `user`/`date`/`exercise` are the group key (shown once in a
 * header above their rows, not repeated per row); `cells` holds the remaining
 * per-set columns with those three already removed. */
interface DataRow {
  user: string;
  date: string;
  exercise: string; // canonical (processed) or raw (original) exercise name
  cells: string[];
}

/** Raw exercise name → canonical (merged) name, so the Exercise dropdown — which
 * lists canonical names — can also filter the original CSV's raw spellings. */
function rawToCanonicalExercise(): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of data.records) {
    if (r.originalExerciseName && r.originalExerciseName !== r.exerciseName) {
      m.set(r.originalExerciseName, r.exerciseName);
    }
  }
  return m;
}

// The three columns lifted into the group header rather than repeated per row.
const DATA_GROUP_COLS = new Set(["user", "date", "exercise_name"]);

/** Build the header + rows for whichever table is active. Username and set_number
 * are omitted entirely; user/date/exercise_name are pulled out as the group key,
 * so `header`/`cells` contain only the remaining per-set columns. */
function dataRows(): { header: string[]; rows: DataRow[] } {
  if (S.dataView === "original") {
    const raw = parseCsvRows(data.rawCsv);
    const rawHeader = raw[0] ?? [];
    // Drop username/set_number, and split out the grouped columns.
    const dropIdx = new Set(
      rawHeader.flatMap((h, i) => (h === "username" || h === "set_number" ? [i] : [])),
    );
    const userIdx = rawHeader.indexOf("user");
    const dateIdx = rawHeader.indexOf("date");
    const exIdx = rawHeader.indexOf("exercise_name");
    const keep = (row: string[]) =>
      row.filter((_, i) => !dropIdx.has(i) && !DATA_GROUP_COLS.has(rawHeader[i] ?? ""));
    const header = keep(rawHeader);
    const toCanon = rawToCanonicalExercise();
    const rows = raw.slice(1).map((row) => {
      const rawEx = exIdx >= 0 ? (row[exIdx] ?? "") : "";
      return {
        user: userIdx >= 0 ? (row[userIdx] ?? "") : "",
        date: dateIdx >= 0 ? (row[dateIdx] ?? "") : "",
        // Match on the canonical name so the dropdown catches merged spellings.
        exercise: toCanon.get(rawEx) ?? rawEx,
        cells: keep(row),
      };
    });
    return { header, rows };
  }
  // Processed: a tracking table that lays bare EVERY variable and function the
  // app derives for a set, in the order they're computed — so a wrong number can
  // be traced to the exact step. Each column maps to a named function/value:
  //   raw_name        — original logged exercise name (before canonicalisation)
  //   bw_coeff        — coeffFor(): how much bodyweight the lift loads
  //   logged_w        — weight as logged
  //   real_added      — realPullupWeight(): assisted-machine weight halved
  //   bodyweight      — the bodyweight used (per-set log, or athlete table)
  //   bw_source       — which of the two the Setting picked
  //   eff_load        — effectiveLoad() = coeff*bodyweight + real_added (1RM input)
  //   reps / capped   — logged reps, and reps capped at MAX_1RM_REPS for 1RM
  //   epley/brzycki/nuzzo — each estimate1RM formula on the effective load
  //   added_1RM       — addedWeight1RM(): the headline number (bw share peeled off)
  //   volume          — setVolume() = logged_w * reps
  //   dropset/percentile/category/tier/notes — flags & classification
  const header = [
    "raw_name", "bw_coeff", "logged_w", "real_added", "bodyweight", "bw_source",
    "eff_load", "reps", "capped", "epley", "brzycki", "nuzzo", "added_1RM",
    "volume", "dropset", "percentile", "category", "tier", "notes",
  ];
  const rows = computedRecords().map((r) => {
    // r.weight is already the effective (bw-inclusive) load; r.origWeight is what
    // was logged. Recompute the named intermediates for full transparency.
    const logged = r.origWeight !== undefined ? r.origWeight : r.weight;
    const coeff = coeffFor(r.exerciseName);
    const realAdded = realPullupWeight(r.exerciseName, logged);
    const perSet = r.bodyweight !== null && r.bodyweight !== undefined;
    const bw = r.bodyweight ?? athProfile(r.username)?.weight ?? null;
    const effLoad = r.weight; // = effectiveLoad(realAdded, bw, coeff)
    const cappedReps = r.reps === null ? null : Math.min(r.reps, MAX_1RM_REPS);
    const overCap = r.reps !== null && r.reps > MAX_1RM_REPS;
    return {
      user: r.user,
      date: r.date,
      exercise: r.exerciseName,
      cells: [
        r.originalExerciseName && r.originalExerciseName !== r.exerciseName ? r.originalExerciseName : "",
        dataNum(coeff),
        dataNum(logged),
        realAdded === logged ? "" : dataNum(realAdded),
        dataNum(bw),
        coeff > 0 ? (perSet ? "per-set" : "default") : "—",
        dataNum(effLoad),
        dataNum(r.reps),
        cappedReps !== r.reps ? dataNum(cappedReps) : "",
        // Above the rep cap there's no reliable 1RM — blank the formula columns
        // (matches addedWeight1RM, which returns "—" past the cap).
        overCap ? "" : dataNum(epley1RM(effLoad, r.reps)),
        overCap ? "" : dataNum(brzycki1RM(effLoad, r.reps)),
        overCap ? "" : dataNum(nuzzo1RM(effLoad, r.reps)),
        dataNum(addedWeight1RM(r, currentFormula())),
        dataNum(setVolume(logged, r.reps)),
        r.dropset ? "TRUE" : "",
        dataNum(r.percentile),
        catFor(r.exerciseName),
        tierFor(r.exerciseName),
        r.notes,
      ],
    };
  });
  return { header, rows };
}

function renderDataTab() {
  const { header, rows } = dataRows();
  const exPick = els.dataExercise.value;
  const userPick = els.dataUser.value;
  const q = S.dataSearch.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (userPick && row.user !== userPick) return false;
    if (exPick && row.exercise !== exPick) return false;
    if (q && !row.cells.some((c) => c.toLowerCase().includes(q))) return false;
    return true;
  });

  const total = filtered.length;
  const maxPage = Math.max(0, Math.ceil(total / DATA_PAGE_SIZE) - 1);
  if (dataPage > maxPage) dataPage = maxPage;
  const start = dataPage * DATA_PAGE_SIZE;
  const pageRows = filtered.slice(start, start + DATA_PAGE_SIZE);

  // Group consecutive rows by (user, date, exercise): emit the key once as a
  // banner row, then its data rows below. prevKey starts null so the first row
  // of every page always re-prints its banner (groups can span page breaks).
  const cols = header.length;
  let prevKey: string | null = null;
  const bodyParts: string[] = [];
  for (const row of pageRows) {
    const key = `${row.user} ${row.date} ${row.exercise}`;
    if (key !== prevKey) {
      bodyParts.push(
        `<tr class="data-group"><td colspan="${cols}">` +
          `<span class="dg-user">${escapeHtml(row.user)}</span>` +
          `<span class="dg-sep">·</span><span class="dg-ex">${escapeHtml(row.exercise)}</span>` +
          `<span class="dg-sep">·</span><span class="dg-date">${escapeHtml(row.date)}</span>` +
          `</td></tr>`,
      );
      prevKey = key;
    }
    bodyParts.push(`<tr>${row.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`);
  }

  const thead = `<thead><tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`;
  const active = exPick || userPick || q;
  const count = `<p class="muted" style="margin:0 0 0.6rem">${total.toLocaleString()} rows${active ? " (filtered)" : ""}</p>`;
  els.dataTableWrap.innerHTML =
    count + `<table class="data-table data-raw-table">${thead}<tbody>${bodyParts.join("")}</tbody></table>`;
  els.dataPager.innerHTML = pagerHtml(dataPage, total, DATA_PAGE_SIZE);
}

/** Fill the Data-tab Exercise and Athlete dropdowns from the loaded records. */
function populateDataFilters() {
  const exercises = distinctExercises(data.records);
  els.dataExercise.innerHTML =
    `<option value="">All exercises</option>` +
    exercises.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
  // Value is the display name ("Adomas") because that's the `user` column both
  // the processed records and the original CSV carry — so one dropdown filters
  // both tables consistently.
  const users = distinctUsers(data.records);
  els.dataUser.innerHTML =
    `<option value="">All athletes</option>` +
    users.map((u) => `<option value="${escapeHtml(u.user)}">${escapeHtml(u.user)}</option>`).join("");
}

// ---- "Refresh data" status -------------------------------------------------
// The refresh runs as a GitHub Action (see the Data tab + fetch-data.yml). The
// browser can read its status from the public GitHub API (api.github.com sends
// CORS headers, and public-repo run status needs no auth), so we can tell the
// owner whether to keep waiting or that it failed — without leaving the page.
const REFRESH_RUNS_API =
  "https://api.github.com/repos/adomasgaudi/data/actions/workflows/fetch-data.yml/runs?per_page=1";
let refreshPollTimer: number | null = null;

/** Human "x min ago" for an ISO timestamp. */
function agoText(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function setRefreshStatus(html: string, cls: string) {
  els.refreshStatus.className = `refresh-status ${cls}`;
  els.refreshStatus.innerHTML = html;
}

/** Fetch the latest fetch-data run and show whether to keep waiting / it failed.
 * Re-polls itself every 12 s while a run is still going. */
async function pollRefreshStatus(): Promise<void> {
  if (refreshPollTimer !== null) { clearTimeout(refreshPollTimer); refreshPollTimer = null; }
  let run: {
    status: string; conclusion: string | null; html_url: string;
    run_started_at?: string; updated_at: string; created_at: string;
  } | null = null;
  try {
    const res = await fetch(REFRESH_RUNS_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    run = data.workflow_runs?.[0] ?? null;
  } catch {
    setRefreshStatus(
      `Couldn't reach GitHub to check status — <a href="https://github.com/adomasgaudi/data/actions/workflows/fetch-data.yml" target="_blank" rel="noopener">open it on GitHub</a>.`,
      "is-unknown",
    );
    return;
  }
  if (!run) {
    setRefreshStatus("No refresh has run yet. Click the button above to start one.", "is-idle");
    return;
  }
  const link = `<a href="${escapeHtml(run.html_url)}" target="_blank" rel="noopener">view on GitHub →</a>`;
  if (run.status !== "completed") {
    const started = run.run_started_at ?? run.created_at;
    setRefreshStatus(
      `⏳ <strong>Refresh is running…</strong> keep waiting (started ${agoText(started)}). This page will update the status by itself. ${link}`,
      "is-running",
    );
    refreshPollTimer = window.setTimeout(pollRefreshStatus, 12_000);
    return;
  }
  // Completed.
  if (run.conclusion === "success") {
    setRefreshStatus(
      `✓ <strong>Last refresh succeeded</strong> (${agoText(run.updated_at)}). If you just ran it, reload this page to see the new data. ${link}`,
      "is-ok",
    );
  } else {
    setRefreshStatus(
      `✗ <strong>Last refresh failed</strong> (${run.conclusion ?? "stopped"}, ${agoText(run.updated_at)}). ${link}`,
      "is-fail",
    );
  }
}

function setupDataTab() {
  populateDataFilters();
  els.refreshStatusBtn.addEventListener("click", () => {
    setRefreshStatus("Checking…", "is-idle");
    void pollRefreshStatus();
  });
  document.querySelectorAll<HTMLButtonElement>(".data-viewbtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.dataview === "original" ? "original" : "processed";
      if (v === S.dataView) return;
      S.dataView = v;
      dataPage = 0;
      document.querySelectorAll<HTMLButtonElement>(".data-viewbtn").forEach((b) =>
        b.classList.toggle("is-active", b === btn),
      );
      renderDataTab();
    });
  });
  els.dataExercise.addEventListener("change", () => {
    dataPage = 0;
    renderDataTab();
  });
  els.dataUser.addEventListener("change", () => {
    dataPage = 0;
    renderDataTab();
  });
  els.dataSearch.addEventListener("input", () => {
    S.dataSearch = els.dataSearch.value;
    dataPage = 0;
    renderDataTab();
  });
  els.dataPager.addEventListener("click", (e) => {
    const p = pageFromClick(e);
    if (p !== null) {
      dataPage = p;
      renderDataTab();
    }
  });
}

/**
 * Wire up the Guide's training checklists: restore ticked boxes from this
 * device's localStorage, save on every change, keep the "x / y done" count
 * fresh and let the Reset button clear a list. Each box has a stable data-key.
 */
// ---- Add tab: hand-logged sets, saved on-device and merged with the CSV data --
interface ManualEntry {
  id: string;
  user: string;
  username: string;
  date: string;
  exerciseName: string;
  weight: number | null;
  reps: number | null;
  /** Free-text note (the variation circumstances, e.g. a handstand's setup) so a
   * hand-logged set joins the same note-based variation system as CSV sets. */
  notes?: string;
  /** Squat-rack hole chosen on the Add form, stored per set — the difficulty
   * selection that replaces added weight for incline push-ups. */
  levelValue?: number;
}
const MANUAL_KEY = "colosseum.manualSets.v1";
let manualEntries: ManualEntry[] = loadManual();
let editingManualId: string | null = null; // which hand-logged set is being edited inline

function loadManual(): ManualEntry[] {
  try {
    const raw = localStorage.getItem(MANUAL_KEY);
    return raw ? (JSON.parse(raw) as ManualEntry[]) : [];
  } catch {
    return [];
  }
}
function saveManual() {
  try {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(manualEntries));
  } catch {
    /* storage unavailable (private mode) — entries still apply this session */
  }
}

/** Turn a stored entry into a SetRecord matching the CSV shape, so every view
 * treats it identically. Bodyweight comes from the athlete profile table. */
function manualToRecord(m: ManualEntry, setNumber: number): SetRecord {
  return {
    user: m.user,
    username: m.username,
    date: m.date,
    bodyweight: athProfile(m.username)?.weight ?? null,
    exerciseName: m.exerciseName,
    setNumber,
    weight: m.weight,
    reps: m.reps,
    // The note carries the variation (e.g. a handstand's "b2w, +15cm") so a
    // hand-logged set resolves + edits its difficulty exactly like a CSV set.
    notes: m.notes ?? "",
    dropset: false,
    percentile: null,
    ...(m.levelValue !== undefined
      ? { levelDim: "sq" as const, levelValue: m.levelValue, levelLabel: levelLabel("sq", m.levelValue) }
      : {}),
  };
}

/** Append the hand-logged sets to the loaded dataset (called once after load and
 * after any add/delete, by rebuilding from data.csvRecords + manual). */
let csvRecordCount = 0; // how many of data.records came from the CSV (the prefix)
function mergeManualSets() {
  // Keep the first csvRecordCount records (the CSV) and re-append manual ones.
  data.records.length = csvRecordCount;
  // A high, unique set number per entry → a stable, collision-free setId (so each
  // hand-logged set edits/tags independently and never clashes with a CSV set).
  manualEntries.forEach((m, i) => data.records.push(manualToRecord(m, 100000 + i)));
}

/** Populate the Add form's athlete dropdown + exercise suggestions and the table. */
function renderAddTab() {
  const users = rosterUsers();
  const prev = els.addAthlete.value;
  els.addAthlete.innerHTML = users
    .map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`)
    .join("");
  if (prev) els.addAthlete.value = prev;
  els.addExerciseList.innerHTML = selectableExercises(data.records)
    .map((e) => `<option value="${escapeHtml(e)}"></option>`)
    .join("");
  if (!els.addDate.value) els.addDate.value = todayIso();

  // Recently-added list (newest first). Each row has Edit + Delete; the row being
  // edited swaps its cells for inputs (exercise / weight × reps / date) + Save.
  const rows = [...manualEntries]
    .reverse()
    .map((m) => {
      if (m.id === editingManualId) {
        return (
          `<tr data-edit-row="${escapeHtml(m.id)}"><td>${escapeHtml(m.user)}</td>` +
          `<td><input class="me-ex" value="${escapeHtml(m.exerciseName)}" /></td>` +
          `<td class="num"><input class="me-weight" type="number" step="0.5" inputmode="decimal" placeholder="kg" value="${m.weight ?? ""}" />` +
          `<span class="muted"> × </span><input class="me-reps" type="number" step="1" min="1" inputmode="numeric" placeholder="reps" value="${m.reps ?? ""}" /></td>` +
          `<td class="num"><input class="me-date" type="date" value="${escapeHtml(m.date)}" /></td>` +
          `<td class="num"><button type="button" class="manual-save" data-id="${escapeHtml(m.id)}">Save</button>` +
          `<button type="button" class="manual-cancel" aria-label="Cancel">×</button></td></tr>`
        );
      }
      return (
        `<tr><td>${escapeHtml(m.user)}</td><td>${escapeHtml(m.exerciseName)}</td>` +
        `<td class="num">${m.weight ?? "—"}${m.reps != null ? `×${m.reps}` : ""}</td>` +
        `<td class="num">${escapeHtml(m.date)}</td>` +
        `<td class="num"><button type="button" class="manual-edit" data-id="${escapeHtml(m.id)}" aria-label="Edit">✎</button>` +
        `<button type="button" class="manual-del" data-id="${escapeHtml(m.id)}" aria-label="Delete">×</button></td></tr>`
      );
    })
    .join("");
  els.addCount.textContent = manualEntries.length ? `(${manualEntries.length})` : "";
  els.addTable.innerHTML = manualEntries.length
    ? `<thead><tr><th>Athlete</th><th>Exercise</th><th class="num">Set</th><th class="num">Date</th><th></th></tr></thead><tbody>${rows}</tbody>`
    : `<tbody><tr><td class="muted">No hand-logged sets yet.</td></tr></tbody>`;
}

/* Some bodyweight lifts are progressed by changing leverage, not load. Decline
 * sit-ups get harder as the arms move from the stomach up over the head — so when
 * that exercise is entered, the Add form offers an arm-position choice (easiest →
 * hardest) and the pick is folded into the logged exercise name, making each
 * position its own tracked variant (like a heavier weight would be). */
const SITUP_ARM_POSITIONS = [
  "arms on stomach",
  "arms straight by sides",
  "hands on head",
  "arms overhead, elbows bent",
  "arms overhead, straight",
];
const isDeclineSitup = (name: string): boolean =>
  /decline\s*sit[\s-]*ups?/.test(name.toLowerCase());

/** Show/populate the arm-position dropdown only for decline sit-ups. */
function updateArmPosField(): void {
  const show = isDeclineSitup(els.addExercise.value);
  els.addArmPosField.hidden = !show;
  if (show && els.addArmPos.options.length === 0)
    els.addArmPos.innerHTML =
      `<option value="">— pick a position —</option>` +
      SITUP_ARM_POSITIONS.map((p) => `<option value="${p}">${p}</option>`).join("");
}

/* Push-ups (and the other lifts the owner does on the squat rack) are progressed
 * by hole, not weight. For those a "Squat-rack hole" field appears, and its value
 * is stored as the set's LEVEL — a per-set selection that picks a bodyweight-part
 * instead of added kilos. The exercise name never changes (one exercise). */
const usesSquatRackHole = (name: string): boolean =>
  /push|inverted row|\brow\b|deadlift|good morning|\bdip\b|leg pull|pull[- ]?in|leg raise/i.test(name);

/** Show the squat-rack-hole field only for exercises that use it. */
function updateVariantField(): void {
  els.addVariantField.hidden = !usesSquatRackHole(els.addExercise.value.trim());
}

// The weight / reps / sets inputs + Add / cancel buttons shared by both inline
// forms (add-a-set and add-a-new-exercise).
const AF_FIELDS =
  `<input class="wo-af-weight" type="number" step="0.5" inputmode="decimal" placeholder="kg" aria-label="Weight" />` +
  `<input class="wo-af-reps" type="number" step="1" min="1" inputmode="numeric" placeholder="reps" aria-label="Reps" />` +
  `<input class="wo-af-sets" type="number" step="1" min="1" inputmode="numeric" placeholder="sets" aria-label="Sets" />` +
  `<button type="button" class="wo-af-go">Add</button>` +
  `<button type="button" class="wo-af-cancel" aria-label="Cancel">×</button>` +
  `<span class="wo-af-msg muted"></span>`;

/** Day / Today chooser — only worth showing when the session you're viewing
 * isn't today (so you can log to a past day or to today). */
function afWhenToggle(date: string, today: string): string {
  return date === today
    ? ""
    : `<span class="wo-af-when seg-toggle">` +
        `<button type="button" class="seg-btn is-active" data-when="day">${escapeHtml(shortDate(date))}</button>` +
        `<button type="button" class="seg-btn" data-when="today">Today</button>` +
        `</span>`;
}

/** Compact inline "add set" form shown right under an exercise in the Workouts
 * view, so a set is logged on this screen without jumping to the Add page. The
 * athlete is the one the page is showing; the date is the session's date. */
function inlineAddFormHtml(exerciseName: string, date: string): string {
  const today = todayIso();
  return (
    `<span class="wo-addform" data-addex="${escapeHtml(exerciseName)}" data-daydate="${escapeHtml(date)}" data-todaydate="${escapeHtml(today)}">` +
    afWhenToggle(date, today) +
    AF_FIELDS +
    `</span>`
  );
}

/** Like the add-set form, but with a searchable exercise picker up front so a
 * brand-new exercise can be added to a session (type to filter every known
 * exercise; a new name is allowed too). */
function inlineAddExerciseFormHtml(date: string): string {
  const today = todayIso();
  return (
    `<span class="wo-addform wo-addform--new" data-daydate="${escapeHtml(date)}" data-todaydate="${escapeHtml(today)}">` +
    afWhenToggle(date, today) +
    `<input class="wo-af-ex" list="addExerciseList" placeholder="search exercise…" aria-label="Exercise" autocomplete="off" />` +
    AF_FIELDS +
    `</span>`
  );
}

/** Remove an open inline add form, plus its wrapping detail-table row if it sits
 * in the expanded sets table. */
function removeInlineAddForm(form: HTMLElement) {
  const row = form.closest("tr.wo-addform-row");
  if (row) row.remove();
  else form.remove();
}

/** Toggle the inline add form for a "+ set" button. In the expanded sets table
 * it becomes its own row under the exercise header; in the collapsed session
 * summary it sits inline right after the button. */
function toggleInlineAddForm(btn: HTMLElement) {
  const ex = btn.dataset.addex ?? "";
  const date = btn.dataset.adddate ?? "";
  const headerRow = btn.closest("tr.set-ex-row");
  if (headerRow) {
    const next = headerRow.nextElementSibling;
    if (next?.classList.contains("wo-addform-row")) {
      next.remove();
      return;
    }
    const tr = document.createElement("tr");
    tr.className = "wo-addform-row";
    tr.innerHTML = `<td colspan="4">${inlineAddFormHtml(ex, date)}</td>`;
    headerRow.insertAdjacentElement("afterend", tr);
    tr.querySelector<HTMLInputElement>(".wo-af-weight")?.focus();
    return;
  }
  const sib = btn.nextElementSibling;
  if (sib?.classList.contains("wo-addform")) {
    sib.remove();
    return;
  }
  btn.insertAdjacentHTML("afterend", inlineAddFormHtml(ex, date));
  btn.nextElementSibling?.querySelector<HTMLInputElement>(".wo-af-weight")?.focus();
}

/** Toggle the inline "add a new exercise" form for a "+ exercise" button. Same
 * two contexts as toggleInlineAddForm, but the form leads with a searchable
 * exercise picker. */
function toggleInlineAddExerciseForm(btn: HTMLElement) {
  const date = btn.dataset.adddate ?? "";
  const hostRow = btn.closest("tr.set-ex-row");
  if (hostRow) {
    const next = hostRow.nextElementSibling;
    if (next?.classList.contains("wo-addform-row")) {
      next.remove();
      return;
    }
    const tr = document.createElement("tr");
    tr.className = "wo-addform-row";
    tr.innerHTML = `<td colspan="4">${inlineAddExerciseFormHtml(date)}</td>`;
    hostRow.insertAdjacentElement("afterend", tr);
    tr.querySelector<HTMLInputElement>(".wo-af-ex")?.focus();
    return;
  }
  const sib = btn.nextElementSibling;
  if (sib?.classList.contains("wo-addform")) {
    sib.remove();
    return;
  }
  btn.insertAdjacentHTML("afterend", inlineAddExerciseFormHtml(date));
  btn.nextElementSibling?.querySelector<HTMLInputElement>(".wo-af-ex")?.focus();
}

/** Log the set(s) from an inline form into the hand-logged sets, then refresh
 * the Workouts view in place (keeping the open weeks/days expanded). */
function onInlineAddGo(form: HTMLElement) {
  // New-exercise form carries a search input; the per-exercise form carries the
  // name on the button's data-addex.
  const exInput = form.querySelector<HTMLInputElement>(".wo-af-ex");
  const exerciseName = exInput ? exInput.value.trim() : (form.dataset.addex ?? "");
  // Use whichever day the toggle has selected (the session day or today); with no
  // toggle (session already is today) both are the same.
  const when = form.querySelector<HTMLElement>(".wo-af-when .seg-btn.is-active")?.dataset.when;
  const date =
    (when === "today" ? form.dataset.todaydate : form.dataset.daydate) || form.dataset.daydate || todayIso();
  const msg = form.querySelector<HTMLElement>(".wo-af-msg");
  if (exInput && !exerciseName) {
    if (msg) msg.textContent = "Pick or type an exercise.";
    exInput.focus();
    return;
  }
  const weight = parseFloat(form.querySelector<HTMLInputElement>(".wo-af-weight")!.value);
  const reps = Math.round(parseFloat(form.querySelector<HTMLInputElement>(".wo-af-reps")!.value));
  const setsRaw = Math.round(parseFloat(form.querySelector<HTMLInputElement>(".wo-af-sets")!.value));
  const sets = Number.isFinite(setsRaw) && setsRaw >= 1 ? setsRaw : 1;
  const username = els.athlete.value;
  const user = athleteLabel();
  if (!username || !exerciseName) return;
  if (!Number.isFinite(reps) || reps < 1) {
    if (msg) msg.textContent = "Enter reps (1+).";
    form.querySelector<HTMLInputElement>(".wo-af-reps")?.focus();
    return;
  }
  for (let i = 0; i < sets; i++) {
    manualEntries.push({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      user,
      username,
      date,
      exerciseName,
      weight: Number.isFinite(weight) ? weight : null,
      reps,
    });
  }
  saveManual();
  mergeManualSets();
  // Which weeks/days are expanded right now — reopen them after the rebuild.
  const openDates = new Set(
    Array.from(document.querySelectorAll<HTMLElement>("tr.wo-row.open"))
      .map((r) => workoutGroups[Number(r.dataset.index)]?.date)
      .filter((d): d is string => Boolean(d)),
  );
  // The set just landed in data.records; rebuild this athlete's day cache so the
  // day view (week view reads activeRecords directly) reflects it too.
  athleteWorkouts = workoutsForUser(activeRecords(), els.athlete.value);
  renderWorkoutsPage();
  reopenWorkoutGroups(openDates);
  renderWorkoutCalendar();
  renderDataTab();
}

/** After a re-render, re-expand the workout rows whose group date is in the set. */
function reopenWorkoutGroups(dates: Set<string>) {
  for (const row of document.querySelectorAll<HTMLTableRowElement>("tr.wo-row")) {
    if (row.classList.contains("open")) continue;
    const grp = workoutGroups[Number(row.dataset.index)];
    if (grp && dates.has(grp.date)) insertDetail(row, 2, workoutGroupHtml(grp));
  }
}

function onAddSubmit() {
  const username = els.addAthlete.value;
  const user = els.addAthlete.selectedOptions[0]?.textContent ?? username;
  let exerciseName = els.addExercise.value.trim();
  // Fold the chosen arm position into the name so it tracks as its own variant.
  const armPos = !els.addArmPosField.hidden ? els.addArmPos.value : "";
  if (armPos && isDeclineSitup(exerciseName)) exerciseName = `${exerciseName} (${armPos})`;
  // A chosen squat-rack hole is stored PER SET (not in the name) — it's the
  // difficulty selection that stands in for added weight on an incline push-up.
  const holeRaw = parseFloat(els.addVariant.value);
  const levelValue =
    !els.addVariantField.hidden && Number.isFinite(holeRaw) ? Math.round(holeRaw) : undefined;
  const weight = parseFloat(els.addWeight.value);
  const reps = Math.round(parseFloat(els.addReps.value));
  const note = els.addNote.value.trim(); // variation circumstances (resolves + editable like CSV)
  const date = els.addDate.value || todayIso();
  // How many identical sets to log at once (blank/1 = a single set).
  const setsRaw = Math.round(parseFloat(els.addSets.value));
  const sets = Number.isFinite(setsRaw) && setsRaw >= 1 ? setsRaw : 1;
  if (!username || !exerciseName) {
    els.addHint.textContent = "Pick an athlete and enter an exercise.";
    return;
  }
  if (!Number.isFinite(reps) || reps < 1) {
    els.addHint.textContent = "Enter the reps (1 or more).";
    return;
  }
  for (let i = 0; i < sets; i++) {
    manualEntries.push({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      user,
      username,
      date,
      exerciseName,
      weight: Number.isFinite(weight) ? weight : null,
      reps,
      ...(note ? { notes: note } : {}),
      ...(levelValue !== undefined ? { levelValue } : {}),
    });
  }
  saveManual();
  mergeManualSets();
  // Keep the just-entered athlete / exercise / weight / reps / sets / date in
  // place so logging the next set of the same exercise is one tap (Add again).
  // Nothing is cleared — the form "remembers" what you last added.
  const setWord = sets === 1 ? "set" : `${sets} sets`;
  els.addHint.textContent = `Added ${setWord} of ${exerciseName} ${Number.isFinite(weight) ? `${weight}kg × ` : ""}${reps} for ${user}. Tap Add again to log more.`;
  renderAddTab();
  renderAll(); // every view now includes the new set
  renderDataTab();
}

/** Download the hand-logged sets as a JSON backup (portable across devices). */
function exportManual() {
  const blob = new Blob([JSON.stringify(manualEntries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `colosseum-added-sets-${todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Merge an imported backup into the on-device sets (dedupe by id). */
async function importManual(file: File) {
  try {
    const arr = JSON.parse(await file.text()) as ManualEntry[];
    if (!Array.isArray(arr)) throw new Error("not a backup file");
    const byId = new Map(manualEntries.map((m) => [m.id, m]));
    let added = 0;
    for (const m of arr)
      if (m && typeof m.id === "string" && typeof m.username === "string" && typeof m.exerciseName === "string") {
        if (!byId.has(m.id)) added++;
        byId.set(m.id, m);
      }
    manualEntries = [...byId.values()];
    saveManual();
    mergeManualSets();
    renderAddTab();
    renderAll();
    renderDataTab();
    els.addHint.textContent = `Imported — ${added} new set${added === 1 ? "" : "s"} added (${manualEntries.length} total).`;
  } catch (err) {
    els.addHint.textContent = `Couldn't read that file: ${String(err)}`;
  }
}

// ===========================================================================
// FULL-SITE BACKUP  (see src/backup.ts for the pure, tested core)
//
// Everything the owner edits lives in localStorage. These helpers let them save
// ALL of it to one file and restore it, and — when the browser supports it —
// keep a live backup file that re-saves itself on every change. Pure logic is
// in backup.ts; this is the browser glue (downloads, file pickers, the handle).
// ===========================================================================

const AUTOBACKUP_ON_KEY = "colosseum.__autobackupOn.v1";
const AUTOBACKUP_AT_KEY = "colosseum.__autobackupAt.v1";

/** Build a fresh full backup of every saved setting on this device. */
function makeBackupText(): string {
  return backupToText(collectBackup(localStorage, CURRENT_VERSION));
}

/** Download a complete backup file (manual "Back up everything" button). */
function downloadBackup() {
  const blob = new Blob([makeBackupText()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setAutoBackupStatus("Backed up just now.");
}

/** Restore from a chosen backup file, then reload so every view re-reads it. */
async function restoreFromFile(file: File) {
  try {
    const backup = parseBackup(await file.text());
    const count = Object.keys(backup.data).length;
    const when = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString() : "an unknown time";
    const ok = window.confirm(
      `Restore ${count} saved setting${count === 1 ? "" : "s"} from this backup (taken ${when})?\n\n` +
        `Smart merge: this backup wins on any conflict, but anything you've edited ` +
        `on THIS device that the backup doesn't mention is kept. The page will reload.`,
    );
    if (!ok) return;
    applyBackup(localStorage, backup, "deep");
    window.location.reload();
  } catch (err) {
    setAutoBackupStatus(`Couldn't restore: ${String(err instanceof Error ? err.message : err)}`, true);
  }
}

// ---- Live auto-backup via the File System Access API (where supported) ------
// The chosen file's handle can't be JSON-stringified into localStorage, so it
// lives in a tiny IndexedDB store that persists across reloads.

type FsHandle = FileSystemFileHandle;
const fsApiSupported = (): boolean => typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === "function";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("colosseum-backup", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key: string, val: unknown): Promise<void> {
  const db = await idb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  const out = await new Promise<T | undefined>((res, rej) => {
    const tx = db.transaction("handles", "readonly");
    const r = tx.objectStore("handles").get(key);
    r.onsuccess = () => res(r.result as T | undefined);
    r.onerror = () => rej(r.error);
  });
  db.close();
  return out;
}

let autoHandle: FsHandle | null = null;

/** Verify (or request) write permission on the saved handle. */
async function ensureWritable(h: FsHandle): Promise<boolean> {
  const anyH = h as unknown as {
    queryPermission(o: { mode: "readwrite" }): Promise<PermissionState>;
    requestPermission(o: { mode: "readwrite" }): Promise<PermissionState>;
  };
  if ((await anyH.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return (await anyH.requestPermission({ mode: "readwrite" })) === "granted";
}

/** Write the current full backup to the live file. Silent on success. */
async function writeAutoBackup(): Promise<void> {
  if (!autoHandle) return;
  try {
    if (!(await ensureWritable(autoHandle))) {
      setAutoBackupStatus("Auto-backup paused — the file needs permission again.", true);
      return;
    }
    const w = await autoHandle.createWritable();
    await w.write(makeBackupText());
    await w.close();
    try { localStorage.setItem(AUTOBACKUP_AT_KEY, new Date().toISOString()); } catch { /* ignore */ }
    setAutoBackupStatus(`Live backup saved at ${new Date().toLocaleTimeString()}.`);
  } catch {
    setAutoBackupStatus("Couldn't write the live backup file just now.", true);
  }
}

// Debounce: many settings save in a burst; write the file once the dust settles.
let autoBackupTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutoBackup() {
  if (localStorage.getItem(AUTOBACKUP_ON_KEY) !== "1" || !autoHandle) return;
  if (autoBackupTimer) clearTimeout(autoBackupTimer);
  autoBackupTimer = setTimeout(() => void writeAutoBackup(), 1500);
}

/** Turn the live auto-backup on: let the owner pick/create the file once. */
async function armAutoBackup(): Promise<void> {
  if (!fsApiSupported()) return;
  try {
    const picker = (window as unknown as {
      showSaveFilePicker(o: unknown): Promise<FsHandle>;
    }).showSaveFilePicker;
    autoHandle = await picker({
      suggestedName: backupFilename(),
      types: [{ description: "Colosseum backup", accept: { "application/json": [".json"] } }],
    });
    await idbPut("autoBackupHandle", autoHandle);
    localStorage.setItem(AUTOBACKUP_ON_KEY, "1");
    els.autoBackupToggle.checked = true;
    await writeAutoBackup(); // save immediately so the file is current from the off
  } catch {
    // user cancelled the picker — leave it off
    autoHandle = null;
    els.autoBackupToggle.checked = false;
  }
}

function disarmAutoBackup() {
  autoHandle = null;
  try { localStorage.setItem(AUTOBACKUP_ON_KEY, "0"); } catch { /* ignore */ }
  els.autoBackupToggle.checked = false;
  setAutoBackupStatus("Live auto-backup is off. Use “Back up everything” to save a file manually.");
}

function setAutoBackupStatus(msg: string, warn = false) {
  els.autoBackupHint.textContent = msg;
  els.autoBackupHint.classList.toggle("settings-hint--warn", warn);
}

/**
 * Central change hook: wrap localStorage.setItem once so EVERY edit (no matter
 * which of the ~30 save functions made it) nudges the live backup. This is why
 * we don't have to touch each saveX() call site.
 */
function installBackupHook() {
  const native = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (k: string, v: string) => {
    native(k, v);
    if (k.startsWith("colosseum.") && k !== AUTOBACKUP_AT_KEY && k !== AUTOBACKUP_ON_KEY) scheduleAutoBackup();
  };
}

/** Wire the Settings backup controls and restore live-backup state on load. */
async function setupBackup() {
  installBackupHook();
  els.backupNowBtn.addEventListener("click", downloadBackup);
  els.restoreBtn.addEventListener("click", () => els.restoreFile.click());
  // Clear ONLY the disposable cache tier (settings/filters/session). Authored data
  // is structurally excluded by the allowlist in backup.ts, so it can't be lost.
  els.clearCacheBtn.addEventListener("click", () => {
    if (!window.confirm("Clear the cache? This resets settings, filters and who you're signed in as. Your hand-logged sets, body stats, renames and overrides are kept. The page will reload.")) return;
    clearCache(localStorage);
    location.reload();
  });
  els.restoreFile.addEventListener("change", () => {
    const f = els.restoreFile.files?.[0];
    if (f) void restoreFromFile(f);
    els.restoreFile.value = "";
  });

  if (!fsApiSupported()) {
    // No live-file support (e.g. iPhone Safari) — hide the toggle, lean on manual.
    els.autoBackupToggle.closest("label")?.setAttribute("hidden", "");
    setAutoBackupStatus("Tip: tap “Back up everything” after editing to save a file you can keep or move to another device.");
    return;
  }

  els.autoBackupToggle.addEventListener("change", () => {
    if (els.autoBackupToggle.checked) void armAutoBackup();
    else disarmAutoBackup();
  });

  // Re-arm from a previous session: if the owner had it on, reuse the saved handle.
  if (localStorage.getItem(AUTOBACKUP_ON_KEY) === "1") {
    const saved = await idbGet<FsHandle>("autoBackupHandle");
    if (saved && (await ensureWritable(saved))) {
      autoHandle = saved;
      els.autoBackupToggle.checked = true;
      const at = localStorage.getItem(AUTOBACKUP_AT_KEY);
      setAutoBackupStatus(at ? `Live backup on — last saved ${new Date(at).toLocaleString()}.` : "Live backup on.");
    } else {
      // handle lost or permission gone — fall back to off but tell them why
      disarmAutoBackup();
      setAutoBackupStatus("Live backup was interrupted (file or permission lost). Turn it back on to re-pick the file.", true);
    }
  }
}

function setupAddTab() {
  renderAddTab();
  updateArmPosField();
  updateVariantField();
  els.addExercise.addEventListener("input", () => {
    updateArmPosField();
    updateVariantField();
  });
  els.addSubmit.addEventListener("click", onAddSubmit);
  els.addExport.addEventListener("click", exportManual);
  els.addImport.addEventListener("click", () => els.addImportFile.click());
  els.addImportFile.addEventListener("change", () => {
    const file = els.addImportFile.files?.[0];
    if (file) void importManual(file);
    els.addImportFile.value = ""; // allow re-importing the same file
  });
  els.addTable.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const editBtn = t.closest<HTMLButtonElement>(".manual-edit");
    if (editBtn?.dataset.id) {
      editingManualId = editBtn.dataset.id; // open this row's inline editor
      renderAddTab();
      return;
    }
    if (t.closest(".manual-cancel")) {
      editingManualId = null;
      renderAddTab();
      return;
    }
    const saveBtn = t.closest<HTMLButtonElement>(".manual-save");
    if (saveBtn?.dataset.id) {
      saveManualEdit(saveBtn.dataset.id, saveBtn.closest("tr")!);
      return;
    }
    const delBtn = t.closest<HTMLButtonElement>(".manual-del");
    if (!delBtn?.dataset.id) return;
    manualEntries = manualEntries.filter((m) => m.id !== delBtn.dataset.id);
    saveManual();
    mergeManualSets();
    renderAddTab();
    renderAll();
    renderDataTab();
  });
}

/** Commit the inline edits for one hand-logged set (exercise / weight / reps /
 * date) from its editor row, then refresh everywhere. */
function saveManualEdit(id: string, row: HTMLElement) {
  const entry = manualEntries.find((m) => m.id === id);
  if (!entry) return;
  const exerciseName = row.querySelector<HTMLInputElement>(".me-ex")!.value.trim();
  const weight = parseFloat(row.querySelector<HTMLInputElement>(".me-weight")!.value);
  const reps = Math.round(parseFloat(row.querySelector<HTMLInputElement>(".me-reps")!.value));
  const date = row.querySelector<HTMLInputElement>(".me-date")!.value || entry.date;
  if (!exerciseName || !Number.isFinite(reps) || reps < 1) {
    els.addHint.textContent = "Need an exercise and reps (1 or more) to save.";
    return;
  }
  entry.exerciseName = exerciseName;
  entry.weight = Number.isFinite(weight) ? weight : null;
  entry.reps = reps;
  entry.date = date;
  editingManualId = null;
  saveManual();
  mergeManualSets();
  renderAddTab();
  renderAll();
  renderDataTab();
  els.addHint.textContent = `Updated ${exerciseName} for ${entry.user}.`;
}

function setupChecklists() {
  const lists = Array.from(document.querySelectorAll<HTMLElement>("[data-checklist]"));
  for (const list of lists) {
    const storeKey = `colosseum.checklist.${list.dataset.checklist}`;
    const boxes = Array.from(
      list.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-key]'),
    );
    const progress = list.querySelector<HTMLElement>("[data-progress]");
    const resetBtn = list.querySelector<HTMLButtonElement>("[data-reset]");

    let saved: Record<string, boolean> = {};
    try {
      saved = JSON.parse(localStorage.getItem(storeKey) ?? "{}");
    } catch {
      saved = {};
    }

    const updateProgress = () => {
      if (!progress) return;
      const done = boxes.filter((b) => b.checked).length;
      progress.textContent = `${done} / ${boxes.length} done`;
    };

    const save = () => {
      const state: Record<string, boolean> = {};
      for (const b of boxes) if (b.checked) state[b.dataset.key!] = true;
      try {
        localStorage.setItem(storeKey, JSON.stringify(state));
      } catch {
        // Storage may be full or blocked (private mode); ticks just won't persist.
      }
    };

    for (const b of boxes) {
      b.checked = saved[b.dataset.key!] === true;
      b.addEventListener("change", () => {
        save();
        updateProgress();
      });
    }
    updateProgress();

    resetBtn?.addEventListener("click", () => {
      for (const b of boxes) b.checked = false;
      save();
      updateProgress();
    });
  }
}

/** Toggle which tab panel is visible when a tab button is clicked. */
// ---- Group view: muscle-group categories across athletes --------------------

/** One collapsible-free card per group, with a small heading + a count chip. */
function groupCard(name: string, memberCount: number, bodyHtml: string): string {
  return (
    `<div class="gv-card"><div class="gv-card-head">` +
    `<h3>${escapeHtml(name)}</h3>` +
    `<span class="muted gv-count">${memberCount} lift${memberCount === 1 ? "" : "s"}</span>` +
    `</div>${bodyHtml}</div>`
  );
}

/** Render the Group view: each category (LIST_CATEGORIES, multi-membership)
 * shown for one athlete (best 1RM per member lift) or for everyone (a mini
 * leaderboard across the category's member lifts). */
function renderGroupsView() {
  const formula = currentFormula();
  const recs = computedRecords();
  const present = distinctExercises(activeRecords()); // most-trained first (active set)

  // Athlete picker: "Everyone" + each athlete; keep the current selection.
  const users = distinctUsers(data.records);
  const prev = els.groupsAthlete.value;
  els.groupsAthlete.innerHTML =
    `<option value="">Everyone</option>` +
    users.map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`).join("");
  els.groupsAthlete.value = prev || "";
  const who = els.groupsAthlete.value;

  // Each "source" is a named category bucket with its member lifts in the data.
  const sources: { name: string; members: string[] }[] = LIST_CATEGORIES.map((cat) => ({
    name: cat,
    members: present.filter((e) => exerciseCategories(e).includes(cat)),
  }));

  const base = filterRecords(recs, { excludeDropsets: els.excludeDropsets.checked });
  const cards: string[] = [];

  for (const g of sources) {
    const members = g.members;
    if (members.length === 0) continue;

    if (who) {
      // One athlete: best estimated 1RM per member lift, biggest as the headline.
      const prs = personalRecords(
        filterRecords(recs, { usernames: [who], excludeDropsets: els.excludeDropsets.checked }),
        formula,
        strengthAsOf(),
      );
      const byEx = new Map(prs.map((p) => [p.exerciseName, p]));
      const rows = members
        .map((m) => byEx.get(m))
        .filter((p): p is PersonalRecord => p !== undefined)
        .sort((a, b) => b.bestE1rm.e1rm - a.bestE1rm.e1rm);
      if (rows.length === 0) {
        cards.push(groupCard(g.name, members.length, `<p class="muted gv-empty">Not trained yet.</p>`));
        continue;
      }
      const best = rows[0]!.bestE1rm;
      const body =
        `<div class="gv-head-num"><span class="gv-big">${fmt(best.e1rm)}</span><span class="gv-unit">kg est. 1RM</span></div>` +
        `<table class="data-table gv-table"><tbody>` +
        rows
          .map((p) => {
            const w = p.bestE1rm.weight;
            return (
              `<tr><td><span class="ex-code">${escapeHtml(codeFor(p.exerciseName))}</span>` +
              `<span class="gv-sub muted">${escapeHtml(p.exerciseName)}</span></td>` +
              `<td class="num">${fmt(p.bestE1rm.e1rm)}</td>` +
              `<td class="num gv-raw">${w === null ? "—" : fmt(w)}×${p.bestE1rm.reps}</td></tr>`
            );
          })
          .join("") +
        `</tbody></table>`;
      cards.push(groupCard(g.name, members.length, body));
    } else {
      // Everyone: best e1rm per athlete across the group's member lifts, ranked.
      const byUser = new Map<string, { user: string; e1rm: number; ex: string }>();
      for (const m of members) {
        for (const e of leaderboard(base, m, formula, strengthAsOf())) {
          const cur = byUser.get(e.username);
          if (!cur || e.e1rm > cur.e1rm) byUser.set(e.username, { user: e.user, e1rm: e.e1rm, ex: m });
        }
      }
      const ranked = [...byUser.values()].sort((a, b) => b.e1rm - a.e1rm).slice(0, 8);
      const body =
        ranked.length === 0
          ? `<p class="muted gv-empty">Not trained yet.</p>`
          : `<table class="data-table gv-table"><tbody>` +
            ranked
              .map(
                (r, i) =>
                  `<tr><td class="gv-rank">${i + 1}</td>` +
                  `<td>${escapeHtml(r.user)}<span class="gv-sub muted">${escapeHtml(codeFor(r.ex))}</span></td>` +
                  `<td class="num">${fmt(r.e1rm)}</td></tr>`,
              )
              .join("") +
            `</tbody></table>`;
      cards.push(groupCard(g.name, members.length, body));
    }
  }

  els.groupsBody.innerHTML =
    cards.join("") || `<p class="muted">No grouped lifts in the data yet.</p>`;
}

function setupGroupsView() {
  els.groupsAthlete.addEventListener("change", () => deferRender(renderGroupsView));
  renderGroupsView(); // populate the athlete picker before first open
}

// ---- Group view: train two+ people together, levels + workouts side by side --

/** Who's in the current training session (usernames). Seeded with the first two
 * athletes the first time the view opens; the user toggles people in/out. */
const teamSelected = new Set<string>();

/** Render the multi-person Group view: ONE combined table of every exercise any
 * selected athlete has trained, with each person's estimated 1RM side by side so
 * they can be compared directly (— where someone hasn't done it; the leader's
 * cell per row is highlighted). A compact per-person summary sits on top. */
function renderTeamView() {
  const users = distinctUsers(data.records);
  if (teamSelected.size === 0) for (const u of users.slice(0, 2)) teamSelected.add(u.username);
  for (const name of [...teamSelected]) if (!users.some((x) => x.username === name)) teamSelected.delete(name);

  els.teamChips.innerHTML = users
    .map(
      (u) =>
        `<button type="button" class="team-chip${teamSelected.has(u.username) ? " is-active" : ""}" ` +
        `data-username="${escapeHtml(u.username)}">${escapeHtml(u.user)}</button>`,
    )
    .join("");

  const picks = users.filter((u) => teamSelected.has(u.username));
  if (picks.length === 0) {
    els.teamBody.innerHTML = `<p class="muted">Pick at least one person above.</p>`;
    return;
  }
  const formula = currentFormula();
  const recs = computedRecords();

  // Per-person best estimated 1RM by exercise, plus a quick header summary.
  const maps = picks.map((u) => {
    const m = new Map<string, number>();
    for (const p of personalRecords(
      filterRecords(recs, { usernames: [u.username], excludeDropsets: els.excludeDropsets.checked }),
      formula,
      strengthAsOf(),
    ))
      m.set(p.exerciseName, p.bestE1rm.e1rm);
    return m;
  });
  const summaries = picks
    .map((u) => {
      const s = athleteSummary(activeRecords(), u.username);
      const bw = s.bodyweightLast;
      return (
        `<div class="team-sumchip"><strong>${escapeHtml(u.user)}</strong>` +
        `<span class="muted">${bw !== null ? `${fmt(bw)} kg · ` : ""}${s.sessionsPerWeek.toFixed(1)}/wk · ${s.sets} sets</span></div>`
      );
    })
    .join("");

  // Union of every exercise anyone in the group has trained, busiest 1RM first.
  const union = [...new Set(maps.flatMap((m) => [...m.keys()]))];
  const topOf = (ex: string) => Math.max(...maps.map((m) => m.get(ex) ?? 0));
  union.sort((a, b) => topOf(b) - topOf(a));
  const codes = exerciseCodesFor(union, codeFor);

  const head =
    `<thead><tr><th>Exercise</th>${picks.map((u) => `<th class="num">${escapeHtml(u.user)}</th>`).join("")}</tr></thead>`;
  const rows = union
    .map((ex) => {
      const vals = maps.map((m) => m.get(ex));
      const present = vals.filter((v): v is number => v !== undefined);
      const best = present.length ? Math.max(...present) : null;
      const shared = present.length === picks.length && picks.length > 1;
      const cells = vals
        .map((v) => `<td class="num${v !== undefined && v === best ? " team-win" : ""}">${v === undefined ? "—" : fmt(v)}</td>`)
        .join("");
      return (
        `<tr class="${shared ? "team-shared-row" : ""}"><td><span class="ex-code">${escapeHtml(codes.get(ex) ?? codeFor(ex))}</span>` +
        `<span class="gv-sub muted">${escapeHtml(ex)}</span></td>${cells}</tr>`
      );
    })
    .join("");

  els.teamBody.innerHTML =
    `<div class="team-summaries">${summaries}</div>` +
    (union.length
      ? `<div class="team-sec-lbl">All exercises · est 1RM (kg) — shared rows highlighted</div>` +
        `<table class="data-table team-shared-table">${head}<tbody>${rows}</tbody></table>`
      : `<p class="muted">No exercises logged for the selected people in this view.</p>`);
}

function setupTeamView() {
  for (const u of loadTeamPicks()) teamSelected.add(u); // remember last session's picks
  els.teamChips.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".team-chip");
    const name = btn?.dataset.username;
    if (!name) return;
    if (teamSelected.has(name)) teamSelected.delete(name);
    else teamSelected.add(name);
    saveTeamPicks([...teamSelected]);
    renderTeamView();
  });
}

/**
 * Switch the visible top-level panel (leaderboards, athlete, groups, add, …).
 * The old top `.tabs` bar is hidden (CSS) in favour of the bottom nav, but its
 * buttons stay in the DOM as the is-active source of truth; this drives both.
 */
// ---- WorkoutAnalysisView: shared exercise-selection state + derived mode ----
// The unified analysis view (TASK 2). The MODE is derived from how many exercises
// are picked — none = all, one = single, many = compare — so there's no separate
// mode flag to keep in sync. `waSelected` lives at module scope, so it survives
// re-renders and navigating away/back; nothing here touches the existing pages.
type WaMode = "all" | "single" | "compare";
// TWO independent exercise selections (EXR-SEL, two copies): `waSelected` drives
// the calendar + workout history (and the view mode / title / single-lift extras);
// `waGraphSel` drives ONLY the graph. Match buttons copy one into the other.
let waSelected: string[] = [];
let waGraphSel: string[] = [];
// Which selection the SELECTOR rendering / handlers currently act on. Set per
// selector instance while rendering, and from the clicked container's
// data-selscope in handlers. Consumers outside the selector (calendar pills,
// history, drill-in, palette) always use waSelected directly.
type SelScope = "graph" | "hist";
let curSelScope: SelScope = "hist";
function selArr(): string[] { return curSelScope === "graph" ? waGraphSel : waSelected; }
function setSelArr(v: string[]): void { if (curSelScope === "graph") waGraphSel = v; else waSelected = v; }
// One-time seed: the beginning ANL view is a real PRE-SELECTION of ALL the
// athlete's lifts (so the pills show), not a special aggregate view.
let analysisSeeded = false;
/** The default analysis selection: ALL of the athlete's logged lifts (most-trained
 * first). The graph still caps at WA_GRAPH_MAX, so extras are listed, not drawn. */
function defaultSelection(): string[] {
  return exerciseCountsForUser(activeRecords(), els.athlete.value).map((c) => c.exerciseName);
}
/** Max exercises plotted on the analysis graph at once — past this the SVG
 * redraw lags, so extra selections are listed but not drawn (see renderWaGraph). */
const WA_GRAPH_MAX = 10;
// When the Analysis "compare" mode is showing the workout-history list scoped to
// the picked lifts, this holds the RAW exercise names to keep (members expanded
// for combined / comparison groups). Empty = no scoping (the normal full history).
let waListExerciseFilter: string[] = [];
// The Analysis compare-graph dropdown (own SVG instance + view toggle), shown
// only with 2+ exercises picked.
/** Expand selected names to the raw logged exercise names they cover: a combined
 * or comparison group becomes its members; everything else is itself. */
function expandToRawExercises(names: readonly string[]): string[] {
  const byName = new Map(userExerciseDefs.map((d) => [d.name, d]));
  const out = new Set<string>();
  for (const n of names) {
    const def = byName.get(n);
    if (def && (def.identity === "combined" || def.identity === "comparison_group") && def.members?.length)
      for (const m of def.members) out.add(m);
    else out.add(n);
  }
  return [...out];
}
// "all" mode (nothing selected) always shows the workout history list + the year
// calendar. (The old Workouts/Exercise-list toggle and the Overview/Table/Charts/
// Stats layout switcher were removed — browsing exercises is the selector's job
// and a lift's stats live in single mode, so there was nothing left to toggle.)
// Which exercise IDENTITY types the selector offers (TASK 12). Default: originals
// All identity types are included by default (originals + dissolved variants +
// combined + comparison groups), so every kind of lift shows in the selector
// unless the owner unticks one.
const waIncludeIdentities = new Set<ExerciseIdentity>(["original", "dissolved", "combined", "comparison_group"]);
// Metadata filters active in the selector (TASK 19): dim → accepted values.
const waFilterValues: Partial<Record<ExerciseFilterDim, string[]>> = {};
// Unified selector: live search text (TASK 43) and Group By dimension (TASK 45).
let waSearchQuery = "";
// Does the current Analysis search ALSO scope the workout history (chosen via the
// search popup's "Find in history")? Off = the search only filters the picker.
let searchFindHistory = false;
// Index page live search: when set, the Index shows a flat list of matching lifts
// instead of the grouped view, so the bottom search bar FINDS a lift in the Index
// (rather than jumping to the Analysis view).
let bwSearchQuery = "";
let waGroupBy: "none" | ExerciseFilterDim = "function"; // default: group the selector by Function
// Groups (of the current Group-by dimension) turned OFF — their exercises are
// filtered out of the picker. Tap a group header in the Exercises dropdown to
// toggle. Replaces the old separate Filter button.
const waGroupsOff = new Set<string>();
// The picker, calendar and Index all share these CORE group-by dimensions. The
// extra taxonomy dims (body part, joint, movement, plane, difficulty, equipment)
// live only in the Index now — see INDEX_GROUP_MODES.
const WA_GROUPBY_DIMS: ExerciseFilterDim[] = ["discipline", "muscleGroup", "function", "tier"];
// Picker pill mode: individual exercise pills (default) or ONE pill per category
// (manual toggle), so whole categories can be opened/eliminated at once. Categories
// mode needs a Group-by dimension (it groups by it).
let waChipsMode: "exercises" | "categories" = "categories"; // default: whole-category pills (tap to expand)
// Which category's floating exercise dropdown is open (a group key, "__all", or null).
let waCatMenuKey: string | null = null;
let waCatMenuScope: SelScope = "hist";
// Short labels for the category-pill sub-line count (e.g. "4/5 func").
const WA_DIM_SHORT: Partial<Record<ExerciseFilterDim, string>> = {
  function: "func", bodyPart: "part", muscleGroup: "musc", joint: "joint",
  movement: "move", plane: "plane", equipment: "equip", difficulty: "diff", tier: "tier",
};
// Show "missing" exercises too: lifts that exist in the data but aren't in this
// athlete's picker — because they're filtered out (active-set / group toggles) or
// the athlete simply never trained them. Rendered greyed-out so you can see how
// many are hidden, and still tap one to select it.
let waShowMissing = false;
// Universal Analytics Graph state (TASKS 25–29): enabled metrics + config.
const waMetrics = new Set<string>(["e1rm"]);
const waGraphConfig: GraphConfig = { ...DEFAULT_GRAPH_CONFIG };
// S.waPerBodyweight now lives on S (appState).
// User-assigned taxonomy metadata (TASK 24), saved on this device, merged into the
// metadata the filter engine reads so saved joints/movements/planes drive filtering.
let userTaxonomy: UserAssignments = (() => {
  try { return JSON.parse(localStorage.getItem("colosseum.userTaxonomy") ?? "{}") as UserAssignments; } catch { return {}; }
})();
function saveUserTaxonomy(): void {
  try { localStorage.setItem("colosseum.userTaxonomy", JSON.stringify(userTaxonomy)); } catch { /* ignore */ }
}
/** Metadata provider for the filter engine: built-in taxonomy + the user's saved
 * assignments. */
// Muscle group goes through mgsFor so the selector honours the owner's per-muscle
// involvement levels (membership = level ≥ 3), consistent with the Index/calendar.
const waMeta = (name: string, dim: ExerciseFilterDim): string[] =>
  dim === "muscleGroup" ? (mgsFor(name) as string[]) : exerciseMetaValues(name, dim, userTaxonomy);
/** Distinct selectable exercises for the current athlete, tagged by identity:
 * their logged lifts are "original"; the synthetic group derived names they have
 * are "combined" / "comparison_group". De-duplicated by name (originals win). */
function waSelectorExercises(): { name: string; identity: ExerciseIdentity }[] {
  const username = els.athlete.value;
  const out = new Map<string, ExerciseIdentity>();
  for (const c of exerciseCountsForUser(activeRecords(), username)) out.set(c.exerciseName, "original");
  for (const r of computedRecords()) {
    if (r.username !== username || r.exerciseName === "") continue;
    const id = exerciseIdentity(r);
    if (id !== "original" && !out.has(r.exerciseName)) out.set(r.exerciseName, id);
  }
  // User-created defs (dissolved / combined / comparison) are selectable even
  // before any sets are logged to them, and their declared identity always wins
  // (a defined name's name was rejected if it shadowed an existing lift).
  for (const d of userExerciseDefs) out.set(d.name, d.identity);
  // Per-group display mode: hide a combine group's members (or its synthetic) so
  // merged lifts read as ONE entry by default. The records stay (the synthetic is
  // still built from them); only the picker entry is hidden.
  const hidden = groupDisplayHiddenNames();
  return [...out].filter(([name]) => !hidden.has(name)).map(([name, identity]) => ({ name, identity }));
}
/** Exercises that EXIST in the data but aren't in this athlete's picker — either
 * filtered out (active-set / hidden sets) or never trained by them. Drawn from the
 * RAW, unfiltered dataset (so active-set–filtered lifts surface too), minus what
 * the selector already shows. Greyed-out "missing" chips, for awareness. */
function waMissingExercises(): { name: string; identity: ExerciseIdentity }[] {
  const shown = new Set(waSelectorExercises().map((e) => e.name));
  const hidden = groupDisplayHiddenNames(); // intentionally hidden by display mode, not "missing"
  const out = new Map<string, ExerciseIdentity>();
  for (const r of data.records) {
    const n = r.exerciseName;
    if (n === "" || shown.has(n) || hidden.has(n) || out.has(n)) continue;
    out.set(n, "original"); // raw logged lifts read as "original" in the picker
  }
  return [...out].map(([name, identity]) => ({ name, identity }));
}
function waMode(): WaMode {
  return waSelected.length === 0 ? "all" : waSelected.length === 1 ? "single" : "compare";
}
// TASK 3/4: rather than duplicate the existing views, the LIVE panels are
// relocated into the analysis view by mode — the Workouts panel for "all", the
// Exercises panel (drill-in) for "single" — and moved back to their athlete tabs
// when you leave or the mode changes. A node lives in one place at a time, but the
// homes are never visible at once (different top tabs), so the old pages still work.
let analysisPanel: "none" | "workouts" | "exercises" = "none";
/** Move the requested live panel into the analysis content host, returning the
 * other(s) to their home sub-tab. Pure DOM shuffling — no logic duplicated. */
function setAnalysisMainPanel(which: "none" | "workouts" | "exercises"): void {
  const host = document.getElementById("waWorkoutsHost");
  const woPanel = document.getElementById("workoutsPanel");
  const exPanel = document.getElementById("exercisesPanel");
  const woHome = document.getElementById("sub-workouts");
  const exHome = document.getElementById("sub-exercises");
  if (!host || !woPanel || !exPanel || !woHome || !exHome) return;
  // The exercise list's floating search bar lives outside the panel, so it must
  // travel with it (else search would be stranded in the hidden athlete tab).
  const exSearch = document.getElementById("exSearchBar");
  // Return whatever isn't wanted to its home tab.
  if (which !== "workouts" && woPanel.parentElement === host) woHome.appendChild(woPanel);
  if (which !== "exercises" && exPanel.parentElement === host) {
    exHome.appendChild(exPanel);
    if (exSearch) exHome.appendChild(exSearch);
  }
  // Mount the wanted panel.
  if (which === "workouts" && woPanel.parentElement !== host) host.appendChild(woPanel);
  if (which === "exercises" && exPanel.parentElement !== host) {
    host.appendChild(exPanel);
    if (exSearch) host.appendChild(exSearch);
  }
  document.getElementById("waWorkoutsEmpty")?.toggleAttribute("hidden", which !== "none");
  analysisPanel = which;
}
/** Move the athlete picker (.ath-row) AND the legacy "Stats & training mix"
 * (#athleteDetails) to the top of the analysis view, or back to their home
 * #tab-athlete. The hidden #athlete select stays put (source of truth); only the
 * visible chips + sex toggle + the stats disclosure travel. */
function setAnalysisAthletePicker(inAnalysis: boolean): void {
  const row = document.querySelector<HTMLElement>(".ath-row");
  const host = document.getElementById("waAthleteHost");
  const home = document.getElementById("tab-athlete");
  if (!row || !host || !home) return;
  // Only steal them into Analysis when that tab is actually showing — the renderer
  // also runs on athlete change while the legacy Athlete tab is open.
  const analysisVisible = document.getElementById("tab-analysis")?.hidden === false;
  const stats = document.getElementById("athleteDetails");
  const statsHost = document.getElementById("waStatsHost");
  const sel = document.getElementById("athlete"); // stats returns just after this
  if (inAnalysis && analysisVisible) {
    if (row.parentElement !== host) host.appendChild(row);
    if (stats && statsHost && stats.parentElement !== statsHost) statsHost.appendChild(stats);
  } else if (!inAnalysis) {
    if (row.parentElement === host) home.insertBefore(row, home.firstChild);
    if (stats && statsHost && stats.parentElement === statsHost) {
      if (sel && sel.parentElement === home) sel.insertAdjacentElement("afterend", stats);
      else home.appendChild(stats);
    }
  }
}
/** Move the training-year heatmap (#workoutCalendar) into the Analysis view (its
 * own always-on section), or back into #workoutsPanel. It lives inside the
 * Workouts panel in the legacy view, so we pull it out so it shows in every
 * Analysis mode (not just "all"), and hand it back on leave. */
function setAnalysisCalendar(inAnalysis: boolean): void {
  const cal = document.getElementById("workoutCalendar");
  const host = document.getElementById("waCalendarHost");
  const woPanel = document.getElementById("workoutsPanel");
  const woSets = document.getElementById("workoutSets");
  if (!cal || !host || !woPanel) return;
  const analysisVisible = document.getElementById("tab-analysis")?.hidden === false;
  if (inAnalysis && analysisVisible) {
    if (cal.parentElement !== host) host.appendChild(cal);
  } else if (!inAnalysis && cal.parentElement === host) {
    // Return it to its original spot in the Workouts panel: right after #workoutSets.
    if (woSets && woSets.parentElement === woPanel) woSets.insertAdjacentElement("afterend", cal);
    else woPanel.insertBefore(cal, woPanel.firstChild);
  }
}
/** Restore both relocated panels to their home tabs (on leaving the analysis view). */
function restoreAnalysisPanels(): void {
  if (analysisPanel !== "none") setAnalysisMainPanel("none");
  setAnalysisAthletePicker(false);
  setAnalysisCalendar(false);
  waListExerciseFilter = []; // un-scope the workout history for the legacy tab
}

/** Render the analysis view from `waSelected`. Selecting lifts is only a FILTER on
 * one shared view, never a different page — so the main content is always the
 * Workouts history list:
 *   • all            → the full history
 *   • single/compare → the same history, scoped to the picked lift(s)
 * The universal graph (and, for compare, the overlay dropdown) sit above it. It
 * also re-paints the Filters mode readout and the exercise-selector chips. */
/** The workout-history exercise filter, honouring an active Analysis search: with
 * no query it's the passed base (the selection, or [] = all); with a query it's
 * EVERY lift in this athlete's log whose name/code matches — even unselected ones —
 * so a lift buried deep in history is findable from the ONE search bar. Expanded to
 * raw member names; a no-match query maps to a sentinel so the list reads empty. */
function historyFilterWithSearch(base: string[]): string[] {
  // Only scopes the history when the owner chose "Find in history" in the search
  // popup (otherwise a search just filters the picker). Matches EXACTLY the lifts
  // the picker is showing for this query.
  if (!searchFindHistory || !waSearchQuery.trim()) return base;
  const matching = waChipListBase().map((e) => e.name);
  return matching.length ? expandToRawExercises(matching) : [" no-history-match"];
}
/** Recompute the history filter (mode base + search) — for the light keystroke
 * update that refreshes the history without rebuilding the whole Analysis view. */
function refreshHistorySearch(): void {
  const mode = waMode();
  const base = mode === "single" || mode === "compare" ? expandToRawExercises(waSelected) : [];
  waListExerciseFilter = historyFilterWithSearch(base);
}

function renderWorkoutAnalysis(): void {
  // First time in: pre-select ALL of the athlete's lifts in BOTH selectors so the
  // view opens as a real selection (pills shown), not the implicit aggregate.
  if (!analysisSeeded) {
    analysisSeeded = true;
    const all = defaultSelection();
    if (waSelected.length === 0) waSelected = all;
    if (waGraphSel.length === 0) waGraphSel = [...all];
  }
  setAnalysisAthletePicker(true); // athlete chooser pinned at the top of the view
  const mode = waMode();
  // The Workout-history section's collapsible summary doubles as its title, so it
  // reflects the current mode (Exercise analysis / Compare / Exercise list / …).
  const contentTitle = document.getElementById("waTableSummary");
  const stats = document.getElementById("waStats");
  if (mode === "single" || mode === "compare") {
    // Selecting one OR more lifts is just a FILTER on the same all-exercises view —
    // not a different page. Both show the workout HISTORY scoped to the picked
    // lifts (every past set, in the same compact/expandable session rows), with the
    // overlay graph in a dropdown below (renderWaCompareGraph, compare only). The
    // list is the relocated Workouts panel, filtered via waListExerciseFilter.
    selectedExercise = null;
    combinedWith = [];
    waListExerciseFilter = historyFilterWithSearch(expandToRawExercises(waSelected));
    setAnalysisMainPanel("workouts");
    // The fold summary IS the title now (the inner panel title is hidden in
    // Analysis), so it carries the athlete + scope — no redundant second line.
    // Single mode: the title carries an ℹ info icon (opens that lift's details +
    // the editable difficulty of each note-identified variation), right beside the
    // name — no separate "More info" button below.
    if (contentTitle) {
      if (mode === "single" && waSelected[0]) {
        const ex = waSelected[0];
        contentTitle.innerHTML =
          `${escapeHtml(athleteLabel())} — ${escapeHtml(displayName(ex))}${originBadge(ex)}` +
          ` <button type="button" class="wa-moreinfo wa-title-info" data-moreinfoex="${escapeHtml(ex)}" title="${escapeHtml(displayName(ex))} info" aria-label="${escapeHtml(displayName(ex))} info">ℹ</button>`;
      } else {
        contentTitle.textContent = `${athleteLabel()} — selected lifts`;
      }
    }
    // The More-info button moved next to the title, so the old stats slot is empty.
    if (stats) { stats.innerHTML = ""; stats.setAttribute("hidden", ""); }
    S.workoutsPage = 0; // the scoped list is shorter; start at the top
    renderWorkoutsPage();
    } else {
    // All (nothing selected): the live Workouts panel — its history list.
    waListExerciseFilter = historyFilterWithSearch([]);
    setAnalysisMainPanel("workouts");
    if (contentTitle) contentTitle.textContent = `${athleteLabel()} — workouts`;
    stats?.setAttribute("hidden", "");
    renderWorkoutsPage();
    }
  // An active search re-titles the history so it's clear it's showing matches, not
  // the selection (the history list is filtered to them by historyFilterWithSearch).
  if (waSearchQuery.trim() && contentTitle)
    contentTitle.textContent = `${athleteLabel()} — “${waSearchQuery.trim()}” in history`;
  // The training-year calendar shows in EVERY mode (own always-on section). With
  // exercises selected it highlights just those lifts' squares; with nothing
  // selected it keeps the user's own calendar filter (saved/restored around a
  // selection so picking a lift doesn't lose it). Only while Analysis is the
  // visible tab — otherwise the legacy view's own calendar would be hijacked.
  if (document.getElementById("tab-analysis")?.hidden === false) {
    if ((mode === "single" || mode === "compare") && waSelected.length) {
      if (S.heatFiltersSaved === null) S.heatFiltersSaved = S.heatFilters;
      // Expand combined/comparison lifts to their raw member names — the same
      // expansion the history list uses (waListExerciseFilter) — so the calendar
      // counts EVERY set of the selection, not just those logged under the parent
      // name. Without this a merged lift shows all sets in the list but only a few
      // on the calendar.
      S.heatFilters = expandToRawExercises(waSelected).map((n) => `ex:${n}`);
    } else if (S.heatFiltersSaved !== null) {
      S.heatFilters = S.heatFiltersSaved;
      S.heatFiltersSaved = null;
    }
    setAnalysisCalendar(true);
    renderWorkoutCalendar();
  }
  // Two independent exercise selectors: one for the GRAPH, one (sticky) for the
  // calendar + workout history. See renderSelector.
  renderSelector("graph");
  renderSelector("hist");
  // Single-lift extras (machine-type cable/gravity toggle) follow the HISTORY
  // selector (waSelected), per the two-selector design.
  const assignBox = document.getElementById("waAssign");
  if (assignBox) assignBox.innerHTML = (mode === "single" && waSelected[0]) ? machineModeControl(waSelected[0]) : "";
  renderWaGraph();
}

/** Render ONE exercise selector instance. `scope` chooses which selection it edits
 * and draws (graph vs the calendar/history). The two share the ancillary settings
 * (group-by, name mode, identities, search, show-missing); only the SELECTION is
 * per-scope. A "match" button copies the OTHER selector's picks into this one. */
function renderSelector(scope: SelScope): void {
  const sel = document.getElementById(scope === "graph" ? "waExerciseSelector" : "waExerciseSelectorHist");
  if (!sel) return;
  curSelScope = scope;
  sel.dataset.selscope = scope;
  const cur = selArr();
  // Identity-inclusion toggles (shared) — they filter the chips below.
  const idLabels: [ExerciseIdentity, string][] = [
    ["original", "Original"], ["dissolved", "Dissolved"], ["combined", "Combined"], ["comparison_group", "Comparison groups"],
  ];
  const toggles = idLabels
    .map(([id, label]) => `<button type="button" class="wa-name-opt wa-inc-btn${waIncludeIdentities.has(id) ? " is-on" : ""}" data-waident="${id}" aria-pressed="${waIncludeIdentities.has(id)}">${label}</button>`)
    .join("");
  // Chip label mode (shared global name mode) — ONE compact cycling pill (code →
  // short → full), like the history list's. data-waname carries the NEXT mode so a
  // tap advances it (the existing .wa-name-opt handler sets it). No "Show as" label.
  const nextName: NameMode = nameMode === "code" ? "short" : nameMode === "short" ? "full" : "code";
  const nameToggle =
    `<button type="button" class="wa-name-opt name-mode-opt" data-waname="${nextName}" title="Lift labels — tap to cycle: code → short → full">${nameMode === "code" ? "Code" : nameMode === "short" ? "Short" : "Full"}</button>`;
  const groupOpts =
    `<option value="none"${waGroupBy === "none" ? " selected" : ""}>None</option>` +
    WA_GROUPBY_DIMS.map((d) => `<option value="${d}"${waGroupBy === d ? " selected" : ""}>${escapeHtml(FILTER_DIM_LABELS[d])}</option>`).join("");
  const searchActive = waSearchQuery.trim()
    ? `<button type="button" class="wa-searchclear wa-search-active" title="Clear search">🔎 “${escapeHtml(waSearchQuery.trim())}” ✕</button>`
    : "";
  const modeToggle = waGroupBy !== "none"
    ? `<button type="button" class="wa-chipsmode wa-clear" title="Switch the pills between individual exercises and whole categories">Pills: ${waChipsMode === "categories" ? "Categories" : "Exercises"}</button>`
    : "";
  const missingCount = waMissingExercises().length;
  const missingToggle = (missingCount > 0 || waShowMissing)
    ? `<button type="button" class="wa-showmissing wa-name-opt${waShowMissing ? " is-on" : ""}" title="${waShowMissing ? "Hide the greyed-out exercises this athlete hasn't done / are filtered out." : "Show greyed-out exercises that exist but aren't here — filtered out or never trained."}">${waShowMissing ? "Hide missing" : `Show missing <span class="wa-miss-n">(${missingCount})</span>`}</button>`
    : "";
  // "Match" button: copy the OTHER selector's selection into this one.
  const matchSrc = scope === "graph" ? "hist" : "graph";
  const matchLabel = scope === "graph" ? "Match history" : "Match graph";
  const matchBtn = `<button type="button" class="wa-clear wa-match" data-matchfrom="${matchSrc}" title="Copy the other selector's picks here">${matchLabel}</button>`;
  // These controls live at the TOP level (in the header, next to the button), not
  // buried in the menu: Group-by, Pills mode, Select all, Clear.
  const groupCtl = `<label class="wa-gcfg-f wa-sel-group" title="Group the picker by"><select class="wa-groupby">${groupOpts}</select></label>`;
  const selAllBtn = `<button type="button" class="wa-selectall wa-clear">Select all</button>`;
  const clearBtn = `<button type="button" class="wa-clearsel wa-clear"${cur.length ? "" : " disabled"}>Clear</button>`;
  // The exercise-selector DROPDOWN is gone: its picker chips now live inline (below
  // the controls) and its settings/tools moved into a small ⚙ popout. A plain label
  // keeps the "what / how many" context the old dropdown summary showed.
  const foldTools = `<div class="wa-chips-tools">${matchBtn}${missingToggle}${searchActive}</div>`;
  const settingsBlock = `<div class="wa-fold-settings">${toggles}${nameToggle}</div>`;
  const prevChipScroll = sel.querySelector<HTMLElement>(".wa-chips-wrap")?.scrollTop ?? 0;
  // Everything but Group lives in the ⚙ popout now: pick-mode, Select all / Clear,
  // Match, Show missing, the identity toggles and name mode. Its open state MUST
  // survive the re-render every inner toggle triggers — otherwise tapping any option
  // rebuilds the menu closed (the recurring "clicking a setting closes the menu" bug).
  const cogOpen = sel.querySelector<HTMLDetailsElement>(".wa-sel-cog")?.open ?? false;
  const settingsCog =
    `<details class="wa-sel-cog"${cogOpen ? " open" : ""}><summary class="wa-sel-cog-sum" title="Selector settings — pick mode, select all / clear, identities, name mode, match, show missing">⚙</summary>` +
    `<div class="wa-sel-cog-menu"><div class="wa-chips-tools">${modeToggle}${selAllBtn}${clearBtn}</div>${foldTools}${settingsBlock}</div></details>`;
  // Selected pills. For the GRAPH selector the first WA_GRAPH_MAX are marked 📈 (the
  // graph's point budget) with a "Trim to N" button; the history selector has no cap.
  const onGraph = scope === "graph" ? new Set(cur.slice(0, WA_GRAPH_MAX)) : new Set<string>();
  const stickyCats = waChipsMode === "categories" && waGroupBy !== "none";
  let selPills = "";
  if (stickyCats) {
    // Category mode: the always-visible top strip IS the whole-category picker — one
    // expandable pill per group (tap opens its exercises), horizontally scrollable.
    // No "all" pill (redundant with Select all / Clear in the ⚙) and no count label.
    selPills = `<div class="wa-sel-pills wa-catstrip">${waCatPillsInner(waChipListBase())}</div>`;
  } else if (cur.length) {
    selPills = `<div class="wa-sel-pills">` +
      cur.map((n) => {
        const g = onGraph.has(n);
        const dot = g ? `<span class="wa-sel-graphdot" aria-hidden="true"></span>` : "";
        const title = scope === "graph"
          ? (g ? `On the graph · tap to remove ${n}` : `Selected but past the graph's ${WA_GRAPH_MAX}-lift limit · tap to remove ${n}`)
          : `Tap to remove ${n}`;
        return `<button type="button" class="wa-sel-pill${scope === "graph" ? (g ? " is-graphed" : " is-ungraphed") : ""}" data-waselpill="${escapeHtml(n)}" title="${escapeHtml(title)}">${dot}${escapeHtml(displayName(n))}<span class="wa-sel-pill-x">✕</span></button>`;
      }).join("") + `</div>`;
  }
  const trimBtn = (scope === "graph" && cur.length > WA_GRAPH_MAX)
    ? `<button type="button" class="wa-clear wa-trimgraph wa-match-graph" title="Trim this graph selection to just the ${WA_GRAPH_MAX} lifts the graph plots">Trim to ${WA_GRAPH_MAX}</button>`
    : "";
  // Picker chips live INLINE now (no dropdown). In category-strip mode the outside
  // strip (selPills) IS the picker, so the grid is hidden to avoid duplication;
  // otherwise the chip grid shows below the controls.
  const showGrid = !stickyCats;
  sel.innerHTML =
    `<div class="wa-sel-header">` +
    `<div class="wa-sel-tools">${groupCtl}${settingsCog}${trimBtn}</div>` +
    `</div>` +
    selPills +
    (showGrid ? `<div id="waChips-${scope}" class="wa-chips wa-chips-wrap wa-chips-inline"></div>` : "");
  if (showGrid) renderWaChipsScope(scope);
  const newWrap = sel.querySelector<HTMLElement>(".wa-chips-wrap");
  if (newWrap) newWrap.scrollTop = prevChipScroll;
}

/** One chip for an exercise (selected state + identity). `missing` greys it out:
 * a lift that exists but isn't in this athlete's picker (filtered / never done). */
function waChipHtml(name: string, identity: ExerciseIdentity, missing = false): string {
  const on = selArr().includes(name);
  const label = displayName(name);
  // Tapping the chip selects/deselects; the trailing ⓘ opens its More-info overlay
  // (so you can check a lift that's buried in history without hunting for it).
  const title = missing ? `${name} — hidden (filtered out or never trained)` : `${name} (${identity})`;
  return `<button type="button" class="wa-ex-chip${nameMode !== "code" ? " is-full" : ""}${on ? " is-on" : ""}${missing ? " is-missing" : ""}" data-waex="${escapeHtml(name)}" data-waident="${identity}" aria-pressed="${on}" title="${escapeHtml(title)}">${escapeHtml(label)}<span class="wa-ex-info" data-waexinfo="${escapeHtml(name)}" role="button" aria-label="More info about ${escapeHtml(name)}" title="More info">ⓘ</span></button>`;
}

/** The selector's current exercise list: identity-included, metadata-filtered
 * (TASK 44) and search-narrowed (TASK 43). */
/** Identity-included + search-narrowed (ALL groups). Group headers are built from
 * this so a turned-off group still shows its header (to switch back on). */
function waChipListBase(): { name: string; identity: ExerciseIdentity; missing?: boolean }[] {
  const byIdentity = waSelectorExercises().filter((e) => waIncludeIdentities.has(e.identity));
  // When "Show missing" is on, append the hidden/never-trained lifts (greyed) so
  // the picker reveals the whole catalogue, not just what this athlete has done.
  const q = waSearchQuery.trim().toLowerCase();
  // While SEARCHING, span the whole catalogue (append the missing/never-trained
  // lifts) so any lift is findable by name, code OR short name — not just the ones
  // this athlete has already trained. When not searching, only show-missing adds them.
  const includeMissing = waShowMissing || q.length > 0;
  const list: { name: string; identity: ExerciseIdentity; missing?: boolean }[] = [
    ...byIdentity,
    ...(includeMissing ? waMissingExercises().map((e) => ({ ...e, missing: true })) : []),
  ];
  return list.filter((e) => !q
    || e.name.toLowerCase().includes(q)
    || codeFor(e.name).toLowerCase().includes(q)
    || shortFor(e.name).toLowerCase().includes(q));
}
/** The group key (of the current Group-by dimension) an exercise falls under. */
function waGroupKey(name: string): string {
  if (waGroupBy === "none") return "";
  // "Strength" is too broad: when grouping by Discipline, split strength lifts by
  // their MUSCLE GROUP instead (Chest, Back, Quads…), so each shows as its own pill.
  // The pills are still tagged as falling under Strength (see waGroupIsStrength).
  if (waGroupBy === "discipline") {
    const disc = waMeta(name, "discipline")[0] ?? "";
    if (disc === "Strength") return waMeta(name, "muscleGroup")[0] ?? "Other";
    if (disc === "Statics") return "Other"; // fold the tiny Statics discipline into the Other catch-all
  }
  return waMeta(name, waGroupBy)[0] ?? "Unassigned";
}
/** True when a Discipline-grouping key is one of Strength's muscle-group sub-pills
 * (so the UI can show the subtle "Strength" umbrella tag). */
function waGroupIsStrength(key: string): boolean {
  return waGroupBy === "discipline" && (INDEX_MUSCLES as readonly string[]).includes(key);
}
/** Sort rank for a selector group header: Discipline & Muscle group follow their
 * curated order (so Strength leads the disciplines, not alphabetical); other
 * dimensions fall through to an alphabetical tiebreak. Unknown keys sort last. */
function waGroupRank(key: string): number {
  // Discipline grouping splits Strength into muscle-group pills — rank those inside
  // Strength's slot (by muscle order) so they lead and stay together.
  if (waGroupBy === "discipline" && waGroupIsStrength(key))
    return DISCIPLINES.indexOf("Strength") + (INDEX_MUSCLES as readonly string[]).indexOf(key) / 100;
  const order: readonly string[] =
    waGroupBy === "discipline" ? DISCIPLINES
    : waGroupBy === "muscleGroup" ? INDEX_MUSCLES
    : [];
  const i = order.indexOf(key);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}
/** waChipListBase minus the exercises in turned-off groups (used by Select-all). */
function waChipList(): { name: string; identity: ExerciseIdentity; missing?: boolean }[] {
  if (waGroupBy === "none" || waGroupsOff.size === 0) return waChipListBase();
  return waChipListBase().filter((e) => !waGroupsOff.has(waGroupKey(e.name)));
}

/** Re-fill BOTH selectors' chip lists (each from its own selection). */
function renderWaChips(): void {
  renderWaChipsScope("graph");
  renderWaChipsScope("hist");
}
/** Fill ONE selector's chips — flat, or grouped under headers by the Group By
 * dimension. Re-rendered alone on search/group changes so typing keeps focus. */
function renderWaChipsScope(scope: SelScope): void {
  curSelScope = scope;
  const box = document.getElementById(`waChips-${scope}`);
  if (!box) return;
  const list = waChipListBase(); // ALL groups (so an off group still shows its header)
  if (list.length === 0) {
    box.innerHTML = `<p class="muted wa-placeholder">No exercises match the search.</p>`;
    return;
  }
  // Categories mode (manual toggle): one pill per group — counts + sub-groups —
  // and tapping a pill opens that category's exercises in a floating dropdown.
  if (waChipsMode === "categories" && waGroupBy !== "none") {
    box.innerHTML = waCatPillsHtml(list);
    if (waCatMenuKey !== null) renderWaCatMenu(); // keep an open dropdown's counts fresh
    return;
  }
  if (waGroupBy === "none") {
    box.innerHTML = `<div class="wa-ex-chips">${list.map((e) => waChipHtml(e.name, e.identity, e.missing)).join("")}</div>`;
    return;
  }
  const groups = new Map<string, typeof list>();
  for (const e of list) {
    const key = waGroupKey(e.name);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }
  const chips = (items: typeof list) => `<div class="wa-ex-chips">${items.map((e) => waChipHtml(e.name, e.identity, e.missing)).join("")}</div>`;
  box.innerHTML = [...groups.entries()]
    .sort((a, b) => (waGroupRank(a[0]) - waGroupRank(b[0])) || a[0].localeCompare(b[0]))
    .map(([g, items]) => {
      // The group HEADER is a toggle: tap to filter that whole group in / out of the
      // picker (replaces the old Filter button). An off group shows just its header.
      const off = waGroupsOff.has(g);
      const umbrella = waGroupIsStrength(g) ? ` <span class="wa-cat-umbrella muted">Strength</span>` : "";
      const header =
        `<button type="button" class="wa-group-h${off ? " is-off" : ""}" data-grpoff="${escapeHtml(g)}" ` +
        `title="${off ? "Show this group" : "Hide this group"}">${escapeHtml(g)} <span class="muted">(${items.length})</span>${umbrella}${off ? " · hidden" : ""}</button>`;
      if (off) return `<div class="wa-group">${header}</div>`;
      // Within a group, cluster related families (e.g. all handstand variants) under
      // a nested sub-header; everything else stays directly under the group.
      const direct: typeof list = [];
      const subs = new Map<string, typeof list>();
      for (const e of items) {
        const sg = exerciseSubgroup(e.name);
        if (sg) (subs.get(sg) ?? subs.set(sg, []).get(sg)!).push(e);
        else direct.push(e);
      }
      const subHtml = [...subs.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(
          ([sg, sgItems]) =>
            `<div class="wa-subgroup"><div class="wa-subgroup-h">${escapeHtml(sg)} <span class="muted">(${sgItems.length})</span></div>${chips(sgItems)}</div>`,
        )
        .join("");
      return (
        `<div class="wa-group">${header}` +
        (direct.length ? chips(direct) : "") + subHtml + `</div>`
      );
    })
    .join("");
}

/** A finer "family" subgroup within a group — all handstand variants cluster under
 * "Handstand". null = no subgroup (the chip sits directly under its group). */
function exerciseSubgroup(name: string): string | null {
  const n = name.toLowerCase();
  if (/handstand/.test(n)) return "Handstand";
  // Deadlift family split into finer sub-headers (most-specific first, so a
  // "Romanian Deadlift" reads as hamstring, not the plain deadlift bucket).
  if (/rdl|romanian|stiff[ -]?leg|nordic|leg curl|hamstring/.test(n)) return "Stiff-leg / RDL (hamstring)";
  if (/back extension|hyperextension|reverse hyper|good ?morning|superman|jefferson/.test(n)) return "Back extension";
  if (/deadlift|rack pull/.test(n)) return "Deadlift";
  return null;
}

// ---- Categories-mode picker: one pill per group + a floating exercise dropdown ----
type WaItem = { name: string; identity: ExerciseIdentity };
/** How many of these picker items are currently selected. */
function waSelCount(items: readonly WaItem[]): number {
  const sel = new Set(selArr());
  let n = 0;
  for (const e of items) if (sel.has(e.name)) n++;
  return n;
}
/** Sub-group coverage within a category: how many of its finer families have at
 * least one exercise selected, out of the total number of families present. */
function waSubgroupCoverage(items: readonly WaItem[]): { sel: number; total: number } {
  const sel = new Set(selArr());
  const has = new Map<string, boolean>(); // subgroup key → any selected?
  for (const e of items) {
    const sg = exerciseSubgroup(e.name) ?? "·"; // ungrouped lifts share one bucket
    has.set(sg, (has.get(sg) ?? false) || sel.has(e.name));
  }
  let s = 0;
  for (const v of has.values()) if (v) s++;
  return { sel: s, total: has.size };
}
/** One category pill: main "label sel/total", plus a smaller sub-group line. */
function waCatPill(key: string, label: string, sel: number, tot: number, subSel: number, subTot: number, subLabel: string): string {
  const cls = sel === 0 ? "" : sel >= tot ? " is-on is-full" : " is-on";
  // Subtle umbrella tag: a muscle-group pill under Discipline grouping is a slice of
  // "Strength" — show it small so you know the broader category it belongs to.
  const umbrella = waGroupIsStrength(key) ? `<span class="wa-cat-umbrella muted">Strength</span>` : "";
  const sub = umbrella || (subTot > 1 ? `<span class="wa-cat-sub muted">${subSel}/${subTot} ${escapeHtml(subLabel)}</span>` : "");
  return (
    `<button type="button" class="wa-cat-pill${cls}${umbrella ? " wa-cat-strength" : ""}" data-wacat="${escapeHtml(key)}" aria-expanded="${waCatMenuKey === key}" title="Open ${escapeHtml(label)}${umbrella ? " (Strength)" : ""} — pick exercises or toggle the whole group">` +
    `<span class="wa-cat-main">${escapeHtml(label)} <span class="wa-cat-count">${sel}/${tot}</span></span>${sub}</button>`
  );
}
/** The full category-pill row: an "all" pill + one pill per group. */
/** Just the category pills (an "all" pill + one per group), no wrapper. Shared by
 * the dropdown (wrapped, multi-row) and the top strip (horizontally scrollable). */
/** The "all" summary category pill (every shown exercise). Kept separate so it can
 * sit on its OWN row ABOVE the horizontally-scrolling per-group pills. */
function waCatAllPill(list: readonly WaItem[]): string {
  const groups = new Map<string, WaItem[]>();
  for (const e of list) groups.set(waGroupKey(e.name), []);
  const dimShort = WA_DIM_SHORT[waGroupBy as ExerciseFilterDim] ?? "grp";
  let groupsCovered = 0;
  const byGroup = new Map<string, WaItem[]>();
  for (const e of list) { const k = waGroupKey(e.name); (byGroup.get(k) ?? byGroup.set(k, []).get(k)!).push(e); }
  for (const g of byGroup.values()) if (waSelCount(g) > 0) groupsCovered++;
  return waCatPill("__all", "all", waSelCount(list), list.length, groupsCovered, byGroup.size, dimShort);
}
/** The per-group category pills (NOT the "all" pill — see waCatAllPill). */
function waCatPillsInner(list: readonly WaItem[]): string {
  const groups = new Map<string, WaItem[]>();
  for (const e of list) {
    const k = waGroupKey(e.name);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(e);
  }
  // Sort the pills by total SET COUNT (most-trained category first), then alpha —
  // so the categories you actually train lead, not a fixed taxonomy order.
  const setCount = new Map<string, number>();
  for (const c of exerciseCountsForUser(activeRecords(), els.athlete.value)) setCount.set(c.exerciseName, c.count);
  const groupSets = (items: readonly WaItem[]) => items.reduce((n, e) => n + (setCount.get(e.name) ?? 0), 0);
  return [...groups.entries()]
    .sort((a, b) => (groupSets(b[1]) - groupSets(a[1])) || a[0].localeCompare(b[0]))
    .map(([k, items]) => {
      const cov = waSubgroupCoverage(items);
      return waCatPill(k, k, waSelCount(items), items.length, cov.sel, cov.total, "sub");
    })
    .join("");
}
function waCatPillsHtml(list: readonly WaItem[]): string {
  return `<div class="wa-cat-allrow">${waCatAllPill(list)}</div><div class="wa-cat-pills">${waCatPillsInner(list)}</div>`;
}
/** The exercises a category pill covers ("__all" = every shown exercise). */
function waCatItems(key: string): WaItem[] {
  const list = waChipListBase();
  return key === "__all" ? list : list.filter((e) => waGroupKey(e.name) === key);
}
function openWaCatMenu(key: string, anchor: HTMLElement, scope: SelScope): void {
  waCatMenuKey = key;
  waCatMenuScope = scope;
  let m = document.getElementById("waCatMenu");
  if (!m) {
    m = document.createElement("div");
    m.id = "waCatMenu";
    m.className = "wa-cat-menu";
    document.body.appendChild(m);
  }
  renderWaCatMenu();
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = Math.min(window.innerWidth - 16, 340);
  m.style.width = `${w}px`;
  m.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
  m.style.top = `${Math.min(r.bottom + 6, window.innerHeight - 80)}px`;
  // Reflect open state on the pills.
  for (const p of document.querySelectorAll<HTMLElement>(".wa-cat-pill"))
    p.setAttribute("aria-expanded", String(p.dataset.wacat === key));
}
function closeWaCatMenu(): void {
  waCatMenuKey = null;
  const m = document.getElementById("waCatMenu");
  if (m) m.hidden = true;
  for (const p of document.querySelectorAll<HTMLElement>(".wa-cat-pill")) p.setAttribute("aria-expanded", "false");
}
function renderWaCatMenu(): void {
  const m = document.getElementById("waCatMenu");
  if (!m || waCatMenuKey === null) return;
  curSelScope = waCatMenuScope;
  const items = waCatItems(waCatMenuKey);
  const sel = waSelCount(items);
  const label = waCatMenuKey === "__all" ? "All exercises" : waCatMenuKey;
  const allOn = items.length > 0 && sel >= items.length;
  m.innerHTML =
    `<div class="wa-cat-menu-head">` +
    `<span class="wa-cat-menu-title">${escapeHtml(label)} <span class="muted">${sel}/${items.length}</span></span>` +
    `<button type="button" class="wa-catall wa-clear" data-catallon="${allOn ? "0" : "1"}">${allOn ? "Deselect all" : "Select all"}</button>` +
    `<button type="button" class="wa-catclose" aria-label="Close">✕</button>` +
    `</div>` +
    `<div class="wa-cat-menu-chips wa-ex-chips">${items.map((e) => waChipHtml(e.name, e.identity)).join("")}</div>`;
}

// Snappy clicks: a Graph-options tap updates its own control instantly, then the
// heavy graph redraw is deferred to the next frame and COALESCED — many quick taps
// = one redraw, and it never blocks the tap (see the #senior rule in CLAUDE.md).
let waGraphRaf = 0;
function scheduleWaGraph(): void {
  if (waGraphRaf) return;
  const y = window.scrollY; // renderWaGraph rebuilds the graph block (innerHTML) →
  waGraphRaf = requestAnimationFrame(() => { // would shift the page; pin scroll.
    waGraphRaf = 0;
    renderWaGraph();
    if (window.scrollY !== y) window.scrollTo(0, y);
  });
}
// A chart-ONLY re-plot, set up at the end of each renderWaGraph: re-runs the SVG
// chart with the current config but does NOT rebuild the options menu — so a live
// slider drag (Volume shift) updates the bars without yanking the slider mid-drag.
let waReplotChart: (() => void) | null = null;
let waChartRaf = 0;
function scheduleWaChartOnly(): void {
  if (waChartRaf) return;
  waChartRaf = requestAnimationFrame(() => { waChartRaf = 0; waReplotChart?.(); });
}

/** Universal Analytics Graph section (TASKS 25–29): metric toggles + config +
 * the reusable graph, rendered from the current selection. Light to re-render, so
 * metric/config changes don't disturb the hosted panels or the selection. */
function renderWaGraph(): void {
  const box = document.getElementById("waGraph");
  if (!box) return;
  // Work out the plotted exercises FIRST, so the metric chips can reflect what's
  // allowed for them (everything is blocked until reviewed in More info).
  waGraphConfig.formula = currentFormula(); // preserve the app-wide 1RM formula (TASK 33)
  // Per-set RIR resolver so the scatter sizes each dot by effort (logged grade,
  // else predicted). Built per render — the strength map is shared across all sets.
  {
    const fm = waGraphConfig.formula;
    const sm = currentStrengthByUserExercise(fm);
    waGraphConfig.rirOf = (r) => rirBandMid(rpeFor(r)) ?? predictedRir(currentStrengthFor(sm, r), r.weight, r.reps, fm);
  }
  const athleteRecs = applyHardSetsFilter(computedRecords().filter((r) => r.username === els.athlete.value));
  const autoDefault = waGraphSel.length === 0;
  const baseExercises = autoDefault
    ? exerciseCountsForUser(athleteRecs, els.athlete.value).map((e) => e.exerciseName)
    : waGraphSel;
  const graphExercises = baseExercises.slice(0, WA_GRAPH_MAX);
  const graphExcluded = baseExercises.slice(WA_GRAPH_MAX);
  // A metric may draw only when EVERY plotted exercise allows it (intersection)
  // — UNLESS the global "All graphs" override is on, which lets everything draw.
  const scopeAllowed = allGraphsAllowed
    ? new Set(ALL_GRAPH_METRIC_IDS)
    : metricsAllowedForScope(graphPerms, graphExercises);
  const drawMetricIds = [...waMetrics].filter((id) => scopeAllowed.has(id));
  // The 15 metrics were one crowded wall of chips — split into a few collapsible
  // sub-groups (a group opens when it has an active metric). A metric still
  // blocked for the plotted lift(s) shows greyed-out with a needs-review tip.
  const METRIC_GROUPS: { label: string; ids: string[] }[] = [
    { label: "Strength", ids: ["e1rm", "weight", "weightRange", "pctWR"] },
    { label: "Trends", ids: ["strength", "strengthDecay", "predicted", "trend", "movingAvg", "pr"] },
    { label: "Volume & frequency", ids: ["volume", "volumeLoad", "reps", "sets", "frequency"] },
  ];
  const metricChips = METRIC_GROUPS.map((g) => {
    const chips = g.ids
      .map((id) => GRAPH_METRICS.find((x) => x.id === id))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => {
        const blocked = graphExercises.length > 0 && !scopeAllowed.has(m.id);
        const blockers = blocked ? exercisesBlockingMetric(graphPerms, graphExercises, m.id) : [];
        const title = blocked ? ` title="Needs review for: ${escapeHtml(blockers.join(", "))}"` : "";
        return `<button type="button" class="wa-metric${waMetrics.has(m.id) ? " is-on" : ""}${blocked ? " is-blocked" : ""}" data-wametric="${m.id}"${title}>${escapeHtml(m.label)}</button>`;
      })
      .join("");
    const nOn = g.ids.filter((id) => waMetrics.has(id)).length;
    return (
      `<details class="wa-metric-group"${nOn ? " open" : ""}>` +
      `<summary class="wa-metric-group-sum">${escapeHtml(g.label)}${nOn ? ` <span class="muted">(${nOn})</span>` : ""}</summary>` +
      `<div class="wa-metric-chips">${chips}</div></details>`
    );
  }).join("");
  const c = waGraphConfig;
  const opt = (v: string, cur: string, label: string) => `<option value="${v}"${v === cur ? " selected" : ""}>${label}</option>`;
  // The app-wide "realistic ⇄ compacted time" toggle now lives HERE in Graph
  // options (not on the chart's own legend row), so all the graph settings sit in
  // one place. It flips the shared pref; every time chart redraws on change.
  const compact = getTimeCompact();
  const cfgUi =
    `<div class="wa-gcfg">` +
    `<label class="wa-gcfg-f">Aggregate<select class="wa-cfg" data-wacfg="aggregation">${opt("none", c.aggregation, "Every set")}${opt("max", c.aggregation, "Max")}${opt("avg", c.aggregation, "Average")}${opt("sum", c.aggregation, "Sum")}</select></label>` +
    `<label class="wa-gcfg-f">Interval<select class="wa-cfg" data-wacfg="interval">${opt("day", c.interval, "Day")}${opt("week", c.interval, "Week")}${opt("month", c.interval, "Month")}</select></label>` +
    `<button type="button" class="wa-name-opt" data-wasmooth title="Smoothing window — sets averaged together (0 = off). Tap to cycle.">Smoothing: ${c.smoothing}</button>` +
    `<label class="wa-gcfg-f" title="Bar (Volume) transparency — 1 solid, lower see-through.">Opacity<input class="wa-cfg" data-wacfg="opacity" type="range" min="0.1" max="1" step="0.05" value="${c.opacity}" /></label>` +
    `<label class="wa-gcfg-f" title="Bar girth — fatten or slim the bars (grouped bars get thin when many lifts are shown).">Bar girth<input class="wa-cfg" data-wacfg="barGirth" type="range" min="0.5" max="4" step="0.25" value="${c.barGirth}" /></label>` +
    `<label class="wa-gcfg-f" title="Right-axis height vs the left (kg) axis: 1 = auto, below 1 makes the right-axis bars taller, above 1 shorter.">Right axis ↕<input class="wa-cfg" data-wacfg="rightHeadroom" type="range" min="0.25" max="4" step="0.25" value="${c.rightHeadroom}" /></label>` +
    `<label class="wa-gcfg-f" title="Move the Volume bars UP or DOWN, away from the 1RM and other lines on the same dates — the two only differ by axis, so the shift is vertical, not in time. 0 = on the floor.">Volume shift<span class="wa-shift-val"> ${c.volumeYShift > 0 ? "+" : ""}${Math.round(c.volumeYShift * 100)}%</span><input class="wa-cfg" data-wacfg="volumeYShift" type="range" min="-0.8" max="0.8" step="0.05" value="${c.volumeYShift}" /></label>` +
    `<label class="wa-inc"><input type="checkbox" class="wa-cfg" data-wacfg="prediction"${c.prediction ? " checked" : ""} /> Prediction</label>` +
    `<label class="wa-inc"><input type="checkbox" class="wa-cfg" data-wacfg="decay"${c.decay ? " checked" : ""} /> Decay</label>` +
    `<label class="wa-inc" title="Show the kg metrics (1RM, weight, strength) as multiples of your bodyweight instead of kilograms."><input type="checkbox" id="waPerBw"${S.waPerBodyweight ? " checked" : ""} /> Per bodyweight (×BW)</label>` +
    `<label class="wa-inc" title="Drop easy / warm-up sets (high reps-in-reserve) — keep only hard working sets. Also applies to the training calendar."><input type="checkbox" id="waHardOnly"${waHardOnly ? " checked" : ""} /> Hard sets only</label>` +
    `<button type="button" class="wa-name-opt${compact ? " is-on" : ""}" data-watime="1" title="${compact ? "Showing compacted time (gaps squeezed). Tap for real spacing." : "Showing real time spacing. Tap to squeeze gaps so all sets fit."}">${compact ? "⇄ Compacted time" : "⇄ Realistic time"}</button>` +
    `<button type="button" class="wa-name-opt${allGraphsAllowed ? " is-on" : ""}" data-allgraphs="1" title="${allGraphsAllowed ? "Showing ALL graphs, ignoring per-exercise approval. Tap for approved-only." : "Showing only approved graphs. Tap to show all, ignoring approval."}">${allGraphsAllowed ? "All graphs" : "Approved only"}</button>` +
    `</div>`;
  const prevGcfg = box.querySelector<HTMLDetailsElement>(".wa-graph-fold");
  if (prevGcfg) S.waGraphFoldOpen = prevGcfg.open;
  // GRAPH-3: the metric chips + advanced options (formula/aggregation/interval/
  // smoothing/prediction/decay) all live inside the collapsible "Graph options"
  // disclosure, so the section stays compact — just the chart shows by default.
  // The summary names what's currently plotted so you can see it while collapsed.
  const activeLabels = GRAPH_METRICS.filter((m) => waMetrics.has(m.id)).map((m) => m.label);
  const sumText = activeLabels.length ? activeLabels.join(", ") : "none selected";
  // Graph options + the chart's Legend sit SIDE BY SIDE in one bar BELOW the chart,
  // both as floating dropdowns (their menus overlay the chart, so opening either
  // never pushes the layout or needs a scroll). The legend element is rendered by
  // the SVG engine inside #waGraphChart; we relocate it down into this bar after the
  // chart draws (its innerHTML keeps updating in place wherever it lives).
  const graphBarHtml =
    `<div class="wa-graph-bar">` +
    `<details class="wa-graph-fold"${S.waGraphFoldOpen ? " open" : ""}>` +
    `<summary class="wa-graph-fold-sum">Graph options <span class="muted wa-graph-fold-cur">· ${escapeHtml(sumText)}</span></summary>` +
    `<div class="wa-graph-menu"><div class="wa-metric-row" role="group" aria-label="Graph metric">${metricChips}</div>${cfgUi}</div>` +
    `</details>` +
    `</div>`;
  // Keep #waGraphChart alive across option/selection re-renders so pan/zoom isn't
  // wiped and pointer listeners stay attached (innerHTML used to recreate it every time).
  let chartBox = box.querySelector<HTMLElement>("#waGraphChart");
  let preservedLegend: Element | null = null;
  if (!chartBox) {
    box.innerHTML =
      `<div id="waGraphChart"></div>${graphBarHtml}<div class="muted wa-placeholder" id="waGraphNote"></div>`;
    chartBox = box.querySelector<HTMLElement>("#waGraphChart");
  } else {
    // The legend node was relocated into the bar; the SVG engine keeps writing into
    // THAT node and only makes a fresh one on a full chart re-mount (which we avoid
    // here to preserve pan/zoom). So rescue it before the bar rebuild destroys it,
    // and re-attach it to the new bar below — otherwise the legend vanishes.
    preservedLegend = box.querySelector(".wa-graph-bar .svgc-legend");
    const bar = box.querySelector(".wa-graph-bar");
    if (bar) bar.outerHTML = graphBarHtml;
    else chartBox.insertAdjacentHTML("afterend", graphBarHtml);
    if (!box.querySelector("#waGraphNote")) {
      const afterBar = box.querySelector(".wa-graph-bar") ?? chartBox;
      afterBar.insertAdjacentHTML("afterend", `<div class="muted wa-placeholder" id="waGraphNote"></div>`);
    }
  }
  // Past ~10 lines × several metrics the SVG redraw lags, so plot the first 10
  // and note the rest (graphExercises / graphExcluded computed above). Only the
  // ALLOWED metrics (drawMetricIds) are drawn — blocked ones never plot.
  const analyticsInput = {
    exercises: graphExercises,
    records: athleteRecs,
    metrics: drawMetricIds,
    config: waGraphConfig,
    codeOf: displayName, // legend uses the chosen name mode (short by default), not raw codes
    perBodyweight: S.waPerBodyweight,
    bodyweight: athProfile(els.athlete.value)?.weight ?? null,
    worldRecordKg: (ex: string) => worldRecordKg(ex, athProfile(els.athlete.value)?.sex ?? "m", athProfile(els.athlete.value)?.weight ?? null),
  };
  const drawn = chartBox ? renderAnalyticsGraph(chartBox, analyticsInput) : 0;
  // Re-plot just the chart with the live config (no menu rebuild) — used by the
  // Volume-shift slider's live drag. Reads waGraphConfig at call time, so the
  // current shift is picked up; finds the current chart element each call.
  waReplotChart = () => {
    const cb = document.getElementById("waGraphChart");
    if (cb) renderAnalyticsGraph(cb, analyticsInput);
  };
  // Relocate the chart's legend down into the bar below it so it sits beside Graph
  // options (the SVG engine keeps updating it in place wherever it lives in the DOM).
  const graphBar = box.querySelector(".wa-graph-bar");
  // Fresh mount → the new legend sits inside chartBox; rebuild path → reuse the
  // node we rescued before the bar was replaced (the engine just updated it).
  const legendEl = preservedLegend ?? chartBox?.querySelector(".svgc-legend");
  if (graphBar && legendEl && legendEl.parentElement !== graphBar) graphBar.appendChild(legendEl);
  const noteEl = document.getElementById("waGraphNote");
  if (noteEl) {
    // BLOCKED state: metrics are selected but none is allowed for the plotted
    // lift(s) — show the "needs review" prompt with a button to the Index page.
    const blockedSelected = [...waMetrics].filter((id) => !scopeAllowed.has(id));
    const reviewTarget = graphExercises.find(
      (n) => [...waMetrics].some((id) => !isMetricAllowed(graphPerms, n, id)),
    ) ?? graphExercises[0] ?? "";
    if (graphExercises.length === 0) {
      noteEl.textContent = "No data yet.";
    } else if (waMetrics.size > 0 && drawMetricIds.length === 0) {
      noteEl.innerHTML = graphReviewPromptHtml(reviewTarget, graphExercises);
    } else {
      // Compatibility / unavailable-state messages (TASK 42), scoped to what's
      // actually drawn (the allowed metrics for the plotted exercises).
      const e1rmPoints = athleteRecs.filter(
        (r) => graphExercises.includes(r.exerciseName) && addedWeight1RM(r, currentFormula()) != null,
      ).length;
      const notes = graphCompatibilityNotes(drawMetricIds, waGraphConfig, { e1rmPoints });
      if (drawn === 0 && notes.length === 0) notes.unshift("Not enough data for the selected metric(s).");
      let html = notes.map(escapeHtml).join("  ·  ");
      // Some selected metrics are blocked for some lifts → a compact review nudge.
      if (blockedSelected.length && reviewTarget) {
        html += `${html ? "  ·  " : ""}<span class="wa-gb-inline">${blockedSelected.length} selected graph${blockedSelected.length === 1 ? "" : "s"} need review · <button type="button" class="wa-gb-link" data-graphreview="${escapeHtml(reviewTarget)}">review</button></span>`;
      }
      // Over the cap: just the "N of M" count as a dropdown revealing the rest.
      if (graphExcluded.length) {
        const block =
          `<details class="wa-excluded"><summary>${WA_GRAPH_MAX} of ${baseExercises.length}</summary>` +
          `<div class="wa-excluded-list">${graphExcluded.map(escapeHtml).join(", ")}</div></details>`;
        html = html ? `${html}  ·  ${block}` : block;
      }
      noteEl.innerHTML = html;
    }
  }
}

/** The graph's "needs review" prompt: a warning + a button that jumps to the
 * Index page at the exercise that needs reviewing. Shown when nothing the owner
 * selected is allowed to plot for the current lift(s). */
function graphReviewPromptHtml(targetEx: string, scopeNames: readonly string[]): string {
  const who = scopeNames.length > 1 ? "these exercises" : `“${escapeHtml(scopeNames[0] ?? targetEx)}”`;
  return (
    `<div class="wa-graph-blocked">` +
    `<span class="wa-gb-icon">⚠</span> ` +
    `<span>This graph isn’t enabled for ${who} yet — it needs review.</span> ` +
    (targetEx
      ? `<button type="button" class="wa-gb-btn" data-graphreview="${escapeHtml(targetEx)}">Review in Index →</button>`
      : "") +
    `</div>`
  );
}

/** The Analysis compare-graph dropdown: the multi-line overlay of the picked
 * lifts, in its own collapsible below the workout history. Only meaningful with
 * 2+ exercises selected; the fold is hidden otherwise. Reuses the legacy compare
 * series builder, with its own SVG instance + view toggle. */
// (Compare graph removed — the universal graph already overlays multiple lifts.)


/** The TASK 24 assignment editor for one exercise: joint / movement / plane
 * multi-selects prefilled with its current (saved-or-seeded) values + Save. */
/** Three-way machine-type toggle (cable / gravity / mixed) for the selected lift,
 * shown for exercises that can be done on both a cable and a machine (e.g. Lat
 * Pulldown). In mixed mode it reports how many sets were auto-classified. */
function machineModeControl(name: string): string {
  const eq = equipmentForExercise(name);
  const mode = machineModeFor(name);
  const eligible = (eq.includes("Cable") && eq.includes("Machine")) || mode !== "cable";
  if (!eligible) return "";
  const btn = (m: MachineMode, label: string, title: string) =>
    `<button type="button" class="seg-btn${mode === m ? " is-active" : ""}" data-machinemode="${m}" data-machine-ex="${escapeHtml(name)}" title="${escapeHtml(title)}">${label}</button>`;
  let note = "";
  if (mode === "gravity") {
    note = `<p class="muted wa-machine-note">Every set scaled to its cable-equivalent (×${GRAVITY_MULT}). The logged machine weight still shows in the set list.</p>`;
  } else if (mode === "mixed") {
    const user = els.athlete.value;
    let gravity = 0, review = 0, cable = 0;
    for (const r of data.records.filter((x) => x.username === user && x.exerciseName === name)) {
      const v = mixedVerdictFor(r);
      if (v === "gravity") gravity++; else if (v === "review") review++; else cable++;
    }
    note = `<p class="muted wa-machine-note">Auto-split by your cable strength level: <strong>${cable}</strong> cable · <strong>${gravity}</strong> gravity (×${GRAVITY_MULT})` +
      (review ? ` · <strong class="wa-machine-review">${review} need review</strong>` : "") + `.</p>`;
  }
  return (
    `<div class="wa-machine">` +
    `<div class="wa-machine-head"><span class="wa-ctl-lbl">Machine</span>` +
    `<div class="seg-toggle" role="group" aria-label="Machine type">` +
    btn("cable", "All cable", "Weights as logged (cable stack).") +
    btn("gravity", "All gravity", `Gravity machine — every set ×${GRAVITY_MULT} for strength.`) +
    btn("mixed", "Mixed", "Both machines logged together — auto-classify each set.") +
    `</div></div>` + note + `</div>`
  );
}

/** The per-exercise taxonomy editor (joints / movements / planes + Save). Lives
 * collapsed inside an exercise's Index inspector / ℹ More-info — NOT in the
 * Analysis view — and the saved metadata drives the Analysis filters. Save button
 * + message use classes (not ids) so the editor can appear in two places at once
 * (the Index row inspector and the overlay) without duplicate ids. */
function taxonomyEditorHtml(name: string): string {
  const sel = (cur: readonly string[], all: readonly string[], cls: string) => {
    const have = new Set(cur);
    const opts = all
      .map((v) => `<option value="${escapeHtml(v)}"${have.has(v) ? " selected" : ""}>${escapeHtml(v)}</option>`)
      .join("");
    return `<select class="${cls}" multiple size="5">${opts}</select>`;
  };
  // Joint-specific display aliases (TASK 23): show generic movement → joint label.
  const hints: string[] = [];
  for (const j of waMeta(name, "joint"))
    for (const m of waMeta(name, "movement")) {
      const disp = movementDisplay(m, j);
      if (disp !== m) hints.push(`${escapeHtml(j)}: ${escapeHtml(m)} → ${escapeHtml(disp)}`);
    }
  const hintLine = hints.length
    ? `<p class="muted wa-alias-hint">Joint labels — ${hints.join(" · ")}</p>`
    : "";
  return (
    `<details class="wa-assign"><summary>🏷 Taxonomy: ${escapeHtml(name)}</summary><div class="wa-assign-body">` +
    `<label class="wa-create-f">Joints${sel(waMeta(name, "joint"), JOINTS, "wa-assign-joint")}</label>` +
    `<label class="wa-create-f">Movements${sel(waMeta(name, "movement"), MOVEMENTS, "wa-assign-movement")}</label>` +
    `<label class="wa-create-f">Planes${sel(waMeta(name, "plane"), PLANES, "wa-assign-plane")}</label>` +
    `<div class="wa-create-act"><button type="button" class="wa-assign-save wa-clear" data-waassign="${escapeHtml(name)}">Save taxonomy</button> <span class="wa-assign-msg muted"></span></div>` +
    hintLine +
    `</div></details>`
  );
}

/** Wire the analysis view's selector once: tapping an exercise chip toggles it in
 * `waSelected` (which flips the mode), and "Clear" empties the selection. */
// ---- Persistent command / search bar (always above the bottom nav) ----
// Plain text filters the Analysis exercise selector; a leading "." opens a
// palette of shortcut commands (".": easy to reach on a phone keyboard).
// Designed to speed up the common moves without hunting through menus. New
// commands are easy to add to commandList() below.
interface CmdSpec { cmd: string; desc: string; run: () => void }

/** Jump to the Analysis home (full ANL for admin, simplified S-ANL otherwise). */
function goToAnalysis(): void {
  const tab = analysisTabName();
  if (document.getElementById(`tab-${tab}`)?.hidden !== false) switchTopTab(tab);
  else if (tab === "analysis") renderWorkoutAnalysis();
}
/** Open BOTH exercise-selector section folds so the (now inline) chip lists show
 * search results. (The chips no longer live in a dropdown — they're always inline.) */
function openSelectorFolds(): void {
  for (const id of ["waExerciseSelector", "waExerciseSelectorHist"]) {
    document.getElementById(id)?.closest("details")?.setAttribute("open", "");
  }
}

function commandList(): CmdSpec[] {
  return [
    { cmd: ".all", desc: "Show everything — clear the exercise selection", run: () => { waSelected = []; waGraphSel = []; goToAnalysis(); } },
    { cmd: ".clear", desc: "Clear the current exercise selection", run: () => { waSelected = []; waGraphSel = []; goToAnalysis(); } },
    { cmd: ".names", desc: "Cycle exercise labels: code → short → full (site-wide)", run: () => { setNameMode(nameMode === "code" ? "short" : nameMode === "short" ? "full" : "code"); applyNameModeChange(); goToAnalysis(); } },
    { cmd: ".dark", desc: "Toggle dark / light mode", run: () => els.themeBtn.click() },
    { cmd: ".today", desc: "Jump to today's workout in the history", run: () => { waSelected = []; goToAnalysis(); jumpToWorkoutDate(todayIso()); } },
    { cmd: ".calendar", desc: "Open the training-year calendar", run: () => { goToAnalysis(); for (let el = document.getElementById("waCalendarHost") as HTMLElement | null; el; el = el.parentElement) if (el instanceof HTMLDetailsElement) el.open = true; } },
    { cmd: ".add", desc: "Add a set (open the Add page)", run: () => switchTopTab("add") },
    { cmd: ".data", desc: "Open the Data page", run: () => switchTopTab("data") },
    { cmd: ".help", desc: "List every command (type . to browse)", run: () => { const i = document.getElementById("cmdInput") as HTMLInputElement | null; if (i) { i.value = "."; i.focus(); renderCmdPalette("."); } } },
  ];
}

let cmdActiveIdx = 0;
/** Render the command palette filtered by the text after the "." trigger. */
function renderCmdPalette(value: string): void {
  const pal = document.getElementById("cmdPalette");
  if (!pal) return;
  const q = value.slice(1).trim().toLowerCase();
  const matches = commandList().filter((c) => !q || c.cmd.slice(1).startsWith(q) || c.desc.toLowerCase().includes(q));
  if (matches.length === 0) {
    pal.hidden = false;
    pal.innerHTML = `<div class="cmd-empty muted">No command matches “.${escapeHtml(q)}”</div>`;
    return;
  }
  if (cmdActiveIdx >= matches.length) cmdActiveIdx = 0;
  pal.hidden = false;
  pal.innerHTML = matches
    .map(
      (c, i) =>
        `<button type="button" class="cmd-opt${i === cmdActiveIdx ? " is-active" : ""}" data-cmd="${escapeHtml(c.cmd)}" role="option">` +
        `<span class="cmd-opt-cmd">${escapeHtml(c.cmd)}</span><span class="cmd-opt-desc">${escapeHtml(c.desc)}</span></button>`,
    )
    .join("");
}
function hideCmdPalette(): void {
  const pal = document.getElementById("cmdPalette");
  if (pal) { pal.hidden = true; pal.innerHTML = ""; }
  cmdActiveIdx = 0;
}
/** The plain-text search popup (like the "." command palette): choose whether the
 * query FILTERS the picker (default) or FINDS matching sets in the workout history,
 * plus one-shot Select-all / Clear. Reuses #cmdPalette + the .cmd-opt styling. */
function renderSearchPalette(value: string): void {
  const pal = document.getElementById("cmdPalette");
  if (!pal) return;
  const q = value.trim();
  if (!q) { hideCmdPalette(); return; }
  const n = waChipListBase().length;
  const opts = [
    { act: "filter", label: "🔎 Filter the list", desc: `${n} lift${n === 1 ? "" : "s"} match “${q}”`, on: !searchFindHistory },
    { act: "find", label: "📜 Find in workout history", desc: "Show every matching set in the history below", on: searchFindHistory },
    { act: "select", label: `➕ Select all ${n} matching`, desc: "Add them to the graph selection", on: false },
    { act: "clear", label: "✕ Clear search", desc: "", on: false },
  ];
  if (cmdActiveIdx >= opts.length) cmdActiveIdx = 0;
  pal.hidden = false;
  pal.innerHTML = opts
    .map(
      (o, i) =>
        `<button type="button" class="cmd-opt${i === cmdActiveIdx ? " is-active" : ""}${o.on ? " is-on" : ""}" data-searchact="${o.act}" role="option">` +
        `<span class="cmd-opt-cmd">${escapeHtml(o.label)}</span><span class="cmd-opt-desc">${escapeHtml(o.desc)}</span></button>`,
    )
    .join("");
}
/** Render the right popup for the current bar text ("." → commands, else search). */
function renderPaletteFor(value: string): void {
  if (value.startsWith(".")) renderCmdPalette(value);
  else renderSearchPalette(value);
}
/** Run a chosen search action, then full-refresh the Analysis view. */
function runSearchAction(act: string): void {
  const input = document.getElementById("cmdInput") as HTMLInputElement | null;
  if (act === "filter") searchFindHistory = false;
  else if (act === "find") searchFindHistory = true;
  else if (act === "select") {
    const add = waChipListBase().map((e) => e.name).filter((n) => !waSelected.includes(n));
    if (add.length) waSelected = [...waSelected, ...add];
  } else if (act === "clear") {
    waSearchQuery = "";
    searchFindHistory = false;
    if (input) input.value = "";
  }
  hideCmdPalette();
  if (act === "select" || act === "clear") input?.blur();
  deferRender(renderWorkoutAnalysis); // picker + history + graph all reflect the choice
}
/** Run a command by its "/name", then reset the bar. */
function runCommand(cmd: string): void {
  const spec = commandList().find((c) => c.cmd === cmd);
  const input = document.getElementById("cmdInput") as HTMLInputElement | null;
  if (!spec) return;
  spec.run();
  if (input && cmd !== ".help") input.value = "";
  if (cmd !== ".help") { hideCmdPalette(); input?.blur(); }
}

function setupCommandBar(): void {
  const input = document.getElementById("cmdInput") as HTMLInputElement | null;
  const pal = document.getElementById("cmdPalette");
  if (!input || !pal) return;
  input.addEventListener("input", () => {
    const v = input.value;
    if (v.startsWith(".")) { cmdActiveIdx = 0; renderCmdPalette(v); return; }
    // On the Index page, plain text FINDS the lift in the Index (flat match list) —
    // it doesn't throw you to the Analysis view, and shows no action popup.
    if (document.getElementById("tab-bwparts")?.hidden === false) {
      hideCmdPalette();
      bwSearchQuery = v.trim();
      renderBwParts();
      return;
    }
    // Analysis: the query live-filters the picker; a popup offers Filter / Find in
    // history / Select / Clear (the history only scopes once you choose "Find").
    waSearchQuery = v;
    if (!v.trim()) searchFindHistory = false;
    cmdActiveIdx = 0;
    renderSearchPalette(v);
    if (document.getElementById("tab-analysis")?.hidden !== false) {
      switchTopTab("analysis"); // builds the selector with the new query
      openSelectorFolds();
    } else {
      openSelectorFolds();
      renderWaChips(); // light update so the input keeps focus
      if (searchFindHistory) {
        // In "find" mode, also re-scope the history live as you type.
        refreshHistorySearch();
        if (document.getElementById("workoutsTable")) renderWorkoutsPage();
        const ct = document.getElementById("waTableSummary");
        if (ct) ct.textContent = waSearchQuery.trim()
          ? `${athleteLabel()} — “${waSearchQuery.trim()}” in history`
          : `${athleteLabel()} — ${waSelected.length ? "selected lifts" : "workouts"}`;
      }
    }
  });
  input.addEventListener("keydown", (e) => {
    if (pal.hidden) return;
    const opts = Array.from(pal.querySelectorAll<HTMLElement>(".cmd-opt"));
    if (e.key === "ArrowDown") { e.preventDefault(); cmdActiveIdx = Math.min(cmdActiveIdx + 1, opts.length - 1); renderPaletteFor(input.value); }
    else if (e.key === "ArrowUp") { e.preventDefault(); cmdActiveIdx = Math.max(cmdActiveIdx - 1, 0); renderPaletteFor(input.value); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const active = opts[cmdActiveIdx] ?? opts[0];
      if (active?.dataset.cmd) runCommand(active.dataset.cmd);
      else if (active?.dataset.searchact) runSearchAction(active.dataset.searchact);
    }
    else if (e.key === "Escape") { hideCmdPalette(); input.blur(); }
  });
  pal.addEventListener("click", (e) => {
    const opt = (e.target as HTMLElement).closest<HTMLElement>(".cmd-opt");
    if (opt?.dataset.cmd) runCommand(opt.dataset.cmd);
    else if (opt?.dataset.searchact) runSearchAction(opt.dataset.searchact);
  });
  // Close the palette on a click anywhere outside the bar.
  document.addEventListener("click", (e) => {
    if (!pal.hidden && !document.getElementById("cmdBar")?.contains(e.target as Node)) hideCmdPalette();
  });
}

function setupWorkoutAnalysis(): void {
  const panel = document.getElementById("tab-analysis");
  if (!panel) return;
  // (Exercise search moved to the always-on command bar — see setupCommandBar.)
  // Keep that command bar just above the on-screen keyboard as you scroll: the
  // VisualViewport shrinks when the keyboard opens, so the gap between it and the
  // layout viewport IS the keyboard height. Publish it as --wa-kb-inset; the CSS
  // lifts the fixed command bar by that amount (0 when the keyboard is closed).
  const vv = window.visualViewport;
  if (vv) {
    const updateKbInset = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--wa-kb-inset", `${Math.round(inset)}px`);
      // Keyboard open → hide the bottom nav so ONLY the search bar rides above the
      // keyboard (the nav otherwise floats up too). 80px guards against browser-
      // chrome jitter being mistaken for a keyboard.
      document.documentElement.classList.toggle("kb-open", inset > 80);
    };
    vv.addEventListener("resize", updateKbInset);
    vv.addEventListener("scroll", updateKbInset);
    updateKbInset();
  }
  // Identity-inclusion checkboxes + metadata-filter selects + Group By (change).
  // Live drag for the Volume-shift slider: update ONLY its own value label and
  // re-plot just the chart as you drag (rule 17 — the tap/drag updates its own
  // control instantly; no full menu rebuild that would yank the slider mid-drag).
  panel.addEventListener("input", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLInputElement>('.wa-cfg[data-wacfg="volumeYShift"]');
    if (!el) return;
    const v = Math.min(0.8, Math.max(-0.8, Number(el.value) || 0));
    waGraphConfig.volumeYShift = v;
    const lbl = el.parentElement?.querySelector<HTMLElement>(".wa-shift-val");
    if (lbl) lbl.textContent = ` ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
    scheduleWaChartOnly();
  });
  panel.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    const grp = target.closest<HTMLSelectElement>(".wa-groupby");
    if (grp) {
      waGroupBy = (grp.value === "none" ? "none" : grp.value) as typeof waGroupBy;
      deferRender(renderWorkoutAnalysis); // rebuild both selectors so they stay in sync
      return;
    }
    // "Hard sets only" lens — re-render the graph(s) AND the training calendar,
    // since this filter applies to both.
    const hard = target.closest<HTMLInputElement>("#waHardOnly");
    if (hard) {
      waHardOnly = hard.checked;
      saveHardOnly();
      deferRender(() => { renderWaGraph(); renderWorkoutCalendar(); }); // pin scroll
      return;
    }
    const perBw = target.closest<HTMLInputElement>("#waPerBw");
    if (perBw) { S.waPerBodyweight = perBw.checked; scheduleWaGraph(); return; }
    // Graph config controls (TASK 29) — update config, redraw the graph (deferred).
    const cfg = target.closest<HTMLElement>(".wa-cfg");
    if (cfg?.dataset.wacfg) {
      const key = cfg.dataset.wacfg;
      const el = cfg as HTMLInputElement | HTMLSelectElement;
      if (key === "aggregation") waGraphConfig.aggregation = el.value as GraphConfig["aggregation"];
      else if (key === "interval") waGraphConfig.interval = el.value as GraphConfig["interval"];
      else if (key === "opacity") waGraphConfig.opacity = Math.min(1, Math.max(0.1, Number((el as HTMLInputElement).value) || 0.6));
      else if (key === "rightHeadroom") waGraphConfig.rightHeadroom = Math.min(4, Math.max(0.25, Number((el as HTMLInputElement).value) || 1));
      else if (key === "barGirth") waGraphConfig.barGirth = Math.min(4, Math.max(0.5, Number((el as HTMLInputElement).value) || 1));
      else if (key === "volumeYShift") waGraphConfig.volumeYShift = Math.min(0.8, Math.max(-0.8, Number((el as HTMLInputElement).value) || 0));
      else if (key === "prediction") waGraphConfig.prediction = (el as HTMLInputElement).checked;
      else if (key === "decay") waGraphConfig.decay = (el as HTMLInputElement).checked;
      scheduleWaGraph();
    }
  });
  panel.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    // Which selector (graph vs calendar/history) was clicked — its root carries
    // data-selscope. Selector actions below operate on that scope's selection.
    const scopeRoot = t.closest<HTMLElement>("[data-selscope]");
    if (scopeRoot) curSelScope = (scopeRoot.dataset.selscope as SelScope) ?? "hist";
    // (Category pills in the top strip are `.wa-cat-pill`s, handled by the
    // document-level pill handler — tap opens that group's floating exercise menu.)
    // A selected-pill ✕ in the sticky bar removes that exercise from the selection.
    const selPill = t.closest<HTMLElement>(".wa-sel-pill");
    if (selPill?.dataset.waselpill) {
      selPill.remove(); // instant feedback; the deferred re-render rebuilds the rest
      setSelArr(selArr().filter((x) => x !== selPill.dataset.waselpill));
      debounceWaRender();
      return;
    }
    // The ⓘ on a chip opens that lift's More-info overlay (not select/deselect).
    const chipInfo = t.closest<HTMLElement>("[data-waexinfo]");
    if (chipInfo?.dataset.waexinfo) { openExerciseInfo(chipInfo.dataset.waexinfo); return; }
    const chip = t.closest<HTMLElement>(".wa-ex-chip");
    if (chip?.dataset.waex) {
      const n = chip.dataset.waex;
      setSelArr(selArr().includes(n) ? selArr().filter((x) => x !== n) : [...selArr(), n]);
      const on = selArr().includes(n);
      chip.classList.toggle("is-on", on); // instant feedback before the heavy re-render
      chip.setAttribute("aria-pressed", String(on));
      debounceWaRender();
      return;
    }
    // "Match" — copy the OTHER selector's selection into this one.
    const matchBtn = t.closest<HTMLElement>(".wa-match");
    if (matchBtn?.dataset.matchfrom) {
      const from = matchBtn.dataset.matchfrom as SelScope;
      setSelArr([...(from === "graph" ? waGraphSel : waSelected)]);
      debounceWaRender();
      return;
    }
    if (t.closest(".wa-selectall")) {
      // Select every exercise currently shown in the picker (respects the active
      // identity-includes / filters / search), into THIS scope.
      setSelArr(waChipList().filter((ex) => !ex.missing).map((ex) => ex.name));
      debounceWaRender();
      return;
    }
    if (t.closest(".wa-clearsel")) {
      setSelArr([]);
      debounceWaRender();
      return;
    }
    // "Trim to N" — drop the graph-selection lifts past the graph's plot budget.
    if (t.closest(".wa-trimgraph")) {
      waGraphSel = waGraphSel.slice(0, WA_GRAPH_MAX);
      debounceWaRender();
      return;
    }
    // Flip BOTH pickers between individual-exercise pills and category pills.
    if (t.closest(".wa-chipsmode")) {
      waChipsMode = waChipsMode === "categories" ? "exercises" : "categories";
      closeWaCatMenu();
      deferRender(renderWorkoutAnalysis);
      return;
    }
    // Reveal / hide the greyed-out "missing" exercises (filtered or never trained).
    if (t.closest(".wa-showmissing")) {
      waShowMissing = !waShowMissing;
      deferRender(renderWorkoutAnalysis); // rebuilds the toggle label + chips
      return;
    }
    // Create a user exercise def (dissolved variant / combined / comparison group).
    if (t.closest("#waNewCreate")) {
      createUserExerciseDef();
      return;
    }
    if (t.closest("#waFiltersClear")) {
      for (const d of FILTER_DIMS) delete waFilterValues[d];
      deferRender(renderWorkoutAnalysis);
      return;
    }
    if (t.closest(".wa-searchclear")) {
      waSearchQuery = "";
      searchFindHistory = false;
      const cmd = document.getElementById("cmdInput") as HTMLInputElement | null;
      if (cmd) cmd.value = "";
      deferRender(renderWorkoutAnalysis);
      return;
    }
    // Group header in the Exercises dropdown → filter that whole group in / out.
    const grpOff = t.closest<HTMLElement>(".wa-group-h");
    if (grpOff?.dataset.grpoff !== undefined) {
      const g = grpOff.dataset.grpoff;
      if (waGroupsOff.has(g)) waGroupsOff.delete(g); else waGroupsOff.add(g);
      deferRender(renderWorkoutAnalysis);
      return;
    }
    // Identity-include toggle button (Original / Dissolved / Combined / …).
    const incBtn = t.closest<HTMLElement>(".wa-inc-btn");
    if (incBtn?.dataset.waident) {
      const id = incBtn.dataset.waident as ExerciseIdentity;
      if (waIncludeIdentities.has(id)) waIncludeIdentities.delete(id);
      else waIncludeIdentities.add(id);
      deferRender(renderWorkoutAnalysis);
      return;
    }
    // Chip label mode → set the GLOBAL name mode (code / short / full), site-wide.
    const nameOpt = t.closest<HTMLElement>(".wa-name-opt");
    if (nameOpt?.dataset.waname) {
      setNameMode(nameOpt.dataset.waname as NameMode);
      applyNameModeChange();
      return;
    }
    // Metadata-filter chip: toggle one value of one dimension on/off.
    const fchip = t.closest<HTMLElement>(".wa-fchip");
    if (fchip?.dataset.wadim && fchip.dataset.wafval !== undefined) {
      const dim = fchip.dataset.wadim as ExerciseFilterDim;
      const val = fchip.dataset.wafval;
      const cur = new Set(waFilterValues[dim] ?? []);
      if (cur.has(val)) cur.delete(val); else cur.add(val);
      if (cur.size) waFilterValues[dim] = [...cur]; else delete waFilterValues[dim];
      deferRender(renderWorkoutAnalysis);
      return;
    }
    // Graph metric toggle (TASK 27): enable/disable a metric, re-render the graph.
    const met = t.closest<HTMLElement>(".wa-metric");
    if (met?.dataset.wametric) {
      const id = met.dataset.wametric;
      if (waMetrics.has(id)) waMetrics.delete(id);
      else waMetrics.add(id);
      met.classList.toggle("is-on"); // instant visual feedback; chart redraws deferred
      scheduleWaGraph();
      return;
    }
    // Smoothing as a cycling toggle (0 → 1 → 2 → 5 → 10 → 20 → 50 → 0).
    if (t.closest<HTMLElement>("[data-wasmooth]")) {
      const steps = [0, 1, 2, 5, 10, 20, 50];
      const i = steps.indexOf(waGraphConfig.smoothing);
      waGraphConfig.smoothing = steps[(i + 1) % steps.length]!;
      scheduleWaGraph();
      return;
    }
    // Realistic ⇄ compacted time toggle (moved here from the chart's legend row).
    if (t.closest<HTMLElement>("[data-watime]")) {
      setTimeCompact(!getTimeCompact());
      renderWaGraph();
      return;
    }
    // Machine type (cable / gravity / mixed) for the selected exercise.
    const machBtn = t.closest<HTMLElement>("[data-machinemode]");
    if (machBtn?.dataset.machinemode && machBtn.dataset.machineEx) {
      setMachineMode(machBtn.dataset.machineEx, machBtn.dataset.machinemode as MachineMode);
      renderWorkoutAnalysis();
      return;
    }
    // (Taxonomy save moved to a document-level handler — the editor now lives in
    // the Index inspector, not this panel.)
    // Tapping an exercise row in the hosted List view drills in (the row handler
    // set selectedExercise already) — reflect it in the analysis selection so the
    // mode/selector stay in step, landing on the single-exercise drill-in.
    if (t.closest("tr.ex-row") && document.getElementById("exercisesPanel")?.closest("#tab-analysis")) {
      if (selectedExercise && waSelected.join("|") !== selectedExercise) {
        waSelected = [selectedExercise];
        waGraphSel = [selectedExercise]; // explicit drill-in focuses BOTH selectors
        renderWorkoutAnalysis();
      }
    }
  });
}

/** Validate the create form and store a new user exercise def (dissolved /
 * combined / comparison_group), then surface it in the selector. */
/** The "Create variant / group" form (dissolved variant / combined / comparison
 * group). Lives on the Index page now; its #waNewCreate button calls
 * createUserExerciseDef(). */
/** Type currently chosen in the create form (drives single-parent vs multi-member). */
function createVariantType(): ExerciseIdentity {
  const el = document.getElementById("waNewType") as HTMLSelectElement | null;
  return (el?.value as ExerciseIdentity) ?? "dissolved";
}
/** The chosen-members pills (graph-selector `.wa-sel-pill` style), each removable. */
function variantSelPillsHtml(): string {
  if (createVariantMembers.length === 0)
    return `<span class="muted wa-create-empty">None picked yet — tap an exercise below.</span>`;
  return createVariantMembers
    .map((n) => `<button type="button" class="wa-sel-pill" data-vmremove="${escapeHtml(n)}" title="Remove">${escapeHtml(n)}<span class="wa-sel-pill-x">✕</span></button>`)
    .join("");
}
/** The tappable exercise chips (graph-selector `.wa-ex-chip` style), search-filtered. */
function variantChipsHtml(): string {
  const q = createVariantSearch.trim().toLowerCase();
  const list = selectableExercises(data.records).filter((n) => !q || n.toLowerCase().includes(q));
  if (list.length === 0) return `<p class="muted wa-placeholder">No exercises match “${escapeHtml(createVariantSearch.trim())}”.</p>`;
  return list
    .map((n) => {
      const on = createVariantMembers.includes(n);
      return `<button type="button" class="wa-ex-chip${on ? " is-on" : ""}" data-vmtoggle="${escapeHtml(n)}" aria-pressed="${on}">${escapeHtml(n)}</button>`;
    })
    .join("");
}
/** The whole member picker (selected pills + search + chip list). */
function variantPickerHtml(): string {
  return (
    `<div class="wa-sel-pills" id="waNewSelPills">${variantSelPillsHtml()}</div>` +
    `<input id="waNewSearch" class="wa-create-search" type="text" placeholder="Search exercises…" autocomplete="off" value="${escapeHtml(createVariantSearch)}" />` +
    `<div id="waNewChips" class="wa-ex-chips wa-chips-wrap">${variantChipsHtml()}</div>`
  );
}
/** A list of the defs already created, so they're visibly there (with a ✕ delete). */
function variantDefsListHtml(): string {
  if (userExerciseDefs.length === 0) return "";
  const kindOf = (id: ExerciseIdentity) => (id === "dissolved" ? "variant" : id === "combined" ? "combined" : "comparison");
  const rows = userExerciseDefs
    .map((d) => {
      const mem = d.identity === "dissolved" ? (d.parent ?? "") : (d.members ?? []).join(", ");
      return (
        `<div class="wa-vdef-row"><button type="button" class="wa-vdef-del" data-vmdeldef="${escapeHtml(d.name)}" title="Delete this def">✕</button>` +
        `<span class="wa-vdef-name">${escapeHtml(d.name)}</span>` +
        `<span class="muted wa-vdef-meta">${kindOf(d.identity)} · ${escapeHtml(mem)}</span></div>`
      );
    })
    .join("");
  return `<div class="wa-vdef-list"><div class="wa-sq-title">Your variants &amp; groups <span class="muted">(${userExerciseDefs.length})</span></div>${rows}</div>`;
}
function createVariantFormHtml(): string {
  return (
    `<label class="wa-create-f">Type<select id="waNewType">` +
    `<option value="dissolved">Dissolved variant (1 parent)</option>` +
    `<option value="combined">Combined group (members)</option>` +
    `<option value="comparison_group">Comparison group (members)</option>` +
    `</select></label>` +
    `<label class="wa-create-f">Name<input id="waNewName" type="text" placeholder="e.g. Assisted Pull Up" autocomplete="off" /></label>` +
    `<div class="wa-create-f">Parent / members<div id="waNewMembers" class="wa-create-picker">${variantPickerHtml()}</div></div>` +
    `<div class="wa-create-act"><button type="button" id="waNewCreate" class="wa-clear">Create</button> <span id="waNewMsg" class="muted">${escapeHtml(createVariantMsg)}</span></div>` +
    variantDefsListHtml()
  );
}
/** Refresh just the chips' on/off state + the chosen-members pills, WITHOUT
 * rebuilding the search or name inputs (so typing keeps focus). */
function renderVariantPicker(): void {
  const chips = document.getElementById("waNewChips");
  if (chips) chips.innerHTML = variantChipsHtml();
  const pills = document.getElementById("waNewSelPills");
  if (pills) pills.innerHTML = variantSelPillsHtml();
}
/** Toggle one exercise in/out of the member selection. For a dissolved variant
 * (one parent) selecting an exercise REPLACES the pick (radio-like). */
function toggleVariantMember(name: string): void {
  createVariantMsg = "";
  const has = createVariantMembers.includes(name);
  if (createVariantType() === "dissolved") {
    createVariantMembers = has ? [] : [name];
  } else {
    createVariantMembers = has ? createVariantMembers.filter((n) => n !== name) : [...createVariantMembers, name];
  }
  renderVariantPicker();
}
function removeVariantMember(name: string): void {
  createVariantMembers = createVariantMembers.filter((n) => n !== name);
  renderVariantPicker();
}
/** Delete a previously-created def (from the "Your variants & groups" list). */
function deleteVariantDef(name: string): void {
  userExerciseDefs = userExerciseDefs.filter((d) => d.name !== name);
  saveUserExerciseDefs();
  renderAll();
  renderWorkoutAnalysis();
}

function createUserExerciseDef(): void {
  const typeEl = document.getElementById("waNewType") as HTMLSelectElement | null;
  const nameEl = document.getElementById("waNewName") as HTMLInputElement | null;
  if (!typeEl || !nameEl) return;
  // Show the message immediately (errors) AND remember it so it survives a rebuild.
  const setMsg = (s: string) => { createVariantMsg = s; const m = document.getElementById("waNewMsg"); if (m) m.textContent = s; };
  const identity = typeEl.value as ExerciseIdentity;
  const name = nameEl.value.trim();
  const members = [...createVariantMembers];
  if (!name) return setMsg("Enter a name.");
  // No duplicates — never shadow an existing exercise or another def.
  if (new Set(selectableExercises(data.records)).has(name) || userExerciseDefs.some((d) => d.name === name))
    return setMsg("That name already exists.");
  if (members.length === 0)
    return setMsg(identity === "dissolved" ? "Pick the parent exercise." : "Pick the member exercises.");
  const def: UserExerciseDef =
    identity === "dissolved"
      ? { name, identity, parent: members[0]! }
      : { name, identity, members };
  userExerciseDefs.push(def);
  saveUserExerciseDefs();
  waIncludeIdentities.add(identity); // so the new one shows immediately
  // Reset the form for the next one and leave a confirmation that survives the
  // renderAll() rebuild (so it's obvious the def was created, and it now appears
  // in the "Your variants & groups" list just below).
  createVariantMembers = [];
  createVariantSearch = "";
  createVariantMsg = `Created “${name}” ✓ — see it below and in the selector.`;
  renderAll(); // refresh the Index (where the form lives) + leaderboards/PRs/etc.
  renderWorkoutAnalysis();
}

/**
 * Open the unified WorkoutAnalysisView with preloaded state (TASKS 49–52). The
 * mode follows the selection: none → all (workouts or list), one → single, 2+ →
 * compare — so a redirected Single/Compare link lands in the right mode with the
 * right exercises already selected.
 */
function openWorkoutAnalysis(opts: { exercises?: string[] } = {}): void {
  if (opts.exercises) {
    const ex = opts.exercises.filter((n) => n.length > 0);
    waSelected = ex;
    waGraphSel = [...ex]; // an explicit "show this lift" focuses BOTH selectors
  }
  switchTopTab(analysisTabName()); // full or simplified per the detail flag (no drift)
}

/**
 * Map legacy deep-links / bookmarks to the unified view (TASKS 49–52). No route
 * is broken: an unrecognised hash is ignored. Recognised:
 *   #workouts | #analysis | #list → all (Workouts + calendar)
 *   #single=<exercise>            → single, that exercise
 *   #compare=<a>,<b>              → compare, those lifts
 */
function handleAnalysisHash(): void {
  const h = decodeURIComponent(location.hash.replace(/^#/, "")).trim();
  if (!h) return;
  if (h === "workouts" || h === "analysis" || h === "list") openWorkoutAnalysis();
  else if (h.startsWith("single=")) openWorkoutAnalysis({ exercises: [h.slice("single=".length)] });
  else if (h.startsWith("compare=")) openWorkoutAnalysis({ exercises: h.slice("compare=".length).split(",").map((s) => s.trim()) });
}

/** Save the joint/movement/plane multi-selects for one exercise (TASK 24) into
 * the user taxonomy, so the filters can use the saved metadata. */
function saveTaxonomyAssignment(btn: HTMLElement, name: string): void {
  // Scope the reads to THIS editor (the one whose Save was tapped), so two open
  // copies (Index inspector + ℹ overlay) don't read each other's selects.
  const root: ParentNode = btn.closest(".wa-assign") ?? document;
  const read = (cls: string) => {
    const el = root.querySelector<HTMLSelectElement>(`.${cls}`);
    return el ? Array.from(el.selectedOptions).map((o) => o.value) : [];
  };
  userTaxonomy[name] = {
    joint: read("wa-assign-joint"),
    movement: read("wa-assign-movement"),
    plane: read("wa-assign-plane"),
  };
  saveUserTaxonomy();
  const msg = root.querySelector<HTMLElement>(".wa-assign-msg");
  if (msg) msg.textContent = "Saved.";
  // The saved taxonomy drives the Analysis filters — refresh that view only if
  // it's the one currently open (avoids rebuilding a hidden tab).
  if (document.getElementById("tab-analysis")?.hidden === false) renderWorkoutAnalysis();
}

function switchTopTab(name: string) {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab, .guide-btn"));
  for (const t of tabs) t.classList.toggle("is-active", t.dataset.tab === name);
  // Panels aren't all backed by a .tab button (e.g. #tab-groups), so toggle by id.
  for (const panel of document.querySelectorAll<HTMLElement>(".tab-panel"))
    panel.hidden = panel.id !== `tab-${name}`;
  // The simplified S-ANL page gets a clean chrome (no SP, no data-summary footer).
  document.body.classList.toggle("on-s-anl", name === "s-analysis");
  // Chart.js needs a resize nudge if it was first drawn while hidden.
  if (name === "leaderboards") renderLeaderboard(); // re-render at the real width
  if (name === "data") void pollRefreshStatus();
  if (name === "sitemap") renderSiteMap();
  if (name === "changelog") renderChangelog();
  if (name === "s-analysis") renderSAnalysis();
  if (name === "groups") renderGroupsView();
  if (name === "team") renderTeamView();
  if (name === "statsedit") renderStatsEdit();
  if (name === "analysis") renderWorkoutAnalysis();
  // Leaving the analysis view → return the relocated panel(s) to their athlete
  // tabs so the old Workouts / Single-exercise pages keep working.
  if (name !== "analysis") restoreAnalysisPanels();
  updateBottomNav();
}

function setupTabs() {
  // ".guide-btn" is the top-bar Guide button (lives outside the .tabs nav but
  // still switches to the guide panel via its data-tab).
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".tab, .guide-btn"))
    tab.addEventListener("click", () => switchTopTab(tab.dataset.tab ?? ""));
}

/**
 * Replace a native <select> with a custom HTML/CSS dropdown (no OS chrome). The
 * native select is hidden but kept as the source of truth, so all existing
 * population (innerHTML of <option>s), `.value` reads and "change" listeners
 * keep working untouched. A MutationObserver re-syncs the custom UI whenever the
 * options are repopulated; selecting an option sets `.value` and fires "change".
 */
/** Enhance an element + its descendant native single <select>s into the app's
 * .xdd dropdown — so the UI NEVER falls back to the OS picker (which looks
 * different on every device and ignores our styling). Idempotent: already-
 * enhanced (.dd-native) and multi-selects are skipped, as are the two hidden
 * mirror selects (#athlete behind its chip row, #viewAsSelect) and anything under
 * [data-no-xdd]. A select tagged .dd-wide gets the wide menu. */
function enhanceSelectTree(el: HTMLElement): void {
  const list = el.matches("select") ? [el as HTMLSelectElement] : [];
  for (const s of el.querySelectorAll<HTMLSelectElement>("select")) list.push(s);
  for (const sel of list) {
    if (sel.classList.contains("dd-native") || sel.multiple) continue;
    if (sel.id === "athlete" || sel.id === "viewAsSelect" || sel.closest("[data-no-xdd]")) continue;
    enhanceSelect(sel, sel.classList.contains("dd-wide") ? { wide: true } : {});
  }
}

/** Show/hide a <select> that may have been enhanced into a .xdd twin — toggles the
 * `hidden` attr on BOTH, so a hidden enhanced dropdown actually disappears (the
 * visible control is the twin, not the now-`dd-native`-hidden select). */
function setEnhancedSelectHidden(sel: HTMLSelectElement, hidden: boolean): void {
  sel.hidden = hidden;
  const twin = sel.nextElementSibling;
  if (twin instanceof HTMLElement && twin.classList.contains("xdd")) twin.hidden = hidden;
}

function enhanceSelect(sel: HTMLSelectElement, opts: { wide?: boolean } = {}) {
  sel.classList.add("dd-native");
  const dd = document.createElement("div");
  dd.className = "xdd" + (opts.wide ? " xdd-wide" : "");
  sel.insertAdjacentElement("afterend", dd);

  const optHtml = (o: HTMLOptionElement) =>
    `<button type="button" class="xdd-opt${o.value === sel.value ? " is-active" : ""}" data-val="${escapeHtml(o.value)}" role="option">${escapeHtml(o.textContent ?? "")}</button>`;

  const sync = () => {
    let menu = "";
    for (const node of Array.from(sel.children)) {
      if (node instanceof HTMLOptGroupElement) {
        menu += `<div class="xdd-group">${escapeHtml(node.label)}</div>`;
        for (const o of Array.from(node.children)) if (o instanceof HTMLOptionElement) menu += optHtml(o);
      } else if (node instanceof HTMLOptionElement) {
        menu += optHtml(node);
      }
    }
    const wasOpen = dd.classList.contains("open");
    dd.innerHTML =
      `<button type="button" class="xdd-btn">${escapeHtml(sel.selectedOptions[0]?.textContent ?? "")}<span class="xdd-caret">▾</span></button>` +
      `<div class="xdd-menu"${wasOpen ? "" : " hidden"} role="listbox">${menu}</div>`;
  };
  sync();

  const close = () => {
    dd.classList.remove("open");
    dd.querySelector<HTMLElement>(".xdd-menu")?.setAttribute("hidden", "");
  };
  dd.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest(".xdd-btn")) {
      const menu = dd.querySelector<HTMLElement>(".xdd-menu")!;
      const opening = menu.hasAttribute("hidden");
      menu.toggleAttribute("hidden", !opening);
      dd.classList.toggle("open", opening);
      return;
    }
    const opt = t.closest<HTMLElement>(".xdd-opt");
    if (opt?.dataset.val !== undefined) {
      if (sel.value !== opt.dataset.val) {
        sel.value = opt.dataset.val;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      close();
      sync();
    }
  });
  document.addEventListener("click", (e) => {
    if (!dd.contains(e.target as Node)) close();
  });
  // Repopulating the select (new <option>s) or a code-driven change re-syncs.
  new MutationObserver(() => sync()).observe(sel, { childList: true, subtree: true });
  sel.addEventListener("change", sync);
}


/** Show one of the Athlete sub-views (Workouts / Exercises). Decoupled from the
 * nav buttons so it works whether called from the bottom nav or from code (e.g.
 * a list row jumping to Exercises). Does NOT switch the top tab — callers that
 * need the Athlete panel visible should switchTopTab("athlete") first. */
function showSubtab(name: string) {
  for (const n of ["workouts", "exercises"]) {
    const panel = document.getElementById(`sub-${n}`);
    if (panel) panel.hidden = n !== name;
  }
  syncExerciseTabs(); // keep the Workouts | List | Compare | Single bar in step
  updateBottomNav();
}

/** Light up the right bottom-nav item: Workouts/Exercises when the Athlete tab
 * shows that sub-view, otherwise "Other" (anything reached via the sheet). */
function updateBottomNav() {
  // The bottom nav bar is gone; the only label to keep current is the Analysis
  // entry in the "More" sheet (full ANL vs the simplified S-ANL page).
  const lbl = document.getElementById("otherAnalysisLabel");
  if (lbl) lbl.textContent = analysisTabName() === "s-analysis" ? "S-Analysis" : "Analysis";
  updateBrand();
}

/** The "Colosseum" title doubles as a Back-to-home button: on any non-analysis
 * page it shows a ‹ back arrow (and reads "back to Colosseum"); on the analysis
 * home it's just the plain wordmark. */
/** Page name shown in the top title, by tab id. The title reads the CURRENT page's
 * name; off the home (analysis) pages it gets a ‹ back arrow to return home. */
const PAGE_NAMES: Record<string, string> = {
  analysis: "Analysis", "s-analysis": "S-Analysis", leaderboards: "Colosseum",
  athlete: "Athlete", bwparts: "Index", groups: "Stats", team: "Group",
  data: "Data", add: "Add", test: "Formulas", statsedit: "Athletes",
  sitemap: "Site map", guide: "Guide", changelog: "Version history",
};
function updateBrand() {
  const el = document.getElementById("brandTitle");
  if (!el) return;
  const cur = (document.querySelector<HTMLElement>(".tab-panel:not([hidden])")?.id ?? "").replace(/^tab-/, "");
  const onHome = cur === "analysis" || cur === "s-analysis";
  const name = PAGE_NAMES[cur] ?? "Colosseum";
  el.classList.toggle("is-back", !onHome);
  // On a sub-page the title is that page's name with a ‹ back arrow; on home it's
  // just the page name (no arrow). i18n translates the name via its text node.
  el.innerHTML = onHome ? name : `<span class="brand-back" aria-hidden="true">‹</span>${name}`;
  el.title = onHome ? name : "Back to home";
}

function setOtherSheetOpen(open: boolean) {
  els.otherSheet.hidden = !open;
  document.body.classList.toggle("sheet-open", open);
}

/** Navigation: the top-bar "More" (⋯) button opens the sheet of all views. The
 * bottom nav bar is gone (Analysis is the home page); the sheet's first item
 * leads back to Analysis (full ANL, or simplified S-ANL per the toggle). */
function setupBottomNav() {
  document.getElementById("moreBtn")?.addEventListener("click", () => {
    setOtherSheetOpen(els.otherSheet.hidden);
  });
  // Sheet items each open a view and close the sheet. The Analysis item routes to
  // whichever analysis page is active (full or simplified); the rest use data-tab.
  for (const item of els.otherSheet.querySelectorAll<HTMLButtonElement>(".other-item")) {
    item.addEventListener("click", () => {
      setOtherSheetOpen(false);
      switchTopTab(item.dataset.nav === "analysis" ? analysisTabName() : item.dataset.tab ?? "");
    });
  }
  // Tapping the backdrop (or anything marked data-other-close) dismisses it.
  els.otherSheet.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-other-close]")) setOtherSheetOpen(false);
  });
}

// Decorative login page (NOT enforced). On the very first visit it shows once
// (the .signed-in head flag skips it afterwards); from then on it's only opened
// on demand via Settings → Log in. The two buttons just switch view — no real auth.
{
  const signedIn = (() => { try { return localStorage.getItem("colosseum.signedIn") === "1"; } catch { return false; } })();
  if (!signedIn) showLoginPage(); // first visit: show the page (non-blocking choice)
  document.getElementById("loginAdminBtn")?.addEventListener("click", logIn);
  document.getElementById("loginGuestBtn")?.addEventListener("click", viewAsSpectator);
  // Enter in the password field submits the admin login.
  document.getElementById("loginPass")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") logIn();
  });
}

void init();

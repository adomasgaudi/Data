// ==================== CONFIGURATION ====================
//
// Node.js port of the original Google Apps Script that scrapes StrengthLevel.
// Requires Node 18+ (uses the global `fetch`). Named `.cjs` because the project's
// package.json is `"type": "module"` — this file stays CommonJS on purpose.
//
// It writes the dashboard's bundled data file (src/data/ud.csv). The GitHub
// Action `.github/workflows/fetch-data.yml` runs it and commits the result, which
// re-deploys the site. You can also run it locally:
//
//   node scripts/strengthlevel.cjs            -> incremental sync (default)
//   node scripts/strengthlevel.cjs sync       -> incremental sync
//   node scripts/strengthlevel.cjs rebuild    -> full rebuild (slow)
//   node scripts/strengthlevel.cjs clear-cache
//
// Override the output path with the OUTPUT_CSV env var if needed.

const fs = require("fs");
const path = require("path");

const BASE_URL = "https://my.strengthlevel.com";
const FETCH_LIMIT = 200;
const FETCH_DELAY_MS = 100;

// Default to the dashboard's bundled CSV (resolved relative to the repo root, so
// it works no matter what directory the script is launched from).
const OUTPUT_CSV =
  process.env.OUTPUT_CSV || path.join(__dirname, "..", "src", "data", "ud.csv");
const USERID_CACHE_FILE =
  process.env.USERID_CACHE_FILE || path.join(__dirname, "..", ".userid-cache.json");

const COL_USERNAME = 1;
const COL_DATE = 2;

const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json, text/plain, */*",
  "Referer": BASE_URL
};

const USERS = {
  "Adomas": "adomasgaudi",
  "Kristina": "andromeda94",
  "Johan": "johannesschut",
  "Andrius": "andriusp",
  "Mantas": "mantasp",
  "Marija": "marijasenkus",
  "Sandra": "sandrakri",
  "Dzul": "dzuljeta",
  "Agne": "agne_ram",
  "Laurynas": "bebras",
  "Simona": "simona",
  "Henrikas": "henrikas",
  "Tomas": "t.urba",
  "Brigita": "brigita_r",
  "Karolis": "karolisb",
  "Simonas": "simonasputrius",
  "Indre": "indre_ju",
  "Natalija": "natali",
  "Monika": "monika",
  "Ruta": "rutagaudi"
};

const OUTPUT_COLUMNS = [
  "user", "username", "date", "bodyweight",
  "exercise_name", "set_number", "weight", "reps",
  "notes", "dropset", "percentile"
];


// ==================== ENTRY POINT ====================

async function importDATA() {
  setStatus("Reading existing data...");

  const existingRows = readExistingDataRows(OUTPUT_CSV);
  const latestDateByUsername = computeLatestDatePerUser(existingRows);

  const newRows = await collectNewRowsForAllUsers(latestDateByUsername);

  if (newRows.length === 0) {
    setStatus(`Done. No new workouts. Total ${existingRows.length} rows.`);
    return;
  }

  const mergedRows = mergeNewWithExisting(existingRows, newRows, latestDateByUsername);
  setStatus(`Writing ${newRows.length} new rows...`);
  writeCsv(OUTPUT_CSV, [OUTPUT_COLUMNS, ...mergedRows]);

  setStatus(`Done. Added ${newRows.length} new rows. Total ${mergedRows.length}.`);
}

function clearUserIdCache() {
  if (fs.existsSync(USERID_CACHE_FILE)) fs.unlinkSync(USERID_CACHE_FILE);
}


// ==================== FULL REBUILD ====================

async function updatePAST() {
  setStatus("Full rebuild starting...");

  const emptyLatestDateMap = new Map();
  const allRows = await collectNewRowsForAllUsers(emptyLatestDateMap);

  if (allRows.length === 0) {
    setStatus("Failed: No workout rows found.");
    throw new Error("No workout rows found.");
  }

  setStatus(`Writing ${allRows.length} rows...`);
  writeCsv(OUTPUT_CSV, [OUTPUT_COLUMNS, ...allRows]);

  setStatus(`Done. Rebuilt with ${allRows.length} rows.`);
}


// ==================== STATUS / LOGGING ====================
// Replaces writing to a status cell in the spreadsheet.

function setStatus(message) {
  console.log(message);
}


// ==================== CSV HELPERS ====================

function readExistingDataRows(csvPath) {
  if (!fs.existsSync(csvPath)) return [];

  const records = parseCsv(fs.readFileSync(csvPath, "utf8"));
  if (records.length < 2) return [];

  return records.slice(1); // drop header row
}

function writeCsv(csvPath, rows) {
  const text = rows.map(row => row.map(csvEscape).join(",")).join("\n") + "\n";
  fs.writeFileSync(csvPath, text, "utf8");
}

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Minimal RFC-4180-ish parser: handles quoted fields, escaped quotes (""),
// embedded commas/newlines, and CRLF/LF line endings.
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* ignore */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }

  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}


// ==================== EXISTING DATA READERS ====================

function computeLatestDatePerUser(existingRows) {
  const latestByUsername = new Map();
  for (const row of existingRows) {
    const username = row[COL_USERNAME];
    const date = row[COL_DATE];
    if (!username || !date) continue;

    const current = latestByUsername.get(username);
    if (!current || date > current) latestByUsername.set(username, date);
  }
  return latestByUsername;
}


// ==================== USER LOOP ====================

async function collectNewRowsForAllUsers(latestDateByUsername) {
  const newRows = [];
  const userEntries = Object.entries(USERS);
  const totalUsers = userEntries.length;

  for (let u = 0; u < totalUsers; u++) {
    const [userLabel, username] = userEntries[u];
    const userIndex = u + 1;
    const sinceDate = latestDateByUsername.get(username) || null;

    setStatus(`User ${userIndex}/${totalUsers}: ${userLabel}`);
    const userRows = await collectNewRowsForUser(userLabel, username, sinceDate, userIndex, totalUsers);
    newRows.push(...userRows);
  }
  return newRows;
}

async function collectNewRowsForUser(userLabel, username, sinceDate, userIndex, totalUsers) {
  const userId = await resolveUserId(userLabel, username);
  if (userId === null) return [];

  return paginateWorkoutsSince(userId, sinceDate, userLabel, username, userIndex, totalUsers);
}


// ==================== USER ID (CACHE + FRESH LOOKUP) ====================

let userIdCache = loadUserIdCache();

function loadUserIdCache() {
  try {
    if (fs.existsSync(USERID_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(USERID_CACHE_FILE, "utf8"));
    }
  } catch (_) { /* corrupt cache -> start fresh */ }
  return {};
}

function saveUserIdCache() {
  fs.writeFileSync(USERID_CACHE_FILE, JSON.stringify(userIdCache, null, 2), "utf8");
}

async function resolveUserId(userLabel, username) {
  const cached = userIdCache[username];
  if (cached) return cached;

  const freshId = await lookupUserIdOrLogSkip(userLabel, username);
  if (freshId !== null) {
    userIdCache[username] = freshId;
    saveUserIdCache();
  }
  return freshId;
}

async function lookupUserIdOrLogSkip(userLabel, username) {
  const profile = await fetchProfileHtml(username);
  if (profile.error) {
    setStatus(`Skipped ${userLabel}: ${profile.error}`);
    return null;
  }

  const parsed = parseUserIdFromHtml(profile.html);
  if (parsed.error) {
    setStatus(`Skipped ${userLabel}: ${parsed.error}`);
    return null;
  }

  return parsed.userId;
}

async function fetchProfileHtml(username) {
  const url = `${BASE_URL}/${encodeURIComponent(username)}/workouts`;

  let response;
  try {
    response = await fetch(url, { method: "GET", headers: HEADERS });
  } catch (err) {
    return { error: "profile fetch failed" };
  }

  if (!response.ok) return { error: `profile HTTP ${response.status}` };

  return { html: await response.text() };
}

function parseUserIdFromHtml(html) {
  const match = html.match(/window\.prefill\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return { error: "user_id not found" };

  try {
    const prefill = JSON.parse(match[1]);
    return { userId: String(prefill[0].request.params.user_id) };
  } catch (err) {
    return { error: "prefill parse failed" };
  }
}


// ==================== WORKOUT PAGINATION (INCREMENTAL) ====================

async function paginateWorkoutsSince(userId, sinceDate, userLabel, username, userIndex, totalUsers) {
  const newRows = [];
  let offset = 0;
  let pageNum = 1;

  while (true) {
    setStatus(`User ${userIndex}/${totalUsers}: ${userLabel} | page ${pageNum}`);

    const page = await fetchWorkoutsPage(userId, offset);
    if (page.error) {
      setStatus(`Stopped ${userLabel}: ${page.error} on page ${pageNum}`);
      return newRows;
    }

    if (!page.workouts.length) return newRows;

    const { rowsFromPage, reachedBoundary } = extractRowsFromPageSince(page.workouts, sinceDate, userLabel, username);
    newRows.push(...rowsFromPage);

    if (reachedBoundary) return newRows;

    offset += FETCH_LIMIT;
    pageNum += 1;
    await sleep(FETCH_DELAY_MS);
  }
}

function extractRowsFromPageSince(workouts, sinceDate, userLabel, username) {
  const rowsFromPage = [];
  let reachedBoundary = false;

  for (const workout of workouts) {
    const workoutDate = workout.date || "";

    if (sinceDate && workoutDate < sinceDate) {
      reachedBoundary = true;
      break;
    }

    appendRowsFromSingleWorkout(workout, userLabel, username, rowsFromPage);
  }
  return { rowsFromPage, reachedBoundary };
}

async function fetchWorkoutsPage(userId, offset) {
  const query = buildWorkoutsQuery(userId, offset);

  let response;
  try {
    response = await fetch(`${BASE_URL}/api/workouts?${query}`, {
      method: "GET",
      headers: HEADERS
    });
  } catch (err) {
    return { error: "API fetch failed" };
  }

  if (!response.ok) return { error: `API HTTP ${response.status}` };

  return parseWorkoutsPayload(await response.text());
}

function buildWorkoutsQuery(userId, offset) {
  const params = {
    user_id: userId,
    limit: String(FETCH_LIMIT),
    offset: String(offset),
    "workout.fields": "date,bodyweight,exercises",
    "workoutexercise.fields": "exercise_name,sets",
    "set.fields": "weight,reps,notes,dropset,percentile"
  };

  return Object.keys(params)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
}

function parseWorkoutsPayload(rawText) {
  try {
    const payload = JSON.parse(rawText);
    return { workouts: payload.data || [] };
  } catch (err) {
    return { error: "API parse failed" };
  }
}


// ==================== ROW BUILDING ====================

function appendRowsFromSingleWorkout(workout, userLabel, username, outRows) {
  const workoutDate = workout.date || "";
  const bodyweight = workout.bodyweight ?? "";
  const exercises = workout.exercises || [];

  for (const exercise of exercises) {
    appendRowsFromExercise(exercise, userLabel, username, workoutDate, bodyweight, outRows);
  }
}

function appendRowsFromExercise(exercise, userLabel, username, workoutDate, bodyweight, outRows) {
  const exerciseName = exercise.exercise_name || "";
  const sets = exercise.sets || [];

  for (let i = 0; i < sets.length; i++) {
    const row = buildSetRow(sets[i], i + 1, userLabel, username, workoutDate, bodyweight, exerciseName);
    outRows.push(row);
  }
}

function buildSetRow(setData, setNumber, userLabel, username, workoutDate, bodyweight, exerciseName) {
  return [
    userLabel,
    username,
    workoutDate,
    bodyweight,
    exerciseName,
    setNumber,
    setData.weight ?? "",
    setData.reps ?? "",
    setData.notes ?? "",
    setData.dropset ?? "",
    setData.percentile ?? ""
  ];
}


// ==================== MERGE ====================

function mergeNewWithExisting(existingRows, newRows, latestDateByUsername) {
  const usernamesWithNewData = new Set(newRows.map(r => r[COL_USERNAME]));
  const filteredExisting = existingRows.filter(row => !isBoundaryRowForRefreshedUser(row, usernamesWithNewData, latestDateByUsername));
  return [...filteredExisting, ...newRows];
}

function isBoundaryRowForRefreshedUser(row, usernamesWithNewData, latestDateByUsername) {
  const username = row[COL_USERNAME];
  if (!usernamesWithNewData.has(username)) return false;

  const rowDate = row[COL_DATE];
  const userLatestDate = latestDateByUsername.get(username);
  return rowDate === userLatestDate;
}


// ==================== MISC ====================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ==================== CLI ====================

async function main() {
  const command = process.argv[2] || "sync";

  switch (command) {
    case "sync":
      await importDATA();
      break;
    case "rebuild":
      await updatePAST();
      break;
    case "clear-cache":
      clearUserIdCache();
      setStatus("user_id cache cleared.");
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Usage: node scripts/strengthlevel.cjs [sync|rebuild|clear-cache]");
      process.exit(1);
  }
}

main().catch(err => {
  setStatus("Error: " + err.message);
  process.exit(1);
});

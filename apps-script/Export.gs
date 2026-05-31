/**
 * ADD THIS to your existing StrengthLevel import Apps Script project
 * (the one with importDATA / updatePAST). It exposes the already-ingested
 * "UD" sheet as JSON so the website can read it.
 *
 * Deploy:  Apps Script editor → Deploy → New deployment → type "Web app"
 *          → Execute as: Me, Who has access: "Anyone".
 *          Copy the /exec URL — that's your data endpoint.
 *
 * The website reads it via VITE_DATA_URL (directly) or via UPSTREAM_DATA_URL
 * (through the Cloudflare /api/data proxy).
 *
 * Assumes these constants already exist in the project:
 *   SPREADSHEET_ID, TARGET_SHEET_NAME ("UD"), OUTPUT_COLUMNS
 */

function doGet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(TARGET_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: `Sheet "${TARGET_SHEET_NAME}" not found.`, rows: [] });
  }

  const lastRow = sheet.getLastRow();
  const rows = [];

  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, OUTPUT_COLUMNS.length).getValues();
    const tz = Session.getScriptTimeZone();

    for (const value of values) {
      const obj = {};
      for (let c = 0; c < OUTPUT_COLUMNS.length; c++) {
        let cell = value[c];
        // Normalise date cells to "yyyy-MM-dd" so the client never guesses formats.
        if (OUTPUT_COLUMNS[c] === "date" && cell instanceof Date) {
          cell = Utilities.formatDate(cell, tz, "yyyy-MM-dd");
        }
        obj[OUTPUT_COLUMNS[c]] = cell;
      }
      rows.push(obj);
    }
  }

  return jsonResponse({
    updatedAt: new Date().toISOString(),
    count: rows.length,
    rows: rows
  });
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

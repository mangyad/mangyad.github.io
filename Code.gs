function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Match Predictor')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getUserEmail() {
  const email = Session.getActiveUser().getEmail();
  if (!email) throw new Error("Authentication failed. Please log in.");
  return email;
}

function getPageHtml(pageName) {
  return HtmlService.createTemplateFromFile(pageName).evaluate().getContent();
}

/** 
 * Fetches unique dates from 'schedule' tab where 'Display' is TRUE 
 */
function getAvailableDates() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('schedule');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const dateIdx = headers.indexOf('date');
  const displayIdx = headers.indexOf('display');
  
  const uniqueDatesMap = {};
  for (let i = 1; i < data.length; i++) {
    const rawDate = data[i][dateIdx];
    const display = displayIdx !== -1 ? data[i][displayIdx] : true;
    if (!rawDate || String(display).toUpperCase() !== 'TRUE') continue;
    
    const formattedDate = Utilities.formatDate(new Date(rawDate), Session.getScriptTimeZone(), "yyyy-MM-dd");
    uniqueDatesMap[formattedDate] = true;
  }
  return Object.keys(uniqueDatesMap).sort();
}

/** 
 * Fetches visible matches for a specific date 
 */
function getMatchesForDate(targetDateStr) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('schedule');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const matchIdx = headers.indexOf('match');
  const dateIdx = headers.indexOf('date');
  const displayIdx = headers.indexOf('display');
  
  const filteredMatches = [];
  const targetDate = new Date(targetDateStr).setHours(0,0,0,0);
  
  for (let i = 1; i < data.length; i++) {
    const rowDate = new Date(data[i][dateIdx]).setHours(0,0,0,0);
    const display = displayIdx !== -1 ? data[i][displayIdx] : true;
    if (rowDate === targetDate && String(display).toUpperCase() === 'TRUE') {
      filteredMatches.push(data[i][matchIdx]);
    }
  }
  return filteredMatches;
}

/** 
 * Checks for existing entries and only saves NEW predictions 
 */
function submitPredictions(predictions) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('predictions');
    if (!sheet) {
      sheet = ss.insertSheet('predictions');
      sheet.appendRow(['timestamps', 'user', 'match', 'score team 1', 'score team 2']);
    }
    
    const user = getUserEmail().toLowerCase().trim();
    const timestamp = new Date();
    
    // 1. Get existing entries to check for duplicates
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).toLowerCase().trim());
    const userIdx = headers.indexOf('user');
    const matchIdx = headers.indexOf('match');
    
    const existingKeys = new Set();
    for (let i = 1; i < data.length; i++) {
      const u = String(data[i][userIdx]).toLowerCase().trim();
      const m = data[i][matchIdx];
      existingKeys.add(u + "|" + m);
    }
    
    // 2. Filter and append only unique predictions
    let count = 0;
    predictions.forEach(pred => {
      const key = user + "|" + pred.match;
      if (!existingKeys.has(key)) {
        sheet.appendRow([
          timestamp, 
          user, 
          pred.match, 
          Number(pred.score1), 
          Number(pred.score2)
        ]);
        count++;
      }
    });
    
    if (count === 0) return "No new predictions to save (all were previously entered).";
    return `Successfully saved ${count} new prediction(s)!`;
    
  } catch (e) {
    return "Error: " + e.message;
  }
}

/** 
 * History view logic 
 */
function getUserPredictionHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('predictions');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  
  const userIdx = headers.indexOf('user');
  const matchIdx = headers.indexOf('match');
  const s1Idx = headers.indexOf('score team 1');
  const s2Idx = headers.indexOf('score team 2');
  const tsIdx = headers.indexOf('timestamps');
  
  const currentUser = getUserEmail().toLowerCase().trim();
  const history = [];
  
  for (let i = data.length - 1; i > 0; i--) {
    if (String(data[i][userIdx]).toLowerCase().trim() === currentUser) {
      const ts = data[i][tsIdx];
      history.push({
        date: ts instanceof Date ? Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyy-MM-dd") : "N/A",
        time: ts instanceof Date ? Utilities.formatDate(ts, Session.getScriptTimeZone(), "HH:mm") : "N/A",
        match: data[i][matchIdx],
        score1: data[i][s1Idx],
        score2: data[i][s2Idx]
      });
    }
  }
  return history;
}

/** 
 * Fetching existing scores to pre-fill the UI 
 */
function getExistingPredictionsForUser(matchNames) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('predictions');
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const userIdx = headers.indexOf('user');
  const matchIdx = headers.indexOf('match');
  const s1Idx = headers.indexOf('score team 1');
  const s2Idx = headers.indexOf('score team 2');
  
  const currentUser = getUserEmail().toLowerCase().trim();
  const existingMap = {};
  for (let i = data.length - 1; i > 0; i--) {
    const rowUser = String(data[i][userIdx]).toLowerCase().trim();
    const rowMatch = data[i][matchIdx];
    if (rowUser === currentUser && matchNames.includes(rowMatch) && !existingMap[rowMatch]) {
      existingMap[rowMatch] = { score1: data[i][s1Idx], score2: data[i][s2Idx] };
    }
  }
  return existingMap;
}

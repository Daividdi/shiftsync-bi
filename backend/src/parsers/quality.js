const XLSX = require("xlsx");

const LOWER_PT = new Set(["de","da","do","das","dos","e","em","a","o","na","no","nas","nos","por","para","com","ao","aos","às"]);

function normalizeName(name) {
  if (!name) return name;
  const s = String(name).replace(/\xa0/g, " ").trim();
  const letters = s.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (!letters) return s;
  const upper = (letters.match(/[A-ZÀÁÂÃÄÅÆÈÉÊËÌÍÎÏÐÒÓÔÕÖÙÚÛÜÝ]/g) || []).length;
  if (upper / letters.length > 0.6) {
    return s.toLowerCase().split(" ").map((w, i) =>
      (i === 0 || !LOWER_PT.has(w)) && w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w
    ).join(" ");
  }
  return s;
}

// "2026w21(0518～0524)" → "2026-05-24"
function weekLabelToDate(label) {
  const m = String(label).match(/(\d{4})w\d+\((\d{2})(\d{2})[～~](\d{2})(\d{2})\)/);
  if (!m) return null;
  const [, year, , , em, ed] = m;
  return `${year}-${em}-${ed}`;
}

// "202605" → "2026-05-31"
function monthLabelToEndDate(label) {
  const y  = String(label).slice(0, 4);
  const mo = String(label).slice(4, 6);
  if (!y || !mo) return null;
  const lastDay = new Date(parseInt(y), parseInt(mo), 0).getDate();
  return `${y}-${mo}-${String(lastDay).padStart(2, "0")}`;
}

function safeNum(v, fallback = 0) {
  if (v == null || String(v).trim() === "-" || String(v).trim() === "") return fallback;
  const n = parseFloat(String(v));
  return isNaN(n) ? fallback : n;
}

// Find a sheet by trying exact names, then partial/case-insensitive match
function findSheet(wb, ...candidates) {
  for (const name of candidates) {
    if (wb.Sheets[name]) return wb.Sheets[name];
  }
  const lower = candidates.map(c => c.toLowerCase());
  for (const sheetName of wb.SheetNames) {
    const sl = sheetName.toLowerCase();
    if (lower.some(c => sl.includes(c))) return wb.Sheets[sheetName];
  }
  return null;
}

// Find ALL sheets whose name matches any of the patterns (partial, case-insensitive)
function findAllSheets(wb, ...patterns) {
  const lower = patterns.map(c => c.toLowerCase());
  return wb.SheetNames
    .filter(n => lower.some(p => n.toLowerCase().includes(p)))
    .map(n => ({ name: n, sheet: wb.Sheets[n] }));
}

// Detect period type from header row of a designer-analysis sheet
function detectDesignerSheetPeriod(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (rows.length < 2) return null;
  const labels = rows[1].slice(4).filter(v => v && String(v).trim());
  if (!labels.length) return null;
  const first = String(labels[0]).trim();
  if (/\d{4}w\d+\(/.test(first)) return "week";
  if (/^\d{6}$/.test(first)) return "month";
  return null;
}

// Unpivot a pivot sheet where:
//   row[0] = [label_col, weekLabel1, weekLabel2, ...]
//   row[1] = [id_col, "score", "score", ...]
//   row[2+] = [id_value, score1, score2, ...]
function unpivotWeekly(ws) {
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (rows.length < 3) return [];
  const weekLabels = rows[0].slice(1).map(v => String(v || "").trim());
  const result = [];
  for (let r = 2; r < rows.length; r++) {
    const id = String(rows[r][0] || "").trim();
    if (!id) continue;
    for (let c = 0; c < weekLabels.length; c++) {
      const label = weekLabels[c];
      if (!label) continue;
      const raw = rows[r][c + 1];
      if (raw == null || String(raw).trim() === "-") continue;
      const score = parseFloat(String(raw));
      if (isNaN(score)) continue;
      const date = weekLabelToDate(label);
      if (!date) continue;
      result.push({ week_label: label, week_date: date, id, avg_score: score });
    }
  }
  return result;
}

// Parse the multi-measure pivot sheets (Designers_Analysis12 and 15)
function parseDesignerSheet(ws, periodType) {
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (rows.length < 3) return [];

  const headerRow = rows[1];
  const periodLabels = headerRow.slice(4).map(v => String(v || "").trim());
  const uniquePeriods = [];
  for (const lbl of periodLabels) {
    if (!lbl) break;
    if (uniquePeriods.includes(lbl)) break;
    uniquePeriods.push(lbl);
  }
  const nPeriods = uniquePeriods.length;
  if (!nPeriods) return [];

  const toDate = periodType === "week" ? weekLabelToDate : monthLabelToEndDate;
  const result = [];

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const grp  = String(row[0] || "").trim();
    if (!grp || grp === "BR-ATD" || grp === "TOTAL") continue;
    const pos      = String(row[1] || "").replace(/^BR-/, "").trim();
    const username = String(row[2] || "").trim();
    const name     = normalizeName(String(row[3] || "").trim());
    if (!username || !name) continue;

    for (let pi = 0; pi < nPeriods; pi++) {
      const label = uniquePeriods[pi];
      if (!label) continue;
      const avg_score = row[4 + pi];
      if (avg_score == null || String(avg_score).trim() === "-") continue;
      const score = parseFloat(String(avg_score));
      if (isNaN(score)) continue;
      const date = toDate(label);
      if (!date) continue;

      result.push({
        period_label:   label,
        period_date:    date,
        period_type:    periodType,
        group_no:       grp,
        position:       pos,
        username,
        designer_name:  name,
        avg_score:      score,
        prop_low_score: safeNum(row[4 + nPeriods       + pi]),
        prop_unfit:     safeNum(row[4 + 2 * nPeriods   + pi]),
        score_qty:      Math.round(safeNum(row[4 + 3 * nPeriods + pi])),
        qty_low_score:  Math.round(safeNum(row[4 + 4 * nPeriods + pi])),
        qty_unfit:      Math.round(safeNum(row[4 + 5 * nPeriods + pi])),
      });
    }
  }
  return result;
}

function parseQualityFile(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });

  // ─── 1. Weekly group scores ─────────────────────────────────────────────────
  const groupSheet = findSheet(wb, "Avg_score_by_Group13", "Avg_score_by_Group", "score_by_group");
  const rawGroups = unpivotWeekly(groupSheet);
  const weeklyGroups = rawGroups.map(r => ({ ...r, group_no: r.id }));

  // ─── 2. Weekly position/batch scores ────────────────────────────────────────
  const batchSheet = findSheet(wb, "Avg_score_by_Batch14", "Avg_score_by_Batch", "score_by_batch", "score_by_position");
  const rawPositions = unpivotWeekly(batchSheet);
  const weeklyPositions = rawPositions.map(r => ({ ...r, position_name: r.id }));

  // ─── 3. Designer analysis sheets — auto-detect weekly vs monthly ─────────────
  // Prefer known names first, then fall back to any "Analysis" or "Designer" sheet
  const analysisSheets = findAllSheets(wb, "designers_analysis", "designer_analysis", "analysis");

  let weeklyDesigners  = [];
  let monthlyDesigners = [];

  // Also try the exact legacy names directly
  const knownWeekly  = wb.Sheets["Designers_Analysis15"];
  const knownMonthly = wb.Sheets["Designers_Analysis12"];

  if (knownWeekly)  weeklyDesigners  = parseDesignerSheet(knownWeekly,  "week");
  if (knownMonthly) monthlyDesigners = parseDesignerSheet(knownMonthly, "month");

  // For any remaining analysis sheets not already handled
  for (const { name, sheet } of analysisSheets) {
    if (name === "Designers_Analysis15" || name === "Designers_Analysis12") continue;
    const period = detectDesignerSheetPeriod(sheet);
    if (period === "week"  && !weeklyDesigners.length)  weeklyDesigners  = parseDesignerSheet(sheet, "week");
    if (period === "month" && !monthlyDesigners.length) monthlyDesigners = parseDesignerSheet(sheet, "month");
    // If detection is ambiguous but we still need data, try both
    if (!period && !weeklyDesigners.length && !monthlyDesigners.length) {
      const asWeek  = parseDesignerSheet(sheet, "week");
      const asMonth = parseDesignerSheet(sheet, "month");
      if (asWeek.length)  weeklyDesigners  = asWeek;
      if (asMonth.length) monthlyDesigners = asMonth;
    }
  }

  // Debug: attach sheet names so upload route can log if needed
  const sheetNames = wb.SheetNames;

  return {
    subType: "combined",
    weeklyGroups,
    weeklyPositions,
    weeklyDesigners,
    monthlyDesigners,
    _sheetNames: sheetNames,
  };
}

module.exports = { parseQualityFile, weekLabelToDate, monthLabelToEndDate };

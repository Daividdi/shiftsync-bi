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

const SKIP_POSITIONS = new Set([
  "Group Leader","Design Doctor","Direct Manager","HR","IT",
  "Lean Operations","SoftwareDeveloper-开发人员","Trainer","User-Wuxi","Tech-Wuxi",
  "Client Support","Clinical Support","BR-Client Support","BR-Design Doctor",
]);

// Case type weights: new_case=1, mod=2/3, refinement=0.5, other=1
const WEIGHTS = { new_case: 1, mod: 2/3, refinement: 0.5, other: 1 };

function classifyCase(val) {
  const v = String(val || "").toLowerCase().replace(/[\s_\-]/g, "");
  if (v.startsWith("new") || v === "nc" || v === "newcase") return "new_case";
  if (v === "mod" || v.startsWith("modif") || v === "modification") return "mod";
  if (v.startsWith("refin") || v === "ref" || v === "refinement") return "refinement";
  return "other";
}

// Auto-detect which column contains case types
function detectCaseTypeColumn(rows) {
  for (const key of Object.keys(rows[0] || {})) {
    const hits = rows.filter(r => {
      const k = classifyCase(r[key]);
      return k === "new_case" || k === "mod" || k === "refinement";
    }).length;
    if (hits >= 3) return key;
  }
  return null;
}

function parseProductivityFile(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });

  const detailsWs = wb.Sheets["Details"];
  if (!detailsWs) throw new Error("Sheet 'Details' not found. Expected a Capacity_Design file.");

  const details = XLSX.utils.sheet_to_json(detailsWs, { defval: null });
  if (!details.length) throw new Error("Details sheet is empty");

  // Quota per group from Avg_Daily_Task_Num_Designer_2
  const quotaByGroup = {};
  const avgWs = wb.Sheets["Avg_Daily_Task_Num_Designer_2"];
  if (avgWs) {
    const avgRows = XLSX.utils.sheet_to_json(avgWs, { header: 1, defval: null });
    for (const row of avgRows.slice(1)) {
      const grp = String(row[2] || "").trim();
      const avg = parseFloat(row[3]);
      if (grp && !isNaN(avg)) quotaByGroup[grp] = avg;
    }
  }

  // Find most recent COMPLETED date — skip today's partial data
  const allDates = new Set();
  for (const row of details) {
    const d = String(row.complete_date || "").slice(0, 8);
    if (/^\d{8}$/.test(d)) allDates.add(d);
  }
  if (!allDates.size) throw new Error("No valid complete_date found in Details sheet");
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const sorted = [...allDates].sort();
  const completed = sorted.filter(d => d < todayStr);
  const latestDate = completed.length ? completed[completed.length - 1] : sorted[sorted.length - 1];

  // Detect case type column
  const latestRows = details.filter(r => String(r.complete_date || "").slice(0, 8) === latestDate);
  const caseTypeCol = detectCaseTypeColumn(latestRows);
  console.log(`[parser] latestDate=${latestDate} rows=${latestRows.length} caseTypeCol=${caseTypeCol}`);
  if (!caseTypeCol && latestRows[0]) console.log(`[parser] available columns: ${Object.keys(latestRows[0]).join(", ")}`);

  // Aggregate per designer on latestDate — weighted by case type
  const byDesigner = {};
  for (const row of details) {
    const dateStr = String(row.complete_date || "").slice(0, 8);
    if (dateStr !== latestDate) continue;

    const uid = String(row.designer_user_id || "").trim();
    const pos = String(row.position || "").replace(/^BR-/, "").trim();
    if (!uid || SKIP_POSITIONS.has(pos)) continue;

    if (!byDesigner[uid]) {
      byDesigner[uid] = {
        designer_name: normalizeName(String(row.designer_name || "").trim()),
        job_level:     pos,
        group_no:      String(row.group || "").trim(),
        completed:     0,
        new_case_count: 0,
        mod_count:      0,
        refinement_count: 0,
        other_count:    0,
      };
    }

    const caseType = caseTypeCol ? classifyCase(row[caseTypeCol]) : "other";
    byDesigner[uid].completed += WEIGHTS[caseType];
    byDesigner[uid][caseType === "new_case" ? "new_case_count" : caseType + "_count"]++;
  }

  // Country counts for the latest date
  const geoMap = {};
  for (const row of details) {
    const dateStr = String(row.complete_date || "").slice(0, 8);
    if (dateStr !== latestDate) continue;
    const country = String(row.country || "").trim();
    if (!country || country === "NA") continue;
    geoMap[country] = (geoMap[country] || 0) + 1;
  }
  const geo = Object.entries(geoMap).map(([country, case_count]) => ({ country, case_count }));

  const rows = Object.values(byDesigner).map(d => {
    const quota      = quotaByGroup[d.group_no] ?? quotaByGroup["BR-ATD"] ?? 0;
    const completed  = d.completed;
    const uncompleted = Math.max(0, quota - completed);
    return {
      group_no:              d.group_no,
      job_level:             d.job_level,
      designer_name:         d.designer_name,
      on_duty_morning:       1,
      on_duty_afternoon:     0,
      progress:              quota > 0 ? completed / quota : null,
      avg_progress_by_level: null,
      total_cases:           completed,
      completed,
      uncompleted,
      quota,
      remained_quota:        uncompleted,
      new_case_count:        d.new_case_count,
      mod_count:             d.mod_count,
      refinement_count:      d.refinement_count,
      other_count:           d.other_count,
    };
  });

  return { rows, geo };
}

module.exports = { parseProductivityFile };

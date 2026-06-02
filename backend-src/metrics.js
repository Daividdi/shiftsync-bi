const express = require("express");
const router = express.Router();
const db = require("../db");
const { getAdminQuotaResolver, getExcludedDesigners } = require("./admin");

const EXCLUDE_LEVELS = ["Group Leader", "Design Doctor", "Direct Manager", "HR", "IT",
  "Lean Operations", "SoftwareDeveloper-开发人员", "Trainer", "User-Wuxi", "Tech-Wuxi", "Client Support", "Clinical Support"];

function isProductionGroup(g) {
  return typeof g === "string" && g.startsWith("BR-ATD-");
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function lastNDates(n) {
  const today = todayISO();
  return db.prepare(
    `SELECT DISTINCT snapshot_date FROM uploads WHERE file_type='productivity'
     AND snapshot_date < ?
     ORDER BY snapshot_date DESC LIMIT ?`
  ).all(today, n).map(r => r.snapshot_date).reverse();
}

function prodSummary(date, groupFilter = null, groupLike = null) {
  let q = `SELECT * FROM productivity WHERE snapshot_date=? AND on_duty_morning=1
            AND job_level NOT IN (${EXCLUDE_LEVELS.map(() => "?").join(",")})
            AND group_no LIKE 'BR-ATD-%'`;
  const params = [date, ...EXCLUDE_LEVELS];
  if (groupFilter) { q += " AND group_no=?"; params.push(groupFilter); }
  if (groupLike)   { q += " AND group_no LIKE ?"; params.push(groupLike); }
  const rows = db.prepare(q).all(...params);
  if (!rows.length) return null;

  // Apply admin-set quotas; designers with quota=0 are excluded from all calculations
  const resolveQuota   = getAdminQuotaResolver(date);
  const excludedNames  = getExcludedDesigners();

  const resolvedRows = rows
    .filter(r => !excludedNames.has(r.designer_name))
    .map(r => {
      const aq = resolveQuota(r.designer_name, r.group_no);
      return aq != null ? { ...r, quota: aq, uncompleted: Math.max(0, aq - r.completed) } : r;
    });

  const withQuota = resolvedRows.filter(r => r.quota > 0);
  const totalQuota = withQuota.reduce((s, r) => s + r.quota, 0);
  const totalCompleted = withQuota.reduce((s, r) => s + r.completed, 0);
  const totalUncompleted = withQuota.reduce((s, r) => s + r.uncompleted, 0);
  const activeCount = withQuota.length;

  // Case type totals (aggregated across all designers)
  const caseTypes = {
    new_case: rows.reduce((s, r) => s + (r.new_case_count || 0), 0),
    mod:      rows.reduce((s, r) => s + (r.mod_count || 0), 0),
    refinement: rows.reduce((s, r) => s + (r.refinement_count || 0), 0),
    other:    rows.reduce((s, r) => s + (r.other_count || 0), 0),
  };

  return {
    date,
    progress: totalQuota > 0 ? totalCompleted / totalQuota : null,
    totalQuota,
    totalCompleted,
    totalUncompleted,
    activeCount,
    avgCompleted: activeCount > 0 ? totalCompleted / activeCount : 0,
    caseTypes,
  };
}

// GET /api/metrics/productivity/today?groupType=atd|atp&date=YYYY-MM-DD
router.get("/productivity/today", (req, res) => {
  const allDates = lastNDates(30);
  if (!allDates.length) return res.json({ today: null, yesterday: null });
  const gl = req.query.groupType === "atd" ? "BR-ATD-%" : req.query.groupType === "atp" ? "BR-ATP%" : null;

  if (req.query.date) {
    const d = req.query.date;
    const idx = allDates.indexOf(d);
    const prev = idx > 0 ? allDates[idx - 1] : null;
    return res.json({
      today: prodSummary(d, null, gl),
      yesterday: prev ? prodSummary(prev, null, gl) : null,
      latestDate: d,
    });
  }

  const today = allDates[allDates.length - 1];
  const yesterday = allDates.length > 1 ? allDates[allDates.length - 2] : null;
  res.json({
    today: prodSummary(today, null, gl),
    yesterday: yesterday ? prodSummary(yesterday, null, gl) : null,
    latestDate: today,
  });
});

// GET /api/metrics/productivity/trend?days=7&groupType=atd|atp
router.get("/productivity/trend", (req, res) => {
  const n = Math.min(30, parseInt(req.query.days) || 7);
  const dates = lastNDates(n);
  const gl = req.query.groupType === "atd" ? "BR-ATD-%" : req.query.groupType === "atp" ? "BR-ATP%" : null;
  const trend = dates.map(d => prodSummary(d, null, gl)).filter(Boolean);
  res.json(trend);
});

// GET /api/metrics/productivity/top?date=YYYY-MM-DD&n=3&groupType=atd|atp
router.get("/productivity/top", (req, res) => {
  const dates = lastNDates(2);
  const date = req.query.date || dates[dates.length - 1] || null;
  const n = parseInt(req.query.n) || 3;
  if (!date) return res.json([]);

  const gl = req.query.groupType === "atd" ? "BR-ATD-%" : req.query.groupType === "atp" ? "BR-ATP%" : null;
  let q = `SELECT designer_name, group_no, job_level, progress, completed, quota
     FROM productivity
     WHERE snapshot_date=? AND on_duty_morning=1 AND progress IS NOT NULL
       AND quota > 0
       AND job_level NOT IN (${EXCLUDE_LEVELS.map(() => "?").join(",")})`;
  const params = [date, ...EXCLUDE_LEVELS];
  if (gl) { q += " AND group_no LIKE ?"; params.push(gl); }
  q += " ORDER BY progress DESC, completed DESC LIMIT ?";
  params.push(n);

  const rows = db.prepare(q).all(...params);
  res.json({ date, rankings: rows });
});

// GET /api/metrics/productivity/groups?date=YYYY-MM-DD
router.get("/productivity/groups", (req, res) => {
  const dates = lastNDates(30);
  const date = req.query.date || dates[dates.length - 1] || null;
  if (!date) return res.json([]);

  const groups = db.prepare(
    "SELECT DISTINCT group_no FROM productivity WHERE snapshot_date=? ORDER BY group_no"
  ).all(date).map(r => r.group_no).filter(g => isProductionGroup(g));

  const result = groups.map(g => ({
    group: g,
    ...prodSummary(date, g),
  })).filter(g => g.totalQuota > 0);

  res.json({ date, groups: result });
});

// GET /api/metrics/productivity/groups/trend?days=7
router.get("/productivity/groups/trend", (req, res) => {
  const n = Math.min(14, parseInt(req.query.days) || 7);
  const dates = lastNDates(n);
  if (!dates.length) return res.json([]);

  const allGroups = db.prepare(
    `SELECT DISTINCT group_no FROM productivity WHERE snapshot_date IN (${dates.map(()=>"?").join(",")}) ORDER BY group_no`
  ).all(...dates).map(r => r.group_no);

  const result = allGroups.map(g => ({
    group: g,
    trend: dates.map(d => prodSummary(d, g)).filter(Boolean),
  }));

  res.json(result);
});

// GET /api/metrics/productivity/top-by-group?date=YYYY-MM-DD&n=3
router.get("/productivity/top-by-group", (req, res) => {
  const dates = lastNDates(2);
  const date = req.query.date || dates[dates.length - 1] || null;
  const n = parseInt(req.query.n) || 3;
  if (!date) return res.json([]);

  const groups = db.prepare(
    "SELECT DISTINCT group_no FROM productivity WHERE snapshot_date=? ORDER BY group_no"
  ).all(date).map(r => r.group_no).filter(g => isProductionGroup(g));

  const result = groups.map(g => {
    const rows = db.prepare(
      `SELECT designer_name, group_no, job_level, progress, completed, quota
       FROM productivity
       WHERE snapshot_date=? AND group_no=? AND on_duty_morning=1
         AND progress IS NOT NULL AND quota > 0
         AND job_level NOT IN (${EXCLUDE_LEVELS.map(() => "?").join(",")})
       ORDER BY progress DESC, completed DESC LIMIT ?`
    ).all(date, g, ...EXCLUDE_LEVELS, n);
    return { group: g, top: rows };
  }).filter(g => g.top.length > 0);

  res.json({ date, groups: result });
});

// GET /api/metrics/productivity/top-by-group/month?n=5
router.get("/productivity/top-by-group/month", (req, res) => {
  const n = parseInt(req.query.n) || 5;

  const today = todayISO();
  const latestRow = db.prepare(
    "SELECT MAX(snapshot_date) as d FROM uploads WHERE file_type='productivity' AND snapshot_date < ?"
  ).get(today);
  if (!latestRow?.d) return res.json({ month: null, groups: [] });

  const month = latestRow.d.slice(0, 7);
  const dates = db.prepare(
    "SELECT DISTINCT snapshot_date FROM uploads WHERE file_type='productivity' AND snapshot_date LIKE ? AND snapshot_date < ? ORDER BY snapshot_date"
  ).all(`${month}-%`, today).map(r => r.snapshot_date);

  if (!dates.length) return res.json({ month, groups: [] });

  const ph = dates.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT group_no, designer_name, job_level,
           SUM(completed) as total_completed,
           SUM(quota) as total_quota
    FROM productivity
    WHERE snapshot_date IN (${ph})
      AND on_duty_morning = 1
      AND quota > 0
      AND job_level NOT IN (${EXCLUDE_LEVELS.map(() => "?").join(",")})
    GROUP BY group_no, designer_name
    ORDER BY group_no, total_completed DESC
  `).all(...dates, ...EXCLUDE_LEVELS);

  const byGroup = {};
  for (const row of rows) {
    if (!byGroup[row.group_no]) byGroup[row.group_no] = [];
    if (byGroup[row.group_no].length < n) {
      byGroup[row.group_no].push({
        designer_name: row.designer_name,
        job_level: row.job_level,
        completed: Math.round(row.total_completed),
        quota: Math.round(row.total_quota),
        progress: row.total_quota > 0 ? row.total_completed / row.total_quota : null,
      });
    }
  }

  const groups = Object.keys(byGroup).sort().map(g => ({ group: g, top: byGroup[g] }));
  res.json({ month, groups });
});

// GET /api/metrics/productivity/available-dates
router.get("/productivity/available-dates", (_, res) => {
  const today = todayISO();
  const dates = db.prepare(
    "SELECT DISTINCT snapshot_date FROM uploads WHERE file_type='productivity' AND snapshot_date < ? ORDER BY snapshot_date DESC"
  ).all(today).map(r => r.snapshot_date);
  res.json({ dates });
});

// GET /api/metrics/productivity/geo?date=YYYY-MM-DD
router.get("/productivity/geo", (req, res) => {
  const dates = lastNDates(2);
  const date = req.query.date || dates[dates.length - 1] || null;
  if (!date) return res.json({ date: null, geo: [] });
  const geo = db.prepare(
    "SELECT country, case_count FROM productivity_geo WHERE snapshot_date=? ORDER BY case_count DESC"
  ).all(date);
  res.json({ date, geo });
});

// GET /api/metrics/productivity/levels?date=YYYY-MM-DD
router.get("/productivity/levels", (req, res) => {
  const dates = lastNDates(30);
  const date = req.query.date || dates[dates.length - 1] || null;
  if (!date) return res.json({ date: null, levels: [] });

  const rows = db.prepare(`
    SELECT job_level,
           COUNT(*) as designer_count,
           ROUND(AVG(progress) * 100, 1) as avg_progress_pct,
           ROUND(AVG(completed), 1) as avg_completed,
           ROUND(AVG(quota), 1) as avg_quota
    FROM productivity
    WHERE snapshot_date=? AND on_duty_morning=1 AND quota > 0
      AND group_no LIKE 'BR-ATD-%'
      AND job_level NOT IN (${EXCLUDE_LEVELS.map(() => "?").join(",")})
    GROUP BY job_level
    ORDER BY avg_progress_pct DESC
  `).all(date, ...EXCLUDE_LEVELS);

  res.json({ date, levels: rows });
});

// GET /api/metrics/productivity/attainment?date=YYYY-MM-DD
// Returns per-designer quota attainment for the given date, admin-quota-resolved
router.get("/productivity/attainment", (req, res) => {
  const dates = lastNDates(30);
  const date = req.query.date || dates[dates.length - 1] || null;
  if (!date) return res.json({ date: null, designers: [] });

  let q = `SELECT designer_name, group_no, job_level, completed, quota, new_case_count, mod_count, refinement_count
           FROM productivity WHERE snapshot_date=? AND on_duty_morning=1
           AND job_level NOT IN (${EXCLUDE_LEVELS.map(() => "?").join(",")})`;
  const rows = db.prepare(q).all(date, ...EXCLUDE_LEVELS);

  const resolveQuota  = getAdminQuotaResolver(date);
  const excludedNames = getExcludedDesigners();

  const designers = rows
    .filter(r => !excludedNames.has(r.designer_name))
    .map(r => {
      const aq = resolveQuota(r.designer_name, r.group_no);
      const quota = aq != null ? aq : r.quota;
      if (quota <= 0) return null;
      const progress = quota > 0 ? r.completed / quota : null;
      return {
        designer_name: r.designer_name,
        group_no: r.group_no,
        job_level: r.job_level,
        completed: r.completed,
        quota,
        progress,
        new_case_count: r.new_case_count || 0,
        mod_count: r.mod_count || 0,
        refinement_count: r.refinement_count || 0,
        quota_source: aq != null ? "admin" : "spreadsheet",
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.progress ?? 0) - (b.progress ?? 0)); // worst first

  res.json({ date, designers });
});

// GET /api/metrics/productivity/attainment-period?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/productivity/attainment-period", (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: "start and end required" });

  const today = todayISO();
  const dates = db.prepare(
    "SELECT DISTINCT snapshot_date FROM uploads WHERE file_type='productivity' AND snapshot_date BETWEEN ? AND ? AND snapshot_date < ? ORDER BY snapshot_date"
  ).all(start, end, today).map(r => r.snapshot_date);

  if (!dates.length) return res.json({ start, end, dates: [], designers: [] });

  const excludedNames = getExcludedDesigners();
  const designerMap = {};

  for (const date of dates) {
    const resolveQuota = getAdminQuotaResolver(date);
    const rows = db.prepare(
      `SELECT designer_name, group_no, job_level, completed, quota, new_case_count, mod_count, refinement_count
       FROM productivity WHERE snapshot_date=? AND on_duty_morning=1
       AND job_level NOT IN (${EXCLUDE_LEVELS.map(() => "?").join(",")})
       AND group_no LIKE 'BR-ATD-%'`
    ).all(date, ...EXCLUDE_LEVELS);

    for (const r of rows) {
      if (excludedNames.has(r.designer_name)) continue;
      const aq = resolveQuota(r.designer_name, r.group_no);
      const quota = aq != null ? aq : r.quota;
      if (quota <= 0) continue;

      if (!designerMap[r.designer_name]) {
        designerMap[r.designer_name] = {
          designer_name: r.designer_name,
          group_no: r.group_no,
          job_level: r.job_level,
          completed: 0,
          total_quota: 0,
          days: 0,
          new_case_count: 0, mod_count: 0, refinement_count: 0,
          quota_source: aq != null ? "admin" : "spreadsheet",
        };
      }
      designerMap[r.designer_name].completed    += r.completed;
      designerMap[r.designer_name].total_quota  += quota;
      designerMap[r.designer_name].days++;
      designerMap[r.designer_name].new_case_count  += r.new_case_count  || 0;
      designerMap[r.designer_name].mod_count       += r.mod_count       || 0;
      designerMap[r.designer_name].refinement_count += r.refinement_count || 0;
    }
  }

  const designers = Object.values(designerMap)
    .map(d => ({ ...d, progress: d.total_quota > 0 ? d.completed / d.total_quota : null }))
    .sort((a, b) => (a.progress ?? 0) - (b.progress ?? 0));

  res.json({ start, end, dates, designers });
});

// GET /api/metrics/available-dates
router.get("/available-dates", (_, res) => {
  const today = todayISO();
  const rows = db.prepare(
    "SELECT snapshot_date, file_type FROM uploads WHERE snapshot_date < ? ORDER BY snapshot_date DESC LIMIT 60"
  ).all(today);
  res.json(rows);
});

module.exports = router;

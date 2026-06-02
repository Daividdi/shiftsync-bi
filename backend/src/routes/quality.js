const express = require("express");
const router = express.Router();
const db = require("../db");
const { getExcludedDesigners } = require("./admin");

const MIN_CASES = 3;

function isProductionGroup(g) {
  return typeof g === "string" && g.startsWith("BR-ATD-");
}

function latestDesignerDate(periodType) {
  const row = db.prepare(
    `SELECT snapshot_date FROM uploads WHERE file_type='quality_${periodType}_designer'
     ORDER BY snapshot_date DESC LIMIT 1`
  ).get();
  return row?.snapshot_date || null;
}

function resolveDate(periodType, explicit) {
  return explicit || latestDesignerDate(periodType);
}

function aggregateDesigners(rows) {
  const totalQty   = rows.reduce((s, r) => s + (r.score_qty   || 0), 0);
  const totalLow   = rows.reduce((s, r) => s + (r.qty_low_score || 0), 0);
  const totalUnfit = rows.reduce((s, r) => s + (r.qty_unfit   || 0), 0);
  const weighted   = rows.reduce((s, r) => s + (r.avg_score   || 0) * (r.score_qty || 0), 0);
  return {
    avg_score:      totalQty > 0 ? weighted / totalQty : null,
    total_scored:   totalQty,
    rate_low_score: totalQty > 0 ? totalLow  / totalQty : null,
    rate_unfit:     totalQty > 0 ? totalUnfit / totalQty : null,
    qty_low_score:  totalLow,
    qty_unfit:      totalUnfit,
  };
}

// GET /api/quality/available-dates
router.get("/available-dates", (_, res) => {
  const weeks = db.prepare(
    "SELECT DISTINCT snapshot_date FROM uploads WHERE file_type='quality_week_designer' ORDER BY snapshot_date DESC"
  ).all().map(r => r.snapshot_date);
  const months = db.prepare(
    "SELECT DISTINCT snapshot_date FROM uploads WHERE file_type='quality_month_designer' ORDER BY snapshot_date DESC"
  ).all().map(r => r.snapshot_date);
  res.json({ weeks, months });
});

// GET /api/quality/summary?weekDate=&monthDate=
router.get("/summary", (req, res) => {
  const weekDate  = resolveDate("week",  req.query.weekDate);
  const monthDate = resolveDate("month", req.query.monthDate);

  const weekRows  = weekDate  ? db.prepare("SELECT * FROM quality_designer WHERE snapshot_date=? AND period_type='week'").all(weekDate).filter(r => isProductionGroup(r.group_no))  : [];
  const monthRows = monthDate ? db.prepare("SELECT * FROM quality_designer WHERE snapshot_date=? AND period_type='month'").all(monthDate).filter(r => isProductionGroup(r.group_no)) : [];

  const weekBatch  = weekDate  ? db.prepare("SELECT * FROM quality_batch WHERE snapshot_date=? AND period_type='week'").all(weekDate)  : [];
  const monthBatch = monthDate ? db.prepare("SELECT * FROM quality_batch WHERE snapshot_date=? AND period_type='month'").all(monthDate) : [];

  const totalWeek  = weekBatch.find(r => r.position_name === "TOTAL");
  const totalMonth = monthBatch.find(r => r.position_name === "TOTAL");

  res.json({
    week: {
      date: weekDate,
      ...aggregateDesigners(weekRows),
      total_avg_score: totalWeek?.avg_score ?? null,
      by_position: weekBatch.filter(r => r.position_name !== "TOTAL"),
    },
    month: {
      date: monthDate,
      ...aggregateDesigners(monthRows),
      total_avg_score: totalMonth?.avg_score ?? null,
      by_position: monthBatch.filter(r => r.position_name !== "TOTAL"),
    },
  });
});

// GET /api/quality/trend?periods=7&date=YYYY-MM-DD
router.get("/trend", (req, res) => {
  const n    = Math.min(20, parseInt(req.query.periods) || 7);
  const upTo = req.query.date || null;
  const uploads = upTo
    ? db.prepare("SELECT DISTINCT snapshot_date FROM uploads WHERE file_type='quality_week_designer' AND snapshot_date<=? ORDER BY snapshot_date DESC LIMIT ?").all(upTo, n)
    : db.prepare("SELECT DISTINCT snapshot_date FROM uploads WHERE file_type='quality_week_designer' ORDER BY snapshot_date DESC LIMIT ?").all(n);

  const trend = uploads.map(r => r.snapshot_date).reverse().map(date => {
    const rows  = db.prepare("SELECT * FROM quality_designer WHERE snapshot_date=? AND period_type='week'").all(date).filter(r => isProductionGroup(r.group_no));
    const agg   = aggregateDesigners(rows);
    const batch = db.prepare("SELECT * FROM quality_batch WHERE snapshot_date=? AND period_type='week'").all(date);
    const total = batch.find(r => r.position_name === "TOTAL");
    return { date, ...agg, total_avg_score: total?.avg_score ?? agg.avg_score };
  });

  res.json(trend);
});

// GET /api/quality/trend/month?periods=6&date=YYYY-MM-DD
router.get("/trend/month", (req, res) => {
  const n    = Math.min(12, parseInt(req.query.periods) || 6);
  const upTo = req.query.date || null;
  const uploads = upTo
    ? db.prepare("SELECT DISTINCT snapshot_date FROM uploads WHERE file_type='quality_month_designer' AND snapshot_date<=? ORDER BY snapshot_date DESC LIMIT ?").all(upTo, n)
    : db.prepare("SELECT DISTINCT snapshot_date FROM uploads WHERE file_type='quality_month_designer' ORDER BY snapshot_date DESC LIMIT ?").all(n);

  const trend = uploads.map(r => r.snapshot_date).reverse().map(date => {
    const rows  = db.prepare("SELECT * FROM quality_designer WHERE snapshot_date=? AND period_type='month'").all(date).filter(r => isProductionGroup(r.group_no));
    const agg   = aggregateDesigners(rows);
    return { date, ...agg };
  });

  res.json(trend);
});

// GET /api/quality/top?period=week&n=10&date=
router.get("/top", (req, res) => {
  const period = req.query.period || "week";
  const n    = parseInt(req.query.n) || 10;
  const date = resolveDate(period, req.query.date);
  if (!date) return res.json({ date: null, rankings: [] });

  const rows = db.prepare(
    `SELECT designer_name, group_no, position, avg_score, score_qty, prop_low_score
     FROM quality_designer
     WHERE snapshot_date=? AND period_type=? AND score_qty >= ? AND group_no NOT IN ('BR-ATD','TOTAL')
     ORDER BY avg_score DESC, score_qty DESC LIMIT ?`
  ).all(date, period, MIN_CASES, n).filter(r => isProductionGroup(r.group_no));

  res.json({ date, rankings: rows });
});

// GET /api/quality/groups?period=week&date=
router.get("/groups", (req, res) => {
  const period = req.query.period || "week";
  const date   = resolveDate(period, req.query.date);
  if (!date) return res.json({ date: null, groups: [] });

  const excluded = getExcludedDesigners();
  const allRows = db.prepare(
    "SELECT * FROM quality_designer WHERE snapshot_date=? AND period_type=? AND group_no NOT IN ('BR-ATD','TOTAL')"
  ).all(date, period).filter(r => !excluded.has(r.designer_name) && isProductionGroup(r.group_no));

  const byGroup = {};
  for (const r of allRows) {
    if (!byGroup[r.group_no]) byGroup[r.group_no] = [];
    byGroup[r.group_no].push(r);
  }

  const groups = Object.entries(byGroup).map(([group, rows]) => ({
    group,
    ...aggregateDesigners(rows),
  })).filter(g => g.total_scored > 0).sort((a, b) => b.avg_score - a.avg_score);

  res.json({ date, groups });
});

// GET /api/quality/top-by-group?period=week&n=5&date=
router.get("/top-by-group", (req, res) => {
  const period = req.query.period || "week";
  const n    = parseInt(req.query.n) || 5;
  const date = resolveDate(period, req.query.date);
  if (!date) return res.json({ date: null, groups: [] });

  const excluded = getExcludedDesigners();
  const groups = db.prepare(
    "SELECT DISTINCT group_no FROM quality_designer WHERE snapshot_date=? AND period_type=? AND group_no NOT IN ('BR-ATD','TOTAL') ORDER BY group_no"
  ).all(date, period).map(r => r.group_no).filter(g => isProductionGroup(g));

  const result = groups.map(g => {
    const top = db.prepare(
      `SELECT designer_name, position, avg_score, score_qty
       FROM quality_designer
       WHERE snapshot_date=? AND period_type=? AND group_no=? AND score_qty >= ?
       ORDER BY avg_score DESC, score_qty DESC LIMIT ?`
    ).all(date, period, g, MIN_CASES, n + excluded.size + 5).filter(r => !excluded.has(r.designer_name)).slice(0, n);
    return { group: g, top };
  }).filter(g => g.top.length > 0);

  res.json({ date, groups: result });
});

// GET /api/quality/designers?period=week&date=
router.get("/designers", (req, res) => {
  const period = req.query.period || "week";
  const date   = resolveDate(period, req.query.date);
  if (!date) return res.json({ date: null, designers: [] });

  const designers = db.prepare(
    `SELECT designer_name, group_no, position, avg_score, score_qty, prop_low_score, qty_low_score, qty_unfit
     FROM quality_designer
     WHERE snapshot_date=? AND period_type=? AND score_qty > 0
       AND group_no NOT IN ('BR-ATD','TOTAL')
     ORDER BY score_qty DESC`
  ).all(date, period).filter(r => isProductionGroup(r.group_no));

  res.json({ date, designers });
});

module.exports = router;

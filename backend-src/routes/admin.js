const express = require("express");
const router = express.Router();
const db = require("../db");

// Resolve admin quota for a designer/group.
// Always uses the most recent quota entry, so quotas set in Gestão apply to all dates.
function getAdminQuotaResolver(_date) {
  const rows = db.prepare(
    `SELECT designer_name, group_no, quota
     FROM quotas ORDER BY effective_date DESC, id DESC`
  ).all();

  // First-wins: since sorted desc by date, first entry per key is the latest
  const dMap = {}, gMap = {};
  for (const r of rows) {
    if (r.designer_name && !dMap[r.designer_name]) dMap[r.designer_name] = r.quota;
    else if (!r.designer_name && r.group_no && !gMap[r.group_no]) gMap[r.group_no] = r.quota;
  }
  return (designerName, groupNo) => dMap[designerName] ?? gMap[groupNo] ?? null;
}

// GET /api/admin/quotas — list all quota entries
router.get("/quotas", (_, res) => {
  const rows = db.prepare(
    `SELECT id, group_no, designer_name, quota, effective_date, notes, created_at
     FROM quotas ORDER BY effective_date DESC, group_no, designer_name`
  ).all();
  res.json(rows);
});

// GET /api/admin/designers — list known designers from productivity table
router.get("/designers", (_, res) => {
  const rows = db.prepare(
    `SELECT DISTINCT designer_name, group_no
     FROM productivity
     WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM uploads WHERE file_type='productivity')
     ORDER BY group_no, designer_name`
  ).all();
  res.json(rows);
});

// GET /api/admin/groups — list known groups from productivity table
router.get("/groups", (_, res) => {
  const rows = db.prepare(
    `SELECT DISTINCT group_no FROM productivity
     WHERE group_no IS NOT NULL AND group_no != ''
     ORDER BY group_no`
  ).all().map(r => r.group_no);
  res.json(rows);
});

// POST /api/admin/quotas — create quota entry
router.post("/quotas", (req, res) => {
  const { group_no, designer_name, quota, effective_date, notes } = req.body;
  if (!quota || !effective_date)
    return res.status(400).json({ error: "quota and effective_date are required" });
  if (!group_no && !designer_name)
    return res.status(400).json({ error: "group_no or designer_name is required" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effective_date))
    return res.status(400).json({ error: "effective_date must be YYYY-MM-DD" });

  const { lastInsertRowid } = db.prepare(
    `INSERT INTO quotas (group_no, designer_name, quota, effective_date, notes)
     VALUES (?, ?, ?, ?, ?)`
  ).run(group_no || null, designer_name || null, parseFloat(quota), effective_date, notes || null);

  res.json({ ok: true, id: lastInsertRowid });
});

// PUT /api/admin/quotas/:id — update quota entry
router.put("/quotas/:id", (req, res) => {
  const { quota, effective_date, notes } = req.body;
  if (!quota || !effective_date)
    return res.status(400).json({ error: "quota and effective_date are required" });

  const info = db.prepare(
    `UPDATE quotas SET quota=?, effective_date=?, notes=? WHERE id=?`
  ).run(parseFloat(quota), effective_date, notes || null, req.params.id);

  if (!info.changes) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// DELETE /api/admin/quotas/:id
router.delete("/quotas/:id", (req, res) => {
  const info = db.prepare("DELETE FROM quotas WHERE id=?").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// Returns a Set of designer names whose latest admin quota is 0 (should be excluded everywhere)
function getExcludedDesigners() {
  const rows = db.prepare(
    `SELECT designer_name, quota FROM quotas
     WHERE designer_name IS NOT NULL ORDER BY effective_date DESC, id DESC`
  ).all();
  const seen = new Set(), excluded = new Set();
  for (const r of rows) {
    if (!seen.has(r.designer_name)) {
      seen.add(r.designer_name);
      if (r.quota === 0) excluded.add(r.designer_name);
    }
  }
  return excluded;
}

module.exports = { router, getAdminQuotaResolver, getExcludedDesigners };

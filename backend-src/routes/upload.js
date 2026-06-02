const express = require("express");
const multer  = require("multer");
const router  = express.Router();
const db      = require("../db");
const { parseProductivityFile }             = require("../parsers/productivity");
const { parseQualityFile, monthLabelToEndDate } = require("../parsers/quality");

const storage = multer.memoryStorage();
const upload  = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.originalname.match(/\.xlsx?$/i)) cb(null, true);
    else cb(new Error("Only .xlsx files accepted"));
  },
});

router.post("/", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const fileType     = req.body.type || "productivity";
    const snapshotDate = req.body.date || new Date().toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate))
      return res.status(400).json({ error: "Invalid date format (YYYY-MM-DD)" });

    if (fileType === "productivity") return handleProductivity(req, res);
    if (fileType === "quality")      return handleQuality(req, res, snapshotDate);

    return res.status(400).json({ error: "Invalid type (use 'productivity' or 'quality')" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Productivity ─────────────────────────────────────────────────────────────
// Always replaces existing data for each detected date — the daily file is the source of truth.
// Date comes from each row's complete_date, never from the upload form.

function handleProductivity(req, res) {
  const dateResults = parseProductivityFile(req.file.buffer);

  const stmt = db.prepare(`
    INSERT INTO productivity
      (upload_id,snapshot_date,group_no,job_level,designer_name,
       on_duty_morning,on_duty_afternoon,progress,avg_progress_by_level,
       total_cases,completed,uncompleted,quota,remained_quota,
       new_case_count,mod_count,refinement_count,other_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const geoStmt = db.prepare(
    "INSERT INTO productivity_geo (upload_id,snapshot_date,country,case_count) VALUES (?,?,?,?)"
  );

  let imported = 0, replaced = 0;

  for (const { date, rows, geo } of dateResults) {
    // Always replace: delete existing upload record (cascade removes linked rows) + any orphaned rows
    const existing = db.prepare("SELECT id FROM uploads WHERE snapshot_date=? AND file_type='productivity'").get(date);
    if (existing) {
      db.prepare("DELETE FROM uploads WHERE id=?").run(existing.id);
      replaced++;
    } else {
      imported++;
    }
    // Remove orphaned rows for this date not covered by cascade
    db.prepare("DELETE FROM productivity WHERE snapshot_date=? AND upload_id NOT IN (SELECT id FROM uploads)").run(date);
    db.prepare("DELETE FROM productivity_geo WHERE snapshot_date=? AND upload_id NOT IN (SELECT id FROM uploads)").run(date);
    // Clear from deleted_snapshots so this date can always be re-imported
    db.prepare("DELETE FROM deleted_snapshots WHERE snapshot_date=? AND file_type='productivity'").run(date);

    const { lastInsertRowid: uploadId } = db.prepare(
      "INSERT INTO uploads (snapshot_date, filename, file_type) VALUES (?,?,?)"
    ).run(date, req.file.originalname, "productivity");

    db.transaction(() => {
      for (const r of rows) stmt.run(
        uploadId, date, r.group_no, r.job_level, r.designer_name,
        r.on_duty_morning, r.on_duty_afternoon, r.progress, r.avg_progress_by_level,
        r.total_cases, r.completed, r.uncompleted, r.quota, r.remained_quota,
        r.new_case_count || 0, r.mod_count || 0, r.refinement_count || 0, r.other_count || 0
      );
      for (const g of geo) geoStmt.run(uploadId, date, g.country, g.case_count);
    })();
  }

  return res.json({ ok: true, dates: dateResults.length, imported, replaced });
}

// ─── Quality ──────────────────────────────────────────────────────────────────

// skipIfExists=true: returns null for records already in DB *or* that the user explicitly deleted.
// skipIfExists=false: force-reimport — clears the deleted blocklist and replaces any existing record.
function upsertUpload(date, filename, fileType, skipIfExists = false) {
  if (skipIfExists) {
    const ex = db.prepare("SELECT 1 FROM uploads WHERE snapshot_date=? AND file_type=?").get(date, fileType);
    if (ex) return null;
    const wasDeleted = db.prepare("SELECT 1 FROM deleted_snapshots WHERE snapshot_date=? AND file_type=?").get(date, fileType);
    if (wasDeleted) return null;
  } else {
    // Force reimport: remove existing data and clear the deleted blocklist
    const ex = db.prepare("SELECT id FROM uploads WHERE snapshot_date=? AND file_type=?").get(date, fileType);
    if (ex) db.prepare("DELETE FROM uploads WHERE id=?").run(ex.id);
    db.prepare("DELETE FROM deleted_snapshots WHERE snapshot_date=? AND file_type=?").run(date, fileType);
  }
  return db.prepare("INSERT INTO uploads (snapshot_date, filename, file_type) VALUES (?,?,?)")
    .run(date, filename, fileType).lastInsertRowid;
}

function handleQuality(req, res, snapshotDate) {
  // force=true: reimport everything (clears deleted_snapshots, replaces existing records)
  const force = req.body.force === "true" || req.body.force === true;
  const parsed = parseQualityFile(req.file.buffer);

  // ── New combined format (Capacity_Design_score / BR_Case_design_score) ──
  if (parsed.subType === "combined") {
    const { weeklyGroups, weeklyPositions, weeklyDesigners, monthlyDesigners, _sheetNames } = parsed;

    // If nothing was parsed, the file format is unrecognised — return useful debug info
    if (!weeklyGroups.length && !weeklyDesigners.length && !monthlyDesigners.length) {
      return res.status(422).json({
        error: `Nenhum dado encontrado no arquivo. Abas detectadas: ${(_sheetNames || []).join(", ") || "(nenhuma)"}`,
        sheetNames: _sheetNames || [],
      });
    }

    const batchStmt = db.prepare(`
      INSERT INTO quality_batch (upload_id,snapshot_date,period_type,period_label,position_name,avg_score)
      VALUES (?,?,?,?,?,?)
    `);
    const designerStmt = db.prepare(`
      INSERT INTO quality_designer
        (upload_id,snapshot_date,period_type,period_label,group_no,position,username,
         designer_name,avg_score,prop_low_score,prop_unfit,score_qty,qty_low_score,qty_unfit)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const ATD_GROUPS = new Set(["BR-ATD-BR1","BR-ATD-BR2","BR-ATD-BR3","BR-ATD-BR4","BR-ATD-BR5"]);

    // Collect all distinct week dates from both sources
    const allWeekDates = [...new Set([
      ...weeklyGroups.map(g => g.week_date),
      ...weeklyDesigners.map(d => d.period_date),
    ])].sort();

    // ── One upload record per week ──────────────────────────────────────────
    let importedWeeks = 0, importedMonths = 0;
    for (const wDate of allWeekDates) {
      const uid = upsertUpload(wDate, req.file.originalname, "quality_week_designer", !force);
      if (!uid) continue; // already exists or blocked — skip
      importedWeeks++;

      const weekGroups    = weeklyGroups.filter(g => g.week_date === wDate);
      const weekPositions = weeklyPositions.filter(p => p.week_date === wDate);
      const weekDesigners = weeklyDesigners.filter(d => d.period_date === wDate);
      const weekLabel     = weekGroups[0]?.week_label || weekDesigners[0]?.period_label || wDate;

      db.transaction(() => {
        // Group-level batch + TOTAL
        for (const g of weekGroups) {
          batchStmt.run(uid, wDate, "week", weekLabel, g.group_no, g.avg_score);
        }
        const subScores = weekGroups.filter(g => ATD_GROUPS.has(g.group_no)).map(g => g.avg_score);
        if (subScores.length) {
          batchStmt.run(uid, wDate, "week", weekLabel, "TOTAL",
            subScores.reduce((s, v) => s + v, 0) / subScores.length);
        }

        // Position-level batch
        for (const p of weekPositions) {
          batchStmt.run(uid, wDate, "week", weekLabel, p.position_name, p.avg_score);
        }

        // Per-designer rows
        for (const d of weekDesigners) {
          designerStmt.run(uid, wDate, "week", weekLabel,
            d.group_no, d.position, d.username, d.designer_name,
            d.avg_score, d.prop_low_score, d.prop_unfit,
            d.score_qty, d.qty_low_score, d.qty_unfit
          );
        }
      })();
    }

    // ── Monthly per-designer ────────────────────────────────────────────────
    const allMonthDates = [...new Set(monthlyDesigners.map(d => d.period_date))].sort();
    for (const moDate of allMonthDates) {
      const uid    = upsertUpload(moDate, req.file.originalname, "quality_month_designer", !force);
      if (!uid) continue; // already exists or blocked — skip
      importedMonths++;
      const moRows = monthlyDesigners.filter(d => d.period_date === moDate);
      const moLabel = moRows[0]?.period_label || moDate.slice(0, 7).replace("-", "");

      db.transaction(() => {
        for (const d of moRows) {
          designerStmt.run(uid, moDate, "month", moLabel,
            d.group_no, d.position, d.username, d.designer_name,
            d.avg_score, d.prop_low_score, d.prop_unfit,
            d.score_qty, d.qty_low_score, d.qty_unfit
          );
        }
      })();
    }

    return res.json({
      ok: true,
      weeks: importedWeeks,
      weeksSkipped: allWeekDates.length - importedWeeks,
      months: importedMonths,
      force,
      designers: [...new Set(weeklyDesigners.map(d => d.designer_name))].length,
    });
  }

  // ── Legacy format (Designers_Analysis / Avg_score_by_Batch sheets) ──
  const { periodType, periodLabel, rows } = parsed;
  const fileTypeFull = `quality_${periodType}_${parsed.subType}`;
  const uid = upsertUpload(snapshotDate, req.file.originalname, fileTypeFull);

  if (parsed.subType === "designer") {
    const stmt = db.prepare(`
      INSERT INTO quality_designer
        (upload_id,snapshot_date,period_type,period_label,group_no,position,username,
         designer_name,avg_score,prop_low_score,prop_unfit,score_qty,qty_low_score,qty_unfit)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    db.transaction(rs => {
      for (const r of rs) stmt.run(
        uid, snapshotDate, periodType, periodLabel,
        r.group_no, r.position, r.username, r.designer_name,
        r.avg_score, r.prop_low_score, r.prop_unfit,
        r.score_qty, r.qty_low_score, r.qty_unfit
      );
    })(rows);
  } else {
    const stmt = db.prepare(`
      INSERT INTO quality_batch (upload_id,snapshot_date,period_type,period_label,position_name,avg_score)
      VALUES (?,?,?,?,?,?)
    `);
    db.transaction(rs => {
      for (const r of rs) stmt.run(uid, snapshotDate, periodType, periodLabel, r.position_name, r.avg_score);
    })(rows);
  }

  return res.json({ ok: true, date: snapshotDate, subType: fileTypeFull, periodLabel, rows: rows.length });
}

// ─── History & Delete ─────────────────────────────────────────────────────────

router.get("/history", (_, res) => {
  const rows = db.prepare(
    "SELECT snapshot_date, file_type, filename, uploaded_at FROM uploads ORDER BY snapshot_date DESC, file_type LIMIT 60"
  ).all();
  res.json(rows);
});

router.delete("/:date/:type", (req, res) => {
  const { date } = req.params;
  const type = decodeURIComponent(req.params.type);
  const row = db.prepare("SELECT id FROM uploads WHERE snapshot_date=? AND file_type=?").get(date, type);
  if (!row) return res.status(404).json({ error: "Not found" });
  db.prepare("DELETE FROM uploads WHERE id=?").run(row.id);
  // Record the explicit deletion so re-uploads skip this week permanently
  db.prepare("INSERT OR REPLACE INTO deleted_snapshots (snapshot_date, file_type) VALUES (?,?)").run(date, type);
  res.json({ ok: true });
});

module.exports = router;

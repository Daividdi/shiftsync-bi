const express = require("express");
const multer  = require("multer");
const http    = require("http");
const router  = express.Router();
const db      = require("../db");
const { parseProductivityFile }             = require("../parsers/productivity");
const { parseQualityFile, monthLabelToEndDate } = require("../parsers/quality");

function notifyBiUpdated(title, body) {
  const secret = process.env.BI_NOTIFY_SECRET;
  const base   = process.env.SHIFTSYNC_NOTIFY_URL || "http://172.25.66.23:8080";
  if (!secret) return;
  try {
    const payload = JSON.stringify({ title, body: body || null });
    const url = new URL("/api/internal/bi-updated", base);
    const req = http.request({
      hostname: url.hostname, port: url.port || 80, path: url.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret, "Content-Length": Buffer.byteLength(payload) },
    });
    req.on("error", () => {});
    req.write(payload);
    req.end();
  } catch (_) {}
}


function describeProductivityUpdate(dateResults) {
  const n = dateResults.length;
  if (n === 0) return "Nenhum dado importado";
  const dates = dateResults.map(d => d.date).sort();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  if (n === 1) {
    if (dates[0] === yStr) return "Dados de ontem atualizados";
    const [, m, d] = dates[0].split("-");
    return `Dados de ${d}/${m} atualizados`;
  }
  if (n <= 7) return "Última semana atualizada";
  return "Último mês atualizado";
}

function describeQualityUpdate(importedWeeks, importedMonths) {
  if (importedWeeks > 0 && importedMonths > 0) {
    const w = importedWeeks === 1 ? "1 semana" : `${importedWeeks} semanas`;
    const m = importedMonths === 1 ? "1 mês" : `${importedMonths} meses`;
    return `${w} e ${m} atualizados`;
  }
  if (importedWeeks === 1) return "Última semana atualizada";
  if (importedWeeks > 1) return `${importedWeeks} semanas atualizadas`;
  if (importedMonths === 1) return "Último mês atualizado";
  if (importedMonths > 1) return `${importedMonths} meses atualizados`;
  return "Dados atualizados";
}

const storage = multer.memoryStorage();
const upload  = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.originalname.match(/\.xlsx?$/i)) cb(null, true);
    else cb(new Error("Only .xlsx files accepted"));
  },
});

// Autodetecção: tenta qualidade (abas BR Case Design), depois produtividade.
function detectFileType(buffer) {
  try {
    const q = parseQualityFile(buffer);
    if (q && (q.subType !== "combined" || q.weeklyGroups.length || q.weeklyDesigners.length || q.monthlyDesigners.length)) return "quality";
  } catch (e) {}
  try {
    const p = parseProductivityFile(buffer);
    if (p && p.length) return "productivity";
  } catch (e) {}
  return null;
}

// ─── Preview (parse only, no DB writes) ──────────────────────────────────────
router.post("/preview", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    let fileType       = req.body.type || "productivity";
    const snapshotDate = req.body.date || new Date().toISOString().slice(0, 10);
    if (fileType === "auto") {
      fileType = detectFileType(req.file.buffer);
      if (!fileType) return res.status(422).json({ error: "Formato não reconhecido — envie Capacity_Design (produtividade) ou BR Case Design (qualidade)." });
    }

    if (fileType === "productivity") {
      const dateResults = parseProductivityFile(req.file.buffer);
      const dates = dateResults.map(({ date }) => {
        const ex = db.prepare("SELECT 1 FROM uploads WHERE snapshot_date=? AND file_type='productivity'").get(date);
        return { date, status: ex ? "replace" : "new" };
      });
      return res.json({ type: "productivity", dates });
    }

    if (fileType === "quality") {
      const parsed = parseQualityFile(req.file.buffer);

      if (parsed.subType !== "combined") {
        return res.json({ type: "quality_legacy", subType: parsed.subType, periodType: parsed.periodType });
      }

      const { weeklyGroups, weeklyDesigners, monthlyDesigners, _sheetNames } = parsed;
      if (!weeklyGroups.length && !weeklyDesigners.length && !monthlyDesigners.length) {
        return res.status(422).json({
          error: `Nenhum dado encontrado no arquivo. Abas detectadas: ${(_sheetNames || []).join(", ") || "(nenhuma)"}`,
          sheetNames: _sheetNames || [],
        });
      }

      const allWeekDates = [...new Set([
        ...weeklyGroups.map(g => g.week_date),
        ...weeklyDesigners.map(d => d.period_date),
      ])].sort();

      const weeks = allWeekDates.map(date => {
        const ex  = db.prepare("SELECT 1 FROM uploads WHERE snapshot_date=? AND file_type='quality_week_designer'").get(date);
        const del = !ex && db.prepare("SELECT 1 FROM deleted_snapshots WHERE snapshot_date=? AND file_type='quality_week_designer'").get(date);
        const wg  = weeklyGroups.find(g => g.week_date === date);
        const wd  = weeklyDesigners.find(d => d.period_date === date);
        return { date, label: wg?.week_label || wd?.period_label || date, status: ex ? "exists" : del ? "deleted" : "new" };
      });

      const allMonthDates = [...new Set(monthlyDesigners.map(d => d.period_date))].sort();
      const months = allMonthDates.map(date => {
        const ex  = db.prepare("SELECT 1 FROM uploads WHERE snapshot_date=? AND file_type='quality_month_designer'").get(date);
        const del = !ex && db.prepare("SELECT 1 FROM deleted_snapshots WHERE snapshot_date=? AND file_type='quality_month_designer'").get(date);
        const md  = monthlyDesigners.find(d => d.period_date === date);
        return { date, label: md?.period_label || date.slice(0, 7), status: ex ? "exists" : del ? "deleted" : "new" };
      });

      return res.json({
        type: "quality_combined",
        weeks,
        months,
        designers: [...new Set(weeklyDesigners.map(d => d.designer_name))].length,
      });
    }

    return res.status(400).json({ error: "Invalid type" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    let fileType       = req.body.type || "productivity";
    const snapshotDate = req.body.date || new Date().toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate))
      return res.status(400).json({ error: "Invalid date format (YYYY-MM-DD)" });

    if (fileType === "auto") {
      fileType = detectFileType(req.file.buffer);
      if (!fileType) return res.status(422).json({ error: "Formato não reconhecido — envie Capacity_Design (produtividade) ou BR Case Design (qualidade)." });
    }

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

  notifyBiUpdated(
    "BI & Indicadores Pessoais atualizados",
    describeProductivityUpdate(dateResults)
  );
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

    notifyBiUpdated(
      "BI & Indicadores Pessoais atualizados",
      describeQualityUpdate(importedWeeks, importedMonths)
    );
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

  notifyBiUpdated(
    "BI & Indicadores Pessoais atualizados",
    periodType === "month" ? "Último mês atualizado" : "Última semana atualizada"
  );
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

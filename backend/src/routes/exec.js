const express = require("express");
const db = require("../db");
const router = express.Router();

const round = (v, d = 0) => (v == null ? null : Number(Number(v).toFixed(d)));

// GET /api/exec/summary — painel executivo (BR agora; MY entra quando a
// autenticação cross-servidor for decidida — ver exec_summary_cache).
// Sem autenticação própria aqui (este app não tem login): o acesso real é
// controlado pela ponte postMessage no frontend, que só libera a tela
// quando embutida no ShiftSync principal com role gerencia/hr/ti.
router.get("/summary", (req, res) => {
  try {
    const monthKey = new Date().toISOString().slice(0, 7);

    const prod = db.prepare(
      "SELECT SUM(completed) c, SUM(quota) q, COUNT(DISTINCT designer_name) n FROM productivity WHERE snapshot_date LIKE ? AND quota>0"
    ).get(monthKey + "-%");
    const qual = db.prepare(
      "SELECT AVG(avg_score) s, SUM(score_qty) qty FROM quality_designer WHERE period_type='month' AND snapshot_date LIKE ?"
    ).get(monthKey + "-%");
    let qc = null;
    try {
      qc = db.prepare(
        "SELECT SUM(inspections) insp, SUM(passed) passed FROM qc_designer WHERE snapshot_date LIKE ?"
      ).get(monthKey + "-%");
    } catch (e) { /* qc_designer pode não existir ainda */ }

    const br = {
      label: "Brasil", monthKey,
      headcount: prod ? prod.n : 0,
      pct: prod && prod.q > 0 ? round(prod.c / prod.q * 100) : null,
      qualityScore: qual && qual.s != null ? round(qual.s, 2) : null,
      qcRate: qc && qc.insp ? round(qc.passed / qc.insp * 100, 1) : null,
      updatedAt: new Date().toISOString(),
    };

    // MY: lido de um cache alimentado por um sync externo (ainda não
    // conectado — pendente decisão sobre a credencial cross-servidor).
    let my = { label: "Malásia", connected: false };
    try {
      const row = db.prepare("SELECT * FROM exec_summary_cache WHERE center='MY' ORDER BY id DESC LIMIT 1").get();
      if (row) {
        my = {
          label: "Malásia", connected: true,
          headcount: row.headcount, pct: row.pct, qualityScore: row.quality_score, qcRate: row.qc_rate,
          updatedAt: row.updated_at,
        };
      }
    } catch (e) { /* tabela ainda não existe */ }

    res.json({ br, my, generatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[exec/summary]", e.message);
    res.status(500).json({ error: "Falha ao calcular o painel executivo" });
  }
});

// POST /api/exec/ingest — recebe o snapshot do outro centro (secret-gated,
// mesmo padrão x-internal-secret usado no ShiftSync principal). Nenhum
// script ainda chama isto — fica pronto para quando o sync MY→BR for
// autorizado.
router.post("/ingest", (req, res) => {
  const SECRET = process.env.EXEC_SYNC_SECRET;
  if (!SECRET || req.headers["x-internal-secret"] !== SECRET) return res.status(401).json({ error: "Unauthorized" });
  const { center, headcount, pct, qualityScore, qcRate } = req.body || {};
  if (!center) return res.status(400).json({ error: "center é obrigatório" });
  db.exec(`CREATE TABLE IF NOT EXISTS exec_summary_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT, center TEXT NOT NULL,
    headcount INTEGER, pct REAL, quality_score REAL, qc_rate REAL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.prepare("INSERT INTO exec_summary_cache (center, headcount, pct, quality_score, qc_rate) VALUES (?,?,?,?,?)")
    .run(center, headcount ?? null, pct ?? null, qualityScore ?? null, qcRate ?? null);
  res.json({ ok: true });
});

module.exports = router;

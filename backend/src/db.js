const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DATA_DIR = process.env.DATA_DIR || "/data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "bi.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Safe column migration — SQLite has no ADD COLUMN IF NOT EXISTS
function addCol(table, col, type) {
  if (!db.pragma(`table_info(${table})`).find(c => c.name === col))
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL,
    filename TEXT,
    file_type TEXT NOT NULL DEFAULT 'productivity',
    uploaded_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS productivity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    snapshot_date TEXT NOT NULL,
    group_no TEXT,
    job_level TEXT,
    designer_name TEXT,
    on_duty_morning INTEGER,
    on_duty_afternoon INTEGER,
    progress REAL,
    avg_progress_by_level REAL,
    total_cases REAL,
    completed REAL,
    uncompleted REAL,
    quota REAL,
    remained_quota REAL
  );

  CREATE TABLE IF NOT EXISTS quality_designer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    snapshot_date TEXT NOT NULL,
    period_type TEXT NOT NULL,
    period_label TEXT NOT NULL,
    group_no TEXT,
    position TEXT,
    username TEXT,
    designer_name TEXT,
    avg_score REAL,
    prop_low_score REAL,
    prop_unfit REAL,
    score_qty INTEGER,
    qty_low_score INTEGER,
    qty_unfit INTEGER
  );

  CREATE TABLE IF NOT EXISTS quality_batch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    snapshot_date TEXT NOT NULL,
    period_type TEXT NOT NULL,
    period_label TEXT NOT NULL,
    position_name TEXT,
    avg_score REAL
  );

  CREATE TABLE IF NOT EXISTS productivity_geo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    snapshot_date TEXT NOT NULL,
    country TEXT NOT NULL,
    case_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_prod_date ON productivity(snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_geo_date ON productivity_geo(snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_prod_group ON productivity(snapshot_date, group_no);
  CREATE INDEX IF NOT EXISTS idx_qd_date ON quality_designer(snapshot_date, period_type);
  CREATE INDEX IF NOT EXISTS idx_qb_date ON quality_batch(snapshot_date, period_type);
  CREATE TABLE IF NOT EXISTS quotas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_no TEXT,
    designer_name TEXT,
    quota REAL NOT NULL,
    effective_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_quota_designer ON quotas(designer_name, effective_date);
  CREATE INDEX IF NOT EXISTS idx_quota_group    ON quotas(group_no, effective_date);
  CREATE TABLE IF NOT EXISTS deleted_snapshots (
    snapshot_date TEXT NOT NULL,
    file_type TEXT NOT NULL,
    deleted_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (snapshot_date, file_type)
  );
`);

// Migrations for existing installations
addCol("productivity", "new_case_count",  "INTEGER DEFAULT 0");
addCol("productivity", "mod_count",       "INTEGER DEFAULT 0");
addCol("productivity", "refinement_count","INTEGER DEFAULT 0");
addCol("productivity", "other_count",     "INTEGER DEFAULT 0");

module.exports = db;

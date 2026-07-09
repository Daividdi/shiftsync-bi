#!/usr/bin/env python3
# QC interno (inspeções) → bi.db qc_designer (resumo diário) + qc_reason
# (detalhe por tipo de pedido — Novo/Rescan/Modificação — para o drill-down
# de motivos de reprovação). Fonte: warehouse gms_quality_inspection (db
# 13371339), veredito result_code YES/NO + total_score 0-100, designer via
# solution_code → gms_design; tipo de pedido via order_id → gms_order.
# Uso: qc-feed.py            → D-1
#      qc-feed.py A [B]      → backfill do dia A até B (inclusive)
import sys, json, sqlite3, ssl, urllib.request, datetime
BIDB = "/var/lib/docker/volumes/shiftsync-bi_bi-data/_data/bi.db"
KEY = open("/opt/bi-compare/.mbkey").read().strip()
LOWER = set("de da do das dos e em a o na no ao aos com para por".split())

def mbq(sql, db=13371339):
    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    body = json.dumps({"database": db, "type": "native", "native": {"query": sql}}).encode()
    req = urllib.request.Request("https://metabase-brza.eainc.com/api/dataset", data=body,
        headers={"Content-Type": "application/json", "X-Api-Key": KEY})
    d = json.load(urllib.request.urlopen(req, timeout=180, context=ctx))
    cols = [c["name"] for c in d["data"]["cols"]]
    return [dict(zip(cols, r)) for r in d["data"]["rows"]]

def nameNorm(s):
    if not isinstance(s, str): return s
    s = s.replace("\xa0", " ").strip()
    L = [ch for ch in s if ch.isalpha()]
    if not L: return s
    if sum(1 for ch in L if ch.isupper()) / len(L) > 0.6:
        return " ".join((w[0].upper() + w[1:] if (i == 0 or w not in LOWER) and w else w) for i, w in enumerate(s.lower().split(" ")))
    return s

def feed_day(cur, D):
    nxt = (datetime.date.fromisoformat(D) + datetime.timedelta(days=1)).isoformat()
    rows = mbq(f"""
SELECT gte.name grp, gu.name designer, COUNT(*) insp,
  SUM(CASE WHEN gqi.total_score >= 80 THEN 1 ELSE 0 END) passed,
  SUM(CASE WHEN gqi.result_code = 'YES' THEN 1 ELSE 0 END) approved_yes,
  ROUND(AVG(gqi.total_score), 2) avg_score
FROM gms_quality_inspection gqi
JOIN gms_design gd ON gd.solution_code = gqi.solution_code
JOIN gms_user gu ON gu.account = gd.complete_user
JOIN gms_team gte ON gte.id = gu.team_id
WHERE gqi.created >= '{D} 00:00:00' AND gqi.created < '{nxt} 00:00:00'
  AND (gqi.is_deleted = 0 OR gqi.is_deleted IS NULL)
  AND gqi.total_score IS NOT NULL AND gqi.is_finished = 1
  AND gte.name LIKE 'BR-ATD-%'
GROUP BY gte.name, gu.name""")
    cur.execute("DELETE FROM qc_designer WHERE snapshot_date=?", (D,))
    for r in rows:
        cur.execute("INSERT INTO qc_designer (snapshot_date, group_no, designer_name, inspections, passed, approved_yes, avg_score) VALUES (?,?,?,?,?,?,?)",
                    (D, r["grp"], nameNorm(r["designer"]), int(r["insp"]), int(r["passed"] or 0), int(r["approved_yes"] or 0), r["avg_score"]))

    # Detalhe por tipo de pedido (drill-down de motivos de reprovação)
    reason_rows = mbq(f"""
SELECT gte.name grp, gu.name designer, go.order_type otype, COUNT(*) insp,
  SUM(CASE WHEN gqi.total_score >= 80 THEN 1 ELSE 0 END) passed
FROM gms_quality_inspection gqi
JOIN gms_order go ON go.id = gqi.order_id
JOIN gms_design gd ON gd.solution_code = gqi.solution_code
JOIN gms_user gu ON gu.account = gd.complete_user
JOIN gms_team gte ON gte.id = gu.team_id
WHERE gqi.created >= '{D} 00:00:00' AND gqi.created < '{nxt} 00:00:00'
  AND (gqi.is_deleted = 0 OR gqi.is_deleted IS NULL)
  AND gqi.total_score IS NOT NULL AND gqi.is_finished = 1
  AND gte.name LIKE 'BR-ATD-%' AND go.order_type IS NOT NULL
GROUP BY gte.name, gu.name, go.order_type""")
    cur.execute("DELETE FROM qc_reason WHERE snapshot_date=?", (D,))
    for r in reason_rows:
        cur.execute("INSERT INTO qc_reason (snapshot_date, group_no, designer_name, order_type, inspections, passed) VALUES (?,?,?,?,?,?)",
                    (D, r["grp"], nameNorm(r["designer"]), r["otype"], int(r["insp"]), int(r["passed"] or 0)))
    return len(rows)

con = sqlite3.connect(BIDB, timeout=60)
cur = con.cursor()
cur.execute("""CREATE TABLE IF NOT EXISTS qc_designer (
  id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_date TEXT NOT NULL,
  group_no TEXT, designer_name TEXT NOT NULL,
  inspections INTEGER NOT NULL, passed INTEGER NOT NULL, approved_yes INTEGER, avg_score REAL)""")
cur.execute("CREATE INDEX IF NOT EXISTS idx_qcd_date_name ON qc_designer(snapshot_date, designer_name)")
cur.execute("""CREATE TABLE IF NOT EXISTS qc_reason (
  id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_date TEXT NOT NULL,
  group_no TEXT, designer_name TEXT NOT NULL, order_type TEXT NOT NULL,
  inspections INTEGER NOT NULL, passed INTEGER NOT NULL)""")
cur.execute("CREATE INDEX IF NOT EXISTS idx_qcr_date_name ON qc_reason(snapshot_date, designer_name)")
cur.execute("CREATE INDEX IF NOT EXISTS idx_qcr_date_group ON qc_reason(snapshot_date, group_no)")

if len(sys.argv) >= 2:
    a = datetime.date.fromisoformat(sys.argv[1])
    b = datetime.date.fromisoformat(sys.argv[2]) if len(sys.argv) >= 3 else a
    d = a; total = 0
    while d <= b:
        n = feed_day(cur, d.isoformat()); con.commit()
        total += n
        if n: print(f"  {d}: {n} designers")
        d += datetime.timedelta(days=1)
    print(f"GRAVADO: QC backfill {a}..{b} ({total} linhas).")
else:
    D = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    n = feed_day(cur, D); con.commit()
    print(f"GRAVADO: QC {D} ({n} designers).")
con.close()

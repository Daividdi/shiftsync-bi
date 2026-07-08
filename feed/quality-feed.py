#!/usr/bin/env python3
# Qualidade (nota dos médicos) → bi.db quality_designer/quality_batch — automático.
# Fórmula oficial (card 207): nota = SUM(rate)/COUNT(DISTINCT solution_code);
# baixas = casos distintos com rate<=6; unfit = fit_preference='2'.
# Uso: quality-feed.py                → semanas correntes (3) + mês corrente e anterior
#      quality-feed.py 2026-01-01    → backfill de semanas/meses desde a data
import sys, json, sqlite3, ssl, urllib.request, datetime
BIDB = "/var/lib/docker/volumes/shiftsync-bi_bi-data/_data/bi.db"
KEY = open("/opt/bi-compare/.mbkey").read().strip()
LOWER = set("de da do das dos e em a o na no ao aos com para por".split())
TILDE = "～"

def mbq(sql, db=13371338):
    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    body = json.dumps({"database": db, "type": "native", "native": {"query": sql}}).encode()
    req = urllib.request.Request("https://metabase-brza.eainc.com/api/dataset", data=body,
        headers={"Content-Type": "application/json", "X-Api-Key": KEY})
    d = json.load(urllib.request.urlopen(req, timeout=180, context=ctx))
    if not d.get("data"): raise RuntimeError("MB: " + json.dumps(d.get("error"))[:300])
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

DETAIL = """WITH detail AS (
  SELECT u.name designer, te.name team, gdl.code level_code,
         gdr.rate, gdr.fit_preference, gd.solution_code
  FROM gms_design_rate gdr
  JOIN gms_design gd ON gd.solution_code = gdr.solution_code
  JOIN gms_user u ON u.account = gd.complete_user
  JOIN gms_team te ON te.id = u.team_id
  LEFT JOIN gms_designer_level gdl ON gdl.id = u.designer_level_id
  WHERE gd.status != 'CONFIRMED' AND gdr.msg_time IS NOT NULL AND gd.iortho_solution_name != ''
    AND te.name LIKE 'BR%%'
    AND gdr.msg_time >= '%s 00:00:00' AND gdr.msg_time < '%s 00:00:00'
)"""

def fetch_period(a, b):
    des = mbq(DETAIL % (a, b) + """
SELECT team, designer, level_code,
  SUM(rate)/NULLIF(COUNT(DISTINCT solution_code),0) avg_score,
  COUNT(DISTINCT solution_code) qty,
  COUNT(DISTINCT CASE WHEN rate <= 6 THEN solution_code END) low,
  COUNT(DISTINCT CASE WHEN fit_preference = '2' THEN solution_code END) unfit
FROM detail GROUP BY team, designer, level_code""")
    bat = mbq(DETAIL % (a, b) + """
SELECT COALESCE(level_code, 'TOTAL') pos, SUM(rate)/NULLIF(COUNT(DISTINCT solution_code),0) avg_score
FROM detail GROUP BY level_code
UNION ALL
SELECT 'TOTAL', SUM(rate)/NULLIF(COUNT(DISTINCT solution_code),0) FROM detail""")
    return des, bat

def write_period(cur, snap, ptype, label, des, bat):
    if not des: return 0
    cur.execute("DELETE FROM uploads WHERE snapshot_date=? AND file_type=?", (snap, f"quality_{ptype}_designer"))
    cur.execute("DELETE FROM quality_designer WHERE snapshot_date=? AND period_type=? AND upload_id NOT IN (SELECT id FROM uploads)", (snap, ptype))
    cur.execute("DELETE FROM quality_batch WHERE snapshot_date=? AND period_type=? AND upload_id NOT IN (SELECT id FROM uploads)", (snap, ptype))
    cur.execute("DELETE FROM deleted_snapshots WHERE snapshot_date=? AND file_type=?", (snap, f"quality_{ptype}_designer"))
    cur.execute("INSERT INTO uploads (snapshot_date, filename, file_type) VALUES (?,?,?)", (snap, "auto-doris-quality", f"quality_{ptype}_designer"))
    uid = cur.lastrowid
    for r in des:
        qty = int(r["qty"] or 0)
        low = int(r["low"] or 0); unfit = int(r["unfit"] or 0)
        cur.execute("""INSERT INTO quality_designer
          (upload_id,snapshot_date,period_type,period_label,group_no,position,username,designer_name,
           avg_score,prop_low_score,prop_unfit,score_qty,qty_low_score,qty_unfit)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
          (uid, snap, ptype, label, r["team"], r["level_code"], None, nameNorm(r["designer"]),
           round(r["avg_score"], 6) if r["avg_score"] is not None else None,
           round(low / qty, 6) if qty else None, round(unfit / qty, 6) if qty else None,
           qty, low, unfit))
    for r in bat:
        if r.get("pos") is None: continue
        cur.execute("INSERT INTO quality_batch (upload_id,snapshot_date,period_type,period_label,position_name,avg_score) VALUES (?,?,?,?,?,?)",
                    (uid, snap, ptype, label, r["pos"], round(r["avg_score"], 6) if r["avg_score"] is not None else None))
    return len(des)

def week_bounds(day):
    mon = day - datetime.timedelta(days=day.weekday())
    return mon, mon + datetime.timedelta(days=6)

def do_week(cur, day):
    mon, sun = week_bounds(day)
    iy, iw, _ = mon.isocalendar()
    label = f"{iy}w{iw}({mon.strftime('%m%d')}{TILDE}{sun.strftime('%m%d')})"
    des, bat = fetch_period(mon.isoformat(), (sun + datetime.timedelta(days=1)).isoformat())
    n = write_period(cur, sun.isoformat(), "week", label, des, bat)
    if n: print(f"  semana {label}: {n} designers")
    return n

def do_month(cur, y, m):
    a = datetime.date(y, m, 1)
    b = datetime.date(y + (m == 12), (m % 12) + 1, 1)
    snap = (b - datetime.timedelta(days=1)).isoformat()
    des, bat = fetch_period(a.isoformat(), b.isoformat())
    n = write_period(cur, snap, "month", f"{y}{m:02d}", des, bat)
    if n: print(f"  mes {y}{m:02d}: {n} designers")
    return n

con = sqlite3.connect(BIDB, timeout=60)
cur = con.cursor()
today = datetime.date.today()
if len(sys.argv) >= 2:
    start = datetime.date.fromisoformat(sys.argv[1])
    d, _ = week_bounds(start)
    while d <= today:
        do_week(cur, d); con.commit()
        d += datetime.timedelta(days=7)
    y, m = start.year, start.month
    while (y, m) <= (today.year, today.month):
        do_month(cur, y, m); con.commit()
        m += 1
        if m > 12: y, m = y + 1, 1
    print("backfill concluido")
else:
    for k in (14, 7, 0):
        do_week(cur, today - datetime.timedelta(days=k)); con.commit()
    pm = today.replace(day=1) - datetime.timedelta(days=1)
    do_month(cur, pm.year, pm.month); con.commit()
    do_month(cur, today.year, today.month); con.commit()
    print("GRAVADO: qualidade (3 semanas + 2 meses).")
con.close()

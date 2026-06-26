const express = require("express");
const https = require("https");
const router = express.Router();

const KEY = process.env.MB_API_KEY || "";
const HOST = "metabase-brza.eainc.com";
const DESIGN_DB = 13371341;
const agent = new https.Agent({ rejectUnauthorized: false }); // cert self-signed interno

function mb(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ database: DESIGN_DB, type: "native", native: { query: sql } });
    const req = https.request({ host: HOST, path: "/api/dataset", method: "POST", agent,
      headers: { "Content-Type": "application/json", "X-Api-Key": KEY, "Content-Length": Buffer.byteLength(body) } },
      r => { let d=""; r.on("data",c=>d+=c); r.on("end",()=>{ try{ const j=JSON.parse(d);
        if(!j.data) return reject(new Error("MB:"+JSON.stringify(j.error).slice(0,200)));
        const cols=j.data.cols.map(c=>c.name);
        resolve(j.data.rows.map(row=>Object.fromEntries(row.map((v,i)=>[cols[i],v])))); }catch(e){reject(e);} }); });
    req.on("error", reject); req.setTimeout(60000, ()=>req.destroy(new Error("timeout"))); req.write(body); req.end();
  });
}
const brts = s => (typeof s==="string" ? s.replace(/Z$/,"-03:00") : s);
const LOWER = new Set(["de","da","do","das","dos","e","em","a","o","na","no","ao","aos","com","para","por"]);
function nameNorm(s){ if(typeof s!=="string") return s; s=s.replace(/ /g," ").trim();
  const L=s.replace(/[^a-zA-ZÀ-ÿ]/g,""); if(!L) return s;
  const u=(L.match(/[A-ZÀ-Þ]/g)||[]).length;
  if(u/L.length>0.6) return s.toLowerCase().split(" ").map((w,i)=>(i===0||!LOWER.has(w))&&w?w[0].toUpperCase()+w.slice(1):w).join(" ");
  return s; }

const TODAY = "completed >= DATE(NOW() - INTERVAL 3 HOUR)";
const ACT = "'INITIAL','ALLOCATED','EXECUTING','REVIEWING','REVIEWING_CONFIRM','PAUSED'";

router.get("/board", async (_req, res) => {
  try {
    const [live, designers, teamsProg, pending, byType, quality] = await Promise.all([
      mb(`SELECT team_name grp, COUNT(*) casos, ROUND(SUM(completed_task_num),2) pontos, COUNT(DISTINCT assignee_account) designers, MAX(completed) ultimo
          FROM dwd_task_wide_br WHERE ${TODAY} AND team_name LIKE 'BR-ATD-%' AND completed_task_num>0 GROUP BY team_name ORDER BY casos DESC`),
      mb(`SELECT u.name designer, t.name grp, dl.code nivel,
            ROUND(c.completed,2) completed, ROUND(q.user_quota,2) total,
            ROUND(c.completed/NULLIF(q.user_quota,0)*100,1) progress
          FROM user_quota_all_date_br q JOIN gms_user u ON u.id=q.id JOIN gms_team t ON t.id=u.team_id
            LEFT JOIN gms_designer_level dl ON dl.id=u.designer_level_id
            JOIN (SELECT assignee_name, ROUND(SUM(completed_task_num),4) completed FROM dwd_task_wide_br
                  WHERE ${TODAY} AND team_name LIKE 'BR-ATD-%' AND completed_task_num>0 GROUP BY assignee_name) c ON c.assignee_name=u.name
          WHERE q.date=DATE(NOW()-INTERVAL 3 HOUR) AND t.name LIKE 'BR-ATD-%' AND q.user_quota>0 AND c.completed>0
          ORDER BY c.completed DESC`),
      mb(`SELECT t.name grp, ROUND(SUM(COALESCE(c.completed,0)),2) completed, ROUND(SUM(q.user_quota),2) total,
            ROUND(SUM(COALESCE(c.completed,0))/NULLIF(SUM(q.user_quota),0)*100,1) progress
          FROM user_quota_all_date_br q JOIN gms_user u ON u.id=q.id JOIN gms_team t ON t.id=u.team_id
            LEFT JOIN (SELECT assignee_name, SUM(completed_task_num) completed FROM dwd_task_wide_br
                       WHERE ${TODAY} AND team_name LIKE 'BR-ATD-%' AND completed_task_num>0 GROUP BY assignee_name) c ON c.assignee_name=u.name
          WHERE q.date=DATE(NOW()-INTERVAL 3 HOUR) AND t.name LIKE 'BR-ATD-%' AND q.user_quota>0
          GROUP BY t.name ORDER BY t.name`),
      mb(`SELECT team_name grp, COUNT(*) aberto,
            SUM(CASE WHEN DATE(deadline)=DATE(NOW()-INTERVAL 3 HOUR) THEN 1 ELSE 0 END) vence_hoje,
            SUM(CASE WHEN DATE(deadline)<DATE(NOW()-INTERVAL 3 HOUR) THEN 1 ELSE 0 END) atrasado
          FROM dwd_task_wide_br WHERE team_name LIKE 'BR-ATD-%' AND status IN (${ACT}) GROUP BY team_name ORDER BY team_name`),
      mb(`SELECT CASE WHEN type_code IN ('executeFullDesign','executeDesignTargetPosition') THEN 'novo'
                      WHEN type_code IN ('executeArrangeSteps','executeDesignSubStep') THEN 'refinamento'
                      WHEN type_code='executeFullDesignModification' THEN 'modificacao' ELSE 'outro' END tipo, COUNT(*) qtd
          FROM dwd_task_wide_br WHERE ${TODAY} AND team_name LIKE 'BR-ATD-%' AND completed_task_num>0 GROUP BY tipo`),
      mb(`SELECT te.name grp, ROUND(AVG(gdr.rate),2) nps, COUNT(DISTINCT gd.solution_code) qty
          FROM gms_design_rate gdr JOIN gms_design gd ON gd.solution_code=gdr.solution_code JOIN gms_user u ON u.account=gd.complete_user JOIN gms_team te ON te.id=u.team_id
          WHERE gd.status!='CONFIRMED' AND gdr.msg_time IS NOT NULL AND gd.iortho_solution_name!=''
            AND gdr.msg_time >= DATE_SUB(DATE(NOW()-INTERVAL 3 HOUR),INTERVAL 7 DAY) AND te.name LIKE 'BR-ATD-%' GROUP BY te.name ORDER BY te.name`),
    ]);
    const bt={novo:0,refinamento:0,modificacao:0,outro:0}; byType.forEach(r=>bt[r.tipo]=+r.qtd);
    const lvSum={}, lvCnt={};
    designers.forEach(x=>{ const k=x.grp+"|"+x.nivel; lvSum[k]=(lvSum[k]||0)+(+x.progress||0); lvCnt[k]=(lvCnt[k]||0)+1; });
    res.json({
      ts: new Date().toISOString(),
      teams: live.map(r=>({ ...r, ultimo: brts(r.ultimo) })),
      designers: designers.map(r=>({ ...r, designer: nameNorm(r.designer),
        media: lvCnt[r.grp+"|"+r.nivel] ? Math.round(lvSum[r.grp+"|"+r.nivel]/lvCnt[r.grp+"|"+r.nivel]*10)/10 : null })),
      teamsProgress: teamsProg,
      pending, byType: bt, quality,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

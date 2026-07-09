import React, { useEffect, useState } from "react";
import api from "../api";
import { T, progColor, scoreColor, ATD_PREFIX, gridCols } from "../theme";

function fmtDateFull(d) {
  if (!d) return "";
  const [year, m, day] = d.split("-");
  const dt = new Date(`${year}-${m}-${day}T12:00:00`);
  const dow = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][dt.getDay()];
  return `${dow}, ${day}/${m}/${year}`;
}
function fmtWeek(d) {
  if (!d) return "";
  const [year, m, day] = d.split("-");
  const end = new Date(`${year}-${m}-${day}T12:00:00`);
  const start = new Date(end); start.setDate(end.getDate() - 6);
  const sm = String(start.getMonth() + 1).padStart(2, "0");
  const sd = String(start.getDate()).padStart(2, "0");
  return `${sd}–${day}/${m}/${year}`;
}

function StatusBadge({ value, thresholds = [0.8, 0.6] }) {
  const labels = ["On Track", "At Risk", "Behind"];
  const colors = [T.green, T.yellow, T.red];
  const idx = value >= thresholds[0] ? 0 : value >= thresholds[1] ? 1 : 2;
  const c = colors[idx];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: c + "18", border: `1px solid ${c}44`, borderRadius: 20, padding: "5px 14px", width: "fit-content" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 10px ${c}` }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: c, letterSpacing: 0.8 }}>{labels[idx]}</span>
    </div>
  );
}

function ScoreStatusBadge({ value }) {
  const label = value >= 9 ? "Excelente" : value >= 8.5 ? "Bom" : value >= 8.3 ? "Regular" : "Atenção";
  const c = scoreColor(value);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: c + "18", border: `1px solid ${c}44`, borderRadius: 20, padding: "5px 14px", width: "fit-content" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 10px ${c}` }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: c, letterSpacing: 0.8 }}>{label}</span>
    </div>
  );
}

function HeroCard({ label, value, unit, subtitle, color, badge, bar, delta }) {
  const fillPct = bar != null ? Math.min(100, bar * 100) : 0;
  return (
    <div style={{
      background: `linear-gradient(145deg, T.border, T.bgControl)`,
      border: `1px solid ${color}55`, borderRadius: 18,
      padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 8,
      position: "relative", overflow: "hidden",
      boxShadow: `0 0 60px ${color}1a, 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 T.border`,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${color}66, transparent)` }} />
      {bar != null && (
        <>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: T.bgControl }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, height: 4,
            width: `${fillPct.toFixed(1)}%`,
            background: `linear-gradient(90deg, ${color}, ${color}88)`,
            transition: "width 1.5s ease",
            boxShadow: `0 0 12px ${color}99`,
          }} />
        </>
      )}
      <div style={{ fontSize: 11, color: T.t5, textTransform: "uppercase", letterSpacing: 2 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
        <div style={{ fontSize: 52, fontWeight: 900, color, lineHeight: 1, letterSpacing: -2, textShadow: `0 0 40px ${color}55` }}>{value ?? "—"}</div>
        {unit && <div style={{ fontSize: 18, fontWeight: 700, color: color + "88", paddingBottom: 6 }}>{unit}</div>}
        {delta != null && (
          <div style={{ fontSize: 13, fontWeight: 700, color: delta > 0 ? T.green : T.red, paddingBottom: 6, marginLeft: 4 }}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
          </div>
        )}
      </div>
      {badge}
      {subtitle && <div style={{ fontSize: 12, color: T.t4, marginTop: 1, lineHeight: 1.4 }}>{subtitle}</div>}
    </div>
  );
}

function DimPanel({ label, color, value, valueLabel, barFill, barTarget, line1, line2, deltaLabel, deltaPositive }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, overflow: "hidden",
      background: `${color}16`, border: `1px solid ${color}44`,
      borderRadius: 4, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6,
      boxShadow: `inset 0 1px 0 ${color}22`,
    }}>
      <div style={{ fontSize: 11, color: T.t5, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, flexShrink: 0 }}>{label}</div>

      {/* Big value */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 3, flexShrink: 0 }}>
        <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1, textShadow: `0 0 20px ${color}55` }}>
          {value ?? "—"}
        </div>
        {valueLabel && <span style={{ fontSize: 13, fontWeight: 600, color: color + "88" }}>{valueLabel}</span>}
      </div>

      {/* Stacked bars: actual + target reference */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
        <div style={{ background: T.bgControl, borderRadius: 4, overflow: "hidden", height: 6 }}>
          <div style={{
            width: `${Math.min(100, barFill * 100).toFixed(1)}%`, height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}88)`,
            transition: "width 1.5s ease", boxShadow: `0 0 10px ${color}66`,
          }} />
        </div>
        <div style={{ position: "relative", height: 3, background: T.bgControl, borderRadius: 2 }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${(barTarget * 100).toFixed(1)}%`,
            background: "T.borderBright", borderRadius: 2,
          }} />
          <div style={{
            position: "absolute", top: -2, bottom: -2,
            left: `calc(${(barTarget * 100).toFixed(1)}% - 1px)`,
            width: 2, background: T.yellow, borderRadius: 1,
          }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ fontSize: 12, color: T.t3, lineHeight: 1.5, overflow: "hidden" }}>
        {line1 && <div style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{line1}</div>}
        {line2 && <div style={{ color: T.t4, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{line2}</div>}
      </div>

      {/* Delta vs target */}
      {deltaLabel != null && (
        <div style={{
          marginTop: "auto", display: "flex", alignItems: "center", gap: 4,
          background: deltaPositive ? `${T.green}14` : `${T.red}14`,
          border: `1px solid ${deltaPositive ? T.green : T.red}33`,
          borderRadius: 8, padding: "4px 8px", flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: T.t5 }}>vs meta</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: deltaPositive ? T.green : T.red, marginLeft: "auto" }}>
            {deltaPositive ? "+" : ""}{deltaLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, progress, totalCompleted, totalQuota, totalUncompleted, activeCount,
                     avg_score, total_scored, rate_low_score }) {
  const pc = progColor(progress);
  const sc = scoreColor(avg_score);
  const name = group.replace("BR-ATD-", "");

  const prodDelta = progress != null ? ((progress - 0.8) * 100).toFixed(1) : null;
  const qualDelta = avg_score != null ? (avg_score - 8.3).toFixed(2) : null;

  return (
    <div style={{
      background: T.bgControl, border: `1px solid T.borderControl`,
      borderRadius: 18, padding: "14px 14px", display: "flex", flexDirection: "column", gap: 8,
      overflow: "hidden", minWidth: 0,
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: T.t1 }}>{name}</span>
        {activeCount != null && (
          <span style={{ fontSize: 13, color: T.t5, background: T.bgControl, borderRadius: 10, padding: "3px 10px" }}>
            {activeCount} ativos
          </span>
        )}
      </div>

      {/* Two dimension panels */}
      <div style={{ display: "flex", gap: 10, flex: 1 }}>
        <DimPanel
          label="Prod."
          color={pc}
          value={progress != null ? `${(progress * 100).toFixed(1)}%` : null}
          barFill={progress ?? 0}
          barTarget={0.8}
          line1={`${Math.round(totalCompleted || 0)} / ${Math.round(totalQuota || 0)} casos`}
          line2={totalUncompleted > 0 ? `${Math.round(totalUncompleted)} pendentes` : "Sem pendências"}
          deltaLabel={prodDelta != null ? `${prodDelta}%` : null}
          deltaPositive={progress >= 0.8}
        />
        <DimPanel
          label="Qual."
          color={sc}
          value={avg_score != null ? avg_score.toFixed(2) : null}
          valueLabel="/10"
          barFill={avg_score != null ? avg_score / 10 : 0}
          barTarget={0.83}
          line1={`${total_scored || 0} avaliados`}
          line2={rate_low_score != null ? `${(rate_low_score * 100).toFixed(1)}% score ≤6` : null}
          deltaLabel={qualDelta}
          deltaPositive={avg_score >= 8.3}
        />
      </div>
    </div>
  );
}

export default function OverviewScreen() {
  const [atdProd, setAtdProd] = useState(null);
  const [atpProd, setAtpProd] = useState(null);
  const [quality, setQuality] = useState(null);
  const [groups, setGroups] = useState([]);
  const [qGroups, setQGroups] = useState([]);
  const [refreshedAt, setRefreshedAt] = useState("");

  async function load() {
    try {
      const [a, b, q, g, qg] = await Promise.all([
        api.get("/metrics/productivity/today?groupType=atd"),
        api.get("/metrics/productivity/today?groupType=atp"),
        api.get("/quality/summary"),
        api.get("/metrics/productivity/groups"),
        api.get("/quality/groups?period=week"),
      ]);
      setAtdProd(a.data);
      setAtpProd(b.data);
      setQuality(q.data);
      setGroups((g.data.groups || []).filter(x => x.group?.startsWith(ATD_PREFIX)));
      setQGroups((qg.data.groups || []).filter(x => x.group?.startsWith(ATD_PREFIX)));
      setRefreshedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) { console.error(e); }
  }

  useEffect(() => { load(); const t = setInterval(load, 10 * 60 * 1000); return () => clearInterval(t); }, []);

  const atdT = atdProd?.today;
  const atdY = atdProd?.yesterday;
  const atpT = atpProd?.today;
  const atpY = atpProd?.yesterday;
  const weekQ = quality?.week;
  const monthQ = quality?.month;
  const atdDate = atdProd?.latestDate;

  const atdPct = atdT?.progress;
  const atpPct = atpT?.progress;
  const qualScore = weekQ?.total_avg_score;

  const noData = !atdT && !weekQ;

  const mergedGroups = groups.map(g => {
    const qg = qGroups.find(q => q.group === g.group);
    return {
      ...g,
      avg_score: qg?.avg_score,
      total_scored: qg?.total_scored,
      rate_low_score: qg?.rate_low_score,
      rate_unfit: qg?.rate_unfit,
    };
  });

  const prodBehind  = mergedGroups.filter(g => g.progress != null && g.progress < 0.6);
  const qualAtRisk  = mergedGroups.filter(g => g.avg_score != null && g.avg_score < 8.3);
  const statusIssues = [
    ...(prodBehind.length  ? [`${prodBehind.length} grupo${prodBehind.length > 1 ? "s" : ""} prod < 60%`] : []),
    ...(qualAtRisk.length  ? [`${qualAtRisk.length} grupo${qualAtRisk.length > 1 ? "s" : ""} qualidade < 8.3`] : []),
    ...(weekQ?.rate_low_score > 0.1 ? [`score ≤6: ${(weekQ.rate_low_score * 100).toFixed(1)}%`] : []),
    ...(weekQ?.rate_unfit > 0.08   ? [`unfit: ${(weekQ.rate_unfit * 100).toFixed(1)}%`] : []),
  ];
  const cols = gridCols(Math.max(mergedGroups.length, 1));

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "18px 32px 72px", gap: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 42, fontWeight: 900, color: T.t1, letterSpacing: -1.5, textWrap: 'balance' }}>Visão Geral</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {atdDate && (
            <div style={{ fontSize: 14, fontWeight: 600, color: T.t2, background: T.bgControl, padding: "8px 20px", borderRadius: 20, border: `1px solid ${T.borderControl}`, boxShadow: T.pillShadow }}>
              Prod. {fmtDateFull(atdDate)}
            </div>
          )}
          {weekQ?.date && (
            <div style={{ fontSize: 14, fontWeight: 600, color: T.t2, background: T.bgControl, padding: "8px 20px", borderRadius: 20, border: `1px solid ${T.borderControl}`, boxShadow: T.pillShadow }}>
              Qual. Semana {fmtWeek(weekQ.date)}
            </div>
          )}
          {refreshedAt && (
            <div style={{ fontSize: 12, color: T.t5, background: T.bgControl, padding: "6px 14px", borderRadius: 20, border: `1px solid ${T.border}` }}>
              ↻ {refreshedAt}
            </div>
          )}
        </div>
      </div>

      {noData ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.t5, fontSize: 20 }}>
          Aguardando dados — faça upload para iniciar
        </div>
      ) : (
        <>
          {/* Hero cards — compact row at top */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, flexShrink: 0 }}>
            <HeroCard
              label="ATD · Produtividade (hoje)"
              value={atdPct != null ? (atdPct * 100).toFixed(1) : "—"}
              unit="%"
              color={T.blue}
              badge={atdPct != null ? <StatusBadge value={atdPct} /> : null}
              subtitle={`${Math.round(atdT?.totalCompleted || 0)} / ${Math.round(atdT?.totalQuota || 0)} casos · ${atdT?.activeCount || 0} designers`}
              bar={atdPct}
              delta={atdY?.progress != null && atdPct != null ? atdPct - atdY.progress : null}
            />
            <HeroCard
              label="ATD · Qualidade (semana)"
              value={qualScore != null ? qualScore.toFixed(2) : "—"}
              unit="/10"
              color={T.green}
              badge={qualScore != null ? <ScoreStatusBadge value={qualScore} /> : null}
              subtitle={weekQ ? `${weekQ.total_scored || 0} casos · ≤6: ${weekQ.rate_low_score != null ? (weekQ.rate_low_score * 100).toFixed(1) + "%" : "—"}${monthQ?.total_avg_score != null ? " · Mês: " + monthQ.total_avg_score.toFixed(2) : ""}` : null}
              bar={qualScore ? qualScore / 10 : null}
            />
            <HeroCard
              label="ATP · Produtividade (hoje)"
              value={atpPct != null ? (atpPct * 100).toFixed(1) : "—"}
              unit="%"
              color={T.orange}
              badge={atpPct != null ? <StatusBadge value={atpPct} /> : null}
              subtitle={`${Math.round(atpT?.totalCompleted || 0)} / ${Math.round(atpT?.totalQuota || 0)} casos · ${atpT?.activeCount || 0} designers`}
              bar={atpPct}
              delta={atpY?.progress != null && atpPct != null ? atpPct - atpY.progress : null}
            />
          </div>

          {/* ATD group cards — center of page, full width */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: T.t5, textTransform: "uppercase", letterSpacing: 2.5, flexShrink: 0 }}>
              Grupos ATD — Saúde por Dimensão
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
              {mergedGroups.length === 0 ? (
                <div style={{ color: T.t5, fontSize: 15 }}>Sem dados de grupos</div>
              ) : (
                mergedGroups.map(g => (
                  <GroupCard
                    key={g.group}
                    group={g.group}
                    progress={g.progress}
                    totalCompleted={g.totalCompleted}
                    totalQuota={g.totalQuota}
                    totalUncompleted={g.totalUncompleted}
                    activeCount={g.activeCount}
                    avg_score={g.avg_score}
                    total_scored={g.total_scored}
                    rate_low_score={g.rate_low_score}
                  />
                ))
              )}
            </div>
          </div>

          {!noData && (
            statusIssues.length === 0 ? (
              <div style={{ flexShrink: 0, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10, padding: "9px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, boxShadow: `0 0 10px ${T.green}`, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: T.green }}>Todos os grupos dentro da meta</span>
              </div>
            ) : (
              <div style={{ flexShrink: 0, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "9px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: T.red, boxShadow: `0 0 10px ${T.red}`, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#fca5a5" }}>{statusIssues.join("  ·  ")}</span>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

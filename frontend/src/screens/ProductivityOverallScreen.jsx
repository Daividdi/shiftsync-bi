import React, { useEffect, useState } from "react";
import api from "../api";
import PeriodSelector from "../components/PeriodSelector";
import ProgressBar from "../components/ProgressBar";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, LabelList,
} from "recharts";
import { T, progColor, ATD_PREFIX, GROUP_COLORS, gridCols } from "../theme";

function fmtDateFull(d) {
  if (!d) return "";
  const [year, m, day] = d.split("-");
  const dt = new Date(`${year}-${m}-${day}T12:00:00`);
  const dow = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][dt.getDay()];
  return `${dow}, ${day}/${m}/${year}`;
}

const SHORT  = g => g.replace("BR-ATD-", "");
const SHORT2 = g => g.replace("BR-ATD-", "");
const fmtD   = d => { const p = d.split("-"); return `${p[2]}/${p[1]}`; };
const MEDAL  = ["#ffd700", "#c0c0c0", "#cd7f32"];

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: T.cardShadow }}>
      <div style={{ color: T.t4, marginBottom: 5, fontWeight: 700 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ color: T.t3 }}>{p.name}:</span>
          <span style={{ color: T.t1, fontWeight: 700 }}>{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

export default function ProductivityOverallScreen() {
  const [groups, setGroups]           = useState([]);
  const [groupsTrend, setGroupsTrend] = useState([]);
  const [top3, setTop3]               = useState([]);
  const [latestDate, setLatestDate]   = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");
  const [availDates, setAvailDates]   = useState([]);
  const [selDate, setSelDate]         = useState(null);
  const [monthSummary, setMonthSummary] = useState(null);
  const [monthMode, setMonthMode] = useState(false); // false => D-1 + Semanal; true => Mês consolidado

  useEffect(() => {
    api.get("/metrics/productivity/available-dates").then(({ data }) => {
      setAvailDates(data.dates || []);
      if (!selDate && data.dates[0]) setSelDate(data.dates[0]);
    }).catch(() => {});
  }, []);

  async function load() {
    try {
      const dateQ = selDate ? `?date=${selDate}` : "";
      const dateA = selDate ? `&date=${selDate}` : "";
      const monthQ = selDate ? `?month=${selDate.slice(0, 7)}` : "";
      const [gd, tr, td1, ms] = await Promise.all([
        api.get(`/metrics/productivity/groups${dateQ}`),
        api.get("/metrics/productivity/groups/trend?days=12"),
        api.get(`/metrics/productivity/top-by-group?n=3${dateA}`),
        api.get(`/metrics/productivity/month-summary${monthQ}`),
      ]);
      setGroups((gd.data.groups || []).filter(g => g.group?.startsWith(ATD_PREFIX)));
      setGroupsTrend((tr.data || []).filter(g => g.group?.startsWith(ATD_PREFIX)));
      setTop3((td1.data.groups || []).filter(g => g.group?.startsWith(ATD_PREFIX)));
      setMonthSummary(ms.data || null);
      setLatestDate(gd.data.date || "");
      setRefreshedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (selDate) load();
  }, [selDate]);

  useEffect(() => {
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const noData = groups.length === 0;

  // D-1
  const totalQ     = groups.reduce((s, g) => s + g.totalQuota, 0);
  const totalC     = groups.reduce((s, g) => s + g.totalCompleted, 0);
  const overallProg = totalQ > 0 ? totalC / totalQ : null;
  const totalDelta  = Math.round(totalC - totalQ);
  const c_overall   = progColor(overallProg);

  const validGroups = groups.filter(g => g.activeCount > 0);
  const totalDesigners = validGroups.reduce((s, g) => s + g.activeCount, 0);

  const avgQuotaRef = validGroups.length > 0
    ? Math.round(validGroups.reduce((s, g) => s + g.totalQuota / g.activeCount, 0) / validGroups.length)
    : null;

  // Semanal — uploads da semana calendário de selDate (segunda → selDate)
  const allDates = [...new Set(groupsTrend.flatMap(g => g.trend.map(t => t.date)))].sort();
  const weeklyDates = (() => {
    const ref = selDate || latestDate;
    if (!ref) return allDates.slice(-5);
    const dt = new Date(ref + "T12:00:00");
    const dow = dt.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(dt); mon.setDate(dt.getDate() + diff);
    const weekStart = mon.toISOString().slice(0, 10);
    const filtered = allDates.filter(d => d >= weekStart && d <= ref);
    return filtered.length > 0 ? filtered : allDates.slice(-1); // fallback to at least 1 day
  })();
  let weeklyQ = 0, weeklyC = 0;
  groupsTrend.forEach(g => {
    g.trend.filter(t => weeklyDates.includes(t.date)).forEach(t => {
      weeklyQ += t.totalQuota    || 0;
      weeklyC += t.totalCompleted || 0;
    });
  });
  const weeklyProg  = weeklyQ > 0 ? weeklyC / weeklyQ : null;
  const weeklyDelta = Math.round(weeklyC - weeklyQ);
  const c_weekly    = progColor(weeklyProg);
  // Week range label
  const weekLabel = weeklyDates.length > 0
    ? (() => {
        const [, m0, d0] = weeklyDates[0].split("-");
        const [, m1, d1] = weeklyDates.at(-1).split("-");
        return weeklyDates.length === 1 ? `${d0}/${m0}` : `${d0}/${m0}–${d1}/${m1}`;
      })()
    : "";

  // Mensal — agregado do mês inteiro (todos os dias com dados)
  const mSum       = monthSummary?.summary || null;
  const monthProg  = mSum?.progress ?? null;
  const monthC     = mSum?.totalCompleted || 0;
  const monthQ     = mSum?.totalQuota || 0;
  const monthDelta = Math.round(monthC - monthQ);
  const monthDays  = monthSummary?.days || 0;
  const c_month    = progColor(monthProg);
  const monthLabel = (() => {
    const m = monthSummary?.month || (selDate || latestDate || "").slice(0, 7);
    if (!m) return "";
    const [y, mo] = m.split("-");
    return new Date(+y, +mo - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
  })();

  // Quota vs Entregue por grupo (barras)
  const quotaVsData = groups.map(g => ({
    name:     SHORT2(g.group),
    group:    g.group,
    quota:    Math.round(g.totalQuota),
    entregue: Math.round(g.totalCompleted),
    pendente: Math.round(g.totalUncompleted || 0),
  }));

  // Avg Tasks/Dia trend
  const avgTasksData = allDates.map(date => {
    const row = { date: fmtD(date) };
    groupsTrend.forEach(g => {
      const t = g.trend.find(t => t.date === date);
      if (t?.avgCompleted != null) row[g.group] = +t.avgCompleted.toFixed(1);
    });
    return row;
  });

  const nCols = gridCols(Math.max(top3.length, 1));
  const topGroupId = [...groups].sort((a, b) => (b.progress || 0) - (a.progress || 0))[0]?.group;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "14px 28px", gap: 10, overflow: "hidden" }}>
      <style>{`@keyframes pulse-prod { 0%,100% { box-shadow: 0 0 0 0 var(--pc,rgba(0,0,0,0.3)); } 60% { box-shadow: 0 0 0 5px transparent; } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 38, fontWeight: 900, color: T.t1, letterSpacing: -1.5, textWrap: "balance" }}>
          Produtividade Geral
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PeriodSelector dates={availDates} selectedDate={selDate} onDateChange={setSelDate} periodType="day" />
          <button onClick={() => setMonthMode(m => !m)} style={{
            background: monthMode ? "rgba(59,130,246,0.18)" : T.bgControl,
            border: `1px solid ${monthMode ? "#3b82f6aa" : T.borderControl}`,
            borderRadius: 9, padding: "7px 16px",
            color: monthMode ? "#3b82f6" : T.t3,
            fontSize: 13, fontWeight: monthMode ? 800 : 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>Mês consolidado</button>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.t2, background: T.bgControl, padding: "8px 20px", borderRadius: 20, border: `1px solid ${T.borderControl}`, boxShadow: T.pillShadow }}>
            {monthMode ? `Mês · ${monthLabel}${monthDays ? ` · ${monthDays} dias` : ""}` : (latestDate ? `D-1 · ${fmtDateFull(latestDate)}` : "Sem dados")}
            {refreshedAt && <span style={{ color: T.t5, fontSize: 12, marginLeft: 8 }}>↻ {refreshedAt}</span>}
          </div>
        </div>
      </div>

      {noData ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.t5, fontSize: 17 }}>
          Faça upload do arquivo de produtividade para visualizar
        </div>
      ) : (
        <>
          {monthMode ? (
            /* Mês consolidado — hero único */
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 24px", boxShadow: `${T.cardShadow}, 0 0 40px ${c_month}0d`, position: "relative", overflow: "hidden", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${c_month}cc, transparent)` }} />
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: T.t4, textTransform: "uppercase", letterSpacing: 1.2 }}>Atingimento — Mês consolidado · {monthLabel}{monthDays ? ` · ${monthDays} dias c/ dados` : ""}</span>
                <span style={{ fontSize: 46, fontWeight: 900, color: c_month, lineHeight: 1, textShadow: T.isDark ? `0 0 28px ${c_month}66` : "none", fontVariantNumeric: "tabular-nums" }}>
                  {monthProg != null ? `${(monthProg * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
              <ProgressBar value={monthProg} color="auto" height={34} />
              <div style={{ display: "flex", gap: 30, marginTop: 12 }}>
                <div><div style={{ fontSize: 24, fontWeight: 800, color: T.t1, fontVariantNumeric: "tabular-nums" }}>{Math.round(monthC).toLocaleString()}</div><div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>casos entregues</div></div>
                <div><div style={{ fontSize: 24, fontWeight: 800, color: T.t3, fontVariantNumeric: "tabular-nums" }}>{Math.round(monthQ).toLocaleString()}</div><div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>cota alocada</div></div>
                <div><div style={{ fontSize: 24, fontWeight: 800, color: monthDelta >= 0 ? T.green : T.red, fontVariantNumeric: "tabular-nums" }}>{monthDelta >= 0 ? `+${monthDelta}` : monthDelta}</div><div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>Δ acima da cota</div></div>
                <div style={{ marginLeft: "auto" }}><div style={{ fontSize: 24, fontWeight: 800, color: T.blue }}>{mSum?.activeCount || 0}</div><div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>designers</div></div>
              </div>
            </div>
          ) : (
          /* Row 1: Hero D-1 | Hero Semanal */
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flexShrink: 0 }}>

            {/* D-1 */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 22px", boxShadow: `${T.cardShadow}, 0 0 40px ${c_overall}0d`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${c_overall}cc, transparent)` }} />
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: T.t4, textTransform: "uppercase", letterSpacing: 1.2 }}>Atingimento Geral — D-1</span>
                <span style={{ fontSize: 40, fontWeight: 900, color: c_overall, lineHeight: 1, textShadow: T.isDark ? `0 0 28px ${c_overall}66` : "none", fontVariantNumeric: "tabular-nums" }}>
                  {overallProg != null ? `${(overallProg * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
              <ProgressBar value={overallProg} color="auto" height={32} />
              <div style={{ display: "flex", gap: 24, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.t1, fontVariantNumeric: "tabular-nums" }}>{Math.round(totalC).toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>casos entregues</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.t3, fontVariantNumeric: "tabular-nums" }}>{Math.round(totalQ).toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>cota alocada</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: totalDelta >= 0 ? T.green : T.red, fontVariantNumeric: "tabular-nums" }}>
                    {totalDelta >= 0 ? `+${totalDelta}` : totalDelta}
                  </div>
                  <div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>Δ acima da cota</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.blue }}>{totalDesigners}</div>
                  <div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>designers</div>
                </div>
              </div>
            </div>

            {/* Semanal */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 22px", boxShadow: `${T.cardShadow}, 0 0 40px ${c_weekly}0d`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${c_weekly}cc, transparent)` }} />
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 11, color: T.t4, textTransform: "uppercase", letterSpacing: 1.2 }}>Atingimento Semanal</span>
                  <span style={{ fontSize: 11, color: T.t5, marginLeft: 6 }}>
                    {weekLabel && `${weekLabel} · `}{weeklyDates.length} dia{weeklyDates.length !== 1 ? "s" : ""} c/ dados
                    {weeklyDates.length === 1 && weeklyDates[0] === (selDate || latestDate) && (
                      <span style={{ color: "#f59e0b", marginLeft: 6, fontWeight: 600 }}>= D-1</span>
                    )}
                  </span>
                </div>
                <span style={{ fontSize: 40, fontWeight: 900, color: c_weekly, lineHeight: 1, textShadow: T.isDark ? `0 0 28px ${c_weekly}66` : "none", fontVariantNumeric: "tabular-nums" }}>
                  {weeklyProg != null ? `${(weeklyProg * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
              <ProgressBar value={weeklyProg} color="auto" height={32} />
              <div style={{ display: "flex", gap: 24, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.t1, fontVariantNumeric: "tabular-nums" }}>{Math.round(weeklyC).toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>casos entregues</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.t3, fontVariantNumeric: "tabular-nums" }}>{Math.round(weeklyQ).toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>cota alocada</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: weeklyDelta >= 0 ? T.green : T.red, fontVariantNumeric: "tabular-nums" }}>
                    {weeklyDelta >= 0 ? `+${weeklyDelta}` : weeklyDelta}
                  </div>
                  <div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>Δ acima da cota</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.purple }}>{weeklyDates.length}</div>
                  <div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>dias úteis</div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Row 2 (flex:1): [tabela + avg tasks] | quota vs entregue */}
          <div style={{ display: "grid", gridTemplateColumns: "0.68fr 1.32fr", gap: 10, flex: 1, minHeight: 0 }}>

            {/* Coluna esquerda: tabela + avg tasks empilhados */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>

            {/* Tabela por grupo */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 16px", flexShrink: 0, boxShadow: T.cardShadow }}>
              <div style={{ display: "grid", gridTemplateColumns: "10px 1fr 44px 44px 38px 34px", gap: "0 8px", marginBottom: 4 }}>
                {["", "Grupo", "Cota", "Real.", "Δ", "%"].map(h => (
                  <div key={h} style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.7, paddingBottom: 4, borderBottom: `1px solid ${T.border}`, textAlign: (h === "" || h === "Grupo") ? "left" : "right" }}>{h}</div>
                ))}
              </div>

              {groups.map(g => {
                const gc = GROUP_COLORS[g.group] || T.t3;
                const delta = Math.round(g.totalCompleted - g.totalQuota);
                const isTop = g.group === topGroupId;
                return (
                  <div key={g.group} style={{ display: "grid", gridTemplateColumns: "10px 1fr 44px 44px 38px 34px", gap: "0 8px", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: gc, flexShrink: 0, ...(isTop ? { '--pc': gc + '66', animation: 'pulse-prod 2.5s ease-in-out infinite' } : {}) }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: gc }}>{SHORT(g.group)}</span>
                    <span style={{ fontSize: 12, color: T.t3, textAlign: "right" }}>{Math.round(g.totalQuota)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.t1, textAlign: "right" }}>{Math.round(g.totalCompleted)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: delta >= 0 ? T.green : T.red, textAlign: "right" }}>{delta >= 0 ? `+${delta}` : delta}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: progColor(g.progress), textAlign: "right" }}>{g.progress != null ? `${(g.progress * 100).toFixed(0)}%` : "—"}</span>
                  </div>
                );
              })}

              <div style={{ display: "grid", gridTemplateColumns: "10px 1fr 44px 44px 38px 34px", gap: "0 8px", alignItems: "center", padding: "6px 0", borderTop: `1px solid ${T.border}`, marginTop: 3 }}>
                <div />
                <span style={{ fontSize: 10, fontWeight: 800, color: T.t4, textTransform: "uppercase" }}>Total</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.t2, textAlign: "right" }}>{Math.round(totalQ)}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.t1, textAlign: "right" }}>{Math.round(totalC)}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: totalDelta >= 0 ? T.green : T.red, textAlign: "right" }}>{totalDelta >= 0 ? `+${totalDelta}` : totalDelta}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: c_overall, textAlign: "right" }}>{overallProg != null ? `${(overallProg * 100).toFixed(0)}%` : "—"}</span>
              </div>
            </div>

            {/* Avg Tasks / Dia — abaixo da tabela, cresce para preencher */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "10px 14px", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 4, boxShadow: T.cardShadow }}>
              <div style={{ fontSize: 11, color: T.t4, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>
                Média de Tasks / Dia · por Grupo
                {avgQuotaRef && <span style={{ color: T.yellow, marginLeft: 8, fontWeight: 600 }}>Ref: {avgQuotaRef} tasks</span>}
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={avgTasksData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke={T.border} vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: T.t4, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: T.t4, fontSize: 10 }} axisLine={false} tickLine={false}
                      label={{ value: "tasks/dia", angle: -90, position: "insideLeft", offset: -2, style: { textAnchor: "middle", fill: T.t5, fontSize: 9 } }}
                      width={48} />
                    <Tooltip content={<TT />} />
                    {avgQuotaRef && (
                      <ReferenceLine y={avgQuotaRef} stroke={T.yellow} strokeDasharray="6 4" strokeWidth={1.5}
                        label={{ value: `cota ${avgQuotaRef}`, fill: T.yellow, fontSize: 10, position: "insideTopRight" }} />
                    )}
                    {groupsTrend.map(g => (
                      <Line key={g.group} type="monotone" dataKey={g.group}
                        stroke={GROUP_COLORS[g.group] || T.t3}
                        strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name={SHORT2(g.group)} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
                {groupsTrend.map(g => (
                  <div key={g.group} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 14, height: 2.5, borderRadius: 2, background: GROUP_COLORS[g.group] || T.t3 }} />
                    <span style={{ fontSize: 10, color: T.t4 }}>{SHORT2(g.group)}</span>
                  </div>
                ))}
              </div>
            </div>

            </div>{/* fecha coluna esquerda */}

            {/* Quota vs Entregue — preenche altura disponível */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, minHeight: 0, boxShadow: T.cardShadow }}>
              <div style={{ fontSize: 11, color: T.t4, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>
                Cota Alocada vs Entregue — D-1 · por Grupo
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quotaVsData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="4 4" stroke={T.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: T.t2, fontSize: 13, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: T.t4, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ rx: 8, ry: 8, fill: T.border, strokeWidth: 0 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        const gc = GROUP_COLORS[d?.group] || T.cyan;
                        return (
                          <div style={{
                            background: T.card,
                            border: `1px solid ${gc}50`,
                            borderRadius: 12,
                            padding: "12px 16px",
                            fontSize: 12,
                            boxShadow: T.cardShadow,
                            minWidth: 140,
                          }}>
                            <div style={{ color: gc, marginBottom: 8, fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>{d?.name}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: T.t4 }}>
                                <span>Cota</span>
                                <strong style={{ color: T.t3, fontVariantNumeric: "tabular-nums" }}>{d?.quota}</strong>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: T.t4 }}>
                                <span>Entregue</span>
                                <strong style={{ color: gc, fontVariantNumeric: "tabular-nums" }}>{d?.entregue}</strong>
                              </div>
                              {d?.pendente > 0 && (
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: T.t4 }}>
                                  <span>Pendente</span>
                                  <strong style={{ color: T.yellow, fontVariantNumeric: "tabular-nums" }}>{d?.pendente}</strong>
                                </div>
                              )}
                            </div>
                            <div style={{ marginTop: 8, height: 2, borderRadius: 1, background: `linear-gradient(90deg, ${gc}80, transparent)` }} />
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="quota" name="Cota" fill="rgba(148,163,184,0.22)" stroke="rgba(148,163,184,0.35)" strokeWidth={1} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="quota" position="top" style={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} />
                    </Bar>
                    <Bar dataKey="entregue" name="Entregue" radius={[6, 6, 0, 0]}>
                      {quotaVsData.map((d) => (
                        <Cell key={d.group} fill={GROUP_COLORS[d.group] || T.t3} fillOpacity={0.85} />
                      ))}
                      <LabelList dataKey="entregue" position="top" style={{ fill: T.t1, fontSize: 13, fontWeight: 800 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(148,163,184,0.35)", border: "1px solid rgba(148,163,184,0.5)" }} />
                  <span style={{ fontSize: 10, color: T.t4 }}>Cota alocada</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: T.cyan + "99" }} />
                  <span style={{ fontSize: 10, color: T.t4 }}>Casos entregues</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3 (flexShrink:0): Top 3 full width */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 18px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, boxShadow: T.cardShadow }}>

            <div style={{ flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: T.t4, textTransform: "uppercase", letterSpacing: 1 }}>Top 3 Produtividade · por Grupo</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: `repeat(${nCols}, 1fr)`, gridAutoRows: "minmax(110px, 130px)", gap: 8 }}>
              {top3.map(g => {
                const gc = GROUP_COLORS[g.group] || T.t3;
                return (
                  <div key={g.group} style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    boxShadow: T.cardShadow,
                    borderLeft: `3px solid ${gc}`,
                    borderRadius: 10, padding: "10px 14px",
                    display: "flex", flexDirection: "column", gap: 6,
                    overflow: "hidden",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: gc, paddingBottom: 6, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                      {SHORT2(g.group)}
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly" }}>
                      {g.top.length === 0 ? (
                        <div style={{ fontSize: 11, color: T.t5 }}>Sem dados</div>
                      ) : (
                        g.top.map((p, i) => {
                          const pc = (p.progress || 0) > 1 ? T.cyan : progColor(p.progress);
                          return (
                            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: i === 0 ? gc + "22" : (MEDAL[i] || T.t5) + "18", border: `1.5px solid ${i === 0 ? gc : (MEDAL[i] || T.t5)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: i === 0 ? gc : (MEDAL[i] || T.t5), ...(i === 0 ? { '--pc': gc + '55', animation: 'pulse-prod 2.5s ease-in-out infinite' } : {}) }}>{i + 1}</div>
                                <span title={p.designer_name} style={{ flex: 1, fontSize: 12, color: T.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.designer_name}</span>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 2, flexShrink: 0 }}>
                                  <span style={{ fontSize: 13, fontWeight: 800, color: pc, fontVariantNumeric: "tabular-nums" }}>{(+p.completed).toFixed(1)}</span>
                                  <span style={{ fontSize: 9, color: T.t5 }}>/{Math.round(p.quota)}</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: pc, marginLeft: 2 }}>{(p.progress * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                              <div style={{ background: T.borderControl, borderRadius: 2, overflow: "hidden", height: 2.5, marginLeft: 22 }}>
                                <div style={{ width: `${Math.min(100, (p.progress || 0) * 100)}%`, height: "100%", background: pc, transition: "width 1.2s ease" }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { TrendingUp, Users, AlertTriangle, Activity } from "lucide-react";
import api from "../api";
import KPICard from "../components/KPICard";
import ProgressBar from "../components/ProgressBar";
import PeriodSelector from "../components/PeriodSelector";
import { ProgressAreaTrend } from "../components/TrendChart";
import WorldMap from "../components/WorldMap";
import { T, progColor } from "../theme";

function fmtDateFull(d) {
  if (!d) return "";
  const [year, m, day] = d.split("-");
  const dt = new Date(`${year}-${m}-${day}T12:00:00`);
  const dow = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][dt.getDay()];
  return `${dow}, ${day}/${m}/${year}`;
}

function fmtMonth(m) {
  if (!m) return "";
  const [y, mo] = m.split("-");
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${names[parseInt(mo) - 1]}/${y}`;
}

const MEDAL = ["#ffd700","#c0c0c0","#cd7f32","#6b7280","#6b7280","#6b7280","#6b7280","#6b7280","#6b7280","#6b7280"];

function RankRow({ rank, name, group, progress, completed, quota }) {
  const pct = progress || 0;
  const over = pct > 1;
  const c = over ? T.cyan : progColor(pct);
  const barPct = Math.min(pct, 1) * 100;
  const shortGroup = (group || "").replace("BR-ATD-", "");
  const mc = MEDAL[rank] || "#607d92";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "5px 0", borderBottom: `1px solid ${T.bgControl}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: mc + "22", border: `1.5px solid ${mc}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: mc, flexShrink: 0 }}>{rank + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontSize: 9, color: T.t4 }}>{shortGroup}</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: c, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{(pct * 100).toFixed(0)}%{over ? "↑" : ""}</div>
          <div style={{ fontSize: 9, color: T.t5 }}>{Math.round(completed)}/{Math.round(quota)}</div>
        </div>
      </div>
      <div style={{ background: T.bgControl, borderRadius: 3, overflow: "hidden", height: 3, marginLeft: 28 }}>
        <div style={{ width: `${barPct}%`, height: "100%", background: `linear-gradient(90deg, ${c}, ${c}66)`, borderRadius: 3, transition: "width 1.2s ease" }} />
      </div>
    </div>
  );
}

export default function ProductivityScreen() {
  // ── Day mode state ──
  const [today, setToday]         = useState(null);
  const [yesterday, setYesterday] = useState(null);
  const [trend, setTrend]         = useState([]);
  const [top, setTop]             = useState([]);
  const [geo, setGeo]             = useState([]);
  const [groups, setGroups]       = useState([]);
  const [latestDate, setLatestDate] = useState("");
  const [availDates, setAvailDates] = useState([]);
  const [selDate, setSelDate]     = useState(null);

  // ── Month mode state ──
  const [periodMode, setPeriodMode]   = useState("day"); // "day" | "month"
  const [monthSummary, setMonthSummary] = useState(null);
  const [monthGroups, setMonthGroups]   = useState([]);
  const [monthGeo, setMonthGeo]         = useState([]);
  const [monthTop, setMonthTop]         = useState([]);
  const [monthTrend, setMonthTrend]     = useState([]);
  const [monthDays, setMonthDays]       = useState(0);

  const [refreshedAt, setRefreshedAt] = useState("");

  // ── Init: load available dates ──
  useEffect(() => {
    api.get("/metrics/productivity/available-dates").then(({ data }) => {
      setAvailDates(data.dates || []);
      if (!selDate && data.dates[0]) setSelDate(data.dates[0]);
    }).catch(() => {});
  }, []);

  // ── Day load ──
  async function loadDay() {
    try {
      const dateQ    = selDate ? `&date=${selDate}` : "";
      const geoDateQ = selDate ? `?date=${selDate}` : "";
      const [td, tr, tp, gd, gr] = await Promise.all([
        api.get(`/metrics/productivity/today?groupType=atd${dateQ}`),
        api.get("/metrics/productivity/trend?days=10&groupType=atd"),
        api.get(`/metrics/productivity/top?n=10&groupType=atd${dateQ}`),
        api.get(`/metrics/productivity/geo${geoDateQ}`),
        api.get(`/metrics/productivity/groups${geoDateQ}`),
      ]);
      setToday(td.data.today);
      setYesterday(td.data.yesterday);
      setLatestDate(td.data.latestDate || "");
      setTrend(tr.data || []);
      setTop(tp.data.rankings || []);
      setGeo(gd.data.geo || []);
      setGroups(gr.data.groups || []);
      setRefreshedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) { console.error(e); }
  }

  // ── Month load — month derived automatically from selected date ──
  async function loadMonth(month) {
    if (!month) return;
    try {
      const q = `?month=${month}`;
      const [ms, mt, mg, tr] = await Promise.all([
        api.get(`/metrics/productivity/month-summary${q}`),
        api.get(`/metrics/productivity/month-top${q}&n=10`),
        api.get(`/metrics/productivity/month-geo${q}`),
        api.get(`/metrics/productivity/month-trend${q}`),
      ]);
      setMonthSummary(ms.data.summary);
      setMonthDays(ms.data.days || 0);
      setMonthGroups(ms.data.groups || []);
      setMonthTop(mt.data.rankings || []);
      setMonthGeo(mg.data.geo || []);
      setMonthTrend(tr.data || []);
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (!selDate) return;
    if (periodMode === "day") loadDay();
    else loadMonth(selDate.slice(0, 7));
  }, [selDate, periodMode]);

  useEffect(() => {
    const t = setInterval(() => {
      if (periodMode === "day") loadDay();
      else if (selDate) loadMonth(selDate.slice(0, 7));
    }, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [periodMode, selDate]);

  // ── Active data aliases ──
  const isMonth      = periodMode === "month";
  const autoMonth    = selDate ? selDate.slice(0, 7) : null;
  const active       = isMonth ? monthSummary : today;
  const activeTrend  = isMonth ? monthTrend   : trend;
  const activeTop    = isMonth ? monthTop     : top;
  const activeGeo    = isMonth ? monthGeo     : geo;
  const activeGroups = isMonth ? monthGroups  : groups;

  const noData = !active;
  const prog   = active?.progress;
  const c      = progColor(prog);
  const delta  = (!isMonth && today && yesterday?.progress != null) ? (today.progress - yesterday.progress) : null;

  const bestDay    = activeTrend.length ? Math.max(...activeTrend.map(d => d.progress || 0)) : null;
  const avgProg    = activeTrend.length ? activeTrend.reduce((s, d) => s + (d.progress || 0), 0) / activeTrend.length : null;
  const totalCases = activeTrend.length ? Math.round(activeTrend.reduce((s, d) => s + (d.totalCompleted || 0), 0)) : null;

  // ── Period label ──
  const periodLabel = isMonth
    ? `Mês · ${fmtMonth(autoMonth)}${monthDays ? ` · ${monthDays} dias` : ""}`
    : `D-1 · ${latestDate ? fmtDateFull(latestDate) : "Sem dados"}`;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "18px 30px", gap: 12, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 42, fontWeight: 900, color: T.t1, letterSpacing: -1.5 }}>Produtividade ATD</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PeriodSelector dates={availDates} selectedDate={selDate} onDateChange={setSelDate} periodType="day" />
          <div style={{ fontSize: 14, fontWeight: 600, color: T.t2, background: T.bgControl, padding: "8px 20px", borderRadius: 20, border: `1px solid ${T.borderControl}`, boxShadow: T.pillShadow, display: "flex", alignItems: "center", gap: 10 }}>
            <span>{periodLabel}</span>
            <span style={{ width: 1, height: 14, background: T.border }} />
            <button
              onClick={() => setPeriodMode(m => m === "day" ? "month" : "day")}
              style={{ fontSize: 11, fontWeight: 700, color: isMonth ? T.cyan : T.t4, background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: 0.5 }}
            >
              {isMonth ? "Mês" : "Dia"}
            </button>
            {refreshedAt && <span style={{ color: T.t5, fontSize: 12 }}>↻ {refreshedAt}</span>}
          </div>
        </div>
      </div>

      {noData ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.t5, fontSize: 20 }}>
          Faça upload do arquivo de produtividade para visualizar
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, flexShrink: 0 }}>
            <KPICard
              title={isMonth ? "Atingimento ATD Mês" : "Atingimento ATD D-1"}
              value={prog != null ? `${(prog * 100).toFixed(1)}%` : "—"}
              sub={`${Math.round(active?.totalCompleted || 0).toLocaleString()} / ${Math.round(active?.totalQuota || 0).toLocaleString()} casos`}
              icon={<TrendingUp size={14} />} color={c} delta={delta} />
            <KPICard
              title="Casos Pendentes"
              value={Math.round(active?.totalUncompleted || 0).toLocaleString()}
              sub={isMonth ? "acumulado no mês" : "com cota atribuída"}
              icon={<AlertTriangle size={14} />}
              color={active?.totalUncompleted > 100 ? T.red : T.yellow} />
            <KPICard
              title="Designers Ativos"
              value={active?.activeCount || 0}
              sub={isMonth ? "únicos no mês" : "com cota no D-1"}
              icon={<Users size={14} />} color={T.blue} />
            <KPICard
              title={isMonth ? "Casos / Designer (mês)" : "Média / Designer"}
              value={(active?.avgCompleted || 0).toFixed(1)}
              sub={isMonth ? `em ${monthDays} dias úteis` : `meta D-1: ${active?.totalQuota && active?.activeCount ? (active.totalQuota / active.activeCount).toFixed(1) : "—"} casos`}
              icon={<Activity size={14} />} color={T.purple} />
          </div>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.85fr", gap: 12, flex: 1, minHeight: 0 }}>

            {/* Coluna esquerda: mapa */}
            <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                {activeGeo.length > 0 ? (
                  <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                    <WorldMap geo={activeGeo} groups={activeGroups} height="100%" />
                  </div>
                ) : (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.t5, fontSize: 14 }}>
                    Sem dados geográficos para este período
                  </div>
                )}
              </div>
            </div>

            {/* Coluna direita */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>

              {/* Atingimento + trend */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0, overflow: "hidden", boxShadow: T.cardShadow }}>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: T.t4, textTransform: "uppercase", letterSpacing: 1 }}>
                      {isMonth ? `Atingimento da Meta — ${fmtMonth(autoMonth)}` : "Atingimento da Meta — D-1"}
                    </span>
                    {!isMonth && (
                      <span style={{ fontSize: 11, color: T.t5 }}>
                        D-2: {yesterday?.progress != null ? `${(yesterday.progress * 100).toFixed(1)}%` : "—"}
                      </span>
                    )}
                  </div>
                  <ProgressBar value={prog} color="auto" height={24} />
                </div>

                <div style={{ fontSize: 11, color: T.t4, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>
                  {isMonth ? `Dias do mês (${activeTrend.length})` : `Últimos ${activeTrend.length} Dias`}
                </div>

                <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                  <ProgressAreaTrend
                    data={activeTrend.map(d => ({ date: d.date, progress: d.progress }))}
                    dataKey="progress" target={0.8} id="prod-atd-main"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, flexShrink: 0 }}>
                  {[
                    { label: "Melhor dia",  value: bestDay != null ? `${(bestDay * 100).toFixed(0)}%` : "—", color: T.green },
                    { label: `Média ${activeTrend.length}d`, value: avgProg != null ? `${(avgProg * 100).toFixed(0)}%` : "—", color: T.blue },
                    { label: "Casos período", value: totalCases != null ? totalCases.toLocaleString() : "—", color: T.cyan },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: T.bgControl, borderRadius: 8, padding: "7px 10px" }}>
                      <div style={{ fontSize: 9, color: T.t5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ranking */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "12px 14px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden", boxShadow: T.cardShadow }}>
                <div style={{ fontSize: 11, color: T.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, flexShrink: 0 }}>
                  {isMonth ? `Top Mês — ${activeTop.length} designers` : `Top D-1 — ${activeTop.length > 0 ? `${activeTop.length} designers` : ""}`}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {activeTop.length === 0 ? (
                    <div style={{ color: T.t5, fontSize: 14, marginTop: 16 }}>Sem dados</div>
                  ) : (
                    activeTop.map((p, i) => (
                      <RankRow key={i} rank={i}
                        name={p.designer_name} group={p.group_no}
                        progress={p.progress} completed={p.completed} quota={p.quota}
                      />
                    ))
                  )}
                </div>
                {active && (
                  <div style={{ paddingTop: 8, marginTop: 6, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>
                      {isMonth ? fmtMonth(autoMonth) : "D-1"}
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      {[
                        { label: "Ating.", value: active.progress != null ? `${(active.progress * 100).toFixed(1)}%` : "—", color: progColor(active.progress) },
                        { label: "Casos",  value: Math.round(active.totalCompleted || 0).toLocaleString(), color: T.blue },
                        { label: "Pend.",  value: Math.round(active.totalUncompleted || 0).toLocaleString(), color: active.totalUncompleted > 100 ? T.red : T.yellow },
                      ].map(m => (
                        <div key={m.label} style={{ flex: 1, background: T.bgControl, borderRadius: 8, padding: "6px 6px", textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#8aaabf", marginBottom: 2 }}>{m.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: m.color, fontVariantNumeric: "tabular-nums" }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

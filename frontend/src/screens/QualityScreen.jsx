import React, { useEffect, useState, useMemo } from "react";
import { TrendingDown, ThumbsDown, CheckCircle } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, ReferenceLine, Tooltip } from "recharts";
import api from "../api";
import KPICard from "../components/KPICard";
import PeriodSelector from "../components/PeriodSelector";
import { AreaTrend, BarTrend, DesignerScatter } from "../components/TrendChart";
import { T, scoreColor } from "../theme";

function fmtWeek(d) {
  if (!d) return "";
  const [year, m, day] = d.split("-");
  const end = new Date(`${year}-${m}-${day}T12:00:00`);
  const start = new Date(end); start.setDate(end.getDate() - 6);
  const sd = String(start.getDate()).padStart(2, "0");
  return `${sd}–${day}/${m}/${year}`;
}

function fmtMonth(d) {
  if (!d) return "";
  const [year, m] = d.split("-");
  const dt = new Date(parseInt(year), parseInt(m) - 1, 1);
  return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function scorePct(v) {
  return Math.max(0, Math.min(100, ((v || 0) - 7) / 3 * 100));
}

function fmtTick(d) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return d.slice(5);
}

function ScoreTrendCard({ title, value, delta, trendData, color, id }) {
  const c    = scoreColor(value);
  const gid  = `sc-${id}`;
  const gshadow = `sc-sh-${id}`;

  const data = trendData.map(d => ({ ...d, _s: d.score }));

  const renderDot = (props) => {
    const { cx, cy, index, payload } = props;
    if (cx == null || cy == null) return null;
    const val = payload.score;
    if (val == null) return null;
    const isLast = index === data.length - 1;
    const dotR   = isLast ? 6 : 4.5;
    const scoreLblY = cy - dotR - 7;

    // Delta vs previous period
    const prevVal = index > 0 ? data[index - 1]?.score : null;
    const diff    = prevVal != null && !isNaN(prevVal) ? val - prevVal : null;
    const dColor  = diff == null ? null : diff > 0 ? T.green : diff < 0 ? T.red : T.t4;
    const dLabel  = diff == null ? null
      : diff > 0 ? `▲${diff.toFixed(2)}`
      : diff < 0 ? `▼${Math.abs(diff).toFixed(2)}`
      : `–`;
    const deltaLblY = scoreLblY - 12;

    return (
      <g key={`dot-${id}-${index}`}>
        {isLast && <circle cx={cx} cy={cy} r={14} fill={color} fillOpacity={0.14} />}
        <circle cx={cx} cy={cy} r={dotR}
          fill={isLast ? color : T.card}
          stroke={color} strokeWidth={isLast ? 2.5 : 2} />
        {/* Score label */}
        <text x={cx} y={scoreLblY}
          textAnchor="middle" dominantBaseline="auto"
          fill={isLast ? color : T.t1}
          fontSize={isLast ? 12 : 10}
          fontWeight={isLast ? "900" : "700"}
          style={{ fontVariantNumeric: "tabular-nums" }}>
          {val.toFixed(2)}
        </text>
        {/* Delta label — shows variation vs previous week */}
        {dLabel && (
          <text x={cx} y={deltaLblY}
            textAnchor="middle" dominantBaseline="auto"
            fill={dColor}
            fontSize={isLast ? 9 : 8}
            fontWeight="700"
            style={{ fontVariantNumeric: "tabular-nums" }}>
            {dLabel}
          </text>
        )}
      </g>
    );
  };

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: "14px 20px",
      display: "flex", flexDirection: "column", gap: 6, overflow: "hidden",
      position: "relative", boxShadow: T.cardShadow,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}99, transparent)` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: T.t4, textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
        {value != null && (
          <div style={{
            fontSize: 10, fontWeight: 700,
            color: value >= 8.3 ? T.green : T.red,
            background: value >= 8.3 ? T.green + "18" : T.red + "18",
            border: `1px solid ${value >= 8.3 ? T.green + "30" : T.red + "30"}`,
            borderRadius: 6, padding: "2px 8px", letterSpacing: 0.5,
          }}>
            {value >= 8.3 ? "✓ acima da meta" : "✗ abaixo da meta"}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
        <span style={{
          fontSize: 32, fontWeight: 900, color: c, lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          filter: T.isDark ? `drop-shadow(0 0 12px ${c}55)` : "none",
        }}>
          {value != null ? value.toFixed(2) : "—"}
        </span>
        <span style={{ fontSize: 12, color: T.t3, marginBottom: 2 }}>/10</span>
        {delta != null && !isNaN(delta) && (
          <span style={{
            fontSize: 12, fontWeight: 800, marginBottom: 3, lineHeight: 1,
            color: delta > 0 ? T.green : delta < 0 ? T.red : T.t4,
            background: delta > 0 ? T.green + "18" : delta < 0 ? T.red + "18" : T.bgControl,
            border: `1px solid ${delta > 0 ? T.green + "30" : delta < 0 ? T.red + "30" : T.border}`,
            borderRadius: 5, padding: "2px 6px",
          }}>
            {delta > 0 ? `▲ ${delta.toFixed(2)}` : delta < 0 ? `▼ ${Math.abs(delta).toFixed(2)}` : "— estável"}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 46, right: 14, left: -28, bottom: 10 }}>
            <defs>
              <linearGradient id={gshadow} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0.00} />
              </linearGradient>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.62} />
                <stop offset="45%"  stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={T.bgControl} vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtTick}
              tick={{ fill: "#8aaabf", fontSize: 10 }}
              axisLine={{ stroke: T.bgControl }} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis domain={[d => Math.max(7, +(d - 0.3).toFixed(1)), d => Math.min(10, +(d + 0.15).toFixed(1))]} hide />

            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const val = payload[0]?.value;
              return (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, boxShadow: T.cardShadow }}>
                  <div style={{ color: T.t4, fontSize: 11, marginBottom: 4 }}>{fmtTick(label)}</div>
                  <div style={{ color: scoreColor(val), fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{val?.toFixed(2)}</div>
                </div>
              );
            }} />

            <ReferenceLine y={8.3}
              stroke="#f59e0b" strokeDasharray="8 5" strokeWidth={2.5} strokeOpacity={0.9}
              label={{ value: "META 8.3", position: "insideTopRight", fill: "#f59e0b", fontSize: 11, fontWeight: 800, dy: -4 }}
            />
            <Area type="monotone" dataKey="_s" stroke="none" fill={`url(#${gshadow})`} fillOpacity={1}
              dot={false} activeDot={false} isAnimationActive animationDuration={900} animationEasing="ease-out" />
            <Area type="monotone" dataKey="score" stroke={color} strokeWidth={2.5}
              fill={`url(#${gid})`} fillOpacity={1}
              dot={renderDot}
              activeDot={{ r: 7, fill: color, stroke: "#0a0e1a", strokeWidth: 2 }}
              isAnimationActive animationDuration={1400} animationEasing="ease-out" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const MEDAL = ["#ffd700", "#c0c0c0", "#cd7f32", "#6b7280", "#6b7280", "#6b7280", "#6b7280", "#6b7280", "#6b7280", "#6b7280"];

const QUALITY_TABS = [
  { key: "semana", label: "Semana" },
  { key: "mes",    label: "Mês"    },
];

const slide = (delay) => ({
  animation: `qs-up 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}ms both`,
});

export default function QualityScreen() {
  const [summary, setSummary]         = useState(null);
  const [weekTrend, setWeekTrend]     = useState([]);
  const [weekTrendRaw, setWeekTrendRaw] = useState([]);
  const [monthTrend, setMonthTrend]   = useState([]);
  const [top, setTop]                 = useState([]);
  const [designers, setDesigners]     = useState([]);
  const [availDates, setAvailDates]   = useState({ weeks: [], months: [] });
  const [period, setPeriod]           = useState("semana");
  const [selWeek, setSelWeek]         = useState(null);
  const [selMonth, setSelMonth]       = useState(null);
  const [refreshedAt, setRefreshedAt] = useState("");

  // Load available dates on mount
  useEffect(() => {
    api.get("/quality/available-dates").then(({ data }) => {
      setAvailDates(data);
      if (!selWeek && data.weeks[0])  setSelWeek(data.weeks[0]);
      if (!selMonth && data.months[0]) setSelMonth(data.months[0]);
    }).catch(() => {});
  }, []);

  const activeDate = period === "semana" ? selWeek : selMonth;
  const activePeriodType = period === "semana" ? "week" : "month";

  // When on Semana tab, find the monthly upload that corresponds to the selected week's month
  const derivedMonth = useMemo(() => {
    if (period !== "semana" || !selWeek || !availDates.months.length) return selMonth;
    const weekYM = selWeek.slice(0, 7);
    return availDates.months.find(m => m.slice(0, 7) === weekYM) || selMonth;
  }, [period, selWeek, availDates.months, selMonth]);

  async function load() {
    try {
      const weekDate  = selWeek  || undefined;
      const monthDate = (period === "semana" ? derivedMonth : selMonth) || undefined;
      const dateParam = activeDate ? `&date=${activeDate}` : "";

      const [s, wtr, mtr, tp, ds] = await Promise.all([
        api.get(`/quality/summary${weekDate ? `?weekDate=${weekDate}` : ""}${monthDate ? `${weekDate ? "&" : "?"}monthDate=${monthDate}` : ""}`),
        api.get(`/quality/trend?periods=12${weekDate ? `&date=${weekDate}` : ""}`),
        api.get(`/quality/trend/month?periods=6${monthDate ? `&date=${monthDate}` : ""}`),
        api.get(`/quality/top?period=${activePeriodType}&n=10${dateParam}`),
        api.get(`/quality/designers?period=${activePeriodType}${dateParam}`),
      ]);
      setSummary(s.data);
      const rawW = wtr.data || [];
      setWeekTrendRaw(rawW);
      setWeekTrend(rawW.map(d => ({ date: d.date, score: +(d.total_avg_score || d.avg_score || 0).toFixed(4) })));
      setMonthTrend((mtr.data || []).map(d => ({ date: d.date, score: +(d.avg_score || 0).toFixed(4) })));
      setTop(tp.data.rankings || []);
      setDesigners(ds.data.designers || []);
      setRefreshedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (selWeek || selMonth) load();
  }, [selWeek, selMonth, period]);

  useEffect(() => {
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const week  = summary?.week;
  const month = summary?.month;
  const noData = !week?.date && !month?.date;

  const weekDelta = weekTrend.length >= 2
    ? +(weekTrend.at(-1).score - weekTrend.at(-2).score).toFixed(2) : null;
  const monthDelta = monthTrend.length >= 2
    ? +(monthTrend.at(-1).score - monthTrend.at(-2).score).toFixed(2) : null;

  const panelStyle = {
    background: T.card, border: `1px solid ${T.border}`, boxShadow: T.cardShadow,
    borderRadius: 16, padding: "16px 22px",
    display: "flex", flexDirection: "column", overflow: "hidden",
    position: "relative",
  };

  const headerDate = period === "semana"
    ? (week?.date ? `Semana ${fmtWeek(week.date)}` : "Sem dados")
    : (month?.date ? fmtMonth(month.date) : "Sem dados");

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "18px 30px", gap: 10, overflow: "hidden" }}>
      <style>{`
        @keyframes qs-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, ...slide(0) }}>
        <div style={{ fontSize: 42, fontWeight: 900, color: T.t1, letterSpacing: -1.5, textWrap: "balance" }}>
          Qualidade ATD
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PeriodSelector
            tabs={QUALITY_TABS}
            activeTab={period}
            onTabChange={setPeriod}
            dates={period === "semana" ? availDates.weeks : availDates.months}
            selectedDate={period === "semana" ? selWeek : selMonth}
            onDateChange={period === "semana" ? setSelWeek : setSelMonth}
            periodType={period === "semana" ? "week" : "month"}
          />
          <div style={{ fontSize: 14, fontWeight: 600, color: T.t2, background: T.bgControl, padding: "8px 20px", borderRadius: 20, border: `1px solid ${T.borderControl}`, boxShadow: T.pillShadow }}>
            {headerDate}
            {refreshedAt && <span style={{ color: T.t5, fontSize: 12, marginLeft: 8 }}>↻ {refreshedAt}</span>}
          </div>
        </div>
      </div>

      {noData ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#607d92", fontSize: 20 }}>
          Faça upload dos arquivos de qualidade para visualizar
        </div>
      ) : (
        <>
          {/* Row 1: KPI tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, flexShrink: 0, ...slide(60) }}>
            <KPICard title={`Casos Avaliados (${period === "semana" ? "semana" : "mês"})`}
              value={period === "semana" ? (week?.total_scored || 0).toLocaleString() : (month?.total_scored || 0).toLocaleString()}
              sub={period === "semana" ? `Mês: ${(month?.total_scored || 0).toLocaleString()} casos` : `Semana: ${(week?.total_scored || 0).toLocaleString()} casos`}
              icon={<CheckCircle size={14} />} color="#3b82f6" />
            <KPICard title="Taxa Score ≤ 6"
              value={
                period === "semana"
                  ? (week?.rate_low_score != null ? `${(week.rate_low_score * 100).toFixed(1)}%` : "—")
                  : (month?.rate_low_score != null ? `${(month.rate_low_score * 100).toFixed(1)}%` : "—")
              }
              sub={`${(period === "semana" ? week?.qty_low_score : month?.qty_low_score) || 0} casos com nota baixa`}
              icon={<TrendingDown size={14} />}
              color={
                period === "semana"
                  ? (week?.rate_low_score > 0.15 ? "#ef4444" : week?.rate_low_score > 0.08 ? "#f59e0b" : "#22c55e")
                  : (month?.rate_low_score > 0.15 ? "#ef4444" : month?.rate_low_score > 0.08 ? "#f59e0b" : "#22c55e")
              } />
            <KPICard title="Unfit Preferência"
              value={
                period === "semana"
                  ? (week?.rate_unfit != null ? `${(week.rate_unfit * 100).toFixed(1)}%` : "—")
                  : (month?.rate_unfit != null ? `${(month.rate_unfit * 100).toFixed(1)}%` : "—")
              }
              sub={`${(period === "semana" ? week?.qty_unfit : month?.qty_unfit) || 0} casos sinalizados`}
              icon={<ThumbsDown size={14} />}
              color={
                period === "semana"
                  ? (week?.rate_unfit > 0.1 ? "#ef4444" : week?.rate_unfit > 0.05 ? "#f59e0b" : "#22c55e")
                  : (month?.rate_unfit > 0.1 ? "#ef4444" : month?.rate_unfit > 0.05 ? "#f59e0b" : "#22c55e")
              } />
          </div>

          {/* Row 2: Score trend cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flexShrink: 0, height: 190, ...slide(120) }}>
            <ScoreTrendCard
              title="Evolução Score Semanal"
              value={week?.total_avg_score}
              delta={weekDelta}
              trendData={weekTrend}
              color="#3b82f6"
              id="week"
            />
            <ScoreTrendCard
              title="Evolução Score Mensal"
              value={month?.total_avg_score ?? month?.avg_score}
              delta={monthDelta}
              trendData={monthTrend}
              color="#8b5cf6"
              id="month"
            />
          </div>

          {/* Row 3: Detail charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 0.85fr", gap: 12, flex: 1, minHeight: 0 }}>

            {/* LEFT: score evolution + low score bar */}
            <div style={{ ...panelStyle, gap: 0, ...slide(180) }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T.blue}99, transparent)` }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
                <div style={{ fontSize: 13, color: T.t4, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>
                  Evolução Score — Semanas
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <AreaTrend data={weekTrend} dataKey="score" color="#3b82f6" target={8.3} id="qscore" height="100%" showLabels />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0, borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontSize: 13, color: T.t4, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>
                  Taxa Score ≤ 6 — Tendência
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <BarTrend data={weekTrendRaw.map(d => ({ date: d.date, low: d.rate_low_score || 0 }))} dataKey="low" color="#ef4444" pct height="100%" />
                </div>
              </div>
            </div>

            {/* CENTER: designer bars + score por nível */}
            <div style={{ ...panelStyle, gap: 10, ...slide(240) }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T.purple}99, transparent)` }} />
              <div style={{ fontSize: 13, color: T.t4, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>
                Score vs Volume
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <DesignerScatter designers={designers} height="100%" />
              </div>
            </div>

            {/* RIGHT: top 10 ranking */}
            <div style={{ ...panelStyle, gap: 0, ...slide(300) }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T.cyan}99, transparent)` }} />
              <div style={{ fontSize: 12, color: T.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, flexShrink: 0 }}>
                Top 10 Qualidade ({period === "semana" ? "semana" : "mês"})
              </div>
              {top.length === 0 ? (
                <div style={{ color: "#607d92", fontSize: 15 }}>Sem dados</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, overflow: "hidden" }}>
                  {top.map((p, i) => {
                    const c = scoreColor(p.avg_score);
                    const medalColor = MEDAL[i] || "#607d92";
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "5px 8px", borderRadius: 8, background: T.bgControl,
                        animation: `qs-up 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${300 + i * 40}ms both`,
                      }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: medalColor + "22", border: `1.5px solid ${medalColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: medalColor, flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div title={p.designer_name} style={{ fontSize: 12, fontWeight: 700, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>
                              {p.designer_name}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: c, flexShrink: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                              {p.avg_score?.toFixed(2)}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                            <div style={{ flex: 1, background: T.borderControl, borderRadius: 3, overflow: "hidden", height: 3 }}>
                              <div style={{ width: `${scorePct(p.avg_score)}%`, height: "100%", background: `linear-gradient(90deg, ${c}, ${c}88)`, borderRadius: 3, transition: "width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)" }} />
                            </div>
                            <div style={{ fontSize: 9, color: T.t5, flexShrink: 0 }}>{p.score_qty}x</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(week?.total_avg_score || month?.total_avg_score) && (
                <div style={{ paddingTop: 8, marginTop: 6, borderTop: `1px solid ${T.border}`, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {week?.total_avg_score && (
                    <div>
                      <div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Semana</div>
                      <div style={{ display: "flex", gap: 5 }}>
                        {[
                          { label: "Score", value: week.total_avg_score?.toFixed(2), color: scoreColor(week.total_avg_score) },
                          { label: "Casos", value: week.total_scored?.toLocaleString(), color: "#3b82f6" },
                          { label: "≤6",    value: week.rate_low_score != null ? `${(week.rate_low_score * 100).toFixed(1)}%` : "—", color: "#ef4444" },
                        ].map(m => (
                          <div key={m.label} style={{ flex: 1, background: T.bgControl, borderRadius: 8, padding: "6px 6px", textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: "#8aaabf", marginBottom: 2 }}>{m.label}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {month?.total_avg_score && (
                    <div>
                      <div style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Mês (acum.)</div>
                      <div style={{ display: "flex", gap: 5 }}>
                        {[
                          { label: "Score", value: month.total_avg_score?.toFixed(2), color: scoreColor(month.total_avg_score) },
                          { label: "Casos", value: month.total_scored?.toLocaleString(), color: "#3b82f6" },
                          { label: "≤6",    value: month.rate_low_score != null ? `${(month.rate_low_score * 100).toFixed(1)}%` : "—", color: "#ef4444" },
                        ].map(m => (
                          <div key={m.label} style={{ flex: 1, background: T.bgControl, borderRadius: 8, padding: "6px 6px", textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: "#8aaabf", marginBottom: 2 }}>{m.label}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import api from "../api";
import PeriodSelector from "../components/PeriodSelector";
import { T, scoreColor, ATD_PREFIX, gridCols, GROUP_COLORS } from "../theme";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from "recharts";

const GlossBar = ({ x, y, width, height, payload }) => {
  if (!width || width <= 0) return null;
  const fill = (payload && payload.color) || "#64748b";
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} ry={8} fill={fill} />
      <rect x={x} y={y} width={width} height={height} rx={8} ry={8} fill="url(#qGloss)" />
    </g>
  );
};

function fmtWeek(d) {
  if (!d) return "";
  const [year, m, day] = d.split("-");
  const end = new Date(`${year}-${m}-${day}T12:00:00`);
  const start = new Date(end); start.setDate(end.getDate() - 6);
  const sm = String(start.getMonth() + 1).padStart(2, "0");
  const sd = String(start.getDate()).padStart(2, "0");
  return `${sd}–${day}/${m}/${year}`;
}

const MEDAL = ["#ffd700", "#c0c0c0", "#cd7f32", "#6b7280", "#6b7280"];

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 18px", fontSize: 14, boxShadow: T.cardShadow }}>
      <div style={{ color: T.t4, marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: T.t1, fontWeight: 800, fontSize: 16 }}>{p.value?.toFixed(2)} / 10</div>
      ))}
    </div>
  );
};

export default function OverallQualityScreen() {
  const [groups, setGroups]         = useState([]);
  const [topByGroup, setTopByGroup] = useState([]);
  const [date, setDate]             = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");
  const [availDates, setAvailDates] = useState({ weeks: [], months: [] });
  const [period, setPeriod]         = useState("semana");
  const [selWeek, setSelWeek]       = useState(null);
  const [selMonth, setSelMonth]     = useState(null);

  useEffect(() => {
    api.get("/quality/available-dates").then(({ data }) => {
      setAvailDates(data);
      if (!selWeek  && data.weeks[0])  setSelWeek(data.weeks[0]);
      if (!selMonth && data.months[0]) setSelMonth(data.months[0]);
    }).catch(() => {});
  }, []);

  const activeDate = period === "semana" ? selWeek : selMonth;
  const activePeriodType = period === "semana" ? "week" : "month";

  async function load() {
    try {
      const dateQ = activeDate ? `&date=${activeDate}` : "";
      const [gd, td] = await Promise.all([
        api.get(`/quality/groups?period=${activePeriodType}${dateQ}`),
        api.get(`/quality/top-by-group?period=${activePeriodType}&n=5${dateQ}`),
      ]);
      const allGroups = gd.data.groups || [];
      const allTop    = td.data.groups || [];
      setGroups(allGroups.filter(g => g.group?.startsWith(ATD_PREFIX)));
      setTopByGroup(allTop.filter(g => g.group?.startsWith(ATD_PREFIX)));
      setDate(gd.data.date || "");
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

  const noData = groups.length === 0;

  const sorted = [...groups].sort((a, b) => b.avg_score - a.avg_score);
  const chartData = sorted.map(g => ({
    name: g.group.replace("BR-ATD-", ""),
    score: +(g.avg_score || 0).toFixed(2),
    color: scoreColor(g.avg_score),
  }));

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "18px 30px", gap: 12, overflow: "hidden" }}>
      <style>{`@keyframes pulse-qual { 0%,100% { box-shadow: 0 0 0 0 var(--pc,rgba(0,0,0,0.3)); } 60% { box-shadow: 0 0 0 5px transparent; } }`}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 42, fontWeight: 900, color: T.t1, letterSpacing: -1.5, textWrap: 'balance' }}>Qualidade — Por Grupo</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PeriodSelector
            tabs={[{ key: "semana", label: "Semana" }, { key: "mes", label: "Mês" }]}
            activeTab={period}
            onTabChange={setPeriod}
            dates={period === "semana" ? availDates.weeks : availDates.months}
            selectedDate={period === "semana" ? selWeek : selMonth}
            onDateChange={period === "semana" ? setSelWeek : setSelMonth}
            periodType={period === "semana" ? "week" : "month"}
          />
          <div style={{ fontSize: 14, fontWeight: 600, color: T.t2, background: T.bgControl, padding: "8px 20px", borderRadius: 20, border: `1px solid ${T.borderControl}`, boxShadow: T.pillShadow }}>
            {date ? `${period === "semana" ? "Semana " + fmtWeek(date) : fmtWeek(date)}` : "Sem dados"}
            {refreshedAt && <span style={{ color: T.t5, fontSize: 12, marginLeft: 8 }}>↻ {refreshedAt}</span>}
          </div>
        </div>
      </div>

      {noData ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.t5, fontSize: 20 }}>
          Faça upload dos arquivos de qualidade para visualizar
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Top row: bar chart + summary table side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flexShrink: 0 }}>

            {/* Bar chart */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 20px", boxShadow: T.cardShadow, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T.purple}aa, transparent)` }} />
              <div style={{ fontSize: 13, color: T.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                Score Médio por Grupo (semana)
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 64, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="qGloss" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
                      <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke={T.bgControl} horizontal={false} />
                  <XAxis type="number" domain={[7, 10]} tick={{ fill: T.t4, fontSize: 14 }} axisLine={false} tickLine={false} tickCount={7} />
                  <YAxis type="category" dataKey="name" tick={{ fill: T.t2, fontSize: 14, fontWeight: 700 }} axisLine={false} tickLine={false} width={96} />
                  <Tooltip content={<TT />} cursor={{ rx: 8, ry: 8, fill: T.border }} />
                  <ReferenceLine x={8.5} stroke="#f59e0b" strokeDasharray="6 4" strokeWidth={2}
                    label={{ value: "Meta 8.5", fill: "#f59e0b", fontSize: 13, position: "top" }} />
                  <Bar dataKey="score" radius={[0, 8, 8, 0]} shape={<GlossBar />} background={{ fill: T.border, radius: [0, 8, 8, 0] }}
                    label={{ position: "right", fontSize: 16, fontWeight: 800, fill: T.t1, formatter: v => v.toFixed(2) }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary table */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 20px", boxShadow: T.cardShadow, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T.blue}aa, transparent)` }} />
              <div style={{ fontSize: 13, color: T.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                Resumo por Grupo
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: "8px 20px", alignItems: "center" }}>
                {["Grupo", "Score", "Casos", "≤ 6", "Unfit"].map(h => (
                  <div key={h} style={{ fontSize: 12, color: T.t5, textTransform: "uppercase", letterSpacing: 1, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>{h}</div>
                ))}
                {sorted.map((g, gi) => {
                  const c = scoreColor(g.avg_score);
                  const gc = GROUP_COLORS[g.group] || c;
                  const isLow = g.rate_low_score > 0.15;
                  const isUnfit = g.rate_unfit > 0.1;
                  return (
                    <React.Fragment key={g.group}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: gc, flexShrink: 0, ...(gi === 0 ? { '--pc': gc + '66', animation: 'pulse-qual 2.5s ease-in-out infinite' } : {}) }} />
                        <span style={{ fontSize: 16, fontWeight: 700, color: T.t2 }}>{g.group.replace("BR-ATD-", "")}</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: c, textAlign: "right", textShadow: T.isDark ? `0 0 16px ${c}55` : "none" }}>{g.avg_score?.toFixed(2)}</div>
                      <div style={{ fontSize: 16, color: T.t3, textAlign: "right" }}>{g.total_scored}</div>
                      <div style={{ fontSize: 16, fontWeight: isLow ? 800 : 400, color: isLow ? T.red : T.t4, textAlign: "right" }}>
                        {g.rate_low_score != null ? `${(g.rate_low_score * 100).toFixed(1)}%` : "—"}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: isUnfit ? 800 : 400, color: isUnfit ? T.red : T.t4, textAlign: "right" }}>
                        {g.rate_unfit != null ? `${(g.rate_unfit * 100).toFixed(1)}%` : "—"}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Bottom: Top 3 per group — full width */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
            <div style={{ fontSize: 13, color: T.t4, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>
              Top 5 Qualidade por Grupo
            </div>
            <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${gridCols(Math.max(topByGroup.length, 1))}, 1fr)`, gridAutoRows: "1fr", gap: 10 }}>
              {topByGroup.map(g => {
                const groupScore = groups.find(gr => gr.group === g.group);
                const c = scoreColor(groupScore?.avg_score);
                const gc = GROUP_COLORS[g.group] || c;
                return (
                  <div key={g.group} style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: "14px 18px",
                    display: "flex", flexDirection: "column", gap: 8,
                    overflow: "hidden", position: "relative",
                    boxShadow: `${T.cardShadow}, 0 0 24px ${gc}10`,
                  }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${gc}cc, ${gc}22)` }} />
                    {/* Group header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: T.t1 }}>{g.group.replace("BR-ATD-", "")}</span>
                      {groupScore && (
                        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                          <span style={{ fontSize: 26, fontWeight: 900, color: c, textShadow: T.isDark ? `0 0 16px ${c}55` : "none" }}>
                            {groupScore.avg_score?.toFixed(2)}
                          </span>
                          <span style={{ fontSize: 12, color: T.t5, marginLeft: 2 }}>/10</span>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {groupScore && (
                      <div style={{ background: T.borderControl, borderRadius: 4, overflow: "hidden", height: 4, flexShrink: 0 }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, ((groupScore.avg_score || 0) - 7) / 3 * 100))}%`, height: "100%", background: `linear-gradient(90deg, ${gc}, ${gc}55)`, transition: "width 1.2s ease" }} />
                      </div>
                    )}

                    {/* Ranking rows */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap: 6 }}>
                      {g.top.length === 0 ? (
                        <div style={{ fontSize: 13, color: T.t5 }}>Sem avaliações suficientes (mín. 3)</div>
                      ) : (
                        g.top.map((p, i) => {
                          const sc = scoreColor(p.avg_score);
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                                background: MEDAL[i] + "20", border: `2px solid ${MEDAL[i]}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, fontWeight: 900, color: MEDAL[i],
                                ...(i === 0 ? { '--pc': gc + '55', animation: 'pulse-qual 2.5s ease-in-out infinite' } : {}),
                              }}>{i + 1}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div title={p.designer_name} style={{ fontSize: 15, fontWeight: 700, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.designer_name}</div>
                                <div style={{ fontSize: 12, color: T.t4, marginTop: 2 }}>{p.position} · {p.score_qty} casos</div>
                              </div>
                              <div style={{ fontSize: 22, fontWeight: 900, color: sc, flexShrink: 0, textShadow: T.isDark ? `0 0 12px ${sc}66` : "none" }}>
                                {p.avg_score?.toFixed(2)}
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

        </div>
      )}
    </div>
  );
}

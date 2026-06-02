import React, { useEffect, useState } from "react";
import api from "../api";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from "recharts";
import { T, progColor, ATD_PREFIX, gridCols } from "../theme";

function fmtDateFull(d) {
  if (!d) return "";
  const [year, m, day] = d.split("-");
  const dt = new Date(`${year}-${m}-${day}T12:00:00`);
  const dow = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][dt.getDay()];
  return `${dow}, ${day}/${m}/${year}`;
}

const SHORT = g => g.replace("BR-ATD-", "").replace("BR-", "");

const MEDAL = ["#ffd700", "#c0c0c0", "#cd7f32"];

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: T.cardShadow }}>
      <div style={{ color: T.t4, marginBottom: 5, fontWeight: 700 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color || p.fill, flexShrink: 0 }} />
          <span style={{ color: T.t3 }}>{p.name}:</span>
          <span style={{ color: T.t1, fontWeight: 700 }}>
            {p.name === "Progresso" ? `${(p.value * 100).toFixed(1)}%` : Math.round(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function OverallProductivityScreen() {
  const [groups, setGroups]       = useState([]);
  const [topByGroup, setTopByGroup] = useState([]);
  const [latestDate, setLatestDate] = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");

  async function load() {
    try {
      const [gd, td] = await Promise.all([
        api.get("/metrics/productivity/groups"),
        api.get("/metrics/productivity/top-by-group?n=5"),
      ]);
      const allGroups = gd.data.groups || [];
      const allTop = td.data.groups || [];
      setGroups(allGroups.filter(g => g.group?.startsWith(ATD_PREFIX)));
      setTopByGroup(allTop.filter(g => g.group?.startsWith(ATD_PREFIX)));
      setLatestDate(gd.data.date || "");
      setRefreshedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) { console.error(e); }
  }

  useEffect(() => { load(); const t = setInterval(load, 10 * 60 * 1000); return () => clearInterval(t); }, []);

  const noData = groups.length === 0;
  const chartData = groups.map(g => ({
    name: SHORT(g.group),
    fullName: g.group,
    completed: Math.round(g.totalCompleted),
    quota: Math.round(g.totalQuota),
    progress: g.progress,
    pending: Math.round(g.totalUncompleted),
  }));

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "16px 28px", gap: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 42, fontWeight: 900, color: T.t1, letterSpacing: -1.5, textWrap: 'balance' }}>Produtividade — Por Grupo</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.t2, background: T.bgControl, padding: "8px 20px", borderRadius: 20, border: `1px solid ${T.borderControl}`, boxShadow: T.pillShadow }}>
          {latestDate ? fmtDateFull(latestDate) : "Sem dados"}
          {refreshedAt && <span style={{ color: T.t5, fontSize: 12, marginLeft: 8 }}>↻ {refreshedAt}</span>}
        </div>
      </div>

      {noData ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.t5, fontSize: 17 }}>
          Faça upload do arquivo de produtividade para visualizar
        </div>
      ) : (
        <>
          <div style={{ background: T.bgControl, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 22px", flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: T.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              Comparativo — Concluídos vs Cota · Linha = Progresso %
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <ComposedChart data={chartData} margin={{ top: 6, right: 48, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCompleteATD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.blue} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={T.blue} stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={T.bgControl} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: T.t3, fontSize: 14, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: T.t4, fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right"
                  tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: T.t4, fontSize: 13 }} axisLine={false} tickLine={false}
                  domain={[0, 1]} />
                <Tooltip content={<TT />} />
                <ReferenceLine yAxisId="right" y={0.8} stroke={T.yellow} strokeDasharray="6 4" strokeWidth={2}
                  label={{ value: "Meta 80%", fill: T.yellow, fontSize: 13, position: "insideTopRight" }} />
                <Bar yAxisId="left" dataKey="quota" name="Cota" fill={T.bgControl} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="completed" name="Concluídos" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={progColor(d.progress)} fillOpacity={0.8} />)}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="progress" name="Progresso"
                  stroke={T.t1} strokeWidth={3} strokeDasharray="6 3"
                  dot={{ r: 6, fill: T.t1, stroke: "#0a0e1a", strokeWidth: 2 }}
                  activeDot={{ r: 7 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols(Math.max(groups.length, 1))}, 1fr)`, gap: 10, flex: 1, minHeight: 0 }}>
            {groups.map(g => {
              const top = (topByGroup.find(t => t.group === g.group) || {}).top || [];
              const c = progColor(g.progress);
              const delta = g.progress != null ? ((g.progress - 0.8) * 100).toFixed(1) : null;
              return (
                <div key={g.group} style={{ background: T.bgControl, border: `1px solid ${c}55`, borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 40px ${c}0d`, overflow: "hidden", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.t1 }}>{g.group.replace("BR-ATD-", "")}</span>
                    <span style={{ fontSize: 28, fontWeight: 900, color: c, textShadow: `0 0 20px ${c}55` }}>{g.progress != null ? `${(g.progress * 100).toFixed(1)}%` : "—"}</span>
                  </div>
                  <div style={{ background: T.bgControl, borderRadius: 5, overflow: "hidden", height: 7 }}>
                    <div style={{ width: `${Math.min(100, (g.progress || 0) * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${c}, ${c}55)`, transition: "width 1.2s ease", boxShadow: `0 0 8px ${c}66` }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: T.t4 }}>{Math.round(g.totalCompleted)} / {Math.round(g.totalQuota)} · {Math.round(g.totalUncompleted)} pend.</span>
                    {delta != null && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: g.progress >= 0.8 ? "#22c55e" : "#ef4444" }}>
                        {g.progress >= 0.8 ? "+" : ""}{delta}% meta
                      </span>
                    )}
                  </div>
                  {top.length > 0 && (
                    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly" }}>
                      {top.map((p, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: MEDAL[i] || T.t4, fontWeight: 800, width: 20, flexShrink: 0 }}>{i + 1}º</span>
                          <span title={p.designer_name} style={{ flex: 1, fontSize: 13, color: T.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.designer_name}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: progColor(p.progress), flexShrink: 0 }}>{(p.progress * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Status strip */}
          {(() => {
            const behind = groups.filter(g => g.progress != null && g.progress < 0.6);
            const atRisk = groups.filter(g => g.progress != null && g.progress >= 0.6 && g.progress < 0.7);
            if (behind.length === 0 && atRisk.length === 0) return (
              <div style={{ flexShrink: 0, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10, padding: "9px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, boxShadow: `0 0 10px ${T.green}`, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: T.green }}>Todos os grupos dentro da meta de produtividade</span>
              </div>
            );
            const parts = [
              ...(behind.length ? [`${behind.length} grupo${behind.length > 1 ? "s" : ""} abaixo de 60%: ${behind.map(g => g.group.replace("BR-ATD-", "")).join(", ")}`] : []),
              ...(atRisk.length ? [`${atRisk.length} grupo${atRisk.length > 1 ? "s" : ""} em risco (60–70%): ${atRisk.map(g => g.group.replace("BR-ATD-", "")).join(", ")}`] : []),
            ];
            return (
              <div style={{ flexShrink: 0, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "9px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: T.red, boxShadow: `0 0 10px ${T.red}`, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#fca5a5" }}>{parts.join("  ·  ")}</span>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

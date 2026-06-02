import React from "react";
import { T } from "../theme";
import {
  ResponsiveContainer, AreaChart, Area, ComposedChart,
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
  ScatterChart, Scatter, ZAxis,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";

const getTick = () => ({ fill: T.t3, fontSize: 14 });
const getTickSm = () => ({ fill: T.t3, fontSize: 13 });


function fmtDate(d) {
  if (!d) return "";
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

const BaseTT = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 14, boxShadow: T.cardShadow }}>
      <div style={{ color: T.t4, marginBottom: 7, fontSize: 13, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color || p.fill || "#3b82f6", flexShrink: 0 }} />
          <span style={{ color: T.t3 }}>{p.name}:</span>
          <span style={{ color: T.t1, fontWeight: 700 }}>{fmt ? fmt(p.value, p.name) : p.value?.toFixed?.(2) ?? p.value}</span>
        </div>
      ))}
    </div>
  );
};

const pctFmt = v => `${(v * 100).toFixed(1)}%`;
const numFmt = v => v?.toFixed?.(1) ?? v;

function scoreColor(v) {
  if (v >= 0.8) return "#34d399";
  if (v >= 0.6) return "#fbbf24";
  return "#f87171";
}

// ─── Area with gradient fill + optional value+delta labels ───────────────────
export function AreaTrend({ data, dataKey, color = "#3b82f6", target, pct = false, height = 200, id = "a", showLabels = false }) {
  const gid = `grad-${id}`;
  const tickFmt = pct ? v => `${(v * 100).toFixed(0)}%` : v => v?.toFixed(1);
  const ttFmt   = pct ? v => pctFmt(v) : numFmt;

  const renderDot = showLabels
    ? (props) => {
        const { cx, cy, index, payload } = props;
        if (cx == null || cy == null) return null;
        const val  = payload[dataKey];
        if (val == null) return null;
        const prev  = index > 0 ? data[index - 1]?.[dataKey] : null;
        const delta = prev != null ? val - prev : null;
        const valStr  = pct ? `${(val * 100).toFixed(0)}%` : val?.toFixed(2);
        const dAbs    = delta != null ? (pct ? `${(Math.abs(delta) * 100).toFixed(1)}pp` : Math.abs(delta).toFixed(2)) : null;
        const dSign   = delta != null ? (delta >= 0 ? "▲" : "▼") : null;
        const dColor  = delta != null ? (delta >= 0 ? "#34d399" : "#f87171") : null;
        return (
          <g key={props.key}>
            <circle cx={cx} cy={cy} r={5} fill={color} stroke="#0a0e1a" strokeWidth={2} />
            <text x={cx} y={cy - 10} textAnchor="middle" dominantBaseline="auto" fill={color} fontSize={11} fontWeight="800">{valStr}</text>
            {dSign && <text x={cx} y={cy - 22} textAnchor="middle" dominantBaseline="auto" fill={dColor} fontSize={10} fontWeight="700">{dSign}{dAbs}</text>}
          </g>
        );
      }
    : null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: showLabels ? 46 : 14, right: 14, left: -8, bottom: 8 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.5} />
            <stop offset="95%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke={T.border} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={getTick()} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={tickFmt} tick={getTick()} axisLine={false} tickLine={false}
          domain={pct
            ? [0, Math.max(1, ...(data.map(d => d[dataKey] || 0)))]
            : [
                d => target != null ? Math.min(d - 0.15, target - 0.9) : d - 0.15,
                d => target != null ? Math.max(d + 0.25, target + 0.35) : d + 0.25,
              ]} />
        <Tooltip content={<BaseTT fmt={(v) => ttFmt(v)} />} />
        {target !== undefined && (
          <ReferenceLine y={target} stroke="#f59e0b" strokeDasharray="7 5" strokeWidth={2}
            label={{ value: pct ? `Meta ${(target * 100).toFixed(0)}%` : `Meta ${target}`, fill: "#f59e0b", fontSize: 12, fontWeight: 800, position: "insideTopLeft", dy: -4 }} />
        )}
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5}
          fill={`url(#${gid})`}
          dot={showLabels ? renderDot : { r: 5, fill: color, stroke: "#0a0e1a", strokeWidth: 2 }}
          activeDot={{ r: 7, fill: color, stroke: "#0a0e1a", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Area with auto-colored dots (progress 0→1) ──────────────────────────────
export function ProgressAreaTrend({ data, dataKey, target, height = 200, id = "p", color = "#3b82f6" }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 14, right: 14, left: -8, bottom: 20 }}>
        <defs>
          <linearGradient id={`gprog-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.45} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke={T.border} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: T.t3, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={12} />
        <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={getTick()} axisLine={false} tickLine={false} domain={[0, 1]} />
        <Tooltip content={<BaseTT fmt={v => pctFmt(v)} />} />
        {target !== undefined && (
          <ReferenceLine y={target} stroke="#f59e0b" strokeDasharray="7 5" strokeWidth={2}
            label={{ value: `Meta ${(target * 100).toFixed(0)}%`, fill: "#f59e0b", fontSize: 13, position: "insideTopRight" }} />
        )}
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3}
          fill={`url(#gprog-${id})`}
          dot={(props) => {
            const { cx, cy, payload } = props;
            const c = scoreColor(payload[dataKey]);
            return <circle key={props.key} cx={cx} cy={cy} r={6} fill={c} stroke="#0a0e1a" strokeWidth={2} />;
          }}
          activeDot={{ r: 8, fill: color }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Composed: quota bars + completed bars + progress line ───────────────────
export function ComposedTrend({ data, height = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 14, right: 40, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={T.border} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={getTick()} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={getTick()} axisLine={false} tickLine={false} />
        <YAxis yAxisId="right" orientation="right"
          tickFormatter={v => `${(v * 100).toFixed(0)}%`}
          tick={getTick()} axisLine={false} tickLine={false} domain={[0, 1]} />
        <Tooltip content={<BaseTT fmt={(v, n) => n === "Progresso" ? pctFmt(v) : Math.round(v).toString()} />} />
        <Bar yAxisId="left" dataKey="totalQuota" name="Cota" fill={T.border} radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="totalCompleted" name="Concluídos" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={scoreColor(d.progress)} fillOpacity={0.8} />)}
        </Bar>
        <Line yAxisId="right" type="monotone" dataKey="progress" name="Progresso"
          stroke="#e2e8f0" strokeWidth={2.5} strokeDasharray="6 3"
          dot={{ r: 4, fill: "#e2e8f0", stroke: "#0a0e1a", strokeWidth: 1.5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Designer bars: score ranking with volume label ───────────────────────────
export const GROUP_COLORS = {
  "BR-ATD-BR1": "#4b93ff",
  "BR-ATD-BR2": "#10b981",
  "BR-ATD-BR3": "#f59e0b",
  "BR-ATD-BR4": "#8b5cf6",
  "BR-ATD-BR5": "#06b6d4",
  "BR-ATP": "#f97316",
};

const SCATTER_PALETTE = ["#4b93ff","#10b981","#f59e0b","#8b5cf6","#06b6d4","#f97316","#ef4444","#ec4899"];

function shortName(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function scoreBarColor(v) {
  if (v >= 9)   return "#34d399";
  if (v >= 8.5) return "#60a5fa";
  if (v >= 8)   return "#a78bfa";
  return "#fbbf24";
}

const DesignerBarTT = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 14, boxShadow: T.cardShadow, maxWidth: 240 }}>
      <div style={{ fontWeight: 700, color: T.t1, marginBottom: 4 }}>{d.fullName}</div>
      <div style={{ fontSize: 13, color: T.t4, marginBottom: 8 }}>{d.group} · {d.position}</div>
      <div style={{ display: "flex", gap: 18 }}>
        <span style={{ color: T.t3 }}>Score: <strong style={{ color: scoreBarColor(d.score) }}>{d.score?.toFixed(2)}</strong></span>
        <span style={{ color: T.t3 }}>Casos: <strong style={{ color: T.t1 }}>{d.qty}</strong></span>
      </div>
    </div>
  );
};

export function DesignerBars({ designers = [], height = 220 }) {
  const maxRows = Math.floor(height / 22);
  const data = [...designers]
    .sort((a, b) => b.avg_score - a.avg_score)
    .slice(0, maxRows)
    .map(d => ({
      name: shortName(d.designer_name),
      score: +(d.avg_score || 0).toFixed(2),
      qty: d.score_qty,
      fullName: d.designer_name,
      group: d.group_no,
      position: d.position,
    }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 2, right: 52, left: 4, bottom: 2 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={T.border} horizontal={false} />
        <XAxis type="number" domain={[7, 10]} tick={getTickSm()} axisLine={false} tickLine={false} tickCount={7} />
        <YAxis type="category" dataKey="name" tick={{ fill: T.t2, fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} width={88} />
        <Tooltip content={<DesignerBarTT />} />
        <ReferenceLine x={8.5} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5} />
        <Bar dataKey="score" radius={[0, 5, 5, 0]} background={{ fill: T.border, radius: [0, 5, 5, 0] }}
          label={{ position: "right", fontSize: 13, fontWeight: 700, fill: T.t1, formatter: v => v.toFixed(2) }}>
          {data.map((d, i) => (
            <Cell key={i} fill={scoreBarColor(d.score)} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DesignerScatter({ designers = [], height = 220 }) {
  return <DesignerBars designers={designers} height={height} />;
}

// ─── Horizontal bar: by position ─────────────────────────────────────────────
export function HorizBar({ data, dataKey = "score", domain = [7, 10], height = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={T.border} horizontal={false} />
        <XAxis type="number" domain={domain} tick={getTickSm()} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: T.t2, fontSize: 13 }} axisLine={false} tickLine={false} width={46} />
        <Tooltip content={<BaseTT fmt={v => v?.toFixed(2)} />} />
        <Bar dataKey={dataKey} radius={[0, 6, 6, 0]} background={{ fill: T.border, radius: [0, 6, 6, 0] }}>
          {data.map((d, i) => (
            <Cell key={i} fill={d[dataKey] >= 9 ? "#34d399" : d[dataKey] >= 8.5 ? "#60a5fa" : d[dataKey] >= 8 ? "#a78bfa" : "#fbbf24"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Radar: groups multi-metric ──────────────────────────────────────────────
export function GroupRadar({ groups = [], height = 300 }) {
  if (!groups.length) return null;
  const groupNames = groups.map(g => g.group);
  const COLORS = ["#4b93ff", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444"];
  const radarData = [
    { metric: "Score Médio", ...Object.fromEntries(groups.map(g => [g.group, +(g.avg_score || 0).toFixed(2)])) },
    { metric: "Aprovação", ...Object.fromEntries(groups.map(g => [g.group, +((1 - (g.rate_low_score || 0)) * 10).toFixed(2)])) },
    { metric: "Preferência", ...Object.fromEntries(groups.map(g => [g.group, +((1 - (g.rate_unfit || 0)) * 10).toFixed(2)])) },
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={radarData} margin={{ top: 16, right: 32, left: 32, bottom: 16 }}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "#b0c4d8", fontSize: 14, fontWeight: 600 }} />
        <PolarRadiusAxis domain={[7, 10]} tick={{ fill: "#8aaabf", fontSize: 12 }} tickCount={4} />
        {groupNames.map((g, i) => (
          <Radar key={g} name={g.replace("BR-ATD-", "").replace("BR-", "")}
            dataKey={g} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]}
            fillOpacity={0.14} strokeWidth={2.5} dot={{ r: 4 }} />
        ))}
        <Legend iconType="circle" iconSize={10}
          formatter={v => <span style={{ color: "#b0c4d8", fontSize: 13 }}>{v.replace("BR-ATD-", "").replace("BR-", "")}</span>} />
        <Tooltip content={<BaseTT fmt={v => v?.toFixed(2)} />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── Bar trend ───────────────────────────────────────────────────────────────
export function BarTrend({ data, dataKey, color = "#3b82f6", target, pct = false, height = 180 }) {
  const tickFmt = pct ? v => `${(v * 100).toFixed(0)}%` : v => v?.toFixed(0);
  const colorAt = v => pct ? scoreColor(v) : color;
  // For pct charts, zoom into actual data range (not 0–100%) so bars are visible
  const pctDomain = [0, d => Math.min(1, d > 0 ? +(d * 1.6).toFixed(3) : 0.25)];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={T.border} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={getTickSm()} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={tickFmt} tick={getTickSm()} axisLine={false} tickLine={false}
          domain={pct ? pctDomain : ["auto", "auto"]} />
        <Tooltip content={<BaseTT fmt={pct ? v => pctFmt(v) : numFmt} />} />
        {target !== undefined && <ReferenceLine y={target} stroke="#f59e0b" strokeDasharray="6 4" strokeWidth={1.5} />}
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}
          label={pct ? {
            position: "top",
            formatter: v => v > 0 ? `${(v * 100).toFixed(1)}%` : "",
            fontSize: 11, fontWeight: 700, fill: "#8aaabf",
          } : false}>
          {data.map((d, i) => <Cell key={i} fill={colorAt(d[dataKey])} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineTrend({ data, dataKey, color = "#3b82f6", target, pct = false, height = 180 }) {
  const tickFmt = pct ? v => `${(v * 100).toFixed(0)}%` : v => v?.toFixed(1);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={T.border} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={getTick()} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={tickFmt} tick={getTick()} axisLine={false} tickLine={false} domain={pct ? [0, 1] : ["auto", "auto"]} />
        <Tooltip content={<BaseTT fmt={pct ? v => pctFmt(v) : numFmt} />} />
        {target !== undefined && <ReferenceLine y={target} stroke="#f59e0b" strokeDasharray="6 4" strokeWidth={1.5} />}
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3}
          dot={{ r: 5, fill: color, stroke: "#0a0e1a", strokeWidth: 2 }} activeDot={{ r: 7 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

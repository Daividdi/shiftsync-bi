import React, { useEffect, useState } from "react";
import { TrendingUp, Users, AlertTriangle, Activity } from "lucide-react";
import api from "../api";
import KPICard from "../components/KPICard";
import ProgressBar from "../components/ProgressBar";
import { ProgressAreaTrend } from "../components/TrendChart";
import { T, progColor } from "../theme";

function fmtDateFull(d) {
  if (!d) return "";
  const [year, m, day] = d.split("-");
  const dt = new Date(`${year}-${m}-${day}T12:00:00`);
  const dow = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][dt.getDay()];
  return `${dow}, ${day}/${m}/${year}`;
}

const MEDAL = ["#ffd700", "#c0c0c0", "#cd7f32"];

function RankRow({ rank, name, progress, completed, quota }) {
  const pct = Math.min(1, progress || 0);
  const c = progColor(pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "13px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: MEDAL[rank] + "22", border: `2px solid ${MEDAL[rank]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: MEDAL[rank], flexShrink: 0 }}>{rank + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontSize: 13, color: T.t4 }}>{Math.round(completed)} / {Math.round(quota)} casos</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: c, flexShrink: 0 }}>{(pct * 100).toFixed(0)}%</div>
      </div>
      <div style={{ background: T.bgControl, borderRadius: 4, overflow: "hidden", height: 5 }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: `linear-gradient(90deg, ${c}, ${c}66)`, borderRadius: 4, transition: "width 1.2s ease", boxShadow: `0 0 8px ${c}66` }} />
      </div>
    </div>
  );
}

export default function ATPProductivityScreen() {
  const [today, setToday] = useState(null);
  const [yesterday, setYesterday] = useState(null);
  const [trend, setTrend] = useState([]);
  const [top, setTop] = useState([]);
  const [latestDate, setLatestDate] = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");

  async function load() {
    try {
      const [td, tr, tp] = await Promise.all([
        api.get("/metrics/productivity/today?groupType=atp"),
        api.get("/metrics/productivity/trend?days=10&groupType=atp"),
        api.get("/metrics/productivity/top?n=5&groupType=atp"),
      ]);
      setToday(td.data.today);
      setYesterday(td.data.yesterday);
      setLatestDate(td.data.latestDate || "");
      setTrend(tr.data || []);
      setTop(tp.data.rankings || []);
      setRefreshedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) { console.error(e); }
  }

  useEffect(() => { load(); const t = setInterval(load, 10 * 60 * 1000); return () => clearInterval(t); }, []);

  const noData = !today;
  const prog = today?.progress;
  const c = progColor(prog);
  const delta = (today && yesterday?.progress != null) ? (today.progress - yesterday.progress) : null;

  const bestDay    = trend.length ? Math.max(...trend.map(d => d.progress || 0)) : null;
  const avgProg    = trend.length ? trend.reduce((s, d) => s + (d.progress || 0), 0) / trend.length : null;
  const totalCases = trend.length ? Math.round(trend.reduce((s, d) => s + (d.totalCompleted || 0), 0)) : null;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "18px 30px", gap: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 42, fontWeight: 900, color: T.t1, letterSpacing: -1.5, textWrap: "balance" }}>
            Produtividade <span style={{ color: T.orange, fontSize: 32 }}>ATP</span>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.t2, background: T.bgControl, padding: "8px 20px", borderRadius: 20, border: `1px solid ${T.borderControl}`, boxShadow: T.pillShadow }}>
          {latestDate ? fmtDateFull(latestDate) : "Sem dados"}
          {refreshedAt && <span style={{ color: T.t5, fontSize: 12, marginLeft: 8 }}>↻ {refreshedAt}</span>}
        </div>
      </div>

      {noData ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.t5, fontSize: 20 }}>
          Faça upload do arquivo de produtividade para visualizar
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, flexShrink: 0 }}>
            <KPICard title="Progresso ATP" value={prog != null ? `${(prog * 100).toFixed(1)}%` : "—"}
              sub={`${Math.round(today?.totalCompleted || 0)} / ${Math.round(today?.totalQuota || 0)} casos`}
              icon={<TrendingUp size={14} />} color={T.orange} delta={delta} />
            <KPICard title="Casos Pendentes" value={Math.round(today?.totalUncompleted || 0)}
              sub="com cota atribuída"
              icon={<AlertTriangle size={14} />}
              color={today?.totalUncompleted > 200 ? T.red : T.yellow} />
            <KPICard title="Designers Ativos" value={today?.activeCount || 0}
              sub="em turno hoje"
              icon={<Users size={14} />} color={T.orange} />
            <KPICard title="Média / Designer" value={(today?.avgCompleted || 0).toFixed(1)}
              sub={`meta: ${today?.totalQuota && today?.activeCount ? (today.totalQuota / today.activeCount).toFixed(1) : "—"} casos`}
              icon={<Activity size={14} />} color={T.yellow} />
          </div>

          <div style={{ background: T.bgControl, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 22px", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: T.t4, textTransform: "uppercase", letterSpacing: 1 }}>Meta Diária — Progresso ATP</span>
              <span style={{ fontSize: 13, color: T.t4 }}>D-1: {yesterday?.progress != null ? `${(yesterday.progress * 100).toFixed(1)}%` : "—"}</span>
            </div>
            <ProgressBar value={prog} color={T.orange} height={32} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>
            <div style={{ background: T.bgControl, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 22px", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
              <div style={{ fontSize: 13, color: T.t4, textTransform: "uppercase", letterSpacing: 1 }}>
                Atingimento Diário — Últimos {trend.length} Dias
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ProgressAreaTrend
                  data={trend.map(d => ({ date: d.date, progress: d.progress }))}
                  dataKey="progress" target={0.8} id="prod-atp-main" color={T.orange}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, flexShrink: 0 }}>
                {[
                  { label: "Melhor dia", value: bestDay != null ? `${(bestDay * 100).toFixed(0)}%` : "—", color: T.green },
                  { label: `Média ${trend.length}d`, value: avgProg != null ? `${(avgProg * 100).toFixed(0)}%` : "—", color: T.orange },
                  { label: "Casos (período)", value: totalCases != null ? totalCases.toLocaleString() : "—", color: T.yellow },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: T.bgControl, borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: T.t5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: T.bgControl, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 22px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ fontSize: 13, color: T.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                Top ATP — D-1
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {top.length === 0 ? (
                  <div style={{ color: T.t5, fontSize: 15, marginTop: 20 }}>Sem dados</div>
                ) : (
                  top.slice(0, 5).map((p, i) => (
                    <RankRow key={i} rank={i}
                      name={p.designer_name}
                      progress={p.progress} completed={p.completed} quota={p.quota}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

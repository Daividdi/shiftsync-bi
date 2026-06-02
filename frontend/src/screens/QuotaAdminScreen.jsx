import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Save, X, Trash2, RefreshCw, Search } from "lucide-react";
import api from "../api";
import UploadPage from "./UploadPage";
import { T, progColor, GROUP_COLORS } from "../theme";

const today = () => new Date().toISOString().slice(0, 10);

function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtWeekRange(start, end) {
  if (!start || !end) return "";
  const [, sm, sd] = start.split("-");
  const [, em, ed] = end.split("-");
  return `${sd}/${sm} – ${ed}/${em}`;
}

function getWeeksFromDates(dates) {
  const weeks = {};
  for (const d of dates) {
    const dt = new Date(d + "T12:00:00");
    const dow = dt.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(dt); mon.setDate(dt.getDate() + diff);
    const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
    const key = mon.toISOString().slice(0, 10);
    if (!weeks[key]) weeks[key] = { start: key, end: fri.toISOString().slice(0, 10), dates: [] };
    weeks[key].dates.push(d);
  }
  return Object.values(weeks).sort((a, b) => b.start.localeCompare(a.start));
}

function AttainmentPct({ progress }) {
  if (progress == null) return <span style={{ color: T.t5, fontSize: 12 }}>—</span>;
  const pct = Math.round(progress * 100);
  const over = pct > 100;
  const c = over ? "#34d399" : pct >= 85 ? "#fbbf24" : pct >= 70 ? "#f97316" : "#f87171";
  const barW = Math.min(pct, 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: c, fontVariantNumeric: "tabular-nums" }}>
          {pct}%
        </span>
        {over && <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700 }}>↑</span>}
      </div>
      <div style={{ position: "relative", height: 4, background: T.border, borderRadius: 2, width: 70 }}>
        <div style={{ width: `${barW}%`, height: "100%", background: c, borderRadius: 2, transition: "width 0.4s" }} />
        {over && <div style={{ position: "absolute", right: 0, top: -1, bottom: -1, width: 2, background: "#34d399", borderRadius: 1 }} />}
      </div>
    </div>
  );
}

function mkInput(T) {
  return {
    background: T.card,
    border: "1px solid " + T.border,
    borderRadius: 8, padding: "8px 12px",
    color: T.t1, fontSize: 13,
    outline: "none", fontFamily: "inherit",
    width: "100%", boxSizing: "border-box",
  };
}

function mkCard(T) {
  return {
    background: T.cardAlt,
    border: "1px solid " + T.border,
    borderRadius: 14,
  };
}

// Main tab button (Metas / Atingimento)
function TabBtn({ active, onClick, children, color = T.blue }) {
  return (
    <button onClick={onClick} style={{
      background: active ? `${color}28` : T.bgControl,
      border: `1px solid ${active ? color : T.borderControl}`,
      borderRadius: 8, padding: "7px 18px",
      color: active ? color : T.t3,
      fontSize: 13, cursor: "pointer", fontWeight: active ? 700 : 500,
      transition: "all 0.15s",
    }}>{children}</button>
  );
}

// Group filter chip (Todos / BR1 / BR2 …)
function GroupChip({ active, onClick, label, color }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 5,
      background: active ? `${color}28` : T.bgControl,
      border: `1.5px solid ${active ? color : T.borderControl}`,
      borderRadius: 20, padding: "5px 12px",
      color: active ? color : T.t3,
      fontSize: 12, cursor: "pointer", fontWeight: active ? 700 : 500,
      transition: "all 0.15s",
    }}>
      {color && <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? color : T.t5, flexShrink: 0, transition: "background 0.15s" }} />}
      {label}
    </button>
  );
}

// Compact label for non-production groups in filter chips and table rows
function groupShortLabel(g) {
  if (!g) return "—";
  if (g === "BR-Basic QC")          return "QC";
  if (g === "Brazilian Medical Center") return "Medical";
  if (g === "BR-ATD")               return "ATD";
  return g.replace("BR-ATD-", "").replace("BR-", "").slice(0, 10);
}



export default function QuotaAdminScreen({ onBack }) {
  const [designers, setDesigners] = useState([]);
  const [quotas,    setQuotas]    = useState([]);
  const [groups,    setGroups]    = useState([]);
  const [attDates,  setAttDates]  = useState([]);

  const [mainTab,       setMainTab]       = useState("quotas");
  const [attPeriod,     setAttPeriod]     = useState("diario");
  const [groupFilter,   setGroupFilter]   = useState("all");
  const [search,        setSearch]        = useState("");
  const [attDate,       setAttDate]       = useState(null);
  const [selWeek,       setSelWeek]       = useState(null);
  const [attainment,    setAttainment]    = useState([]);
  const [attGroupFilter, setAttGroupFilter] = useState("all");
  const [saved, setSaved] = useState(false);
  const INFO_BOX = (
    <div style={{ padding: "14px 18px", background: T.blue + "12", border: "1px solid " + T.blue + "33", borderRadius: 12, fontSize: 11.5, color: T.t3, lineHeight: 1.75, flexShrink: 0 }}>
      <strong style={{ color: T.blue, fontSize: 12 }}>Como funciona</strong><br />
      {"•"} Meta em <strong>pontos/dia</strong>: NC = 1pt {"·"} Ref = 2/3pt {"·"} Mod = 1/3pt.<br />
      {"•"} Meta individual tem prioridade sobre a do grupo.<br />
      {"•"} <strong>Meta 0 = excluído</strong> de todos os gráficos e cálculos (QC, Medical, Design Doctor, Lean…). Para reativar, defina uma meta &gt; 0.<br />
      {"•"} Vigência: o sistema usa sempre o último registro com <em>vigência ≤ hoje</em>. Trocar a vigência amanhã não altera cálculos passados.<br />
      {"•"} Vista Semanal: soma os dias com upload disponível; meta proporcional a esses dias.
    </div>
  );

  const [editDesigner, setEditDesigner] = useState(null);
  const [fQuota, setFQuota] = useState("");
  const [fDate,  setFDate]  = useState(today());
  const [fNotes, setFNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const [q, d, g, av] = await Promise.all([
        api.get("/admin/quotas"),
        api.get("/admin/designers"),
        api.get("/admin/groups"),
        api.get("/metrics/productivity/available-dates"),
      ]);
      setQuotas(q.data);
      setDesigners(d.data);
      setGroups(g.data);
      setAttDates(av.data.dates || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

  const effectiveQuota = useCallback((designerName, groupNo) => {
    const today_str = today();
    const dq = quotas
      .filter(q => q.designer_name === designerName && q.effective_date <= today_str)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
    if (dq) return { quota: dq.quota, source: "designer", id: dq.id };

    const gq = quotas
      .filter(q => q.group_no === groupNo && !q.designer_name && q.effective_date <= today_str)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
    if (gq) return { quota: gq.quota, source: "group", id: gq.id };

    return { quota: null, source: "spreadsheet", id: null };
  }, [quotas]);

  const filteredDesigners = useMemo(() => {
    return designers
      .filter(d => groupFilter === "all" || d.group_no === groupFilter)
      .filter(d => !search || d.designer_name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.designer_name.localeCompare(b.designer_name, "pt-BR"));
  }, [designers, groupFilter, search]);

  const loadDailyAtt = useCallback(async (date) => {
    if (!date) return;
    try {
      const r = await api.get(`/metrics/productivity/attainment?date=${date}`);
      setAttainment(r.data.designers || []);
      setAttDate(r.data.date || date);
    } catch {}
  }, []);

  const loadWeeklyAtt = useCallback(async (week) => {
    if (!week) return;
    try {
      const r = await api.get(`/metrics/productivity/attainment-period?start=${week.start}&end=${week.end}`);
      setAttainment(r.data.designers || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (mainTab !== "atingimento") return;
    if (attPeriod === "diario") {
      const d = attDate || attDates[0];
      if (d) loadDailyAtt(d);
    } else {
      const weeks = getWeeksFromDates(attDates);
      const w = selWeek || weeks[0];
      if (w) { setSelWeek(w); loadWeeklyAtt(w); }
    }
  }, [mainTab, attPeriod, attDates]);

  async function handleSaveQuota(e) {
    e.preventDefault();
    if (!editDesigner || fQuota === "" || !fDate) return;
    try {
      await api.post("/admin/quotas", {
        designer_name: editDesigner.designer_name,
        quota: parseFloat(fQuota),
        effective_date: fDate,
        notes: fNotes || undefined,
      });
      flash(); load(); setEditDesigner(null);
    } catch {}
  }

  async function handleDeleteQuota(id) {
    if (!confirm("Remover esta meta?")) return;
    await api.delete(`/admin/quotas/${id}`);
    load();
  }

  function openEdit(d) {
    const eq = effectiveQuota(d.designer_name, d.group_no);
    setEditDesigner(d);
    setFQuota(eq.quota != null ? String(eq.quota) : "");
    setFDate(today());
    setFNotes("");
  }

  const weeks = useMemo(() => getWeeksFromDates(attDates), [attDates]);

  const attFiltered = attGroupFilter === "all"
    ? attainment
    : attainment.filter(d => d.group_no === attGroupFilter);

  const attSummary = attFiltered.reduce((acc, d) => {
    const pct = d.progress != null ? Math.round(d.progress * 100) : null;
    const k = pct == null ? "—" : pct >= 100 ? "Atingiu" : pct >= 85 ? "Próximo" : pct >= 70 ? "Atenção" : "Crítico";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const attGroups = [...new Set(attainment.map(d => d.group_no).filter(Boolean))].sort();

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", padding: "24px 36px 0", background: T.bg, color: T.t1, fontFamily: "inherit" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.t4, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ fontSize: 26, fontWeight: 900, color: T.t1, letterSpacing: -0.5 }}>
          Metas de Produtividade
        </div>
        {saved && (
          <div style={{ fontSize: 12, fontWeight: 700, color: T.green, background: `${T.green}18`, border: `1px solid ${T.green}44`, borderRadius: 6, padding: "4px 12px" }}>
            Salvo ✓
          </div>
        )}
      </div>

      {/* Main tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexShrink: 0 }}>
        <TabBtn active={mainTab === "quotas"} onClick={() => setMainTab("quotas")}>Metas por Colaborador</TabBtn>
        <TabBtn active={mainTab === "atingimento"} onClick={() => setMainTab("atingimento")} color={T.cyan}>Atingimento</TabBtn>
        <TabBtn active={mainTab === "upload"} onClick={() => setMainTab("upload")} color={T.green}>Upload</TabBtn>
      </div>

      {/* Content — fills remaining height */}
      <div style={{ flex: 1, overflow: "hidden", paddingBottom: mainTab === "upload" ? 0 : 24 }}>

        {/* ─── METAS TAB ─── */}
        {mainTab === "quotas" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, height: "100%" }}>

            {/* Designer list */}
            <div style={{ ...mkCard(T), display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* Filters */}
              <div style={{ padding: "16px 20px 12px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <GroupChip active={groupFilter === "all"} onClick={() => setGroupFilter("all")} label="Todos" color={T.t3} />
                  {groups.map(g => {
                    const isProd = g.startsWith("BR-ATD-BR");
                    const key = isProd ? g.replace("BR-ATD-", "") : groupShortLabel(g);
                    const color = isProd ? (GROUP_COLORS[g] || T.blue) : T.t5;
                    return (
                      <GroupChip key={g} active={groupFilter === g} onClick={() => setGroupFilter(g)} label={key} color={color} />
                    );
                  })}
                </div>
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.t5, pointerEvents: "none" }} />
                  <input
                    type="text"
                    placeholder="Buscar colaborador..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ ...mkInput(T), paddingLeft: 30 }}
                  />
                </div>
              </div>

              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 72px 88px 40px", gap: "0 8px", padding: "6px 20px", borderBottom: `1px solid ${T.border}`, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
                {["Colaborador", "Grupo", "Cota/dia", "Vigência", ""].map(h => (
                  <div key={h} style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 1 }}>{h}</div>
                ))}
              </div>

              {/* Scrollable list */}
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                {filteredDesigners.length === 0 ? (
                  <div style={{ padding: "24px 20px", color: T.t5, fontSize: 14 }}>Nenhum colaborador encontrado</div>
                ) : filteredDesigners.map(d => {
                  const eq = effectiveQuota(d.designer_name, d.group_no);
                  const isSelected = editDesigner?.designer_name === d.designer_name;
                  const isExcluded = eq.quota === 0;
                  const isProd = d.group_no?.startsWith("BR-ATD-BR");
                  const grpKey = isProd ? d.group_no?.replace("BR-ATD-", "") : groupShortLabel(d.group_no);
                  const grpColor = isProd ? (GROUP_COLORS[d.group_no] || T.blue) : T.t5;
                  return (
                    <div key={d.designer_name} onClick={() => openEdit(d)} style={{
                      display: "grid", gridTemplateColumns: "1fr 72px 72px 88px 40px", gap: "0 8px",
                      padding: "9px 20px", cursor: "pointer",
                      borderBottom: `1px solid ${T.borderSubtle}`,
                      background: isSelected ? "rgba(59,130,246,0.08)" : "transparent",
                      transition: "background 0.1s",
                    }}>
                      <div title={d.designer_name} style={{ fontSize: 13, color: isExcluded ? T.t5 : T.t1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.designer_name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: grpColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: grpColor, fontWeight: 600 }}>{grpKey || "—"}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {eq.quota === 0 ? (
                          <span style={{ fontSize: 10, color: T.t5, background: T.bgControl, borderRadius: 4, padding: "1px 6px" }}>excluído</span>
                        ) : eq.quota != null ? (
                          <span style={{ color: eq.source === "designer" ? T.cyan : T.t3 }}>{eq.quota}</span>
                        ) : (
                          <span style={{ color: T.t5, fontSize: 11 }}>planilha</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.t5 }}>
                        {eq.source !== "spreadsheet" && eq.id ? (() => {
                          const rec = quotas.find(q => q.id === eq.id);
                          return rec ? <span style={{ fontSize: 10, color: T.t5 }}>{fmtDate(rec.effective_date)}</span> : null;
                        })() : "—"}
                      </div>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        {eq.id && (
                          <button onClick={ev => { ev.stopPropagation(); handleDeleteQuota(eq.id); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: T.t5, padding: "2px 4px", borderRadius: 4, lineHeight: 1 }}
                            title="Remover meta">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right column: edit panel + info */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", minHeight: 0 }}>

              {/* Edit panel */}
              <div style={{ ...mkCard(T), padding: "22px" }}>
                {!editDesigner ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: T.t5 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>👈</div>
                    <div style={{ fontSize: 13 }}>Selecione um colaborador para definir a meta</div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: T.t1 }}>{editDesigner.designer_name}</div>
                      <div style={{ fontSize: 12, color: T.t4, marginTop: 2 }}>
                        {editDesigner.group_no?.replace("BR-ATD-", "") || "—"}
                        {(() => {
                          const eq = effectiveQuota(editDesigner.designer_name, editDesigner.group_no);
                          if (eq.quota == null) return <span style={{ color: T.t5 }}> · meta da planilha</span>;
                          if (eq.source === "group") return <span style={{ color: T.t5 }}> · herda do grupo ({eq.quota})</span>;
                          return null;
                        })()}
                      </div>
                    </div>

                    <form onSubmit={handleSaveQuota} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 11, color: T.t5, display: "block", marginBottom: 4 }}>COTA DIÁRIA (pontos)</label>
                        <input type="number" step="0.5" min="0" value={fQuota} onChange={e => setFQuota(e.target.value)}
                          style={mkInput(T)} placeholder="0 = excluído dos cálculos" required />
                        <div style={{ fontSize: 10, color: T.t5, marginTop: 4 }}>NC=1pt · Mod=0.67pt · Ref=0.5pt · 0=Trainee/QC</div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: T.t5, display: "block", marginBottom: 4 }}>VIGÊNCIA A PARTIR DE</label>
                        <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={mkInput(T)} required />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: T.t5, display: "block", marginBottom: 4 }}>OBSERVAÇÃO (opcional)</label>
                        <input type="text" value={fNotes} onChange={e => setFNotes(e.target.value)} style={mkInput(T)} placeholder="Ex: revisão pós-treinamento" />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="submit" style={{
                          flex: 1, background: `${T.blue}22`, border: `1px solid ${T.blue}66`,
                          borderRadius: 8, padding: "10px 0",
                          color: T.blue, fontSize: 13, cursor: "pointer", fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}>
                          <Save size={14} /> Salvar Meta
                        </button>
                        <button type="button" onClick={() => setEditDesigner(null)} style={{
                          background: T.bgControl, border: `1px solid ${T.borderControl}`,
                          borderRadius: 8, padding: "10px 14px",
                          color: T.t4, fontSize: 13, cursor: "pointer",
                          display: "flex", alignItems: "center",
                        }}>
                          <X size={14} />
                        </button>
                      </div>
                    </form>

                    {/* History */}
                    {(() => {
                      const hist = quotas.filter(q => q.designer_name === editDesigner.designer_name).sort((a, b) => b.effective_date.localeCompare(a.effective_date));
                      if (!hist.length) return null;
                      return (
                        <div style={{ marginTop: 20, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
                          <div style={{ fontSize: 11, color: T.t5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Histórico</div>
                          {hist.map(h => (
                            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.borderSubtle}` }}>
                              <span style={{ fontSize: 12, color: h.quota === 0 ? T.t5 : T.cyan, fontWeight: 700 }}>
                                {h.quota === 0 ? "excluído" : h.quota}
                              </span>
                              <span style={{ fontSize: 11, color: T.t4 }}>{fmtDate(h.effective_date)}</span>
                              <span style={{ fontSize: 11, color: T.t5, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.notes || ""}</span>
                              <button onClick={() => handleDeleteQuota(h.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: T.t5, padding: 0, lineHeight: 1 }}>
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Como funciona */}
              {INFO_BOX}
            </div>
          </div>
        )}

        {/* ─── ATINGIMENTO TAB ─── */}
        {mainTab === "atingimento" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>

            {/* Controls row */}
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <TabBtn active={attPeriod === "diario"} onClick={() => { setAttPeriod("diario"); setAttainment([]); }} color={T.blue}>Diário</TabBtn>
              <TabBtn active={attPeriod === "semanal"} onClick={() => { setAttPeriod("semanal"); setAttainment([]); }} color={T.cyan}>Semanal</TabBtn>

              {attPeriod === "diario" ? (
                <select value={attDate || ""} onChange={e => { setAttDate(e.target.value); loadDailyAtt(e.target.value); }}
                  style={{ ...mkInput(T), width: "auto", minWidth: 160 }}>
                  {attDates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
                </select>
              ) : (
                <select
                  value={selWeek?.start || ""}
                  onChange={e => {
                    const w = weeks.find(w => w.start === e.target.value);
                    if (w) { setSelWeek(w); loadWeeklyAtt(w); }
                  }}
                  style={{ ...mkInput(T), width: "auto", minWidth: 200 }}
                >
                  {weeks.map(w => (
                    <option key={w.start} value={w.start}>
                      Semana {fmtWeekRange(w.start, w.end)} ({w.dates.length}d)
                    </option>
                  ))}
                </select>
              )}

              <button onClick={() => attPeriod === "diario" ? loadDailyAtt(attDate) : loadWeeklyAtt(selWeek)}
                style={{ background: T.bgControl, border: `1px solid ${T.borderControl}`, borderRadius: 8, padding: "7px 10px", color: T.t4, cursor: "pointer", display: "flex", alignItems: "center" }}>
                <RefreshCw size={13} />
              </button>

              {/* Group filter chips */}
              <div style={{ display: "flex", gap: 6, marginLeft: 4 }}>
                <GroupChip active={attGroupFilter === "all"} onClick={() => setAttGroupFilter("all")} label="Todos" color={T.t3} />
                {attGroups.map(g => {
                  const key = g.replace("BR-ATD-", "");
                  const color = GROUP_COLORS[g] || GROUP_COLORS[key] || T.blue;
                  return (
                    <GroupChip key={g} active={attGroupFilter === g} onClick={() => setAttGroupFilter(g)} label={key} color={color} />
                  );
                })}
              </div>

              {/* Summary pills */}
              {Object.keys(attSummary).length > 0 && (
                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  {[
                    { label: "Atingiu",  color: "#34d399" },
                    { label: "Próximo",  color: "#fbbf24" },
                    { label: "Atenção",  color: "#f97316" },
                    { label: "Crítico",  color: "#f87171" },
                  ].filter(s => attSummary[s.label]).map(({ label, color }) => (
                    <div key={label} style={{ background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 6, padding: "3px 10px", fontSize: 12, color, fontWeight: 700 }}>
                      {attSummary[label]} {label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attainment table — scrollable */}
            <div style={{ ...mkCard(T), flex: 1, overflowY: "auto", minHeight: 0 }}>
              {attFiltered.length === 0 ? (
                <div style={{ padding: "32px 24px", color: T.t5, fontSize: 14, textAlign: "center" }}>
                  Sem dados — selecione uma data ou semana
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 0.6fr 2.4fr 1fr 120px", gap: "0 12px", padding: "10px 24px 8px", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, background: T.bg, backdropFilter: "blur(8px)", zIndex: 1 }}>
                    {[attPeriod === "semanal" ? "Colaborador (acum. semana)" : "Colaborador", "Grupo", "Nível", "Casos NC · Mod · Ref", "Pontos / Meta", "Atingimento"].map(h => (
                      <div key={h} style={{ fontSize: 10, color: T.t5, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</div>
                    ))}
                  </div>

                  {[...attFiltered].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0)).map((d, i) => {
                    const pct = d.progress != null ? Math.round(d.progress * 100) : null;
                    const metaLabel = d.quota_source === "admin" ? "fixo" : "planilha";
                    const quotaField = attPeriod === "semanal" ? d.total_quota : d.quota;
                    return (
                      <div key={d.designer_name} style={{
                        display: "grid", gridTemplateColumns: "2fr 0.8fr 0.6fr 2.4fr 1fr 120px", gap: "0 12px",
                        padding: "10px 24px",
                        borderBottom: i < attFiltered.length - 1 ? `1px solid ${T.borderSubtle}` : "none",
                        alignItems: "center",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                          <div title={d.designer_name} style={{ fontSize: 13, fontWeight: 600, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {d.designer_name}
                          </div>
                          <span style={{ fontSize: 9, color: T.t5, background: T.bgControl, borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>
                            {metaLabel}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: T.t4 }}>{d.group_no?.replace("BR-ATD-", "") || "—"}</div>
                        <div style={{ fontSize: 10, color: T.t5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.job_level || "—"}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: T.t4, fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: "#93c5fd" }}>NC</span> {d.new_case_count}
                          </span>
                          <span style={{ color: T.t5 }}>·</span>
                          <span style={{ fontSize: 11, color: T.t4, fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: "#c4b5fd" }}>Mod</span> {d.mod_count}
                          </span>
                          <span style={{ color: T.t5 }}>·</span>
                          <span style={{ fontSize: 11, color: T.t4, fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: "#86efac" }}>Ref</span> {d.refinement_count}
                          </span>
                        </div>
                        <div style={{ fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: pct >= 100 ? "#34d399" : T.t3 }}>
                            {d.completed.toFixed(1)}
                          </span>
                          <span style={{ fontSize: 11, color: T.t5 }}> / {quotaField?.toFixed(1)}</span>
                          {attPeriod === "semanal" && d.days > 0 && (
                            <div style={{ fontSize: 9, color: T.t5 }}>{d.days} dia{d.days !== 1 ? "s" : ""}</div>
                          )}
                        </div>
                        <AttainmentPct progress={d.progress} />
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
        {mainTab === "upload" && (
          <div style={{ height: "100%", overflow: "auto", margin: "0 -36px", padding: "0 36px" }}>
            <UploadPage onBack={() => setMainTab("quotas")} />
          </div>
        )}
      </div>
    </div>
  );
}

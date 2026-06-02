import React, { useState, useEffect, useRef } from "react";
import {
  Upload, CheckCircle, XCircle, Trash2,
  RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Eye,
} from "lucide-react";
import api from "../api";
import { T } from "../theme";

function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function weekRange(monDate) {
  const mon = new Date(monDate + "T12:00:00");
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
  const [, mm, md] = monDate.split("-");
  const fm = String(fri.getMonth() + 1).padStart(2, "0");
  const fd = String(fri.getDate()).padStart(2, "0");
  return `${md}/${mm} – ${fd}/${fm}`;
}

function monthLabel(d) {
  const [y, m] = d.split("-");
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

function groupProductivity(rows) {
  const byWeek = {};
  for (const r of rows) {
    const dt = new Date(r.snapshot_date + "T12:00:00");
    const dow = dt.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(dt); mon.setDate(dt.getDate() + diff);
    const key = mon.toISOString().slice(0, 10);
    if (!byWeek[key]) byWeek[key] = { weekStart: key, rows: [] };
    byWeek[key].rows.push(r);
  }
  return Object.values(byWeek).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBanner({ status }) {
  if (!status || status === "loading") return null;
  const ok = status.ok;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px",
      background: ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
      border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
      borderRadius: 10, fontSize: 13, color: ok ? "#22c55e" : "#ef4444", marginTop: 8,
    }}>
      {ok ? <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
           : <XCircle    size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
      <span>{status.msg}</span>
    </div>
  );
}

function DropZone({ file, setFile, inputRef }) {
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${drag ? "#6366F1" : file ? "#3b82f6" : "#334155"}`,
        borderRadius: 12, padding: "32px 24px", textAlign: "center", cursor: "pointer",
        background: drag ? "rgba(99,102,241,0.06)" : file ? "rgba(59,130,246,0.06)" : "transparent",
        transition: "all 0.2s",
      }}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
        onChange={e => setFile(e.target.files[0])} />
      <Upload size={28} color={file ? "#3b82f6" : "#475569"} style={{ margin: "0 auto 10px" }} />
      {file ? (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#3b82f6" }}>{file.name}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{(file.size / 1024).toFixed(0)} KB</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Clique ou arraste o arquivo .xlsx aqui</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>Máximo 25 MB</div>
        </>
      )}
    </div>
  );
}

function PreviewPanel({ preview, type, force, onConfirm, onCancel, confirming }) {
  if (preview.type === "productivity") {
    const news = preview.dates.filter(d => d.status === "new");
    const repl = preview.dates.filter(d => d.status === "replace");
    return (
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20, marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Eye size={14} color="#6366F1" /> Preview — Produtividade
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
          {news.length > 0 && (
            <div style={{ fontSize: 12, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "4px 10px", borderRadius: 6 }}>
              {news.length} dia{news.length > 1 ? "s" : ""} novo{news.length > 1 ? "s" : ""}
            </div>
          )}
          {repl.length > 0 && (
            <div style={{ fontSize: 12, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "4px 10px", borderRadius: 6 }}>
              {repl.length} dia{repl.length > 1 ? "s" : ""} a substituir
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {preview.dates.map(d => (
            <span key={d.date} style={{
              fontSize: 11, padding: "3px 8px", borderRadius: 5,
              background: d.status === "new" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
              color: d.status === "new" ? "#22c55e" : "#f59e0b",
              border: `1px solid ${d.status === "new" ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)"}`,
            }}>
              {fmtDate(d.date)} {d.status === "replace" ? "↺" : "+"}
            </span>
          ))}
        </div>
        <PreviewActions onConfirm={onConfirm} onCancel={onCancel} confirming={confirming} />
      </div>
    );
  }

  if (preview.type === "quality_combined") {
    const newW = preview.weeks.filter(w => w.status === "new");
    const exW  = preview.weeks.filter(w => w.status === "exists");
    const delW = preview.weeks.filter(w => w.status === "deleted");
    const newM = preview.months.filter(m => m.status === "new");
    const exM  = preview.months.filter(m => m.status === "exists");
    return (
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20, marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Eye size={14} color="#6366F1" /> Preview — Qualidade · {preview.designers} colaboradores
        </div>
        {preview.weeks.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Semanas</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {preview.weeks.map(w => {
                const c = w.status === "new" ? "#22c55e" : w.status === "exists" ? "#f59e0b" : "#94a3b8";
                const bg = w.status === "new" ? "rgba(34,197,94,0.1)" : w.status === "exists" ? "rgba(245,158,11,0.1)" : "rgba(148,163,184,0.1)";
                const label = w.status === "new" ? "+" : w.status === "exists" ? (force ? "↺" : "⏭") : "✗";
                return (
                  <span key={w.date} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: bg, color: c, border: `1px solid ${c}40` }}>
                    {w.label} {label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {preview.months.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Meses</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {preview.months.map(m => {
                const c = m.status === "new" ? "#22c55e" : "#f59e0b";
                const bg = m.status === "new" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)";
                const label = m.status === "new" ? "+" : force ? "↺" : "⏭";
                return (
                  <span key={m.date} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: bg, color: c, border: `1px solid ${c}40` }}>
                    {m.label} {label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {(exW.length > 0 || exM.length > 0) && !force && (
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={12} color="#f59e0b" />
            {exW.length + exM.length} período(s) já existente(s) serão ignorados — ative "Forçar reimportação" para substituir
          </div>
        )}
        <PreviewActions onConfirm={onConfirm} onCancel={onCancel} confirming={confirming} />
      </div>
    );
  }

  if (preview.type === "quality_legacy") {
    return (
      <div style={{ background: "#1e293b", border: "1px solid #f59e0b44", borderRadius: 12, padding: 20, marginTop: 8 }}>
        <div style={{ fontSize: 13, color: "#f59e0b", display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={14} /> Formato legado detectado ({preview.subType})
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
          Este arquivo usa o formato antigo. O upload será processado para o período selecionado.
        </div>
        <PreviewActions onConfirm={onConfirm} onCancel={onCancel} confirming={confirming} />
      </div>
    );
  }

  return null;
}

function PreviewActions({ onConfirm, onCancel, confirming }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <button onClick={onCancel} style={{
        background: "transparent", border: "1px solid #334155",
        borderRadius: 8, padding: "8px 16px", color: "#64748b",
        fontSize: 13, cursor: "pointer",
      }}>Cancelar</button>
      <button onClick={onConfirm} disabled={confirming} style={{
        background: confirming ? "#1e3a5f" : "#3b82f6", border: "none",
        borderRadius: 8, padding: "8px 20px", color: "#fff",
        fontSize: 13, fontWeight: 700, cursor: confirming ? "default" : "pointer",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        {confirming ? <><RefreshCw size={13} style={{ animation: "spin 0.6s linear infinite" }} /> Importando...</> : "Confirmar importação"}
      </button>
    </div>
  );
}

// ─── History components ───────────────────────────────────────────────────────

function DeleteButton({ onDelete }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>Remover?</span>
        <button onClick={onDelete} style={{
          background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: 6, padding: "3px 10px", color: "#ef4444",
          fontSize: 11, fontWeight: 700, cursor: "pointer",
        }}>Sim</button>
        <button onClick={() => setConfirming(false)} style={{
          background: "transparent", border: "1px solid #334155",
          borderRadius: 6, padding: "3px 8px", color: "#64748b",
          fontSize: 11, cursor: "pointer",
        }}>Não</button>
      </div>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} style={{
      background: "none", border: "none", cursor: "pointer",
      color: "#475569", padding: "6px 8px", borderRadius: 6,
      display: "flex", alignItems: "center", justifyContent: "center",
      minWidth: 32, minHeight: 32,
    }}
      onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
      onMouseLeave={e => e.currentTarget.style.color = "#475569"}
    >
      <Trash2 size={13} />
    </button>
  );
}

function HistorySection({ title, color, items, onDelete }) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        background: "none", border: "none", cursor: "pointer",
        padding: "6px 0", marginBottom: open ? 8 : 0,
      }}>
        {open ? <ChevronDown size={13} color="#64748b" /> : <ChevronRight size={13} color="#64748b" />}
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 1 }}>{title}</span>
        <span style={{ fontSize: 11, color: "#475569", marginLeft: 4 }}>({items.length})</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 14px", background: "#1e293b",
              borderRadius: 8, border: "1px solid #1e293b",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#334155"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.filename} · {item.uploaded_at?.slice(0, 16).replace("T", " ")}
                </div>
              </div>
              <DeleteButton onDelete={() => onDelete(item.snapshot_date, item.file_type)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UploadPage({ onBack }) {
  const [file,       setFile]       = useState(null);
  const [type,       setType]       = useState("productivity");
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [force,      setForce]      = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview,    setPreview]    = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [status,     setStatus]     = useState(null);
  const [history,    setHistory]    = useState([]);
  const inputRef = useRef();

  async function loadHistory() {
    try { const r = await api.get("/upload/history"); setHistory(r.data); } catch {}
  }
  useEffect(() => { loadHistory(); }, []);

  async function handlePreview() {
    if (!file) return;
    setPreviewing(true); setPreview(null); setStatus(null);
    const fd = new FormData();
    fd.append("file", file); fd.append("type", type); fd.append("date", date);
    try {
      const r = await api.post("/upload/preview", fd);
      setPreview(r.data);
    } catch (e) {
      setStatus({ ok: false, msg: e.response?.data?.error || e.message });
      setPreviewing(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setConfirming(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("type", type); fd.append("date", date);
    if (force) fd.append("force", "true");
    try {
      const r = await api.post("/upload", fd);
      const d = r.data;
      let msg;
      if (d.dates != null)        msg = `${d.dates} dia(s) de produtividade importados (${d.imported} novos, ${d.replaced} substituídos)`;
      else if (d.weeks != null)   msg = d.force
        ? `${d.weeks} semana(s) reimportada(s)${d.months ? ` · ${d.months} mês(es)` : ""}`
        : `${d.weeks} semana(s) nova(s)${d.weeksSkipped ? ` · ${d.weeksSkipped} ignoradas` : ""}${d.months ? ` · ${d.months} mês(es)` : ""}`;
      else msg = `${d.rows} registros importados`;
      setStatus({ ok: true, msg });
      setFile(null); setPreview(null); setPreviewing(false);
      loadHistory();
    } catch (e) {
      setStatus({ ok: false, msg: e.response?.data?.error || e.message });
    } finally { setConfirming(false); }
  }

  function handleCancel() {
    setPreview(null); setPreviewing(false);
  }

  async function handleDelete(date, fileType) {
    // Optimistic update
    setHistory(prev => prev.filter(h => !(h.snapshot_date === date && h.file_type === fileType)));
    try {
      await api.delete(`/upload/${date}/${encodeURIComponent(fileType)}`);
    } catch {
      // Rollback on error
      loadHistory();
      setStatus({ ok: false, msg: "Erro ao remover upload. Tente novamente." });
    }
  }

  // Group history
  const productivity   = history.filter(h => h.file_type === "productivity");
  const qualityWeeks   = history.filter(h => h.file_type === "quality_week_designer");
  const qualityMonths  = history.filter(h => h.file_type === "quality_month_designer");
  const others         = history.filter(h => !["productivity","quality_week_designer","quality_month_designer"].includes(h.file_type));

  // Group productivity by week
  const prodWeeks = groupProductivity(productivity);

  // Build productivity display items (one per week, but deletable per day)
  const prodItems = productivity.map(h => ({
    ...h,
    label: fmtDate(h.snapshot_date),
  }));

  const qualWeekItems  = qualityWeeks.map(h => ({ ...h, label: `Semana ${weekRange(h.snapshot_date)}` }));
  const qualMonthItems = qualityMonths.map(h => ({ ...h, label: monthLabel(h.snapshot_date) }));
  const otherItems     = others.map(h => ({ ...h, label: `${h.file_type} · ${fmtDate(h.snapshot_date)}` }));

  return (
    <div style={{ minHeight: "100vh", padding: "32px 40px", overflowY: "auto", background: "#0a0e1a" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 2 }}>ShiftSync BI</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#e2e8f0" }}>Upload de Dados</div>
        </div>

        {/* Upload card */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          {/* Type + date row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Tipo de arquivo</label>
              <select value={type} onChange={e => { setType(e.target.value); setPreview(null); setPreviewing(false); }} style={{
                width: "100%", background: "#0f172a", border: "1px solid #334155",
                borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13,
              }}>
                <option value="productivity">Produtividade (Capacity_Design)</option>
                <option value="quality">Qualidade (BR Case Design)</option>
              </select>
            </div>
            {type !== "productivity" && (
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                  <div onClick={() => setForce(f => !f)} style={{
                    width: 36, height: 20, borderRadius: 10,
                    background: force ? "#f59e0b" : "#334155",
                    position: "relative", transition: "background 0.2s", flexShrink: 0,
                  }}>
                    <div style={{
                      position: "absolute", top: 2, left: force ? 18 : 2, width: 16, height: 16,
                      borderRadius: "50%", background: "#fff", transition: "left 0.2s",
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: force ? "#f59e0b" : "#64748b" }}>Forçar reimportação</span>
                </label>
              </div>
            )}
            {type === "productivity" && (
              <div>
                <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Data de referência</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{
                  width: "100%", background: "#0f172a", border: "1px solid #334155",
                  borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13,
                }} />
              </div>
            )}
          </div>

          {/* Drop zone */}
          {!preview && <DropZone file={file} setFile={f => { setFile(f); setPreview(null); setPreviewing(false); setStatus(null); }} inputRef={inputRef} />}

          {/* Preview result */}
          {preview && <PreviewPanel preview={preview} type={type} force={force} onConfirm={handleConfirm} onCancel={handleCancel} confirming={confirming} />}

          {/* Action button */}
          {!preview && (
            <button onClick={handlePreview} disabled={!file || previewing} style={{
              marginTop: 14, width: "100%",
              background: !file ? "#1e293b" : "#6366F1",
              border: "none", borderRadius: 10, padding: "11px 0",
              color: !file ? "#475569" : "#fff",
              fontWeight: 700, fontSize: 14, cursor: !file ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.2s",
            }}>
              {previewing
                ? <><RefreshCw size={14} style={{ animation: "spin 0.6s linear infinite" }} /> Analisando arquivo...</>
                : <><Eye size={14} /> Verificar arquivo</>
              }
            </button>
          )}

          <StatusBanner status={status} />
        </div>

        {/* History */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Uploads Recentes</span>
            <button onClick={loadHistory} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: "4px", display: "flex" }}>
              <RefreshCw size={12} />
            </button>
          </div>

          {history.length === 0 ? (
            <div style={{ color: "#475569", fontSize: 13, padding: "20px 0", textAlign: "center" }}>Nenhum upload registrado</div>
          ) : (
            <>
              <HistorySection title="Produtividade" color="#06b6d4" items={prodItems} onDelete={handleDelete} />
              <HistorySection title="Qualidade — Semanas" color="#8b5cf6" items={qualWeekItems} onDelete={handleDelete} />
              <HistorySection title="Qualidade — Meses" color="#10b981" items={qualMonthItems} onDelete={handleDelete} />
              <HistorySection title="Outros" color="#94a3b8" items={otherItems} onDelete={handleDelete} />
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: #1e293b; }
      `}</style>
    </div>
  );
}

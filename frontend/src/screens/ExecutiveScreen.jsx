import React, { useEffect, useState } from "react";
import { ShieldCheck, TrendingUp, Star, ClipboardList, Users, ArrowLeft, Briefcase } from "lucide-react";
import api from "../api";
import { T } from "../theme";

const EXEC_ROLES = ["hr", "ti", "gerencia"];

const fmt = (v, d = 0) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }));

function CenterCard({ center, T }) {
  const c = center.connected === false ? T.t7 : (center.pct >= 100 ? T.green : center.pct >= 80 ? "#f59e0b" : "#ef4444");
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: "22px 24px", position: "relative", overflow: "hidden", opacity: center.connected === false ? 0.6 : 1 }}>
      <i aria-hidden style={{ position: "absolute", top: 0, left: 0, right: "30%", height: 3, background: `linear-gradient(90deg, ${c}, transparent)` }} />
      <div style={{ fontSize: 13, fontWeight: 800, color: T.t1, marginBottom: 4 }}>{center.label}</div>
      {center.connected === false ? (
        <div style={{ fontSize: 12.5, color: T.t6, padding: "18px 0" }}>
          Aguardando decisão sobre a autenticação cross-servidor para conectar este centro.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
            {center.pctPending ? (
              <>
                <span style={{ fontSize: 24, fontWeight: 800, color: T.t6 }}>Em validação</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 42, fontWeight: 900, color: c, lineHeight: 1 }}>{fmt(center.pct)}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.t5 }}>% da meta</span>
              </>
            )}
          </div>
          {center.pctPending && <div style={{ fontSize: 10.5, color: T.t7, marginTop: 3 }}>% de atingimento ainda em conferência — volume, qualidade e QC abaixo já validados.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginTop: 18 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: T.t5, textTransform: "uppercase", letterSpacing: 0.6 }}><Briefcase size={12} /> Casos</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.t1, marginTop: 3 }}>{center.caseVolume != null ? fmt(center.caseVolume) : "—"}</div>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: T.t5, textTransform: "uppercase", letterSpacing: 0.6 }}><Star size={12} /> Qualidade</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.t1, marginTop: 3 }}>{fmt(center.qualityScore, 2)}</div>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: T.t5, textTransform: "uppercase", letterSpacing: 0.6 }}><ClipboardList size={12} /> QC</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.t1, marginTop: 3 }}>{center.qcRate != null ? fmt(center.qcRate, 1) + "%" : "—"}</div>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: T.t5, textTransform: "uppercase", letterSpacing: 0.6 }}><Users size={12} /> Equipe</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.t1, marginTop: 3 }}>{center.headcount ?? "—"}</div>
            </div>
          </div>
          {center.updatedAt && <div style={{ fontSize: 10.5, color: T.t7, marginTop: 16 }}>Atualizado {new Date(center.updatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>}
        </>
      )}
    </div>
  );
}

export default function ExecutiveScreen({ execRole, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const authorized = EXEC_ROLES.includes(execRole);

  useEffect(() => {
    if (!authorized) return;
    api.get("/exec/summary").then(r => setData(r.data)).catch(() => setError(true));
  }, [authorized]);

  if (!authorized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, background: T.bg, color: T.t1 }}>
        <ShieldCheck size={40} color={T.t6} />
        <div style={{ fontSize: 15, fontWeight: 700 }}>Acesso restrito</div>
        <div style={{ fontSize: 12.5, color: T.t6, maxWidth: 320, textAlign: "center" }}>Este painel é visível apenas para gerência/RH/TI, autenticados no ShiftSync principal.</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "36px 44px", background: T.bg, color: T.t1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        {onBack && <button onClick={onBack} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 9px", color: T.t3, cursor: "pointer", display: "flex" }}><ArrowLeft size={15} /></button>}
        <div style={{ display: "inline-flex", width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", background: "#6366F11f", color: "#6366F1" }}><TrendingUp size={19} /></div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800 }}>Painel Executivo</div>
          <div style={{ fontSize: 12.5, color: T.t6 }}>Comparativo entre centros — visível apenas para gerência</div>
        </div>
      </div>

      {error && <div style={{ color: "#ef4444", fontSize: 13 }}>Não foi possível carregar os dados do painel executivo.</div>}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20, maxWidth: 900 }}>
          <CenterCard center={data.br} T={T} />
          <CenterCard center={data.my} T={T} />
        </div>
      )}
    </div>
  );
}

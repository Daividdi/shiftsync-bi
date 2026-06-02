import React from "react";
import { Trophy } from "lucide-react";

const MEDAL = ["#ffd700", "#c0c0c0", "#cd7f32"];
const LABEL = ["1º", "2º", "3º"];

export default function RankingCard({ title, items = [], valueKey = "progress", valueFmt, style = {} }) {
  const fmt = valueFmt || (v => `${(v * 100).toFixed(1)}%`);
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, ...style,
    }}>
      <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}>
        <Trophy size={13} color="#fbbf24" />
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ color: "#475569", fontSize: 14 }}>Sem dados disponíveis</div>
      ) : (
        items.slice(0, 3).map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: MEDAL[i] + "22",
              border: `2px solid ${MEDAL[i]}`, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 12, fontWeight: 700, color: MEDAL[i], flexShrink: 0,
            }}>
              {LABEL[i]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div title={item.designer_name || item.name} style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.designer_name || item.name}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{item.group_no || item.group} · {item.job_level || item.level}</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: MEDAL[i], flexShrink: 0 }}>
              {fmt(item[valueKey])}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

import React from "react";
import { T } from "../theme";

export default function KPICard({ title, value, sub, icon, color = "#3b82f6", style = {}, delta }) {
  const pos = delta > 0;
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 16, padding: "18px 22px",
      display: "flex", flexDirection: "column", gap: 8,
      position: "relative", overflow: "hidden",
      boxShadow: T.cardShadow,
      ...style,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}99, transparent)` }} />
      <div style={{ fontSize: 13, color: T.t4, textTransform: "uppercase", letterSpacing: 1.2, display: "flex", alignItems: "center", gap: 6 }}>
        {icon && <span style={{ color }}>{icon}</span>}
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div style={{ fontSize: 44, fontWeight: 900, color, lineHeight: 1, letterSpacing: -1.5, textShadow: T.isDark ? `0 0 30px ${color}44` : "none" }}>{value ?? "—"}</div>
        {delta != null && (
          <div style={{ fontSize: 15, fontWeight: 700, color: pos ? "#22c55e" : "#ef4444", marginBottom: 6 }}>
            {pos ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
          </div>
        )}
      </div>
      {sub && <div style={{ fontSize: 14, color: T.t4 }}>{sub}</div>}
    </div>
  );
}

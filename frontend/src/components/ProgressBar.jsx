import React from "react";
import { T } from "../theme";

export default function ProgressBar({ value, label, sublabel, color = "#3b82f6", height = 32 }) {
  const real = (value || 0) * 100;
  const barPct = Math.min(100, real);
  const over = real > 100;
  const colorAt = p => p > 100 ? T.cyan : p >= 80 ? "#34d399" : p >= 60 ? "#fbbf24" : "#f87171";
  const c = color === "auto" ? colorAt(real) : (over ? T.cyan : color);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 15, color: "#cbd5e1" }}>{label}</span>
          {sublabel && <span style={{ fontSize: 14, color: "#64748b" }}>{sublabel}</span>}
        </div>
      )}
      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: height, overflow: "hidden", height, position: "relative" }}>
        <div style={{
          height: "100%", width: `${barPct}%`,
          background: over
            ? `linear-gradient(90deg, #34d399, ${T.cyan})`
            : `linear-gradient(90deg, ${c}, ${c}cc)`,
          borderRadius: height, transition: "width 1.2s ease",
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          paddingRight: 12, boxSizing: "border-box",
          boxShadow: over ? `0 0 20px ${T.cyan}88` : `0 0 16px ${c}66`,
        }}>
          {barPct > 30 && (
            <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>
              {real.toFixed(1)}%{over ? " ↑" : ""}
            </span>
          )}
        </div>
        {barPct <= 30 && (
          <span style={{ position: "absolute", left: `${barPct + 2}%`, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 800, color: c, whiteSpace: "nowrap" }}>
            {real.toFixed(1)}%{over ? " ↑" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

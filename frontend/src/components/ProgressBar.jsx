import React from "react";
import { T } from "../theme";

export default function ProgressBar({ value, label, sublabel, color = "#3b82f6", height = 32, hideValue = false }) {
  const real = (value || 0) * 100;
  const barPct = Math.min(100, real);
  const over = real > 100;
  const colorAt = p => p >= 100 ? "#3b82f6" : p >= 90 ? "#22c55e" : p >= 80 ? "#facc15" : p >= 65 ? "#fb923c" : p >= 50 ? "#ec4899" : "#a855f7";
  const c = color === "auto" ? colorAt(real) : (over ? T.cyan : color);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <style>{"@keyframes pbShine{0%{transform:translateX(-170%)}100%{transform:translateX(420%)}}"}</style>
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
          position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          paddingRight: 12, boxSizing: "border-box",
          boxShadow: over ? `0 0 20px ${T.cyan}88` : `0 0 16px ${c}66`,
        }}>
          {/* gloss (brilho no topo) */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0) 58%)", pointerEvents: "none" }} />
          {/* shimmer (reflexo que percorre) */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "34%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)", animation: "pbShine 1.8s ease-out", pointerEvents: "none" }} />
          {!hideValue && barPct > 30 && (
            <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", position: "relative", zIndex: 1, textShadow: "0 1px 3px #0007" }}>
              {real.toFixed(1)}%{over ? " ↑" : ""}
            </span>
          )}
        </div>
        {!hideValue && barPct <= 30 && (
          <span style={{ position: "absolute", left: `${barPct + 2}%`, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 800, color: c, whiteSpace: "nowrap" }}>
            {real.toFixed(1)}%{over ? " ↑" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

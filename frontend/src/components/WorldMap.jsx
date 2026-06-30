import React, { memo } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { T, progColor } from "../theme";

const GEO_URL = import.meta.env.BASE_URL + "world-110m.json";

const CENTROIDS = {
  "United States":            [-98.6, 39.5],
  "United States of America": [-98.6, 39.5],
  "Brazil":                   [-51.9, -14.2],
  "Mexico":                   [-102.5, 23.6],
  "Canada":                   [-96.8, 56.1],
  "Argentina":                [-63.6, -38.4],
  "Colombia":                 [-74.3, 4.6],
  "Chile":                    [-71.5, -35.7],
  "Peru":                     [-75.0, -9.2],
  "Venezuela":                [-66.6, 6.4],
  "Puerto Rico":              [-66.6, 18.2],
  "Dominican Republic":       [-70.2, 18.7],
  "Cuba":                     [-79.5, 21.5],
  "Spain":                    [-3.7, 40.4],
  "Portugal":                 [-8.2, 39.4],
  "Japan":                    [138.3, 36.2],
  "China":                    [104.2, 35.9],
  "India":                    [78.9, 20.6],
  "Australia":                [133.8, -25.3],
  "South Africa":             [25.1, -29.0],
  "United Kingdom":           [-3.4, 55.4],
  "Germany":                  [10.4, 51.2],
  "France":                   [2.2, 46.2],
};

const GEO_ALIAS = {
  "United States of America": "United States",
  "USA":                      "United States",
  "Brasil":                   "Brazil",
};

// The auto-feed stores ISO-2 country codes (Doris country_iso_two_letter_code),
// while Excel uploads used full English names. Normalize both to the canonical
// names used by CENTROIDS / PT_BR / the GeoJSON match.
const ISO2 = {
  US: "United States", BR: "Brazil", MX: "Mexico", CA: "Canada",
  AR: "Argentina", CO: "Colombia", CL: "Chile", PE: "Peru", VE: "Venezuela",
  PR: "Puerto Rico", DO: "Dominican Republic", CU: "Cuba",
  ES: "Spain", PT: "Portugal", JP: "Japan", CN: "China", IN: "India",
  AU: "Australia", ZA: "South Africa", GB: "United Kingdom",
  DE: "Germany", FR: "France",
};
function canonCountry(c) { return ISO2[c] || GEO_ALIAS[c] || c; }

const PT_BR = {
  "United States":      "EUA",
  "Brazil":             "Brasil",
  "Mexico":             "México",
  "Colombia":           "Colômbia",
  "Argentina":          "Argentina",
  "Puerto Rico":        "Porto Rico",
  "Dominican Republic": "Rep. Dom.",
  "Cuba":               "Cuba",
  "Canada":             "Canadá",
  "Spain":              "Espanha",
  "Portugal":           "Portugal",
  "Japan":              "Japão",
  "China":              "China",
  "India":              "Índia",
  "Australia":          "Austrália",
  "South Africa":       "África do Sul",
  "United Kingdom":     "Reino Unido",
  "Germany":            "Alemanha",
  "France":             "França",
};
function ptBr(n) { return PT_BR[n] || n; }

export default memo(function WorldMap({ geo = [], groups = [], height = "100%" }) {
  if (!geo.length) return null;

  const PALETTE = [T.cyan, T.blue, T.purple, T.green, T.orange, T.teal];

  // Normalize country (ISO-2 or full name) to canonical, merging any duplicates.
  const merged = {};
  for (const d of geo) {
    const country = canonCountry(d.country);
    if (!merged[country]) merged[country] = { ...d, country, case_count: 0 };
    merged[country].case_count += d.case_count || 0;
  }
  const sorted = Object.values(merged).sort((a, b) => b.case_count - a.case_count);
  const maxCount = sorted[0]?.case_count || 1;

  const byName = {};
  sorted.forEach((d, i) => {
    byName[d.country] = { ...d, color: PALETTE[i] || T.t4, rank: i };
    Object.entries(GEO_ALIAS).forEach(([alias, canon]) => {
      if (canon === d.country) byName[alias] = byName[d.country];
    });
  });

  function matchGeo(geoProps) {
    const name = geoProps.NAME || geoProps.ADMIN || geoProps.name || "";
    return byName[name] || byName[GEO_ALIAS[name]] || null;
  }

  const markers = sorted.map(d => {
    const coords = CENTROIDS[d.country];
    return coords ? { ...d, coords, color: byName[d.country].color } : null;
  }).filter(Boolean);

  const panelBg     = T.isDark
    ? `linear-gradient(160deg, ${T.cyan}14 0%, ${T.blue}08 45%, transparent 100%)`
    : T.card;
  const panelBorder = `1px solid ${T.isDark ? T.cyan + "30" : T.border}`;
  const panelShadow = T.isDark ? `inset 1px 0 16px ${T.cyan}08` : T.cardShadow;

  return (
    <div style={{ display: "flex", width: "100%", height, flex: 1, minHeight: 0 }}>

      {/* ── Map ── */}
      <div style={{ flex: 1, position: "relative", minWidth: 0, overflow: "hidden" }}>
        <ComposableMap
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: 310, center: [-85, 18] }}
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(g => {
                const match = matchGeo(g.properties);
                return (
                  <Geography
                    key={g.rsmKey}
                    geography={g}
                    fill={match ? match.color + "55" : T.bgControl}
                    stroke={match ? match.color : T.border}
                    strokeWidth={match ? 1.2 : 0.3}
                    style={{
                      default: { outline: "none" },
                      hover:   { outline: "none", fill: match ? match.color + "77" : T.bgControl },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {markers.map(d => {
            // Radius proportional to count, min 14 to always fit text inside
            const r        = Math.max(14, Math.sqrt(d.case_count / maxCount) * 22);
            const numSize  = Math.max(9, Math.min(12, r * 0.58));
            const lblSize  = 10;

            return (
              <Marker key={d.country} coordinates={d.coords}>
                {/* glow halo */}
                <circle cx={0} cy={0} r={r + 6}  fill={d.color + "0d"} stroke="none" />
                {/* filled circle */}
                <circle cx={0} cy={0} r={r}      fill={d.color + "60"} stroke={d.color} strokeWidth={1.5} />
                {/* count inside circle — dy="0.35em" centers text cross-browser */}
                <text
                  x={0} y={0} dy="0.35em"
                  textAnchor="middle"
                  fontSize={numSize}
                  fontWeight={700}
                  fill={T.t1}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {d.case_count.toLocaleString()}
                </text>
                {/* country name below circle */}
                <text
                  x={0} y={r + lblSize + 4} dy="0.35em"
                  textAnchor="middle"
                  fontSize={lblSize}
                  fontWeight={500}
                  fill={T.t3}
                >
                  {ptBr(d.country)}
                </text>
              </Marker>
            );
          })}
        </ComposableMap>
      </div>

      {/* ── Groups attainment panel ── */}
      {groups.length > 0 && (
        <div style={{
          flex: "0 0 200px",
          display: "flex",
          flexDirection: "column",
          padding: "14px 16px 14px 16px",
          background: panelBg,
          borderLeft: panelBorder,
          boxShadow: panelShadow,
        }}>
          <div style={{ fontSize: 11, color: T.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Ating. por Grupo · D-1
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, justifyContent: "center" }}>
            {groups.map(g => {
              const pct    = g.progress || 0;
              const over   = pct > 1;
              const color  = progColor(pct);
              const barPct = Math.min(pct, 1) * 100;
              const shortName = g.group.replace("BR-ATD-", "");
              return (
                <div key={g.group}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.t2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {shortName}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      {(pct * 100).toFixed(0)}%{over ? "↑" : ""}
                    </span>
                  </div>
                  <div style={{ background: T.bgControl, borderRadius: 4, height: 5, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{ width: `${barPct}%`, height: "100%", background: `linear-gradient(90deg, ${color}, ${color}66)`, borderRadius: 4, transition: "width 1s ease" }} />
                  </div>
                  <div style={{ fontSize: 12, color: T.t4, fontVariantNumeric: "tabular-nums" }}>
                    {Math.round(g.totalCompleted).toLocaleString()} · {g.avgCompleted.toFixed(1)}/téc
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

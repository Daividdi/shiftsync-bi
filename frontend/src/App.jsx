import React, { useState, useEffect, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import LiveProductionScreen from "./screens/LiveProductionScreen";
import ProductivityScreen from "./screens/ProductivityScreen";
import ProductivityOverallScreen from "./screens/ProductivityOverallScreen";
import QualityScreen from "./screens/QualityScreen";
import OverallQualityScreen from "./screens/OverallQualityScreen";
import UploadPage from "./screens/UploadPage";
import QuotaAdminScreen from "./screens/QuotaAdminScreen";
import ExecutiveScreen from "./screens/ExecutiveScreen";
import { T, applyTheme } from "./theme";

function readTheme() {
  try { return localStorage.getItem("shiftsync_theme") !== "light"; } catch { return true; }
}

const SCREENS = [
  { id: "live",       label: "Produção ao vivo",     component: LiveProductionScreen,      accent: "#f59e0b" },
  { id: "prod-geral", label: "Produtividade Geral", component: ProductivityOverallScreen, accent: T.cyan   },
  { id: "atd-prod",   label: "Produtividade ATD",   component: ProductivityScreen,        accent: T.blue   },
  { id: "atd-qual",   label: "Qualidade ATD",        component: QualityScreen,             accent: "#3b82f6" },
  { id: "qual-geral", label: "Qualidade Geral",      component: OverallQualityScreen,      accent: T.green  },
];

const ROTATE_MS = 30_000;

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

export default function App() {
  const [isDark, setIsDark] = useState(() => { const d = readTheme(); applyTheme(d); return d; });
  const [page, setPage] = useState("dashboard");
  const [screenIdx, setScreenIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [execRole, setExecRole] = useState(null); // só chega via postMessage do ShiftSync principal
  let navTimer = null;

  useEffect(() => {
    applyTheme(isDark);
    document.body.style.background = isDark ? "#0a0e1a" : T.bg;
    document.body.style.color = isDark ? "#e2e8f0" : T.t1;
  }, [isDark]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "shiftsync_theme") {
        const dark = e.newValue !== "light";
        applyTheme(dark);
        setIsDark(dark);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // postMessage bridge — controlled by ShiftSync parent
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "SET_SCREEN") {
        setScreenIdx(e.data.idx);
        setPaused(true);
        setPage("dashboard");
      }
      // ShiftSync sends this to navigate to management pages
      if (e.data?.type === "BI_GOTO_PAGE") {
        const p = e.data.page;
        if (p === "upload" || p === "admin" || p === "exec" || p === "dashboard") setPage(p);
      }
      // Ponte de acesso do Painel Executivo — só o ShiftSync principal (já
      // autenticado) manda a role; sem essa mensagem, a tela fica bloqueada.
      if (e.data?.type === "AUTH_ROLE") setExecRole(e.data.role || null);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    try { window.parent.postMessage({ type: "SCREEN_CHANGED", idx: screenIdx }, "*"); } catch {}
  }, [screenIdx]);

  const next = useCallback(() => setScreenIdx(i => (i + 1) % SCREENS.length), []);
  const prev = useCallback(() => setScreenIdx(i => (i - 1 + SCREENS.length) % SCREENS.length), []);

  useEffect(() => {
    if (paused || page !== "dashboard") return;
    const t = setInterval(next, ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, page, next]);

  useEffect(() => {
    const handler = e => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") setPaused(p => !p);
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "Escape") { setPage("dashboard"); window.location.hash = ""; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  function showNavBriefly() {
    setShowNav(true);
    clearTimeout(navTimer);
    navTimer = setTimeout(() => setShowNav(false), 3000);
  }

  if (page === "upload") {
    return <div key={isDark ? "dark" : "light"} style={{ background: T.bg, minHeight: "100vh" }}><UploadPage onBack={() => { setPage("dashboard"); window.location.hash = ""; try { window.parent.postMessage({ type: "BI_PAGE_BACK" }, "*"); } catch {} }} /></div>;
  }

  if (page === "admin") {
    return <div key={isDark ? "dark" : "light"} style={{ background: T.bg, minHeight: "100vh" }}><QuotaAdminScreen onBack={() => { setPage("dashboard"); window.location.hash = ""; try { window.parent.postMessage({ type: "BI_PAGE_BACK" }, "*"); } catch {} }} /></div>;
  }

  if (page === "exec") {
    return <div key={isDark ? "dark" : "light"} style={{ background: T.bg, minHeight: "100vh" }}><ExecutiveScreen execRole={execRole} onBack={() => { setPage("dashboard"); window.location.hash = ""; try { window.parent.postMessage({ type: "BI_PAGE_BACK" }, "*"); } catch {} }} /></div>;
  }

  const Screen = SCREENS[screenIdx].component;
  const accent = SCREENS[screenIdx].accent;

  return (
    <div key={isDark ? "dark" : "light"} style={{ position: "relative", height: "100vh", overflow: "hidden", background: T.bg }} onMouseMove={showNavBriefly}>
      <Screen />

      {/* Bottom nav — controls */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: isDark ? "linear-gradient(transparent, rgba(8,12,24,0.97))" : "linear-gradient(transparent, rgba(240,242,245,0.97))",
        padding: "20px 28px 14px",
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10,
        opacity: showNav ? 1 : 0.08,
        transition: "opacity 0.4s",
        zIndex: 100,
      }}>
        {!paused && (
          <span style={{ fontSize: 11, color: T.t5, letterSpacing: 0.5 }}>
            A seguir: {SCREENS[(screenIdx + 1) % SCREENS.length].label}
          </span>
        )}
        {SCREENS.map((_, i) => (
          <div key={i} style={{
            width: i === screenIdx ? 22 : 6, height: 6, borderRadius: 3,
            background: i === screenIdx ? accent : T.border,
            transition: "width 0.3s, background-color 0.3s",
          }} />
        ))}
        <div style={{ width: 1, height: 16, background: T.border, margin: "0 3px" }} />
        <button onClick={() => setPaused(p => !p)}
          style={{ background: "none", border: "none", color: T.t4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          {paused ? "▶ Play" : "⏸ Pausa"}
        </button>
        <button onClick={toggleFullscreen}
          style={{ background: T.bgControl, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 9px", color: T.t4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 30, minHeight: 30 }}
          title="Tela cheia (F)">
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* Progress bar at bottom */}
      {!paused && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 3, zIndex: 101 }}>
          <div key={screenIdx} style={{
            height: "100%", background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
            animation: `grow ${ROTATE_MS}ms linear forwards`,
            boxShadow: `0 0 10px ${accent}`,
          }} />
        </div>
      )}

      <style>{`
        @keyframes grow { from { width: 0% } to { width: 100% } }
        * { box-sizing: border-box; }
        body {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}

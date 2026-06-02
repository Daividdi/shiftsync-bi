import React, { useMemo } from "react";
import { T } from "../theme";

function isoWeekNum(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const mon1 = new Date(jan4);
  mon1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  return Math.floor((d - mon1) / (7 * 864e5)) + 1;
}

function weekRange(dates) {
  const s = [...dates].sort();
  const [, sm, sd] = s[0].split("-");
  const [, em, ed] = s[s.length - 1].split("-");
  return sm === em ? `${sd}–${ed}/${em}` : `${sd}/${sm}–${ed}/${em}`;
}

function fmtMonthKey(m) { // "YYYY-MM"
  const [y, mo] = m.split("-");
  return new Date(+y, +mo - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "");
}

function fmtWeekDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const end = new Date(`${y}-${m}-${day}T12:00:00`);
  const start = new Date(end); start.setDate(end.getDate() - 6);
  const sm = String(start.getMonth() + 1).padStart(2, "0");
  const sd = String(start.getDate()).padStart(2, "0");
  return `Sem ${isoWeekNum(d)} · ${sd}/${sm}–${day}/${m}`;
}

function fmtMonthDate(d) {
  if (!d) return "";
  const [y, m] = d.split("-");
  return new Date(+y, +m - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "");
}

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const getSel = () => ({
  background: T.bgControl,
  border: `1px solid ${T.borderControl}`,
  borderRadius: 8, padding: "5px 10px",
  color: T.t1, fontSize: 12, cursor: "pointer",
  outline: "none", fontFamily: "inherit",
});

function TabBar({ tabs, activeTab, onTabChange }) {
  if (!tabs || tabs.length <= 1) return null;
  return (
    <div style={{ display: "flex", background: T.bgControl, border: `1px solid ${T.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
      {tabs.map(({ key, label, disabled }) => (
        <button key={key} onClick={() => !disabled && onTabChange(key)} style={{
          background: activeTab === key ? "rgba(59,130,246,0.18)" : "transparent",
          border: `1px solid ${activeTab === key ? "#3b82f688" : "transparent"}`,
          borderRadius: 7, padding: "5px 14px",
          color: activeTab === key ? "#3b82f6" : disabled ? T.t5 : T.t4,
          fontSize: 12, cursor: disabled ? "default" : "pointer",
          fontWeight: activeTab === key ? 700 : 400,
          transition: "background 0.2s, border-color 0.2s, color 0.2s",
          minHeight: 30, opacity: disabled ? 0.4 : 1,
        }}>{label}</button>
      ))}
    </div>
  );
}

export default function PeriodSelector({
  tabs, activeTab, onTabChange,
  dates = [], selectedDate, onDateChange,
  periodType = "week",
}) {
  // Group all dates by "YYYY-MM"
  const byMonth = useMemo(() => {
    const map = {};
    dates.forEach(d => { const m = d.slice(0, 7); (map[m] = map[m] || []).push(d); });
    return map;
  }, [dates]);

  const months = useMemo(() => Object.keys(byMonth).sort().reverse(), [byMonth]);

  // Derive active month from selectedDate or fall back to most recent
  const curMonth = (selectedDate && byMonth[selectedDate.slice(0, 7)])
    ? selectedDate.slice(0, 7)
    : months[0] || null;

  const curMonthDates = curMonth ? byMonth[curMonth] : [];

  // Group month-dates by ISO week (used in "day" mode)
  const byWeek = useMemo(() => {
    const map = {};
    curMonthDates.forEach(d => {
      const w = isoWeekNum(d);
      (map[w] = map[w] || []).push(d);
    });
    return map;
  }, [curMonthDates]);

  const weekNums = useMemo(() => Object.keys(byWeek).map(Number).sort((a, b) => b - a), [byWeek]);

  // Derive active week from selectedDate or fall back to most recent
  const selectedWeekNum = selectedDate ? isoWeekNum(selectedDate) : null;
  const curWeek = (selectedWeekNum && byWeek[selectedWeekNum])
    ? selectedWeekNum
    : weekNums[0] || null;

  const weekDates = curWeek != null ? [...(byWeek[curWeek] || [])].sort() : [];

  // ── DAILY: Month dropdown → Week dropdown → Day-of-week pills ───────────
  if (periodType === "day") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {months.length > 1 && (
          <select value={curMonth || ""} style={getSel()}
            onChange={e => {
              const m = e.target.value;
              const recent = [...(byMonth[m] || [])].sort().reverse()[0];
              if (recent) onDateChange(recent);
            }}>
            {months.map(m => <option key={m} value={m}>{fmtMonthKey(m)}</option>)}
          </select>
        )}
        {weekNums.length > 1 && (
          <select value={curWeek ?? ""} style={getSel()}
            onChange={e => {
              const w = +e.target.value;
              const recent = [...(byWeek[w] || [])].sort().reverse()[0];
              if (recent) onDateChange(recent);
            }}>
            {weekNums.map(w => (
              <option key={w} value={w}>Sem {w} · {weekRange(byWeek[w])}</option>
            ))}
          </select>
        )}
        {weekDates.length > 0 && (
          <div style={{ display: "flex", gap: 3 }}>
            {weekDates.map(d => {
              const label = DOW[new Date(d + "T12:00:00").getDay()];
              const active = d === selectedDate;
              return (
                <button key={d} onClick={() => onDateChange(d)} style={{
                  background: active ? "rgba(59,130,246,0.18)" : T.bgControl,
                  border: `1px solid ${active ? "#3b82f688" : T.border}`,
                  borderRadius: 7, padding: "5px 10px",
                  color: active ? "#3b82f6" : T.t4,
                  fontSize: 12, fontWeight: active ? 700 : 400,
                  cursor: "pointer", minHeight: 30,
                  transition: "background 0.15s, color 0.15s",
                }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── WEEK: Tabs + Month pre-filter + Week dropdown with "Sem N" labels ───
  if (periodType === "week") {
    const weekDropdownDates = curMonth ? curMonthDates : dates;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
        {months.length > 1 && (
          <select value={curMonth || ""} style={getSel()}
            onChange={e => {
              const m = e.target.value;
              const recent = [...(byMonth[m] || [])].sort().reverse()[0];
              if (recent) onDateChange(recent);
            }}>
            {months.map(m => <option key={m} value={m}>{fmtMonthKey(m)}</option>)}
          </select>
        )}
        {weekDropdownDates.length > 0 && (
          <select value={selectedDate || ""} style={getSel()} onChange={e => onDateChange(e.target.value)}>
            {weekDropdownDates.map(d => (
              <option key={d} value={d}>{fmtWeekDate(d)}</option>
            ))}
          </select>
        )}
      </div>
    );
  }

  // ── MONTH: Tabs + Month dropdown ─────────────────────────────────────────
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      {dates.length > 0 && (
        <select value={selectedDate || ""} style={getSel()} onChange={e => onDateChange(e.target.value)}>
          {dates.map(d => (
            <option key={d} value={d}>{fmtMonthDate(d)}</option>
          ))}
        </select>
      )}
    </div>
  );
}

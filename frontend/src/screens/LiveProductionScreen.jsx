import React, { useEffect, useState } from "react";
import api from "../api";
import { T, scoreColor } from "../theme";
import { Activity, Layers, Clock3, AlertTriangle, Timer } from "lucide-react";

const fmt = n => (n==null?"—":Number(n).toLocaleString("pt-BR"));
const r1  = n => (n==null?"—":Math.round(Number(n)).toLocaleString("pt-BR"));
const rel = ts => { if(!ts) return "—"; const s=(Date.now()-new Date(ts).getTime())/1000; if(s<90) return "agora"; if(s<3600) return Math.floor(s/60)+" min"; return Math.floor(s/3600)+"h"; };
const hhmm = ts => ts? new Date(ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "—";
const SHORT = g => (g||"").replace("BR-ATD-","");
const MEDAL = ["#ffd700","#c0c0c0","#cd7f32"];
const TITLE = 12; // tamanho único dos títulos de seção
const byPct = p => p>=100?"#3b82f6" : p>=90?"#22c55e" : p>=80?"#facc15" : p>=65?"#fb923c" : p>=50?"#ec4899" : "#a855f7";

const Chip = ({ children, color }) => (
  <span style={{ fontSize:10.5, fontWeight:700, color: color||T.t4, background:(color||T.t5)+"1f",
    border:`1px solid ${(color||T.t5)}40`, borderRadius:6, padding:"1px 7px", whiteSpace:"nowrap" }}>{children}</span>
);

// barra com gradiente + gloss + shimmer
function Bar({ pct, color, height, strong, label }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ position:"relative", height, borderRadius:height/2, background:T.bgControl, overflow:"hidden", boxShadow:`inset 0 0 0 1px ${T.border}` }}>
      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:w+"%", borderRadius:height/2,
        background:`linear-gradient(90deg, ${color}d0, ${color})`,
        boxShadow: strong?`0 0 20px ${color}aa`:`0 0 9px ${color}55`,
        transition:"width 1s cubic-bezier(.3,.8,.3,1)", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, rgba(255,255,255,.32), rgba(255,255,255,0) 60%)" }} />
        <div className="lvShine" style={{ position:"absolute", top:0, bottom:0, left:0, width:"38%", background:"linear-gradient(90deg, transparent, rgba(255,255,255,.32), transparent)" }} />
      </div>
      {label && w>20 && <span style={{ position:"absolute", right:10, top:0, height:"100%", display:"flex", alignItems:"center", fontSize:strong?13:11, fontWeight:800, color:"#fff", textShadow:"0 1px 3px #0008" }}>{pct.toFixed(1)}%</span>}
    </div>
  );
}

function Section({ title, accent="#3b82f6", right, children, style, bodyStyle, bodyClass, stripe=3 }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, boxShadow:T.cardShadow,
      position:"relative", overflow:"hidden", padding:"11px 16px", display:"flex", flexDirection:"column", minHeight:0, ...style }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:stripe, background:`linear-gradient(90deg, ${accent}, ${accent}22)` }} />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9, flex:"0 0 auto" }}>
        <div style={{ fontSize:TITLE, fontWeight:700, color:T.t3, textTransform:"uppercase", letterSpacing:.9 }}>{title}</div>
        {right}
      </div>
      <div className={bodyClass} style={{ display:"flex", flexDirection:"column", minHeight:0, flex:"1 1 auto", ...bodyStyle }}>{children}</div>
    </div>
  );
}
const KPIbox = ({ title, value, sub, color, icon }) => (
  <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:13, padding:"10px 15px", position:"relative", overflow:"hidden", boxShadow:T.cardShadow }}>
    <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:`linear-gradient(90deg, ${color}, ${color}22)` }} />
    <div style={{ fontSize:10.5, color:T.t5, textTransform:"uppercase", letterSpacing:.7, display:"flex", alignItems:"center", gap:6 }}>{icon && <span style={{ color }}>{icon}</span>}{title}</div>
    <div style={{ fontSize:26, fontWeight:900, color, lineHeight:1.06, marginTop:3, letterSpacing:-.5, textShadow:T.isDark?`0 0 18px ${color}40`:"none" }}>{value}</div>
    <div style={{ fontSize:10.5, color:T.t5, marginTop:1 }}>{sub}</div>
  </div>
);
const Center = ({children}) => <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:T.t4, fontSize:16, background:T.bg }}>{children}</div>;

export default function LiveProductionScreen() {
  const [d, setD]   = useState(null);
  const [err, setErr] = useState(null);
  const [upd, setUpd] = useState("");
  const [, tick]    = useState(0);
  const [conf, setConf] = useState(false);
  const celebrated = React.useRef(false);
  async function load() {
    try { const { data } = await api.get("/live/board"); setD(data); setErr(null); setUpd(new Date().toLocaleTimeString("pt-BR"));
      const tp = data.teamsProgress || []; const dn = tp.reduce((s,x)=>s+ +x.completed,0), tt = tp.reduce((s,x)=>s+ +x.total,0);
      const pct = tt ? dn/tt*100 : 0;
      if (pct >= 100 && !celebrated.current) { celebrated.current = true; setConf(true); setTimeout(()=>setConf(false), 6500); }
      else if (pct < 100) celebrated.current = false;
    }
    catch (e) { setErr(e?.message || "erro"); }
  }
  useEffect(() => { load(); const t=setInterval(load, 20000); return ()=>clearInterval(t); }, []);
  useEffect(() => { const t=setInterval(()=>tick(x=>x+1), 1000); return ()=>clearInterval(t); }, []);

  if (err) return <Center>Erro ao carregar produção ao vivo: {err}</Center>;
  if (!d)  return <Center>Carregando produção ao vivo…</Center>;

  const teams = d.teams||[], designers = d.designers||[], pend = d.pending||[], tprog = d.teamsProgress||[], quality = d.quality||[];
  const bt = d.byType||{novo:0,refinamento:0,modificacao:0,outro:0};
  const totCasos = teams.reduce((s,t)=>s+ +t.casos,0);
  const tpm={}; tprog.forEach(x=>tpm[x.grp]=x);
  const pm={};  pend.forEach(x=>pm[x.grp]=x);
  const qm={};  quality.forEach(x=>qm[x.grp]=x);
  const gDone = tprog.reduce((s,x)=>s+ +x.completed,0), gTot = tprog.reduce((s,x)=>s+ +x.total,0);
  const gPct = gTot? gDone/gTot*100 : 0, gRest = Math.max(0,gTot-gDone);
  const totOpen=pend.reduce((s,p)=>s+ +p.aberto,0), totToday=pend.reduce((s,p)=>s+ +p.vence_hoje,0), totLate=pend.reduce((s,p)=>s+ +p.atrasado,0);
  let last=null; teams.forEach(x=>{ if(!last||new Date(x.ultimo)>new Date(last)) last=x.ultimo; });
  const qt = (bt.novo+bt.refinamento+bt.modificacao)||1;

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", gap:10, padding:"12px 18px 14px",
      background:T.bg, color:T.t1, fontVariantNumeric:"tabular-nums", overflow:"hidden", boxSizing:"border-box" }}>
      <style>{`
        @keyframes lvPulse{0%{box-shadow:0 0 0 0 ${T.green}77}70%{box-shadow:0 0 0 8px ${T.green}00}100%{box-shadow:0 0 0 0 ${T.green}00}}
        @keyframes lvShimmer{0%{transform:translateX(-170%)}100%{transform:translateX(380%)}}
        .lvShine{animation:lvShimmer 2.6s linear infinite}
        .lvScroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.14) transparent}
        .lvScroll::-webkit-scrollbar{width:6px;height:6px}
        .lvScroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.13);border-radius:3px}
        .lvScroll::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.22)}
        .lvScroll::-webkit-scrollbar-track{background:transparent}
      `}</style>
      {conf && <Confetti />}

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flex:"0 0 auto" }}>
        <div style={{ fontSize:38, fontWeight:900, color:T.t1, letterSpacing:-1.5, textWrap:"balance" }}>Produção ao vivo</div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, background:T.green+"18", border:`1px solid ${T.green}45`, color:T.green, padding:"5px 11px", borderRadius:99, fontSize:11, fontWeight:800, letterSpacing:".1em", boxShadow:`0 0 14px ${T.green}30` }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:T.green, animation:"lvPulse 1.4s infinite" }}/> AO VIVO
          </div>
          <div style={{ color:T.t5, fontSize:10.5 }}>{upd ? "atualizado "+upd : ""}</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:11, flex:"0 0 auto" }}>
        <KPIbox title="Casos hoje"      value={fmt(totCasos)} sub="contagem (produção)" color={T.blue}   icon={<Activity size={13}/>} />
        <KPIbox title="Concluído (eq.)" value={r1(gDone)}     sub="volume equivalente"  color={T.cyan}   icon={<Layers size={13}/>} />
        <KPIbox title="Em aberto"       value={fmt(totOpen)}  sub={fmt(totToday)+" vencem hoje"} color={T.yellow} icon={<Clock3 size={13}/>} />
        <KPIbox title="Atrasados"       value={fmt(totLate)}  sub="fora do prazo"       color={T.red}    icon={<AlertTriangle size={13}/>} />
        <KPIbox title="Última entrega"  value={rel(last)}     sub={hhmm(last)}          color={T.green}  icon={<Timer size={13}/>} />
      </div>

      {/* HERO meta — destaque máximo */}
      <Section title="🎯 Meta do dia · Concluído vs Total (equiv.)" accent={T.cyan} stripe={5}
        style={{ flex:"0 0 auto", padding:"14px 18px", background:`linear-gradient(105deg, ${T.cardAlt}, ${T.card})`, border:`1px solid ${T.cyan}3a`, boxShadow:`${T.cardShadow}, 0 0 30px ${T.cyan}1f` }}
        bodyStyle={{ gap:9 }}
        right={<div style={{ fontSize:13, color:T.t4 }}>
          {gPct>=100 && <span style={{ color:T.green, fontWeight:800, marginRight:10 }}>🎉 Meta batida!</span>}
          <b style={{ fontSize:30, color:byPct(gPct), fontWeight:900, marginRight:7, textShadow:T.isDark?`0 0 26px ${byPct(gPct)}66`:"none" }}>{gPct.toFixed(1)}%</b>
          Concluído <b style={{color:T.t2}}>{r1(gDone)}</b> de {r1(gTot)} · faltam <b style={{ color:T.yellow }}>{r1(gRest)}</b></div>}>
        <Bar pct={gPct} color={byPct(gPct)} height={32} strong />
      </Section>

      {/* main */}
      <div style={{ flex:"1 1 auto", display:"grid", gridTemplateColumns:"1.1fr 1fr", gap:12, minHeight:0 }}>
        {/* progresso por equipe — discreto */}
        <Section title="Progresso por equipe — hoje" accent={T.green} bodyStyle={{ justifyContent:"space-around" }}>
          {teams.map(t => {
            const tt=tpm[t.grp]||{progress:0,completed:0,total:0}; const pv=+tt.progress;
            const p=pm[t.grp]||{aberto:0,atrasado:0}; const q=qm[t.grp]; const col=byPct(pv);
            return (
              <div key={t.grp}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.t3 }}>{SHORT(t.grp)} <Chip color={T.cyan}>👥 {t.designers}</Chip></div>
                  <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                    <b style={{ fontSize:13, color:col }}>{pv}%</b>
                    <span style={{ fontSize:10.5, color:T.t5 }}>{r1(tt.completed)}/{r1(tt.total)}</span>
                    {+p.atrasado>0 && <Chip color={T.red}>{p.atrasado} atr.</Chip>}
                    <Chip color={T.yellow}>{p.aberto} ab.</Chip>
                    {q && <Chip color={scoreColor(+q.nps)}>★ {q.nps}</Chip>}
                  </div>
                </div>
                <Bar pct={pv} color={col} height={11} />
              </div>
            );
          })}
        </Section>

        {/* top designers */}
        <Section title="Top designers — hoje" accent={T.purple} right={<span style={{fontSize:10.5,color:T.t5}}>marcador = média do nível</span>} bodyStyle={{ overflow:"auto" }} bodyClass="lvScroll">
          {designers.map((x,i)=>{
            const col=byPct(+x.progress); const w=Math.min(100,+x.progress);
            const mp = x.media!=null? Math.min(100,+x.media) : null; const mc = T.t1;
            return (
              <div key={x.designer+i} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:`1px solid ${T.borderSubtle}` }}>
                <div style={{ width:20, textAlign:"center", fontWeight:900, fontSize:13, color: i<3?MEDAL[i]:T.t5 }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:600, color:T.t2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{x.designer}</div>
                  <div style={{ fontSize:10, color:T.t5 }}>{SHORT(x.grp)} · {fmt(x.completed)} concl.</div>
                </div>
                <div style={{ position:"relative", width:88, height:15, flexShrink:0 }}>
                  <div style={{ position:"absolute", inset:0, background:T.bgControl, borderRadius:8, overflow:"hidden", boxShadow:`inset 0 0 0 1px ${T.border}` }}>
                    <div style={{ position:"absolute", inset:0, width:w+"%", borderRadius:8, background:`linear-gradient(90deg, ${col}d0, ${col})`, boxShadow:`0 0 10px ${col}55`, transition:"width 1s ease", overflow:"hidden" }}>
                      <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, rgba(255,255,255,.30), rgba(255,255,255,0) 60%)" }}/>
                    </div>
                  </div>
                  {mp!=null && <>
                    <span style={{ position:"absolute", left:mp+"%", top:-4, transform:"translateX(-50%)", width:0, height:0, borderLeft:"3.5px solid transparent", borderRight:"3.5px solid transparent", borderTop:`4px solid ${mc}`, zIndex:3 }}/>
                    <span style={{ position:"absolute", left:mp+"%", top:-2, height:19, width:2.5, background:mc, transform:"translateX(-50%)", borderRadius:2, boxShadow:`0 0 0 1.5px ${T.card}`, zIndex:2 }}/>
                  </>}
                </div>
                <b style={{ width:40, textAlign:"right", color:col, fontSize:12.5, fontWeight:800, flexShrink:0 }}>{Math.round(x.progress)}%</b>
              </div>
            );
          })}
        </Section>
      </div>

      {/* volume por tipo */}
      <Section title="Volume por tipo — hoje" accent={T.purple} style={{ flex:"0 0 auto" }} bodyStyle={{ flexDirection:"row", alignItems:"center", gap:18 }}>
        <Leg c={T.cyan}>Casos novos <b style={{color:T.t1,marginLeft:4}}>{fmt(bt.novo)}</b></Leg>
        <Leg c={T.green}>Refinamentos <b style={{color:T.t1,marginLeft:4}}>{fmt(bt.refinamento)}</b></Leg>
        <Leg c={T.purple}>Modificações <b style={{color:T.t1,marginLeft:4}}>{fmt(bt.modificacao)}</b></Leg>
        <div style={{ flex:1, display:"flex", height:14, borderRadius:7, overflow:"hidden", background:T.bgControl, boxShadow:`inset 0 0 0 1px ${T.border}` }}>
          <Seg c={T.cyan} w={bt.novo/qt*100} /><Seg c={T.green} w={bt.refinamento/qt*100} /><Seg c={T.purple} w={bt.modificacao/qt*100} />
        </div>
      </Section>
    </div>
  );
}
function Confetti() {
  const colors = ["#34d399","#22d3ee","#fbbf24","#f87171","#a78bfa","#38bdf8","#fb923c","#f472b6"];
  const pieces = [];
  for (let i=0;i<150;i++){
    const left=Math.random()*100, delay=Math.random()*0.9, dur=2.6+Math.random()*2.4;
    const c=colors[i%colors.length], rot=Math.random()*360, w=6+Math.random()*8, h=w*(0.4+Math.random()*0.5);
    pieces.push(<i key={i} style={{ position:"absolute", left:left+"%", top:"-6%", width:w, height:h, background:c, borderRadius:2, opacity:0.95, transform:`rotate(${rot}deg)`, animation:`confFall ${dur}s ${delay}s cubic-bezier(.2,.6,.4,1) forwards` }}/>);
  }
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:60 }}>
      <style>{"@keyframes confFall{0%{transform:translateY(-12vh) rotate(0deg);opacity:1}100%{transform:translateY(112vh) rotate(900deg);opacity:.9}}"}</style>
      {pieces}
    </div>
  );
}
const Leg = ({c,children}) => <span style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, color:T.t3, whiteSpace:"nowrap" }}><i style={{ width:10, height:10, borderRadius:"50%", background:c, boxShadow:`0 0 9px ${c}88`, display:"inline-block" }}/>{children}</span>;
const Seg = ({c,w}) => <div style={{ width:w+"%", height:"100%", background:`linear-gradient(180deg, ${c}, ${c}cc)` }} />;

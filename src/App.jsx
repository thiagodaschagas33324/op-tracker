import { useState, useEffect, useRef } from "react";

const PROCESSOS = [
  { id: "PCP",        nome: "PCP",               icone: "📋", cor: "#3B82F6" },
  { id: "CORTE",      nome: "Corte",              icone: "✂️",  cor: "#F59E0B" },
  { id: "DOBRA",      nome: "Dobra",              icone: "🔧", cor: "#8B5CF6" },
  { id: "ACABAMENTO", nome: "Acabamento",         icone: "⚙️",  cor: "#10B981" },
  { id: "QUALIDADE",  nome: "Qualidade",          icone: "✅", cor: "#06B6D4" },
  { id: "LIDER",      nome: "Líder de Produção",  icone: "👷", cor: "#EF4444" },
  { id: "LOGISTICA",  nome: "Logística",          icone: "🚚", cor: "#6B7280" },
];
const PROC_MAP = Object.fromEntries(PROCESSOS.map(p => [p.id, p]));

function useStorage() {
  const [ops, setOpsState]   = useState([]);
  const [movs, setMovsState] = useState([]);
  useEffect(() => {
    try {
      setOpsState(JSON.parse(localStorage.getItem("op_ops") || "[]"));
      setMovsState(JSON.parse(localStorage.getItem("op_movs") || "[]"));
    } catch {}
  }, []);
  const setOps  = v => { const n = typeof v==="function"?v(ops):v;   setOpsState(n);  localStorage.setItem("op_ops",  JSON.stringify(n)); };
  const setMovs = v => { const n = typeof v==="function"?v(movs):v;  setMovsState(n); localStorage.setItem("op_movs", JSON.stringify(n)); };
  return { ops, setOps, movs, setMovs };
}

function now() { return new Date().toLocaleString("pt-BR"); }
function bs(cor) { return { display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:cor+"22",color:cor,border:`1px solid ${cor}44` }; }
const Badge = ({ status }) => status==="ENCERRADA" ? <span style={bs("#10B981")}>✅ Encerrada</span> : <span style={bs("#F97316")}>⏳ Em Andamento</span>;
function ProcBadge({ id }) { const p=PROC_MAP[id]; if(!p) return null; return <span style={bs(p.cor)}>{p.icone} {p.nome}</span>; }

// ─── CAMERA SCANNER ───────────────────────────────────────────────────────────
function CameraScanner({ onDetect, onClose }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const activeRef = useRef(false);
  const canvasRef = useRef(document.createElement("canvas"));
  const [status, setStatus]     = useState("loading");
  const [erro, setErro]         = useState("");
  const [facingBack, setFacingBack] = useState(true);

  useEffect(() => { loadQuagga(); return () => stopAll(); }, []);

  function loadQuagga() {
    if (window.Quagga) { startCamera(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js";
    s.onload  = () => startCamera(true);
    s.onerror = () => { setStatus("error"); setErro("Falha ao carregar biblioteca.\nTente recarregar a página."); };
    document.head.appendChild(s);
  }

  async function startCamera(back) {
    stopAll();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: back ? { ideal:"environment" } : { ideal:"user" }, width:{ideal:1280}, height:{ideal:720} }
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStatus("ready"); activeRef.current = true; scanLoop();
    } catch(e) {
      setStatus("error");
      setErro(e.name==="NotAllowedError"
        ? "Permissão negada.\nVá em Ajustes > Safari > Câmera e permita o acesso."
        : "Não foi possível acessar a câmera:\n" + e.message);
    }
  }

  function scanLoop() {
    if (!activeRef.current || !videoRef.current || !window.Quagga) return;
    const v = videoRef.current;
    if (v.readyState !== 4) { rafRef.current = requestAnimationFrame(scanLoop); return; }
    const c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    window.Quagga.decodeSingle({
      decoder: { readers:["code_128_reader","code_39_reader","ean_reader","ean_8_reader","upc_reader","i2of5_reader"] },
      locate: true, src: c.toDataURL("image/jpeg", 0.8),
    }, r => {
      if (r?.codeResult?.code && activeRef.current) {
        activeRef.current = false;
        if (videoRef.current) videoRef.current.style.outline = "4px solid #10B981";
        setTimeout(() => { if(videoRef.current) videoRef.current.style.outline="none"; onDetect(r.codeResult.code); }, 300);
        return;
      }
      if (activeRef.current) rafRef.current = requestAnimationFrame(() => setTimeout(scanLoop, 250));
    });
  }

  function stopAll() {
    activeRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; }
  }

  async function trocarCamera() {
    const next = !facingBack; setFacingBack(next); setStatus("loading"); await startCamera(next);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.97)",zIndex:2000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:12}}>
      <style>{`@keyframes scan{0%,100%{top:5%}50%{top:85%}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:"100%",maxWidth:480,background:"#111318",borderRadius:16,overflow:"hidden",border:"1px solid #333"}}>
        <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #252830"}}>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:"#E8EAF0"}}>📷 Leitura por Câmera</div>
            <div style={{fontSize:11,color:"#6B7280",marginTop:1}}>Aponte para o código de barras da OP</div>
          </div>
          <button onClick={()=>{stopAll();onClose();}} style={{background:"#1A1D24",border:"1px solid #333",borderRadius:8,color:"#9CA3AF",padding:"6px 14px",fontSize:13,fontWeight:700}}>✕ Fechar</button>
        </div>
        <div style={{position:"relative",background:"#000",width:"100%",aspectRatio:"4/3",overflow:"hidden"}}>
          <video ref={videoRef} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} playsInline muted autoPlay/>
          {status==="ready"&&(
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
              <div style={{position:"relative",width:"80%",maxWidth:320,aspectRatio:"3/1"}}>
                {[[{top:0,left:0},{borderTop:"3px solid #F97316",borderLeft:"3px solid #F97316"}],[{top:0,right:0},{borderTop:"3px solid #F97316",borderRight:"3px solid #F97316"}],[{bottom:0,left:0},{borderBottom:"3px solid #F97316",borderLeft:"3px solid #F97316"}],[{bottom:0,right:0},{borderBottom:"3px solid #F97316",borderRight:"3px solid #F97316"}]].map(([pos,b],i)=>(
                  <div key={i} style={{position:"absolute",width:28,height:28,...pos,...b}}/>
                ))}
                <div style={{position:"absolute",left:"5%",right:"5%",top:"50%",height:2,background:"linear-gradient(90deg,transparent,#F97316,transparent)",animation:"scan 1.8s ease-in-out infinite"}}/>
              </div>
            </div>
          )}
          {status==="loading"&&(
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.8)",gap:12}}>
              <div style={{fontSize:36,animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</div>
              <div style={{color:"#E8EAF0",fontSize:13}}>Iniciando câmera...</div>
            </div>
          )}
          {status==="error"&&(
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.88)",padding:24,gap:12}}>
              <div style={{fontSize:36}}>⚠️</div>
              <div style={{color:"#EF4444",fontSize:13,textAlign:"center",lineHeight:1.6,whiteSpace:"pre-line"}}>{erro}</div>
            </div>
          )}
        </div>
        <div style={{padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid #252830",background:"#0D0F14"}}>
          <div style={{fontSize:11,color:status==="ready"?"#10B981":"#6B7280",display:"flex",alignItems:"center",gap:6}}>
            {status==="ready"&&<><span style={{width:6,height:6,borderRadius:"50%",background:"#10B981",display:"inline-block"}}/>Câmera ativa</>}
            {status==="loading"&&"Aguarde..."}
          </div>
          <button onClick={trocarCamera} style={{background:"#1A1D24",border:"1px solid #333",borderRadius:8,color:"#E8EAF0",padding:"6px 14px",fontSize:12,fontWeight:700}}>
            🔄 {facingBack?"Frontal":"Traseira"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ ops, onNav }) {
  const em = ops.filter(o=>o.status==="EM_ANDAMENTO");
  const en = ops.filter(o=>o.status==="ENCERRADA");
  const pp = {}; em.forEach(o=>{ pp[o.processo_atual]=(pp[o.processo_atual]||0)+1; });
  return (
    <div>
      <div style={S.topbar}>
        <div><div style={S.pageTitle}>Dashboard</div><div style={S.pageSub}>Visão geral das Ordens de Produção</div></div>
        <button style={S.btnPrimary} onClick={()=>onNav("scanner")}>➕ Registrar OP</button>
      </div>
      <div style={S.content}>
        <div style={S.cardGrid}>
          {[{l:"Total",v:ops.length,c:"#3B82F6"},{l:"Em Andamento",v:em.length,c:"#F97316"},{l:"Encerradas",v:en.length,c:"#10B981"}]
            .map(s=><div key={s.l} style={S.card}><div style={S.cardLabel}>{s.l}</div><div style={{...S.cardValue,color:s.c}}>{s.v}</div></div>)}
        </div>
        <div style={{marginBottom:24}}>
          <div style={S.sectionLabel}>Por Processo (em andamento)</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10}}>
            {PROCESSOS.map(p=>(
              <div key={p.id} style={{...S.card,textAlign:"center",padding:"14px 8px",borderColor:p.cor+"33"}}>
                <div style={{fontSize:22,marginBottom:4}}>{p.icone}</div>
                <div style={{fontSize:10,fontWeight:700,color:"#6B7280",marginBottom:4}}>{p.nome}</div>
                <div style={{fontSize:26,fontWeight:800,fontFamily:"monospace",color:p.cor}}>{pp[p.id]||0}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={S.sectionLabel}>Últimas OPs</div>
            <button style={S.btnGhost} onClick={()=>onNav("ops")}>Ver todas →</button>
          </div>
          <div style={S.tableWrap}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Código","Processo","Status",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {ops.slice().reverse().slice(0,10).map(op=>(
                  <tr key={op.codigo}>
                    <td style={S.td}><span style={S.opCode}>{op.codigo}</span></td>
                    <td style={S.td}><ProcBadge id={op.processo_atual}/></td>
                    <td style={S.td}><Badge status={op.status}/></td>
                    <td style={S.td}><button style={S.btnGhost} onClick={()=>onNav("detalhe",op.codigo)}>Ver →</button></td>
                  </tr>
                ))}
                {!ops.length&&<tr><td colSpan={4} style={{textAlign:"center",color:"#6B7280",padding:32}}>Nenhuma OP registrada ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCANNER ──────────────────────────────────────────────────────────────────
function Scanner({ ops, setOps, movs, setMovs }) {
  const [processo,  setProcesso]  = useState("");
  const [codigo,    setCodigo]    = useState("");
  const [operador,  setOperador]  = useState("");
  const [obs,       setObs]       = useState("");
  const [resultado, setResultado] = useState(null);
  const [camAberta, setCamAberta] = useState(false);
  const [erros,     setErros]     = useState({});
  const inputRef = useRef(null);

  function validar() {
    const e = {};
    if (!codigo.trim())   e.codigo   = "Informe o código da OP";
    if (!processo)        e.processo = "Selecione o processo";
    if (!operador.trim()) e.operador = "Informe o operador responsável";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function onCamDetect(cod) {
    setCamAberta(false); setCodigo(cod); setResultado(null);
    setErros(prev => ({...prev, codigo: undefined}));
    setTimeout(()=>inputRef.current?.focus(), 150);
  }

  function registrar() {
    if (!validar()) return;
    const cod = codigo.trim();
    const agora = now();
    const novoStatus = processo==="LOGISTICA" ? "ENCERRADA" : "EM_ANDAMENTO";
    setOps(prev => {
      if (prev.find(o=>o.codigo===cod)) return prev.map(o=>o.codigo===cod?{...o,processo_atual:processo,status:novoStatus}:o);
      return [...prev,{codigo:cod,cliente:"",descricao:"",data_criacao:agora,processo_atual:processo,status:novoStatus,criado_em:agora}];
    });
    const nm = {op_codigo:cod,processo,operador:operador.trim(),observacao:obs,data_hora:agora};
    setMovs(prev=>[...prev,nm]);
    const hist=[...movs.filter(m=>m.op_codigo===cod),nm];
    setResultado({ok:true,codigo:cod,status:novoStatus,historico:hist,
      msg:`✅ OP ${cod} registrada em ${PROC_MAP[processo]?.nome}${novoStatus==="ENCERRADA"?" — ENCERRADA!":""}`});
    setCodigo(""); setObs(""); setErros({});
    setTimeout(()=>inputRef.current?.focus(),100);
  }

  return (
    <div>
      {camAberta&&<CameraScanner onDetect={onCamDetect} onClose={()=>setCamAberta(false)}/>}
      <div style={S.topbar}>
        <div><div style={S.pageTitle}>📷 Registrar OP</div><div style={S.pageSub}>Câmera, leitor USB ou digitação manual</div></div>
      </div>
      <div style={{...S.content, maxWidth:680}}>

        {/* PROCESSO */}
        <div style={{...S.card, marginBottom:16}}>
          <div style={S.sectionLabel}>1. Selecione o Processo {erros.processo&&<span style={{color:"#EF4444",fontStyle:"normal",textTransform:"none",letterSpacing:0}}>— {erros.processo}</span>}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(88px,1fr))",gap:8}}>
            {PROCESSOS.map(p=>(
              <div key={p.id} onClick={()=>{setProcesso(p.id);setErros(prev=>({...prev,processo:undefined}));setTimeout(()=>inputRef.current?.focus(),50);}}
                style={{background:processo===p.id?p.cor+"22":"#1A1D24",border:`2px solid ${processo===p.id?p.cor:erros.processo?"#EF444466":"#252830"}`,borderRadius:10,padding:"12px 6px",textAlign:"center",cursor:"pointer",transition:".15s"}}>
                <div style={{fontSize:20,marginBottom:4}}>{p.icone}</div>
                <div style={{fontSize:10,fontWeight:700,color:processo===p.id?p.cor:"#6B7280",lineHeight:1.3}}>{p.nome}</div>
              </div>
            ))}
          </div>
        </div>

        {/* OPERADOR — vem antes do código para destaque */}
        <div style={{...S.card, marginBottom:16}}>
          <div style={S.sectionLabel}>2. Operador Responsável</div>
          <input value={operador} onChange={e=>{setOperador(e.target.value);setErros(prev=>({...prev,operador:undefined}));}}
            placeholder="Digite seu nome ou matrícula"
            style={{...S.input, borderColor: erros.operador?"#EF4444":"#252830", fontSize:15}}/>
          {erros.operador&&<div style={{color:"#EF4444",fontSize:12,marginTop:6}}>⚠️ {erros.operador}</div>}
        </div>

        {/* CÓDIGO */}
        <div style={{...S.card, marginBottom:16}}>
          <div style={S.sectionLabel}>3. Código da OP</div>
          <button onClick={()=>setCamAberta(true)}
            style={{width:"100%",padding:"14px",marginBottom:12,background:"#0D0F14",border:"2px dashed #F97316",borderRadius:12,color:"#F97316",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
            <span style={{fontSize:28}}>📷</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:14,fontWeight:800}}>Abrir Câmera</div>
              <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>Celular, tablet ou webcam · Code 128, QR Code e outros</div>
            </div>
          </button>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{flex:1,height:1,background:"#252830"}}/><span style={{fontSize:10,color:"#4B5563",fontWeight:700,whiteSpace:"nowrap"}}>OU LEITOR USB / DIGITAÇÃO</span><div style={{flex:1,height:1,background:"#252830"}}/>
          </div>
          <div style={{display:"flex",gap:10,marginBottom:8}}>
            <input ref={inputRef} value={codigo} onChange={e=>{setCodigo(e.target.value);setResultado(null);setErros(prev=>({...prev,codigo:undefined}));}}
              onKeyDown={e=>e.key==="Enter"&&registrar()} placeholder="Ex: OP-2024-001234"
              style={{...S.input,fontSize:16,fontFamily:"monospace",letterSpacing:2,color:"#F97316",flex:1,borderColor:erros.codigo?"#EF4444":"#252830"}}/>
          </div>
          {erros.codigo&&<div style={{color:"#EF4444",fontSize:12,marginBottom:8}}>⚠️ {erros.codigo}</div>}
          <div style={{marginTop:8}}>
            <label style={S.label}>Observação (opcional)</label>
            <input value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ex: Peça com retrabalho" style={S.input}/>
          </div>
        </div>

        <button style={{...S.btnPrimary,width:"100%",justifyContent:"center",padding:"14px",fontSize:15}} onClick={registrar}>
          ✅ Confirmar Registro
        </button>

        {resultado&&(
          <div style={{marginTop:16}}>
            <div style={{padding:"14px 18px",borderRadius:10,marginBottom:12,fontSize:13,background:resultado.ok?"#10B98122":"#EF444422",border:`1px solid ${resultado.ok?"#10B98144":"#EF444444"}`,color:resultado.ok?"#10B981":"#EF4444"}}>
              {resultado.msg}
            </div>
            {resultado.ok&&resultado.historico&&(
              <div style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <span style={S.opCode}>{resultado.codigo}</span><Badge status={resultado.status}/>
                </div>
                <div style={S.sectionLabel}>Histórico desta OP</div>
                {resultado.historico.map((m,i)=>{
                  const p=PROC_MAP[m.processo]||{icone:"📌",nome:m.processo,cor:"#888"};
                  return <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:i<resultado.historico.length-1?"1px solid #252830":"none"}}>
                    <div style={{fontSize:20}}>{p.icone}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:p.cor}}>{p.nome}</div>
                      <div style={{fontSize:11,color:"#6B7280"}}>{m.data_hora} — {m.operador}</div>
                      {m.observacao&&<div style={{fontSize:11,color:"#F59E0B",marginTop:2}}>📝 {m.observacao}</div>}
                    </div>
                  </div>;
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LISTA OPs ────────────────────────────────────────────────────────────────
function ListaOps({ ops, onNav }) {
  const [busca,setBusca]=useState(""); const [fS,setFS]=useState(""); const [fP,setFP]=useState("");
  const f = ops.filter(o=>{
    if(fS&&o.status!==fS)return false; if(fP&&o.processo_atual!==fP)return false;
    if(busca){const b=busca.toLowerCase();if(!o.codigo.toLowerCase().includes(b)&&!(o.cliente||"").toLowerCase().includes(b))return false;}
    return true;
  }).slice().reverse();
  return (
    <div>
      <div style={S.topbar}>
        <div><div style={S.pageTitle}>📋 Ordens de Produção</div><div style={S.pageSub}>{f.length} resultado(s)</div></div>
        <button style={S.btnPrimary} onClick={()=>onNav("scanner")}>➕ Registrar</button>
      </div>
      <div style={S.content}>
        <div style={{...S.card,marginBottom:16}}>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
            <div style={{flex:1,minWidth:150}}><label style={S.label}>Buscar</label><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Código ou cliente..." style={S.input}/></div>
            <div style={{minWidth:130}}><label style={S.label}>Status</label>
              <select value={fS} onChange={e=>setFS(e.target.value)} style={S.input}><option value="">Todos</option><option value="EM_ANDAMENTO">Em Andamento</option><option value="ENCERRADA">Encerrada</option></select></div>
            <div style={{minWidth:130}}><label style={S.label}>Processo</label>
              <select value={fP} onChange={e=>setFP(e.target.value)} style={S.input}><option value="">Todos</option>{PROCESSOS.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            <button style={S.btnGhost} onClick={()=>{setBusca("");setFS("");setFP("");}}>✕</button>
          </div>
        </div>
        <div style={S.tableWrap}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Código","Processo","Status","Data",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {f.map(op=>(
                <tr key={op.codigo}>
                  <td style={S.td}><span style={S.opCode}>{op.codigo}</span></td>
                  <td style={S.td}><ProcBadge id={op.processo_atual}/></td>
                  <td style={S.td}><Badge status={op.status}/></td>
                  <td style={{...S.td,fontSize:11,color:"#6B7280"}}>{op.criado_em}</td>
                  <td style={S.td}><button style={S.btnGhost} onClick={()=>onNav("detalhe",op.codigo)}>Ver →</button></td>
                </tr>
              ))}
              {!f.length&&<tr><td colSpan={5} style={{textAlign:"center",color:"#6B7280",padding:32}}>Nenhuma OP encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── DETALHE ──────────────────────────────────────────────────────────────────
function DetalheOp({ codigo, ops, movs, onNav }) {
  const op = ops.find(o=>o.codigo===codigo);
  if(!op) return <div style={{padding:32,color:"#6B7280"}}>OP não encontrada. <button style={S.btnGhost} onClick={()=>onNav("ops")}>← Voltar</button></div>;
  const hist = movs.filter(m=>m.op_codigo===codigo);
  const pass = hist.map(m=>m.processo);
  return (
    <div>
      <div style={S.topbar}>
        <div><div style={S.pageTitle}>OP {op.codigo}</div><div style={S.pageSub}>{op.criado_em}</div></div>
        <div style={{display:"flex",gap:8}}>
          <button style={S.btnPrimary} onClick={()=>onNav("scanner")}>📷 Registrar</button>
          <button style={S.btnGhost} onClick={()=>onNav("ops")}>← Voltar</button>
        </div>
      </div>
      <div style={S.content}>
        <div style={S.cardGrid}>
          <div style={S.card}><div style={S.cardLabel}>Status</div><div style={{marginTop:8}}><Badge status={op.status}/></div></div>
          <div style={S.card}><div style={S.cardLabel}>Processo Atual</div><div style={{marginTop:8}}><ProcBadge id={op.processo_atual}/></div></div>
          <div style={S.card}><div style={S.cardLabel}>Etapas</div><div style={{...S.cardValue,color:"#3B82F6"}}>{hist.length}</div></div>
        </div>
        <div style={{...S.card,marginBottom:16}}>
          <div style={S.sectionLabel}>Jornada da OP</div>
          <div style={{display:"flex",alignItems:"center",overflowX:"auto",paddingBottom:8}}>
            {PROCESSOS.map((p,i)=>{
              const cur=p.id===op.processo_atual; const done=pass.includes(p.id)&&!cur;
              return <div key={p.id} style={{display:"flex",alignItems:"center"}}>
                {i>0&&<div style={{color:"#252830",fontSize:16,margin:"0 -3px"}}>›</div>}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:76,padding:"10px 6px",borderRadius:8,opacity:done?.4:1,background:cur?p.cor+"18":"transparent",border:cur?`1px solid ${p.cor}`:"1px solid transparent"}}>
                  <div style={{fontSize:18}}>{p.icone}</div>
                  <div style={{fontSize:9,fontWeight:700,textAlign:"center",color:cur?p.cor:"#6B7280",lineHeight:1.3}}>{p.nome}</div>
                  {pass.includes(p.id)&&<div style={{fontSize:9,color:"#10B981",fontWeight:700}}>✓</div>}
                </div>
              </div>;
            })}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.sectionLabel}>Histórico Completo</div>
          {!hist.length?<div style={{textAlign:"center",color:"#6B7280",padding:24}}>Nenhuma movimentação.</div>:(
            <div style={{position:"relative",paddingLeft:26}}>
              <div style={{position:"absolute",left:7,top:0,bottom:0,width:2,background:"#252830"}}/>
              {hist.map((m,i)=>{
                const p=PROC_MAP[m.processo]||{icone:"📌",nome:m.processo,cor:"#888"};
                return <div key={i} style={{position:"relative",marginBottom:18}}>
                  <div style={{position:"absolute",left:-22,top:2,width:13,height:13,borderRadius:"50%",border:"2px solid #0A0C10",background:p.cor}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:p.cor}}>{p.icone} {p.nome}</div>
                      <div style={{fontSize:12,color:"#9CA3AF"}}>👤 {m.operador}</div>
                      {m.observacao&&<div style={{fontSize:11,color:"#F59E0B",marginTop:2}}>📝 {m.observacao}</div>}
                    </div>
                    <div style={{fontSize:10,color:"#6B7280",whiteSpace:"nowrap",flexShrink:0}}>{m.data_hora}</div>
                  </div>
                </div>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const { ops, setOps, movs, setMovs } = useStorage();
  const [tela, setTela]   = useState("dashboard");
  const [param, setParam] = useState("");
  function onNav(t,p="") { setTela(t); setParam(p); window.scrollTo(0,0); }

  const navItems = [{id:"dashboard",l:"Dashboard",i:"📊"},{id:"scanner",l:"Registrar OP",i:"📷"},{id:"ops",l:"Todas as OPs",i:"📋"}];

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"#0A0C10",color:"#E8EAF0",fontFamily:"'Syne',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
        input,select{outline:none}button{cursor:pointer;font-family:inherit}
        /* MOBILE NAV */
        .mob-nav{display:none}
        .desk-sidebar{display:flex}
        @media(max-width:640px){
          .mob-nav{display:flex!important}
          .desk-sidebar{display:none!important}
          .page-content{padding:16px!important}
          .topbar-inner{padding:12px 16px!important}
        }
      `}</style>

      {/* SIDEBAR — desktop only */}
      <aside className="desk-sidebar" style={{width:210,background:"#111318",borderRight:"1px solid #252830",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:"20px 18px",borderBottom:"1px solid #252830",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:26}}>🏭</span>
          <div><div style={{fontSize:14,fontWeight:800}}>OP Tracker</div><div style={{fontSize:9,color:"#6B7280",letterSpacing:1,textTransform:"uppercase"}}>Rastreabilidade</div></div>
        </div>
        <nav style={{padding:"14px 10px",flex:1}}>
          {navItems.map(n=>(
            <div key={n.id} onClick={()=>onNav(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:2,background:tela===n.id?"#F97316":"transparent",color:tela===n.id?"#fff":"#6B7280"}}>
              <span>{n.i}</span>{n.l}
            </div>
          ))}
        </nav>
        <div style={{padding:14,borderTop:"1px solid #252830"}}>
          <div style={{fontSize:11,color:"#6B7280",display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#10B981",display:"inline-block"}}/>
            {ops.length} OPs salvas
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <main style={{flex:1,overflow:"auto",paddingBottom:72}}>
          {tela==="dashboard"&&<Dashboard ops={ops} onNav={onNav}/>}
          {tela==="scanner"  &&<Scanner ops={ops} setOps={setOps} movs={movs} setMovs={setMovs}/>}
          {tela==="ops"      &&<ListaOps ops={ops} onNav={onNav}/>}
          {tela==="detalhe"  &&<DetalheOp codigo={param} ops={ops} movs={movs} onNav={onNav}/>}
        </main>

        {/* BOTTOM NAV — mobile only */}
        <nav className="mob-nav" style={{position:"fixed",bottom:0,left:0,right:0,background:"#111318",borderTop:"1px solid #252830",display:"none",justifyContent:"space-around",alignItems:"center",padding:"8px 0",zIndex:100}}>
          {navItems.map(n=>(
            <div key={n.id} onClick={()=>onNav(n.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 16px",borderRadius:8,cursor:"pointer",background:tela===n.id?"#F9731620":"transparent"}}>
              <span style={{fontSize:20}}>{n.i}</span>
              <span style={{fontSize:10,fontWeight:700,color:tela===n.id?"#F97316":"#6B7280"}}>{n.l}</span>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

const S = {
  topbar:      {padding:"16px 24px",borderBottom:"1px solid #252830",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#111318",position:"sticky",top:0,zIndex:10},
  pageTitle:   {fontSize:18,fontWeight:800},
  pageSub:     {fontSize:11,color:"#6B7280",marginTop:2},
  content:     {padding:24},
  cardGrid:    {display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20},
  card:        {background:"#111318",border:"1px solid #252830",borderRadius:12,padding:16},
  cardLabel:   {fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6B7280",marginBottom:6},
  cardValue:   {fontSize:30,fontWeight:800,fontFamily:"monospace"},
  sectionLabel:{fontSize:10,fontWeight:700,letterSpacing:"1.5px",color:"#6B7280",textTransform:"uppercase",marginBottom:12},
  tableWrap:   {background:"#111318",border:"1px solid #252830",borderRadius:12,overflow:"hidden",overflowX:"auto"},
  th:          {padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",color:"#6B7280",borderBottom:"1px solid #252830",background:"#1A1D24",whiteSpace:"nowrap"},
  td:          {padding:"10px 14px",fontSize:13,borderBottom:"1px solid #252830",whiteSpace:"nowrap"},
  opCode:      {fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#F97316",letterSpacing:1,background:"#1A1D24",padding:"3px 8px",borderRadius:6,border:"1px solid #252830"},
  input:       {background:"#1A1D24",border:"1px solid #252830",borderRadius:8,color:"#E8EAF0",padding:"10px 14px",fontSize:13,fontFamily:"inherit",width:"100%",transition:".15s"},
  label:       {fontSize:11,fontWeight:700,letterSpacing:".5px",color:"#6B7280",display:"block",marginBottom:5},
  btnPrimary:  {background:"#F97316",color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:700,display:"inline-flex",alignItems:"center",gap:6},
  btnGhost:    {background:"transparent",color:"#6B7280",border:"1px solid #252830",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700},
};

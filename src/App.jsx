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
      setOpsState(JSON.parse(localStorage.getItem("op_tracker_ops") || "[]"));
      setMovsState(JSON.parse(localStorage.getItem("op_tracker_movs") || "[]"));
    } catch {}
  }, []);
  const setOps  = v => { const n = typeof v==="function"?v(ops):v;   setOpsState(n);  localStorage.setItem("op_tracker_ops",  JSON.stringify(n)); };
  const setMovs = v => { const n = typeof v==="function"?v(movs):v;  setMovsState(n); localStorage.setItem("op_tracker_movs", JSON.stringify(n)); };
  return { ops, setOps, movs, setMovs };
}

function now() { return new Date().toLocaleString("pt-BR"); }
function bs(cor) { return { display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:cor+"22",color:cor,border:`1px solid ${cor}44` }; }
const Badge = ({ status }) => status==="ENCERRADA" ? <span style={bs("#10B981")}>✅ Encerrada</span> : <span style={bs("#F97316")}>⏳ Em Andamento</span>;
function ProcBadge({ id }) { const p=PROC_MAP[id]; if(!p) return null; return <span style={bs(p.cor)}>{p.icone} {p.nome}</span>; }

// ─── CAMERA SCANNER ───────────────────────────────────────────────────────────
function CameraScanner({ onDetect, onClose }) {
  const videoRef  = useRef(null);
  const readerRef = useRef(null);
  const activeRef = useRef(false);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [erro,   setErro]   = useState("");
  const [cameras,setCameras]= useState([]);
  const [camIdx, setCamIdx] = useState(0);

  useEffect(() => {
    loadZXing();
    return () => stopReader();
  }, []);

  function loadZXing() {
    if (window.ZXing) { startReader(window.ZXing); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.20.0/zxing.min.js";
    s.onload  = () => startReader(window.ZXing);
    s.onerror = () => { setStatus("error"); setErro("Falha ao carregar biblioteca. Verifique sua internet."); };
    document.head.appendChild(s);
  }

  async function startReader(ZXing) {
    try {
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.EAN_13,   ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.QR_CODE,  ZXing.BarcodeFormat.ITF,
        ZXing.BarcodeFormat.PDF_417,  ZXing.BarcodeFormat.DATA_MATRIX,
      ]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

      const reader = new ZXing.BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      const devs = await ZXing.BrowserMultiFormatReader.listVideoInputDevices();
      if (!devs?.length) { setStatus("error"); setErro("Nenhuma câmera encontrada neste dispositivo."); return; }

      // Sort: back camera first
      const sorted = [...devs].sort((a,b) => /back|rear|traseira|environment/i.test(b.label) - /back|rear|traseira|environment/i.test(a.label));
      setCameras(sorted);
      await beginDecode(reader, sorted, 0);
    } catch(e) {
      setStatus("error");
      setErro("Não foi possível acessar a câmera. Verifique as permissões do navegador.\n" + e.message);
    }
  }

  async function beginDecode(reader, cams, idx) {
    if (!videoRef.current || !cams[idx]) return;
    activeRef.current = true;
    setStatus("ready");
    try {
      await reader.decodeFromVideoDevice(cams[idx].deviceId, videoRef.current, (result, err) => {
        if (result && activeRef.current) {
          activeRef.current = false;
          if (videoRef.current) videoRef.current.style.outline = "4px solid #10B981";
          setTimeout(() => { if(videoRef.current) videoRef.current.style.outline = "none"; }, 500);
          onDetect(result.getText());
        }
      });
    } catch(e) {
      setStatus("error"); setErro("Erro ao iniciar câmera: " + e.message);
    }
  }

  function stopReader() {
    activeRef.current = false;
    try { readerRef.current?.reset(); } catch {}
  }

  async function trocarCamera() {
    if (cameras.length < 2) return;
    stopReader();
    const next = (camIdx + 1) % cameras.length;
    setCamIdx(next);
    setStatus("loading");
    await new Promise(r => setTimeout(r, 400));
    await beginDecode(readerRef.current, cameras, next);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.95)",zIndex:2000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:16}}>
      <style>{`@keyframes scan{0%,100%{top:8%}50%{top:88%}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:"100%",maxWidth:460,background:"#111318",borderRadius:20,overflow:"hidden",border:"1px solid #333"}}>

        <div style={{padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #252830"}}>
          <div>
            <div style={{fontWeight:800,fontSize:16,color:"#E8EAF0"}}>📷 Leitura por Câmera</div>
            <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>Aponte para o código de barras da OP</div>
          </div>
          <button onClick={()=>{stopReader();onClose();}} style={{background:"#1A1D24",border:"1px solid #333",borderRadius:8,color:"#9CA3AF",padding:"6px 14px",fontSize:13,fontWeight:700}}>✕ Fechar</button>
        </div>

        <div style={{position:"relative",background:"#000",width:"100%",aspectRatio:"4/3",overflow:"hidden"}}>
          <video ref={videoRef} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} playsInline muted autoPlay/>

          {/* Mira */}
          {status==="ready" && (
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
              <div style={{position:"relative",width:"75%",maxWidth:300,aspectRatio:"3/1"}}>
                {[[{top:0,left:0},{borderTop:"3px solid #F97316",borderLeft:"3px solid #F97316"}],
                  [{top:0,right:0},{borderTop:"3px solid #F97316",borderRight:"3px solid #F97316"}],
                  [{bottom:0,left:0},{borderBottom:"3px solid #F97316",borderLeft:"3px solid #F97316"}],
                  [{bottom:0,right:0},{borderBottom:"3px solid #F97316",borderRight:"3px solid #F97316"}]
                ].map(([pos,border],i)=>(
                  <div key={i} style={{position:"absolute",width:28,height:28,...pos,...border}}/>
                ))}
                <div style={{position:"absolute",left:"5%",right:"5%",top:"50%",height:2,background:"linear-gradient(90deg,transparent,#F97316,transparent)",animation:"scan 1.8s ease-in-out infinite"}}/>
              </div>
            </div>
          )}

          {status==="loading" && (
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.75)",gap:12}}>
              <div style={{fontSize:36,animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</div>
              <div style={{color:"#E8EAF0",fontSize:13}}>Iniciando câmera...</div>
            </div>
          )}

          {status==="error" && (
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.85)",padding:24,gap:12}}>
              <div style={{fontSize:36}}>⚠️</div>
              <div style={{color:"#EF4444",fontSize:13,textAlign:"center",lineHeight:1.6,whiteSpace:"pre-line"}}>{erro}</div>
            </div>
          )}
        </div>

        <div style={{padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid #252830",background:"#0D0F14"}}>
          <div style={{fontSize:11,color:status==="ready"?"#10B981":"#6B7280",display:"flex",alignItems:"center",gap:6}}>
            {status==="ready" && <><span style={{width:6,height:6,borderRadius:"50%",background:"#10B981",display:"inline-block"}}/>Câmera ativa</>}
            {status==="loading" && "Carregando..."}
          </div>
          {cameras.length > 1 && (
            <button onClick={trocarCamera} style={{background:"#1A1D24",border:"1px solid #333",borderRadius:8,color:"#E8EAF0",padding:"6px 14px",fontSize:12,fontWeight:700}}>
              🔄 Câmera {camIdx+1}/{cameras.length}
            </button>
          )}
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
          {[{l:"Total de OPs",v:ops.length,c:"#3B82F6"},{l:"Em Andamento",v:em.length,c:"#F97316"},{l:"Encerradas",v:en.length,c:"#10B981"}]
            .map(s=><div key={s.l} style={S.card}><div style={S.cardLabel}>{s.l}</div><div style={{...S.cardValue,color:s.c}}>{s.v}</div></div>)}
        </div>
        <div style={{marginBottom:32}}>
          <div style={S.sectionLabel}>OPs por Processo (em andamento)</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:12}}>
            {PROCESSOS.map(p=>(
              <div key={p.id} style={{...S.card,textAlign:"center",padding:"16px 10px",borderColor:p.cor+"33"}}>
                <div style={{fontSize:24,marginBottom:6}}>{p.icone}</div>
                <div style={{fontSize:11,fontWeight:700,color:"#6B7280",marginBottom:6}}>{p.nome}</div>
                <div style={{fontSize:28,fontWeight:800,fontFamily:"monospace",color:p.cor}}>{pp[p.id]||0}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={S.sectionLabel}>Últimas OPs</div>
            <button style={S.btnGhost} onClick={()=>onNav("ops")}>Ver todas →</button>
          </div>
          <div style={S.tableWrap}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Código OP","Cliente","Processo Atual","Status",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {ops.slice().reverse().slice(0,10).map(op=>(
                  <tr key={op.codigo}>
                    <td style={S.td}><span style={S.opCode}>{op.codigo}</span></td>
                    <td style={{...S.td,color:"#9CA3AF"}}>{op.cliente||"—"}</td>
                    <td style={S.td}><ProcBadge id={op.processo_atual}/></td>
                    <td style={S.td}><Badge status={op.status}/></td>
                    <td style={S.td}><button style={S.btnGhost} onClick={()=>onNav("detalhe",op.codigo)}>Ver →</button></td>
                  </tr>
                ))}
                {!ops.length&&<tr><td colSpan={5} style={{textAlign:"center",color:"#6B7280",padding:40}}>Nenhuma OP registrada ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCANNER TELA ─────────────────────────────────────────────────────────────
function Scanner({ ops, setOps, movs, setMovs }) {
  const [processo,  setProcesso]  = useState("");
  const [codigo,    setCodigo]    = useState("");
  const [operador,  setOperador]  = useState("");
  const [obs,       setObs]       = useState("");
  const [resultado, setResultado] = useState(null);
  const [camAberta, setCamAberta] = useState(false);
  const inputRef = useRef(null);

  function onCamDetect(cod) {
    setCamAberta(false);
    setCodigo(cod);
    setResultado(null);
    setTimeout(()=>inputRef.current?.focus(), 150);
  }

  function registrar() {
    const cod = codigo.trim();
    if (!cod)      return setResultado({ok:false,msg:"⚠️ Digite ou leia o código da OP!"});
    if (!processo) return setResultado({ok:false,msg:"⚠️ Selecione o processo primeiro!"});
    const agora = now();
    const novoStatus = processo==="LOGISTICA" ? "ENCERRADA" : "EM_ANDAMENTO";
    setOps(prev => {
      if (prev.find(o=>o.codigo===cod))
        return prev.map(o=>o.codigo===cod?{...o,processo_atual:processo,status:novoStatus}:o);
      return [...prev,{codigo:cod,cliente:"",descricao:"",data_criacao:agora,processo_atual:processo,status:novoStatus,criado_em:agora}];
    });
    const nm = {op_codigo:cod,processo,operador:operador||"Não informado",observacao:obs,data_hora:agora};
    setMovs(prev=>[...prev,nm]);
    const hist=[...movs.filter(m=>m.op_codigo===cod),nm];
    setResultado({ok:true,codigo:cod,status:novoStatus,historico:hist,msg:`✅ OP ${cod} registrada em ${PROC_MAP[processo]?.nome}${novoStatus==="ENCERRADA"?" — ENCERRADA!":""}`});
    setCodigo(""); setObs("");
    setTimeout(()=>inputRef.current?.focus(),100);
  }

  return (
    <div>
      {camAberta && <CameraScanner onDetect={onCamDetect} onClose={()=>setCamAberta(false)}/>}
      <div style={S.topbar}>
        <div><div style={S.pageTitle}>📷 Registrar OP</div><div style={S.pageSub}>Câmera, leitor USB ou digitação manual</div></div>
      </div>
      <div style={{...S.content,maxWidth:700}}>

        <div style={S.card}>
          <div style={S.sectionLabel}>1. Selecione o Processo</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(98px,1fr))",gap:10}}>
            {PROCESSOS.map(p=>(
              <div key={p.id} onClick={()=>{setProcesso(p.id);setTimeout(()=>inputRef.current?.focus(),50);}}
                style={{background:processo===p.id?p.cor+"22":"#1A1D24",border:`2px solid ${processo===p.id?p.cor:"#252830"}`,borderRadius:10,padding:"13px 8px",textAlign:"center",cursor:"pointer",transition:".15s"}}>
                <div style={{fontSize:22,marginBottom:5}}>{p.icone}</div>
                <div style={{fontSize:11,fontWeight:700,color:processo===p.id?p.cor:"#6B7280"}}>{p.nome}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.sectionLabel}>2. Código da OP</div>

          {/* BOTÃO CÂMERA */}
          <button onClick={()=>setCamAberta(true)}
            style={{width:"100%",padding:"16px",marginBottom:14,background:"#0D0F14",border:"2px dashed #F97316",borderRadius:14,color:"#F97316",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:14,transition:".2s"}}>
            <span style={{fontSize:32}}>📷</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:14,fontWeight:800}}>Abrir Câmera</div>
              <div style={{fontSize:11,color:"#9CA3AF",marginTop:3,fontWeight:400}}>Funciona no celular, tablet ou webcam · Lê código de barras e QR Code</div>
            </div>
          </button>

          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{flex:1,height:1,background:"#252830"}}/><span style={{fontSize:11,color:"#4B5563",fontWeight:700,whiteSpace:"nowrap"}}>OU LEITOR USB / DIGITAÇÃO</span><div style={{flex:1,height:1,background:"#252830"}}/>
          </div>

          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <input ref={inputRef} value={codigo} onChange={e=>{setCodigo(e.target.value);setResultado(null);}} onKeyDown={e=>e.key==="Enter"&&registrar()}
              placeholder="Ex: OP-2024-001234"
              style={{...S.input,fontSize:17,fontFamily:"monospace",letterSpacing:2,color:"#F97316",flex:1}}/>
            <button style={S.btnPrimary} onClick={registrar}>✅ Confirmar</button>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={S.label}>Operador / Responsável</label>
              <input value={operador} onChange={e=>setOperador(e.target.value)} placeholder="Seu nome ou matrícula" style={S.input}/></div>
            <div><label style={S.label}>Observação (opcional)</label>
              <input value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ex: Peça com retrabalho" style={S.input}/></div>
          </div>
        </div>

        {resultado && (
          <div>
            <div style={{padding:"14px 18px",borderRadius:10,marginBottom:16,fontSize:13,background:resultado.ok?"#10B98122":"#EF444422",border:`1px solid ${resultado.ok?"#10B98144":"#EF444444"}`,color:resultado.ok?"#10B981":"#EF4444"}}>
              {resultado.msg}
            </div>
            {resultado.ok && resultado.historico && (
              <div style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <span style={S.opCode}>{resultado.codigo}</span><Badge status={resultado.status}/>
                </div>
                <div style={S.sectionLabel}>Histórico desta OP</div>
                {resultado.historico.map((m,i)=>{
                  const p=PROC_MAP[m.processo]||{icone:"📌",nome:m.processo,cor:"#888"};
                  return <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:i<resultado.historico.length-1?"1px solid #252830":"none"}}>
                    <div style={{fontSize:22}}>{p.icone}</div>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:p.cor}}>{p.nome}</div>
                      <div style={{fontSize:11,color:"#6B7280",fontFamily:"monospace"}}>{m.data_hora} — {m.operador}</div>
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
        <button style={S.btnPrimary} onClick={()=>onNav("scanner")}>➕ Registrar OP</button>
      </div>
      <div style={S.content}>
        <div style={{...S.card,marginBottom:24}}>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
            <div style={{flex:1,minWidth:160}}><label style={S.label}>Buscar</label><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Código ou cliente..." style={S.input}/></div>
            <div style={{minWidth:140}}><label style={S.label}>Status</label>
              <select value={fS} onChange={e=>setFS(e.target.value)} style={S.input}><option value="">Todos</option><option value="EM_ANDAMENTO">Em Andamento</option><option value="ENCERRADA">Encerrada</option></select></div>
            <div style={{minWidth:140}}><label style={S.label}>Processo</label>
              <select value={fP} onChange={e=>setFP(e.target.value)} style={S.input}><option value="">Todos</option>{PROCESSOS.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            <button style={S.btnGhost} onClick={()=>{setBusca("");setFS("");setFP("");}}>✕ Limpar</button>
          </div>
        </div>
        <div style={S.tableWrap}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Código OP","Cliente","Processo Atual","Status","Criado em",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {f.map(op=>(
                <tr key={op.codigo}>
                  <td style={S.td}><span style={S.opCode}>{op.codigo}</span></td>
                  <td style={{...S.td,color:"#9CA3AF"}}>{op.cliente||"—"}</td>
                  <td style={S.td}><ProcBadge id={op.processo_atual}/></td>
                  <td style={S.td}><Badge status={op.status}/></td>
                  <td style={{...S.td,fontSize:11,color:"#6B7280",fontFamily:"monospace"}}>{op.criado_em}</td>
                  <td style={S.td}><button style={S.btnGhost} onClick={()=>onNav("detalhe",op.codigo)}>Ver →</button></td>
                </tr>
              ))}
              {!f.length&&<tr><td colSpan={6} style={{textAlign:"center",color:"#6B7280",padding:40}}>Nenhuma OP encontrada.</td></tr>}
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
  if(!op) return <div style={{padding:40,color:"#6B7280"}}>OP não encontrada. <button style={S.btnGhost} onClick={()=>onNav("ops")}>← Voltar</button></div>;
  const hist = movs.filter(m=>m.op_codigo===codigo);
  const pass = hist.map(m=>m.processo);
  return (
    <div>
      <div style={S.topbar}>
        <div><div style={S.pageTitle}>OP {op.codigo}</div><div style={S.pageSub}>{op.criado_em}</div></div>
        <div style={{display:"flex",gap:10}}>
          <button style={S.btnPrimary} onClick={()=>onNav("scanner")}>📷 Registrar Mov.</button>
          <button style={S.btnGhost} onClick={()=>onNav("ops")}>← Voltar</button>
        </div>
      </div>
      <div style={S.content}>
        <div style={S.cardGrid}>
          <div style={S.card}><div style={S.cardLabel}>Status</div><div style={{marginTop:8}}><Badge status={op.status}/></div></div>
          <div style={S.card}><div style={S.cardLabel}>Processo Atual</div><div style={{marginTop:8}}><ProcBadge id={op.processo_atual}/></div></div>
          <div style={S.card}><div style={S.cardLabel}>Etapas Registradas</div><div style={{...S.cardValue,color:"#3B82F6"}}>{hist.length}</div></div>
        </div>
        <div style={S.card}>
          <div style={S.sectionLabel}>Jornada da OP</div>
          <div style={{display:"flex",alignItems:"center",overflowX:"auto",paddingBottom:8}}>
            {PROCESSOS.map((p,i)=>{
              const cur=p.id===op.processo_atual; const done=pass.includes(p.id)&&!cur;
              return <div key={p.id} style={{display:"flex",alignItems:"center"}}>
                {i>0&&<div style={{color:"#252830",fontSize:18,margin:"0 -4px"}}>›</div>}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,minWidth:86,padding:"12px 8px",borderRadius:10,opacity:done?.4:1,background:cur?p.cor+"18":"transparent",border:cur?`1px solid ${p.cor}`:"1px solid transparent"}}>
                  <div style={{fontSize:22}}>{p.icone}</div>
                  <div style={{fontSize:10,fontWeight:700,textAlign:"center",color:cur?p.cor:"#6B7280"}}>{p.nome}</div>
                  {pass.includes(p.id)&&<div style={{fontSize:9,color:"#10B981",fontWeight:700}}>✓</div>}
                </div>
              </div>;
            })}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.sectionLabel}>Histórico Completo</div>
          {!hist.length?<div style={{textAlign:"center",color:"#6B7280",padding:32}}>Nenhuma movimentação.</div>:(
            <div style={{position:"relative",paddingLeft:28}}>
              <div style={{position:"absolute",left:8,top:0,bottom:0,width:2,background:"#252830"}}/>
              {hist.map((m,i)=>{
                const p=PROC_MAP[m.processo]||{icone:"📌",nome:m.processo,cor:"#888"};
                return <div key={i} style={{position:"relative",marginBottom:20}}>
                  <div style={{position:"absolute",left:-24,top:2,width:14,height:14,borderRadius:"50%",border:"2px solid #0A0C10",background:p.cor}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"start"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:p.cor}}>{p.icone} {p.nome}</div>
                      <div style={{fontSize:12,color:"#9CA3AF"}}>Operador: <strong>{m.operador}</strong></div>
                      {m.observacao&&<div style={{fontSize:12,color:"#F59E0B",marginTop:4}}>📝 {m.observacao}</div>}
                    </div>
                    <div style={{fontSize:11,color:"#6B7280",fontFamily:"monospace",whiteSpace:"nowrap",marginLeft:16}}>{m.data_hora}</div>
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
  const [tela, setTela] = useState("dashboard");
  const [param, setParam] = useState("");
  function onNav(t,p="") { setTela(t); setParam(p); }

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"#0A0C10",color:"#E8EAF0",fontFamily:"'Syne',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
        input,select{outline:none}button{cursor:pointer;font-family:inherit}
      `}</style>

      <aside style={{width:220,background:"#111318",borderRight:"1px solid #252830",display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:"22px 20px",borderBottom:"1px solid #252830",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>🏭</span>
          <div><div style={{fontSize:15,fontWeight:800,letterSpacing:-.5}}>OP Tracker</div><div style={{fontSize:10,color:"#6B7280",letterSpacing:1,textTransform:"uppercase"}}>Rastreabilidade</div></div>
        </div>
        <nav style={{padding:"16px 12px",flex:1}}>
          {[{id:"dashboard",l:"Dashboard",i:"📊"},{id:"scanner",l:"Registrar OP",i:"📷"},{id:"ops",l:"Todas as OPs",i:"📋"}].map(n=>(
            <div key={n.id} onClick={()=>onNav(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:2,background:tela===n.id?"#F97316":"transparent",color:tela===n.id?"#fff":"#6B7280"}}>
              <span>{n.i}</span>{n.l}
            </div>
          ))}
        </nav>
        <div style={{padding:16,borderTop:"1px solid #252830"}}>
          <div style={{fontSize:11,color:"#6B7280",display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#10B981",display:"inline-block"}}/>
            {ops.length} OPs salvas
          </div>
        </div>
      </aside>

      <main style={{flex:1,overflow:"auto"}}>
        {tela==="dashboard"&&<Dashboard ops={ops} onNav={onNav}/>}
        {tela==="scanner"  &&<Scanner ops={ops} setOps={setOps} movs={movs} setMovs={setMovs}/>}
        {tela==="ops"      &&<ListaOps ops={ops} onNav={onNav}/>}
        {tela==="detalhe"  &&<DetalheOp codigo={param} ops={ops} movs={movs} onNav={onNav}/>}
      </main>
    </div>
  );
}

const S = {
  topbar:      {padding:"20px 32px",borderBottom:"1px solid #252830",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#111318",position:"sticky",top:0,zIndex:10},
  pageTitle:   {fontSize:20,fontWeight:800},
  pageSub:     {fontSize:12,color:"#6B7280",marginTop:2},
  content:     {padding:32},
  cardGrid:    {display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:16,marginBottom:32},
  card:        {background:"#111318",border:"1px solid #252830",borderRadius:12,padding:20},
  cardLabel:   {fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6B7280",marginBottom:8},
  cardValue:   {fontSize:32,fontWeight:800,fontFamily:"monospace"},
  sectionLabel:{fontSize:11,fontWeight:700,letterSpacing:"1.5px",color:"#6B7280",textTransform:"uppercase",marginBottom:14},
  tableWrap:   {background:"#111318",border:"1px solid #252830",borderRadius:12,overflow:"hidden"},
  th:          {padding:"12px 16px",textAlign:"left",fontSize:10,fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",color:"#6B7280",borderBottom:"1px solid #252830",background:"#1A1D24"},
  td:          {padding:"12px 16px",fontSize:13,borderBottom:"1px solid #252830"},
  opCode:      {fontFamily:"monospace",fontSize:13,fontWeight:700,color:"#F97316",letterSpacing:1,background:"#1A1D24",padding:"3px 10px",borderRadius:6,border:"1px solid #252830"},
  input:       {background:"#1A1D24",border:"1px solid #252830",borderRadius:8,color:"#E8EAF0",padding:"10px 14px",fontSize:13,fontFamily:"inherit",width:"100%",transition:".15s"},
  label:       {fontSize:12,fontWeight:700,letterSpacing:".5px",color:"#6B7280",display:"block",marginBottom:6},
  btnPrimary:  {background:"#F97316",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700,display:"inline-flex",alignItems:"center",gap:7},
  btnGhost:    {background:"transparent",color:"#6B7280",border:"1px solid #252830",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700},
};

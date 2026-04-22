import { useState, useEffect, useRef } from "react";

// ─── CONFIGURAÇÃO SUPABASE ────────────────────────────────────────────────────
// Substitua com seus dados do painel Supabase → Settings → API
const SUPABASE_URL = "https://ubaffcvwngzwvytqgzgj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViYWZmY3Z3bmd6d3Z5dHFnempqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MTI5NTMsImV4cCI6MjA2MTA4ODk1M30.zK7lso62pbGq4yNFG7w8M1e8dIKd0yjBVuFaPfLARsA";

async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${r.status}`);
  }
  const text = await r.text();
  return text ? JSON.parse(text) : [];
}

const PROCESSOS = [
  { id: "PCP",        nome: "PCP",            icone: "📋", cor: "#3B82F6" },
  { id: "CORTE",      nome: "Corte",          icone: "✂️", cor: "#F59E0B" },
  { id: "DOBRA",      nome: "Dobra",          icone: "🔧", cor: "#8B5CF6" },
  { id: "ACABAMENTO", nome: "Acabamento",     icone: "⚙️", cor: "#10B981" },
  { id: "QUALIDADE",  nome: "Qualidade",      icone: "✅", cor: "#06B6D4" },
  { id: "LIDER",      nome: "Líder Produção", icone: "👷", cor: "#EF4444" },
  { id: "LOGISTICA",  nome: "Logística",      icone: "🚚", cor: "#6B7280" },
];
const PM = Object.fromEntries(PROCESSOS.map(p => [p.id, p]));
const now = () => new Date().toISOString();
const fmtDate = iso => iso ? new Date(iso).toLocaleString("pt-BR") : "";

function Tag({ cor, children }) {
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:700,background:cor+"22",color:cor,border:`1px solid ${cor}44`}}>{children}</span>;
}
function StatusTag({ s }) {
  return s==="ENCERRADA" ? <Tag cor="#10B981">✅ Encerrada</Tag> : <Tag cor="#F97316">⏳ Em Andamento</Tag>;
}
function ProcTag({ id }) {
  const p = PM[id]; if (!p) return null;
  return <Tag cor={p.cor}>{p.icone} {p.nome}</Tag>;
}

// ─── CÂMERA ──────────────────────────────────────────────────────────────────
function Cam({ onCode, onClose }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const loopRef   = useRef(null);
  const alive     = useRef(false);
  const canvasRef = useRef(document.createElement("canvas"));
  const [tela,   setTela]  = useState("menu");
  const [status, setSt]    = useState("idle");
  const [msg,    setMsg]   = useState("");
  const [lendo,  setLendo] = useState(false);
  const [manual, setMan]   = useState("");

  useEffect(() => () => stopVideo(), []);

  async function onFileChange(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setTela("foto"); setLendo(true); setMsg("");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      if (typeof BarcodeDetector !== "undefined") {
        try {
          const det = new BarcodeDetector({ formats:["code_128","code_39","ean_13","ean_8","qr_code","itf","pdf417","data_matrix","code_93","upc_a"] });
          const res = await det.detect(img);
          if (res.length) { setLendo(false); onCode(res[0].rawValue); return; }
          setMsg("Código não encontrado.\nTente com mais luz e câmera mais perto."); setLendo(false);
        } catch(er) { setMsg("Erro: "+er.message); setLendo(false); }
      } else {
        const c = canvasRef.current;
        c.width = Math.min(img.width,700); c.height = Math.round(img.height*c.width/img.width);
        c.getContext("2d").drawImage(img,0,0,c.width,c.height);
        setMsg("__preview__"); setLendo(false);
      }
    };
    img.onerror = () => { setMsg("Não foi possível ler a imagem."); setLendo(false); };
    img.src = url;
  }

  async function startVideo() {
    setTela("video"); setSt("loading"); setMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ideal:"environment"}, width:{ideal:1280}, height:{ideal:720} } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setSt("ok"); alive.current = true;
      if (typeof BarcodeDetector !== "undefined") {
        const det = new BarcodeDetector({ formats:["code_128","code_39","ean_13","ean_8","qr_code","itf","data_matrix","code_93"] });
        const loop = async () => {
          if (!alive.current) return;
          try {
            const res = await det.detect(videoRef.current);
            if (res.length && alive.current) { alive.current=false; stopVideo(); onCode(res[0].rawValue); return; }
          } catch {}
          loopRef.current = setTimeout(loop, 350);
        };
        loop();
      }
    } catch(e) {
      setSt("erro");
      setMsg(e.name==="NotAllowedError" ? "Permissão negada.\niPhone: Ajustes → Safari → Câmera → Permitir" : "Câmera não disponível.\nUse a opção Tirar Foto.");
    }
  }

  function stopVideo() {
    alive.current = false;
    if (loopRef.current) clearTimeout(loopRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; }
  }
  function voltar() { stopVideo(); setTela("menu"); setSt("idle"); setMsg(""); setLendo(false); setMan(""); }
  const isPreview = msg==="__preview__";

  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.97)",display:"flex",alignItems:"center",justifyContent:"center",padding:12,overflowY:"auto"}}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}} @keyframes sc{0%,100%{top:4%}50%{top:88%}}`}</style>
      <div style={{width:"100%",maxWidth:440,background:"#111318",borderRadius:16,border:"1px solid #2a2d35",overflow:"hidden"}}>
        <div style={{padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #1e2128"}}>
          <div style={{fontWeight:800,fontSize:15}}>📷 Ler Código de Barras</div>
          <button onClick={()=>{stopVideo();onClose();}} style={{background:"#1a1d24",border:"1px solid #2a2d35",color:"#9ca3af",borderRadius:8,padding:"5px 13px",fontSize:13,fontWeight:700}}>✕</button>
        </div>
        {tela==="menu" && (
          <div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:12,color:"#6b7280",textAlign:"center",marginBottom:4}}>Selecione o método de leitura:</div>
            <label>
              <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={onFileChange}/>
              <div style={{background:"#F9731610",border:"2px solid #F97316",borderRadius:12,padding:16,display:"flex",alignItems:"center",gap:14,cursor:"pointer"}}>
                <span style={{fontSize:34}}>📱</span>
                <div>
                  <div style={{fontWeight:800,fontSize:14,color:"#F97316"}}>Tirar Foto do Código</div>
                  <div style={{fontSize:11,color:"#9ca3af",marginTop:3}}>✅ iPhone e Android · Câmera nativa · Recomendado</div>
                </div>
              </div>
            </label>
            <div onClick={startVideo} style={{background:"#3B82F608",border:"2px solid #3B82F633",borderRadius:12,padding:16,display:"flex",alignItems:"center",gap:14,cursor:"pointer"}}>
              <span style={{fontSize:34}}>🎥</span>
              <div>
                <div style={{fontWeight:800,fontSize:14,color:"#3B82F6"}}>Câmera ao Vivo</div>
                <div style={{fontSize:11,color:"#9ca3af",marginTop:3}}>Leitura automática · Android Chrome e PC</div>
              </div>
            </div>
            <div style={{background:"#0d0f14",borderRadius:10,padding:"10px 12px",fontSize:11,color:"#6b7280"}}>
              💡 <strong style={{color:"#9ca3af"}}>iPhone:</strong> use sempre "Tirar Foto"
            </div>
          </div>
        )}
        {tela==="foto" && (
          <div style={{padding:24,display:"flex",flexDirection:"column",alignItems:"center",gap:14,minHeight:180}}>
            {lendo && <><div style={{fontSize:38,animation:"sp 1s linear infinite",display:"inline-block"}}>⟳</div><div style={{fontSize:14,fontWeight:700}}>Identificando código...</div></>}
            {!lendo && msg && !isPreview && (
              <><div style={{fontSize:34}}>⚠️</div>
                <div style={{color:"#EF4444",fontSize:13,textAlign:"center",lineHeight:1.6,whiteSpace:"pre-line"}}>{msg}</div>
                <label><input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{setMsg("");setLendo(true);onFileChange(e);}}/>
                  <div style={{background:"#F97316",color:"#fff",padding:"10px 22px",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer"}}>📷 Tentar Novamente</div></label>
                <button onClick={voltar} style={{background:"transparent",border:"1px solid #2a2d35",color:"#9ca3af",padding:"7px 18px",borderRadius:8,fontSize:12,fontWeight:700}}>← Voltar</button>
              </>
            )}
            {!lendo && isPreview && (
              <><div style={{fontSize:11,color:"#9ca3af",textAlign:"center"}}>Digite o código que aparece na imagem:</div>
                <img src={canvasRef.current.toDataURL()} style={{width:"100%",borderRadius:8,border:"1px solid #2a2d35"}} alt="preview"/>
                <input value={manual} onChange={e=>setMan(e.target.value)} onKeyDown={e=>e.key==="Enter"&&manual.trim()&&onCode(manual.trim())} placeholder="Digite o código da OP" autoFocus style={{background:"#1a1d24",border:"1px solid #2a2d35",borderRadius:8,color:"#F97316",padding:"10px 14px",fontSize:15,fontFamily:"monospace",letterSpacing:2,width:"100%"}}/>
                <button onClick={()=>manual.trim()&&onCode(manual.trim())} style={{background:"#F97316",color:"#fff",border:"none",borderRadius:8,padding:11,fontSize:14,fontWeight:800,width:"100%"}}>✅ Confirmar</button>
                <label style={{cursor:"pointer"}}><input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{setMsg("");setLendo(true);setMan("");onFileChange(e);}}/>
                  <span style={{fontSize:11,color:"#6b7280",textDecoration:"underline"}}>📷 Tirar outra foto</span></label>
              </>
            )}
          </div>
        )}
        {tela==="video" && (
          <>
            <div style={{position:"relative",background:"#000",width:"100%",aspectRatio:"4/3",overflow:"hidden"}}>
              <video ref={videoRef} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} playsInline muted autoPlay/>
              {status==="ok" && (
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                  <div style={{position:"relative",width:"78%",maxWidth:290,aspectRatio:"3/1"}}>
                    {[[{top:0,left:0},{borderTop:"3px solid #F97316",borderLeft:"3px solid #F97316"}],[{top:0,right:0},{borderTop:"3px solid #F97316",borderRight:"3px solid #F97316"}],[{bottom:0,left:0},{borderBottom:"3px solid #F97316",borderLeft:"3px solid #F97316"}],[{bottom:0,right:0},{borderBottom:"3px solid #F97316",borderRight:"3px solid #F97316"}]].map(([p,b],i)=><div key={i} style={{position:"absolute",width:26,height:26,...p,...b}}/>)}
                    <div style={{position:"absolute",left:"5%",right:"5%",top:"50%",height:2,background:"linear-gradient(90deg,transparent,#F97316,transparent)",animation:"sc 1.8s ease-in-out infinite"}}/>
                  </div>
                </div>
              )}
              {status==="loading" && <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.8)",gap:12}}><div style={{fontSize:34,animation:"sp 1s linear infinite",display:"inline-block"}}>⟳</div><div style={{fontSize:13}}>Iniciando câmera...</div></div>}
              {status==="erro" && <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.9)",padding:20,gap:10}}><div style={{fontSize:32}}>⚠️</div><div style={{color:"#EF4444",fontSize:12,textAlign:"center",lineHeight:1.6,whiteSpace:"pre-line"}}>{msg}</div></div>}
            </div>
            <div style={{padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0d0f14",borderTop:"1px solid #1e2128"}}>
              <div style={{fontSize:11,color:status==="ok"?"#10B981":status==="erro"?"#EF4444":"#F97316",display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:"currentColor",display:"inline-block"}}/>
                {status==="ok"?"Câmera ativa":status==="loading"?"Iniciando...":"Erro"}
              </div>
              <button onClick={voltar} style={{background:"#1a1d24",border:"1px solid #2a2d35",color:"#9ca3af",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700}}>← Voltar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ ops, onNav, carregando }) {
  const em = ops.filter(o => o.status==="EM_ANDAMENTO");
  const en = ops.filter(o => o.status==="ENCERRADA");
  const pp = {}; em.forEach(o => { pp[o.processo_atual]=(pp[o.processo_atual]||0)+1; });
  return (
    <div>
      <div style={T.topbar}>
        <div><div style={T.title}>Dashboard</div><div style={T.sub}>Visão geral das Ordens de Produção</div></div>
        <button style={T.btnOrange} onClick={()=>onNav("reg")}>➕ Registrar OP</button>
      </div>
      <div style={T.page}>
        {carregando && <div style={{textAlign:"center",color:"#6b7280",padding:32,fontSize:13}}>⟳ Carregando dados...</div>}
        {!carregando && <>
          <div style={T.grid3}>
            {[{l:"Total",v:ops.length,c:"#3B82F6"},{l:"Em Andamento",v:em.length,c:"#F97316"},{l:"Encerradas",v:en.length,c:"#10B981"}]
              .map(s=><div key={s.l} style={T.card}><div style={T.lbl}>{s.l}</div><div style={{fontSize:28,fontWeight:800,fontFamily:"monospace",color:s.c,marginTop:4}}>{s.v}</div></div>)}
          </div>
          <div style={T.lbl}>Por Processo (em andamento)</div>
          <div style={{...T.grid7,marginBottom:20}}>
            {PROCESSOS.map(p=>(
              <div key={p.id} style={{...T.card,textAlign:"center",padding:"12px 4px",borderColor:p.cor+"33"}}>
                <div style={{fontSize:20,marginBottom:3}}>{p.icone}</div>
                <div style={{fontSize:9,fontWeight:700,color:"#6b7280",lineHeight:1.3,marginBottom:3}}>{p.nome}</div>
                <div style={{fontSize:22,fontWeight:800,fontFamily:"monospace",color:p.cor}}>{pp[p.id]||0}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={T.lbl}>Últimas OPs</div>
            <button style={T.btnGhost} onClick={()=>onNav("list")}>Ver todas →</button>
          </div>
          <div style={T.tableWrap}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Código","Processo","Status",""].map(h=><th key={h} style={T.th}>{h}</th>)}</tr></thead>
              <tbody>
                {ops.slice(0,10).map(op=>(
                  <tr key={op.id}>
                    <td style={T.td}><span style={T.code}>{op.codigo}</span></td>
                    <td style={T.td}><ProcTag id={op.processo_atual}/></td>
                    <td style={T.td}><StatusTag s={op.status}/></td>
                    <td style={T.td}><button style={T.btnGhost} onClick={()=>onNav("det",op.codigo)}>Ver →</button></td>
                  </tr>
                ))}
                {!ops.length&&<tr><td colSpan={4} style={{color:"#6b7280",textAlign:"center",padding:28,fontSize:13}}>Nenhuma OP registrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </>}
      </div>
    </div>
  );
}

// ─── REGISTRO ─────────────────────────────────────────────────────────────────
function Registro({ recarregar }) {
  const [proc,  setProc]  = useState("");
  const [cod,   setCod]   = useState("");
  const [oper,  setOper]  = useState("");
  const [obs,   setObs]   = useState("");
  const [res,   setRes]   = useState(null);
  const [cam,   setCam]   = useState(false);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const codRef  = useRef(null);
  const operRef = useRef(null);

  function validar() {
    const e = {};
    if (!proc)        e.proc = "Selecione o processo";
    if (!oper.trim()) e.oper = "Campo obrigatório";
    if (!cod.trim())  e.cod  = "Informe o código";
    setErros(e); return !Object.keys(e).length;
  }

  function onCamCode(c) { setCam(false); setCod(c); setErros(p=>({...p,cod:undefined})); }

  async function registrar() {
    if (!validar()) return;
    setSalvando(true); setRes(null);
    const c = cod.trim();
    const novoSt = proc==="LOGISTICA" ? "ENCERRADA" : "EM_ANDAMENTO";
    try {
      // Upsert OP
      const ops_existentes = await sb(`ops?codigo=eq.${encodeURIComponent(c)}&select=id`, { method:"GET" });
      let op_id;
      if (ops_existentes.length > 0) {
        op_id = ops_existentes[0].id;
        await sb(`ops?id=eq.${op_id}`, {
          method: "PATCH",
          body: JSON.stringify({ processo_atual: proc, status: novoSt }),
          prefer: "return=minimal",
        });
      } else {
        const [nova] = await sb("ops", {
          method: "POST",
          body: JSON.stringify({ codigo: c, processo_atual: proc, status: novoSt }),
        });
        op_id = nova.id;
      }
      // Inserir movimentação
      await sb("movimentacoes", {
        method: "POST",
        body: JSON.stringify({ op_codigo: c, processo: proc, operador: oper.trim(), observacao: obs }),
      });
      // Buscar histórico
      const hist = await sb(`movimentacoes?op_codigo=eq.${encodeURIComponent(c)}&order=criado_em.asc`);
      setRes({ ok:true, codigo:c, status:novoSt, hist,
        msg:`✅ OP ${c} registrada em ${PM[proc]?.nome}${novoSt==="ENCERRADA"?" — ENCERRADA!":""}` });
      setCod(""); setObs(""); setErros({});
      recarregar();
    } catch(e) {
      setRes({ ok:false, msg:"❌ Erro ao salvar: " + e.message });
    }
    setSalvando(false);
  }

  return (
    <div>
      {cam && <Cam onCode={onCamCode} onClose={()=>setCam(false)}/>}
      <div style={T.topbar}>
        <div><div style={T.title}>📋 Registrar OP</div><div style={T.sub}>Câmera, leitor USB ou digitação</div></div>
      </div>
      <div style={{...T.page,maxWidth:660}}>
        {/* PROCESSO */}
        <div style={{...T.card,marginBottom:12}}>
          <div style={{...T.lbl,marginBottom:10}}>1. Processo {erros.proc&&<span style={{color:"#ef4444",fontStyle:"normal",textTransform:"none",letterSpacing:0,marginLeft:6}}>— {erros.proc}</span>}</div>
          <div style={T.grid7}>
            {PROCESSOS.map(p=>(
              <div key={p.id} onClick={()=>{setProc(p.id);setErros(e=>({...e,proc:undefined}));operRef.current?.focus();}}
                style={{background:proc===p.id?p.cor+"22":"#1a1d24",border:`2px solid ${proc===p.id?p.cor:erros.proc?"#ef444450":"#252830"}`,borderRadius:10,padding:"11px 4px",textAlign:"center",cursor:"pointer",transition:".15s"}}>
                <div style={{fontSize:20,marginBottom:3}}>{p.icone}</div>
                <div style={{fontSize:9,fontWeight:700,color:proc===p.id?p.cor:"#6b7280",lineHeight:1.3}}>{p.nome}</div>
              </div>
            ))}
          </div>
        </div>
        {/* OPERADOR */}
        <div style={{...T.card,marginBottom:12}}>
          <label style={T.lbl}>2. Operador Responsável <span style={{color:"#ef4444"}}>*</span></label>
          <input ref={operRef} value={oper} onChange={e=>{setOper(e.target.value);setErros(p=>({...p,oper:undefined}));}}
            onKeyDown={e=>e.key==="Enter"&&codRef.current?.focus()}
            placeholder="Seu nome ou matrícula"
            style={{...T.inp,borderColor:erros.oper?"#ef4444":"#252830",fontSize:15}}/>
          {erros.oper&&<div style={{color:"#ef4444",fontSize:11,marginTop:4}}>⚠️ {erros.oper}</div>}
        </div>
        {/* CÓDIGO */}
        <div style={{...T.card,marginBottom:12}}>
          <div style={T.lbl}>3. Código da OP <span style={{color:"#ef4444"}}>*</span></div>
          <button onClick={()=>setCam(true)} style={{width:"100%",padding:"14px",marginBottom:12,background:"#0d0f14",border:`2px dashed ${erros.cod?"#ef4444":"#F97316"}`,borderRadius:12,color:"#F97316",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
            <span style={{fontSize:28}}>📷</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:14,fontWeight:800}}>Abrir Câmera</div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>iPhone ✅ · Android ✅ · PC ✅</div>
            </div>
          </button>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{flex:1,height:1,background:"#252830"}}/>
            <span style={{fontSize:10,color:"#4b5563",fontWeight:700,whiteSpace:"nowrap"}}>OU LEITOR USB / DIGITAÇÃO</span>
            <div style={{flex:1,height:1,background:"#252830"}}/>
          </div>
          <input ref={codRef} value={cod} onChange={e=>{setCod(e.target.value);setRes(null);setErros(p=>({...p,cod:undefined}));}}
            onKeyDown={e=>e.key==="Enter"&&registrar()}
            placeholder="Aponte o leitor USB aqui ou digite"
            autoComplete="off"
            style={{...T.inp,fontFamily:"monospace",fontSize:15,letterSpacing:2,color:"#F97316",borderColor:erros.cod?"#ef4444":"#252830",marginBottom:6}}/>
          {erros.cod&&<div style={{color:"#ef4444",fontSize:11,marginBottom:6}}>⚠️ {erros.cod}</div>}
          <div style={{fontSize:11,color:"#4b5563",marginBottom:10}}>🔌 <strong>Leitor USB:</strong> conecte, clique neste campo e aponte para o código.</div>
          <label style={T.lbl}>Observação (opcional)</label>
          <input value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ex: Retrabalho, peça danificada..." style={T.inp}/>
        </div>
        <button style={{...T.btnOrange,width:"100%",justifyContent:"center",padding:15,fontSize:15,opacity:salvando?.7:1}} onClick={registrar} disabled={salvando}>
          {salvando ? "⟳ Salvando..." : "✅ Confirmar Registro"}
        </button>
        {res && (
          <div style={{marginTop:14}}>
            <div style={{padding:"12px 16px",borderRadius:10,marginBottom:10,fontSize:13,background:res.ok?"#10B98122":"#EF444422",border:`1px solid ${res.ok?"#10B98144":"#EF444444"}`,color:res.ok?"#10B981":"#EF4444"}}>{res.msg}</div>
            {res.ok && res.hist?.length > 0 && (
              <div style={T.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={T.code}>{res.codigo}</span><StatusTag s={res.status}/>
                </div>
                <div style={T.lbl}>Histórico desta OP</div>
                {res.hist.map((m,i)=>{
                  const p=PM[m.processo]||{icone:"📌",nome:m.processo,cor:"#888"};
                  return <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:i<res.hist.length-1?"1px solid #1e2128":"none"}}>
                    <span style={{fontSize:18}}>{p.icone}</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:12,color:p.cor}}>{p.nome}</div>
                      <div style={{fontSize:11,color:"#6b7280"}}>{fmtDate(m.criado_em)} — 👤 {m.operador}</div>
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

// ─── LISTA ────────────────────────────────────────────────────────────────────
function Lista({ ops, onNav, carregando }) {
  const [q,setQ]=useState(""); const [fS,setFS]=useState(""); const [fP,setFP]=useState("");
  const f = ops.filter(o=>{
    if(fS&&o.status!==fS)return false;
    if(fP&&o.processo_atual!==fP)return false;
    if(q&&!o.codigo.toLowerCase().includes(q.toLowerCase()))return false;
    return true;
  });
  return (
    <div>
      <div style={T.topbar}>
        <div><div style={T.title}>📋 Ordens de Produção</div><div style={T.sub}>{f.length} resultado(s)</div></div>
        <button style={T.btnOrange} onClick={()=>onNav("reg")}>➕ Registrar</button>
      </div>
      <div style={T.page}>
        <div style={{...T.card,marginBottom:12}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:130}}><div style={T.lbl}>Buscar</div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Código..." style={T.inp}/></div>
            <div style={{minWidth:110}}><div style={T.lbl}>Status</div>
              <select value={fS} onChange={e=>setFS(e.target.value)} style={T.inp}>
                <option value="">Todos</option><option value="EM_ANDAMENTO">Em Andamento</option><option value="ENCERRADA">Encerrada</option>
              </select>
            </div>
            <div style={{minWidth:110}}><div style={T.lbl}>Processo</div>
              <select value={fP} onChange={e=>setFP(e.target.value)} style={T.inp}>
                <option value="">Todos</option>{PROCESSOS.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <button onClick={()=>{setQ("");setFS("");setFP("");}} style={{...T.btnGhost,alignSelf:"flex-end"}}>✕</button>
          </div>
        </div>
        {carregando && <div style={{textAlign:"center",color:"#6b7280",padding:32,fontSize:13}}>⟳ Carregando...</div>}
        {!carregando && <div style={T.tableWrap}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Código","Processo","Status","Data",""].map(h=><th key={h} style={T.th}>{h}</th>)}</tr></thead>
            <tbody>
              {f.map(op=>(
                <tr key={op.id}>
                  <td style={T.td}><span style={T.code}>{op.codigo}</span></td>
                  <td style={T.td}><ProcTag id={op.processo_atual}/></td>
                  <td style={T.td}><StatusTag s={op.status}/></td>
                  <td style={{...T.td,fontSize:11,color:"#6b7280"}}>{fmtDate(op.criado_em)}</td>
                  <td style={T.td}><button style={T.btnGhost} onClick={()=>onNav("det",op.codigo)}>Ver →</button></td>
                </tr>
              ))}
              {!f.length&&<tr><td colSpan={5} style={{color:"#6b7280",textAlign:"center",padding:28,fontSize:13}}>Nenhuma OP encontrada.</td></tr>}
            </tbody>
          </table>
        </div>}
      </div>
    </div>
  );
}

// ─── DETALHE ──────────────────────────────────────────────────────────────────
function Detalhe({ cod, ops, onNav }) {
  const [hist, setHist] = useState([]);
  const [loading, setLoading] = useState(true);
  const op = ops.find(o=>o.codigo===cod);

  useEffect(() => {
    if (!cod) return;
    sb(`movimentacoes?op_codigo=eq.${encodeURIComponent(cod)}&order=criado_em.asc`)
      .then(setHist).catch(()=>setHist([])).finally(()=>setLoading(false));
  }, [cod]);

  if (!op) return <div style={{padding:24,color:"#6b7280",fontSize:13}}>OP não encontrada. <button style={T.btnGhost} onClick={()=>onNav("list")}>← Voltar</button></div>;
  const pass = hist.map(m=>m.processo);

  return (
    <div>
      <div style={T.topbar}>
        <div><div style={T.title}>OP {op.codigo}</div><div style={T.sub}>{fmtDate(op.criado_em)}</div></div>
        <div style={{display:"flex",gap:8}}>
          <button style={T.btnOrange} onClick={()=>onNav("reg")}>📷 Registrar</button>
          <button style={T.btnGhost} onClick={()=>onNav("list")}>← Voltar</button>
        </div>
      </div>
      <div style={T.page}>
        <div style={T.grid3}>
          <div style={T.card}><div style={T.lbl}>Status</div><div style={{marginTop:6}}><StatusTag s={op.status}/></div></div>
          <div style={T.card}><div style={T.lbl}>Processo Atual</div><div style={{marginTop:6}}><ProcTag id={op.processo_atual}/></div></div>
          <div style={T.card}><div style={T.lbl}>Etapas</div><div style={{fontSize:28,fontWeight:800,fontFamily:"monospace",color:"#3B82F6",marginTop:4}}>{hist.length}</div></div>
        </div>
        <div style={{...T.card,marginBottom:12}}>
          <div style={T.lbl}>Jornada</div>
          <div style={{display:"flex",alignItems:"center",overflowX:"auto",paddingBottom:8}}>
            {PROCESSOS.map((p,i)=>{
              const cur=p.id===op.processo_atual, done=pass.includes(p.id)&&!cur;
              return <div key={p.id} style={{display:"flex",alignItems:"center"}}>
                {i>0&&<div style={{color:"#252830",fontSize:14,margin:"0 -2px"}}>›</div>}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,minWidth:68,padding:"9px 4px",borderRadius:8,opacity:done?.4:1,background:cur?p.cor+"18":"transparent",border:cur?`1px solid ${p.cor}`:"1px solid transparent"}}>
                  <div style={{fontSize:16}}>{p.icone}</div>
                  <div style={{fontSize:8,fontWeight:700,color:cur?p.cor:"#6b7280",textAlign:"center",lineHeight:1.3}}>{p.nome}</div>
                  {pass.includes(p.id)&&<div style={{fontSize:8,color:"#10B981",fontWeight:800}}>✓</div>}
                </div>
              </div>;
            })}
          </div>
        </div>
        <div style={T.card}>
          <div style={T.lbl}>Histórico Completo</div>
          {loading && <div style={{color:"#6b7280",textAlign:"center",padding:20,fontSize:13}}>⟳ Carregando...</div>}
          {!loading && !hist.length && <div style={{color:"#6b7280",textAlign:"center",padding:20,fontSize:13}}>Sem movimentações.</div>}
          {!loading && hist.length > 0 && (
            <div style={{position:"relative",paddingLeft:24}}>
              <div style={{position:"absolute",left:7,top:0,bottom:0,width:2,background:"#252830"}}/>
              {hist.map((m,i)=>{
                const p=PM[m.processo]||{icone:"📌",nome:m.processo,cor:"#888"};
                return <div key={i} style={{position:"relative",marginBottom:16}}>
                  <div style={{position:"absolute",left:-20,top:2,width:12,height:12,borderRadius:"50%",background:p.cor,border:"2px solid #0a0c10"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:12,color:p.cor}}>{p.icone} {p.nome}</div>
                      <div style={{fontSize:11,color:"#9ca3af"}}>👤 {m.operador}</div>
                      {m.observacao&&<div style={{fontSize:11,color:"#F59E0B",marginTop:2}}>📝 {m.observacao}</div>}
                    </div>
                    <div style={{fontSize:10,color:"#6b7280",whiteSpace:"nowrap",flexShrink:0}}>{fmtDate(m.criado_em)}</div>
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

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [ops,       setOps]       = useState([]);
  const [tela,      setTela]      = useState("dash");
  const [param,     setParam]     = useState("");
  const [loading,   setLoading]   = useState(true);
  const [dbErro,    setDbErro]    = useState(false);

  async function carregarOps() {
    try {
      const data = await sb("ops?order=criado_em.desc&limit=200");
      setOps(data); setDbErro(false);
    } catch(e) {
      console.error(e); setDbErro(true);
    }
    setLoading(false);
  }

  useEffect(() => { carregarOps(); }, []);

  function go(t, p="") { setTela(t); setParam(p); window.scrollTo(0,0); }
  const NAV = [{id:"dash",label:"Dashboard",icon:"📊"},{id:"reg",label:"Registrar",icon:"📷"},{id:"list",label:"OPs",icon:"📋"}];

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"#0a0c10",color:"#e8eaf0",fontFamily:"system-ui,sans-serif"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
        button,input,select{font-family:inherit;outline:none}button{cursor:pointer}
        .sidebar{display:flex}.botnav{display:none}
        @media(max-width:600px){
          .sidebar{display:none!important}.botnav{display:flex!important}
          .pg{padding:14px!important}.tb{padding:12px 14px!important}
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className="sidebar" style={{width:200,background:"#111318",borderRight:"1px solid #1e2128",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:"18px 16px",borderBottom:"1px solid #1e2128",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>🏭</span>
          <div><div style={{fontSize:14,fontWeight:800}}>OP Tracker</div><div style={{fontSize:9,color:"#6b7280",letterSpacing:1,textTransform:"uppercase"}}>Rastreabilidade</div></div>
        </div>
        <nav style={{padding:"12px 8px",flex:1}}>
          {NAV.map(n=>(
            <div key={n.id} onClick={()=>go(n.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 11px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:2,background:tela===n.id?"#F97316":"transparent",color:tela===n.id?"#fff":"#6b7280"}}>
              <span>{n.icon}</span>{n.label}
            </div>
          ))}
        </nav>
        <div style={{padding:12,borderTop:"1px solid #1e2128",fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",gap:5}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:dbErro?"#EF4444":"#10B981",display:"inline-block"}}/>
          {dbErro ? "Sem conexão" : `${ops.length} OPs salvas`}
        </div>
      </aside>

      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"}}>
        {dbErro && (
          <div style={{background:"#EF444422",border:"1px solid #EF444444",color:"#EF4444",padding:"10px 16px",fontSize:12,textAlign:"center"}}>
            ⚠️ Sem conexão com o banco de dados. Verifique a URL e a chave do Supabase no arquivo App.jsx.
          </div>
        )}
        <main style={{flex:1,overflowY:"auto",paddingBottom:68}}>
          {tela==="dash" && <Dashboard ops={ops} onNav={go} carregando={loading}/>}
          {tela==="reg"  && <Registro recarregar={carregarOps}/>}
          {tela==="list" && <Lista ops={ops} onNav={go} carregando={loading}/>}
          {tela==="det"  && <Detalhe cod={param} ops={ops} onNav={go}/>}
        </main>

        {/* BOTTOM NAV MOBILE */}
        <nav className="botnav" style={{position:"fixed",bottom:0,left:0,right:0,background:"#111318",borderTop:"1px solid #1e2128",display:"none",justifyContent:"space-around",padding:"6px 0 10px",zIndex:200}}>
          {NAV.map(n=>(
            <div key={n.id} onClick={()=>go(n.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"5px 16px",borderRadius:8,cursor:"pointer",background:tela===n.id?"#F9731618":"transparent"}}>
              <span style={{fontSize:22}}>{n.icon}</span>
              <span style={{fontSize:10,fontWeight:700,color:tela===n.id?"#F97316":"#6b7280"}}>{n.label}</span>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

const T = {
  topbar:    {padding:"14px 20px",borderBottom:"1px solid #1e2128",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#111318",position:"sticky",top:0,zIndex:10},
  title:     {fontSize:17,fontWeight:800},
  sub:       {fontSize:11,color:"#6b7280",marginTop:2},
  page:      {padding:18},
  grid3:     {display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:16},
  grid7:     {display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:12},
  card:      {background:"#111318",border:"1px solid #1e2128",borderRadius:12,padding:14},
  lbl:       {fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",color:"#6b7280",marginBottom:8,display:"block"},
  tableWrap: {background:"#111318",border:"1px solid #1e2128",borderRadius:12,overflow:"hidden",overflowX:"auto"},
  th:        {padding:"9px 12px",textAlign:"left",fontSize:9,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",color:"#6b7280",borderBottom:"1px solid #1e2128",background:"#1a1d24",whiteSpace:"nowrap"},
  td:        {padding:"9px 12px",fontSize:12,borderBottom:"1px solid #1e2128",whiteSpace:"nowrap"},
  code:      {fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#F97316",letterSpacing:1,background:"#1a1d24",padding:"2px 8px",borderRadius:5,border:"1px solid #1e2128"},
  inp:       {background:"#1a1d24",border:"1px solid #252830",borderRadius:8,color:"#e8eaf0",padding:"9px 12px",fontSize:13,width:"100%",display:"block"},
  btnOrange: {background:"#F97316",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:700,display:"inline-flex",alignItems:"center",gap:6},
  btnGhost:  {background:"transparent",color:"#6b7280",border:"1px solid #1e2128",borderRadius:8,padding:"7px 13px",fontSize:12,fontWeight:700},
};

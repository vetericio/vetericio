import { Link } from "@tanstack/react-router";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, BringToFront, Copy, Eye, EyeOff,
  ImagePlus, Layers3, Monitor, Move, Plus, Redo2, RotateCcw, Save, SendToBack,
  Smartphone, Trash2, Type, Undo2, UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  applyVisualLayout, cloneVisual, editableTarget, EMPTY_DOCUMENT, ensurePage, validImageSource,
  visualLabel, visualSelector, type VisualAdded, type VisualDevice, type VisualDocument,
  type VisualLayout, type VisualPatch, type VisualStyle, VISUAL_DRAFT_KEY, VISUAL_NODE_ATTR,
  VISUAL_PUBLISHED_KEY, VISUAL_VERSIONS_KEY,
} from "@/lib/visual-editor";

const PAGES = [
  ["/", "Página inicial"], ["/login", "Login"], ["/planos", "Planos"], ["/contratar", "Contratação"],
  ["/inicio", "Bem-vindo / áreas"], ["/internacao", "Internação"], ["/consultorio", "Consultório"],
  ["/recepcao", "Recepção"], ["/financeiro", "Financeiro"], ["/estoque", "Serviços e estoque"],
  ["/anamnese", "Anamnese"], ["/animais", "Animais"], ["/animal", "Ficha do animal"],
  ["/novo-animal", "Cadastro do animal"], ["/tutores", "Tutores"], ["/consulta", "Consulta"],
  ["/registro-clinico", "Registro clínico"], ["/fila-espera", "Fila de espera"], ["/medicacoes", "Medicações"],
  ["/curva", "Curva"], ["/alarmes", "Alarmes"], ["/pendencias", "Pendências"], ["/plantoes", "Histórico de plantões"],
  ["/registros", "Registros"], ["/termos", "Termos e documentos"], ["/assinar", "Assinar documento"],
  ["/receituario", "Receituário"], ["/encaminhar", "Encaminhamento"], ["/perfil-clinica", "Perfil da clínica"],
  ["/sincronizacao", "Sincronização"], ["/temas", "Temas"], ["/admin", "Admin da plataforma"],
  ["/admin-conteudo", "Admin · Conteúdo"], ["/admin-planos", "Admin · Planos"], ["/admin-solicitacoes", "Admin · Solicitações"],
] as const;

type Version = { id: string; publishedAt: string; pages: VisualDocument["pages"] };
type SelectedItem = { id: string; kind: "patch" | "added" };

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const deviceWidth = (device: VisualDevice) => device === "desktop" ? 1440 : 390;

function number(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function VisualPageEditor() {
  const [device, setDevice] = useState<VisualDevice>("desktop");
  const [route, setRoute] = useState("/");
  const [zoom, setZoom] = useState(70);
  const [documento, setDocumento] = useState<VisualDocument>(EMPTY_DOCUMENT());
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [undo, setUndo] = useState<VisualDocument[]>([]);
  const [redo, setRedo] = useState<VisualDocument[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const selectedRef = useRef<SelectedItem[]>([]);
  const documentRef = useRef(documento);
  selectedRef.current = selected;
  documentRef.current = documento;

  const layout = useMemo(() => ensurePage(cloneVisual(documento), route)[device], [documento, route, device]);
  const first = useMemo(() => {
    const item = selected[0];
    if (!item) return null;
    return item.kind === "patch" ? layout.patches.find((x) => x.id === item.id) || null : layout.added.find((x) => x.id === item.id) || null;
  }, [selected, layout]);

  useEffect(() => { void (async () => {
    setLoading(true);
    const [draft, published, history] = await Promise.all([
      (supabase as any).from("oricse_config").select("valor").eq("chave", VISUAL_DRAFT_KEY).maybeSingle(),
      (supabase as any).from("oricse_config").select("valor").eq("chave", VISUAL_PUBLISHED_KEY).maybeSingle(),
      (supabase as any).from("oricse_config").select("valor").eq("chave", VISUAL_VERSIONS_KEY).maybeSingle(),
    ]);
    setDocumento(draft.data?.valor || published.data?.valor || EMPTY_DOCUMENT());
    setVersions(Array.isArray(history.data?.valor) ? history.data.valor : []);
    setLoading(false);
  })(); }, []);

  const checkpoint = useCallback(() => {
    setUndo((items) => [...items.slice(-39), cloneVisual(documentRef.current)]);
    setRedo([]);
  }, []);

  const updateLayout = useCallback((mutate: (layout: VisualLayout) => void, remember = true) => {
    if (remember) checkpoint();
    setDocumento((current) => {
      const next = cloneVisual(current);
      mutate(ensurePage(next, route)[device]);
      next.updatedAt = new Date().toISOString();
      return next;
    });
  }, [checkpoint, route, device]);

  function undoNow() {
    const previous = undo.at(-1); if (!previous) return;
    setRedo((items) => [...items, cloneVisual(documento)]); setDocumento(previous); setUndo((items) => items.slice(0, -1)); setSelected([]);
  }
  function redoNow() {
    const next = redo.at(-1); if (!next) return;
    setUndo((items) => [...items, cloneVisual(documento)]); setDocumento(next); setRedo((items) => items.slice(0, -1)); setSelected([]);
  }

  const selectedElements = useCallback(() => {
    const doc = iframeRef.current?.contentDocument; if (!doc) return [] as HTMLElement[];
    return selectedRef.current.map((item) => {
      if (item.kind === "added") return doc.querySelector(`[${VISUAL_NODE_ATTR}="${item.id}"]`) as HTMLElement | null;
      const patch = ensurePage(cloneVisual(documentRef.current), route)[device].patches.find((x) => x.id === item.id);
      try { return patch ? doc.querySelector(patch.selector) as HTMLElement | null : null; } catch { return null; }
    }).filter(Boolean) as HTMLElement[];
  }, [route, device]);

  const drawSelection = useCallback(() => {
    const doc = iframeRef.current?.contentDocument; if (!doc) return;
    doc.querySelectorAll("[data-oricse-editor-overlay]").forEach((x) => x.remove());
    const elements = selectedElements();
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const overlay = doc.createElement("div");
      overlay.dataset["oricseEditorOverlay"] = "1";
      Object.assign(overlay.style, { position:"fixed", left:`${rect.left}px`, top:`${rect.top}px`, width:`${rect.width}px`, height:`${rect.height}px`, border:"2px solid #6F293B", boxSizing:"border-box", pointerEvents:"none", zIndex:"2147483646" });
      doc.body.appendChild(overlay);
    }
    if (elements.length) {
      const rect = elements[0].getBoundingClientRect();
      const handle = doc.createElement("button");
      handle.type = "button";
      handle.setAttribute("aria-label", "Redimensionar seleção");
      handle.dataset["oricseEditorOverlay"] = "1";
      Object.assign(handle.style, { position:"fixed", left:`${rect.right - 8}px`, top:`${rect.bottom - 8}px`, width:"18px", height:"18px", borderRadius:"50%", border:"2px solid white", background:"#6F293B", cursor:"nwse-resize", pointerEvents:"auto", zIndex:"2147483647" });
      const begin = (event: PointerEvent) => {
        event.preventDefault(); event.stopPropagation(); checkpoint();
        const sx=event.clientX, sy=event.clientY;
        const starts = selectedRef.current.map((item) => {
          const target = elements[selectedRef.current.indexOf(item)];
          const box = target?.getBoundingClientRect();
          return { item, width:box?.width || 100, height:box?.height || 40 };
        });
        const move = (ev: PointerEvent) => {
          const dx=(ev.clientX-sx)/Math.max(zoom/100,.1), dy=(ev.clientY-sy)/Math.max(zoom/100,.1);
          updateLayout((value) => starts.forEach(({item,width,height}) => {
            const target=item.kind==="patch"?value.patches.find(x=>x.id===item.id):value.added.find(x=>x.id===item.id);
            if(target){target.style.width=Math.max(10,Math.round(width+dx));target.style.height=Math.max(10,Math.round(height+dy));}
          }), false);
        };
        const stop=()=>{doc.defaultView?.removeEventListener("pointermove",move);doc.defaultView?.removeEventListener("pointerup",stop);};
        doc.defaultView?.addEventListener("pointermove",move); doc.defaultView?.addEventListener("pointerup",stop);
      };
      handle.addEventListener("pointerdown", begin);
      doc.body.appendChild(handle);
    }
  }, [checkpoint, selectedElements, updateLayout, zoom]);

  const applyToFrame = useCallback(() => {
    const doc = iframeRef.current?.contentDocument; if (!doc) return;
    applyVisualLayout(doc, layout);
    doc.documentElement.style.setProperty("--oricse-editor-cursor", "move");
    doc.querySelectorAll("a,button,input,textarea,select").forEach((element) => {
      (element as HTMLElement).style.pointerEvents = "auto";
    });
    drawSelection();
  }, [layout, drawSelection]);

  useEffect(() => { const id = requestAnimationFrame(applyToFrame); return () => cancelAnimationFrame(id); }, [applyToFrame]);

  const bindFrame = useCallback(() => {
    const doc = iframeRef.current?.contentDocument; const win = iframeRef.current?.contentWindow;
    if (!doc || !win) return;
    applyToFrame();
    let drag: null | { sx:number; sy:number; starts: Array<{item:SelectedItem;x:number;y:number}> } = null;
    const pointerDown = (event: PointerEvent) => {
      const raw = event.target as Element | null;
      if (!raw || raw.closest("[data-oricse-editor-overlay]")) return;
      event.preventDefault(); event.stopPropagation();
      const element = editableTarget(raw);
      const addedId = element.closest(`[${VISUAL_NODE_ATTR}]`)?.getAttribute(VISUAL_NODE_ATTR);
      let item: SelectedItem;
      if (addedId) item = { id:addedId, kind:"added" };
      else {
        const selector = visualSelector(element);
        let patch = ensurePage(cloneVisual(documentRef.current), route)[device].patches.find((x) => x.selector === selector);
        if (!patch) {
          patch = { id:uid("element"), selector, label:visualLabel(element), style:{} };
          updateLayout((value) => value.patches.push(patch!), true);
        }
        item = { id:patch.id, kind:"patch" };
      }
      const multi = event.shiftKey || event.ctrlKey || event.metaKey;
      const already = selectedRef.current.some((x) => x.id === item.id && x.kind === item.kind);
      const next = multi ? (already ? selectedRef.current.filter((x) => x.id !== item.id || x.kind !== item.kind) : [...selectedRef.current,item]) : [item];
      setSelected(next); selectedRef.current=next;
      checkpoint();
      const page = ensurePage(cloneVisual(documentRef.current), route)[device];
      const starts = next.map((entry) => {
        const target=entry.kind==="patch"?page.patches.find(x=>x.id===entry.id):page.added.find(x=>x.id===entry.id);
        return {item:entry,x:target?.style.x||0,y:target?.style.y||0};
      });
      drag={sx:event.clientX,sy:event.clientY,starts};
    };
    const move = (event: PointerEvent) => {
      if(!drag) return;
      const dx=(event.clientX-drag.sx)/Math.max(zoom/100,.1),dy=(event.clientY-drag.sy)/Math.max(zoom/100,.1);
      updateLayout((value)=>drag!.starts.forEach(({item,x,y})=>{
        const target=item.kind==="patch"?value.patches.find(p=>p.id===item.id):value.added.find(p=>p.id===item.id);
        if(target){target.style.x=Math.round(x+dx);target.style.y=Math.round(y+dy);}
      }),false);
    };
    const stop=()=>{drag=null;};
    const block = (event: Event) => { if ((event.target as Element)?.closest("a,button,form")) { event.preventDefault(); event.stopPropagation(); } };
    doc.addEventListener("pointerdown",pointerDown,true); win.addEventListener("pointermove",move,true); win.addEventListener("pointerup",stop,true); doc.addEventListener("click",block,true); doc.addEventListener("submit",block,true);
  }, [applyToFrame, checkpoint, device, route, updateLayout, zoom]);

  function patchSelected(style: Partial<VisualStyle>, text?: string) {
    if (!selected.length) return;
    updateLayout((value) => selected.forEach((item) => {
      const target=item.kind==="patch"?value.patches.find(x=>x.id===item.id):value.added.find(x=>x.id===item.id);
      if(target){target.style={...target.style,...style};if(text!==undefined)target.text=text;}
    }));
  }

  function addText() {
    const item: VisualAdded={id:uid("text"),kind:"text",text:"Novo texto",style:{x:40,y:80,width:320,height:70,fontSize:30,fontWeight:700,color:"#4A1826",zIndex:20}};
    updateLayout((value)=>value.added.push(item));setSelected([{id:item.id,kind:"added"}]);
  }
  function addImage() {
    const src=window.prompt("Cole o endereço da imagem (URL HTTPS, caminho do site ou data:image):","");
    if(!src)return;if(!validImageSource(src))return toast.error("Use uma URL de imagem válida.");
    const item:VisualAdded={id:uid("image"),kind:"image",src,text:"Imagem",style:{x:40,y:80,width:260,height:200,zIndex:20}};
    updateLayout((value)=>value.added.push(item));setSelected([{id:item.id,kind:"added"}]);
  }
  function duplicate() {
    if(!selected.length)return;
    const newSelection:SelectedItem[]=[];
    updateLayout((value)=>selected.forEach((item)=>{
      if(item.kind==="added"){const source=value.added.find(x=>x.id===item.id);if(source){const copy={...cloneVisual(source),id:uid(source.kind),style:{...source.style,x:(source.style.x||0)+20,y:(source.style.y||0)+20}};value.added.push(copy);newSelection.push({id:copy.id,kind:"added"});}}
      else {const source=value.patches.find(x=>x.id===item.id);if(source){const copy={...cloneVisual(source),id:uid("copy"),selector:source.selector,style:{...source.style,x:(source.style.x||0)+20,y:(source.style.y||0)+20}};value.patches.push(copy);newSelection.push({id:copy.id,kind:"patch"});}}
    }));setSelected(newSelection);
  }
  function hideOrDelete() {
    if(!selected.length)return;
    updateLayout((value)=>selected.forEach((item)=>{if(item.kind==="added")value.added=value.added.filter(x=>x.id!==item.id);else{const patch=value.patches.find(x=>x.id===item.id);if(patch)patch.hidden=true;}}));setSelected([]);
  }
  function toggleVisibility(item:SelectedItem) {
    updateLayout((value)=>{const target=item.kind==="patch"?value.patches.find(x=>x.id===item.id):value.added.find(x=>x.id===item.id);if(!target)return;if(item.kind==="patch")(target as VisualPatch).hidden=!(target as VisualPatch).hidden;else target.style.opacity=target.style.opacity===0?1:0;});
  }
  function resetPage() { if(!confirm("Restaurar esta página neste tamanho?"))return;updateLayout((value)=>{value.patches=[];value.added=[];});setSelected([]); }

  async function saveDraft() {
    setSaving(true);const payload={...documento,updatedAt:new Date().toISOString()};
    const {error}=await (supabase as any).from("oricse_config").upsert({chave:VISUAL_DRAFT_KEY,valor:payload,updated_at:new Date().toISOString()});
    setSaving(false);if(error)return toast.error(error.message);setDocumento(payload);toast.success("Rascunho salvo.");
  }
  async function publish() {
    setSaving(true);const payload={...documento,updatedAt:new Date().toISOString()};
    const history:Version[]=[{id:uid("version"),publishedAt:payload.updatedAt,pages:cloneVisual(payload.pages)},...versions].slice(0,12);
    const [published,draft,savedHistory]=await Promise.all([
      (supabase as any).from("oricse_config").upsert({chave:VISUAL_PUBLISHED_KEY,valor:payload,updated_at:payload.updatedAt}),
      (supabase as any).from("oricse_config").upsert({chave:VISUAL_DRAFT_KEY,valor:payload,updated_at:payload.updatedAt}),
      (supabase as any).from("oricse_config").upsert({chave:VISUAL_VERSIONS_KEY,valor:history,updated_at:payload.updatedAt}),
    ]);
    setSaving(false);const error=published.error||draft.error||savedHistory.error;if(error)return toast.error(error.message);
    setDocumento(payload);setVersions(history);window.dispatchEvent(new Event("oricse:visual-published"));toast.success("Alterações publicadas no sistema.");
  }
  function restore(version:Version){checkpoint();setDocumento({version:1,updatedAt:new Date().toISOString(),pages:cloneVisual(version.pages)});setSelected([]);toast.success("Versão carregada como rascunho. Revise e publique.");}

  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?redoNow():undoNow();}else if(event.key==="Delete"&&selectedRef.current.length){event.preventDefault();hideOrDelete();}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);});

  if(loading)return <main className="flex min-h-screen items-center justify-center bg-[#ece8e3]">Carregando editor visual…</main>;
  const frameWidth=deviceWidth(device);const scale=zoom/100;

  return <main className="min-h-screen bg-[#ded9d3] text-slate-900">
    <header className="sticky top-0 z-50 flex min-h-16 flex-wrap items-center gap-2 border-b bg-white px-3 py-2 shadow-sm">
      <Link to="/admin" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold"><ArrowLeft size={17}/> Admin</Link>
      <button onClick={()=>setLeftOpen(x=>!x)} className="rounded-xl border p-2" title="Páginas e elementos"><Layers3 size={18}/></button>
      <button onClick={addText} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold"><Type size={17}/> Texto</button>
      <button onClick={addImage} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold"><ImagePlus size={17}/> Imagem</button>
      <button disabled={!undo.length} onClick={undoNow} className="rounded-xl border p-2 disabled:opacity-30"><Undo2 size={18}/></button>
      <button disabled={!redo.length} onClick={redoNow} className="rounded-xl border p-2 disabled:opacity-30"><Redo2 size={18}/></button>
      <div className="mx-1 h-8 w-px bg-slate-200"/>
      <button onClick={()=>{setDevice("desktop");setSelected([])}} className={`rounded-xl p-2 ${device==="desktop"?"bg-primary text-white":"border"}`}><Monitor size={18}/></button>
      <button onClick={()=>{setDevice("mobile");setSelected([])}} className={`rounded-xl p-2 ${device==="mobile"?"bg-primary text-white":"border"}`}><Smartphone size={18}/></button>
      <select value={zoom} onChange={e=>setZoom(Number(e.target.value))} className="rounded-xl border px-2 py-2"><option value={40}>40%</option><option value={55}>55%</option><option value={70}>70%</option><option value={85}>85%</option><option value={100}>100%</option></select>
      <button onClick={()=>setRightOpen(x=>!x)} className="rounded-xl border p-2" title="Propriedades"><Move size={18}/></button>
      <div className="ml-auto flex gap-2"><button disabled={saving} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-semibold"><Save size={17}/> Salvar rascunho</button><button disabled={saving} onClick={publish} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-white"><UploadCloud size={17}/> Publicar</button></div>
    </header>

    <div className={`grid min-h-[calc(100vh-64px)] ${leftOpen&&rightOpen?"lg:grid-cols-[260px_minmax(0,1fr)_290px]":leftOpen?"lg:grid-cols-[260px_minmax(0,1fr)]":rightOpen?"lg:grid-cols-[minmax(0,1fr)_290px]":"grid-cols-1"}`}>
      {leftOpen&&<aside className="border-r bg-white p-3">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Página<select value={route} onChange={e=>{setRoute(e.target.value);setSelected([])}} className="mt-2 w-full rounded-xl border p-2 text-sm font-semibold normal-case tracking-normal">{PAGES.map(([path,name])=><option key={path} value={path}>{name}</option>)}</select></label>
        <div className="mt-5 flex items-center justify-between"><h2 className="font-bold">Camadas</h2><button onClick={()=>setSelected([])} className="text-xs font-semibold text-primary">Desmarcar</button></div>
        <div className="mt-2 max-h-[48vh] space-y-1 overflow-auto">
          {[...layout.added.map(x=>({item:{id:x.id,kind:"added" as const},label:x.text||x.kind,hidden:x.style.opacity===0})),...layout.patches.map(x=>({item:{id:x.id,kind:"patch" as const},label:x.label,hidden:x.hidden}))].reverse().map(({item,label,hidden})=><div key={`${item.kind}-${item.id}`} className={`flex items-center gap-1 rounded-lg border p-1 ${selected.some(x=>x.id===item.id&&x.kind===item.kind)?"border-primary bg-primary/5":""}`}><button onClick={()=>setSelected([item])} className="min-w-0 flex-1 truncate px-2 py-1 text-left text-xs font-semibold">{label}</button><button onClick={()=>toggleVisibility(item)} className="p-1 text-muted-foreground">{hidden?<EyeOff size={14}/>:<Eye size={14}/>}</button></div>)}
          {!layout.added.length&&!layout.patches.length&&<p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">Clique em qualquer objeto dentro da página para começar a editá-lo.</p>}
        </div>
        <div className="mt-5 border-t pt-4"><div className="flex items-center justify-between"><h2 className="font-bold">Versões</h2><button onClick={resetPage} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><RotateCcw size={13}/> Restaurar página</button></div><div className="mt-2 space-y-2">{versions.slice(0,5).map(v=><button key={v.id} onClick={()=>restore(v)} className="w-full rounded-xl border p-2 text-left text-xs"><strong>{new Date(v.publishedAt).toLocaleString("pt-BR")}</strong><span className="mt-1 block text-muted-foreground">Carregar como rascunho</span></button>)}{!versions.length&&<p className="text-xs text-muted-foreground">Nenhuma versão publicada ainda.</p>}</div></div>
      </aside>}

      <section className="min-w-0 overflow-auto p-6">
        <div className="mx-auto origin-top" style={{width:frameWidth*scale,minHeight:760*scale}}>
          <div className="origin-top-left overflow-hidden rounded-lg bg-white shadow-2xl" style={{width:frameWidth,height:device==="desktop"?900:844,transform:`scale(${scale})`}}>
            <iframe key={`${route}-${device}`} ref={iframeRef} src={`${route}${route.includes("?")?"&":"?"}visual_editor=1`} onLoad={bindFrame} title={`Editor de ${route}`} className="h-full w-full border-0 bg-white" style={{width:frameWidth}}/>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-600">Clique para selecionar. Shift + clique seleciona vários. Arraste para mover e use o ponto inferior direito para redimensionar.</p>
      </section>

      {rightOpen&&<aside className="border-l bg-white p-4">
        <h2 className="font-bold">Propriedades</h2><p className="mt-1 text-xs text-muted-foreground">{selected.length?`${selected.length} elemento(s) selecionado(s)`:"Selecione algo na página."}</p>
        {first&&<div className="mt-4 space-y-4">
          {(!("kind" in first)||first.kind!=="image")&&<label className="block text-xs font-bold">Texto<textarea value={first.text||""} onChange={e=>patchSelected({},e.target.value)} rows={4} className="mt-1 w-full rounded-xl border p-2 font-normal"/></label>}
          {"src" in first&&first.kind==="image"&&<label className="block text-xs font-bold">Imagem<input value={first.src||""} onChange={e=>updateLayout(v=>{const x=v.added.find(a=>a.id===first.id);if(x)x.src=e.target.value;})} className="mt-1 w-full rounded-xl border p-2 font-normal"/></label>}
          <div className="grid grid-cols-2 gap-2">{([['x','X'],['y','Y'],['width','Largura'],['height','Altura']] as const).map(([key,label])=><label key={key} className="text-xs font-bold">{label}<input type="number" value={first.style[key]??""} onChange={e=>patchSelected({[key]:number(e.target.value)})} className="mt-1 w-full rounded-lg border p-2 font-normal"/></label>)}</div>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">Fonte<input type="number" min={6} max={220} value={first.style.fontSize??""} onChange={e=>patchSelected({fontSize:number(e.target.value)})} className="mt-1 w-full rounded-lg border p-2 font-normal"/></label><label className="text-xs font-bold">Peso<select value={first.style.fontWeight||400} onChange={e=>patchSelected({fontWeight:number(e.target.value)})} className="mt-1 w-full rounded-lg border p-2 font-normal"><option value={400}>Normal</option><option value={500}>Médio</option><option value={600}>Semibold</option><option value={700}>Negrito</option><option value={900}>Black</option></select></label></div>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">Texto<input type="color" value={first.style.color||"#4A1826"} onChange={e=>patchSelected({color:e.target.value})} className="mt-1 h-10 w-full rounded border"/></label><label className="text-xs font-bold">Fundo<input type="color" value={first.style.backgroundColor||"#FFFFFF"} onChange={e=>patchSelected({backgroundColor:e.target.value})} className="mt-1 h-10 w-full rounded border"/></label></div>
          <div className="flex gap-2"><button onClick={()=>patchSelected({textAlign:"left"})} className="rounded-lg border p-2"><AlignLeft size={17}/></button><button onClick={()=>patchSelected({textAlign:"center"})} className="rounded-lg border p-2"><AlignCenter size={17}/></button><button onClick={()=>patchSelected({textAlign:"right"})} className="rounded-lg border p-2"><AlignRight size={17}/></button><label className="ml-auto flex items-center gap-2 text-xs font-bold">Opacidade<input type="number" min={0} max={1} step={0.1} value={first.style.opacity??1} onChange={e=>patchSelected({opacity:number(e.target.value,1)})} className="w-16 rounded-lg border p-2"/></label></div>
          <div className="grid grid-cols-2 gap-2"><button onClick={()=>patchSelected({zIndex:(first.style.zIndex||0)+1})} className="inline-flex items-center justify-center gap-2 rounded-xl border p-2 text-xs font-bold"><BringToFront size={15}/> Frente</button><button onClick={()=>patchSelected({zIndex:(first.style.zIndex||0)-1})} className="inline-flex items-center justify-center gap-2 rounded-xl border p-2 text-xs font-bold"><SendToBack size={15}/> Trás</button></div>
          <div className="grid grid-cols-2 gap-2 border-t pt-4"><button onClick={duplicate} className="inline-flex items-center justify-center gap-2 rounded-xl border p-2 text-xs font-bold"><Copy size={15}/> Duplicar</button><button onClick={hideOrDelete} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 p-2 text-xs font-bold text-red-600"><Trash2 size={15}/> Excluir</button></div>
        </div>}
      </aside>}
    </div>
  </main>;
}

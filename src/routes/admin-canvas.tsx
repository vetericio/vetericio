import { createFileRoute, Link } from "@tanstack/react-router";
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, BringToFront, Copy, Monitor, Plus, Save, SendToBack, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-canvas")({ component: AdminCanvas });

type Device = "desktop" | "mobile";
type Align = "left" | "center" | "right";
type Kind = "logo" | "title" | "subtitle" | "text" | "cards";

type Box = { x:number; y:number; w:number; h:number; fontSize:number; fontWeight:number; color:string; align:Align; z:number };
type CanvasElement = { id:string; kind:Kind; text?:string; protected?:boolean; desktop:Box; mobile:Box };

type SiteConfig = { marca?:string; titulo_planos?:string; subtitulo_planos?:string; cta_plano?:string; logo_url?:string };
type Plano = { codigo:string; nome:string; publico_alvo:string; preco:string; preco_mensal?:string; preco_anual?:string; descricao:string; itens:string[]; ativo:boolean; ordem:number };

const box = (x:number,y:number,w:number,h:number,fontSize=32,fontWeight=400,color="#102b25",align:Align="center",z=1):Box => ({x,y,w,h,fontSize,fontWeight,color,align,z});

const DEFAULT_ELEMENTS: CanvasElement[] = [
  { id:"logo", kind:"logo", protected:true, desktop:box(760,70,400,250,16,400,"#000","center",1), mobile:box(75,40,240,160,16,400,"#000","center",1) },
  { id:"title", kind:"title", protected:true, text:"Escolha o plano ideal para sua clínica ou petshop.", desktop:box(360,360,1200,100,58,700,"#102b25","center",2), mobile:box(25,235,340,120,34,700,"#102b25","center",2) },
  { id:"subtitle", kind:"subtitle", protected:true, text:"Organize atendimento, internação, prontuários, financeiro e estoque em um só sistema.", desktop:box(430,475,1060,70,24,400,"#61706b","center",2), mobile:box(25,365,340,100,18,400,"#61706b","center",2) },
  { id:"cards", kind:"cards", protected:true, desktop:box(80,650,1760,620,16,400,"#000","left",1), mobile:box(15,540,360,1500,16,400,"#000","left",1) },
];

function AdminCanvas() {
  const [device,setDevice] = useState<Device>("desktop");
  const [zoom,setZoom] = useState(50);
  const [site,setSite] = useState<SiteConfig>({});
  const [planos,setPlanos] = useState<Plano[]>([]);
  const [elements,setElements] = useState<CanvasElement[]>(DEFAULT_ELEMENTS);
  const [selected,setSelected] = useState<string>("title");
  const [saving,setSaving] = useState(false);
  const drag = useRef<{id:string; sx:number; sy:number; ox:number; oy:number}|null>(null);
  const resize = useRef<{id:string; sx:number; sy:number; ow:number; oh:number}|null>(null);

  useEffect(()=>{ void (async()=>{
    const [cfg,p,canvas] = await Promise.all([
      (supabase as any).from("oricse_config").select("valor").eq("chave","site_publico").maybeSingle(),
      (supabase as any).from("oricse_planos").select("codigo,nome,publico_alvo,preco,preco_mensal,preco_anual,descricao,itens,ativo,ordem").eq("ativo",true).order("ordem"),
      (supabase as any).from("oricse_config").select("valor").eq("chave","planos_canvas").maybeSingle(),
    ]);
    const s = cfg.data?.valor || {};
    setSite(s);
    setPlanos((p.data||[]).map((x:any)=>({...x,itens:Array.isArray(x.itens)?x.itens:[]})));
    if (canvas.data?.valor?.elements) setElements(canvas.data.valor.elements);
    else setElements(DEFAULT_ELEMENTS.map((el)=> el.id==="title" ? {...el,text:s.titulo_planos||el.text} : el.id==="subtitle" ? {...el,text:s.subtitulo_planos||el.text} : el));
  })(); },[]);

  const current = useMemo(()=>elements.find(e=>e.id===selected)||null,[elements,selected]);
  const currentBox = current?.[device];
  const canvasWidth = device==="desktop"?1920:390;
  const canvasHeight = device==="desktop"?1400:2200;
  const scale = zoom/100;

  function patchElement(id:string, fn:(el:CanvasElement)=>CanvasElement){ setElements(list=>list.map(el=>el.id===id?fn(el):el)); }
  function patchBox(id:string, patch:Partial<Box>){ patchElement(id,el=>({...el,[device]:{...el[device],...patch}})); }

  function onMove(ev:PointerEvent){
    if(drag.current){ const d=drag.current; patchBox(d.id,{x:Math.round(d.ox+(ev.clientX-d.sx)/scale),y:Math.round(d.oy+(ev.clientY-d.sy)/scale)}); }
    if(resize.current){ const r=resize.current; patchBox(r.id,{w:Math.max(80,Math.round(r.ow+(ev.clientX-r.sx)/scale)),h:Math.max(40,Math.round(r.oh+(ev.clientY-r.sy)/scale))}); }
  }
  function stop(){ drag.current=null; resize.current=null; window.removeEventListener("pointermove",onMove); window.removeEventListener("pointerup",stop); }
  function beginDrag(e:React.PointerEvent,id:string,b:Box){ e.preventDefault(); e.stopPropagation(); setSelected(id); drag.current={id,sx:e.clientX,sy:e.clientY,ox:b.x,oy:b.y}; window.addEventListener("pointermove",onMove); window.addEventListener("pointerup",stop); }
  function beginResize(e:React.PointerEvent,id:string,b:Box){ e.preventDefault(); e.stopPropagation(); setSelected(id); resize.current={id,sx:e.clientX,sy:e.clientY,ow:b.w,oh:b.h}; window.addEventListener("pointermove",onMove); window.addEventListener("pointerup",stop); }

  function addText(){
    const id=`text-${Date.now()}`;
    const el:CanvasElement={id,kind:"text",text:"Novo texto",desktop:box(700,580,520,80,32,600,"#102b25","center",5),mobile:box(45,480,300,70,24,600,"#102b25","center",5)};
    setElements(v=>[...v,el]); setSelected(id);
  }
  function duplicate(){ if(!current) return; const id=`${current.kind}-${Date.now()}`; const clone={...current,id,protected:false,text:current.text||"Texto",desktop:{...current.desktop,x:current.desktop.x+30,y:current.desktop.y+30},mobile:{...current.mobile,x:current.mobile.x+15,y:current.mobile.y+15}}; setElements(v=>[...v,clone]); setSelected(id); }
  function remove(){ if(!current||current.protected) return toast.error("Esse elemento estrutural não pode ser excluído."); setElements(v=>v.filter(e=>e.id!==current.id)); setSelected("title"); }
  function z(delta:number){ if(!current) return; patchBox(current.id,{z:Math.max(0,currentBox!.z+delta)}); }

  async function save(){
    setSaving(true);
    const title=elements.find(e=>e.id==="title")?.text||site.titulo_planos||"";
    const subtitle=elements.find(e=>e.id==="subtitle")?.text||site.subtitulo_planos||"";
    const [{error:e1},{error:e2}] = await Promise.all([
      (supabase as any).from("oricse_config").upsert({chave:"planos_canvas",valor:{version:1,elements},updated_at:new Date().toISOString()}),
      (supabase as any).from("oricse_config").upsert({chave:"site_publico",valor:{...site,titulo_planos:title,subtitulo_planos:subtitle},updated_at:new Date().toISOString()}),
    ]);
    setSaving(false); if(e1||e2) return toast.error((e1||e2).message); setSite(s=>({...s,titulo_planos:title,subtitulo_planos:subtitle})); toast.success("Canvas salvo.");
  }

  const renderElement=(el:CanvasElement)=>{
    const b=el[device]; const sel=selected===el.id;
    const common:React.CSSProperties={position:"absolute",left:b.x,top:b.y,width:b.w,height:b.h,zIndex:b.z,boxSizing:"border-box"};
    let body:React.ReactNode=null;
    if(el.kind==="logo") body=<img src={site.logo_url||"/oricse-logo.png"} className="h-full w-full object-contain" draggable={false}/>;
    else if(el.kind==="cards") body=<div className={`grid h-full gap-5 ${device==="desktop"?"grid-cols-4":"grid-cols-1"}`}>{planos.map((p)=><div key={p.codigo} className="flex min-h-0 flex-col rounded-3xl border bg-white p-6 shadow-sm"><div className="text-2xl font-bold">{p.nome}</div><div className="mt-1 text-sm font-semibold text-primary">{p.publico_alvo}</div><div className="mt-3 text-sm text-slate-500">{p.descricao}</div><div className="mt-6 text-3xl font-bold">{p.preco_mensal||p.preco}</div><button className="mt-5 rounded-xl bg-primary px-4 py-3 font-semibold text-white">{site.cta_plano||"Escolher plano"}</button><ul className="mt-5 space-y-2 text-sm">{p.itens?.slice(0,5).map((i:string)=><li key={i}>{i}</li>)}</ul></div>)}</div>;
    else body=<div className="flex h-full w-full items-center" style={{fontSize:b.fontSize,fontWeight:b.fontWeight,color:b.color,textAlign:b.align,justifyContent:b.align==="left"?"flex-start":b.align==="right"?"flex-end":"center",lineHeight:1.15,whiteSpace:"pre-wrap",overflow:"hidden"}}>{el.text}</div>;
    return <div key={el.id} style={common} onPointerDown={(e)=>beginDrag(e,el.id,b)} onClick={(e)=>{e.stopPropagation();setSelected(el.id)}} className={`${sel?"ring-4 ring-primary/70":"hover:ring-2 hover:ring-primary/30"} select-none`}>
      {body}
      {sel&&<><span className="absolute -top-7 left-0 rounded bg-primary px-2 py-1 text-xs font-semibold text-white">{el.kind}</span><button aria-label="Redimensionar" onPointerDown={(e)=>beginResize(e,el.id,b)} className="absolute -bottom-3 -right-3 h-7 w-7 cursor-se-resize rounded-full border-2 border-white bg-primary shadow"/></>}
    </div>;
  };

  return <main className="min-h-screen bg-[#eceae5] text-slate-900">
    <header className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b bg-white px-4 py-3 shadow-sm">
      <Link to="/admin" className="mr-2 inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold"><ArrowLeft size={17}/> Admin</Link>
      <button onClick={addText} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold"><Plus size={16}/> Texto</button>
      <div className="h-8 w-px bg-slate-200"/>
      <button onClick={()=>setDevice("desktop")} className={`rounded-xl px-3 py-2 ${device==="desktop"?"bg-primary text-white":"border"}`}><Monitor size={18}/></button>
      <button onClick={()=>setDevice("mobile")} className={`rounded-xl px-3 py-2 ${device==="mobile"?"bg-primary text-white":"border"}`}><Smartphone size={18}/></button>
      <select value={zoom} onChange={e=>setZoom(Number(e.target.value))} className="rounded-xl border px-3 py-2"><option>50</option><option>75</option><option>100</option><option>125</option></select><span className="text-sm">%</span>
      {current&&currentBox&&<>
        <div className="h-8 w-px bg-slate-200"/>
        {current.kind!=="logo"&&current.kind!=="cards"&&<><input value={current.text||""} onChange={e=>patchElement(current.id,x=>({...x,text:e.target.value}))} className="min-w-[220px] flex-1 rounded-xl border px-3 py-2"/><input type="number" min={8} max={160} value={currentBox.fontSize} onChange={e=>patchBox(current.id,{fontSize:Number(e.target.value)})} className="w-20 rounded-xl border px-2 py-2"/><button onClick={()=>patchBox(current.id,{fontWeight:currentBox.fontWeight>=700?400:700})} className={`rounded-xl border p-2 ${currentBox.fontWeight>=700?"bg-slate-200":""}`}><Bold size={18}/></button><button onClick={()=>patchBox(current.id,{align:"left"})} className="rounded-xl border p-2"><AlignLeft size={18}/></button><button onClick={()=>patchBox(current.id,{align:"center"})} className="rounded-xl border p-2"><AlignCenter size={18}/></button><button onClick={()=>patchBox(current.id,{align:"right"})} className="rounded-xl border p-2"><AlignRight size={18}/></button><input type="color" value={currentBox.color} onChange={e=>patchBox(current.id,{color:e.target.value})} className="h-10 w-12 rounded border"/></>}
        <button onClick={duplicate} className="rounded-xl border p-2" title="Duplicar"><Copy size={18}/></button><button onClick={()=>z(1)} className="rounded-xl border p-2" title="Trazer para frente"><BringToFront size={18}/></button><button onClick={()=>z(-1)} className="rounded-xl border p-2" title="Mandar para trás"><SendToBack size={18}/></button><button onClick={remove} className="rounded-xl border p-2 text-red-600" title="Excluir"><Trash2 size={18}/></button>
      </>}
      <button disabled={saving} onClick={save} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-white"><Save size={17}/>{saving?"Salvando...":"Salvar"}</button>
    </header>

    <div className="overflow-auto p-8">
      <div className="mx-auto" style={{width:canvasWidth*scale,height:canvasHeight*scale}}>
        <div onClick={()=>setSelected("")} className="relative origin-top-left overflow-hidden bg-[#f6f4ef] shadow-2xl" style={{width:canvasWidth,height:canvasHeight,transform:`scale(${scale})`}}>
          {elements.slice().sort((a,b)=>a[device].z-b[device].z).map(renderElement)}
        </div>
      </div>
    </div>
  </main>;
}

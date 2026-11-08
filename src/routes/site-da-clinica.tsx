import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, ChevronRight,
  Eye, FileClock, ImagePlus, Laptop, Layers3, Monitor, Palette,
  Plus, Redo2, Save, Send, Smartphone, Sparkles, Trash2, Type, Undo2, Upload,
  UsersRound, HelpCircle, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { enviarLogoClinica } from "@/lib/clinic-logo.functions";
import { usePermissoes } from "@/hooks/usePermissoes";
import {
  clinicSitePresets, clinicSiteSections, clinicSiteSectionLabels,
  clinicSiteTemplateLabels, clinicSiteTemplateDescriptions, clinicSiteTemplates,
  normalizeClinicSiteConfig, prestigeDefault,
  type ClinicSiteConfig, type ClinicSiteSection, type ClinicSiteTemplate,
} from "@/lib/clinic-site";

export const Route = createFileRoute("/site-da-clinica")({component:SiteDaClinica});

type Tab = "modelos"|"conteudo"|"midia"|"cores"|"secoes"|"equipe"|"duvidas"|"historico";
type SavedVersion = {
  id:string; template:ClinicSiteTemplate; config:ClinicSiteConfig; created_at:string;
};
type ImageTarget = "logo"|"hero"|"gallery"|"team";
const tabLabels: Record<Tab,string> = {
  modelos:"Modelos",conteudo:"Conteúdo",midia:"Fotos e logo",cores:"Aparência",
  secoes:"Seções",equipe:"Equipe",duvidas:"Perguntas",historico:"Histórico",
};
const editorTabs = [
  {id:"modelos" as Tab,icon:Sparkles},
  {id:"conteudo" as Tab,icon:Type},
  {id:"midia" as Tab,icon:ImagePlus},
  {id:"cores" as Tab,icon:Palette},
  {id:"secoes" as Tab,icon:Layers3},
  {id:"equipe" as Tab,icon:UsersRound},
  {id:"duvidas" as Tab,icon:HelpCircle},
  {id:"historico" as Tab,icon:FileClock},
];
const mobile = (max:number) => ({
  className:"mt-1 min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm font-normal",
  maxLength:max,
});

function SiteDaClinica() {
  const {clinicaId, carregando, pode} = usePermissoes();
  const [config,setConfig] = useState<ClinicSiteConfig>(prestigeDefault);
  const [template,setTemplate] = useState<ClinicSiteTemplate>("prestige");
  const [slug,setSlug] = useState("");
  const [status,setStatus] = useState<"rascunho"|"publicado">("rascunho");
  const [hasRecord,setHasRecord] = useState(false);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [uploading,setUploading] = useState("");
  const [tab,setTab] = useState<Tab>("modelos");
  const [device,setDevice] = useState<"mobile"|"tablet"|"desktop">("desktop");
  const [ready,setReady] = useState(false);
  const [selected,setSelected] = useState("inicio");
  const [undo,setUndo] = useState<ClinicSiteConfig[]>([]);
  const [redo,setRedo] = useState<ClinicSiteConfig[]>([]);
  const [versions,setVersions] = useState<SavedVersion[]>([]);
  const [dirty,setDirty] = useState(false);
  const iframe=useRef<HTMLIFrameElement>(null);

  useEffect(()=>{
    if(!clinicaId) return;
    let active=true;
    void (async()=>{
      const [site, history, clinic] = await Promise.all([
        (supabaseBanco as any).from("clinic_sites")
          .select("slug,status,template,config,draft_template,draft_config")
          .eq("clinica_id",clinicaId).maybeSingle(),
        (supabaseBanco as any).from("clinic_site_versions")
          .select("id,template,config,created_at").eq("clinica_id",clinicaId)
          .order("created_at",{ascending:false}).limit(25),
        (supabaseBanco as any).from("clinicas")
          .select("nome,slug,logo_url").eq("id",clinicaId).maybeSingle(),
      ]);
      if(!active)return;
      if(site.error)toast.error("Falha ao carregar o site: "+site.error.message);
      if(site.data){
        const current=site.data;
        setHasRecord(true);
        setSlug(current.slug||"");
        setStatus(current.status==="publicado"?"publicado":"rascunho");
        const chosen=current.draft_template||current.template;
        if(clinicSiteTemplates.includes(chosen))setTemplate(chosen);
        setConfig(normalizeClinicSiteConfig(current.draft_config||current.config));
      }else if(clinic.data){
        setSlug(clinic.data.slug||"");
        setConfig(normalizeClinicSiteConfig({
          ...prestigeDefault,
          name:clinic.data.nome||prestigeDefault.name,
          logoUrl:clinic.data.logo_url||"",
        }));
      }
      if(!history.error)setVersions((history.data||[]).map((row:any)=>({
        id:row.id,template:row.template,
        config:normalizeClinicSiteConfig(row.config),created_at:row.created_at,
      })));
      setLoading(false);
    })();
    return()=>{active=false};
  },[clinicaId]);

  useEffect(()=>{
    const onMessage=(e:MessageEvent)=>{
      if(e.origin!==window.location.origin||e.source!==iframe.current?.contentWindow)return;
      if(e.data?.type==="oricse-clinic-site-preview-ready-v1")setReady(true);
      if(e.data?.type==="oricse-clinic-site-select-v1"){
        const section=String(e.data.section||"inicio");
        setSelected(section);
        if(section==="galeria")setTab("midia");
        else if(section==="equipe")setTab("equipe");
        else if(section==="faq")setTab("duvidas");
        else if(section==="rodape")setTab("cores");
        else setTab("conteudo");
      }
    };
    window.addEventListener("message",onMessage);
    return()=>window.removeEventListener("message",onMessage);
  },[]);

  useEffect(()=>{
    if(!ready)return;
    iframe.current?.contentWindow?.postMessage({
      type:"oricse-clinic-site-preview-v1",template,config,selected,
    },window.location.origin);
  },[ready,template,config,selected]);

  const update=(patch:Partial<ClinicSiteConfig>)=>{
    setUndo(previous=>[...previous.slice(-29),config]);
    setRedo([]);
    setConfig(current=>({...current,...patch}));
    setDirty(true);
  };
  const updateText=(key:keyof ClinicSiteConfig,value:string)=>update({[key]:value} as Partial<ClinicSiteConfig>);
  const chooseTemplate=(next:ClinicSiteTemplate)=>{
    if(next===template)return;
    setTemplate(next);
    update(clinicSitePresets[next]);
  };
  const undoChange=()=>{
    if(!undo.length)return;
    setRedo(current=>[config,...current].slice(0,30));
    setConfig(undo[undo.length-1]);setUndo(undo.slice(0,-1));setDirty(true);
  };
  const redoChange=()=>{
    if(!redo.length)return;
    setUndo(current=>[...current.slice(-29),config]);
    setConfig(redo[0]);setRedo(redo.slice(1));setDirty(true);
  };
  const moveSection=(section:ClinicSiteSection,delta:number)=>{
    const list=[...config.sectionOrder],from=list.indexOf(section),to=from+delta;
    if(from<0||to<0||to>=list.length)return;
    [list[from],list[to]]=[list[to],list[from]];
    update({sectionOrder:list});
  };
  const toggleSection=(section:ClinicSiteSection)=>{
    update({hiddenSections:config.hiddenSections.includes(section)
      ?config.hiddenSections.filter(id=>id!==section):[...config.hiddenSections,section]});
  };

  async function uploadImage(file:File|undefined,target:ImageTarget,index=-1){
    if(!file||!clinicaId)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5*1024*1024){
      toast.error("Use uma foto PNG, JPG ou WebP de até 5 MB.");return;
    }
    setUploading(target+"-"+index);
    try{
      const base64=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result||""));
        reader.onerror=()=>reject(new Error("Não foi possível ler a imagem."));
        reader.readAsDataURL(file);
      });
      const {data:session,error:sessionError}=await supabase.auth.getSession();
      if(sessionError||!session.session?.access_token)throw new Error("Faça login novamente para enviar a imagem.");
      const result=await enviarLogoClinica({data:{
        clinicaId,accessToken:session.session.access_token,
        fileName:file.name,mimeType:file.type,base64,
        categoria:target==="logo"?"logo":"site",
      }} as never);
      const url=String(result?.logoUrl||"");
      if(!url.startsWith("https://"))throw new Error("O arquivo não retornou endereço seguro.");
      if(target==="logo")update({logoUrl:url});
      if(target==="hero")update({heroImageUrl:url});
      if(target==="gallery"){
        const next=[...config.galleryUrls];
        if(index<0)next.push(url);else next[index]=url;
        update({galleryUrls:next.slice(0,12)});
      }
      if(target==="team"&&index>=0){
        const next=[...config.team];next[index]={...next[index],imageUrl:url};
        update({team:next});
      }
      toast.success("Imagem enviada. Salve o rascunho para aplicar.");
    }catch(e){toast.error(e instanceof Error?e.message:"Falha no envio da foto.");}
    finally{setUploading("")}
  }

  const fileButton=(text:string,target:ImageTarget,index=-1)=>(
    <label className={"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold hover:bg-muted "+(uploading?"opacity-60":"")}>
      <Upload size={16}/>{uploading===target+"-"+index?"Enviando...":text}
      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
        disabled={Boolean(uploading)} onChange={e=>{void uploadImage(e.target.files?.[0],target,index);e.currentTarget.value="";}}/>
    </label>
  );

  async function save(publish=false){
    if(!clinicaId||saving)return;
    if(!slug||!config.name.trim())return toast.error("Confira o nome e o endereço da clínica.");
    setSaving(true);
    try{
      const now=new Date().toISOString();
      const base={clinica_id:clinicaId,slug,updated_at:now};
      const values=publish
        ?{...base,status:"publicado",config,template,
          draft_config:null,draft_template:null,draft_updated_at:null,publicado_em:now}
        :{...base,draft_config:config,draft_template:template,draft_updated_at:now};
      let result:any;
      if(hasRecord){
        result=await (supabaseBanco as any).from("clinic_sites").update(values)
          .eq("clinica_id",clinicaId).select("id").maybeSingle();
      }else{
        result=await (supabaseBanco as any).from("clinic_sites").insert({
          ...values,config,template,status:publish?"publicado":"rascunho",
        }).select("id").maybeSingle();
      }
      if(result.error||!result.data)throw new Error(result.error?.message||"Não foi possível salvar o site.");
      setHasRecord(true);
      setDirty(false);
      if(publish){
        setStatus("publicado");
        const version=await (supabaseBanco as any).from("clinic_site_versions").insert({
          clinica_id:clinicaId,config,template,
        }).select("id,template,config,created_at").maybeSingle();
        if(version.error)toast.error("Site publicado, mas o histórico não foi registrado.");
        else if(version.data)setVersions(current=>[{
          id:version.data.id,template:version.data.template,
          config:normalizeClinicSiteConfig(version.data.config),
          created_at:version.data.created_at,
        },...current].slice(0,25));
      }
      toast.success(publish?"Site publicado.":"Rascunho salvo sem alterar o site público.");
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar.");}
    finally{setSaving(false)}
  }

  const field=(label:string,key:keyof ClinicSiteConfig,rows=0)=>{
    const value=String(config[key]??"");
    return <label className="block text-sm font-bold">{label}
      {rows ? <textarea rows={rows} value={value} onChange={e=>updateText(key,e.target.value)}
          className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm font-normal"/> :
        <input value={value} onChange={e=>updateText(key,e.target.value)} {...mobile(300)}/>}
    </label>;
  };

  if(carregando||loading)return <main className="p-6 text-sm text-muted-foreground">Carregando editor da clínica...</main>;
  if(!pode("administracao.site"))return <main className="mx-auto max-w-xl p-8">
    <h1 className="text-2xl font-bold">Sem permissão</h1>
    <p className="mt-2 text-muted-foreground">Somente perfis autorizados podem editar o site da clínica.</p>
  </main>;

  return <main className="min-h-screen bg-muted/30 p-3 pb-20 sm:p-5">
    <div className="mx-auto max-w-[1750px]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-background p-4">
        <div>
          <Link to="/configuracao-site" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground"><ArrowLeft size={15}/> Voltar</Link>
          <h1 className="mt-1 text-2xl font-extrabold">Editor visual do site</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {slug ? slug+".oricse.com.br" : "Endereço não configurado"} · {status==="publicado"?"Publicado":"Rascunho"}
            {dirty && <span className="font-bold text-amber-700"> · Alterações não salvas</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={undoChange} disabled={!undo.length} aria-label="Desfazer" className="rounded-lg border p-2 disabled:opacity-30"><Undo2 size={18}/></button>
          <button type="button" onClick={redoChange} disabled={!redo.length} aria-label="Refazer" className="rounded-lg border p-2 disabled:opacity-30"><Redo2 size={18}/></button>
          {status==="publicado"&&slug&&<a href={"/c/"+encodeURIComponent(slug)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 text-xs font-bold"><ExternalLink size={15}/> Site ao vivo</a>}
          <button type="button" onClick={()=>void save(false)} disabled={saving||Boolean(uploading)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-4 text-xs font-bold disabled:opacity-50"><Save size={16}/> Salvar rascunho</button>
          <button type="button" onClick={()=>void save(true)} disabled={saving||Boolean(uploading)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50"><Send size={16}/> {saving?"Salvando...":"Publicar"}</button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden rounded-2xl border bg-background">
          <div className="flex flex-wrap gap-1 border-b bg-muted/30 p-2">
            {editorTabs.map(({id,icon:Icon})=><button key={id} type="button" onClick={()=>setTab(id)}
              aria-pressed={tab===id} title={tabLabels[id]}
              className={"flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold "+(tab===id?"bg-primary text-primary-foreground":"hover:bg-muted")}>
              <Icon size={15}/>{tabLabels[id]}
            </button>)}
          </div>
          <div className="max-h-[calc(100vh-185px)] space-y-5 overflow-y-auto p-4">
            {tab==="modelos"&&<>
              <div><h2 className="text-lg font-extrabold">Escolha entre seis sites</h2><p className="mt-1 text-sm text-muted-foreground">Cada modelo inclui página inicial, serviços, apresentação, fotos, equipe e contato.</p></div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {clinicSiteTemplates.map(item=>{
                  const preset=clinicSitePresets[item];
                  return <button type="button" key={item} onClick={()=>chooseTemplate(item)}
                    aria-pressed={item===template} className={"overflow-hidden rounded-2xl border-2 p-3 text-left "+(item===template?"border-primary":"border-muted")}>
                    <div className="flex h-20 items-center justify-between rounded-xl px-4" style={{background:preset.backgroundColor,color:preset.textColor}}>
                      <span className="max-w-32 text-sm font-black">{clinicSiteTemplateLabels[item]}</span>
                      <div className="h-9 w-9 rounded-full" style={{background:preset.primaryColor}}/>
                    </div>
                    <div className="mt-3 flex justify-between gap-2"><div><strong className="text-sm">{clinicSiteTemplateLabels[item]}</strong><p className="text-xs text-muted-foreground">{clinicSiteTemplateDescriptions[item]}</p></div>{item===template&&<CheckCircle2 className="shrink-0 text-primary" size={20}/>}</div>
                  </button>
                })}
              </div>
            </>}
            {tab==="conteudo"&&<>
              <h2 className="text-lg font-extrabold">Textos e informações</h2>
              {field("Nome da clínica","name")}
              {field("Título principal","slogan",2)}
              {field("Apresentação curta","description",4)}
              {field("Texto do botão de contato","ctaLabel")}
              {field("Telefone","phone")}
              {field("WhatsApp com DDD","whatsapp")}
              {field("Endereço completo","address",2)}
              {field("Horários de funcionamento","hours",2)}
              {field("Link de agendamento (HTTPS)","bookingUrl")}
              {field("Instagram (HTTPS)","instagramUrl")}
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={config.emergency24h} onChange={e=>update({emergency24h:e.target.checked})}/> Emergência 24h (somente se oferecer)</label>
              <div className="border-t pt-4">
                <h3 className="font-bold">Seção Sobre nós</h3>
                <div className="mt-3 space-y-3">{field("Título","aboutTitle")}{field("Texto","aboutText",6)}</div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-bold">Serviços da clínica</h3>
                <p className="my-2 text-xs text-muted-foreground">Cada linha vira um cartão de serviço no site.</p>
                <div className="space-y-2">{config.services.map((service,index)=><div key={index} className="flex items-center gap-2">
                  <input aria-label={"Serviço "+(index+1)} value={service} onChange={e=>{
                    const next=[...config.services];next[index]=e.target.value;update({services:next});
                  }} {...mobile(100)}/>
                  <button type="button" aria-label="Excluir serviço" onClick={()=>update({services:config.services.filter((_,i)=>i!==index)})} className="mt-1 rounded-lg border p-2 text-destructive"><Trash2 size={17}/></button>
                </div>)}</div>
                <button type="button" disabled={config.services.length>=24} onClick={()=>update({services:[...config.services,"Novo serviço"]})} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-40"><Plus size={17}/> Adicionar serviço</button>
              </div>
            </>}
            {tab==="midia"&&<>
              <h2 className="text-lg font-extrabold">Logo e fotos</h2>
              <p className="text-xs text-muted-foreground">Os arquivos ficam vinculados apenas à sua clínica. Use PNG, JPG ou WebP até 5 MB.</p>
              <div className="space-y-2 rounded-xl border p-3">
                <strong className="text-sm">Logo da clínica</strong>
                {config.logoUrl&&<img src={config.logoUrl} alt="Logo" className="h-20 w-28 rounded-lg bg-white object-contain p-2"/>}
                {fileButton("Enviar ou trocar logo","logo")}
              </div>
              <div className="space-y-2 rounded-xl border p-3">
                <strong className="text-sm">Imagem principal</strong>
                {config.heroImageUrl&&<img src={config.heroImageUrl} alt="Foto principal" className="h-32 w-full rounded-lg object-cover"/>}
                {fileButton("Enviar imagem de capa","hero")}
                {config.heroImageUrl&&<button type="button" onClick={()=>update({heroImageUrl:""})} className="block text-xs text-destructive underline">Remover foto do site</button>}
              </div>
              <div className="space-y-3 rounded-xl border p-3">
                <strong className="text-sm">Galeria de fotos ({config.galleryUrls.length}/12)</strong>
                <div className="grid grid-cols-2 gap-2">
                  {config.galleryUrls.map((url,index)=><div key={url+index} className="space-y-1">
                    <img src={url} alt={"Foto "+(index+1)} className="h-24 w-full rounded-lg object-cover"/>
                    <div className="flex flex-wrap gap-1">{fileButton("Trocar","gallery",index)}
                      <button type="button" aria-label="Remover foto" className="rounded-lg border p-2 text-destructive" onClick={()=>update({galleryUrls:config.galleryUrls.filter((_,i)=>i!==index)})}><Trash2 size={15}/></button>
                    </div>
                  </div>)}
                </div>
                {config.galleryUrls.length<12&&fileButton("Adicionar foto","gallery")}
              </div>
            </>}
            {tab==="cores"&&<>
              <h2 className="text-lg font-extrabold">Aparência do site</h2>
              <p className="text-xs text-muted-foreground">Personalize as cores do modelo escolhido. As alterações aparecem na prévia.</p>
              {([
                ["primaryColor","Cor principal"],
                ["secondaryColor","Cor de destaque"],
                ["backgroundColor","Fundo"],
                ["textColor","Cor do texto"],
              ] as const).map(([key,label])=><label key={key} className="flex items-center justify-between gap-4 text-sm font-semibold">
                {label}<div className="flex items-center gap-2"><input type="color" value={config[key]} onChange={e=>update({[key]:e.target.value})} className="h-11 w-12 cursor-pointer rounded-lg border bg-white p-1"/><span className="font-mono text-xs">{config[key]}</span></div>
              </label>)}
              <button type="button" onClick={()=>update(clinicSitePresets[template])} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Restaurar cores do modelo</button>
              <div className="rounded-xl border p-3 text-xs text-muted-foreground">O editor não altera o cabeçalho nem as cores da administração da ORICSE: somente o site público da clínica.</div>
            </>}
            {tab==="secoes"&&<>
              <h2 className="text-lg font-extrabold">Organizar a página</h2>
              <p className="text-xs text-muted-foreground">Mostre ou esconda seções e mude a ordem usando as setas. A página inicial e o rodapé permanecem fixos.</p>
              <div className="space-y-2">{config.sectionOrder.map(section=><div key={section} className="flex items-center gap-2 rounded-xl border p-3">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!config.hiddenSections.includes(section)} onChange={()=>toggleSection(section)}/><span className="truncate">{clinicSiteSectionLabels[section]}</span></label>
                <button type="button" aria-label={"Editar "+clinicSiteSectionLabels[section]} onClick={()=>setSelected(section)} className="rounded border p-1.5"><Eye size={15}/></button>
                <button type="button" aria-label={"Subir "+clinicSiteSectionLabels[section]} onClick={()=>moveSection(section,-1)} className="rounded border p-1.5"><ArrowUp size={15}/></button>
                <button type="button" aria-label={"Descer "+clinicSiteSectionLabels[section]} onClick={()=>moveSection(section,1)} className="rounded border p-1.5"><ArrowDown size={15}/></button>
              </div>)}</div>
            </>}
            {tab==="equipe"&&<>
              <h2 className="text-lg font-extrabold">Profissionais</h2>
              <p className="text-xs text-muted-foreground">Adicione apenas membros reais da equipe. Sem profissionais cadastrados, essa seção não aparece no site público.</p>
              {config.team.map((person,index)=><div key={index} className="space-y-3 rounded-xl border p-3">
                <strong className="text-sm">Profissional {index+1}</strong>
                {person.imageUrl&&<img src={person.imageUrl} alt={person.name} className="h-28 w-28 rounded-xl object-cover"/>}
                {fileButton("Enviar foto","team",index)}
                <label className="block text-xs font-bold">Nome<input value={person.name} onChange={e=>{const next=[...config.team];next[index]={...person,name:e.target.value};update({team:next});}} {...mobile(120)}/></label>
                <label className="block text-xs font-bold">Cargo ou especialidade<input value={person.role} onChange={e=>{const next=[...config.team];next[index]={...person,role:e.target.value};update({team:next});}} {...mobile(160)}/></label>
                <button type="button" className="text-xs font-bold text-destructive underline" onClick={()=>update({team:config.team.filter((_,i)=>i!==index)})}>Excluir profissional</button>
              </div>)}
              <button type="button" disabled={config.team.length>=20} onClick={()=>update({team:[...config.team,{name:"",role:"",imageUrl:""}]})} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-40"><Plus size={17}/> Adicionar profissional</button>
            </>}
            {tab==="duvidas"&&<>
              <h2 className="text-lg font-extrabold">Perguntas frequentes</h2>
              {config.faqItems.map((item,index)=><div key={index} className="space-y-3 rounded-xl border p-3">
                <label className="block text-xs font-bold">Pergunta<input value={item.question} onChange={e=>{const next=[...config.faqItems];next[index]={...item,question:e.target.value};update({faqItems:next});}} {...mobile(160)}/></label>
                <label className="block text-xs font-bold">Resposta<textarea rows={3} value={item.answer} onChange={e=>{const next=[...config.faqItems];next[index]={...item,answer:e.target.value};update({faqItems:next});}} className="mt-1 w-full rounded-xl border p-3 text-sm font-normal"/></label>
                <button type="button" className="text-xs font-bold text-destructive underline" onClick={()=>update({faqItems:config.faqItems.filter((_,i)=>i!==index)})}>Excluir pergunta</button>
              </div>)}
              <button type="button" disabled={config.faqItems.length>=12} onClick={()=>update({faqItems:[...config.faqItems,{question:"",answer:""}]})} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-40"><Plus size={17}/> Adicionar pergunta</button>
            </>}
            {tab==="historico"&&<>
              <h2 className="text-lg font-extrabold">Histórico de publicações</h2>
              <p className="text-xs text-muted-foreground">Ao escolher uma versão anterior, ela vira um rascunho nesta tela. Clique em Publicar para disponibilizá-la novamente.</p>
              {!versions.length&&<p className="rounded-xl border p-4 text-sm text-muted-foreground">Nenhuma publicação anterior registrada.</p>}
              {versions.map(version=><button type="button" key={version.id} className="flex w-full items-center justify-between gap-2 rounded-xl border p-4 text-left hover:bg-muted/30"
                onClick={()=>{setUndo(previous=>[...previous.slice(-29),config]);setTemplate(version.template);setConfig(version.config);setDirty(true);setTab("conteudo");toast.success("Versão carregada como rascunho.");}}>
                <div><strong className="block text-sm">{clinicSiteTemplateLabels[version.template]}</strong><span className="text-xs text-muted-foreground">{new Date(version.created_at).toLocaleString("pt-BR")}</span></div><ChevronRight size={17}/>
              </button>)}
            </>}
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div><strong className="text-sm">Prévia interativa</strong><p className="text-xs text-muted-foreground">Clique em uma seção para editá-la. Ações de agendamento ficam desativadas aqui.</p></div>
            <div className="flex gap-1 rounded-xl border bg-muted/30 p-1" role="group" aria-label="Tamanho da prévia">
              {([
                ["mobile",Smartphone,"Celular"],
                ["tablet",Laptop,"Tablet"],
                ["desktop",Monitor,"Computador"],
              ] as const).map(([id,Icon,label])=><button key={id} type="button" onClick={()=>setDevice(id)}
                aria-label={label} aria-pressed={device===id} className={"rounded-lg p-2 "+(device===id?"bg-primary text-primary-foreground":"")}><Icon size={18}/></button>)}
            </div>
          </div>
          <div className="flex min-h-[600px] justify-center overflow-auto bg-slate-200/40 p-3 sm:p-6">
            <iframe ref={iframe} title="Prévia do site da clínica" src="/site-da-clinica-preview"
              onLoad={()=>setReady(true)} loading="eager"
              className="max-w-full flex-none border bg-white shadow-xl"
              style={{width:device==="mobile"?390:device==="tablet"?768:1200,height:790}}/>
          </div>
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">
            <span className="font-semibold">Modelo: {clinicSiteTemplateLabels[template]}</span>
            <span className="ml-3">Seleção atual: {selected==="inicio"?"Página inicial":(clinicSiteSectionLabels as Record<string,string>)[selected]||"Rodapé"}</span>
          </div>
        </section>
      </div>
    </div>
  </main>;
}

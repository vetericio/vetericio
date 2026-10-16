import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Copy, ExternalLink, KeyRound, PawPrint, RefreshCw, ShieldCheck, Upload, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/usePermissoes";
import { type Comanda, lerComandas, saldoComanda, totalComanda, totalPagoComanda } from "@/lib/comandas";

export const Route = createFileRoute("/portal-tutores")({ component: PortalTutores });

type TutorDb = { id:string; codigo_publico:string; nome:string; cpf:string; telefone:string|null; email:string|null; dados:Record<string,unknown> };
type PortalDb = { id:string; tutor_id:string; usuario:string; ativo:boolean; ultimo_acesso_em:string|null; created_at:string };
type TutorLocal = { id?:string; nome?:string; telefone?:string; email?:string; cpfCnpj?:string; cpf?:string; [key:string]:unknown };
type AnimalLocal = { id?:string; tutorId?:string; tutor_id?:string; nome?:string; especie?:string; raca?:string; sexo?:string; nascimento?:string; peso?:string; foto_url?:string; [key:string]:unknown };
type Convite = { usuario:string; token:string; expira_em:string; clinica_slug:string; link:string };

function soDigitos(valor?: string) { return String(valor || "").replace(/\D/g, ""); }
function uuidValido(valor?: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(valor || "")); }
function normalizarUsuario(nome:string) {
  const base=nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,".").replace(/^\.+|\.+$/g,"");
  return `@tut.${base || "tutor"}`.slice(0,41);
}
function lerLocal<T>(chave:string):T[] {
  if(typeof window==="undefined") return [];
  try { const v=JSON.parse(oricseStorage.getItem(chave)||"[]"); return Array.isArray(v)?v:[]; }
  catch { return []; }
}

function PortalTutores(){
  const { carregando:carregandoPermissao,pode,clinicaId }=usePermissoes();
  const [carregando,setCarregando]=useState(true);
  const [tutores,setTutores]=useState<TutorDb[]>([]);
  const [portais,setPortais]=useState<PortalDb[]>([]);
  const [slug,setSlug]=useState("");
  const [selecionado,setSelecionado]=useState("");
  const [usuario,setUsuario]=useState("");
  const [convite,setConvite]=useState<Convite|null>(null);
  const [emitindo,setEmitindo]=useState(false);
  const [sincronizando,setSincronizando]=useState(false);
  const [locais,setLocais]=useState(()=>lerLocal<TutorLocal>("oricse-tutores-v1"));
  const [animaisLocais,setAnimaisLocais]=useState(()=>lerLocal<AnimalLocal>("oricse-animais-v1"));
  const [comandasLocais,setComandasLocais]=useState<Comanda[]>(()=>typeof window==="undefined"?[]:lerComandas());

  const carregar=useCallback(async()=>{
    if(!clinicaId)return;
    setCarregando(true);
    try{
      const [tutoresResp,portaisResp,clinicaResp]=await Promise.all([
        (supabase as any).from("tutores").select("id,codigo_publico,nome,cpf,telefone,email,dados").eq("clinica_id",clinicaId).order("nome"),
        (supabase as any).from("oricse_portal_tutores").select("id,tutor_id,usuario,ativo,ultimo_acesso_em,created_at").eq("clinica_id",clinicaId).order("created_at",{ascending:false}),
        (supabase as any).from("clinicas").select("slug").eq("id",clinicaId).maybeSingle(),
      ]);
      for(const r of [tutoresResp,portaisResp,clinicaResp])if(r.error)throw r.error;
      setTutores((tutoresResp.data||[]) as TutorDb[]);
      setPortais((portaisResp.data||[]) as PortalDb[]);
      setSlug(clinicaResp.data?.slug||"");
    }catch(error){toast.error(error instanceof Error?error.message:"Não foi possível carregar os tutores.");}
    finally{setCarregando(false);}
  },[clinicaId]);

  useEffect(()=>{void carregar();},[carregar]);
  useEffect(()=>{
    if(typeof window==="undefined") return;
    const atualizar=()=>{ setLocais(lerLocal("oricse-tutores-v1")); setAnimaisLocais(lerLocal("oricse-animais-v1")); setComandasLocais(lerComandas()); };
    window.addEventListener("storage",atualizar);
    window.addEventListener("oricse-comandas-atualizadas",atualizar);
    return()=>{window.removeEventListener("storage",atualizar);window.removeEventListener("oricse-comandas-atualizadas",atualizar);};
  },[]);

  const portalPorTutor=useMemo(()=>new Map(portais.map(p=>[p.tutor_id,p])),[portais]);
  const tutorSelecionado=tutores.find(t=>t.id===selecionado)||null;
  useEffect(()=>{
    if(tutorSelecionado&&!portalPorTutor.has(tutorSelecionado.id)) setUsuario(normalizarUsuario(tutorSelecionado.nome));
    setConvite(null);
  },[selecionado,tutorSelecionado?.id,portalPorTutor]);

  const locaisValidos=useMemo(()=>locais.filter(t=>Boolean(t.nome?.trim())&&soDigitos(String(t.cpfCnpj||t.cpf||"")).length===11&&uuidValido(t.id)),[locais]);
  const animaisImportaveis=useMemo(()=>animaisLocais.filter(a=>uuidValido(a.id)&&Boolean(a.nome?.trim())&&Boolean(a.tutorId||a.tutor_id)),[animaisLocais]);
  const comandasImportaveis=useMemo(()=>comandasLocais.filter(c=>uuidValido(c.id)&&uuidValido(c.tutorId)&&uuidValido(c.animalId)),[comandasLocais]);

  async function sincronizarDadosLocais(){
    if(!clinicaId)return;
    const resumo=`${locaisValidos.length} tutor(es), ${animaisImportaveis.length} animal(is) e ${comandasImportaveis.length} comanda(s)`;
    if(!window.confirm(`Sincronizar ${resumo} deste navegador para ESTA clínica? Nada será apagado do banco; serão criados/atualizados apenas registros compatíveis.`))return;
    setSincronizando(true);
    try{
      const mapaTutor=new Map<string,string>();
      const mapaAnimal=new Map<string,string>();
      let tutoresSincronizados=0,animaisSincronizados=0,comandasSincronizadas=0,ignorados=0;

      for(const local of locais){
        const cpf=soDigitos(String(local.cpfCnpj||local.cpf||""));
        if(!uuidValido(local.id)||!local.nome?.trim()||cpf.length!==11){ignorados++;continue;}
        const {data:existente,error:erroBusca}=await (supabase as any).from("tutores").select("id").eq("clinica_id",clinicaId).eq("cpf_digitos",cpf).maybeSingle();
        if(erroBusca)throw erroBusca;
        let id=existente?.id as string|undefined;
        if(!id){
          const {data,error}=await (supabase as any).from("tutores").insert({
            id:local.id,clinica_id:clinicaId,nome:local.nome.trim(),cpf,telefone:local.telefone||null,email:local.email||null,
            dados:{...local,origem_importacao:"localStorage",origem_local_id:local.id},
          }).select("id").single();
          if(error)throw error;
          id=data.id;
        } else {
          const {error}=await (supabase as any).from("tutores").update({
            nome:local.nome.trim(),telefone:local.telefone||null,email:local.email||null,
            dados:{...local,origem_importacao:"localStorage",origem_local_id:local.id},updated_at:new Date().toISOString(),
          }).eq("id",id).eq("clinica_id",clinicaId);
          if(error)throw error;
        }
        mapaTutor.set(String(local.id),id!);
        tutoresSincronizados++;
      }

      for(const animal of animaisImportaveis){
        const tutorId=mapaTutor.get(String(animal.tutorId||animal.tutor_id||""));
        if(!tutorId){ignorados++;continue;}
        const peso=Number(String(animal.peso||"").replace(",","."));
        const {error}=await (supabase as any).from("oricse_animais").upsert({
          id:animal.id,clinica_id:clinicaId,tutor_id:tutorId,nome:String(animal.nome||"").trim(),
          especie:String(animal.especie||""),raca:String(animal.raca||""),sexo:String(animal.sexo||""),
          nascimento:animal.nascimento||null,peso_kg:Number.isFinite(peso)&&peso>0?peso:null,foto_url:animal.foto_url||null,
          dados:{...animal,origem_importacao:"localStorage",origem_local_id:animal.id},updated_at:new Date().toISOString(),
        },{onConflict:"id"});
        if(error)throw error;
        mapaAnimal.set(String(animal.id),String(animal.id));
        animaisSincronizados++;
      }

      for(const comanda of comandasImportaveis){
        const tutorId=mapaTutor.get(comanda.tutorId);
        const animalId=mapaAnimal.get(comanda.animalId);
        if(!tutorId||!animalId){ignorados++;continue;}
        const {error}=await (supabase as any).from("oricse_portal_comandas").upsert({
          id:comanda.id,clinica_id:clinicaId,tutor_id:tutorId,animal_id:animalId,numero:comanda.numero,status:comanda.status,
          origem:comanda.origem,aberta_em:comanda.abertaEm,finalizada_em:comanda.finalizadaEm||null,itens:comanda.itens,pagamentos:comanda.pagamentos,
          total:totalComanda(comanda),total_pago:totalPagoComanda(comanda),saldo:saldoComanda(comanda),visivel_tutor:true,updated_at:new Date().toISOString(),
        },{onConflict:"id"});
        if(error)throw error;
        comandasSincronizadas++;
      }

      toast.success(`${tutoresSincronizados} tutor(es), ${animaisSincronizados} animal(is) e ${comandasSincronizadas} comanda(s) sincronizados.${ignorados?` ${ignorados} registro(s) incompatível(is) ignorado(s).`:""}`);
      await carregar();
    }catch(error){toast.error(error instanceof Error?error.message:"Não foi possível sincronizar os dados locais.");}
    finally{setSincronizando(false);}
  }

  async function emitirConvite(){
    if(!tutorSelecionado||!usuario.trim())return;
    setEmitindo(true);setConvite(null);
    try{
      const {data,error}=await (supabase as any).rpc("oricse_portal_emitir_convite",{p_tutor_id:tutorSelecionado.id,p_usuario:usuario});
      if(error)throw error;
      const item=data?.[0];if(!item?.token)throw new Error("O convite não foi gerado.");
      const link=`${window.location.origin}/pet/${encodeURIComponent(item.clinica_slug)}/portal#ativar=${encodeURIComponent(item.token)}&usuario=${encodeURIComponent(item.usuario)}`;
      setConvite({...item,link});
      toast.success("Convite criado. Ele expira em 48 horas e só pode ser usado uma vez.");
    }catch(error){toast.error(error instanceof Error?error.message:"Não foi possível gerar o convite.");}
    finally{setEmitindo(false);}
  }

  async function copiar(texto:string,mensagem:string){try{await navigator.clipboard.writeText(texto);toast.success(mensagem);}catch{toast.error("Não foi possível copiar automaticamente.");}}

  if(carregandoPermissao||carregando)return <main className="mx-auto max-w-6xl px-5 py-10 text-sm text-muted-foreground">Carregando portal dos tutores...</main>;
  if(!pode("portal_tutor.gerenciar"))return <main className="mx-auto max-w-xl px-5 py-12 text-center"><ShieldCheck className="mx-auto text-muted-foreground"/><h1 className="mt-3 text-2xl font-bold">Portal não disponível</h1><p className="mt-2 text-sm text-muted-foreground">Seu usuário ou o plano desta clínica não permite gerenciar o Portal do Tutor.</p><Link to="/inicio" className="mt-5 inline-block font-semibold text-primary">Voltar ao início</Link></main>;

  const temDadosLocais=locais.length>0||animaisLocais.length>0||comandasLocais.length>0;
  return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><Link to="/tutores" className="text-sm font-semibold text-muted-foreground hover:text-primary">← Tutores</Link><h1 className="mt-3 text-3xl font-black tracking-tight">Portal do Tutor</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Ative acessos reais para os tutores desta clínica. Cada login só enxerga os próprios animais e dados liberados.</p></div>{slug&&<a href={`/pet/${slug}/portal`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-bold"><ExternalLink size={16}/> Abrir portal</a>}</div>

    {temDadosLocais&&<section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><Upload className="mt-0.5 text-amber-800"/><div className="flex-1"><h2 className="font-black text-amber-950">Sincronização dos dados deste navegador</h2><p className="mt-1 text-sm text-amber-900">Localizei {locais.length} tutor(es), {animaisLocais.length} animal(is) e {comandasLocais.length} comanda(s). A sincronização só ocorre após sua confirmação e sempre para a clínica atual.</p><p className="mt-1 text-xs text-amber-800">Compatíveis agora: {locaisValidos.length} tutor(es), {animaisImportaveis.length} animal(is) e {comandasImportaveis.length} comanda(s).</p><button disabled={sincronizando||!locaisValidos.length} onClick={sincronizarDadosLocais} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-900 px-4 text-sm font-bold text-white disabled:opacity-40">{sincronizando?<RefreshCw size={16} className="animate-spin"/>:<Upload size={16}/>} Sincronizar para esta clínica</button></div></div></section>}

    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-2xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Users size={19}/><h2 className="text-lg font-black">Tutores cadastrados</h2></div><p className="mt-1 text-xs text-muted-foreground">Selecione um tutor para criar ou consultar o acesso.</p></div><button onClick={()=>void carregar()} className="rounded-lg border p-2 text-muted-foreground" aria-label="Atualizar"><RefreshCw size={16}/></button></div><div className="mt-4 space-y-2">{tutores.length?tutores.map(t=>{const portal=portalPorTutor.get(t.id);return <button key={t.id} onClick={()=>setSelecionado(t.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selecionado===t.id?"border-primary bg-primary/5":"hover:bg-secondary/40"}`}><span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"><PawPrint size={17}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{t.nome}</strong><span className="block text-xs text-muted-foreground">{t.codigo_publico} · {t.telefone||"Sem telefone"}</span></span>{portal?<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-800"><CheckCircle2 size={12}/> Ativo</span>:<span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-black uppercase text-muted-foreground">Sem acesso</span>}</button>}):<p className="rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">Nenhum tutor cadastrado no banco desta clínica.</p>}</div></section>

      <aside className="self-start rounded-2xl border bg-card p-5 shadow-sm">{!tutorSelecionado?<div className="py-8 text-center"><KeyRound className="mx-auto text-muted-foreground"/><h2 className="mt-3 font-black">Selecione um tutor</h2><p className="mt-1 text-sm text-muted-foreground">O acesso é criado individualmente.</p></div>:portalPorTutor.get(tutorSelecionado.id)?<div><div className="flex items-center gap-2 text-emerald-700"><CheckCircle2/><h2 className="text-lg font-black">Acesso ativo</h2></div><p className="mt-3 font-bold">{tutorSelecionado.nome}</p><p className="mt-1 text-sm text-muted-foreground">Usuário: <strong>{portalPorTutor.get(tutorSelecionado.id)?.usuario}</strong></p>{portalPorTutor.get(tutorSelecionado.id)?.ultimo_acesso_em&&<p className="mt-1 text-xs text-muted-foreground">Último acesso: {new Date(portalPorTutor.get(tutorSelecionado.id)!.ultimo_acesso_em!).toLocaleString("pt-BR")}</p>}<p className="mt-4 rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">A senha nunca fica visível para a clínica. O tutor usa a senha criada na ativação.</p></div>:<div><div className="flex items-center gap-2"><KeyRound/><h2 className="text-lg font-black">Criar acesso</h2></div><p className="mt-2 text-sm text-muted-foreground">Tutor: <strong>{tutorSelecionado.nome}</strong></p><label className="mt-4 block text-sm font-bold">Usuário do portal<input value={usuario} onChange={e=>setUsuario(e.target.value)} placeholder="@tut.nome" className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"/></label><button disabled={emitindo||!usuario.trim()} onClick={emitirConvite} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-40">{emitindo?<RefreshCw size={16} className="animate-spin"/>:<KeyRound size={16}/>} Gerar convite de ativação</button>{convite&&<div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><p className="text-sm font-black">Convite pronto</p><p className="mt-1 text-xs">Expira em {new Date(convite.expira_em).toLocaleString("pt-BR")}.</p><div className="mt-3 rounded-lg bg-white p-2 font-mono text-[10px] break-all">{convite.link}</div><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={()=>copiar(convite.link,"Link copiado.")} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-900 px-3 py-2 text-xs font-bold text-white"><Copy size={13}/> Copiar link</button><button onClick={()=>copiar(`${convite.usuario}\n${convite.token}`,"Usuário e código copiados.")} className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold"><Copy size={13}/> Copiar código</button></div></div>}</div>}</aside>
    </div>
  </main>;
}

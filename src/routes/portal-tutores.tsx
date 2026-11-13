import { PortalTutorLoginPreview } from "./pet/$slug/portal";
import { oricseStorage } from "@/lib/oricse-storage";
import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { ExternalLink, MessageCircle, PawPrint, RefreshCw, ShieldCheck, Upload, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { EditorConvitePortalTutor } from "@/components/EditorConvitePortalTutor";
import { tokenConfiguracoesClinica } from "@/lib/configuracoes-clinica-ui";
import { obterModeloConvite } from "@/lib/convite-portal-tutor.functions";
import { preencherConvite, urlPortalDoTutor, whatsappDoTutor } from "@/lib/convite-portal-tutor";
import { usePermissoes } from "@/hooks/usePermissoes";
import { type Comanda, lerComandas, saldoComanda, totalComanda, totalPagoComanda } from "@/lib/comandas";

export const Route = createFileRoute("/portal-tutores")({ component: PortalTutoresComPrevia });

function PortalTutoresComPrevia() {
  // A prévia do Canva não exige escolher clínica ou aguardar dados de tutores.
  const location = useLocation();
  const { clinicaId, carregando, pode } = usePermissoes();
  if (new URLSearchParams(location.searchStr).has("portal_login_preview")) {
    return <PortalTutorLoginPreview />;
  }
  if (carregando) return <main className="mx-auto max-w-6xl px-5 py-10 text-sm text-muted-foreground">Carregando Portal do Tutor…</main>;
  if (!clinicaId || !pode("portal_tutor.gerenciar")) {
    return <main className="mx-auto max-w-xl px-5 py-12 text-center"><ShieldCheck className="mx-auto text-muted-foreground" /><h1 className="mt-3 text-2xl font-bold">Portal não disponível</h1><p className="mt-2 text-sm text-muted-foreground">Selecione uma clínica com acesso à gestão do Portal do Tutor.</p><Link to="/inicio" className="mt-5 inline-block font-semibold text-primary">Voltar ao início</Link></main>;
  }
  return <PortalTutores key={clinicaId} clinicaId={clinicaId} tutorIdInicial={new URLSearchParams(location.searchStr).get("tutorId") || ""} />;
}

type TutorDb = { id: string; codigo_publico: string; nome: string; telefone: string | null; email: string | null };
type AnimalDb = { id: string; tutor_id: string | null; nome: string };
type PortalDb = { id:string; tutor_id:string; usuario:string; ativo:boolean; auth_user_id:string|null; convite_expira_em:string|null };
type TutorLocal = { id?:string; nome?:string; telefone?:string; email?:string; cpfCnpj?:string; cpf?:string; [key:string]:unknown };
type AnimalLocal = { id?:string; tutorId?:string; tutor_id?:string; nome?:string; especie?:string; raca?:string; sexo?:string; nascimento?:string; peso?:string; foto_url?:string; [key:string]:unknown };
type Convite = { usuario: string; token: string; expira_em: string; clinica_slug: string };

function conviteValido(convite: Convite | undefined, portal: PortalDb | undefined) {
  return convite && portal?.ativo && !portal.auth_user_id &&
    Date.parse(portal.convite_expira_em || "") === Date.parse(convite.expira_em) &&
    Date.parse(convite.expira_em) > Date.now() ? convite : null;
}

function soDigitos(valor?: string) { return String(valor || "").replace(/\D/g, ""); }
function uuidValido(valor?: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(valor || "")); }
function lerLocal<T>(chave:string):T[] {
  if(typeof window==="undefined") return [];
  try { const v=JSON.parse(oricseStorage.getItem(chave)||"[]"); return Array.isArray(v)?v:[]; }
  catch { return []; }
}

async function carregarPaginas<T>(buscar: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const registros: T[] = [];
  const limite = 500;
  for (let inicio = 0; ; inicio += limite) {
    const { data, error } = await buscar(inicio, inicio + limite - 1);
    if (error) throw error;
    registros.push(...(data || []));
    if (!data || data.length < limite) return registros;
  }
}

function PortalTutores({ clinicaId, tutorIdInicial }: { clinicaId: string; tutorIdInicial: string }) {
  const [carregando,setCarregando]=useState(true);
  const [tutores,setTutores]=useState<TutorDb[]>([]);
  const [portais,setPortais]=useState<PortalDb[]>([]);
  const [slug,setSlug]=useState("");
  const [clinicaNome, setClinicaNome] = useState("");
  const [animais, setAnimais] = useState<AnimalDb[]>([]);
  const [modelo, setModelo] = useState<string | null>(null);
  const [erroModelo, setErroModelo] = useState("");
  const [erroPainel, setErroPainel] = useState("");
  const [convites, setConvites] = useState<Record<string, Convite>>({});
  const [emitindo, setEmitindo] = useState<string | null>(null);
  const [aberturaPendente, setAberturaPendente] = useState<string | null>(null);
  const [sincronizando,setSincronizando]=useState(false);
  const [locais,setLocais]=useState(()=>lerLocal<TutorLocal>("oricse-tutores-v1"));
  const [animaisLocais,setAnimaisLocais]=useState(()=>lerLocal<AnimalLocal>("oricse-animais-v1"));
  const [comandasLocais,setComandasLocais]=useState<Comanda[]>(()=>typeof window==="undefined"?[]:lerComandas());

  const carregarModelo = useCallback(async () => {
    setErroModelo("");
    try {
      const accessToken = await tokenConfiguracoesClinica();
      const resposta = await obterModeloConvite({ data: { accessToken, clinicaId } });
      setModelo(resposta.modelo);
    } catch {
      setErroModelo("Não foi possível carregar a mensagem da clínica.");
    }
  }, [clinicaId]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroPainel("");
    try {
      const [listaTutores, listaPortais, clinicaResp, listaAnimais] = await Promise.all([
        carregarPaginas<TutorDb>((inicio, fim) => supabaseBanco.from("tutores")
          .select("id,codigo_publico,nome,telefone,email").eq("clinica_id", clinicaId)
          .order("nome").order("id").range(inicio, fim)),
        carregarPaginas<PortalDb>((inicio, fim) => supabaseBanco.from("oricse_portal_tutores")
          .select("id,tutor_id,usuario,ativo,auth_user_id,convite_expira_em")
          .eq("clinica_id", clinicaId).order("id").range(inicio, fim)),
        supabaseBanco.from("clinicas").select("nome,slug").eq("id", clinicaId).single(),
        carregarPaginas<AnimalDb>((inicio, fim) => supabaseBanco.from("oricse_animais")
          .select("id,tutor_id,nome").eq("clinica_id", clinicaId).not("tutor_id", "is", null)
          .order("nome").order("id").range(inicio, fim)),
      ]);
      if (clinicaResp.error) throw clinicaResp.error;
      setTutores(listaTutores);
      setPortais(listaPortais);
      setAnimais(listaAnimais);
      setSlug(clinicaResp.data.slug || "");
      setClinicaNome(clinicaResp.data.nome);
    } catch {
      setErroPainel("Não foi possível carregar os tutores e animais desta clínica.");
    } finally {
      setCarregando(false);
    }
  }, [clinicaId]);

  useEffect(() => { void carregar(); void carregarModelo(); }, [carregar, carregarModelo]);
  useEffect(()=>{
    if(typeof window==="undefined") return;
    const atualizar=()=>{ setLocais(lerLocal("oricse-tutores-v1")); setAnimaisLocais(lerLocal("oricse-animais-v1")); setComandasLocais(lerComandas()); };
    window.addEventListener("storage",atualizar);
    window.addEventListener("oricse-comandas-atualizadas",atualizar);
    return()=>{window.removeEventListener("storage",atualizar);window.removeEventListener("oricse-comandas-atualizadas",atualizar);};
  },[]);

  const portalPorTutor=useMemo(()=>new Map(portais.map(p=>[p.tutor_id,p])),[portais]);
  const animaisPorTutor = useMemo(() => {
    const mapa = new Map<string, AnimalDb[]>();
    for (const animal of animais) {
      if (!animal.tutor_id) continue;
      const lista = mapa.get(animal.tutor_id) || [];
      lista.push(animal);
      mapa.set(animal.tutor_id, lista);
    }
    return mapa;
  }, [animais]);
  function linkConvite(tutor: TutorDb, convite: Convite, texto: string) {
    return whatsappDoTutor(tutor.telefone, preencherConvite(texto, {
      nome_tutor: tutor.nome,
      nome_clinica: clinicaNome,
      link_portal: urlPortalDoTutor(convite.clinica_slug),
      usuario_tutor: convite.usuario,
      codigo_ativacao: convite.token,
    }));
  }

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

  async function enviarConvite(tutor: TutorDb, portal: PortalDb) {
    if (emitindo || !modelo || !slug || portal.auth_user_id || !whatsappDoTutor(tutor.telefone, "")) return;
    const aba = window.open("about:blank", "_blank");
    if (aba) {
      aba.opener = null;
      const referrer = aba.document.createElement("meta");
      referrer.name = "referrer";
      referrer.content = "no-referrer";
      aba.document.head.append(referrer);
      aba.document.body.textContent = "Abrindo WhatsApp…";
    }
    setEmitindo(tutor.id);
    setAberturaPendente(null);
    try {
      let convite = conviteValido(convites[tutor.id], portal);
      if (!convite) {
        const { data, error } = await supabaseBanco.rpc("oricse_portal_emitir_convite", {
          p_tutor_id: tutor.id, p_usuario: portal.usuario,
        });
        if (error) throw error;
        const item = data?.[0];
        if (!item?.token) throw new Error("O convite não foi gerado.");
        convite = item;
        setConvites((atuais) => ({ ...atuais, [tutor.id]: item }));
        setPortais((atuais) => atuais.map((acesso) => acesso.tutor_id === tutor.id
          ? { ...acesso, ativo: true, usuario: item.usuario, convite_expira_em: item.expira_em }
          : acesso));
      }
      const url = linkConvite(tutor, convite, modelo);
      if (!url) throw new Error("Cadastre um telefone válido para abrir o WhatsApp.");
      if (aba && !aba.closed) aba.location.replace(url);
      else setAberturaPendente(tutor.id);
    } catch (error) {
      aba?.close();
      toast.error(typeof error === "object" && error && "message" in error
        ? String(error.message) : "Não foi possível preparar o convite.");
    } finally {
      setEmitindo(null);
    }
  }

  if (carregando && !slug) return <main className="mx-auto max-w-6xl px-5 py-10 text-sm text-muted-foreground">Carregando Portal do Tutor…</main>;

  const temDadosLocais=locaisValidos.length>0;
  return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><Link to="/tutores" className="text-sm font-semibold text-muted-foreground hover:text-primary">← Tutores</Link><h1 className="mt-3 text-3xl font-black tracking-tight">Acesso ao Portal do Tutor</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Gerencie os acessos e convites dos tutores desta clínica.</p></div>{slug&&<a href={urlPortalDoTutor(slug)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-bold"><ExternalLink size={16}/> Abrir portal</a>}</div>

    {modelo && slug && <EditorConvitePortalTutor clinicaId={clinicaId} clinicaNome={clinicaNome} slug={slug} salvo={modelo} aoSalvar={setModelo} />}
    {erroModelo && <div role="alert" className="mt-5 rounded-xl border bg-card p-4 text-sm">
      {erroModelo} <button type="button" className="ml-2 font-semibold text-primary" onClick={() => void carregarModelo()}>Tentar novamente</button>
    </div>}
    {erroPainel && <p role="alert" className="mt-5 rounded-xl border bg-card p-4 text-sm">{erroPainel} <button type="button" className="ml-2 font-semibold text-primary" onClick={() => void carregar()}>Tentar novamente</button></p>}
    {temDadosLocais&&<section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><Upload className="mt-0.5 text-amber-800"/><div className="flex-1"><h2 className="font-black text-amber-950">Sincronização dos dados deste navegador</h2><p className="mt-1 text-sm text-amber-900">Localizei {locais.length} tutor(es), {animaisLocais.length} animal(is) e {comandasLocais.length} comanda(s). A sincronização só ocorre após sua confirmação e sempre para a clínica atual.</p><p className="mt-1 text-xs text-amber-800">Compatíveis agora: {locaisValidos.length} tutor(es), {animaisImportaveis.length} animal(is) e {comandasImportaveis.length} comanda(s).</p><button disabled={sincronizando||!locaisValidos.length} onClick={sincronizarDadosLocais} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-900 px-4 text-sm font-bold text-white disabled:opacity-40">{sincronizando?<RefreshCw size={16} className="animate-spin"/>:<Upload size={16}/>} Sincronizar para esta clínica</button></div></div></section>}

    <section className="mt-6 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black"><Users size={19} /> Tutores cadastrados</h2>
        <button type="button" onClick={() => void carregar()} disabled={carregando || Boolean(emitindo)}
          className="rounded-lg border p-2 text-muted-foreground" aria-label="Atualizar tutores">
          <RefreshCw size={16} className={carregando ? "animate-spin" : ""} />
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {tutores.map((tutor) => {
          const portal = portalPorTutor.get(tutor.id);
          const vinculados = animaisPorTutor.get(tutor.id) || [];
          const ativo = Boolean(portal?.ativo && portal.auth_user_id);
          const convite = conviteValido(convites[tutor.id], portal);
          const temTelefone = Boolean(whatsappDoTutor(tutor.telefone, ""));
          const urlPendente = aberturaPendente === tutor.id && convite && modelo
            ? linkConvite(tutor, convite, modelo) : null;
          const impedimento = portal?.auth_user_id ? (ativo ? "Acesso já ativado" : "Acesso inativo")
            : !portal ? "Usuário do portal indisponível"
            : !temTelefone ? "Telefone indisponível"
            : !slug ? "Endereço do portal indisponível"
            : !modelo ? "Mensagem do convite indisponível" : "";
          return (
            <li key={tutor.id} className={`grid gap-3 rounded-xl border p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${tutor.id === tutorIdInicial ? "border-primary bg-primary/5" : ""}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="break-words text-sm font-bold">{tutor.nome}</h3>
                  <span className="text-xs text-muted-foreground">Código no sistema <strong>{tutor.codigo_publico || "—"}</strong></span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${ativo ? "bg-emerald-100 text-emerald-800" : "bg-secondary text-muted-foreground"}`}>
                    {ativo ? "Ativo" : portal?.auth_user_id ? "Inativo" : "Primeiro acesso"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <PawPrint size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  {vinculados.length ? vinculados.map((animal) => (
                    <span key={animal.id} className="break-words rounded-md border px-2 py-0.5 text-xs">{animal.nome}</span>
                  )) : <span className="text-xs text-muted-foreground">Sem animais vinculados</span>}
                </div>
                <div className="mt-3 grid gap-x-8 gap-y-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs">
                    <div className="min-w-0"><dt className="text-muted-foreground">Telefone</dt><dd className="font-medium">{tutor.telefone || "—"}</dd></div>
                    <div className="min-w-0"><dt className="text-muted-foreground">E-mail</dt><dd className="break-all font-medium">{tutor.email || "—"}</dd></div>
                  </dl>
                  <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs">
                    <div className="min-w-0"><dt className="text-muted-foreground">@ do portal</dt><dd className="break-all font-medium">{portal?.usuario || "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Código de ativação</dt><dd className="font-medium">{convite?.token || (portal?.auth_user_id ? "Já utilizado" : "Gerado ao convidar")}</dd></div>
                  </dl>
                </div>
              </div>
              <div className="flex flex-col items-start gap-1 md:items-end">
                {urlPendente ? (
                  <a href={urlPendente} target="_blank" rel="noreferrer" onClick={(e) => {
                    if (conviteValido(convites[tutor.id], portal)) return;
                    e.preventDefault();
                    setAberturaPendente(null);
                    toast.error("O código expirou. Clique em Enviar convite novamente.");
                  }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
                    <MessageCircle size={16} /> Abrir WhatsApp
                  </a>
                ) : (
                  <button type="button" disabled={Boolean(impedimento || emitindo || carregando)}
                    onClick={() => { if (portal) void enviarConvite(tutor, portal); }}
                    className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    {emitindo === tutor.id ? <RefreshCw size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                    {emitindo === tutor.id ? "Preparando…" : "Enviar convite"}
                  </button>
                )}
                {impedimento && <span className="text-xs text-muted-foreground">{impedimento}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {!tutores.length && !erroPainel && <p className="mt-4 rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">Nenhum tutor cadastrado nesta clínica.</p>}
    </section>
    <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Conteúdos do Portal do Tutor</p>
          <h2 className="mt-2 text-xl font-black">Documentos e cuidados de cada animal</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Receitas, exames, laudos, atestados, cartões de vacinação, vermífugos e outros documentos são vinculados ao animal na ficha da clínica. Cada registro possui controle individual de liberação para o tutor, e os PDFs ficam disponíveis quando anexados.</p>
        </div>
        <Link to="/animais" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Gerenciar por animal <ExternalLink size={16}/></Link>
      </div>
      <p className="mt-4 rounded-xl bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">Cada clínica administra exclusivamente seus registros. Conteúdos internos não são exibidos ao tutor sem liberação.</p>
    </section>
  </main>;
}

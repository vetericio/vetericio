import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseBanco } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PortalClinicContact, type CanaisClinica } from "@/components/PortalClinicContact";
export const Route = createFileRoute("/configurar-portal-tutor")({
  component: ConfigurarPortalTutor,
});
type Config = {
  mensagem_boas_vindas: string;
  telefone_publico: string;
  whatsapp_publico: string;
  instrucoes_agendamento: string;
  exibir_agendamento: boolean;
  exibir_documentos: boolean;
};
type Extra = {
  banner_titulo: string;
  banner_subtitulo: string;
  banner_link: string;
  destaque_servico: string;
  chamada_promocional: string;
  horario_atendimento: string;
  endereco_publico: string;
  instagram: string;
  facebook: string;
  politica_cancelamento: string;
  aviso_importante: string;
  cor_destaque: string;
  mostrar_promocoes: boolean;
  mostrar_banner: boolean;
  mostrar_whatsapp: boolean;
  mostrar_contato: boolean;
  mostrar_horarios: boolean;
  mostrar_avisos: boolean;
  mostrar_instagram: boolean;
  mostrar_servico: boolean;
};
const extrasIniciais: Extra = {
  banner_titulo: "Cuidando de quem você ama",
  banner_subtitulo: "Conheça nossos serviços",
  banner_link: "",
  destaque_servico: "",
  chamada_promocional: "",
  horario_atendimento: "",
  endereco_publico: "",
  instagram: "",
  facebook: "",
  politica_cancelamento: "",
  aviso_importante: "",
  cor_destaque: "#257a70",
  mostrar_promocoes: true,
  mostrar_banner: true,
  mostrar_whatsapp: true,
  mostrar_contato: true,
  mostrar_horarios: true,
  mostrar_avisos: true,
  mostrar_instagram: true,
  mostrar_servico: true,
};
type AgendaPortal = { id: string; nome: string; portal_ativo: boolean };
type Promo = {
  id?: string;
  titulo: string;
  descricao: string;
  cupom: string;
  desconto_percentual: number;
  inicio: string;
  fim: string;
  ativo: boolean;
};
const promoVazia: Promo = {
  titulo: "",
  descricao: "",
  cupom: "",
  desconto_percentual: 0,
  inicio: "",
  fim: "",
  ativo: false,
};
const inicial: Config = {
  mensagem_boas_vindas: "Bem-vindo ao Portal do Tutor!",
  telefone_publico: "",
  whatsapp_publico: "",
  instrucoes_agendamento: "",
  exibir_agendamento: true,
  exibir_documentos: true,
};
function ConfigurarPortalTutor() {
  const [marcaAdmin, setMarcaAdmin] = useState(false);
  const [canais, setCanais] = useState<CanaisClinica>({});
  const [salvandoCanais, setSalvandoCanais] = useState(false);
  const [salvandoMarca, setSalvandoMarca] = useState(false);
  const [marca, setMarca] = useState({nome_exibicao:"",logo_clinica_url:"",logo_cabecalho_url:"",titulo_cabecalho:"PORTAL DO TUTOR",subtitulo_cabecalho:"Acompanhe seus pets, agende serviços e acesse documentos em um só lugar."});
  const [extras, setExtras] = useState<Extra>(extrasIniciais),
    [agendas, setAgendas] = useState<AgendaPortal[]>([]),
    [promos, setPromos] = useState<Promo[]>([]),
    [promo, setPromo] = useState<Promo>(promoVazia),
    [salvandoExtra, setSalvandoExtra] = useState(false);
  const [slug, setSlug] = useState(""),
    [clinica, setClinica] = useState(""),
    [nome, setNome] = useState(""),
    [config, setConfig] = useState<Config>(inicial),
    [busy, setBusy] = useState(true),
    [saving, setSaving] = useState(false),
    [erro, setErro] = useState("");
  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabaseBanco.auth.getUser();
        if (!user) throw Error("Faça login.");
        const { data: contexto, error: contextoError } = await supabaseBanco.rpc(
          "oricse_contexto_clinica_atual",
        );
        const clinicaAtiva = contexto?.[0];
        if (contextoError || !clinicaAtiva?.clinica_id) throw Error("Clínica ativa não encontrada.");
        setClinica(clinicaAtiva.clinica_id);
        // A RPC valida permissões no servidor. Apenas admins recebem acesso.
        const marcaResposta=await (supabaseBanco as any).rpc("oricse_portal_marca_admin",{p_clinica_id:clinicaAtiva.clinica_id});
        if(!marcaResposta.error){setMarcaAdmin(true);setMarca(m=>({...m,...marcaResposta.data}));}
        if(!marcaResposta.error){const contatos=await (supabaseBanco as any).rpc("oricse_portal_contatos_admin",{p_clinica_id:clinicaAtiva.clinica_id});if(!contatos.error)setCanais(contatos.data||{});}

        const [c, r] = await Promise.all([
          supabaseBanco
            .from("clinicas")
            .select("nome,slug")
            .eq("id", clinicaAtiva.clinica_id)
            .maybeSingle(),
          (supabaseBanco as any).rpc("oricse_portal_config_gerenciar", {
            p_clinica_id: clinicaAtiva.clinica_id,
          }),
        ]);
        if (r.error) throw r.error;
        setConfig({ ...inicial, ...r.data });
        const painel = await (supabaseBanco as any).rpc("oricse_portal_painel", {
          p_clinica: clinicaAtiva.clinica_id,
        });
        if (painel.error) throw painel.error;
        setExtras({ ...extrasIniciais, ...painel.data.opcoes });
        setAgendas(painel.data.agendas || []);
        setPromos(painel.data.promocoes || []);
        setNome(c.data?.nome || "Clínica");
        setSlug(c.data?.slug || "");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        setBusy(false);
      }
    })();
  }, []);
  const change = (k: keyof Config, v: string | boolean) => setConfig((s) => ({ ...s, [k]: v }));
  async function salvarMarca() {
    if(!marcaAdmin || !clinica)return;
    setSalvandoMarca(true);
    try {
      const {data,error}=await (supabaseBanco as any).rpc("oricse_portal_marca_admin",{
        p_clinica_id:clinica,p_nome:marca.nome_exibicao,
        p_logo_clinica:marca.logo_clinica_url,p_logo_cabecalho:marca.logo_cabecalho_url,
        p_titulo:marca.titulo_cabecalho,p_subtitulo:marca.subtitulo_cabecalho
      });
      if(error)throw error;
      setMarca(m=>({...m,...data}));toast.success("Identidade do Portal do Tutor salva.");
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar a identidade.");}
    finally{setSalvandoMarca(false);}
  }
  async function salvar() {
    setSaving(true);
    const { error } = await (supabaseBanco as any).rpc("oricse_portal_config_gerenciar", {
      p_clinica_id: clinica,
      p_mensagem: config.mensagem_boas_vindas,
      p_telefone: config.telefone_publico,
      p_whatsapp: config.whatsapp_publico,
      p_instrucoes: config.instrucoes_agendamento,
      p_agendamento: config.exibir_agendamento,
      p_documentos: config.exibir_documentos,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Configurações do Portal do Tutor salvas.");
  }
  async function chamarPainel(params: Record<string, unknown>) {
    const { data, error } = await (supabaseBanco as any).rpc("oricse_portal_painel", {
      p_clinica: clinica,
      ...params,
    });
    if (error) throw error;
    setAgendas(data.agendas || []);
    setPromos(data.promocoes || []);
  }
  async function salvarCanais(){
    if(!marcaAdmin||!clinica)return;
    setSalvandoCanais(true);
    try{
      const sanitizado=Object.fromEntries(Object.entries(canais).map(([k,v])=>[k,String(v||"").trim()]));
      const {data,error}=await (supabaseBanco as any).rpc("oricse_portal_contatos_admin",{p_clinica_id:clinica,p_canais:sanitizado});
      if(error)throw error;
      setCanais(data||{});toast.success("Contatos e redes sociais atualizados no portal da clínica.");
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar os canais.");}
    finally{setSalvandoCanais(false);}
  }
  async function salvarExtras() {
    setSalvandoExtra(true);
    try {
      await chamarPainel({ p_opcoes: extras });
      toast.success("Marketing e apresentação salvos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvandoExtra(false);
    }
  }
  async function alternarAgenda(a: AgendaPortal) {
    try {
      await chamarPainel({ p_agenda_id: a.id, p_agenda_ativa: !a.portal_ativo });
      toast.success("Visibilidade da agenda atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar a agenda");
    }
  }
  async function criarPromo() {
    if (promo.inicio && promo.fim && promo.fim < promo.inicio) {
      toast.error("A data final deve ser igual ou posterior à inicial.");
      return;
    }
    try {
      await chamarPainel({ p_promocao: promo });
      setPromo(promoVazia);
      toast.success("Promoção cadastrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cadastrar promoção");
    }
  }
  async function mudarPublicacaoPromo(p: { id?: string; ativo: boolean; titulo: string }) {
    if (!p.id) {
      toast.error("Promoção sem identificador");
      return;
    }
    const { error } = await (supabaseBanco as any).rpc("oricse_portal_promocao_publicar", {
      p_clinica: clinica,
      p_promocao: p.id,
      p_publicar: !p.ativo,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await chamarPainel({});
    toast.success(p.ativo ? "Promoção pausada." : "Promoção publicada.");
  }
  const extrasCampos: [keyof Extra, string][] = [
    ["banner_titulo", "Título do banner"],
    ["banner_subtitulo", "Subtítulo do banner"],
    ["banner_link", "Link do banner (https://)"],
    ["destaque_servico", "Serviço em destaque"],
    ["chamada_promocional", "Chamada de marketing"],
    ["horario_atendimento", "Horário de atendimento"],
    ["endereco_publico", "Endereço para o tutor"],
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["politica_cancelamento", "Política de cancelamento"],
    ["aviso_importante", "Aviso importante"],
    ["cor_destaque", "Cor de destaque (hexadecimal)"],
  ];
  const extrasFlags: [keyof Extra, string][] = [
    ["mostrar_promocoes", "Exibir promoções"],
    ["mostrar_banner", "Exibir banner"],
    ["mostrar_whatsapp", "Exibir WhatsApp"],
    ["mostrar_contato", "Exibir telefone"],
    ["mostrar_horarios", "Exibir horários"],
    ["mostrar_avisos", "Exibir avisos"],
    ["mostrar_instagram", "Exibir Instagram"],
    ["mostrar_servico", "Exibir serviço em destaque"],
  ];
  const fields: [keyof Config, string, number][] = [
    ["mensagem_boas_vindas", "Mensagem de boas-vindas", 500],
    ["telefone_publico", "Telefone da clínica", 40],
    ["whatsapp_publico", "WhatsApp de atendimento", 40],
    ["instrucoes_agendamento", "Orientações para agendamento", 1000],
  ];
  if (!busy && !erro) {
    return (
      <main className="mx-auto max-w-3xl p-6 sm:p-10 text-foreground">
        <Link to="/perfil-clinica" className="text-sm font-semibold text-primary">← Administração da clínica</Link>
        <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold">Portal do Tutor protegido</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            A configuração do Portal do Tutor está bloqueada para evitar alterações acidentais.
            O acesso dos tutores e os dados já publicados continuam disponíveis.
          </p>
          {slug && <Link to="/pet/$slug/portal" params={{slug}} target="_blank" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Abrir portal oficial ↗</Link>}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-5 text-foreground">
      <header className="space-y-3">
        <Link to="/perfil-clinica" className="text-sm font-semibold text-primary">← Administração da clínica</Link>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Administração / Clínica</p>
        <h1 className="text-3xl font-extrabold">Portal do Tutor</h1>
        <p className="text-sm text-muted-foreground">Central de configuração do portal oficial de <strong>{nome||"sua clínica"}</strong>. Todas as personalizações ficam vinculadas à clínica selecionada. Apenas administradores alteram nome e logos.</p>
        <div className="flex flex-wrap gap-2">
          {slug&&<Link to="/pet/$slug/portal" params={{slug}} target="_blank" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Abrir portal oficial da clínica ↗</Link>}
          <Link to="/demo-portal-tutor" target="_blank" className="inline-flex min-h-11 items-center rounded-xl border bg-card px-4 text-sm font-semibold">Visualizar demonstração ORICSE ↗</Link>
        </div>
        <p className="text-xs text-muted-foreground">A demonstração mantém dados fictícios e não recebe as personalizações das clínicas.</p>
      </header>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="font-bold">O que você pode configurar</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a href="#identidade-portal" className="rounded-xl border p-3 text-sm font-semibold hover:bg-secondary">Identidade, logo e cabeçalho</a>
          <a href="#conteudo-portal" className="rounded-xl border p-3 text-sm font-semibold hover:bg-secondary">Contatos, boas-vindas e seções</a>
          <a href="#agendas-portal" className="rounded-xl border p-3 text-sm font-semibold hover:bg-secondary">Agendas e horários publicados</a>
          <a href="#marketing-portal" className="rounded-xl border p-3 text-sm font-semibold hover:bg-secondary">Marketing, banners e promoções</a>
          <a href="#contatos-portal" className="rounded-xl border p-3 text-sm font-semibold hover:bg-secondary">Fale com a Clínica · redes sociais</a>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link to="/configurar-agenda-online" className="rounded-xl border p-3 text-sm font-semibold hover:bg-secondary">Profissionais, disponibilidade e regras de pagamento ↗</Link>
          <Link to="/precos-portal" className="rounded-xl border p-3 text-sm font-semibold hover:bg-secondary">Serviços, preços e cobranças ↗</Link>
          <Link to="/portal-tutores" className="rounded-xl border p-3 text-sm font-semibold hover:bg-secondary">Tutores, convites e acessos ↗</Link>
          <Link to="/configuracao-site" className="rounded-xl border p-3 text-sm font-semibold hover:bg-secondary">Outras configurações do portal ↗</Link>
        </div>
      </section>
      {!busy&&!erro&&marcaAdmin&&<section id="identidade-portal" className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-bold">Identidade do Portal do Tutor</h2>
        <p className="text-sm text-muted-foreground">Somente administradores podem alterar o nome e a logo da clínica e a identidade visual do cabeçalho.</p>
        {([["nome_exibicao","Nome exibido da clínica"],["logo_clinica_url","URL HTTPS da logo da clínica"],["logo_cabecalho_url","URL HTTPS da logo do topo (deixe vazio para usar ORICSE)"],["titulo_cabecalho","Título do topo"],["subtitulo_cabecalho","Frase abaixo do título"]] as const).map(([key,label])=><label key={key} className="block text-sm font-semibold">{label}<input className="mt-1 w-full rounded-xl border bg-background p-3 font-normal" value={marca[key]||""} onChange={e=>setMarca(m=>({...m,[key]:e.target.value}))} maxLength={key.includes("url")?1000:key==="subtitulo_cabecalho"?300:160}/></label>)}
        <div className="flex items-center gap-3 rounded-xl bg-secondary/30 p-3">{marca.logo_clinica_url&&<img src={marca.logo_clinica_url} alt="Prévia da logo" className="h-14 w-14 rounded-lg object-contain"/>}<strong>{marca.nome_exibicao||nome}</strong></div>
        <button disabled={salvandoMarca} onClick={()=>void salvarMarca()} className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50">{salvandoMarca?"Salvando…":"Salvar identidade do portal"}</button>
      </section>}
      {!busy&&!erro&&marcaAdmin&&<section id="contatos-portal" className="space-y-4 rounded-2xl border bg-card p-5">
        <div><h2 className="text-lg font-bold">Fale com a Clínica</h2><p className="text-sm text-muted-foreground">Somente o administrador altera os canais publicados no Portal do Tutor. O WhatsApp fica em destaque; campos vazios ficam ocultos para o tutor.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
         {([
          ["whatsapp","WhatsApp (com DDD)"],["instagram","Instagram — URL HTTPS"],["facebook","Facebook — URL HTTPS"],
          ["x","X / Twitter — URL HTTPS"],["tiktok","TikTok — URL HTTPS"],["youtube","YouTube — URL HTTPS"],
          ["linkedin","LinkedIn — URL HTTPS"],["site","Site oficial — URL HTTPS"],["email","E-mail"],
          ["telefone","Telefone"],["endereco","Endereço"],["horario","Horário de atendimento"]
         ] as Array<[keyof CanaisClinica,string]>).map(([k,rotulo])=><label key={k} className="text-sm font-semibold">{rotulo}<input className="mt-1 w-full rounded-xl border bg-background p-3 font-normal" maxLength={400} value={canais[k]||""} onChange={e=>setCanais(v=>({...v,[k]:e.target.value}))} placeholder={["instagram","facebook","x","tiktok","youtube","linkedin","site"].includes(k)?"https://":undefined}/></label>)}
        </div>
        <button disabled={salvandoCanais} type="button" onClick={()=>void salvarCanais()} className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50">{salvandoCanais?"Salvando…":"Salvar canais de contato"}</button>
        <div><h3 className="mb-3 font-bold">Prévia do tutor</h3><PortalClinicContact canais={canais} demonstracao/></div>
      </section>}
      {busy ? (
        <p>Carregando configurações…</p>
      ) : erro ? (
        <p role="alert" className="rounded-lg border p-4 text-destructive">
          {erro}
        </p>
      ) : (
        <section id="conteudo-portal" className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-bold">Informações e recursos do tutor</h2>
          {fields.map(([key, label, max]) => (
            <label key={key} className="block text-sm font-semibold">
              {label}
              {key === "mensagem_boas_vindas" || key === "instrucoes_agendamento" ? (
                <textarea
                  maxLength={max}
                  rows={2}
                  value={String(config[key])}
                  onChange={(e) => change(key, e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground"
                />
              ) : (
                <input
                  maxLength={max}
                  value={String(config[key])}
                  onChange={(e) => change(key, e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground"
                />
              )}
            </label>
          ))}
          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              checked={config.exibir_agendamento}
              onChange={(e) => change("exibir_agendamento", e.target.checked)}
            />{" "}
            Mostrar acesso à agenda no Portal do Tutor
          </label>
          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              checked={config.exibir_documentos}
              onChange={(e) => change("exibir_documentos", e.target.checked)}
            />{" "}
            Mostrar seção de documentos no Portal do Tutor
          </label>
          <p className="text-xs text-muted-foreground">
            As agendas e formas de pagamento são configuradas separadamente. Ocultar um acesso não
            apaga registros existentes.
          </p>
          <button
            disabled={saving}
            onClick={() => void salvar()}
            className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar Portal do Tutor"}
          </button>
        </section>
      )}
      <section id="agendas-portal" className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="text-lg font-bold">Agendas publicadas para o tutor</h2>
        <p className="text-sm text-muted-foreground">
          Escolha individualmente quais agendas estão disponíveis no portal. Desligar não exclui
          agendamentos.
        </p>
        {agendas.map((a) => (
          <label
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-xl border p-3"
          >
            <strong>{a.nome}</strong>
            <span className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={a.portal_ativo}
                onChange={() => void alternarAgenda(a)}
              />
              {a.portal_ativo ? "Visível" : "Oculta"}
            </span>
          </label>
        ))}
        {!agendas.length && (
          <p className="text-sm text-muted-foreground">Nenhuma agenda cadastrada.</p>
        )}
      </section>
      <section id="marketing-portal" className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="text-lg font-bold">Marketing e apresentação do Portal do Tutor</h2>
        <p className="text-sm text-muted-foreground">
          Textos de destaque, redes sociais, avisos e comunicação da clínica.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {extrasCampos.map(([key, label]) => (
            <label className="text-sm font-semibold" key={key}>
              {label}
              <input
                maxLength={
                  key === "aviso_importante" || key === "politica_cancelamento" ? 500 : 180
                }
                className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground"
                value={String(extras[key])}
                onChange={(e) => setExtras((v) => ({ ...v, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <h3 className="font-bold">Elementos visíveis</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {extrasFlags.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(extras[key])}
                onChange={(e) => setExtras((v) => ({ ...v, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
        <button
          disabled={salvandoExtra}
          onClick={() => void salvarExtras()}
          className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          Salvar marketing e apresentação
        </button>
      </section>
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="text-lg font-bold">Campanhas e promoções</h2>
        <p className="text-sm text-muted-foreground">
          Crie promoções para divulgação no portal. Cupons ficam apenas informativos até a
          integração com o checkout.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Título
            <input
              className="mt-1 w-full rounded-lg border bg-background p-3"
              value={promo.titulo}
              onChange={(e) => setPromo((p) => ({ ...p, titulo: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Cupom
            <input
              className="mt-1 w-full rounded-lg border bg-background p-3"
              value={promo.cupom}
              onChange={(e) => setPromo((p) => ({ ...p, cupom: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Desconto (%)
            <input
              type="number"
              min="0"
              max="100"
              className="mt-1 w-full rounded-lg border bg-background p-3"
              value={promo.desconto_percentual}
              onChange={(e) =>
                setPromo((p) => ({ ...p, desconto_percentual: Number(e.target.value) }))
              }
            />
          </label>
          <label className="text-sm">
            Descrição
            <input
              className="mt-1 w-full rounded-lg border bg-background p-3"
              value={promo.descricao}
              onChange={(e) => setPromo((p) => ({ ...p, descricao: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Início
            <input
              type="date"
              className="mt-1 w-full rounded-lg border bg-background p-3"
              value={promo.inicio}
              onChange={(e) => setPromo((p) => ({ ...p, inicio: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Fim
            <input
              type="date"
              className="mt-1 w-full rounded-lg border bg-background p-3"
              value={promo.fim}
              onChange={(e) => setPromo((p) => ({ ...p, fim: e.target.value }))}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={promo.ativo}
            onChange={(e) => setPromo((p) => ({ ...p, ativo: e.target.checked }))}
          />
          Publicar no portal
        </label>
        <button
          onClick={() => void criarPromo()}
          className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground"
        >
          Criar promoção
        </button>
        <div className="space-y-2">
          {promos.map((p, i) => (
            <div
              key={p.id || i}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div>
                <strong>{p.titulo}</strong>
                <p className="text-sm text-muted-foreground">
                  {p.desconto_percentual}% · {p.cupom || "Sem cupom"} ·{" "}
                  {p.ativo ? "Publicada" : "Pausada"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void mudarPublicacaoPromo(p)}
                className="rounded-lg border px-3 py-2 text-sm font-semibold"
              >
                {p.ativo ? "Pausar promoção" : "Publicar promoção"}
              </button>
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link to="/configurar-agenda-online" className="underline text-primary">
          Configurar agendamentos
        </Link>
        <Link to="/precos-portal" className="underline text-primary">
          Configurar preços e cobranças
        </Link>
      </div>
    </main>
  );
}

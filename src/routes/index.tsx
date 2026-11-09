import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ArrowRight, BadgeDollarSign, Bath, CalendarDays, Check, ClipboardList,
  CreditCard, FileText, HeartPulse, Hotel, Menu, PawPrint, Scissors,
  ShoppingBag, Stethoscope, Store, UserRound, Users, X
} from "lucide-react";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { AlvoradaDemoShowcase } from "@/components/clinic-site/AlvoradaDemoShowcase";
import { ClinicSiteRenderer } from "@/components/clinic-site/ClinicSiteRenderer";
import {
  clinicSiteTemplates,
  normalizeClinicSiteConfig,
  type ClinicSiteTemplate,
} from "@/lib/clinic-site";
import {
  findPublicClinicSlug,
  isPlatformHostname,
  loadPublicClinicSite,
  normalizeHostname,
} from "@/lib/public-clinic-site";

/**
 * Resolva a clínica ANTES do HTML inicial ser renderizado.
 * O navegador nunca deve ver o conteúdo de oricse.com.br nem uma rota
 * intermediária de erro enquanto o subdomínio público é identificado.
 */
const resolverPaginaInicial = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("cache-control", "no-store");
  const request = getRequest();
  const hostDaUrl = normalizeHostname(new URL(request.url).hostname);
  const hostDoCabecalho = normalizeHostname(request.headers.get("host"));
  const hostname =
    isPlatformHostname(hostDaUrl) && !isPlatformHostname(hostDoCabecalho) && hostDoCabecalho
      ? hostDoCabecalho
      : hostDaUrl;

  if (!hostname || isPlatformHostname(hostname)) {
    // A página principal da ORICSE permanece com seu comportamento próprio.
    return { tipo: "plataforma" as const };
  }

  try {
    // *.oricse.com.br já identifica seu slug; não é necessário um segundo
    // redirecionamento nem uma consulta de domínio antes de ler o site.
    const subdominio = hostname.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)\.oricse\.com\.br$/);
    const slug = subdominio?.[1] ?? (await findPublicClinicSlug(hostname));
    if (!slug) return { tipo: "nao_encontrado" as const };

    const site = await loadPublicClinicSite(slug);
    if (!site) return { tipo: "nao_encontrado" as const };
    return { tipo: "clinica" as const, slug, site };
  } catch (error) {
    console.error("Não foi possível resolver a página pública da clínica:", error);
    return { tipo: "indisponivel" as const };
  }
});

export const Route = createFileRoute("/")({
  loader: () => resolverPaginaInicial(),
  component: PaginaInicial,
});

function PaginaInicial() {
  const resultado = Route.useLoaderData();
  if (resultado.tipo === "plataforma") return <PaginaInicialPlataforma />;

  if (resultado.tipo === "clinica") {
    const { slug, site } = resultado;
    const template: ClinicSiteTemplate = clinicSiteTemplates.includes(site.template as ClinicSiteTemplate)
      ? (site.template as ClinicSiteTemplate)
      : "prestige";
    const config = normalizeClinicSiteConfig(site.config);

    return slug === "alvorada" ? (
      <AlvoradaDemoShowcase
        initialTemplate={template}
        config={config}
        clinicSlug={slug}
      />
    ) : (
      <ClinicSiteRenderer template={template} config={config} clinicSlug={slug} />
    );
  }

  // Em uma falha real nunca exiba a home da plataforma ou uma rota errada.
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4EE] p-6 text-[#173D35]">
      <section className="max-w-md text-center">
        <h1 className="text-2xl font-bold">
          {resultado.tipo === "indisponivel"
            ? "Site temporariamente indisponível"
            : "Endereço da clínica não encontrado"}
        </h1>
        <p className="mt-3 text-sm opacity-75">
          {resultado.tipo === "indisponivel"
            ? "Não foi possível carregar o site neste momento. Tente novamente."
            : "Confira se o endereço da clínica está correto."}
        </p>
        {resultado.tipo === "indisponivel" && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full bg-[#173D35] px-6 py-3 text-sm font-semibold text-white"
          >
            Tentar novamente
          </button>
        )}
      </section>
    </main>
  );
}


// Página pública restaurada de uma versão já existente do ORICSE.
// O documento visual e os rascunhos salvos continuam separados no banco.
const recursos = [
  [CalendarDays, "Agenda inteligente"],
  [CreditCard, "OricsePay"],
  [Users, "Portal do Tutor"],
  [BadgeDollarSign, "Financeiro e Caixa"],
  [Scissors, "Banho e Tosa"],
  [Hotel, "Hotelzinho"],
  [HeartPulse, "Internação"],
  [ClipboardList, "Relatórios"],
] as const;

const modulos = [
  [Stethoscope, "Clínica e Consultório", "Prontuário, receitas, exames, vacinas e acompanhamento do paciente."],
  [Scissors, "Banho e Tosa", "Controle de agenda, serviços, pacotes e histórico de atendimentos."],
  [Hotel, "Hotelzinho", "Gestão de hospedagens, diárias, rotina e cuidados do pet."],
  [Store, "Pet Shop", "Controle de vendas, estoque, produtos e comandas integrado ao atendimento."],
  [UserRound, "Veterinário a domicílio", "Agenda externa, rotas, atendimentos e prontuário na palma da mão."],
  [FileText, "Portal do Tutor", "Documentos, receitas, exames, cartão de vacina e agendamentos."],
  [CreditCard, "OricsePay", "Pagamentos digitais, cobranças e repasses com praticidade."],
  [Users, "CRM e campanhas", "Relacionamento com tutores, lembretes e campanhas segmentadas."],
] as const;

function TelaSistema() {
  return (
    <div className="overflow-hidden rounded-2xl border-[5px] border-[#26302b] bg-[#f8faf8] shadow-[0_22px_44px_rgba(26,54,35,.23)]">
      <div className="flex min-h-[280px]">
        <aside className="hidden w-[112px] bg-[#155f35] p-3 text-[8px] font-semibold text-white/80 sm:block">
          <div className="mb-5 flex items-center gap-1.5 text-xs font-black text-white"><PawPrint size={15}/>Oricse</div>
          {["Início","Agenda","Recepção","Prontuário","Internação","Banho e Tosa","Hotelzinho","Estoque","Financeiro","Caixa","OricsePay"].map((item, i) => (
            <div key={item} className={"mb-1 rounded px-2 py-1.5 " + (i === 0 ? "bg-white/20 text-white" : "")}>{item}</div>
          ))}
        </aside>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-[9px] text-[#7a867e]">Olá, equipe</p><h3 className="text-sm font-extrabold text-[#183729]">Visão geral</h3></div>
            <span className="h-7 w-7 rounded-full bg-[#dce9d9]" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Agenda de hoje","—"],["Atendimentos","—"],["Faturamento","R$ —"],["Internações","—"]].map(([l,v]) => (
              <div key={l} className="rounded-lg border border-[#e3ebe1] bg-white p-2.5"><p className="text-[7px] text-[#758077]">{l}</p><strong className="mt-1 block text-xs text-[#245e39]">{v}</strong></div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1.25fr_.75fr]">
            <div className="rounded-lg border border-[#e3ebe1] bg-white p-3"><div className="flex justify-between text-[8px] font-bold text-[#345640]"><span>Agenda de hoje</span><span>Ver agenda →</span></div><div className="mt-4 h-14 rounded bg-[#f0f6ef]" /></div>
            <div className="rounded-lg border border-[#e3ebe1] bg-white p-3"><p className="text-[8px] font-bold text-[#345640]">Acesso rápido</p><div className="mt-3 grid grid-cols-2 gap-2 text-[7px] text-[#52705c]"><span>Recepção</span><span>Caixa</span><span>Check-in</span><span>Prontuário</span></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Titulo({children}:{children:ReactNode}) {
  return <h2 className="font-display text-3xl font-semibold leading-[.98] tracking-[-.045em] text-[#173727] sm:text-5xl">{children}</h2>;
}

function PaginaInicialPlataforma() {
  const [menu, setMenu] = useState(false);
  return (
    <main className="overflow-x-hidden bg-[#fcfcf9] text-[#254231]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
        <Link to="/" aria-label="Oricse — início" className="flex items-center gap-2"><img src="/oricse-logo-oryx.svg?v=15" className="h-10 w-10" alt="Oricse"/><span className="text-xl font-black tracking-tight text-[#1c6439]">Oricse</span></Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold md:flex"><a href="#solucoes">Soluções</a><a href="#funcionalidades">Funcionalidades</a><Link to="/planos">Planos</Link><a href="#sobre">Sobre</a></nav>
        <Link to="/planos" className="hidden rounded-lg bg-[#176538] px-4 py-2.5 text-sm font-bold text-white shadow-sm md:inline-flex">Solicitar demonstração</Link>
        <button onClick={() => setMenu(!menu)} className="rounded-lg bg-[#176538] p-2.5 text-white md:hidden" aria-expanded={menu}>{menu ? <X size={18}/> : <Menu size={18}/>}</button>
        {menu && <nav className="absolute right-5 top-16 z-20 grid w-56 gap-3 rounded-xl border border-[#dfe8df] bg-white p-4 text-sm font-semibold shadow-xl md:hidden"><a href="#solucoes" onClick={()=>setMenu(false)}>Soluções</a><a href="#funcionalidades" onClick={()=>setMenu(false)}>Funcionalidades</a><Link to="/planos">Planos</Link><Link to="/login">Entrar</Link></nav>}
      </header>

      <section className="relative border-b border-[#e3e8df]">
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#f4f8f0]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-5 pb-8 pt-8 sm:px-8 lg:grid-cols-[.86fr_1.15fr_.74fr] lg:px-10 lg:pt-12">
          <div className="z-10 self-center">
            <p className="text-[10px] font-bold uppercase tracking-[.21em] text-[#56715b]">Plataforma completa para o mercado pet</p>
            <h1 className="mt-4 font-display text-[clamp(42px,5vw,70px)] font-semibold leading-[.91] tracking-[-.055em] text-[#193b28]">A gestão inteligente<br/>para o <span className="text-[#21713e]">mercado pet.</span></h1>
            <p className="mt-5 max-w-md text-[15px] leading-6 text-[#506056]">A Oricse ajuda clínicas, pet shops, banho e tosa, hotelzinho, veterinários domiciliares e outros negócios pet a gerenciar tudo em um só lugar.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link to="/planos" className="inline-flex items-center gap-2 rounded-lg bg-[#176538] px-4 py-3 text-sm font-bold text-white">Conhecer o sistema <ArrowRight size={16}/></Link><Link to="/login" className="inline-flex items-center gap-2 rounded-lg border border-[#a8b8aa] bg-white px-4 py-3 text-sm font-bold text-[#215b35]">Já sou cliente</Link></div>
          </div>
          <div className="relative z-10 self-end lg:translate-y-4"><TelaSistema /></div>
          <div className="z-10 self-center rounded-xl bg-white/75 p-4 backdrop-blur-sm lg:p-0 lg:bg-transparent">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fbf2d8] px-3 py-1.5 text-[10px] font-bold text-[#846528]">✦ Completa, moderna e intuitiva</div>
            <h2 className="mt-4 text-2xl font-semibold leading-7 text-[#254231]">Tudo o que você precisa para cuidar do seu negócio pet.</h2>
            <ul className="mt-5 space-y-3 text-sm font-medium text-[#526259]">{["Gestão clínica, operacional e financeira","Recursos para diversos tipos de negócio pet","Experiência digital completa para o tutor","Escalável para uma ou várias unidades"].map(t=><li key={t} className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 rounded-full bg-[#278042] p-0.5 text-white"/>{t}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e4e9e1] bg-white"><div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-[#e7ece4] sm:grid-cols-4 lg:grid-cols-8 lg:divide-y-0">{recursos.map(([Icon,t])=><div key={t} className="flex items-center justify-center gap-2 px-3 py-4 text-center text-[10px] font-bold text-[#46614f]"><Icon size={19} className="text-[#39764a]"/><span>{t}</span></div>)}</div></section>

      <section id="solucoes" className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[.7fr_1.5fr_.65fr] lg:px-10">
        <div><p className="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#628269]">Soluções</p><Titulo>Tudo o que seu negócio precisa.</Titulo><p className="mt-4 text-sm leading-6 text-[#607066]">Funcionalidades completas e integradas para a rotina de clínicas, pet shops e demais negócios pet.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">{modulos.map(([Icon,t,d])=><article key={t} className="rounded-xl border border-[#e2e9df] bg-white p-4 shadow-[0_8px_20px_rgba(40,70,45,.04)]"><Icon size={21} className="text-[#337144]"/><h3 className="mt-3 text-sm font-extrabold text-[#2b5138]">{t}</h3><p className="mt-1 text-xs leading-5 text-[#68776d]">{d}</p></article>)}</div>
        <aside className="rounded-xl border border-[#ecdcae] bg-[#fffaf0] p-5 shadow-sm"><span className="text-4xl text-[#c49938]">“</span><p className="mt-3 text-sm leading-6 text-[#596155]">A Oricse trouxe muito mais organização para a nossa clínica, agilizou o atendimento e melhorou demais a experiência dos nossos tutores.</p><div className="mt-6 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c8ddc9] text-xs font-bold text-[#28613a]">DV</div><div><strong className="block text-xs">Dra. Letícia Almeida</strong><span className="text-[10px] text-[#798277]">Gestora de clínica veterinária</span></div></div></aside>
      </section>

      <section id="funcionalidades" className="border-y border-[#e1e8df] bg-[#f2f7ef] px-5 py-12 sm:px-8 lg:px-10"><div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[.65fr_1.35fr]"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#628269]">Para quem é</p><Titulo>Atendemos todo o mercado pet.</Titulo><p className="mt-4 text-sm leading-6 text-[#607066]">Uma plataforma flexível, feita para diferentes modelos e tamanhos de operação.</p></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{[[Store,"Clínicas de todos os portes"],[HeartPulse,"Hospitais veterinários"],[ShoppingBag,"Pet shops"],[Bath,"Banho e tosa"],[Hotel,"Hotelzinho"],[Stethoscope,"Atendimento domiciliar"]].map(([Icon,t])=>{const I=Icon as typeof Store;return <div key={t as string} className="text-center text-xs font-bold text-[#405d49]"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#317243] shadow-sm"><I size={22}/></div><p className="mt-2">{t as string}</p></div>})}</div></div></section>

      <section id="sobre" className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:px-10"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#628269]">Benefícios reais</p><Titulo>Mais eficiência para o seu negócio.</Titulo><p className="mt-4 text-sm leading-6 text-[#607066]">Mais eficiência na rotina, mais controle na gestão e mais valor na experiência do tutor.</p></div><div className="grid gap-3 sm:grid-cols-2">{[["Mais organização","Centralize sua operação e tenha uma visão completa do negócio."],["Atendimento mais ágil","Agilize a recepção, o atendimento e o fluxo da sua equipe."],["Controle financeiro","Acompanhe vendas, pagamentos, recebimentos e resultados."],["Experiência melhor para tutores","Mais comodidade, comunicação e confiança para quem cuida do pet."]].map(([t,d])=><article key={t} className="rounded-xl border border-[#e2e9df] p-5"><Check size={20} className="text-[#3b7e4c]"/><h3 className="mt-5 text-sm font-extrabold text-[#2b5138]">{t}</h3><p className="mt-2 text-xs leading-5 text-[#68776d]">{d}</p></article>)}</div></section>

      <section className="bg-[#eef6eb] px-5 py-12 sm:px-8 lg:px-10"><div className="mx-auto grid max-w-7xl overflow-hidden rounded-2xl bg-[#e0efda] p-6 sm:grid-cols-[.8fr_1.2fr] sm:p-10"><div><div className="flex h-40 w-28 items-center justify-center rounded-[22px] border-4 border-[#244c31] bg-white shadow-xl"><div className="text-center text-[10px] font-bold text-[#23663a]"><PawPrint className="mx-auto mb-2" size={22}/>Portal do Tutor</div></div></div><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#5e7b64]">Portal do Tutor e OricsePay</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.04em] text-[#1b4c2c] sm:text-4xl">Conecte sua empresa aos tutores com praticidade, transparência e modernidade.</h2><ul className="mt-5 grid gap-2 text-sm font-medium text-[#395641] sm:grid-cols-2">{["Acesso a receitas, exames e prontuários","Cartão de vacina sempre atualizado","Agendamento online e check-in","Comunicação direta com sua equipe","Pagamentos digitais com OricsePay"].map(t=><li key={t} className="flex gap-2"><Check size={16} className="shrink-0 text-[#2f7945]"/>{t}</li>)}</ul></div></div></section>

      <section className="px-5 py-10 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 rounded-2xl bg-[#e5efdd] px-7 py-7 text-center sm:flex-row sm:text-left"><div><h2 className="font-display text-2xl font-semibold text-[#1b4d2c]">Pronto para transformar a gestão da sua empresa pet?</h2><p className="mt-1 text-sm text-[#607066]">Conheça a Oricse na prática e descubra como simplificar sua rotina.</p></div><Link to="/planos" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#176538] px-5 py-3 text-sm font-bold text-white">Solicitar demonstração <ArrowRight size={17}/></Link></div></section>

      <footer className="border-t border-[#e2e9df] px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-xs text-[#647168]"><span className="flex items-center gap-2 font-bold text-[#315a3d]"><PawPrint size={18}/>Oricse · Plataforma para o mercado pet</span><span>© 2026 Oricse. Todos os direitos reservados.</span><div className="flex gap-4"><Link to="/politica-de-privacidade">Privacidade</Link><Link to="/termos-de-uso">Termos de uso</Link><Link to="/login">Entrar</Link></div></div></footer>
    </main>
  );
}
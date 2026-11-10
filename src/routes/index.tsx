import { useState, type ReactNode } from "react";
import { ORICSTUDIO_LOGO } from "@/lib/oricstudio-logo";
import { CalendarCheck, CalendarClock, CheckCircle2, ChevronDown, Heart, Bookmark, Images, Instagram, Megaphone, MessageCircle, Package, Settings, Sparkles } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";

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
  loadPublicVisualDocument,
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
    let visual = { version: 1 as const, updatedAt: "", pages: {} as Record<string, any> };
    try { visual = await loadPublicVisualDocument(); } catch (error) { console.error("Não foi possível carregar o layout público:", error); }
    return { tipo: "plataforma" as const, visual };
  }

  try {
    // *.oricse.com.br já identifica seu slug; não é necessário um segundo
    // redirecionamento nem uma consulta de domínio antes de ler o site.
    const subdominio = hostname.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)\.oricse\.com\.br$/);
    const slug = subdominio?.[1] ?? (await findPublicClinicSlug(hostname));
    if (!slug) return { tipo: "nao_encontrado" as const };

    const [site, visual] = await Promise.all([loadPublicClinicSite(slug), loadPublicVisualDocument().catch(() => ({ version: 1 as const, updatedAt: "", pages: {} as Record<string, any> }))]);
    if (!site) return { tipo: "nao_encontrado" as const };
    return { tipo: "clinica" as const, slug, site, visual };
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
  const bootstrap = "visual" in resultado ? <script id="oricse-visual-bootstrap" type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(resultado.visual).replace(/</g, "\\u003c") }} /> : null;
  if (resultado.tipo === "plataforma") return <>{bootstrap}<PaginaInicialPlataforma /></>;

  if (resultado.tipo === "clinica") {
    const { slug, site } = resultado;
    const template: ClinicSiteTemplate = clinicSiteTemplates.includes(site.template as ClinicSiteTemplate)
      ? (site.template as ClinicSiteTemplate)
      : "prestige";
    const config = normalizeClinicSiteConfig(site.config);

    return <>{bootstrap}{slug === "alvorada" ? (
      <AlvoradaDemoShowcase initialTemplate={template} config={config} clinicSlug={slug} />
    ) : (
      <ClinicSiteRenderer template={template} config={config} clinicSlug={slug} />
    )}</>;
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


const modulos = [
  { icon: CalendarDays, titulo: "Recepção", descricao: "Organize a agenda, confirme atendimentos, acompanhe a fila de espera e tenha o cadastro do tutor e do pet sempre à mão." },
  { icon: Stethoscope, titulo: "Clínica veterinária", descricao: "Prontuário, receitas, vacinas, exames, documentos e acompanhamento clínico completo em um só fluxo." },
  { icon: Scissors, titulo: "Banho e tosa", descricao: "Controle serviços, pacotes, profissionais, horários e observações importantes para cada pet." },
  { icon: Hotel, titulo: "Hotelzinho", descricao: "Cuide de reservas, hospedagens, check-in, estadias, diárias e rotinas de cuidado com clareza." },
  { icon: Sparkles, titulo: "Meu OricStúdio", descricao: "Crie e organize a presença digital do seu negócio, planeje conteúdos e fortaleça sua marca." },
  { icon: Users, titulo: "Gestão de clientes", descricao: "Histórico completo de tutores e pets, relacionamento, lembretes e campanhas segmentadas." },
  { icon: CreditCard, titulo: "Financeiro", descricao: "Caixa, comandas, cobranças, repasses e uma visão clara da saúde financeira da operação." },
  { icon: CalendarCheck, titulo: "OricsePay", descricao: "Disponibilize a agenda no Portal do Tutor e confirme o agendamento somente após o pagamento." },
  { icon: Package, titulo: "Estoque e produtos", descricao: "Catálogo, movimentações, vendas, alertas e produtos conectados à rotina da clínica e do pet shop." },
  { icon: ClipboardList, titulo: "Relatórios", descricao: "Acompanhe atendimentos, vendas, desempenho, caixa e os dados que ajudam sua empresa a crescer." },
  { icon: UserRound, titulo: "RH e atividade", descricao: "Equipe, acessos, ponto, jornadas e permissões definidos de acordo com cada função." },
  { icon: Settings, titulo: "Configurações", descricao: "Personalize sua clínica, usuários, preferências, integrações, portal e presença digital." },
] as const;

const joias = [
  ["Portal do Tutor", "Documentos, vacinas e pagamentos em um só lugar.", UserRound],
  ["Fluxo integrado", "Agenda, atendimento e caixa sem retrabalho.", CalendarCheck],
  ["Agendamento mediante pagamento", "O tutor confirma o horário após pagar online.", CalendarDays],
] as const;

function Titulo({children, claro = false}:{children:ReactNode; claro?:boolean}) {
  return <h2 className={"font-display text-4xl font-semibold leading-[.96] tracking-[-.055em] sm:text-6xl " + (claro ? "text-[#fff9f4]" : "text-[#4A1826]")}>{children}</h2>;
}

function OrixHero() {
  return (
    <div className="relative mx-auto flex min-h-[360px] items-end justify-center overflow-hidden rounded-[32px] border border-[#eadbd4] bg-[linear-gradient(145deg,#fffaf6,#f1dfdc)] px-5 pt-8 shadow-[0_25px_70px_rgba(74,24,38,.10)]">
      <div className="absolute left-7 top-7 rounded-full border border-[#d9b7bf] bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#8d4359]">Conexão que acompanha</div>
      <div className="relative z-10 flex h-[310px] items-center justify-center">
        <img src={ORICSTUDIO_LOGO} alt="Órix" className="h-[310px] w-auto max-w-full object-contain object-bottom drop-shadow-[0_18px_18px_rgba(74,24,38,.18)]" />
      </div>
      <div className="absolute inset-x-8 bottom-6 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-center backdrop-blur-sm"><p className="font-display text-xl font-semibold text-[#4A1826]">Tudo conectado, sem complicar.</p><p className="mt-1 text-xs text-[#795a65]">Uma operação pet mais fácil para a equipe e para o tutor.</p></div>
    </div>
  );
}
function PaginaInicialPlataforma() {
  const [menu, setMenu] = useState(false);
  // A capa não pode controlar a árvore do banner. Se uma imagem atrasar ou
  // falhar, o conteúdo continua na mesma estrutura e posição desde o primeiro
  // frame, evitando a troca tardia de logo, textos e botões.
  const capaOficialCarregada = true;
  return (

    <>
      {/* CSS crítico entregue pelo próprio SSR: não espera JS, Tailwind ou hidratação.
          Seletores restritos à home evitam interferir em clínicas e no Canva. */}
      <style>{`
        main[data-visual-id="home-fundo-bege"] {
          background-color: #fffdfa;
          color: #512b38;
          overflow-x: hidden;
        }
        main[data-visual-id="home-fundo-bege"] [data-visual-id="home-banner"] {
          position: relative;
          isolation: isolate;
          background: transparent;
        }
        main[data-visual-id="home-fundo-bege"] [data-visual-id="home-base-capa"] {
          position: relative;
          width: 100%;
          background: transparent;
        }
        main[data-visual-id="home-fundo-bege"] [data-visual-id="home-imagem-oryx"] {
          display: block;
          width: 100%;
          height: auto;
        }
        @media (min-width: 1024px) {
          main[data-visual-id="home-fundo-bege"] [data-visual-id="home-base-capa"] {
            aspect-ratio: 1.86 / 1;
          }
          main[data-visual-id="home-fundo-bege"] [data-visual-id="home-imagem-oryx"] {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: fill;
          }
          main[data-visual-id="home-fundo-bege"] [data-visual-id="home-conteudo-banner"] {
            position: absolute;
            inset: 0;
            display: block;
            width: 100%;
            max-width: none;
            padding: 0;
          }
          main[data-visual-id="home-fundo-bege"] [data-visual-id="home-conteudo-banner"] > div {
            display: contents;
          }
          main[data-visual-id="home-fundo-bege"] [data-home-hero-logo-wrap] {
            position: absolute;
            top: -4%;
            left: 14%;
            width: auto;
            margin: 0;
            z-index: 10;
          }
          main[data-visual-id="home-fundo-bege"] [data-visual-id="home-logo-oricse"] {
            width: clamp(130px, 12vw, 200px);
            height: clamp(130px, 12vw, 200px);
            object-fit: contain;
          }
          main[data-visual-id="home-fundo-bege"] [data-visual-id="home-selo"] {
            position: absolute;
            top: 25%;
            left: 5%;
            z-index: 10;
          }
          main[data-visual-id="home-fundo-bege"] [data-visual-id="home-titulo-principal"] {
            position: absolute;
            top: 31%;
            left: 5%;
            width: 46%;
            max-width: none;
            margin-top: 0;
            z-index: 10;
            font-size: clamp(56px, 5.3vw, 98px);
            line-height: .91;
            letter-spacing: -.065em;
          }
          main[data-visual-id="home-fundo-bege"] [data-visual-id="home-texto-apoio"] {
            position: absolute;
            top: 72%;
            left: 5%;
            max-width: 42%;
            margin-top: 0;
            z-index: 10;
            font-size: clamp(14px, 1.05vw, 18px);
          }
          main[data-visual-id="home-fundo-bege"] [data-home-hero-actions] {
            position: absolute;
            top: 85%;
            left: 6%;
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 0;
            z-index: 10;
          }
          main[data-visual-id="home-fundo-bege"] [data-visual-id="home-legenda-inferior"] {
            position: absolute;
            bottom: 1%;
            left: 58%;
            margin-top: 0;
            z-index: 10;
            color: white;
            font-size: clamp(10px, .72vw, 13px);
          }
        }
      `}</style>
    <main data-visual-id="home-fundo-bege" data-visual-label="Fundo bege da página" className="overflow-x-hidden bg-[#fffdfa] text-[#512b38]">
      <header data-visual-id="home-cabecalho" data-visual-label="Cabeçalho" className="mx-auto flex min-h-[52px] max-w-7xl items-center justify-end px-5 py-0 sm:px-8 lg:px-10">
        <nav data-visual-id="home-menu-superior" data-visual-label="Menu superior" className="hidden items-center gap-8 text-sm font-semibold text-[#6b4050] md:flex"><a href="#oricstudio">OricStúdio</a><a href="#diferenciais">Portal do Tutor</a><Link to="/planos">Planos</Link><Link data-visual-id="home-botao-login" data-visual-label="Botão Login" to="/login" className="rounded-full bg-[#4A1826] px-5 py-2.5 font-bold text-white">Login</Link></nav>
        <button onClick={() => setMenu(!menu)} aria-expanded={menu} className="rounded-full bg-[#4A1826] p-2.5 text-white md:hidden">{menu ? <X size={17}/> : <Menu size={17}/>}</button>
        {menu && <nav className="absolute right-5 top-20 z-30 grid w-56 gap-3 rounded-2xl border border-[#eadbd4] bg-[#fffdfa] p-4 text-sm font-semibold text-[#5a2b3a] shadow-xl md:hidden"><a href="#oricstudio" onClick={()=>setMenu(false)}>OricStúdio</a><a href="#diferenciais" onClick={()=>setMenu(false)}>Portal do Tutor</a><Link to="/planos">Planos</Link><Link to="/login" className="rounded-full bg-[#4A1826] px-4 py-2 text-center font-bold text-white">Login</Link></nav>}
      </header>

      <section data-visual-id="home-banner" data-visual-label="Área do banner" className="relative isolate border-t border-[#f0e3de] bg-transparent">
        {/* A capa original, sem escrita, é decorativa; textos e botões seguem reais e acessíveis. */}
        <img
          src="/oricse-capa-paisagem.png"
          alt=""
          aria-hidden="true"
          className="hidden"
          loading="eager"
        />
        {capaOficialCarregada ? (
          <div data-visual-id="home-base-capa" data-visual-label="Área da capa" className="relative z-[1] w-full bg-transparent lg:aspect-[1.86]">
            {/* Em telas menores, a arte inteira fica visível antes do conteúdo. */}
            <img
              src="/oricse-capa-paisagem.png"
              data-visual-id="home-imagem-oryx" data-visual-label="Imagem do órix e pôr do sol" alt="Órix nas dunas ao pôr do sol"
              width={1672}
              height={941}
              className="block h-auto w-full lg:absolute lg:inset-0 lg:h-full lg:object-fill"
              loading="eager"
              decoding="async"
            />
            <div data-visual-id="home-conteudo-banner" data-visual-label="Coluna do banner" className="relative mx-auto flex max-w-7xl items-start px-5 pb-12 pt-6 sm:px-8 lg:absolute lg:inset-0 lg:block lg:max-w-none lg:p-0">
              <div className="max-w-xl lg:contents">
            {/* Logo centralizada sobre o selo, dentro da coluna de conteúdo. */}
            <div data-home-hero-logo-wrap className="mb-6 flex w-full justify-center sm:mb-8 lg:absolute lg:-top-[4%] lg:left-[14%] lg:z-10 lg:mb-0 lg:w-auto">
              <img
                src="/oricse-logo-oryx.svg?v=15"
                data-visual-id="home-logo-oricse" data-visual-label="Logo ORICSE" alt="ORICSE — Soluções para o mercado pet"
                width={200}
                height={200}
                className="h-[150px] w-[150px] object-contain sm:h-[180px] sm:w-[180px] lg:h-[clamp(130px,12vw,200px)] lg:w-[clamp(130px,12vw,200px)]"
                loading="eager"
                fetchPriority="high"
              />
            </div>

            <p data-visual-id="home-selo" data-visual-label="Selo plataforma completa" className="inline-flex items-center gap-2 rounded-full border border-[#e8d1d2] bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#8a4e61] lg:absolute lg:left-[5%] lg:top-[25%] lg:z-10"><Sparkles size={13}/> Plataforma completa para o mercado pet</p>
            <h1 data-visual-id="home-titulo-principal" data-visual-label="Título principal" className="mt-6 max-w-[12ch] font-display text-[clamp(48px,6vw,84px)] font-semibold leading-[.91] tracking-[-.065em] text-[#4A1826] lg:absolute lg:left-[5%] lg:top-[31%] lg:z-10 lg:mt-0 lg:w-[46%] lg:max-w-none lg:text-[clamp(56px,5.3vw,98px)]">Cuidar de pets é a sua <span className="text-[#a56a78]">missão.</span> Organizar tudo é a nossa.</h1>
            <p data-visual-id="home-texto-apoio" data-visual-label="Texto de apoio" className="mt-6 max-w-xl text-[17px] leading-7 text-[#785867] lg:absolute lg:left-[5%] lg:top-[72%] lg:z-10 lg:mt-0 lg:max-w-[42%] lg:text-[clamp(14px,1.05vw,18px)]">Uma plataforma completa para manter a rotina organizada, o time alinhado e os tutores por perto.</p>
            <div data-home-hero-actions className="mt-8 flex flex-wrap gap-3 lg:absolute lg:left-[6%] lg:top-[85%] lg:z-10 lg:mt-0"><Link data-visual-id="home-botao-conhecer" data-visual-label="Botão Conhecer a Oricse" to="/planos" className="inline-flex items-center gap-2 rounded-full bg-[#4A1826] px-6 py-3.5 font-bold text-white">Conhecer a Oricse <ArrowRight size={17}/></Link><Link data-visual-id="home-botao-cliente" data-visual-label="Botão Já sou cliente" to="/login" className="inline-flex items-center rounded-full border border-[#ceb3bb] bg-white px-6 py-3.5 font-bold text-[#5d293c]">Já sou cliente</Link></div>
            <p data-visual-id="home-legenda-inferior" data-visual-label="Legenda inferior do banner" className="mt-6 flex items-center gap-2 text-sm text-[#876570] lg:absolute lg:bottom-[1%] lg:left-[58%] lg:z-10 lg:mt-0 lg:text-[clamp(10px,.72vw,13px)] lg:text-white"><PawPrint size={16} className="text-[#8d4359]"/> Uma plataforma para sua operação inteira, com a sua identidade.</p>

              </div>
            </div>
          </div>
        ) : (
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:px-10 lg:py-24">
          <div>
            {/* Logo centralizada sobre o selo, dentro da coluna de conteúdo. */}
            <div className="mb-6 flex w-full justify-center sm:mb-8">
              <img
                src="/oricse-logo-oryx.svg?v=15"
                alt="ORICSE — Soluções para o mercado pet"
                width={200}
                height={200}
                className="h-[150px] w-[150px] object-contain sm:h-[180px] sm:w-[180px] lg:h-[200px] lg:w-[200px]"
                loading="eager"
                fetchPriority="high"
              />
            </div>

            <p className="inline-flex items-center gap-2 rounded-full border border-[#e8d1d2] bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#8a4e61]"><Sparkles size={13}/> Plataforma completa para o mercado pet</p>
            <h1 className="mt-6 max-w-[12ch] font-display text-[clamp(48px,6vw,84px)] font-semibold leading-[.91] tracking-[-.065em] text-[#4A1826]">Cuidar de pets é a sua <span className="text-[#a56a78]">missão.</span> Organizar tudo é a nossa.</h1>
            <p className="mt-6 max-w-xl text-[17px] leading-7 text-[#785867]">Uma plataforma completa para manter a rotina organizada, o time alinhado e os tutores por perto.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link to="/planos" className="inline-flex items-center gap-2 rounded-full bg-[#4A1826] px-6 py-3.5 font-bold text-white">Conhecer a Oricse <ArrowRight size={17}/></Link><Link to="/login" className="inline-flex items-center rounded-full border border-[#ceb3bb] bg-white px-6 py-3.5 font-bold text-[#5d293c]">Já sou cliente</Link></div>
            <p className="mt-6 flex items-center gap-2 text-sm text-[#876570]"><PawPrint size={16} className="text-[#8d4359]"/> Uma plataforma para sua operação inteira, com a sua identidade.</p>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full border border-[#d8b8bf] opacity-60" />
            <div className="absolute -bottom-10 -left-12 h-36 w-36 rounded-full bg-[#e5c8c7] blur-2xl" />
            <OrixHero />
          </div>
        </div>

        )}
      </section>

      <section className="mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <div className="grid gap-3 md:grid-cols-3">
          {joias.map(([titulo, texto, Icone]) => (
            <article key={titulo} className="flex min-h-[100px] items-center gap-3.5 rounded-[20px] border border-[#ecdfd9] bg-white/95 px-4 py-4 shadow-[0_8px_28px_rgba(74,24,38,.035)] transition-shadow hover:shadow-[0_12px_32px_rgba(74,24,38,.085)]">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#f8eff0] text-[#8d4359]"><Icone size={20} strokeWidth={1.7}/></span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold leading-5 text-[#4A1826]">{titulo}</h2>
                <p className="mt-1 text-xs leading-[1.5] text-[#765c66]">{texto}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="solucoes" className="border-y border-[#eee0da] bg-[#fbf6f2] px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9c6574]">Soluções para a rotina de verdade</p><Titulo>Cada parte do seu negócio, no mesmo sistema.</Titulo><p className="mt-5 text-[17px] leading-7 text-[#765c66]">Da chegada do tutor ao pagamento, a Oricse organiza a operação e deixa sua equipe livre para cuidar melhor.</p></div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {modulos.map(({icon:Icon,titulo,descricao})=><article key={titulo} className="group flex min-h-[230px] flex-col rounded-2xl border border-[#eaded8] bg-white p-5 text-[#4A1826] transition duration-300 hover:-translate-y-1 hover:border-[#c79ca6] hover:shadow-[0_16px_32px_rgba(74,24,38,.10)]"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7ebea] text-[#7a344c] transition group-hover:bg-[#4A1826] group-hover:text-[#fff9f4]"><Icon size={19}/></div><h3 className="mt-4 text-base font-bold">{titulo}</h3><p className="mt-2 text-sm leading-6 text-[#765c66]">{descricao}</p><a href="/solucoes" className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-[#e5cfd2] bg-[#fffaf9] px-3 py-1.5 text-xs font-bold text-[#7a344c] transition hover:border-[#7a344c] hover:bg-[#4A1826] hover:text-white">Saiba mais <ArrowRight size={14}/></a></article>)}
          </div>
        </div>
      </section>

      <section id="oricstudio" aria-labelledby="oricstudio-titulo" className="relative isolate overflow-hidden bg-[#35111f] px-5 py-16 text-[#fff9f4] sm:px-8 sm:py-20 lg:px-10 lg:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute -right-44 -top-44 h-[540px] w-[540px] rounded-full bg-[#a45670]/20 blur-[95px]"/>
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-60 left-[18%] h-[490px] w-[590px] rounded-full bg-[#8e4c44]/20 blur-[100px]"/>
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.93fr_1.07fr] xl:gap-20">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[.06] p-2 pr-5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5">
                <img src={ORICSTUDIO_LOGO} alt="" className="h-full w-full object-contain scale-[2.5]"/>
              </span>
              <span className="block">
                <span className="block text-sm font-extrabold tracking-tight text-white">OricStúdio</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[.14em] text-[#e5b9c7]">Marketing pensado para o mercado pet</span>
              </span>
            </div>

            <p className="mt-9 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-[#f4bdcb]">
              <Sparkles size={15}/> Sua marca merece aparecer
            </p>
            <h2 id="oricstudio-titulo" className="mt-4 max-w-[640px] font-display text-[clamp(2.65rem,4.5vw,4.75rem)] font-semibold leading-[1.07] tracking-[-.06em]">
              Quem cuida tão bem merece <span className="text-[#f5c6a8]">ser lembrado.</span>
            </h2>
            <p className="mt-6 max-w-[540px] text-[16px] leading-[1.8] text-[#f2d8df]/85 sm:text-[17px]">
              Seu próximo post não precisa nascer na correria. Planeje campanhas, organize imagens e legendas, acompanhe aprovações e crie uma comunicação com a personalidade do seu negócio.
            </p>
            <p className="mt-5 max-w-[510px] text-sm font-semibold leading-6 text-[#f6d0b7]">
              Menos tempo pensando no que postar. Mais espaço para cuidar de quem importa.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/solucoes#meu-oricstudio" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ffe2ca] px-6 py-3.5 text-sm font-extrabold text-[#4A1826] shadow-[0_12px_30px_rgba(0,0,0,.15)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Conhecer o OricStúdio <ArrowRight size={18}/>
              </a>
              <Link to="/oricstudio" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Já tenho acesso <ArrowRight size={16}/>
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#f8e2e4]/85">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={16} className="text-[#f5c6a8]"/> Calendário editorial</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={16} className="text-[#f5c6a8]"/> Biblioteca de mídias</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={16} className="text-[#f5c6a8]"/> Revisão de conteúdo</span>
            </div>
          </div>

          <div className="relative mx-auto flex w-full max-w-[640px] justify-start pb-4 pt-5 sm:min-h-[610px] sm:items-center sm:pl-5">
            <div aria-hidden="true" className="absolute left-[8%] top-[15%] h-[440px] w-[440px] rounded-full border border-[#ffdfc8]/10 bg-[#7d455b]/15 blur-[2px]"/>
            <div aria-hidden="true" className="absolute right-0 top-[8%] h-[320px] w-[320px] rounded-full border border-white/10"/>

            <div className="absolute right-0 top-12 z-[1] hidden w-[265px] rotate-[5deg] rounded-[24px] border border-[#efdce2]/40 bg-[#fffaf7] p-5 text-[#4A1826] shadow-[0_30px_70px_rgba(0,0,0,.28)] sm:block">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[12px] font-extrabold"><CalendarDays size={17} className="text-[#a65f75]"/> Calendário editorial</span>
                <span className="text-[10px] font-bold text-[#ac8791]">EXEMPLO</span>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-[#8a6c76]">Uma semana de conteúdo organizada</p>
              <div className="mt-4 space-y-2.5">
                {[
                  ["SEG", "Dica de prevenção", "Ideia salva"],
                  ["QUA", "Cuidados com os pets", "Em revisão"],
                  ["SEX", "Campanha de check-up", "Aprovado"],
                ].map(([dia, nome, etapa])=>(
                  <div key={dia} className="flex items-center gap-2.5 rounded-xl border border-[#f1e2e2] bg-white px-2.5 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f8eded] text-[10px] font-extrabold text-[#914963]">{dia}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold">{nome}</span><span className="block text-[10px] text-[#9c7e89]">{etapa}</span></span>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#d99d82]"/>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-[2] w-[min(88vw,326px)] overflow-hidden rounded-[32px] border-[7px] border-[#fff7f2] bg-white text-[#4A1826] shadow-[0_28px_85px_rgba(0,0,0,.36)] sm:ml-2 sm:-rotate-[4deg]">
              <div className="flex items-center gap-2.5 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f9e5de] text-[#994865]"><PawPrint size={17}/></span>
                <span className="min-w-0 flex-1"><span className="block text-[12px] font-extrabold">sua.clinica</span><span className="block text-[10px] text-[#94757c]">Campanha ilustrativa</span></span>
                <Instagram size={20} className="text-[#713749]"/>
              </div>
              <img src="/oricstudio-campanha-exemplo.svg" alt="Exemplo ilustrativo de post veterinário com cachorro, gato e convite para um check-up" className="block aspect-[4/5] w-full object-cover" loading="lazy" decoding="async"/>
              <div className="px-4 pb-4 pt-3">
                <div className="flex items-center gap-3 text-[#704255]"><Heart size={19}/><MessageCircle size={19}/><Bookmark size={19} className="ml-auto"/></div>
                <p className="mt-3 text-[12px] leading-[1.5] text-[#674350]"><strong>sua.clinica</strong> 🐾 Prevenir também é uma forma de amar. Que tal organizar o próximo check-up?</p>
                <p className="mt-2 text-[10px] text-[#987d87]">Exemplo ilustrativo de conteúdo</p>
              </div>
            </div>

            <div className="absolute bottom-[10%] right-0 z-[3] hidden max-w-[245px] rounded-2xl border border-white/20 bg-[#fff7ef] px-4 py-3 text-[#502231] shadow-[0_18px_40px_rgba(0,0,0,.22)] sm:block">
              <div className="flex items-center gap-2 text-[12px] font-extrabold"><CheckCircle2 size={17} className="text-[#a25b73]"/> Pronto para revisar</div>
              <p className="mt-1 text-[11px] leading-4 text-[#876a73]">Arte, legenda e planejamento no mesmo lugar.</p>
            </div>
          </div>
        </div>

        <div className="relative mx-auto mt-10 grid max-w-7xl gap-5 border-t border-white/15 pt-7 sm:grid-cols-3 sm:gap-7">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#ffd7c0]"><CalendarClock size={19}/></span>
            <div><h3 className="text-sm font-bold text-white">Chega de post de última hora</h3><p className="mt-1 text-xs leading-5 text-[#f2d5db]/75">Visualize suas ideias em um calendário editorial.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#ffd7c0]"><Images size={19}/></span>
            <div><h3 className="text-sm font-bold text-white">Sua identidade em cada campanha</h3><p className="mt-1 text-xs leading-5 text-[#f2d5db]/75">Artes e legendas organizadas para a equipe.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#ffd7c0]"><Megaphone size={19}/></span>
            <div><h3 className="text-sm font-bold text-white">Comunicação com intenção</h3><p className="mt-1 text-xs leading-5 text-[#f2d5db]/75">Campanhas de prevenção, serviços e relacionamento.</p></div>
          </div>
        </div>
      </section>

      <section id="diferenciais" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9c6574]">Por que sua clínica precisa do Portal do Tutor</p><Titulo>Menos mensagens repetidas. Mais confiança para voltar.</Titulo><p className="mt-5 text-[17px] leading-7 text-[#765c66]">Depois da consulta, o tutor não precisa procurar conversa antiga nem ligar para pedir documento. Ele encontra o que precisa no próprio acesso da clínica — e sua equipe ganha tempo para atender melhor.</p></div><div className="rounded-[28px] border border-[#ead8d5] bg-[#fffaf7] p-6 sm:p-8"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3e2e2] text-[#7e334b]"><PawPrint size={23}/></div><div><h3 className="text-xl font-bold text-[#4A1826]">O tutor resolve. Sua equipe respira.</h3><p className="text-sm text-[#856973]">Um acesso seguro, com a identidade da sua clínica, para acompanhar o pet sem depender da recepção.</p></div></div><div className="mt-7 grid gap-3 sm:grid-cols-2">{["Receitas, exames, laudos e documentos sempre disponíveis","Cartão de vacina e vermífugo atualizado para o próximo retorno","Agendamento online reduzindo ligações e troca de mensagens","Comandas e pagamentos digitais com mais praticidade"].map(t=><div key={t} className="flex gap-2 rounded-xl bg-white p-3 text-sm font-semibold text-[#66404d]"><span className="mt-0.5 text-[#9d5268]">✦</span>{t}</div>)}</div></div></div></section>

      <section className="px-5 pb-14 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 rounded-[28px] bg-[#f1e3df] px-7 py-10 text-center sm:flex-row sm:px-12 sm:text-left"><div><h2 className="font-display text-3xl font-semibold tracking-[-.04em] text-[#4A1826] sm:text-4xl">Conheça cada solução da Oricse.</h2><p className="mt-2 text-[#765c66]">Veja o que cada área faz e encontre o que funciona para sua operação.</p></div><a href="/solucoes" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#4A1826] px-6 py-3.5 font-bold text-white">Ver todas as soluções <ArrowRight size={17}/></a></div></section>

      <footer className="border-t border-[#eaded8] px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-xs text-[#846873]"><span className="flex items-center gap-2 font-bold text-[#5a293b]"><img src="/oricse-logo-oryx.svg?v=15" className="h-7 w-7" alt=""/>Oricse · Soluções para o mercado pet</span><span>© 2026 Oricse. Todos os direitos reservados.</span><div className="flex gap-4"><Link to="/politica-de-privacidade">Privacidade</Link><Link to="/termos-de-uso">Termos</Link><Link to="/login">Entrar</Link></div></div></footer>
    </main>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  ClipboardList,
  LifeBuoy,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  WalletCards,
} from "lucide-react";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { ClinicLogin } from "@/components/ClinicLogin";
import { useTenantContext } from "@/lib/tenant-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oricse — Mais cuidado, uma rotina mais leve" },
      {
        name: "description",
        content:
          "A Oricse organiza a rotina da sua clínica veterinária: pacientes, consultas, recepção, internação e financeiro em um só lugar.",
      },
    ],
  }),
  component: PaginaInicial,
});

const solucoes = [
  {
    Icone: Stethoscope,
    titulo: "Consultas e prontuários",
    descricao: "Registros clínicos organizados para acompanhar cada paciente.",
  },
  {
    Icone: BedDouble,
    titulo: "Internação",
    descricao: "Acompanhe plantões, cuidados e evolução dos animais internados.",
  },
  {
    Icone: CalendarDays,
    titulo: "Recepção e agenda",
    descricao: "Organize agendamentos, fila de espera, tutores e pacientes.",
  },
  {
    Icone: WalletCards,
    titulo: "Caixa e gestão",
    descricao: "Tenha lançamentos financeiros e informações da clínica por perto.",
  },
] as const;

function linkSuporte(contato: string) {
  const valor = contato.trim();
  if (!valor) return null;
  if (/^(https?:|mailto:|tel:)/i.test(valor)) return valor;

  const email = valor.match(/[^\s<>]+@[^\s<>]+\.[^\s<>]+/)?.[0];
  if (email) return `mailto:${email}`;

  const telefone = valor.replace(/\D/g, "");
  if (telefone.length >= 10) return `https://wa.me/${telefone}`;

  return null;
}

function PaginaInicial() {
  const { portal, loading, error } = useTenantContext();
  if (loading && typeof window !== "undefined") {
    return <main className="min-h-screen bg-[#f5f7f4]" />;
  }
  if (portal) return <ClinicLogin clinic={portal} />;
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7f4] px-4">
        <section className="rounded-2xl border bg-white p-6 text-center">
          <h1 className="font-bold">Não foi possível carregar o site da clínica</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </section>
      </main>
    );
  }
  return <PaginaInicialOricse />;
}

function PaginaInicialOricse() {
  const { marca, logo_url, contato } = useSiteBranding();
  const suporte = linkSuporte(contato);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8f5] text-[#17352f]">
      <header className="relative z-10 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
        <a href="#" aria-label={`${marca} — início`} className="flex min-h-11 items-center">
          <img
            src={logo_url}
            alt={marca}
            className="max-h-12 max-w-[172px] object-contain object-left"
          />
        </a>
        <nav
          aria-label="Navegação principal"
          className="flex flex-wrap items-center justify-end gap-2 sm:gap-3"
        >
          <a
            href="#recursos"
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#55716a] transition hover:bg-white hover:text-[#17352f] sm:inline-flex"
          >
            Recursos
          </a>
          <Link
            to="/planos"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[#55716a] transition hover:bg-white hover:text-[#17352f]"
          >
            Planos
          </Link>
          <a
            href="#suporte"
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#55716a] transition hover:bg-white hover:text-[#17352f] sm:inline-flex"
          >
            Suporte
          </a>
          <Link
            to="/login"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d8e4df] bg-white px-4 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            Fazer login
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-14 pt-8 sm:px-8 sm:pb-20 sm:pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-24 lg:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-56 top-0 h-[34rem] w-[34rem] rounded-full bg-emerald-100/70 blur-3xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#dce9e3] bg-white/80 px-3.5 py-2 text-xs font-bold tracking-wide text-primary shadow-sm">
            <Sparkles size={14} />
            GESTÃO VETERINÁRIA COM MAIS LEVEZA
          </span>
          <h1 className="mt-6 max-w-2xl font-display text-4xl font-semibold leading-[1.1] tracking-tight text-[#153b33] sm:text-5xl lg:text-[3.65rem]">
            Mais tempo para cuidar. Menos tempo organizando.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#59736c] sm:text-lg sm:leading-8">
            A Oricse reúne a rotina da sua clínica veterinária em um só lugar — do primeiro contato
            ao acompanhamento clínico.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/planos"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[0_10px_25px_-12px_rgba(13,81,71,0.65)] transition hover:-translate-y-0.5 hover:bg-primary/90"
            >
              Conhecer os planos <ArrowRight size={17} />
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#d8e4df] bg-white px-5 text-sm font-bold text-[#24564b] transition hover:border-primary/40 hover:bg-[#fafffc]"
            >
              Já sou cliente · Entrar
            </Link>
            <a
              href="#suporte"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#55716a] transition hover:bg-white"
            >
              <LifeBuoy size={17} /> Obter suporte
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#607a73]">
            {["Atendimento", "Internação", "Recepção", "Financeiro"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-primary" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div
          aria-label="Áreas integradas da Oricse"
          className="relative mx-auto w-full max-w-[540px]"
        >
          <div
            aria-hidden="true"
            className="absolute inset-8 rounded-full bg-emerald-200/40 blur-3xl"
          />
          <div className="relative rounded-[2rem] border border-white bg-white/80 p-4 shadow-[0_35px_80px_-45px_rgba(22,76,63,0.35)] backdrop-blur sm:p-6">
            <div className="flex items-center justify-between border-b border-[#edf1ee] px-2 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#82968f]">
                  Tudo conectado
                </p>
                <p className="mt-1 text-base font-bold text-[#1b4038]">A rotina da clínica</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9f6f0] text-primary">
                <PawPrint size={20} />
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {solucoes.map(({ Icone, titulo, descricao }, index) => (
                <article
                  key={titulo}
                  className="rounded-2xl border border-[#edf1ee] bg-[#fcfdfb] p-4 transition hover:border-[#c9ded4] hover:bg-white"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${index === 0 ? "bg-sky-50 text-sky-700" : index === 1 ? "bg-emerald-50 text-emerald-700" : index === 2 ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700"}`}
                  >
                    <Icone size={19} strokeWidth={1.8} />
                  </span>
                  <h2 className="mt-3 text-sm font-bold text-[#21453c]">{titulo}</h2>
                  <p className="mt-1 text-xs leading-5 text-[#70837d]">{descricao}</p>
                </article>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#eff7f2] px-4 py-3">
              <ShieldCheck size={19} className="shrink-0 text-primary" />
              <p className="text-xs leading-5 text-[#496b60]">
                Informações da clínica reunidas em um ambiente feito para a rotina veterinária.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="scroll-mt-8 border-y border-[#e7eeea] bg-white/70">
        <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-9 sm:grid-cols-3 sm:px-8 lg:px-10">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f6f0] text-primary">
              <ClipboardList size={19} />
            </span>
            <div>
              <h2 className="text-sm font-bold">Fluxo mais organizado</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Cadastros, agenda e recepção em uma rotina mais clara.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <Stethoscope size={19} />
            </span>
            <div>
              <h2 className="text-sm font-bold">Cuidado acompanhado</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Prontuários e informações clínicas sempre à mão.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <WalletCards size={19} />
            </span>
            <div>
              <h2 className="text-sm font-bold">Gestão em um só lugar</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Acompanhe também caixa, serviços e estoque.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="suporte"
        className="scroll-mt-8 mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-12 sm:px-8 sm:py-16 lg:flex-row lg:items-center lg:justify-between lg:px-10"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Estamos por perto
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#17352f] sm:text-3xl">
            Precisa de uma mão? Conte com o suporte.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#647a73]">
            Fale com a equipe Oricse pelo canal de atendimento disponível para sua clínica.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {suporte ? (
            <a
              href={suporte}
              target={suporte.startsWith("http") ? "_blank" : undefined}
              rel={suporte.startsWith("http") ? "noreferrer" : undefined}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f36] px-5 text-sm font-bold text-white transition hover:bg-[#205448]"
            >
              <LifeBuoy size={17} /> Falar com suporte <ArrowRight size={16} />
            </a>
          ) : (
            <p className="inline-flex min-h-11 items-center rounded-xl border border-[#e0e9e4] bg-white px-4 text-sm text-[#647a73]">
              Canal de contato em configuração.
            </p>
          )}
          <Link
            to="/planos"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d8e4df] bg-white px-5 text-sm font-bold text-[#24564b] transition hover:border-primary/40"
          >
            Ver planos
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#e7eeea] bg-white/60">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-[#70837d] sm:px-8 lg:px-10">
          <span>
            © {new Date().getFullYear()} {marca} · Sistema veterinário
          </span>
          <div className="flex items-center gap-4">
            <Link to="/planos" className="font-semibold hover:text-primary">
              Planos
            </Link>
            <Link to="/login" className="font-semibold hover:text-primary">
              Fazer login
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

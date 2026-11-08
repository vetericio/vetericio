import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Globe2,
  Menu,
  Scissors,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Store,
  WalletCards,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oricse — Soluções para o mercado pet" },
      {
        name: "description",
        content:
          "Clínica, petshop, banho e tosa, hotelzinho, pagamentos e Portal do Tutor em uma só plataforma.",
      },
      { property: "og:title", content: "Oricse — A operação pet inteira, conectada." },
      {
        property: "og:description",
        content:
          "Gestão, atendimento, pagamentos e relacionamento para negócios que cuidam de animais.",
      },
      { property: "og:url", content: "https://oricse.com.br/" },
    ],
  }),
  component: PaginaInicial,
});

const modulos = [
  {
    icon: CalendarDays,
    titulo: "Agenda e recepção",
    descricao: "Consultas, retornos, fila de espera e agendas separadas para cada operação.",
  },
  {
    icon: Stethoscope,
    titulo: "Atendimento clínico",
    descricao: "Prontuário, receitas, documentos e histórico do paciente ao alcance da equipe.",
  },
  {
    icon: BedDouble,
    titulo: "Internação",
    descricao: "Plantões, parâmetros, medicações e evoluções sem perder o contexto do caso.",
  },
  {
    icon: Scissors,
    titulo: "Banho, tosa e hotelzinho",
    descricao: "Serviços, reservas, estadias, cuidados e rotina do pet no mesmo ambiente.",
  },
  {
    icon: WalletCards,
    titulo: "Caixa e OricsePay",
    descricao: "Comandas, pagamentos online, lançamentos e gestão financeira da clínica.",
  },
  {
    icon: Store,
    titulo: "Petshop e estoque",
    descricao: "Vendas e movimentações organizadas junto da rotina de serviços e atendimento.",
  },
] as const;

const diferenciais = [
  ["Portal do Tutor", "Agenda, pets, vacinas, receitas, exames, laudos, documentos e comandas em um acesso seguro."],
  ["OricStúdio", "Planeje conteúdo e conecte a presença digital da sua clínica sem sair da plataforma."],
  ["Seu endereço", "Cada clínica pode ter seu próprio endereço em nome.oricse.com.br e presença digital gerenciada."],
] as const;

function PreviewSistema() {
  return (
    <div className="rounded-2xl border border-[#3c1725]/10 bg-white p-3 shadow-[0_24px_50px_rgba(43,15,24,.14)] sm:p-4">
      <div className="overflow-hidden rounded-xl border border-[#ede5dd] bg-[#faf8f5]">
        <div className="flex items-center justify-between border-b border-[#ede5dd] bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/oricse-logo-oryx.svg?v=15" alt="" className="h-7 w-7" />
            <span className="text-xs font-black tracking-[.14em]">ORICSE</span>
          </div>
          <span className="rounded-full bg-[#f4e7e8] px-2.5 py-1 text-[10px] font-bold text-[#702a43]">
            PLATAFORMA
          </span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-[1.08fr_.92fr]">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8b6672]">Sua operação conectada</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {["Agenda", "Atendimento", "Internação", "Caixa", "Portal do Tutor", "OricsePay"].map((item) => (
                <div key={item} className="rounded-md border border-[#f1ebe6] bg-[#fffdfa] px-3 py-2.5 text-xs font-semibold text-[#513942]">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-[#4A1826] p-4 text-[#fffaf5]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#dcb8bd]">Do seu jeito</p>
            <p className="mt-4 font-display text-2xl font-semibold">Uma plataforma para a sua rotina.</p>
            <p className="mt-3 text-xs leading-5 text-[#f8e9ed]/75">Cada clínica organiza as próprias agendas, equipe e atendimentos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaginaInicial() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <main className="overflow-x-hidden bg-[#fbf8f4] text-[#2B0F18]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
        <Link to="/" aria-label="Oricse — início">
          <img
            src="/oricse-logo-oryx.svg?v=15"
            width="56"
            height="56"
            alt="Oricse — soluções para o mercado pet"
            className="h-11 w-auto sm:h-14"
          />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold md:flex">
          <a href="#solucoes" className="underline-offset-4 hover:underline">Soluções</a>
          <a href="#para-quem" className="underline-offset-4 hover:underline">Para quem é</a>
          <Link to="/planos" className="underline-offset-4 hover:underline">Planos</Link>
          <Link to="/login" className="rounded-lg bg-[#4A1826] px-4 py-2.5 text-[#fffaf5]">Entrar</Link>
        </nav>
        <button
          type="button"
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto(!menuAberto)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#4A1826] px-4 text-sm font-semibold text-[#fffaf5] md:hidden"
        >
          {menuAberto ? <X size={18} /> : <Menu size={18} />} Menu
        </button>
        {menuAberto && (
          <nav className="absolute right-5 top-20 z-20 grid w-56 gap-3 rounded-xl border border-[#eadfd5] bg-[#fffaf5] p-4 text-sm font-semibold shadow-xl md:hidden">
            <a href="#solucoes" onClick={() => setMenuAberto(false)}>Soluções</a>
            <a href="#para-quem" onClick={() => setMenuAberto(false)}>Para quem é</a>
            <Link to="/planos" onClick={() => setMenuAberto(false)}>Planos</Link>
            <Link to="/login" onClick={() => setMenuAberto(false)}>Entrar</Link>
          </nav>
        )}
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-8 sm:px-8 sm:pb-28 lg:grid-cols-[.9fr_1.1fr] lg:px-10 lg:pb-32 lg:pt-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[#f2e5e4] px-3 py-1.5 text-xs font-bold text-[#702a43]">
            <Sparkles size={14} /> Soluções completas para o mercado pet
          </p>
          <h1 className="mt-6 max-w-[10ch] font-display text-[clamp(45px,6.4vw,88px)] font-semibold leading-[.94] tracking-[-.055em]">
            Mais cuidado. Menos desencontro.
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-7 text-[#513942]">
            A Oricse reúne atendimento, gestão, pagamentos e relacionamento em uma plataforma feita para quem cuida de animais.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/planos" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#4A1826] px-5 font-bold text-[#fffaf5] transition hover:-translate-y-0.5">
              Conhecer a Oricse <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="font-semibold underline underline-offset-4">Já sou cliente</Link>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-[#725965]">
            <ShieldCheck size={16} className="text-[#4f8067]" /> Dados separados por clínica e acesso por perfil.
          </p>
        </div>
        <PreviewSistema />
      </section>

      <section id="para-quem" className="border-y border-[#eadfd5] bg-[#f3ece5] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#8f6071]">Feita para a rotina real</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.04em]">Um sistema para o seu tipo de negócio.</h2>
          </div>
          <div className="flex max-w-2xl flex-wrap gap-2">
            {["Veterinário em domicílio", "Clínicas de todos os portes", "Petshops", "Banho e tosa", "Hotelzinho"].map((item) => (
              <span key={item} className="rounded-full border border-[#d7c5b8] bg-[#fffaf5] px-3 py-2 text-sm font-semibold">{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="solucoes" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#8f6071]">A operação inteira conectada</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-.04em] sm:text-5xl">
            Menos abas. Mais controle.
          </h2>
          <p className="mt-4 text-[17px] leading-7 text-[#513942]">
            Cada área da Oricse conversa com a próxima para a equipe trabalhar com contexto, e não com retrabalho.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map(({ icon: Icon, titulo, descricao }) => (
            <article key={titulo} className="rounded-xl border border-[#eadfd5] bg-white p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5e9e9] text-[#702a43]"><Icon size={20} /></div>
              <h3 className="mt-5 text-lg font-bold">{titulo}</h3>
              <p className="mt-2 text-sm leading-6 text-[#654f57]">{descricao}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#4A1826] px-5 py-16 text-[#fffaf5] sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#dcb8bd]">Além da gestão</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-.04em] sm:text-5xl">
              Uma experiência que continua fora da clínica.
            </h2>
          </div>
          <div className="grid gap-4">
            {diferenciais.map(([titulo, descricao]) => (
              <article key={titulo} className="rounded-xl border border-white/15 bg-white/5 p-5">
                <h3 className="text-lg font-bold">{titulo}</h3>
                <p className="mt-2 leading-6 text-[#f8e9ed]/80">{descricao}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <div className="rounded-2xl bg-[#e9ddd1] px-6 py-10 sm:px-10 sm:py-12">
          <Globe2 className="text-[#702a43]" size={28} />
          <h2 className="mt-5 max-w-2xl font-display text-4xl font-semibold tracking-[-.04em] sm:text-5xl">
            Sua clínica pode começar organizada desde o primeiro dia.
          </h2>
          <p className="mt-4 max-w-xl text-[17px] leading-7 text-[#513942]">
            Escolha o plano, cadastre a equipe e deixe a rotina trabalhar a seu favor.
          </p>
          <Link to="/planos" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#4A1826] px-5 font-bold text-[#fffaf5]">
            Ver planos e recursos <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#eadfd5] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-sm">
          <span>© 2026 Oricse · Soluções para o mercado pet</span>
          <span className="flex gap-4">
            <Link to="/planos" className="underline">Planos</Link>
            <Link to="/login" className="underline">Entrar</Link>
            <Link to="/politica-de-privacidade" className="underline">Privacidade</Link>
          </span>
        </div>
      </footer>
    </main>
  );
}

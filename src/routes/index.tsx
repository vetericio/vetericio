import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Menu,
  PawPrint,
  ReceiptText,
  Scissors,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Store,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oricse — Soluções para o mercado pet" },
      { name: "description", content: "Gestão clínica, operacional, financeira e experiência digital para todo o mercado pet." },
      { property: "og:title", content: "Oricse — Plataforma completa para o mercado pet" },
      { property: "og:description", content: "Tudo o que o seu negócio pet precisa, em uma plataforma simples e conectada." },
      { property: "og:url", content: "https://oricse.com.br/" },
    ],
  }),
  component: PaginaInicial,
});

const solucoes = [
  { icon: Stethoscope, titulo: "Clínica e consultório", texto: "Prontuário, receitas, exames, agenda e histórico do paciente.", cor: "bg-[#4A1826] text-white" },
  { icon: Scissors, titulo: "Banho e tosa", texto: "Controle de serviços, agenda e comunicação com o tutor.", cor: "bg-[#CFA06C] text-[#2B0F18]" },
  { icon: PawPrint, titulo: "Hotelzinho", texto: "Reservas, estadias, cuidados e rotina de cada hóspede.", cor: "bg-[#668A77] text-white" },
  { icon: Store, titulo: "Pet shop", texto: "Vendas, comandas, produtos e estoque no mesmo lugar.", cor: "bg-[#6F5B95] text-white" },
];

const diferenciais = [
  ["Gestão clínica, operacional e financeira", "Cada módulo conversa com a rotina inteira do seu negócio."],
  ["Recursos para diversos modelos pet", "Da consulta em domicílio à operação com várias unidades."],
  ["Experiência digital completa para o tutor", "Agenda, documentos, vacinas e pagamentos em um acesso seguro."],
  ["Escalável para uma ou várias unidades", "Acessos, dados e permissões organizados por clínica e equipe."],
] as const;

function PainelProduto() {
  return (
    <div className="relative mx-auto w-full max-w-[660px] rounded-[26px] border border-white/70 bg-white p-3 shadow-[0_32px_90px_rgba(47,18,34,.18)]">
      <div className="overflow-hidden rounded-[18px] border border-[#eee6df] bg-[#fbf9f6]">
        <div className="flex items-center justify-between border-b border-[#eee6df] bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <img src="/oricse-logo-oryx.svg?v=15" alt="" className="h-8 w-8" />
            <span className="text-xs font-black tracking-[.18em] text-[#2B0F18]">ORICSE</span>
          </div>
          <span className="rounded-full bg-[#f4e7e8] px-3 py-1.5 text-[10px] font-bold text-[#702a43]">VISÃO GERAL</span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-xl border border-[#ede7e1] bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6a72]">Sua operação, organizada</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {["Agenda", "Consultório", "Internação", "Caixa", "Portal do Tutor", "OricsePay"].map((item) => (
                <div key={item} className="rounded-lg bg-[#faf5f1] px-3 py-3 text-xs font-bold text-[#513942]">{item}</div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-[#4A1826] p-4 text-[#fffaf5]">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#dcb8bd]">Feita para a rotina real</p>
            <p className="mt-5 font-display text-3xl font-semibold leading-[1.02]">Um sistema.<br />Seu negócio inteiro.</p>
            <div className="mt-7 flex items-center gap-2 text-xs text-[#f4dfe3]"><ShieldCheck size={16} /> Acessos por perfil e clínica</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaginaInicial() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <main className="overflow-x-hidden bg-[#FCFAF7] text-[#2B0F18]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link to="/" aria-label="Oricse — início">
          <img src="/oricse-logo-oryx.svg?v=15" width="58" height="58" alt="Oricse — soluções para o mercado pet" className="h-12 w-auto sm:h-14" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-[#513942] md:flex">
          <a href="#solucoes" className="transition hover:text-[#702a43]">Soluções</a>
          <a href="#funcionalidades" className="transition hover:text-[#702a43]">Funcionalidades</a>
          <Link to="/planos" className="transition hover:text-[#702a43]">Planos</Link>
          <Link to="/login" className="rounded-full bg-[#4A1826] px-5 py-2.5 text-white transition hover:bg-[#66243a]">Entrar</Link>
        </nav>
        <button type="button" aria-expanded={menuAberto} onClick={() => setMenuAberto(!menuAberto)} className="inline-flex items-center gap-2 rounded-full bg-[#4A1826] px-4 py-2.5 text-sm font-semibold text-white md:hidden">
          {menuAberto ? <X size={17} /> : <Menu size={17} />} Menu
        </button>
        {menuAberto && (
          <nav className="absolute right-5 top-20 z-20 grid w-56 gap-3 rounded-2xl border border-[#eadfd5] bg-white p-4 text-sm font-semibold shadow-xl md:hidden">
            <a href="#solucoes" onClick={() => setMenuAberto(false)}>Soluções</a>
            <a href="#funcionalidades" onClick={() => setMenuAberto(false)}>Funcionalidades</a>
            <Link to="/planos" onClick={() => setMenuAberto(false)}>Planos</Link>
            <Link to="/login" onClick={() => setMenuAberto(false)}>Entrar</Link>
          </nav>
        )}
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 sm:pb-28 lg:grid-cols-[.9fr_1.1fr] lg:px-10 lg:pb-32 lg:pt-16">
        <div className="relative z-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#e8dbd4] bg-white px-3 py-1.5 text-xs font-bold text-[#702a43]">
            <Sparkles size={14} /> Plataforma completa para o mercado pet
          </p>
          <h1 className="mt-6 max-w-[9ch] font-display text-[clamp(48px,6.3vw,86px)] font-semibold leading-[.94] tracking-[-.06em]">
            Gestão inteligente para o mercado pet.
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-7 text-[#5a444c]">
            Tudo o que você precisa para cuidar do seu negócio — com mais controle, eficiência e uma experiência melhor para tutores.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/planos" className="inline-flex items-center gap-2 rounded-full bg-[#4A1826] px-6 py-3.5 font-bold text-white transition hover:-translate-y-0.5">Conhecer a Oricse <ArrowRight size={18} /></Link>
            <a href="#solucoes" className="inline-flex items-center gap-2 rounded-full border border-[#d9cabe] bg-white px-6 py-3.5 font-bold text-[#4A1826]">Ver soluções <ChevronRight size={17} /></a>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-[#765e66]"><ShieldCheck size={16} className="text-[#4f8067]" /> Segurança, dados separados por clínica e acesso por perfil.</p>
        </div>
        <div className="relative">
          <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-[#ead8ca]/65 blur-3xl" />
          <div className="absolute -bottom-12 left-12 h-40 w-40 rounded-full bg-[#d8d1e6]/60 blur-3xl" />
          <PainelProduto />
        </div>
      </section>

      <section id="funcionalidades" className="border-y border-[#eadfd5] bg-[#f5efe9] px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-4">
          {diferenciais.map(([titulo, texto], index) => (
            <div key={titulo} className="border-l border-[#d9c9bd] pl-4 first:border-l-0 first:pl-0">
              <span className="font-display text-3xl font-semibold text-[#702a43]">0{index + 1}</span>
              <h2 className="mt-2 text-sm font-bold">{titulo}</h2>
              <p className="mt-1.5 text-sm leading-5 text-[#6b555d]">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="solucoes" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8f6071]">Soluções que acompanham sua rotina</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-.05em] sm:text-6xl">Um sistema para cada parte do seu negócio.</h2>
          </div>
          <Link to="/planos" className="inline-flex items-center gap-2 font-bold text-[#702a43] underline underline-offset-4">Ver planos e recursos <ArrowRight size={17} /></Link>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {solucoes.map(({ icon: Icon, titulo, texto, cor }) => (
            <article key={titulo} className={"group min-h-60 rounded-[22px] p-6 transition hover:-translate-y-1 " + cor}>
              <div className="flex items-center justify-between"><Icon size={27} /><span className="rounded-full border border-current/25 p-1.5"><ArrowRight size={15} /></span></div>
              <h3 className="mt-16 text-xl font-bold">{titulo}</h3>
              <p className="mt-2 text-sm leading-6 opacity-85">{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#4A1826] px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#dcb8bd]">Tudo conectado</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-[1] tracking-[-.05em] sm:text-6xl">Do primeiro contato ao pagamento.</h2>
            <p className="mt-5 max-w-md text-[17px] leading-7 text-[#f6e6e9]/80">Menos retrabalho para sua equipe e mais clareza para decidir, atender e crescer.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [CalendarDays, "Agenda e recepção", "Consultas, retornos, fila de espera e agendas por operação."],
              [ClipboardList, "Internação", "Plantões, medicações, parâmetros e evoluções."],
              [ReceiptText, "Portal do Tutor", "Receitas, exames, vacinas, documentos e comandas."],
              [CreditCard, "Caixa e OricsePay", "Lançamentos, pagamentos e experiência de cobrança integrada."],
            ].map(([Icon, titulo, texto]) => (
              <article key={titulo as string} className="rounded-2xl border border-white/15 bg-white/[.07] p-5">
                <Icon size={21} className="text-[#e5bc91]" />
                <h3 className="mt-8 text-lg font-bold">{titulo as string}</h3>
                <p className="mt-2 text-sm leading-6 text-[#f6e6e9]/75">{texto as string}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <div className="rounded-[28px] bg-[#e9dfd5] px-6 py-11 sm:px-12 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#8f6071]">Para todo o mercado pet</p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="max-w-3xl font-display text-4xl font-semibold tracking-[-.05em] sm:text-6xl">Sua operação tem um jeito. A Oricse acompanha.</h2>
              <div className="mt-7 flex flex-wrap gap-2">
                {["Clínicas de todos os portes", "Hospitais veterinários", "Pet shops", "Banho e tosa", "Hotelzinho", "Veterinário domiciliar"].map((item) => (
                  <span key={item} className="rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#513942]">{item}</span>
                ))}
              </div>
            </div>
            <Link to="/planos" className="inline-flex items-center gap-2 rounded-full bg-[#4A1826] px-6 py-3.5 font-bold text-white">Solicitar demonstração <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#eadfd5] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-sm text-[#624c54]">
          <div className="flex items-center gap-2 font-semibold"><img src="/oricse-logo-oryx.svg?v=15" alt="" className="h-7 w-7" /> Oricse · Soluções para o mercado pet</div>
          <div className="flex gap-4"><Link to="/planos" className="underline">Planos</Link><Link to="/login" className="underline">Entrar</Link><Link to="/politica-de-privacidade" className="underline">Privacidade</Link></div>
        </div>
      </footer>
    </main>
  );
}
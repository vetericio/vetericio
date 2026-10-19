import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oricse — Sistema para clínica veterinária e petshop" },
      {
        name: "description",
        content: "Agenda, prontuário, internação, petshop e caixa em um só sistema.",
      },
      { property: "og:title", content: "Oricse — Mais tempo para cuidar." },
      {
        property: "og:description",
        content: "Sistema de gestão para clínicas veterinárias e petshops.",
      },
      { property: "og:url", content: "https://oricse.vetericio.workers.dev/" },
    ],
  }),
  component: PaginaInicial,
});

const modulos = [
  [
    "Consultas e prontuário",
    "Registre a história de cada paciente e mantenha as informações clínicas ao alcance da equipe.",
    "Prontuário de Luna",
    "Anamnese atualizada · Receita disponível",
  ],
  [
    "Internação",
    "Acompanhe parâmetros, medicações, evoluções e trocas de plantão sem perder o contexto.",
    "Internação · Leito 04",
    "Temperatura 38,4 °C · Próxima medicação 14:00",
  ],
  [
    "Recepção e agenda",
    "Organize atendimentos, retornos, fila de espera, tutores e pacientes desde a chegada.",
    "Agenda de hoje",
    "09:30 · Thor · Consulta | 10:15 · Nina · Retorno",
  ],
  [
    "Petshop",
    "Reúna banho e tosa, vendas e estoque na mesma rotina em que a clínica funciona.",
    "Petshop · Banho e tosa",
    "Mel · banho 11:00 | Estoque: shampoo neutro",
  ],
  [
    "Caixa e gestão",
    "Tenha comandas, pagamentos e serviços registrados para acompanhar a operação diariamente.",
    "Caixa do dia",
    "Comanda #1042 · Consulta + vacina · Em aberto",
  ],
] as const;

function Painel({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return (
    <div data-ui="oricse-system-preview" className="bg-[#F5F2EE] p-4 text-[#2B0F18] sm:p-6">
      <div className="bg-white p-4 shadow-[0_18px_36px_rgba(43,15,24,.12)]">
        <div className="flex items-center justify-between border-b border-[#E9E1D6] pb-3 text-xs">
          <span className="font-bold">ORICSE</span>
          <span>Hoje</span>
        </div>
        <h4 className="mt-7 font-display text-xl font-semibold">{titulo}</h4>
        <p className="mt-3 max-w-sm text-base leading-6">{detalhe}</p>
        <div className="mt-7 h-2 w-full bg-[#E9E1D6]">
          <div className="h-full w-2/3 bg-[#4A1826]" />
        </div>
      </div>
    </div>
  );
}

function PaginaInicial() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [perfil, setPerfil] = useState("Clínica");
  return (
    <main className="overflow-x-hidden bg-[#F5F2EE] text-[#2B0F18]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
        <Link to="/" aria-label="Oricse — início">
          <img
            src="/oricse-logo-oryx.svg"
            width="56"
            height="56"
            alt="Oricse — sistema veterinário e petshop"
            className="h-10 w-auto sm:h-14"
          />
        </Link>
        <nav className="hidden items-center gap-7 text-base md:flex">
          <a href="#recursos" className="underline-offset-4 hover:underline">
            Recursos
          </a>
          <Link to="/planos" className="underline-offset-4 hover:underline">
            Planos
          </Link>
          <a href="#suporte" className="underline-offset-4 hover:underline">
            Suporte
          </a>
          <Link to="/login" className="underline underline-offset-4">
            Entrar
          </Link>
        </nav>
        <button
          type="button"
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto(!menuAberto)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#4A1826] px-4 text-sm font-semibold text-[#F5F2EE] md:hidden"
        >
          {menuAberto ? <X size={18} /> : <Menu size={18} />} Menu
        </button>
        {menuAberto && (
          <nav className="absolute right-5 top-20 z-20 grid w-56 gap-2 bg-[#F5F2EE] p-4 shadow-xl md:hidden">
            <a href="#recursos" onClick={() => setMenuAberto(false)}>
              Recursos
            </a>
            <Link to="/planos" onClick={() => setMenuAberto(false)}>
              Planos
            </Link>
            <a href="#suporte" onClick={() => setMenuAberto(false)}>
              Suporte
            </a>
            <Link to="/login" onClick={() => setMenuAberto(false)}>
              Entrar
            </Link>
          </nav>
        )}
      </header>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-24 pt-10 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:px-10 lg:pb-40 lg:pt-20">
        <div>
          <h1 className="max-w-[8ch] font-display text-[clamp(44px,7.1vw,100px)] font-semibold leading-[.95] tracking-[-.055em]">
            Mais tempo para cuidar.
          </h1>
          <p className="mt-7 max-w-xl text-[17px] leading-7">
            A Oricse organiza agenda, prontuário, internação, petshop e caixa da sua clínica em um
            só sistema.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Link
              to="/planos"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#4A1826] px-5 font-bold text-[#F5F2EE] transition hover:-translate-y-0.5"
            >
              Conhecer os planos <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="font-semibold underline underline-offset-4">
              Já sou cliente — entrar
            </Link>
          </div>
        </div>
        <Painel
          titulo="Agenda de hoje"
          detalhe="09:30 · Thor · Consulta | 10:15 · Nina · Retorno | 11:00 · Mel · Banho e tosa"
        />
      </section>
      <section id="recursos" className="bg-[#E9E1D6] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <h2 className="max-w-xl font-display text-4xl font-semibold leading-tight tracking-[-.04em] sm:text-5xl">
            A clínica inteira no mesmo ritmo.
          </h2>
          <div className="mt-16 space-y-20 sm:mt-24">
            {modulos.map(([titulo, descricao, painel, detalhe], i) => (
              <article key={titulo} className="grid items-center gap-9 lg:grid-cols-2 lg:gap-20">
                <div className={i % 2 ? "lg:order-2" : ""}>
                  <h3 className="font-display text-2xl font-semibold sm:text-3xl">{titulo}</h3>
                  <p className="mt-4 max-w-lg text-[17px] leading-7">{descricao}</p>
                </div>
                <Painel titulo={painel} detalhe={detalhe} />
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
        <div className="max-w-3xl">
          <h2 className="font-display text-4xl font-semibold tracking-[-.04em] sm:text-5xl">
            Como é o seu negócio?
          </h2>
          <p className="mt-4 text-[17px] leading-7">
            Escolha um perfil para ver por onde começar. Todos os recursos continuam disponíveis
            para consulta.
          </p>
          <div className="mt-7 flex flex-wrap gap-3" role="group" aria-label="Perfil do negócio">
            {["Clínica", "Petshop", "Clínica + Petshop"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPerfil(item)}
                className={
                  "rounded-lg px-4 py-3 font-semibold transition " +
                  (perfil === item ? "bg-[#4A1826] text-[#F5F2EE]" : "bg-[#E9E1D6]")
                }
              >
                {item}
              </button>
            ))}
          </div>
          <p className="mt-6 text-lg">
            <strong>{perfil}:</strong> agenda, atendimento e gestão conectados à rotina da sua
            equipe.
          </p>
          <Link
            to="/planos"
            className="mt-7 inline-block font-semibold underline underline-offset-4"
          >
            Ver plano recomendado
          </Link>
        </div>
      </section>
      <section className="bg-[#4A1826] px-5 py-20 text-[#F5F2EE] sm:px-8 sm:py-28 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-display text-4xl font-semibold tracking-[-.04em] sm:text-5xl">
            Comece com clareza.
          </h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {["Escolha o plano", "Cadastre a equipe e importe os dados", "Comece a atender"].map(
              (item, index) => (
                <li key={item} className="text-lg">
                  <span className="block text-[#C59A5C]">{index + 1}</span>
                  <strong className="mt-2 block">{item}</strong>
                </li>
              ),
            )}
          </ol>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {["Essencial", "Plus (Clínica)", "Master (Equipe)"].map((nome) => (
              <div key={nome}>
                <h3 className="text-2xl font-semibold">{nome}</h3>
                <p className="mt-2 text-[#F5F2EE]/80">
                  Confira valores, recursos e usuários incluídos.
                </p>
              </div>
            ))}
          </div>
          <Link
            to="/planos"
            className="mt-10 inline-flex min-h-12 items-center rounded-lg bg-[#F5F2EE] px-5 font-bold text-[#4A1826]"
          >
            Ver todos os detalhes
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
        <h2 className="font-display text-4xl font-semibold tracking-[-.04em] sm:text-5xl">
          Perguntas frequentes
        </h2>
        <div className="mt-10 max-w-3xl divide-y divide-[#E9E1D6]">
          {[
            [
              "Funciona no celular?",
              "Sim. A Oricse foi pensada para acompanhar a rotina da clínica também fora do computador.",
            ],
            [
              "Meus dados ficam seguros?",
              "O acesso é individual e os dados de cada clínica permanecem separados.",
            ],
            [
              "Há fidelidade?",
              "Os detalhes de cada modalidade e forma de pagamento estão na página de planos.",
            ],
            [
              "Como funciona o suporte?",
              "Nossa equipe atende por WhatsApp e e-mail nos canais abaixo.",
            ],
          ].map(([q, a]) => (
            <details key={q} className="py-5">
              <summary className="cursor-pointer text-lg font-semibold">{q}</summary>
              <p className="mt-3 text-[17px] leading-7">{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section id="suporte" className="bg-[#E9E1D6] px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-display text-4xl font-semibold tracking-[-.04em] sm:text-5xl">
            Precisa de ajuda? Fale com a gente.
          </h2>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 text-lg">
            <a
              className="font-semibold underline underline-offset-4"
              href="https://wa.me/5531995512795"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp: (31) 99551-2795
            </a>
            <a
              className="font-semibold underline underline-offset-4"
              href="mailto:vetericio@gmail.com"
            >
              vetericio@gmail.com
            </a>
          </div>
        </div>
      </section>
      <footer className="bg-[#F5F2EE] px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="font-display text-5xl font-semibold tracking-[-.06em] sm:text-7xl">
            Oricse
          </p>
          <div className="mt-8 flex flex-wrap justify-between gap-4 text-sm">
            <span>© 2026 Oricse · Sistema veterinário e petshop</span>
            <span>
              <Link to="/planos" className="underline">
                Planos
              </Link>{" "}
              ·{" "}
              <Link to="/login" className="underline">
                Entrar
              </Link>{" "}
              ·{" "}
              <a href="#suporte" className="underline">
                Suporte
              </a>
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

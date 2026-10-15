import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BedDouble,
  ClipboardList,
  Lock,
  Stethoscope,
  WalletCards,
} from "lucide-react";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { usePermissoes } from "@/hooks/usePermissoes";

export const Route = createFileRoute("/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Oricse" },
      {
        name: "description",
        content: "Acesse rapidamente os espaços da sua clínica veterinária.",
      },
    ],
  }),
  component: Inicio,
});

const areas = [
  {
    to: "/internacao",
    permissao: "internacao.painel",
    numero: "01",
    titulo: "Internação",
    descricao: "Plantões, pacientes internados e acompanhamento dos cuidados.",
    acao: "Acessar internação",
    Icone: BedDouble,
    iconeClass: "bg-emerald-500/10 text-emerald-700",
    detalhe: "CUIDADO CONTÍNUO",
  },
  {
    to: "/consultorio",
    permissao: "consultorio.atendimentos",
    numero: "02",
    titulo: "Consultas",
    descricao: "Atendimentos, prontuários e documentos em um só lugar.",
    acao: "Acessar consultas",
    Icone: Stethoscope,
    iconeClass: "bg-sky-500/10 text-sky-700",
    detalhe: "ATENDIMENTO CLÍNICO",
  },
  {
    to: "/recepcao",
    permissao: "recepcao.agenda",
    numero: "03",
    titulo: "Recepção",
    descricao: "Organize a chegada, a fila de espera e os agendamentos.",
    acao: "Acessar recepção",
    Icone: ClipboardList,
    iconeClass: "bg-amber-500/10 text-amber-700",
    detalhe: "ROTINA ORGANIZADA",
  },
  {
    to: "/financeiro",
    permissao: "caixa.financeiro.visualizar",
    numero: "04",
    titulo: "Caixa",
    descricao: "Acompanhe entradas, despesas e valores a receber.",
    acao: "Acessar caixa",
    Icone: WalletCards,
    iconeClass: "bg-violet-500/10 text-violet-700",
    detalhe: "GESTÃO FINANCEIRA",
  },
] as const;

function Inicio() {
  const { marca } = useSiteBranding();
  const { carregando, pode, bloqueadaPeloPlano } = usePermissoes();
  const areasVisiveis = carregando
    ? areas
    : areas.filter((area) => pode(area.permissao) || bloqueadaPeloPlano(area.permissao));

  return (
    <main className="relative mx-auto min-h-[65vh] w-full max-w-6xl overflow-hidden px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-primary/5 blur-3xl"
      />
      <section className="relative">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-card/80 px-3 py-1.5 text-xs font-semibold tracking-wide text-primary shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {marca}
          <span className="text-muted-foreground">·</span>
          Espaço de trabalho
        </div>
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Cuidar da clínica começa por aqui.
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Escolha uma área para continuar. Tudo o que a sua equipe precisa,
            com mais clareza e leveza no dia a dia.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:mt-8">
          {areasVisiveis.map(({ to, permissao, numero, titulo, descricao, acao, Icone, iconeClass, detalhe }) => {
            const bloqueado = !carregando && bloqueadaPeloPlano(permissao);
            const conteudo = <>
              <span
                aria-hidden="true"
                className="absolute -right-5 -top-7 font-display text-7xl font-semibold tracking-tighter text-foreground/[0.035]"
              >
                {numero}
              </span>
              <div className="relative flex items-start justify-between gap-4">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconeClass}`}>
                  <Icone aria-hidden="true" size={20} strokeWidth={1.8} />
                </span>
                <span className="pt-1 text-[10px] font-bold tracking-[0.16em] text-muted-foreground">
                  {detalhe}
                </span>
              </div>
              <div className="relative mt-3">
                <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
                  {titulo}
                </h2>
                <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
                  {descricao}
                </p>
              </div>
              <span className={`relative mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold ${bloqueado ? "text-muted-foreground" : "text-primary"}`}>
                {bloqueado ? <><Lock aria-hidden="true" size={15}/> Não incluído no plano</> : <>{acao}<ArrowUpRight aria-hidden="true" size={16} /></>}
              </span>
            </>;

            if (bloqueado) {
              return <div key={to} aria-disabled="true" className="relative flex min-h-44 cursor-not-allowed flex-col overflow-hidden rounded-2xl border border-dashed border-border/80 bg-muted/30 p-4 opacity-60 sm:p-5">
                {conteudo}
              </div>;
            }

            return <Link
              key={to}
              to={to}
              className="group relative flex min-h-44 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md sm:p-5"
            >
              {conteudo}
            </Link>;
          })}
        </div>
      </section>
    </main>
  );
}

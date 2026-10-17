import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BedDouble,
  Building2,
  ClipboardList,
  Lock,
  ShieldCheck,
  Stethoscope,
  WalletCards,
} from "lucide-react";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { usePermissoes } from "@/hooks/usePermissoes";
import { supabase } from "@/integrations/supabase/client";
import {
  limparContextoAdminClinica,
  salvarContextoAdminClinica,
  type PerfilAdminClinica,
} from "@/lib/admin-clinic-context";

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
    perfil: "internacao",
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
    perfil: "consultorio",
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
    perfil: "recepcao",
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
    perfil: "caixa",
    numero: "04",
    titulo: "Caixa",
    descricao: "Acompanhe entradas, despesas e valores a receber.",
    acao: "Acessar caixa",
    Icone: WalletCards,
    iconeClass: "bg-violet-500/10 text-violet-700",
    detalhe: "GESTÃO FINANCEIRA",
  },
] as const;

type ClinicaAdmin = {
  id: string;
  nome: string;
  slug: string | null;
  status: string | null;
};

function normalizarUsuario(valor: unknown) {
  return String(valor || "").trim().replace(/^@+/, "").toLowerCase();
}

function Inicio() {
  const navigate = useNavigate();
  const { marca } = useSiteBranding();
  const { carregando, pode, bloqueadaPeloPlano } = usePermissoes();
  const [verificandoUsuario, setVerificandoUsuario] = useState(true);
  const [eVetAdmin27, setEVetAdmin27] = useState(false);
  const [clinicas, setClinicas] = useState<ClinicaAdmin[]>([]);
  const [clinicaId, setClinicaId] = useState("");
  const [carregandoClinicas, setCarregandoClinicas] = useState(false);
  const [erroClinicas, setErroClinicas] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user?.id) return;
        const { data: perfil } = await (supabase as any)
          .from("app_users")
          .select("username,role")
          .eq("user_id", auth.user.id)
          .maybeSingle();
        if (!ativo) return;
        setEVetAdmin27(
          perfil?.role === "admin" &&
          normalizarUsuario(perfil?.username) === "vetadmin27",
        );
      } finally {
        if (ativo) setVerificandoUsuario(false);
      }
    })();
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!eVetAdmin27) return;
    let ativo = true;
    setCarregandoClinicas(true);
    setErroClinicas("");
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("clinicas")
        .select("id,nome,slug,status")
        .order("nome");
      if (!ativo) return;
      if (error) {
        setErroClinicas(error.message || "Não foi possível carregar as clínicas.");
        setClinicas([]);
      } else {
        const lista = ((data || []) as ClinicaAdmin[]).filter(
          (clinica) => clinica.status !== "cancelada",
        );
        setClinicas(lista);
        setClinicaId((atual) => atual || lista[0]?.id || "");
      }
      setCarregandoClinicas(false);
    })();
    return () => { ativo = false; };
  }, [eVetAdmin27]);

  const entrarComo = (perfil: PerfilAdminClinica, destino: string) => {
    const clinica = clinicas.find((item) => item.id === clinicaId);
    if (!clinica) {
      setErroClinicas("Selecione uma clínica antes de entrar.");
      return;
    }
    salvarContextoAdminClinica({
      clinicaId: clinica.id,
      clinicaNome: clinica.nome,
      clinicaSlug: clinica.slug || "",
      perfil,
    });
    void navigate({ to: destino as never });
  };

  if (verificandoUsuario) {
    return (
      <main className="mx-auto flex min-h-[65vh] w-full max-w-6xl items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Carregando o início…</p>
      </main>
    );
  }

  if (eVetAdmin27) {
    const clinicaAtual = clinicas.find((item) => item.id === clinicaId);
    return (
      <main className="relative mx-auto min-h-[65vh] w-full max-w-6xl overflow-hidden px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <section className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-card/80 px-3 py-1.5 text-xs font-semibold tracking-wide text-primary shadow-sm">
            <ShieldCheck size={15} />
            Acesso exclusivo · @vetadmin27
          </div>
          <div className="max-w-3xl">
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              Escolha a clínica e o perfil de acesso.
            </h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground sm:text-lg">
              Você visualizará somente os dados da clínica selecionada durante este acesso.
            </p>
          </div>

          <div className="mt-7 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
            <label htmlFor="clinica-admin" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 size={18} className="text-primary" />
              Clínica
            </label>
            <select
              id="clinica-admin"
              value={clinicaId}
              onChange={(event) => {
                setClinicaId(event.target.value);
                setErroClinicas("");
              }}
              disabled={carregandoClinicas}
              className="mt-3 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base font-medium outline-none focus:border-primary"
            >
              {!clinicas.length && <option value="">Nenhuma clínica disponível</option>}
              {clinicas.map((clinica) => (
                <option key={clinica.id} value={clinica.id}>
                  {clinica.nome}{clinica.slug ? ` · /${clinica.slug}` : ""}
                </option>
              ))}
            </select>
            {clinicaAtual && (
              <p className="mt-2 text-xs text-muted-foreground">
                Clínica selecionada: <strong className="text-foreground">{clinicaAtual.nome}</strong>
              </p>
            )}
            {erroClinicas && <p className="mt-2 text-sm font-medium text-red-600">{erroClinicas}</p>}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {areas.map(({ to, perfil, numero, titulo, descricao, Icone, iconeClass, detalhe }) => (
              <button
                key={perfil}
                type="button"
                disabled={!clinicaId || carregandoClinicas}
                onClick={() => entrarComo(perfil, to)}
                className="group relative flex min-h-44 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 sm:p-5"
              >
                <span aria-hidden="true" className="absolute -right-5 -top-7 font-display text-7xl font-semibold tracking-tighter text-foreground/[0.035]">
                  {numero}
                </span>
                <div className="relative flex items-start justify-between gap-4">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconeClass}`}>
                    <Icone aria-hidden="true" size={20} strokeWidth={1.8} />
                  </span>
                  <span className="pt-1 text-[10px] font-bold tracking-[0.16em] text-muted-foreground">{detalhe}</span>
                </div>
                <div className="relative mt-3">
                  <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">{titulo}</h2>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{descricao}</p>
                </div>
                <span className="relative mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-primary">
                  Entrar neste perfil <ArrowUpRight aria-hidden="true" size={16} />
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              limparContextoAdminClinica();
              window.location.assign("/admin");
            }}
            className="mt-4 flex min-h-16 w-full items-center justify-between rounded-2xl border border-primary/20 bg-primary px-5 text-left text-primary-foreground shadow-sm transition hover:opacity-95"
          >
            <span>
              <strong className="block font-display text-lg">Admin da plataforma</strong>
              <span className="text-sm opacity-80">Gerenciar clínicas, planos, usuários e configurações gerais.</span>
            </span>
            <ShieldCheck aria-hidden="true" size={24} />
          </button>
        </section>
      </main>
    );
  }

  const areasVisiveis = carregando
    ? areas
    : areas.filter((area) => pode(area.permissao) || bloqueadaPeloPlano(area.permissao));

  return (
    <main className="relative mx-auto min-h-[65vh] w-full max-w-6xl overflow-hidden px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
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
              <span aria-hidden="true" className="absolute -right-5 -top-7 font-display text-7xl font-semibold tracking-tighter text-foreground/[0.035]">
                {numero}
              </span>
              <div className="relative flex items-start justify-between gap-4">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconeClass}`}>
                  <Icone aria-hidden="true" size={20} strokeWidth={1.8} />
                </span>
                <span className="pt-1 text-[10px] font-bold tracking-[0.16em] text-muted-foreground">{detalhe}</span>
              </div>
              <div className="relative mt-3">
                <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">{titulo}</h2>
                <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">{descricao}</p>
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

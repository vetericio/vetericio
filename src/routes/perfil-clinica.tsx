import { createFileRoute } from "@tanstack/react-router";
import { Building2, Clock3, Save, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/perfil-clinica")({
  head: () => ({
    meta: [
      { title: "Perfil da clínica — Oricse" },
      { name: "description", content: "Configurações operacionais da clínica na Oricse." },
    ],
  }),
  component: PerfilClinica,
});

type Papel = "rt" | "veterinario" | "auxiliar_estagiario" | "recepcao" | string;
type Duracoes = Record<string, number>;

type ClinicaPerfil = {
  id: string;
  nome: string;
  duracao_padrao_atendimento_min: number;
  duracoes_atendimento_min: Duracoes;
  papel: Papel;
};

const OPCOES_INTERVALO = [10, 15, 20, 30, 45, 60];
const TIPOS = ["Consulta", "Retorno", "Cirurgia", "Banho e Tosa", "Vacina", "Procedimento"] as const;
const DURACOES_PADRAO: Duracoes = {
  Consulta: 30,
  Retorno: 30,
  Cirurgia: 120,
  "Banho e Tosa": 60,
  Vacina: 30,
  Procedimento: 30,
};

function PerfilClinica() {
  const [perfil, setPerfil] = useState<ClinicaPerfil | null>(null);
  const [intervalo, setIntervalo] = useState(30);
  const [duracoes, setDuracoes] = useState<Duracoes>(DURACOES_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const podeEditar = perfil?.papel === "rt" || perfil?.papel === "recepcao";
  const opcaoSelecionada = useMemo(
    () => OPCOES_INTERVALO.includes(intervalo) ? String(intervalo) : "personalizado",
    [intervalo],
  );

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) throw new Error("Sessão não encontrada.");

        const { data: vinculo, error: erroVinculo } = await (supabase as any)
          .from("clinica_usuarios")
          .select("clinica_id,papel")
          .eq("user_id", userId)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (erroVinculo) throw erroVinculo;
        if (!vinculo?.clinica_id) throw new Error("Usuário não vinculado a uma clínica.");

        const { data: clinica, error: erroClinica } = await (supabase as any)
          .from("clinicas")
          .select("id,nome,duracao_padrao_atendimento_min,duracoes_atendimento_min")
          .eq("id", vinculo.clinica_id)
          .maybeSingle();
        if (erroClinica) throw erroClinica;
        if (!clinica?.id) throw new Error("Clínica não encontrada.");

        const intervaloSalvo = Math.max(5, Number(clinica.duracao_padrao_atendimento_min) || 30);
        const salvas = { ...DURACOES_PADRAO, ...(clinica.duracoes_atendimento_min || {}) };
        if (!ativo) return;
        setPerfil({
          id: clinica.id,
          nome: clinica.nome,
          duracao_padrao_atendimento_min: intervaloSalvo,
          duracoes_atendimento_min: salvas,
          papel: vinculo.papel,
        });
        setIntervalo(intervaloSalvo);
        setDuracoes(salvas);
      } catch (e) {
        if (ativo) toast.error((e as Error).message || "Não foi possível carregar o perfil da clínica.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, []);

  function alterarDuracao(tipo: string, valor: number) {
    setDuracoes((atual) => ({ ...atual, [tipo]: valor }));
  }

  async function salvar() {
    if (!podeEditar) return toast.error("Somente o RT ou a Recepção podem alterar esta configuração.");
    const intervaloMin = Math.round(Number(intervalo));
    if (!Number.isFinite(intervaloMin) || intervaloMin < 5 || intervaloMin > 720) {
      return toast.error("Informe um intervalo entre 5 e 720 minutos.");
    }

    for (const tipo of TIPOS) {
      const minutos = Math.round(Number(duracoes[tipo]));
      if (!Number.isFinite(minutos) || minutos < 5 || minutos > 720) {
        return toast.error(`Informe uma duração válida para ${tipo}.`);
      }
    }

    setSalvando(true);
    try {
      const payload = Object.fromEntries(TIPOS.map((tipo) => [tipo, Math.round(Number(duracoes[tipo]))]));
      const { error } = await (supabase as any).rpc("set_my_clinic_agenda_settings", {
        p_interval_minutes: intervaloMin,
        p_durations: payload,
      });
      if (error) throw error;
      setPerfil((atual) => atual ? {
        ...atual,
        duracao_padrao_atendimento_min: intervaloMin,
        duracoes_atendimento_min: payload,
      } : atual);
      toast.success("Configurações da agenda salvas.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível salvar a configuração.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <main className="mx-auto w-full max-w-4xl px-4 py-8"><div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Carregando perfil da clínica...</div></main>;
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-12 pt-4">
      <header className="mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 size={22} /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Perfil da clínica</h1>
            <p className="text-sm text-muted-foreground">{perfil?.nome || "Clínica"}</p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 text-primary" size={21} />
          <div>
            <h2 className="text-lg font-bold text-foreground">Intervalo dos horários da agenda</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Define de quanto em quanto tempo os horários aparecem no seletor e na grade da agenda.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="text-sm font-semibold text-foreground">
            Intervalo da grade
            <select
              value={opcaoSelecionada}
              disabled={!podeEditar}
              onChange={(e) => {
                if (e.target.value !== "personalizado") setIntervalo(Number(e.target.value));
                else if (OPCOES_INTERVALO.includes(intervalo)) setIntervalo(25);
              }}
              className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 font-normal"
            >
              {OPCOES_INTERVALO.map((min) => <option key={min} value={min}>{min} minutos</option>)}
              <option value="personalizado">Personalizado</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-foreground">
            Minutos
            <input
              type="number"
              min={5}
              max={720}
              step={5}
              value={intervalo}
              disabled={!podeEditar}
              onChange={(e) => setIntervalo(Number(e.target.value))}
              className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 font-normal"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl bg-secondary/50 p-4 text-sm text-foreground">
          <strong>Exemplo com {intervalo || 30} min:</strong>{" "}
          8h00 → {formatarExemplo(8 * 60 + (intervalo || 30))} → {formatarExemplo(8 * 60 + 2 * (intervalo || 30))}.
        </div>
      </section>

      <section className="mt-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Stethoscope className="mt-0.5 text-primary" size={21} />
          <div>
            <h2 className="text-lg font-bold text-foreground">Tempo de cada atendimento</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Você determina quanto tempo cada tipo de atendimento ocupa na agenda. A Oricse bloqueia todos os horários abrangidos por esse período.
            </p>
          </div>
        </div>

        <div className="mt-5 divide-y rounded-xl border bg-background">
          {TIPOS.map((tipo) => (
            <div key={tipo} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground">{tipo}</div>
                <div className="text-xs text-muted-foreground">Ocupa {formatarDuracao(duracoes[tipo] || 30)} na agenda</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={720}
                  step={5}
                  value={duracoes[tipo] ?? 30}
                  disabled={!podeEditar}
                  onChange={(e) => alterarDuracao(tipo, Number(e.target.value))}
                  className="h-10 w-24 rounded-lg border bg-background px-3 text-right font-semibold"
                />
                <span className="w-8 text-sm text-muted-foreground">min</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm text-foreground">
          <strong>Exemplo:</strong> se Cirurgia estiver configurada para 120 min e for marcada às 10h, a agenda fica ocupada de <strong>10h às 12h</strong>.
        </div>

        {!podeEditar && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            Seu perfil pode visualizar esta configuração. A alteração fica disponível para RT e Recepção.
          </p>
        )}

        <button
          type="button"
          disabled={!podeEditar || salvando}
          onClick={salvar}
          className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={17} /> {salvando ? "Salvando..." : "Salvar configurações da agenda"}
        </button>
      </section>
    </main>
  );
}

function formatarExemplo(total: number) {
  const minutosDia = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(minutosDia / 60);
  const m = minutosDia % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function formatarDuracao(minutos: number) {
  const valor = Math.max(0, Number(minutos) || 0);
  const horas = Math.floor(valor / 60);
  const resto = valor % 60;
  if (horas && resto) return `${horas}h${String(resto).padStart(2, "0")}`;
  if (horas) return `${horas}h`;
  return `${resto} min`;
}

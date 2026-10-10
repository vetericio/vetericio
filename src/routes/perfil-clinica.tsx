import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Save, Building2 } from "lucide-react";
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

type ClinicaPerfil = {
  id: string;
  nome: string;
  duracao_padrao_atendimento_min: number;
  papel: Papel;
};

const OPCOES = [15, 20, 30, 45, 60, 90];

function PerfilClinica() {
  const [perfil, setPerfil] = useState<ClinicaPerfil | null>(null);
  const [duracao, setDuracao] = useState(30);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const podeEditar = perfil?.papel === "rt" || perfil?.papel === "recepcao";
  const opcaoSelecionada = useMemo(() => OPCOES.includes(duracao) ? String(duracao) : "personalizado", [duracao]);

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
          .select("id,nome,duracao_padrao_atendimento_min")
          .eq("id", vinculo.clinica_id)
          .maybeSingle();
        if (erroClinica) throw erroClinica;
        if (!clinica?.id) throw new Error("Clínica não encontrada.");

        const minutos = Math.max(5, Number(clinica.duracao_padrao_atendimento_min) || 30);
        if (!ativo) return;
        setPerfil({ id: clinica.id, nome: clinica.nome, duracao_padrao_atendimento_min: minutos, papel: vinculo.papel });
        setDuracao(minutos);
      } catch (e) {
        if (ativo) toast.error((e as Error).message || "Não foi possível carregar o perfil da clínica.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, []);

  async function salvar() {
    if (!podeEditar) return toast.error("Somente o RT ou a Recepção podem alterar esta configuração.");
    const minutos = Math.round(Number(duracao));
    if (!Number.isFinite(minutos) || minutos < 5 || minutos > 720) {
      return toast.error("Informe uma duração entre 5 e 720 minutos.");
    }
    setSalvando(true);
    try {
      const { data, error } = await (supabase as any).rpc("set_my_clinic_appointment_duration", { p_minutes: minutos });
      if (error) throw error;
      const salvo = Number(data) || minutos;
      setDuracao(salvo);
      setPerfil((atual) => atual ? { ...atual, duracao_padrao_atendimento_min: salvo } : atual);
      toast.success(`Duração padrão alterada para ${salvo} minutos.`);
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível salvar a configuração.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <main className="mx-auto w-full max-w-3xl px-4 py-8"><div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Carregando perfil da clínica...</div></main>;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-4">
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
            <h2 className="text-lg font-bold text-foreground">Duração padrão dos atendimentos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A clínica decide quanto tempo cada horário ocupa na agenda. Esse intervalo é usado para organizar os horários e impedir dois atendimentos no mesmo período.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="text-sm font-semibold text-foreground">
            Intervalo padrão
            <select
              value={opcaoSelecionada}
              disabled={!podeEditar}
              onChange={(e) => {
                if (e.target.value !== "personalizado") setDuracao(Number(e.target.value));
                else if (OPCOES.includes(duracao)) setDuracao(25);
              }}
              className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 font-normal"
            >
              {OPCOES.map((min) => <option key={min} value={min}>{min} minutos</option>)}
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
              value={duracao}
              disabled={!podeEditar}
              onChange={(e) => setDuracao(Number(e.target.value))}
              className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 font-normal"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl bg-secondary/50 p-4 text-sm text-foreground">
          <strong>Exemplo com {duracao || 30} min:</strong>{" "}
          8h00 → {formatarExemplo(8 * 60 + (duracao || 30))} → {formatarExemplo(8 * 60 + 2 * (duracao || 30))}.
          <span className="mt-1 block text-xs text-muted-foreground">Se um período já estiver ocupado, a Oricse bloqueia outro agendamento que se sobreponha a ele.</span>
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
          <Save size={17} /> {salvando ? "Salvando..." : "Salvar configuração"}
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

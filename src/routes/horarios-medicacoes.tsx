import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, PawPrint } from "lucide-react";
import { useRegistros } from "@/hooks/useRegistros";
import { nomeMedicacao, type Medicacao } from "@/lib/ficha";
import { emojiEspecie } from "@/lib/anamnese";

export const Route = createFileRoute("/horarios-medicacoes")({
  component: HorariosMedicacoes,
});

type DoseAgendada = {
  id: string;
  horario: Date;
  animal: string;
  especie: string;
  tutor: string;
  baia: string;
  medicamento: Medicacao;
  peso: string;
};

function numeroPtBr(valor: string) {
  const numero = Number(valor.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

function intervaloEmHoras(duracao: string) {
  const match = duracao.match(/(?:a\s*cada\s*)?(\d+(?:[,.]\d+)?)\s*h(?:oras?)?/i);
  if (!match) return null;
  const horas = Number(match[1].replace(",", "."));
  return Number.isFinite(horas) && horas > 0 ? horas : null;
}

function montarHorariosHoje(horarioInicial: string, intervalo: string, agora: Date) {
  const [hora, minuto] = horarioInicial.split(":").map(Number);
  if (!Number.isFinite(hora) || !Number.isFinite(minuto)) return [];

  const primeiraDoseHoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
    hora,
    minuto,
  );
  const horas = intervaloEmHoras(intervalo);
  if (!horas) return primeiraDoseHoje >= agora ? [primeiraDoseHoje] : [];

  const passoMs = horas * 60 * 60 * 1000;
  const limite = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  let dose = new Date(primeiraDoseHoje.getTime() - passoMs * Math.ceil(24 / horas));
  const horarios: Date[] = [];
  while (dose < limite) {
    if (dose >= agora) horarios.push(new Date(dose));
    dose = new Date(dose.getTime() + passoMs);
  }
  return horarios;
}

function doseTotal(medicamento: Medicacao, peso: string) {
  const dose = medicamento.dose.match(/([\d,.]+)\s*mg\s*\/\s*kg/i);
  const kg = numeroPtBr(peso);
  if (!dose || kg === null) return "";
  const porKg = Number(dose[1].replace(",", "."));
  if (!Number.isFinite(porKg)) return "";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(porKg * kg)} mg total`;
}

function formatarHorario(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    ...(data.toDateString() !== new Date().toDateString() ? { weekday: "short" } : {}),
  }).format(data);
}

function HorariosMedicacoes() {
  const { registros, carregado } = useRegistros();
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const doses = useMemo(() => {
    return registros
      .filter((registro) => !registro.obito)
      .flatMap((registro) =>
        (registro.medicacoes ?? []).flatMap((medicamento, indice) => {
          if (!medicamento.horarioInicial) return [];
          return montarHorariosHoje(medicamento.horarioInicial, medicamento.duracao, agora).map(
            (horario) => ({
              id: `${registro.id}-${indice}-${horario.toISOString()}`,
              horario,
              animal: registro.animal,
              especie: registro.especie ?? "",
              tutor: registro.tutor?.trim() || "Não informado",
              baia: registro.baia?.trim() || "Não informada",
              medicamento,
              peso: registro.peso ?? medicamento.peso?.replace(/\s*kg/i, "") ?? "",
            }),
          );
        }),
      )
      .sort((a, b) => a.horario.getTime() - b.horario.getTime());
  }, [registros, agora]);

  const semHorario = registros.flatMap((registro) =>
    !registro.obito
      ? (registro.medicacoes ?? [])
          .filter((medicamento) => !medicamento.horarioInicial)
          .map((medicamento) => `${registro.id}-${nomeMedicacao(medicamento)}`)
      : [],
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-5">
      <Link
        to="/internacao"
        className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary"
      >
        <ArrowLeft size={17} /> Voltar à internação
      </Link>

      <header className="mt-3 rounded-2xl bg-primary px-5 py-5 text-primary-foreground">
        <p className="flex items-center gap-2 text-sm font-semibold opacity-85">
          <Clock3 size={17} /> INTERNAÇÃO
        </p>
        <h1 className="mt-1 text-2xl font-bold">Horários das medicações</h1>
        <p className="mt-1 text-sm opacity-85">
          Próximas doses dos animais internados, organizadas por horário.
        </p>
      </header>

      {carregado && doses.length === 0 && (
        <section className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center">
          <PawPrint className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-2 font-semibold">Nenhuma dose programada para as próximas 24 horas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nas medicações da ficha de internação, informe o horário da primeira dose para ela
            aparecer nesta agenda.
          </p>
          {semHorario.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {semHorario.length} medicação(ões) ainda sem horário definido.
            </p>
          )}
          <Link
            to="/registros"
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Abrir animais internados
          </Link>
        </section>
      )}

      <div className="mt-4 space-y-3">
        {doses.map((dose) => {
          const total = doseTotal(dose.medicamento, dose.peso);
          return (
            <article
              key={dose.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <span className="rounded-xl bg-primary/10 px-3 py-2 text-lg font-bold tabular-nums text-primary">
                  {formatarHorario(dose.horario)}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-foreground">
                    {emojiEspecie(dose.especie as "Cachorro" | "Gato")}{" "}
                    {dose.animal || "Animal sem nome"}
                    <span className="ml-1 font-medium text-muted-foreground">
                      ({dose.especie || "espécie não informada"})
                    </span>
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">Tutor: {dose.tutor}</p>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                  {dose.baia}
                </span>
              </div>
              <div className="pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Medicação
                </p>
                <p className="mt-1 text-base font-bold text-foreground">
                  {nomeMedicacao(dose.medicamento)}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {dose.medicamento.dose || "Dose não informada"}
                  {total ? ` – ${total}` : ""}
                  {dose.medicamento.quantidade ? ` – ${dose.medicamento.quantidade}` : ""}
                  {dose.medicamento.via ? ` · ${dose.medicamento.via}` : ""}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {doses.length > 0 && semHorario.length > 0 && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {semHorario.length} medicação(ões) sem horário inicial ainda não aparecem na agenda.
        </p>
      )}
    </main>
  );
}

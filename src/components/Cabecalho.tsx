import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useRegistros } from "@/hooks/useRegistros";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { useFinalizarPlantao } from "@/hooks/useFinalizarPlantao";
import { DialogoTurno } from "@/components/DialogoTurno";
import { rotuloPlantaoAtual } from "@/lib/plantao";

const base = "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm";

export function Cabecalho() {
  const { registros } = useRegistros();
  const { plantao, definirTurno, carregado } = usePlantaoAtual();
  const finalizar = useFinalizarPlantao();
  const [iniciarAberto, setIniciarAberto] = useState(false);
  const [dataHoje, setDataHoje] = useState("");

  const finalizarPlantao = () => {
    const quantos = registros.length;
    const aviso = quantos
      ? `Tem certeza que deseja finalizar o plantão? ${quantos} animal(is) irão para o histórico de plantões.`
      : "Tem certeza que deseja finalizar o plantão?";
    if (!window.confirm(aviso)) return;
    finalizar();
  };

  useEffect(() => {
    setDataHoje(new Date().toLocaleDateString("pt-BR"));
  }, []);

  return (
    <header className="border-b border-border bg-card/60">
      <div className="mx-auto w-full max-w-5xl px-4 pb-3 pt-5 text-center">
        <h1 className="font-display text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
          Veterício Serviços Veterinários LTDA
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Ficha de Avaliação da Internação
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {plantao ? rotuloPlantaoAtual(plantao) : dataHoje || "—"}
          {plantao && (
            <button
              type="button"
              onClick={() => definirTurno(null)}
              className="ml-2 underline underline-offset-2 hover:text-foreground"
            >
              alterar
            </button>
          )}
        </p>

        {carregado && (
          <div className="mt-3">
            {plantao ? (
              <button
                type="button"
                onClick={finalizarPlantao}
                className="w-full max-w-xs rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                Finalizar plantão
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIniciarAberto(true)}
                className="w-full max-w-xs rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Iniciar plantão
              </button>
            )}
          </div>
        )}

        <DialogoTurno aberto={iniciarAberto} onFechar={() => setIniciarAberto(false)} />

        <nav className="mt-3 space-y-2">
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              activeProps={{ className: `${base} bg-primary text-primary-foreground` }}
              inactiveProps={{
                className: `${base} bg-secondary text-secondary-foreground hover:bg-secondary/70`,
              }}
            >
              Início
            </Link>
            <Link
              to="/registros"
              activeProps={{ className: `${base} bg-primary text-primary-foreground` }}
              inactiveProps={{
                className: `${base} bg-secondary text-secondary-foreground hover:bg-secondary/70`,
              }}
            >
              Animais internados
            </Link>
            <Link
              to="/evolucao"
              activeProps={{ className: `${base} bg-primary text-primary-foreground` }}
              inactiveProps={{
                className: `${base} bg-secondary text-secondary-foreground hover:bg-secondary/70`,
              }}
            >
              Evolução
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Link
              to="/curva"
              activeProps={{ className: `${base} bg-primary text-primary-foreground` }}
              inactiveProps={{
                className: `${base} bg-secondary text-secondary-foreground hover:bg-secondary/70`,
              }}
            >
              Curva
            </Link>
            <Link
              to="/alarmes"
              activeProps={{ className: `${base} bg-primary text-primary-foreground` }}
              inactiveProps={{
                className: `${base} bg-secondary text-secondary-foreground hover:bg-secondary/70`,
              }}
            >
              Alarmes
            </Link>
            <Link
              to="/plantoes"
              activeProps={{ className: `${base} bg-primary text-primary-foreground` }}
              inactiveProps={{
                className: `${base} bg-secondary text-secondary-foreground hover:bg-secondary/70`,
              }}
            >
              Plantões
            </Link>
          </div>
        </nav>

        <p className="mt-2 text-xs font-semibold text-foreground sm:text-sm">
          Total de registros do plantão de hoje: {registros.length}
        </p>
      </div>
    </header>
  );
}

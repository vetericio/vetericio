import { useEffect, useState } from "react";

import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ConfirmarAcao, usarConfirmacao } from "@/components/ConfirmarAcao";
import { useRegistros } from "@/hooks/useRegistros";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { useFinalizarPlantao } from "@/hooks/useFinalizarPlantao";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { usePermissoes } from "@/hooks/usePermissoes";
import { useProtecaoDadosLocais } from "@/hooks/useProtecaoDadosLocais";
import { DialogoTurno } from "@/components/DialogoTurno";
import { MenuLateral } from "@/components/MenuLateral";
import { rotuloPlantaoAtual } from "@/lib/plantao";

const base =
  "min-h-11 flex items-center rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm";

import { LINKS_TOPO as LINKS, SO_COM_PLANTAO } from "@/lib/navegacao";

const PERMISSAO_LINK: Record<string, string> = {
  "/internacao": "internacao.painel",
  "/registros": "internacao.painel",
  "/anamnese": "internacao.registrar",
};

const AREAS_TROCA = [
  { to: "/internacao", rotulo: "Internação", permissao: "internacao.painel" },
  { to: "/consultorio", rotulo: "Consultas", permissao: "consultorio.atendimentos" },
  { to: "/recepcao", rotulo: "Recepção", permissao: "recepcao.agenda" },
  { to: "/financeiro", rotulo: "Caixa", permissao: "caixa.financeiro.visualizar" },
] as const;

export function Cabecalho() {
  const location = useLocation();
  const navigate = useNavigate();
  const { marca, logo_url } = useSiteBranding();
  const { carregando: carregandoPermissoes, pode, permitidas, adminGlobal } = usePermissoes();
  useProtecaoDadosLocais({ permitidas, carregando: carregandoPermissoes, adminGlobal });
  const plantaoArea = ["/internacao", "/registros", "/anamnese", "/curva", "/alarmes", "/pendencias", "/plantoes"].includes(location.pathname);
  const { registros } = useRegistros();
  const { plantao, definirTurno, carregado } = usePlantaoAtual();
  const finalizar = useFinalizarPlantao();
  const confirmacao = usarConfirmacao();
  const [iniciarAberto, setIniciarAberto] = useState(false);
  const [dataHoje, setDataHoje] = useState("");
  const [trocarArea, setTrocarArea] = useState(false);
  const podeGerenciarPlantao = carregandoPermissoes || pode("internacao.plantoes");

  const finalizarPlantao = () => {
    if (!podeGerenciarPlantao) return;
    const quantos = registros.length;
    confirmacao.pedir({
      titulo: "Finalizar o plantão agora?",
      descricao: quantos
        ? `${quantos} animal(is) vão para o histórico de plantões. Nada é apagado: você continua vendo tudo em Plantões.`
        : "Nenhum animal na lista de hoje. Nada é apagado.",
      acao: "Finalizar plantão",
      onConfirmar: finalizar,
    });
  };

  useEffect(() => {
    setDataHoje(new Date().toLocaleDateString("pt-BR"));
  }, []);

  return (
    <header className="relative border-b border-border bg-card/60">
      <MenuLateral />
      <div className={`mx-auto w-full max-w-5xl px-4 text-center ${plantaoArea ? "pb-3 pt-4" : "pb-2 pt-2"}`}>
        <div className={plantaoArea ? "mb-2 flex justify-center" : "mb-1 flex justify-center"}>
          <img
            src={logo_url}
            alt={`${marca} — sistema veterinário e petshop`}
            className={`h-auto w-full object-contain ${plantaoArea ? "max-w-[180px] sm:max-w-[220px]" : "max-w-[90px] sm:max-w-[110px]"}`}
          />
        </div>

        <div className={plantaoArea ? "mb-2" : "mb-0"}>
          <button
            type="button"
            onClick={() => setTrocarArea((aberto) => !aberto)}
            className={`rounded-xl border bg-card font-semibold shadow-sm ${plantaoArea ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs sm:text-sm"}`}
          >
            {location.pathname === "/" ? "Escolher área" : "← Voltar / trocar área"}
          </button>
          {trocarArea && (
            <div className="mx-auto mt-2 grid max-w-md gap-2 rounded-2xl border bg-card p-3 text-left shadow-lg">
              <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Para onde deseja ir?</p>
              {AREAS_TROCA.filter((area) => carregandoPermissoes || pode(area.permissao)).map((area) => (
                <button
                  key={area.to}
                  type="button"
                  onClick={() => { setTrocarArea(false); navigate({ to: area.to }); }}
                  className="rounded-xl bg-secondary px-3 py-3 text-left font-semibold hover:bg-secondary/70"
                >
                  {area.rotulo}
                </button>
              ))}
            </div>
          )}
        </div>

        {plantaoArea && <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Ficha de Avaliação da Internação</p>}
        {plantaoArea && <p className="mt-0.5 text-[11px] text-muted-foreground">
          {plantao ? rotuloPlantaoAtual(plantao) : dataHoje || "—"}
          {plantao && podeGerenciarPlantao && (
            <button type="button" onClick={() => definirTurno(null)} className="ml-2 underline underline-offset-2 hover:text-foreground">alterar</button>
          )}
        </p>}

        {plantaoArea && carregado && podeGerenciarPlantao && (
          <div className="mt-3">
            {plantao ? (
              <button type="button" onClick={finalizarPlantao} className="w-full max-w-xs rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90">Finalizar plantão</button>
            ) : (
              <button type="button" onClick={() => setIniciarAberto(true)} className="w-full max-w-xs rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Iniciar plantão</button>
            )}
          </div>
        )}

        <DialogoTurno aberto={iniciarAberto} onFechar={() => setIniciarAberto(false)} />

        {plantaoArea && <nav className="mx-auto mt-3 flex max-w-2xl flex-wrap justify-center gap-2">
          {LINKS.map((item) => {
            const permissao = PERMISSAO_LINK[item.to];
            if (permissao && !carregandoPermissoes && !pode(permissao)) return null;
            const bloqueado = !plantao && SO_COM_PLANTAO.includes(item.to);
            if (bloqueado)
              return (
                <button key={item.to} type="button" disabled={!podeGerenciarPlantao} onClick={() => podeGerenciarPlantao && setIniciarAberto(true)} className={`${base} bg-secondary/40 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60`}>
                  {item.rotulo}{podeGerenciarPlantao ? " · inicie o plantão" : ""}
                </button>
              );
            return (
              <Link key={item.to} to={item.to} {...(item.exato ? { activeOptions: { exact: true } } : {})} activeProps={{ className: `${base} bg-primary text-primary-foreground` }} inactiveProps={{ className: `${base} bg-secondary text-secondary-foreground hover:bg-secondary/70` }}>
                {item.rotulo}
              </Link>
            );
          })}
        </nav>}

        {plantaoArea && <p className="mt-2 text-xs font-semibold text-foreground sm:text-sm">Total de registros do plantão de hoje: {registros.length}</p>}
        {plantaoArea && <ConfirmarAcao pedido={confirmacao.pedido} onFechar={confirmacao.fechar} />}
      </div>
    </header>
  );
}

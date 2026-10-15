import { useEffect } from "react";
import { toast } from "sonner";

const TUTORES = "oricse-tutores-v1";
const ANIMAIS = "oricse-animais-v1";

const REGRAS_CHAVE: Array<{ teste: (chave: string) => boolean; qualquer: string[] }> = [
  { teste: (k) => k === "oricse-financeiro-lancamentos-v1", qualquer: ["caixa.financeiro.gerenciar", "caixa.comandas"] },
  { teste: (k) => k === "oricse-comandas-v1", qualquer: ["caixa.comandas"] },
  { teste: (k) => k === "oricse-agendas-v2" || k === "oricse-fila-espera-v1", qualquer: ["recepcao.agenda"] },
  { teste: (k) => k === "oricse-pesos-animal-v1", qualquer: ["recepcao.cadastros.editar", "consultorio.atendimentos"] },
  { teste: (k) => k.startsWith("oricse-rascunho-consulta-"), qualquer: ["consultorio.atendimentos"] },
  { teste: (k) => k === "veterico-registros-v1" || k === "veterico-anamneses" || k === "veterico-curvas-v1" || k === "veterico-alarmes-v1" || k === "veterico-pendencias-v1" || k === "veterico-alertas-v1" || k === "veterico-regras-alerta-v1", qualquer: ["internacao.registrar"] },
  { teste: (k) => k === "veterico-medicamentos-v1", qualquer: ["internacao.medicacoes", "consultorio.medicacoes"] },
  { teste: (k) => k === "veterico-plantao-v1" || k === "veterico-plantoes-v1", qualquer: ["internacao.plantoes"] },
  { teste: (k) => k === "veterico-assinatura-v1" || k === "veterico-carimbo-v1", qualquer: ["consultorio.receituario"] },
  { teste: (k) => k === "veterico-tema-v1" || k === "veterico-tema-cor-v1", qualquer: ["administracao.temas"] },
];

type ItemComId = { id?: unknown; [key: string]: unknown };

type OpCadastro = "criar" | "editar" | "excluir";

function operacoesCadastro(antes: string | null, depois: string): Set<OpCadastro> {
  const operacoes = new Set<OpCadastro>();
  try {
    const a = JSON.parse(antes || "[]") as unknown;
    const d = JSON.parse(depois || "[]") as unknown;
    if (!Array.isArray(a) || !Array.isArray(d)) return new Set(["editar"]);
    const mapaAntes = new Map<string, ItemComId>();
    const mapaDepois = new Map<string, ItemComId>();
    for (const item of a) if (item && typeof item === "object" && typeof (item as ItemComId).id === "string") mapaAntes.set(String((item as ItemComId).id), item as ItemComId);
    for (const item of d) if (item && typeof item === "object" && typeof (item as ItemComId).id === "string") mapaDepois.set(String((item as ItemComId).id), item as ItemComId);
    for (const [id, item] of mapaDepois) {
      if (!mapaAntes.has(id)) operacoes.add("criar");
      else if (JSON.stringify(mapaAntes.get(id)) !== JSON.stringify(item)) operacoes.add("editar");
    }
    for (const id of mapaAntes.keys()) if (!mapaDepois.has(id)) operacoes.add("excluir");
    return operacoes;
  } catch {
    return new Set(["editar"]);
  }
}

const CODIGO_CADASTRO: Record<OpCadastro, string> = {
  criar: "recepcao.cadastros.criar",
  editar: "recepcao.cadastros.editar",
  excluir: "recepcao.cadastros.excluir",
};

export function useProtecaoDadosLocais({
  permitidas,
  carregando,
  adminGlobal,
}: {
  permitidas: Set<string>;
  carregando: boolean;
  adminGlobal: boolean;
}) {
  useEffect(() => {
    if (carregando || typeof window === "undefined" || adminGlobal) return;

    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    let ultimoAviso = 0;

    const avisar = () => {
      const agora = Date.now();
      if (agora - ultimoAviso > 900) {
        ultimoAviso = agora;
        toast.error("Seu usuário não tem permissão para realizar esta alteração.");
      }
    };
    const negar = (): never => {
      avisar();
      const erro = new Error("Ação bloqueada pelas permissões do usuário.");
      erro.name = "NotAllowedError";
      throw erro;
    };
    const temAlguma = (codigos: string[]) => codigos.some((codigo) => permitidas.has(codigo));

    Storage.prototype.setItem = function (chave: string, valor: string) {
      if (this !== window.localStorage) return originalSetItem.call(this, chave, valor);

      if (chave === TUTORES || chave === ANIMAIS) {
        const operacoes = operacoesCadastro(window.localStorage.getItem(chave), valor);
        for (const operacao of operacoes) if (!permitidas.has(CODIGO_CADASTRO[operacao])) negar();
        return originalSetItem.call(this, chave, valor);
      }

      const regra = REGRAS_CHAVE.find((item) => item.teste(chave));
      if (regra && !temAlguma(regra.qualquer)) negar();
      return originalSetItem.call(this, chave, valor);
    };

    Storage.prototype.removeItem = function (chave: string) {
      if (this !== window.localStorage) return originalRemoveItem.call(this, chave);
      if ((chave === TUTORES || chave === ANIMAIS) && !permitidas.has("recepcao.cadastros.excluir")) negar();
      const regra = REGRAS_CHAVE.find((item) => item.teste(chave));
      if (regra && !temAlguma(regra.qualquer)) negar();
      return originalRemoveItem.call(this, chave);
    };

    return () => {
      Storage.prototype.setItem = originalSetItem;
      Storage.prototype.removeItem = originalRemoveItem;
    };
  }, [adminGlobal, carregando, permitidas]);
}

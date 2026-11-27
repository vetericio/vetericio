type RegistroParaResumo = {
  titulo: string;
  subtipo?: string;
  detalhe?: string;
  dados?: unknown;
  status?: string;
};

const LIMITE_RESUMO = 96;
const SEM_RESUMO = "Sem resumo disponível.";
const CONSULTA = /^consulta(?:$|[\s:–—-])/;
const CAMPOS = [
  { chave: "queixa", rotulos: ["queixa principal", "queixa", "motivo da consulta"], prefixo: "" },
  {
    chave: "suspeitas",
    rotulos: ["hipoteses / suspeitas", "hipoteses", "suspeitas"],
    prefixo: "Suspeita: ",
  },
  { chave: "conduta", rotulos: ["conduta / orientacoes", "conduta"], prefixo: "Conduta: " },
] as const;

function normalizar(texto = "") {
  return texto
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function ehRegistroConsulta(registro: RegistroParaResumo) {
  if (registro.status === "adendo" || /^adendo\b/.test(normalizar(registro.titulo))) return false;
  return CONSULTA.test(normalizar(registro.subtipo || registro.titulo));
}

function primeiraLinha(valor: unknown) {
  if (typeof valor !== "string") return "";
  const linha = valor.trim().split(/\r?\n/, 1)[0].replace(/\s+/g, " ").trim();
  const limpa = normalizar(linha).replace(/[.!?\s]+$/, "");
  return /^(?:[-–—]+|n\/a|nao informad[oa]|nao preenchid[oa]|sem informa(?:cao|coes)(?: adicionais)?)?$/.test(
    limpa,
  )
    ? ""
    : linha;
}

function limitar(texto: string) {
  const caracteres = Array.from(texto);
  if (caracteres.length <= LIMITE_RESUMO) return texto;
  const trecho = caracteres.slice(0, LIMITE_RESUMO - 1).join("");
  const espaco = trecho.lastIndexOf(" ");
  return (espaco > LIMITE_RESUMO / 2 ? trecho.slice(0, espaco) : trecho).trimEnd() + "…";
}

// Mostra um trecho do próprio prontuário, sem inferir diagnóstico, conduta ou novos dados.
export function resumirConsulta(registro: RegistroParaResumo) {
  const dados =
    registro.dados && typeof registro.dados === "object"
      ? (registro.dados as Record<string, unknown>)
      : {};
  const linhas = (registro.detalhe || "").trim().split(/\r?\n/);
  const camposLegados = new Map<string, string>();
  let temSecaoClinica = false;
  for (const [i, origem] of linhas.entries()) {
    const linha = origem.trim();
    const campo = /^([^:]+):\s*(.*)$/.exec(linha);
    if (!campo) continue;
    const rotulo = normalizar(campo[1]).replace(/\s*\/\s*/g, " / ");
    const proxima = linhas[i + 1]?.trim() || "";
    if (CAMPOS.some(({ rotulos }) => rotulos.some((item) => item === rotulo))) {
      temSecaoClinica = true;
      const valor = primeiraLinha(campo[2] || (!proxima.includes(":") ? proxima : ""));
      if (valor && !camposLegados.has(rotulo)) camposLegados.set(rotulo, valor);
    } else if (
      /^(?:tutor relata|observacoes por sistema|exame clinico|exames (?:solicitados|oftalmologicos)|medicacoes(?: \/ receita)?|retorno|data indicada para retorno)$/.test(
        rotulo,
      )
    ) {
      temSecaoClinica = true;
    }
  }
  for (const { chave, rotulos, prefixo } of CAMPOS) {
    const valor =
      primeiraLinha(dados[chave]) ||
      rotulos.map((rotulo) => camposLegados.get(rotulo)).find(Boolean);
    if (valor) return limitar(prefixo + valor);
  }
  const trecho = temSecaoClinica ? "" : linhas.map(primeiraLinha).find(Boolean);
  return trecho ? limitar(trecho) : SEM_RESUMO;
}

/**
 * Núcleo puro de autorização de planos, compartilhado entre RPC e escrita Drive.
 * Negação prevalece sempre que o plano está inativo ou a clínica está bloqueada.
 */
export type RegraPlano = {
  plano_id: unknown;
  funcionalidade_codigo: unknown;
  permitido: unknown;
};
export type ExcecaoPlano = {
  clinica_id?: unknown;
  funcionalidade_codigo: unknown;
  permitido: unknown;
  expira_em?: unknown;
};
export type ContextoPlano = {
  statusClinica: string;
  planoAtivo: boolean;
  planoId: string;
  codigoPlano: string;
  clinicaId: string;
  regras: RegraPlano[];
  excecoes: ExcecaoPlano[];
  legados: readonly string[];
  acoesLegadas: ReadonlySet<string>;
  agora?: number;
};

/** A exceção é individual por clínica. Sem exceção/regra, só ações legadas mantêm comportamento anterior. */
export function recursoLiberado(codigo: string, contexto: ContextoPlano): boolean {
  if (contexto.statusClinica !== "ativa" || !contexto.planoAtivo || !contexto.planoId || !codigo) return false;
  const agora = contexto.agora ?? Date.now();
  const excecao = contexto.excecoes.find((item) =>
    String(item.clinica_id || contexto.clinicaId) === contexto.clinicaId &&
    String(item.funcionalidade_codigo) === codigo &&
    (!item.expira_em || (Number.isFinite(new Date(String(item.expira_em)).getTime()) &&
      new Date(String(item.expira_em)).getTime() > agora)));
  if (excecao) return excecao.permitido === true;
  const linha = contexto.regras.find((regra) =>
    String(regra.plano_id) === contexto.planoId &&
    String(regra.funcionalidade_codigo) === codigo);
  if (linha) return linha.permitido === true;
  return codigo.startsWith("acao.")
    ? contexto.acoesLegadas.has(codigo.slice(5))
    : contexto.legados.includes(codigo);
}

export function permissaoEfetiva(params: {
  codigo: string;
  modulo: string | null | undefined;
  contexto: ContextoPlano;
  permitidoCargo: boolean;
  excecaoUsuario?: boolean;
}): boolean {
  const { codigo, modulo, contexto, permitidoCargo, excecaoUsuario } = params;
  return (!modulo || recursoLiberado(modulo, contexto))
    && recursoLiberado("acao." + codigo, contexto)
    && (excecaoUsuario === undefined ? permitidoCargo : excecaoUsuario);
}

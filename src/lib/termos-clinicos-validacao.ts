/**
 * Validação puramente funcional dos 14 termos clínicos ORICSE.
 * Não autoriza emissão: o servidor aplica o bloqueio de homologação.
 * A informação específica do caso não integra o modelo editável.
 */
import { TEXTOS_TERMOS_PADRAO } from "@/lib/textos-termos";
import { TEXTOS_TERMOS_ADICIONAIS } from "@/lib/textos-termos-adicionais";
import { formatarDataExtensoDocumento } from "@/lib/modelos-documentos";

export const BIBLIOTECA_TERMOS = [...TEXTOS_TERMOS_PADRAO, ...TEXTOS_TERMOS_ADICIONAIS];
export type CodigoTermoClinico = (typeof BIBLIOTECA_TERMOS)[number]["id"];
export type CampoClinico = { id: string; rotulo: string; obrigatorio: boolean };
const c = (id: string, rotulo: string, obrigatorio = false): CampoClinico => ({ id, rotulo, obrigatorio });

export const CAMPOS_TERMOS: Record<CodigoTermoClinico, readonly CampoClinico[]> = {
  eutanasia: [
    c("justificativa", "Justificativa clínica e condição do paciente (preenchimento obrigatório)", true),
    c("metodo", "Método informado ao responsável (preenchimento obrigatório)", true),
    c("observacoesVet", "Observações do médico-veterinário"), c("observacoesResponsavel", "Observações do responsável"),
  ],
  cirurgia: [
    c("procedimento", "Procedimento cirúrgico autorizado (preenchimento obrigatório)", true),
    c("riscos", "Riscos específicos e condições relevantes do paciente", true),
    c("observacoesVet", "Observações do médico-veterinário"), c("observacoesResponsavel", "Observações do responsável"),
  ],
  anestesia: [
    c("tecnica", "Tipo de anestesia e procedimento indicado (preenchimento obrigatório)", true),
    c("risco", "Risco anestésico e condições clínicas relevantes", true),
    c("observacoesVet", "Observações do médico-veterinário"), c("observacoesResponsavel", "Observações do responsável"),
  ],
  "retirada-sem-alta": [
    c("estado", "Estado clínico no momento da retirada (preenchimento obrigatório)", true),
    c("riscos", "Conduta recomendada e riscos específicos informados (preenchimento obrigatório)", true),
    c("motivo", "Motivo da retirada informado pelo responsável"),
    c("observacoesVet", "Observações do médico-veterinário"), c("observacoesResponsavel", "Observações do responsável"),
    c("testemunha1", "Testemunha 1 (nome completo, documento e assinatura, apenas se houver recusa)"),
    c("testemunha2", "Testemunha 2 (nome completo, documento e assinatura, apenas se houver recusa)"),
  ],
  internacao: [
    c("motivo", "Motivo da internação (obrigatório)", true),
    c("riscos", "Quadro clínico e riscos específicos (obrigatório)", true),
    c("tratamento", "Tratamento inicialmente proposto", true), c("reavaliacao", "Previsão de reavaliação"),
    c("observacoes", "Observações"),
  ],
  "terapeutico-risco": [
    c("procedimento", "Procedimento autorizado (obrigatório)", true),
    c("indicacao", "Indicação clínica", true),
    c("riscos", "Riscos específicos (obrigatório)", true),
    c("alternativas", "Alternativas apresentadas", true),
    c("consequencias", "Consequências da não realização"),
    c("observacoes", "Observações adicionais"),
  ],
  diagnostico: [
    c("exames", "Exames autorizados (obrigatório)", true),
    c("finalidade", "Finalidade diagnóstica", true),
    c("riscos", "Riscos específicos e cuidados necessários"),
    c("observacoes", "Observações"),
  ],
  recusa: [
    c("recusado", "Tratamento ou exame recusado (obrigatório)", true),
    c("recomendacao", "Recomendação médica", true),
    c("riscos", "Riscos específicos da recusa (obrigatório)", true),
    c("alternativas", "Alternativas oferecidas"),
    c("motivo", "Motivo informado pelo responsável"), c("orientacoes", "Orientações fornecidas", true),
  ],
  transferencia: [
    c("destino", "Hospital ou clínica de destino (obrigatório)", true),
    c("motivo", "Motivo da transferência", true),
    c("estado", "Estado clínico no momento da saída (obrigatório)", true),
    c("riscos", "Riscos do deslocamento", true),
    c("transporte", "Responsável pelo transporte e acompanhamento", true),
    c("orientacoes", "Orientações e suporte durante o transporte"),
  ],
  transfusao: [
    c("indicacao", "Indicação clínica", true),
    c("componente", "Tipo de sangue ou hemocomponente (obrigatório)", true),
    c("compatibilidade", "Tipagem e testes de compatibilidade (obrigatório)", true),
    c("bolsa", "Identificação e rastreabilidade da bolsa (obrigatório)", true),
    c("riscos", "Riscos específicos do paciente"), c("observacoes", "Observações"),
  ],
  corpo: [
    c("obito", "Data e horário do óbito", true),
    c("entrega", "Data e horário de entrega do corpo (obrigatório)", true),
    c("recebedor", "Pessoa que recebeu o corpo (obrigatório)", true),
    c("destino", "Destinação informada pelo responsável", true),
    c("orientacoes", "Restrições sanitárias e orientações fornecidas"),
    c("observacoes", "Observações"),
  ],
  "doacao-corpo": [
    c("instituicao", "Instituição receptora (obrigatório)", true),
    c("finalidade", "Finalidade da utilização (obrigatório)", true),
    c("recebedor", "Responsável pelo recebimento", true),
    c("transporte", "Condições de transporte e conservação"),
    c("destinacao", "Destinação final e possibilidade de devolução", true),
    c("entrega", "Data da entrega"), c("observacoes", "Observações"),
  ],
  rcp: [
    c("condicao", "Condição clínica e prognóstico discutidos", true),
    c("decisao", "Decisão registrada (obrigatório)", true),
    c("justificativa", "Justificativa clínica e orientação profissional (obrigatório)", true),
    c("dataHora", "Data e horário da decisão", true),
    c("observacoes", "Observações"),
  ],
  domiciliar: [
    c("endereco", "Endereço do atendimento (obrigatório)", true),
    c("motivo", "Motivo da solicitação"),
    c("procedimentos", "Procedimentos previstos (obrigatório)", true),
    c("riscos", "Limitações e riscos específicos", true),
    c("encaminhamento", "Orientações sobre eventual encaminhamento", true),
    c("observacoes", "Observações"),
  ],
};

export type DadosIdentificacaoTermo = {
  paciente: string; especie: string; tutor: string; cpf: string; enderecoTutor: string;
  veterinario: string; crmv: string; clinica: string; data: string;
};
export type DadosTermo = {
  tipo: CodigoTermoClinico;
  campos: Record<string, string>;
  identificacao: DadosIdentificacaoTermo;
  recusaAssinatura?: boolean;
};

export function cpfValidoTermo(entrada: string): boolean {
  const cpf = entrada.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const tamanho of [9, 10]) {
    const soma = [...cpf.slice(0, tamanho)].reduce((total, digito, i) => total + Number(digito) * (tamanho + 1 - i), 0);
    const verificador = (soma * 10) % 11 % 10;
    if (verificador !== Number(cpf[tamanho])) return false;
  }
  return true;
}

export function pendenciasTermo(dados: DadosTermo): string[] {
  const pendencias: string[] = [];
  const { identificacao: i, campos, tipo } = dados;
  for (const [campo, rotulo] of [
    [i.paciente, "Nome do paciente"], [i.especie, "Espécie"],
    [i.tutor, "Responsável pelo animal"], [i.enderecoTutor, "Endereço completo do responsável"],
    [i.veterinario, "Médico-veterinário"], [i.crmv, "CRMV"],
    [i.clinica, "Clínica"], [i.data, "Data de emissão"],
  ]) if (!campo?.trim()) pendencias.push(rotulo);
  if (!cpfValidoTermo(i.cpf)) pendencias.push("CPF válido do responsável");
  for (const campo of CAMPOS_TERMOS[tipo]) {
    if (campo.obrigatorio && !campos[campo.id]?.trim()) pendencias.push(campo.rotulo.replace(/ \((obrigatório|preenchimento obrigatório)\)/, ""));
  }
  if (tipo === "retirada-sem-alta" && dados.recusaAssinatura) {
    if (!campos.testemunha1?.trim() || !campos.testemunha2?.trim()) pendencias.push("Duas testemunhas presenciais da recusa de assinatura");
  }
  if (tipo === "rcp" && !["reanimar", "nao_reanimar"].includes(campos.decisao || "")) {
    pendencias.push("Decisão inequívoca de RCP, discutida com o profissional");
  }
  if (tipo === "domiciliar" && /transfus[aã]o|anestesia geral|cirurgi[ac]/i.test(campos.procedimentos || "")) {
    pendencias.push("Procedimento potencialmente vedado no domicílio: encaminhar à unidade habilitada");
  }
  return [...new Set(pendencias)];
}

/**
 * Preenche somente identificadores conhecidos, sem substituições parciais.
 * Os campos clínicos são adicionados na seção específica; alterações nos
 * textos-base não podem remover requisitos obrigatórios.
 */
export function prepararConteudoTermo(dados: DadosTermo, corpoPersonalizado?: string): string {
  const pendentes = pendenciasTermo(dados);
  if (pendentes.length) throw new Error("Preencha antes de emitir: " + pendentes.join("; "));
  const modelo = BIBLIOTECA_TERMOS.find((item) => item.id === dados.tipo);
  if (!modelo) throw new Error("Modelo de termo não reconhecido.");
  const base = (corpoPersonalizado ?? modelo.texto).replace(/\r\n/g, "\n");
  const campos = CAMPOS_TERMOS[dados.tipo];
  const valores: Record<string, string> = {
    tutor: dados.identificacao.tutor, paciente: dados.identificacao.paciente,
    veterinario: dados.identificacao.veterinario, crmv: dados.identificacao.crmv,
  };
  let texto = base.replace(/\{\{([a-z_]+)\}\}/g, (original, chave: string) =>
    Object.hasOwn(valores, chave) ? valores[chave] : original);
  if (dados.tipo === "rcp") {
    const reanimar = dados.campos.decisao === "reanimar";
    texto = texto.replace("(  ) Autorizo", reanimar ? "(X) Autorizo" : "( ) Autorizo")
      .replace("(  ) Solicito", reanimar ? "( ) Solicito" : "(X) Solicito");
  }
  const linhas = texto.split("\n").filter((linha) => !campos.some((campo) => linha.trim() === campo.rotulo + ":"));
  const informacoes = campos.filter((campo) => dados.campos[campo.id]?.trim()).map((campo) =>
    campo.rotulo.replace(/ \((obrigatório|preenchimento obrigatório)\)/, "") + ": " +
    (dados.tipo === "rcp" && campo.id === "decisao" ?
      (dados.campos.decisao === "reanimar" ? "Reanimar" : "Não reanimar") : dados.campos[campo.id].trim()));
  if (dados.tipo === "retirada-sem-alta") {
    informacoes.push(dados.recusaAssinatura
      ? "Recusa de assinatura registrada: SIM. Duas testemunhas presentes e identificadas no termo."
      : "Recusa de assinatura registrada: NÃO.");
  }
  texto = linhas.join("\n").trim() + "\n\nINFORMAÇÕES CLÍNICAS ESPECÍFICAS:\n" + informacoes.join("\n");
  if (/\{\{[^{}]+\}\}/.test(texto)) throw new Error("O modelo ainda contém identificadores sem preenchimento.");
  if (!texto.trim() || texto.length > 25_000) throw new Error("O conteúdo excede os limites do termo.");
  return texto;
}

export function identificacaoDoTermo(dados: DadosTermo): string {
  const i = dados.identificacao;
  return [
    "RESPONSÁVEL PELO ANIMAL: " + i.tutor,
    "CPF: " + i.cpf,
    "ENDEREÇO: " + i.enderecoTutor,
    "PACIENTE: " + i.paciente + " · ESPÉCIE: " + i.especie,
    "MÉDICO-VETERINÁRIO: " + i.veterinario + " · " + i.crmv,
    "CLÍNICA: " + i.clinica,
    "DATA: " + formatarDataExtensoDocumento(i.data),
  ].join("\n");
}

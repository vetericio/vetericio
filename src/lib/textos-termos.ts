/**
 * Biblioteca oficial de textos-base do ORICSE.
 * Referências: CFMV 1321/2020 (Anexos VI, VIII, IX e X), com alterações
 * da Resolução 1653/2025; e CFMV 1000/2012 para eutanásia.
 * O cabeçalho, identificação e assinaturas são montados pelo gerador,
 * não devem ser incluídos no corpo editável.
 */
export const TEXTOS_TERMOS_PADRAO = [
  {
    id: "eutanasia",
    nome: "Eutanásia",
    titulo: "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA REALIZAÇÃO DE EUTANÁSIA",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, declaro que recebi esclarecimentos do(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}, sobre o estado clínico, a indicação do procedimento, seu prognóstico e as alternativas terapêuticas aplicáveis.",
      "",
      "Declaro compreender que a eutanásia é um procedimento que resulta na morte definitiva e irreversível do animal. Fui esclarecido(a) sobre o método proposto e sobre os cuidados destinados a reduzir ao máximo a dor, o medo e o sofrimento.",
      "",
      "Recebi oportunidade de esclarecer dúvidas e compreendo que a realização do procedimento depende de indicação clínica e ética do médico-veterinário, observadas as normas profissionais vigentes.",
      "",
      "Diante dessas informações, autorizo, de modo livre e esclarecido, a realização da eutanásia no animal acima identificado.",
      "",
      "Justificativa clínica e condição do paciente (preenchimento obrigatório):",
      "",
      "Método informado ao responsável (preenchimento obrigatório):",
      "",
      "Observações do médico-veterinário:",
      "",
      "Observações do responsável:"
    ].join("\n"),
    referencia: "CFMV 1321/2020, Anexo IX; CFMV 1000/2012"
  },
  {
    id: "cirurgia",
    nome: "Cirurgia e procedimento cirúrgico",
    titulo: "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA PROCEDIMENTO CIRÚRGICO",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, autorizo a realização do procedimento cirúrgico descrito abaixo, após receber informações do(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}.",
      "",
      "Fui informado(a) sobre a finalidade da intervenção, as alternativas possíveis e os riscos durante ou após o procedimento, que podem incluir hemorragia, infecção, complicações na cicatrização, necessidade de novas intervenções, sequelas e, em situações graves, óbito.",
      "",
      "Compreendo que não existe garantia de resultado e que fatores individuais do paciente podem influenciar a evolução clínica. Fui orientado(a) sobre a necessidade de acompanhamento e cuidados pós-operatórios.",
      "",
      "O consentimento para o procedimento anestésico é registrado em termo específico. Novos procedimentos eletivos não abrangidos por esta autorização exigem esclarecimento e autorização próprios, ressalvadas as situações emergenciais previstas nas normas aplicáveis.",
      "",
      "Declaro que minhas dúvidas foram respondidas e autorizo livremente a intervenção descrita.",
      "",
      "Procedimento cirúrgico autorizado (preenchimento obrigatório):",
      "",
      "Riscos específicos e condições relevantes do paciente:",
      "",
      "Observações do médico-veterinário:",
      "",
      "Observações do responsável:"
    ].join("\n"),
    referencia: "CFMV 1321/2020, Anexo VI"
  },
  {
    id: "anestesia",
    nome: "Anestesia",
    titulo: "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA PROCEDIMENTOS ANESTÉSICOS",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, autorizo os procedimentos anestésicos ou sedativos descritos abaixo, sob responsabilidade do(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}.",
      "",
      "Fui esclarecido(a) sobre o tipo de anestesia proposto, seus benefícios e riscos, inclusive reações adversas a medicamentos, alterações circulatórias ou respiratórias, aspiração, parada cardiorrespiratória e, em casos graves, óbito.",
      "",
      "Entendo que avaliação e exames pré-anestésicos contribuem para identificar riscos, mas não eliminam completamente a possibilidade de complicações. A equipe poderá ajustar a técnica diante das condições clínicas do paciente e adotar medidas emergenciais quando necessárias.",
      "",
      "Declaro ter tido oportunidade de esclarecer dúvidas e autorizo, de forma livre e consciente, o procedimento anestésico indicado.",
      "",
      "Tipo de anestesia e procedimento indicado (preenchimento obrigatório):",
      "",
      "Risco anestésico e condições clínicas relevantes:",
      "",
      "Observações do médico-veterinário:",
      "",
      "Observações do responsável:"
    ].join("\n"),
    referencia: "CFMV 1321/2020, Anexo VIII"
  },
  {
    id: "retirada-sem-alta",
    nome: "Retirada sem alta médica",
    titulo: "TERMO DE ESCLARECIMENTO PARA RETIRADA DE ANIMAL SEM ALTA MÉDICA",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, declaro que solicitei sua retirada do serviço veterinário antes da concessão de alta médica, contrariando a recomendação assistencial explicada pelo(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}.",
      "",
      "Fui esclarecido(a) sobre o estado clínico do animal, a conduta recomendada e os riscos de interromper a assistência, inclusive agravamento, sofrimento, sequelas e óbito.",
      "",
      "Mesmo ciente dessas informações, manifesto minha decisão voluntária de retirar o animal sem alta médica e assumo a responsabilidade pela decisão e seus riscos, sem prejuízo das responsabilidades legais que eventualmente caibam aos profissionais e ao estabelecimento.",
      "",
      "Recebi as orientações possíveis para procurar assistência veterinária imediatamente em caso de piora e tive oportunidade de esclarecer minhas dúvidas.",
      "",
      "Estado clínico no momento da retirada (preenchimento obrigatório):",
      "",
      "Conduta recomendada e riscos específicos informados (preenchimento obrigatório):",
      "",
      "Motivo da retirada informado pelo responsável:",
      "",
      "Observações do médico-veterinário:",
      "",
      "Observações do responsável:",
      "",
      "Em caso de recusa de assinatura, registrar no prontuário a recusa, o horário e as assinaturas de duas testemunhas presentes, nos termos da Resolução CFMV nº 1.653/2025.",
      "",
      "Testemunha 1 (nome completo, documento e assinatura, apenas se houver recusa):",
      "",
      "Testemunha 2 (nome completo, documento e assinatura, apenas se houver recusa):"
    ].join("\n"),
    referencia: "CFMV 1321/2020, Anexo X; CFMV 1653/2025"
  }
] as const;

export type TipoTextoTermo = (typeof TEXTOS_TERMOS_PADRAO)[number]["id"];
export const IDs_TERMOS = TEXTOS_TERMOS_PADRAO.map((item) => item.id) as [TipoTextoTermo, ...TipoTextoTermo[]];

export function modeloTermoPorId(id: string) {
  return TEXTOS_TERMOS_PADRAO.find((item) => item.id === id);
}

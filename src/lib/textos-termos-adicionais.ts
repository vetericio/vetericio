/**
 * Textos adicionais do ORICSE em REVISÃO.
 * NÃO IMPORTAR EM PRODUÇÃO até duas revisões registradas:
 * Dr. Paulo (jurídica) e Dra. Camila (clínico-veterinária).
 * Os documentos serão assinados pelo responsável e profissional habilitado.
 */
export const TEXTOS_TERMOS_ADICIONAIS = [
  {
    id: "internacao",
    nome: "Internação e tratamento clínico",
    titulo: "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA INTERNAÇÃO E TRATAMENTO CLÍNICO OU PÓS-CIRÚRGICO",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, declaro que recebi esclarecimentos sobre o estado clínico do paciente, a necessidade de internação e o tratamento recomendado pelo(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}.",
      "Fui informado(a) de que a internação poderá compreender administração de medicamentos, fluidoterapia, analgesia, oxigenoterapia, monitorização, cuidados de enfermagem, exames complementares e outras medidas clínicas indicadas, respeitadas as autorizações específicas exigíveis para procedimentos de maior risco.",
      "Compreendo que, apesar dos recursos empregados e da assistência prestada, poderão ocorrer complicações, agravamento do quadro, necessidade de transferência, sequelas ou óbito.",
      "Estou ciente de que não é possível garantir a recuperação do paciente, considerando a gravidade da doença e sua resposta individual ao tratamento.",
      "Autorizo a internação e o tratamento clínico ou pós-cirúrgico especificados, comprometendo-me a fornecer informações relevantes sobre o histórico do animal e a manter meus contatos atualizados.",
      "Declaro ter recebido explicações satisfatórias e oportunidade de esclarecer minhas dúvidas.",
      "Motivo da internação (obrigatório):",
      "Quadro clínico e riscos específicos (obrigatório):",
      "Tratamento inicialmente proposto:",
      "Previsão de reavaliação:",
      "Observações:"
    ].join("\n\n"),
    referencia: "CFMV 1321/2020, Anexo VII"
  },
  {
    id: "terapeutico-risco",
    nome: "Procedimento terapêutico de risco",
    titulo: "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA PROCEDIMENTO TERAPÊUTICO DE RISCO",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, declaro que fui informado(a) pelo(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}, sobre a indicação, a finalidade, os benefícios esperados, as alternativas disponíveis e os riscos do procedimento proposto.",
      "Compreendo que, em razão da natureza da intervenção ou das condições clínicas do paciente, poderão ocorrer complicações graves, incluindo reações adversas, hemorragias, infecções, lesões de órgãos, perda temporária ou permanente de funções, sequelas, necessidade de tratamentos adicionais e, em situações graves, óbito.",
      "Fui esclarecido(a) sobre as consequências possíveis da não realização do procedimento e sobre as medidas previstas para reduzir os riscos.",
      "Entendo que a execução da intervenção conforme as boas práticas profissionais não garante resultado favorável ou ausência de complicações.",
      "Após receber as informações necessárias e esclarecer minhas dúvidas, autorizo livre e conscientemente a realização do procedimento terapêutico especificado.",
      "Procedimento autorizado (obrigatório):",
      "Indicação clínica:",
      "Riscos específicos (obrigatório):",
      "Alternativas apresentadas:",
      "Consequências da não realização:",
      "Observações adicionais:"
    ].join("\n\n"),
    referencia: "CFMV 1321/2020, Anexo IV"
  },
  {
    id: "diagnostico",
    nome: "Exames e procedimentos diagnósticos",
    titulo: "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA REALIZAÇÃO DE EXAMES",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, autorizo a realização dos exames e procedimentos diagnósticos identificados neste documento, conforme indicação do(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}.",
      "Declaro que recebi esclarecimentos sobre a finalidade dos exames, sua importância na investigação clínica, as possíveis limitações diagnósticas e os riscos associados.",
      "Compreendo que determinados procedimentos podem exigir contenção física, coleta de material biológico ou técnicas invasivas, podendo ocasionar desconforto, dor, sangramentos, hematomas, reações adversas ou outras complicações, conforme a técnica utilizada.",
      "Estou ciente de que alguns exames poderão apresentar resultados inconclusivos e exigir repetição ou investigação complementar.",
      "A eventual necessidade de sedação, anestesia ou procedimento de risco não abrangido pela autorização inicial deverá ser avaliada e autorizada especificamente, observadas as situações emergenciais previstas nas normas profissionais.",
      "Declaro ter compreendido as informações fornecidas e autorizo os exames descritos abaixo.",
      "Exames autorizados (obrigatório):",
      "Finalidade diagnóstica:",
      "Riscos específicos e cuidados necessários:",
      "Observações:"
    ].join("\n\n"),
    referencia: "CFMV 1321/2020, Anexo III"
  },
  {
    id: "recusa",
    nome: "Recusa de tratamento ou exames",
    titulo: "TERMO DE CIÊNCIA E RESPONSABILIDADE POR RECUSA DE TRATAMENTO OU EXAMES",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, declaro que recebi orientação do(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}, sobre a necessidade de realização do tratamento ou dos exames especificados neste documento.",
      "Fui informado(a) sobre a condição clínica do animal, os benefícios esperados da conduta recomendada e os riscos relacionados à sua não realização.",
      "Compreendo que a recusa poderá comprometer o diagnóstico, retardar o tratamento, agravar a doença, causar dor e sofrimento, favorecer o desenvolvimento de sequelas e, em determinadas circunstâncias, resultar no óbito do paciente.",
      "Declaro que foram apresentadas, quando disponíveis e clinicamente aplicáveis, alternativas à conduta inicialmente recomendada.",
      "Mesmo após os esclarecimentos recebidos, manifesto minha decisão de não autorizar, neste momento, os procedimentos descritos abaixo.",
      "Reconheço os riscos relacionados à minha decisão, sem que esta declaração represente isenção automática das responsabilidades legais e profissionais do estabelecimento ou da equipe médico-veterinária.",
      "Declaro que minha manifestação é livre, consciente e que tive oportunidade de esclarecer dúvidas.",
      "Tratamento ou exame recusado (obrigatório):",
      "Recomendação médica:",
      "Riscos específicos da recusa (obrigatório):",
      "Alternativas oferecidas:",
      "Motivo informado pelo responsável:",
      "Orientações fornecidas:"
    ].join("\n\n"),
    referencia: "CFMV 1321/2020, regras gerais de prontuário e consentimento"
  },
  {
    id: "transferencia",
    nome: "Transferência hospitalar",
    titulo: "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA TRANSFERÊNCIA HOSPITALAR",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, declaro que fui informado(a) pelo(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}, sobre a recomendação de transferência do paciente para outro estabelecimento médico-veterinário.",
      "Compreendo que a transferência poderá ser necessária em razão da condição clínica do animal, da necessidade de internação, monitorização, exames, procedimentos especializados ou recursos não disponíveis no local do atendimento inicial.",
      "Fui esclarecido(a) sobre os riscos envolvidos no deslocamento, incluindo estresse, dor, alterações respiratórias ou cardiovasculares, agravamento do quadro clínico e, em situações críticas, óbito durante o transporte.",
      "Estou ciente de que o transporte deverá observar as condições clínicas do paciente e os recursos necessários para sua segurança, conforme avaliação profissional.",
      "Autorizo a transferência para o estabelecimento identificado neste documento, nas condições previamente esclarecidas, e compreendo que o tratamento terá continuidade conforme a avaliação da equipe receptora.",
      "Declaro que recebi informações sobre a organização do transporte, a responsabilidade por sua execução e os custos eventualmente envolvidos.",
      "Hospital ou clínica de destino (obrigatório):",
      "Motivo da transferência:",
      "Estado clínico no momento da saída (obrigatório):",
      "Riscos do deslocamento:",
      "Responsável pelo transporte e acompanhamento:",
      "Orientações e suporte durante o transporte:"
    ].join("\n\n"),
    referencia: "Boas práticas e princípios de consentimento, CFMV 1321/2020"
  },
  {
    id: "transfusao",
    nome: "Transfusão sanguínea",
    titulo: "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA TRANSFUSÃO SANGUÍNEA",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, declaro que recebi esclarecimentos do(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}, sobre a indicação de transfusão sanguínea e seus benefícios esperados.",
      "Fui informado(a) de que o procedimento consiste na administração de sangue total ou hemocomponentes, conforme a necessidade clínica do paciente.",
      "Compreendo que, apesar da seleção do produto, dos exames e testes de compatibilidade indicados e do acompanhamento profissional, existem riscos de reações transfusionais imediatas ou tardias.",
      "Essas complicações podem incluir febre, alterações circulatórias ou respiratórias, reações alérgicas, hemólise, sobrecarga circulatória, transmissão de agentes infecciosos e, em casos graves, choque e óbito.",
      "Estou ciente de que os testes e cuidados prévios reduzem riscos, mas não garantem a ausência de intercorrências ou o sucesso terapêutico.",
      "Fui esclarecido(a) sobre a necessidade de monitorização durante e após a transfusão e sobre a possibilidade de interrupção do procedimento diante de reações adversas.",
      "Declaro que recebi informações sobre as alternativas clinicamente aplicáveis e as consequências da não realização da transfusão.",
      "Diante dessas informações, autorizo de maneira livre e consciente a transfusão especificada neste documento.",
      "Indicação clínica:",
      "Tipo de sangue ou hemocomponente (obrigatório):",
      "Tipagem e testes de compatibilidade (obrigatório):",
      "Identificação e rastreabilidade da bolsa (obrigatório):",
      "Riscos específicos do paciente:",
      "Observações:"
    ].join("\n\n"),
    referencia: "CFMV 1321/2020; CFMV 1690/2026 veda transfusão domiciliar"
  },
  {
    id: "corpo",
    nome: "Retirada e destinação de corpo",
    titulo: "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA RETIRADA DE CORPO DE ANIMAL EM ÓBITO",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, declaro que fui informado(a) sobre o óbito do paciente e recebi esclarecimentos relativos à retirada e destinação de seu corpo.",
      "Manifesto minha decisão de receber o corpo do animal, assumindo, a partir de sua entrega, a responsabilidade pela guarda, transporte e destinação ambientalmente adequada, respeitando a legislação sanitária e ambiental aplicável.",
      "Declaro ter sido orientado(a) de que o descarte irregular poderá representar risco à saúde pública e ao meio ambiente, sendo necessário utilizar métodos e serviços legalmente permitidos.",
      "Estou ciente de que, dependendo da causa do óbito ou de condições sanitárias específicas, poderão existir restrições quanto ao manuseio, transporte e destinação do corpo.",
      "Confirmo que recebi orientações sobre as opções disponíveis e que a entrega será devidamente registrada pelo estabelecimento.",
      "A assinatura deste termo não substitui o atestado de óbito médico-veterinário nem afasta as responsabilidades do estabelecimento quanto aos atos praticados antes da entrega.",
      "Data e horário do óbito:",
      "Data e horário de entrega do corpo (obrigatório):",
      "Pessoa que recebeu o corpo (obrigatório):",
      "Destinação informada pelo responsável:",
      "Restrições sanitárias e orientações fornecidas:",
      "Observações:"
    ].join("\n\n"),
    referencia: "CFMV 1321/2020, Anexo V"
  },
  {
    id: "doacao-corpo",
    nome: "Doação de corpo para ensino e pesquisa",
    titulo: "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA DOAÇÃO DE CORPO DE ANIMAL PARA FINS DE ENSINO E PESQUISA",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, declaro minha intenção de doar voluntariamente o corpo do animal, após a confirmação de seu óbito, para utilização em atividades de ensino e pesquisa desenvolvidas por instituição devidamente identificada.",
      "Fui esclarecido(a) de que o corpo poderá ser utilizado em atividades educacionais, estudos anatômicos, treinamento técnico ou pesquisa científica, observadas a finalidade informada e as exigências éticas e legais aplicáveis.",
      "Compreendo que as atividades poderão envolver manipulação, conservação, estudo e outras intervenções sobre o cadáver, conforme os protocolos autorizados pela instituição receptora.",
      "Estou ciente de que a utilização ou destinação final do corpo dependerá das condições técnicas e das regras da instituição responsável, que deverão ser informadas previamente.",
      "Declaro que a doação é voluntária, sem remuneração ou benefício financeiro, e que possuo legitimidade para autorizá-la.",
      "Compreendo que a presente autorização não constitui consentimento para a realização de eutanásia ou de qualquer procedimento em animal vivo.",
      "Após receber os esclarecimentos necessários, autorizo a doação nas condições descritas neste documento.",
      "Instituição receptora (obrigatório):",
      "Finalidade da utilização (obrigatório):",
      "Responsável pelo recebimento:",
      "Condições de transporte e conservação:",
      "Destinação final e possibilidade de devolução:",
      "Data da entrega:",
      "Observações:"
    ].join("\n\n"),
    referencia: "CFMV 1321/2020, Anexo XII"
  },
  {
    id: "rcp",
    nome: "Reanimação cardiopulmonar",
    titulo: "TERMO DE ESCLARECIMENTO E REGISTRO DE DECISÃO SOBRE REANIMAÇÃO CARDIOPULMONAR",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, declaro ter recebido esclarecimentos do(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}, sobre a possibilidade de parada cardiorrespiratória e as medidas de reanimação aplicáveis.",
      "Fui informado(a) de que a reanimação cardiopulmonar consiste em um conjunto de manobras e intervenções destinadas a tentar restabelecer a circulação sanguínea e a respiração em situações de parada cardiorrespiratória.",
      "Compreendo que essas medidas poderão incluir compressões torácicas, ventilação assistida, administração de medicamentos, desfibrilação e outras intervenções tecnicamente indicadas.",
      "Estou ciente de que a reanimação poderá causar complicações, incluindo lesões torácicas, fraturas, lesões de órgãos e danos decorrentes da falta de oxigenação, mesmo quando executada adequadamente.",
      "Reconheço que o sucesso da reanimação não é garantido e que o retorno da circulação não significa necessariamente recuperação completa ou sobrevivência até a alta.",
      "DECISÃO DO RESPONSÁVEL (selecionar UMA alternativa após discussão clínica):",
      "(  ) Autorizo a tentativa de reanimação cardiopulmonar em caso de parada cardiorrespiratória, conforme indicação e critérios técnicos da equipe médico-veterinária.",
      "(  ) Solicito que não sejam iniciadas manobras de reanimação cardiopulmonar em caso de parada cardiorrespiratória, após discussão do prognóstico e das implicações dessa decisão com o médico-veterinário.",
      "Declaro compreender que minha manifestação deverá ser avaliada e documentada pelo profissional responsável, observadas as obrigações éticas e legais pertinentes.",
      "Condição clínica e prognóstico discutidos:",
      "Decisão registrada (obrigatório):",
      "Justificativa clínica e orientação profissional (obrigatório):",
      "Data e horário da decisão:",
      "Observações:"
    ].join("\n\n"),
    referencia: "Diretrizes clínicas RECOVER; Código de Ética CFMV 1138/2016"
  },
  {
    id: "domiciliar",
    nome: "Atendimento domiciliar",
    titulo: "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA ATENDIMENTO MÉDICO-VETERINÁRIO DOMICILIAR",
    texto: [
      "Eu, {{tutor}}, responsável pelo animal {{paciente}}, autorizo a realização de atendimento médico-veterinário no local de permanência do animal, conforme avaliação e indicação do(a) médico(a)-veterinário(a) {{veterinario}}, CRMV {{crmv}}.",
      "Declaro que fui informado(a) de que o atendimento domiciliar possibilita a realização de consultas, exames clínicos, procedimentos permitidos, administração de medicamentos, vacinação e outras atividades compatíveis com as condições técnicas e sanitárias disponíveis.",
      "Compreendo que o ambiente domiciliar apresenta limitações em comparação com clínicas e hospitais veterinários, especialmente quanto à disponibilidade de equipamentos, monitorização, exames complementares, suporte intensivo e atendimento de emergências.",
      "Fui esclarecido(a) de que, conforme a Resolução CFMV nº 1.690/2026, o atendimento domiciliar não autoriza transfusão sanguínea, anestesia geral (exceto nos casos de eutanásia), quimioterápicos antineoplásicos injetáveis, cateterismos profundos, coleta de líquor e procedimentos invasivos vedados. Procedimentos cirúrgicos somente são admitidos nas exceções expressas da norma, como sutura superficial e drenagem de abscesso, observadas condições técnicas.",
      "Compreendo que a fluidoterapia somente pode ocorrer enquanto o médico-veterinário permanecer no local, e que a sedação ou tranquilização exige a permanência profissional até a recuperação completa do paciente.",
      "Estou ciente de que, caso o médico-veterinário identifique a necessidade de recursos não disponíveis ou de assistência hospitalar, poderá indicar o encaminhamento do animal a um estabelecimento devidamente estruturado.",
      "Declaro compreender que o atendimento domiciliar não garante a resolução do quadro clínico e que o encaminhamento, transporte, internação e procedimentos hospitalares dependerão das condições assistenciais e contratuais previamente esclarecidas.",
      "Comprometo-me a fornecer informações relevantes sobre o animal e a colaborar com as condições de segurança necessárias à realização do atendimento.",
      "Após receber as informações e esclarecer minhas dúvidas, autorizo o atendimento domiciliar nos limites legais, éticos e técnicos aplicáveis.",
      "Endereço do atendimento (obrigatório):",
      "Motivo da solicitação:",
      "Procedimentos previstos (obrigatório):",
      "Limitações e riscos específicos:",
      "Orientações sobre eventual encaminhamento:",
      "Observações:"
    ].join("\n\n"),
    referencia: "CFMV 1690/2026; CFMV 1321/2020"
  }
] as const;

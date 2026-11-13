import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, ClipboardList, FileText, Mail, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({ meta: [
    { title: "Termos de Uso e Contratação | Oricse" },
    { name: "description", content: "Conheça as condições de contratação, uso, planos, fidelidade Master e responsabilidades da Oricse - Vetericio Serviços Veterinários LTDA." },
  ] }),
  component: TermosDeUso,
});

const EMPRESA = "Oricse - Vetericio Serviços Veterinários LTDA";
const CNPJ_EMPRESA = "67.099.538/0001-76";
const ENDERECO_EMPRESA = "Rua Tenente Marino Freire, bairro Maria Helena, Belo Horizonte/MG, CEP 31680-120";
const SECOES = [
  {
    "id": "identificacao",
    "title": "01. Identificação das partes e aceite",
    "intro": "Estes Termos de Uso regulam a contratação e utilização do ORICSE, plataforma oferecida por Oricse - Vetericio Serviços Veterinários LTDA, inscrita no CNPJ 67.099.538/0001-76, denominada neste documento “Oricse”.",
    "items": [
      "O endereço cadastral identificado é Rua Tenente Marino Freire, bairro Maria Helena, Belo Horizonte/MG, CEP 31680-120. O número do imóvel ainda depende de conferência no comprovante cadastral oficial.",
      "Contratante é a pessoa física ou jurídica que solicita e mantém um plano ORICSE, devidamente identificada durante o cadastro. Usuários são os profissionais e colaboradores autorizados pelo contratante.",
      "Ao concluir o aceite eletrônico, o contratante declara ter tido oportunidade de ler este documento e a Política de Privacidade, além das informações comerciais apresentadas no momento da contratação.",
      "A aceitação deve ser associada à versão disponibilizada no momento da contratação. Quando o fluxo permitir, poderão ser preservados registros de data, conta e manifestação de vontade, para comprovar as condições efetivamente apresentadas, sem presumir consentimento para finalidades distintas."
    ]
  },
  {
    "id": "definicoes",
    "title": "02. Definições",
    "intro": "Os conceitos abaixo ajudam a compreender a prestação de serviços e as responsabilidades das partes.",
    "items": [
      "Plataforma: sistema ORICSE disponibilizado pela internet, com módulos, funcionalidades e integrações pertinentes ao plano contratado.",
      "Ambiente do estabelecimento: espaço lógico separado para organização dos cadastros, usuários, arquivos e serviços de cada contratante.",
      "Administrador: usuário autorizado a organizar acessos e configurações do estabelecimento. Tutor: pessoa que utiliza os serviços oferecidos pelo estabelecimento em relação aos animais sob sua responsabilidade.",
      "Plano: conjunto de funcionalidades, limites, periodicidade de cobrança e condições comerciais informadas no processo de contratação.",
      "Para interpretar estas condições, estabelecimento inclui profissionais autônomos e pessoas jurídicas autorizadas, quando cabível. Prestadores externos são entidades independentes contratadas para funções determinadas. O acesso de um funcionário à plataforma não lhe concede automaticamente poderes de representação ou contratação."
    ]
  },
  {
    "id": "objeto",
    "title": "03. Objeto e âmbito dos serviços",
    "intro": "O ORICSE é uma solução de software como serviço (SaaS) para clínicas e hospitais veterinários, atendimento veterinário domiciliar, hotelzinho e operações de pet shop, banho e tosa.",
    "items": [
      "De acordo com o plano e a configuração habilitada, a plataforma pode disponibilizar agendas, recepção, cadastro de tutores e animais, prontuários, receitas, exames, internação, acompanhamento de medicações, hotelzinho, banho e tosa, estoque, caixa, relatórios e controle de equipe.",
      "Recursos opcionais podem incluir Portal do Tutor, campanhas, relacionamento com clientes, documentos, notificações, integrações e canais de cobrança.",
      "A existência de um módulo no catálogo não implica sua disponibilidade irrestrita em todos os planos. O escopo efetivamente contratado é aquele mostrado na oferta e confirmado pela Oricse.",
      "O contratante é responsável pelos equipamentos, navegadores, conexão e demais recursos necessários ao uso da plataforma.",
      "A descrição geral de funções não substitui a disponibilidade efetiva no plano contratado. Serviços dependentes de integrações, câmera, internet, navegadores ou equipamentos específicos poderão exigir requisitos adicionais, a serem informados quando relevantes, sem autorizar cobrança por recurso não disponibilizado conforme a oferta."
    ]
  },
  {
    "id": "licenca",
    "title": "04. Licença de uso e propriedade intelectual",
    "intro": "Enquanto o contrato estiver vigente e o acesso autorizado, a Oricse concede licença limitada, não exclusiva e intransferível para utilização das funcionalidades contratadas.",
    "items": [
      "A licença não transfere propriedade do sistema, código-fonte, identidade visual, marcas, componentes, materiais e demais ativos de propriedade intelectual.",
      "Não é permitido revender a licença, compartilhar um ambiente entre estabelecimentos não autorizados, reproduzir o código ou tentar contornar controles de segurança, observadas as exceções previstas em lei.",
      "Os dados legítimos registrados pelo estabelecimento não se tornam propriedade da Oricse por estarem armazenados ou processados na plataforma.",
      "Modelos de documentos, interfaces, marcas e materiais da plataforma podem estar sujeitos a licenças próprias ou de terceiros. O contratante conserva seus direitos legítimos sobre conteúdos inseridos, mas precisa respeitar direitos autorais, de imagem e de terceiros ao publicá-los."
    ]
  },
  {
    "id": "cadastro",
    "title": "05. Cadastro, verificação e aprovação do estabelecimento",
    "intro": "O interessado deve prestar informações corretas e demonstrar legitimidade para atuar em nome do estabelecimento ou como profissional autônomo.",
    "items": [
      "Podem ser solicitados nome, CPF/CNPJ, dados de contato, endereço, CRMV e outras informações pertinentes ao tipo de operação.",
      "O envio do cadastro e a confirmação do pagamento não significam criação imediata de ambiente nem ativação automática da conta. A Oricse poderá analisar o pedido, confirmar informações e preparar o espaço antes de liberar o acesso.",
      "Em casos justificados, poderá ser solicitada documentação adicional para verificação de representação, regularidade profissional, segurança ou prevenção a fraude, respeitada a legislação.",
      "Se a solicitação não for aceita, eventuais cobranças serão tratadas conforme a oferta, a legislação aplicável e os direitos de restituição que couberem.",
      "A análise cadastral não equivale à certificação de regularidade sanitária ou profissional pela ORICSE. Caso informações ou documentos não sejam confirmados, poderá ser solicitada complementação com esclarecimento do motivo, observadas a boa-fé, a proporcionalidade e os direitos do interessado."
    ]
  },
  {
    "id": "identificador",
    "title": "06. Identificador público (@), nome e configurações",
    "intro": "O estabelecimento pode solicitar um identificador público (@) e indicar um nome comercial para apresentação em recursos autorizados.",
    "items": [
      "A escolha do identificador depende de disponibilidade técnica, confirmação administrativa e respeito a nomes, marcas e direitos de terceiros.",
      "A Oricse poderá exigir ajuste em identificadores impróprios, conflitantes ou fraudulentos, com comunicação adequada.",
      "O contratante é responsável pela exatidão e atualização do conteúdo comercial, identidade da clínica e informações disponibilizadas aos seus tutores.",
      "A disponibilização de domínio, subdomínio ou identificador não representa registro de marca nem garante titularidade exclusiva perante terceiros. Reclamações fundamentadas de violação de direitos poderão ocasionar análise e, quando legalmente cabível, suspensão ou alteração do identificador em questão."
    ]
  },
  {
    "id": "plano",
    "title": "07. Planos, preços, periodicidade e usuários",
    "intro": "A contratação informará o plano selecionado, o valor, o período de cobrança, a quantidade de usuários incluídos, o custo de perfis adicionais e as condições comerciais aplicáveis.",
    "items": [
      "Os ciclos de cobrança podem ser mensais, trimestrais, semestrais, anuais ou bienais, conforme a oferta efetivamente contratada. A periodicidade financeira não se confunde com prazo mínimo de permanência; o plano Master possui fidelidade de 12 meses nos termos expressamente apresentados.",
      "Valores, descontos promocionais, quantidade de usuários e serviços adicionais devem ser apresentados antes da confirmação do pedido. Descontos temporários seguirão as regras informadas na oferta.",
      "Qualquer condição de renovação automática, se disponibilizada futuramente, dependerá de comunicação clara e autorização específica quando legalmente necessária.",
      "Alterações de valores ou de planos respeitarão as condições assumidas, eventuais avisos prévios e a legislação aplicável.",
      "O resumo da contratação deve apresentar, quando aplicável, valores totais, tributos, descontos, periodicidade e serviços adicionais. Divergências entre o plano contratado e a cobrança efetiva deverão ser apuradas, com correção e restituição quando devidas, sem impor dificuldades injustificadas ao contratante."
    ]
  },
  {
    "id": "master",
    "title": "08. Plano Master — fidelidade de 12 meses",
    "intro": "ATENÇÃO: o plano Master possui fidelidade contratual de 12 (doze) meses. Esta condição deve ser apresentada com destaque antes do aceite e do pagamento, independentemente de o cliente escolher cobrança mensal ou anual.",
    "items": [
      "A permanência mínima do plano Master corresponde a 1 (um) ano, contado da ativação da contratação. A modalidade de pagamento mensal não transforma esse plano em contratação sem fidelidade.",
      "Antes da contratação devem ficar claros o período mínimo, o preço, a periodicidade, eventuais benefícios da fidelização e as consequências de cancelamento antecipado, se houver.",
      "Pedidos de encerramento antes de completar 12 meses serão analisados conforme as condições específicas aceitas pelo contratante e a legislação aplicável. Não haverá cobrança automática de multa não informada expressamente na oferta e no aceite.",
      "A fidelidade não afasta direitos legais de arrependimento, resolução por descumprimento ou outras garantias legais aplicáveis. Eventual renovação por novo período de fidelidade não será presumida sem informação e aceite válidos.",
      "A fidelidade deve ser interpretada juntamente com a oferta expressamente aceita e os benefícios que a justificam, quando houver. Cancelamento antecipado não autoriza penalidade desproporcional, cobrança não informada ou supressão de direitos legais; cada situação exige avaliação conforme suas circunstâncias."
    ]
  },
  {
    "id": "pagamento",
    "title": "09. Pagamento, confirmação e acesso",
    "intro": "Os pagamentos poderão ser processados por prestadores financeiros e intermediadores independentes, conforme a opção efetivamente disponível e configurada.",
    "items": [
      "O pedido pode permanecer com status pendente até a confirmação recebida do provedor de pagamentos. O retorno visual do checkout, isoladamente, não substitui a verificação financeira.",
      "Após confirmação, a solicitação poderá ser encaminhada para análise e preparação do ambiente, conforme o fluxo do ORICSE.",
      "Informações de faturamento, recibos e registros financeiros serão disponibilizados segundo a operação e a legislação aplicável; dados confidenciais de cartão devem ser tratados pelo prestador de pagamento.",
      "Em caso de pagamento recusado, pendente ou contestado, o acesso poderá depender da regularização, sem prejuízo dos direitos aplicáveis.",
      "O estabelecimento deve conferir identificação do pagador, valores e modalidade escolhida. Divergências de status podem resultar de processamento assíncrono, análise antifraude ou indisponibilidade externa; cobranças duplicadas ou incorretas devem contar com canal adequado de contestação e correção."
    ]
  },
  {
    "id": "teste",
    "title": "10. Teste gratuito e recursos promocionais",
    "intro": "O ORICSE pode oferecer testes, demonstrações, vouchers e promoções específicas, sujeitos às condições informadas na oferta.",
    "items": [
      "Se houver teste gratuito, sua duração, elegibilidade, limitações e regras de encerramento devem ser apresentadas antes do início.",
      "Promoções e vouchers podem ser limitados por prazo, pessoa, quantidade de utilizações ou plano; o benefício exibido no resumo da contratação prevalece sobre expectativas não confirmadas.",
      "O término do teste pode restringir acesso e edição até a contratação ou regularização, observadas obrigações de tratamento dos dados e regras de exportação que caibam.",
      "Ambientes demonstrativos não devem receber prontuários reais sem fundamento legítimo e autorização apropriada. Condições especiais de participação, pesquisas ou feedback devem ser informadas previamente e não eliminam direitos essenciais, independentemente da existência de benefícios promocionais vinculados ao período de testes."
    ]
  },
  {
    "id": "cancelamento",
    "title": "11. Cancelamento, desistência e reembolsos",
    "intro": "O contratante pode solicitar encerramento da relação contratual pelo canal oficial de atendimento, observadas as condições de cada plano e os direitos estabelecidos na legislação.",
    "items": [
      "Em contratações à distância, o direito de arrependimento será respeitado quando aplicável, inclusive na forma e no prazo previstos no art. 49 do Código de Defesa do Consumidor.",
      "No plano Master, pedidos anteriores ao término da fidelidade de 12 meses seguirão a seção específica desse plano; qualquer penalidade somente poderá ser exigida quando previamente informada, legítima e válida conforme o caso.",
      "O pedido de cancelamento não elimina obrigações vencidas e legitimamente devidas. Valores eventualmente reembolsáveis serão apurados de acordo com o contrato e a legislação.",
      "A desativação do ambiente, a retirada de acessos e a disponibilização de dados seguirão os procedimentos técnicos disponíveis e as obrigações legais e profissionais de guarda.",
      "Encerramento de plano e cancelamento de transação são procedimentos distintos. A ORICSE deverá esclarecer, conforme as condições efetivas, quais cobranças permanecem devidas, os procedimentos de contestação e as consequências sobre o acesso, preservados os meios legalmente cabíveis de obtenção de dados."
    ]
  },
  {
    "id": "responsabilidade",
    "title": "12. Responsabilidades técnicas e veterinárias",
    "intro": "O ORICSE é uma ferramenta de apoio administrativo e documental. Não oferece diagnóstico automático substitutivo do profissional nem assume a responsabilidade técnica do estabelecimento.",
    "items": [
      "A clínica ou profissional responde por prontuários, prescrições, diagnósticos, condutas, anestesia, medicações, internação, cuidados, serviços e demais atos profissionais realizados.",
      "É dever do estabelecimento cumprir as normas do CRMV/CFMV e demais regras sanitárias e de exercício profissional pertinentes à sua operação.",
      "Os profissionais devem conferir informações importadas, campos calculados, dados de medicamentos, documentos e resultados antes de utilizá-los em decisões assistenciais.",
      "O ORICSE não substitui protocolos de emergência, supervisão profissional, consentimentos ou conferências que sejam necessários na rotina clínica.",
      "O profissional deverá validar as informações clínicas e a conduta adotada, especialmente em urgências. Entretanto, a exigência de conferência humana não exime a ORICSE por defeitos do software nem por informações equivocadas que lhe sejam juridicamente imputáveis."
    ]
  },
  {
    "id": "tutores",
    "title": "13. Portal do Tutor, hotelzinho e serviços pet",
    "intro": "O estabelecimento determina quais conteúdos e serviços serão disponibilizados aos seus tutores por meio de suas configurações.",
    "items": [
      "É sua responsabilidade confirmar os direitos de acesso, a legitimidade dos representantes e a adequação de documentos e informações compartilhadas.",
      "Regras de hospedagem, banho e tosa, vacinação, transporte, reservas, cancelamento de serviços e condições assistenciais pertencem à relação entre estabelecimento e tutor e não são automaticamente definidas pela Oricse.",
      "Informações públicas do estabelecimento e campanhas devem ser completas, corretas e compatíveis com as leis e normas profissionais aplicáveis.",
      "As condições comerciais e assistenciais dos serviços aos animais são definidas pelo profissional ou estabelecimento responsável e devem ser comunicadas ao tutor. Formulários eletrônicos não substituem esclarecimentos necessários, consentimento informado ou cumprimento das normas profissionais e sanitárias aplicáveis."
    ]
  },
  {
    "id": "dados",
    "title": "14. Dados pessoais, confidencialidade e LGPD",
    "intro": "O tratamento de dados pessoais segue a Política de Privacidade do ORICSE e as normas brasileiras, em especial a Lei Geral de Proteção de Dados Pessoais.",
    "items": [
      "Em regra, a Oricse é controladora dos dados necessários à sua própria contratação, faturamento e suporte e atua como operadora de dados inseridos por estabelecimentos para suas atividades, conforme os papéis definidos para cada operação.",
      "O contratante deve adotar bases legais adequadas, orientar sua equipe, configurar permissões e prestar aos titulares as informações cabíveis sobre os tratamentos sob sua responsabilidade.",
      "A Oricse e os estabelecimentos devem observar medidas de segurança, confidencialidade e tratamento de incidentes de acordo com suas obrigações e com a realidade do serviço.",
      "Consulte a Política de Privacidade para informações sobre categorias de dados, finalidades, fornecedores, retenção e direitos dos titulares.",
      "O contratante deve limitar o acesso da equipe aos dados necessários e comunicar desligamentos ou suspeitas de uso indevido. A ORICSE, por sua vez, deverá manter controles técnicos proporcionais ao risco e cooperar com pedidos legítimos de titulares e autoridades."
    ]
  },
  {
    "id": "comunicacoes",
    "title": "15. Campanhas e comunicações",
    "intro": "Ferramentas de CRM, campanhas, e-mail e mensagens devem ser usadas de forma legítima e responsável.",
    "items": [
      "O estabelecimento define o público, o conteúdo, a base legal e a frequência de seus envios, além de respeitar recusas, revogação de consentimentos e mecanismos de descadastro quando aplicáveis.",
      "É proibido utilizar a plataforma para spam ilícito, assédio, comunicações fraudulentas ou divulgação não autorizada de informações pessoais e clínicas.",
      "Fornecedores de comunicação podem estabelecer limites técnicos, políticas e condições próprias.",
      "O uso de campanhas exige atenção às regras de envio, identificação do remetente e descadastramento. O fornecimento da ferramenta não autoriza reutilização indiscriminada de informações clínicas ou de tutores para publicidade sem fundamento jurídico, necessidade demonstrável e salvaguardas apropriadas."
    ]
  },
  {
    "id": "seguranca",
    "title": "16. Segurança e condutas proibidas",
    "intro": "Todos os usuários devem proteger suas credenciais e acessar apenas os dados e módulos para os quais estejam autorizados.",
    "items": [
      "É vedado tentar invadir contas, contornar permissões, exfiltrar informações, inserir malware, manipular cobranças, fraudar documentos ou explorar vulnerabilidades.",
      "O contratante deve cadastrar usuários individualmente, revisar acessos após desligamentos e notificar suspeitas de comprometimento.",
      "A Oricse poderá adotar medidas proporcionais de contenção e suspensão em caso de risco comprovado à segurança, fraude ou abuso, respeitando o devido tratamento da situação e as obrigações legais.",
      "Compartilhar senhas, tentar acessar dados de outras clínicas ou explorar falhas são condutas proibidas. Medidas preventivas devem ser proporcionais e documentadas quando cabível, sem justificar retenção abusiva de prontuários, comprovantes ou documentos cuja entrega seja legalmente devida."
    ]
  },
  {
    "id": "disponibilidade",
    "title": "17. Disponibilidade, manutenção e terceiros",
    "intro": "A plataforma é oferecida como serviço digital sujeito a operações de infraestrutura e a eventuais interrupções.",
    "items": [
      "A Oricse buscará manter estabilidade, segurança e recuperação de falhas, sem prometer disponibilidade absoluta ou ausência integral de erros.",
      "Poderão ocorrer manutenções e alterações técnicas necessárias para segurança, correções, compatibilidade ou melhoria dos recursos, observadas as obrigações da contratação.",
      "Serviços externos, como bancos de dados, armazenamento, meios de pagamento, comunicação e mapas, podem possuir termos próprios e sofrer indisponibilidades não controladas pela Oricse.",
      "Incidentes em funções críticas deverão ser avaliados segundo extensão, duração, possibilidade de mitigação e responsabilidade contratual. Quando aplicável, a ORICSE deverá prestar informações razoáveis sobre a ocorrência, providências e alternativas, sem afastar direitos decorrentes de falhas atribuíveis à prestação do serviço."
    ]
  },
  {
    "id": "dados-retencao",
    "title": "18. Continuidade, exportação e encerramento dos dados",
    "intro": "O encerramento do serviço pode implicar restrição ou desativação de acesso, mas os dados devem ser tratados conforme a legislação e as condições contratadas.",
    "items": [
      "Quando disponíveis, as funções de exportação e os procedimentos de obtenção de cópias devem ser utilizados com antecedência e observância das regras de confidencialidade.",
      "A retenção, eliminação e eventual conservação obrigatória de informações observarão os prazos legais, contábeis, profissionais e contratuais aplicáveis.",
      "Dados de terceiros não poderão ser entregues a pessoas não autorizadas, inclusive em solicitações de exportação de acervos clínicos.",
      "A clínica poderá ser obrigada a conservar documentos após o término da assinatura por prazos profissionais e fiscais. A transição deve distinguir dados acessíveis ao contratante, informações de terceiros, arquivos sujeitos a guarda e cópias técnicas temporárias."
    ]
  },
  {
    "id": "alteracoes",
    "title": "19. Atualizações contratuais e comunicação",
    "intro": "O ORICSE poderá atualizar seus recursos e estes Termos em razão de exigências legais, evolução tecnológica ou mudanças de serviço.",
    "items": [
      "Alterações materiais serão comunicadas por meios apropriados, respeitando direitos adquiridos, condições contratadas e o direito de escolha do contratante quando aplicável.",
      "A versão vigente será disponibilizada em página pública, com a data de atualização.",
      "Quando uma alteração exigir aceite adicional, a Oricse deverá providenciar mecanismo apropriado de ciência e manifestação.",
      "Mudanças relevantes deverão permitir identificação da nova versão e compreensão dos impactos. A continuidade da navegação não equivale automaticamente a aceite válido de qualquer alteração, sobretudo em preços, fidelidade ou tratamento opcional de dados pessoais."
    ]
  },
  {
    "id": "contato",
    "title": "20. Atendimento, identificação e disposições finais",
    "intro": "Solicitações de suporte, contratação, cancelamento ou esclarecimentos poderão ser encaminhadas à Oricse - Vetericio Serviços Veterinários LTDA pelo contato oficial.",
    "items": [
      "E-mail: atendimento@oricse.com.br. Para facilitar o atendimento, informe o estabelecimento, o assunto e o número da solicitação, caso disponível.",
      "Nome empresarial: Vetericio Serviços Veterinários LTDA; CNPJ: 67.099.538/0001-76; localização cadastral identificada: Rua Tenente Marino Freire, bairro Maria Helena, Belo Horizonte/MG, CEP 31680-120 (número do imóvel pendente de confirmação).",
      "Eventuais controvérsias serão tratadas preferencialmente pelos canais de atendimento e por meios adequados de solução, sem afastar o foro competente e as proteções obrigatórias previstas na legislação.",
      "Condições comerciais e documentos complementares efetivamente aceitos integram a relação contratual conforme a lei; eventuais divergências devem ser apuradas pelos canais oficiais.",
      "Solicitações jurídicas, financeiras e de privacidade devem utilizar canais oficiais verificáveis. A previsão de atendimento eletrônico não impede reclamações perante órgãos competentes nem altera prazos legais, observados a natureza do pedido e os deveres de resposta aplicáveis."
    ]
  },
  {
  "id": "licencas-terceirizadas",
  "title": "21. Prestadores externos, licenças e condições de integração",
  "intro": "Para operar seus módulos, a ORICSE depende de serviços e componentes independentes sujeitos a licenças e contratos de terceiros.",
  "items": [
    "Podem ser empregados serviços de hospedagem, execução de aplicações, redes, autenticação, segurança, banco de dados, armazenamento, sincronização de documentos, comunicação e intermediação financeira. O emprego de cada serviço depende das funcionalidades habilitadas e não implica que todos os prestadores tenham acesso a todos os dados.",
    "Os contratos, licenças de APIs, permissões, políticas de uso e limites operacionais dos fornecedores podem impor restrições, alterações, suspensão ou revogação de recursos. A contratação da ORICSE não transfere ao contratante propriedade intelectual nem licença autônoma para explorar tecnologias de terceiros.",
    "Falhas, manutenções, indisponibilidades ou mudanças de condições de serviços externos podem afetar a plataforma. A ORICSE empregará esforços razoáveis de prevenção, mitigação, comunicação e restabelecimento, sem prometer ausência absoluta de interrupções.",
    "Quando o contratante conectar conta própria de serviço externo, deverá preservar as autorizações e cumprir regras aplicáveis, sem prejuízo das obrigações próprias da ORICSE e dos direitos legais que não possam ser afastados por contrato.",
    "Prestadores financeiros independentes poderão conduzir suas próprias análises de identificação, prevenção de fraudes, aprovação, estorno e contestação, de acordo com suas regras e a legislação aplicável.",
    "Nenhuma referência a terceiro exclui a responsabilidade da ORICSE por atos ou omissões que lhe sejam juridicamente imputáveis.",
    "As regras dos fornecedores externos podem variar por região, modalidade de integração e tipo de licença. A ORICSE deve avaliar compatibilidade contratual e requisitos de segurança antes de adotar serviços essenciais, sem garantir que condições de terceiros permaneçam imutáveis."
  ]
},
  {
  "id": "dados-continuidades",
  "title": "22. Continuidade, prontuários e cooperação",
  "intro": "A operação da plataforma e de suas integrações não substitui os deveres de guarda, sigilo e responsabilidade profissional.",
  "items": [
    "O profissional e o estabelecimento permanecem responsáveis pela elaboração, exatidão, assinatura e conservação de registros e documentos clínicos segundo normas profissionais aplicáveis.",
    "Procedimentos de cópia, sincronização, exportação e recuperação dependem das capacidades técnicas, licenças e configurações dos serviços disponíveis, não constituindo promessa de restauração infalível ou de backup irrestrito.",
    "No encerramento ou suspensão, a ORICSE e o estabelecimento deverão cooperar, dentro das condições contratadas e da legislação, para preservar e disponibilizar os dados cuja entrega seja devida, sem permitir acesso de pessoas não autorizadas.",
    "Alterações materiais em funcionalidades, integrações ou condições de serviço deverão observar os deveres legais de transparência, comunicação e tratamento de dados.",
    "Se a indisponibilidade afetar urgências ou registros assistenciais, o estabelecimento deve manter contingência clínica proporcional. Essa providência não reduz o dever da ORICSE de preservar integridade, investigar falhas e apoiar a recuperação quando exigido por suas obrigações legais ou contratuais."
  ]
},
  {
  "id": "catalogo",
  "title": "23. Abrangência dos módulos e configurações",
  "intro": "O ORICSE disponibiliza um catálogo modular, sem garantia de que todos os recursos estejam incluídos em todos os planos ou ativados em todos os estabelecimentos.",
  "items": [
    "Conforme contratação e configuração, os módulos podem abranger recepção, consultório, internação, exames, vacinas, documentos, prescrições, agenda, Portal do Tutor, hospitalidade pet, banho e tosa, vendas, orçamentos, estoque, caixa, gestão de equipes, ponto, CRM, sites de clínicas, OricStudio, OricsePay e outros recursos divulgados na oferta.",
    "Os módulos, limites de usuários, cargos, integrações, funcionalidades experimentais e serviços adicionais dependerão do plano, da oferta vinculante, das autorizações e da situação da contratação.",
    "Funcionalidades em demonstração e informações fictícias devem estar segregadas dos ambientes produtivos. A demonstração não representa compromisso de disponibilidade, precisão ou identidade com cada plano comercial.",
    "A contratação de um módulo não dispensa análise de limitações, especialmente em funções beta ou dependentes de dispositivos externos. Modificações substanciais de escopo devem respeitar as condições comerciais aceitas e assegurar comunicação adequada ao contratante."
  ]
},
  {
  "id": "financeiro",
  "title": "24. OricsePay, intermediação financeira e conciliação",
  "intro": "Os recursos de cobrança e pagamento estão sujeitos à habilitação, ao contrato aplicável e aos serviços financeiros de terceiros legalmente autorizados.",
  "items": [
    "A ORICSE pode oferecer integração tecnológica para cobranças, links, pagamentos presenciais ou remotos, repasses, conciliação e modalidades de antecipação quando efetivamente contratadas e disponibilizadas; a oferta específica prevalece sobre a descrição genérica.",
    "Taxas, descontos, prazos de liquidação, retenções, reservas, antecipações e destinatários do recebimento deverão ser apresentados no fluxo comercial e nos instrumentos específicos pertinentes, sem garantia de aprovação de operações ou antecipação de valores.",
    "Reembolsos, cancelamentos, contestações, chargebacks, prevenção a fraude, verificações de identidade e eventual bloqueio de transações obedecerão às responsabilidades, às normas legais e às condições do prestador financeiro, conforme seu papel na operação.",
    "A ORICSE não se declara instituição financeira ou responsável pela custódia de recursos apenas por disponibilizar integração técnica. Sua responsabilidade por integração, informações, falhas próprias e obrigações legais permanece preservada.",
    "O contratante deve conferir lançamentos, dados dos destinatários, conciliações e eventuais divergências, comunicando erros pelos canais de atendimento, sem prejuízo do dever da ORICSE de corrigir falhas que lhe sejam imputáveis.",
    "Quando existirem diferentes destinatários de pagamento, as regras de divisão de valores deverão ser claras e vinculadas à operação autorizada. A conciliação exibida no sistema não constitui comprovante definitivo de liquidação antes da confirmação financeira pertinente, inclusive após estornos."
  ]
},
  {
  "id": "studio",
  "title": "25. OricStudio, redes sociais e propriedade intelectual",
  "intro": "As ferramentas de criação e gestão de conteúdo são auxiliares da atividade do contratante e podem operar por meio de contas e plataformas externas.",
  "items": [
    "O contratante declara possuir poderes para conectar perfis e autorizar, quando habilitado, agendamentos, publicações e interações em seus canais. Revogar acessos ou desconectar serviços pode interromper fluxos e publicações.",
    "O contratante é responsável pela legitimidade dos materiais, marcas, imagens, músicas, dados pessoais e direitos de terceiros que fornecer, aprovar ou mandar publicar; a ORICSE responde pelos atos e falhas que lhe sejam próprios, nos limites da lei.",
    "Plataformas de redes sociais podem limitar APIs, alterar requisitos, rejeitar publicações, suspender contas ou remover conteúdos. Nenhuma ferramenta da ORICSE garante alcance, engajamento, resultado publicitário ou disponibilidade de canal externo.",
    "Recursos automatizados, sugestões e conteúdo eventualmente gerado por inteligência artificial exigem revisão humana, especialmente quanto a exatidão, publicidade veterinária, direitos autorais, discriminação, sigilo e dados pessoais. Não devem ser publicados sem conferência do responsável.",
    "Condições especiais de licença de mídias, modelos, marcas e serviços de terceiros devem ser observadas pelo usuário conforme cada integração, sem afastar as obrigações próprias da ORICSE.",
    "Antes de publicar conteúdo automatizado, o responsável pelo perfil deverá conferir material e configurações da conta. Pedidos de remoção, correção ou contestação autoral dependerão da natureza do conteúdo, das permissões concedidas e das condições do canal externo utilizado."
  ]
},
  {
  "id": "vendas",
  "title": "26. Venda Expressa, orçamentos, estoque, caixa e fiscalidade",
  "intro": "As funcionalidades comerciais oferecem apoio ao registro e ao controle operacional do estabelecimento.",
  "items": [
    "Vendas expressas podem ocorrer sem cadastro de tutor quando permitido pela legislação e pelo fluxo contratado; o estabelecimento permanece responsável pelos registros obrigatórios, fornecimento de informações e comprovação da transação.",
    "Orçamentos são documentos comerciais sujeitos à conferência de itens, validade, quantidades, preços, tributos, condições e aceite pelo estabelecimento e pelo cliente. A geração de PDF ou imagem não substitui documento fiscal exigido em lei.",
    "Estoque, movimentações, entradas, saídas, validade de produtos, inventários, favoritos e históricos dependem de alimentação e conferência pelos usuários autorizados; divergências devem ser registradas e investigadas.",
    "Recebimentos, fechamentos de caixa, ajustes, cancelamentos, estornos e devoluções devem manter trilhas adequadas de autorização e justificativa conforme a funcionalidade disponibilizada. O contratante responde pela gestão fiscal e contábil de seu negócio, sem excluir responsabilidade da ORICSE por erros próprios do software.",
    "A ORICSE não substitui contabilidade, emissão fiscal legalmente obrigatória ou sistemas governamentais específicos, salvo se houver integração expressamente contratada e habilitada.",
    "Leitores de código de barras, cadastros rápidos e importações podem produzir identificação incompleta, exigindo conferência do produto. Divergências entre preços anunciados, orçamento, itens efetivamente fornecidos e cobrança final deverão ser tratadas conforme a oferta aceita e a legislação aplicável."
  ]
},
  {
  "id": "clinica",
  "title": "27. Atos veterinários, prontuários e recursos de apoio clínico",
  "intro": "A aplicação fornece instrumentos administrativos e de documentação, sem assumir a função privativa do médico-veterinário.",
  "items": [
    "Prescrições, receitas controladas, cálculo de doses e fluidos, evolução, internação, agendas terapêuticas, exames, procedimentos e orientações clínicas devem ser conferidos e validados por profissional habilitado antes de seu uso assistencial.",
    "O usuário deve verificar identidade do animal, espécie, peso, condição clínica, apresentação e concentração do medicamento, unidades, via, intervalo, limites de dose, contraindicações e demais condições relevantes. Erros de preenchimento ou conversão podem causar dano e devem ser comunicados imediatamente.",
    "O sistema não substitui supervisão contínua, protocolos de emergência, aferição clínica, responsabilidade técnica, consentimentos específicos ou as exigências de prontuários e receituários previstas nas normas profissionais.",
    "A ORICSE permanece responsável por defeitos e falhas do serviço que lhe sejam juridicamente imputáveis, inclusive quando causarem dano; nenhuma previsão transfere indiscriminadamente ao veterinário a responsabilidade por erro técnico do software.",
    "Registros e documentos clínicos devem observar deveres de sigilo, autenticidade, guarda, acesso, disponibilização e integridade previstos em lei e nas normas profissionais aplicáveis.",
    "Informações usadas em cálculos clínicos devem ser verificadas quanto a unidades, concentração e apresentação dos medicamentos, especialmente em opções personalizáveis. Inconsistências detectadas deverão ser comunicadas, documentadas e, quando atribuíveis à ORICSE, investigadas e corrigidas sem atraso injustificado."
  ]
},
  {
  "id": "portal",
  "title": "28. Portal do Tutor, agendamentos e serviços aos animais",
  "intro": "O estabelecimento é responsável pelo atendimento e pela legitimidade do vínculo entre tutor, animal e documentos acessados.",
  "items": [
    "Os recursos de agendamento, cobrança antecipada e reserva de horários obedecem às condições visíveis no momento da solicitação e às regras do prestador de pagamento; disponibilidade apresentada não garante confirmação definitiva antes dos controles aplicáveis.",
    "É responsabilidade do estabelecimento conferir a identidade e os poderes do solicitante antes de liberar prontuários, prescrições, exames, documentos e demais informações do animal, respeitados os direitos de titulares e de terceiros.",
    "Quando um tutor possui vínculos com mais de um estabelecimento, os dados de cada clínica deverão ser segregados conforme autorização e finalidade; o vínculo a uma clínica não autoriza, por si só, acesso a acervos de outras.",
    "Serviços de hotelzinho, creche, hospedagem, alimentação, medicações de rotina, banho e tosa podem exigir condições particulares, restrições de saúde e consentimentos específicos definidos entre estabelecimento e cliente.",
    "Confirmações, atrasos, faltas, cancelamentos e devoluções de serviços prestados pelo estabelecimento são regidos pelas condições específicas e pela legislação aplicável; a ORICSE responde apenas por suas obrigações próprias como fornecedora da plataforma.",
    "O agendamento online pode depender de agenda disponível, profissional, confirmação de pagamento e regras de prazo informadas ao tutor. Cancelamentos e alterações devem ser comunicados conforme a operação, sem ocultar valores, condições ou direitos de restituição aplicáveis."
  ]
},
  {
  "id": "equipe",
  "title": "29. Equipe, ponto, permissões e gestão administrativa",
  "intro": "A atribuição de credenciais e funções deve observar necessidade de acesso, segurança, obrigações trabalhistas e normas do estabelecimento.",
  "items": [
    "O contratante administra cargos, permissões, vínculos de funcionários, desligamentos e autorizações concedidas em seus ambientes, respeitadas as proteções técnicas do sistema.",
    "Registros de jornada, escalas, comissões, produtividade, remuneração e relatórios são ferramentas de apoio e devem ser conferidos com as normas trabalhistas, instrumentos coletivos e exigências fiscais aplicáveis; sua existência não garante enquadramento automático como sistema oficial de ponto.",
    "A ORICSE deve adotar controles proporcionais para impedir acessos indevidos entre estabelecimentos e executar adequadamente as restrições contratadas, sem transferir ao contratante responsabilidade por falhas técnicas próprias.",
    "É vedado criar usuários fictícios para obter acesso indevido, compartilhar credenciais ou consultar informações sem necessidade funcional e base legítima.",
    "Perfis administrativos e permissões elevadas exigem especial cautela, pois podem permitir exportação e edição de informações relevantes. O registro de jornadas, escalas e movimentações de pessoal não substitui controles trabalhistas ou documentos legalmente exigidos quando aplicáveis."
  ]
},
  {
  "id": "dados-secao-30",
  "title": "30. Exportação, cópias de segurança, exclusão e continuidade",
  "intro": "A disponibilidade dos dados está sujeita a limitações técnicas e obrigações legais de conservação, sem afastar deveres de segurança.",
  "items": [
    "Procedimentos de backup, cópias externas, sincronização e recuperação dependem da infraestrutura, das licenças e das autorizações efetivamente disponíveis. Nenhuma cláusula constitui garantia absoluta contra perda de dados ou dispensa medidas adequadas de prevenção.",
    "Mediante encerramento ou solicitação legitimada, o contratante poderá requerer informações e exportação dos dados que lhe pertençam ou aos quais tenha direito, por meios seguros e na extensão técnica e legal cabível.",
    "Suspensão de cobrança não deve implicar destruição arbitrária de prontuários ou outros documentos de guarda obrigatória. Os procedimentos específicos de retenção, transição e eliminação deverão respeitar legislação, contratos e direitos dos titulares.",
    "A ORICSE deve comunicar incidentes e apoiar os controladores na forma exigida pela LGPD, além de adotar medidas proporcionais de resposta e continuidade.",
    "Pedidos de extração, transferência e eliminação devem ser verificados quanto à legitimidade e aos deveres de guarda. A ORICSE não poderá invocar limitações técnicas genéricas para afastar obrigações contratuais ou legais efetivamente exigíveis."
  ]
},
  {
  "id": "planos",
  "title": "31. Promoções, Programa Beta, fidelidade e renovação",
  "intro": "Condições especiais devem constar de oferta, instrumento individual ou regulamento próprio, com informação clara e verificável.",
  "items": [
    "Benefícios de programas beta, gratuidade temporária, descontos por prazo determinado, cupons, condições de fundador e preços promocionais só se aplicam às contratações expressamente elegíveis e nos limites informados no instrumento aceito.",
    "A participação em testes não dispensa padrões legais de segurança, transparência e cooperação; alterações relevantes de funcionalidades experimentais deverão ser comunicadas quando exigido.",
    "Renovações, reajustes, cobrança recorrente, fidelidade do plano Master e consequências de cancelamento precisam ser comunicados com clareza e respeitar regras legais aplicáveis. Não haverá contratação onerosa automática quando a oferta não autorizar essa cobrança.",
    "Benefícios descritos como permanentes em instrumentos específicos válidos devem observar suas condições pactuadas, sem serem eliminados por simples alteração genérica dos Termos.",
    "Benefícios de fundadores e acesso antecipado não garantem funcionalidades inexistentes nem dispensam comunicação de riscos dos testes. Promessas específicas de desconto ou gratuidade deverão observar a elegibilidade e as condições válidas aceitas pelo contratante."
  ]
},
  {
  "id": "responsabilidade-secao-32",
  "title": "32. Limites jurídicos, comunicação e resolução de conflitos",
  "intro": "As partes devem colaborar para mitigar incidentes e resolver divergências de maneira documentada e proporcional.",
  "items": [
    "Nenhuma disposição exclui responsabilidade por dolo, culpa, defeito do serviço, descumprimento contratual ou direitos indisponíveis quando juridicamente atribuíveis à ORICSE.",
    "O contratante deverá relatar incidentes, cobranças indevidas, falhas, dados divergentes e solicitações de correção com informações suficientes para investigação, sem que essa cooperação constitua renúncia de direitos.",
    "As provas de adesão, versão aplicável, oferta, registros de autorização e comunicações deverão ser conservadas quando geradas, segundo critérios legítimos de retenção e proteção de dados.",
    "Eventual conflito será tratado inicialmente pelos canais oficiais quando possível, sem limitar o acesso a autoridades administrativas, mecanismos de solução de conflitos ou ao Poder Judiciário.",
    "A interpretação das cláusulas deve observar boa-fé, equilíbrio e legislação aplicável. Disposições genéricas não podem excluir indenização legalmente devida, impedir produção de provas, restringir acesso ao Judiciário nem afastar direitos de titulares de dados pessoais."
  ]
}
] as const;

function TermosDeUso() {
 return (
  <main className="min-h-screen bg-[#F8F5F2] text-[#381724]">
   <div className="border-b border-[#E9DCE0] bg-white">
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
     <Link to="/" className="inline-flex items-center gap-3" aria-label="Oricse — início"><img src="/oricse-logo-oryx.svg?v=15" alt="Logo da Oricse" width="56" height="56" className="h-12 w-12 object-contain"/><span className="text-lg font-extrabold tracking-wide">ORICSE</span></Link>
     <Link to="/planos" className="inline-flex items-center gap-2 text-sm font-semibold text-[#703047] hover:underline"><ArrowLeft size={16}/> Voltar ao site</Link>
    </header>
   </div>
   <section className="relative overflow-hidden bg-[#4A182C] px-5 py-14 text-white sm:py-20">
    <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-48 h-[30rem] w-[30rem] rounded-full border-[70px] border-white/5"/>
    <div className="relative mx-auto max-w-6xl">
     <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.19em] text-[#EED8DF]"><ShieldCheck size={17}/> Clareza, responsabilidades e transparência</p>
     <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">Termos de Uso e Contratação</h1>
     <p className="mt-5 max-w-3xl text-base leading-8 text-[#F0DBE2]">Condições de acesso, planos, pagamentos, responsabilidades e direitos relacionados ao uso do ecossistema ORICSE.</p>
     <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/90"><span className="rounded-full border border-white/25 px-4 py-2">Contratação de software como serviço</span><span className="rounded-full border border-white/25 px-4 py-2">Revisado em 12/11/2026</span></div>
    </div>
   </section>
   <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
    <section className="mb-10 grid gap-4 rounded-3xl border border-[#E8D9DE] bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
     <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#8B5E6D]">Responsável pela plataforma</p>
      <h2 className="mt-2 text-lg font-bold">{EMPRESA}</h2>
      <p className="mt-1 text-sm font-semibold text-[#703047]">CNPJ: {CNPJ_EMPRESA}</p>
      <p className="mt-1 text-sm leading-6 text-[#78666C]">Endereço cadastral identificado: {ENDERECO_EMPRESA} (número sujeito à conferência).</p>
     </div>
     <a href="mailto:atendimento@oricse.com.br?subject=Termos%20de%20Uso%20e%20Contrata%C3%A7%C3%A3o%20%E2%80%94%20Oricse" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCC7D0] px-5 py-3 text-sm font-bold text-[#703047] hover:bg-[#FBF4F7]"><Mail size={17}/> Falar com a Oricse <ArrowUpRight size={15}/></a>
    </section>
    <div className="grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
     <aside className="rounded-2xl border border-[#E8D9DE] bg-white p-5 lg:sticky lg:top-5">
      <div className="mb-3 flex items-center gap-2"><FileText size={18} className="text-[#703047]"/><h2 className="font-bold">Neste documento</h2></div>
      <nav aria-label="Índice dos termos" className="max-h-[65vh] space-y-1 overflow-y-auto">{SECOES.map(secao=><a key={secao.id} href={`#${secao.id}`} className="block rounded-lg px-2 py-2 text-sm leading-5 text-[#6C5860] transition hover:bg-[#F8EFF2] hover:text-[#703047]">{secao.title}</a>)}</nav>
     </aside>
     <article className="min-w-0 rounded-3xl border border-[#E8D9DE] bg-white p-5 shadow-sm sm:p-9">
      <div className="mb-9 rounded-2xl border-l-4 border-[#703047] bg-[#FAF4F6] p-5">
       <h2 className="font-bold">Antes de contratar</h2>
       <p className="mt-2 text-sm leading-7 text-[#6F5D64]">Verifique as condições do plano e as regras de pagamento e aprovação. <strong className="text-[#703047]">O plano Master tem fidelidade de 12 meses, inclusive quando o pagamento é mensal.</strong> Os direitos previstos em lei permanecem resguardados.</p>
      </div>
      {SECOES.map(secao=><section id={secao.id} key={secao.id} className="scroll-mt-6 border-b border-[#F0E6E9] py-8 first:pt-0 last:border-0 last:pb-0">
       <h2 className="font-display text-xl font-bold leading-snug text-[#4A182C] sm:text-2xl">{secao.title}</h2>
       <p className="mt-4 text-[15px] leading-8 text-[#695860]">{secao.intro}</p>
       <ul className="mt-4 space-y-3">{secao.items.map(item=><li key={item} className="flex items-start gap-3 text-[15px] leading-7 text-[#695860]"><span aria-hidden="true" className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#A36C80]"/><span>{item}</span></li>)}</ul>
      </section>)}
      <div className="mt-10 rounded-2xl bg-[#4A182C] p-6 text-white sm:p-8">
       <p className="text-xs font-bold uppercase tracking-widest text-white/70">Atendimento e contratações</p>
       <h2 className="mt-3 font-display text-2xl font-bold">Fale com a Oricse</h2>
       <p className="mt-2 text-sm leading-7 text-white/80">Para dúvidas comerciais, solicitações, cancelamento e esclarecimentos sobre estes Termos, entre em contato.</p>
       <a className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-[#4A182C] hover:bg-[#F8EEF2]" href="mailto:atendimento@oricse.com.br?subject=Termos%20de%20Uso%20e%20Contrata%C3%A7%C3%A3o%20%E2%80%94%20Oricse"><Mail size={18}/> atendimento@oricse.com.br <ArrowUpRight size={16}/></a>
      </div>
      <p className="mt-6 text-xs leading-6 text-[#8A747D]">Para informações complementares sobre condições comerciais e tratamento de dados, utilize os canais oficiais de atendimento.</p>
     </article>
    </div>
    <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[#E1D4D9] pt-6 text-xs text-[#856F78]"><span>© {new Date().getFullYear()} {EMPRESA}</span><div className="flex gap-5"><Link to="/politica-de-privacidade" className="underline underline-offset-4">Política de Privacidade</Link><Link to="/" className="underline underline-offset-4">Início</Link></div></footer>
   </div>
  </main>
 );
}

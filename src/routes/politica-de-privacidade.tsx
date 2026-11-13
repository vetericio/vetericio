import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, FileText, Mail, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({ meta: [
    { title: "Política de Privacidade e Proteção de Dados | Oricse" },
    { name: "description", content: "Saiba como a Oricse - Vetericio Serviços Veterinários LTDA trata dados pessoais e protege a privacidade de usuários, clínicas e tutores." }
  ] }),
  component: PoliticaDePrivacidade,
});

const EMPRESA = "Oricse - Vetericio Serviços Veterinários LTDA";
const CNPJ_EMPRESA = "67.099.538/0001-76";
const ENDERECO_EMPRESA = "Rua Tenente Marino Freire, bairro Maria Helena, Belo Horizonte/MG, CEP 31680-120";
const SECOES = [
  {
    "id": "apresentacao",
    "title": "01. Apresentação e abrangência",
    "intro": "Esta Política explica como os dados pessoais são tratados no site e na plataforma Oricse, incluindo a contratação de planos, a operação de estabelecimentos veterinários e pet, o Portal do Tutor e os canais de atendimento.",
    "items": [
      "Aplica-se a visitantes, interessados, contratantes, responsáveis técnicos, funcionários e usuários autorizados dos estabelecimentos, tutores e outras pessoas cujos dados sejam registrados no sistema.",
      "O tratamento varia conforme os módulos efetivamente utilizados pela empresa contratante. Uma funcionalidade disponível no sistema não significa que todos os estabelecimentos a utilizem.",
      "Esta Política complementa os Termos de Uso e deve ser lida em conjunto com os avisos e documentos específicos de cada estabelecimento quando existentes."
    ]
  },
  {
    "id": "responsabilidades",
    "title": "02. Quem é responsável pelos dados",
    "intro": "A definição de controlador e operador depende de quem decide as finalidades e os meios essenciais do tratamento em cada atividade.",
    "items": [
      "Oricse - Vetericio Serviços Veterinários LTDA atua, em regra, como controladora dos dados necessários ao seu próprio site, contratação de planos, relacionamento comercial, suporte, administração de contas e segurança da plataforma.",
      "Quando uma clínica, hospital veterinário, profissional domiciliar, hotelzinho ou pet shop registra dados de tutores, clientes, profissionais e atendimentos para sua própria atividade, esse estabelecimento é normalmente o controlador; a Oricse trata tais informações como operadora, de acordo com a contratação e as instruções legítimas recebidas.",
      "O estabelecimento é responsável por informar seus titulares, definir bases legais, administrar as permissões de sua equipe e avaliar a legitimidade dos dados, documentos e campanhas que cadastra. A classificação dos agentes pode variar conforme a operação concreta."
    ]
  },
  {
    "id": "categorias",
    "title": "03. Quais dados podem ser tratados",
    "intro": "Tratamos informações fornecidas durante cadastros, atendimentos e operações, além de dados técnicos necessários ao funcionamento do serviço.",
    "items": [
      "Identificação e contato: nome, nome empresarial, CPF/CNPJ, CRMV e UF, endereço, CEP, telefone, e-mail e informações de representantes e responsáveis.",
      "Contas e segurança: credenciais e identificadores de usuários, perfis e permissões, vínculos a estabelecimentos, eventos de acesso, informações técnicas de sessão, dispositivo, navegador e registros de segurança.",
      "Dados de tutores e clientes: identificação, contato, endereço, preferências de comunicação e histórico de relacionamento ou de serviços utilizados.",
      "Dados relativos aos animais: identificação, espécie, raça, idade, histórico veterinário, prontuários, anamneses, receitas, exames, evolução, internação, medicações, vacinas, imagens e documentos, quando inseridos no sistema.",
      "Operações do estabelecimento: agendas, reservas, estadias, cuidados em hotelzinho, creche, banho e tosa, estoque, comanda, caixa, relatórios, equipe, horários e tarefas.",
      "Cobranças e contratações: plano, valores, cupons, situação financeira, identificadores de transações e confirmações de pagamento. Dados de pagamento são processados também pelo prestador responsável pelo checkout.",
      "Comunicações e arquivos: mensagens de suporte, documentos enviados, dados de campanhas e registros das preferências de contato."
    ]
  },
  {
    "id": "finalidades",
    "title": "04. Para que utilizamos os dados",
    "intro": "O tratamento é limitado às atividades necessárias e compatíveis com as finalidades informadas aos titulares.",
    "items": [
      "Fornecer, administrar e personalizar os módulos contratados e permitir que equipes autorizadas atendam seus clientes e animais.",
      "Gerenciar contas, autenticação, permissões, agendamentos, Portal do Tutor, documentos, serviços, estoque, caixa e relatórios.",
      "Operacionalizar contratação, faturamento, pagamento, confirmação financeira, suporte, cancelamento e prevenção a fraudes.",
      "Manter segurança, prevenir acessos indevidos, diagnosticar falhas, registrar eventos operacionais e assegurar continuidade do serviço.",
      "Permitir comunicações transacionais (por exemplo, informações de agendamento e atendimento) e, quando cabível e legitimamente autorizado, comunicações promocionais de responsabilidade do estabelecimento.",
      "Atender exigências legais, regulatórias, requisições legítimas e exercício regular de direitos."
    ]
  },
  {
    "id": "bases-legais",
    "title": "05. Bases legais do tratamento",
    "intro": "O tratamento de dados pessoais deve estar apoiado em uma hipótese legal adequada, definida de acordo com a finalidade e o contexto.",
    "items": [
      "Execução de contrato ou procedimentos preliminares, quando o dado é necessário à contratação e à prestação dos serviços.",
      "Cumprimento de obrigações legais e regulatórias, inclusive obrigações fiscais, contábeis e profissionais aplicáveis.",
      "Legítimo interesse, quando cabível e após avaliação dos direitos e expectativas dos titulares, especialmente para segurança e aperfeiçoamento do serviço.",
      "Exercício regular de direitos em processos judiciais, administrativos ou arbitrais.",
      "Consentimento livre, informado e específico quando a legislação exigir, como em determinadas comunicações opcionais. O consentimento pode ser revogado nos termos da LGPD.",
      "Quando houver dados pessoais sensíveis de pessoas naturais, aplicam-se as hipóteses e salvaguardas específicas previstas na LGPD. Registros veterinários sobre animais não são, por si sós, dados pessoais sensíveis de seres humanos, mas podem conter dados pessoais dos tutores e profissionais."
    ]
  },
  {
    "id": "portal",
    "title": "06. Portal do Tutor e documentos",
    "intro": "O Portal do Tutor é uma extensão dos serviços disponibilizados pelo estabelecimento que utiliza a plataforma.",
    "items": [
      "A clínica define os recursos exibidos aos seus tutores, como dados dos animais, agendamentos, documentos, comprovantes, resultados, comunicados e informações de serviços.",
      "O estabelecimento deve conferir a identidade de quem recebe acesso e verificar se a divulgação de documentos é adequada ao vínculo com o animal e às regras profissionais aplicáveis.",
      "A Oricse fornece os recursos técnicos do portal, sem substituir as decisões do estabelecimento sobre quais informações devem ser registradas ou compartilhadas."
    ]
  },
  {
    "id": "campanhas",
    "title": "07. CRM, campanhas e comunicações",
    "intro": "O ORICSE dispõe de recursos para organizar o relacionamento com clientes e, quando utilizados, campanhas por canais como e-mail e WhatsApp.",
    "items": [
      "O estabelecimento é responsável por determinar público, conteúdo, fundamento jurídico, frequência e destinatários de suas campanhas.",
      "É necessário respeitar preferências, recusas e pedidos de interrupção de mensagens promocionais, bem como as regras dos canais utilizados.",
      "Dados de atendimento e históricos clínicos não devem ser usados para segmentação publicitária sem avaliação específica de necessidade, proporcionalidade, base legal e confidencialidade.",
      "Comunicações indispensáveis ao atendimento ou à execução de um contrato podem ter natureza distinta de publicidade e devem ser identificadas adequadamente."
    ]
  },
  {
    "id": "pagamentos",
    "title": "08. Pagamentos, planos e fornecedores financeiros",
    "intro": "O ORICSE pode integrar serviços de pagamento para cobrar seus planos e, em módulos próprios, permitir recebimentos de estabelecimentos.",
    "items": [
      "Informações de pedido, valores, ciclo contratado, identificação do pagador e situação do pagamento podem ser utilizadas para registrar e conciliar cobranças.",
      "Quando o checkout envolver prestador financeiro independente, o processamento de transações poderá estar sujeito a avisos de privacidade próprios desse prestador, conforme seu papel na operação, sem afastar os direitos dos titulares.",
      "A confirmação de uma cobrança não implica acesso irrestrito aos dados financeiros: consultas e permissões devem corresponder à função do usuário e à necessidade operacional.",
      "A ativação de planos e funcionalidades depende das regras de contratação e da confirmação financeira aplicável."
    ]
  },
  {
    "id": "compartilhamento",
    "title": "09. Compartilhamento e operadores de tecnologia",
    "intro": "O compartilhamento é realizado quando necessário à prestação do serviço, à segurança, à integração solicitada ou ao cumprimento de obrigações legais.",
    "items": [
      "Podemos utilizar prestadores terceirizados de hospedagem, infraestrutura, execução e proteção da aplicação, banco de dados, armazenamento, autenticação, processamento de arquivos e monitoramento, conforme os recursos efetivamente utilizados.",
      "Integrações de armazenamento e sincronização, e-mail, mensageria, mapas e serviços financeiros podem ser utilizadas conforme a configuração do estabelecimento e as funcionalidades efetivamente ativadas.",
      "Dados podem ser fornecidos a autoridades mediante obrigação legal ou requisição válida, observados os requisitos aplicáveis.",
      "Não declaramos que todos esses serviços tratam os dados de todos os clientes. O fluxo efetivo varia de acordo com as integrações e configurações em uso."
    ]
  },
  {
    "id": "transferencias",
    "title": "10. Transferências internacionais",
    "intro": "O uso de provedores globais pode envolver armazenamento, acesso ou processamento em outros países.",
    "items": [
      "Sempre que uma operação configurar transferência internacional de dados pessoais, deverão ser observadas as hipóteses legais e as salvaguardas aplicáveis previstas na LGPD e na regulamentação da ANPD.",
      "O local de processamento e o mecanismo jurídico utilizado dependem do serviço contratado, de sua configuração e dos instrumentos aplicáveis com os fornecedores."
    ]
  },
  {
    "id": "seguranca",
    "title": "11. Segurança, acessos e incidentes",
    "intro": "Adotamos e buscamos aperfeiçoar controles técnicos e organizacionais proporcionais aos riscos das operações e à natureza dos dados.",
    "items": [
      "Entre os controles relevantes estão autenticação, permissões por perfil, mecanismos de restrição de acesso e registros técnicos de segurança, de acordo com os recursos configurados.",
      "Contratantes devem proteger suas credenciais, administrar o acesso de sua equipe, revisar permissões e informar prontamente suspeitas de acesso indevido.",
      "Nenhum ambiente digital está isento de riscos. Eventos de segurança serão avaliados e tratados conforme a gravidade, as responsabilidades dos agentes e as obrigações de comunicação aplicáveis."
    ]
  },
  {
    "id": "retencao",
    "title": "12. Conservação, exportação e exclusão",
    "intro": "Os dados são mantidos pelo período necessário às finalidades informadas e às exigências legais, contratuais, administrativas e profissionais.",
    "items": [
      "Os períodos podem variar entre dados cadastrais, faturamento, registros técnicos, documentos clínicos e informações operacionais dos estabelecimentos.",
      "O encerramento do contrato não significa exclusão automática e imediata de todos os registros, pois podem existir obrigações de conservação, prevenção a fraudes, exercício de direitos ou necessidades de exportação previstas no contrato.",
      "Pedidos de correção, exportação ou eliminação serão examinados segundo a natureza do dado, o papel de cada agente e as hipóteses legais de retenção.",
      "Cópias de segurança podem seguir ciclos próprios de retenção e substituição, respeitadas as obrigações aplicáveis."
    ]
  },
  {
    "id": "direitos",
    "title": "13. Direitos dos titulares de dados pessoais",
    "intro": "Nos termos da LGPD, o titular pode exercer direitos perante o controlador responsável pelo tratamento, observadas as condições previstas na legislação.",
    "items": [
      "Solicitar confirmação de tratamento e acesso aos dados pessoais.",
      "Pedir correção de dados incompletos, inexatos ou desatualizados.",
      "Solicitar anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei, quando cabível.",
      "Solicitar portabilidade, informações sobre compartilhamentos e sobre a possibilidade de não fornecer consentimento.",
      "Revogar consentimento e solicitar eliminação dos dados tratados com base nessa hipótese, ressalvadas as hipóteses legais de conservação.",
      "Solicitar revisão de decisões tomadas unicamente com base em tratamento automatizado, quando previstas em lei, e apresentar reclamação à ANPD.",
      "Quando o pedido se refere a dados inseridos por uma clínica ou pet shop, o primeiro contato deverá ser, em regra, com o estabelecimento responsável, sem prejuízo do apoio técnico da Oricse."
    ]
  },
  {
    "id": "cookies",
    "title": "14. Cookies, sessões e tecnologias semelhantes",
    "intro": "Cookies e mecanismos equivalentes podem ser empregados para o funcionamento técnico da plataforma e para manter sessões e preferências de acesso.",
    "items": [
      "Recursos estritamente necessários podem viabilizar autenticação, segurança, continuidade da sessão e configuração de funcionalidades.",
      "Caso sejam adotadas tecnologias analíticas ou publicitárias não essenciais, elas deverão ser informadas de maneira adequada e submetidas aos mecanismos de escolha exigidos pelas regras aplicáveis.",
      "O titular também pode administrar determinadas preferências no navegador, observando que a desativação de recursos necessários pode prejudicar o uso do sistema."
    ]
  },
  {
    "id": "criancas",
    "title": "15. Crianças, adolescentes e representantes",
    "intro": "O ORICSE não foi desenvolvido como rede social infantil. Todavia, os registros profissionais podem envolver dados de responsáveis e, em situações específicas, de menores.",
    "items": [
      "Quando dados pessoais de crianças ou adolescentes forem inseridos, o estabelecimento deverá avaliar o melhor interesse do titular e observar os requisitos legais aplicáveis.",
      "Representantes legais podem exercer direitos conforme a legislação, mediante verificação adequada de legitimidade."
    ]
  },
  {
    "id": "contato",
    "title": "16. Como falar conosco e exercer seus direitos",
    "intro": "Para questões relacionadas à plataforma, à contratação e aos tratamentos sob responsabilidade da Oricse, utilize o canal indicado abaixo.",
    "items": [
      "E-mail de contato: vetericio@gmail.com. No assunto, informe “Privacidade e proteção de dados — Oricse”.",
      "Para facilitar a análise, descreva sua relação com o ORICSE, o estabelecimento envolvido (se houver) e o direito que deseja exercer. Não envie senhas ou documentos desnecessários no primeiro contato.",
      "A identidade do solicitante poderá ser verificada de forma proporcional para evitar acesso indevido a dados de terceiros.",
      "Quando a solicitação for relativa a dados de tutores e pacientes administrados por um estabelecimento, orientaremos, quando possível, o encaminhamento ao controlador responsável.",
      "A Oricse - Vetericio Serviços Veterinários LTDA está identificada pelo CNPJ 67.099.538/0001-76, com cadastro localizado em Belo Horizonte/MG, bairro Maria Helena, Rua Tenente Marino Freire, CEP 31680-120. O número do imóvel ainda depende de conferência com o comprovante cadastral oficial."
    ]
  },
  {
    "id": "alteracoes",
    "title": "17. Atualizações desta Política",
    "intro": "Podemos atualizar esta Política para refletir mudanças na legislação, nos serviços, nos fornecedores ou nas práticas de tratamento.",
    "items": [
      "A versão vigente ficará disponível nesta página, com indicação da data da atualização.",
      "Alterações materialmente relevantes serão comunicadas por meios apropriados, conforme as circunstâncias e a legislação aplicável.",
      "Solicitações de esclarecimento, acesso, correção e demais direitos podem ser dirigidas ao canal de privacidade informado nesta Política."
    ]
  },
  {
  "id": "terceiros-condicoes",
  "title": "18. Prestadores de serviços e dependências tecnológicas",
  "intro": "A prestação do serviço pode envolver operadores ou controladores independentes, conforme a finalidade e a relação concreta com os dados.",
  "items": [
    "Categorias de prestadores incluem infraestrutura e hospedagem, proteção de aplicações, banco de dados, autenticação, armazenamento e sincronização, comunicações, suporte e processamento financeiro. Apenas fluxos necessários aos recursos habilitados são pertinentes a cada estabelecimento.",
    "O compartilhamento observa finalidade, necessidade, base legal e obrigações contratuais adequadas. Alguns prestadores, sobretudo os financeiros, podem ser controladores independentes de tratamentos próprios e disponibilizar avisos de privacidade específicos.",
    "Permissões de integração, contratos e licenças de terceiros podem mudar ou terminar, afetando o funcionamento de módulos. A ORICSE avaliará impactos sobre o tratamento de dados e implementará medidas de mitigação e comunicação cabíveis.",
    "A classificação de operador, suboperador ou controlador depende da atividade concreta, não apenas da contratação de infraestrutura. A terceirização não afasta as responsabilidades legais próprias da ORICSE.",
    "A identidade de destinatários e as informações específicas exigidas pela LGPD serão disponibilizadas conforme a obrigação legal aplicável, por transparência direta ou pelo canal de privacidade indicado; o uso de descrições por categoria não substitui divulgações legalmente obrigatórias."
  ]
},
  {
  "id": "transferencia-governanca",
  "title": "19. Transferências internacionais, incidentes e continuidade",
  "intro": "Cada transferência internacional e incidente de segurança relevante deve ser examinado conforme o fluxo efetivamente adotado.",
  "items": [
    "Conforme a configuração do serviço, dados pessoais podem ser armazenados, acessados ou processados fora do Brasil. A ORICSE deverá documentar e informar, quando exigido, países de destino, duração, finalidades, destinatários e mecanismos legais da transferência.",
    "Transferências internacionais devem observar as hipóteses da LGPD, a regulamentação da ANPD e salvaguardas efetivamente adotadas, como cláusulas contratuais adequadas quando cabíveis. Uma referência genérica a fornecedores globais não substitui informação específica obrigatória.",
    "Incidentes serão avaliados, contidos, registrados e comunicados aos agentes responsáveis, titulares e autoridade competente quando exigido, segundo risco e prazos legais.",
    "Requisições de acesso, correção, eliminação e portabilidade poderão exigir atuação do controlador do estabelecimento, com cooperação técnica da ORICSE quando esta atuar como operadora.",
    "Restrições de retenção, obrigações profissionais e cópias técnicas de segurança podem impedir eliminação instantânea de todos os dados. A restauração estará sujeita às possibilidades técnicas e às salvaguardas existentes."
  ]
}
] as const;

function PoliticaDePrivacidade() {
  return (
    <main className="min-h-screen bg-[#F8F5F2] text-[#381724]">
      <div className="border-b border-[#E9DCE0] bg-white">
        <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-3" aria-label="Oricse — início">
            <img src="/oricse-logo-oryx.svg?v=15" alt="Logo da Oricse" width="56" height="56" className="h-12 w-12 object-contain"/>
            <span className="text-lg font-extrabold tracking-wide">ORICSE</span>
          </Link>
          <Link to="/planos" className="inline-flex items-center gap-2 text-sm font-semibold text-[#703047] hover:underline"><ArrowLeft size={16}/> Voltar ao site</Link>
        </header>
      </div>
      <section className="relative overflow-hidden bg-[#4A182C] px-5 py-14 text-white sm:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-48 h-[30rem] w-[30rem] rounded-full border-[70px] border-white/5" />
        <div className="relative mx-auto max-w-6xl">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.19em] text-[#EED8DF]"><ShieldCheck size={17}/> Transparência, segurança e respeito aos seus dados</p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">Política de Privacidade e Proteção de Dados</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#F0DBE2]">Esta página explica, de maneira clara e responsável, como tratamos informações pessoais no ecossistema Oricse, o papel dos estabelecimentos que usam a plataforma e como você pode exercer seus direitos.</p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/90"><span className="rounded-full border border-white/25 px-4 py-2">Lei Geral de Proteção de Dados — LGPD</span><span className="rounded-full border border-white/25 px-4 py-2">Atualizada em 02/11/2026</span></div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <section className="mb-10 grid gap-4 rounded-3xl border border-[#E8D9DE] bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#8B5E6D]">Responsável pela plataforma</p>
            <h2 className="mt-2 text-lg font-bold">{EMPRESA}</h2><p className="mt-1 text-sm font-semibold text-[#703047]">CNPJ: {CNPJ_EMPRESA}</p><p className="mt-1 text-sm text-[#78666C]">Endereço cadastral identificado: {ENDERECO_EMPRESA} (número sujeito à conferência).</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#78666C]">Este documento diferencia os tratamentos realizados pela Oricse e aqueles realizados pelos estabelecimentos que utilizam seus serviços.</p>
          </div>
          <a href="mailto:vetericio@gmail.com?subject=Privacidade%20e%20prote%C3%A7%C3%A3o%20de%20dados%20%E2%80%94%20Oricse" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCC7D0] px-5 py-3 text-sm font-bold text-[#703047] hover:bg-[#FBF4F7]"><Mail size={17}/> Falar sobre privacidade <ArrowUpRight size={15}/></a>
        </section>

        <div className="grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
          <aside className="rounded-2xl border border-[#E8D9DE] bg-white p-5 lg:sticky lg:top-5">
            <div className="mb-3 flex items-center gap-2"><FileText size={18} className="text-[#703047]"/><h2 className="font-bold">Neste documento</h2></div>
            <nav aria-label="Índice da política de privacidade" className="max-h-[65vh] space-y-1 overflow-y-auto">
              {SECOES.map(secao => <a key={secao.id} href={`#${secao.id}`} className="block rounded-lg px-2 py-2 text-sm leading-5 text-[#6C5860] transition hover:bg-[#F8EFF2] hover:text-[#703047]">{secao.title}</a>)}
            </nav>
          </aside>

          <article className="min-w-0 rounded-3xl border border-[#E8D9DE] bg-white p-5 shadow-sm sm:p-9">
            <div className="mb-9 rounded-2xl border-l-4 border-[#703047] bg-[#FAF4F6] p-5">
              <h2 className="font-bold">Compromisso com a privacidade</h2>
              <p className="mt-2 text-sm leading-7 text-[#6F5D64]">A proteção de dados faz parte da prestação responsável de serviços digitais. A Oricse busca oferecer transparência sobre finalidades, responsabilidades, compartilhamentos e direitos, sem substituir as obrigações legais de cada clínica, hospital ou outro estabelecimento contratante.</p>
            </div>
            {SECOES.map(secao => <section id={secao.id} key={secao.id} className="scroll-mt-6 border-b border-[#F0E6E9] py-8 first:pt-0 last:border-0 last:pb-0">
              <h2 className="font-display text-xl font-bold leading-snug text-[#4A182C] sm:text-2xl">{secao.title}</h2>
              <p className="mt-4 text-[15px] leading-8 text-[#695860]">{secao.intro}</p>
              <ul className="mt-4 space-y-3">
                {secao.items.map(item => <li key={item} className="flex items-start gap-3 text-[15px] leading-7 text-[#695860]"><span aria-hidden="true" className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#A36C80]"/><span>{item}</span></li>)}
              </ul>
            </section>)}
            <div className="mt-10 rounded-2xl bg-[#4A182C] p-6 text-white sm:p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">Canal de contato</p>
              <h2 className="mt-3 font-display text-2xl font-bold">Fale com a Oricse</h2>
              <p className="mt-2 text-sm leading-7 text-white/80">Dúvidas, solicitações e pedidos relacionados à privacidade e ao tratamento de dados pessoais podem ser encaminhados pelo canal abaixo.</p>
              <a className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-[#4A182C] hover:bg-[#F8EEF2]" href="mailto:vetericio@gmail.com?subject=Privacidade%20e%20prote%C3%A7%C3%A3o%20de%20dados%20%E2%80%94%20Oricse"><Mail size={18}/> vetericio@gmail.com <ArrowUpRight size={16}/></a>
            </div>
            <p className="mt-6 text-xs leading-6 text-[#8A747D]">Para informações específicas sobre destinatários, fornecedores e transferências internacionais, utilize o canal de privacidade indicado. A transparência legalmente exigida será observada em cada operação.</p>
          </article>
        </div>
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[#E1D4D9] pt-6 text-xs text-[#856F78]"><span>© {new Date().getFullYear()} {EMPRESA}</span><div className="flex gap-5"><Link to="/termos-de-uso" className="underline underline-offset-4">Termos de Uso</Link><Link to="/" className="underline underline-offset-4">Início</Link></div></footer>
      </div>
    </main>
  );
}

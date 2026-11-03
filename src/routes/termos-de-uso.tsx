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
      "Ao concluir o aceite eletrônico, o contratante declara ter tido oportunidade de ler este documento e a Política de Privacidade, além das informações comerciais apresentadas no momento da contratação."
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
      "Plano: conjunto de funcionalidades, limites, periodicidade de cobrança e condições comerciais informadas no processo de contratação."
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
      "O contratante é responsável pelos equipamentos, navegadores, conexão e demais recursos necessários ao uso da plataforma."
    ]
  },
  {
    "id": "licenca",
    "title": "04. Licença de uso e propriedade intelectual",
    "intro": "Enquanto o contrato estiver vigente e o acesso autorizado, a Oricse concede licença limitada, não exclusiva e intransferível para utilização das funcionalidades contratadas.",
    "items": [
      "A licença não transfere propriedade do sistema, código-fonte, identidade visual, marcas, componentes, materiais e demais ativos de propriedade intelectual.",
      "Não é permitido revender a licença, compartilhar um ambiente entre estabelecimentos não autorizados, reproduzir o código ou tentar contornar controles de segurança, observadas as exceções previstas em lei.",
      "Os dados legítimos registrados pelo estabelecimento não se tornam propriedade da Oricse por estarem armazenados ou processados na plataforma."
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
      "Se a solicitação não for aceita, eventuais cobranças serão tratadas conforme a oferta, a legislação aplicável e os direitos de restituição que couberem."
    ]
  },
  {
    "id": "identificador",
    "title": "06. Identificador público (@), nome e configurações",
    "intro": "O estabelecimento pode solicitar um identificador público (@) e indicar um nome comercial para apresentação em recursos autorizados.",
    "items": [
      "A escolha do identificador depende de disponibilidade técnica, confirmação administrativa e respeito a nomes, marcas e direitos de terceiros.",
      "A Oricse poderá exigir ajuste em identificadores impróprios, conflitantes ou fraudulentos, com comunicação adequada.",
      "O contratante é responsável pela exatidão e atualização do conteúdo comercial, identidade da clínica e informações disponibilizadas aos seus tutores."
    ]
  },
  {
    "id": "plano",
    "title": "07. Planos, preços, periodicidade e usuários",
    "intro": "A contratação informará o plano selecionado, o valor, o período de cobrança, a quantidade de usuários incluídos, o custo de perfis adicionais e as condições comerciais aplicáveis.",
    "items": [
      "Podem ser oferecidos ciclos mensais ou anuais. O ciclo de cobrança determina quando os pagamentos são exigíveis e não se confunde, por si só, com um eventual prazo de permanência mínima.",
      "Valores, descontos promocionais, quantidade de usuários e serviços adicionais devem ser apresentados antes da confirmação do pedido. Descontos temporários seguirão as regras informadas na oferta.",
      "Qualquer condição de renovação automática, se disponibilizada futuramente, dependerá de comunicação clara e autorização específica quando legalmente necessária.",
      "Alterações de valores ou de planos respeitarão as condições assumidas, eventuais avisos prévios e a legislação aplicável."
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
      "A fidelidade não afasta direitos legais de arrependimento, resolução por descumprimento ou outras garantias legais aplicáveis. Eventual renovação por novo período de fidelidade não será presumida sem informação e aceite válidos."
    ]
  },
  {
    "id": "pagamento",
    "title": "09. Pagamento, confirmação e acesso",
    "intro": "Os pagamentos poderão ser processados por prestadores externos, como Mercado Pago, quando a opção estiver disponível e configurada.",
    "items": [
      "O pedido pode permanecer com status pendente até a confirmação recebida do provedor de pagamentos. O retorno visual do checkout, isoladamente, não substitui a verificação financeira.",
      "Após confirmação, a solicitação poderá ser encaminhada para análise e preparação do ambiente, conforme o fluxo do ORICSE.",
      "Informações de faturamento, recibos e registros financeiros serão disponibilizados segundo a operação e a legislação aplicável; dados confidenciais de cartão devem ser tratados pelo prestador de pagamento.",
      "Em caso de pagamento recusado, pendente ou contestado, o acesso poderá depender da regularização, sem prejuízo dos direitos aplicáveis."
    ]
  },
  {
    "id": "teste",
    "title": "10. Teste gratuito e recursos promocionais",
    "intro": "O ORICSE pode oferecer testes, demonstrações, vouchers e promoções específicas, sujeitos às condições informadas na oferta.",
    "items": [
      "Se houver teste gratuito, sua duração, elegibilidade, limitações e regras de encerramento devem ser apresentadas antes do início.",
      "Promoções e vouchers podem ser limitados por prazo, pessoa, quantidade de utilizações ou plano; o benefício exibido no resumo da contratação prevalece sobre expectativas não confirmadas.",
      "O término do teste pode restringir acesso e edição até a contratação ou regularização, observadas obrigações de tratamento dos dados e regras de exportação que caibam."
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
      "A desativação do ambiente, a retirada de acessos e a disponibilização de dados seguirão os procedimentos técnicos disponíveis e as obrigações legais e profissionais de guarda."
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
      "O ORICSE não substitui protocolos de emergência, supervisão profissional, consentimentos ou conferências que sejam necessários na rotina clínica."
    ]
  },
  {
    "id": "tutores",
    "title": "13. Portal do Tutor, hotelzinho e serviços pet",
    "intro": "O estabelecimento determina quais conteúdos e serviços serão disponibilizados aos seus tutores por meio de suas configurações.",
    "items": [
      "É sua responsabilidade confirmar os direitos de acesso, a legitimidade dos representantes e a adequação de documentos e informações compartilhadas.",
      "Regras de hospedagem, banho e tosa, vacinação, transporte, reservas, cancelamento de serviços e condições assistenciais pertencem à relação entre estabelecimento e tutor e não são automaticamente definidas pela Oricse.",
      "Informações públicas do estabelecimento e campanhas devem ser completas, corretas e compatíveis com as leis e normas profissionais aplicáveis."
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
      "Consulte a Política de Privacidade para informações sobre categorias de dados, finalidades, fornecedores, retenção e direitos dos titulares."
    ]
  },
  {
    "id": "comunicacoes",
    "title": "15. Campanhas e comunicações",
    "intro": "Ferramentas de CRM, campanhas, e-mail e mensagens devem ser usadas de forma legítima e responsável.",
    "items": [
      "O estabelecimento define o público, o conteúdo, a base legal e a frequência de seus envios, além de respeitar recusas, revogação de consentimentos e mecanismos de descadastro quando aplicáveis.",
      "É proibido utilizar a plataforma para spam ilícito, assédio, comunicações fraudulentas ou divulgação não autorizada de informações pessoais e clínicas.",
      "Fornecedores de comunicação podem estabelecer limites técnicos, políticas e condições próprias."
    ]
  },
  {
    "id": "seguranca",
    "title": "16. Segurança e condutas proibidas",
    "intro": "Todos os usuários devem proteger suas credenciais e acessar apenas os dados e módulos para os quais estejam autorizados.",
    "items": [
      "É vedado tentar invadir contas, contornar permissões, exfiltrar informações, inserir malware, manipular cobranças, fraudar documentos ou explorar vulnerabilidades.",
      "O contratante deve cadastrar usuários individualmente, revisar acessos após desligamentos e notificar suspeitas de comprometimento.",
      "A Oricse poderá adotar medidas proporcionais de contenção e suspensão em caso de risco comprovado à segurança, fraude ou abuso, respeitando o devido tratamento da situação e as obrigações legais."
    ]
  },
  {
    "id": "disponibilidade",
    "title": "17. Disponibilidade, manutenção e terceiros",
    "intro": "A plataforma é oferecida como serviço digital sujeito a operações de infraestrutura e a eventuais interrupções.",
    "items": [
      "A Oricse buscará manter estabilidade, segurança e recuperação de falhas, sem prometer disponibilidade absoluta ou ausência integral de erros.",
      "Poderão ocorrer manutenções e alterações técnicas necessárias para segurança, correções, compatibilidade ou melhoria dos recursos, observadas as obrigações da contratação.",
      "Serviços externos, como bancos de dados, armazenamento, meios de pagamento, comunicação e mapas, podem possuir termos próprios e sofrer indisponibilidades não controladas pela Oricse."
    ]
  },
  {
    "id": "dados-retencao",
    "title": "18. Continuidade, exportação e encerramento dos dados",
    "intro": "O encerramento do serviço pode implicar restrição ou desativação de acesso, mas os dados devem ser tratados conforme a legislação e as condições contratadas.",
    "items": [
      "Quando disponíveis, as funções de exportação e os procedimentos de obtenção de cópias devem ser utilizados com antecedência e observância das regras de confidencialidade.",
      "A retenção, eliminação e eventual conservação obrigatória de informações observarão os prazos legais, contábeis, profissionais e contratuais aplicáveis.",
      "Dados de terceiros não poderão ser entregues a pessoas não autorizadas, inclusive em solicitações de exportação de acervos clínicos."
    ]
  },
  {
    "id": "alteracoes",
    "title": "19. Atualizações contratuais e comunicação",
    "intro": "O ORICSE poderá atualizar seus recursos e estes Termos em razão de exigências legais, evolução tecnológica ou mudanças de serviço.",
    "items": [
      "Alterações materiais serão comunicadas por meios apropriados, respeitando direitos adquiridos, condições contratadas e o direito de escolha do contratante quando aplicável.",
      "A versão vigente será disponibilizada em página pública, com a data de atualização.",
      "Quando uma alteração exigir aceite adicional, a Oricse deverá providenciar mecanismo apropriado de ciência e manifestação."
    ]
  },
  {
    "id": "contato",
    "title": "20. Atendimento, identificação e disposições finais",
    "intro": "Solicitações de suporte, contratação, cancelamento ou esclarecimentos poderão ser encaminhadas à Oricse - Vetericio Serviços Veterinários LTDA pelo contato oficial.",
    "items": [
      "E-mail: vetericio@gmail.com. Para facilitar o atendimento, informe o estabelecimento, o assunto e o número da solicitação, caso disponível.",
      "Nome empresarial: Vetericio Serviços Veterinários LTDA; CNPJ: 67.099.538/0001-76; localização cadastral identificada: Rua Tenente Marino Freire, bairro Maria Helena, Belo Horizonte/MG, CEP 31680-120 (número do imóvel pendente de confirmação).",
      "Eventuais controvérsias serão tratadas preferencialmente pelos canais de atendimento e por meios adequados de solução, sem afastar o foro competente e as proteções obrigatórias previstas na legislação.",
      "Esta redação é um instrumento contratual preliminar que deve ser revisado juridicamente e validado quanto às condições financeiras específicas antes de seu uso comercial definitivo."
    ]
  }
] as const;

function TermosDeUso() {
 return (
  <main className="min-h-screen bg-[#F8F5F2] text-[#381724]">
   <div className="border-b border-[#E9DCE0] bg-white">
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
     <Link to="/" className="inline-flex items-center gap-3" aria-label="Oricse — início"><img src="/oricse-logo-oryx.svg" alt="Logo da Oricse" width="56" height="56" className="h-12 w-12 object-contain"/><span className="text-lg font-extrabold tracking-wide">ORICSE</span></Link>
     <Link to="/planos" className="inline-flex items-center gap-2 text-sm font-semibold text-[#703047] hover:underline"><ArrowLeft size={16}/> Voltar ao site</Link>
    </header>
   </div>
   <section className="relative overflow-hidden bg-[#4A182C] px-5 py-14 text-white sm:py-20">
    <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-48 h-[30rem] w-[30rem] rounded-full border-[70px] border-white/5"/>
    <div className="relative mx-auto max-w-6xl">
     <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.19em] text-[#EED8DF]"><ShieldCheck size={17}/> Clareza, responsabilidades e transparência</p>
     <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">Termos de Uso e Contratação</h1>
     <p className="mt-5 max-w-3xl text-base leading-8 text-[#F0DBE2]">Condições de acesso, planos, pagamentos, responsabilidades e direitos relacionados ao uso do ecossistema ORICSE.</p>
     <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/90"><span className="rounded-full border border-white/25 px-4 py-2">Contratação de software como serviço</span><span className="rounded-full border border-white/25 px-4 py-2">Atualizado em 02/11/2026</span></div>
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
     <a href="mailto:vetericio@gmail.com?subject=Termos%20de%20Uso%20e%20Contrata%C3%A7%C3%A3o%20%E2%80%94%20Oricse" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCC7D0] px-5 py-3 text-sm font-bold text-[#703047] hover:bg-[#FBF4F7]"><Mail size={17}/> Falar com a Oricse <ArrowUpRight size={15}/></a>
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
       <a className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-[#4A182C] hover:bg-[#F8EEF2]" href="mailto:vetericio@gmail.com?subject=Termos%20de%20Uso%20e%20Contrata%C3%A7%C3%A3o%20%E2%80%94%20Oricse"><Mail size={18}/> vetericio@gmail.com <ArrowUpRight size={16}/></a>
      </div>
      <p className="mt-6 text-xs leading-6 text-[#8A747D]">Nota: confirme o número do endereço empresarial e as condições concretas de eventual multa de cancelamento antecipado em instrumento separado, se aplicável. Recomenda-se revisão jurídica antes da publicação definitiva.</p>
     </article>
    </div>
    <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[#E1D4D9] pt-6 text-xs text-[#856F78]"><span>© {new Date().getFullYear()} {EMPRESA}</span><div className="flex gap-5"><Link to="/politica-de-privacidade" className="underline underline-offset-4">Política de Privacidade</Link><Link to="/" className="underline underline-offset-4">Início</Link></div></footer>
   </div>
  </main>
 );
}

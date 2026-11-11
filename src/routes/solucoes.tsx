import { RodapeInstitucional } from "@/components/RodapeInstitucional";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft, ArrowRight, Bath, CalendarDays, ClipboardList, CreditCard,
  FileText, Hotel, Package, Settings, Sparkles, Stethoscope, Store, UserRound, Users
} from "lucide-react";

export const Route = createFileRoute("/solucoes")({
  head: () => ({ meta: [
    { title: "Soluções Oricse — conheça cada recurso" },
    { name: "description", content: "Entenda em detalhes como cada solução da Oricse ajuda a sua rotina pet." },
  ]}),
  component: Solucoes,
});

const solucoes = [
  { id:"recepcao", icon:CalendarDays, titulo:"Recepção", resumo:"A porta de entrada da sua rotina.", itens:["Agenda diária, semanal e mensal","Confirmação de atendimentos e retornos","Fila de espera com visualização clara","Cadastro integrado de tutor e pet","Acesso rápido à ficha e ao histórico"] },
  { id:"clinica-veterinaria", icon:Stethoscope, titulo:"Clínica veterinária", resumo:"Tudo do atendimento clínico, sem procurar em várias telas.", itens:["Prontuário completo por paciente","Receitas, exames, laudos e documentos","Vacinas e histórico de saúde","Consultório, evolução e acompanhamento","Internação com parâmetros e medicações"] },
  { id:"banho-e-tosa", icon:Bath, titulo:"Banho e tosa", resumo:"Serviços organizados sem misturar com a rotina clínica.", itens:["Agenda própria para banho, tosa e serviços","Cadastro de pacotes e observações","Profissional responsável e tempo do serviço","Histórico do pet e comunicação com o tutor","Cobrança pelo Caixa Geral"] },
  { id:"hotelzinho", icon:Hotel, titulo:"Hotelzinho", resumo:"Controle a estadia de cada hóspede com tranquilidade.", itens:["Reservas e ocupação em uma agenda visual","Check-in, check-out e estadias","Rotina de cuidados e informações do pet","Itens extras e serviços da hospedagem","Organização por dia, semana ou mês"] },
  { id:"meu-oricstudio", icon:Sparkles, titulo:"Meu OricStúdio", resumo:"Sua marca pet ativa, sem sair do ecossistema Oricse.", itens:["Planejamento de posts e conteúdos","Organização da presença digital da clínica","Campanhas e comunicação de serviços","Conexão entre conteúdo, CRM e sua operação","Ferramenta feita para o mercado pet"] },
  { id:"gestao-de-clientes", icon:Users, titulo:"Gestão de clientes", resumo:"Conheça melhor quem confia os pets à sua empresa.", itens:["Histórico de tutores e pets","Relacionamento, lembretes e retornos","Segmentação para campanhas","Informações conectadas ao atendimento","Mais contexto para uma comunicação pessoal"] },
  { id:"financeiro-e-oricsepay", icon:CreditCard, titulo:"Financeiro e OricsePay", resumo:"Do caixa ao pagamento online, com transparência.", itens:["Caixa único por clínica","Comandas, lançamentos e conciliação","PIX, crédito e débito conforme a operação","Pagamentos pelo Portal do Tutor","Repasses e taxas configurados pela clínica"] },
  { id:"estoque-e-produtos", icon:Package, titulo:"Estoque e produtos", resumo:"Venda e estoque acompanhando a vida real da empresa.", itens:["Catálogo de produtos e serviços","Movimentações de entrada e saída","Produtos conectados ao pet shop","Controle de estoque e organização","Vendas integradas ao caixa"] },
  { id:"relatorios", icon:ClipboardList, titulo:"Relatórios", resumo:"Informação clara para decidir melhor.", itens:["Atendimentos e ocupação","Vendas, caixa e financeiro","Indicadores por área da operação","Visão para acompanhar resultados","Dados úteis, sem complicação"] },
  { id:"rh-e-atividade", icon:UserRound, titulo:"RH e atividade", resumo:"Equipe e acesso organizados de forma simples.", itens:["Perfis e permissões por função","Ponto e jornada conforme o plano","Minhas horas e atividades","Organização de equipe","Visibilidade para quem administra"] },
  { id:"configuracoes", icon:Settings, titulo:"Configurações", resumo:"A Oricse com a cara e as regras da sua operação.", itens:["Dados da clínica e da equipe","Temas e preferências do sistema","Portal do Tutor e personalizações","Domínio, site e integrações","Controle de acessos e permissões"] },
  { id:"portal-do-tutor", icon:FileText, titulo:"Portal do Tutor", resumo:"O espaço do tutor para acompanhar tudo do pet.", itens:["Receitas, exames, laudos e documentos","Cartão de vacina e vermífugo","Agendamento online com disponibilidade da clínica","Comandas, pagamentos e confirmações","Comunicação direta e histórico do animal"] },
] as const;

function Solucoes() {
  return <main className="min-h-screen bg-[#fffdfa] text-[#512b38]">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#672e43]"><ArrowLeft size={17}/> Voltar à Oricse</Link>
      <a href="https://oricse.com.br/#diferenciais" className="rounded-full bg-[#4A1826] px-5 py-2.5 text-sm font-bold text-white">Solicitar demonstração</a>
    </header>
    <section className="border-y border-[#eddfda] bg-[#f8efeb] px-5 py-16 text-center sm:px-8 sm:py-20">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9c6574]">Soluções Oricse</p>
      <h1 className="mx-auto mt-4 max-w-3xl font-display text-5xl font-semibold leading-[.94] tracking-[-.06em] text-[#4A1826] sm:text-7xl">Entenda como cada parte da Oricse trabalha pela sua rotina.</h1>
      <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-7 text-[#765c66]">Escolha uma solução na página inicial e chegue direto aqui. Todas estão na mesma página porque sua operação também é uma só.</p>
    </section>
    <nav className="sticky top-0 z-20 border-b border-[#eaded8] bg-[#fffdfa]/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1">{solucoes.map(item=><a key={item.id} href={"#"+item.id} className="shrink-0 rounded-full border border-[#e6d4d4] bg-white px-3 py-2 text-xs font-bold text-[#713849] hover:bg-[#f6e8e9]">{item.titulo}</a>)}</div></nav>
    <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
      <div className="grid gap-5 md:grid-cols-2">{solucoes.map(({id,icon:Icon,titulo,resumo,itens},i)=><article id={id} key={id} className={"scroll-mt-24 rounded-[26px] border p-7 sm:p-8 " + (titulo==="Meu OricStúdio" ? "border-[#a56a78] bg-[#4A1826] text-white" : "border-[#eaded8] bg-white")}>
        <div className={"flex h-12 w-12 items-center justify-center rounded-xl " + (titulo==="Meu OricStúdio" ? "bg-white/15 text-[#f3cad1]" : "bg-[#f7ebea] text-[#823b53]")}><Icon size={24}/></div>
        <h2 className="mt-6 font-display text-3xl font-semibold tracking-[-.04em]">{titulo}</h2>
        <p className={"mt-2 text-[17px] leading-6 " + (titulo==="Meu OricStúdio" ? "text-[#f5dfe2]/85" : "text-[#765c66]")}>{resumo}</p>
        <ul className="mt-7 space-y-3">{itens.map(item=><li key={item} className={"flex gap-2 text-sm leading-5 " + (titulo==="Meu OricStúdio" ? "text-[#f7e8ea]" : "text-[#614550]")}><span className={titulo==="Meu OricStúdio" ? "text-[#f2bcc6]" : "text-[#a44f65]"}>✦</span>{item}</li>)}</ul>
        {i===0 && <a href="#portal-do-tutor" className="mt-7 inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4">Ver também Portal do Tutor <ArrowRight size={16}/></a>}
      </article>)}</div>
    </section>
    <section className="px-5 pb-16 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 rounded-[28px] bg-[#f1e3df] px-8 py-10 text-center sm:flex-row sm:text-left"><div><h2 className="font-display text-3xl font-semibold text-[#4A1826]">Quer ver a Oricse funcionando na sua rotina?</h2><p className="mt-2 text-[#765c66]">Escolha seu plano e comece com a operação organizada.</p></div><Link to="/planos" className="inline-flex items-center gap-2 rounded-full bg-[#4A1826] px-6 py-3.5 font-bold text-white">Conhecer planos <ArrowRight size={17}/></Link></div></section>
    <RodapeInstitucional />
  </main>;
}
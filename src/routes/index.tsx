import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ArrowRight, Bath, CalendarDays, ChevronDown, ClipboardList, CreditCard,
  FileText, Hotel, Menu, Package, PawPrint, Scissors, Settings, Sparkles,
  Stethoscope, Store, UserRound, Users, X
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Oricse — Soluções elegantes para o mercado pet" },
    { name: "description", content: "A plataforma que une recepção, clínica, banho e tosa, hotelzinho, financeiro e relacionamento em uma experiência premium." },
    { property: "og:title", content: "Oricse — A operação pet, em perfeita harmonia." },
    { property: "og:url", content: "https://oricse.com.br/" },
  ]}),
  component: PaginaInicial,
});

const modulos = [
  { icon: CalendarDays, titulo: "Recepção", descricao: "Organize a agenda, confirme atendimentos, acompanhe a fila de espera e tenha o cadastro do tutor e do pet sempre à mão." },
  { icon: Stethoscope, titulo: "Clínica veterinária", descricao: "Prontuário, receitas, vacinas, exames, documentos e acompanhamento clínico completo em um só fluxo." },
  { icon: Scissors, titulo: "Banho e tosa", descricao: "Controle serviços, pacotes, profissionais, horários e observações importantes para cada pet." },
  { icon: Hotel, titulo: "Hotelzinho", descricao: "Cuide de reservas, hospedagens, check-in, estadias, diárias e rotinas de cuidado com clareza." },
  { icon: Sparkles, titulo: "Meu OricStúdio", descricao: "Crie e organize a presença digital da clínica, planeje conteúdos e mantenha sua marca viva sem sair da Oricse." },
  { icon: Users, titulo: "Gestão de clientes", descricao: "Histórico completo de tutores e pets, relacionamento, lembretes e campanhas segmentadas." },
  { icon: CreditCard, titulo: "Financeiro e OricsePay", descricao: "Caixa, comandas, pagamentos online, cobranças, repasses e visão financeira da operação." },
  { icon: Package, titulo: "Estoque e produtos", descricao: "Catálogo, movimentações, vendas, alertas e produtos conectados à rotina da clínica e do pet shop." },
  { icon: ClipboardList, titulo: "Relatórios", descricao: "Acompanhe atendimentos, vendas, desempenho, caixa e os dados que ajudam sua empresa a crescer." },
  { icon: UserRound, titulo: "RH e atividade", descricao: "Equipe, acessos, ponto, jornadas e permissões definidos de acordo com cada função." },
  { icon: Settings, titulo: "Configurações", descricao: "Personalize sua clínica, usuários, preferências, integrações, portal e presença digital." },
] as const;

const joias = [
  ["Atendimento impecável", "Da recepção ao prontuário, cada detalhe do cuidado fica registrado e acessível para a equipe certa."],
  ["Operação leve", "Módulos conectados evitam retrabalho entre agenda, clínica, caixa, serviços e relacionamento."],
  ["Experiência para o tutor", "Portal com documentos, vacinas, exames, agendamento, comunicados e pagamentos online."],
] as const;

function Titulo({children, claro = false}:{children:ReactNode; claro?:boolean}) {
  return <h2 className={"font-display text-4xl font-semibold leading-[.96] tracking-[-.055em] sm:text-6xl " + (claro ? "text-[#fff9f4]" : "text-[#4A1826]")}>{children}</h2>;
}

function MenuDoSistema() {
  const itens = [
    [CalendarDays, "Recepção"], [Stethoscope, "Clínica veterinária"], [Scissors, "Banho e tosa"],
    [Hotel, "Hotelzinho"], [Sparkles, "Meu OricStúdio"], [Settings, "Mais opções"],
  ] as const;
  return (
    <div className="rounded-[26px] border border-[#eadbd4] bg-[#fffdfa] p-3 shadow-[0_25px_70px_rgba(74,24,38,.10)]">
      <div className="mb-3 flex items-center justify-between px-2"><span className="font-display text-xl font-semibold text-[#4A1826]">Menu</span><X size={17} className="text-[#8d6570]"/></div>
      <div className="space-y-1.5">
        {itens.map(([Icon, titulo], i) => <div key={titulo} className={"flex items-center justify-between rounded-xl border px-3 py-2.5 text-[11px] font-bold " + (i === 4 ? "border-[#dcc3c9] bg-[#f7eaec] text-[#651e37]" : "border-[#eee1dc] bg-[#fffaf7] text-[#5a2b3a]")}><span className="flex items-center gap-2"><Icon size={15}/>{titulo}</span><ChevronDown size={14}/></div>)}
      </div>
      <div className="mt-2 border-l border-[#d9c0c5] pl-3">
        {[["Gestão de clientes", Users], ["Financeiro", CreditCard], ["Estoque e produtos", Package], ["Relatórios", ClipboardList], ["RH", UserRound], ["Configurações", Settings]].map(([titulo, Icon]) => { const I=Icon as typeof Users; return <div key={titulo as string} className="mt-1 flex items-center justify-between rounded-lg border border-[#f0e3df] bg-white px-2.5 py-2 text-[9px] font-semibold text-[#754858]"><span className="flex items-center gap-1.5"><I size={13}/>{titulo as string}</span><ChevronDown size={12}/></div>})}
      </div>
    </div>
  );
}

function PaginaInicial() {
  const [menu, setMenu] = useState(false);
  return (
    <main className="overflow-x-hidden bg-[#fffdfa] text-[#512b38]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link to="/" className="flex items-center gap-2" aria-label="Oricse — início"><img src="/oricse-logo-oryx.svg?v=15" className="h-11 w-11" alt="Oricse"/><span className="text-lg font-black tracking-[.08em] text-[#4A1826]">ORICSE</span></Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-[#6b4050] md:flex"><a href="#solucoes">Soluções</a><a href="#diferenciais">Diferenciais</a><a href="#oricstudio">OricStúdio</a><Link to="/planos">Planos</Link></nav>
        <Link to="/planos" className="hidden rounded-full bg-[#4A1826] px-5 py-2.5 text-sm font-bold text-white md:inline-flex">Solicitar demonstração</Link>
        <button onClick={() => setMenu(!menu)} aria-expanded={menu} className="rounded-full bg-[#4A1826] p-2.5 text-white md:hidden">{menu ? <X size={17}/> : <Menu size={17}/>}</button>
        {menu && <nav className="absolute right-5 top-20 z-30 grid w-56 gap-3 rounded-2xl border border-[#eadbd4] bg-[#fffdfa] p-4 text-sm font-semibold text-[#5a2b3a] shadow-xl md:hidden"><a href="#solucoes" onClick={()=>setMenu(false)}>Soluções</a><a href="#diferenciais" onClick={()=>setMenu(false)}>Diferenciais</a><a href="#oricstudio" onClick={()=>setMenu(false)}>OricStúdio</a><Link to="/planos">Planos</Link><Link to="/login">Entrar</Link></nav>}
      </header>

      <section className="relative border-y border-[#f0e3de] bg-[radial-gradient(circle_at_63%_45%,#f4e1df_0,transparent_24%),linear-gradient(180deg,#fffdfa_0%,#faf4f0_100%)]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:px-10 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#e8d1d2] bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#8a4e61]"><Sparkles size={13}/> Plataforma completa para o mercado pet</p>
            <h1 className="mt-6 max-w-[10ch] font-display text-[clamp(48px,6vw,84px)] font-semibold leading-[.91] tracking-[-.065em] text-[#4A1826]">Gestão com <span className="text-[#a56a78]">requinte</span> para quem cuida.</h1>
            <p className="mt-6 max-w-xl text-[17px] leading-7 text-[#785867]">A Oricse transforma a rotina da clínica, do pet shop, do hotelzinho e do atendimento domiciliar em uma experiência organizada, elegante e humana.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link to="/planos" className="inline-flex items-center gap-2 rounded-full bg-[#4A1826] px-6 py-3.5 font-bold text-white">Conhecer a Oricse <ArrowRight size={17}/></Link><Link to="/login" className="inline-flex items-center rounded-full border border-[#ceb3bb] bg-white px-6 py-3.5 font-bold text-[#5d293c]">Já sou cliente</Link></div>
            <p className="mt-6 flex items-center gap-2 text-sm text-[#876570]"><PawPrint size={16} className="text-[#8d4359]"/> Uma plataforma para sua operação inteira, com a sua identidade.</p>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full border border-[#d8b8bf] opacity-60" />
            <div className="absolute -bottom-10 -left-12 h-36 w-36 rounded-full bg-[#e5c8c7] blur-2xl" />
            <MenuDoSistema />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10"><div className="grid gap-3 sm:grid-cols-3">{joias.map(([titulo,texto],i)=><article key={titulo} className="rounded-2xl border border-[#ecdfd9] bg-white p-5"><span className="font-display text-2xl text-[#a56a78]">0{i+1}</span><h2 className="mt-4 text-base font-bold text-[#4A1826]">{titulo}</h2><p className="mt-2 text-sm leading-6 text-[#765c66]">{texto}</p></article>)}</div></section>

      <section id="solucoes" className="border-y border-[#eee0da] bg-[#fbf6f2] px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9c6574]">Tudo o que a sua operação precisa</p><Titulo>Funcionalidades pensadas para cada detalhe da rotina.</Titulo><p className="mt-5 text-[17px] leading-7 text-[#765c66]">O menu da Oricse é o mapa da sua empresa: cada área tem uma função clara, mas todas trabalham juntas para a sua equipe ganhar tempo.</p></div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {modulos.map(({icon:Icon,titulo,descricao},i)=><article key={titulo} className={"group rounded-[22px] border p-6 transition hover:-translate-y-1 " + (i===4 ? "border-[#b98895] bg-[#4A1826] text-[#fff9f4] shadow-[0_20px_35px_rgba(74,24,38,.18)]" : "border-[#eaded8] bg-white text-[#4A1826]")}><div className={"flex h-11 w-11 items-center justify-center rounded-xl " + (i===4 ? "bg-[#ffffff18] text-[#f1cfd4]" : "bg-[#f7ebea] text-[#7a344c]")}><Icon size={22}/></div><h3 className="mt-5 text-xl font-bold">{titulo}</h3><p className={"mt-2 max-w-lg text-[15px] leading-6 " + (i===4 ? "text-[#f5dfe2]/85" : "text-[#765c66]")}>{descricao}</p><span className={"mt-5 inline-flex items-center gap-1 text-sm font-bold " + (i===4 ? "text-[#f0cbd1]" : "text-[#8b4057]")}>Conhecer recurso <ArrowRight size={15}/></span></article>)}
          </div>
        </div>
      </section>

      <section id="oricstudio" className="bg-[#4A1826] px-5 py-20 text-[#fff9f4] sm:px-8 sm:py-24 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
          <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#dbabb5]">Meu OricStúdio</p><Titulo claro>Seu cuidado também merece uma marca bonita.</Titulo><p className="mt-5 max-w-md text-[17px] leading-7 text-[#f3dce0]/80">O OricStúdio leva a presença digital da sua clínica para dentro da plataforma: organize ideias, crie conteúdos, mantenha a comunicação ativa e cuide da imagem da sua marca com a mesma atenção que você dá aos pets.</p><Link to="/planos" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f4dfdf] px-6 py-3.5 font-bold text-[#4A1826]">Conhecer o OricStúdio <ArrowRight size={17}/></Link></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["Planejamento de conteúdo","Organize pautas e tenha clareza do que comunicar."],["Presença da clínica","Conecte canais e mantenha sua marca com identidade."],["Comunicação com tutores","Transforme campanhas e lembretes em relacionamento."],["Tudo dentro da Oricse","Sem perder o contexto da sua operação e do seu público."]].map(([t,d])=><article key={t} className="rounded-2xl border border-white/15 bg-white/[.07] p-6"><Sparkles size={20} className="text-[#e7b8c1]"/><h3 className="mt-10 text-lg font-bold">{t}</h3><p className="mt-2 text-sm leading-6 text-[#f5dfe2]/75">{d}</p></article>)}
          </div>
        </div>
      </section>

      <section id="diferenciais" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9c6574]">A experiência continua com o tutor</p><Titulo>Do atendimento à confiança.</Titulo><p className="mt-5 text-[17px] leading-7 text-[#765c66]">A Oricse não termina no balcão. Ela aproxima a clínica do tutor e deixa informações importantes sempre bem cuidadas.</p></div><div className="rounded-[28px] border border-[#ead8d5] bg-[#fffaf7] p-6 sm:p-8"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3e2e2] text-[#7e334b]"><PawPrint size={23}/></div><div><h3 className="text-xl font-bold text-[#4A1826]">Portal do Tutor + OricsePay</h3><p className="text-sm text-[#856973]">Informação e praticidade em um único acesso.</p></div></div><div className="mt-7 grid gap-3 sm:grid-cols-2">{["Receitas, exames, documentos e laudos","Cartão de vacina e vermífugo atualizados","Agendamento online e comunicação direta","Comandas e pagamentos digitais seguros"].map(t=><div key={t} className="flex gap-2 rounded-xl bg-white p-3 text-sm font-semibold text-[#66404d]"><span className="mt-0.5 text-[#9d5268]">✦</span>{t}</div>)}</div></div></div></section>

      <section className="px-5 pb-14 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 rounded-[28px] bg-[#f1e3df] px-7 py-10 text-center sm:flex-row sm:px-12 sm:text-left"><div><h2 className="font-display text-3xl font-semibold tracking-[-.04em] text-[#4A1826] sm:text-4xl">Sua operação merece uma gestão à altura.</h2><p className="mt-2 text-[#765c66]">Conheça a Oricse e transforme a rotina do seu negócio pet.</p></div><Link to="/planos" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#4A1826] px-6 py-3.5 font-bold text-white">Solicitar demonstração <ArrowRight size={17}/></Link></div></section>

      <footer className="border-t border-[#eaded8] px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-xs text-[#846873]"><span className="flex items-center gap-2 font-bold text-[#5a293b]"><img src="/oricse-logo-oryx.svg?v=15" className="h-7 w-7" alt=""/>Oricse · Soluções para o mercado pet</span><span>© 2026 Oricse. Todos os direitos reservados.</span><div className="flex gap-4"><Link to="/politica-de-privacidade">Privacidade</Link><Link to="/termos-de-uso">Termos</Link><Link to="/login">Entrar</Link></div></div></footer>
    </main>
  );
}
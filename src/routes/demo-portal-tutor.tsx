import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PortalClinicContact } from "@/components/PortalClinicContact";
import { PortalTutorOtherServices } from "@/components/PortalTutorOtherServices";
import { PortalFooter } from "@/components/PortalFooter";
import { Activity, ArrowLeft, ArrowRight, Bell, CalendarDays, Check, ChevronRight, CircleHelp, ClipboardList, Clock3, CreditCard, Download, FileHeart, FileText, Heart, Home, Hotel, LogOut, Menu, MessageCircle, PawPrint, Plus, Scissors, Search, Settings, ShieldCheck, ShoppingBag, Stethoscope, Syringe, UserRound, Wallet, X } from "lucide-react";

export const Route = createFileRoute("/demo-portal-tutor")({ component: DemoPortalTutor });
type Aba = "inicio"|"pets"|"agenda"|"saude"|"documentos"|"financeiro"|"banho"|"hotel"|"contato"|"perfil";
const pets=[{id:1,nome:"Lua",tipo:"Gata • SRD",idade:"3 anos",emoji:"🐱",cor:"#f0d8d1",peso:"4,2 kg"},{id:2,nome:"Thor",tipo:"Cão • Golden Retriever",idade:"5 anos",emoji:"🐶",cor:"#eddfbd",peso:"28 kg"}];
const arquivosRecentesDemo=[
 {titulo:"Hemograma completo",categoria:"exame",pet:"Lua",data:"03/11/2026"},
 {titulo:"Laudo ultrassonográfico",categoria:"exame",pet:"Thor",data:"02/10/2026"},
 {titulo:"Receita veterinária",categoria:"receita",pet:"Thor",data:"20/10/2026"}
] as const;
const menu: Array<{id:Aba,label:string,icon:typeof Home}> = [
 {id:"inicio",label:"Início",icon:Home},{id:"pets",label:"Meus pets",icon:PawPrint},{id:"agenda",label:"Agendamentos",icon:CalendarDays},
 {id:"saude",label:"Saúde e vacinas",icon:Heart},{id:"documentos",label:"Documentos",icon:FileText},{id:"financeiro",label:"Financeiro",icon:Wallet},
 {id:"banho",label:"Banho e tosa",icon:Scissors},{id:"hotel",label:"Hotelzinho",icon:Hotel},{id:"contato",label:"Fale com a Clínica",icon:MessageCircle},{id:"perfil",label:"Meu perfil",icon:UserRound}
];
const compromissos:CompromissoDemo[]=[{data:"12 DEZ",dataISO:"2026-12-12",hora:"09:30",pet:"Lua",tipo:"Consulta",profissional:"Dr. Marcelo",status:"Confirmado"},{data:"13 DEZ",dataISO:"2026-12-13",hora:"14:00",pet:"Lua",tipo:"Banho e Tosa",profissional:"Equipe de Banho e Tosa",status:"Confirmado"}];
type CompromissoDemo={data:string;dataISO:string;hora:string;pet:string;tipo:string;profissional:string;status:string};

// Disponibilidade inteiramente fictícia, publicada pela clínica de demonstração.
// O portal real consulta o banco via oricse_portal_horarios_disponiveis.
const agendaPublicadaDemo:Record<string,Array<{servico:string;profissional:string;horarios:string[];pagamento:boolean}>>={
 "2026-12-12":[{servico:"Consulta veterinária",profissional:"Dr. Marcelo",horarios:["10:30","11:00"],pagamento:true}],
 "2026-12-13":[{servico:"Banho e tosa",profissional:"Equipe de Banho e Tosa",horarios:["09:00","11:00"],pagamento:false}],
 "2026-12-15":[{servico:"Consulta veterinária",profissional:"Dr. Marcelo",horarios:["09:00","15:30"],pagamento:true},{servico:"Vacinação",profissional:"Dra. Luciana",horarios:["10:00"],pagamento:true}],
 "2026-12-17":[{servico:"Retorno",profissional:"Dra. Luciana",horarios:["14:00","15:00"],pagamento:false}],
 "2026-12-21":[{servico:"Banho",profissional:"Equipe de Banho e Tosa",horarios:["08:30","10:30"],pagamento:false}]
};

function CalendarioTutor({compromissos,abrirDetalhes,agendarDia,mostrarCalendario=true}:{compromissos:CompromissoDemo[];abrirDetalhes:(c:CompromissoDemo)=>void;agendarDia:(data:string)=>void;mostrarCalendario?:boolean}){
 const [mes,setMes]=useState(new Date(2026,11,1));
 const [selecionado,setSelecionado]=useState<string|null>(null);
 const inicio=new Date(mes.getFullYear(),mes.getMonth(),1).getDay();
 const total=new Date(mes.getFullYear(),mes.getMonth()+1,0).getDate();
 const dias=[...Array(inicio).fill(null),...Array.from({length:total},(_,i)=>i+1)];
 const mesTexto=mes.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
 const proximos=[...compromissos].sort((a,b)=>a.dataISO.localeCompare(b.dataISO)||a.hora.localeCompare(b.hora));
 const formatar=(iso:string)=>iso.split("-").reverse().join("/");
 const selecionados=selecionado?proximos.filter(a=>a.dataISO===selecionado):[];
 return <section className="w-full rounded-3xl border border-[#eee8e4] bg-white p-4 shadow-sm sm:p-5">
  <h2 className="mb-3 text-lg font-extrabold">Minha agenda</h2>
  <div className="space-y-2" aria-label="Próximos compromissos">
   {proximos.length===0?<p className="rounded-xl bg-[#faf7f4] p-4 text-sm text-[#81767b]">Nenhum compromisso agendado.</p>:proximos.slice(0,mostrarCalendario?5:8).map((a,i)=>{
    const diaSemana=new Date(a.dataISO+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long"});
    return <button key={i} type="button" onClick={()=>abrirDetalhes(a)} className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-[#efe8e5] bg-white p-3 text-left transition hover:border-[#d5b1bf] hover:bg-[#faf4f6] sm:gap-4 sm:p-4">
      <div className="w-[124px] shrink-0 border-r border-[#eadfe2] pr-2 sm:w-[178px] sm:pr-4">
       <span className="block text-sm font-extrabold capitalize leading-tight text-[#702a43]">{diaSemana.slice(0,3)}, {formatar(a.dataISO)} · {a.hora}</span>
      </div>
      <div className="min-w-0 flex-1">
       <span className="block text-sm font-extrabold text-[#30252b]">{a.pet} · {a.tipo}</span>
       <span className="mt-1 block text-xs text-[#786e73]">{a.profissional}</span>
       <span className="mt-1 block text-xs font-semibold text-[#702a43]">{a.status}</span>
      </div>
      <ChevronRight className="shrink-0 text-[#9b7a86]" size={18}/>
     </button>;
   })}
  </div>
  {mostrarCalendario&&<div className="mt-4 space-y-2 lg:hidden"><p className="text-sm font-extrabold text-[#312530]">Dias e horários disponíveis</p>{Object.entries(agendaPublicadaDemo).slice(0,5).map(([iso,opcoes])=>{const livres=opcoes.flatMap(op=>op.horarios.filter(h=>!compromissos.some(c=>c.dataISO===iso&&c.hora===h)).map(h=>h));const dataFormatada=new Date(iso+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"});return livres.length?<div key={iso} className="rounded-xl bg-[#faf7f4] p-3"><div className="mb-2 flex items-center justify-between gap-2"><b className="capitalize">{dataFormatada}</b><button onClick={()=>agendarDia(iso)} className="text-sm font-semibold text-[#702a43]">Agendar</button></div><div className="flex flex-wrap gap-2">{livres.map(h=><button key={h} onClick={()=>agendarDia(iso)} className="min-h-11 rounded-lg border border-[#e6d9d7] bg-white px-3 text-sm font-semibold text-[#702a43]">{h}</button>)}</div></div>:null;})}</div>}
  {mostrarCalendario&&<div className="mt-4 hidden w-full overflow-hidden rounded-xl border border-[#eadfe2] lg:block">
   <div className="flex items-center justify-between gap-2 border-b border-[#eadfe2] bg-[#faf6f7] px-3 py-3">
    <button aria-label="Mês anterior" className="rounded-lg px-3 py-1 font-bold text-[#702a43] hover:bg-[#f7e9ee]" onClick={()=>setMes(new Date(mes.getFullYear(),mes.getMonth()-1,1))}>‹</button>
    <span className="text-sm font-bold">{mesTexto.charAt(0).toUpperCase()+mesTexto.slice(1)}</span>
    <button aria-label="Próximo mês" className="rounded-lg px-3 py-1 font-bold text-[#702a43] hover:bg-[#f7e9ee]" onClick={()=>setMes(new Date(mes.getFullYear(),mes.getMonth()+1,1))}>›</button>
   </div>
   <div className="grid grid-cols-7 bg-[#eadfe2] gap-px" role="grid" aria-label="Calendário mensal, iniciando no domingo">
    {["DOMINGO","SEGUNDA","TERÇA","QUARTA","QUINTA","SEXTA","SÁBADO"].map((nome,i)=><div key={i} className="flex min-w-0 items-center justify-center bg-[#f8eef2] px-0.5 py-3 text-center text-[9px] font-extrabold text-[#702a43] sm:text-xs">{nome}</div>)}
    {dias.map((dia,i)=>{
      if(dia===null)return <span key={"v"+i} className="min-h-16 bg-[#faf8f8] sm:min-h-24"/>;
      const iso=`${mes.getFullYear()}-${String(mes.getMonth()+1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
      const marcados=proximos.filter(a=>a.dataISO===iso);
      return <div key={i} role="gridcell"
        className={`flex min-h-16 min-w-0 flex-col items-start gap-1 p-1.5 text-left text-xs transition sm:min-h-24 sm:p-2.5 ${selecionado===iso?"bg-[#f4e0e8] ring-2 ring-inset ring-[#702a43]":marcados.length?"bg-[#fff8fa]":"bg-white"}`}>
        <div className="flex w-full min-w-0 items-center justify-between gap-1">
          <button type="button" aria-label={`Ver compromissos do dia ${dia}`} onClick={()=>setSelecionado(iso)}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold ${selecionado===iso?"bg-[#702a43] text-white":"text-[#30232b] hover:bg-[#f3dce5]"}`}>{dia}</button>
          {(agendaPublicadaDemo[iso]||[]).some(a=>a.horarios.some(h=>!compromissos.some(m=>m.dataISO===iso&&m.hora===h)))&&<button type="button" aria-label={`Agendar para ${dia}/${String(mes.getMonth()+1).padStart(2,"0")}/${mes.getFullYear()}`}
            onClick={()=>agendarDia(iso)}
            className="rounded-md border border-[#d6a8b8] bg-white px-1.5 py-1 text-[9px] font-bold leading-tight text-[#702a43] hover:bg-[#f3dce5] sm:px-2 sm:text-[11px]">Agendar</button>}
        </div>
        {marcados.length>0&&<div className="w-full space-y-1">
         {marcados.slice(0,2).map((a,j)=><button key={j} type="button" onClick={()=>abrirDetalhes(a)} className="block w-full break-words rounded bg-[#f3dce5] px-1 py-0.5 text-left text-[9px] font-semibold leading-tight text-[#702a43] hover:bg-[#eac8d5] sm:text-xs">{a.pet} · {a.tipo}<span className="block text-[9px] font-normal sm:text-[11px]">{a.profissional}</span></button>)}
         {marcados.length>2&&<span className="block text-[10px] font-bold text-[#702a43]">+{marcados.length-2}</span>}
        </div>}
      </div>;
    })}
   </div>
  </div>}
  {mostrarCalendario&&selecionado&&<div className="mt-3 hidden text-xs text-[#71666a] lg:block"><b>{formatar(selecionado)}:</b> {selecionados.length?selecionados.map((a,i)=><button key={i} onClick={()=>abrirDetalhes(a)} className="ml-2 font-semibold text-[#702a43] underline">{a.hora} · {a.pet} · {a.tipo}<span className="block text-[9px] font-normal sm:text-[11px]">{a.profissional}</span></button>):"Nenhum compromisso."}</div>}
 </section>;
}

function DemoPortalTutor(){
 // Login cenográfico: não autentica, não armazena nem envia credenciais.
 const [demoAutorizada,setDemoAutorizada]=useState(false);
 const [demoUsuario,setDemoUsuario]=useState("");
 const [demoSenha,setDemoSenha]=useState("");
 const [maisAberto,setMaisAberto]=useState(false);
 const [mostrarSenha,setMostrarSenha]=useState(false);
 const [recuperarDemo,setRecuperarDemo]=useState(false);
 const [aba,setAba]=useState<Aba>("inicio");const [pet,setPet]=useState<number|null>(null);const [modal,setModal]=useState("");const [menuAberto,setMenuAberto]=useState(false);
 const [perfilDados,setPerfilDados]=useState({nome:"Mariana Oliveira",email:"mariana@exemplo.com",telefone:"(31) 99999-0000",notificacoes:true});
 const [perfilEdicao,setPerfilEdicao]=useState(perfilDados);
 const [filtro,setFiltro]=useState("");const [servico,setServico]=useState("Consulta veterinária");const [data,setData]=useState("2026-11-12");const [hora,setHora]=useState("09:30");const [petAgendar,setPetAgendar]=useState("Lua");const [agendados,setAgendados]=useState(compromissos);
 const [favorito,setFavorito]=useState(false);
 const selecionado=useMemo(()=>pets.find(p=>p.id===pet)||pets[0],[pet]);
 const servicosDoDia=(agendaPublicadaDemo[data]||[]).filter(a=>a.horarios.some(h=>!agendados.some(x=>x.dataISO===data&&x.hora===h)));
 const agendaSelecionada=servicosDoDia.find(a=>a.servico===servico);
 const horariosLivres=(agendaSelecionada?.horarios||[]).filter(h=>!agendados.some(x=>x.dataISO===data&&x.hora===h));
 const pagamentoObrigatorio=Boolean(agendaSelecionada?.pagamento);
 function navegar(id:Aba){setAba(id);setMenuAberto(false);setFiltro("");window.scrollTo?.(0,0);}
 function aviso(texto:string){setModal(texto)}
 const card="rounded-2xl bg-white";
 const botao="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#702a43] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#572038]";
 const secundario="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#e9dfdc] bg-white px-4 py-3 text-sm font-semibold text-[#67283e] transition hover:bg-[#fcf4f0]";
 const titulo=menu.find(m=>m.id===aba)?.label||"Início";
 if(!demoAutorizada) return <main className="portal-tutor-demo flex min-h-screen items-center justify-center bg-[#faf7f4] px-4 py-6 text-[#342732] sm:py-10">
  <div className="grid w-full max-w-4xl overflow-hidden bg-white sm:grid-cols-2 sm:rounded-2xl sm:border sm:border-[#eadfda]">
   <section className="hidden min-h-[540px] flex-col justify-between bg-[#faf7f4] p-9 text-[#312530] sm:flex">
    <div><img src="/oricse-logo-oryx.svg" alt="Oricse" className="h-28 w-28 object-contain sm:h-36 sm:w-36"/><h1 className="mt-8 text-3xl font-extrabold">Portal do tutor</h1><p className="mt-3 max-w-sm leading-relaxed text-[#786b73]">Acompanhe os cuidados dos seus pets em um só lugar.</p></div>
   </section>
   <div className="p-5 sm:p-9">
    <div className="mb-7 flex items-center gap-3 sm:hidden"><img src="/oricse-logo-oryx.svg" alt="Oricse" className="h-24 w-24 shrink-0 object-contain"/><div><h1 className="text-xl font-extrabold">Portal do tutor</h1><p className="text-sm text-[#786b73]">Acesso aos seus pets</p></div></div>
    {recuperarDemo?<div className="space-y-5">
      <h2 className="text-2xl font-extrabold text-[#312530]">Esqueci minha senha</h2>
      <p className="leading-relaxed text-[#6b5d62]">No portal real, a recuperação valida os dados do tutor e do animal vinculado à clínica.</p>
      <button type="button" className={botao+" w-full"} onClick={()=>setRecuperarDemo(false)}>Voltar ao login</button>
    </div>:<form className="space-y-5" onSubmit={e=>{e.preventDefault();if(demoUsuario.trim()&&demoSenha.trim()){setDemoAutorizada(true);setDemoSenha("");}}}>
      <div><h2 className="text-2xl font-extrabold text-[#312530]">Entrar</h2><p className="mt-1 text-sm text-[#786b73]">Use seus dados de acesso ao portal.</p></div>
      <div className="rounded-xl bg-[#f8e9ee] p-4 text-sm leading-relaxed text-[#6e3045]"><b>Ambiente de demonstração.</b> Use qualquer e-mail e senha. Nenhum dado é validado ou enviado.</div>
      <label className="block text-sm font-bold">E-mail<input required autoComplete="email" value={demoUsuario} onChange={e=>setDemoUsuario(e.target.value)} placeholder="seu e-mail" className="mt-2 w-full rounded-xl border border-[#e6d9d7] bg-white px-4 py-3 font-normal outline-none focus:border-[#702a43]"/></label>
      <label className="block text-sm font-bold">Senha<div className="mt-2 flex overflow-hidden rounded-xl border border-[#e6d9d7] focus-within:border-[#702a43]"><input required autoComplete="current-password" type={mostrarSenha?"text":"password"} value={demoSenha} onChange={e=>setDemoSenha(e.target.value)} placeholder="sua senha" className="min-w-0 flex-1 px-4 py-3 font-normal outline-none"/><button type="button" className="px-4 text-xs font-semibold text-[#702a43]" onClick={()=>setMostrarSenha(!mostrarSenha)}>{mostrarSenha?"Ocultar":"Mostrar"}</button></div></label>
      <div className="flex justify-end"><button type="button" onClick={()=>setRecuperarDemo(true)} className="text-sm font-semibold text-[#702a43] underline underline-offset-4 hover:text-[#572038]">Esqueci minha senha</button></div>
      <button type="submit" className={botao+" w-full"}>Entrar no portal <ArrowRight size={17}/></button>
     </form>}
   </div>
  </div>
 </main>;
 return <div className="min-h-screen bg-[#faf7f4] text-[#312830]" style={{fontFamily:"Inter, ui-sans-serif, system-ui"}}>
  <div className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-2 border-b border-[#e9dce0] bg-[#faf7f4] px-3 py-2 text-[#312530] sm:px-4 sm:py-3 lg:px-8">
   <div className="flex min-w-0 items-center gap-2 sm:gap-3"><img src="/oricse-logo-oryx.svg" alt="Símbolo ORICSE" className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20"/><div className="min-w-0"><div className="text-sm font-extrabold tracking-wide sm:text-base">PORTAL DO TUTOR</div><div className="max-h-14 overflow-hidden text-[10px] leading-snug text-[#786b73] sm:max-h-none sm:text-xs">Acompanhe seus pets, agende serviços e acesse documentos em um só lugar.</div></div></div>
   <div className="flex items-center gap-2 sm:gap-3"><button onClick={()=>aviso("Central de notificações: esta é uma demonstração. Nenhum aviso real será enviado.")} aria-label="Notificações" className="relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-black/5"><Bell size={20}/><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#f5bd90]"/></button><button onClick={()=>navegar("perfil")} aria-label="Abrir meu perfil" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcb8bd] font-semibold text-[#351e2b] sm:h-10 sm:w-10">M</button></div>
  </div>
  <div className="mx-auto flex max-w-[1550px]">
   <aside className={`${menuAberto?"fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 max-h-[65vh] overflow-auto rounded-2xl shadow-2xl":"hidden"} border border-[#eee5e0] bg-white p-4 lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-14 lg:block lg:h-[calc(100vh-3.5rem)] lg:w-64 lg:shrink-0 lg:max-h-none lg:overflow-auto lg:rounded-none lg:border-y-0 lg:border-l-0`}>
    <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[#f9f2ee] p-4"><img src="/clinica-bem-estar-demo.svg" alt="Logo da Clínica Bem-Estar Pet" className="h-14 w-14 shrink-0 rounded-xl object-contain"/><div className="min-w-0 font-bold leading-snug">Clínica Bem-Estar Pet</div></div>
    <nav className="space-y-1">{menu.slice(menuAberto?4:0,menuAberto?undefined:5).map(m=><button key={m.id} onClick={()=>navegar(m.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${aba===m.id?"bg-[#f4e5e9] text-[#69283d]":"text-[#685a61] hover:bg-[#faf5f2]"}`}><m.icon size={19}/>{m.label}{aba===m.id&&<ChevronRight size={14} className="ml-auto"/>}</button>)}
    <button onClick={()=>setMaisAberto(v=>!v)} aria-expanded={maisAberto} className="hidden w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#685a61] hover:bg-[#faf5f2] lg:flex"><Menu size={19}/>Mais serviços<ChevronRight size={15} className={`ml-auto transition-transform ${maisAberto?"rotate-90":""}`}/></button>
    {(maisAberto||menu.slice(5).some(m=>m.id===aba))&&<div className="ml-3 hidden border-l border-[#e9d8de] pl-3 lg:block">{menu.slice(5).map(m=><button key={m.id} onClick={()=>navegar(m.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${aba===m.id?"bg-[#f4e5e9] text-[#69283d]":"text-[#685a61] hover:bg-[#faf5f2]"}`}><m.icon size={18}/>{m.label}</button>)}</div>}</nav>
    <div className="mt-8 rounded-2xl bg-[#f8f1ee] p-4 text-xs text-[#765861]"><ShieldCheck size={20} className="mb-2 text-[#702a43]"/>Prévia segura: nenhum dado real, compra ou agendamento é realizado.</div>
   </aside>
   {menuAberto&&<button className="fixed inset-0 z-30 bg-black/30 lg:hidden" aria-label="Fechar menu" onClick={()=>setMenuAberto(false)}/>}
   <main className="portal-tutor-demo min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-7 lg:px-10">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{aba==="inicio"?"Olá, Mariana! 👋":titulo}</h1>{aba==="inicio"&&<p className="mt-1 text-sm text-[#6e6268]">Tudo o que seus pets precisam, em um só lugar.</p>}</div></div>
    {aba==="inicio"&&<>
      <section className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-4"><img src="/clinica-bem-estar-demo.svg" alt="Logo da Clínica Bem-Estar Pet" className="h-14 w-14 shrink-0 rounded-xl bg-[#f9f2ee] p-1.5 object-contain"/><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-[#8b5b6d]">Sua clínica</p><h2 className="mt-0.5 truncate text-base font-extrabold text-[#312530]">Clínica Bem-Estar Pet</h2></div></section>
      <section className="mb-4 rounded-2xl bg-[#702a43] px-5 py-6 text-white sm:px-7"><h2 className="text-xl font-extrabold sm:text-2xl">Como podemos cuidar dos seus pets hoje?</h2><div className="mt-4"><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#702a43] transition hover:bg-[#f8e9ee]" onClick={()=>setModal("agendar")}><Plus size={17}/>Agendar serviço</button></div></section>
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f8e9ee] p-4 text-[#4a2534]"><div className="flex min-w-0 items-center gap-3"><Bell size={20} className="shrink-0 text-[#702a43]"/><div><p className="font-bold">Vacina de Lua vence em 18 dias</p><p className="text-sm text-[#795866]">Próxima dose: 22/11/2026</p></div></div><button className={secundario+" border-0 bg-transparent"} onClick={()=>navegar("saude")}>Agendar reforço</button></section>
      <div className="mb-5"><CalendarioTutor mostrarCalendario={false} compromissos={agendados} abrirDetalhes={a=>aviso(a.tipo+" — "+a.pet+" — "+a.profissional+" às "+a.hora+". Status: "+a.status+".")} agendarDia={iso=>{const primeira=(agendaPublicadaDemo[iso]||[]).find(a=>a.horarios.some(h=>!agendados.some(x=>x.dataISO===iso&&x.hora===h)));if(!primeira)return;setData(iso);setServico(primeira.servico);setHora(primeira.horarios.find(h=>!agendados.some(x=>x.dataISO===iso&&x.hora===h))||"");setModal("agendar")}}/></div>
      <section className={card+" mb-5 p-5"}><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-extrabold">Meus pets</h2><button className="text-sm font-semibold text-[#702a43]" onClick={()=>navegar("pets")}>Ver fichas →</button></div><div className="flex flex-wrap gap-3">{pets.map(p=><button key={p.id} onClick={()=>{setPet(p.id);navegar("pets")}} className="flex min-w-[120px] flex-1 items-center gap-3 rounded-2xl border border-[#f0e6e3] p-3 text-left hover:bg-[#faf5f2]"><span className="flex h-12 w-12 items-center justify-center rounded-xl text-3xl" style={{background:p.cor}}>{p.emoji}</span><span><b className="block text-sm">{p.nome}</b><span className="text-xs text-[#81777b]">{p.idade}</span></span></button>)}</div></section>
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        {([{titulo:"Últimos exames",categoria:"exame",icone:Activity},{titulo:"Últimas receitas",categoria:"receita",icone:FileText}] as const).map(grupo=><section key={grupo.categoria} className={card+" min-w-0 p-5"}>
          <div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><grupo.icone size={19} className="text-[#702a43]"/><h2 className="text-base font-extrabold">{grupo.titulo}</h2></div><button type="button" className="text-xs font-semibold text-[#702a43] hover:underline" onClick={()=>navegar("documentos")}>Ver todos →</button></div>
          <div className="space-y-2">{arquivosRecentesDemo.filter(a=>a.categoria===grupo.categoria).sort((a,b)=>b.data.split("/").reverse().join("-").localeCompare(a.data.split("/").reverse().join("-"))).slice(0,3).map(a=><button key={a.titulo+a.pet} type="button" onClick={()=>{const animal=pets.find(p=>p.nome===a.pet);if(animal)setPet(animal.id);navegar("documentos");}} className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-[#eee8e4] px-3 py-3 text-left hover:bg-[#faf5f2]">
            <FileText size={17} className="shrink-0 text-[#702a43]"/><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{a.titulo}</strong><span className="block text-xs text-[#81777b]">{a.pet} · {a.data}</span></span><ChevronRight size={16} className="shrink-0 text-[#9b7a86]"/>
          </button>)}</div>
        </section>)}
      </div>
      <PortalTutorOtherServices onNavigate={id=>navegar(id as Aba)}/>
    </>}
    {aba==="pets"&&<><div className="mb-4 flex justify-between gap-3"><p className="text-sm text-[#887b80]">Histórico, cuidados e informações dos seus animais.</p><span className="text-xs text-[#887b80]">O cadastro de novos animais é realizado exclusivamente pela clínica.</span></div><div className="mb-5 grid gap-4 sm:grid-cols-2">{pets.map(p=><button key={p.id} onClick={()=>setPet(p.id)} className={`${card} flex items-center gap-4 p-5 text-left ${selecionado.id===p.id?"ring-2 ring-[#a46b7e]":""}`}><span className="flex h-20 w-20 items-center justify-center rounded-3xl text-5xl" style={{background:p.cor}}>{p.emoji}</span><span><b className="text-xl">{p.nome}</b><span className="block text-sm text-[#887b80]">{p.tipo}</span><span className="block text-xs text-[#887b80]">{p.idade} • {p.peso}</span></span></button>)}</div><section className={card+" p-6"}><div className="mb-4 flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f0dade] text-3xl">{selecionado.emoji}</span><div><h2 className="text-xl font-black">Ficha de {selecionado.nome}</h2><p className="text-sm text-[#867b80]">Informações e acompanhamento</p></div></div><div className="grid gap-3 sm:grid-cols-2">{[["Espécie",selecionado.tipo],["Idade",selecionado.idade],["Último peso",selecionado.peso],["Alergias","Não informadas"],["Microchip","Consultar clínica"],["Última consulta","20/10/2026"]].map(x=><div key={x[0]} className={`rounded-xl p-4 ${x[0]==="Alergias"?"bg-[#f8e9ee]":"bg-[#faf7f4]"}`}><p className="text-xs text-[#887b80]">{x[0]}</p><p className="mt-1 font-semibold">{x[1]}</p>{x[0]==="Alergias"&&<button onClick={()=>aviso("Informe as alergias diretamente à clínica para atualização da ficha.")} className="mt-2 text-sm font-semibold text-[#702a43]">Informar à clínica</button>}</div>)}</div><div className="mt-5 flex flex-wrap gap-2"><button className={botao} onClick={()=>navegar("saude")}>Ver saúde</button><button className={secundario} onClick={()=>navegar("documentos")}>Ver documentos</button><button className={secundario} onClick={()=>setModal("agendar")}>Agendar serviço</button></div></section></>}
    {aba==="agenda"&&<><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#6e6268]">Confira seus horários e escolha uma disponibilidade.</p><button className={botao} onClick={()=>setModal("agendar")}><Plus size={17}/>Novo agendamento</button></div><CalendarioTutor compromissos={agendados} abrirDetalhes={a=>aviso(a.tipo+" — "+a.pet+" — "+a.profissional+" às "+a.hora+". Status: "+a.status+".")} agendarDia={iso=>{const primeira=(agendaPublicadaDemo[iso]||[]).find(a=>a.horarios.some(h=>!agendados.some(x=>x.dataISO===iso&&x.hora===h)));if(!primeira)return;setData(iso);setServico(primeira.servico);setHora(primeira.horarios.find(h=>!agendados.some(x=>x.dataISO===iso&&x.hora===h))||"");setModal("agendar")}}/></>}
    {aba==="saude"&&<><div className="mb-5 flex flex-wrap gap-2">{pets.map(p=><button key={p.id} className={selecionado.id===p.id?botao:secundario} onClick={()=>setPet(p.id)}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-current/10 text-xs">{p.emoji}</span>{p.nome}</button>)}</div><div className="grid gap-4 lg:grid-cols-2">{[{titulo:"Vacinação",icon:Syringe,linha:"Vacina antirrábica",data:"Vence em 18 dias (22/11)",estado:"Próxima",acao:"Agendar reforço",cor:"bg-[#fff4df] text-[#896026]"},{titulo:"Vermifugação",icon:ShieldCheck,linha:"Vermífugo de rotina",data:"Em dia até 10/03/2027",estado:"Em dia",acao:"Ver histórico",cor:"bg-[#edf7ef] text-[#366344]"},{titulo:"Histórico clínico",icon:Stethoscope,linha:"Consulta de rotina",data:"Registrada em 20/10/2026",estado:"Registrado",acao:"Ver histórico",cor:"bg-[#f5f1f3] text-[#6e5962]"},{titulo:"Exames",icon:Activity,linha:"Hemograma completo",data:"03/11/2026",estado:"Disponível",acao:"Ver laudo",cor:"bg-[#f8e9ee] text-[#702a43]"}].map(c=><section key={c.titulo} className={card+" p-5"}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><c.icon size={21} className="text-[#702a43]"/><h2 className="text-lg font-extrabold">{c.titulo}</h2></div><span className={"rounded-full px-2.5 py-1 text-xs font-bold "+c.cor}>{c.estado}</span></div><div className="mt-4"><b>{c.linha}</b><p className="mt-1 text-sm text-[#6e6268]">{c.data}</p></div><button className="mt-4 text-sm font-bold text-[#702a43]" onClick={()=>aviso("Detalhes de "+c.titulo+" — visualização de demonstração.")}>{c.acao} →</button></section>)}</div></>}
    {aba==="documentos"&&<section className={card+" p-5"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Documentos dos meus pets</h2><p className="mt-1 text-sm text-[#887b80]">Escolha o animal sem sair desta página.</p></div><label className="flex items-center gap-2 rounded-xl border px-3 py-2"><Search size={16}/><input aria-label="Pesquisar documento" className="w-36 bg-transparent text-sm outline-none" value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Pesquisar"/></label></div>
      <div className="mb-4 flex flex-wrap gap-2">{pets.map(p=><button key={p.id} type="button" onClick={()=>setPet(p.id)} aria-pressed={selecionado.id===p.id} className={selecionado.id===p.id?botao:secundario}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-current/10 text-xs">{p.emoji}</span>{p.nome}</button>)}</div>
      <div className="mb-2 text-sm font-bold">Arquivos de {selecionado.nome}</div>
      {([{t:"Hemograma completo",tipo:"Exame laboratorial",pet:"Lua",data:"03/11/2026"},{t:"Receita veterinária",tipo:"Receita",pet:"Thor",data:"20/10/2026"},{t:"Cartão de vacinação",tipo:"Vacinas",pet:"Lua",data:"15/09/2026"},{t:"Laudo ultrassonográfico",tipo:"Laudo",pet:"Thor",data:"02/10/2026"},{t:"Comprovante de atendimento",tipo:"Documento",pet:"Lua",data:"03/11/2026"}] as const).filter(d=>d.pet===selecionado.nome&&Object.values(d).join(" ").toLowerCase().includes(filtro.toLowerCase())).map((d,i)=><div key={i} className="flex flex-wrap items-center gap-3 border-b border-[#eee9e5] py-4 last:border-0"><FileText size={21} className="text-[#702a43]"/><div className="min-w-0 flex-1"><b className="text-sm">{d.t}</b><p className="text-xs text-[#877b80]">{d.tipo} • {d.data}</p></div><button className={secundario} onClick={()=>aviso("Arquivo demonstrativo. A clínica disponibiliza o documento no portal real.")}><Download size={15}/>Abrir</button></div>)}
      {!([{t:"Hemograma completo",pet:"Lua"},{t:"Receita veterinária",pet:"Thor"},{t:"Cartão de vacinação",pet:"Lua"},{t:"Laudo ultrassonográfico",pet:"Thor"},{t:"Comprovante de atendimento",pet:"Lua"}]).some(d=>d.pet===selecionado.nome&&d.t.toLowerCase().includes(filtro.toLowerCase()))&&<p className="py-5 text-sm text-[#887b80]">Nenhum documento encontrado para este animal.</p>}
    </section>}
    {aba==="financeiro"&&<><div className="mb-5 grid gap-4 sm:grid-cols-3">{[["Saldo em aberto","R$ 85,00"],["Pagamentos realizados","R$ 320,00"],["Comandas","2"]].map(x=><section key={x[0]} className={card+" p-5"}><p className="text-sm text-[#887b80]">{x[0]}</p><h2 className="mt-2 text-2xl font-black">{x[1]}</h2></section>)}</div><section className={card+" p-5"}><h2 className="mb-4 text-lg font-extrabold">Minhas comandas</h2>{[["Consulta de rotina","Lua","R$ 85,00","Em aberto"],["Vacinação + avaliação","Thor","R$ 320,00","Pago"]].map(x=><div key={x[0]} className="flex flex-wrap items-center gap-3 border-b py-4 last:border-0"><span className="rounded-xl bg-[#f9edef] p-3"><Wallet size={19}/></span><div className="flex-1"><b className="text-sm">{x[0]}</b><p className="text-xs text-[#887b80]">{x[1]} • {x[3]}</p></div><b>{x[2]}</b><button className={secundario} onClick={()=>aviso(x[3]==="Pago"?"Recibo demonstrativo.":"Checkout demonstrativo: nenhum pagamento será cobrado.")}>{x[3]==="Pago"?"Recibo":"Ver / pagar"}</button></div>)}</section></>}
    {aba==="banho"&&<section className={card+" p-6"}><div className="mb-5 flex items-center gap-3"><Scissors size={28} className="text-[#702a43]"/><div><h2 className="text-xl font-black">Banho e tosa</h2><p className="text-sm text-[#887b80]">Agende cuidados e acompanhe seus serviços.</p></div></div><div className="grid gap-2 sm:grid-cols-3">{[{t:"Banho",d:"Higiene e bem-estar"},{t:"Banho e tosa",d:"Cuidado completo"},{t:"Serviço especial",d:"Sob avaliação"}].map(x=><button key={x.t} onClick={()=>{setServico(x.t);setModal("agendar")}} className="rounded-xl bg-[#faf7f4] p-4 text-left transition hover:bg-[#f8e9ee]"><Scissors size={20} className="mb-3 text-[#702a43]"/><b>{x.t}</b><p className="mt-1 text-sm text-[#887b80]">{x.d}</p><span className="mt-3 block text-sm font-bold text-[#702a43]">Agendar →</span></button>)}</div></section>}
    {aba==="hotel"&&<section className={card+" p-6"}><div className="mb-5 flex items-center gap-3"><Hotel size={28} className="text-[#702a43]"/><div><h2 className="text-xl font-black">Hotelzinho</h2><p className="text-sm text-[#887b80]">Estadias, reservas e cuidados dos hóspedes.</p></div></div><div className="grid gap-2 sm:grid-cols-3">{[{t:"Reservar estadia",d:"Escolha as datas de entrada e saída.",i:Hotel},{t:"Minhas reservas",d:"Acompanhe o status das solicitações.",i:CalendarDays},{t:"Cuidados especiais",d:"Alimentação, rotina e orientações.",i:ClipboardList}].map(x=><button key={x.t} onClick={()=>aviso(x.t+": consulte a clínica para confirmar sua disponibilidade.")} className="rounded-xl bg-[#faf7f4] p-4 text-left transition hover:bg-[#f8e9ee]"><x.i size={20} className="mb-3 text-[#702a43]"/><b>{x.t}</b><p className="mt-1 text-sm text-[#887b80]">{x.d}</p></button>)}</div></section>}
    {aba==="contato"&&<PortalClinicContact demonstracao canais={{
 whatsapp:"(31) 99999-0000",
 instagram:"https://www.instagram.com/",
 facebook:"https://www.facebook.com/",
 x:"https://x.com/",
 tiktok:"https://www.tiktok.com/",
 youtube:"https://www.youtube.com/",
 site:"https://example.com/",
 email:"contato@exemplo.com",
 telefone:"(31) 3333-0000",
 endereco:"Endereço fictício, Belo Horizonte/MG",
 horario:"Segunda a sexta, 8h às 18h"
}}/>}
        {aba==="perfil"&&<section className={card+" max-w-3xl p-6"}><div className="mb-5 flex items-center gap-3"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f0dade] text-2xl font-bold text-[#702a43]">{perfilDados.nome.trim().charAt(0).toUpperCase()||"M"}</div><div><h2 className="text-xl font-black">{perfilDados.nome}</h2><p className="text-sm text-[#887b80]">Responsável por Lua e Thor</p></div></div><div className="grid gap-3 sm:grid-cols-2">{[["Nome",perfilDados.nome],["E-mail",perfilDados.email],["Telefone",perfilDados.telefone],["CPF","***.***.***-**"],["Clínica","Clínica Bem-Estar Pet"],["Notificações",perfilDados.notificacoes?"Ativadas":"Desativadas"]].map(x=><div key={x[0]} className="rounded-2xl bg-[#faf7f4] p-4"><p className="text-xs text-[#887b80]">{x[0]}</p><b>{x[1]}</b></div>)}</div><div className="mt-5 flex flex-wrap gap-2"><button className={secundario} onClick={()=>{setPerfilEdicao({...perfilDados});setModal("editar-perfil")}}><Settings size={17}/>Editar dados</button><button className={secundario} onClick={()=>aviso("Alteração de senha disponível no portal autenticado da clínica.")}>Alterar senha</button><button className={secundario} onClick={()=>{setDemoAutorizada(false);setAba("inicio");setDemoUsuario("");setDemoSenha("");}}><LogOut size={17}/>Sair</button></div></section>}
    <div className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t border-[#eaddd9] bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">{menu.slice(0,4).map(m=><button key={m.id} onClick={()=>navegar(m.id)} className={`flex flex-col items-center gap-1 px-1 py-3 text-[10px] font-semibold ${aba===m.id?"text-[#702a43]":"text-[#84777b]"}`}><m.icon size={20}/>{m.label==="Agendamentos"?"Agenda":m.label==="Saúde e vacinas"?"Saúde":m.label}</button>)}<button onClick={()=>setMenuAberto(true)} className="flex flex-col items-center gap-1 px-1 py-3 text-[10px] font-semibold text-[#84777b]"><Menu size={20}/>Mais</button></div>
    <PortalFooter/>
   </main>
  </div>
  {modal&&<div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-[#251b22]/65 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setModal("")}}><div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">{modal==="agendar"?"Novo agendamento":modal==="editar-perfil"?"Editar meus dados":"Prévia do Portal"}</h2><button onClick={()=>setModal("")} aria-label="Fechar"><X size={22}/></button></div>{modal==="editar-perfil"?<form className="space-y-4" onSubmit={e=>{e.preventDefault();if(!perfilEdicao.nome.trim()||!perfilEdicao.email.trim()||!perfilEdicao.telefone.trim())return;setPerfilDados({...perfilEdicao,nome:perfilEdicao.nome.trim(),email:perfilEdicao.email.trim(),telefone:perfilEdicao.telefone.trim()});setModal("");}}>
  {([["Nome","nome","text"],["E-mail","email","email"],["Telefone","telefone","tel"]] as const).map(([rotulo,campo,tipo])=><label key={campo} className="block text-sm font-semibold">{rotulo}<input type={tipo} required value={perfilEdicao[campo]} onChange={e=>setPerfilEdicao(p=>({...p,[campo]:e.target.value}))} className="mt-1 w-full rounded-xl border border-[#e9dfdc] p-3"/></label>)}
  <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold"><input type="checkbox" checked={perfilEdicao.notificacoes} onChange={e=>setPerfilEdicao(p=>({...p,notificacoes:e.target.checked}))}/>Receber notificações</label>
  <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-[#faf7f4] p-3"><p className="text-xs text-[#887b80]">CPF · não editável</p><strong>***.***.***-**</strong></div><div className="rounded-xl bg-[#faf7f4] p-3"><p className="text-xs text-[#887b80]">Clínica · não editável</p><strong>Clínica Bem-Estar Pet</strong></div></div>
  <p className="text-xs text-[#887b80]">Os dados alterados nesta prévia não são enviados à clínica.</p><button type="submit" className={botao+" w-full"}><Check size={16}/>Salvar alterações</button>
 </form>:modal==="agendar"?<form onSubmit={e=>{e.preventDefault();const d=new Date(data+"T12:00:00");if(!horariosLivres.includes(hora))return;setAgendados([...agendados,{data:d.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}).toUpperCase(),dataISO:data,hora,pet:petAgendar,tipo:servico,profissional:agendaSelecionada?.profissional||"Profissional não informado",status:pagamentoObrigatorio?"Pagamento pendente (prévia)":"Solicitado (prévia)"}]);setModal("");navegar("agenda")}} className="space-y-4"><p className="text-sm text-[#887b80]">Apenas serviços e horários liberados pela clínica aparecem aqui. Nesta prévia não são feitas reservas ou cobranças reais.</p><label className="block text-sm font-semibold">Pet<select className="mt-1 w-full rounded-xl border p-3" value={petAgendar} onChange={e=>setPetAgendar(e.target.value)}>{pets.map(p=><option key={p.id}>{p.nome}</option>)}</select></label><label className="block text-sm font-semibold">Serviço<select className="mt-1 w-full rounded-xl border p-3" value={servico} onChange={e=>{const a=servicosDoDia.find(a=>a.servico===e.target.value);setServico(e.target.value);setHora(a?.horarios.find(h=>!agendados.some(x=>x.dataISO===data&&x.hora===h))||"")}}>{servicosDoDia.map(a=><option key={a.servico}>{a.servico}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#faf7f4] p-3 text-sm"><span className="block text-xs text-[#887b80]">Profissional responsável</span><strong>{agendaSelecionada?.profissional||"Selecione um serviço"}</strong></div><label className="block text-sm font-semibold">Data<input type="date" readOnly className="mt-1 w-full rounded-xl border bg-[#faf7f4] p-3" value={data}/></label><label className="block text-sm font-semibold">Horário<select className="mt-1 w-full rounded-xl border p-3" value={hora} onChange={e=>setHora(e.target.value)}>{horariosLivres.map(h=><option key={h}>{h}</option>)}</select></label></div>{pagamentoObrigatorio?<div className="rounded-xl border border-[#e7cdac] bg-[#fff8ec] p-3 text-sm text-[#72511e]"><b>Pagamento antecipado exigido pela clínica.</b><p className="mt-1">No portal real, ao iniciar o pagamento, este horário fica reservado por <b>15 minutos</b>. Se o prazo terminar sem confirmação, ele será liberado para outro tutor.</p><p className="mt-2 text-xs">Nesta demonstração não existe bloqueio real de horário nem cobrança.</p></div>:<div className="rounded-xl bg-[#f3f7f4] p-3 text-sm text-[#3c654a]">Este serviço não exige pagamento antecipado. A clínica define se a solicitação precisa de aprovação.</div>}
<button disabled={!agendaSelecionada||!horariosLivres.includes(hora)} className={botao+" w-full disabled:opacity-40"} type="submit"><Check size={16}/>{pagamentoObrigatorio?"Continuar para pagamento":"Solicitar agendamento"}</button></form>:<><p className="mb-6 text-sm leading-relaxed text-[#6b5d62]">{modal}</p><button className={botao+" w-full"} onClick={()=>setModal("")}>Entendi</button></>}</div></div>}
 </div>;
}

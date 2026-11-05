import { ChevronRight, Hotel, MessageCircle, Scissors, Wallet } from "lucide-react";

type ServicoExtra = { titulo:string; descricao:string; id:string; Icon:typeof Scissors };

const servicos:ServicoExtra[]=[
  {titulo:"Banho e tosa",descricao:"Cuidados de higiene",id:"banho",Icon:Scissors},
  {titulo:"Hotelzinho",descricao:"Reservas e estadias",id:"hotel",Icon:Hotel},
  {titulo:"Financeiro",descricao:"Comandas e pagamentos",id:"financeiro",Icon:Wallet},
  {titulo:"Fale com a Clínica",descricao:"Canais de atendimento",id:"contato",Icon:MessageCircle},
];

export function PortalTutorOtherServices({onNavigate}:{onNavigate:(id:string)=>void}){
 return <section className="mb-5 rounded-2xl bg-white p-5 sm:p-6">
  <div className="mb-4"><h2 className="text-base font-extrabold text-[#312530]">Outros serviços</h2><p className="mt-1 text-sm text-[#6e6268]">Acessos que não estão na navegação principal.</p></div>
  <div className="grid gap-1">
   {servicos.map(({titulo,descricao,id,Icon})=><button key={id} type="button" onClick={()=>onNavigate(id)} className="flex min-h-14 items-center gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-[#faf5f2]">
    <Icon size={23} strokeWidth={1.8} className="shrink-0 text-[#702a43]"/>
    <span className="min-w-0 flex-1"><b className="block text-base font-bold text-[#312530]">{titulo}</b><span className="text-sm text-[#786b73]">{descricao}</span></span>
    <ChevronRight size={20} strokeWidth={1.8} className="shrink-0 text-[#9b7a86]"/>
   </button>)}
  </div>
 </section>;
}

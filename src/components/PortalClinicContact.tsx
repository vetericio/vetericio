import { ArrowUpRight, Clock3, Globe2, Instagram, Linkedin, Mail, MapPin, MessageCircle, Phone, Youtube } from "lucide-react";
import type { ReactNode } from "react";

export type CanaisClinica = {
  whatsapp?:string; instagram?:string; facebook?:string; x?:string; tiktok?:string; youtube?:string;
  site?:string; email?:string; telefone?:string; endereco?:string; horario?:string; linkedin?:string;
};

const limpar=(v?:string)=>String(v||"").trim();
const linkHttps=(v?:string)=>{try{const url=new URL(limpar(v));return url.protocol==="https:"?url.href:null;}catch{return null;}};
const digitos=(v?:string)=>limpar(v).replace(/\D/g,"");
const whatsappUrl=(v?:string)=>{const n=digitos(v);return n.length>=10&&n.length<=15?`https://wa.me/${n.length<=11?"55":""}${n}`:null;};
const telefoneUrl=(v?:string)=>{const n=digitos(v);return n.length>=10&&n.length<=15?`tel:+${n.length<=11?"55":""}${n}`:null;};
const emailUrl=(v?:string)=>{const s=limpar(v);return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?`mailto:${s}`:null;};
const mapaUrl=(v?:string)=>limpar(v)?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(limpar(v))}`:null;
const perfilRede=(url:string)=>{try{const u=new URL(url);const trecho=decodeURIComponent(u.pathname).split("/").filter(Boolean).at(-1)||u.hostname.replace(/^www\./,"");return trecho.startsWith("@")?trecho:`@${trecho}`;}catch{return "Página oficial";}};

type BotaoCanalProps={url:string;rotulo:string;principal?:boolean;demonstracao:boolean};
function BotaoCanal({url,rotulo,principal=false,demonstracao}:BotaoCanalProps){
 const classe=principal
  ?"inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#702a43] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#572038] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#702a43]"
  :"inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#702a43]/20 bg-[#702a43]/5 px-4 py-2.5 text-sm font-bold text-[#702a43] transition hover:bg-[#702a43]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#702a43]";
 const inner=<>{rotulo}<ArrowUpRight size={16} aria-hidden/></>;
 return demonstracao
  ?<span className={classe+" cursor-default"} aria-label={rotulo+" (demonstração)"}>{inner}</span>
  :<a className={classe} href={url} target={url.startsWith("https:")?"_blank":undefined} rel={url.startsWith("https:")?"noopener noreferrer":undefined}>{inner}</a>;
}

type CardCanalProps={icone:ReactNode;nome:string;detalhe:string;url:string;acao:string;demonstracao:boolean};
function CardCanal({icone,nome,detalhe,url,acao,demonstracao}:CardCanalProps){
 return <div className="flex min-w-0 flex-col justify-between gap-5 rounded-2xl border border-[#e9dce0] bg-white p-5 shadow-sm transition hover:border-[#d6b8c3] sm:p-6">
  <div className="flex min-w-0 items-start gap-4">
   <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f6eaf0] text-[#702a43]">{icone}</div>
   <div className="min-w-0 pt-0.5"><h3 className="text-lg font-extrabold text-[#312530]">{nome}</h3><p className="mt-1 break-words text-sm text-[#7b6b73]">{detalhe}</p></div>
  </div>
  <BotaoCanal url={url} rotulo={acao} demonstracao={demonstracao}/>
 </div>;
}

export function PortalClinicContact({canais,demonstracao=false}:{canais:CanaisClinica;demonstracao?:boolean}){
 const whats=whatsappUrl(canais.whatsapp);
 const sociais=[
  {chave:"instagram",nome:"Instagram",icone:<Instagram size={27}/>,acao:"Abrir Instagram"},
  {chave:"facebook",nome:"Facebook",icone:<Globe2 size={27}/>,acao:"Abrir Facebook"},
  {chave:"x",nome:"X",icone:<span className="text-2xl font-black">𝕏</span>,acao:"Abrir X"},
  {chave:"tiktok",nome:"TikTok",icone:<span className="text-2xl font-black">♪</span>,acao:"Abrir TikTok"},
  {chave:"youtube",nome:"YouTube",icone:<Youtube size={27}/>,acao:"Abrir YouTube"},
  {chave:"linkedin",nome:"LinkedIn",icone:<Linkedin size={27}/>,acao:"Abrir LinkedIn"},
  {chave:"site",nome:"Site oficial",icone:<Globe2 size={27}/>,acao:"Acessar site"}
 ] as const;
 const redes=sociais.flatMap(s=>{const url=linkHttps(canais[s.chave]);return url?[{...s,url}]:[];});
 const email=emailUrl(canais.email), telefone=telefoneUrl(canais.telefone), mapa=mapaUrl(canais.endereco);
 const possuiCanal=Boolean(whats||redes.length||email||telefone||mapa||limpar(canais.horario));
 return <section className="space-y-7 rounded-3xl border border-[#eadfe2] bg-white p-5 sm:p-8">
  <header><h2 className="text-2xl font-black tracking-tight text-[#312530] sm:text-3xl">Fale com a Clínica</h2><p className="mt-2 text-sm text-[#786b73] sm:text-base">Escolha como deseja entrar em contato. Estamos aqui para ajudar você e seu pet.</p></header>
  {!possuiCanal&&<p className="rounded-xl bg-[#faf7f8] p-5 text-sm text-[#786b73]">A clínica ainda não disponibilizou canais de contato neste portal.</p>}
  {whats&&<section aria-label="Contato principal" className="rounded-3xl border border-[#e8cdd8] bg-[#fbf5f7] p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div className="flex min-w-0 items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#702a43] text-white"><MessageCircle size={30}/></div><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-[#8b5b6d]">Contato principal</p><h3 className="mt-1 text-xl font-black text-[#312530] sm:text-2xl">WhatsApp da clínica</h3><p className="mt-1 text-sm text-[#786b73]">{limpar(canais.whatsapp)}</p></div></div>
      <BotaoCanal url={whats} rotulo="Chamar no WhatsApp" principal demonstracao={demonstracao}/>
    </div>
   </section>}
  {redes.length>0&&<section><h3 className="mb-4 text-base font-extrabold text-[#312530]">Redes sociais e site</h3><div className="grid gap-4 sm:grid-cols-2">{redes.map(s=><CardCanal key={s.chave} icone={s.icone} nome={s.nome} detalhe={s.chave==="site"?new URL(s.url).hostname:perfilRede(s.url)} url={s.url} acao={s.acao} demonstracao={demonstracao}/>)}</div></section>}
  {(email||telefone||mapa||limpar(canais.horario))&&<section><h3 className="mb-4 text-base font-extrabold text-[#312530]">Outros contatos</h3><div className="grid gap-4 sm:grid-cols-2">
    {telefone&&<CardCanal icone={<Phone size={27}/>} nome="Telefone" detalhe={limpar(canais.telefone)} url={telefone} acao="Ligar agora" demonstracao={demonstracao}/>}
    {email&&<CardCanal icone={<Mail size={27}/>} nome="E-mail" detalhe={limpar(canais.email)} url={email} acao="Enviar e-mail" demonstracao={demonstracao}/>}
    {mapa&&<CardCanal icone={<MapPin size={27}/>} nome="Endereço" detalhe={limpar(canais.endereco)} url={mapa} acao="Abrir no mapa" demonstracao={demonstracao}/>}
    {limpar(canais.horario)&&<div className="flex min-w-0 items-start gap-4 rounded-2xl border border-[#e9dce0] bg-[#faf7f8] p-5 sm:p-6"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f6eaf0] text-[#702a43]"><Clock3 size={27}/></div><div className="min-w-0"><h4 className="text-lg font-extrabold text-[#312530]">Horário de atendimento</h4><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#786b73]">{limpar(canais.horario)}</p></div></div>}
  </div></section>}
  {demonstracao&&<p className="border-t pt-4 text-xs text-[#786b73]">Prévia ilustrativa: os botões não abrem contatos reais nesta demonstração.</p>}
 </section>;
}

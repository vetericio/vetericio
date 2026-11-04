import { ExternalLink, Mail, MapPin, MessageCircle, Phone, Clock3, Globe2, Instagram, Youtube, Linkedin } from "lucide-react";
import type { ReactNode } from "react";

export type CanaisClinica = {
 whatsapp?:string;instagram?:string;facebook?:string;x?:string;tiktok?:string;youtube?:string;
 site?:string;email?:string;telefone?:string;endereco?:string;horario?:string;linkedin?:string;
};
const semEspacos=(v?:string)=>String(v||"").trim();
const linkSeguro=(v?:string)=>{try{const u=new URL(semEspacos(v));return u.protocol==="https:"?u.href:null}catch{return null}};
const somenteDigitos=(v?:string)=>semEspacos(v).replace(/\D/g,"");
const contatoWhatsapp=(v?:string)=>{const n=somenteDigitos(v);return n.length>=10&&n.length<=15?`https://wa.me/${n.length<=11?"55":""}${n}`:null};
const contatoTelefone=(v?:string)=>{const n=somenteDigitos(v);return n.length>=10&&n.length<=15?`tel:+${n.length<=11?"55":""}${n}`:null};
const contatoEmail=(v?:string)=>{const s=semEspacos(v);return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?`mailto:${s}`:null};

export function PortalClinicContact({canais,demonstracao=false}:{canais:CanaisClinica;demonstracao?:boolean}){
 const sociais=[
  {k:"instagram",nome:"Instagram",Icon:Instagram},
  {k:"facebook",nome:"Facebook",Icon:Globe2},
  {k:"x",nome:"X",Icon:Globe2},
  {k:"tiktok",nome:"TikTok",Icon:Globe2},
  {k:"youtube",nome:"YouTube",Icon:Youtube},
  {k:"linkedin",nome:"LinkedIn",Icon:Linkedin},
  {k:"site",nome:"Site",Icon:Globe2}
 ] as const;
 const whats=contatoWhatsapp(canais.whatsapp);
 const outros=[{nome:"E-mail",valor:canais.email,url:contatoEmail(canais.email),Icon:Mail},
 {nome:"Telefone",valor:canais.telefone,url:contatoTelefone(canais.telefone),Icon:Phone}];
 const alguma=Boolean(whats||sociais.some(s=>linkSeguro(canais[s.k]))||outros.some(c=>c.url)||semEspacos(canais.endereco)||semEspacos(canais.horario));
 const acao=(url:string,conteudo:ReactNode,principal=false)=>
  demonstracao?<div className={principal?"rounded-xl bg-[#702a43] px-4 py-3 font-bold text-white":"rounded-xl border bg-white px-4 py-3 text-sm font-semibold"}>{conteudo}</div>:
  <a href={url} target={url.startsWith("https:")?"_blank":undefined} rel={url.startsWith("https:")?"noopener noreferrer":undefined} className={principal?"inline-flex min-h-12 w-full items-center justify-between rounded-xl bg-[#702a43] px-4 py-3 font-bold text-white hover:opacity-90":"inline-flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"}>{conteudo}</a>;
 return <section className="space-y-5 rounded-2xl border bg-white p-5 sm:p-6">
  <div><h2 className="text-xl font-extrabold">Fale com a Clínica</h2><p className="mt-1 text-sm text-slate-500">Escolha o canal de atendimento que preferir.</p></div>
  {!alguma&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">A clínica ainda não disponibilizou canais de contato neste portal.</p>}
  {whats&&<div><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Contato principal</h3>{acao(whats,<span className="flex items-center gap-2"><MessageCircle size={19}/>Chamar no WhatsApp <span className="text-xs font-normal opacity-80">{semEspacos(canais.whatsapp)}</span></span>,true)}</div>}
  {sociais.some(s=>linkSeguro(canais[s.k]))&&<div><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Redes sociais e site</h3><div className="grid gap-2 sm:grid-cols-2">{sociais.map(s=>{const url=linkSeguro(canais[s.k]);return url?<div key={s.k}>{acao(url,<><span className="flex items-center gap-2"><s.Icon size={18}/>{s.nome}</span><ExternalLink size={15}/></>)}</div>:null})}</div></div>}
  {outros.some(o=>o.url)&&<div><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Outros contatos</h3><div className="grid gap-2 sm:grid-cols-2">{outros.map(o=>o.url?<div key={o.nome}>{acao(o.url,<><span className="flex items-center gap-2"><o.Icon size={18}/><span className="min-w-0 break-words">{o.valor}</span></span><ExternalLink size={15}/></>)}</div>:null)}</div></div>}
  {(semEspacos(canais.endereco)||semEspacos(canais.horario))&&<div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">{semEspacos(canais.endereco)&&<p className="flex items-start gap-2"><MapPin size={17} className="shrink-0"/>{canais.endereco}</p>}{semEspacos(canais.horario)&&<p className="flex items-start gap-2"><Clock3 size={17} className="shrink-0"/>{canais.horario}</p>}</div>}
  {demonstracao&&<p className="text-xs text-slate-500">Contatos ilustrativos da demonstração. Nenhuma mensagem é enviada daqui.</p>}
 </section>;
}

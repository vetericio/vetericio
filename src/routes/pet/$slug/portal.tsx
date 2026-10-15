import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, FileText, HeartPulse, LockKeyhole, PawPrint, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pet/$slug/portal")({ component: PortalTutorClinica });
type ClinicaPublica={nome:string;slug:string;logo_url:string|null};
function PortalTutorClinica(){
 const {slug}=Route.useParams();
 const [clinica,setClinica]=useState<ClinicaPublica|null>(null);
 const [carregando,setCarregando]=useState(true);
 const [usuario,setUsuario]=useState("");
 const [senha,setSenha]=useState("");
 useEffect(()=>{let ativo=true;setCarregando(true);setClinica(null);(async()=>{
  const {data,error}=await (supabase as any).rpc("oricse_portal_tutor_clinica",{p_slug:slug});
  if(!ativo)return;
  if(!error&&Array.isArray(data)&&data.length)setClinica(data[0]);
  setCarregando(false);
 })();return()=>{ativo=false}},[slug]);
 if(carregando)return <main className="flex min-h-screen items-center justify-center">Carregando portal…</main>;
 if(!clinica)return <main className="mx-auto max-w-lg p-10 text-center"><h1 className="text-2xl font-bold">Portal indisponível</h1><p className="mt-3 text-muted-foreground">Clínica não encontrada ou portal indisponível.</p><Link to="/" className="mt-4 inline-block underline">Voltar ao ORICSE</Link></main>;
 const itens=[{nome:"Meus animais",desc:"Dados e acompanhamento",Icon:PawPrint},{nome:"Agendamentos",desc:"Horários disponibilizados pela clínica",Icon:CalendarDays},{nome:"Vacinas e cuidados",desc:"Orientações e lembretes",Icon:HeartPulse},{nome:"Exames e documentos",desc:"Arquivos compartilhados",Icon:FileText}];
 return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-5">{clinica.logo_url?<img src={clinica.logo_url} alt="" className="h-14 w-14 rounded-xl object-contain"/>:<div className="rounded-xl bg-slate-100 p-3"><PawPrint/></div>}<div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Portal do tutor · ORICSE</p><h1 className="text-xl font-bold">{clinica.nome}</h1></div></div></header><div className="mx-auto grid max-w-5xl gap-7 px-5 py-10 lg:grid-cols-[1.25fr_1fr]"><section className="space-y-5"><div><h2 className="text-3xl font-bold">Tudo sobre seu pet, em um só lugar.</h2><p className="mt-2 text-slate-600">Acompanhe seus animais, consulte documentos e agende serviços quando sua clínica disponibilizar.</p></div><div className="grid gap-3 sm:grid-cols-2">{itens.map(({nome,desc,Icon})=><div key={nome} className="rounded-2xl border bg-white p-5"><Icon className="mb-3 text-slate-600"/><h3 className="font-bold">{nome}</h3><p className="mt-1 text-sm text-slate-500">{desc}</p><span className="mt-3 inline-block text-xs text-slate-400">Disponível após ativação</span></div>)}</div></section><section className="self-start rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-2"><UserRound/><h2 className="text-xl font-bold">Acesso do tutor</h2></div><p className="mt-2 text-sm text-slate-500">Seu usuário será fornecido pela clínica. O acesso seguro está em preparação.</p><form className="mt-5 space-y-4" onSubmit={e=>e.preventDefault()}><label className="block text-sm font-medium">Usuário<input value={usuario} onChange={e=>setUsuario(e.target.value)} autoComplete="username" placeholder="@tut.seunome" className="mt-1 w-full rounded-xl border px-3 py-3"/></label><label className="block text-sm font-medium">Senha<input type="password" value={senha} onChange={e=>setSenha(e.target.value)} autoComplete="current-password" placeholder="Sua senha" className="mt-1 w-full rounded-xl border px-3 py-3"/></label><button disabled className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-300 px-4 py-3 font-semibold text-slate-600"><LockKeyhole size={17}/>Acesso em preparação</button></form><p className="mt-4 text-xs text-slate-500">Para proteger seus dados, o login e os agendamentos permanecem desativados até a conclusão da autenticação e das permissões.</p></section></div></main>;
}

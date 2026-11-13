import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Search, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePermissoes } from "@/hooks/usePermissoes";
import { supabaseBanco } from "@/integrations/supabase/client";

export const Route = createFileRoute("/consulta-avulsa")({ component: ConsultaAvulsa });
type Animal = { id: string; nome: string; especie: string | null; tutor_id: string | null };
type Tutor = { id: string; nome: string };
function ConsultaAvulsa() {
 const {clinicaId, carregando: verificando, adminGlobal, pode} = usePermissoes();
 const autorizado = adminGlobal || pode("consultorio.atendimentos");
 const [animais,setAnimais]=useState<Animal[]>([]);
 const [tutores,setTutores]=useState<Tutor[]>([]);
 const [busca,setBusca]=useState("");
 const [carregando,setCarregando]=useState(false);
 useEffect(()=>{
   if(!clinicaId||!autorizado)return;
   let ativo=true;setCarregando(true);
   Promise.all([
    (supabaseBanco as any).from("oricse_animais").select("id,nome,especie,tutor_id").eq("clinica_id",clinicaId).order("nome").limit(1000),
    (supabaseBanco as any).from("tutores").select("id,nome").eq("clinica_id",clinicaId).order("nome").limit(1000),
   ]).then(([a,t])=>{if(!ativo)return;if(a.error||t.error)throw Error(a.error?.message||t.error?.message);setAnimais(a.data||[]);setTutores(t.data||[])})
    .catch(e=>{if(ativo)toast.error(e instanceof Error?e.message:"Não foi possível carregar os pacientes.");})
    .finally(()=>{if(ativo)setCarregando(false)});
   return ()=>{ativo=false};
 },[clinicaId,autorizado]);
 const nomes=useMemo(()=>new Map(tutores.map(x=>[x.id,x.nome])),[tutores]);
 const encontrados=useMemo(()=>animais.filter(a=>[a.nome,a.especie||"",nomes.get(a.tutor_id||"")||""].join(" ").toLowerCase().includes(busca.toLowerCase())).slice(0,100),[animais,nomes,busca]);
 if(verificando)return <main className="p-8">Verificando acesso…</main>;
 if(!autorizado)return <main className="p-8" role="alert">Sem permissão para atendimentos.</main>;
 return <main className="mx-auto max-w-4xl space-y-5 p-4 pb-24 sm:p-6">
  <Link to="/consultorio" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={17}/> Consultório</Link>
  <header><h1 className="text-3xl font-bold">Consulta avulsa</h1><p className="mt-2 text-muted-foreground">Inicie uma consulta diretamente, sem incluir o animal na fila da Recepção.</p></header>
  <label className="flex items-center gap-2 rounded-xl border bg-card px-4"><Search size={18} className="text-muted-foreground"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar animal, espécie ou tutor" className="min-h-12 w-full bg-transparent outline-none"/></label>
  {carregando?<p>Carregando pacientes…</p>:<div className="grid gap-3 sm:grid-cols-2">{encontrados.map(animal=><article key={animal.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4"><div className="min-w-0"><h2 className="truncate font-semibold">{animal.nome}</h2><p className="text-sm text-muted-foreground">{animal.especie||"Espécie não informada"} · {nomes.get(animal.tutor_id||"")||"Tutor não informado"}</p></div><Link to="/registro-clinico" search={{animalId:animal.id} as never} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"><Stethoscope size={17}/> Atender</Link></article>)}</div>}
  {!carregando&&!encontrados.length&&<p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">Nenhum animal encontrado. Cadastre o animal antes de abrir o prontuário.</p>}
 </main>;
}

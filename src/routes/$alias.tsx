import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$alias")({ component: AliasPagina });

function AliasPagina() {
  const { alias } = Route.useParams();
  const navigate = useNavigate();
  const [erro,setErro] = useState("");
  useEffect(()=>{
    let ativo=true;
    (async()=>{
      const {data,error}=await (supabase as any).from("oricse_rotas_personalizadas")
        .select("rota_original").eq("rota_publica","/"+alias).maybeSingle();
      if(!ativo)return;
      if(error){setErro("Não foi possível consultar este endereço.");return;}
      const permitidas=["/recepcao","/estoque","/financeiro","/comandas","/minha-atividade"];
      if(data?.rota_original && permitidas.includes(data.rota_original)){
        void navigate({to:data.rota_original as any,replace:true});
      } else setErro("Página não encontrada.");
    })();
    return()=>{ativo=false};
  },[alias,navigate]);
  return <main className="flex min-h-screen items-center justify-center p-6 text-center">
    <div><h1 className="text-xl font-bold">{erro||"Abrindo página..."}</h1>
      {erro&&<a href="/" className="mt-3 inline-block underline">Voltar ao início</a>}</div>
  </main>;
}

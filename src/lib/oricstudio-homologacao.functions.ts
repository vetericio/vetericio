import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {ORICSTUDIO_PLATAFORMA_ID} from "@/lib/oricstudio-plataforma";

// Diagnóstico exclusivo da Administração Geral: expõe presença de variáveis,
// nunca valores de chaves, tokens, credenciais ou dados pessoais dos clientes.
export const diagnosticarHomologacaoOricStudio=createServerFn({method:"POST"})
 .validator((input:unknown)=>z.object({accessToken:z.string().min(20)}).parse(input))
 .handler(async({data})=>{
   const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
   const {requireMetaEditor,metaConfig}=await import("@/lib/oricstudio-meta.server");
   await requireMetaEditor(supabaseAdmin,data.accessToken,ORICSTUDIO_PLATAFORMA_ID,false);
   let facebook=false,instagram=false;
   try{facebook=metaConfig().configured;}catch{}
   try{
     const {instagramDiretoConfig}=await import("@/lib/oricstudio-instagram.server");
     instagram=instagramDiretoConfig().configured;
   }catch{}
   const jobsSecret=process.env["ORICSTUDIO_CRON_SECRET"]||"";
   const mediaKey=process.env["ORICSTUDIO_MIDIA_SIGNING_KEY"]||"";
   const [clinicas,licencas,contas,envios]=await Promise.all([
     supabaseAdmin.from("clinicas").select("id",{head:true,count:"exact"})
       .eq("status","ativa").is("excluido_em",null),
     supabaseAdmin.from("oricstudio_licencas").select("clinica_id",{head:true,count:"exact"})
       .eq("status","ativo"),
     supabaseAdmin.from("oricstudio_meta_contas").select("id",{head:true,count:"exact"})
       .eq("status","ativa"),
     supabaseAdmin.from("oricstudio_envios").select("id",{head:true,count:"exact"}),
   ]);
   if(clinicas.error||licencas.error||contas.error||envios.error)
     throw new Error("Não foi possível consultar os indicadores OricStudio.");
   return {
     meta_instagram_configurada:instagram,
     meta_facebook_configurada:facebook,
     segredo_agendador_configurado:/^[A-Za-z0-9_-]{32,256}$/.test(jobsSecret),
     gateway_midia_configurado:mediaKey.length>=32,
     publicacao_liberada:process.env["ORICSTUDIO_PUBLICACAO_HOMOLOGADA"]==="true",
     coleta_liberada:process.env["ORICSTUDIO_COLETA_HOMOLOGADA"]==="true",
     clinicas_ativas:clinicas.count??0,licencas_ativas:licencas.count??0,
     contas_ig:contas.count??0,envios:envios.count??0,
   };
 });

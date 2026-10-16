import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { driveAccessToken, driveFetch } from "@/lib/drive-kv.server";

const schema=z.object({accessToken:z.string().min(20),documentoId:z.string().uuid(),tipo:z.enum(["documento","exame","receita"]).default("documento")});

async function driveQuery(accessToken:string,table:string,filters:any[]){
  const {executarDriveDbInterno}=await import("@/lib/drive-db.functions");
  return executarDriveDbInterno({accessToken,table,operation:"select",columns:"*",filters,order:[],single:"maybeSingle",head:false,count:null} as any) as Promise<any>;
}

async function localizarArquivo(token:string,registroId:string){
  const escaped=registroId.replace(/'/g,"\\'");
  const q=encodeURIComponent(`appProperties has { key='oricseRegistroId' and value='${escaped}' } and trashed=false`);
  const response=await driveFetch(token,`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,appProperties)&pageSize=5`);
  const json=await response.json() as {files?:Array<{id:string;name:string;mimeType?:string;size?:string;appProperties?:Record<string,string>}>};
  if(json.files?.[0])return json.files[0];
  // Compatibilidade com registros que guardavam o ID nativo do Drive.
  try{
    const direto=await driveFetch(token,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(registroId)}?fields=id,name,mimeType,size,appProperties`);
    return await direto.json() as {id:string;name:string;mimeType?:string;size?:string;appProperties?:Record<string,string>};
  }catch{return null;}
}

export const baixarDocumentoPortal=createServerFn({method:"POST"})
  .validator((input:unknown)=>schema.parse(input))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {data:authData,error:authError}=await supabaseAdmin.auth.getUser(data.accessToken);
    if(authError||!authData.user)throw new Error("Sessão inválida ou expirada.");
    const {data:portal}=await supabaseAdmin.from("oricse_portal_tutores").select("clinica_id,tutor_id,ativo").eq("auth_user_id",authData.user.id).eq("ativo",true).limit(1).maybeSingle();
    if(!portal)throw new Error("Você não tem acesso a este arquivo.");

    const tabela=data.tipo==="exame"?"oricse_portal_exames":data.tipo==="receita"?"oricse_portal_receitas":"oricse_portal_documentos";
    const resposta=await driveQuery(data.accessToken,tabela,[{kind:"eq",column:"id",value:data.documentoId},{kind:"eq",column:"visivel_tutor",value:true}]);
    if(resposta.error)throw new Error(resposta.error.message);
    const registro=resposta.data;
    if(!registro?.drive_arquivo_id||String(registro.clinica_id)!==String(portal.clinica_id))throw new Error("Este arquivo ainda não está disponível para download.");

    const token=await driveAccessToken("https://www.googleapis.com/auth/drive.readonly");
    const arquivo=await localizarArquivo(token,String(registro.drive_arquivo_id));
    if(!arquivo)throw new Error("Arquivo não encontrado no Google Drive.");
    if(arquivo.appProperties?.clinicaId&&String(arquivo.appProperties.clinicaId)!==String(portal.clinica_id))throw new Error("Você não tem acesso a este arquivo.");
    if(Number(arquivo.size||0)>20_000_000)throw new Error("Este arquivo é grande demais para abrir pelo portal.");

    const response=await driveFetch(token,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(arquivo.id)}?alt=media`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.byteLength>20_000_000)throw new Error("Este arquivo é grande demais para abrir pelo portal.");
    return{nome:arquivo.name||registro.titulo,mimeType:arquivo.mimeType||"application/octet-stream",base64:bytes.toString("base64")};
  });

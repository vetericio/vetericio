import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { driveAccessToken, driveFetch } from "@/lib/drive-kv.server";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";
import { PORTAL_PDF_MAX_BYTES } from "@/lib/drive-storage";

const schema=z.object({accessToken:z.string().min(20),documentoId:z.string().uuid(),clinicaEquipeId:z.string().uuid().optional(),tipo:z.enum(["documento","exame","receita"]).default("documento")});

async function driveQuery(accessToken:string,table:string,filters:any[]){
  const {executarDriveDbInterno}=await import("@/lib/drive-db.functions");
  return executarDriveDbInterno({accessToken,table,operation:"select",columns:"*",filters,order:[],single:"maybeSingle",head:false,count:null} as any) as Promise<any>;
}

async function consultarArquivo(token: string, driveId: string) {
  const resposta = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}?fields=id,name,mimeType,size,appProperties`);
  return resposta.json() as Promise<{id:string;name:string;mimeType?:string;size?:string;appProperties?:Record<string,string>}>;
}

async function localizarArquivo(token:string,registroId:string){
  const escaped=registroId.replace(/'/g,"\\'");
  const q=encodeURIComponent(`appProperties has { key='oricseRegistroId' and value='${escaped}' } and trashed=false`);
  const response=await driveFetch(token,`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,appProperties)&pageSize=5`);
  const json=await response.json() as {files?:Array<{id:string;name:string;mimeType?:string;size?:string;appProperties?:Record<string,string>}>};
  if(json.files?.[0])return json.files[0];
  // Compatibilidade com registros que guardavam o ID nativo do Drive.
  try{
    return await consultarArquivo(token, registroId);
  }catch{return null;}
}

export const baixarDocumentoPortal=createServerFn({method:"POST"})
  .validator((input:unknown)=>schema.parse(input))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {data:authData,error:authError}=await supabaseAdmin.auth.getUser(data.accessToken);
    if(authError||!authData.user)throw new Error("Sessão inválida ou expirada.");

    const tabela=data.tipo==="exame"?"oricse_portal_exames":data.tipo==="receita"?"oricse_portal_receitas":"oricse_portal_documentos";
    // Documentos clínicos novos têm registro canônico no PostgreSQL;
    // preservar a consulta legada do Drive para registros anteriores.
    const {data:canonico,error:erroCanonico}=await supabaseAdmin.from(tabela as "oricse_portal_documentos")
      .select("id,clinica_id,animal_id,drive_arquivo_id,visivel_tutor")
      .eq("id",data.documentoId).maybeSingle();
    if(erroCanonico)throw new Error("Não foi possível verificar a autorização do documento.");
    if(canonico && !data.clinicaEquipeId && canonico.visivel_tutor !== true) throw new Error("Documento não liberado ao tutor.");
    let registro: any=canonico;
    if(!registro && !data.clinicaEquipeId){
      const resposta=await driveQuery(data.accessToken,tabela,[{kind:"eq",column:"id",value:data.documentoId},{kind:"eq",column:"visivel_tutor",value:true}]);
      if(resposta.error)throw new Error(resposta.error.message);
      registro=resposta.data;
    }
    if(!registro?.drive_arquivo_id || !registro.clinica_id)throw new Error("Este arquivo ainda não está disponível para download.");
    const clinicaId: string = registro.clinica_id;
    if (data.clinicaEquipeId) {
      if (clinicaId!==data.clinicaEquipeId) throw new Error("Arquivo indisponível nesta clínica.");
      await exigirPermissaoClinica(supabaseAdmin,authData.user.id,clinicaId,["consultorio.atendimentos"],data.accessToken);
    } else {
      const {data:portal,error:erroPortal}=await supabaseAdmin.from("oricse_portal_tutores")
        .select("tutor_id").eq("auth_user_id",authData.user.id).eq("clinica_id",clinicaId)
        .eq("ativo",true).maybeSingle();
      if(erroPortal||!portal)throw new Error("Você não tem acesso a este arquivo.");
      const {data:animalPermitido,error:erroAnimal}=await supabaseAdmin.from("oricse_animais").select("id")
        .eq("id",registro.animal_id).eq("clinica_id",clinicaId).eq("tutor_id",portal.tutor_id).maybeSingle();
      if(erroAnimal||!animalPermitido)throw new Error("Você não tem acesso a este documento.");
    }

    const token=await driveAccessToken("https://www.googleapis.com/auth/drive.readonly");
    const { data: vinculo, error: erroVinculo } = canonico
      ? await supabaseAdmin.from("drive_arquivos").select("drive_file_id")
          .eq("id", registro.drive_arquivo_id).eq("clinica_id", clinicaId).maybeSingle()
      : { data: null, error: null };
    if (erroVinculo || (canonico && !vinculo)) throw new Error("Não foi possível verificar o vínculo do arquivo.");
    const arquivo = vinculo
      ? await consultarArquivo(token, vinculo.drive_file_id)
      : await localizarArquivo(token, String(registro.drive_arquivo_id));
    if(!arquivo)throw new Error("Arquivo não encontrado no Google Drive.");
    if(arquivo.appProperties?.clinicaId&&String(arquivo.appProperties.clinicaId)!==String(clinicaId))throw new Error("Você não tem acesso a este arquivo.");
    if(arquivo.appProperties?.entidadeTipo==="animal" &&
      String(arquivo.appProperties.entidadeId||"")!==String(registro.animal_id)){
      throw new Error("O arquivo não pertence ao animal autorizado.");
    }
    if(Number(arquivo.size||0)>PORTAL_PDF_MAX_BYTES)throw new Error("Este arquivo é grande demais para abrir pelo portal.");

    const response=await driveFetch(token,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(arquivo.id)}?alt=media`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.byteLength>PORTAL_PDF_MAX_BYTES)throw new Error("Este arquivo é grande demais para abrir pelo portal.");
    return{nome:arquivo.name||registro.titulo,mimeType:arquivo.mimeType||"application/octet-stream",base64:bytes.toString("base64")};
  });

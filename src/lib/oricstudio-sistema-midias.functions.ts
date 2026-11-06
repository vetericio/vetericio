// Biblioteca do OricStúdio da plataforma. Não recebe nem utiliza clinica_id.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const auth=z.object({accessToken:z.string().min(20)});
const arquivo=z.object({
  accessToken:z.string().min(20),
  nome:z.string().min(1).max(255),
  mimeType:z.enum(["image/png","image/jpeg","image/webp","video/mp4","video/quicktime"]),
  base64:z.string().min(1).max(18_000_000)
});
const registro=auth.extend({registroId:z.string().uuid()});
const BUCKET="oricstudio-sistema";
const EXT:Record<string,string>={
  "image/png":"png","image/jpeg":"jpg","image/webp":"webp",
  "video/mp4":"mp4","video/quicktime":"mov"
};

async function adminDb(accessToken:string){
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data:auth,error}=await supabaseAdmin.auth.getUser(accessToken);
  if(error||!auth.user?.id)throw new Error("Sessão expirada.");
  const {data:user,error:roleError}=await supabaseAdmin.from("app_users")
    .select("role").eq("user_id",auth.user.id).maybeSingle();
  if(roleError||user?.role!=="admin")
    throw new Error("Biblioteca do sistema restrita à Administração Geral.");
  return supabaseAdmin;
}

export const enviarMidiaSistemaOricStudio=createServerFn({method:"POST"})
  .validator((input:unknown)=>arquivo.parse(input))
  .handler(async({data})=>{
    const db=await adminDb(data.accessToken);
    const b64=data.base64.includes(",")?data.base64.split(",",2)[1]:data.base64;
    if(!b64||!/^[A-Za-z0-9+/]*={0,2}$/.test(b64))
      throw new Error("Arquivo inválido.");
    const bytes=Buffer.from(b64,"base64");
    if(bytes.length===0||bytes.length>12*1024*1024)
      throw new Error("Arquivo excede 12 MB.");
    const id=randomUUID();
    const caminho=`biblioteca/${id}.${EXT[data.mimeType]}`;
    const uploaded=await db.storage.from(BUCKET).upload(caminho,bytes,{
      contentType:data.mimeType,upsert:false
    });
    if(uploaded.error)throw new Error("Falha ao armazenar mídia privada do ORICSE.");
    const {error}=await db.from("oricstudio_sistema_midias").insert({
      id,nome:data.nome,tipo:data.mimeType.startsWith("video/")?"video":"imagem",
      caminho_privado:caminho
    });
    if(error){
      await db.storage.from(BUCKET).remove([caminho]);
      throw new Error("Falha ao registrar mídia do ORICSE.");
    }
    return {registroId:id};
  });

export const visualizarMidiaSistemaOricStudio=createServerFn({method:"POST"})
  .validator((input:unknown)=>registro.parse(input))
  .handler(async({data})=>{
    const db=await adminDb(data.accessToken);
    const {data:item,error}=await db.from("oricstudio_sistema_midias")
      .select("caminho_privado,tipo").eq("id",data.registroId).maybeSingle();
    if(error||!item||item.tipo!=="imagem")throw new Error("Imagem não encontrada.");
    const {data:link,error:linkError}=await db.storage.from(BUCKET)
      .createSignedUrl(item.caminho_privado,120);
    if(linkError||!link?.signedUrl)throw new Error("Imagem privada indisponível.");
    return {dataUrl:link.signedUrl};
  });

export const excluirMidiaSistemaOricStudio=createServerFn({method:"POST"})
  .validator((input:unknown)=>registro.parse(input))
  .handler(async({data})=>{
    const db=await adminDb(data.accessToken);
    const {data:item,error}=await db.from("oricstudio_sistema_midias")
      .select("caminho_privado").eq("id",data.registroId).maybeSingle();
    if(error||!item)throw new Error("Mídia não encontrada.");
    const removed=await db.storage.from(BUCKET).remove([item.caminho_privado]);
    if(removed.error)throw new Error("Não foi possível apagar o arquivo privado.");
    const {error:deleteError}=await db.from("oricstudio_sistema_midias").delete()
      .eq("id",data.registroId);
    if(deleteError)throw new Error("Arquivo apagado, mas o registro precisa ser conciliado.");
    return {ok:true};
  });

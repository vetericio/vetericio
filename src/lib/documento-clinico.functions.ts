import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { driveAccessToken, driveFetch } from "@/lib/drive-kv.server";

import { MODELOS_BASE_CLINICOS } from "@/lib/modelos-documentos";

const autenticacaoSchema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
});
const registrarSchema = autenticacaoSchema.extend({
  animalId: z.string().uuid(),
  tutorId: z.string().uuid(),
  registroId: z.string().uuid(),
  modeloId: z.string().uuid(),
  modeloVersao: z.number().int().nonnegative(),
  categoria: z.enum(["pedido","documento","termo"]),
  titulo: z.string().trim().min(3).max(140),
  assinaturaConferida: z.literal(true),
  arquivoSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const publicarSchema = autenticacaoSchema.extend({
  documentoId: z.string().uuid(),
  visivel: z.boolean(),
});
type SupabaseAdmin = Awaited<ReturnType<typeof obterAdmin>>;
async function obterAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function autorizarProfissional(admin: SupabaseAdmin, token: string, clinicaId: string) {
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) throw new Error("Sessão expirada. Faça login novamente.");
  const userId = auth.user.id;
  const { data: clinica, error: clinicaError } = await admin.from("clinicas")
    .select("id,status,excluido_em").eq("id",clinicaId).maybeSingle();
  if (clinicaError || !clinica || clinica.status !== "ativa" || clinica.excluido_em) {
    throw new Error("Clínica indisponível.");
  }
  const { data: vinculo, error: vinculoError } = await admin.from("clinica_usuarios")
    .select("papel,ativo").eq("clinica_id",clinicaId).eq("user_id",userId).eq("ativo",true).maybeSingle();
  if (vinculoError || !vinculo || !["rt","veterinario"].includes(String(vinculo.papel))) {
    throw new Error("Somente veterinários ou RTs com vínculo ativo podem registrar ou liberar documentos assinados.");
  }
  const { data: permissoes, error: permissoesError } = await (admin as any).rpc("oricse_permissoes_efetivas", {
    p_clinica_id:clinicaId, p_user_id:userId,
  });
  if (permissoesError || !Array.isArray(permissoes) ||
    !permissoes.some((p: any) => p.codigo === "consultorio.receituario" && p.permitido === true)) {
    throw new Error("Seu cargo ou plano não permite assinar e publicar documentos.");
  }
  return userId;
}
async function conferirAnimal(admin: SupabaseAdmin, clinicaId: string, animalId: string, tutorId: string) {
  const { data: animal, error } = await admin.from("oricse_animais")
    .select("id,tutor_id,clinica_id").eq("id",animalId).eq("clinica_id",clinicaId).eq("tutor_id",tutorId).maybeSingle();
  if (error || !animal) throw new Error("Animal e tutor não estão vinculados a esta clínica.");
}
async function conferirModelo(admin: SupabaseAdmin, clinicaId: string, modeloId: string, versao: number, categoria: string) {
  const base = MODELOS_BASE_CLINICOS.find(item => item.id === modeloId);
  if (base) {
    if (base.categoria !== categoria || versao !== 0) throw new Error("Modelo padrão inválido.");
    return;
  }
  const { data, error } = await admin.from("oricse_dados_modulos")
    .select("dados").eq("clinica_id",clinicaId).eq("chave","estado_sistema").maybeSingle();
  if (error) throw new Error("Não foi possível verificar a biblioteca de modelos.");
  const estado = data?.dados && typeof data.dados === "object" && !Array.isArray(data.dados)
    ? data.dados as Record<string, unknown> : {};
  let lista: unknown;
  try { lista = JSON.parse(String(estado["oricse-modelos-documentos-v1"] || "[]")); }
  catch { throw new Error("A biblioteca está inconsistente."); }
  const modelo = Array.isArray(lista) ? lista.find((m: any) => m?.id === modeloId) : null;
  if (!modelo || modelo.categoria !== categoria || Number(modelo.versao) !== versao) {
    throw new Error("O modelo foi alterado ou removido. Atualize o documento antes de emitir.");
  }
}
async function encontrarPdf(registroId: string) {
  const token = await driveAccessToken("https://www.googleapis.com/auth/drive.readonly");
  const q = encodeURIComponent("appProperties has { key='oricseRegistroId' and value='" + registroId + "' } and trashed=false");
  const r = await driveFetch(token,"https://www.googleapis.com/drive/v3/files?q="+q+
    "&fields=files(id,name,mimeType,size,parents,appProperties)&pageSize=5");
  const j = await r.json() as { files?: Array<{id:string;name:string;mimeType?:string;size?:string;parents?:string[];appProperties?:Record<string,string>}> };
  const arquivo = j.files?.find((f) => f.appProperties?.oricseRegistroId === registroId);
  if (!arquivo) throw new Error("O PDF não foi localizado no Google Drive.");
  if (arquivo.mimeType !== "application/pdf" || Number(arquivo.size||0) <= 0 ||
      Number(arquivo.size||0) > 10_000_000) {
    throw new Error("O arquivo enviado não é um PDF válido de até 10 MB.");
  }
  const response=await driveFetch(token,"https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(arquivo.id)+"?alt=media");
  const bytes=Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== Number(arquivo.size) || bytes.byteLength > 10_000_000 ||
      bytes.subarray(0,5).toString("ascii") !== "%PDF-") {
    throw new Error("O PDF do Drive não corresponde ao arquivo informado.");
  }
  const { createHash }=await import("node:crypto");
  const sha256=createHash("sha256").update(bytes).digest("hex");
  return {...arquivo,sha256};
}
function erroBanco(error: {message?:string}|null, contexto:string) {
  if (error) throw new Error(contexto+": "+error.message);
}
export const registrarDocumentoClinicoAssinado = createServerFn({method:"POST"})
  .validator((input:unknown) => registrarSchema.parse(input))
  .handler(async ({data}) => {
    const admin = await obterAdmin();
    const userId = await autorizarProfissional(admin,data.accessToken,data.clinicaId);
    await conferirAnimal(admin,data.clinicaId,data.animalId,data.tutorId);
    await conferirModelo(admin,data.clinicaId,data.modeloId,data.modeloVersao,data.categoria);
    const arquivo = await encontrarPdf(data.registroId);
    if (arquivo.sha256 !== data.arquivoSha256) throw new Error("O PDF recebido não corresponde ao arquivo conferido. Faça o envio novamente.");
    const props = arquivo.appProperties || {};
    if (props.clinicaId !== data.clinicaId || props.entidadeTipo !== "animal" ||
        props.entidadeId !== data.animalId || props.enviadoPor !== userId ||
        props.categoria !== "documentos" || props.visibilidade !== "interno") {
      throw new Error("O PDF não pertence a este atendimento ou ao profissional autenticado.");
    }
    const {data:antigo,error:erroAntigo} = await admin.from("drive_arquivos")
      .select("id,clinica_id,entidade_id").eq("id",data.registroId).maybeSingle();
    erroBanco(erroAntigo,"Não foi possível validar o arquivo");
    if (antigo && (antigo.clinica_id !== data.clinicaId || antigo.entidade_id !== data.animalId)) {
      throw new Error("Identificador do arquivo pertence a outro atendimento.");
    }
    if (!antigo) {
      const {error:erroArquivo} = await admin.from("drive_arquivos").insert({
        id:data.registroId, clinica_id:data.clinicaId, categoria:"documentos",
        nome:arquivo.name, mime_type:"application/pdf", tamanho_bytes:Number(arquivo.size||0),
        drive_file_id:arquivo.id, drive_folder_id:arquivo.parents?.[0]||null,
        visibilidade:"interno",entidade_tipo:"animal",entidade_id:data.animalId,
        enviado_por:userId,
        metadata:{
          origem:"modelo_clinico_assinado", modeloId:data.modeloId, modeloVersao:data.modeloVersao,
          categoria:data.categoria, tutorId:data.tutorId, assinatura:"conferida_manualmente_sem_validacao_criptografica",
          emitido_por:userId, emitido_em:new Date().toISOString(),
          integridade_sha256:arquivo.sha256,
          integridade_verificada_em:new Date().toISOString(),
          eventos:[{tipo:"registro",por:userId,em:new Date().toISOString()}],
        },
      });
      erroBanco(erroArquivo,"Não foi possível registrar o arquivo");
    }
    const {data:existente,error:erroExistente} = await admin.from("oricse_portal_documentos")
      .select("id,visivel_tutor").eq("clinica_id",data.clinicaId)
      .eq("drive_arquivo_id",data.registroId).maybeSingle();
    erroBanco(erroExistente,"Não foi possível consultar a emissão");
    if (existente) return {documentoId:existente.id, visivelTutor:existente.visivel_tutor, registrado:true};
    const {data:emitido,error:erroEmissao} = await admin.from("oricse_portal_documentos").insert({
      clinica_id:data.clinicaId, animal_id:data.animalId, drive_arquivo_id:data.registroId,
      titulo:data.titulo, tipo:data.categoria==="pedido"?"Pedido de exame":data.categoria==="termo"?"Termo":"Documento clínico",
      data_documento:new Date().toISOString().slice(0,10),
      observacoes:"Assinatura declarada e conferida pelo profissional. Autenticidade criptográfica não verificada.",
      visivel_tutor:false,
    }).select("id,visivel_tutor").single();
    if (erroEmissao || !emitido?.id) throw new Error("O PDF foi arquivado, mas o registro de emissão falhou: "+(erroEmissao?.message||"sem confirmação")+". Tente registrar o mesmo arquivo novamente.");
    return {documentoId:emitido.id,visivelTutor:false,registrado:true};
  });

export const alterarPublicacaoDocumentoClinico = createServerFn({method:"POST"})
  .validator((input:unknown) => publicarSchema.parse(input))
  .handler(async ({data}) => {
    const admin = await obterAdmin();
    const userId = await autorizarProfissional(admin,data.accessToken,data.clinicaId);
    const {data:doc,error} = await admin.from("oricse_portal_documentos")
      .select("id,clinica_id,animal_id,drive_arquivo_id,visivel_tutor")
      .eq("id",data.documentoId).eq("clinica_id",data.clinicaId).maybeSingle();
    if (error || !doc?.drive_arquivo_id) throw new Error("Documento não encontrado.");
    const {data:arquivo,error:erroArquivo} = await admin.from("drive_arquivos")
      .select("id,clinica_id,entidade_id,metadata").eq("id",doc.drive_arquivo_id).maybeSingle();
    if (erroArquivo || !arquivo || arquivo.clinica_id !== data.clinicaId ||
        arquivo.entidade_id !== doc.animal_id) throw new Error("Arquivo inválido para este animal.");
    const metadata = arquivo.metadata && typeof arquivo.metadata === "object" && !Array.isArray(arquivo.metadata)
      ? arquivo.metadata as Record<string,unknown> : {};
    if (metadata.origem !== "modelo_clinico_assinado" ||
        metadata.assinatura !== "conferida_manualmente_sem_validacao_criptografica") {
      throw new Error("Somente documentos assinados e registrados podem ser liberados por este fluxo.");
    }
    const atualizadoEm = new Date().toISOString();
    const {data:salvo,error:erroSalvar} = await admin.from("oricse_portal_documentos")
      .update({visivel_tutor:data.visivel,updated_at:atualizadoEm})
      .eq("id",data.documentoId).eq("clinica_id",data.clinicaId)
      .select("id,visivel_tutor").single();
    if (erroSalvar || !salvo) throw new Error("Falha ao confirmar a visibilidade no Portal do Tutor.");
    const eventos = Array.isArray(metadata.eventos) ? metadata.eventos.slice(-29) : [];
    const {error:erroAuditoria} = await admin.from("drive_arquivos").update({
      metadata:{...metadata,eventos:[...eventos,{tipo:data.visivel?"liberacao_portal":"ocultacao_portal",por:userId,em:atualizadoEm}]},
    }).eq("id",arquivo.id).eq("clinica_id",data.clinicaId);
    if (erroAuditoria) {
      // Não manter o documento publicado se a trilha de auditoria falhar.
      const {error:erroReversao}=await admin.from("oricse_portal_documentos")
        .update({visivel_tutor:doc.visivel_tutor,updated_at:new Date().toISOString()})
        .eq("id",doc.id).eq("clinica_id",data.clinicaId);
      if (erroReversao) throw new Error("A auditoria falhou e não foi possível reverter a visibilidade. Faça uma revisão imediata.");
      throw new Error("A auditoria falhou. A alteração de visibilidade foi revertida.");
    }
    return {documentoId:salvo.id,visivelTutor:salvo.visivel_tutor};
  });

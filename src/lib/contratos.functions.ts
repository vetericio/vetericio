import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { deleteDriveFile, driveAccessToken, driveFetch, writeDriveFile } from "@/lib/drive-kv.server";

const PDF_MAX_BYTES = 20_000_000;
async function carregarPdfDoDrive(
  contratoId: string,
  tipo: "em_branco" | "assinado",
  driveId: string | null,
) {
  if (!driveId || !/^[A-Za-z0-9_-]{10,}$/.test(driveId))
    throw new Error("PDF não está disponível no Google Drive.");
  const token = await driveAccessToken();
  const endpoint = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(driveId);
  const respMeta = await driveFetch(token, endpoint + "?fields=id,mimeType,size,trashed,appProperties");
  const metadata = await respMeta.json() as {
    mimeType?: string; size?: string; trashed?: boolean;
    appProperties?: Record<string, string>;
  };
  if (
    metadata.trashed
    || metadata.mimeType !== "application/pdf"
    || metadata.appProperties?.oricseContratoId !== contratoId
    || metadata.appProperties?.oricseContratoTipo !== tipo
    || Number(metadata.size) > PDF_MAX_BYTES
  ) throw new Error("PDF do contrato não corresponde ao registro solicitado.");
  const resp = await driveFetch(token, endpoint + "?alt=media");
  const bytes = Buffer.from(await resp.arrayBuffer());
  if (!bytes.length || bytes.length > PDF_MAX_BYTES)
    throw new Error("PDF ausente ou acima de 20 MB.");
  return bytes.toString("base64");
}

const accessSchema = z.object({ accessToken: z.string().min(20) });
const tokenSchema = z.object({ token: z.string().min(32).max(160) });
const camposSchema = z.record(z.string().max(1000));
const arquivoSchema = tokenSchema.extend({
  tipo: z.enum(["em_branco", "assinado"]),
  base64: z.string().min(1).max(28_000_000),
  mimeType: z.literal("application/pdf"),
});
const templatePdfSchema = z.string().max(4_000_000).optional().nullable();

async function carregarAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function hashToken(token: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(token).digest("hex");
}

async function gerarToken() {
  const { randomBytes } = await import("node:crypto");
  return randomBytes(32).toString("base64url");
}

async function exigirAdministrador(accessToken: string) {
  const admin = await carregarAdmin();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");
  const { data: perfil } = await admin
    .from("app_users")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (perfil?.role !== "admin")
    throw new Error("Apenas a administração da plataforma pode gerenciar contratos.");
  return { admin, userId: data.user.id };
}

function extrairCampos(conteudo: string) {
  const encontrados = new Set<string>();
  const regex = /{{\s*([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ0-9_-]{1,80})\s*}}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(conteudo))) encontrados.add(match[1]);
  return [...encontrados];
}

export const listarModelosContratos = createServerFn({ method: "POST" })
  .validator((input: unknown) => accessSchema.parse(input))
  .handler(async ({ data }) => {
    const { admin } = await exigirAdministrador(data.accessToken);
    const { data: modelos, error } = await admin
      .from("oricse_contrato_modelos")
      .select("id,titulo,descricao,conteudo,template_pdf_base64,template_pdf_url,ativo,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Não foi possível carregar os modelos de contrato.");
    return {
      modelos: (modelos || []).map((modelo) => ({
        ...modelo,
        campos: extrairCampos(modelo.conteudo),
      })),
    };
  });

export const criarModeloContrato = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    accessSchema
      .extend({
        titulo: z.string().trim().min(2).max(160),
        descricao: z.string().max(500).default(""),
        conteudo: z.string().min(10).max(200000),
        templatePdfBase64: templatePdfSchema,
        templatePdfUrl: z.string().url().max(500).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { admin, userId } = await exigirAdministrador(data.accessToken);
    const campos = extrairCampos(data.conteudo);
    if (!campos.length)
      throw new Error("Inclua pelo menos um campo entre chaves, por exemplo {{nome}}.");
    const { data: modelo, error } = await admin
      .from("oricse_contrato_modelos")
      .insert({
        titulo: data.titulo,
        descricao: data.descricao,
        conteudo: data.conteudo,
        template_pdf_base64: data.templatePdfBase64 || null,
        template_pdf_url: data.templatePdfUrl || null,
        criado_por: userId,
      })
      .select("id,titulo,descricao,conteudo,template_pdf_base64,template_pdf_url,ativo,created_at,updated_at")
      .single();
    if (error || !modelo) throw new Error("Não foi possível salvar o modelo de contrato.");
    return { modelo: { ...modelo, campos } };
  });

export const criarLinkContrato = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    accessSchema
      .extend({
        modeloId: z.string().uuid(),
        validadeDias: z.number().int().min(1).max(365).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { admin, userId } = await exigirAdministrador(data.accessToken);
    const { data: modelo, error: modeloError } = await admin
      .from("oricse_contrato_modelos")
      .select("id,titulo,conteudo,template_pdf_base64,template_pdf_url,ativo")
      .eq("id", data.modeloId)
      .maybeSingle();
    if (modeloError || !modelo || !modelo.ativo)
      throw new Error("Modelo de contrato indisponível.");
    const token = await gerarToken();
    const tokenHash = await hashToken(token);
    const expiraEm = new Date(Date.now() + data.validadeDias * 24 * 60 * 60 * 1000).toISOString();
    const { data: contrato, error } = await admin
      .from("oricse_contratos")
      .insert({
        modelo_id: modelo.id,
        modelo_titulo: modelo.titulo,
        modelo_conteudo_snapshot: modelo.conteudo,
        modelo_pdf_base64_snapshot: modelo.template_pdf_base64 || null,
        modelo_pdf_url_snapshot: modelo.template_pdf_url || null,
        token_hash: tokenHash,
        token_prefix: token.slice(0, 12),
        expira_em: expiraEm,
        criado_por: userId,
      })
      .select("id,modelo_titulo,status,expira_em,created_at")
      .single();
    if (error || !contrato) throw new Error("Não foi possível gerar o link do contrato.");
    return { contrato, token, campos: extrairCampos(modelo.conteudo) };
  });

export const listarContratos = createServerFn({ method: "POST" })
  .validator((input: unknown) => accessSchema.parse(input))
  .handler(async ({ data }) => {
    const { admin } = await exigirAdministrador(data.accessToken);
    const { data: contratos, error } = await admin
      .from("oricse_contratos")
      .select(
        "id,modelo_titulo,status,pessoa_nome,pessoa_email,expira_em,preenchido_em,assinado_em,created_at,oricse_contrato_arquivos(id,tipo,tamanho_bytes,drive_file_id,drive_file_url,created_at)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error("Não foi possível carregar os contratos gerados.");
    return { contratos: contratos || [] };
  });

export const obterContratoPublico = createServerFn({ method: "POST" })
  .validator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = await carregarAdmin();
    const tokenHash = await hashToken(data.token);
    const { data: contrato, error } = await admin
      .from("oricse_contratos")
      .select(
        "id,modelo_titulo,modelo_conteudo_snapshot,modelo_pdf_base64_snapshot,modelo_pdf_url_snapshot,status,pessoa_nome,dados,expira_em,preenchido_em,assinado_em",
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error || !contrato) throw new Error("Link de contrato inválido.");
    if (
      contrato.status === "cancelado" ||
      (contrato.expira_em && new Date(contrato.expira_em).getTime() <= Date.now())
    ) {
      if (contrato.status !== "expirado")
        await admin.from("oricse_contratos").update({ status: "expirado" }).eq("id", contrato.id);
      throw new Error("Este link de contrato expirou ou foi cancelado.");
    }
    return {
      contrato: {
        id: contrato.id,
        titulo: contrato.modelo_titulo,
        conteudo: contrato.modelo_conteudo_snapshot,
        templatePdfBase64: contrato.modelo_pdf_base64_snapshot,
        templatePdfUrl: contrato.modelo_pdf_url_snapshot,
        status: contrato.status,
        pessoaNome: contrato.pessoa_nome,
        dados: contrato.dados || {},
        expiraEm: contrato.expira_em,
        preenchidoEm: contrato.preenchido_em,
        assinadoEm: contrato.assinado_em,
        campos: extrairCampos(contrato.modelo_conteudo_snapshot),
      },
    };
  });

export const salvarDadosContrato = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    tokenSchema
      .extend({
        pessoaNome: z.string().trim().min(2).max(180),
        pessoaEmail: z.string().trim().email().max(255).optional().or(z.literal("")),
        dados: camposSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const admin = await carregarAdmin();
    const tokenHash = await hashToken(data.token);
    const { data: contrato, error: buscaError } = await admin
      .from("oricse_contratos")
      .select("id,status,expira_em,pessoa_nome")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (buscaError || !contrato) throw new Error("Link de contrato inválido.");
    if (
      contrato.status === "cancelado" ||
      (contrato.expira_em && new Date(contrato.expira_em).getTime() <= Date.now())
    )
      throw new Error("Este link de contrato expirou.");
    const agora = new Date().toISOString();
    const { error } = await admin
      .from("oricse_contratos")
      .update({
        pessoa_nome: data.pessoaNome,
        pessoa_email: data.pessoaEmail || null,
        dados: data.dados,
        status: "preenchido",
        preenchido_em: agora,
        updated_at: agora,
      })
      .eq("id", contrato.id);
    if (error) throw new Error("Não foi possível salvar os dados do contrato.");
    return { ok: true, contratoId: contrato.id, preenchidoEm: agora };
  });

export const salvarArquivoContrato = createServerFn({ method: "POST" })
  .validator((input: unknown) => arquivoSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = await carregarAdmin();
    const tokenHash = await hashToken(data.token);
    const { data: contrato, error: contratoError } = await admin
      .from("oricse_contratos")
      .select("id,status,expira_em,pessoa_nome")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (contratoError || !contrato) throw new Error("Link de contrato inválido.");
    if (
      contrato.status === "cancelado" ||
      (contrato.expira_em && new Date(contrato.expira_em).getTime() <= Date.now())
    )
      throw new Error("Este link de contrato expirou.");
    if (data.tipo === "assinado" && !["preenchido", "assinado"].includes(contrato.status))
      throw new Error("Preencha o contrato antes de enviar a versão assinada.");
    const bytes = Buffer.from(data.base64.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (!bytes.length || bytes.length > 20_000_000) throw new Error("O PDF deve ter até 20 MB.");
    const nomeSeguro =
      String(contrato.pessoa_nome || "Pessoa")
        .trim()
        .replace(/[^a-zA-ZÀ-ÿ0-9 _-]/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 100) || "Pessoa";
    const nomeVersao = data.tipo === "em_branco" ? "Em branco" : "Assinado";
    // Arquivo único por versão: evita sobrescrever um contrato anterior antes
    // que o banco confirme a substituição.
    const nomeArquivo = nomeSeguro + " - " + nomeVersao + " - " + crypto.randomUUID().slice(0, 8) + ".pdf";
    const tokenDrive = await driveAccessToken();
    const driveArquivo = await writeDriveFile(
      tokenDrive,
      ["contratos", contrato.id],
      nomeArquivo,
      bytes,
      "application/pdf",
      {
        oricseContratoId: contrato.id,
        oricseContratoTipo: data.tipo,
      },
    );
    const novoCaminho = "drive:" + driveArquivo.id;
    const { data: anterior } = await admin
      .from("oricse_contrato_arquivos")
      .select("storage_path,drive_file_id")
      .eq("contrato_id", contrato.id)
      .eq("tipo", data.tipo)
      .maybeSingle();
    const { error: arquivoError } = await admin.from("oricse_contrato_arquivos").upsert(
      {
        contrato_id: contrato.id,
        tipo: data.tipo,
        storage_path: novoCaminho,
        mime_type: "application/pdf",
        tamanho_bytes: bytes.length,
        drive_file_id: driveArquivo.id,
        drive_file_url: driveArquivo.url,
        drive_folder_id: driveArquivo.folderId,
      },
      { onConflict: "contrato_id,tipo" },
    );
    if (arquivoError) {
      try {
        await driveFetch(
          tokenDrive,
          "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(driveArquivo.id),
          { method: "DELETE" },
        );
      } catch (erroLimpeza) {
        console.error("Falha ao limpar PDF de contrato não registrado:", erroLimpeza);
      }
      throw new Error("Não foi possível registrar o PDF do contrato.");
    }
    // Preserva a versão anterior enquanto o banco não confirma a nova.
    if (anterior?.drive_file_id && anterior.drive_file_id !== driveArquivo.id) {
      try {
        await driveFetch(
          tokenDrive,
          "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(anterior.drive_file_id),
          { method: "DELETE" },
        );
      } catch (erroLimpeza) {
        console.error("Falha ao limpar versão anterior do contrato:", erroLimpeza);
      }
    }
    const agora = new Date().toISOString();
    if (data.tipo === "assinado")
      await admin
        .from("oricse_contratos")
        .update({ status: "assinado", assinado_em: agora, updated_at: agora })
        .eq("id", contrato.id);
    return {
      ok: true,
      tipo: data.tipo,
      tamanhoBytes: bytes.length,
      drive: {
        fileId: driveArquivo.id,
        fileUrl: driveArquivo.url,
        folderId: driveArquivo.folderId,
      },
    };
  });

export const obterDownloadContrato = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    tokenSchema.extend({ tipo: z.enum(["em_branco", "assinado"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const admin = await carregarAdmin();
    const tokenHash = await hashToken(data.token);
    const { data: contrato } = await admin
      .from("oricse_contratos")
      .select("id,expira_em,status")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (
      !contrato ||
      contrato.status === "cancelado" ||
      (contrato.expira_em && new Date(contrato.expira_em).getTime() <= Date.now())
    )
      throw new Error("Contrato indisponível.");
    const { data: arquivo } = await admin
      .from("oricse_contrato_arquivos")
      .select("storage_path,drive_file_id,mime_type")
      .eq("contrato_id", contrato.id)
      .eq("tipo", data.tipo)
      .maybeSingle();
    if (!arquivo) throw new Error("Esta versão do contrato ainda não foi gerada.");
    const base64 = await carregarPdfDoDrive(contrato.id, data.tipo, arquivo.drive_file_id);
    return { base64, mimeType: arquivo.mime_type };
  });

export const obterDownloadContratoAdmin = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    accessSchema
      .extend({ contratoId: z.string().uuid(), tipo: z.enum(["em_branco", "assinado"]) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { admin } = await exigirAdministrador(data.accessToken);
    const { data: arquivo } = await admin
      .from("oricse_contrato_arquivos")
      .select("storage_path,drive_file_id,mime_type")
      .eq("contrato_id", data.contratoId)
      .eq("tipo", data.tipo)
      .maybeSingle();
    if (!arquivo) throw new Error("Esta versão do contrato ainda não foi gerada.");
    const base64 = await carregarPdfDoDrive(data.contratoId, data.tipo, arquivo.drive_file_id);
    return { base64, mimeType: arquivo.mime_type };
  });

export const cancelarContrato = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    accessSchema.extend({ contratoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { admin } = await exigirAdministrador(data.accessToken);
    const { error } = await admin
      .from("oricse_contratos")
      .update({ status: "cancelado", updated_at: new Date().toISOString() })
      .eq("id", data.contratoId);
    if (error) throw new Error("Não foi possível cancelar o link do contrato.");
    return { ok: true };
  });


export const excluirContrato = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    accessSchema.extend({ contratoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { admin } = await exigirAdministrador(data.accessToken);
    const { data: arquivos, error: arquivosError } = await admin
      .from("oricse_contrato_arquivos")
      .select("storage_path,drive_file_id")
      .eq("contrato_id", data.contratoId);
    if (arquivosError) throw new Error("Não foi possível localizar os arquivos do contrato.");

    // Não excluir dados que ainda estejam exclusivamente em armazenamento legado.
    // A migração precisa ser feita antes da exclusão definitiva.
    const legados = (arquivos || []).filter(
      (arquivo) =>
        arquivo.storage_path &&
        !arquivo.storage_path.startsWith("drive:") &&
        !arquivo.drive_file_id,
    );
    if (legados.length) {
      throw new Error("O contrato possui arquivos antigos que precisam ser migrados ao Drive antes da exclusão.");
    }
    const driveIds = [...new Set(
      (arquivos || [])
        .map((arquivo) =>
          arquivo.drive_file_id ||
          (arquivo.storage_path?.startsWith("drive:") ? arquivo.storage_path.slice(6) : null),
        )
        .filter((id): id is string => Boolean(id)),
    )];
    if (driveIds.length) {
      const driveToken = await driveAccessToken();
      for (const driveId of driveIds) await deleteDriveFile(driveToken, driveId);
    }

    const { error } = await admin
      .from("oricse_contratos")
      .delete()
      .eq("id", data.contratoId);
    if (error) throw new Error("Não foi possível excluir o contrato.");
    return { ok: true };
  });

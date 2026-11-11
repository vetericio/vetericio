import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { driveAccessToken, writeDriveFile } from "@/lib/drive-kv.server";

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
    const path = `${contrato.id}/${nomeSeguro} - ${nomeVersao}.pdf`;
    const bucket = admin.storage.from("oricse-contratos");
    const upload = await bucket.upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upload.error) throw new Error("Não foi possível guardar o PDF do contrato.");

    let driveArquivo: { id: string; folderId: string; url: string };
    try {
      const driveToken = await driveAccessToken();
      driveArquivo = await writeDriveFile(
        driveToken,
        ["contratos"],
        `${nomeSeguro} - ${nomeVersao}.pdf`,
        bytes,
        "application/pdf",
        {
          oricseContratoId: contrato.id,
          oricseContratoTipo: data.tipo,
        },
      );
    } catch (error) {
      await bucket.remove([path]);
      const detalhe = error instanceof Error ? error.message : "falha desconhecida";
      throw new Error(`Não foi possível salvar o PDF no Google Drive: ${detalhe}`);
    }
    const { data: anterior } = await admin
      .from("oricse_contrato_arquivos")
      .select("storage_path")
      .eq("contrato_id", contrato.id)
      .eq("tipo", data.tipo)
      .maybeSingle();
    if (anterior?.storage_path) await bucket.remove([anterior.storage_path]);
    const { error: arquivoError } = await admin.from("oricse_contrato_arquivos").upsert(
      {
        contrato_id: contrato.id,
        tipo: data.tipo,
        storage_path: path,
        mime_type: "application/pdf",
        tamanho_bytes: bytes.length,
        drive_file_id: driveArquivo.id,
        drive_file_url: driveArquivo.url,
        drive_folder_id: driveArquivo.folderId,
      },
      { onConflict: "contrato_id,tipo" },
    );
    if (arquivoError) {
      await bucket.remove([path]);
      throw new Error("Não foi possível registrar o PDF do contrato.");
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
      .select("storage_path,mime_type")
      .eq("contrato_id", contrato.id)
      .eq("tipo", data.tipo)
      .maybeSingle();
    if (!arquivo) throw new Error("Esta versão do contrato ainda não foi gerada.");
    const signed = await admin.storage
      .from("oricse-contratos")
      .createSignedUrl(arquivo.storage_path, 600);
    if (signed.error || !signed.data?.signedUrl)
      throw new Error("Não foi possível preparar o download.");
    return { url: signed.data.signedUrl, mimeType: arquivo.mime_type };
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
      .select("storage_path,mime_type")
      .eq("contrato_id", data.contratoId)
      .eq("tipo", data.tipo)
      .maybeSingle();
    if (!arquivo) throw new Error("Esta versão do contrato ainda não foi gerada.");
    const signed = await admin.storage
      .from("oricse-contratos")
      .createSignedUrl(arquivo.storage_path, 600);
    if (signed.error || !signed.data?.signedUrl)
      throw new Error("Não foi possível preparar o download.");
    return { url: signed.data.signedUrl, mimeType: arquivo.mime_type };
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

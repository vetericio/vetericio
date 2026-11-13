import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DURACOES_ATENDIMENTO, LIMITE_PDF_TERMO } from "@/lib/configuracoes-clinica";
import { exigirPermissaoClinica, clienteSupabaseUsuario } from "@/lib/permissao-clinica.server";

import {
  FUNDOS_DOCUMENTOS, TIPOS_MODELO_DOCUMENTO,
  type IdentidadeDocumento, type ModeloDocumentoPadrao, type TipoModeloDocumento,
} from "@/lib/modelos-documentos";

const sessao = z.object({ accessToken: z.string().min(20) });
const clinicaSchema = sessao.extend({ clinicaId: z.string().uuid() });
const duracao = z.number().int().min(5).max(720);
const agendaSchema = clinicaSchema.extend({
  intervalo: z.number().int().min(5).max(240),
  duracoes: z.object({
    Consulta: duracao, Retorno: duracao, Cirurgia: duracao,
    "Banho e Tosa": duracao, Vacina: duracao, Procedimento: duracao,
  }).strict(),
});
const protecao = z.object({ assinar: z.boolean(), receituario: z.boolean() }).strict();
const areaSchema = sessao.extend({
  area: z.enum(["assinar", "receituario"]),
  animalId: z.string().uuid().optional(),
  tutorId: z.string().uuid().optional(),
});
const pdfSchema = z.object({
  nome: z.string().trim().min(1).max(220).regex(/\.pdf$/i),
  driveId: z.string().regex(/^[\w-]+$/),
});
const PROTECAO = "protecao_documentos";
const PDF = "pdf_padrao_termos";

function chaveClinica(clinicaId: string, chave: string) {
  return `configuracoes_clinica:${clinicaId}:${chave}`;
}

async function contexto(accessToken: string) {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sessão expirada. Entre novamente.");
  const usuario = data.user;
  const [conta, selecao, vinculos] = await Promise.all([
    admin.from("app_users").select("role").eq("user_id", usuario.id).maybeSingle(),
    admin.from("oricse_clinica_ativa_usuario").select("clinica_id").eq("user_id", usuario.id).maybeSingle(),
    admin.from("clinica_usuarios").select("clinica_id,papel").eq("user_id", usuario.id).eq("ativo", true),
  ]);
  if (conta.error || selecao.error || vinculos.error) throw new Error("Não foi possível confirmar a clínica ativa.");
  const adminGeral = conta.data?.role === "admin";
  const lista = vinculos.data || [];
  const selecionada = selecao.data?.clinica_id;
  const vinculo = lista.find((item) => item.clinica_id === selecionada) || (lista.length === 1 ? lista[0] : null);
  const clinicaId = adminGeral ? selecionada : vinculo?.clinica_id;
  if (!clinicaId) throw new Error("Selecione uma clínica ativa para continuar.");
  const { data: clinica, error: erroClinica } = await admin.from("clinicas")
    .select("id,nome,status,excluido_em,duracao_padrao_atendimento_min,duracoes_atendimento_min")
    .eq("id", clinicaId).maybeSingle();
  if (erroClinica || !clinica || clinica.status !== "ativa" || clinica.excluido_em) throw new Error("Clínica indisponível.");
  return {
    admin, usuario, clinica, accessToken,
    podeEditarDocumentos: adminGeral || ["rt", "admin_clinica"].includes(vinculo?.papel || ""),
  };
}

type Contexto = Awaited<ReturnType<typeof contexto>>;

function confirmarClinica(ctx: Contexto, clinicaId: string) {
  if (ctx.clinica.id !== clinicaId) throw new Error("A clínica ativa mudou. Atualize a página.");
}

function exigirGestor(ctx: Contexto, clinicaId: string) {
  confirmarClinica(ctx, clinicaId);
  if (!ctx.podeEditarDocumentos) throw new Error("Somente o RT ou a administração da clínica pode alterar esta configuração.");
}

async function ler(ctx: Contexto, chave: string): Promise<unknown> {
  const { data, error } = await ctx.admin.from("oricse_config")
    .select("valor").eq("chave", chaveClinica(ctx.clinica.id, chave)).maybeSingle();
  if (error) throw new Error("Não foi possível consultar a configuração.");
  return data?.valor ?? null;
}

async function gravar(ctx: Contexto, chave: string, dados: object) {
  const { error } = await ctx.admin.from("oricse_config").upsert({
    chave: chaveClinica(ctx.clinica.id, chave), valor: dados, updated_at: new Date().toISOString(),
  }, { onConflict: "chave" });
  if (error) throw new Error("Não foi possível salvar a configuração.");
}

async function lerProtecao(ctx: Contexto) {
  const dados = await ler(ctx, PROTECAO);
  return dados === null ? { assinar: true, receituario: true } : protecao.parse(dados);
}

async function lerPdf(ctx: Contexto) {
  const dados = await ler(ctx, PDF);
  return dados === null ? null : pdfSchema.parse(dados);
}

async function autorizarAgenda(ctx: Contexto) {
  await exigirPermissaoClinica(ctx.admin, ctx.usuario.id, ctx.clinica.id,
    ["recepcao.agenda", "administracao.configuracoes"], ctx.accessToken);
}

async function autorizarTermos(ctx: Contexto) {
  if (ctx.podeEditarDocumentos) return;
  await exigirPermissaoClinica(ctx.admin, ctx.usuario.id, ctx.clinica.id,
    ["consultorio.receituario", "consultorio.atendimentos"], ctx.accessToken);
}

export const obterConfiguracoesClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => sessao.parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    const [podeEditarAgenda, politica, pdf] = await Promise.all([
      autorizarAgenda(ctx).then(() => true, () => false),
      ctx.podeEditarDocumentos ? lerProtecao(ctx) : null,
      ctx.podeEditarDocumentos ? lerPdf(ctx) : null,
    ]);
    return {
      id: ctx.clinica.id as string, nome: ctx.clinica.nome as string,
      intervalo: Number(ctx.clinica.duracao_padrao_atendimento_min) || 30,
      duracoes: { ...DURACOES_ATENDIMENTO, ...ctx.clinica.duracoes_atendimento_min } as typeof DURACOES_ATENDIMENTO,
      podeEditarAgenda, podeEditarDocumentos: ctx.podeEditarDocumentos,
      protecao: politica, pdf: pdf?.nome ?? null,
    };
  });

export const salvarAgendaClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => agendaSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    confirmarClinica(ctx, data.clinicaId);
    await autorizarAgenda(ctx);
    const { error } = await ctx.admin.from("clinicas").update({
      duracao_padrao_atendimento_min: data.intervalo,
      duracoes_atendimento_min: data.duracoes, updated_at: new Date().toISOString(),
    }).eq("id", data.clinicaId).select("id").single();
    if (error) throw new Error("Não foi possível salvar as durações da agenda.");
    return { ok: true };
  });

export const salvarProtecaoClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => clinicaSchema.extend({ protecao }).parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    exigirGestor(ctx, data.clinicaId);
    await gravar(ctx, PROTECAO, data.protecao);
    return { ok: true };
  });

async function contextoDaArea(data: z.infer<typeof areaSchema>) {
  const ctx = await contexto(data.accessToken);
  await exigirPermissaoClinica(ctx.admin, ctx.usuario.id, ctx.clinica.id, ["consultorio.receituario"], data.accessToken);
  if (data.area === "receituario" && (data.animalId || data.tutorId)) {
    const consulta = data.animalId
      ? ctx.admin.from("oricse_animais").select("id").eq("id", data.animalId)
      : ctx.admin.from("tutores").select("id").eq("id", data.tutorId);
    const { data: registro, error } = await consulta.eq("clinica_id", ctx.clinica.id).maybeSingle();
    if (error || !registro) throw new Error("O atendimento não pertence à clínica ativa.");
  }
  return ctx;
}

export const consultarProtecaoClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => areaSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await contextoDaArea(data);
    return { exigeSenha: (await lerProtecao(ctx))[data.area], clinicaId: ctx.clinica.id as string };
  });

export const confirmarSenhaClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => areaSchema.extend({
    clinicaId: z.string().uuid(),
    senha: z.string().min(1).max(512),
  }).parse(input))
  .handler(async ({ data }) => {
    const ctx = await contextoDaArea(data);
    confirmarClinica(ctx, data.clinicaId);
    if (!(await lerProtecao(ctx))[data.area]) return { ok: true };
    if (!ctx.usuario.email) throw new Error("Esta conta precisa de um e-mail de acesso para confirmar a senha.");
    const auth = clienteSupabaseUsuario().auth;
    const resultado = await auth.signInWithPassword({ email: ctx.usuario.email, password: data.senha });
    if (resultado.error?.status === 429) throw new Error("Muitas tentativas. Aguarde e tente novamente.");
    if (resultado.error || resultado.data.user?.id !== ctx.usuario.id) {
      throw new Error("Não foi possível confirmar a senha da conta.");
    }
    await auth.signOut({ scope: "local" });
    return { ok: true };
  });

export const salvarPdfPadraoTermos = createServerFn({ method: "POST" })
  .validator((input: unknown) => clinicaSchema.extend({
    nome: pdfSchema.shape.nome,
    base64: z.string().min(1).max(Math.ceil(LIMITE_PDF_TERMO / 3) * 4)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  }).parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    exigirGestor(ctx, data.clinicaId);
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > LIMITE_PDF_TERMO || bytes.subarray(0, 5).toString() !== "%PDF-") {
      throw new Error("Envie um PDF válido de até 5 MB.");
    }
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(bytes).catch(() => null);
    if (!pdf?.getPageCount()) throw new Error("Envie um PDF válido, com pelo menos uma página e sem senha.");
    const { driveAccessToken, writeDriveFile } = await import("@/lib/drive-kv.server");
    const token = await driveAccessToken();
    const arquivo = await writeDriveFile(token, ["Clinicas", "clinica-" + data.clinicaId, "Modelos de termos"],
      crypto.randomUUID() + ".pdf", bytes, "application/pdf");
    await gravar(ctx, PDF, { nome: data.nome, driveId: arquivo.id });
    return { nome: data.nome };
  });

export const removerPdfPadraoTermos = createServerFn({ method: "POST" })
  .validator((input: unknown) => clinicaSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    exigirGestor(ctx, data.clinicaId);
    const { error } = await ctx.admin.from("oricse_config").delete().eq("chave", chaveClinica(data.clinicaId, PDF));
    if (error) throw new Error("Não foi possível remover o PDF padrão.");
    return { ok: true };
  });

export const obterNomePdfPadraoTermos = createServerFn({ method: "POST" })
  .validator((input: unknown) => sessao.parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    await autorizarTermos(ctx);
    return { nome: (await lerPdf(ctx))?.nome ?? null, clinicaId: ctx.clinica.id as string };
  });

export const baixarPdfPadraoTermos = createServerFn({ method: "POST" })
  .validator((input: unknown) => clinicaSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    confirmarClinica(ctx, data.clinicaId);
    await autorizarTermos(ctx);
    const pdf = await lerPdf(ctx);
    if (!pdf) throw new Error("A clínica ainda não tem um PDF padrão para termos.");
    const { driveAccessToken, driveFetch } = await import("@/lib/drive-kv.server");
    const token = await driveAccessToken("https://www.googleapis.com/auth/drive.readonly");
    const resposta = await driveFetch(token, "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(pdf.driveId) + "?alt=media");
    const bytes = Buffer.from(await resposta.arrayBuffer());
    if (bytes.length > LIMITE_PDF_TERMO || bytes.subarray(0, 5).toString() !== "%PDF-") {
      throw new Error("O PDF padrão está indisponível.");
    }
    return { nome: pdf.nome, base64: bytes.toString("base64") };
  });

const modeloDocumentoSchema = z.object({
  fundo: z.string().refine((id) => id === "" || FUNDOS_DOCUMENTOS.some(([fundo]) => fundo === id)),
  texto: z.string().max(25000),
  usarLogo: z.boolean(),
}).strict();
const tipoModeloSchema = z.enum(TIPOS_MODELO_DOCUMENTO);
const logoDocumentoSchema = z.object({ driveId: z.string().regex(/^[\w-]+$/) });
const CHAVE_LOGO_DOCUMENTOS = "logo_documentos";

async function lerModeloDocumento(ctx: Contexto, tipo: TipoModeloDocumento) {
  const valor = await ler(ctx, "modelo_documento:" + tipo);
  return valor === null ? { fundo: "", texto: "", usarLogo: true } : modeloDocumentoSchema.parse(valor);
}

const dadosPapelSchema = z.object({
  nome: z.string().trim().max(160),
  razaoSocial: z.string().trim().max(220),
  cnpj: z.string().trim().max(40),
  crmv: z.string().trim().max(70),
  endereco: z.string().trim().max(350),
  telefone: z.string().trim().max(70),
  email: z.string().trim().max(160),
  municipio: z.string().trim().max(120),
}).strict();
const CHAVE_DADOS_DOCUMENTOS = "dados_documentos";

async function identidadeDocumentos(ctx: Contexto): Promise<IdentidadeDocumento> {
  const [contrato, cadastro, site, logoSalva, dadosSalvos] = await Promise.all([
    ctx.admin.from("oricse_contratacoes")
      .select("razao_social,cnpj,clinica_telefone,clinica_email,clinica_endereco,clinica_numero,clinica_complemento,clinica_bairro,clinica_cidade,clinica_uf,clinica_cep,dados")
      .eq("clinica_criada_id", ctx.clinica.id).is("excluido_em", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ctx.admin.from("clinicas").select("logo_url,dominio,slug").eq("id", ctx.clinica.id).single(),
    ctx.admin.from("clinic_sites").select("config").eq("clinica_id", ctx.clinica.id).maybeSingle(),
    ler(ctx, CHAVE_LOGO_DOCUMENTOS),
    ler(ctx, CHAVE_DADOS_DOCUMENTOS),
  ]);
  if (contrato.error || cadastro.error || site.error) {
    throw new Error("Não foi possível consultar a identidade da clínica.");
  }
  const dados = contrato.data;
  const extras = (dados?.dados || {}) as Record<string, unknown>;
  const config = (site.data?.config || {}) as Record<string, unknown>;
  const texto = (valor: unknown) => typeof valor === "string" ? valor.trim() : "";
  const municipio = [dados?.clinica_cidade, dados?.clinica_uf].filter(Boolean).join("/");
  const rua = [dados?.clinica_endereco, dados?.clinica_numero].filter(Boolean).join(", ");
  const endereco = rua ? [rua, dados?.clinica_complemento, dados?.clinica_bairro, municipio,
    dados?.clinica_cep && "CEP " + dados.clinica_cep].filter(Boolean).join(" · ") : texto(config.address);
  const url = [cadastro.data?.logo_url, config.logoUrl].map(texto)
    .find((candidata) => /^(https:\/\/|\/(?!\/))/.test(candidata)) || "";
  let logoUrl = url;
  if (logoSalva) {
    const { driveId } = logoDocumentoSchema.parse(logoSalva);
    const { driveAccessToken, driveFetch } = await import("@/lib/drive-kv.server");
    try {
      const token = await driveAccessToken("https://www.googleapis.com/auth/drive.readonly");
      const resposta = await driveFetch(token, "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(driveId) + "?alt=media");
      const bytes = Buffer.from(await resposta.arrayBuffer());
      if (pngDocumentoValido(bytes)) logoUrl = "data:image/png;base64," + bytes.toString("base64");
    } catch {
      // A identidade cadastrada mantém a emissão disponível se o Drive falhar.
    }
  }
  const identidade = {
    nome: ctx.clinica.nome, razaoSocial: texto(dados?.razao_social), cnpj: texto(dados?.cnpj),
    crmv: texto(extras.registro_crmv_estabelecimento || extras.clinica_crmv),
    endereco, municipio, logoUrl,
    telefone: texto(dados?.clinica_telefone) || texto(config.phone),
    email: texto(dados?.clinica_email) || texto(config.email),
    site: texto(cadastro.data?.dominio) || (cadastro.data?.slug ? `${cadastro.data.slug}.oricse.com.br` : ""),
  };
  const ajustes = dadosSalvos === null ? {} : dadosPapelSchema.partial().parse(dadosSalvos);
  return { ...identidade, ...ajustes, nome: ajustes.nome || identidade.nome };
}

export const obterModelosDocumentoClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => clinicaSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    exigirGestor(ctx, data.clinicaId);
    const [identidade, modelos] = await Promise.all([
      identidadeDocumentos(ctx),
      Promise.all(TIPOS_MODELO_DOCUMENTO.map(async (tipo) => [tipo, await lerModeloDocumento(ctx, tipo)] as const)),
    ]);
    return { identidade, modelos: Object.fromEntries(modelos) as Record<TipoModeloDocumento, ModeloDocumentoPadrao> };
  });

export const obterModeloDocumentoEmissao = createServerFn({ method: "POST" })
  .validator((input: unknown) => clinicaSchema.extend({ tipo: tipoModeloSchema }).parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    confirmarClinica(ctx, data.clinicaId);
    await autorizarTermos(ctx);
    const [identidade, modelo] = await Promise.all([identidadeDocumentos(ctx), lerModeloDocumento(ctx, data.tipo)]);
    return { identidade, modelo };
  });

export const salvarModeloDocumentoClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => clinicaSchema.extend({ tipo: tipoModeloSchema, modelo: modeloDocumentoSchema }).parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    exigirGestor(ctx, data.clinicaId);
    await gravar(ctx, "modelo_documento:" + data.tipo, data.modelo);
    return { ok: true };
  });

export const salvarDadosDocumentoClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => clinicaSchema.extend({ dados: dadosPapelSchema.partial() }).parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    exigirGestor(ctx, data.clinicaId);
    const anteriores = await ler(ctx, CHAVE_DADOS_DOCUMENTOS);
    await gravar(ctx, CHAVE_DADOS_DOCUMENTOS, {
      ...(anteriores === null ? {} : dadosPapelSchema.partial().parse(anteriores)), ...data.dados,
    });
    return { ok: true };
  });

const LIMITE_LOGO_DOCUMENTO = 1_000_000;
function pngDocumentoValido(bytes: Buffer) {
  return bytes.length >= 33 && bytes.length <= LIMITE_LOGO_DOCUMENTO &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR" &&
    [bytes.readUInt32BE(16), bytes.readUInt32BE(20)].every((medida) => medida > 0 && medida <= 480);
}

export const salvarLogoDocumentoClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => clinicaSchema.extend({
    base64: z.string().min(1).max(Math.ceil(LIMITE_LOGO_DOCUMENTO / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/).nullable(),
  }).parse(input))
  .handler(async ({ data }) => {
    const ctx = await contexto(data.accessToken);
    exigirGestor(ctx, data.clinicaId);
    if (data.base64 === null) {
      const { error } = await ctx.admin.from("oricse_config").delete().eq("chave", chaveClinica(data.clinicaId, CHAVE_LOGO_DOCUMENTOS));
      if (error) throw new Error("Não foi possível voltar à logo cadastrada.");
    } else {
      const bytes = Buffer.from(data.base64, "base64");
      if (!pngDocumentoValido(bytes)) throw new Error("Envie uma logo PNG válida de até 1 MB.");
      const { driveAccessToken, driveFetch, writeDriveFile } = await import("@/lib/drive-kv.server");
      const token = await driveAccessToken();
      const arquivo = await writeDriveFile(token, ["Clinicas", "clinica-" + data.clinicaId, "Identidade dos documentos"],
        crypto.randomUUID() + ".png", bytes, "image/png");
      try {
        await gravar(ctx, CHAVE_LOGO_DOCUMENTOS, { driveId: arquivo.id });
      } catch (erro) {
        await driveFetch(token, "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(arquivo.id), { method: "DELETE" }).catch(() => {});
        throw erro;
      }
    }
    return identidadeDocumentos(ctx);
  });

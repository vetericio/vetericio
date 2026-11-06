// Publishing queue: turns due posts into Instagram media through the official Graph API.
// Server only. Every step is persisted before the next one so a crash or retry never publishes twice:
// a container is only published while Meta reports it FINISHED (never PUBLISHED), and a publish call
// whose outcome is unknown is re-checked against the container status before anything else happens.
import type { Database } from "@/integrations/supabase/types";
import {
  GraphError,
  GraphNetworkError,
  audit,
  getPageToken,
  getUserToken,
  graphGet,
  graphPost,
  metaConfig,
} from "./meta.server";
import { limitsFor, raiseAlert, resolveAlerts } from "./alerts.server";
import { registerFailure } from "./rules.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
type Post = Database["public"]["Tables"]["posts"]["Row"];
type Asset = Database["public"]["Tables"]["media_assets"]["Row"];

const MAX_TENTATIVAS = 5;
const BACKOFF_MIN = [1, 2, 5, 15, 30];
// Containers still processing this long after the scheduled time are given up on.
const MAX_ESPERA_CONTAINER_MS = 2 * 60 * 60 * 1000;

type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

class PermanentError extends Error {}

export async function runPublishQueue(admin: Admin) {
  const { data: settings } = await admin
    .from("app_settings")
    .select("pausa_geral")
    .eq("id", true)
    .maybeSingle();
  await admin
    .from("app_settings")
    .update({ ultimo_ciclo_fila: new Date().toISOString() })
    .eq("id", true);
  if (settings?.pausa_geral) return { pausado: true, processados: 0 };
  await queueHealthAlerts(admin);

  const { data: posts, error } = await admin.rpc("claim_due_posts", {
    _limit: 3,
    _lease_seconds: 120,
  });
  if (error) throw new Error(`Falha ao reservar posts: ${error.message}`);

  const resultados: { id: string; status: string }[] = [];
  for (const post of posts ?? []) {
    try {
      resultados.push({ id: post.id, status: await processPost(admin, post) });
    } catch (e: any) {
      // Unexpected bug: keep the post for the next tick instead of losing it.
      await logEvent(admin, post.id, post.etapa ?? "processar", "erro", String(e?.message || e));
      await admin
        .from("posts")
        .update({ locked_until: null, ultimo_erro: String(e?.message || e).slice(0, 500) })
        .eq("id", post.id);
      resultados.push({ id: post.id, status: "erro_interno" });
    }
  }
  return { pausado: false, processados: resultados.length, resultados };
}

async function processPost(admin: Admin, post: Post): Promise<string> {
  const ctx = await accountContext(admin, post.instagram_account_id);
  if (!ctx)
    return fail(
      admin,
      post,
      "Conta sem conexão ativa com a Meta ou sem token da Página. Reconecte a conta.",
    );

  if (post.status === "resultado_desconhecido") return verifyUncertain(admin, post, ctx);

  // Posts queued by the assistant (no human approval) stop if the account's automation was suspended.
  if (!post.aprovado_por && !post.container_id) {
    const { data: regra } = await admin
      .from("regras_publicacao")
      .select("suspensa_em")
      .eq("instagram_account_id", post.instagram_account_id)
      .maybeSingle();
    if (regra?.suspensa_em) {
      await update(admin, post.id, {
        status: "aguardando_aprovacao",
        etapa: null,
        locked_until: null,
      });
      await logEvent(
        admin,
        post.id,
        "regras",
        "retido",
        "Automação da conta suspensa: aguardando aprovação humana.",
      );
      return "aguardando_aprovacao";
    }
  }

  try {
    // 1. Carousel items first (each item is its own container).
    if (post.tipo === "carrossel" && post.children_container_ids.length === 0) {
      const assets = await loadAssets(admin, post.media_asset_ids);
      const ids: string[] = [];
      for (const a of assets) {
        const params: Record<string, string> = {
          is_carousel_item: "true",
          access_token: ctx.token,
        };
        if (a.tipo === "video")
          Object.assign(params, { media_type: "VIDEO", video_url: a.public_url! });
        else Object.assign(params, { image_url: a.public_url! });
        if (a.tipo === "imagem" && post.alt_text) params["alt_text"] = post.alt_text;
        const r = await graphPost<{ id: string }>(`${ctx.graph}/${ctx.igUserId}/media`, params);
        ids.push(r.id);
      }
      await update(admin, post.id, { children_container_ids: ids, etapa: "aguardando_itens" });
      await logEvent(admin, post.id, "criar_itens", "ok", `${ids.length} itens`);
      post = { ...post, children_container_ids: ids };
    }
    if (post.tipo === "carrossel" && !post.container_id) {
      for (const childId of post.children_container_ids) {
        const st = await containerStatus(ctx, childId);
        if (st.code === "IN_PROGRESS") return wait(admin, post, "aguardando_itens");
        if (st.code !== "FINISHED")
          throw new PermanentError(`Item do carrossel com status ${st.code}: ${st.detail}`);
      }
    }

    // 2. Main container.
    if (!post.container_id) {
      const params = await containerParams(admin, post, ctx.token);
      const r = await graphPost<{ id: string }>(`${ctx.graph}/${ctx.igUserId}/media`, params);
      await update(admin, post.id, { container_id: r.id, etapa: "aguardando_container" });
      await logEvent(admin, post.id, "criar_container", "ok", r.id);
      post = { ...post, container_id: r.id };
    }

    // 3. Wait until Meta finishes processing (images take seconds, videos can take minutes).
    let st = await containerStatus(ctx, post.container_id!);
    for (let i = 0; i < 4 && st.code === "IN_PROGRESS"; i++) {
      await sleep(4000);
      st = await containerStatus(ctx, post.container_id!);
    }
    if (st.code === "IN_PROGRESS") {
      if (
        Date.now() - new Date(post.agendado_para ?? post.created_at).getTime() >
        MAX_ESPERA_CONTAINER_MS
      ) {
        throw new PermanentError("A Meta não terminou de processar a mídia em 2 horas.");
      }
      return wait(admin, post, "aguardando_container");
    }
    if (st.code === "PUBLISHED") return confirmPublished(admin, post, ctx);
    if (st.code === "EXPIRED") {
      // Never published (EXPIRED only happens to unpublished containers): build a fresh one next tick.
      await update(admin, post.id, {
        container_id: null,
        children_container_ids: [],
        etapa: null,
        locked_until: null,
      });
      await logEvent(admin, post.id, "container", "expirado", "Container expirou; será recriado.");
      return "processando";
    }
    if (st.code === "ERROR")
      throw new PermanentError(`A Meta recusou a mídia: ${st.detail || "erro no processamento"}`);

    // 4. Publish.
    return publish(admin, post, ctx);
  } catch (e) {
    return handleError(admin, post, e);
  }
}

async function publish(admin: Admin, post: Post, ctx: Ctx): Promise<string> {
  const limit = await graphGet<any>(`${ctx.graph}/${ctx.igUserId}/content_publishing_limit`, {
    fields: "quota_usage,config",
    access_token: ctx.token,
  }).catch(() => null);
  const usage = limit?.data?.[0];
  if (usage && usage.config?.quota_total && usage.quota_usage >= usage.config.quota_total) {
    await update(admin, post.id, {
      locked_until: null,
      proxima_tentativa: addMinutes(60),
      ultimo_erro: "Limite diário de publicações da conta atingido.",
    });
    await logEvent(
      admin,
      post.id,
      "publicar",
      "adiado",
      `Cota ${usage.quota_usage}/${usage.config.quota_total}`,
    );
    return "processando";
  }

  // Persist the attempt BEFORE calling Meta: if we crash mid-call, the next tick verifies instead of re-publishing.
  await update(admin, post.id, {
    etapa: "publicando",
    publish_attempted_at: new Date().toISOString(),
  });
  try {
    const r = await graphPost<{ id: string }>(`${ctx.graph}/${ctx.igUserId}/media_publish`, {
      creation_id: post.container_id!,
      access_token: ctx.token,
    });
    return finalize(admin, post, ctx, r.id);
  } catch (e) {
    if (e instanceof GraphNetworkError) {
      await update(admin, post.id, {
        status: "resultado_desconhecido",
        etapa: "verificar",
        locked_until: null,
        ultimo_erro: "Sem resposta da Meta ao publicar; o resultado será verificado.",
      });
      await logEvent(admin, post.id, "publicar", "desconhecido", e.message);
      return "resultado_desconhecido";
    }
    // Meta answered with an error: double-check the container before deciding anything.
    const st = await containerStatus(ctx, post.container_id!).catch(() => null);
    if (st?.code === "PUBLISHED") return confirmPublished(admin, post, ctx);
    await update(admin, post.id, { etapa: "aguardando_container", publish_attempted_at: null });
    throw e;
  }
}

async function verifyUncertain(admin: Admin, post: Post, ctx: Ctx): Promise<string> {
  if (!post.container_id) {
    await update(admin, post.id, { status: "processando", etapa: null, locked_until: null });
    return "processando";
  }
  const st = await containerStatus(ctx, post.container_id).catch((e) => {
    if (e instanceof GraphNetworkError) return null;
    throw e;
  });
  if (!st) {
    await update(admin, post.id, { locked_until: null, proxima_tentativa: addMinutes(2) });
    return "resultado_desconhecido";
  }
  await logEvent(admin, post.id, "verificar", "ok", `Container ${st.code}`);
  if (st.code === "PUBLISHED") return confirmPublished(admin, post, ctx);
  if (st.code === "FINISHED") {
    // Confirmed not published: safe to try again.
    await update(admin, post.id, {
      status: "processando",
      etapa: "aguardando_container",
      publish_attempted_at: null,
    });
    return publish(admin, { ...post, status: "processando" }, ctx);
  }
  if (st.code === "IN_PROGRESS") {
    await update(admin, post.id, { locked_until: null, proxima_tentativa: addMinutes(1) });
    return "resultado_desconhecido";
  }
  return fail(
    admin,
    post,
    `Publicação não confirmada: container ${st.code}. ${st.detail ?? ""}`.trim(),
  );
}

/** The container says PUBLISHED but we lost the media id: find it among the account's latest media. */
async function confirmPublished(admin: Admin, post: Post, ctx: Ctx): Promise<string> {
  const since =
    new Date(post.publish_attempted_at ?? post.agendado_para ?? post.created_at).getTime() -
    5 * 60_000;
  const recent = await graphGet<{ data: { id: string; timestamp: string; caption?: string }[] }>(
    `${ctx.graph}/${ctx.igUserId}/media`,
    { fields: "id,timestamp,caption", limit: "10", access_token: ctx.token },
  ).catch(() => ({ data: [] }));
  const caption = (post.legenda ?? "").trim().slice(0, 40);
  const match = recent.data.find(
    (m) =>
      new Date(m.timestamp).getTime() >= since &&
      (!caption || (m.caption ?? "").startsWith(caption)),
  );
  return finalize(admin, post, ctx, match?.id ?? null);
}

async function finalize(
  admin: Admin,
  post: Post,
  ctx: Ctx,
  mediaId: string | null,
): Promise<string> {
  let permalink: string | null = null;
  if (mediaId) {
    const m = await graphGet<{ permalink?: string }>(`${ctx.graph}/${mediaId}`, {
      fields: "permalink",
      access_token: ctx.token,
    }).catch(() => null);
    permalink = m?.permalink ?? null;
  }
  await update(admin, post.id, {
    status: "publicado",
    etapa: null,
    ig_media_id: mediaId,
    permalink,
    publicado_em: new Date().toISOString(),
    locked_until: null,
    proxima_tentativa: null,
    ultimo_erro: mediaId
      ? null
      : "Publicado (confirmado pelo status do container), mas o ID da mídia não foi localizado.",
  });
  await logEvent(admin, post.id, "publicar", "publicado", permalink ?? mediaId ?? "sem id");
  await audit(admin, {
    acao: "publicacao_publicada",
    alvo: post.id,
    detalhes: { ig_media_id: mediaId, permalink },
  });
  return "publicado";
}

async function handleError(admin: Admin, post: Post, e: unknown): Promise<string> {
  const msg = e instanceof Error ? e.message : String(e);
  const transient = e instanceof GraphNetworkError || (e instanceof GraphError && e.transient);
  const tentativas = post.tentativas + 1;
  if (e instanceof PermanentError || !transient || tentativas >= MAX_TENTATIVAS) {
    return fail(admin, post, msg, tentativas);
  }
  await update(admin, post.id, {
    tentativas,
    locked_until: null,
    proxima_tentativa: addMinutes(BACKOFF_MIN[tentativas - 1] ?? 30),
    ultimo_erro: msg.slice(0, 500),
  });
  await logEvent(
    admin,
    post.id,
    post.etapa ?? "processar",
    "nova_tentativa",
    `${tentativas}/${MAX_TENTATIVAS}: ${msg}`,
  );
  return "processando";
}

async function fail(
  admin: Admin,
  post: Post,
  msg: string,
  tentativas = post.tentativas,
): Promise<string> {
  await update(admin, post.id, {
    status: "falhou",
    etapa: null,
    tentativas,
    locked_until: null,
    proxima_tentativa: null,
    ultimo_erro: msg.slice(0, 500),
  });
  await logEvent(admin, post.id, post.etapa ?? "processar", "falhou", msg);
  await raiseAlert(admin, {
    instagram_account_id: post.instagram_account_id,
    tipo: "falha_publicacao",
    chave: post.id,
    severidade: "alta",
    mensagem: `Publicação "${post.titulo || (post.legenda ?? "").slice(0, 40) || post.id}" falhou: ${msg.slice(0, 300)}`,
  });
  if (await registerFailure(admin, post.instagram_account_id)) {
    await raiseAlert(admin, {
      instagram_account_id: post.instagram_account_id,
      tipo: "automacao_suspensa",
      severidade: "alta",
      mensagem:
        "A automação desta conta foi suspensa após falhas seguidas. Revise em Regras de automação.",
    });
  }
  await audit(admin, {
    acao: "publicacao_falhou",
    alvo: post.id,
    resultado: "erro",
    detalhes: { erro: msg.slice(0, 300) },
  });
  return "falhou";
}

async function wait(admin: Admin, post: Post, etapa: string): Promise<string> {
  await update(admin, post.id, { etapa, locked_until: null, proxima_tentativa: addMinutes(1) });
  return "processando";
}

async function containerParams(
  admin: Admin,
  post: Post,
  token: string,
): Promise<Record<string, string>> {
  const p: Record<string, string> = { access_token: token };
  const caption = post.legenda ?? "";
  if (post.tipo === "carrossel") {
    return {
      ...p,
      media_type: "CAROUSEL",
      children: post.children_container_ids.join(","),
      caption,
    };
  }
  const [asset] = await loadAssets(admin, post.media_asset_ids.slice(0, 1));
  if (!asset?.public_url) throw new PermanentError("A publicação não tem mídia.");
  if (post.tipo === "imagem") {
    if (asset.tipo !== "imagem")
      throw new PermanentError("Publicação de imagem precisa de uma imagem JPEG.");
    return {
      ...p,
      image_url: asset.public_url,
      caption,
      ...(post.alt_text ? { alt_text: post.alt_text } : {}),
    };
  }
  if (post.tipo === "reels") {
    if (asset.tipo !== "video") throw new PermanentError("Reels precisa de um vídeo.");
    const out: Record<string, string> = {
      ...p,
      media_type: "REELS",
      video_url: asset.public_url,
      caption,
      share_to_feed: String(post.share_to_feed),
    };
    if (post.capa_asset_id) {
      const [capa] = await loadAssets(admin, [post.capa_asset_id]);
      if (capa?.public_url) out["cover_url"] = capa.public_url;
    }
    return out;
  }
  // Story: no caption on stories.
  return asset.tipo === "video"
    ? { ...p, media_type: "STORIES", video_url: asset.public_url }
    : { ...p, media_type: "STORIES", image_url: asset.public_url };
}

export type Ctx = { igUserId: string; token: string; graph: string };

export async function accountContext(admin: Admin, accountId: string): Promise<Ctx | null> {
  const { data: acc } = await admin
    .from("instagram_accounts")
    .select("ig_user_id, page_id, connection_id")
    .eq("id", accountId)
    .maybeSingle();
  if (!acc?.connection_id) return null;
  const {data:connection}=await admin.from("meta_connections")
    .select("login_provider").eq("id",acc.connection_id).maybeSingle();
  if ((connection as any)?.login_provider==="instagram") {
    const token=await getUserToken(admin,acc.connection_id);
    if (!token) return null;
    return {igUserId:acc.ig_user_id,token,graph:"https://graph.instagram.com/v26.0"};
  }
  // Preservar o comportamento original do Gestor 2.0 para Facebook Login.
  if(!acc.page_id)return null;
  const token=await getPageToken(admin,acc.connection_id,acc.page_id);
  if(!token)return null;
  return {igUserId:acc.ig_user_id,token,graph:metaConfig().graph};
}

async function containerStatus(
  ctx: Ctx,
  containerId: string,
): Promise<{ code: ContainerStatus; detail: string | null }> {
  const r = await graphGet<{ status_code: ContainerStatus; status?: string }>(
    `${ctx.graph}/${containerId}`,
    {
      fields: "status_code,status",
      access_token: ctx.token,
    },
  );
  return { code: r.status_code, detail: r.status ?? null };
}

async function loadAssets(admin: Admin, ids: string[]): Promise<Asset[]> {
  if (!ids.length) return [];
  const { data } = await admin.from("media_assets").select("*").in("id", ids);
  const byId = new Map((data ?? []).map((a) => [a.id, a]));
  const ordered = ids.map((id) => byId.get(id)).filter((a): a is Asset => !!a);
  if (ordered.length !== ids.length)
    throw new PermanentError("Uma das mídias da publicação não existe mais.");
  return ordered;
}

async function update(
  admin: Admin,
  id: string,
  values: Database["public"]["Tables"]["posts"]["Update"],
) {
  const { error } = await admin.from("posts").update(values).eq("id", id);
  if (error) throw new Error(`Falha ao salvar o estado do post: ${error.message}`);
}

async function logEvent(
  admin: Admin,
  postId: string,
  etapa: string,
  resultado: string,
  detalhe?: string | null,
) {
  await admin.from("post_events").insert({
    post_id: postId,
    etapa,
    resultado,
    detalhe: detalhe ? detalhe.slice(0, 1000) : null,
  });
}

function addMinutes(min: number) {
  return new Date(Date.now() + min * 60_000).toISOString();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Posts waiting too long for approval, or stuck in processing, become alerts (deduplicated). */
async function queueHealthAlerts(admin: Admin) {
  const { data: pend } = await admin
    .from("posts")
    .select("id, instagram_account_id, titulo, legenda, updated_at, status")
    .in("status", ["aguardando_aprovacao", "processando"]);
  const { data: openAlerts } = await admin
    .from("alerts")
    .select("chave, tipo, instagram_account_id")
    .in("tipo", ["aprovacao_pendente", "fila_atrasada"])
    .eq("resolvido", false);
  const ativos = new Set((pend ?? []).map((p) => `${p.status}:${p.id}`));
  for (const a of openAlerts ?? []) {
    const st = a.tipo === "aprovacao_pendente" ? "aguardando_aprovacao" : "processando";
    if (!ativos.has(`${st}:${a.chave}`))
      await resolveAlerts(admin, a.instagram_account_id, a.tipo, a.chave);
  }
  for (const p of pend ?? []) {
    const horas = (Date.now() - new Date(p.updated_at).getTime()) / 3600_000;
    const nome = p.titulo || (p.legenda ?? "").slice(0, 40) || p.id;
    if (p.status === "aguardando_aprovacao") {
      const limite = (await limitsFor(admin, p.instagram_account_id)).aprovacao_horas;
      if (horas >= limite)
        await raiseAlert(admin, {
          instagram_account_id: p.instagram_account_id,
          tipo: "aprovacao_pendente",
          chave: p.id,
          severidade: "media",
          mensagem: `"${nome}" aguarda aprovação há mais de ${limite}h.`,
        });
    } else if (horas >= 2) {
      await raiseAlert(admin, {
        instagram_account_id: p.instagram_account_id,
        tipo: "fila_atrasada",
        chave: p.id,
        severidade: "alta",
        mensagem: `"${nome}" está em processamento há mais de 2 horas.`,
      });
    }
  }
}

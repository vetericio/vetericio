import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateAssistant, jsonError, resolveAccount } from "@/lib/server/assistant.server";
import { postSchema } from "@/lib/post-schema";

// Assistant API for posts.
// GET  ?status=agendado,processando  → lists posts (to avoid duplicates and report back).
// POST { conta: "@user", ...post fields } → saves a draft, schedules or publishes now, with the same
//      rules as the editor. Outside the "assistido" mode the assistant's schedules are auto-approved.
export const Route = createFileRoute("/api/public/assistente/posts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateAssistant(request);
        if (auth instanceof Response) return auth;
        const statuses = (
          new URL(request.url).searchParams.get("status") ??
          "agendado,processando,aguardando_aprovacao"
        )
          .split(",")
          .filter(Boolean)
          .slice(0, 8);
        const { data, error } = await auth.admin
          .from("posts")
          .select(
            "id, instagram_account_id, tipo, titulo, campanha, status, agendado_para, publicado_em, permalink, ultimo_erro, legenda",
          )
          .in("status", statuses)
          .order("agendado_para", { ascending: true })
          .limit(200);
        if (error) return jsonError(error.message, 500);
        const { data: settings } = await auth.admin
          .from("app_settings")
          .select("pausa_geral, modo_autonomia")
          .eq("id", true)
          .maybeSingle();
        return Response.json({ ok: true, settings, posts: data });
      },
      POST: async ({ request }) => {
        const auth = await authenticateAssistant(request);
        if (auth instanceof Response) return auth;
        try {
          const raw = (await request.json()) as Record<string, unknown>;
          const { conta, ...rest } = z
            .object({ conta: z.string().min(1).max(64) })
            .passthrough()
            .parse(raw);
          const account = await resolveAccount(auth.admin, conta);
          const data = postSchema.parse({
            titulo: null,
            campanha: null,
            legenda: null,
            alt_text: null,
            capa_asset_id: null,
            share_to_feed: true,
            agendado_para: null,
            ...rest,
            instagram_account_id: account.id,
          });
          const { savePostCore } = await import("@/lib/server/posts.server");
          return Response.json({ ok: true, ...(await savePostCore(auth.admin, auth.actor, data)) });
        } catch (e) {
          if (e instanceof z.ZodError)
            return jsonError(
              new Error(e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")),
            );
          return jsonError(e);
        }
      },
    },
  },
});

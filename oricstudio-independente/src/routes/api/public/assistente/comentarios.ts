import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateAssistant, jsonError, resolveAccount } from "@/lib/server/assistant.server";

// Assistant API for comment replies. The assistant only writes SUGGESTIONS: publishing a reply
// still needs a person to press "Responder" in the panel.
// GET  ?conta=@user  → unanswered, unarchived comments with the post caption and brand context.
// POST { id, sugestao } → stores a tailored suggestion (sugestao_por = 'assistente').
export const Route = createFileRoute("/api/public/assistente/comentarios")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateAssistant(request);
        if (auth instanceof Response) return auth;
        try {
          const conta = new URL(request.url).searchParams.get("conta");
          let q = auth.admin
            .from("comments")
            .select(
              "id, instagram_account_id, ig_media_id, parent_ig_comment_id, autor, texto, publicado_em, categoria, precisa_humano, motivo_humano, resposta_sugerida, sugestao_por",
            )
            .eq("respondido", false)
            .eq("arquivado", false)
            .order("publicado_em", { ascending: false })
            .limit(100);
          if (conta) q = q.eq("instagram_account_id", (await resolveAccount(auth.admin, conta)).id);
          const { data: comments, error } = await q;
          if (error) throw new Error(error.message);
          const mediaIds = [
            ...new Set((comments ?? []).map((c) => c.ig_media_id).filter((x): x is string => !!x)),
          ];
          const accIds = [...new Set((comments ?? []).map((c) => c.instagram_account_id))];
          const [{ data: media }, { data: accounts }, { data: brands }] = await Promise.all([
            mediaIds.length
              ? auth.admin
                  .from("ig_media")
                  .select("ig_media_id, caption, permalink")
                  .in("ig_media_id", mediaIds)
              : Promise.resolve({ data: [] as any[] }),
            accIds.length
              ? auth.admin.from("instagram_accounts").select("id, username").in("id", accIds)
              : Promise.resolve({ data: [] as any[] }),
            accIds.length
              ? auth.admin
                  .from("brands")
                  .select("instagram_account_id, nome_marca, tom_de_voz, contato_resposta")
                  .in("instagram_account_id", accIds)
              : Promise.resolve({ data: [] as any[] }),
          ]);
          return Response.json({ ok: true, comments, media, accounts, brands });
        } catch (e) {
          return jsonError(e);
        }
      },
      POST: async ({ request }) => {
        const auth = await authenticateAssistant(request);
        if (auth instanceof Response) return auth;
        try {
          const body = z
            .object({ id: z.string().uuid(), sugestao: z.string().trim().min(1).max(2200) })
            .parse(await request.json());
          const { data, error } = await auth.admin
            .from("comments")
            .update({ resposta_sugerida: body.sugestao, sugestao_por: "assistente" })
            .eq("id", body.id)
            .eq("respondido", false)
            .select("id")
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) throw new Error("Comentário não encontrado ou já respondido.");
          return Response.json({ ok: true });
        } catch (e) {
          if (e instanceof z.ZodError)
            return jsonError(new Error(e.issues.map((i) => i.message).join("; ")));
          return jsonError(e);
        }
      },
    },
  },
});

import { z } from "zod";

// Shared by the editor's server functions and the assistant API.
export const postSchema = z.object({
  id: z.string().uuid().optional(),
  instagram_account_id: z.string().uuid(),
  tipo: z.enum(["imagem", "carrossel", "reels", "story"]),
  titulo: z.string().trim().max(120).nullable(),
  campanha: z.string().trim().max(120).nullable(),
  legenda: z.string().max(2200).nullable(),
  alt_text: z.string().max(1000).nullable(),
  media_asset_ids: z.array(z.string().uuid()).max(20),
  capa_asset_id: z.string().uuid().nullable(),
  share_to_feed: z.boolean(),
  agendado_para: z.string().datetime().nullable(),
  acao: z.enum(["rascunho", "agendar", "publicar_agora"]),
});

export type PostInput = z.infer<typeof postSchema>;
export const EDITAVEIS = ["rascunho", "aguardando_aprovacao", "agendado", "falhou"];

export function validateContent(
  p: PostInput,
  assets: { id: string; tipo: string }[],
): string | null {
  const n = p.media_asset_ids.length;
  const tipos = p.media_asset_ids.map((id) => assets.find((a) => a.id === id)?.tipo);
  if (tipos.some((t) => !t)) return "Uma das mídias não existe.";
  if (p.tipo === "imagem" && (n !== 1 || tipos[0] !== "imagem"))
    return "Publicação de imagem precisa de exatamente 1 imagem.";
  if (p.tipo === "carrossel" && (n < 2 || n > 20)) return "Carrossel precisa de 2 a 20 itens.";
  if (p.tipo === "reels" && (n !== 1 || tipos[0] !== "video"))
    return "Reels precisa de exatamente 1 vídeo.";
  if (p.tipo === "story" && n !== 1) return "Story precisa de exatamente 1 imagem ou vídeo.";
  const legenda = p.legenda ?? "";
  if ((legenda.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > 30)
    return "A legenda tem mais de 30 hashtags (limite do Instagram).";
  if ((legenda.match(/(?<![\w.])@[\w.]+/g) ?? []).length > 20)
    return "A legenda tem mais de 20 menções (limite do Instagram).";
  return null;
}

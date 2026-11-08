import { describe, expect, it } from "vitest";
import { analyze, type MediaInput } from "@/lib/analysis";
import { classify, suggestReply } from "@/lib/comment-classifier";
import { taxaInteracao, variacao } from "@/lib/metrics";

const media = (
  i: number,
  reach: number,
  inter: number,
  over: Partial<MediaInput> = {},
): MediaInput => ({
  ig_media_id: `m${i}`,
  publicado_em: new Date(Date.UTC(2026, 9, 1 + i, 22)).toISOString(),
  media_type: "IMAGE",
  media_product_type: "FEED",
  caption: `Post ${i}`,
  permalink: null,
  insights: { reach, total_interactions: inter },
  ...over,
});

describe("cálculos", () => {
  it("taxa de interação e variação não dividem por zero", () => {
    expect(taxaInteracao(10, 200)).toBe(5);
    expect(taxaInteracao(10, 0)).toBeNull();
    expect(taxaInteracao(null, 100)).toBeNull();
    expect(variacao(120, 100)).toBe(20);
    expect(variacao(5, 0)).toBeNull();
  });
});

describe("análise estratégica", () => {
  it("com poucos dados avisa e não conclui", () => {
    const r = analyze({ media: [media(1, 100, 5), media(2, 80, 4)], daily: [] });
    expect(r.recomendacoes).toHaveLength(0);
    expect(r.avisos[0]).toMatch(/ao menos 5/);
  });

  it("aponta publicações acima da média com dados e confiança", () => {
    const ms = [
      media(1, 100, 5),
      media(2, 100, 5),
      media(3, 100, 5),
      media(4, 100, 5),
      media(5, 100, 30),
    ];
    const r = analyze({ media: ms, daily: [] });
    const acima = r.recomendacoes.find((x) => x.id === "acima-media");
    expect(acima?.dados).toContain("Post 5");
    expect(acima?.confianca).toBe("baixa");
  });

  it("compara formatos só com amostra mínima", () => {
    const reels = [6, 7, 8].map((i) =>
      media(i, 1000, 50, { media_product_type: "REELS", media_type: "VIDEO" }),
    );
    const feed = [1, 2, 3].map((i) => media(i, 200, 10));
    const r = analyze({ media: [...reels, ...feed], daily: [] });
    expect(r.recomendacoes.find((x) => x.id === "formato")?.titulo).toMatch(/Reels/);
  });
});

describe("classificação de comentários", () => {
  it("encaminha casos sensíveis e reclamações para humano", () => {
    expect(classify("Vou entrar com processo no Procon").categoria).toBe("sensivel");
    expect(classify("Meu pedido não chegou até hoje").precisaHumano).toBe(true);
  });
  it("identifica oportunidade, pergunta e elogio", () => {
    expect(classify("Quanto fica o cachê pra um casamento?").categoria).toBe("oportunidade");
    expect(classify("Vocês vão lançar música nova?").categoria).toBe("pergunta");
    expect(classify("Que som incrível 🔥").categoria).toBe("elogio");
  });
  it("não sugere resposta para comentário sensível", () => {
    expect(suggestReply("sensivel", "x", "(31) 9999")).toBeNull();
    expect(suggestReply("pergunta", "ana", "no WhatsApp (31) 99223-3295")).toContain("@ana");
  });
});

describe("sugestões de resposta", () => {
  it("reconhece elogios curtos e sugere agradecimento em comentários genéricos", async () => {
    const { classify, suggestReply } = await import("@/lib/comment-classifier");
    expect(classify("Bravo!").categoria).toBe("elogio");
    expect(suggestReply("outro", "ana", null)).toBe("Valeu pelo comentário, @ana! 🙌");
  });
  it("não pede resposta da marca em conversa entre seguidores", async () => {
    const { needsBrandReply } = await import("@/lib/comment-classifier");
    expect(needsBrandReply("🔥🔥@lsantana65", true, "minha_conta")).toBe(false);
    expect(needsBrandReply("@minha_conta quando é o próximo?", true, "minha_conta")).toBe(true);
    expect(needsBrandReply("Que show", false, "minha_conta")).toBe(true);
  });
});

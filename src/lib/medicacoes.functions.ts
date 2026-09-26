import { createServerFn } from "@tanstack/react-start";
import type { Medicacao } from "./ficha";

/**
 * Leitura de receitas por IA (visão). Recebe a imagem em base64 (data URL)
 * e devolve as medicações separadas em nome, dose e duração.
 */

const INSTRUCAO = `Você lê receitas e prescrições veterinárias em português.
Extraia TODAS as medicações da imagem. Para cada uma devolva:
- nome: nome do medicamento com a grafia correta e completa (expanda abreviações, ex.: "dipi" -> "Dipirona")
- dose: transcreva a quantidade/volume exatamente como aparece (ex.: "0,5 mL", "1 cp"). NÃO transforme mL em mg/kg e NÃO invente dose.
- duracao: coloque a FREQUÊNCIA quando aparecer (ex.: "8/8h", "12/12h", "24/24h"). Se houver também duração do tratamento, preserve depois da frequência. Vazio se não houver.
IMPORTANTE: números em mL são volume a ministrar. O aplicativo fará depois o cálculo inverso da dose usando peso e concentração cadastrados.
Responda APENAS com JSON no formato {"medicacoes":[{"nome":"","dose":"","duracao":""}]}.
Se não conseguir ler nada, devolva {"medicacoes":[]}.`;

type Resultado = { medicacoes: Medicacao[] };

export const lerReceitaComIA = createServerFn({ method: "POST" })
  .inputValidator((data: { imagem: string }) => {
    if (typeof data?.imagem !== "string" || !data.imagem.startsWith("data:image/")) {
      throw new Error("Imagem inválida");
    }
    return data;
  })
  .handler(async ({ data }): Promise<Resultado> => {
    const chave = process.env["LOVABLE_API_KEY"];
    if (!chave) throw new Error("IA não configurada");

    const corpo = {
      model: "google/gemini-3.7-flash",
      messages: [
        { role: "system", content: INSTRUCAO },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia as medicações desta imagem." },
            { type: "image_url", image_url: { url: data.imagem } },
          ],
        },
      ],
      response_format: { type: "json_object" as const },
    };

    let ultima = "";
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${chave}`,
        },
        body: JSON.stringify(corpo),
      });

      if (resposta.ok) {
        const json = (await resposta.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const texto = json.choices?.[0]?.message?.content ?? "";
        return { medicacoes: extrair(texto) };
      }

      const detalhe = await resposta.text();
      ultima = `IA ${resposta.status}: ${detalhe.slice(0, 300)}`;

      if (resposta.status === 429 || resposta.status >= 500) {
        const espera = resposta.headers.get("retry-after");
        const ms = espera ? Number(espera) * 1000 : 800 * (tentativa + 1);
        await new Promise((r) => setTimeout(r, Math.min(ms, 4000)));
        continue;
      }
      throw new Error(ultima);
    }
    throw new Error(ultima || "IA indisponível");
  });

function extrair(texto: string): Medicacao[] {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return [];
  try {
    const bruto = JSON.parse(texto.slice(inicio, fim + 1)) as {
      medicacoes?: { nome?: unknown; dose?: unknown; duracao?: unknown }[];
    };
    return (bruto.medicacoes ?? [])
      .map((m) => ({
        nome: String(m.nome ?? "").trim(),
        dose: String(m.dose ?? "").trim(),
        duracao: String(m.duracao ?? "").trim(),
      }))
      .filter((m) => m.nome || m.dose);
  } catch {
    return [];
  }
}

// Rule-based comment triage (PT-BR keywords). It only sorts and suggests; sensitive cases and
// complaints are always routed to a human, and nothing here is sent without the configured rules.

export type Categoria =
  "sensivel" | "reclamacao" | "oportunidade" | "pergunta" | "elogio" | "outro";

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const SENSIVEL = [
  "processo",
  "advogad",
  "procon",
  "justica",
  "judicial",
  "policia",
  "boletim de ocorrencia",
  "golpe",
  "fraude",
  "estelionat",
  "calote",
  "roubo",
  "roubaram",
  "denunci",
  "ameac",
  "vou expor",
  "racis",
  "homofob",
  "machis",
  "assedi",
  "abuso",
  "agress",
  "suicid",
  "morte",
  "morreu",
  "violencia",
];
const RECLAMACAO = [
  "nao chegou",
  "atras",
  "defeito",
  "quebrad",
  "estragad",
  "pessim",
  "horrivel",
  "ruim demais",
  "reclam",
  "decepcion",
  "devolu",
  "reembols",
  "estorno",
  "nao respond",
  "ninguem respond",
  "cancelar",
  "cancelad",
  "enganad",
  "propaganda enganosa",
  "absurdo",
  "vergonha",
  "descaso",
];
const OPORTUNIDADE = [
  "contrat",
  "orcamento",
  "cache",
  "valor do show",
  "quanto custa",
  "quanto fica",
  "preco",
  "valor",
  "data disponivel",
  "agenda",
  "evento",
  "festa",
  "casamento",
  "aniversario",
  "formatura",
  "bar ",
  "toca em",
  "tocar em",
  "show em",
  "show na",
  "show no",
  "comprar",
  "compro",
  "quero um",
  "quero uma",
  "frete",
  "entrega",
  "tamanho",
  "tem disponivel",
  "estoque",
  "loja",
  "pix",
];
const PERGUNTA_INICIO = [
  "quanto",
  "qual",
  "quais",
  "como",
  "onde",
  "quando",
  "tem ",
  "voces",
  "vcs",
  "pode",
  "posso",
  "da pra",
  "e possivel",
];
const ELOGIO = [
  "bravo",
  "excelente",
  "que show",
  "showzaco",
  "irado",
  "monstro",
  "boa demais",
  "top",
  "demais",
  "incrivel",
  "sensacional",
  "parabens",
  "lindo",
  "linda",
  "massa",
  "foda",
  "brabo",
  "braba",
  "amei",
  "amo",
  "perfeit",
  "maravilh",
  "show de bola",
  "que som",
  "melhor",
  "sucesso",
  "arrasou",
  "arrasa",
];
const ELOGIO_EMOJI =
  /[\u{1F525}\u{2764}\u{1F44F}\u{1F60D}\u{1F918}\u{1F64C}\u{1F49C}\u{1F5A4}\u{1F929}\u{2728}]/u;

export function classify(text: string): {
  categoria: Categoria;
  precisaHumano: boolean;
  motivo: string | null;
} {
  const t = norm(text);
  const has = (list: string[]) => list.find((k) => t.includes(k));
  const s = has(SENSIVEL);
  if (s) return { categoria: "sensivel", precisaHumano: true, motivo: `Termo sensível: “${s}”` };
  const r = has(RECLAMACAO);
  if (r)
    return { categoria: "reclamacao", precisaHumano: true, motivo: `Possível reclamação: “${r}”` };
  const isQuestion = t.includes("?") || PERGUNTA_INICIO.some((p) => t.trimStart().startsWith(p));
  if (has(OPORTUNIDADE)) return { categoria: "oportunidade", precisaHumano: false, motivo: null };
  if (isQuestion) return { categoria: "pergunta", precisaHumano: false, motivo: null };
  if (has(ELOGIO) || ELOGIO_EMOJI.test(text))
    return { categoria: "elogio", precisaHumano: false, motivo: null };
  return { categoria: "outro", precisaHumano: false, motivo: null };
}

/** Short reply suggestion in a neutral, friendly tone. Never for sensitive comments. */
export function suggestReply(
  categoria: Categoria,
  username: string | null,
  contato: string | null,
): string | null {
  const at = username ? `@${username} ` : "";
  const fale = contato
    ? ` Chama a gente ${contato.trim()} que respondemos com todos os detalhes.`
    : " Manda uma mensagem pra gente que respondemos com todos os detalhes.";
  switch (categoria) {
    case "elogio":
      return `${at}valeu demais pelo carinho! 🙌`.trim();
    case "pergunta":
      return `Oi ${at}obrigado pela pergunta!${fale}`.replace("  ", " ");
    case "oportunidade":
      return `Oi ${at}que bom o seu interesse!${fale}`.replace("  ", " ");
    case "reclamacao":
      return `Oi ${at}sentimos muito por isso. Queremos resolver:${fale.replace(" que respondemos com todos os detalhes", "")}`.replace(
        "  ",
        " ",
      );
    case "outro":
      return `Valeu pelo comentário, ${at}`.trim().replace(/,$/, "") + "! 🙌";
    default:
      return null;
  }
}

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  sensivel: "Sensível",
  reclamacao: "Reclamação",
  oportunidade: "Oportunidade comercial",
  pergunta: "Pergunta",
  elogio: "Elogio",
  outro: "Outro",
};

/**
 * A reply inside someone else's thread that doesn't mention the account is a conversation between
 * followers: it usually needs no answer from the brand, so no suggestion is made.
 */
export function needsBrandReply(
  text: string,
  isThreadReply: boolean,
  accountUsername: string | null,
) {
  if (!isThreadReply) return true;
  return !!accountUsername && text.toLowerCase().includes(`@${accountUsername.toLowerCase()}`);
}

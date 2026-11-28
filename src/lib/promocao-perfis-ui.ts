export type OfertaPerfis =
  | { tipo: "padrao" }
  | { tipo: "extras_gratis"; perfisBase: number; extrasGratis: number; prazo: string }
  | { tipo: "ilimitado"; prazo: string };

export function formatarPrazoOferta(data: string) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "";
}

export function tituloOfertaPerfis(oferta: OfertaPerfis) {
  if (oferta.tipo === "ilimitado") return "Perfis ilimitados sem acréscimo";
  if (oferta.tipo === "extras_gratis") {
    const total = oferta.perfisBase + oferta.extrasGratis;
    return `${total} perfis incluídos`;
  }
  return null;
}

export function descricaoOfertaPerfis(oferta: OfertaPerfis) {
  if (oferta.tipo === "padrao") return null;
  const prazo = formatarPrazoOferta(oferta.prazo);
  if (!prazo) return null;
  const beneficio =
    oferta.tipo === "ilimitado"
      ? "Adicione perfis sem acréscimo."
      : `${oferta.extrasGratis} perfis extras grátis, além do que o plano já inclui.`;
  return `${beneficio} Contrate até ${prazo}. O benefício começa na ativação e vale enquanto a assinatura elegível permanecer ativa.`;
}

export type CampanhaPerfis =
  { ativa: false; id: null } | { ativa: true; id: string; prazo: string; essencialBonus: number };

export function planoParticipanteDaCampanha(plano: string) {
  return plano === "essencial-2026" || plano === "profissional-2026" || plano === "master-2026";
}

export function lerCampanhaPerfis(valor: unknown): CampanhaPerfis {
  const objeto = Array.isArray(valor) ? valor[0] : valor;
  if (!objeto || typeof objeto !== "object" || !("ativa" in objeto))
    throw new Error("Condições para perfis não confirmadas.");
  if (objeto.ativa === false) return { ativa: false, id: null };
  const { ativa, id, encerra_em, essencial_bonus } = objeto as Record<string, unknown>;
  if (
    ativa !== true ||
    typeof id !== "string" ||
    !id.trim() ||
    typeof encerra_em !== "string" ||
    !formatarPrazoOferta(encerra_em) ||
    typeof essencial_bonus !== "number" ||
    !Number.isSafeInteger(essencial_bonus) ||
    essencial_bonus <= 0
  ) {
    throw new Error("Condições para perfis não confirmadas.");
  }
  return { ativa: true, id, prazo: encerra_em, essencialBonus: essencial_bonus };
}

export function ofertaDoPlano(
  plano: string,
  perfisBase: number,
  campanha?: CampanhaPerfis,
): OfertaPerfis {
  if (!campanha?.ativa || !planoParticipanteDaCampanha(plano)) return { tipo: "padrao" };
  if (plano === "essencial-2026")
    return {
      tipo: "extras_gratis",
      perfisBase,
      extrasGratis: campanha.essencialBonus,
      prazo: campanha.prazo,
    };
  return { tipo: "ilimitado", prazo: campanha.prazo };
}

export function distribuirPerfis(quantidade: number, perfisBase: number, oferta: OfertaPerfis) {
  const baseSelecionados = Math.min(quantidade, perfisBase);
  const excedentes = Math.max(0, quantidade - perfisBase);
  const extrasGratuitos =
    oferta.tipo === "ilimitado"
      ? excedentes
      : oferta.tipo === "extras_gratis"
        ? Math.min(excedentes, oferta.extrasGratis)
        : 0;
  return {
    baseSelecionados,
    extrasGratuitos,
    extrasCobrados: excedentes - extrasGratuitos,
    inclusosParaResumo:
      oferta.tipo === "extras_gratis" ? perfisBase + oferta.extrasGratis : perfisBase,
  };
}

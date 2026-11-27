import { clienteSupabaseUsuario } from "./permissao-clinica.server.ts";
import type { DadosRelatorio } from "./relatorios.ts";
import {
  limitesDoPeriodoPet,
  montarRelatorioBanho,
  montarRelatorioHotel,
  type AcomodacaoPet,
  type BanhoRegistro,
  type EstadiaPet,
  type EstornoPet,
  type ExtraPet,
  type PagamentoPet,
  type PeriodoPet,
} from "./relatorios-pet.ts";

type EntradaRelatorioPet = PeriodoPet & {
  accessToken: string;
  clinicaId: string;
  codigo: "11" | "12";
  podeVerFinanceiro: boolean;
};
type BancoPet = Pick<ReturnType<typeof clienteSupabaseUsuario>, "from">;

async function paginasPet<T>(
  ler: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const registros: T[] = [];
  const pagina = 500;
  for (let de = 0; de < 20_000; de += pagina) {
    const resposta = await ler(de, de + pagina - 1);
    if (resposta.error || !resposta.data)
      throw new Error("Não foi possível consultar os registros do relatório.");
    registros.push(...resposta.data);
    if (resposta.data.length < pagina) return registros;
  }
  throw new Error("Muitos registros. Reduza o período para consultar este relatório.");
}

export async function gerarRelatorioPet(input: EntradaRelatorioPet): Promise<DadosRelatorio> {
  return consultarRelatorioPet(clienteSupabaseUsuario(input.accessToken), input);
}

// O dispatcher valida a sessão, o piloto, hotelzinho.visualizar e a permissão financeira.
// As consultas continuam a usar o JWT da pessoa e o RLS, nunca a chave de serviço.
export async function consultarRelatorioPet(
  banco: BancoPet,
  { clinicaId, codigo, inicio, fim, podeVerFinanceiro }: Omit<EntradaRelatorioPet, "accessToken">,
  agora = Date.now(),
): Promise<DadosRelatorio> {
  const periodo = { inicio, fim };
  const limites = limitesDoPeriodoPet(periodo);
  const banho = codigo === "11";
  const setores = banho ? ["Banho e tosa", "Banho e Tosa"] : ["Hotelzinho"];
  const data = (campo: string) => `and(${campo}.gte.${limites.inicio},${campo}.lt.${limites.fim})`;

  async function consultarFinanceiro() {
    const [pagamentos, estornos] = await Promise.all([
      paginasPet<PagamentoPet>((de, ate) =>
        banco
          .from("oricse_caixa_lancamentos")
          .select(
            banho
              ? "registrado_em,valor_centavos,forma_pagamento,agendamento_banho_tosa_id"
              : "registrado_em,valor_centavos,forma_pagamento",
          )
          .eq("clinica_id", clinicaId)
          .in("setor", setores)
          .eq("tipo", "entrada")
          .eq("status", "pago")
          .gte("registrado_em", limites.inicio)
          .lt("registrado_em", limites.fim)
          .order("registrado_em")
          .order("id")
          .range(de, ate)
          .overrideTypes<PagamentoPet[], { merge: false }>(),
      ),
      paginasPet<EstornoPet>((de, ate) =>
        banco
          .from("oricse_caixa_estornos")
          .select("revisado_em,valor_centavos,origem:oricse_caixa_lancamentos!inner(setor)")
          .eq("clinica_id", clinicaId)
          .eq("origem.clinica_id", clinicaId)
          .in("origem.setor", setores)
          .eq("origem.tipo", "entrada")
          .eq("status", "confirmado")
          .gte("revisado_em", limites.inicio)
          .lt("revisado_em", limites.fim)
          .order("id")
          .range(de, ate),
      ),
    ]);
    return { pagamentos, estornos };
  }

  if (banho) {
    const [registros, financeiro] = await Promise.all([
      paginasPet<BanhoRegistro>((de, ate) =>
        banco
          .from("oricse_banho_tosa_agendamentos")
          .select("id,servico_nome,inicio,status,profissional,pronto_em,entregue_em")
          .eq("clinica_id", clinicaId)
          .or([data("inicio"), data("pronto_em"), data("entregue_em")].join(","))
          .order("inicio")
          .order("id")
          .range(de, ate),
      ),
      podeVerFinanceiro ? consultarFinanceiro() : undefined,
    ]);
    return montarRelatorioBanho(periodo, registros, financeiro);
  }

  const [estadias, acomodacoes, extras, financeiro] = await Promise.all([
    paginasPet<EstadiaPet>((de, ate) => {
      const campos =
        "id,status,acomodacao_id,chegada_prevista,saida_prevista,checkin_em,checkout_em";
      const janelaPrevista = `chegada_prevista.lt.${limites.fim},saida_prevista.gt.${limites.inicio}`;
      return banco
        .from("oricse_hotel_estadias")
        .select(podeVerFinanceiro ? campos + ",valor_final_centavos" : campos)
        .eq("clinica_id", clinicaId)
        .or(
          [
            `and(status.eq.reservada,${janelaPrevista})`,
            `and(status.eq.hospedado,checkin_em.is.null,${janelaPrevista})`,
            `and(status.eq.hospedado,checkin_em.lt.${limites.fim},or(checkout_em.gt.${limites.inicio},checkout_em.is.null))`,
            `and(status.eq.concluida,checkin_em.lt.${limites.fim},checkout_em.gt.${limites.inicio})`,
            `and(status.eq.concluida,checkout_em.gte.${limites.inicio},checkout_em.lt.${limites.fim})`,
          ].join(","),
        )
        .order("id")
        .range(de, ate)
        .overrideTypes<EstadiaPet[], { merge: false }>();
    }),
    paginasPet<AcomodacaoPet>((de, ate) =>
      banco
        .from("oricse_hotel_acomodacoes")
        .select("id,nome")
        .eq("clinica_id", clinicaId)
        .order("id")
        .range(de, ate),
    ),
    paginasPet<ExtraPet>((de, ate) =>
      banco
        .from("oricse_hotel_extras")
        .select(podeVerFinanceiro ? "categoria,quantidade,valor_unitario_centavos" : "categoria")
        .eq("clinica_id", clinicaId)
        .gte("created_at", limites.inicio)
        .lt("created_at", limites.fim)
        .order("id")
        .range(de, ate)
        .overrideTypes<ExtraPet[], { merge: false }>(),
    ),
    podeVerFinanceiro ? consultarFinanceiro() : undefined,
  ]);
  return montarRelatorioHotel(periodo, estadias, acomodacoes, extras, agora, financeiro);
}

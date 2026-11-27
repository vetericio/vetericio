import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clienteSupabaseUsuario } from "@/lib/permissao-clinica.server";
import { diaNoFuso, somarDias, type DadosRelatorio } from "./relatorios";
import {
  categoriaDocumento,
  montarRelatorioDocumentos,
  montarRelatorioMovimentos,
  montarRelatorioReceitas,
  type DocumentoRelatorio,
  type MovimentoRelatorio,
  type ReceitaRelatorio,
} from "./relatorios-documentos";

type Entrada = {
  accessToken: string;
  clinicaId: string;
  codigo: "22" | "23" | "24";
  inicio: string;
  fim: string;
};

type Consulta<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

async function paginar<T>(consultar: (de: number, ate: number) => Consulta<T>): Promise<T[]> {
  const tamanho = 500;
  const resultado: T[] = [];
  for (let de = 0; de < 20_000; de += tamanho) {
    const { data, error } = await consultar(de, de + tamanho - 1);
    if (error || !data) throw new Error("Não foi possível consultar os registros do relatório.");
    resultado.push(...data);
    if (data.length < tamanho) return resultado;
  }
  throw new Error("Muitos registros. Reduza o período do relatório.");
}

async function porLotes<T>(
  valores: Array<string | null>,
  consultar: (ids: string[]) => Promise<T[]>,
  chave: (r: T) => [string, string],
) {
  const ids = [...new Set(valores.filter((v): v is string => v !== null))];
  const mapa = new Map<string, string>();
  for (let de = 0; de < ids.length; de += 100) {
    for (const registro of await consultar(ids.slice(de, de + 100))) {
      const [id, valor] = chave(registro);
      if (!mapa.has(id)) mapa.set(id, valor);
    }
  }
  return mapa;
}

async function registros<T>(consulta: Consulta<T>) {
  const { data, error } = await consulta;
  if (error || !data) throw new Error("Não foi possível consultar os vínculos do relatório.");
  return data;
}

/**
 * Somente após a autorização de clínica/piloto e da permissão específica do relatório.
 * O JWT protege a consulta canônica; o cliente administrativo apenas resolve vínculos
 * mínimos de registros já autorizados que não necessariamente integram o catálogo do cargo.
 */
export async function gerarRelatorioDocumentos({
  accessToken,
  clinicaId,
  codigo,
  inicio,
  fim,
}: Entrada): Promise<DadosRelatorio> {
  const banco = clienteSupabaseUsuario(accessToken);
  if (codigo === "23") {
    // A faixa em UTC inclui a borda do dia no fuso brasileiro. O filtro final usa
    // o fuso histórico de São Paulo para não deslocar operações próximas da meia-noite.
    const movimentos = await paginar<MovimentoRelatorio>((de, ate) =>
      banco
        .from("oricse_historico_estoque")
        .select(
          "id,item_id,item_nome,tipo,quantidade,estoque_anterior,estoque_posterior,registrado_em",
        )
        .eq("clinica_id", clinicaId)
        .gte("registrado_em", inicio + "T00:00:00Z")
        .lt("registrado_em", somarDias(fim, 2) + "T00:00:00Z")
        .order("registrado_em", { ascending: false })
        .order("id")
        .range(de, ate),
    );
    return montarRelatorioMovimentos(
      movimentos.filter((movimento) => {
        const dia = diaNoFuso(movimento.registrado_em);
        return dia >= inicio && dia <= fim;
      }),
    );
  }

  type RegistroVinculado = { animal_id: string; drive_arquivo_id: string | null };
  const nomesAnimais = (linhas: RegistroVinculado[]) =>
    porLotes(
      linhas.map((r) => r.animal_id),
      (ids) =>
        registros(
          supabaseAdmin
            .from("oricse_animais")
            .select("id,nome")
            .eq("clinica_id", clinicaId)
            .in("id", ids),
        ),
      (r) => [r.id, r.nome],
    );
  const registrosPdf = (linhas: RegistroVinculado[]) =>
    porLotes(
      linhas.map((r) => r.drive_arquivo_id),
      (ids) =>
        registros(
          supabaseAdmin
            .from("drive_arquivos")
            .select("id,entidade_id")
            .eq("clinica_id", clinicaId)
            .eq("entidade_tipo", "animal")
            .eq("mime_type", "application/pdf")
            .not("entidade_id", "is", null)
            .in("id", ids),
        ),
      (r) => [r.id, r.entidade_id || ""],
    );
  if (codigo === "24") {
    const documentos = (
      await paginar<DocumentoRelatorio>((de, ate) =>
        banco
          .from("oricse_portal_documentos")
          .select("id,animal_id,titulo,tipo,data_documento,visivel_tutor,drive_arquivo_id")
          .eq("clinica_id", clinicaId)
          .is("excluido_em", null)
          .gte("data_documento", inicio)
          .lte("data_documento", fim)
          .order("data_documento", { ascending: false })
          .order("id")
          .range(de, ate),
      )
    ).filter((d) => categoriaDocumento(d.tipo, d.titulo));
    const [animais, pdfs] = await Promise.all([nomesAnimais(documentos), registrosPdf(documentos)]);
    return montarRelatorioDocumentos(documentos, animais, pdfs);
  }

  const receitas = await paginar<ReceitaRelatorio>((de, ate) =>
    banco
      .from("oricse_portal_receitas")
      .select(
        "id,animal_id,tutor_id,drive_arquivo_id,emitida_em,numero,titulo,tipo,resumo,visivel_tutor,prescritor_nome,prescritor_crmv",
      )
      .eq("clinica_id", clinicaId)
      .is("excluido_em", null)
      .gte("emitida_em", inicio)
      .lte("emitida_em", fim)
      .order("emitida_em", { ascending: false })
      .order("id")
      .range(de, ate),
  );
  const hoje = diaNoFuso(new Date().toISOString());
  const [animais, tutores, consultas, pdfs, clinicas] = await Promise.all([
    nomesAnimais(receitas),
    porLotes(
      receitas.map((r) => r.tutor_id),
      (ids) =>
        registros(
          supabaseAdmin.from("tutores").select("id,nome").eq("clinica_id", clinicaId).in("id", ids),
        ),
      (r) => [r.id, r.nome],
    ),
    porLotes(
      receitas.map((r) => r.animal_id),
      (ids) =>
        paginar((de, ate) =>
          supabaseAdmin
            .from("oricse_animal_registros_extra")
            .select("animal_id,data")
            .eq("clinica_id", clinicaId)
            .in("animal_id", ids)
            .eq("tipo", "Registros clínicos")
            .eq("titulo", "Consulta")
            .not("dados_atendimento", "is", null)
            .lte("data", hoje)
            .order("data", { ascending: false })
            .order("id")
            .range(de, ate),
        ),
      (r) => [r.animal_id, r.data],
    ),
    registrosPdf(receitas),
    registros(supabaseAdmin.from("clinicas").select("nome").eq("id", clinicaId).limit(1)),
  ]);
  return montarRelatorioReceitas({
    receitas,
    animais,
    tutores,
    consultas,
    pdfs,
    clinica: clinicas[0]?.nome || "Clínica selecionada",
  });
}

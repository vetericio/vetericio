import type { clienteSupabaseUsuario } from "./permissao-clinica.server.ts";
import type { executarDriveDbInterno } from "./drive-db.functions";
import { limitesDoPeriodoPet } from "./relatorios-pet.ts";
import { periodoValido, somarDias, type DadosRelatorio } from "./relatorios.ts";
import {
  envioCrmNoPeriodo,
  noPeriodoGestao,
  montarRelatorioAuditoria,
  montarRelatorioContratacao,
  montarRelatorioRelacionamento,
  type AssinaturaGestao,
  type CampanhaGestao,
  type ContratacaoGestao,
  type EnvioCrmGestao,
  type EstoqueGestao,
  type OrigemTutorGestao,
  type PeriodoGestao,
  type PermissaoGestao,
  type SiteGestao,
  type StudioEnvioGestao,
  type StudioRevisaoGestao,
} from "./relatorios-gestao.ts";

type EntradaGestao = PeriodoGestao & {
  accessToken: string;
  clinicaId: string;
  codigo: "27" | "29" | "30";
};
type BancoGestao = ReturnType<typeof clienteSupabaseUsuario>;
type FontesGestao = {
  usuario: Pick<BancoGestao, "from" | "rpc">;
  admin: Pick<BancoGestao, "from">;
  drive: typeof executarDriveDbInterno;
};

const pagina = 500;
const maxRegistros = 20_000;
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const erroConsulta = () => new Error("Não foi possível consultar as fontes deste relatório.");
const erroLimite = () =>
  new Error("Muitos registros. Reduza o período para consultar este relatório.");

async function paginar<T>(
  ler: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const itens: T[] = [];
  for (let de = 0; de <= maxRegistros; de += pagina) {
    const { data, error } = await ler(de, de + pagina - 1);
    if (error || !data) throw erroConsulta();
    itens.push(...data);
    if (itens.length > maxRegistros) throw erroLimite();
    if (data.length < pagina) return itens;
  }
  throw erroLimite();
}

async function umaLinha<T>(ler: PromiseLike<{ data: T | null; error: unknown }>) {
  const { data, error } = await ler;
  if (error) throw erroConsulta();
  return data;
}

// Somente pelo dispatcher: login, vínculo ativo, clínica-piloto e permissão do relatório
// antes da consulta. O JWT/RLS também controla cada fonte secundária.
export async function gerarRelatorioGestao(input: EntradaGestao): Promise<DadosRelatorio> {
  const [{ clienteSupabaseUsuario }, { supabaseAdmin }, { executarDriveDbInterno }] =
    await Promise.all([
      import("./permissao-clinica.server.ts"),
      import("@/integrations/supabase/client.server"),
      import("./drive-db.functions"),
    ]);
  return consultarRelatorioGestao(
    {
      usuario: clienteSupabaseUsuario(input.accessToken),
      admin: supabaseAdmin,
      drive: executarDriveDbInterno,
    },
    input,
  );
}

export async function consultarRelatorioGestao(
  { usuario, admin, drive }: FontesGestao,
  { accessToken, clinicaId, codigo, inicio, fim }: EntradaGestao,
): Promise<DadosRelatorio> {
  if (!accessToken || !uuid.test(clinicaId) || !periodoValido(inicio, fim)) throw erroConsulta();
  const periodo = { inicio, fim };
  const limites = limitesDoPeriodoPet(periodo);
  const permissao = (permissaoCodigo: string) =>
    permitido("oricse_usuario_pode_permissao", {
      p_clinica_id: clinicaId,
      p_codigo: permissaoCodigo,
    });
  const podeAcessarStudio = () => permitido("oricstudio_pode_acessar", { p_clinica_id: clinicaId });
  const podeGerenciarPermissoes = () =>
    permitido("oricse_pode_gerenciar_permissoes", { p_clinica_id: clinicaId });
  async function permitido(rpc: string, parametros: Record<string, string>) {
    const resultado = await usuario.rpc(rpc, parametros);
    if (resultado.error) throw erroConsulta();
    return resultado.data === true;
  }

  async function lerDrive<T>(
    table: "oricse_crm_eventos" | "oricse_permissoes_usuario",
    columns: string,
    colunaData: "enviado_em" | "atualizado_em",
    order: Parameters<typeof drive>[0]["order"],
    adicionais: Parameters<typeof drive>[0]["filters"] = [],
  ): Promise<T[]> {
    // Drive compara strings. Use margem e recorte pelo dia civil depois,
    // para preservar datas legadas sem milissegundos ou com offset.
    const resultado = await drive({
      accessToken,
      table,
      columns,
      order,
      operation: "select",
      filters: [
        { kind: "eq", column: "clinica_id", value: clinicaId },
        { kind: "gte", column: colunaData, value: somarDias(inicio, -1) },
        { kind: "lt", column: colunaData, value: somarDias(fim, 2) },
        ...adicionais,
      ],
      range: [0, maxRegistros],
      single: "none",
      head: false,
      count: null,
    }).catch(() => {
      throw erroConsulta();
    });
    if (resultado.error || !Array.isArray(resultado.data)) throw erroConsulta();
    if (resultado.data.length > maxRegistros) throw erroLimite();
    return resultado.data as T[];
  }

  if (codigo === "27") {
    const colunasEnvio = "id,canal,tipo,status,enviado_em";
    const lerEnviosBanco = () =>
      usuario.from("oricse_crm_eventos").select(colunasEnvio).eq("clinica_id", clinicaId);
    const [campanhas, enviosBanco, enviosDrive, podeTutores, podeSite, podeStudio] =
      await Promise.all([
        paginar<CampanhaGestao>((de, ate) =>
          usuario
            .from("oricse_crm_campanhas")
            .select("status,canal")
            .eq("clinica_id", clinicaId)
            .gte("created_at", limites.inicio)
            .lt("created_at", limites.fim)
            .order("id")
            .range(de, ate),
        ),
        paginar<EnvioCrmGestao>((de, ate) =>
          lerEnviosBanco()
            .eq("status", "enviado")
            .gte("enviado_em", limites.inicio)
            .lt("enviado_em", limites.fim)
            .order("id")
            .range(de, ate),
        ),
        lerDrive<EnvioCrmGestao>(
          "oricse_crm_eventos",
          colunasEnvio,
          "enviado_em",
          [{ column: "id", ascending: true }],
          [{ kind: "eq", column: "status", value: "enviado" }],
        ),
        permissao("recepcao.cadastros.visualizar"),
        permissao("administracao.site"),
        podeAcessarStudio(),
      ]);
    // Mesma precedência da tela do CRM: PostgreSQL substitui o registro de
    // mesmo ID no Drive inclusive se sua versão atual deixou de contar como envio.
    const provenientesDrive = new Map(
      envioCrmNoPeriodo(enviosDrive, periodo)
        .filter((e) => typeof e.id === "string" && e.id)
        .map((e) => [e.id, e]),
    );
    for (const e of enviosBanco) provenientesDrive.delete(e.id);
    const idsVerificar = [...provenientesDrive.keys()].filter((id) => uuid.test(id));
    for (let de = 0; de < idsVerificar.length; de += 100) {
      const { data, error } = await lerEnviosBanco().in("id", idsVerificar.slice(de, de + 100));
      if (error || !data) throw erroConsulta();
      for (const e of data) provenientesDrive.delete(e.id);
    }
    const [captacao, site, studio] = await Promise.all([
      podeTutores
        ? paginar<OrigemTutorGestao>((de, ate) =>
            usuario
              .from("tutores")
              .select("origem:dados->>origem")
              .eq("clinica_id", clinicaId)
              .gte("created_at", limites.inicio)
              .lt("created_at", limites.fim)
              .order("id")
              .range(de, ate),
          )
        : Promise.resolve(null),
      podeSite
        ? umaLinha<SiteGestao>(
            usuario
              .from("clinic_sites")
              .select("status,publicado_em")
              .eq("clinica_id", clinicaId)
              .maybeSingle(),
          )
        : Promise.resolve(undefined),
      podeStudio
        ? paginar<StudioEnvioGestao>((de, ate) =>
            usuario
              .from("oricstudio_envios")
              .select("formato")
              .eq("clinica_id", clinicaId)
              .gte("meta_publicacao_confirmada_em", limites.inicio)
              .lt("meta_publicacao_confirmada_em", limites.fim)
              .order("id")
              .range(de, ate),
          )
        : Promise.resolve(null),
    ]);
    return montarRelatorioRelacionamento({
      envios: [...enviosBanco, ...provenientesDrive.values()],
      campanhas,
      captacao,
      site,
      studio,
    });
  }

  if (codigo === "29") {
    // Fontes ORICSE com RLS privativa do admin da plataforma. A sessão
    // autenticada só chega aqui após o gate da clínica + administração.
    // Jamais ler oricse_contratos (global) nem resolver vínculo por nome ou CPF.
    const [contratacoes, assinatura, clinica, podeVerStudio] = await Promise.all([
      paginar<ContratacaoGestao>((de, ate) =>
        admin
          .from("oricse_contratacoes")
          .select("plano_nome,ciclo,status")
          .eq("clinica_criada_id", clinicaId)
          .gte("created_at", limites.inicio)
          .lt("created_at", limites.fim)
          .order("id")
          .range(de, ate),
      ),
      umaLinha<AssinaturaGestao>(
        admin
          .from("oricse_assinaturas")
          .select("plano_codigo,ciclo,status,inicio_em,proximo_vencimento_em")
          .eq("clinica_id", clinicaId)
          .maybeSingle(),
      ),
      umaLinha<{ plano: string | null }>(
        admin.from("clinicas").select("plano").eq("id", clinicaId).maybeSingle(),
      ),
      // Os mesmos papéis de gestão que a RLS de oricstudio_solicitacoes permite.
      podeGerenciarPermissoes(),
    ]);
    let cancelamentosStudio: number | null = null;
    if (podeVerStudio) {
      const { count, error } = await usuario
        .from("oricstudio_solicitacoes")
        .select("id", { head: true, count: "exact" })
        .eq("clinica_id", clinicaId)
        .gte("cancelamento_em", limites.inicio)
        .lt("cancelamento_em", limites.fim);
      if (error || count === null) throw erroConsulta();
      cancelamentosStudio = count;
    }
    if (!clinica) throw erroConsulta();
    return montarRelatorioContratacao(
      contratacoes,
      assinatura,
      clinica.plano,
      cancelamentosStudio,
      periodo,
    );
  }

  if (codigo !== "30" || !(await podeGerenciarPermissoes()))
    throw new Error("Seu cargo não autoriza consultar as regras de acesso da clínica.");
  const [permissoesEquipe, permissoesBanco, podeLerEstoque, podeMovimentarEstoque, podeStudio] =
    await Promise.all([
      // UserPermissionsPanel usa o proxy Drive. Não projetar a identificação
      // do colaborador; mostraremos o PostgreSQL separadamente, sem somar.
      lerDrive<PermissaoGestao & { atualizado_em: string }>(
        "oricse_permissoes_usuario",
        "permissao_codigo,permitido,atualizado_em",
        "atualizado_em",
        [
          { column: "user_id", ascending: true },
          { column: "permissao_codigo", ascending: true },
        ],
      ),
      paginar<PermissaoGestao>((de, ate) =>
        usuario
          .from("oricse_permissoes_usuario")
          .select("permissao_codigo,permitido")
          .eq("clinica_id", clinicaId)
          .gte("atualizado_em", limites.inicio)
          .lt("atualizado_em", limites.fim)
          .order("user_id")
          .order("permissao_codigo")
          .range(de, ate),
      ),
      permissao("estoque.catalogo.visualizar"),
      permissao("estoque.movimentar"),
      podeAcessarStudio(),
    ]);
  const [estoque, studio] = await Promise.all([
    podeLerEstoque || podeMovimentarEstoque
      ? paginar<EstoqueGestao>((de, ate) =>
          usuario
            .from("oricse_historico_estoque")
            .select("tipo")
            .eq("clinica_id", clinicaId)
            .gte("registrado_em", limites.inicio)
            .lt("registrado_em", limites.fim)
            .order("id")
            .range(de, ate),
        )
      : Promise.resolve(null),
    podeStudio
      ? paginar<StudioRevisaoGestao>((de, ate) =>
          usuario
            .from("oricstudio_publicacoes_versoes")
            .select("evento")
            .eq("clinica_id", clinicaId)
            .gte("criado_em", limites.inicio)
            .lt("criado_em", limites.fim)
            .order("id")
            .range(de, ate),
        )
      : Promise.resolve(null),
  ]);
  return montarRelatorioAuditoria(
    permissoesEquipe.filter((regra) => noPeriodoGestao(regra.atualizado_em, periodo)),
    permissoesBanco,
    estoque,
    studio,
  );
}

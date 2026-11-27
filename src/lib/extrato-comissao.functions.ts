import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const entrada = z.object({
  accessToken: z.string().min(20).max(8192),
  clinicaId: z.string().uuid(),
  funcionarioId: z.string().uuid(),
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});
const linha = z.object({
  id: z.string().min(1).max(100),
  clinica_id: z.string().uuid(),
  funcionario_id: z.string().uuid(),
  tipo: z.literal("comissao"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().max(2000),
  valor: z.union([z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/), z.number().positive()]),
});

export const fecharExtratoComissao = createServerFn({ method: "POST" })
  .validator((dados: unknown) => entrada.parse(dados))
  .handler(async ({ data }) => {
    const [
      { supabaseAdmin },
      { exigirPermissaoClinica, clienteSupabaseUsuario },
      { executarDriveDbInterno },
    ] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/permissao-clinica.server"),
      import("@/lib/drive-db.functions"),
    ]);
    const { data: auth, error: authErro } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErro || !auth.user) throw new Error("Faça login para fechar o extrato.");
    const user = clienteSupabaseUsuario(data.accessToken);
    const { data: ativa, error: ativaErro } = await user.rpc("oricse_contexto_clinica_atual");
    if (ativaErro || ativa?.[0]?.clinica_id !== data.clinicaId)
      throw new Error("Selecione a clínica ativa.");
    await exigirPermissaoClinica(
      supabaseAdmin,
      auth.user.id,
      data.clinicaId,
      ["equipe.pagamentos.gerenciar"],
      data.accessToken,
    );
    const hoje = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
    if (data.mes >= hoje) throw new Error("Selecione um mês encerrado.");
    const [ano, mes] = data.mes.split("-").map(Number);
    const inicio = data.mes + "-01";
    const fim = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
    const banco = supabaseAdmin;
    const q = () =>
      banco
        .from("oricse_fechamentos_comissao")
        .select("fechado_em")
        .eq("clinica_id", data.clinicaId)
        .eq("funcionario_id", data.funcionarioId)
        .eq("mes", inicio)
        .maybeSingle();
    const existente = await q();
    if (existente.error) throw new Error("Não foi possível verificar o fechamento.");
    if (existente.data) return { ok: true };

    // A mesma fonte operacional da tela Jornada, lida e validada no servidor.
    const resposta = await executarDriveDbInterno({
      accessToken: data.accessToken,
      table: "oricse_pagamento_lancamentos",
      operation: "select",
      columns: "id,clinica_id,funcionario_id,tipo,data,descricao,valor",
      filters: [
        { kind: "eq", column: "clinica_id", value: data.clinicaId },
        { kind: "eq", column: "funcionario_id", value: data.funcionarioId },
        { kind: "eq", column: "tipo", value: "comissao" },
        { kind: "gte", column: "data", value: inicio },
        { kind: "lt", column: "data", value: fim },
      ],
      order: [
        { column: "data", ascending: true },
        { column: "id", ascending: true },
      ],
      range: [0, 2000],
      single: "none",
      head: false,
      count: null,
    });
    if (
      resposta.error ||
      !Array.isArray(resposta.data) ||
      !resposta.data.length ||
      resposta.data.length > 2000
    )
      throw new Error("Não foi possível ler todos os lançamentos deste período.");
    const ids = new Set<string>();
    const itens = resposta.data.map((bruto) => {
      const l = linha.parse(bruto);
      const centavos = Math.round(Number(l.valor) * 100);
      if (
        l.clinica_id !== data.clinicaId ||
        l.funcionario_id !== data.funcionarioId ||
        l.data < inicio ||
        l.data >= fim ||
        !Number.isSafeInteger(centavos) ||
        centavos <= 0 ||
        centavos > 999999999999 ||
        ids.has(l.id)
      )
        throw new Error("A origem apresentou um lançamento inconsistente.");
      ids.add(l.id);
      return { id: l.id, data: l.data, descricao: l.descricao, centavos };
    });
    const total = itens.reduce((s, l) => s + l.centavos, 0);
    if (!Number.isSafeInteger(total)) throw new Error("Total inválido para fechamento.");
    const { error } = await banco.from("oricse_fechamentos_comissao").insert({
      clinica_id: data.clinicaId,
      funcionario_id: data.funcionarioId,
      mes: inicio,
      itens,
      valor_centavos: total,
      fechado_por: auth.user.id,
    });
    if (error && (error.code !== "23505" || !(await q()).data))
      throw new Error("Não foi possível salvar o fechamento.");
    return { ok: true };
  });

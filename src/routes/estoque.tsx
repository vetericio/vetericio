import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PackagePlus, Pencil, Plus, Trash2, Wrench, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DIAS_SEMANA,
  type DiaSemana,
  type ItemCatalogo,
  type ProfissionalClinica,
  type RegraComissao,
  type RemuneracaoFuncionario,
} from "@/lib/comissoes";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/estoque")({ component: Estoque });

type Aba = "catalogo" | "cadastro" | "estoque" | "comissoes" | "equipe";
type ItemForm = {
  id?: string;
  tipo: "servico" | "produto";
  nome: string;
  categoria: string;
  valor: string;
  estoque_atual: string;
  estoque_minimo: string;
};

const CATEGORIAS_SERVICOS = ["Consultas", "Vacinação", "Vermifugação", "Exames laboratoriais", "Diagnóstico por imagem", "Cirurgias", "Internação", "Procedimentos", "Odontologia", "Banho e tosa", "Atendimento domiciliar", "Outros"];
const CATEGORIAS_PRODUTOS = ["Medicamentos", "Vacinas", "Vermífugos", "Antiparasitários", "Rações", "Petiscos", "Higiene e limpeza", "Acessórios", "Brinquedos", "Suplementos", "Materiais hospitalares", "Outros"];
function formatarCentavos(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 12);
  return (Number(digitos || "0") / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatarValorExistente(valor: number) {
  return formatarCentavos(String(Math.round(valor * 100)));
}
const FORM_VAZIO: ItemForm = {
  tipo: "servico",
  nome: "",
  categoria: "",
  valor: "",
  estoque_atual: "",
  estoque_minimo: "",
};

function dinheiro(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Estoque() {
  const [aba, setAba] = useState<Aba>("catalogo");
  const [clinicaId, setClinicaId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [podeEditar, setPodeEditar] = useState(false);
  const [adminGeral, setAdminGeral] = useState(false);
  const [clinicasDisponiveis, setClinicasDisponiveis] = useState<{id: string; nome: string}[]>([]);
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [regras, setRegras] = useState<RegraComissao[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalClinica[]>([]);
  const [remuneracoes, setRemuneracoes] = useState<RemuneracaoFuncionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState<ItemForm | null>(null);
  const [quantidadesEstoque, setQuantidadesEstoque] = useState<Record<string, string>>({});
  const [salvandoEstoque, setSalvandoEstoque] = useState<string | null>(null);
  const [regraItemId, setRegraItemId] = useState("");
  const [regraDia, setRegraDia] = useState("");
  const [regraPercentual, setRegraPercentual] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [percentualRemuneracao, setPercentualRemuneracao] = useState("");

  const servicos = useMemo(
    () => itens.filter((item) => item.tipo === "servico" && item.ativo),
    [itens],
  );
  const produtos = useMemo(
    () => itens.filter((item) => item.tipo === "produto" && item.ativo),
    [itens],
  );

  async function ajustarEstoque(item: ItemCatalogo, operacao: "entrada" | "saida") {
    if (!podeEditar || !clinicaId || item.tipo !== "produto") return;
    const quantidade = Number((quantidadesEstoque[item.id] || "").replace(",", "."));
    if (!Number.isFinite(quantidade) || quantidade <= 0) return void toast.error("Informe uma quantidade maior que zero.");
    const atual = Number(item.estoque_atual ?? 0);
    const novo = operacao === "entrada" ? atual + quantidade : atual - quantidade;
    if (novo < 0) return void toast.error("Saída maior que o estoque disponível.");
    setSalvandoEstoque(item.id);
    try {
      const { data, error } = await supabase.from("oricse_catalogo_itens")
        .update({ estoque_atual: Math.round(novo * 1000) / 1000, updated_at: new Date().toISOString() })
        .eq("id", item.id).eq("clinica_id", clinicaId)
        .eq("estoque_atual", atual).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("O estoque foi alterado por outra operação. Atualize e tente novamente.");
      setQuantidadesEstoque(prev => ({ ...prev, [item.id]: "" }));
      await carregarDados(clinicaId);
      toast.success(operacao === "entrada" ? "Entrada registrada no estoque." : "Saída registrada no estoque.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar estoque.");
      await carregarDados(clinicaId);
    } finally { setSalvandoEstoque(null); }
  }

  async function carregarDados(clinica: string) {
    const [itensResult, regrasResult, vinculosResult] = await Promise.all([
      supabase.from("oricse_catalogo_itens").select("*").eq("clinica_id", clinica).order("nome"),
      supabase.from("oricse_regras_comissao").select("*").eq("clinica_id", clinica),
      supabase
        .from("clinica_usuarios")
        .select("user_id,papel")
        .eq("clinica_id", clinica)
        .eq("ativo", true),
    ]);
    if (itensResult.error) throw itensResult.error;
    if (regrasResult.error) throw regrasResult.error;
    if (vinculosResult.error) throw vinculosResult.error;
    const vinculos = vinculosResult.data || [];
    const ids = vinculos.map((item) => item.user_id);
    const [perfisResult, remuneracoesResult] = await Promise.all([
      supabase.from("app_users").select("user_id,username,email").in("user_id", ids),
      supabase.from("oricse_remuneracao_funcionario").select("*").eq("clinica_id", clinica),
    ]);
    if (perfisResult.error) throw perfisResult.error;
    if (remuneracoesResult.error) throw remuneracoesResult.error;
    const papeis = new Map(vinculos.map((item) => [item.user_id, item.papel]));
    setItens((itensResult.data || []) as ItemCatalogo[]);
    setRegras((regrasResult.data || []) as RegraComissao[]);
    setRemuneracoes((remuneracoesResult.data || []) as RemuneracaoFuncionario[]);
    setProfissionais(
      (perfisResult.data || [])
        .map((perfil) => ({
          user_id: perfil.user_id,
          nome: perfil.username ? `@${perfil.username}` : perfil.email || "Funcionário",
          papel: String(papeis.get(perfil.user_id) || ""),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    );
  }

  useEffect(() => {
    let ativo = true;
    async function iniciar() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) throw new Error("Entre na sua conta para acessar os serviços e comissões.");
        const { data: perfil, error: erroPerfil } = await supabase
          .from("app_users").select("role").eq("user_id", userId).maybeSingle();
        if (erroPerfil) throw erroPerfil;
        const eAdminGeral = perfil?.role === "admin";
        const { data: vinculo, error } = await supabase
          .from("clinica_usuarios")
          .select("clinica_id,papel")
          .eq("user_id", userId)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        let clinicaSelecionada = vinculo?.clinica_id || "";
        if (eAdminGeral) {
          const { data: clinicas, error: erroClinicas } = await supabase
            .from("clinicas").select("id,nome").order("nome");
          if (erroClinicas) throw erroClinicas;
          if (!ativo) return;
          const disponiveis = clinicas || [];
          setClinicasDisponiveis(disponiveis);
          const salva = typeof window !== "undefined" ? sessionStorage.getItem("oricse-admin-clinica-estoque") : null;
          if (salva && disponiveis.some(c => c.id === salva)) clinicaSelecionada = salva;
          else if (!clinicaSelecionada) clinicaSelecionada = disponiveis[0]?.id || "";
        }
        if (!clinicaSelecionada) throw new Error("Nenhuma clínica disponível para este catálogo.");
        if (!ativo) return;
        setAdminGeral(eAdminGeral);
        setClinicaId(clinicaSelecionada);
        setUsuarioId(userId);
        setPodeEditar(eAdminGeral || ["responsavel", "admin_clinica", "rt", "recepcao"].includes(vinculo?.papel || ""));
        await carregarDados(clinicaSelecionada);
      } catch (error) {
        if (ativo)
          toast.error(
            error instanceof Error ? error.message : "Não foi possível carregar os dados.",
          );
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void iniciar();
    return () => {
      ativo = false;
    };
  }, []);

  function iniciarCadastro(tipo: ItemForm["tipo"]) {
    setModal({ ...FORM_VAZIO, tipo });
  }

  async function salvarItem(event: FormEvent) {
    event.preventDefault();
    if (!modal || !clinicaId) return;
    const nome = modal.nome.trim();
    const valor = Number(modal.valor.replace(/[^\d,]/g, "").replace(",", "."));
    const estoqueAtual =
      modal.tipo === "produto" && modal.estoque_atual !== ""
        ? Number(modal.estoque_atual.replace(",", "."))
        : null;
    const estoqueMinimo =
      modal.tipo === "produto" && modal.estoque_minimo !== ""
        ? Number(modal.estoque_minimo.replace(",", "."))
        : null;
    if (!nome) return void toast.error("Informe o nome.");
    if (!Number.isFinite(valor) || valor < 0) return void toast.error("Informe um preço válido.");
    if (
      [estoqueAtual, estoqueMinimo].some(
        (quantidade) => quantidade !== null && (!Number.isFinite(quantidade) || quantidade < 0),
      )
    ) {
      return void toast.error("Informe quantidades de estoque válidas.");
    }
    const payload = {
      clinica_id: clinicaId,
      tipo: modal.tipo,
      nome,
      categoria: modal.categoria.trim(),
      valor: Math.round(valor * 100) / 100,
      estoque_atual: estoqueAtual,
      estoque_minimo: estoqueMinimo,
      updated_at: new Date().toISOString(),
      ...(modal.id ? {} : { criado_por: usuarioId }),
    };
    const { error } = modal.id
      ? await supabase
          .from("oricse_catalogo_itens")
          .update(payload)
          .eq("id", modal.id)
          .eq("clinica_id", clinicaId)
      : await supabase.from("oricse_catalogo_itens").insert(payload);
    if (error) return void toast.error(`Não foi possível salvar: ${error.message}`);
    setModal(null);
    await carregarDados(clinicaId);
    toast.success(modal.id ? "Item atualizado." : "Item cadastrado.");
  }

  async function arquivarItem(item: ItemCatalogo) {
    if (!clinicaId || !window.confirm(`Remover "${item.nome}" do catálogo?`)) return;
    const { error } = await supabase
      .from("oricse_catalogo_itens")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("clinica_id", clinicaId);
    if (error) return void toast.error(`Não foi possível remover o item: ${error.message}`);
    await carregarDados(clinicaId);
    toast.success("Item removido do catálogo.");
  }

  async function salvarRegra(event: FormEvent) {
    event.preventDefault();
    const percentual = Number(regraPercentual.replace(",", "."));
    if (!clinicaId) return;
    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      return void toast.error("A comissão deve ficar entre 0% e 100%.");
    }
    const itemId = regraItemId || null;
    const dias: (DiaSemana | null)[] =
      regraDia === "uteis"
        ? [1, 2, 3, 4, 5]
        : regraDia === "fim-de-semana"
          ? [6, 0]
          : regraDia === ""
            ? [null]
            : [Number(regraDia) as DiaSemana];
    const resultados = await Promise.all(
      dias.map((dia) => {
        const existente = regras.find(
          (regra) => regra.item_id === itemId && regra.dia_semana === dia,
        );
        const payload = {
          clinica_id: clinicaId,
          item_id: itemId,
          dia_semana: dia,
          percentual: Math.round(percentual * 100) / 100,
          updated_at: new Date().toISOString(),
          ...(existente ? {} : { criado_por: usuarioId }),
        };
        return existente
          ? supabase.from("oricse_regras_comissao").update(payload).eq("id", existente.id)
          : supabase.from("oricse_regras_comissao").insert(payload);
      }),
    );
    const erroRegra = resultados.find((resultado) => resultado.error)?.error;
    if (erroRegra) {
      await carregarDados(clinicaId);
      return void toast.error(`Não foi possível salvar todas as regras: ${erroRegra.message}`);
    }
    setRegraPercentual("");
    await carregarDados(clinicaId);
    toast.success(
      dias.length > 1
        ? "Regras de comissão salvas para os dias selecionados."
        : "Regra de comissão salva.",
    );
  }

  async function excluirRegra(regra: RegraComissao) {
    if (!clinicaId) return;
    const { error } = await supabase
      .from("oricse_regras_comissao")
      .delete()
      .eq("id", regra.id)
      .eq("clinica_id", clinicaId);
    if (error) return void toast.error(`Não foi possível remover a regra: ${error.message}`);
    await carregarDados(clinicaId);
  }

  async function salvarRemuneracao(event: FormEvent) {
    event.preventDefault();
    const percentual = Number(percentualRemuneracao.replace(",", "."));
    if (!clinicaId || !funcionarioId || !servicoId)
      return void toast.error("Selecione o funcionário e o serviço.");
    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      return void toast.error("O percentual deve ficar entre 0% e 100%.");
    }
    const { error } = await supabase.from("oricse_remuneracao_funcionario").upsert(
      {
        clinica_id: clinicaId,
        funcionario_id: funcionarioId,
        servico_id: servicoId,
        percentual: Math.round(percentual * 100) / 100,
        criado_por: usuarioId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinica_id,funcionario_id,servico_id" },
    );
    if (error) return void toast.error(`Não foi possível salvar o percentual: ${error.message}`);
    setPercentualRemuneracao("");
    await carregarDados(clinicaId);
    toast.success("Percentual individual salvo.");
  }

  async function excluirRemuneracao(remuneracao: RemuneracaoFuncionario) {
    if (!clinicaId) return;
    const { error } = await supabase
      .from("oricse_remuneracao_funcionario")
      .delete()
      .eq("id", remuneracao.id)
      .eq("clinica_id", clinicaId);
    if (error) return void toast.error(`Não foi possível remover o percentual: ${error.message}`);
    await carregarDados(clinicaId);
  }

  const itemSelecionadoRegra = itens.find((item) => item.id === regraItemId);

  if (carregando) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">
        Carregando catálogo e regras...
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6">
      <Link
        to="/financeiro"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft size={17} /> Financeiro
      </Link>
      {adminGeral && (
        <div className="mb-5 rounded-2xl border bg-card p-4">
          <label htmlFor="clinica-admin-estoque" className="mb-2 block text-sm font-semibold">Administração geral · Clínica selecionada</label>
          <select id="clinica-admin-estoque" value={clinicaId}
            onChange={async event => {
              const nova = event.target.value;
              if (!clinicasDisponiveis.some(c => c.id === nova)) return;
              setModal(null);
              setCarregando(true);
              try {
                await carregarDados(nova);
                setClinicaId(nova);
                sessionStorage.setItem("oricse-admin-clinica-estoque", nova);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Não foi possível trocar a clínica.");
              } finally { setCarregando(false); }
            }}
            className="w-full rounded-xl border bg-background px-3 py-3 sm:max-w-md">
            {clinicasDisponiveis.map(clinica => <option key={clinica.id} value={clinica.id}>{clinica.nome}</option>)}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">As alterações serão feitas exclusivamente na clínica selecionada.</p>
        </div>
      )}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Perfil da clínica
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Serviços, produtos e comissões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre preços de produtos e serviços, configure comissões e controle o estoque.
          </p>
        </div>
      </header>

      <nav className="sticky top-0 z-30 mb-5 flex gap-1 overflow-x-auto rounded-xl border bg-card/95 p-1 shadow-sm backdrop-blur-md">
        {(
          [
            ["catalogo", "Serviços e produtos"],
            ["cadastro", "Adicionar valores"],
            ["estoque", "Estoque"],
            ["comissoes", "Comissões"],
            ["equipe", "Remuneração da equipe"],
          ] as const
        ).map(([id, nome]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${aba === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {nome}
          </button>
        ))}
      </nav>

      {aba === "estoque" && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Estoque de produtos</h2>
              <p className="mt-1 text-sm text-muted-foreground">Controle entradas e saídas usando o mesmo cadastro da precificação.</p>
            </div>
            <span className="rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">{produtos.length} produtos</span>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <div className="min-w-[690px] divide-y">
              {produtos.map(produto => (
                <div key={produto.id} className="grid grid-cols-[minmax(0,1fr)_80px_90px_90px_90px] items-center gap-2 px-3 py-2 hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" title={produto.nome}>{produto.nome}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{produto.categoria || "Produto"}</p>
                  </div>
                  <div className="text-center">
                    <span className="text-base font-bold tabular-nums">{Number(produto.estoque_atual ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</span>
                    {produto.estoque_minimo != null && Number(produto.estoque_atual ?? 0) <= Number(produto.estoque_minimo) && <p className="text-[10px] text-amber-700">Baixo</p>}
                  </div>
                  {podeEditar ? (
                    <>
                      <input aria-label={`Quantidade de ${produto.nome}`} type="text" inputMode="decimal" placeholder="Qtd." value={quantidadesEstoque[produto.id] || ""}
                        onChange={e => setQuantidadesEstoque(prev => ({ ...prev, [produto.id]: e.target.value.replace(/[^0-9,.]/g, "") }))}
                        className="h-9 w-full rounded-lg border bg-background px-2 text-sm" />
                      <button type="button" disabled={salvandoEstoque !== null} onClick={() => ajustarEstoque(produto, "entrada")}
                        className="h-9 rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">+ Entrada</button>
                      <button type="button" disabled={salvandoEstoque !== null} onClick={() => ajustarEstoque(produto, "saida")}
                        className="h-9 rounded-lg border px-2 text-xs font-semibold disabled:opacity-50">− Saída</button>
                    </>
                  ) : <span className="col-span-3 text-right text-xs text-muted-foreground">Consulta</span>}
                </div>
              ))}
            </div>
          </div>
          {produtos.length === 0 && <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Nenhum produto cadastrado. Adicione produtos em Precificação → Adicionar valores.</p>}
        </section>
      )}

      {aba === "cadastro" && (
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Catálogo da clínica</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Adicionar produtos e serviços</h2>
            <p className="mt-2 text-sm text-muted-foreground">Cadastre os preços cobrados pela clínica. Os itens ficarão disponíveis no catálogo e para utilização nas comandas.</p>
          </div>
          {podeEditar ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <button type="button" onClick={() => iniciarCadastro("servico")}
                className="group flex flex-col items-start gap-3 rounded-2xl border bg-background p-6 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Plus size={23} /></span>
                <span className="text-lg font-bold">Novo serviço</span>
                <span className="text-sm text-muted-foreground">Consultas, vacinas, procedimentos e outros serviços. Defina nome, categoria e valor.</span>
                <span className="mt-auto text-sm font-semibold text-primary">Cadastrar serviço →</span>
              </button>
              <button type="button" onClick={() => iniciarCadastro("produto")}
                className="group flex flex-col items-start gap-3 rounded-2xl border bg-background p-6 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Plus size={23} /></span>
                <span className="text-lg font-bold">Novo produto</span>
                <span className="text-sm text-muted-foreground">Medicamentos, acessórios e produtos. Defina preço, categoria e quantidades de estoque.</span>
                <span className="mt-auto text-sm font-semibold text-primary">Cadastrar produto →</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Seu perfil possui acesso de consulta. Solicite a um responsável, RT ou recepção com permissão para cadastrar valores.
            </div>
          )}
        </section>
      )}

      {aba === "catalogo" && (
        <div className="grid gap-4 md:grid-cols-2">
          <CatalogoGrupo
            titulo="Serviços"
            descricao="Sem controle de estoque."
            icone="servico"
            itens={servicos}
            podeEditar={podeEditar}
            aoEditar={(item) =>
              setModal({
                id: item.id,
                tipo: item.tipo,
                nome: item.nome,
                categoria: item.categoria,
                valor: formatarValorExistente(item.valor),
                estoque_atual: "",
                estoque_minimo: "",
              })
            }
            aoRemover={arquivarItem}
          />
          <CatalogoGrupo
            titulo="Produtos"
            descricao="Com preço e estoque atual."
            icone="produto"
            itens={produtos}
            podeEditar={podeEditar}
            aoEditar={(item) =>
              setModal({
                id: item.id,
                tipo: item.tipo,
                nome: item.nome,
                categoria: item.categoria,
                valor: String(item.valor),
                estoque_atual: item.estoque_atual == null ? "" : String(item.estoque_atual),
                estoque_minimo: item.estoque_minimo == null ? "" : String(item.estoque_minimo),
              })
            }
            aoRemover={arquivarItem}
          />
          {!servicos.length && !produtos.length && (
            <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              O catálogo está vazio. Cadastre um serviço ou produto para começar.
            </div>
          )}
        </div>
      )}

      {aba === "comissoes" && (
        <section className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="font-bold">Nova regra de comissão</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Deixe item e dia sem seleção para definir a regra geral. Prioridade: item + dia, regra
              geral do dia, item em qualquer dia e regra geral.
            </p>
            <form
              onSubmit={salvarRegra}
              className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto]"
            >
              <select
                value={regraItemId}
                onChange={(event) => setRegraItemId(event.target.value)}
                className="h-10 min-w-0 rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">Todos os serviços e produtos</option>
                {itens
                  .filter((item) => item.ativo)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome} · {item.tipo === "servico" ? "Serviço" : "Produto"}
                    </option>
                  ))}
              </select>
              <select
                value={regraDia}
                onChange={(event) => setRegraDia(event.target.value)}
                className="h-10 rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">Todos os dias</option>
                <option value="uteis">Segunda a sexta</option>
                <option value="fim-de-semana">Sábado e domingo</option>
                {DIAS_SEMANA.map((dia) => (
                  <option key={dia.value} value={dia.value}>
                    {dia.label}
                  </option>
                ))}
              </select>
              <label className="relative">
                <input
                  value={regraPercentual}
                  onChange={(event) => setRegraPercentual(event.target.value)}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  className="h-10 w-full rounded-lg border bg-background px-3 pr-8 text-sm"
                />
                <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
              </label>
              <button
                disabled={!podeEditar}
                className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Plus size={15} /> Salvar
              </button>
            </form>
            {itemSelecionadoRegra && (
              <p className="mt-2 text-xs text-muted-foreground">
                A regra será aplicada a “{itemSelecionadoRegra.nome}”.
              </p>
            )}
          </div>
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-4 py-3 text-sm font-bold">Regras cadastradas</div>
            {regras.length ? (
              regras.map((regra) => {
                const item = itens.find((cadastro) => cadastro.id === regra.item_id);
                const dia = DIAS_SEMANA.find((opcao) => opcao.value === regra.dia_semana);
                return (
                  <div
                    key={regra.id}
                    className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {item?.nome || "Todos os serviços e produtos"}
                        {item && !item.ativo ? " · inativo" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dia?.label || "Todos os dias"} · Comissão
                      </p>
                    </div>
                    <strong className="text-sm text-primary">{regra.percentual}%</strong>
                    <button
                      type="button"
                      onClick={() => excluirRegra(regra)}
                      disabled={!podeEditar}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                      aria-label="Remover regra"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma regra. Sem regra configurada, a comissão é 0%.
              </p>
            )}
          </section>
        </section>
      )}

      {aba === "equipe" && (
        <section className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="font-bold">Percentual por funcionário e serviço</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastre a remuneração percentual por atendimento e funcionário. Ela é separada da
              comissão comercial.
            </p>
            <form
              onSubmit={salvarRemuneracao}
              className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_110px_auto]"
            >
              <select
                value={funcionarioId}
                onChange={(event) => setFuncionarioId(event.target.value)}
                className="h-10 min-w-0 rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">Selecione o funcionário</option>
                {profissionais.map((profissional) => (
                  <option key={profissional.user_id} value={profissional.user_id}>
                    {profissional.nome}
                  </option>
                ))}
              </select>
              <select
                value={servicoId}
                onChange={(event) => setServicoId(event.target.value)}
                className="h-10 min-w-0 rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">Selecione o serviço</option>
                {servicos.map((servico) => (
                  <option key={servico.id} value={servico.id}>
                    {servico.nome}
                  </option>
                ))}
              </select>
              <label className="relative">
                <input
                  value={percentualRemuneracao}
                  onChange={(event) => setPercentualRemuneracao(event.target.value)}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  className="h-10 w-full rounded-lg border bg-background px-3 pr-8 text-sm"
                />
                <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
              </label>
              <button
                disabled={!podeEditar}
                className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Plus size={15} /> Salvar
              </button>
            </form>
          </div>
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-4 py-3 text-sm font-bold">Valores por funcionário</div>
            {remuneracoes.length ? (
              remuneracoes.map((valor) => {
                const profissional = profissionais.find(
                  (pessoa) => pessoa.user_id === valor.funcionario_id,
                );
                const servico = itens.find((item) => item.id === valor.servico_id);
                return (
                  <div
                    key={valor.id}
                    className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {profissional?.nome || "Funcionário"}
                      </p>
                      <p className="text-xs text-muted-foreground">{servico?.nome || "Serviço"}</p>
                    </div>
                    <div className="text-right">
                      <strong className="text-sm text-primary">{valor.percentual}%</strong>
                      {servico && (
                        <p className="text-[11px] text-muted-foreground">
                          {dinheiro((servico.valor * valor.percentual) / 100)} por atendimento
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => excluirRemuneracao(valor)}
                      disabled={!podeEditar}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                      aria-label="Remover percentual"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {profissionais.length
                  ? "Nenhum percentual individual cadastrado."
                  : "Cadastre funcionários na equipe da clínica para configurar a remuneração."}
              </p>
            )}
          </section>
        </section>
      )}

      {!podeEditar && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Seu perfil pode consultar estas informações; somente responsável, RT ou recepção podem
          alterá-las.
        </p>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <form
            onSubmit={salvarItem}
            className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">
                {modal.id ? "Editar" : "Novo"} {modal.tipo === "servico" ? "serviço" : "produto"}
              </h2>
              <button type="button" onClick={() => setModal(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold sm:col-span-2">
                Nome
                <input
                  autoFocus
                  maxLength={120}
                  required
                  value={modal.nome}
                  onChange={(event) => setModal({ ...modal, nome: event.target.value })}
                  placeholder={modal.tipo === "servico" ? "Ex.: Consulta" : "Ex.: Vacina V10"}
                  className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                Categoria
                <select value={modal.categoria} onChange={(event) => setModal({ ...modal, categoria: event.target.value })}
                  className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal">
                  <option value="">Selecione uma categoria</option>
                  {[...new Set([...(modal.tipo === "servico" ? CATEGORIAS_SERVICOS : CATEGORIAS_PRODUTOS), ...(modal.categoria ? [modal.categoria] : [])])].map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold">
                Preço
                <input required type="text" inputMode="numeric" value={modal.valor}
                  onChange={(event) => setModal({ ...modal, valor: formatarCentavos(event.target.value) })}
                  onFocus={(event) => event.currentTarget.select()}
                  placeholder="R$ 0,00" aria-label="Preço em reais, digitado em centavos"
                  className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal tabular-nums"
                />
              </label>
              {modal.tipo === "produto" && (
                <>
                  <label className="text-xs font-semibold">
                    Estoque atual
                    <input
                      min="0"
                      step="0.001"
                      type="number"
                      value={modal.estoque_atual}
                      onChange={(event) =>
                        setModal({ ...modal, estoque_atual: event.target.value })
                      }
                      placeholder="Opcional"
                      className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Estoque mínimo
                    <input
                      min="0"
                      step="0.001"
                      type="number"
                      value={modal.estoque_minimo}
                      onChange={(event) =>
                        setModal({ ...modal, estoque_minimo: event.target.value })
                      }
                      placeholder="Opcional"
                      className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal"
                    />
                  </label>
                </>
              )}
            </div>
            <button
              disabled={!podeEditar}
              className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              Salvar {modal.tipo === "servico" ? "serviço" : "produto"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

function CatalogoGrupo({
  titulo,
  descricao,
  icone,
  itens,
  podeEditar,
  aoEditar,
  aoRemover,
}: {
  titulo: string;
  descricao: string;
  icone: "servico" | "produto";
  itens: ItemCatalogo[];
  podeEditar: boolean;
  aoEditar: (item: ItemCatalogo) => void;
  aoRemover: (item: ItemCatalogo) => void;
}) {
  const Icon = icone === "servico" ? Wrench : PackagePlus;
  return (
    <section className="rounded-xl border bg-card p-3">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold">{titulo}</h2>
          <p className="text-[11px] text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <div className="space-y-2">
        {itens.length ? (
          itens.map((item) => (
            <article
              key={item.id}
              className="flex min-h-[58px] items-center gap-2 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.nome}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {item.categoria ||
                    (item.tipo === "produto" ? `Estoque: ${item.estoque_atual ?? "—"}` : "Serviço")}
                  {item.tipo === "produto" && item.categoria
                    ? ` · Estoque: ${item.estoque_atual ?? "—"}`
                    : ""}
                </p>
              </div>
              <strong className="whitespace-nowrap text-sm text-primary">
                {dinheiro(item.valor)}
              </strong>
              {podeEditar && (
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => aoEditar(item)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                    aria-label={`Editar ${item.nome}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => aoRemover(item)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                    aria-label={`Remover ${item.nome}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nenhum {icone === "servico" ? "serviço" : "produto"} cadastrado.
          </div>
        )}
      </div>
    </section>
  );
}

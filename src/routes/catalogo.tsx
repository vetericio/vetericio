import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, PackagePlus, Save, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { categoriaCatalogoExame, categoriaExame, EXAMES_PADRAO, type CategoriaExame } from "@/lib/exames-catalogo";

export const Route = createFileRoute("/catalogo")({ component: Catalogo });

type TipoItem = "servico" | "produto";
type ClinicaOpcao = { id: string; nome: string };
type ItemCatalogo = {
  id: string;
  tipo: TipoItem;
  nome: string;
  preco: number | string;
  categoria?: string | null;
  comissao?: number | string | null;
  codigo_tributacao?: string | null;
  cnae?: string | null;
  descricao_prefeitura?: string | null;
  aliquota_iss?: number | string | null;
  estoque_atual?: number | string | null;
  estoque_minimo?: number | string | null;
  fornecedor?: string | null;
};

const vazio = {
  nome: "",
  preco: "",
  categoria: "",
  comissao: "",
  codigo_tributacao: "",
  cnae: "",
  descricao_prefeitura: "",
  aliquota_iss: "",
  estoque_atual: "",
  estoque_minimo: "",
  fornecedor: "",
};

function numero(valor: string) {
  const normalizado = valor.trim().replace(/\./g, "").replace(",", ".");
  if (!normalizado) return null;
  const convertido = Number(normalizado);
  return Number.isFinite(convertido) ? convertido : NaN;
}

function moeda(valor: number | string | null | undefined) {
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}

function valorParaCampo(valor: number | string) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(2).replace(".", ",") : "";
}

function mensagemErro(erro: unknown, padrao: string) {
  if (erro instanceof Error && erro.message) return erro.message;
  if (erro && typeof erro === "object" && "message" in erro && typeof (erro as { message?: unknown }).message === "string") return (erro as { message: string }).message;
  return padrao;
}

function Catalogo() {
  const [clinicaId, setClinicaId] = useState("");
  const [papel, setPapel] = useState("");
  const [adminGlobal, setAdminGlobal] = useState(false);
  const [clinicasAdmin, setClinicasAdmin] = useState<ClinicaOpcao[]>([]);
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(false);
  const [cadastroExame, setCadastroExame] = useState(false);
  const [tipo, setTipo] = useState<TipoItem>("servico");
  const [form, setForm] = useState(vazio);
  const [janelaFiscal, setJanelaFiscal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [semeandoExames, setSemeandoExames] = useState(false);
  const [precosExames, setPrecosExames] = useState<Record<string, string>>({});
  const [salvandoPrecoExame, setSalvandoPrecoExame] = useState("");
  const [editandoPrecoExame, setEditandoPrecoExame] = useState<Record<string, boolean>>({});

  const podeEditar = adminGlobal || ["clinica", "rt"].includes(papel);
  const titulo = tipo === "servico" ? "Cadastrar serviço" : "Cadastrar produto";
  const descricao = tipo === "servico"
    ? "Serviços não movimentam estoque."
    : "Produtos podem ter estoque atual e mínimo.";
  const servicos = useMemo(() => itens.filter((item) => item.tipo === "servico" && !categoriaExame(item.categoria)), [itens]);
  const produtos = useMemo(() => itens.filter((item) => item.tipo === "produto"), [itens]);
  const exames = useMemo(() => itens.filter((item) => categoriaExame(item.categoria)), [itens]);

  async function carregarItensDaClinica(id: string) {
    const { data, error } = await (supabase as any)
      .from("clinica_catalogo_itens")
      .select("*")
      .eq("clinica_id", id)
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;
    setClinicaId(id);
    setItens(data || []);
  }

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) throw new Error("Sessão não encontrada.");

        const { data: usuarioSistema, error: erroUsuarioSistema } = await (supabase as any)
          .from("app_users")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
        if (erroUsuarioSistema) throw erroUsuarioSistema;

        const { data: vinculo, error: erroVinculo } = await (supabase as any)
          .from("clinica_usuarios")
          .select("clinica_id,papel")
          .eq("user_id", userId)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (erroVinculo) throw erroVinculo;

        const ehAdminGlobal = usuarioSistema?.role === "admin";
        let clinicaAtiva = vinculo?.clinica_id || "";

        if (ehAdminGlobal) {
          const { data: clinicas, error: erroClinicas } = await (supabase as any)
            .from("clinicas")
            .select("id,nome")
            .order("nome");
          if (erroClinicas) throw erroClinicas;
          if (!ativo) return;
          setClinicasAdmin(clinicas || []);
          if (!clinicaAtiva) clinicaAtiva = clinicas?.[0]?.id || "";
        }

        if (!clinicaAtiva) throw new Error("Nenhuma clínica disponível para este catálogo.");
        if (!ativo) return;

        setPapel(vinculo?.papel || "");
        setAdminGlobal(ehAdminGlobal);
        await carregarItensDaClinica(clinicaAtiva);
      } catch (e) {
        if (ativo) toast.error((e as Error).message || "Não foi possível carregar serviços e produtos.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, []);

  function abrirCadastro(novoTipo: TipoItem) {
    if (!podeEditar) return toast.error("Somente Admin ORICSE, Clínica ou RT podem cadastrar.");
    if (!clinicaId) return toast.error("Selecione uma clínica antes de cadastrar.");
    setTipo(novoTipo);
    setForm(vazio);
    setCadastroExame(false);
    setJanelaFiscal(false);
    setNovo(true);
  }

  function abrirCadastroExame() {
    if (!podeEditar) return toast.error("Somente Admin ORICSE, Clínica ou RT podem cadastrar.");
    if (!clinicaId) return toast.error("Selecione uma clínica antes de cadastrar.");
    setTipo("servico");
    setForm({ ...vazio, categoria: categoriaCatalogoExame("Outros") });
    setCadastroExame(true);
    setJanelaFiscal(false);
    setNovo(true);
  }

  async function adicionarExamesPadrao() {
    if (!podeEditar || !clinicaId) return;
    const existentes = new Set(itens.map((item) => item.nome.trim().toLocaleLowerCase("pt-BR")));
    const novos = EXAMES_PADRAO.filter((item) => !existentes.has(item.nome.toLocaleLowerCase("pt-BR")));
    if (!novos.length) return void toast.info("Todos os exames padrão já estão cadastrados.");
    setSemeandoExames(true);
    try {
      const { data, error } = await (supabase as any).from("clinica_catalogo_itens").insert(novos.map((item) => ({
        clinica_id: clinicaId,
        tipo: "servico",
        nome: item.nome,
        preco: 0,
        categoria: categoriaCatalogoExame(item.categoria),
      }))).select();
      if (error) throw error;
      setItens((atual) => [...atual, ...(data || [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      toast.success(`${novos.length} exames adicionados. Agora informe os valores de cada um.`);
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível cadastrar os exames padrão.");
    } finally {
      setSemeandoExames(false);
    }
  }

  async function salvarPrecoExame(item: ItemCatalogo) {
    if (!podeEditar) return;
    const preco = numero(precosExames[item.id] ?? String(item.preco));
    if (preco === null || Number.isNaN(preco) || preco < 0) return void toast.error("Informe um valor válido para o exame.");
    setSalvandoPrecoExame(item.id);
    try {
      const { data, error } = await (supabase as any).from("clinica_catalogo_itens").update({ preco }).eq("id", item.id).eq("clinica_id", clinicaId).select("id,preco").single();
      if (error) throw error;
      if (!data?.id) throw new Error("O valor não foi confirmado pelo banco.");
      const precoSalvo = Number(data.preco);
      setItens((atual) => atual.map((atualItem) => atualItem.id === item.id ? { ...atualItem, preco: precoSalvo } : atualItem));
      setPrecosExames((atual) => ({ ...atual, [item.id]: valorParaCampo(precoSalvo) }));
      setEditandoPrecoExame((atual) => ({ ...atual, [item.id]: false }));
      toast.success("Valor do exame atualizado.");
    } catch (e) {
      toast.error(mensagemErro(e, "Não foi possível atualizar o valor do exame."));
    } finally {
      setSalvandoPrecoExame("");
    }
  }

  async function salvar() {
    const preco = numero(form.preco);
    const comissao = numero(form.comissao);
    const aliquotaIss = numero(form.aliquota_iss);
    const estoqueAtual = numero(form.estoque_atual);
    const estoqueMinimo = numero(form.estoque_minimo);

    if (!form.nome.trim()) return toast.error("Informe o nome.");
    if (preco === null || Number.isNaN(preco) || preco < 0) return toast.error("Informe um preço válido.");
    if ([comissao, aliquotaIss, estoqueAtual, estoqueMinimo].some((valor) => valor !== null && Number.isNaN(valor))) {
      return toast.error("Revise os valores numéricos.");
    }
    if (aliquotaIss !== null && (aliquotaIss < 0 || aliquotaIss > 100)) return toast.error("A alíquota de ISS deve ficar entre 0 e 100%.");

    setSalvando(true);
    try {
      const { data, error } = await (supabase as any)
        .from("clinica_catalogo_itens")
        .insert({
          clinica_id: clinicaId,
          tipo,
          nome: form.nome.trim(),
          preco,
          categoria: form.categoria.trim() || null,
          comissao,
          codigo_tributacao: form.codigo_tributacao.trim() || null,
          cnae: form.cnae.trim() || null,
          descricao_prefeitura: form.descricao_prefeitura.trim() || null,
          aliquota_iss: aliquotaIss,
          estoque_atual: tipo === "produto" ? estoqueAtual : null,
          estoque_minimo: tipo === "produto" ? estoqueMinimo : null,
          fornecedor: tipo === "produto" ? form.fornecedor.trim() || null : null,
        })
        .select()
        .single();
      if (error) throw error;
      setItens((atual) => [...atual, data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      setNovo(false);
      setForm(vazio);
      toast.success(tipo === "servico" ? "Serviço cadastrado." : "Produto cadastrado.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <main className="mx-auto w-full max-w-5xl px-4 py-8"><div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Carregando catálogo...</div></main>;

  return <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4">
    <Link to="/perfil-clinica" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={17} /> Perfil da clínica</Link>

    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-primary">Perfil da clínica</p>
        <h1 className="mt-1 text-2xl font-black text-foreground">Serviços e produtos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cadastre o que a clínica oferece e o que controla em estoque.</p>
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!podeEditar || !clinicaId} onClick={abrirCadastroExame} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 text-sm font-black text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"><PackagePlus size={18} /> Cadastrar exame</button><button type="button" disabled={!podeEditar || !clinicaId} onClick={() => abrirCadastro("servico")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><PackagePlus size={18} /> Serviço / produto</button></div>
    </header>

    {adminGlobal && clinicasAdmin.length > 1 && <label className="mt-5 block max-w-md text-sm font-bold text-foreground">Clínica para este catálogo<select value={clinicaId} onChange={(e) => void carregarItensDaClinica(e.target.value).catch((erro) => toast.error(erro.message || "Não foi possível trocar a clínica."))} className="mt-1 min-h-11 w-full rounded-xl border bg-card px-3 font-normal"><option value="">Selecione</option>{clinicasAdmin.map((clinica) => <option key={clinica.id} value={clinica.id}>{clinica.nome}</option>)}</select></label>}

    {!podeEditar && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Seu perfil pode visualizar este catálogo. O cadastro é permitido para Admin, Clínica e RT.</p>}

    {novo && <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-black">{cadastroExame ? "Cadastrar exame" : titulo}</h2><p className="mt-1 text-sm text-muted-foreground">{cadastroExame ? "Defina a categoria e o valor que será lançado automaticamente na comanda." : descricao}</p></div>
        <button type="button" onClick={() => setNovo(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Fechar cadastro"><X size={19} /></button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
        <button type="button" onClick={() => setTipo("servico")} className={"min-h-11 rounded-lg text-sm font-black " + (tipo === "servico" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}><Wrench className="mr-2 inline" size={16} /> Serviço</button>
        <button type="button" onClick={() => setTipo("produto")} className={"min-h-11 rounded-lg text-sm font-black " + (tipo === "produto" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}><PackagePlus className="mr-2 inline" size={16} /> Produto</button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Campo label={tipo === "servico" ? "Nome do serviço *" : "Nome do produto *"} value={form.nome} onChange={(nome) => setForm({ ...form, nome })} placeholder={tipo === "servico" ? "Ex.: Consulta clínica" : "Ex.: Vermífugo"} />
        <Campo label="Preço *" value={form.preco} onChange={(preco) => setForm({ ...form, preco })} inputMode="decimal" placeholder="0,00" />
        {cadastroExame ? <label className="block text-sm font-bold text-foreground">Categoria do exame<select value={categoriaExame(form.categoria) || "Outros"} onChange={(e) => setForm({ ...form, categoria: categoriaCatalogoExame(e.target.value as CategoriaExame) })} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal outline-none focus:border-primary">{(["Sangue", "Urina", "Fezes", "Imagem", "Outros"] as CategoriaExame[]).map((categoria) => <option key={categoria}>{categoria}</option>)}</select></label> : <Campo label="Categoria" value={form.categoria} onChange={(categoria) => setForm({ ...form, categoria })} placeholder={tipo === "servico" ? "Ex.: Consulta, procedimento" : "Ex.: Medicamento, alimento"} />}
        <Campo label="Comissão (opcional)" value={form.comissao} onChange={(comissao) => setForm({ ...form, comissao })} inputMode="decimal" placeholder="0,00" />

        {tipo === "produto" && <>
          <Campo label="Estoque atual" value={form.estoque_atual} onChange={(estoque_atual) => setForm({ ...form, estoque_atual })} inputMode="decimal" placeholder="0" />
          <Campo label="Estoque mínimo" value={form.estoque_minimo} onChange={(estoque_minimo) => setForm({ ...form, estoque_minimo })} inputMode="decimal" placeholder="0" />
          <Campo label="Fornecedor" value={form.fornecedor} onChange={(fornecedor) => setForm({ ...form, fornecedor })} placeholder="Opcional" />
        </>}
      </div>

      {tipo === "servico" && <button type="button" onClick={() => setJanelaFiscal(true)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold text-foreground hover:bg-muted"><ChevronDown size={17} /> Código de serviço / dados fiscais</button>}

      <div className="mt-5 flex justify-end border-t pt-4">
        <button type="button" disabled={salvando} onClick={salvar} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground disabled:opacity-50"><Save size={17} /> {salvando ? "Salvando..." : "Salvar cadastro"}</button>
      </div>
    </section>}

    <section className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-black text-sky-950">Exames e valores</h2><p className="mt-1 text-sm text-sky-900/75">Configurados pelo RT/Admin. Ao selecionar na consulta, entram na comanda com este valor.</p></div><button type="button" disabled={!podeEditar || semeandoExames} onClick={() => void adicionarExamesPadrao()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-700 px-4 text-sm font-black text-white disabled:opacity-50"><PackagePlus size={17}/>{semeandoExames ? "Adicionando..." : "Adicionar lista padrão"}</button></div>{exames.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{exames.map((item) => { const editando = editandoPrecoExame[item.id] !== false; return <div key={item.id} className="rounded-xl border bg-white px-4 py-3"><p className="font-bold text-foreground">{item.nome}</p><p className="mt-1 text-xs text-muted-foreground">{categoriaExame(item.categoria)}</p><div className="mt-3 flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-bold text-muted-foreground">Valor<input disabled={!podeEditar || !editando} inputMode="decimal" value={precosExames[item.id] ?? valorParaCampo(item.preco)} onChange={(e) => setPrecosExames((atual) => ({ ...atual, [item.id]: e.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-sm font-normal text-foreground outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60"/></label><button type="button" disabled={!podeEditar || salvandoPrecoExame===item.id} onClick={() => editando ? void salvarPrecoExame(item) : setEditandoPrecoExame((atual) => ({ ...atual, [item.id]: true }))} className="min-h-10 rounded-lg bg-sky-700 px-3 text-xs font-black text-white disabled:opacity-50">{salvandoPrecoExame===item.id ? "..." : editando ? "Salvar" : "Editar"}</button></div></div>; })}</div> : <p className="mt-4 rounded-xl border border-dashed bg-white/70 p-4 text-sm text-sky-950/70">Ainda não há exames cadastrados. Use “Adicionar lista padrão” e depois informe o preço de cada exame.</p>}</section>

    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Lista titulo="Serviços" descricao="Não têm controle de estoque." itens={servicos} icone={<Wrench size={20} />} />
      <Lista titulo="Produtos" descricao="Controlam estoque atual e mínimo." itens={produtos} icone={<PackagePlus size={20} />} produto />
    </div>

    {janelaFiscal && <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-6">
      <section role="dialog" aria-modal="true" aria-label="Dados fiscais do serviço" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-black">Código de serviço / dados fiscais</h2><p className="mt-1 text-sm text-muted-foreground">Preencha apenas se a clínica emitir NFS-e. As informações devem ser orientadas pela contabilidade.</p></div><button type="button" onClick={() => setJanelaFiscal(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Fechar"><X size={19} /></button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo label="Código de tributação do serviço" value={form.codigo_tributacao} onChange={(codigo_tributacao) => setForm({ ...form, codigo_tributacao })} />
          <Campo label="CNAE do serviço" value={form.cnae} onChange={(cnae) => setForm({ ...form, cnae })} />
          <label className="block sm:col-span-2 text-sm font-bold">Descrição genérica para a prefeitura<textarea value={form.descricao_prefeitura} onChange={(e) => setForm({ ...form, descricao_prefeitura: e.target.value })} rows={4} className="mt-1 w-full rounded-xl border bg-background p-3 font-normal outline-none focus:border-primary" placeholder="Descrição do serviço para emissão da NFS-e" /></label>
          <Campo label="Alíquota de ISS (%)" value={form.aliquota_iss} onChange={(aliquota_iss) => setForm({ ...form, aliquota_iss })} inputMode="decimal" placeholder="Ex.: 2,00" />
        </div>
        <div className="mt-5 flex justify-end"><button type="button" onClick={() => setJanelaFiscal(false)} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground">Concluir</button></div>
      </section>
    </div>}
  </main>;
}

function Campo({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (valor: string) => void; placeholder?: string; inputMode?: "decimal" | "text" }) {
  return <label className="block text-sm font-bold text-foreground">{label}<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal outline-none focus:border-primary" /></label>;
}

function Lista({ titulo, descricao, itens, icone, produto = false }: { titulo: string; descricao: string; itens: ItemCatalogo[]; icone: React.ReactNode; produto?: boolean }) {
  return <section className="rounded-2xl border bg-card p-5 shadow-sm">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary">{icone}</span><div><h2 className="font-black text-foreground">{titulo}</h2><p className="text-sm text-muted-foreground">{descricao}</p></div></div>
    {itens.length === 0 ? <p className="mt-5 rounded-xl bg-muted/50 p-5 text-center text-sm text-muted-foreground">Nenhum {titulo.toLowerCase().slice(0, -1)} cadastrado.</p> : <div className="mt-4 divide-y rounded-xl border">{itens.map((item) => <div key={item.id} className="px-4 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-bold text-foreground">{item.nome}</div><div className="mt-0.5 text-xs text-muted-foreground">{item.categoria || "Sem categoria"}{produto && item.estoque_atual != null ? " · Estoque: " + item.estoque_atual : ""}</div></div><div className="shrink-0 text-sm font-black text-primary">{moeda(item.preco)}</div></div></div>)}</div>}
  </section>;
}

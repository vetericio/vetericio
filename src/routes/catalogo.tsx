import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, PackagePlus, Save, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/catalogo")({ component: Catalogo });

type TipoItem = "servico" | "produto";
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

function Catalogo() {
  const [clinicaId, setClinicaId] = useState("");
  const [papel, setPapel] = useState("");
  const [adminGlobal, setAdminGlobal] = useState(false);
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(false);
  const [tipo, setTipo] = useState<TipoItem>("servico");
  const [form, setForm] = useState(vazio);
  const [janelaFiscal, setJanelaFiscal] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const podeEditar = adminGlobal || ["clinica", "rt"].includes(papel);
  const titulo = tipo === "servico" ? "Cadastrar serviço" : "Cadastrar produto";
  const descricao = tipo === "servico"
    ? "Serviços não movimentam estoque."
    : "Produtos podem ter estoque atual e mínimo.";
  const servicos = useMemo(() => itens.filter((item) => item.tipo === "servico"), [itens]);
  const produtos = useMemo(() => itens.filter((item) => item.tipo === "produto"), [itens]);

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
        if (!vinculo?.clinica_id) throw new Error("Usuário não vinculado a uma clínica.");

        const { data, error } = await (supabase as any)
          .from("clinica_catalogo_itens")
          .select("*")
          .eq("clinica_id", vinculo.clinica_id)
          .eq("ativo", true)
          .order("nome");
        if (error) throw error;
        if (!ativo) return;
        setClinicaId(vinculo.clinica_id);
        setPapel(vinculo.papel || "");
        setAdminGlobal(usuarioSistema?.role === "admin");
        setItens(data || []);
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
    if (!podeEditar) return toast.error("Somente Admin, Clínica ou RT podem cadastrar.");
    setTipo(novoTipo);
    setForm(vazio);
    setJanelaFiscal(false);
    setNovo(true);
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
      <button type="button" disabled={!podeEditar} onClick={() => abrirCadastro("servico")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><PackagePlus size={18} /> Cadastrar serviço / produto</button>
    </header>

    {!podeEditar && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Seu perfil pode visualizar este catálogo. O cadastro é permitido para Admin, Clínica e RT.</p>}

    {novo && <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-black">{titulo}</h2><p className="mt-1 text-sm text-muted-foreground">{descricao}</p></div>
        <button type="button" onClick={() => setNovo(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Fechar cadastro"><X size={19} /></button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
        <button type="button" onClick={() => setTipo("servico")} className={"min-h-11 rounded-lg text-sm font-black " + (tipo === "servico" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}><Wrench className="mr-2 inline" size={16} /> Serviço</button>
        <button type="button" onClick={() => setTipo("produto")} className={"min-h-11 rounded-lg text-sm font-black " + (tipo === "produto" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}><PackagePlus className="mr-2 inline" size={16} /> Produto</button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Campo label={tipo === "servico" ? "Nome do serviço *" : "Nome do produto *"} value={form.nome} onChange={(nome) => setForm({ ...form, nome })} placeholder={tipo === "servico" ? "Ex.: Consulta clínica" : "Ex.: Vermífugo"} />
        <Campo label="Preço *" value={form.preco} onChange={(preco) => setForm({ ...form, preco })} inputMode="decimal" placeholder="0,00" />
        <Campo label="Categoria" value={form.categoria} onChange={(categoria) => setForm({ ...form, categoria })} placeholder={tipo === "servico" ? "Ex.: Consulta, procedimento" : "Ex.: Medicamento, alimento"} />
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

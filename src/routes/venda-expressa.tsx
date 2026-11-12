import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Barcode, Camera, CheckCircle2, CreditCard, Minus, Package, Plus, RefreshCw, Search, ShoppingCart, Trash2, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/usePermissoes";
import type { ItemCatalogo } from "@/lib/comissoes";

export const Route = createFileRoute("/venda-expressa")({
  head: () => ({ meta: [{ title: "Venda Expressa — ORICSE" }] }),
  component: VendaExpressa,
});

type Carrinho = { produto: ItemCatalogo; quantidade: number };
type Forma = "Dinheiro" | "Pix" | "Cartão de débito" | "Cartão de crédito";
type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type DetectorCtor = new (config: { formats: string[] }) => Detector;
const formatos = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];
const dinheiro = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const preco = (p: ItemCatalogo) => Math.round(Number(p.valor) * 100);
const centavosTexto = (t: string) => {
  const v = t.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  const n = Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
  return v && Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
};
function VendaExpressa() {
  const { clinicaId, carregando: carregandoPermissoes, pode, adminGlobal } = usePermissoes();
  const autorizado = adminGlobal || ((pode("caixa.financeiro.gerenciar") || pode("caixa.comandas")) && pode("estoque.movimentar"));
  const [produtos, setProdutos] = useState<ItemCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<Carrinho[]>([]);
  const [forma, setForma] = useState<Forma>("Pix");
  const [recebido, setRecebido] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const [modal, setModal] = useState(false);
  const [camera, setCamera] = useState(false);
  const [sucesso, setSucesso] = useState<{ id: string; total: number; troco: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const leituraRef = useRef(0);
  const chaveVenda = useRef(crypto.randomUUID());
  const disponiveis = useMemo(() => produtos.filter(p => p.ativo && p.tipo === "produto"), [produtos]);
  const encontrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    return (q ? disponiveis.filter(p => p.nome.toLocaleLowerCase("pt-BR").includes(q)
      || (p.codigo_barras || "").includes(q)) : disponiveis).slice(0, 60);
  }, [busca, disponiveis]);
  const total = carrinho.reduce((s, c) => s + preco(c.produto) * c.quantidade, 0);
  const qtd = carrinho.reduce((s, c) => s + c.quantidade, 0);
  const valorRecebido = centavosTexto(recebido);
  const troco = forma === "Dinheiro" && Number.isFinite(valorRecebido) ? Math.max(0, valorRecebido - total) : 0;

  const carregar = useCallback(async () => {
    if (!clinicaId || !autorizado) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const { data, error } = await (supabaseBanco as any).from("oricse_catalogo_itens")
        .select("id,clinica_id,tipo,nome,categoria,valor,estoque_atual,estoque_minimo,codigo_barras,ativo")
        .eq("clinica_id", clinicaId).eq("tipo", "produto").eq("ativo", true).order("nome").limit(2000);
      if (error) throw error;
      setProdutos((data || []) as ItemCatalogo[]);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao consultar produtos.");
    } finally { setCarregando(false); }
  }, [clinicaId, autorizado]);

  useEffect(() => { setCarrinho([]); setBusca(""); setModal(false); setSucesso(null); chaveVenda.current = crypto.randomUUID(); void carregar(); }, [carregar]);
  const adicionar = useCallback((p: ItemCatalogo) => {
    if (!Number.isFinite(preco(p)) || preco(p) <= 0) return void toast.error("Configure um preço válido para vender este produto.");
    if (p.estoque_atual == null) return void toast.error("Configure o estoque do produto antes de vendê-lo.");
    setCarrinho(anterior => {
      const existente = anterior.find(item => item.produto.id === p.id);
      const quantidade = (existente?.quantidade || 0) + 1;
      if (quantidade > Number(p.estoque_atual)) { toast.error("Estoque insuficiente para " + p.nome); return anterior; }
      return existente
        ? anterior.map(item => item.produto.id === p.id ? { ...item, quantidade } : item)
        : [...anterior, { produto: p, quantidade: 1 }];
    });
    setBusca("");
    inputRef.current?.focus();
  }, []);
  const porCodigo = useCallback((codigo: string) => {
    const valor = codigo.trim();
    if (!valor) return;
    const p = disponiveis.find(item => item.codigo_barras === valor);
    if (!p) return void toast.error("Código de barras não cadastrado: " + valor);
    adicionar(p);
  }, [adicionar, disponiveis]);
  const alterarQuantidade = (id: string, delta: number) => {
    setCarrinho(anterior => anterior.flatMap(item => {
      if (item.produto.id !== id) return [item];
      const nova = item.quantidade + delta;
      if (nova > Number(item.produto.estoque_atual ?? 0)) { toast.error("Estoque insuficiente."); return [item]; }
      return nova > 0 ? [{ ...item, quantidade: nova }] : [];
    }));
  };
  const pararCamera = useCallback(() => {
    setCamera(false);
    cameraStream.current?.getTracks().forEach(track => track.stop());
    cameraStream.current = null;
  }, []);
  useEffect(() => {
    if (!camera) return;
    let cancelado = false;
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const iniciar = async () => {
      try {
        const Detector = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        if (!Detector) throw new Error("Leitura por câmera indisponível neste navegador. Use o leitor USB ou digite o código.");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("A câmera exige HTTPS e permissão do navegador.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return; }
        cameraStream.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("Não foi possível preparar a câmera.");
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats });
        let ocupada = false;
        intervalo = setInterval(async () => {
          if (ocupada || !video || video.readyState < 2) return;
          ocupada = true;
          try {
            const codigos = await detector.detect(video);
            const codigo = codigos[0]?.rawValue;
            if (codigo && Date.now() - leituraRef.current > 1100) {
              leituraRef.current = Date.now();
              porCodigo(codigo);
              pararCamera();
            }
          } catch { /* leitura seguinte pode recuperar a imagem */ }
          finally { ocupada = false; }
        }, 300);
      } catch(e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a câmera.");
        pararCamera();
      }
    };
    void iniciar();
    return () => { cancelado = true; if (intervalo) clearInterval(intervalo); cameraStream.current?.getTracks().forEach(t => t.stop()); cameraStream.current = null; };
  }, [camera, pararCamera, porCodigo]);
  useEffect(() => () => { cameraStream.current?.getTracks().forEach(t=>t.stop()); }, []);

  async function finalizar(e: FormEvent) {
    e.preventDefault();
    if (finalizando || !autorizado || !clinicaId || !carrinho.length) return;
    if (forma === "Dinheiro" && (!Number.isFinite(valorRecebido) || valorRecebido < total))
      return void toast.error("Informe o dinheiro recebido, igual ou maior que o total.");
    setFinalizando(true);
    try {
      const { data, error } = await (supabaseBanco as any).rpc("oricse_venda_expressa_finalizar", {
        p_clinica_id: clinicaId,
        p_idempotencia: chaveVenda.current,
        p_itens: carrinho.map(item => ({ id: item.produto.id, quantidade: item.quantidade })),
        p_forma_pagamento: forma,
        p_recebido_centavos: forma === "Dinheiro" ? valorRecebido : null,
      });
      if (error) throw error;
      if (!data?.id) throw new Error("O banco não confirmou a venda. Confira antes de tentar novamente.");
      setSucesso({ id: String(data.id), total: Number(data.total_centavos), troco: Number(data.troco_centavos) });
      chaveVenda.current = crypto.randomUUID();
      setCarrinho([]);
      setRecebido("");
      setModal(false);
      await carregar();
      window.dispatchEvent(new Event("oricse:caixa-alterado"));
      toast.success("Venda registrada no caixa e estoque atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível finalizar a venda.");
      // Preserva a mesma chave: tentar novamente não duplica a venda.
    } finally { setFinalizando(false); }
  }
  if (carregandoPermissoes) return <main className="p-8">Carregando permissões…</main>;
  if (!autorizado) return <main className="mx-auto max-w-2xl space-y-4 p-8"><h1 className="text-xl font-bold">Venda Expressa</h1><p role="alert">Seu usuário precisa de permissão de caixa e movimentação de estoque.</p><Link to="/inicio" className="underline">Voltar</Link></main>;
  return <main className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link to="/inicio" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><ArrowLeft size={16}/> Voltar</Link>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Venda Expressa</h1>
        <p className="text-sm text-muted-foreground">PDV · sem comanda e sem cadastro de tutor</p></div>
      <button type="button" onClick={() => void carregar()} disabled={carregando} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-50"><RefreshCw size={17}/> Atualizar estoque</button>
    </div>
    {erro && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}
    {sucesso && <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
      <CheckCircle2 size={22}/><div><strong>Venda registrada · {dinheiro(sucesso.total)}</strong><p>Troco: {dinheiro(sucesso.troco)} · Identificador: {sucesso.id.slice(0,8)}</p></div>
      <button type="button" className="ml-auto rounded-lg border border-emerald-500 px-3 py-2" onClick={() => setSucesso(null)}>Nova venda</button></div>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
      <section className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2"><Package className="text-primary" size={20}/><h2 className="text-lg font-bold">Localizar produto</h2></div>
        <form onSubmit={e => { e.preventDefault(); const q=busca.trim(); const exato=disponiveis.find(p=>p.codigo_barras===q); if(exato) porCodigo(q); else if(encontrados.length===1) adicionar(encontrados[0]); else toast.info("Selecione um produto na lista."); }}
          className="flex flex-wrap gap-2">
          <label className="relative min-w-[180px] flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground"/>
            <input autoFocus ref={inputRef} value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder="Nome, código ou leitor de barras + Enter" aria-label="Buscar produto ou ler código de barras"
              className="min-h-12 w-full rounded-xl border bg-background pl-10 pr-3 text-sm"/>
          </label>
          <button type="button" onClick={() => setCamera(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border px-4 text-sm font-bold"><Camera size={18}/> Câmera</button>
        </form>
        <p className="text-xs text-muted-foreground">Leitor USB: posicione o cursor no campo e escaneie (Enter). No celular, toque em Câmera. É necessário cadastrar os códigos no estoque.</p>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {carregando ? <p>Carregando produtos…</p> : encontrados.length ? encontrados.map(p=><button key={p.id} type="button" onClick={()=>adicionar(p)}
            disabled={p.estoque_atual == null || Number(p.estoque_atual)<=0 || preco(p)<=0}
            className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left hover:border-primary disabled:opacity-40">
            <div className="min-w-0"><p className="truncate font-bold">{p.nome}</p><p className="text-xs text-muted-foreground">{p.codigo_barras || p.categoria || "Sem código"} · Estoque: {p.estoque_atual ?? "não configurado"}</p></div>
            <div className="flex shrink-0 items-center gap-2"><strong className="tabular-nums text-primary">{dinheiro(preco(p))}</strong><Plus size={17}/></div>
          </button>) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum produto encontrado. Cadastre-o em Estoque e produtos.</p>}
        </div>
        <Link to="/estoque" className="inline-flex text-xs font-semibold text-primary underline">Gerenciar cadastro, preço e códigos de barras</Link>
      </section>
      <section className="flex min-w-0 flex-col rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-bold"><ShoppingCart size={20} className="text-primary"/> Carrinho ({qtd})</h2>
          <button type="button" disabled={!carrinho.length} onClick={()=>{setCarrinho([]);chaveVenda.current=crypto.randomUUID();}} className="text-xs font-semibold text-muted-foreground underline disabled:opacity-40">Limpar</button></div>
        <div className="my-4 min-h-[160px] flex-1 space-y-2">
          {carrinho.length ? carrinho.map(item=><div key={item.produto.id} className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2"><div><strong className="text-sm">{item.produto.nome}</strong><p className="text-xs text-muted-foreground">{dinheiro(preco(item.produto))} por unidade</p></div>
              <button type="button" onClick={()=>alterarQuantidade(item.produto.id,-item.quantidade)} aria-label={"Remover "+item.produto.nome}><Trash2 size={17}/></button></div>
            <div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2">
              <button type="button" onClick={()=>alterarQuantidade(item.produto.id,-1)} aria-label="Diminuir quantidade" className="rounded-lg border p-2"><Minus size={15}/></button>
              <span className="min-w-6 text-center font-bold tabular-nums">{item.quantidade}</span>
              <button type="button" onClick={()=>alterarQuantidade(item.produto.id,1)} aria-label="Aumentar quantidade" className="rounded-lg border p-2"><Plus size={15}/></button>
            </div><strong className="tabular-nums">{dinheiro(preco(item.produto)*item.quantidade)}</strong></div>
          </div>) : <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">Leia um código ou selecione produtos para começar.</div>}
        </div>
        <div className="border-t pt-4"><div className="flex items-center justify-between"><span className="font-bold">Total da venda</span><strong className="text-3xl font-black tabular-nums text-primary">{dinheiro(total)}</strong></div>
          <button type="button" disabled={!carrinho.length || !!erro} onClick={()=>setModal(true)}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50"><Wallet size={20}/> Receber pagamento</button></div>
      </section>
    </div>
    {camera && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="Leitor de código de barras" className="w-full max-w-lg rounded-2xl bg-card p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><Barcode size={18}/> Escanear código de barras</h2><button type="button" onClick={pararCamera} aria-label="Fechar câmera"><X/></button></div>
        <video ref={videoRef} playsInline muted autoPlay className="max-h-[55vh] w-full rounded-xl bg-black object-cover"/>
        <p className="mt-3 text-xs text-muted-foreground">Aponte para o código. A câmera fecha após a leitura. É possível digitar manualmente se o navegador não oferecer suporte.</p>
      </section></div>}
    {modal && <div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3">
      <form onSubmit={e=>void finalizar(e)} role="dialog" aria-modal="true" aria-label="Pagamento da Venda Expressa" className="w-full max-w-lg space-y-4 rounded-2xl bg-card p-5 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-extrabold"><CreditCard size={19} className="text-primary"/> Finalizar venda</h2><button type="button" disabled={finalizando} onClick={()=>setModal(false)} aria-label="Fechar"><X/></button></div>
        <div className="rounded-xl bg-secondary/50 p-4"><span className="text-sm">Valor total</span><p className="text-3xl font-black tabular-nums">{dinheiro(total)}</p></div>
        <label className="block text-sm font-bold">Forma de pagamento
          <select value={forma} onChange={e=>setForma(e.target.value as Forma)} className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3">
            {(["Pix","Dinheiro","Cartão de débito","Cartão de crédito"] as Forma[]).map(opcao=><option key={opcao}>{opcao}</option>)}
          </select>
        </label>
        {forma==="Dinheiro" && <><label className="block text-sm font-bold">Valor entregue pelo cliente (R$)
          <input inputMode="decimal" required value={recebido} onChange={e=>setRecebido(e.target.value)} placeholder="0,00"
            className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3"/></label>
          <div className="flex justify-between rounded-xl bg-secondary/40 p-3 text-sm"><span>Troco</span><strong>{dinheiro(troco)}</strong></div></>}
        <p className="text-xs leading-5 text-muted-foreground">Confirme somente após receber o pagamento. Este registro não processa Pix ou cartões; ele contabiliza um pagamento já realizado. A venda baixa estoque e entra no caixa sem comanda.</p>
        <div className="flex gap-2"><button type="button" disabled={finalizando} onClick={()=>setModal(false)} className="min-h-12 flex-1 rounded-xl border font-bold">Voltar</button>
          <button type="submit" disabled={finalizando || !total} className="min-h-12 flex-[2] rounded-xl bg-primary px-3 font-bold text-primary-foreground disabled:opacity-50">{finalizando?"Registrando…":"Confirmar pagamento e vender"}</button></div>
      </form></div>}
  </main>;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Barcode, Camera, CheckCircle2, CreditCard, Minus, Package, Plus, RefreshCw, Search, ShoppingCart, Star, Trash2, Wallet, X } from "lucide-react";
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
const formatoQuantidade = (valor: number) => valor.toLocaleString("pt-BR", {minimumFractionDigits: 3,maximumFractionDigits: 3});
const normalizarQuantidade = (texto: string) => {
  const entrada = texto.trim();
  if (!/^\\d{1,5}(?:[,.]\\d{1,3})?$/.test(entrada)) return null;
  const quantidade = Number(entrada.replace(",","."));
  if (!Number.isFinite(quantidade) || quantidade<=0 || quantidade>10000) return null;
  return Math.round(quantidade*1000)/1000;
};
const subtotal = (p: ItemCatalogo, quantidade: number) => Math.round(preco(p)*quantidade);

const centavosTexto = (t: string) => {
  const v = t.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  const n = Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
  return v && Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
};
function VendaExpressa() {
  const { clinicaId, carregando: carregandoPermissoes, pode, adminGlobal } = usePermissoes();
  const autorizado = adminGlobal || pode("caixa.financeiro.gerenciar") || pode("caixa.comandas");
  const [produtos, setProdutos] = useState<ItemCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [quantidadeEntrada, setQuantidadeEntrada] = useState("1,000");
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [erroFavoritos, setErroFavoritos] = useState("");
  const [salvandoFavorito, setSalvandoFavorito] = useState<string | null>(null);

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
  const produtosFavoritos = useMemo(() => disponiveis.filter(p => favoritos.includes(p.id)), [disponiveis, favoritos]);
  const encontrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    return q ? disponiveis.filter(p => p.nome.toLocaleLowerCase("pt-BR").includes(q)
      || (p.codigo_barras || "").includes(q)).slice(0, 15) : [];
  }, [busca, disponiveis]);
  const total = carrinho.reduce((s, c) => s + subtotal(c.produto,c.quantidade), 0);
  const qtd = carrinho.length;
  const valorRecebido = centavosTexto(recebido);
  const troco = forma === "Dinheiro" && Number.isFinite(valorRecebido) ? Math.max(0, valorRecebido - total) : 0;

  const carregar = useCallback(async () => {
    if (!clinicaId || !autorizado) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const { data, error } = await (supabaseBanco as any).from("oricse_catalogo_itens")
        .select("id,clinica_id,tipo,nome,categoria,valor,estoque_atual,estoque_minimo,codigo_barras,venda_por_peso,ativo")
        .eq("clinica_id", clinicaId).eq("tipo", "produto").eq("ativo", true).order("nome").limit(2000);
      if (error) throw error;
      setProdutos((data || []) as ItemCatalogo[]);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao consultar produtos.");
    } finally { setCarregando(false); }
  }, [clinicaId, autorizado]);

  const carregarFavoritos = useCallback(async () => {
    if (!clinicaId || !autorizado) { setFavoritos([]); return; }
    const { data: sessao, error: erroUsuario } = await supabaseBanco.auth.getUser();
    if (erroUsuario || !sessao.user) { setErroFavoritos("Autentique-se para gerenciar favoritos."); return; }
    const {data,error} = await (supabaseBanco as any).from("oricse_pdv_favoritos")
      .select("item_id").eq("clinica_id",clinicaId).eq("usuario_id",sessao.user.id);
    if (error) { setErroFavoritos("Não foi possível carregar os favoritos."); return; }
    setErroFavoritos("");
    setFavoritos((data || []).map((item: {item_id:string})=>item.item_id));
  },[clinicaId,autorizado]);

  useEffect(() => {
    setCarrinho([]); setBusca(""); setModal(false); setSucesso(null);
    setQuantidadeEntrada("1,000"); setFavoritos([]); setErroFavoritos("");
    chaveVenda.current = crypto.randomUUID();
    void carregar(); void carregarFavoritos();
  }, [carregar,carregarFavoritos]);

  async function alternarFavorito(produto: ItemCatalogo) {
    if (!clinicaId || salvandoFavorito) return;
    setSalvandoFavorito(produto.id);
    try {
      const {data: sessao,error: erroUsuario}=await supabaseBanco.auth.getUser();
      if (erroUsuario || !sessao.user) throw new Error("Entre novamente para salvar favoritos.");
      const jaFavorito=favoritos.includes(produto.id);
      const consulta=(supabaseBanco as any).from("oricse_pdv_favoritos");
      const {error}=jaFavorito
        ? await consulta.delete().eq("clinica_id",clinicaId).eq("usuario_id",sessao.user.id).eq("item_id",produto.id)
        : await consulta.insert({clinica_id:clinicaId,usuario_id:sessao.user.id,item_id:produto.id});
      if (error) throw error;
      setFavoritos(anteriores=>jaFavorito?anteriores.filter(id=>id!==produto.id):[...anteriores,produto.id]);
      setErroFavoritos("");
    } catch(e){ toast.error(e instanceof Error?e.message:"Falha ao atualizar favorito."); }
    finally {setSalvandoFavorito(null);}
  }

  const adicionar = useCallback((p: ItemCatalogo) => {
    const quantidade=normalizarQuantidade(quantidadeEntrada);
    if (quantidade===null) return void toast.error("Quantidade inválida. Use 1,000 ou, para peso, 1,500.");
    if (!p.venda_por_peso && !Number.isInteger(quantidade))
      return void toast.error("Este produto é vendido por unidade. Use 1,000 ou outra quantidade inteira.");
    if (!Number.isFinite(preco(p)) || preco(p) <= 0) return void toast.error("Configure um preço válido para vender este produto.");
    if (p.estoque_atual == null) return void toast.error("Configure o estoque do produto antes de vendê-lo.");
    const existente=carrinho.find(item=>item.produto.id===p.id);
    const totalNovo=Math.round(((existente?.quantidade||0)+quantidade)*1000)/1000;
    if(totalNovo>Number(p.estoque_atual)) return void toast.error("Estoque insuficiente para "+p.nome);
    if(totalNovo>10000) return void toast.error("Quantidade máxima excedida.");
    setCarrinho(anterior=>existente
      ? anterior.map(item=>item.produto.id===p.id?{...item,quantidade:totalNovo}:item)
      : [...anterior,{produto:p,quantidade}]);
    setBusca(""); setQuantidadeEntrada("1,000");
    inputRef.current?.focus();
  }, [carrinho,quantidadeEntrada]);

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
      const nova = Math.round((item.quantidade + delta)*1000)/1000;
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
        const detector = new Detector({ formats: formatos });
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
  if (!autorizado) return <main className="mx-auto max-w-2xl space-y-4 p-8"><h1 className="text-xl font-bold">Venda Expressa</h1><p role="alert">Seu usuário precisa de permissão para operar o caixa.</p><Link to="/inicio" className="underline">Voltar</Link></main>;
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
        <form onSubmit={e => { e.preventDefault(); const q=busca.trim(); const exato=disponiveis.find(p=>p.codigo_barras===q); if(exato) porCodigo(q); else if(encontrados.length===1) adicionar(encontrados[0]); else toast.info("Digite um código exato ou selecione um resultado da busca."); }}
          className="flex flex-wrap items-end gap-2">
          <label className="w-[105px] shrink-0 text-xs font-bold">Quantidade
            <input aria-label="Quantidade para adicionar" type="text" inputMode="decimal" value={quantidadeEntrada}
              onChange={e=>setQuantidadeEntrada(e.target.value)} onBlur={()=>{
                const numero=normalizarQuantidade(quantidadeEntrada);
                if(numero!==null)setQuantidadeEntrada(formatoQuantidade(numero));
              }}
              className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 text-center text-base font-bold tabular-nums" placeholder="1,000"/>
          </label>
          <label className="relative min-w-[160px] flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground"/>
            <input autoFocus ref={inputRef} value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder="Nome, código ou leitor de barras + Enter" aria-label="Buscar produto ou ler código de barras"
              className="min-h-12 w-full rounded-xl border bg-background pl-10 pr-3 text-sm"/>
            {busca.trim() && <div role="listbox" aria-label="Resultados da busca" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-card p-1 shadow-xl">
              {encontrados.length ? encontrados.map(p=><div key={p.id} className="flex items-center gap-1 rounded-lg hover:bg-secondary/50">
                <button type="button" onClick={()=>adicionar(p)} className="min-w-0 flex-1 px-3 py-2 text-left text-sm">
                  <span className="block truncate font-semibold">{p.nome}</span>
                  <span className="text-xs text-muted-foreground">{p.codigo_barras||"Sem código"} · {dinheiro(preco(p))}{p.venda_por_peso?"/kg":"/un"}</span>
                </button>
                <button type="button" onClick={()=>void alternarFavorito(p)} disabled={!!salvandoFavorito} title="Marcar como preferido" aria-label={favoritos.includes(p.id)?"Remover dos preferidos":"Adicionar aos preferidos"} className="rounded-lg p-3 text-amber-600 disabled:opacity-50">
                  <Star size={19} fill={favoritos.includes(p.id)?"currentColor":"none"}/>
                </button>
              </div>):<p className="p-4 text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
            </div>}
          </label>
          <button type="button" onClick={() => setCamera(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border px-4 text-sm font-bold"><Camera size={18}/> Câmera</button>
        </form>
        <p className="text-xs text-muted-foreground">Leitor USB: posicione o cursor no campo e escaneie (Enter). No celular, toque em Câmera. É necessário cadastrar os códigos no estoque.</p>
        <section aria-label="Produtos preferidos" className="space-y-2">
          <div className="flex items-center gap-2"><Star size={19} className="text-amber-600" fill="currentColor"/><h3 className="text-base font-bold">Preferidos</h3></div>
          {erroFavoritos && <p className="text-xs text-destructive">{erroFavoritos}</p>}
          {carregando ? <p className="text-sm text-muted-foreground">Carregando…</p> : produtosFavoritos.length
            ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{produtosFavoritos.map(p=><div key={p.id} className="flex min-w-0 items-center gap-2 rounded-xl border p-2">
              <button type="button" disabled={p.estoque_atual==null||Number(p.estoque_atual)<=0||preco(p)<=0}
                onClick={()=>adicionar(p)} className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left hover:bg-secondary/60 disabled:opacity-40">
                <span className="block truncate text-sm font-bold">{p.nome}</span>
                <span className="text-xs text-muted-foreground">{dinheiro(preco(p))}{p.venda_por_peso?"/kg":"/un"} · Estoque: {p.estoque_atual??"—"}</span>
              </button>
              <button type="button" onClick={()=>void alternarFavorito(p)} disabled={!!salvandoFavorito}
                title="Remover dos preferidos" aria-label={"Remover "+p.nome+" dos preferidos"} className="shrink-0 rounded-lg p-2 text-amber-600 hover:bg-secondary disabled:opacity-50">
                <Star size={20} fill="currentColor"/>
              </button>
            </div>)}</div>
            : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum preferido ainda. Pesquise um produto pelo nome ou código e toque na estrela para fixá-lo aqui.</p>}
        </section>
        <Link to="/estoque" className="inline-flex text-xs font-semibold text-primary underline">Gerenciar cadastro, preço e códigos de barras</Link>
      </section>
      <section className="flex min-w-0 flex-col rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-bold"><ShoppingCart size={20} className="text-primary"/> Carrinho ({qtd})</h2>
          <button type="button" disabled={!carrinho.length} onClick={()=>{setCarrinho([]);chaveVenda.current=crypto.randomUUID();}} className="text-xs font-semibold text-muted-foreground underline disabled:opacity-40">Limpar</button></div>
        <div className="my-4 min-h-[160px] flex-1 space-y-2">
          {carrinho.length ? carrinho.map(item=><div key={item.produto.id} className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2"><div><strong className="text-sm">{item.produto.nome}</strong><p className="text-xs text-muted-foreground">{dinheiro(preco(item.produto))} por {item.produto.venda_por_peso?"kg":"unidade"}</p></div>
              <button type="button" onClick={()=>alterarQuantidade(item.produto.id,-item.quantidade)} aria-label={"Remover "+item.produto.nome}><Trash2 size={17}/></button></div>
            <div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2">
              <button type="button" onClick={()=>alterarQuantidade(item.produto.id,item.produto.venda_por_peso?-0.1:-1)} aria-label="Diminuir quantidade" className="rounded-lg border p-2"><Minus size={15}/></button>
              <span className="min-w-6 text-center font-bold tabular-nums">{formatoQuantidade(item.quantidade)}</span>
              <button type="button" onClick={()=>alterarQuantidade(item.produto.id,item.produto.venda_por_peso?0.1:1)} aria-label="Aumentar quantidade" className="rounded-lg border p-2"><Plus size={15}/></button>
            </div><strong className="tabular-nums">{dinheiro(subtotal(item.produto,item.quantidade))}</strong></div>
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

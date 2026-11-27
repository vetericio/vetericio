import { useDemoAlvorada } from "@/lib/demo-alvorada-context";
import { AVISO_DEMO_DOCUMENTOS } from "@/lib/demo-alvorada";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileDown, ImageDown, Plus, Printer, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { usePermissoes } from "@/hooks/usePermissoes";
import { supabaseBanco } from "@/integrations/supabase/client";
import { PrecoPorPesoOrcamento } from "@/components/PrecoPorPesoOrcamento";
import { calcularPrecoOrcamento, type PerfilOrcamento } from "@/lib/preco-orcamento";
import { faixasValidas, type FaixaPrecoPeso } from "@/lib/preco-por-peso";

export const Route = createFileRoute("/orcamento-venda-expressa")({ component: OrcamentoVendaExpressa });

type Produto = { id: string; nome: string; valor: number; faixas: FaixaPrecoPeso[] };
type Linha = { id: string; produtoId: string; quantidade: number; perfil: PerfilOrcamento };
type Clinica = Record<string, unknown>;
type Tutor = { id: string; nome: string; telefone?: string | null; email?: string | null };
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const texto = (v: unknown) => typeof v === "string" ? v.trim() : "";
const numero = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const perfilInicial: PerfilOrcamento = { especie: null, sexo: null, peso: "" };

function OrcamentoVendaExpressa() {
  const demoAlvorada = useDemoAlvorada();
  const { clinicaId, carregando: verificando, adminGlobal, pode } = usePermissoes();
  const autorizado = adminGlobal || pode("caixa.comandas") || pode("caixa.financeiro.gerenciar");
  const [clinica, setClinica] = useState<Clinica>({});
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [nomeTutor, setNomeTutor] = useState("");
  const [contatoTutor, setContatoTutor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [validade, setValidade] = useState("7");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const itens = useMemo(() => linhas.map(linha => {
    const produto = produtos.find(p => p.id === linha.produtoId);
    const preco = produto?.faixas.length ? calcularPrecoOrcamento(produto.faixas, linha.perfil) : null;
    const unitario = preco ? preco.valor : produto?.valor ?? null;
    const quantidadeMilesimos = Math.round(linha.quantidade * 1000);
    const subtotalCentavos = unitario !== null && Number.isFinite(linha.quantidade) && linha.quantidade > 0
      ? Math.round(Math.round(unitario * 100) * quantidadeMilesimos / 1000) : null;
    return { linha, produto, preco, subtotalCentavos };
  }), [linhas, produtos]);
  const total = itens.reduce((soma, item) => soma + (item.subtotalCentavos ?? 0), 0) / 100;
  const temPrecoPendente = itens.some(({ preco }) => preco && preco.valor === null);

  useEffect(() => {
    if (!clinicaId || !autorizado) return;
    let ativo = true;
    setCarregando(true);
    Promise.all([
      (supabaseBanco as any).rpc("oricse_orcamento_dados_clinica", { p_clinica_id: clinicaId }),
      supabaseBanco.from("oricse_catalogo_itens").select("id,nome,valor,tipo,faixas_peso").eq("clinica_id", clinicaId).eq("ativo", true).order("nome"),
      (supabaseBanco as any).from("tutores").select("id,nome,telefone,email").eq("clinica_id", clinicaId).order("nome").limit(1000),
    ]).then(([c, p, t]) => {
      if (!ativo) return;
      if (c.error || p.error) throw new Error(c.error?.message || p.error?.message);
      setClinica(c.data || {});
      setProdutos((p.data ?? []).map(item => ({
        id: item.id,
        nome: item.nome,
        valor: numero(item.valor),
        faixas: item.tipo === "servico" ? faixasValidas(item.faixas_peso) : [],
      })));
      setTutores(t.error ? [] : t.data || []);
    }).catch(e => { if (ativo) toast.error(e instanceof Error ? e.message : "Não foi possível carregar os dados."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [clinicaId, autorizado]);

  function adicionar() {
    const primeiro = produtos[0];
    if (!primeiro) return toast.error("Cadastre um produto ou serviço antes de elaborar o orçamento.");
    setLinhas(v => [...v, { id: crypto.randomUUID(), produtoId: primeiro.id, quantidade: 1, perfil: perfilInicial }]);
  }
  function atualizarLinha(id: string, campos: Partial<Omit<Linha, "id">>) {
    setLinhas(atuais => atuais.map(linha => linha.id === id ? { ...linha, ...campos } : linha));
  }

  function gerarCanvas() {
    if (demoAlvorada) {
      toast.info(AVISO_DEMO_DOCUMENTOS);
      return null;
    }
    if (temPrecoPendente) {
      toast.error("Complete o perfil e o peso dos serviços com preço por faixa."); return null;
    }
    if (!itens.length || itens.some(item => item.subtotalCentavos === null)) {
      toast.error("Inclua itens e quantidades válidas."); return null;
    }
    const largura = 1240, altura = Math.max(1754, 730 + linhas.length * 72 + (observacoes.length > 0 ? 180 + Math.ceil(observacoes.length / 70) * 30 : 0));
    const canvas = document.createElement("canvas"); canvas.width = largura; canvas.height = altura;
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, largura, altura);
    ctx.fillStyle = "#692b40"; ctx.fillRect(0, 0, largura, 16);
    ctx.fillStyle = "#182239"; ctx.font = "bold 40px Arial";
    ctx.fillText(texto(clinica.nome) || texto(clinica.clinica_nome) || "Clínica veterinária", 74, 105);
    ctx.font = "22px Arial"; ctx.fillStyle = "#4b5563";
    const endereco = [texto(clinica.endereco), texto(clinica.numero), texto(clinica.bairro), texto(clinica.cidade), texto(clinica.uf)].filter(Boolean).join(", ");
    const dados = [
      [texto(clinica.razao_social), texto(clinica.cnpj) ? "CNPJ: " + texto(clinica.cnpj) : ""].filter(Boolean).join(" · "),
      endereco,
      [texto(clinica.complemento), texto(clinica.cep) ? "CEP " + texto(clinica.cep) : ""].filter(Boolean).join(" · "),
      [texto(clinica.telefone), texto(clinica.email)].filter(Boolean).join(" · "),
    ].filter(Boolean);
    dados.forEach((s, i) => {
      let parte = s;
      while (parte.length && ctx.measureText(parte).width > 1070) parte = parte.slice(0, -1);
      ctx.fillText(parte, 74, 145 + i * 30);
    });
    ctx.strokeStyle = "#e3e5eb"; ctx.beginPath(); ctx.moveTo(74, 268); ctx.lineTo(1166, 268); ctx.stroke();
    ctx.fillStyle = "#692b40"; ctx.font = "bold 36px Arial"; ctx.fillText("ORÇAMENTO", 74, 331);
    ctx.font = "21px Arial"; ctx.fillStyle = "#374151";
    ctx.fillText("Emissão: " + new Date().toLocaleDateString("pt-BR"), 74, 372);
    ctx.fillText("Validade: " + Math.max(1, Math.min(365, Math.floor(Number(validade)||7))) + " dia(s)", 430, 372);
    ctx.fillText("Tutor/cliente: " + (nomeTutor.trim() || "Não informado").slice(0, 75), 74, 425);
    if (contatoTutor.trim()) ctx.fillText("Contato: " + contatoTutor.trim().slice(0, 70), 74, 463);
    ctx.fillStyle = "#f5eef1"; ctx.fillRect(74, 510, 1092, 58);
    ctx.fillStyle = "#692b40"; ctx.font = "bold 23px Arial";
    ctx.fillText("DESCRIÇÃO", 93, 547); ctx.fillText("QTD.", 780, 547); ctx.fillText("TOTAL", 980, 547);
    let y = 617;
    itens.forEach(({ linha, produto, preco, subtotalCentavos }) => {
      ctx.font = "22px Arial"; ctx.fillStyle = "#182239";
      ctx.fillText(produto?.nome || "Item", 93, y, 655);
      ctx.fillText(linha.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 }), 780, y);
      ctx.fillText(moeda((subtotalCentavos ?? 0) / 100), 980, y);
      if (preco?.pesoKg != null) {
        ctx.font = "18px Arial"; ctx.fillStyle = "#4b5563";
        const peso = preco.pesoKg.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
        ctx.fillText([linha.perfil.especie, linha.perfil.sexo, peso + " kg"].join(" · "), 93, y + 24);
      }
      ctx.strokeStyle = "#e3e5eb"; ctx.beginPath(); ctx.moveTo(74, y + 35); ctx.lineTo(1166, y + 35); ctx.stroke();
      y += 72;
    });
    ctx.fillStyle = "#692b40"; ctx.font = "bold 33px Arial"; ctx.fillText("TOTAL: " + moeda(total), 760, y + 50);
    if (observacoes.trim()) {
      ctx.fillStyle = "#182239"; ctx.font = "bold 22px Arial"; ctx.fillText("Observações", 74, y + 132);
      ctx.font = "20px Arial"; ctx.fillStyle = "#4b5563";
      const words = observacoes.trim().split(/\s+/); let linha = "", desloc = 0;
      words.forEach(p => { const tentativa = (linha + " " + p).trim(); if (ctx.measureText(tentativa).width > 1080) { ctx.fillText(linha, 74, y + 168 + desloc * 29); desloc++; linha = p; } else linha = tentativa; });
      if (linha) ctx.fillText(linha, 74, y + 168 + desloc * 29);
    }
    ctx.fillStyle = "#6b7280"; ctx.font = "18px Arial";
    ctx.fillText("Documento comercial informativo. Não confirma venda, pagamento ou reserva de estoque.", 74, altura - 85);
    ctx.fillText("Gerado pelo ORICSE", 74, altura - 52);
    return canvas;
  }
  function exportar(formato: "pdf" | "jpeg") {
    const canvas = gerarCanvas(); if (!canvas) return;
    const jpg = canvas.toDataURL("image/jpeg", 0.94);
    if (formato === "pdf") {
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const larguraPagina = pdf.internal.pageSize.getWidth();
      const alturaPagina = pdf.internal.pageSize.getHeight();
      const alturaImagem = larguraPagina * canvas.height / canvas.width;
      for (let pagina = 0; pagina < Math.ceil(alturaImagem / alturaPagina); pagina++) {
        if (pagina > 0) pdf.addPage();
        pdf.addImage(jpg, "JPEG", 0, -pagina * alturaPagina, larguraPagina, alturaImagem);
      }
      pdf.save("orcamento-oricse.pdf");
    } else {
      const link = document.createElement("a"); link.download = "orcamento-oricse.jpeg"; link.href = jpg; link.click();
    }
  }
  async function compartilhar() {
    const canvas = gerarCanvas(); if (!canvas) return;
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!blob) return;
    const arquivo = new File([blob], "orcamento-oricse.jpeg", { type: "image/jpeg" });
    if (navigator.share && navigator.canShare?.({ files: [arquivo] })) {
      try { await navigator.share({ title: "Orçamento ORICSE", files: [arquivo] }); }
      catch (e) { if ((e as Error).name !== "AbortError") toast.error("Não foi possível compartilhar."); }
    } else { exportar("jpeg"); toast.info("Imagem salva. Anexe-a ao WhatsApp ou e-mail do tutor."); }
  }
  if (verificando) return <main className="p-8">Verificando acesso…</main>;
  if (!autorizado) return <main className="p-8" role="alert">Sem permissão para acessar a Venda Expressa.</main>;
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 pb-24">
    <Link to="/venda-expressa" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Venda Expressa</Link>
    <header><h1 className="text-3xl font-bold">Orçamento</h1><p className="text-muted-foreground">Crie uma proposta profissional sem registrar venda nem alterar o estoque.</p></header>
    <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
      {tutores.length > 0 && <label className="text-sm font-semibold sm:col-span-2">Selecionar tutor cadastrado (opcional)
        <select aria-label="Selecionar tutor cadastrado" className="mt-2 w-full rounded-xl border bg-background p-3" defaultValue="" onChange={e => {
          const tutor = tutores.find(t => t.id === e.target.value);
          if (tutor) { setNomeTutor(tutor.nome); setContatoTutor(tutor.telefone || tutor.email || ""); }
        }}><option value="">Sem seleção — orçamento avulso</option>{tutores.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
      </label>}
      <label className="text-sm font-semibold">Tutor/cliente (opcional)<input className="mt-2 w-full rounded-xl border bg-background p-3" value={nomeTutor} onChange={e=>setNomeTutor(e.target.value)} placeholder="Nome do tutor ou cliente"/></label>
      <label className="text-sm font-semibold">Contato (opcional)<input className="mt-2 w-full rounded-xl border bg-background p-3" value={contatoTutor} onChange={e=>setContatoTutor(e.target.value)} placeholder="WhatsApp ou e-mail"/></label>
      <label className="text-sm font-semibold">Validade (dias)<input type="number" min="1" max="365" className="mt-2 w-full rounded-xl border bg-background p-3" value={validade} onChange={e=>setValidade(e.target.value)}/></label>
      <div className="self-end text-sm text-muted-foreground">Clínica: {texto(clinica.nome) || "Carregando dados…"}</div>
    </section>
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between"><h2 className="font-bold">Produtos e serviços</h2><button type="button" onClick={adicionar} disabled={carregando || !produtos.length} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Plus size={17}/> Adicionar item</button></div>
      {itens.map(({ linha, preco, subtotalCentavos }) => <div key={linha.id} className="grid items-center gap-2 sm:grid-cols-[1fr_110px_125px_42px]">
        <select aria-label="Produto ou serviço" className="min-w-0 rounded-lg border bg-background p-2.5" value={linha.produtoId}
          onChange={e => atualizarLinha(linha.id, { produtoId: e.target.value })}>
          {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} · {p.faixas.length ? "Preço por perfil" : moeda(p.valor)}</option>)}
        </select>
        <input aria-label="Quantidade" type="number" min="0.001" step="0.001" className="min-w-0 rounded-lg border p-2.5"
          value={linha.quantidade} onChange={e => atualizarLinha(linha.id, { quantidade: Number(e.target.value) })}/>
        <strong className="text-sm tabular-nums">{subtotalCentavos === null ? "Pendente" : moeda(subtotalCentavos / 100)}</strong>
        <button type="button" aria-label="Remover item" onClick={() => setLinhas(a => a.filter(x => x.id !== linha.id))} className="rounded-lg border p-2.5"><Trash2 size={17}/></button>
        {preco && <PrecoPorPesoOrcamento perfil={linha.perfil} preco={preco}
          onChange={campos => atualizarLinha(linha.id, { perfil: { ...linha.perfil, ...campos } })} />}
      </div>)}
      {!linhas.length&&<p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Adicione os itens do orçamento.</p>}
      <p className="text-right text-xl font-bold">{temPrecoPendente ? "Parcial" : "Total"}: {moeda(total)}</p>
    </section>
    <label className="block text-sm font-semibold">Observações<textarea className="mt-2 min-h-24 w-full rounded-xl border bg-card p-3" value={observacoes} onChange={e=>setObservacoes(e.target.value)} placeholder="Condições e informações adicionais"/></label>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>exportar("pdf")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><FileDown size={18}/> PDF</button>
      <button type="button" onClick={()=>exportar("jpeg")} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold"><ImageDown size={18}/> JPEG</button>
      <button type="button" onClick={()=>{const canvas=gerarCanvas();if(canvas){const win=window.open("","_blank");if(!win){toast.error("Permita pop-ups para imprimir.");return;}const imagem=win.document.createElement("img");imagem.alt="Orçamento";imagem.style.width="100%";imagem.onload=()=>{win.focus();win.print();};win.document.body.style.margin="0";win.document.body.appendChild(imagem);imagem.src=canvas.toDataURL("image/jpeg",.94);}}} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold"><Printer size={18}/> Imprimir</button>
      <button type="button" onClick={()=>void compartilhar()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold"><Send size={18}/> Enviar ao tutor</button>
    </div>
  </main>;
}

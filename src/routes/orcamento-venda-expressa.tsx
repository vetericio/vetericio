import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileDown, ImageDown, Plus, Printer, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { usePermissoes } from "@/hooks/usePermissoes";
import { supabaseBanco } from "@/integrations/supabase/client";

export const Route = createFileRoute("/orcamento-venda-expressa")({ component: OrcamentoVendaExpressa });

type Produto = { id: string; nome: string; valor: number; tipo: string; ativo: boolean };
type Linha = { id: string; produtoId: string; quantidade: number };
type Clinica = Record<string, unknown>;
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const texto = (v: unknown) => typeof v === "string" ? v.trim() : "";
const numero = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;

function OrcamentoVendaExpressa() {
  const { clinicaId, carregando: verificando, adminGlobal, pode } = usePermissoes();
  const autorizado = adminGlobal || pode("caixa.comandas") || pode("caixa.financeiro.gerenciar");
  const [clinica, setClinica] = useState<Clinica>({});
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [nomeTutor, setNomeTutor] = useState("");
  const [contatoTutor, setContatoTutor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [validade, setValidade] = useState("7");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const total = useMemo(() => linhas.reduce((s, l) => s + (produtos.find(p => p.id === l.produtoId)?.valor || 0) * l.quantidade, 0), [linhas, produtos]);

  useEffect(() => {
    if (!clinicaId || !autorizado) return;
    let ativo = true;
    setCarregando(true);
    Promise.all([
      (supabaseBanco as any).from("clinicas").select("*").eq("id", clinicaId).single(),
      (supabaseBanco as any).from("oricse_catalogo_itens").select("id,nome,valor,tipo,ativo").eq("clinica_id", clinicaId).eq("ativo", true).order("nome"),
    ]).then(([c, p]) => {
      if (!ativo) return;
      if (c.error || p.error) throw new Error(c.error?.message || p.error?.message);
      setClinica(c.data || {});
      setProdutos(p.data || []);
    }).catch(e => { if (ativo) toast.error(e instanceof Error ? e.message : "Não foi possível carregar os dados."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [clinicaId, autorizado]);

  function adicionar() {
    const primeiro = produtos[0];
    if (!primeiro) return toast.error("Cadastre um produto ou serviço antes de elaborar o orçamento.");
    setLinhas(v => [...v, { id: crypto.randomUUID(), produtoId: primeiro.id, quantidade: 1 }]);
  }
  function gerarCanvas() {
    if (!linhas.length || linhas.some(l => !l.produtoId || !Number.isFinite(l.quantidade) || l.quantidade <= 0)) {
      toast.error("Inclua itens e quantidades válidas."); return null;
    }
    const largura = 1240, altura = Math.max(1754, 720 + linhas.length * 72 + (observacoes.length > 0 ? 260 : 0));
    const canvas = document.createElement("canvas"); canvas.width = largura; canvas.height = altura;
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, largura, altura);
    ctx.fillStyle = "#692b40"; ctx.fillRect(0, 0, largura, 16);
    ctx.fillStyle = "#182239"; ctx.font = "bold 40px Arial";
    ctx.fillText(texto(clinica.nome) || texto(clinica.clinica_nome) || "Clínica veterinária", 74, 105);
    ctx.font = "22px Arial"; ctx.fillStyle = "#4b5563";
    const endereco = [texto(clinica.endereco), texto(clinica.numero), texto(clinica.bairro), texto(clinica.cidade), texto(clinica.uf)].filter(Boolean).join(", ");
    const dados = [endereco, [texto(clinica.telefone), texto(clinica.clinica_telefone), texto(clinica.email), texto(clinica.clinica_email)].filter(Boolean).join(" • "), texto(clinica.cnpj) ? "CNPJ: " + texto(clinica.cnpj) : ""].filter(Boolean);
    dados.forEach((s, i) => ctx.fillText(s.slice(0, 96), 74, 150 + i * 33));
    ctx.strokeStyle = "#e3e5eb"; ctx.beginPath(); ctx.moveTo(74, 268); ctx.lineTo(1166, 268); ctx.stroke();
    ctx.fillStyle = "#692b40"; ctx.font = "bold 36px Arial"; ctx.fillText("ORÇAMENTO", 74, 331);
    ctx.font = "21px Arial"; ctx.fillStyle = "#374151";
    ctx.fillText("Emissão: " + new Date().toLocaleDateString("pt-BR"), 74, 372);
    ctx.fillText("Validade: " + validade + " dia(s)", 430, 372);
    ctx.fillText("Tutor/cliente: " + (nomeTutor.trim() || "Não informado"), 74, 425);
    if (contatoTutor.trim()) ctx.fillText("Contato: " + contatoTutor.trim().slice(0, 70), 74, 463);
    ctx.fillStyle = "#f5eef1"; ctx.fillRect(74, 510, 1092, 58);
    ctx.fillStyle = "#692b40"; ctx.font = "bold 23px Arial";
    ctx.fillText("DESCRIÇÃO", 93, 547); ctx.fillText("QTD.", 780, 547); ctx.fillText("TOTAL", 980, 547);
    let y = 617;
    linhas.forEach(l => {
      const item = produtos.find(p => p.id === l.produtoId);
      ctx.font = "22px Arial"; ctx.fillStyle = "#182239";
      ctx.fillText((item?.nome || "Item").slice(0, 49), 93, y);
      ctx.fillText(l.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 }), 780, y);
      ctx.fillText(moeda((item?.valor || 0) * l.quantidade), 980, y);
      ctx.strokeStyle = "#e3e5eb"; ctx.beginPath(); ctx.moveTo(74, y + 24); ctx.lineTo(1166, y + 24); ctx.stroke();
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
      pdf.addImage(jpg, "JPEG", 0, 0, 210, 210 * canvas.height / canvas.width);
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
      <label className="text-sm font-semibold">Tutor/cliente (opcional)<input className="mt-2 w-full rounded-xl border bg-background p-3" value={nomeTutor} onChange={e=>setNomeTutor(e.target.value)} placeholder="Nome do tutor ou cliente"/></label>
      <label className="text-sm font-semibold">Contato (opcional)<input className="mt-2 w-full rounded-xl border bg-background p-3" value={contatoTutor} onChange={e=>setContatoTutor(e.target.value)} placeholder="WhatsApp ou e-mail"/></label>
      <label className="text-sm font-semibold">Validade (dias)<input type="number" min="1" max="365" className="mt-2 w-full rounded-xl border bg-background p-3" value={validade} onChange={e=>setValidade(e.target.value)}/></label>
      <div className="self-end text-sm text-muted-foreground">Clínica: {texto(clinica.nome) || texto(clinica.clinica_nome) || "Carregando dados…"}</div>
    </section>
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between"><h2 className="font-bold">Produtos e serviços</h2><button type="button" onClick={adicionar} disabled={carregando || !produtos.length} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Plus size={17}/> Adicionar item</button></div>
      {linhas.map(l => {const item=produtos.find(p=>p.id===l.produtoId);return <div key={l.id} className="grid items-center gap-2 sm:grid-cols-[1fr_110px_125px_42px]">
        <select aria-label="Produto ou serviço" className="min-w-0 rounded-lg border bg-background p-2.5" value={l.produtoId} onChange={e=>setLinhas(a=>a.map(x=>x.id===l.id?{...x,produtoId:e.target.value}:x))}>{produtos.map(p=><option key={p.id} value={p.id}>{p.nome} · {moeda(numero(p.valor))}</option>)}</select>
        <input aria-label="Quantidade" type="number" min="0.001" step="0.001" className="rounded-lg border p-2.5" value={l.quantidade} onChange={e=>setLinhas(a=>a.map(x=>x.id===l.id?{...x,quantidade:Number(e.target.value)}:x))}/>
        <strong className="text-sm">{moeda((item?.valor||0)*l.quantidade)}</strong>
        <button type="button" aria-label="Remover item" onClick={()=>setLinhas(a=>a.filter(x=>x.id!==l.id))} className="rounded-lg border p-2.5"><Trash2 size={17}/></button>
      </div>})}
      {!linhas.length&&<p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Adicione os itens do orçamento.</p>}
      <p className="text-right text-xl font-bold">Total: {moeda(total)}</p>
    </section>
    <label className="block text-sm font-semibold">Observações<textarea className="mt-2 min-h-24 w-full rounded-xl border bg-card p-3" value={observacoes} onChange={e=>setObservacoes(e.target.value)} placeholder="Condições e informações adicionais"/></label>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>exportar("pdf")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><FileDown size={18}/> PDF</button>
      <button type="button" onClick={()=>exportar("jpeg")} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold"><ImageDown size={18}/> JPEG</button>
      <button type="button" onClick={()=>{const canvas=gerarCanvas();if(canvas){const win=window.open("","_blank");if(!win){toast.error("Permita pop-ups para imprimir.");return;}win.document.write('<img alt="Orçamento" style="width:100%" src="'+canvas.toDataURL("image/jpeg",.94)+'"/>');win.document.close();win.focus();win.print();}}} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold"><Printer size={18}/> Imprimir</button>
      <button type="button" onClick={()=>void compartilhar()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold"><Send size={18}/> Enviar ao tutor</button>
    </div>
  </main>;
}

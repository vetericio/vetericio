import { useState } from "react";
import { Download, Upload, RotateCcw, Save } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { oricseStorage, descarregarOricseStorage, hidratarOricseStorage } from "@/lib/oricse-storage";

const CHAVE = "oricse-politicas-operacionais-v1";
const schema = z.object({
  versao: z.literal(1),
  agenda: z.object({
    toleranciaMinutos: z.number().int().min(0).max(120),
    cancelamentoHoras: z.number().int().min(0).max(168),
    reagendamentoHoras: z.number().int().min(0).max(168),
    exigirSinal: z.boolean(),
    percentualSinal: z.number().int().min(0).max(100),
  }).strict(),
  aprovacoes: z.object({
    descontoAcimaPercentual: z.number().int().min(0).max(100),
    estornoExigeAprovacao: z.boolean(),
    exclusaoExigeAprovacao: z.boolean(),
  }).strict(),
  comunicacao: z.object({
    confirmacaoConsulta: z.string().max(1500),
    lembreteVacina: z.string().max(1500),
    mensagemRetorno: z.string().max(1500),
    mensagemPosConsulta: z.string().max(1500),
  }).strict(),
}).strict();
type Politicas = z.infer<typeof schema>;

export function BackupPoliticasClinica({podeGerenciar}:{podeGerenciar:boolean}){
  const [restaurar,setRestaurar] = useState<Politicas|null>(null);
  const [arquivo,setArquivo] = useState("");
  const [salvando,setSalvando] = useState(false);
  async function exportar(){
    try {
      await hidratarOricseStorage();
      const bruto = oricseStorage.getItem(CHAVE);
      if (!bruto) return toast.info("Salve as políticas da clínica antes de exportar.");
      const valido = schema.parse(JSON.parse(bruto));
      const blob = new Blob([JSON.stringify(valido,null,2)],{type:"application/json"});
      const url = URL.createObjectURL(blob), a=document.createElement("a");
      a.href=url; a.download="oricse-politicas-"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast.success("Backup manual exportado.");
    } catch { toast.error("Não foi possível ler as políticas salvas."); }
  }
  async function importar(file?:File){
    if (!file || !podeGerenciar) return;
    if (!file.name.toLowerCase().endsWith(".json") || file.size>20000 || file.size<2) return toast.error("Selecione JSON de até 20 KB.");
    try {
      const parseado=schema.parse(JSON.parse(await file.text()));
      setRestaurar(parseado);setArquivo(file.name);
    } catch {setRestaurar(null);toast.error("Backup incompatível. Nenhuma configuração foi alterada.");}
  }
  async function confirmar(){
    if (!podeGerenciar || !restaurar || salvando) return;
    if (!window.confirm("Substituir TODAS as políticas da clínica pelo backup selecionado? Revise o resumo antes de confirmar."))return;
    setSalvando(true);
    try {
      await hidratarOricseStorage();
      oricseStorage.setItem(CHAVE,JSON.stringify(restaurar));
      await descarregarOricseStorage();
      setRestaurar(null);
      toast.success("Políticas restauradas e confirmadas no servidor. Reabra a Central para visualizar.");
    } catch(e) {toast.error(e instanceof Error?e.message:"Não foi possível confirmar a restauração.");}
    finally {setSalvando(false);}
  }
  return <section className="mt-4 rounded-xl border bg-background p-4">
    <h3 className="text-sm font-semibold">Exportar e restaurar políticas</h3>
    <p className="mt-1 text-xs text-muted-foreground">Backup manual apenas de políticas administrativas, agenda e mensagens. Não inclui dados clínicos, pacientes ou documentos.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={()=>void exportar()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Download size={15}/> Exportar JSON</button>
      {podeGerenciar && <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Upload size={15}/> Importar JSON
        <input type="file" accept=".json,application/json" className="sr-only" onChange={e=>{void importar(e.target.files?.[0]);e.target.value="";}}/>
      </label>}
    </div>
    {restaurar && <div className="mt-3 rounded-lg border p-3">
      <p className="text-xs font-semibold">{arquivo}</p>
      <p className="mt-1 text-xs text-muted-foreground">Antecedência de cancelamento: {restaurar.agenda.cancelamentoHoras}h · Desconto sujeito à aprovação: acima de {restaurar.aprovacoes.descontoAcimaPercentual}% · 4 mensagens</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={salvando} onClick={()=>void confirmar()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Save size={15}/>{salvando?"Restaurando...":"Confirmar restauração"}</button>
        <button type="button" disabled={salvando} onClick={()=>setRestaurar(null)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs"><RotateCcw size={15}/> Cancelar</button>
      </div>
    </div>}
  </section>;
}

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { descarregarOricseStorage, hidratarOricseStorage, oricseStorage } from "@/lib/oricse-storage";

export const CHAVE_POLITICAS = "oricse-politicas-operacionais-v1";
export type PoliticasClinica = {
  versao: 1;
  agenda: { toleranciaMinutos: number; cancelamentoHoras: number; reagendamentoHoras: number; exigirSinal: boolean; percentualSinal: number };
  aprovacoes: { descontoAcimaPercentual: number; estornoExigeAprovacao: boolean; exclusaoExigeAprovacao: boolean };
  comunicacao: { confirmacaoConsulta: string; lembreteVacina: string; mensagemRetorno: string; mensagemPosConsulta: string };
};
const PADRAO: PoliticasClinica = {
  versao: 1,
  agenda: { toleranciaMinutos: 10, cancelamentoHoras: 24, reagendamentoHoras: 12, exigirSinal: false, percentualSinal: 0 },
  aprovacoes: { descontoAcimaPercentual: 10, estornoExigeAprovacao: true, exclusaoExigeAprovacao: true },
  comunicacao: {
    confirmacaoConsulta: "Olá, {{tutor}}! Sua consulta de {{paciente}} está agendada para {{data}} às {{hora}}.",
    lembreteVacina: "Olá, {{tutor}}! Verifique a próxima vacina de {{paciente}} com nossa equipe.",
    mensagemRetorno: "Olá, {{tutor}}! Está na hora de avaliar o retorno de {{paciente}}.",
    mensagemPosConsulta: "Olá, {{tutor}}! Como está {{paciente}} após o atendimento? Estamos à disposição.",
  },
};
const copiar = (valor: PoliticasClinica) => JSON.parse(JSON.stringify(valor)) as PoliticasClinica;
function lerPoliticas() {
  try {
    const salvo = oricseStorage.getItem(CHAVE_POLITICAS);
    if (!salvo) return copiar(PADRAO);
    const resultado = JSON.parse(salvo) as PoliticasClinica;
    if (resultado?.versao !== 1 || !resultado.agenda || !resultado.aprovacoes || !resultado.comunicacao) throw new Error("invalid");
    return resultado;
  } catch { throw new Error("As políticas salvas estão inconsistentes. Não será feita substituição automática."); }
}
function campoNumero(nome: string, valor: number, max: number, onChange: (valor: number)=>void, disabled: boolean) {
  return <label className="block text-xs font-medium text-foreground">{nome}<input type="number" value={valor} min={0} max={max} step={1} disabled={disabled}
    onChange={(e)=>onChange(Number(e.target.value))} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3 text-sm disabled:opacity-60"/></label>;
}
export function ConfiguracaoPoliticasClinica({ podeGerenciar, grupo }: { podeGerenciar: boolean; grupo: "estrutura"|"operacao"|"comunicacao" }) {
  const [politicas, setPoliticas] = useState<PoliticasClinica>(copiar(PADRAO));
  const [salvas, setSalvas] = useState<PoliticasClinica>(copiar(PADRAO));
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        await hidratarOricseStorage();
        const estado = lerPoliticas();
        if (ativo) { setPoliticas(estado); setSalvas(copiar(estado)); }
      } catch (e) { if (ativo) setErro(e instanceof Error ? e.message : "Falha ao carregar políticas."); }
      finally { if (ativo) setCarregando(false); }
    })();
    return () => { ativo = false; };
  }, []);
  const alterou = useMemo(()=>JSON.stringify(politicas)!==JSON.stringify(salvas),[politicas,salvas]);
  function mudarAgenda<K extends keyof PoliticasClinica["agenda"]>(chave:K,valor:PoliticasClinica["agenda"][K]) {
    setPoliticas(s=>({...s,agenda:{...s.agenda,[chave]:valor}}));
  }
  function mudarAprovacoes<K extends keyof PoliticasClinica["aprovacoes"]>(chave:K,valor:PoliticasClinica["aprovacoes"][K]) {
    setPoliticas(s=>({...s,aprovacoes:{...s.aprovacoes,[chave]:valor}}));
  }
  function mudarTexto(chave:keyof PoliticasClinica["comunicacao"],valor:string) {
    setPoliticas(s=>({...s,comunicacao:{...s.comunicacao,[chave]:valor}}));
  }
  async function salvar() {
    if (!podeGerenciar || salvando) return;
    const nums = [
      [politicas.agenda.toleranciaMinutos,120],
      [politicas.agenda.cancelamentoHoras,168],
      [politicas.agenda.reagendamentoHoras,168],
      [politicas.agenda.percentualSinal,100],
      [politicas.aprovacoes.descontoAcimaPercentual,100],
    ];
    if (nums.some(([n,max])=>!Number.isInteger(n)||n<0||n>max)) return toast.error("Revise os valores numéricos informados.");
    if (Object.values(politicas.comunicacao).some(v=>v.length>1500)) return toast.error("Cada mensagem deve ter no máximo 1.500 caracteres.");
    setSalvando(true);
    try {
      oricseStorage.setItem(CHAVE_POLITICAS,JSON.stringify(politicas));
      await descarregarOricseStorage();
      setSalvas(copiar(politicas));
      toast.success("Políticas salvas e confirmadas pelo servidor.");
    } catch(e) {
      toast.error(e instanceof Error?e.message:"Não foi possível confirmar o salvamento.");
    } finally { setSalvando(false); }
  }
  if(carregando) return <p className="mt-4 rounded-lg border p-3 text-xs text-muted-foreground">Carregando políticas da clínica...</p>;
  if(erro) return <p className="mt-4 rounded-lg border border-destructive/30 p-3 text-xs text-destructive" role="alert">{erro}</p>;
  return <section className="mt-5 rounded-xl border bg-background p-4 sm:p-5" aria-label="Políticas da clínica">
    <div className="mb-3 flex items-center gap-2"><ShieldCheck size={18} className="text-primary"/><div>
      <h3 className="text-sm font-semibold">{grupo==="estrutura"?"Regras de aprovação":grupo==="operacao"?"Cancelamentos e agendamentos":"Modelos de comunicação"}</h3>
      <p className="text-xs text-muted-foreground">Preferências administrativas salvas por clínica. A execução automática depende de integração específica em cada módulo.</p>
    </div></div>
    {grupo==="estrutura" && <div className="grid gap-3 sm:grid-cols-2">
      {campoNumero("Desconto que exige aprovação (acima de %)",politicas.aprovacoes.descontoAcimaPercentual,100,v=>mudarAprovacoes("descontoAcimaPercentual",v),!podeGerenciar)}
      <div className="space-y-3 sm:col-span-2">{([
        ["estornoExigeAprovacao","Estornos devem exigir aprovação"],
        ["exclusaoExigeAprovacao","Exclusões sensíveis devem exigir aprovação"],
      ] as const).map(([chave,rotulo])=><label key={chave} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={politicas.aprovacoes[chave]} disabled={!podeGerenciar} onChange={e=>mudarAprovacoes(chave,e.target.checked)} className="h-4 w-4 accent-primary"/>{rotulo}</label>)}</div>
    </div>}
    {grupo==="operacao" && <div className="grid gap-3 sm:grid-cols-2">
      {campoNumero("Tolerância de atraso (minutos)",politicas.agenda.toleranciaMinutos,120,v=>mudarAgenda("toleranciaMinutos",v),!podeGerenciar)}
      {campoNumero("Antecedência mínima para cancelamento (horas)",politicas.agenda.cancelamentoHoras,168,v=>mudarAgenda("cancelamentoHoras",v),!podeGerenciar)}
      {campoNumero("Antecedência mínima para reagendamento (horas)",politicas.agenda.reagendamentoHoras,168,v=>mudarAgenda("reagendamentoHoras",v),!podeGerenciar)}
      {campoNumero("Percentual de sinal sugerido (%)",politicas.agenda.percentualSinal,100,v=>mudarAgenda("percentualSinal",v),!podeGerenciar)}
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={politicas.agenda.exigirSinal} disabled={!podeGerenciar} onChange={e=>mudarAgenda("exigirSinal",e.target.checked)} className="h-4 w-4 accent-primary"/>Exigir sinal na política de agendamento (ainda não aplicado ao checkout)</label>
    </div>}
    {grupo==="comunicacao" && <div className="grid gap-3">
      {([
        ["confirmacaoConsulta","Confirmação de consulta"],
        ["lembreteVacina","Lembrete de vacina"],
        ["mensagemRetorno","Mensagem de retorno"],
        ["mensagemPosConsulta","Pós-consulta"],
      ] as const).map(([chave,rotulo])=><label key={chave} className="block text-xs font-medium">{rotulo}<textarea rows={3} maxLength={1500} disabled={!podeGerenciar} value={politicas.comunicacao[chave]} onChange={e=>mudarTexto(chave,e.target.value)} className="mt-1 w-full resize-y rounded-lg border bg-card p-3 text-sm font-normal"/></label>)}
      <p className="text-xs text-muted-foreground">Campos disponíveis para integração futura: {"{{tutor}}"}, {"{{paciente}}"}, {"{{data}}"}, {"{{hora}}"}. Nenhuma mensagem é enviada ao salvar.</p>
    </div>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 size={14}/>{alterou?"Alterações ainda não salvas":"Configurações salvas"}</p>
      <button type="button" disabled={!podeGerenciar || salvando || !alterou} onClick={()=>void salvar()}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save size={16}/>{salvando?"Salvando...":"Salvar políticas"}</button>
    </div>
  </section>;
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { formatarCentavos, simularSplit, type ModoCobranca } from "@/lib/payment-split";
export const Route = createFileRoute("/simulador-pagamentos")({ component: SimuladorPagamentos });
function centavos(texto:string){const n=Number(texto.replace(",", "."));return Number.isFinite(n)&&n>0?Math.round(n*100):0;}
function SimuladorPagamentos(){
 const [modo,setModo]=useState<ModoCobranca>("receber");
 const [valor,setValor]=useState("50,00");
 const [mp,setMp]=useState("5");
 const [fixo,setFixo]=useState("0");
 const [oricse,setOricse]=useState("10");
 const resultado=useMemo(()=>{
  try {return {valor:simularSplit(modo,centavos(valor),{mercadoPagoPercentual:Number(mp.replace(",",".")),mercadoPagoFixoCentavos:centavos(fixo),oricsePercentual:Number(oricse.replace(",","."))}),erro:""};}
  catch(e){return {valor:null,erro:e instanceof Error?e.message:"Valores inválidos"};}
 },[modo,valor,mp,fixo,oricse]);
 const campos=[["Mercado Pago (%)",mp,setMp],["Mercado Pago fixo (R$)",fixo,setFixo],["ORICSE (%)",oricse,setOricse]] as const;
 return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-7 text-foreground">
   <header><h1 className="text-2xl font-bold">Simulador de pagamentos</h1><p className="text-sm text-muted-foreground">Simulação financeira; não cria cobranças ou transfere dinheiro.</p></header>
   <section className="rounded-2xl border bg-card p-5 space-y-4">
    <div className="grid gap-2 sm:grid-cols-2">
     <button type="button" onClick={()=>setModo("receber")} aria-pressed={modo==="receber"} className={`rounded-xl border p-3 text-left font-semibold ${modo==="receber"?"border-primary bg-secondary":"border-border"}`}>Quero receber</button>
     <button type="button" onClick={()=>setModo("cobrar")} aria-pressed={modo==="cobrar"} className={`rounded-xl border p-3 text-left font-semibold ${modo==="cobrar"?"border-primary bg-secondary":"border-border"}`}>Quero cobrar</button>
    </div>
    <label className="block text-sm font-semibold">{modo==="receber"?"Quanto a clínica quer receber líquido (R$)":"Quanto deseja cobrar do tutor (R$)"}<input className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground" inputMode="decimal" value={valor} onChange={e=>setValor(e.target.value)}/></label>
    <div className="grid gap-3 sm:grid-cols-3">{campos.map(([rotulo,v,set])=><label key={rotulo} className="text-sm font-semibold">{rotulo}<input value={v} onChange={e=>set(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground"/></label>)}</div>
    <p className="text-xs text-muted-foreground">Informe as taxas contratadas. O MP pode variar por meio, prazo, parcelamento e condições da conta. Aqui a comissão ORICSE incide sobre o saldo após a tarifa Mercado Pago.</p>
   </section>
   {resultado.valor?<section className="rounded-2xl border bg-card p-5 space-y-3">
     <h2 className="font-bold">Prévia do repasse</h2>
     <div className="rounded-lg bg-secondary p-4"><div className="text-xs">Tutor pagará</div><div className="text-3xl font-black text-foreground">{formatarCentavos(resultado.valor.cobradoTutorCentavos)}</div></div>
     <div className="flex justify-between gap-2"><span>Taxa estimada Mercado Pago</span><strong>{formatarCentavos(resultado.valor.taxaMercadoPagoCentavos)}</strong></div>
     <div className="flex justify-between gap-2"><span>Comissão ORICSE</span><strong>{formatarCentavos(resultado.valor.taxaOricseCentavos)}</strong></div>
     <div className="flex justify-between gap-2 border-t pt-3"><strong>Valor líquido estimado da clínica</strong><strong>{formatarCentavos(resultado.valor.liquidoClinicaCentavos)}</strong></div>
    </section>:<p role="alert" className="rounded-xl border p-4 text-destructive">{resultado.erro}</p>}
    <p className="text-sm text-muted-foreground">A cobrança em produção somente será liberada após conectar a conta Mercado Pago da clínica por OAuth, configurar as tarifas, testar webhooks e aprovar a conciliação.</p>
 </main>;
}

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
 return (
  <main className="mx-auto min-h-screen w-full max-w-6xl space-y-5 px-4 py-5 text-foreground sm:px-6 sm:py-7">
    <header>
      <h1 className="text-2xl font-bold">Simulador de pagamentos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Simulação financeira; não cria cobranças ou transfere dinheiro.</p>
    </header>

    {/* Faixa horizontal compacta: escolha do modo, sem ocupar espaço do simulador. */}
    <section aria-label="Modo de cobrança" className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2.5 sm:px-4">
      <span className="shrink-0 text-sm font-bold">Modo de cobrança</span>
      <div role="group" aria-label="Escolher modo de cobrança" className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:max-w-[340px]">
        <button type="button" onClick={()=>setModo("receber")} aria-pressed={modo==="receber"}
          className={`min-h-9 rounded-lg border px-2 py-1.5 text-center text-sm font-semibold transition-colors ${modo==="receber"?"border-primary bg-secondary text-foreground":"border-border hover:bg-secondary/60"}`}>
          Quero receber
        </button>
        <button type="button" onClick={()=>setModo("cobrar")} aria-pressed={modo==="cobrar"}
          className={`min-h-9 rounded-lg border px-2 py-1.5 text-center text-sm font-semibold transition-colors ${modo==="cobrar"?"border-primary bg-secondary text-foreground":"border-border hover:bg-secondary/60"}`}>
          Quero cobrar
        </button>
      </div>
    </section>

    {/* O restante da página é reservado ao formulário e ao resultado do simulador. */}
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)] lg:items-start">
      <section className="min-w-0 space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-bold">Dados da simulação</h2>
          <p className="mt-1 text-sm text-muted-foreground">Informe o valor e as taxas da operação.</p>
        </div>
        <label className="block text-sm font-semibold">
          {modo==="receber"?"Quanto a clínica quer receber líquido (R$)":"Quanto deseja cobrar do tutor (R$)"}
          <input className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 py-3 text-lg font-bold text-foreground"
            inputMode="decimal" value={valor} onChange={e=>setValor(e.target.value)}/>
        </label>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {campos.map(([rotulo,v,set])=><label key={rotulo} className="min-w-0 text-sm font-semibold">
            {rotulo}
            <input value={v} onChange={e=>set(e.target.value)} inputMode="decimal"
              className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-foreground"/>
          </label>)}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Informe as taxas contratadas. O MP pode variar por meio, prazo, parcelamento e condições da conta.
          Aqui a comissão ORICSE incide sobre o saldo após a tarifa Mercado Pago.
        </p>
      </section>

      {resultado.valor ? (
        <section aria-live="polite" className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">Prévia do repasse</h2>
          <div className="rounded-xl bg-secondary p-5">
            <div className="text-sm text-muted-foreground">Tutor pagará</div>
            <div className="mt-1 break-words text-3xl font-black text-foreground sm:text-4xl">
              {formatarCentavos(resultado.valor.cobradoTutorCentavos)}
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span>Taxa estimada Mercado Pago</span>
            <strong>{formatarCentavos(resultado.valor.taxaMercadoPagoCentavos)}</strong>
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span>Comissão ORICSE</span>
            <strong>{formatarCentavos(resultado.valor.taxaOricseCentavos)}</strong>
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <strong>Valor líquido estimado da clínica</strong>
            <strong className="text-lg">{formatarCentavos(resultado.valor.liquidoClinicaCentavos)}</strong>
          </div>
        </section>
      ) : (
        <p role="alert" className="rounded-xl border bg-card p-5 text-destructive">{resultado.erro}</p>
      )}
    </div>
    <p className="text-sm text-muted-foreground">
      A cobrança em produção somente será liberada após conectar a conta Mercado Pago da clínica por OAuth,
      configurar as tarifas, testar webhooks e aprovar a conciliação.
    </p>
  </main>
 );
}

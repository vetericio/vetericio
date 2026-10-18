import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";
type Modo="receber"|"cobrar";
type Item={id:string;titulo:string;valor_comanda_centavos:number;cobrar_portal:boolean;modo:Modo;valor_centavos:number;ativo:boolean};
type Previa={cobrado_tutor_centavos:number;liquido_clinica_centavos:number;desconto_mp_centavos:number;comissao_oricse_centavos:number};
export const Route=createFileRoute("/precos-portal")({component:Cobrancas});
const moeda=(c:number)=>(c/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const cents=(s:string)=>{const n=Number(s.replace(",", "."));return Number.isFinite(n)?Math.round(n*100):0};
function Cobrancas(){
 const [lista,setLista]=useState<Item[]>([]),[id,setId]=useState<string|null>(null),[nome,setNome]=useState("Consulta"),[valor,setValor]=useState("50,00"),[portal,setPortal]=useState(false),[modo,setModo]=useState<Modo>("cobrar"),[valorOnline,setValorOnline]=useState("50,00"),[meio,setMeio]=useState("pix"),[previa,setPrevia]=useState<Previa|null>(null),[erroPrevia,setErroPrevia]=useState(""),[erro,setErro]=useState(""),[salvando,setSalvando]=useState(false);
 async function carregar(){const {data,error}=await (supabaseBanco as any).rpc("oricse_listar_cobrancas_integradas");if(error){setErro(error.message);return;}setErro("");setLista(data||[])}
 useEffect(()=>{void carregar()},[]);
 useEffect(()=>{if(!id&&modo==="cobrar")setValorOnline(valor)},[valor,id,modo]);
 useEffect(()=>{let active=true;setPrevia(null);setErroPrevia("");if(!portal)return;const c=cents(valorOnline);if(c<=0)return;const timeout=setTimeout(async()=>{const {data,error}=await (supabaseBanco as any).rpc("oricse_previsualizar_cobranca",{p_modo:modo,p_valor_centavos:c,p_modalidade:meio});if(!active)return;if(error)setErroPrevia("Tarifas do pagamento online ainda não configuradas pelo Admin ORICSE.");else setPrevia(data?.[0]||null)},350);return()=>{active=false;clearTimeout(timeout)}},[portal,modo,valorOnline,meio]);
 function editar(item:Item){setId(item.id);setNome(item.titulo);setValor((item.valor_comanda_centavos/100).toFixed(2).replace(".",","));setPortal(item.cobrar_portal);setModo(item.modo);setValorOnline((item.valor_centavos/100).toFixed(2).replace(".",","));window.scrollTo({top:0,behavior:"smooth"})}
 function novo(){setId(null);setNome("");setValor("50,00");setValorOnline("50,00");setModo("cobrar");setPortal(false)}
 async function salvar(){const v=cents(valor),vo=portal?cents(valorOnline):v;if(!nome.trim()||v<=0||vo<=0){toast.error("Preencha descrição e valores válidos.");return;}setSalvando(true);
 const {error}=await (supabaseBanco as any).rpc("oricse_salvar_cobranca_integrada",{p_id:id,p_titulo:nome,p_valor_comanda:v,p_cobrar_portal:portal,p_modo:portal?modo:"cobrar",p_valor_online:vo});
 setSalvando(false);if(error){toast.error(error.message);return;}toast.success("Serviço e cobrança salvos.");novo();await carregar()}
 return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 text-foreground">
 <header><h1 className="text-2xl font-bold">Cobranças da clínica</h1><p className="text-sm text-muted-foreground">Defina o valor fixo do serviço para a comanda. Só configure taxas e repasses se quiser cobrar também pelo Portal do Tutor.</p></header>
 <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
 <h2 className="text-lg font-bold">{id?"Editar serviço":"Cadastrar serviço e valor"}</h2>
 <label className="block text-sm font-semibold">Serviço<input className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex.: Consulta"/></label>
 <label className="block text-sm font-semibold">Valor fixo na comanda (R$)<input className="mt-1 w-full rounded-lg border bg-background p-3 text-lg font-bold text-foreground" inputMode="decimal" value={valor} onChange={e=>setValor(e.target.value)}/><span className="mt-1 block text-xs font-normal text-muted-foreground">Preço-base do atendimento, sem taxas de pagamento online.</span></label>
 <label className="flex items-center justify-between gap-4 rounded-xl border bg-secondary/50 p-4"><span><strong>Cobrar no Portal do Tutor?</strong><span className="mt-1 block text-xs text-muted-foreground">Ative para oferecer pagamento online desse serviço.</span></span><input type="checkbox" checked={portal} onChange={e=>setPortal(e.target.checked)} className="h-5 w-5"/></label>
 {portal&&<div className="space-y-4 rounded-xl border p-4">
 <h3 className="font-bold">Pagamento online</h3>
 <div className="grid gap-2 sm:grid-cols-2"><button type="button" aria-pressed={modo==="receber"} onClick={()=>{setModo("receber");setValorOnline(valor)}} className={`rounded-xl border p-3 text-left ${modo==="receber"?"border-primary bg-secondary":"border-border"}`}><strong>Quero receber</strong><p className="text-xs text-muted-foreground">Defina o líquido desejado pela clínica.</p></button><button type="button" aria-pressed={modo==="cobrar"} onClick={()=>{setModo("cobrar");setValorOnline(valor)}} className={`rounded-xl border p-3 text-left ${modo==="cobrar"?"border-primary bg-secondary":"border-border"}`}><strong>Quero cobrar</strong><p className="text-xs text-muted-foreground">Defina o valor total pago pelo tutor.</p></button></div>
 <label className="block text-sm font-semibold">{modo==="receber"?"Valor líquido desejado (R$)":"Preço no portal (R$)"}<input className="mt-1 w-full rounded-lg border bg-background p-3" inputMode="decimal" value={valorOnline} onChange={e=>setValorOnline(e.target.value)}/></label>
 <label className="block text-sm font-semibold">Simular com<select className="mt-1 w-full rounded-lg border bg-background p-3" value={meio} onChange={e=>setMeio(e.target.value)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option></select></label>
 {previa?<div className="space-y-2 rounded-xl bg-secondary/50 p-4"><div className="flex justify-between"><span>Tutor pagará</span><strong>{moeda(previa.cobrado_tutor_centavos)}</strong></div><div className="flex justify-between"><span>Clínica receberá (estimativa)</span><strong>{moeda(previa.liquido_clinica_centavos)}</strong></div><p className="text-xs text-muted-foreground">Taxas estimadas pelo sistema. O valor fixo da comanda continua independente.</p></div>:<p role="status" className="text-sm text-muted-foreground">{erroPrevia||"Calculando pagamento online…"}</p>}
 </div>}
 <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>void salvar()} disabled={salvando} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{salvando?"Salvando…":id?"Salvar alterações":"Salvar serviço"}</button>{id&&<button type="button" onClick={novo} className="rounded-xl border px-4 py-3">Cancelar edição</button>}</div>
 </section>
 <section className="space-y-2"><h2 className="text-lg font-bold">Serviços cadastrados</h2>{erro&&<p role="alert" className="text-destructive">{erro}</p>}{lista.map(item=><article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><div><h3 className="font-bold">{item.titulo}</h3><p className="text-sm">Comanda: <strong>{moeda(item.valor_comanda_centavos)}</strong></p><p className="text-xs text-muted-foreground">Portal do Tutor: {item.cobrar_portal?"Cobrança online configurada":"Sem cobrança online"}</p></div><button type="button" onClick={()=>editar(item)} className="rounded-xl border px-4 py-2">Editar</button></article>)}{lista.length===0&&<p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>}</section>
 <p className="text-xs text-muted-foreground">Configurar o preço não cria automaticamente um item na comanda nem ativa o checkout. Essas integrações serão liberadas após validação do fluxo financeiro.</p>
 </main>
}
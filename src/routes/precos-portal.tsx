import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";

export const Route=createFileRoute("/precos-portal")({component:PrecosServicos});
type Servico={id:string;nome:string;preco:number|string;tipo:string};
type Pagamento={catalogo_item_id:string;cobrar_portal:boolean;modo:"receber"|"cobrar";valor_centavos:number};
type Previa={cobrado_tutor_centavos:number;liquido_clinica_centavos:number};
const brl=(v:number)=>(v/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function paraCentavos(v:string){const n=Number(v.replace(/\./g,"").replace(",","."));return Number.isFinite(n)?Math.round(n*100):0}
function PrecosServicos(){
 const [servicos,setServicos]=useState<Servico[]>([]),[configs,setConfigs]=useState<Pagamento[]>([]),
 [id,setId]=useState(""),[preco,setPreco]=useState(""),[cobrar,setCobrar]=useState(false),
 [modo,setModo]=useState<"receber"|"cobrar">("cobrar"),[online,setOnline]=useState(""),[meio,setMeio]=useState("pix"),
 [previa,setPrevia]=useState<Previa|null>(null),[erroPrevia,setErroPrevia]=useState(""),
 [erro,setErro]=useState(""),[carregando,setCarregando]=useState(true),[salvando,setSalvando]=useState(false);
 async function carregar(){setCarregando(true);try{
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw Error("Faça login.");
  const {data:vinculo,error:vErr}=await supabase.from("clinica_usuarios").select("clinica_id").eq("user_id",user.id).eq("ativo",true).limit(1).maybeSingle();
  if(vErr||!vinculo?.clinica_id)throw Error("Clínica não identificada.");
  const [catalogo,pag]=await Promise.all([supabase.from("clinica_catalogo_itens").select("id,nome,preco,tipo").eq("clinica_id",vinculo.clinica_id).eq("tipo","servico").eq("ativo",true).order("nome"),(supabaseBanco as any).rpc("oricse_listar_pagamentos_catalogo")]);
  if(catalogo.error)throw catalogo.error;if(pag.error)throw pag.error;
  setServicos(catalogo.data||[]);setConfigs(pag.data||[]);setErro("");
 }catch(e){setErro(e instanceof Error?e.message:"Falha ao carregar serviços")}finally{setCarregando(false)}}
 useEffect(()=>{void carregar()},[]);
 function selecionar(servicoId:string){setId(servicoId);const servico=servicos.find(x=>x.id===servicoId);const c=configs.find(x=>x.catalogo_item_id===servicoId);const valor=Number(servico?.preco||0);const str=valor.toFixed(2).replace(".",",");setPreco(str);setCobrar(Boolean(c?.cobrar_portal));setModo(c?.modo||"cobrar");setOnline(c?(c.valor_centavos/100).toFixed(2).replace(".",","):str);setPrevia(null)}
 useEffect(()=>{if(!cobrar){setPrevia(null);return;}let ativo=true;const n=paraCentavos(online);if(n<=0){setPrevia(null);return;}const timer=setTimeout(async()=>{const {data,error}=await (supabaseBanco as any).rpc("oricse_previsualizar_cobranca",{p_modo:modo,p_valor_centavos:n,p_modalidade:meio});if(!ativo)return;if(error){setErroPrevia("Taxas online ainda não configuradas pelo Admin ORICSE.");setPrevia(null)}else{setErroPrevia("");setPrevia(data?.[0]||null)}},300);return()=>{ativo=false;clearTimeout(timer)}},[cobrar,online,modo,meio]);
 async function salvar(){const servico=servicos.find(x=>x.id===id),centavos=paraCentavos(preco);if(!servico||centavos<0||!Number.isSafeInteger(centavos)){toast.error("Escolha um serviço e informe seu preço.");return;}const onlineCents=cobrar?paraCentavos(online):Math.max(centavos,1);if(cobrar&&(!onlineCents||!previa)){toast.error("Configure antes as taxas do pagamento online.");return;}setSalvando(true);
 try{
  const {error:pErr}=await (supabaseBanco as any).rpc("oricse_configurar_pagamento_catalogo",{p_catalogo_item_id:servico.id,p_titulo:servico.nome,p_valor_referencia:centavos,p_cobrar_portal:cobrar,p_modo:cobrar?modo:"cobrar",p_valor_online:onlineCents});
  if(pErr)throw Error("Não foi possível salvar a configuração online: "+pErr.message);
  const {error:e}=await supabase.from("clinica_catalogo_itens").update({preco:centavos/100}).eq("id",servico.id).eq("tipo","servico");
  if(e)throw Error("Configuração do portal salva, mas a atualização do catálogo falhou: "+e.message);
  toast.success("Preço do catálogo e opção online salvos.");await carregar();
 }catch(e){toast.error(e instanceof Error?e.message:"Erro ao salvar")}finally{setSalvando(false)}}
 const item=servicos.find(s=>s.id===id);
 return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 text-foreground"><header><h1 className="text-2xl font-black">Cobranças da clínica</h1><p className="text-sm text-muted-foreground">O valor da comanda vem do Catálogo de Serviços. Ative o pagamento pelo portal somente quando desejar.</p></header>
 {erro&&<p role="alert" className="rounded-xl border p-4 text-destructive">{erro}</p>}
 <section className="space-y-4 rounded-2xl border bg-card p-5">
  <label className="block text-sm font-semibold">Serviço do catálogo<select disabled={carregando} value={id} onChange={e=>selecionar(e.target.value)} className="mt-1 w-full rounded-xl border bg-background p-3 text-foreground"><option value="">Selecione um serviço</option>{servicos.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
  {!servicos.length&&!carregando&&<p className="text-sm">Ainda não há serviços cadastrados. <Link to="/catalogo" className="font-bold underline text-primary">Cadastrar serviço</Link></p>}
  {item&&<>
    <label className="block text-sm font-semibold">Valor fixo na comanda (R$)<input className="mt-1 w-full rounded-xl border bg-background p-3 text-lg font-bold text-foreground" inputMode="decimal" value={preco} onChange={e=>setPreco(e.target.value)}/><span className="mt-1 block text-xs font-normal text-muted-foreground">Altera o preço do serviço no catálogo. A comanda utiliza esse valor.</span></label>
    <label className="flex items-center justify-between gap-3 rounded-xl border bg-secondary/50 p-4"><span><strong>Cobrar no Portal do Tutor?</strong><span className="block text-xs text-muted-foreground">Pagamento online opcional deste serviço.</span></span><input className="h-5 w-5" type="checkbox" checked={cobrar} onChange={e=>{setCobrar(e.target.checked);if(e.target.checked&&!online)setOnline(preco)}}/></label>
    {cobrar&&<div className="space-y-3 rounded-xl border p-4"><h2 className="font-bold">Pagamento no portal</h2><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={()=>{setModo("receber");setOnline(preco)}} aria-pressed={modo==="receber"} className={`rounded-xl border p-3 text-left ${modo==="receber"?"border-primary bg-secondary":"border-border"}`}><strong>Quero receber</strong><p className="text-xs">Define o líquido da clínica</p></button><button type="button" onClick={()=>{setModo("cobrar");setOnline(preco)}} aria-pressed={modo==="cobrar"} className={`rounded-xl border p-3 text-left ${modo==="cobrar"?"border-primary bg-secondary":"border-border"}`}><strong>Quero cobrar</strong><p className="text-xs">Define quanto o tutor pagará</p></button></div>
    <label className="block text-sm font-semibold">{modo==="receber"?"Valor líquido desejado (R$)":"Cobrar do tutor (R$)"}<input value={online} onChange={e=>setOnline(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
    <label className="block text-sm font-semibold">Simular com<select value={meio} onChange={e=>setMeio(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option></select></label>
    {previa?<div className="rounded-xl bg-secondary/50 p-4 space-y-2"><div className="flex justify-between"><span>Tutor pagará</span><strong>{brl(previa.cobrado_tutor_centavos)}</strong></div><div className="flex justify-between"><span>Clínica receberá (estimativa)</span><strong>{brl(previa.liquido_clinica_centavos)}</strong></div></div>:<p className="text-sm text-muted-foreground">{erroPrevia||"Calculando estimativa…"}</p>}
    </div>}
    <button disabled={salvando} onClick={()=>void salvar()} className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50">{salvando?"Salvando…":"Salvar preço e cobrança"}</button>
  </>}
 </section><section className="rounded-2xl border bg-card p-5"><h2 className="font-bold">Serviços cadastrados</h2><div className="mt-3 space-y-2">{servicos.map(s=><button type="button" key={s.id} onClick={()=>selecionar(s.id)} className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left"><span><strong>{s.nome}</strong><span className="block text-xs text-muted-foreground">Portal: {configs.find(c=>c.catalogo_item_id===s.id)?.cobrar_portal?"Cobrança habilitada":"Sem cobrança"}</span></span><strong>{Number(s.preco).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></button>)}</div></section>
 <p className="text-xs text-muted-foreground">O preço do catálogo é a referência da comanda; o checkout do tutor ainda depende da homologação Mercado Pago. As tarifas são estimadas.</p></main>
}
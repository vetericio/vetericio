import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contratar")({ component: Contratar });

type Dados = Record<string, string> & { quantidade_usuarios: string };

const VAZIO: Dados = {
  clinica_nome: "", razao_social: "", cnpj: "", clinica_telefone: "", clinica_email: "", clinica_cep: "", clinica_endereco: "", clinica_numero: "", clinica_complemento: "", clinica_bairro: "", clinica_cidade: "", clinica_uf: "",
  tipo_operacao: "clinica", slug_desejado: "", dominio: "", quantidade_usuarios: "1",
  responsavel_nome: "", responsavel_cpf: "", responsavel_crmv: "", responsavel_crmv_uf: "", responsavel_email: "", responsavel_telefone: "", responsavel_cep: "", responsavel_endereco: "", responsavel_numero: "", responsavel_complemento: "", responsavel_bairro: "", responsavel_cidade: "", responsavel_uf: "",
  observacoes: "",
};

function campo(label: string, nome: string, dados: Dados, setDados: (d: Dados)=>void, obrigatorio = true, tipo = "text") {
  return <label className="text-sm font-semibold">{label}{obrigatorio && <span className="text-destructive"> *</span>}<input type={tipo} value={dados[nome] || ""} onChange={e=>setDados({...dados,[nome]:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"/></label>;
}

function Contratar() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const plano = params.get("plano") || "essencial";
  const ciclo = params.get("ciclo") === "anual" ? "anual" : "mensal";
  const [etapa, setEtapa] = useState(1);
  const [dados, setDados] = useState<Dados>(() => { try { return {...VAZIO,...JSON.parse(localStorage.getItem("oricse-contratacao") || "{}")}; } catch { return VAZIO; } });
  const [termos, setTermos] = useState(false);
  const [privacidade, setPrivacidade] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState<any>(null);

  const nomePlano = useMemo(() => plano.charAt(0).toUpperCase()+plano.slice(1), [plano]);
  const salvarLocal = (novo: Dados) => { setDados(novo); localStorage.setItem("oricse-contratacao", JSON.stringify(novo)); };
  const exigeCrmv = dados.tipo_operacao === "clinica" || dados.tipo_operacao === "misto";

  function validarAtual() {
    const obrig1 = ["clinica_nome","tipo_operacao","clinica_telefone","clinica_email","clinica_cep","clinica_endereco","clinica_numero","clinica_bairro","clinica_cidade","clinica_uf"];
    const obrig2 = ["responsavel_nome","responsavel_cpf","responsavel_email","responsavel_telefone","responsavel_cep","responsavel_endereco","responsavel_numero","responsavel_bairro","responsavel_cidade","responsavel_uf"];
    if (exigeCrmv) obrig2.push("responsavel_crmv", "responsavel_crmv_uf");
    const faltando = (etapa===1?obrig1:obrig2).some(k=>!String(dados[k]||"").trim());
    if (faltando) { toast.error("Preencha os campos obrigatórios."); return false; }
    return true;
  }

  async function continuarPagamento() {
    if (!termos || !privacidade) { toast.error("Aceite os Termos de Uso e a Política de Privacidade."); return; }
    setEnviando(true);
    const payload = { ...dados, plano_codigo: plano, ciclo, quantidade_usuarios: Number(dados.quantidade_usuarios)||1, aceitou_termos: true, aceitou_privacidade: true };
    const { data, error } = await (supabase as any).rpc("oricse_iniciar_contratacao", { p_dados: payload });
    setEnviando(false);
    if (error) { toast.error(error.message || "Não foi possível iniciar a contratação."); return; }
    const item = Array.isArray(data) ? data[0] : data;
    setPedido(item);
    setEtapa(4);
  }

  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6"><div className="mx-auto max-w-4xl">
    <Link to="/planos" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={18}/> Voltar aos planos</Link>
    <header className="mt-6 rounded-3xl border bg-card p-6 shadow-sm"><p className="text-sm font-semibold text-primary">Plano {nomePlano} · {ciclo === "anual" ? "Anual" : "Mensal"}</p><h1 className="mt-2 text-3xl font-bold">Contratação da Oricse</h1><p className="mt-2 text-muted-foreground">Preencha os dados, revise e siga para o pagamento. A contratação só será enviada para análise depois da confirmação do pagamento.</p></header>

    <div className="mt-5 flex gap-2">{[1,2,3,4].map(n=><div key={n} className={`h-2 flex-1 rounded-full ${n<=etapa?"bg-primary":"bg-muted"}`}/>)}</div>

    {etapa===1 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">1. Dados do estabelecimento</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Tipo de operação <span className="text-destructive">*</span><select value={dados.tipo_operacao} onChange={e=>salvarLocal({...dados,tipo_operacao:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="clinica">Clínica veterinária</option><option value="petshop">Pet shop</option><option value="domicilio">Veterinário em domicílio</option><option value="misto">Clínica + pet shop</option></select></label>{campo("Nome da clínica / estabelecimento","clinica_nome",dados,salvarLocal)}{campo("Razão social","razao_social",dados,salvarLocal,false)}{campo("CNPJ","cnpj",dados,salvarLocal,false)}{campo("Telefone","clinica_telefone",dados,salvarLocal)}{campo("E-mail","clinica_email",dados,salvarLocal,true,"email")}{campo("CEP","clinica_cep",dados,salvarLocal)}{campo("Endereço","clinica_endereco",dados,salvarLocal)}{campo("Número","clinica_numero",dados,salvarLocal)}{campo("Complemento","clinica_complemento",dados,salvarLocal,false)}{campo("Bairro","clinica_bairro",dados,salvarLocal)}{campo("Cidade","clinica_cidade",dados,salvarLocal)}{campo("UF","clinica_uf",dados,salvarLocal)}</div><p className="mt-4 text-xs text-muted-foreground">CNPJ é opcional.</p></section>}

    {etapa===2 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">2. Responsável</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{campo("Nome do responsável","responsavel_nome",dados,salvarLocal)}{campo("CPF","responsavel_cpf",dados,salvarLocal)}{campo("CRMV","responsavel_crmv",dados,salvarLocal,exigeCrmv)}{campo("UF do CRMV","responsavel_crmv_uf",dados,salvarLocal,exigeCrmv)}{campo("Telefone","responsavel_telefone",dados,salvarLocal)}{campo("E-mail","responsavel_email",dados,salvarLocal,true,"email")}{campo("CEP","responsavel_cep",dados,salvarLocal)}{campo("Endereço","responsavel_endereco",dados,salvarLocal)}{campo("Número","responsavel_numero",dados,salvarLocal)}{campo("Complemento","responsavel_complemento",dados,salvarLocal,false)}{campo("Bairro","responsavel_bairro",dados,salvarLocal)}{campo("Cidade","responsavel_cidade",dados,salvarLocal)}{campo("UF","responsavel_uf",dados,salvarLocal)}</div><p className="mt-4 text-xs text-muted-foreground">{exigeCrmv ? "Para clínica veterinária, CRMV e UF do CRMV são obrigatórios." : "Para esta modalidade, CRMV é opcional."}</p></section>}

    {etapa===3 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">3. Configuração e revisão</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{campo("@ desejado","slug_desejado",dados,salvarLocal,false)}{campo("Domínio próprio","dominio",dados,salvarLocal,false)}{campo("Quantidade de usuários","quantidade_usuarios",dados,salvarLocal,true,"number")}</div><label className="mt-4 block text-sm font-semibold">Observações<textarea value={dados.observacoes} onChange={e=>salvarLocal({...dados,observacoes:e.target.value})} rows={3} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-normal"/></label><div className="mt-5 rounded-2xl bg-muted/40 p-4 text-sm"><p><b>Plano:</b> {nomePlano}</p><p><b>Cobrança:</b> {ciclo === "anual" ? "Anual" : "Mensal"}</p><p><b>Estabelecimento:</b> {dados.clinica_nome}</p><p><b>Tipo:</b> {dados.tipo_operacao}</p><p><b>Responsável:</b> {dados.responsavel_nome}</p></div><label className="mt-5 flex gap-3 text-sm"><input type="checkbox" checked={termos} onChange={e=>setTermos(e.target.checked)}/> <span>Li e concordo com os Termos de Uso.</span></label><label className="mt-3 flex gap-3 text-sm"><input type="checkbox" checked={privacidade} onChange={e=>setPrivacidade(e.target.checked)}/> <span>Li e concordo com a Política de Privacidade e tratamento de dados.</span></label></section>}

    {etapa===4 && <section className="mt-5 rounded-3xl border bg-card p-7 text-center shadow-sm"><CreditCard className="mx-auto text-primary" size={42}/><h2 className="mt-3 text-2xl font-bold">Cadastro pronto para pagamento</h2><p className="mx-auto mt-2 max-w-xl text-muted-foreground">Seu cadastro foi reservado, mas ainda não foi enviado para análise. Ele só aparecerá como contratação válida no Admin depois que o pagamento for confirmado.</p><div className="mx-auto mt-5 max-w-md rounded-2xl border p-4 text-left text-sm"><p><b>Plano:</b> {nomePlano}</p><p><b>Ciclo:</b> {ciclo}</p><p><b>Status:</b> aguardando pagamento</p>{pedido?.id && <p className="mt-2 text-xs text-muted-foreground">Pedido {String(pedido.id).slice(0,8)}</p>}</div><p className="mt-5 text-sm font-semibold text-amber-700">O checkout será liberado assim que o provedor de pagamento for conectado.</p></section>}

    {etapa<4 && <div className="mt-5 flex justify-between gap-3">{etapa>1?<button onClick={()=>setEtapa(etapa-1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold"><ChevronLeft size={18}/> Voltar</button>:<span/>}{etapa<3?<button onClick={()=>{if(validarAtual())setEtapa(etapa+1)}} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Continuar <ChevronRight size={18}/></button>:<button disabled={enviando} onClick={continuarPagamento} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"><Check size={18}/>{enviando?"Preparando...":"Ir para pagamento"}</button>}</div>}
  </div></main>;
}

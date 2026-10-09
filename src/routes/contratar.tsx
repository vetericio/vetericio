import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, CreditCard, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

const TEXTO_PADRAO = {
  voltar_planos: "Voltar aos planos",
  titulo_contratacao: "Contratação da Oricse",
  subtitulo_contratacao: "Preencha os dados, revise e siga para o pagamento. A contratação só será enviada para análise depois da confirmação do pagamento.",
  etapa1_titulo: "Dados da clínica",
  etapa2_titulo: "Responsável",
  etapa3_titulo: "Configuração e revisão",
  etapa4_titulo: "Cadastro pronto para pagamento",
  etapa4_texto: "Seu cadastro foi reservado, mas ainda não foi enviado para análise. Ele só aparecerá como contratação válida no Admin depois que o pagamento for confirmado.",
  perfis_titulo: "Perfis de acesso",
  perfis_texto: "Seu plano inclui até {incluidos} {perfil}. Cada perfil adicional custa {valor}/mês.",
  perfis_incluidos_rotulo: "Incluídos",
  perfis_extras_rotulo: "Extras",
  perfis_adicional_rotulo: "Adicional",
  valor_perfil_extra_mensal: 14.9,
  observacoes_rotulo: "Observações",
  texto_termos: "Li e concordo com os Termos de Uso.",
  texto_privacidade: "Li e concordo com a Política de Privacidade e tratamento de dados.",
  botao_continuar: "Continuar",
  botao_voltar: "Voltar",
  botao_pagamento: "Ir para pagamento",
  preparando_pagamento: "Preparando...",
  checkout_pendente: "O checkout será liberado assim que o provedor de pagamento for conectado.",
};

function campo(label: string, nome: string, dados: Dados, setDados: (d: Dados)=>void, obrigatorio = true, tipo = "text") {
  return <label className="text-sm font-semibold">{label}{obrigatorio && <span className="text-destructive"> *</span>}<input type={tipo} value={dados[nome] || ""} onChange={e=>setDados({...dados,[nome]:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"/></label>;
}

function parseBRL(valor?: string) {
  if (!valor) return 0;
  const limpo = valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : 0;
}

function brl(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Contratar() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const plano = params.get("plano") || "essencial";
  const ehTesteGratis = plano === "teste-gratis";
  const ciclo = ehTesteGratis ? "teste" : (params.get("ciclo") === "anual" ? "anual" : "mensal");
  const [etapa, setEtapa] = useState(1);
  const [dados, setDados] = useState<Dados>(() => { try { return {...VAZIO,...JSON.parse(localStorage.getItem("oricse-contratacao") || "{}")}; } catch { return VAZIO; } });
  const [configPlano, setConfigPlano] = useState<any>(null);
  const [texto, setTexto] = useState<any>(TEXTO_PADRAO);
  const [termos, setTermos] = useState(false);
  const [privacidade, setPrivacidade] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState<any>(null);

  useEffect(() => {
    void (async () => {
      const [planoResp, cfgResp] = await Promise.all([
        (supabase as any).from("oricse_planos").select("codigo,nome,usuarios_inclusos,preco_mensal,preco_anual").eq("codigo", plano).maybeSingle(),
        (supabase as any).from("oricse_config").select("valor").eq("chave", "site_publico").maybeSingle(),
      ]);
      if (cfgResp.data?.valor) setTexto({ ...TEXTO_PADRAO, ...cfgResp.data.valor });
      if (planoResp.data) {
        setConfigPlano(planoResp.data);
        setDados(atual => {
          const atualQtd = Math.max(1, Number(atual.quantidade_usuarios) || 1);
          const minimoInicial = ehTesteGratis ? 1 : Math.min(atualQtd, Math.max(1, Number(planoResp.data.usuarios_inclusos) || 1));
          const novo = { ...atual, quantidade_usuarios: String(minimoInicial) };
          localStorage.setItem("oricse-contratacao", JSON.stringify(novo));
          return novo;
        });
      }
    })();
  }, [plano, ehTesteGratis]);

  const nomePlano = useMemo(() => configPlano?.nome || plano.charAt(0).toUpperCase()+plano.slice(1), [configPlano, plano]);
  const salvarLocal = (novo: Dados) => { setDados(novo); localStorage.setItem("oricse-contratacao", JSON.stringify(novo)); };

  const perfisIncluidos = Math.max(1, Number(configPlano?.usuarios_inclusos) || 1);
  const quantidadeUsuarios = ehTesteGratis ? 1 : Math.max(1, Number(dados.quantidade_usuarios) || 1);
  const perfisExtras = ehTesteGratis ? 0 : Math.max(0, quantidadeUsuarios - perfisIncluidos);
  const valorPerfilExtraMensal = Math.max(0, Number(texto.valor_perfil_extra_mensal) || 0);
  const adicionalMensal = perfisExtras * valorPerfilExtraMensal;
  const adicionalCiclo = ciclo === "anual" ? adicionalMensal * 12 : adicionalMensal;
  const valorBase = ehTesteGratis ? 0 : parseBRL(ciclo === "anual" ? configPlano?.preco_anual : configPlano?.preco_mensal);
  const valorTotal = ehTesteGratis ? 0 : valorBase + adicionalCiclo;

  const explicacaoPerfis = String(texto.perfis_texto || TEXTO_PADRAO.perfis_texto)
    .replaceAll("{incluidos}", String(perfisIncluidos))
    .replaceAll("{perfil}", perfisIncluidos === 1 ? "perfil" : "perfis")
    .replaceAll("{valor}", brl(valorPerfilExtraMensal));

  const mudarQuantidade = (delta: number) => salvarLocal({ ...dados, quantidade_usuarios: String(Math.max(1, quantidadeUsuarios + delta)) });

  function validarAtual() {
    const obrig1 = ["clinica_nome","clinica_telefone","clinica_email","clinica_cep","clinica_endereco","clinica_numero","clinica_bairro","clinica_cidade","clinica_uf"];
    if (ehTesteGratis) obrig1.push("cnpj");
    const obrig2 = ["responsavel_nome","responsavel_cpf","responsavel_email","responsavel_telefone","responsavel_cep","responsavel_endereco","responsavel_numero","responsavel_bairro","responsavel_cidade","responsavel_uf"];
    if (dados.tipo_operacao === "clinica" || dados.tipo_operacao === "misto") obrig2.push("responsavel_crmv", "responsavel_crmv_uf");
    const faltando = (etapa===1?obrig1:obrig2).some(k=>!String(dados[k]||"").trim());
    if (faltando) { toast.error("Preencha os campos obrigatórios."); return false; }
    if (etapa===1 && ehTesteGratis) {
      const doc = String(dados.cnpj || "").replace(/\D/g, "");
      if (![11,14].includes(doc.length)) { toast.error("Informe um CPF ou CNPJ válido para o teste gratuito."); return false; }
    }
    return true;
  }

  async function continuarPagamento() {
    if (!termos || !privacidade) { toast.error("Aceite os Termos de Uso e a Política de Privacidade."); return; }
    setEnviando(true);
    const payload = { ...dados, plano_codigo: plano, ciclo, quantidade_usuarios: quantidadeUsuarios, perfis_inclusos: perfisIncluidos, perfis_extras: perfisExtras, adicional_perfis_mensal: adicionalMensal, adicional_perfis_ciclo: adicionalCiclo, valor_base: valorBase, valor_total: valorTotal, aceitou_termos: true, aceitou_privacidade: true };
    const { data, error } = await (supabase as any).rpc(ehTesteGratis ? "oricse_iniciar_teste_gratis" : "oricse_iniciar_contratacao", { p_dados: payload });
    setEnviando(false);
    if (error) { toast.error(error.message || (ehTesteGratis ? "Não foi possível iniciar o teste gratuito." : "Não foi possível iniciar a contratação.")); return; }
    setPedido(Array.isArray(data) ? data[0] : data);
    setEtapa(4);
  }

  const crmvObrigatorio = dados.tipo_operacao === "clinica" || dados.tipo_operacao === "misto";

  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6"><div className="mx-auto max-w-4xl">
    <Link to="/planos" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={18}/> {texto.voltar_planos}</Link>
    <header className="mt-6 rounded-3xl border bg-card p-6 shadow-sm"><p className="text-sm font-semibold text-primary">Plano {nomePlano} · {ehTesteGratis ? "7 dias grátis" : ciclo === "anual" ? "Anual" : "Mensal"}</p><h1 className="mt-2 text-3xl font-bold">{ehTesteGratis ? "Comece seu teste gratuito" : texto.titulo_contratacao}</h1><p className="mt-2 text-muted-foreground">{ehTesteGratis ? "Use a Oricse por 7 dias sem cobrança. O teste é único por CPF/CNPJ." : texto.subtitulo_contratacao}</p></header>
    <div className="mt-5 flex gap-2">{[1,2,3,4].map(n=><div key={n} className={`h-2 flex-1 rounded-full ${n<=etapa?"bg-primary":"bg-muted"}`}/>)}</div>

    {etapa===1 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">1. {texto.etapa1_titulo}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Tipo de operação *<select value={dados.tipo_operacao} onChange={e=>salvarLocal({...dados,tipo_operacao:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="clinica">Clínica veterinária</option><option value="petshop">Pet shop</option><option value="domicilio">Veterinário em domicílio</option><option value="misto">Clínica + pet shop</option></select></label>{campo("Nome da clínica","clinica_nome",dados,salvarLocal)}{campo("Razão social","razao_social",dados,salvarLocal,false)}{campo(ehTesteGratis ? "CPF/CNPJ da empresa" : "CNPJ","cnpj",dados,salvarLocal,ehTesteGratis)}{campo("Telefone","clinica_telefone",dados,salvarLocal)}{campo("E-mail","clinica_email",dados,salvarLocal,true,"email")}{campo("CEP","clinica_cep",dados,salvarLocal)}{campo("Endereço","clinica_endereco",dados,salvarLocal)}{campo("Número","clinica_numero",dados,salvarLocal)}{campo("Complemento","clinica_complemento",dados,salvarLocal,false)}{campo("Bairro","clinica_bairro",dados,salvarLocal)}{campo("Cidade","clinica_cidade",dados,salvarLocal)}{campo("UF","clinica_uf",dados,salvarLocal)}</div>{ehTesteGratis && <p className="mt-3 text-xs text-muted-foreground">O CPF/CNPJ é usado para garantir um único período de teste gratuito por empresa/profissional.</p>}</section>}

    {etapa===2 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">2. {texto.etapa2_titulo}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{campo("Nome do responsável","responsavel_nome",dados,salvarLocal)}{campo("CPF","responsavel_cpf",dados,salvarLocal)}{campo("CRMV","responsavel_crmv",dados,salvarLocal,crmvObrigatorio)}{campo("UF do CRMV","responsavel_crmv_uf",dados,salvarLocal,crmvObrigatorio)}{campo("Telefone","responsavel_telefone",dados,salvarLocal)}{campo("E-mail","responsavel_email",dados,salvarLocal,true,"email")}{campo("CEP","responsavel_cep",dados,salvarLocal)}{campo("Endereço","responsavel_endereco",dados,salvarLocal)}{campo("Número","responsavel_numero",dados,salvarLocal)}{campo("Complemento","responsavel_complemento",dados,salvarLocal,false)}{campo("Bairro","responsavel_bairro",dados,salvarLocal)}{campo("Cidade","responsavel_cidade",dados,salvarLocal)}{campo("UF","responsavel_uf",dados,salvarLocal)}</div>{!crmvObrigatorio && <p className="mt-3 text-xs text-muted-foreground">CRMV é opcional para pet shop e atendimento em domicílio.</p>}</section>}

    {etapa===3 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">3. {texto.etapa3_titulo}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{campo("@ desejado","slug_desejado",dados,salvarLocal,false)}{campo("Domínio próprio","dominio",dados,salvarLocal,false)}
      {!ehTesteGratis && <div className="sm:col-span-2 rounded-2xl border bg-background p-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold">{texto.perfis_titulo}</p><p className="mt-1 text-xs text-muted-foreground">{explicacaoPerfis}</p></div><div className="flex items-center gap-3"><button type="button" onClick={()=>mudarQuantidade(-1)} disabled={quantidadeUsuarios<=1} className="flex h-10 w-10 items-center justify-center rounded-xl border disabled:opacity-40"><Minus size={18}/></button><div className="min-w-12 text-center text-2xl font-bold">{quantidadeUsuarios}</div><button type="button" onClick={()=>mudarQuantidade(1)} className="flex h-10 w-10 items-center justify-center rounded-xl border"><Plus size={18}/></button></div></div>
      <div className="mt-4 grid gap-2 rounded-xl bg-muted/40 p-3 text-sm sm:grid-cols-3"><div><span className="text-muted-foreground">{texto.perfis_incluidos_rotulo}</span><p className="font-bold">{Math.min(quantidadeUsuarios, perfisIncluidos)}</p></div><div><span className="text-muted-foreground">{texto.perfis_extras_rotulo}</span><p className="font-bold">{perfisExtras}</p></div><div><span className="text-muted-foreground">{texto.perfis_adicional_rotulo}</span><p className="font-bold">{brl(adicionalCiclo)}{ciclo === "anual" ? "/ano" : "/mês"}</p></div></div></div>}
      {ehTesteGratis && <div className="sm:col-span-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm"><p className="font-bold text-primary">Como funciona o teste de 7 dias</p><p className="mt-2 text-muted-foreground">O teste é único por CPF/CNPJ. Ao final dos 7 dias, o acesso à área clínica fica pausado até a contratação de um plano. Seus dados permanecem armazenados, mas enquanto a conta estiver pausada não será possível editar, exportar, gerar downloads ou fazer backup pelo sistema.</p></div>}
    </div><label className="mt-4 block text-sm font-semibold">{texto.observacoes_rotulo}<textarea value={dados.observacoes} onChange={e=>salvarLocal({...dados,observacoes:e.target.value})} rows={3} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-normal"/></label>
    <div className="mt-5 rounded-2xl bg-muted/40 p-4 text-sm"><p><b>Plano:</b> {nomePlano}</p><p><b>Cobrança:</b> {ehTesteGratis ? "Grátis por 7 dias" : ciclo === "anual" ? "Anual" : "Mensal"}</p><p><b>Clínica:</b> {dados.clinica_nome}</p><p><b>Responsável:</b> {dados.responsavel_nome}</p>{!ehTesteGratis && <><p><b>Perfis:</b> {quantidadeUsuarios} ({perfisExtras > 0 ? `${perfisExtras} extra${perfisExtras > 1 ? "s" : ""}` : "sem adicionais"})</p><p className="mt-2"><b>Plano:</b> {brl(valorBase)}</p>{perfisExtras > 0 && <p><b>Perfis extras:</b> {brl(adicionalCiclo)}</p>}<p className="mt-1 text-base"><b>Total:</b> {brl(valorTotal)} {ciclo === "anual" ? "/ ano" : "/ mês"}</p></>}</div>
    <label className="mt-5 flex gap-3 text-sm"><input type="checkbox" checked={termos} onChange={e=>setTermos(e.target.checked)}/> <span>{texto.texto_termos}</span></label><label className="mt-3 flex gap-3 text-sm"><input type="checkbox" checked={privacidade} onChange={e=>setPrivacidade(e.target.checked)}/> <span>{texto.texto_privacidade}</span></label></section>}

    {etapa===4 && <section className="mt-5 rounded-3xl border bg-card p-7 text-center shadow-sm">{ehTesteGratis ? <Check className="mx-auto text-primary" size={42}/> : <CreditCard className="mx-auto text-primary" size={42}/>}<h2 className="mt-3 text-2xl font-bold">{ehTesteGratis ? "Seu teste gratuito foi solicitado 💚" : texto.etapa4_titulo}</h2><p className="mx-auto mt-2 max-w-xl text-muted-foreground">{ehTesteGratis ? "Seu CPF/CNPJ ficou vinculado a este único período de teste. Assim que a conta for ativada, os 7 dias começam a contar." : texto.etapa4_texto}</p><div className="mx-auto mt-5 max-w-md rounded-2xl border p-4 text-left text-sm"><p><b>Plano:</b> {nomePlano}</p><p><b>Período:</b> {ehTesteGratis ? "7 dias grátis" : ciclo}</p><p><b>Perfis:</b> {quantidadeUsuarios}</p>{!ehTesteGratis && <p><b>Total:</b> {brl(valorTotal)} {ciclo === "anual" ? "/ ano" : "/ mês"}</p>}<p><b>Status:</b> {ehTesteGratis ? "aguardando ativação" : "aguardando pagamento"}</p>{pedido?.id && <p className="mt-2 text-xs text-muted-foreground">Pedido {String(pedido.id).slice(0,8)}</p>}</div>{!ehTesteGratis && <p className="mt-5 text-sm font-semibold text-amber-700">{texto.checkout_pendente}</p>}</section>}

    {etapa<4 && <div className="mt-5 flex justify-between gap-3">{etapa>1?<button onClick={()=>setEtapa(etapa-1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold"><ChevronLeft size={18}/> {texto.botao_voltar}</button>:<span/>}{etapa<3?<button onClick={()=>{if(validarAtual())setEtapa(etapa+1)}} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">{texto.botao_continuar} <ChevronRight size={18}/></button>:<button disabled={enviando} onClick={continuarPagamento} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"><Check size={18}/>{enviando?texto.preparando_pagamento:(ehTesteGratis ? "Iniciar teste grátis" : texto.botao_pagamento)}</button>}</div>}
  </div></main>;
}
import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, Check, ChevronLeft, ChevronRight, CreditCard, ChevronDown, ExternalLink, Minus, Plus, TicketPercent } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contratar")({ component: Contratar });

type Dados = Record<string, string> & { quantidade_usuarios: string };

type PromoAplicado = {
  codigo: string;
  valor_original: number;
  desconto_aplicado: number;
  valor_final: number;
  duracao: "primeiro_mes" | "recorrente";
};

const VAZIO: Dados = {
  clinica_nome: "", razao_social: "", cnpj: "", clinica_telefone: "", clinica_email: "", clinica_cep: "", clinica_endereco: "", clinica_numero: "", clinica_complemento: "", clinica_bairro: "", clinica_cidade: "", clinica_uf: "",
  tipo_operacao: "clinica", operacoes_ativas: "clinica", slug_desejado: "", nome_publico: "", dominio: "", quantidade_usuarios: "1",
  responsavel_nome: "", responsavel_cpf: "", responsavel_crmv: "", responsavel_crmv_uf: "", responsavel_email: "", responsavel_telefone: "", responsavel_cep: "", responsavel_endereco: "", responsavel_numero: "", responsavel_complemento: "", responsavel_bairro: "", responsavel_cidade: "", responsavel_uf: "",
  observacoes: "",
};


const TIPOS_OPERACAO = [
  { valor: "clinica", nome: "Clínica / hospital veterinário" },
  { valor: "domicilio", nome: "Veterinário em domicílio" },
  { valor: "hotelzinho", nome: "Hotelzinho" },
  { valor: "petshop", nome: "Pet shop / banho e tosa" },
  { valor: "misto", nome: "Operação mista (combinar serviços)" },
] as const;
const OPERACOES_BASE = TIPOS_OPERACAO.filter(tipo => tipo.valor !== "misto");
const TIPOS_COM_ATENDIMENTO_VETERINARIO = new Set(["clinica"]);
const obterOperacoes = (dados: Dados) => dados.tipo_operacao === "misto" ? (dados.operacoes_ativas || "").split(",").filter(valor => OPERACOES_BASE.some(tipo => tipo.valor === valor)) : [dados.tipo_operacao];
const exigeCrmv = (dados: Dados) => obterOperacoes(dados).some(tipo => TIPOS_COM_ATENDIMENTO_VETERINARIO.has(tipo));

type CicloContratacao = "mensal" | "trimestral" | "semestral" | "anual" | "bienal" | "teste";
const CICLOS: Array<{codigo: Exclude<CicloContratacao,"teste">; nome: string; meses: number; descricao: string}> = [
  { codigo: "mensal", nome: "Mensal", meses: 1, descricao: "Cobrança a cada mês, na data de vencimento." },
  { codigo: "trimestral", nome: "Trimestral", meses: 3, descricao: "Uma cobrança a cada 3 meses." },
  { codigo: "semestral", nome: "Semestral", meses: 6, descricao: "Uma cobrança a cada 6 meses." },
  { codigo: "anual", nome: "Anual", meses: 12, descricao: "Acesso por 365 dias." },
  { codigo: "bienal", nome: "Dois anos", meses: 24, descricao: "Uma cobrança a cada 24 meses." },
];
const PLANOS_CONTRATACAO = {
  essencial: { codigo: "essencial", nome: "Essencial", usuarios_inclusos: 1, preco_mensal: "R$ 49,90", preco_trimestral: "R$ 149,70", preco_semestral: "R$ 299,40", preco_anual: "R$ 499,00", preco_bienal: "R$ 1.197,60" },
  "plus-clinica": { codigo: "plus-clinica", nome: "Plus (Clínica)", usuarios_inclusos: 3, preco_mensal: "R$ 99,90", preco_trimestral: "R$ 299,70", preco_semestral: "R$ 599,40", preco_anual: "R$ 999,00", preco_bienal: "R$ 2.397,60" },
  "master-equipe": { codigo: "master-equipe", nome: "Master (Equipe)", usuarios_inclusos: 5, preco_mensal: "R$ 199,90", preco_trimestral: "R$ 599,70", preco_semestral: "R$ 1.199,40", preco_anual: "R$ 1.999,00", preco_bienal: "R$ 4.797,60" },
} as const;
function precoDoCiclo(plano:any,ciclo:CicloContratacao){return String(plano?.[ciclo==="mensal"?"preco_mensal":ciclo==="trimestral"?"preco_trimestral":ciclo==="semestral"?"preco_semestral":ciclo==="anual"?"preco_anual":"preco_bienal"]||"");}
function mesesDoCiclo(ciclo:CicloContratacao){return CICLOS.find((item)=>item.codigo===ciclo)?.meses||1;}
function nomeDoCiclo(ciclo:CicloContratacao){return ciclo==="teste"?"Teste":(CICLOS.find((item)=>item.codigo===ciclo)?.nome||ciclo);}

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

type EnderecoCep = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

async function consultarCepComFallback(cep: string, signal: AbortSignal): Promise<EnderecoCep> {
  const resposta = await fetch(`/api/cep/${cep}`, { signal });
  const endereco = await resposta.json().catch(() => null);
  if (!resposta.ok || !endereco?.localidade || !endereco?.uf) {
    throw new Error(endereco?.erro || "CEP não encontrado");
  }
  return endereco;
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
  const planoParam = params.get("plano") || "essencial";
  const plano = planoParam in PLANOS_CONTRATACAO || planoParam === "teste-gratis" ? planoParam : ({ "plus (clínica)": "plus-clinica", "master (equipe)": "master-equipe" } as Record<string,string>)[planoParam.toLowerCase()] || planoParam;
  const ehTesteGratis = plano === "teste-gratis";
  const cicloParam=params.get("ciclo");
  const cicloInicial:CicloContratacao=ehTesteGratis?"teste":(CICLOS.some((item)=>item.codigo===cicloParam)?cicloParam as Exclude<CicloContratacao,"teste">:"mensal");
  const [ciclo,setCiclo]=useState<CicloContratacao>(cicloInicial);
  const [modoRenovacao,setModoRenovacao]=useState<"automatica_cartao"|"manual">("automatica_cartao");
  const [etapa, setEtapa] = useState(1);
  const operacaoMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const fecharAoClicarFora = (evento: PointerEvent) => {
      if (operacaoMenuRef.current && !operacaoMenuRef.current.contains(evento.target as Node)) operacaoMenuRef.current.open = false;
    };
    document.addEventListener("pointerdown", fecharAoClicarFora);
    return () => document.removeEventListener("pointerdown", fecharAoClicarFora);
  }, []);
  const [dados, setDados] = useState<Dados>(() => { try { return {...VAZIO,...JSON.parse(oricseStorage.getItem("oricse-contratacao") || "{}")}; } catch { return VAZIO; } });
  const [configPlano, setConfigPlano] = useState<any>(() => PLANOS_CONTRATACAO[plano as keyof typeof PLANOS_CONTRATACAO] || null);
  const [texto, setTexto] = useState<any>(TEXTO_PADRAO);
  const [termos, setTermos] = useState(false);
  const [privacidade, setPrivacidade] = useState(false);
  const [aceitouFidelidadeMaster, setAceitouFidelidadeMaster] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState<any>(null);
  const [abrindoCheckout, setAbrindoCheckout] = useState(false);
  const [codigoPromocional, setCodigoPromocional] = useState("");
  const [promoAplicado, setPromoAplicado] = useState<PromoAplicado | null>(null);
  const [validandoPromo, setValidandoPromo] = useState(false);
  const [erroPromo, setErroPromo] = useState("");
  const retornoPagamento = params.get("retorno");
  const pedidoRetorno = params.get("pedido");
  useEffect(() => {
    if (!retornoPagamento || !["sucesso","pendente","falha"].includes(retornoPagamento)) return;
    const url = new URL("/contratacao-recebida", window.location.origin);
    url.searchParams.set("retorno", retornoPagamento);
    window.location.replace(url.toString());
  }, [retornoPagamento]);

  async function abrirCheckout(id: string) {
    if (!id || abrindoCheckout) return;
    setAbrindoCheckout(true);
    try {
      const res = await fetch("https://mwrmfcyrdxfxssebgknz.supabase.co/functions/v1/oricse-planos-checkout?action=checkout", {
        method:"POST", headers:{"content-type":"application/json"},
        body:JSON.stringify({pedido_id:id}),
      });
      const data = await res.json();
      if (!res.ok || typeof data.checkout_url !== "string" || !data.checkout_url.startsWith("https://www.mercadopago.com")) {
        throw new Error(data.error || "Checkout indisponível");
      }
      window.location.assign(data.checkout_url);
    } catch(e) {
      toast.error(e instanceof Error ? e.message : "Falha ao abrir o pagamento");
      setAbrindoCheckout(false);
    }
  }


  useEffect(() => {
    void (async () => {
      const [planoResp, cfgResp] = await Promise.all([
        (supabase as any).from("oricse_planos").select("codigo,nome,usuarios_inclusos,preco_mensal,preco_trimestral,preco_semestral,preco_anual,preco_bienal").eq("codigo", plano).maybeSingle(),
        (supabase as any).from("oricse_config").select("valor").eq("chave", "site_publico").maybeSingle(),
      ]);
      if (cfgResp.data?.valor) setTexto({ ...TEXTO_PADRAO, ...cfgResp.data.valor });
      if (planoResp.data) {
        setConfigPlano(planoResp.data);
        setDados(atual => {
          const atualQtd = Math.max(1, Number(atual.quantidade_usuarios) || 1);
          const minimoInicial = ehTesteGratis ? 1 : Math.min(atualQtd, Math.max(1, Number(planoResp.data.usuarios_inclusos) || 1));
          const novo = { ...atual, quantidade_usuarios: String(minimoInicial) };
          oricseStorage.setItem("oricse-contratacao", JSON.stringify(novo));
          return novo;
        });
      }
    })();
  }, [plano, ehTesteGratis]);

  const planoConhecido = ehTesteGratis || plano in PLANOS_CONTRATACAO;
  const nomePlano = useMemo(() => configPlano?.nome || plano.charAt(0).toUpperCase()+plano.slice(1), [configPlano, plano]);
  const salvarLocal = (novo: Dados) => { setDados(novo); oricseStorage.setItem("oricse-contratacao", JSON.stringify(novo)); };

  // Consulta automática do CEP para os dois endereços do cadastro.
  // Atualiza somente se o CEP ainda corresponder à consulta realizada.
  useEffect(() => {
    const cep = (dados.clinica_cep || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const endereco = await consultarCepComFallback(cep, controller.signal);
        setDados(atual => {
          if ((atual.clinica_cep || "").replace(/\D/g, "") !== cep) return atual;
          const novo = { ...atual, clinica_endereco: endereco.logradouro || atual.clinica_endereco, clinica_bairro: endereco.bairro || atual.clinica_bairro, clinica_cidade: endereco.localidade || atual.clinica_cidade, clinica_uf: endereco.uf || atual.clinica_uf };
          oricseStorage.setItem("oricse-contratacao", JSON.stringify(novo));
          return novo;
        });
      } catch (erro) {
        if (!controller.signal.aborted) toast.error("Não foi possível consultar o CEP. Você pode preencher o endereço manualmente.");
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [dados.clinica_cep]);

  useEffect(() => {
    const cep = (dados.responsavel_cep || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const endereco = await consultarCepComFallback(cep, controller.signal);
        setDados(atual => {
          if ((atual.responsavel_cep || "").replace(/\D/g, "") !== cep) return atual;
          const novo = { ...atual, responsavel_endereco: endereco.logradouro || atual.responsavel_endereco, responsavel_bairro: endereco.bairro || atual.responsavel_bairro, responsavel_cidade: endereco.localidade || atual.responsavel_cidade, responsavel_uf: endereco.uf || atual.responsavel_uf };
          oricseStorage.setItem("oricse-contratacao", JSON.stringify(novo));
          return novo;
        });
      } catch (erro) {
        if (!controller.signal.aborted) toast.error("Não foi possível consultar o CEP. Você pode preencher o endereço manualmente.");
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [dados.responsavel_cep]);


  const perfisIncluidos = Math.max(1, Number(configPlano?.usuarios_inclusos) || 1);
  const quantidadeUsuarios = ehTesteGratis ? 1 : Math.max(1, Number(dados.quantidade_usuarios) || 1);
  const perfisExtras = ehTesteGratis ? 0 : Math.max(0, quantidadeUsuarios - perfisIncluidos);
  const valorPerfilExtraMensal = Math.max(0, Number(texto.valor_perfil_extra_mensal) || 0);
  const adicionalMensal = perfisExtras * valorPerfilExtraMensal;
  const adicionalCiclo=adicionalMensal*mesesDoCiclo(ciclo);
  const valorBase=ehTesteGratis?0:parseBRL(precoDoCiclo(configPlano,ciclo));
  const valorTotal=ehTesteGratis?0:valorBase+adicionalCiclo;
  const cicloNome=nomeDoCiclo(ciclo);
  const descontoPromocional = promoAplicado?.desconto_aplicado || 0;
  const valorCobrado = Math.max(0, promoAplicado?.valor_final ?? valorTotal);

  const explicacaoPerfis = String(texto.perfis_texto || TEXTO_PADRAO.perfis_texto)
    .replaceAll("{incluidos}", String(perfisIncluidos))
    .replaceAll("{perfil}", perfisIncluidos === 1 ? "perfil" : "perfis")
    .replaceAll("{valor}", brl(valorPerfilExtraMensal));

  function limparPromocao() {
    setPromoAplicado(null);
    setErroPromo("");
  }

  function trocarCiclo(proximo: Exclude<CicloContratacao,"teste">) {
    if (ciclo === proximo) return;
    setCiclo(proximo);
    limparPromocao();
  }

  async function aplicarCodigoPromocional() {
    const codigo = codigoPromocional.trim().toUpperCase().replace(/\s+/g, "-");
    if (!codigo) {
      setErroPromo("Digite um código promocional para aplicar.");
      return;
    }
    setValidandoPromo(true);
    setErroPromo("");
    const documento = String(dados.cnpj || dados.responsavel_cpf || "");
    const { data, error } = await (supabase as any).rpc("oricse_validar_codigo_promocional", {
      p_codigo: codigo,
      p_plano_codigo: plano,
      p_documento: documento,
      p_valor_base: valorTotal,
    });
    setValidandoPromo(false);
    const validacao = Array.isArray(data) ? data[0] : data;
    if (error || !validacao?.valido) {
      setPromoAplicado(null);
      setErroPromo(error?.message || validacao?.mensagem || "Código inválido.");
      return;
    }
    setCodigoPromocional(String(validacao.codigo || codigo));
    setPromoAplicado({
      codigo: String(validacao.codigo || codigo),
      valor_original: Number(validacao.valor_original ?? valorTotal),
      desconto_aplicado: Number(validacao.desconto_aplicado || 0),
      valor_final: Number(validacao.valor_final ?? valorTotal),
      duracao: validacao.duracao === "recorrente" ? "recorrente" : "primeiro_mes",
    });
  }

  const mudarQuantidade = (delta: number) => {
    limparPromocao();
    salvarLocal({ ...dados, quantidade_usuarios: String(Math.max(1, quantidadeUsuarios + delta)) });
  };

  function validarAtual() {
    const obrig1 = ["clinica_nome","clinica_telefone","clinica_email","clinica_cep","clinica_endereco","clinica_numero","clinica_bairro","clinica_cidade","clinica_uf"];
    if (ehTesteGratis) obrig1.push("cnpj");
    const obrig2 = ["responsavel_nome","responsavel_cpf","responsavel_email","responsavel_telefone","responsavel_cep","responsavel_endereco","responsavel_numero","responsavel_bairro","responsavel_cidade","responsavel_uf"];
    if (exigeCrmv(dados)) obrig2.push("responsavel_crmv", "responsavel_crmv_uf");
    if (etapa === 1 && obterOperacoes(dados).length === 0) { toast.error("Selecione pelo menos uma área de atuação."); return false; }
    const faltando = (etapa===1?obrig1:obrig2).some(k=>!String(dados[k]||"").trim());
    if (faltando) { toast.error("Preencha os campos obrigatórios."); return false; }
    if (etapa===1 && ehTesteGratis) {
      const doc = String(dados.cnpj || "").replace(/\D/g, "");
      if (![11,14].includes(doc.length)) { toast.error("Informe um CPF ou CNPJ válido para o teste gratuito."); return false; }
    }
    return true;
  }

  async function continuarPagamento() {
    if (!planoConhecido || (!ehTesteGratis && (!configPlano || valorBase <= 0))) { toast.error("Não foi possível validar o valor deste plano. Volte à página de planos."); return; }
    if (!termos || !privacidade) { toast.error("Aceite os Termos de Uso e a Política de Privacidade."); return; }
    if (plano === "master-equipe" && !aceitouFidelidadeMaster) { toast.error("Confirme ciência da fidelidade de 12 meses do plano Master."); return; }
    setEnviando(true);
    const payload = {
      ...dados,
      operacoes_selecionadas: obterOperacoes(dados),
      plano_codigo: plano,
      ciclo,
      modo_renovacao: modoRenovacao,
      quantidade_usuarios: quantidadeUsuarios,
      perfis_inclusos: perfisIncluidos,
      perfis_extras: perfisExtras,
      adicional_perfis_mensal: adicionalMensal,
      adicional_perfis_ciclo: adicionalCiclo,
      valor_base: valorBase,
      valor_total: valorCobrado,
      promo_codigo: promoAplicado?.codigo || null,
      aceitou_termos: true,
      aceitou_privacidade: true,
      fidelidade_meses: plano === "master-equipe" ? 12 : 0,
      aceitou_fidelidade_master: plano === "master-equipe" ? aceitouFidelidadeMaster : null,
      fidelidade_aceita_em: plano === "master-equipe" ? new Date().toISOString() : null,
    };
    const { data, error } = await (supabaseBanco as any).rpc(ehTesteGratis ? "oricse_iniciar_teste_gratis" : "oricse_iniciar_contratacao", { p_dados: payload });
    setEnviando(false);
    if (error) { toast.error(error.message || (ehTesteGratis ? "Não foi possível iniciar o teste gratuito." : "Não foi possível iniciar a contratação.")); return; }
    const novoPedido = Array.isArray(data) ? data[0] : data;
    setPedido(novoPedido);
    setEtapa(4);
    if (!ehTesteGratis && novoPedido?.id) await abrirCheckout(String(novoPedido.id));
  }

  const crmvObrigatorio = exigeCrmv(dados);

  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6"><div className="mx-auto max-w-4xl">
    <Link to="/planos" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={18}/> {texto.voltar_planos}</Link>
    <header className="mt-6 rounded-3xl border bg-card p-6 shadow-sm"><p className="text-sm font-semibold text-primary">Plano {nomePlano} · {ehTesteGratis ? "7 dias grátis" : cicloNome}</p><h1 className="mt-2 text-3xl font-bold">{ehTesteGratis ? "Comece seu teste gratuito" : texto.titulo_contratacao}</h1><p className="mt-2 text-muted-foreground">{ehTesteGratis ? "Use a Oricse por 7 dias sem cobrança. O teste é único por CPF/CNPJ." : texto.subtitulo_contratacao}</p></header>
    {retornoPagamento && <div className="mt-4 rounded-xl border p-4 text-sm font-semibold">{retornoPagamento === "sucesso" ? "Pagamento enviado. A confirmação está sendo processada." : retornoPagamento === "pendente" ? "Pagamento pendente de confirmação." : "Pagamento não concluído."}{pedidoRetorno && <span className="block text-xs font-normal">Pedido {pedidoRetorno.slice(0,8)}</span>}</div>}
    <div className="mt-5 flex gap-2">{[1,2,3,4].map(n=><div key={n} className={`h-2 flex-1 rounded-full ${n<=etapa?"bg-primary":"bg-muted"}`}/>)}</div>

    {etapa===1 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">1. {texto.etapa1_titulo}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="text-sm font-semibold">Tipo de operação *<details ref={operacaoMenuRef} className="group relative mt-1"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl border bg-background px-3 font-normal [&::-webkit-details-marker]:hidden"><span className="truncate">{obterOperacoes(dados).map(v=>OPERACOES_BASE.find(t=>t.valor===v)?.nome).filter(Boolean).join(" + ") || "Selecione os serviços"}</span><ChevronDown size={18} className="shrink-0"/></summary><div className="absolute z-30 mt-1 w-full rounded-xl border bg-background p-2 shadow-lg">{OPERACOES_BASE.map(tipo=><label key={tipo.valor} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 font-normal hover:bg-muted"><input type="checkbox" className="h-4 w-4" checked={obterOperacoes(dados).includes(tipo.valor)} onChange={e=>{const atuais=obterOperacoes(dados);const proximos=e.target.checked?[...new Set([...atuais,tipo.valor])]:atuais.filter(v=>v!==tipo.valor);salvarLocal({...dados,tipo_operacao:proximos.length>1?"misto":proximos[0]||"misto",operacoes_ativas:proximos.join(",")});}}/>{tipo.nome}</label>)}</div></details></div>{campo("Nome da clínica","clinica_nome",dados,salvarLocal)}{campo("Razão social","razao_social",dados,salvarLocal,false)}{campo("CNPJ/CPF","cnpj",dados,salvarLocal,ehTesteGratis)}{campo("Telefone","clinica_telefone",dados,salvarLocal)}{campo("E-mail","clinica_email",dados,salvarLocal,true,"email")}{campo("CEP","clinica_cep",dados,salvarLocal)}{campo("Endereço","clinica_endereco",dados,salvarLocal)}{campo("Número","clinica_numero",dados,salvarLocal)}{campo("Complemento","clinica_complemento",dados,salvarLocal,false)}{campo("Bairro","clinica_bairro",dados,salvarLocal)}{campo("Cidade","clinica_cidade",dados,salvarLocal)}{campo("UF","clinica_uf",dados,salvarLocal)}</div>{ehTesteGratis && <p className="mt-3 text-xs text-muted-foreground">O CPF/CNPJ é usado para garantir um único período de teste gratuito por empresa/profissional.</p>}</section>}

    {etapa===2 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">2. {texto.etapa2_titulo}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{campo("Nome do responsável","responsavel_nome",dados,salvarLocal)}{campo("CPF","responsavel_cpf",dados,salvarLocal)}{campo("CRMV","responsavel_crmv",dados,salvarLocal,crmvObrigatorio)}{campo("UF do CRMV","responsavel_crmv_uf",dados,salvarLocal,crmvObrigatorio)}{campo("Telefone","responsavel_telefone",dados,salvarLocal)}{campo("E-mail","responsavel_email",dados,salvarLocal,true,"email")}{campo("CEP","responsavel_cep",dados,salvarLocal)}{campo("Endereço","responsavel_endereco",dados,salvarLocal)}{campo("Número","responsavel_numero",dados,salvarLocal)}{campo("Complemento","responsavel_complemento",dados,salvarLocal,false)}{campo("Bairro","responsavel_bairro",dados,salvarLocal)}{campo("Cidade","responsavel_cidade",dados,salvarLocal)}{campo("UF","responsavel_uf",dados,salvarLocal)}</div>{!crmvObrigatorio && <p className="mt-3 text-xs text-muted-foreground">CRMV é opcional para operações sem atendimento clínico veterinário.</p>}</section>}

    {etapa===3 && <section className="mt-5 rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Revisão do pedido</p><h2 className="mt-1 text-2xl font-bold">3. {texto.etapa3_titulo}</h2><p className="mt-1 text-sm text-muted-foreground">Escolha o período, confira cada valor e aplique seu código antes de pagar.</p></div>
        {!ehTesteGratis && <div className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-bold text-primary">Plano {nomePlano}</div>}
      </div>

      {!ehTesteGratis ? <div className="contents">
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="rounded-2xl border bg-background p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Período de cobrança</h3><p className="mt-1 text-sm text-muted-foreground">Selecione como prefere pagar.</p></div><CreditCard size={20} className="text-primary"/></div>
            <div role="radiogroup" aria-label="Período de cobrança" className="mt-4 grid gap-3">
              {CICLOS.map((opcao)=>{const valor=parseBRL(precoDoCiclo(configPlano,opcao.codigo))+adicionalMensal*opcao.meses;return <button key={opcao.codigo} type="button" role="radio" aria-checked={ciclo===opcao.codigo} onClick={()=>trocarCiclo(opcao.codigo)} className={`w-full rounded-2xl border p-4 text-left transition ${ciclo===opcao.codigo?"border-primary bg-primary/5 ring-1 ring-primary":"hover:border-primary/40"}`}><div className="flex items-start justify-between gap-4"><div><p className="font-bold">{opcao.nome}</p><p className="mt-1 text-sm text-muted-foreground">{opcao.descricao}</p></div><div className="text-right"><p className="text-lg font-extrabold">{valor>0?brl(valor):"A configurar"}</p><p className="text-xs text-muted-foreground">por período</p></div></div></button>;})}
            </div>
            <div className="mt-5 rounded-2xl border bg-muted/20 p-4"><h3 className="font-bold">Como renovar</h3><p className="mt-1 text-sm text-muted-foreground">No cartão, a renovação é automática. PIX e boleto são cobrados manualmente em cada período.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" onClick={()=>setModoRenovacao("automatica_cartao")} className={`rounded-xl border p-3 text-left ${modoRenovacao==="automatica_cartao"?"border-primary bg-primary/5 ring-1 ring-primary":"bg-background"}`}><strong className="block">Cartão com renovação automática</strong><span className="mt-1 block text-xs text-muted-foreground">O Mercado Pago processa a renovação no vencimento.</span></button><button type="button" onClick={()=>setModoRenovacao("manual")} className={`rounded-xl border p-3 text-left ${modoRenovacao==="manual"?"border-primary bg-primary/5 ring-1 ring-primary":"bg-background"}`}><strong className="block">PIX ou boleto — renovação manual</strong><span className="mt-1 block text-xs text-muted-foreground">Um novo link de cobrança é emitido a cada período.</span></button></div></div></div>

            <div className="mt-5 border-t pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{texto.perfis_titulo}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{explicacaoPerfis}</p></div><div className="flex items-center gap-3"><button type="button" aria-label="Remover perfil" onClick={()=>mudarQuantidade(-1)} disabled={quantidadeUsuarios<=1} className="flex h-10 w-10 items-center justify-center rounded-xl border disabled:opacity-40"><Minus size={18}/></button><div className="min-w-14 text-center"><p className="text-2xl font-extrabold">{quantidadeUsuarios}</p><p className="text-xs text-muted-foreground">perfis</p></div><button type="button" aria-label="Adicionar perfil" onClick={()=>mudarQuantidade(1)} className="flex h-10 w-10 items-center justify-center rounded-xl border"><Plus size={18}/></button></div></div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center text-sm"><div><p className="text-xs text-muted-foreground">{texto.perfis_incluidos_rotulo}</p><p className="mt-1 font-bold">{Math.min(quantidadeUsuarios, perfisIncluidos)}</p></div><div><p className="text-xs text-muted-foreground">{texto.perfis_extras_rotulo}</p><p className="mt-1 font-bold">{perfisExtras}</p></div><div><p className="text-xs text-muted-foreground">{texto.perfis_adicional_rotulo}</p><p className="mt-1 font-bold">{brl(adicionalCiclo)}</p></div></div>
            </div>
          </div>

          <div className="flex h-full min-w-0 flex-col rounded-2xl border border-primary/25 bg-primary/[0.035] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Resumo do pagamento</h3><p className="mt-1 text-sm text-muted-foreground">O valor abaixo é o que seguirá para o Mercado Pago.</p></div><BadgeCheck size={21} className="text-primary"/></div>
            <dl className="mt-5 space-y-3 text-sm"><div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">Plano {nomePlano}</dt><dd className="text-right font-semibold">{brl(valorBase)}</dd></div>{perfisExtras > 0 && <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">Perfis adicionais</dt><dd className="text-right font-semibold">{brl(adicionalCiclo)}</dd></div>}<div className="flex items-start justify-between gap-4 border-t pt-3"><dt className="text-muted-foreground">Subtotal</dt><dd className="text-right font-semibold">{brl(valorTotal)}</dd></div>{promoAplicado && <div className="contents"><div className="flex items-start justify-between gap-4 text-emerald-700"><dt className="flex items-center gap-1.5"><TicketPercent size={16}/> Código {promoAplicado.codigo}</dt><dd className="font-bold">− {brl(descontoPromocional)}</dd></div><p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">{promoAplicado.duracao === "recorrente" ? "Desconto recorrente aplicado ao plano." : "Desconto válido apenas para o primeiro período de cobrança."}</p></div>}<div className="flex items-end justify-between gap-4 border-t pt-4"><dt><p className="font-bold">Total a pagar agora</p><p className="mt-1 text-xs text-muted-foreground">{cicloNome.toLowerCase() + " · " + (modoRenovacao === "automatica_cartao" ? "cartão com renovação automática" : "renovação manual")}</p></dt><dd className="text-right text-2xl font-extrabold text-primary">{brl(valorCobrado)}</dd></div>{promoAplicado?.duracao === "primeiro_mes" && <div className="flex items-start justify-between gap-4 text-xs text-muted-foreground"><dt>Após a promoção</dt><dd>{brl(valorTotal)} por período</dd></div>}</dl>
            <div className="mt-5 grid gap-2 rounded-xl border bg-background/70 p-3 text-xs text-muted-foreground sm:grid-cols-2"><p><span className="font-semibold text-foreground">Clínica:</span> {dados.clinica_nome || "Dados informados na etapa 1"}</p><p><span className="font-semibold text-foreground">Responsável:</span> {dados.responsavel_nome || "Dados informados na etapa 2"}</p></div>
            <div id="oricse-promo-checkout" className="mt-5 flex-1 rounded-2xl border border-dashed border-primary/40 bg-primary/[0.025] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><TicketPercent size={19} className="text-primary"/><h3 className="font-bold">Código promocional</h3></div><p className="mt-1 text-sm text-muted-foreground">Tem um cupom? Aplique-o antes de seguir para o pagamento.</p></div>{promoAplicado && <button type="button" onClick={()=>{setCodigoPromocional("");limparPromocao();}} className="text-sm font-bold text-primary underline underline-offset-4">Remover código</button>}</div>
          <div className="mt-4 flex flex-col gap-2"><input aria-label="Código promocional" value={codigoPromocional} onChange={e=>{setCodigoPromocional(e.target.value.toUpperCase());setErroPromo("");}} onKeyDown={e=>{if(e.key === "Enter"){e.preventDefault();void aplicarCodigoPromocional();}}} placeholder="DIGITE SEU CÓDIGO" className="min-h-12 flex-1 rounded-xl border bg-background px-4 font-bold tracking-wide uppercase outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"/><button type="button" onClick={()=>void aplicarCodigoPromocional()} disabled={validandoPromo} className="min-h-12 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60">{validandoPromo ? "Validando..." : promoAplicado ? "Atualizar código" : "Aplicar código"}</button></div>
          {erroPromo && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{erroPromo}</p>}
          {promoAplicado && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-700"><BadgeCheck size={17}/> Código {promoAplicado.codigo} aplicado: você economiza {brl(descontoPromocional)}.</p>}
        </div>
          </div>
        </div>

      </div> : <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-sm"><p className="font-bold text-primary">Como funciona o teste de 7 dias</p><p className="mt-2 text-muted-foreground">O teste é único por CPF/CNPJ. Ao final dos 7 dias, o acesso à área clínica fica pausado até a contratação de um plano. Seus dados permanecem armazenados, mas enquanto a conta estiver pausada não será possível editar, exportar, gerar downloads ou fazer backup pelo sistema.</p></div>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Identificador público (@)
          <div className="mt-1 flex min-h-11 items-center rounded-xl border bg-background px-3 font-normal"><span className="mr-1 font-bold text-primary">@</span><input aria-label="Identificador público" autoComplete="off" value={dados.slug_desejado || ""} onChange={e=>salvarLocal({...dados,slug_desejado:e.target.value.toLowerCase().replace(/^@+/,"").replace(/[^a-z0-9_.]/g,"").slice(0,30)})} placeholder="minhaclinica" className="min-w-0 flex-1 bg-transparent py-3 outline-none"/></div>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">Seu identificador único na ORICSE.</span>
        </label>
        <label className="text-sm font-semibold">Nome público
          <input value={dados.nome_publico || ""} onChange={e=>salvarLocal({...dados,nome_publico:e.target.value})} placeholder="Nome exibido aos tutores" maxLength={100} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"/>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">Nome apresentado no Portal do Tutor.</span>
        </label>
      </div>
      <label className="mt-5 block text-sm font-semibold">{texto.observacoes_rotulo}<textarea value={dados.observacoes} onChange={e=>salvarLocal({...dados,observacoes:e.target.value})} rows={3} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-normal"/></label>
      {plano === "master-equipe" && <div className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="text-base font-extrabold">Importante: plano Master com fidelidade de 12 meses</p>
        <p className="mt-2 leading-6">A permanência mínima é de 1 ano a partir da ativação. Mesmo ao escolher a cobrança mensal, o compromisso contratual permanece de 12 meses. Leia as condições de cancelamento nos <Link to="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline decoration-2 underline-offset-4">Termos de Uso <ExternalLink size={14} className="inline"/></Link>.</p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 font-semibold">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={aceitouFidelidadeMaster} onChange={e=>setAceitouFidelidadeMaster(e.target.checked)}/>
          <span>Estou ciente e concordo com a fidelidade mínima de 12 meses do plano Master.</span>
        </label>
      </div>}
      <div className="mt-5 space-y-4 border-t pt-5 text-sm"><div className="flex items-start gap-3"><input id="aceitar-termos" type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={termos} onChange={e=>setTermos(e.target.checked)}/><div><label htmlFor="aceitar-termos" className="cursor-pointer">Li e concordo com os </label><Link to="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-600 underline decoration-2 underline-offset-4 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400">Termos de Uso <ExternalLink size={14} aria-hidden="true"/></Link><span className="ml-1 text-xs text-muted-foreground">(clique para ler)</span></div></div><div className="flex items-start gap-3"><input id="aceitar-privacidade" type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={privacidade} onChange={e=>setPrivacidade(e.target.checked)}/><div><label htmlFor="aceitar-privacidade" className="cursor-pointer">Li e concordo com a </label><Link to="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-600 underline decoration-2 underline-offset-4 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400">Política de Privacidade <ExternalLink size={14} aria-hidden="true"/></Link><span className="ml-1"> e tratamento de dados.</span><span className="ml-1 text-xs text-muted-foreground">(clique para ler)</span></div></div></div>
    </section>}

    {etapa===4 && <section className="mt-5 rounded-3xl border bg-card p-7 text-center shadow-sm">{ehTesteGratis ? <Check className="mx-auto text-primary" size={42}/> : <CreditCard className="mx-auto text-primary" size={42}/>}<h2 className="mt-3 text-2xl font-bold">{ehTesteGratis ? "Seu teste gratuito foi solicitado 💚" : texto.etapa4_titulo}</h2><p className="mx-auto mt-2 max-w-xl text-muted-foreground">{ehTesteGratis ? "Seu CPF/CNPJ ficou vinculado a este único período de teste. Assim que a conta for ativada, os 7 dias começam a contar." : texto.etapa4_texto}</p><div className="mx-auto mt-5 max-w-md rounded-2xl border p-4 text-left text-sm"><p><b>Plano:</b> {nomePlano}</p><p><b>Período:</b> {ehTesteGratis ? "7 dias grátis" : cicloNome}</p><p><b>Perfis:</b> {quantidadeUsuarios}</p>{!ehTesteGratis && <p><b>Total:</b> {brl(valorTotal)} por período</p>}<p><b>Status:</b> {ehTesteGratis ? "aguardando ativação" : "aguardando pagamento"}</p>{pedido?.id && <p className="mt-2 text-xs text-muted-foreground">Pedido {String(pedido.id).slice(0,8)}</p>}{!ehTesteGratis && <button type="button" disabled={abrindoCheckout || !pedido?.id} onClick={()=>void abrirCheckout(String(pedido.id))} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">{abrindoCheckout ? "Abrindo Mercado Pago…" : "Pagar com Mercado Pago"}</button>}</div>{!ehTesteGratis && <p className="mt-5 text-sm text-muted-foreground">O pagamento será confirmado automaticamente pelo Mercado Pago. O pedido só será liberado após a confirmação.</p>}</section>}

    {etapa<4 && <div className="mt-5 flex justify-between gap-3">{etapa>1?<button onClick={()=>setEtapa(etapa-1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold"><ChevronLeft size={18}/> {texto.botao_voltar}</button>:<span/>}{etapa<3?<button onClick={()=>{if(validarAtual())setEtapa(etapa+1)}} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">{texto.botao_continuar} <ChevronRight size={18}/></button>:<button disabled={enviando} onClick={continuarPagamento} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"><Check size={18}/>{enviando?texto.preparando_pagamento:(ehTesteGratis ? "Iniciar teste grátis" : texto.botao_pagamento)}</button>}</div>}
  </div></main>;
}
import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, Check, ChevronLeft, ChevronRight, CreditCard, ChevronDown, ExternalLink, Minus, Plus, TicketPercent, ImageUp, Globe2, Clock3, ShieldCheck, Sparkles } from "lucide-react";
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
  observacoes: "", modelo_site: "atelier", estilo_site: "moderno", servicos_iniciais: "", horario_abertura: "08:00", horario_fechamento: "18:00", agenda_online: "sim",
};


const UFS_CRMV = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
] as const;

const TIPOS_OPERACAO = [
  { valor: "clinica", nome: "Clínica veterinária" },
  { valor: "hospital", nome: "Hospital veterinário" },
  { valor: "domicilio", nome: "Veterinário em domicílio" },
  { valor: "petshop", nome: "Petshop e loja" },
  { valor: "banho_tosa", nome: "Banho e tosa" },
  { valor: "hotelzinho", nome: "Hotelzinho e creche" },
  { valor: "ong", nome: "ONG e proteção animal" },
  { valor: "diagnostico", nome: "Diagnóstico e laboratório" },
  { valor: "ensino", nome: "Treinamento e ensino" },
  { valor: "outro", nome: "Outro serviço pet" },
  { valor: "misto", nome: "Operação mista (combinar serviços)" },
] as const;
const ETAPAS_ABERTURA = ["Identidade", "Estrutura", "Serviços", "Configurações", "Revisão"];
const ESTILOS_SITE = [
  { id: "prestige", nome: "Signature", legenda: "Premium e editorial", fundo: "bg-[#121A18]", barra: "bg-[#C9A86A]", detalhe: "bg-[#29423C]" },
  { id: "atelier", nome: "Prime", legenda: "Elegante e contemporâneo", fundo: "bg-[#F7F1EB]", barra: "bg-[#73523C]", detalhe: "bg-[#E4D5C6]" },
  { id: "cuidado", nome: "Class", legenda: "Acolhedor e humano", fundo: "bg-[#F2F8F4]", barra: "bg-[#307760]", detalhe: "bg-[#D7E8DE]" },
  { id: "popular", nome: "King", legenda: "Comercial e marcante", fundo: "bg-[#FFFDF8]", barra: "bg-[#B33C34]", detalhe: "bg-[#FFE297]" },
  { id: "essencial", nome: "Essencial", legenda: "Clean e objetivo", fundo: "bg-white", barra: "bg-[#263C54]", detalhe: "bg-[#E7EDF2]" },
  { id: "horizonte", nome: "Horizonte", legenda: "Natureza e bem-estar", fundo: "bg-[#F6F8F0]", barra: "bg-[#537B52]", detalhe: "bg-[#DCE8D1]" },
] as const;
const SERVICOS_INICIAIS = [
  { id: "consultas", nome: "Consultas", operacoes: ["clinica", "hospital", "domicilio", "ong"] },
  { id: "vacinas", nome: "Vacinação", operacoes: ["clinica", "hospital", "domicilio", "ong"] },
  { id: "exames", nome: "Exames e diagnósticos", operacoes: ["clinica", "hospital", "diagnostico"] },
  { id: "cirurgias", nome: "Cirurgias", operacoes: ["clinica", "hospital"] },
  { id: "atendimento_domiciliar", nome: "Visitas domiciliares", operacoes: ["domicilio"] },
  { id: "banho", nome: "Banho", operacoes: ["petshop", "banho_tosa"] },
  { id: "tosa", nome: "Tosa", operacoes: ["petshop", "banho_tosa"] },
  { id: "loja", nome: "Venda de produtos", operacoes: ["petshop"] },
  { id: "hospedagem", nome: "Hospedagem", operacoes: ["hotelzinho"] },
  { id: "creche", nome: "Creche e recreação", operacoes: ["hotelzinho"] },
  { id: "internacao", nome: "Internação", operacoes: ["hospital"] },
  { id: "urgencia", nome: "Emergências 24h", operacoes: ["hospital"] },
  { id: "adocao", nome: "Adoção responsável", operacoes: ["ong"] },
  { id: "resgate", nome: "Resgate e acolhimento", operacoes: ["ong"] },
  { id: "aulas", nome: "Aulas e treinamentos", operacoes: ["ensino"] },
  { id: "outros_servicos", nome: "Outros serviços pet", operacoes: ["outro"] },
] as const;
const normalizarSlug = (valor: string) => valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").slice(0, 30);
const slugValido = (slug: string) => slug.length >= 3 && slug.length <= 30 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/.test(slug);
const SLUGS_RESERVADOS = new Set(["www","admin","app","api","login","portal","tutor","suporte","mail","email","blog","sistema","oricse"]);
const OPERACOES_BASE = TIPOS_OPERACAO.filter(tipo => tipo.valor !== "misto");
const TIPOS_COM_ATENDIMENTO_VETERINARIO = new Set(["clinica", "hospital", "domicilio", "diagnostico"]);
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
  "solo-2026": { codigo: "solo-2026", nome: "Solo", usuarios_inclusos: 1, preco_mensal: "R$ 49,90", preco_trimestral: "R$ 139,90", preco_semestral: "R$ 269,90", preco_anual: "R$ 499,00", preco_bienal: "R$ 899,00" },
  "essencial-2026": { codigo: "essencial-2026", nome: "Essencial", usuarios_inclusos: 1, preco_mensal: "R$ 79,90", preco_trimestral: "R$ 229,90", preco_semestral: "R$ 429,90", preco_anual: "R$ 799,00", preco_bienal: "R$ 1.439,00" },
  "profissional-2026": { codigo: "profissional-2026", nome: "Profissional", usuarios_inclusos: 3, preco_mensal: "R$ 119,90", preco_trimestral: "R$ 339,90", preco_semestral: "R$ 649,90", preco_anual: "R$ 1.199,00", preco_bienal: "R$ 2.159,00" },
  "master-2026": { codigo: "master-2026", nome: "Master", usuarios_inclusos: 5, preco_mensal: "R$ 199,90", preco_trimestral: "R$ 569,90", preco_semestral: "R$ 1.079,90", preco_anual: "R$ 1.999,00", preco_bienal: "R$ 3.599,00" },
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
  const planoParam = params.get("plano") || "solo-2026";
  const plano = Object.prototype.hasOwnProperty.call(PLANOS_CONTRATACAO, planoParam) ? planoParam : "solo-2026";
  const ehTesteGratis = false;
  const cicloParam=params.get("ciclo");
  const cicloInicial:CicloContratacao=CICLOS.some((item)=>item.codigo===cicloParam)?cicloParam as Exclude<CicloContratacao,"teste">:"mensal";
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
  const [erroValidacao, setErroValidacao] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoNome, setLogoNome] = useState("");
  const [verificandoSlug, setVerificandoSlug] = useState(false);
  const [situacaoSlug, setSituacaoSlug] = useState<"livre" | "ocupado" | "indefinido">("indefinido");

  async function escolherLogo(arquivo?: File) {
    if (!arquivo) return;
    if (!["image/png","image/jpeg","image/webp"].includes(arquivo.type) || arquivo.size > 5 * 1024 * 1024) {
      toast.error("Selecione PNG, JPG ou WebP de até 5 MB.");
      return;
    }
    const objectUrl = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => {
      try {
        const largura = imagem.naturalWidth, altura = imagem.naturalHeight;
        if (!largura || !altura) throw new Error("Imagem inválida.");
        const escala = Math.min(1, 512 / Math.max(largura, altura));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(largura * escala));
        canvas.height = Math.max(1, Math.round(altura * escala));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Não foi possível preparar a imagem.");
        ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
        const imagemTratada = canvas.toDataURL("image/webp", 0.86);
        if (!imagemTratada.startsWith("data:image/") || imagemTratada.length > 600_000)
          throw new Error("A logo ficou muito grande. Use uma imagem mais leve.");
        setLogoDataUrl(imagemTratada);
        setLogoNome(arquivo.name.slice(0, 120));
        setErroValidacao("");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao carregar a logo."); }
      finally { URL.revokeObjectURL(objectUrl); }
    };
    imagem.onerror = () => { URL.revokeObjectURL(objectUrl); toast.error("Não foi possível abrir a imagem selecionada."); };
    imagem.src = objectUrl;
  }

  async function conferirSlug() {
    const slug = normalizarSlug(dados.slug_desejado || "");
    if (!slugValido(slug) || SLUGS_RESERVADOS.has(slug)) {
      setSituacaoSlug("ocupado");
      setErroValidacao("Escolha um endereço válido de 3 a 30 caracteres, com letras, números ou hífen.");
      return false;
    }
    setVerificandoSlug(true);
    try {
      const { data, error } = await (supabaseBanco as any).rpc("oricse_slug_disponivel", { p_slug: slug });
      if (error) throw error;
      if (data !== true) {
        setSituacaoSlug("ocupado");
        setErroValidacao("Este endereço já está reservado. Escolha outro para continuar.");
        return false;
      }
      setSituacaoSlug("livre");
      return true;
    } catch {
      setSituacaoSlug("indefinido");
      setErroValidacao("Não foi possível verificar o endereço agora. Tente novamente.");
      return false;
    } finally { setVerificandoSlug(false); }
  }

  const retornoPagamento = params.get("retorno");
  const pedidoRetorno = params.get("pedido");
  useEffect(() => {
    if (!retornoPagamento || !["sucesso","pendente","falha","isento"].includes(retornoPagamento)) return;
    const url = new URL("/contratacao-recebida", window.location.origin);
    url.searchParams.set("retorno", retornoPagamento);
    if (pedidoRetorno && /^[0-9a-f-]{36}$/i.test(pedidoRetorno)) url.searchParams.set("pedido", pedidoRetorno);
    window.location.replace(url.toString());
  }, [retornoPagamento]);

  async function abrirCheckout(id: string) {
    if (!id || abrindoCheckout) return;
    // Um cupom que zera o pedido não deve acionar o Mercado Pago.
    if (pedido?.status === "isento_aguardando_aprovacao") {
      const destino = new URL("/contratacao-recebida", window.location.origin);
      destino.searchParams.set("retorno", "isento");
      destino.searchParams.set("pedido", id);
      window.location.assign(destino.toString());
      return;
    }
    if (valorCobrado === 0 && promoAplicado?.codigo) {
      toast.error("O pedido com isenção integral não pode ser enviado para pagamento. Consulte sua solicitação.");
      return;
    }
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
  const salvarLocal = (novo: Dados) => { setDados(novo); setErroValidacao(""); oricseStorage.setItem("oricse-contratacao", JSON.stringify(novo)); };

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
    if(typeof window!=="undefined"){const url=new URL(window.location.href);url.searchParams.set("ciclo",proximo);window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);}
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
    try {
      const documento = String(dados.cnpj || dados.responsavel_cpf || "");
      // Consulta pública em PostgreSQL (mesma fonte do checkout), sem exigir login.
      const { data, error } = await (supabaseBanco as any).rpc("oricse_validar_codigo_promocional", {
        p_codigo: codigo,
        p_plano_codigo: plano,
        p_documento: documento,
        p_valor_base: valorTotal,
        p_ciclo: ciclo,
      });
      const validacao = Array.isArray(data) ? data[0] : data;
      if (error || !validacao?.valido) {
        setPromoAplicado(null);
        const mensagem = String(error?.message || validacao?.mensagem || "").trim();
        setErroPromo(mensagem && mensagem !== "undefined" && mensagem !== "null"
          ? mensagem
          : "Não foi possível validar o código. Confira o plano selecionado e tente novamente.");
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
    } catch {
      setPromoAplicado(null);
      setErroPromo("Não foi possível validar o código agora. Tente novamente.");
    } finally {
      setValidandoPromo(false);
    }
  }

  const mudarQuantidade = (delta: number) => {
    limparPromocao();
    salvarLocal({ ...dados, quantidade_usuarios: String(Math.max(1, quantidadeUsuarios + delta)) });
  };

  function validarAtual() {
    if (etapa === 1) {
      if (!dados.clinica_nome.trim()) { setErroValidacao("Informe o nome da clínica."); return false; }
      if (!slugValido(normalizarSlug(dados.slug_desejado || ""))) {
        setErroValidacao("Escolha um endereço do site com 3 a 30 caracteres (letras, números e hífen).");
        return false;
      }
      if (!ESTILOS_SITE.some(estilo => estilo.id === dados.modelo_site)) {
        setErroValidacao("Selecione o estilo visual do site."); return false;
      }
      if (!logoDataUrl) {
        setErroValidacao("Envie a logo da clínica para continuar."); return false;
      }
    }
    const obrigatoriosClinica = ["clinica_telefone","clinica_email","clinica_cep","clinica_endereco","clinica_numero","clinica_bairro","clinica_cidade","clinica_uf"];
    const obrigatoriosResponsavel = ["responsavel_nome","responsavel_cpf","responsavel_email","responsavel_telefone","responsavel_cep","responsavel_endereco","responsavel_numero","responsavel_bairro","responsavel_cidade","responsavel_uf"];
    if (exigeCrmv(dados)) obrigatoriosResponsavel.push("responsavel_crmv", "responsavel_crmv_uf");
    if (etapa === 2 && obterOperacoes(dados).length === 0) {
      setErroValidacao("Selecione pelo menos uma área de atuação."); return false;
    }
    if (etapa === 3) {
      if (!dados.servicos_iniciais.trim()) {
        setErroValidacao("Selecione pelo menos um serviço inicial."); return false;
      }
      if (dados.horario_abertura >= dados.horario_fechamento) {
        setErroValidacao("O horário final deve ser posterior ao horário inicial."); return false;
      }
    }
    const obrig = etapa === 2 ? obrigatoriosClinica : etapa === 4 ? obrigatoriosResponsavel : [];
    const faltando = obrig.filter(k => !String(dados[k] || "").trim());
    if (faltando.length) {
      const rotulos: Record<string,string> = {
        clinica_telefone:"Telefone da clínica",clinica_email:"E-mail da clínica",
        clinica_cep:"CEP da clínica",clinica_endereco:"Endereço da clínica",clinica_numero:"Número da clínica",
        clinica_bairro:"Bairro da clínica",clinica_cidade:"Cidade da clínica",clinica_uf:"UF da clínica",
        responsavel_nome:"Nome do responsável",responsavel_cpf:"CPF",responsavel_email:"E-mail do responsável",
        responsavel_telefone:"Telefone do responsável",responsavel_cep:"CEP do responsável",
        responsavel_endereco:"Endereço do responsável",responsavel_numero:"Número do responsável",
        responsavel_bairro:"Bairro do responsável",responsavel_cidade:"Cidade do responsável",
        responsavel_uf:"UF do responsável",responsavel_crmv:"CRMV",responsavel_crmv_uf:"UF do CRMV",
      };
      setErroValidacao("Confira os campos: " + faltando.map(k => rotulos[k] || k).join(", ") + ".");
      return false;
    }
    setErroValidacao("");
    return true;
  }

  async function avancarEtapa() {
    if (!validarAtual()) return;
    if (etapa === 1 && !(await conferirSlug())) return;
    setEtapa(etapa + 1);
  }

  async function continuarPagamento() {
    if (!logoDataUrl || !slugValido(normalizarSlug(dados.slug_desejado || ""))) { setEtapa(1); setErroValidacao("Confirme a logo e o endereço do site."); return; }
    if (!planoConhecido || (!ehTesteGratis && (!configPlano || valorBase <= 0))) { toast.error("Não foi possível validar o valor deste plano. Volte à página de planos."); return; }
    if (!termos || !privacidade) { toast.error("Aceite os Termos de Uso e a Política de Privacidade."); return; }
    if (plano === "master-2026" && !aceitouFidelidadeMaster) { toast.error("Confirme ciência da fidelidade de 12 meses do plano Master."); return; }
    setEnviando(true);
    const payload = {
      ...dados,
      logo_data_url: logoDataUrl,
      logo_nome: logoNome,
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
      fidelidade_meses: plano === "master-2026" ? 12 : 0,
      aceitou_fidelidade_master: plano === "master-2026" ? aceitouFidelidadeMaster : null,
      fidelidade_aceita_em: plano === "master-2026" ? new Date().toISOString() : null,
    };
    const { data, error } = await (supabaseBanco as any).rpc(ehTesteGratis ? "oricse_iniciar_teste_gratis" : "oricse_iniciar_contratacao", { p_dados: payload });
    setEnviando(false);
    if (error) { toast.error(error.message || (ehTesteGratis ? "Não foi possível iniciar o teste gratuito." : "Não foi possível iniciar a contratação.")); return; }
    const novoPedido = Array.isArray(data) ? data[0] : data;
    setPedido(novoPedido);
    setEtapa(6);
    if (!ehTesteGratis && novoPedido?.id) {
      if (novoPedido.status === "isento_aguardando_aprovacao") {
        toast.success("Solicitação enviada para análise.");
        const destino = new URL("/contratacao-recebida", window.location.origin);
        destino.searchParams.set("retorno", "isento");
        destino.searchParams.set("pedido", String(novoPedido.id));
        window.location.assign(destino.toString());
      } else if (valorCobrado > 0) {
        await abrirCheckout(String(novoPedido.id));
      } else {
        // Nunca iniciar checkout para R$ 0,00. O servidor é a fonte
        // definitiva do status; não fingir aprovação quando ele divergir.
        toast.error("O pedido gratuito foi registrado, mas seu status precisa ser confirmado pela ORICSE.");
      }
    }
  }

  const pedidoIsento = !ehTesteGratis && Boolean(pedido?.id) &&
    (pedido?.status === "isento_aguardando_aprovacao" ||
      (Number(pedido?.valor_total ?? valorCobrado) === 0 &&
       Boolean(promoAplicado?.codigo) && descontoPromocional > 0));
  const crmvObrigatorio = exigeCrmv(dados);

  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6"><div className="mx-auto max-w-4xl">
    <Link to="/planos" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={18}/> {texto.voltar_planos}</Link>
    <header className="mt-6 rounded-3xl border bg-card p-6 shadow-sm"><p className="text-sm font-semibold text-primary">Plano {nomePlano} · {ehTesteGratis ? "7 dias grátis" : cicloNome}</p><h1 className="mt-2 text-3xl font-bold">{ehTesteGratis ? "Comece seu teste gratuito" : texto.titulo_contratacao}</h1><p className="mt-2 text-muted-foreground">{ehTesteGratis ? "Use a Oricse por 7 dias sem cobrança. O teste é único por CPF/CNPJ." : "Personalize sua clínica, configure serviços e revise tudo em cinco etapas. A ativação ocorrerá após a análise da ORICSE."}</p></header>
    {retornoPagamento && <div className="mt-4 rounded-xl border p-4 text-sm font-semibold">{retornoPagamento === "sucesso" ? "Pagamento enviado. A confirmação está sendo processada." : retornoPagamento === "pendente" ? "Pagamento pendente de confirmação." : "Pagamento não concluído."}{pedidoRetorno && <span className="block text-xs font-normal">Pedido {pedidoRetorno.slice(0,8)}</span>}</div>}
    <div className="mt-5 grid grid-cols-5 gap-2" aria-label="Progresso da abertura">
      {ETAPAS_ABERTURA.map((nome,index)=><div key={nome} className="min-w-0"><div className={"h-2 rounded-full " + (index+1<=etapa?"bg-primary":"bg-muted")}/><p className={"mt-2 truncate text-center text-[10px] sm:text-xs " + (index+1===etapa?"font-bold text-primary":"text-muted-foreground")}>{nome}</p></div>)}
    </div>

    {etapa===1 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3 text-primary"><Globe2 size={24}/><h2 className="text-2xl font-extrabold">1. Identidade da sua clínica</h2></div>
      <p className="mt-2 text-sm text-muted-foreground">Comece pelo nome, escolha como deseja aparecer na internet e defina a identidade visual.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {campo("Nome da clínica", "clinica_nome", dados, salvarLocal)}
        <label className="text-sm font-semibold">Nome exibido aos tutores
          <input value={dados.nome_publico} onChange={e => salvarLocal({...dados,nome_publico:e.target.value.slice(0,100)})}
            placeholder={dados.clinica_nome || "Nome que aparecerá no Portal do Tutor"} maxLength={100}
            className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"/>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">Pode ser igual ao nome da clínica.</span>
        </label>
      </div>
      <label className="mt-5 block text-sm font-semibold">Endereço do seu site <span className="text-destructive">*</span>
        <div className="mt-1 flex min-h-12 items-center overflow-hidden rounded-xl border bg-background">
          <input value={dados.slug_desejado} onChange={e => { salvarLocal({...dados,slug_desejado:normalizarSlug(e.target.value)});setSituacaoSlug("indefinido");}}
            placeholder="minhaclinica" maxLength={30} autoComplete="off"
            className="min-w-0 flex-1 px-3 py-3 font-normal outline-none" aria-label="Endereço da clínica"/>
          <span className="shrink-0 border-l bg-muted/40 px-3 py-3 text-xs font-medium text-muted-foreground">.oricse.com.br</span>
        </div>
        <span className="mt-1 block text-xs font-normal text-muted-foreground">De 3 a 30 caracteres. A ativação do endereço ocorrerá após a aprovação da clínica.</span>
        {situacaoSlug==="livre" && <span className="mt-1 block text-xs font-semibold text-emerald-700">Endereço disponível neste momento.</span>}
        {situacaoSlug==="ocupado" && <span className="mt-1 block text-xs font-semibold text-destructive">Escolha outro endereço.</span>}
      </label>
      <div className="mt-7 border-t pt-6">
        <h3 className="flex items-center gap-2 text-lg font-bold"><Sparkles size={19} className="text-primary"/> Escolha o estilo do site</h3>
        <p className="mt-1 text-sm text-muted-foreground">Escolha um dos seis sites completos. Depois você poderá trocar textos, cores, fotos e seções no editor da clínica.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Estilo do site">
          {ESTILOS_SITE.map(estilo => <button key={estilo.id} type="button" role="radio" aria-checked={dados.modelo_site===estilo.id}
            onClick={()=>salvarLocal({...dados,modelo_site:estilo.id,estilo_site:estilo.id})}
            className={"rounded-2xl border-2 p-3 text-left transition hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary " + (dados.modelo_site===estilo.id?"border-primary bg-primary/5":"border-border")}>
            <div className={"h-28 overflow-hidden rounded-xl border p-3 " + estilo.fundo}>
              <div className="flex items-center gap-2"><div className={"h-5 w-5 rounded-md " + estilo.barra}/>
                <div className={"h-1.5 w-16 rounded-full " + estilo.barra}/><div className="ml-auto h-1.5 w-8 rounded-full bg-gray-400/30"/></div>
              <div className={"mt-4 h-3 w-28 rounded " + estilo.barra}/><div className={"mt-2 h-1.5 w-36 max-w-full rounded " + estilo.detalhe}/>
              <div className="mt-3 flex gap-2"><div className={"h-6 w-16 rounded-lg " + estilo.barra}/><div className={"h-6 w-14 rounded-lg " + estilo.detalhe}/></div>
            </div>
            <span className="mt-3 flex items-center justify-between gap-3"><strong>{estilo.nome}</strong>{dados.modelo_site===estilo.id&&<Check size={18} className="text-primary"/>}</span>
            <span className="block text-xs text-muted-foreground">{estilo.legenda}</span>
          </button>)}
        </div>
      </div>
      <div className="mt-7 border-t pt-6">
        <h3 className="flex items-center gap-2 text-lg font-bold"><ImageUp size={20} className="text-primary"/> Logo da clínica <span className="text-destructive">*</span></h3>
        <p className="mt-1 text-sm text-muted-foreground">PNG, JPG ou WebP de até 5 MB. A ORICSE prepara a imagem para o site e para o Portal do Tutor.</p>
        <label className="mt-3 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-primary/40 bg-muted/20 p-5">
          {logoDataUrl?<img src={logoDataUrl} alt="Prévia da logo da clínica" className="h-20 w-20 shrink-0 rounded-xl border bg-white object-contain p-2"/>:<ImageUp size={40} className="shrink-0 text-primary"/>}
          <span className="min-w-0 text-sm"><strong className="block">{logoNome||"Escolher arquivo da logo"}</strong><span className="block text-xs text-muted-foreground">Clique para selecionar ou substituir</span></span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e=>void escolherLogo(e.target.files?.[0])}/>
        </label>
      </div>
      <div className="mt-6 rounded-2xl border bg-muted/25 p-4">
        <h3 className="font-bold">Prévia da identidade</h3>
        <div className="mt-3 flex items-center gap-4 rounded-xl border bg-background p-4">
          {logoDataUrl?<img src={logoDataUrl} alt="" className="h-14 w-14 rounded-lg object-contain"/>:<div className="flex h-14 w-14 items-center justify-center rounded-lg border"><ImageUp size={22}/></div>}
          <div className="min-w-0"><p className="truncate font-bold">{dados.nome_publico||dados.clinica_nome||"Sua clínica"}</p><p className="truncate text-xs text-muted-foreground">{dados.slug_desejado||"sua-clinica"}.oricse.com.br</p></div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">O Portal do Tutor mantém o padrão ORICSE e recebe a identidade permitida da sua clínica.</p>
      </div>
    </section>}

    {etapa===2 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">2. Estrutura e dados da clínica</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="text-sm font-semibold">Tipo de operação *<details ref={operacaoMenuRef} className="group relative mt-1"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl border bg-background px-3 font-normal [&::-webkit-details-marker]:hidden"><span className="truncate">{obterOperacoes(dados).map(v=>OPERACOES_BASE.find(t=>t.valor===v)?.nome).filter(Boolean).join(" + ") || "Selecione os serviços"}</span><ChevronDown size={18} className="shrink-0"/></summary><div className="absolute z-30 mt-1 w-full rounded-xl border bg-background p-2 shadow-lg">{OPERACOES_BASE.map(tipo=><label key={tipo.valor} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 font-normal hover:bg-muted"><input type="checkbox" className="h-4 w-4" checked={obterOperacoes(dados).includes(tipo.valor)} onChange={e=>{const atuais=obterOperacoes(dados);const proximos=e.target.checked?[...new Set([...atuais,tipo.valor])]:atuais.filter(v=>v!==tipo.valor);salvarLocal({...dados,tipo_operacao:proximos.length>1?"misto":proximos[0]||"misto",operacoes_ativas:proximos.join(",")});}}/>{tipo.nome}</label>)}</div></details></div>{campo("Razão social","razao_social",dados,salvarLocal,false)}{campo("CNPJ/CPF","cnpj",dados,salvarLocal,ehTesteGratis)}{campo("Telefone","clinica_telefone",dados,salvarLocal)}{campo("E-mail","clinica_email",dados,salvarLocal,true,"email")}{campo("CEP","clinica_cep",dados,salvarLocal)}{campo("Endereço","clinica_endereco",dados,salvarLocal)}{campo("Número","clinica_numero",dados,salvarLocal)}{campo("Complemento","clinica_complemento",dados,salvarLocal,false)}{campo("Bairro","clinica_bairro",dados,salvarLocal)}{campo("Cidade","clinica_cidade",dados,salvarLocal)}{campo("UF","clinica_uf",dados,salvarLocal)}</div>{ehTesteGratis && <p className="mt-3 text-xs text-muted-foreground">O CPF/CNPJ é usado para garantir um único período de teste gratuito por empresa/profissional.</p>}</section>}

    {etapa===3 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3 text-primary"><Clock3 size={24}/><h2 className="text-2xl font-extrabold">3. Serviços e funcionamento</h2></div>
      <p className="mt-2 text-sm text-muted-foreground">Marque o que sua clínica oferece. A ORICSE utilizará essas preferências na preparação inicial, conforme o plano contratado.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {SERVICOS_INICIAIS.filter(servico=>servico.operacoes.some(op=>obterOperacoes(dados).includes(op))).map(servico=>{
          const selecionados=dados.servicos_iniciais.split(",").filter(Boolean);
          const marcado=selecionados.includes(servico.id);
          return <label key={servico.id} className={"flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm font-semibold " + (marcado?"border-primary bg-primary/5":"")}>
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={marcado}
              onChange={e=>salvarLocal({...dados,servicos_iniciais:(e.target.checked?[...new Set([...selecionados,servico.id])]:selecionados.filter(item=>item!==servico.id)).join(",")})}/>
            {servico.nome}
          </label>;
        })}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Início do funcionamento
          <input type="time" value={dados.horario_abertura} onChange={e=>salvarLocal({...dados,horario_abertura:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"/>
        </label>
        <label className="text-sm font-semibold">Fim do funcionamento
          <input type="time" value={dados.horario_fechamento} onChange={e=>salvarLocal({...dados,horario_fechamento:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"/>
        </label>
      </div>
      <label className="mt-5 flex items-center justify-between gap-4 rounded-xl border p-4 text-sm">
        <span><strong className="block">Agendamento online</strong><span className="mt-1 block text-xs text-muted-foreground">Solicite a configuração inicial de agenda, se seu plano permitir.</span></span>
        <input type="checkbox" className="h-5 w-5 accent-primary" checked={dados.agenda_online==="sim"} onChange={e=>salvarLocal({...dados,agenda_online:e.target.checked?"sim":"nao"})}/>
      </label>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground"><ShieldCheck size={17} className="shrink-0 text-primary"/> A ativação das agendas e do Portal do Tutor ocorre após a aprovação e segue as permissões do seu plano.</p>
    </section>}

    {etapa===4 && <section className="mt-5 rounded-3xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">4. Configurações e responsável</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{campo("Nome do responsável","responsavel_nome",dados,salvarLocal)}{campo("CPF","responsavel_cpf",dados,salvarLocal)}{campo("CRMV","responsavel_crmv",dados,salvarLocal,crmvObrigatorio)}<label className="text-sm font-semibold">UF do CRMV{crmvObrigatorio&&<span className="text-destructive"> *</span>}
  <select
    value={dados.responsavel_crmv_uf}
    onChange={e=>salvarLocal({...dados,responsavel_crmv_uf:e.target.value})}
    required={crmvObrigatorio}
    className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"
    aria-label="UF do CRMV"
  >
    <option value="">Selecione o estado</option>
    {UFS_CRMV.map(uf=><option key={uf.sigla} value={uf.sigla}>{uf.nome}</option>)}
  </select>
</label>{campo("Telefone","responsavel_telefone",dados,salvarLocal)}{campo("E-mail","responsavel_email",dados,salvarLocal,true,"email")}{campo("CEP","responsavel_cep",dados,salvarLocal)}{campo("Endereço","responsavel_endereco",dados,salvarLocal)}{campo("Número","responsavel_numero",dados,salvarLocal)}{campo("Complemento","responsavel_complemento",dados,salvarLocal,false)}{campo("Bairro","responsavel_bairro",dados,salvarLocal)}{campo("Cidade","responsavel_cidade",dados,salvarLocal)}{campo("UF","responsavel_uf",dados,salvarLocal)}</div>{!crmvObrigatorio && <p className="mt-3 text-xs text-muted-foreground">CRMV é opcional para operações sem atendimento clínico veterinário.</p>}</section>}

    {etapa===5 && <section className="mt-5 rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Revisão do pedido</p><h2 className="mt-1 text-2xl font-bold">5. Revisão e contratação</h2><p className="mt-1 text-sm text-muted-foreground">Escolha o período, confira cada valor e aplique seu código antes de pagar.</p></div>
        {!ehTesteGratis && <div className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-bold text-primary">Plano {nomePlano}</div>}
      </div>

      {!ehTesteGratis ? <div className="contents">
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="rounded-2xl border bg-background p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Período de cobrança</h3><p className="mt-1 text-sm text-muted-foreground">Selecione como prefere pagar.</p></div><CreditCard size={20} className="text-primary"/></div>
            <div role="radiogroup" aria-label="Período de cobrança" className="mt-4 grid gap-3">
              {CICLOS.map((opcao)=>{const valor=parseBRL(precoDoCiclo(configPlano,opcao.codigo))+adicionalMensal*opcao.meses;return <button key={opcao.codigo} type="button" role="radio" aria-checked={ciclo===opcao.codigo} onClick={()=>trocarCiclo(opcao.codigo)} className={`w-full rounded-2xl border p-4 text-left transition ${ciclo===opcao.codigo?"border-primary bg-primary/5 ring-1 ring-primary":"hover:border-primary/40"}`}><div className="flex items-start justify-between gap-4"><div><p className="font-bold">{opcao.nome}</p><p className="mt-1 text-sm text-muted-foreground">{opcao.descricao}</p></div><div className="text-right"><p className="text-lg font-extrabold">{valor>0?brl(valor):"A configurar"}</p><p className="text-xs text-muted-foreground">por período</p></div></div></button>;})}
            </div>
            <div className="mt-5 rounded-2xl border bg-muted/20 p-4"><h3 className="font-bold">Como renovar</h3><p className="mt-1 text-sm text-muted-foreground">No cartão, a renovação é automática. PIX e boleto são cobrados manualmente em cada período.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" onClick={()=>setModoRenovacao("automatica_cartao")} className={`rounded-xl border p-3 text-left ${modoRenovacao==="automatica_cartao"?"border-primary bg-primary/5 ring-1 ring-primary":"bg-background"}`}><strong className="block">Cartão com renovação automática</strong><span className="mt-1 block text-xs text-muted-foreground">O Mercado Pago processa a renovação no vencimento.</span></button><button type="button" onClick={()=>setModoRenovacao("manual")} className={`rounded-xl border p-3 text-left ${modoRenovacao==="manual"?"border-primary bg-primary/5 ring-1 ring-primary":"bg-background"}`}><strong className="block">PIX ou boleto — renovação manual</strong><span className="mt-1 block text-xs text-muted-foreground">Um novo link de cobrança é emitido a cada período.</span></button></div></div>

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

      <div className="mt-5 grid gap-3 rounded-2xl border bg-background p-4 text-sm sm:grid-cols-2">
    <p><strong className="block">Clínica</strong>{dados.clinica_nome}</p>
    <p><strong className="block">Endereço solicitado</strong>{dados.slug_desejado}.oricse.com.br</p>
    <p><strong className="block">Estilo do site</strong>{ESTILOS_SITE.find(e => e.id === dados.modelo_site)?.nome || "Prime"}</p>
    <p><strong className="block">Serviços</strong>{SERVICOS_INICIAIS.filter(e => dados.servicos_iniciais.split(",").includes(e.id)).map(e => e.nome).join(", ")}</p>
    <p><strong className="block">Horário inicial</strong>{dados.horario_abertura} às {dados.horario_fechamento}</p>
    <p><strong className="block">Portal do Tutor</strong>Padronizado, com a identidade da clínica</p>
    {logoDataUrl && <img className="h-20 w-20 rounded-xl border bg-white object-contain p-2" src={logoDataUrl} alt="Logo escolhida"/>}
  </div>
      <label className="mt-5 block text-sm font-semibold">{texto.observacoes_rotulo}<textarea value={dados.observacoes} onChange={e=>salvarLocal({...dados,observacoes:e.target.value})} rows={3} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-normal"/></label>
      {plano === "master-2026" && <div className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="text-base font-extrabold">Importante: plano Master com fidelidade de 12 meses</p>
        <p className="mt-2 leading-6">A permanência mínima é de 1 ano a partir da ativação. Mesmo ao escolher a cobrança mensal, o compromisso contratual permanece de 12 meses. Leia as condições de cancelamento nos <Link to="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline decoration-2 underline-offset-4">Termos de Uso <ExternalLink size={14} className="inline"/></Link>.</p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 font-semibold">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={aceitouFidelidadeMaster} onChange={e=>setAceitouFidelidadeMaster(e.target.checked)}/>
          <span>Estou ciente e concordo com a fidelidade mínima de 12 meses do plano Master.</span>
        </label>
      </div>}
      <div className="mt-5 space-y-4 border-t pt-5 text-sm"><div className="flex items-start gap-3"><input id="aceitar-termos" type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={termos} onChange={e=>setTermos(e.target.checked)}/><div><label htmlFor="aceitar-termos" className="cursor-pointer">Li e concordo com os </label><Link to="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-600 underline decoration-2 underline-offset-4 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400">Termos de Uso <ExternalLink size={14} aria-hidden="true"/></Link><span className="ml-1 text-xs text-muted-foreground">(clique para ler)</span></div></div><div className="flex items-start gap-3"><input id="aceitar-privacidade" type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={privacidade} onChange={e=>setPrivacidade(e.target.checked)}/><div><label htmlFor="aceitar-privacidade" className="cursor-pointer">Li e concordo com a </label><Link to="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-600 underline decoration-2 underline-offset-4 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400">Política de Privacidade <ExternalLink size={14} aria-hidden="true"/></Link><span className="ml-1"> e tratamento de dados.</span><span className="ml-1 text-xs text-muted-foreground">(clique para ler)</span></div></div></div>
    </section>}

    {etapa===6 && <section className="mt-5 rounded-3xl border bg-card p-7 text-center shadow-sm">{ehTesteGratis ? <Check className="mx-auto text-primary" size={42}/> : <CreditCard className="mx-auto text-primary" size={42}/>}<h2 className="mt-3 text-2xl font-bold">{ehTesteGratis ? "Seu teste gratuito foi solicitado 💚" : texto.etapa4_titulo}</h2><p className="mx-auto mt-2 max-w-xl text-muted-foreground">{ehTesteGratis ? "Seu CPF/CNPJ ficou vinculado a este único período de teste. Assim que a conta for ativada, os 7 dias começam a contar." : texto.etapa4_texto}</p><div className="mx-auto mt-5 max-w-md rounded-2xl border p-4 text-left text-sm"><p><b>Plano:</b> {nomePlano}</p><p><b>Período:</b> {ehTesteGratis ? "7 dias grátis" : cicloNome}</p><p><b>Perfis:</b> {quantidadeUsuarios}</p>{!ehTesteGratis&&<p><b>Total:</b> {brl(Number(pedido?.valor_total??valorCobrado))} por período</p>}{!ehTesteGratis&&(pedido?.promo_desconto>0||promoAplicado)&&<p className="text-emerald-700"><b>Desconto:</b> {brl(Number(pedido?.promo_desconto??descontoPromocional))}</p>}<p><b>Status:</b> {ehTesteGratis?"aguardando ativação":pedidoIsento?"aguardando aprovação administrativa":"aguardando pagamento"}</p>{pedido?.id && <p className="mt-2 text-xs text-muted-foreground">Pedido {String(pedido.id).slice(0,8)}</p>}{!ehTesteGratis&&!pedidoIsento&&<button type="button" disabled={abrindoCheckout||!pedido?.id} onClick={()=>void abrirCheckout(String(pedido.id))} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">{abrindoCheckout?"Processando…":"Pagar com Mercado Pago"}</button>}{pedidoIsento&&pedido?.id&&<a href={`/contratacao-recebida?retorno=isento&pedido=${encodeURIComponent(String(pedido.id))}`} className="mt-4 block w-full rounded-xl border border-primary px-4 py-3 text-center font-semibold text-primary">Ver solicitação recebida</a>}</div>{!ehTesteGratis&&<p className="mt-5 text-sm text-muted-foreground">{pedidoIsento?"O cupom cobre 100% do período. Não haverá cobrança; a clínica seguirá para aprovação e ativação administrativa.":"O pagamento será confirmado automaticamente pelo Mercado Pago. O pedido só será liberado após a confirmação."}</p>}</section>}

    {etapa<6 && erroValidacao && <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-semibold text-destructive">{erroValidacao}</p>}
    {etapa<=5 && <div className="mt-5 flex items-center justify-between gap-3">
      {etapa>1?<button type="button" onClick={()=>{setErroValidacao("");setEtapa(etapa-1);}} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold"><ChevronLeft size={18}/> Voltar</button>:<span/>}
      {etapa<5?<button type="button" disabled={verificandoSlug} onClick={()=>void avancarEtapa()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">{verificandoSlug?"Verificando endereço...":"Continuar"} <ChevronRight size={18}/></button>
      :<button type="button" disabled={enviando} onClick={()=>void continuarPagamento()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"><Check size={18}/>{enviando?"Enviando...":valorCobrado===0?"Enviar para aprovação":"Continuar para pagamento"}</button>}
    </div>}
  </div></main>;
}

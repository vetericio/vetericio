import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-conteudo")({ component: AdminConteudo });

const PADRAO = {
  marca: "Oricse",
  titulo_planos: "Escolha o plano ideal para sua clínica ou petshop.",
  subtitulo_planos: "Organize atendimento, internação, prontuários, financeiro e estoque em um só sistema.",
  cta_plano: "Escolher plano",
  contato: "",
  logo_url: "",
  selo_mais_vendido: "Mais vendido",
  selo_recomendado: "Recomendado",
  rotulo_mensal: "Mensal",
  rotulo_anual: "Anual",
  texto_pagamento_mensal: "Pagamento mensal",
  texto_pagamento_anual: "Pagamento anual",
  rodape_planos: "Os planos e condições podem ser ajustados conforme a necessidade da clínica.",
  teste_gratis_titulo: "Teste grátis",
  teste_gratis_preco: "Grátis por 7 dias",
  teste_gratis_texto: "Teste gratuito · 1 vez por CPF/CNPJ",
  teste_gratis_botao: "Começar 7 dias grátis",

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

type Config = typeof PADRAO & Record<string, any>;

function Campo({ label, value, onChange, area = false, type = "text" }: { label: string; value: any; onChange: (v: any) => void; area?: boolean; type?: string }) {
  return <label className="text-sm font-semibold">{label}{area ? <textarea value={value ?? ""} onChange={(e)=>onChange(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-normal"/> : <input type={type} value={value ?? ""} onChange={(e)=>onChange(type === "number" ? Number(e.target.value) : e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal"/>}</label>;
}

function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-white p-5 shadow-sm"><div><h2 className="text-xl font-bold">{titulo}</h2>{descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}</div><div className="mt-5 grid gap-4 md:grid-cols-2">{children}</div></section>;
}

function CanvasPlanos({ cfg }: { cfg: Config }) {
  const cards = [
    { nome: cfg.teste_gratis_titulo || "Teste grátis", preco: cfg.teste_gratis_preco || "Grátis por 7 dias", rotulo: cfg.teste_gratis_texto || "Teste gratuito", selo: "" },
    { nome: "Essencial", preco: "R$ 49,90", rotulo: cfg.texto_pagamento_mensal, selo: "" },
    { nome: "Plus", preco: "R$ 79,90", rotulo: cfg.texto_pagamento_mensal, selo: cfg.selo_mais_vendido },
    { nome: "Master", preco: "R$ 119,90", rotulo: cfg.texto_pagamento_mensal, selo: cfg.selo_recomendado },
  ];

  return <div className="sticky top-5 overflow-hidden rounded-3xl border bg-[#f7f4ed] shadow-xl">
    <div className="flex items-center justify-between border-b bg-white px-4 py-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Canvas</p><p className="text-sm font-semibold">Prévia da página de planos</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">ao vivo</span></div>
    <div className="max-h-[calc(100vh-120px)] overflow-auto p-5">
      <div className="mx-auto max-w-5xl rounded-3xl bg-[#faf8f3] p-6 shadow-inner">
        <div className="text-center">
          <img src={cfg.logo_url || "/oricse-logo.png"} alt="Oricse" className="mx-auto h-auto w-full max-w-[190px] object-contain"/>
          <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-bold leading-tight">{cfg.titulo_planos}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">{cfg.subtitulo_planos}</p>
          <div className="mx-auto mt-4 inline-flex rounded-xl border bg-white p-1 text-xs font-semibold shadow-sm"><span className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">{cfg.rotulo_mensal}</span><span className="px-4 py-2 text-slate-500">{cfg.rotulo_anual}</span></div>
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-4">
          {cards.map((card, index) => <div key={card.nome} className={`relative flex min-h-[235px] flex-col rounded-2xl border bg-white p-4 ${index >= 2 ? "border-primary/60 ring-1 ring-primary/10" : ""}`}>
            {card.selo && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-white">{card.selo}</span>}
            <h3 className="mt-1 text-lg font-bold">{card.nome}</h3>
            <p className="mt-2 min-h-9 text-xs text-slate-500">Uma opção da Oricse para sua operação.</p>
            <p className="mt-5 text-xl font-bold">{card.preco}</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-400">{card.rotulo}</p>
            <button className="mt-4 min-h-9 rounded-lg bg-primary px-3 text-xs font-bold text-white">{index === 0 ? (cfg.teste_gratis_botao || "Começar 7 dias grátis") : cfg.cta_plano}</button>
          </div>)}
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-center text-[10px] text-slate-400">{cfg.rodape_planos}</p>
      </div>
    </div>
  </div>;
}

function AdminConteudo() {
  const [cfg, setCfg] = useState<Config>(PADRAO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { void (async () => {
    const { data, error } = await (supabase as any).from("oricse_config").select("valor").eq("chave", "site_publico").maybeSingle();
    if (error) return toast.error("Não foi possível carregar as configurações.");
    setCfg({ ...PADRAO, ...(data?.valor || {}) });
  })(); }, []);

  const set = (campo: string, valor: any) => setCfg((atual) => ({ ...atual, [campo]: valor }));

  async function salvar() {
    setSalvando(true);
    const valor = { ...cfg, valor_perfil_extra_mensal: Math.max(0, Number(cfg.valor_perfil_extra_mensal) || 0) };
    const { error } = await (supabase as any).from("oricse_config").upsert({ chave: "site_publico", valor, updated_at: new Date().toISOString() });
    setSalvando(false);
    if (error) return toast.error(error.message);
    setCfg(valor);
    toast.success("Conteúdo público atualizado.");
  }

  return <main className="min-h-screen bg-[#f6f4ef] px-4 py-6 text-slate-900 sm:px-6"><div className="mx-auto max-w-[1600px]">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={17}/> Voltar ao Admin</Link><h1 className="mt-3 text-3xl font-bold">Site e marca</h1><p className="mt-1 text-sm text-muted-foreground">Edite à esquerda e acompanhe a página no canvas à direita.</p></div>
      <div className="flex gap-2"><a href="/planos" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold">Abrir página pública <ExternalLink size={16}/></a><button disabled={salvando} onClick={salvar} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"><Save size={17}/>{salvando ? "Salvando..." : "Salvar tudo"}</button></div>
    </div>

    <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(620px,1.08fr)]">
      <div className="space-y-5">
        <Bloco titulo="Página de planos" descricao="Tudo aqui altera o canvas ao lado em tempo real.">
          <Campo label="Título" value={cfg.titulo_planos} onChange={(v)=>set("titulo_planos",v)}/>
          <Campo label="Texto do botão" value={cfg.cta_plano} onChange={(v)=>set("cta_plano",v)}/>
          <div className="md:col-span-2"><Campo label="Subtítulo" value={cfg.subtitulo_planos} onChange={(v)=>set("subtitulo_planos",v)} area/></div>
          <Campo label="Selo do Plus" value={cfg.selo_mais_vendido} onChange={(v)=>set("selo_mais_vendido",v)}/>
          <Campo label="Selo do Master" value={cfg.selo_recomendado} onChange={(v)=>set("selo_recomendado",v)}/>
          <Campo label="Nome da opção mensal" value={cfg.rotulo_mensal} onChange={(v)=>set("rotulo_mensal",v)}/>
          <Campo label="Nome da opção anual" value={cfg.rotulo_anual} onChange={(v)=>set("rotulo_anual",v)}/>
          <Campo label="Texto cobrança mensal" value={cfg.texto_pagamento_mensal} onChange={(v)=>set("texto_pagamento_mensal",v)}/>
          <Campo label="Texto cobrança anual" value={cfg.texto_pagamento_anual} onChange={(v)=>set("texto_pagamento_anual",v)}/>
          <div className="md:col-span-2"><Campo label="Texto do rodapé dos planos" value={cfg.rodape_planos} onChange={(v)=>set("rodape_planos",v)} area/></div>
        </Bloco>

        <Bloco titulo="Teste grátis de 7 dias" descricao="Textos específicos do quarto card da página.">
          <Campo label="Nome do plano grátis" value={cfg.teste_gratis_titulo} onChange={(v)=>set("teste_gratis_titulo",v)}/>
          <Campo label="Preço / chamada" value={cfg.teste_gratis_preco} onChange={(v)=>set("teste_gratis_preco",v)}/>
          <div className="md:col-span-2"><Campo label="Texto abaixo do preço" value={cfg.teste_gratis_texto} onChange={(v)=>set("teste_gratis_texto",v)} area/></div>
          <Campo label="Texto do botão" value={cfg.teste_gratis_botao} onChange={(v)=>set("teste_gratis_botao",v)}/>
        </Bloco>

        <Bloco titulo="Formulário de contratação" descricao="Textos das etapas e da revisão antes do pagamento.">
          <Campo label="Título principal" value={cfg.titulo_contratacao} onChange={(v)=>set("titulo_contratacao",v)}/>
          <Campo label="Texto voltar aos planos" value={cfg.voltar_planos} onChange={(v)=>set("voltar_planos",v)}/>
          <div className="md:col-span-2"><Campo label="Subtítulo / explicação" value={cfg.subtitulo_contratacao} onChange={(v)=>set("subtitulo_contratacao",v)} area/></div>
          <Campo label="Etapa 1" value={cfg.etapa1_titulo} onChange={(v)=>set("etapa1_titulo",v)}/>
          <Campo label="Etapa 2" value={cfg.etapa2_titulo} onChange={(v)=>set("etapa2_titulo",v)}/>
          <Campo label="Etapa 3" value={cfg.etapa3_titulo} onChange={(v)=>set("etapa3_titulo",v)}/>
          <Campo label="Etapa 4" value={cfg.etapa4_titulo} onChange={(v)=>set("etapa4_titulo",v)}/>
          <div className="md:col-span-2"><Campo label="Texto após preparar pagamento" value={cfg.etapa4_texto} onChange={(v)=>set("etapa4_texto",v)} area/></div>
        </Bloco>

        <Bloco titulo="Perfis e preço adicional" descricao="O valor salvo aqui passa a ser usado no cálculo.">
          <Campo label="Título da área" value={cfg.perfis_titulo} onChange={(v)=>set("perfis_titulo",v)}/>
          <Campo label="Valor por perfil extra / mês (R$)" type="number" value={cfg.valor_perfil_extra_mensal} onChange={(v)=>set("valor_perfil_extra_mensal",v)}/>
          <div className="md:col-span-2"><Campo label="Texto explicativo" value={cfg.perfis_texto} onChange={(v)=>set("perfis_texto",v)} area/></div>
          <p className="md:col-span-2 -mt-2 text-xs text-muted-foreground">Você pode usar <b>{"{incluidos}"}</b>, <b>{"{perfil}"}</b> e <b>{"{valor}"}</b>.</p>
          <Campo label="Rótulo Incluídos" value={cfg.perfis_incluidos_rotulo} onChange={(v)=>set("perfis_incluidos_rotulo",v)}/>
          <Campo label="Rótulo Extras" value={cfg.perfis_extras_rotulo} onChange={(v)=>set("perfis_extras_rotulo",v)}/>
          <Campo label="Rótulo Adicional" value={cfg.perfis_adicional_rotulo} onChange={(v)=>set("perfis_adicional_rotulo",v)}/>
          <Campo label="Rótulo Observações" value={cfg.observacoes_rotulo} onChange={(v)=>set("observacoes_rotulo",v)}/>
        </Bloco>

        <Bloco titulo="Termos, botões e pagamento">
          <div className="md:col-span-2"><Campo label="Texto dos Termos" value={cfg.texto_termos} onChange={(v)=>set("texto_termos",v)} area/></div>
          <div className="md:col-span-2"><Campo label="Texto da Privacidade" value={cfg.texto_privacidade} onChange={(v)=>set("texto_privacidade",v)} area/></div>
          <Campo label="Botão Continuar" value={cfg.botao_continuar} onChange={(v)=>set("botao_continuar",v)}/>
          <Campo label="Botão Voltar" value={cfg.botao_voltar} onChange={(v)=>set("botao_voltar",v)}/>
          <Campo label="Botão Ir para pagamento" value={cfg.botao_pagamento} onChange={(v)=>set("botao_pagamento",v)}/>
          <Campo label="Texto enquanto prepara" value={cfg.preparando_pagamento} onChange={(v)=>set("preparando_pagamento",v)}/>
          <div className="md:col-span-2"><Campo label="Aviso enquanto checkout não estiver conectado" value={cfg.checkout_pendente} onChange={(v)=>set("checkout_pendente",v)} area/></div>
        </Bloco>
      </div>

      <CanvasPlanos cfg={cfg}/>
    </div>
  </div></main>;
}

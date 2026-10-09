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

  return <main className="min-h-screen bg-[#f6f4ef] px-4 py-6 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={17}/> Voltar ao Admin</Link><h1 className="mt-3 text-3xl font-bold">Conteúdo público e contratação</h1><p className="mt-1 text-sm text-muted-foreground">Tudo desta área pode ser alterado sem mexer no código.</p></div>
      <div className="flex gap-2"><a href="/planos" target="_blank" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold">Ver página <ExternalLink size={16}/></a><button disabled={salvando} onClick={salvar} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"><Save size={17}/>{salvando ? "Salvando..." : "Salvar tudo"}</button></div>
    </div>

    <div className="mt-6 space-y-5">
      <Bloco titulo="Página de planos" descricao="Textos gerais, botões, selos e cobrança exibidos ao público.">
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

      <Bloco titulo="Perfis e preço adicional" descricao="Controle completo da área de perfis. O valor salvo aqui passa a ser usado no cálculo.">
        <Campo label="Título da área" value={cfg.perfis_titulo} onChange={(v)=>set("perfis_titulo",v)}/>
        <Campo label="Valor por perfil extra / mês (R$)" type="number" value={cfg.valor_perfil_extra_mensal} onChange={(v)=>set("valor_perfil_extra_mensal",v)}/>
        <div className="md:col-span-2"><Campo label="Texto explicativo" value={cfg.perfis_texto} onChange={(v)=>set("perfis_texto",v)} area/></div>
        <p className="md:col-span-2 -mt-2 text-xs text-muted-foreground">Você pode usar <b>{"{incluidos}"}</b>, <b>{"{perfil}"}</b> e <b>{"{valor}"}</b>. O sistema substitui automaticamente.</p>
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
  </div></main>;
}

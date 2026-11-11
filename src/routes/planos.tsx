import { RodapeInstitucional } from "@/components/RodapeInstitucional";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Search, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BENEFICIOS_ORICSE, NIVEIS_PLANOS, permitidoNoNivel } from "@/lib/beneficios-oricse";
import { PLANOS_PADRAO } from "@/lib/drive-seed";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos e preços — ORICSE" },
      { name: "description", content: "Compare os 98 benefícios do ORICSE nos planos Solo, Essencial, Profissional e Master." },
      { property: "og:title", content: "Planos ORICSE — compare todas as funcionalidades" },
      { property: "og:url", content: "https://oricse.com.br/planos" },
    ],
  }),
  component: Planos,
});

type Plano = {
  id: string; codigo: string; nome: string; descricao?: string; ativo: boolean;
  usuarios_inclusos: number; preco_mensal?: string; preco_anual?: string; itens?: string[];
};
type Regra = { plano_id: string; funcionalidade_codigo: string; permitido: boolean };
const codigosNovos = new Set<string>(NIVEIS_PLANOS);
const planosIniciais = PLANOS_PADRAO.filter((p) => codigosNovos.has(p.codigo)) as unknown as Plano[];
const LIMITE_ANIMAIS: Record<string, string> = {
  "solo-2026": "25 animais",
  "essencial-2026": "200 animais",
  "profissional-2026": "1.000 animais",
  "master-2026": "Animais ilimitados",
};

const PERGUNTAS_FREQUENTES = [
  {
    pergunta: "O que acontece ao atingir o limite de animais?",
    resposta: "Os cadastros existentes permanecem acessíveis. Para cadastrar novos animais, será necessário ampliar o limite ou o plano.",
  },
  {
    pergunta: "Posso escolher outros períodos de renovação?",
    resposta: "Sim. Na renovação estão previstos ciclos mensal, trimestral, semestral, anual e bienal, conforme as condições vigentes.",
  },
  {
    pergunta: "Os planos possuem fidelidade?",
    resposta: "Somente o plano Master possui fidelidade mínima de 12 meses, inclusive para quem escolhe o pagamento mensal. Os planos Solo, Essencial e Profissional não possuem fidelidade: você pode solicitar o cancelamento sem precisar cumprir um período mínimo de permanência. Valores já pagos, períodos contratados e eventuais condições de cancelamento seguem os termos da contratação.",
  },
  {
    pergunta: "Qual plano é indicado para quem trabalha sozinho?",
    resposta: "O Solo foi pensado para veterinários autônomos. Inclui 1 usuário, consultas, prontuários básicos e documentos clínicos, respeitando o limite de animais do plano.",
  },
  {
    pergunta: "O Oricse atende pet shops, banho e tosa e hotelzinho?",
    resposta: "Sim. O plano Profissional contempla módulos de banho e tosa, hotelzinho, estoque e gestão de serviços. Consulte a comparação para conferir a disponibilidade em cada plano.",
  },
  {
    pergunta: "Quantos profissionais podem usar o sistema?",
    resposta: "Cada plano já inclui uma quantidade de usuários para sua equipe. Precisa de mais profissionais? Você pode ampliar os acessos conforme seu negócio cresce, contratando usuários adicionais por um valor extra, de acordo com as condições comerciais vigentes. Assim, sua equipe tem espaço para crescer sem precisar trocar de sistema.",
  },
  {
    pergunta: "O Portal do Tutor está incluído?",
    resposta: "O Portal do Tutor aparece entre os recursos de planos compatíveis, como Essencial e superiores. Confira a tabela comparativa para ver o que está disponível no plano escolhido.",
  },
  {
    pergunta: "Consigo acompanhar internações e medicações?",
    resposta: "O módulo de internação e o acompanhamento de medicações fazem parte dos recursos apresentados para o plano Profissional e níveis superiores.",
  },
  {
    pergunta: "O sistema tem financeiro e caixa?",
    resposta: "Sim. Há recursos financeiros conforme o plano contratado: opções básicas no Essencial e gestão mais completa nas modalidades superiores.",
  },
  {
    pergunta: "Qual plano oferece RH e controle de ponto?",
    resposta: "Esses recursos são previstos para o Master, que inclui RH, ponto, banco de horas e comissões.",
  },
  {
    pergunta: "Posso usar minha identidade visual e meu domínio?",
    resposta: "O Master é a modalidade indicada para personalização e domínio próprio. As condições e os recursos disponíveis devem ser conferidos na contratação.",
  },
  {
    pergunta: "Posso conhecer o Oricse antes de contratar?",
    resposta: "Sim. Você pode solicitar uma demonstração personalizada para conhecer as funcionalidades mais importantes para seu tipo de negócio.",
    link: true,
  },
] as const;

function Planos() {
  const [planos, setPlanos] = useState<Plano[]>(planosIniciais);
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");
  const [regras, setRegras] = useState<Map<string, boolean>>(new Map());
  const [comparar, setComparar] = useState(false);
  const [busca, setBusca] = useState("");
  const [erroCarregamento, setErroCarregamento] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const [planosRes, regrasRes] = await Promise.all([
          (supabase as any).from("oricse_planos")
            .select("id,codigo,nome,descricao,ativo,ordem,preco_mensal,preco_anual,usuarios_inclusos,itens")
            .eq("ativo", true).order("ordem"),
          (supabase as any).from("oricse_plano_funcionalidades")
            .select("plano_id,funcionalidade_codigo,permitido"),
        ]);
        if (planosRes.error || regrasRes.error) throw planosRes.error || regrasRes.error;
        if (!ativo) return;
        const disponiveis = ((planosRes.data || []) as Plano[]).filter((p) => codigosNovos.has(p.codigo));
        if (disponiveis.length) setPlanos(disponiveis);
        setRegras(new Map(((regrasRes.data || []) as Regra[])
          .filter((r) => r.funcionalidade_codigo.startsWith("beneficio."))
          .map((r) => [r.plano_id + ":" + r.funcionalidade_codigo, Boolean(r.permitido)])));
        setErroCarregamento(false);
      } catch {
        if (ativo) setErroCarregamento(true);
      }
    })();
    return () => { ativo = false; };
  }, []);

  const grupos = useMemo(() => {
    const m = new Map<string, typeof BENEFICIOS_ORICSE>();
    for (const beneficio of BENEFICIOS_ORICSE) {
      const termo = busca.trim().toLocaleLowerCase("pt-BR");
      if (termo && ![beneficio.nome,beneficio.grupo]
        .some((x) => x.toLocaleLowerCase("pt-BR").includes(termo))) continue;
      m.set(beneficio.grupo, [...(m.get(beneficio.grupo) || []), beneficio]);
    }
    return [...m.entries()];
  }, [busca]);

  const autorizado = (p: Plano, codigo: string) => {
    const salvo = regras.get(p.id + ":" + codigo);
    return salvo === undefined
      ? permitidoNoNivel(codigo, NIVEIS_PLANOS.indexOf(p.codigo as any))
      : salvo;
  };

  const detalhesPlano: Record<string, { ideal: string; chamada: string; destaques: string[] }> = {
    "solo-2026": {
      ideal: "Veterinário autônomo",
      chamada: "O essencial para atender com segurança e organização.",
      destaques: ["Prontuários e consultas", "Receitas, exames e documentos", "Painel com resumo do dia", "Cadastro de tutores e animais", "Histórico completo dos animais", "Receituário veterinário em PDF", "Assinatura de documentos clínicos", "Dados completos de identificação e contato", "Documentos e encaminhamentos clínicos", "Temas e aparência básica"],
    },
    "essencial-2026": {
      ideal: "Consultórios e pequenos negócios",
      chamada: "A rotina clínica conectada, do agendamento ao tutor.",
      destaques: ["Agenda e prontuário completo", "Financeiro e caixa básicos", "Portal do Tutor", "Anamnese completa", "Calculadora de medicações", "Cartão de vacinas e vermífugos", "Histórico clínico completo", "Receituário veterinário em PDF", "Assinatura de documentos clínicos", "Consulta de exames e laudos pelo portal"],
    },
    "profissional-2026": {
      ideal: "Clínicas e operações pet",
      chamada: "Quando a sua equipe precisa operar tudo no mesmo lugar.",
      destaques: ["Internação e medicações", "Banho e Tosa e Hotelzinho", "Estoque, financeiro e comandas", "Agendamento online pelo tutor", "Painel completo da recepção", "Controle de medicações na internação", "Indicadores financeiros operacionais", "Fila de espera e controle de atendimento", "Cobranças e pagamentos online"],
    },
    "master-2026": {
      ideal: "Negócios em expansão",
      chamada: "A estrutura completa para gestão, relacionamento e identidade própria.",
      destaques: ["RH, ponto, banco de horas e comissões", "CRM, campanhas e relacionamento", "Domínio próprio e personalização", "Relatórios gerenciais avançados", "Gestão de usuários e permissões", "Análises de desempenho do negócio", "Indicadores e resultados de campanhas"],
    },
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#fffdfa] text-[#4A1826]">
      <section className="relative isolate overflow-hidden border-b border-[#f1ded6] bg-[radial-gradient(circle_at_76%_18%,rgba(255,223,150,.92),transparent_28%),radial-gradient(circle_at_20%_4%,rgba(255,255,255,.95),transparent_34%),linear-gradient(135deg,#fffaf7_0%,#ffd9ca_43%,#ffc65a_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-10%] bottom-[-24%] h-[52%] rotate-[-4deg] rounded-[50%] bg-[#e68b35]/25 blur-[1px]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-12%] bottom-[-34%] h-[53%] rotate-[4deg] rounded-[50%] border-t border-white/50 bg-[#b75527]/25" />
        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-5 sm:px-8 sm:pb-20 lg:px-10 lg:pb-24">
          <header className="flex items-center justify-start gap-4">
            <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#6d2941]/20 bg-white/70 px-4 text-sm font-bold text-[#5b2337] shadow-sm backdrop-blur transition hover:bg-white">
              <ArrowLeft size={17}/> Voltar ao início
            </Link>
          </header>

          <div className="mx-auto mt-14 max-w-4xl text-center sm:mt-16">
            <img src="/oricse-logo-oryx.svg?v=15" alt="ORICSE — Soluções para o mercado pet" width="512" height="512" className="mx-auto block h-[161px] w-[161px] -translate-y-[90px] object-contain sm:h-[179px] sm:w-[179px] lg:h-[213px] lg:w-[213px]" />
            <h1 className="-mt-[50px] font-display text-[clamp(2.8rem,6.2vw,6.25rem)] font-semibold leading-[.91] tracking-[-.065em] text-[#4A1826]">
              Seu negócio cresceu.<br /><span className="text-[#a76b78]">Sua gestão também pode crescer.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-7 text-[#704b58] sm:text-lg">
              Comece com o que sua rotina pede hoje. Quando precisar de mais estrutura, a Oricse acompanha o próximo passo.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="#planos" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#4A1826] px-6 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(74,24,38,.22)] transition hover:-translate-y-0.5 hover:bg-[#662139]">
                Escolher meu plano <span className="ml-2 text-lg">→</span>
              </a>
              <a href="/demonstracao" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#7d3349]/30 bg-white/80 px-6 text-sm font-bold text-[#5e263b] transition hover:bg-white">
                Quero uma demonstração <span className="ml-2 text-lg">→</span>
              </a>
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-3 rounded-[24px] border border-white/70 bg-white/45 p-3 backdrop-blur-sm sm:grid-cols-4 sm:p-4">
            {["Agenda e prontuário", "Financeiro e caixa", "Portal do Tutor", "Gestão que acompanha"].map((item) => (
              <div key={item} className="rounded-2xl bg-white/75 px-4 py-3 text-center text-sm font-bold text-[#5c2a3b]">{item}</div>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="scroll-mt-5 bg-[#fffdfa] px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-[1370px]">
          <div className="flex flex-col items-center justify-between gap-6 text-center lg:flex-row lg:text-left">
            <div className="max-w-2xl">
              <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#a06072]">ENCONTRE O SEU PONTO DE PARTIDA</p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-[.95] tracking-[-.055em] sm:text-5xl">Planos claros. Estrutura de verdade.</h2>
              <p className="mt-4 text-base leading-7 text-[#765c66]">Você vê o que entra em cada plano — inclusive o que ainda não entra.</p>
            </div>
            <div className="flex w-fit items-center gap-1 rounded-2xl border border-[#ddc7c4] bg-white p-1.5 shadow-sm" role="group" aria-label="Período de pagamento">
              <button type="button" onClick={() => setCiclo("mensal")} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${ciclo === "mensal" ? "bg-[#4A1826] text-white shadow-sm" : "text-[#735661] hover:bg-[#faf0ed]"}`}>Mensal</button>
              <button type="button" onClick={() => setCiclo("anual")} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${ciclo === "anual" ? "bg-[#4A1826] text-white shadow-sm" : "text-[#735661] hover:bg-[#faf0ed]"}`}>Anual <span className="hidden sm:inline">· economize 2 meses</span></button>
            </div>
          </div>

          {erroCarregamento && <p className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">Exibindo condições de referência. Confirme os valores na etapa de contratação.</p>}

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4" aria-label="Planos disponíveis">
            {planos.map((p) => {
              const destaque = p.codigo === "profissional-2026";
              const master = p.codigo === "master-2026";
              const preco = ciclo === "mensal" ? p.preco_mensal : p.preco_anual;
              const detalhe = detalhesPlano[p.codigo] || { ideal: "Negócio pet", chamada: p.descricao || "", destaques: (p.itens || []).slice(0, 4) };
              return (
                <article key={p.id} className={`relative flex min-h-full flex-col overflow-hidden rounded-[28px] border p-6 shadow-[0_14px_34px_rgba(74,24,38,.07)] transition hover:-translate-y-1 ${destaque ? "border-[#6b263d] bg-[#fffaf7] ring-2 ring-[#6b263d]/20 xl:-translate-y-3" : master ? "border-[#e7c37a] bg-[linear-gradient(160deg,#fffdf8,#fff5dc)]" : "border-[#eaded8] bg-white"}`}>
                  {destaque && <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-[#4A1826] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.1em] text-white"><Sparkles size={12}/> Mais escolhido</span>}
                  {master && <span className="inline-flex w-fit rounded-full bg-[#f4dc9e] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#674517]">Para crescer sem limite</span>}
                  <p className={`text-xs font-extrabold uppercase tracking-[.14em] ${destaque ? "mt-7 text-[#944a61]" : "mt-4 text-[#a06072]"}`}>Ideal para {detalhe.ideal}</p>
                  <h3 className="mt-3 text-3xl font-black tracking-[-.04em]">{p.nome}</h3>
                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-[#765c66]">{detalhe.chamada}</p>

                  <div className="mt-6 border-y border-[#eaded8] py-5">
                    <p className="text-[clamp(2rem,3vw,2.6rem)] font-black leading-none tracking-[-.05em]">{preco || "Consultar"}</p>
                    <p className="mt-2 text-xs font-semibold text-[#856872]">{ciclo === "mensal" ? "por mês" : "por ano · equivalente a 10 mensalidades"}</p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-[#f8efeb] px-3 py-3"><span className="block text-[10px] font-extrabold uppercase tracking-[.13em] text-[#9b6170]">Animais</span><strong className="mt-1 block text-sm">{LIMITE_ANIMAIS[p.codigo] || "Consulte"}</strong></div>
                    <div className="rounded-2xl bg-[#f8efeb] px-3 py-3"><span className="block text-[10px] font-extrabold uppercase tracking-[.13em] text-[#9b6170]">Equipe</span><strong className="mt-1 block text-sm">{p.usuarios_inclusos} usuário{p.usuarios_inclusos !== 1 ? "s" : ""}</strong></div>
                  </div>

                  <ul className="mt-6 space-y-3 text-sm leading-5 text-[#5e3f4b]">
                    {detalhe.destaques.map((item) => <li key={item} className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-[#9b4f66]"/><span>{item}</span></li>)}
                  </ul>
                  {p.codigo === "master-2026" && <p className="mt-5 rounded-xl bg-[#fff0c9] px-3 py-2 text-xs font-bold leading-5 text-[#79561d]">Fidelidade mínima de 12 meses, inclusive no pagamento mensal.</p>}
                  <div className="mt-auto pt-6">
                    <a href={`/contratar?plano=${encodeURIComponent(p.codigo)}&ciclo=${ciclo}`} aria-label={`Começar com ${p.nome}`} className={`group flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 px-4 text-sm font-extrabold transition hover:-translate-y-0.5 ${destaque ? "border-[#4A1826] bg-[#4A1826] text-white shadow-[0_10px_22px_rgba(74,24,38,.2)] hover:bg-[#662139]" : master ? "border-[#c28c2b] bg-white text-[#5c2739] shadow-[0_8px_18px_rgba(194,140,43,.12)] hover:bg-[#fff9ea]" : "border-[#8a4658]/60 bg-[#fffdfb] text-[#5c2739] shadow-sm hover:border-[#6b263d] hover:bg-[#fff3ef]"}`}>
                      Começar com {p.nome} <span aria-hidden="true" className="text-lg leading-none transition-transform group-hover:translate-x-0.5">→</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="mt-12 overflow-hidden rounded-[30px] bg-[#4A1826] px-6 py-8 text-[#fff9f6] shadow-[0_24px_55px_rgba(74,24,38,.2)] sm:px-10 sm:py-10">
            <div className="flex flex-col items-center justify-between gap-7 text-center lg:flex-row lg:text-left">
              <div className="max-w-2xl"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#f2bdc9]">NÃO É SÓ UM SISTEMA DE CLÍNICA</p><h2 className="mt-3 font-display text-3xl font-semibold leading-[.95] tracking-[-.05em] sm:text-4xl">A Oricse se encaixa no jeito que o seu negócio cuida.</h2><p className="mt-4 text-sm leading-6 text-[#efdce1]">Atendimento em domicílio, clínica com equipe, pet shop, banho e tosa, hotelzinho e outros negócios pet.</p></div>
              <a href="/demonstracao" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[#ffe2ca] px-6 text-sm font-extrabold text-[#4A1826] transition hover:-translate-y-0.5 hover:bg-white">Quero uma demonstração <span className="ml-2 text-lg">→</span></a>
            </div>
          </section>

          <div className="mt-12 text-center">
            <button type="button" onClick={() => setComparar((v) => !v)} aria-label="Comparar todos os 98 benefícios" aria-expanded={comparar} className="inline-flex min-h-12 items-center gap-3 rounded-full border border-[#8b4b5e]/30 bg-white px-6 text-sm font-extrabold text-[#6b2d43] shadow-sm transition hover:bg-[#fff4ef]">
              {comparar ? "Ocultar comparação completa" : "Veja exatamente o que entra em cada plano"}<ChevronDown size={18} className={comparar ? "rotate-180" : ""}/>
            </button>
          </div>

          {comparar && <section className="mt-7 rounded-[28px] border border-[#eaded8] bg-white p-5 shadow-sm sm:p-7" aria-label="Comparação completa dos benefícios">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#a06072]">COMPARAÇÃO TRANSPARENTE</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Veja exatamente o que entra em cada plano</h2><p className="mt-2 text-sm text-[#765c66]">Os 98 itens com indicação explícita de disponibilidade.</p></div>
              <label className="relative flex w-full max-w-sm items-center"><Search className="absolute left-3 text-[#946b77]" size={17}/><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar benefícios..." aria-label="Pesquisar benefícios" className="min-h-11 w-full rounded-xl border border-[#e5d3d0] bg-[#fffaf8] pl-10 pr-3 text-sm outline-none focus:border-[#7c364c]"/></label>
            </div>
            <div className="mt-5 max-w-full overflow-x-auto rounded-2xl border border-[#eaded8]">
              <table className="w-full min-w-[700px] border-collapse text-left text-sm"><thead className="sticky top-0 z-10 bg-[#f9efec]"><tr><th scope="col" className="sticky left-0 z-20 min-w-[270px] bg-[#f9efec] px-4 py-3">Benefício</th>{planos.map((p) => <th scope="col" key={p.id} className="min-w-[100px] px-3 py-3 text-center">{p.nome}</th>)}</tr></thead><tbody>{grupos.map(([grupo, beneficios]) => <FragmentoGrupo key={grupo} grupo={grupo} beneficios={beneficios} planos={planos} autorizado={autorizado}/>)}{grupos.length === 0 && <tr><td className="p-5 text-[#765c66]" colSpan={planos.length + 1}>Nenhum benefício encontrado.</td></tr>}</tbody></table>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#846873]">As condições refletem a configuração comercial global do Admin. Permissões individuais e exceções privadas de cada clínica podem ser diferentes.</p>
          </section>}

          <section className="mx-auto mt-20 max-w-6xl pb-4" aria-labelledby="faq-planos-titulo">
            <div className="text-center">
              <p className="text-[11px] font-extrabold uppercase tracking-[.17em] text-[#a06072]">SEM LETRAS MIÚDAS</p>
              <h2 id="faq-planos-titulo" className="mt-3 font-display text-4xl font-semibold leading-tight tracking-[-.05em] text-[#4A1826]">Perguntas que todo mundo faz</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#765c66] sm:text-base">Respostas diretas para escolher o plano certo para o seu negócio.</p>
            </div>
            <div className="mt-9 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
              {PERGUNTAS_FREQUENTES.map((item) => (
                <article key={item.pergunta} className="flex h-full flex-col rounded-[24px] border border-[#eaded8] bg-white p-6 shadow-[0_8px_25px_rgba(74,24,38,.04)] transition-shadow hover:shadow-[0_12px_35px_rgba(74,24,38,.08)] sm:p-7">
                  <h3 className="text-[17px] font-extrabold leading-snug text-[#4A1826]">{item.pergunta}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-[#765c66]">{item.resposta}</p>
                  {"link" in item && item.link && (
                    <a href="/demonstracao" className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-bold text-[#7c344b] underline underline-offset-4 hover:text-[#4A1826]">
                      Solicitar demonstração <span aria-hidden="true">→</span>
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
      <RodapeInstitucional />
    </main>
  );
}

function FragmentoGrupo({grupo,beneficios,planos,autorizado}:{
  grupo: string;
  beneficios: typeof BENEFICIOS_ORICSE;
  planos: Plano[];
  autorizado: (p: Plano, codigo: string) => boolean;
}) {
  return <>
    <tr><th scope="rowgroup" colSpan={planos.length + 1} className="bg-[#F5F2EE] px-4 py-3 font-black">{grupo} · {beneficios.length}</th></tr>
    {beneficios.map((b) => <tr key={b.codigo} className="border-t border-[#E9E1D6]">
      <th scope="row" className="sticky left-0 bg-white px-4 py-3 font-medium">{b.nome}</th>
      {planos.map((p) => {
        const sim = autorizado(p,b.codigo);
        return <td key={p.id} className="px-3 py-3 text-center" aria-label={p.nome+": "+(sim?"Incluído":"Não incluído")}>
          {sim ? <Check className="mx-auto text-emerald-700" size={18}/> : <X className="mx-auto text-muted-foreground" size={17}/>}
          <span className="sr-only">{sim ? "Incluído" : "Não incluído"}</span>
        </td>;
      })}
    </tr>)}
  </>;
}

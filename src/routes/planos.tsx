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
      { property: "og:url", content: "https://oricse.vetericio.workers.dev/planos" },
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

  return <main className="min-h-screen bg-[#F5F2EE] px-4 py-7 text-[#2B0F18] sm:px-6">
    <div className="mx-auto max-w-[1370px]">
      <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary">
        <ArrowLeft size={18}/> Voltar
      </Link>
      <header className="mx-auto mt-8 max-w-3xl text-center">
        <p className="mx-auto flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2 text-xs font-bold text-primary">
          <Sparkles size={15}/> Planos ORICSE
        </p>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Um plano para cada fase do seu negócio</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          De atendimentos individuais à gestão de clínicas, pet shops, Banho e Tosa e Hotelzinho.
          Compare todos os 98 benefícios, inclusive os que não estão disponíveis em cada plano.
        </p>
        <div className="mx-auto mt-6 flex w-fit items-center gap-1 rounded-2xl border bg-white p-1.5 shadow-sm" role="group" aria-label="Período de pagamento">
          <button type="button" onClick={() => setCiclo("mensal")}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold ${ciclo==="mensal"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}>Mensal</button>
          <button type="button" onClick={() => setCiclo("anual")}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold ${ciclo==="anual"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}>Anual · economize 2 meses</button>
        </div>
      </header>

      {erroCarregamento && <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
        Exibindo condições de referência. Confirme os valores na etapa de contratação.
      </p>}
      <section className="mt-11 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Planos disponíveis">
        {planos.map((p) => {
          const destaque = p.codigo === "profissional-2026";
          const preco = ciclo === "mensal" ? p.preco_mensal : p.preco_anual;
          return <article key={p.id} className={`relative flex h-full flex-col rounded-3xl border bg-white p-5 shadow-sm sm:p-6 ${destaque?"border-primary ring-2 ring-primary/25 shadow-xl":"border-[#E9E1D6]"}`}>
            {destaque && <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"><Sparkles size={13}/> Recomendado</span>}
            <h2 className="text-2xl font-black">{p.nome}</h2>
            <p className="mt-2 min-h-14 text-sm text-muted-foreground">{p.descricao}</p>
            <p className="mt-5 text-3xl font-black tabular-nums">{preco || "Consultar"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{ciclo === "mensal" ? "por mês" : "por ano · 365 dias"}</p>
            <div className="mt-5 space-y-2 rounded-xl bg-[#F5F2EE] p-3 text-sm">
              <p className="font-bold"><Check size={16} className="mr-2 inline text-primary"/>{LIMITE_ANIMAIS[p.codigo] || "Consulte os limites"}</p>
              <p className="font-bold"><Check size={16} className="mr-2 inline text-primary"/>{p.usuarios_inclusos} usuário{p.usuarios_inclusos !== 1 ? "s" : ""}</p>
              {(p.itens || []).filter((item) => !/animais|usuário/i.test(item)).slice(0,4).map((item,i) => <p key={i}><Check size={15} className="mr-2 inline text-primary"/>{item}</p>)}
            </div>
            {p.codigo === "master-2026" && <p className="mt-3 text-xs font-bold text-amber-800">Fidelidade mínima de 12 meses, inclusive no pagamento mensal.</p>}
            <a href={`/contratar?plano=${encodeURIComponent(p.codigo)}&ciclo=${ciclo}`}
              className="mt-auto flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground hover:bg-primary/90" style={{marginTop:24}}>
              Escolher {p.nome}
            </a>
          </article>;
        })}
      </section>
      <div className="mt-8 text-center">
        <button type="button" onClick={() => setComparar((v) => !v)} aria-expanded={comparar}
          className="inline-flex min-h-12 items-center gap-3 rounded-xl border border-primary/30 bg-white px-6 text-sm font-bold text-primary shadow-sm">
          {comparar ? "Ocultar comparação completa" : "Comparar todos os 98 benefícios"}
          <ChevronDown size={18} className={comparar ? "rotate-180" : ""}/>
        </button>
      </div>
      {comparar && <section className="mt-7 rounded-3xl border bg-white p-4 shadow-sm sm:p-6" aria-label="Comparação completa dos benefícios">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Comparação completa dos benefícios</h2>
            <p className="mt-1 text-sm text-muted-foreground">98 itens com indicação explícita do que cada plano inclui ou não inclui.</p>
          </div>
          <label className="relative flex w-full max-w-sm items-center">
            <Search className="absolute left-3 text-muted-foreground" size={17}/>
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar benefícios..." aria-label="Pesquisar benefícios" className="min-h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm"/>
          </label>
        </div>
        <div className="mt-4 max-w-full overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-secondary">
              <tr><th scope="col" className="sticky left-0 z-20 min-w-[270px] bg-secondary px-4 py-3">Benefício</th>
                {planos.map((p) => <th scope="col" key={p.id} className="min-w-[100px] px-3 py-3 text-center">{p.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {grupos.map(([grupo,beneficios]) => <FragmentoGrupo key={grupo} grupo={grupo} beneficios={beneficios} planos={planos} autorizado={autorizado}/>)}
              {grupos.length===0 && <tr><td className="p-5 text-muted-foreground" colSpan={planos.length+1}>Nenhum benefício encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">As condições refletem a configuração comercial global do Admin. Permissões individuais de funcionários e exceções privadas de cada clínica podem ser diferentes. Recursos em desenvolvimento são entregues conforme validação técnica.</p>
      </section>}
      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="font-display text-3xl font-semibold">Perguntas frequentes</h2>
        <div className="mt-5 divide-y divide-[#E9E1D6]">
          <div className="py-4"><h3 className="font-bold">O que acontece ao atingir o limite de animais?</h3><p className="mt-2 text-sm text-muted-foreground">Os cadastros existentes permanecem acessíveis. Para cadastrar novos animais, será necessário ampliar o limite ou o plano.</p></div>
          <div className="py-4"><h3 className="font-bold">Posso escolher outros períodos de renovação?</h3><p className="mt-2 text-sm text-muted-foreground">Sim. Na renovação estão previstos ciclos mensal, trimestral, semestral, anual e bienal, conforme as condições vigentes.</p></div>
          <div className="py-4"><h3 className="font-bold">O plano Master tem fidelidade?</h3><p className="mt-2 text-sm text-muted-foreground">Sim. O Master possui fidelidade mínima de 12 meses mesmo quando pago mensalmente.</p></div>
        </div>
      </section>
    </div>
  </main>;
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

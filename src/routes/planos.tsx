import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos e preços — Oricse" },
      {
        name: "description",
        content: "Conheça os planos da Oricse para veterinários, clínicas e petshops.",
      },
      { property: "og:title", content: "Planos e preços — Oricse" },
      { property: "og:url", content: "https://oricse.vetericio.workers.dev/planos" },
    ],
  }),
  component: Planos,
});

export const PLANOS_PADRAO = [
  {
    nome: "Essencial",
    descricao: "Para veterinário autônomo ou em domicílio",
    preco: "R$ 49,90",
    preco_mensal: "R$ 49,90",
    preco_anual: "R$ 499,00",
    itens: [
      "1 usuário incluso",
      "Cadastro de animais e tutores",
      "Anamnese e prontuários",
      "Receituário e PDFs clínicos",
    ],
  },
  {
    nome: "Plus (Clínica)",
    descricao: "Bom para petshops e clínicas",
    preco: "R$ 99,90",
    preco_mensal: "R$ 99,90",
    preco_anual: "R$ 999,00",
    destaque: true,
    itens: [
      "Logo da sua clínica",
      "3 usuários inclusos",
      "Consultório e recepção",
      "Financeiro e caixa",
      "Serviços e estoque",
    ],
  },
  {
    nome: "Master (Equipe)",
    descricao: "Para equipes e clínicas que precisam de um sistema sob medida",
    preco: "R$ 199,90",
    preco_mensal: "R$ 199,90",
    preco_anual: "R$ 1.999,00",
    itens: [
      "Tudo que o sistema oferece",
      "Personalização: ajustamos o sistema à sua necessidade",
      "Site da clínica com endereço próprio",
      "5 usuários inclusos",
    ],
  },
] as const;

type Plano = {
  codigo?: string;
  nome: string;
  descricao?: string;
  preco?: string;
  preco_mensal?: string;
  preco_anual?: string;
  itens?: readonly string[];
};

type ConsultaPlanos = {
  eq: (
    campo: string,
    valor: boolean,
  ) => { order: (campo: string) => Promise<{ data: Plano[] | null }> };
};

type ClientePlanos = { from: (tabela: string) => { select: (campos: string) => ConsultaPlanos } };

function condicaoGratis(valor: string) {
  if (/gr[áa]tis/i.test(valor)) return true;
  if (!valor.trim()) return false;
  const numero = Number(
    valor
      .replace(/[^0-9,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
  return Number.isFinite(numero) && numero === 0;
}

function Planos() {
  const [planos, setPlanos] = useState<Plano[]>([...PLANOS_PADRAO]);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const api = supabase as unknown as ClientePlanos;
        const { data } = await api
          .from("oricse_planos")
          .select("codigo,nome,descricao,preco,preco_mensal,preco_anual,itens,ativo,ordem")
          .eq("ativo", true)
          .order("ordem");
        if (ativo && Array.isArray(data) && data.length) setPlanos(data);
      } catch {
        // Mantém os planos padrão se a consulta estiver indisponível.
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#F5F2EE] px-4 py-6 text-[#2B0F18] sm:px-6">
      <div className="mx-auto w-full max-w-[1600px]">
        <Link
          to="/"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary"
        >
          <ArrowLeft size={18} /> Voltar
        </Link>

        <header className="mx-auto mt-8 max-w-3xl text-center">
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Escolha o plano ideal para o seu negócio
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Organize atendimento, internação, prontuários, financeiro e estoque em um só sistema.
          </p>
        </header>

        <section className="mt-10 grid gap-5 lg:grid-cols-4">
          {planos.map((plano) => {
            const mensal = String(plano.preco_mensal || plano.preco || "");
            const anual = String(plano.preco_anual || "");
            const nome = String(plano.nome || "");
            const nomeMin = nome.toLowerCase();
            const testeGratis =
              String(plano.codigo || "").toLowerCase() === "teste-gratis" ||
              nomeMin.includes("teste grátis") ||
              nomeMin.includes("teste gratis");
            const codigo = plano.codigo || (testeGratis ? "teste-gratis" : nomeMin);
            const selo = nomeMin.includes("plus") ? "Recomendado" : "";

            return (
              <article
                key={codigo}
                className={
                  "relative flex h-full flex-col rounded-3xl border bg-card p-6 shadow-sm " +
                  (nomeMin.includes("plus")
                    ? "border-primary shadow-lg ring-2 ring-primary/20"
                    : "")
                }
              >
                {selo && (
                  <span
                    className={
                      "absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-bold " +
                      (nomeMin.includes("plus")
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-800 text-white")
                    }
                  >
                    {selo}
                  </span>
                )}
                <h2 className="text-2xl font-bold">{nome}</h2>
                <p className="mt-2 min-h-[120px] text-sm text-muted-foreground">
                  {plano.descricao}
                </p>

                <div className="mt-6 min-h-32">
                  {testeGratis ? (
                    <p className="text-2xl font-bold sm:text-3xl">
                      {plano.preco || mensal || "Grátis por 7 dias"}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Mensal
                        </span>
                        <p className="mt-1 whitespace-nowrap text-lg font-bold leading-tight sm:text-xl">
                          {mensal ? (condicaoGratis(mensal) ? "Grátis" : mensal) : "—"}
                        </p>
                        {mensal && !condicaoGratis(mensal) && (
                          <span className="mt-1 block text-xs text-muted-foreground">por mês</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Anual
                        </span>
                        <p className="mt-1 whitespace-nowrap text-lg font-bold leading-tight sm:text-xl">
                          {anual ? (condicaoGratis(anual) ? "Grátis" : anual) : "—"}
                        </p>
                        {anual && !condicaoGratis(anual) && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            por ano · 2 meses grátis
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <a
                  href={"/contratar?plano=" + encodeURIComponent(codigo) + "&ciclo=mensal"}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Contratar
                </a>

                <ul className="mt-6 space-y-3">
                  {(plano.itens || []).map((item: string) => (
                    <li key={item} className="text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>

        <section className="mx-auto mt-16 max-w-3xl">
          <h2 className="font-display text-3xl font-semibold">Dúvidas sobre os planos</h2>
          <div className="mt-6 divide-y divide-[#E9E1D6]">
            {[
              [
                "Existe fidelidade?",
                "Consulte as condições de contratação apresentadas antes do pagamento.",
              ],
              [
                "Posso trocar de plano?",
                "A equipe Oricse orienta a mudança conforme a necessidade da clínica.",
              ],
              [
                "Quais são as formas de pagamento?",
                "As opções disponíveis aparecem no fluxo de contratação do plano escolhido.",
              ],
            ].map(([pergunta, resposta]) => (
              <details key={pergunta} className="py-4">
                <summary className="cursor-pointer font-semibold">{pergunta}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{resposta}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

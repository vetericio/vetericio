import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { usePermissoes } from "@/hooks/usePermissoes";
import { supabase } from "@/integrations/supabase/client";
import { consultarRelatorio } from "@/lib/relatorios.functions";
import { vincularOrcamentoRelatorio } from "@/lib/orcamentos-relatorio.functions";
import {
  CODIGOS_FINANCEIROS,
  dataBR,
  diaNoFuso,
  periodoValido,
  RELATORIOS,
  PERMISSAO_RELATORIOS,
  type CodigoRelatorio,
  type DadosRelatorio,
  type TabelaRelatorio,
} from "@/lib/relatorios";

export const Route = createFileRoute("/relatorios")({ component: Relatorios });

const controle = "min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const botao =
  "min-h-10 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60";
const titulo = (codigo: CodigoRelatorio) => RELATORIOS[Number(codigo) - 1];

function Relatorios() {
  const { clinicaId, clinicaNome, pode, carregando } = usePermissoes();
  const [atual, escolher] = useState<CodigoRelatorio>("01");
  const autorizado = !!clinicaId && pode(PERMISSAO_RELATORIOS);
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-24 pt-6 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <BarChart3 aria-hidden="true" /> Relatórios
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {clinicaNome || "Consulte os relatórios da clínica selecionada."}
        </p>
      </header>
      {carregando ? (
        <p role="status">Verificando acesso…</p>
      ) : !autorizado ? (
        <p role="status">
          Selecione uma clínica com acesso financeiro para consultar os relatórios.
        </p>
      ) : (
        <>
          <nav aria-label="Relatórios financeiros" className="flex flex-wrap gap-2">
            {CODIGOS_FINANCEIROS.map((codigo) => (
              <button
                key={codigo}
                type="button"
                aria-pressed={atual === codigo}
                onClick={() => escolher(codigo)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${atual === codigo ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
              >
                {codigo} · {titulo(codigo)}
              </button>
            ))}
          </nav>
          <Painel
            key={`${clinicaId}:${atual}`}
            codigo={atual}
            clinicaId={clinicaId}
            podeVincular={pode("caixa.financeiro.gerenciar")}
          />
          <details className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer font-semibold">Catálogo dos 30 relatórios</summary>
            <ol className="mt-4 grid list-decimal gap-2 pl-6 text-sm sm:grid-cols-2">
              {RELATORIOS.map((nome, i) => {
                const codigo = CODIGOS_FINANCEIROS[i];
                return (
                  <li key={nome}>
                    {codigo ? (
                      <button
                        type="button"
                        onClick={() => escolher(codigo)}
                        className="text-left font-semibold text-primary underline"
                      >
                        {nome}
                      </button>
                    ) : (
                      <>
                        {nome} <span className="text-xs text-muted-foreground">(planejado)</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          </details>
        </>
      )}
    </main>
  );
}

async function tokenAtual() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Entre novamente para continuar.");
  return data.session.access_token;
}

function Painel({
  codigo,
  clinicaId,
  podeVincular,
}: {
  codigo: CodigoRelatorio;
  clinicaId: string;
  podeVincular: boolean;
}) {
  const hoje = diaNoFuso(new Date().toISOString());
  const [inicio, setInicio] = useState(hoje.slice(0, 7) + "-01");
  const [fim, setFim] = useState(hoje);
  const [resultado, setResultado] = useState<{
    dados: DadosRelatorio;
    inicio: string;
    fim: string;
  }>();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);

  async function carregar(de: string, ate: string) {
    setResultado(undefined);
    setErro("");
    if (!periodoValido(de, ate)) {
      setErro("Escolha um período válido de até 93 dias.");
      return;
    }
    setOcupado(true);
    try {
      const dados = await consultarRelatorio({
        data: { accessToken: await tokenAtual(), clinicaId, codigo, inicio: de, fim: ate },
      });
      setResultado({ dados, inicio: de, fim: ate });
      setVersao((v) => v + 1);
    } catch {
      setErro("Não foi possível consultar. Confira seu acesso ou tente um período menor.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section
      className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6"
      aria-label={titulo(codigo)}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void carregar(inicio, fim);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="text-sm font-semibold">
          De
          <input
            className={controle}
            type="date"
            value={inicio}
            required
            disabled={ocupado}
            onChange={(e) => setInicio(e.target.value)}
          />
        </label>
        <label className="text-sm font-semibold">
          Até
          <input
            className={controle}
            type="date"
            value={fim}
            required
            min={inicio}
            disabled={ocupado}
            onChange={(e) => setFim(e.target.value)}
          />
        </label>
        <button className={botao} type="submit" disabled={ocupado}>
          {ocupado ? "Consultando…" : "Consultar"}
        </button>
      </form>
      {codigo === "07" && (
        <Link to="/orcamento-venda-expressa" className="inline-flex text-sm text-primary underline">
          Abrir tela de orçamentos
        </Link>
      )}
      {codigo === "07" && podeVincular && (
        <VincularVenda
          clinicaId={clinicaId}
          onVinculado={() => resultado && void carregar(resultado.inicio, resultado.fim)}
        />
      )}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      {ocupado && (
        <p role="status" className="sr-only">
          Carregando relatório.
        </p>
      )}
      {resultado && (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            Período consultado: {dataBR(resultado.inicio)} a {dataBR(resultado.fim)}.
          </p>
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {resultado.dados.indicadores.map((i) => (
              <div className="rounded-xl border p-3" key={i.rotulo}>
                <dt className="text-xs text-muted-foreground">{i.rotulo}</dt>
                <dd className="text-lg font-semibold">{i.valor}</dd>
              </div>
            ))}
          </dl>
          {resultado.dados.notas.map((n) => (
            <p key={n} className="text-sm text-muted-foreground">
              {n}
            </p>
          ))}
          {resultado.dados.tabelas.map((t) => (
            <Tabela key={`${versao}:${t.titulo}`} tabela={t} />
          ))}
        </>
      )}
    </section>
  );
}

function Tabela({ tabela }: { tabela: TabelaRelatorio }) {
  const porPagina = 50;
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const termo = busca.toLocaleLowerCase("pt-BR").trim();
  const filtradas = termo
    ? tabela.linhas.filter((l) =>
        l.some((c) => String(c).toLocaleLowerCase("pt-BR").includes(termo)),
      )
    : tabela.linhas;
  return (
    <section className="space-y-2 border-t pt-4">
      <h2 className="font-bold">{tabela.titulo}</h2>
      {tabela.linhas.length > 0 && (
        <label className="block max-w-sm text-sm">
          Filtrar na tabela
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            className={controle}
          />
        </label>
      )}
      {!filtradas.length ? (
        <p className="py-3 text-sm text-muted-foreground">Nenhum registro encontrado.</p>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border"
          tabIndex={0}
          role="region"
          aria-label={tabela.titulo}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                {tabela.colunas.map((c) => (
                  <th scope="col" key={c} className="px-3 py-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.slice(pagina * porPagina, (pagina + 1) * porPagina).map((l, i) => (
                <tr key={i} className="border-t align-top">
                  {l.map((c, j) => (
                    <td key={j} className="min-w-24 px-3 py-2">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtradas.length > porPagina && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
            disabled={!pagina}
            onClick={() => setPagina(pagina - 1)}
          >
            Anterior
          </button>
          <span>
            Página {pagina + 1} de {Math.ceil(filtradas.length / porPagina)}
          </span>
          <button
            type="button"
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
            disabled={(pagina + 1) * porPagina >= filtradas.length}
            onClick={() => setPagina(pagina + 1)}
          >
            Próxima
          </button>
        </div>
      )}
    </section>
  );
}

function VincularVenda({ clinicaId, onVinculado }: { clinicaId: string; onVinculado: () => void }) {
  const [orcamentoId, setOrcamento] = useState("");
  const [vendaId, setVenda] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [status, setStatus] = useState("");
  return (
    <details className="rounded-xl border p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        Vincular orçamento a uma venda já concluída
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">
        Copie os códigos das tabelas abaixo. O vínculo só entra no relatório e não altera a venda, o
        estoque ou o caixa.
      </p>
      <form
        className="mt-2 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (ocupado) return;
          setOcupado(true);
          setStatus("");
          try {
            await vincularOrcamentoRelatorio({
              data: { clinicaId, accessToken: await tokenAtual(), orcamentoId, vendaId },
            });
            setStatus("Venda vinculada ao orçamento.");
            setOrcamento("");
            setVenda("");
            onVinculado();
          } catch {
            setStatus(
              "Não foi possível vincular. Confira os códigos, a clínica e se a venda já foi vinculada.",
            );
          } finally {
            setOcupado(false);
          }
        }}
      >
        <label className="text-sm font-semibold">
          Código do orçamento
          <input
            required
            value={orcamentoId}
            onChange={(e) => setOrcamento(e.target.value)}
            className={controle}
          />
        </label>
        <label className="text-sm font-semibold">
          Código da venda
          <input
            required
            value={vendaId}
            onChange={(e) => setVenda(e.target.value)}
            className={controle}
          />
        </label>
        <button type="submit" disabled={ocupado} className={botao}>
          {ocupado ? "Vinculando…" : "Confirmar vínculo"}
        </button>
      </form>
      {status && (
        <p role="status" className="mt-2 text-sm">
          {status}
        </p>
      )}
    </details>
  );
}

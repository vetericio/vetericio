import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, FileUp } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { usePermissoes } from "@/hooks/usePermissoes";
import { supabaseBanco } from "@/integrations/supabase/client";
import { enviarAnexoPortal } from "@/lib/drive.functions";
import { PORTAL_PDF_MAX_BYTES } from "@/lib/drive-storage";
import {
  lerCsv,
  modelosMigracao,
  montarRegistros,
  plataformasMigracao,
  sugerirColunas,
  type RegistroMigracao,
  type RetornoMigracao,
  type TipoMigracao,
} from "@/lib/migracao-assistida";

export const Route = createFileRoute("/migracao-assistida")({ component: MigracaoAssistida });

const etapas: Record<TipoMigracao, string> = {
  tutores: "Tutores",
  animais: "Animais",
  prontuarios: "Prontuários",
  vacinas: "Vacinas",
  anexos: "Anexos",
};
const limite = 10_000;
const ImportacaoCadastrosClinica = lazy(async () => ({
  default: (await import("@/components/ImportacaoCadastrosClinica")).ImportacaoCadastrosClinica,
}));
type Aba = { sheet: string; data: (string | number | boolean | Date | null | undefined)[][] };
type Conferencia = RegistroMigracao & RetornoMigracao;

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", conteudo], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MigracaoAssistida() {
  const { clinicaId, pode, carregando } = usePermissoes();
  if (carregando)
    return (
      <p className="p-6" role="status">
        Carregando a clínica…
      </p>
    );
  if (!clinicaId || !pode("administracao.configuracoes"))
    return <p className="p-6">Selecione uma clínica que você administra.</p>;
  return (
    <PainelMigracao
      key={clinicaId}
      clinicaId={clinicaId}
      podeAnexar={pode("consultorio.atendimentos")}
    />
  );
}

function PainelMigracao({ clinicaId, podeAnexar }: { clinicaId: string; podeAnexar: boolean }) {
  const [plataforma, setPlataforma] = useState<keyof typeof plataformasMigracao>("simplesvet");
  const [outra, setOutra] = useState("");
  const [tipo, setTipo] = useState<TipoMigracao>("tutores");
  const [abas, setAbas] = useState<Aba[]>([]);
  const [aba, setAba] = useState(0);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [resultado, setResultado] = useState<Conferencia[]>([]);
  const [anterior, setAnterior] = useState(false);
  const trabalhando = useRef(false);
  const [operacao, setOperacao] = useState("");
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState("");
  const nomePlataforma =
    plataforma === "outra" ? outra.trim() : plataformasMigracao[plataforma].nome;
  const origem = plataforma === "outra" ? outra.trim().toLocaleLowerCase("pt-BR") : plataforma;
  const titulos = (abas[aba]?.data[0] || []).map(String);

  function selecionar(planilhas: Aba[], indice: number, proximoTipo: TipoMigracao) {
    setAba(indice);
    setMapa(sugerirColunas(proximoTipo, (planilhas[indice]?.data[0] || []).map(String)));
    setResultado([]);
    setProgresso("");
  }

  async function abrir(file?: File) {
    if (!file || trabalhando.current) return;
    trabalhando.current = true;
    setAbas([]);
    setResultado([]);
    setErro("");
    setProgresso("");
    setOperacao("Lendo arquivo");
    try {
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error("Selecione um arquivo CSV ou XLSX.");
      if (file.size > 10_000_000) throw new Error("Divida arquivos acima de 10 MB.");
      const planilhas = file.name.toLowerCase().endsWith(".xlsx")
        ? await (await import("read-excel-file/browser")).default(file)
        : [{ sheet: file.name, data: lerCsv(await file.text()) }];
      const utilizaveis: Aba[] = planilhas.filter((item) => item.data.length > 1).map(({sheet,data})=>({
        sheet,
        data: data.map(row=>row.map(cell=>typeof cell==="function"?null:cell)),
      }));
      if (!utilizaveis.length)
        throw new Error("O arquivo precisa de cabeçalho e pelo menos um registro.");
      setAbas(utilizaveis);
      selecionar(utilizaveis, 0, tipo);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível ler o arquivo.");
    } finally {
      trabalhando.current = false;
      setOperacao("");
    }
  }

  async function executar(importar: boolean) {
    const linhas = importar ? resultado : montarRegistros(abas[aba]?.data || [], mapa);
    if (!linhas.length || !origem || trabalhando.current) return;
    if (linhas.length > limite) return setErro("Divida a aba em lotes de até 10.000 registros.");
    trabalhando.current = true;
    const saida: Conferencia[] = [];
    const repetidos = new Set<string>();
    setErro("");
    setOperacao(importar ? "Importando" : "Conferindo");
    setProgresso("");

    try {
      const accessToken =
        tipo === "anexos" && importar
          ? (await supabaseBanco.auth.getSession()).data.session?.access_token
          : undefined;
      const processar = async (lote: RegistroMigracao[]) => {
        const { data, error } = await supabaseBanco.rpc("oricse_migrar_registros", {
          p_clinica: clinicaId,
          p_origem: origem,
          p_tipo: tipo,
          p_registros: lote.map((linha) => linha.dados),
          p_importar: importar,
        });
        if (error || !data || data.length !== lote.length)
          throw new Error(error?.message || "Lote sem confirmação.");
        saida.push(...lote.map((linha, indice) => ({ ...linha, ...data[indice] })));
      };

      let lote: RegistroMigracao[] = [];
      for (const linha of linhas) {
        if (importar && "status" in linha && linha.status === "pendente") {
          saida.push(linha as Conferencia);
          continue;
        }
        const chave = linha.dados.id_origem;
        if (chave && repetidos.has(chave)) {
          saida.push({
            ...linha,
            status: "pendente",
            motivo: "Identificador repetido no arquivo.",
          });
          continue;
        }
        if (chave) repetidos.add(chave);
        if (tipo !== "anexos") {
          lote.push(linha);
          if (lote.length < 100) continue;
          await processar(lote);
          lote = [];
        } else {
          try {
            if (!importar) {
              await processar([linha]);
              const verificacao = saida[saida.length - 1];
              if (verificacao.status !== "novo") continue;
              saida.pop();
              const file = arquivos.find((item) => item.name === linha.dados.arquivo);
              if (
                !podeAnexar ||
                !file ||
                arquivos.filter((item) => item.name === file.name).length !== 1 ||
                file.size > PORTAL_PDF_MAX_BYTES ||
                (await file.slice(0, 5).text()) !== "%PDF-"
              ) {
                saida.push({
                  ...verificacao,
                  status: "pendente",
                  motivo:
                    "Vincule um PDF válido de até 20 MB e confira a permissão de atendimento clínico.",
                });
              } else saida.push(verificacao);
              continue;
            }
            if ("status" in linha && linha.status === "existente") {
              saida.push(linha as Conferencia);
              continue;
            }
            const encontrados = arquivos.filter((file) => file.name === linha.dados.arquivo);
            const file = encontrados[0];
            if (!podeAnexar)
              throw new Error(
                "Seu acesso precisa da permissão de atendimento clínico para importar PDFs.",
              );
            if (
              encontrados.length !== 1 ||
              !file ||
              !file.name.toLowerCase().endsWith(".pdf") ||
              file.size > PORTAL_PDF_MAX_BYTES ||
              (await file.slice(0, 5).text()) !== "%PDF-"
            )
              throw new Error("Selecione um PDF válido, com nome único e até 20 MB.");
            if (importar && "status" in linha && linha.status === "novo") {
              const { animalId, registroId } = linha as Conferencia;
              if (!accessToken || !animalId || !registroId)
                throw new Error("Vínculo ou sessão indisponível. Gere uma nova prévia.");
              const base64 = await new Promise<string>((resolve, reject) => {
                const leitor = new FileReader();
                leitor.onload = () => resolve(String(leitor.result).split(",")[1] || "");
                leitor.onerror = () => reject(new Error("Falha ao ler o PDF."));
                leitor.readAsDataURL(file);
              });
              await enviarAnexoPortal({
                data: {
                  accessToken,
                  clinicaId,
                  animalId,
                  registroId,
                  nome: file.name,
                  base64,
                  categoria: "documentos",
                },
              });
            }
            await processar([linha]);
          } catch (falha) {
            saida.push({
              ...linha,
              status: "pendente",
              motivo: falha instanceof Error ? falha.message : "Falha no PDF.",
            });
          }
        }
        setProgresso(`${saida.length} de ${linhas.length}`);
      }
      if (lote.length) await processar(lote);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha no lote.");
      const conferidas = new Set(saida.map((item) => item.linha));
      saida.push(
        ...linhas
          .filter((item) => !conferidas.has(item.linha))
          .map((item) => ({
            ...item,
            status: "pendente" as const,
            motivo: "Sem confirmação nesta tentativa. Gere outra prévia para retomar.",
          })),
      );
    } finally {
      setResultado(saida.sort((a, b) => a.linha - b.linha));
      setProgresso("");
      setOperacao("");
      trabalhando.current = false;
    }
  }

  const prontos = resultado.some(
    (r) =>
      r.status === "novo" ||
      (r.status === "existente" && r.motivo === "Vínculo pronto para registrar."),
  );
  const pendentes = resultado.filter((linha) => linha.status === "pendente");
  const atualizar = () => {
    setResultado([]);
    setErro("");
  };
  const estiloCampo = "mt-1 min-h-10 w-full rounded-lg border bg-background px-3 font-normal";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 pb-24">
      <Link
        to="/perfil-clinica"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft size={17} /> Configurações da clínica
      </Link>
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">
          Migração Assistida{nomePlataforma ? ` - ${nomePlataforma} - Migração` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Importe na ordem dos botões. Use os mesmos identificadores de origem em todas as abas para
          vincular o histórico ao animal certo.
        </p>
      </header>
      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Plataforma de origem
            <select
              disabled={!!operacao}
              className={estiloCampo}
              value={plataforma}
              onChange={(e) => {
                setPlataforma(e.target.value as typeof plataforma);
                atualizar();
              }}
            >
              {Object.entries(plataformasMigracao).map(([id, item]) => (
                <option key={id} value={id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          {plataforma === "outra" && (
            <label className="text-sm font-semibold">
              Nome da plataforma
              <input
                disabled={!!operacao}
                className={estiloCampo}
                value={outra}
                maxLength={80}
                onChange={(e) => {
                  setOutra(e.target.value);
                  atualizar();
                }}
              />
            </label>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{plataformasMigracao[plataforma].instrucao}</p>
        <div className="flex flex-wrap gap-2" aria-label="Dados a importar">
          {Object.entries(etapas).map(([id, nome]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tipo === id}
              disabled={!!operacao}
              onClick={() => {
                setTipo(id as TipoMigracao);
                selecionar(abas, aba, id as TipoMigracao);
              }}
              className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${tipo === id ? "bg-primary text-primary-foreground" : ""}`}
            >
              {nome}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3">
            <FileUp size={16} /> Abrir CSV ou XLSX
            <input
              type="file"
              accept=".csv,.xlsx"
              disabled={!!operacao}
              className="sr-only"
              onChange={(e) => {
                void abrir(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border px-3"
            onClick={() => baixar(`modelo_${tipo}.csv`, modelosMigracao[tipo] + "\n")}
          >
            <Download size={16} /> Baixar modelo
          </button>
          {tipo === "anexos" && (
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3">
              Selecionar PDFs ({arquivos.length})
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                disabled={!!operacao}
                className="sr-only"
                onChange={(e) => {
                  setArquivos(Array.from(e.target.files || []));
                  atualizar();
                }}
              />
            </label>
          )}
        </div>
        {abas.length > 0 && (
          <>
            <label className="block text-sm font-semibold">
              Aba da planilha
              <select
                disabled={!!operacao}
                className={estiloCampo}
                value={aba}
                onChange={(e) => selecionar(abas, Number(e.target.value), tipo)}
              >
                {abas.map((item, i) => (
                  <option key={i} value={i}>
                    {item.sheet}
                  </option>
                ))}
              </select>
            </label>
            <details className="rounded-lg border p-3" open>
              <summary className="cursor-pointer text-sm font-semibold">
                Vincular colunas da planilha
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(mapa).map(([campo, coluna]) => (
                  <label key={campo} className="text-sm font-semibold">
                    {campo.replaceAll("_", " ")}
                    <select
                      className={estiloCampo}
                      value={coluna}
                      disabled={!!operacao}
                      onChange={(e) => {
                        setMapa((atual) => ({ ...atual, [campo]: e.target.value }));
                        atualizar();
                      }}
                    >
                      <option value="">Sem coluna</option>
                      {titulos.map((titulo, i) => (
                        <option key={i} value={i}>
                          {titulo || `Coluna ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>
            <button
              type="button"
              disabled={!!operacao || !origem}
              onClick={() => void executar(false)}
              className="min-h-11 rounded-lg border px-4 text-sm font-bold disabled:opacity-50"
            >
              Gerar prévia
            </button>
          </>
        )}
        {operacao && (
          <p role="status" className="text-sm">
            {operacao}… {progresso}
          </p>
        )}
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
      </section>
      {resultado.length > 0 && (
        <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="font-bold">Conferência por registro</h2>
          <p className="text-sm">
            {resultado.filter((r) => r.status === "novo").length} novos ·{" "}
            {resultado.filter((r) => r.status === "existente").length} existentes ·{" "}
            {resultado.filter((r) => r.status === "importado").length} importados ·{" "}
            {pendentes.length} pendentes
          </p>
          <ul className="max-h-72 divide-y overflow-auto rounded-lg border text-sm">
            {resultado.map((item) => (
              <li key={item.linha} className="flex flex-wrap justify-between gap-2 p-2">
                <span>
                  Linha {item.linha} ·{" "}
                  {item.dados.id_origem || item.dados.nome || "Sem identificador"}
                </span>
                <span
                  className={
                    item.status === "pendente" ? "text-destructive" : "text-muted-foreground"
                  }
                >
                  {item.motivo}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!prontos || !!operacao}
              className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              onClick={() => void executar(true)}
            >
              Importar registros conferidos
            </button>
            {pendentes.length > 0 && (
              <button
                type="button"
                className="rounded-lg border px-3 text-sm"
                onClick={() =>
                  baixar(
                    `pendencias_${tipo}.csv`,
                    "linha;motivo\n" +
                      pendentes
                        .map((p) => `${p.linha};"${p.motivo.replaceAll('"', '""')}"`)
                        .join("\n"),
                  )
                }
              >
                Baixar pendências
              </button>
            )}
          </div>
        </section>
      )}
      <details
        className="rounded-xl border bg-card p-4"
        onToggle={(e) => setAnterior(e.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-semibold">
          Importador anterior de tutores e animais
        </summary>
        {anterior && (
          <Suspense fallback={<p role="status">Carregando…</p>}>
            <ImportacaoCadastrosClinica podeGerenciar />
          </Suspense>
        )}
      </details>
    </main>
  );
}

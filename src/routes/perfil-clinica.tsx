import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Download, FileText, LockKeyhole, Save, Upload } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfiguracaoModelosDocumentos } from "@/components/ConfiguracaoModelosDocumentos";
import { LIMITE_PDF_TERMO, TIPOS_ATENDIMENTO } from "@/lib/configuracoes-clinica";
import { salvarCopiaPdfPadrao, tokenConfiguracoesClinica } from "@/lib/configuracoes-clinica-ui";
import {
  obterConfiguracoesClinica, removerPdfPadraoTermos, salvarAgendaClinica,
  salvarPdfPadraoTermos, salvarProtecaoClinica,
} from "@/lib/configuracoes-clinica.functions";

export const Route = createFileRoute("/perfil-clinica")({
  head: () => ({ meta: [{ title: "Configurações da clínica — Oricse" }] }),
  component: PerfilClinica,
});

type Configuracoes = Awaited<ReturnType<typeof obterConfiguracoesClinica>>;
const categorias = [
  { id: "agenda", titulo: "Agenda", icone: CalendarDays },
  { id: "protecao", titulo: "Assinatura e receituário", icone: LockKeyhole },
  { id: "documentos", titulo: "Termos e documentos", icone: FileText },
] as const;
const campo = "mt-1 min-h-11 w-full rounded-lg border bg-background px-3 font-normal disabled:opacity-70";
const botao = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50";
const primario = "inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50";

function PerfilClinica() {
  const [config, setConfig] = useState<Configuracoes | null>(null);
  const [erro, setErro] = useState("");
  const [abrirEditor, setAbrirEditor] = useState(false);
  const [categoria, setCategoria] = useState<typeof categorias[number]["id"]>("agenda");

  useEffect(() => {
    let ativo = true;
    tokenConfiguracoesClinica()
      .then((accessToken) => obterConfiguracoesClinica({ data: { accessToken } }))
      .then((dados) => { if (ativo) setConfig(dados); })
      .catch((e: Error) => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, []);

  const visiveis = config?.podeEditarDocumentos ? categorias : categorias.slice(0, 1);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-5 sm:px-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Configurações da clínica</h1>
        {config && <p className="mt-1 text-sm text-muted-foreground">{config.nome}</p>}
      </header>
      {!config ? (
        <p role={erro ? "alert" : "status"} className="rounded-xl border bg-card p-4 text-sm">
          {erro || "Carregando configurações…"}
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
          <nav aria-label="Categorias de configurações" className="grid gap-1 rounded-xl border bg-card p-2 sm:grid-cols-3 lg:sticky lg:top-4 lg:grid-cols-1">
            {visiveis.map(({ id, titulo, icone: Icone }) => (
              <button key={id} type="button" aria-current={categoria === id ? "true" : undefined}
                onClick={() => setCategoria(id)}
                className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium ${categoria === id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                <Icone size={18} className="shrink-0" />
                <span className="flex-1">{titulo}</span>
                <ChevronRight size={15} className="shrink-0" />
              </button>
            ))}
          </nav>
          <div className="min-w-0">
            <div hidden={categoria !== "agenda"}><ConfigAgenda config={config} /></div>
            {config.protecao && (
              <div hidden={categoria !== "protecao"}><ConfigProtecao clinicaId={config.id} inicial={config.protecao} /></div>
            )}
            {config.podeEditarDocumentos && (
              <div hidden={categoria !== "documentos"}>
                <ConfigTermos clinicaId={config.id} inicial={config.pdf} />
                <details className="mt-4 rounded-xl border bg-card p-4" onToggle={(e) => { if (e.currentTarget.open) setAbrirEditor(true); }}>
                  <summary className="cursor-pointer text-sm font-semibold">Editor de modelos clínicos</summary>
                  {abrirEditor && <ConfiguracaoModelosDocumentos clinica={config.nome} podeGerenciar />}
                </details>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Painel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 border-b pb-3 text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function ConfigAgenda({ config }: { config: Configuracoes }) {
  const [intervalo, setIntervalo] = useState(String(config.intervalo));
  const [duracoes, setDuracoes] = useState(config.duracoes);
  const [salvo, setSalvo] = useState({ intervalo, duracoes });
  const [salvando, setSalvando] = useState(false);
  const alterado = intervalo !== salvo.intervalo ||
    TIPOS_ATENDIMENTO.some((tipo) => duracoes[tipo] !== salvo.duracoes[tipo]);
  async function salvar() {
    setSalvando(true);
    try {
      const accessToken = await tokenConfiguracoesClinica();
      await salvarAgendaClinica({ data: { accessToken, clinicaId: config.id, intervalo: Number(intervalo), duracoes } });
      setSalvo({ intervalo, duracoes });
      toast.success("Agenda salva.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Painel titulo="Agenda">
      <form onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
        <fieldset disabled={!config.podeEditarAgenda || salvando}>
          <label className="block max-w-xs text-sm font-medium">Intervalo padrão da grade (minutos)
            <input className={campo} required type="number" min={5} max={240}
              value={intervalo} onChange={(e) => setIntervalo(e.target.value)} />
          </label>
          <p className="mt-2 text-sm text-muted-foreground">Preenche o intervalo ao criar uma agenda na clínica.</p>
          <h3 className="mb-1 mt-5 text-sm font-semibold">Duração dos atendimentos</h3>
          <p className="mb-3 text-sm text-muted-foreground">Define a duração sugerida para novos agendamentos da equipe.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TIPOS_ATENDIMENTO.map((tipo) => (
              <label key={tipo} className="text-sm font-medium">{tipo} (min)
                <input className={campo} required type="number" min={5} max={720}
                  value={duracoes[tipo] || ""}
                  onChange={(e) => setDuracoes({ ...duracoes, [tipo]: Number(e.target.value) })} />
              </label>
            ))}
          </div>
          {config.podeEditarAgenda && (
            <button type="submit" className={`${primario} mt-5`} disabled={!alterado || salvando}>
              <Save size={16} />{salvando ? "Salvando…" : "Salvar agenda"}
            </button>
          )}
        </fieldset>
        {!config.podeEditarAgenda && <p className="mt-4 text-sm text-muted-foreground">Seu perfil pode consultar a agenda.</p>}
      </form>
    </Painel>
  );
}

function ConfigProtecao({ clinicaId, inicial }: { clinicaId: string; inicial: NonNullable<Configuracoes["protecao"]> }) {
  const [protecao, setProtecao] = useState(inicial);
  const [salvo, setSalvo] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    setSalvando(true);
    try {
      const accessToken = await tokenConfiguracoesClinica();
      await salvarProtecaoClinica({ data: { accessToken, clinicaId, protecao } });
      setSalvo(protecao);
      toast.success("Proteção dos documentos salva.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Painel titulo="Assinatura e receituário">
      <p className="mb-4 text-sm text-muted-foreground">Quando a opção estiver ligada, o profissional confirma a própria senha do ORICSE ao abrir a ferramenta.</p>
      <fieldset disabled={salvando} className="space-y-2">
        {([
          ["assinar", "Pedir senha para acessar a assinatura"],
          ["receituario", "Pedir senha para acessar o receituário"],
        ] as const).map(([area, rotulo]) => (
          <label key={area} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-medium">
            {rotulo}
            <input type="checkbox" role="switch" checked={protecao[area]}
              onChange={(e) => setProtecao({ ...protecao, [area]: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-primary" />
          </label>
        ))}
      </fieldset>
      <button type="button" className={`${primario} mt-5`} onClick={() => void salvar()}
        disabled={salvando || (protecao.assinar === salvo.assinar && protecao.receituario === salvo.receituario)}>
        <Save size={16} />{salvando ? "Salvando…" : "Salvar proteção"}
      </button>
    </Painel>
  );
}

function ConfigTermos({ clinicaId, inicial }: { clinicaId: string; inicial: string | null }) {
  const [nome, setNome] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }
  function enviar(arquivo: File) {
    return executar(async () => {
      if (!/\.pdf$/i.test(arquivo.name) || arquivo.size > LIMITE_PDF_TERMO) throw new Error("Selecione um PDF de até 5 MB.");
      const [accessToken, base64] = await Promise.all([
        tokenConfiguracoesClinica(),
        new Promise<string>((resolve, reject) => {
          const leitor = new FileReader();
          leitor.onload = () => resolve(String(leitor.result).split(",")[1] || "");
          leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
          leitor.readAsDataURL(arquivo);
        }),
      ]);
      const pdf = await salvarPdfPadraoTermos({ data: { accessToken, clinicaId, nome: arquivo.name, base64 } });
      setNome(pdf.nome);
      toast.success("PDF padrão salvo.");
    });
  }
  return (
    <Painel titulo="PDF padrão dos termos">
      <p className="text-sm text-muted-foreground">Disponibilize o PDF da clínica para a equipe baixar em Termos e documentos.</p>
      <p className="mt-3 break-all text-sm font-medium">{nome || "Nenhum PDF definido"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className={`${botao} relative ${ocupado ? "opacity-50" : "cursor-pointer"} focus-within:outline focus-within:outline-primary`}>
          <Upload size={16} />{nome ? "Substituir PDF" : "Enviar PDF"}
          <input type="file" className="sr-only" accept=".pdf,application/pdf" disabled={ocupado}
            onChange={(e) => {
              const arquivo = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (arquivo) void enviar(arquivo);
            }} />
        </label>
        {nome && (
          <>
            <button type="button" className={botao} disabled={ocupado} onClick={() => void executar(() => salvarCopiaPdfPadrao(clinicaId))}>
              <Download size={16} /> Baixar PDF
            </button>
            <button type="button" className={`${botao} text-destructive`} disabled={ocupado}
              onClick={() => void executar(async () => {
                const accessToken = await tokenConfiguracoesClinica();
                await removerPdfPadraoTermos({ data: { accessToken, clinicaId } });
                setNome(null);
                toast.success("PDF padrão removido.");
              })}>Remover PDF</button>
          </>
        )}
      </div>
      <p role="status" className="mt-2 text-xs text-muted-foreground">{ocupado ? "Processando…" : "PDF de até 5 MB"}</p>
    </Painel>
  );
}

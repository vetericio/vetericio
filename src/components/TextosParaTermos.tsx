import { useEffect, useMemo, useState } from "react";
import { Eye, FileText, History, RotateCcw, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { tokenConfiguracoesClinica } from "@/lib/configuracoes-clinica-ui";
import { obterTextosTermosClinica, salvarTextoTermoClinica } from "@/lib/configuracoes-clinica.functions";
import { TEXTOS_TERMOS_PADRAO } from "@/lib/textos-termos";
import { TEXTOS_TERMOS_ADICIONAIS } from "@/lib/textos-termos-adicionais";

const base = [...TEXTOS_TERMOS_PADRAO, ...TEXTOS_TERMOS_ADICIONAIS];
type TermoSalvo = {
  texto: string; versao: number; atualizadoEm: string;
  historico: { versao: number; texto: string; atualizadoEm: string }[];
};
type Salvos = Record<string, TermoSalvo>;

export function TextosParaTermos({ clinicaId }: { clinicaId: string }) {
  const [salvos, setSalvos] = useState<Salvos>({});
  const [selecionado, setSelecionado] = useState<string>(base[0].id);
  const [corpo, setCorpo] = useState<string>(base[0].texto);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [visualizando, setVisualizando] = useState(false);
  const atual = useMemo(() => base.find((t) => t.id === selecionado) || base[0], [selecionado]);
  const conteudoSalvo = salvos[atual.id]?.texto ?? atual.texto;
  const alterado = corpo !== conteudoSalvo;
  const dados = salvos[atual.id];

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const accessToken = await tokenConfiguracoesClinica();
        const resultado = await obterTextosTermosClinica({ data: { clinicaId, accessToken } });
        if (!ativo) return;
        const registros = resultado.modelos as Salvos;
        setSalvos(registros);
        setCorpo(registros[base[0].id]?.texto ?? base[0].texto);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar os termos.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [clinicaId]);

  function escolher(id: string) {
    if (alterado && !window.confirm("Descartar alterações não salvas?")) return;
    const termo = base.find((t) => t.id === id);
    if (!termo) return;
    setSelecionado(id);
    setCorpo(salvos[id]?.texto ?? termo.texto);
    setVisualizando(false);
  }

  async function salvar() {
    if (salvando || !alterado) return;
    setSalvando(true);
    try {
      const accessToken = await tokenConfiguracoesClinica();
      const resultado = await salvarTextoTermoClinica({ data: {
        clinicaId, accessToken, id: atual.id, texto: corpo, versaoEsperada: dados?.versao ?? 0,
      } });
      setSalvos((anteriores) => ({ ...anteriores, [atual.id]: resultado.modelo }));
      setCorpo(resultado.modelo.texto);
      toast.success("Rascunho salvo com versão. Continua bloqueado para uso.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar. Nenhuma aprovação registrada.");
    } finally {
      setSalvando(false);
    }
  }

  const demonstrativo = corpo.replace(/\{\{([a-z_]+)\}\}/g, (_, campo: string) => ({
    tutor: "Marina Exemplo", paciente: "Luna", veterinario: "Dra. Ana Exemplo", crmv: "CRMV-MG FICTÍCIO",
  } as Record<string,string>)[campo] || "{{" + campo + "}}");

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label="Textos para Termos">
      <div className="mb-4 flex items-start gap-3">
        <FileText size={22} className="mt-1 shrink-0 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Textos para Termos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Biblioteca de 14 minutas. Edite apenas o corpo. Identificação da clínica, responsável,
            paciente, data por extenso e assinaturas serão inseridas pelo gerador padronizado.
          </p>
        </div>
      </div>
      <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/60 p-3 text-sm text-amber-950 dark:bg-amber-900/20 dark:text-amber-100">
        <ShieldAlert size={18} className="shrink-0" />
        <span><strong>Minutas em revisão.</strong> Dr. Paulo e Dra. Camila ainda não têm aprovações
          independentes registradas. Estes modelos não são emitidos nem publicados automaticamente.</span>
      </div>
      {carregando ? <p role="status" className="p-4 text-sm">Carregando biblioteca…</p> :
       erro ? <p role="alert" className="p-4 text-sm text-destructive">{erro}</p> :
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Termos disponíveis" className="max-h-[560px] space-y-1 overflow-auto">
          {base.map((termo) => (
            <button key={termo.id} type="button" onClick={() => escolher(termo.id)}
              aria-current={termo.id === selecionado ? "true" : undefined}
              className={"flex min-h-12 w-full flex-col rounded-lg border p-3 text-left text-sm " +
                (termo.id === selecionado ? "border-primary bg-primary/5" : "hover:bg-muted")}>
              <span className="font-semibold">{termo.nome}</span>
              <span className="mt-1 text-xs text-muted-foreground">Rascunho · {salvos[termo.id] ? "Versão "+salvos[termo.id].versao : "Texto-base"}</span>
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <h3 className="font-semibold">{atual.nome}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{atual.referencia}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Cabeçalho, identificação do paciente, responsável e assinatura: estrutura fixa, não editável aqui.
            </p>
          </div>
          <label className="block text-sm font-semibold">
            Corpo do termo (única área editável)
            <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={17}
              maxLength={25000} className="mt-2 min-h-72 w-full resize-y rounded-xl border bg-background p-4 font-normal leading-relaxed"
              aria-label="Editar corpo do termo" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!alterado || salvando} onClick={() => void salvar()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              <Save size={16} /> {salvando ? "Salvando rascunho…" : "Salvar rascunho"}
            </button>
            <button type="button" onClick={() => setVisualizando((v) => !v)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold">
              <Eye size={16}/> {visualizando ? "Ocultar prévia" : "Prévia do texto"}
            </button>
            <button type="button" onClick={() => setCorpo(atual.texto)} disabled={salvando}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold">
              <RotateCcw size={16}/> Restaurar texto-base
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            A prévia é demonstrativa e não gera assinatura, PDF válido nem autorização de uso.
          </p>
          {visualizando && <div className="rounded-lg border p-4">
            <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">Demonstração sem validade jurídica</p>
            <p className="text-center font-bold">{atual.titulo}</p>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7">{demonstrativo}</div>
            <p className="mt-5 text-center text-xs text-muted-foreground">Assinaturas e identificação ficam no documento final após homologação.</p>
          </div>}
          {dados?.historico?.length ? <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-semibold"><History size={15} className="mr-2 inline"/> Histórico ({dados.historico.length})</summary>
            <div className="mt-2 space-y-2">
              {dados.historico.map((item) =>
                <div key={item.versao} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
                  <span>Versão {item.versao} · {new Date(item.atualizadoEm).toLocaleString("pt-BR")}</span>
                  <button type="button" className="font-medium text-primary" onClick={() => setCorpo(item.texto)}>Carregar no editor</button>
                </div>
              )}
            </div>
          </details> : null}
        </div>
      </div>}
    </section>
  );
}

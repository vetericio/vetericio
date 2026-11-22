import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Eye, FilePenLine, ShieldAlert, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { obterAutorClinico } from "@/lib/perfil-clinico";
import { obterDadosReceituario } from "@/lib/receituario-contexto.functions";
import { obterModeloDocumentoEmissao } from "@/lib/configuracoes-clinica.functions";
import {
  BIBLIOTECA_TERMOS, CAMPOS_TERMOS, pendenciasTermo, prepararConteudoTermo,
  type CodigoTermoClinico, type DadosTermo,
} from "@/lib/termos-clinicos-validacao";
import { TERMOS_CLINICOS_HOMOLOGADOS } from "@/lib/termos-clinicos-status";
import { criarPdfComModelo, prepararPapelDocumento } from "@/lib/modelos-documentos-pdf";

type Contexto = Awaited<ReturnType<typeof obterDadosReceituario>>;
type ModeloEmissao = Awaited<ReturnType<typeof obterModeloDocumentoEmissao>>;
type Autor = Awaited<ReturnType<typeof obterAutorClinico>>;

export function PreparacaoTermosClinicos() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const animalId = params.get("animalId") || "";
  const tutorId = params.get("tutorId") || "";
  const primeiroTermo = params.get("termo") || BIBLIOTECA_TERMOS[0].id;
  const [selecionado, setSelecionado] = useState<CodigoTermoClinico>(
    (BIBLIOTECA_TERMOS.find(termo => termo.id === primeiroTermo) || BIBLIOTECA_TERMOS[0]).id);
  const [dados, setDados] = useState<Contexto | null>(null);
  const [papel, setPapel] = useState<ModeloEmissao | null>(null);
  const [autor, setAutor] = useState<Autor | null>(null);
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [enderecoCompleto, setEnderecoCompleto] = useState(false);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [recusaAssinatura, setRecusaAssinatura] = useState(false);
  const [carregando, setCarregando] = useState(Boolean(animalId));
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [nomePreview, setNomePreview] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    if (!animalId) return;
    let ativo = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error("Sessão expirada. Entre novamente.");
        const contexto = await obterDadosReceituario({
          data: { accessToken, animalId, ...(tutorId ? { tutorId } : {}) },
        });
        if (!contexto.animal?.id || !contexto.tutor?.id || !contexto.clinicaId) {
          throw new Error("Identificação do animal e do responsável incompleta.");
        }
        const [configuracao, profissional] = await Promise.all([
          obterModeloDocumentoEmissao({ data: {
            accessToken, clinicaId: contexto.clinicaId, tipo: "termo",
          } }),
          obterAutorClinico(),
        ]);
        if (!ativo) return;
        setDados(contexto);
        setPapel(configuracao);
        setAutor(profissional);
        setCpf(contexto.tutor.cpf || "");
        setEndereco(contexto.tutor.endereco || "");
        setEnderecoCompleto(Boolean(contexto.tutor.enderecoCompleto));
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o contexto do paciente.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [animalId, tutorId]);

  const termo = useMemo(() => BIBLIOTECA_TERMOS.find(t => t.id === selecionado) || BIBLIOTECA_TERMOS[0], [selecionado]);

  const dadosTermo: DadosTermo | null = dados?.animal && dados.tutor && autor ? {
    tipo: selecionado,
    campos,
    recusaAssinatura,
    identificacao: {
      paciente: dados.animal.nome,
      especie: dados.animal.especie || "",
      tutor: dados.tutor.nome || "",
      cpf,
      enderecoTutor: endereco,
      enderecoTutorCompleto: enderecoCompleto,
      veterinario: autor.nome || "",
      crmv: autor.crmv || "",
      clinica: dados.clinicaNome || "",
      data: new Date().toLocaleDateString("pt-BR"),
    },
  } : null;

  const pendencias = dadosTermo ? pendenciasTermo(dadosTermo) : [];
  function mudarTermo(id: CodigoTermoClinico) {
    setSelecionado(id);
    setCampos({});
    setRecusaAssinatura(false);
    setPreview(null);
  }
  function mudarCampo(id: string, valor: string) {
    setCampos(atual => ({ ...atual, [id]: valor }));
    setPreview(null);
  }
  async function gerar(visualizar: boolean) {
    const animal = dados?.animal;
    const tutor = dados?.tutor;
    if (gerando || !dadosTermo || !animal || !tutor || !papel || !autor) return;
    if (pendencias.length) return void toast.error("Complete os dados antes de gerar: " + pendencias.join("; "));
    setGerando(true);
    try {
      // Estes modelos não estão homologados. A prévia é SEMPRE marcada como
      // demonstrativa e não pode ser registrada como termo oficial neste fluxo.
      const conteudo = prepararConteudoTermo(dadosTermo, termo.texto);
      const folha = await prepararPapelDocumento(papel.identidade, papel.modelo);
      const pdf = await criarPdfComModelo({
        titulo: termo.titulo,
        conteudo,
        papel: folha,
        demonstrativo: true,
        vias: 2,
        assinaturaResponsavel: tutor.nome || "",
        identificacao: {
          paciente: { ...animal, nome: animal.nome || "", peso: animal.peso ? animal.peso + " kg" : "" },
          tutor: { ...tutor, nome: tutor.nome || "", cpf, endereco },
        },
        assinatura: [
          [papel.identidade.municipio, new Date().toLocaleDateString("pt-BR")].filter(Boolean).join(", "),
          (autor.nome || "") + " · " + (autor.crmv || ""),
        ],
      });
      const nome = "PREVIA-SEM-VALIDADE-" + selecionado + ".pdf";
      if (visualizar) {
        setNomePreview(nome);
        setPreview(URL.createObjectURL(pdf.output("blob")));
      } else {
        pdf.save(nome);
        toast.success("Prévia demonstrativa baixada. Não é um termo válido para assinatura.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível preparar a prévia.");
    } finally {
      setGerando(false);
    }
  }

  if (!animalId) return <section className="mt-6 rounded-xl border bg-card p-5">
    <h2 className="flex items-center gap-2 text-lg font-bold"><FilePenLine size={20} /> Preparação dos 14 termos</h2>
    <p className="mt-2 text-sm text-muted-foreground">
      Abra um animal e acesse sua aba Termos para preencher os dados específicos do atendimento, visualizar os modelos e consultar os anexos.
    </p>
    <Link to="/animais" className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary">Selecionar paciente</Link>
  </section>;

  return <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-label="Preparação de termos clínicos">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold"><FilePenLine className="text-primary" size={22} /> Preparar termo clínico</h2>
        <p className="mt-1 text-sm text-muted-foreground">Selecione um dos 14 modelos e informe os dados necessários antes de gerar a prévia.</p>
      </div>
      <Link to="/animal" search={{ animalId } as never} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold">
        <ArrowLeft size={16} /> Voltar à ficha
      </Link>
    </div>
    {!TERMOS_CLINICOS_HOMOLOGADOS && <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <ShieldAlert className="mt-0.5 shrink-0" size={19} />
      Biblioteca aguardando homologação. Este formulário gera somente prévias demonstrativas, com marcação de ausência de validade. Não habilita emissão ou assinatura oficial.
    </p>}
    {carregando && <p className="mt-4 text-sm text-muted-foreground">Carregando os dados da clínica, do tutor e do paciente…</p>}
    {erro && <p role="alert" className="mt-4 rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{erro}</p>}
    {dados && autor && papel && <>
      <p className="mt-4 text-sm">Paciente: <strong>{dados.animal?.nome}</strong> · Responsável: <strong>{dados.tutor?.nome}</strong> · Veterinário: <strong>{autor.nome || "Não informado"}</strong></p>
      <label className="mt-4 block text-sm font-semibold">
        Modelo de termo
        <select value={selecionado} onChange={e => mudarTermo(e.target.value as CodigoTermoClinico)}
          className="mt-2 min-h-12 w-full rounded-xl border bg-background px-3 text-base font-normal">
          {BIBLIOTECA_TERMOS.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}
        </select>
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          CPF do responsável *
          <input value={cpf} onChange={e => { setCpf(e.target.value); setPreview(null); }}
            placeholder="000.000.000-00" className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">
          Endereço completo do responsável *
          <textarea rows={2} value={endereco} onChange={e => { setEndereco(e.target.value); setEnderecoCompleto(false); setPreview(null); }}
            placeholder="Rua, número, bairro, cidade/UF e CEP" className="mt-1 w-full rounded-xl border bg-background p-3 font-normal" />
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enderecoCompleto} onChange={e => { setEnderecoCompleto(e.target.checked); setPreview(null); }} className="size-4 accent-primary" />
        Conferi rua, número, bairro, cidade, UF e CEP.
      </label>
      <fieldset className="mt-5 grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <legend className="px-2 text-sm font-bold">Informações específicas: {termo.nome}</legend>
        {CAMPOS_TERMOS[selecionado].map(campo => <label key={campo.id} className="text-sm font-semibold">
          {campo.rotulo.replace(/ \((obrigatório|preenchimento obrigatório)\)/, "")}{campo.obrigatorio && " *"}
          {selecionado === "rcp" && campo.id === "decisao" ?
            <select value={campos[campo.id] || ""} onChange={e => mudarCampo(campo.id,e.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 font-normal">
              <option value="">Selecione a decisão</option>
              <option value="reanimar">Reanimar em caso de parada</option>
              <option value="nao_reanimar">Não reanimar, após avaliação e discussão clínica</option>
            </select> :
            <textarea rows={campo.obrigatorio ? 3 : 2} maxLength={2000} value={campos[campo.id] || ""}
              onChange={e => mudarCampo(campo.id,e.target.value)} className="mt-1 w-full rounded-xl border bg-background p-3 font-normal"
              placeholder="Preencha conforme o caso clínico" />}
        </label>)}
        {selecionado === "retirada-sem-alta" && <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
          <input type="checkbox" checked={recusaAssinatura} onChange={e => { setRecusaAssinatura(e.target.checked); setPreview(null); }} className="size-4 accent-primary" />
          O responsável recusou assinar, exigir duas testemunhas presentes.
        </label>}
      </fieldset>
      {pendencias.length > 0 &&
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
          Antes de gerar, complete: {pendencias.join("; ")}.
        </p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" disabled={gerando || pendencias.length > 0} onClick={() => void gerar(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          <Eye size={17} /> {gerando ? "Preparando…" : "Visualizar prévia"}
        </button>
        <button type="button" disabled={gerando || pendencias.length > 0} onClick={() => void gerar(false)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50">
          <Download size={17} /> Baixar prévia (2 vias)
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Os dados informados aqui são usados somente nesta prévia. Não atualizam automaticamente o cadastro nem registram o termo como emitido.
      </p>
    </>}
    {preview && <div role="dialog" aria-modal="true" aria-label="Visualização do termo demonstrativo"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3" onMouseDown={e => { if (e.target === e.currentTarget) setPreview(null); }}>
      <div className="flex h-[min(90dvh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <strong className="text-sm">Prévia demonstrativa · {termo.nome}</strong>
          <div className="flex items-center gap-2">
            <a href={preview} download={nomePreview} className="rounded-lg border px-3 py-2 text-sm font-semibold">Baixar prévia</a>
            <button type="button" onClick={() => setPreview(null)} aria-label="Fechar visualização" className="rounded-lg border p-2"><X size={18} /></button>
          </div>
        </div>
        <iframe title={"Prévia demonstrativa de " + termo.nome} src={preview} className="min-h-0 w-full flex-1 bg-white" />
      </div>
    </div>}
  </section>;
}

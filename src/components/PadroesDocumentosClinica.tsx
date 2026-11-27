import { useDemoAlvorada } from "@/lib/demo-alvorada-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, Save } from "lucide-react";
import { toast } from "sonner";
import {
  obterModelosDocumentoClinica, salvarDadosDocumentoClinica, salvarLogoDocumentoClinica, salvarModeloDocumentoClinica,
} from "@/lib/configuracoes-clinica.functions";
import { tokenConfiguracoesClinica } from "@/lib/configuracoes-clinica-ui";
import {
  COR_QUADROS_PADRAO, DOCUMENTOS, FUNDOS_DOCUMENTOS, TIPOS_MODELO_DOCUMENTO, limparOrientacoesPadraoReceita, obterTemaDocumentoPremium, preencherTextoDocumento,
  urlFundoDocumento, valoresModeloDocumento, type TipoModeloDocumento, type IdentidadeDocumento, type ModeloDocumentoPadrao,
} from "@/lib/modelos-documentos";

const botao = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50";
const coresQuadros = [
  ["Azul padrão", COR_QUADROS_PADRAO],
  ["Azul petróleo", "#28566a"],
  ["Verde sálvia", "#b8cbb4"],
  ["Verde menta", "#c3e5d8"],
  ["Rosa", "#efc8d7"],
  ["Lilás", "#dacdef"],
  ["Pêssego", "#f3d1b7"],
  ["Bege", "#e5d6bb"],
  ["Cinza", "#d6dce2"],
  ["Vinho", "#74364e"],
] as const;
const exemplo = { paciente: "Luna", especie: "Canina", raca: "Sem raça definida", tutor: "Marina Exemplo", data: "13/11/2026" };
const identificacaoExemplo = {
  paciente: { nome: exemplo.paciente, especie: exemplo.especie, raca: exemplo.raca, sexo: "Fêmea",
    idade: "4 anos", peso: "11 kg", pelagem: "Caramelo", castrado: "Sim", microchip: "Identificador fictício" },
  tutor: { nome: exemplo.tutor, cpf: "CPF fictício", nascimento: "15/05/1992",
    telefone: "Telefone fictício", endereco: "Rua de Exemplo, 100" },
};
const profissionalExemplo = "Dra. Ana Exemplo · CRMV-MG fictício";
const camposIdentidade = [
  ["nome", "Nome da clínica", 160], ["razaoSocial", "Razão social", 220], ["cnpj", "CNPJ", 40],
  ["crmv", "Registro do estabelecimento no CRMV", 70], ["endereco", "Endereço completo", 350],
  ["municipio", "Município/UF", 120], ["telefone", "Telefone", 70], ["email", "E-mail da clínica", 160],
] as const;
const campos = [
  ["paciente", "Animal"], ["especie", "Espécie"], ["raca", "Raça"], ["tutor", "Responsável"],
  ["clinica", "Clínica"], ["endereco_clinica", "Endereço da clínica"], ["cnpj_clinica", "CNPJ"],
  ["telefone_clinica", "Telefone"], ["email_clinica", "E-mail"], ["data", "Data"],
] as const;

export function PadroesDocumentosClinica({ clinicaId }: { clinicaId: string }) {
  const [dados, setDados] = useState<Awaited<ReturnType<typeof obterModelosDocumentoClinica>> | null>(null);
  const [tipo, setTipo] = useState<TipoModeloDocumento>("receita");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [logoDocumentoPreview, setLogoDocumentoPreview] = useState("");
  const [dadosEditados, setDadosEditados] = useState<Partial<Omit<NonNullable<typeof dados>["identidade"], "logoUrl" | "logoAlternativa">>>({});

  useEffect(() => {
    let ativo = true;
    tokenConfiguracoesClinica()
      .then(accessToken => obterModelosDocumentoClinica({ data: { accessToken, clinicaId } }))
      .then(resposta => {
        if (!ativo) return;
        setDados(resposta);
      })
      .catch((e: Error) => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, [clinicaId]);

  useEffect(() => {
    let ativo = true;
    const modeloSelecionado = dados?.modelos[tipo];
    if (!dados || !modeloSelecionado?.usarLogo) {
      setLogoDocumentoPreview("");
      return () => { ativo = false; };
    }
    void import("@/lib/modelos-documentos-pdf")
      .then(({ prepararLogoDocumento }) => prepararLogoDocumento(
        dados.identidade, true, Boolean(obterTemaDocumentoPremium(modeloSelecionado.fundo)),
      ))
      .then(logo => { if (ativo) setLogoDocumentoPreview(logo); })
      .catch(() => { if (ativo) setLogoDocumentoPreview(""); });
    return () => { ativo = false; };
  }, [dados?.identidade.logoUrl, dados?.identidade.logoAlternativa, dados?.modelos[tipo]?.usarLogo, dados?.modelos[tipo]?.fundo, tipo]);

  if (!dados) return <p className="rounded-xl border bg-card p-4 text-sm" role={erro ? "alert" : "status"}>
    {erro || "Carregando modelos e dados da clínica…"}
  </p>;

  const { modelos } = dados;
  const identidade = { ...dados.identidade, ...dadosEditados };
  const modelo = modelos[tipo];
  const categoria = DOCUMENTOS[tipo];
  const usaTextoPadrao = tipo === "pedido" || tipo === "documento" || tipo === "termo";
  const textoPrevia = tipo === "receita" ? limparOrientacoesPadraoReceita(modelo.texto)
    : usaTextoPadrao ? modelo.texto || categoria.exemplo : "";
  const corpo = preencherTextoDocumento(textoPrevia, valoresModeloDocumento(identidade, exemplo));

  function atualizar(patch: Partial<typeof modelo>) {
    setDados(atual => atual && ({ ...atual, modelos: { ...atual.modelos, [tipo]: { ...atual.modelos[tipo], ...patch } } }));
  }

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    try { await acao(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível concluir."); }
    finally { setOcupado(false); }
  }

  async function trocarLogo(arquivo: File | null) {
    let base64: string | null = null;
    if (arquivo) {
      if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type) || arquivo.size > 5_000_000)
        throw new Error("Escolha uma imagem PNG, JPG ou WebP de até 5 MB.");
      const url = URL.createObjectURL(arquivo);
      try {
        const { carregarLogoDocumento } = await import("@/lib/modelos-documentos-pdf");
        base64 = (await carregarLogoDocumento(url)).split(",")[1];
      } finally { URL.revokeObjectURL(url); }
    }
    const accessToken = await tokenConfiguracoesClinica();
    const identidadeAtualizada = await salvarLogoDocumentoClinica({ data: { accessToken, clinicaId, base64 } });
    setDados(atual => atual && ({ ...atual, identidade: identidadeAtualizada }));
    toast.success(arquivo ? "Logo dos documentos atualizada." : "Logo do cadastro restaurada.");
  }

  return <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold">Modelos e fundos de documentos</h2>
        <p className="mt-1 text-sm text-muted-foreground">Personalize os modelos de documento da {identidade.nome}.</p>
      </div>
      <fieldset disabled={ocupado} className="space-y-4">
        <label className="block max-w-sm text-sm font-semibold">Tipo de documento
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoModeloDocumento)} className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 font-normal">
            {TIPOS_MODELO_DOCUMENTO.map(chave => <option key={chave} value={chave}>{DOCUMENTOS[chave].titulo}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2 border-y py-3">
          <label className="mr-auto flex min-h-10 items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={modelo.usarLogo} onChange={e => atualizar({ usarLogo: e.target.checked })} />
            Mostrar logo neste tipo de documento
          </label>
          <label className={botao + " cursor-pointer"}><ImagePlus size={16} /> Enviar logo dos documentos
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => {
              const arquivo = e.target.files?.[0]; e.target.value = "";
              if (arquivo) void executar(() => trocarLogo(arquivo));
            }} />
          </label>
          {identidade.logoUrl.startsWith("data:") && <button type="button" className={botao}
            onClick={() => void executar(() => trocarLogo(null))}>Usar logo do cadastro</button>}
        </div>
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-semibold">Dados impressos da clínica</summary>
          <p className="mt-2 text-xs text-muted-foreground">Os dados vêm do cadastro. Salve aqui ajustes que devem aparecer apenas nos documentos.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {camposIdentidade.map(([chave, rotulo, max]) => <label key={chave} className="text-sm font-medium">
              {rotulo}
              <input className="mt-1 min-h-10 w-full rounded-lg border bg-background px-2 font-normal" maxLength={max}
                value={identidade[chave]} onChange={e => setDadosEditados(atual => ({ ...atual, [chave]: e.target.value }))} />
            </label>)}
          </div>
          <button type="button" className={botao + " mt-3"} disabled={!Object.keys(dadosEditados).length} onClick={() => void executar(async () => {
            if (!identidade.nome.trim()) throw new Error("Informe o nome da clínica.");
            const accessToken = await tokenConfiguracoesClinica();
            await salvarDadosDocumentoClinica({ data: { accessToken, clinicaId, dados: dadosEditados } });
            setDados(atual => atual && ({ ...atual, identidade }));
            setDadosEditados({});
            toast.success("Dados dos documentos salvos.");
          })}><Save size={16} /> Salvar dados dos documentos</button>
        </details>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Fundo e tema do documento</legend>
          <p className="mb-3 text-xs text-muted-foreground">
            Os temas premium funcionam com a logo e os dados desta clínica. A escolha é independente para cada tipo de documento.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {[["", "Sem fundo"], ...FUNDOS_DOCUMENTOS].map(([id, nome]) => {
              const tema = obterTemaDocumentoPremium(id);
              const centralizado = id === "14";
              const logoMiniatura = logoDocumentoPreview;
              return (
                <button type="button" key={id} aria-pressed={modelo.fundo === id}
                  onClick={() => atualizar({ fundo: id, ...(tema ? { corQuadros: tema.acento } : {}) })}
                  className={`rounded-lg border p-2 text-left text-xs ${modelo.fundo === id ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"}`}>
                  <div className="aspect-[210/297] overflow-hidden rounded border bg-white">
                    {tema ? <div className="relative flex h-full flex-col overflow-hidden p-2" style={{ backgroundColor: tema.papel, color: tema.texto }}>
                      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: tema.acento }} />
                      <div className={`flex min-h-8 items-center gap-1 ${centralizado ? "flex-col justify-center" : ""} ${id === "15" ? "rounded-sm px-1 py-1" : ""}`}
                        style={id === "15" ? { backgroundColor: tema.acento, color: "#ffffff" } : undefined}>
                        {logoMiniatura ? <img src={logoMiniatura} alt="" loading="lazy" className="h-5 max-w-7 object-contain"
                          style={id === "15" ? { backgroundColor: "#ffffff", borderRadius: 3 } : undefined} /> :
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-sm border text-[5px]" style={{ borderColor: tema.acento }}>LOGO</span>}
                        <span className="min-w-0 truncate text-[7px] font-bold">{identidade.nome || "Sua clínica"}</span>
                      </div>
                      <div className={`my-2 font-serif text-[11px] ${centralizado ? "text-center tracking-widest" : ""}`}>
                        {tipo === "receita" ? "Receituário" : DOCUMENTOS[tipo].titulo}
                      </div>
                      <div className="mb-2 h-px" style={{ backgroundColor: tema.acento }} />
                      <div className="grid grid-cols-2 gap-1">
                        {["PACIENTE", "TUTOR"].map(titulo => <div key={titulo} className="rounded-sm border px-1 py-1 text-left"
                          style={{ backgroundColor: tema.quadro, borderColor: tema.borda }}>
                          <div className="mb-1 text-[5px] font-bold" style={{ color: tema.acento }}>{titulo}</div>
                          <div className="space-y-1">{[0,1,2].map(n => <div key={n} className="h-px opacity-30" style={{ backgroundColor: tema.texto, width: `${92 - n * 12}%` }} />)}</div>
                        </div>)}
                      </div>
                      <div className="mt-3 text-[7px] font-bold" style={{ color: tema.acento }}>PRESCRIÇÃO</div>
                      <div className="mt-1 space-y-1">{[0,1,2,3].map(n => <div key={n} className="h-px opacity-20" style={{ backgroundColor: tema.texto, width: `${95 - n * 9}%` }} />)}</div>
                      <div className="mt-auto mx-auto mb-2 h-px w-1/2" style={{ backgroundColor: tema.acento }} />
                    </div> : id && <img src={urlFundoDocumento(id, true)} alt="" width={160} height={227} loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <span className="mt-1.5 block font-medium">{nome}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Cor dos quadros de Paciente e Tutor</legend>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cores predefinidas">
              {coresQuadros.map(([nome, cor]) => (
                <button key={cor} type="button" aria-label={nome} title={nome}
                  aria-pressed={modelo.corQuadros.toLowerCase() === cor}
                  onClick={() => atualizar({ corQuadros: cor })}
                  className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary">
                  <span aria-hidden="true" className="size-7 rounded-md border border-black/15" style={{ backgroundColor: cor }} />
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-medium">
              Personalizada
              <input type="color" value={modelo.corQuadros} onChange={e => atualizar({ corQuadros: e.target.value })}
                className="h-10 w-12 cursor-pointer rounded-lg border bg-background p-1" />
            </label>
          </div>
        </fieldset>
        {usaTextoPadrao && <>
          <label className="block text-sm font-semibold">
            Texto padrão
            <textarea rows={6} maxLength={25000} value={modelo.texto} placeholder={categoria.exemplo}
              onChange={e => atualizar({ texto: e.target.value })} className="mt-1 w-full rounded-lg border bg-background p-3 font-normal" />
          </label>
          <div className="flex flex-wrap gap-1.5" aria-label="Inserir campo do documento">
            {campos.map(([chave, rotulo]) => <button key={chave} type="button" className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              onClick={() => atualizar({ texto: modelo.texto + (modelo.texto ? " " : "") + "{{" + chave + "}}" })}>{rotulo}</button>)}
          </div>
        </>}
        <button type="button" className={botao + " bg-primary text-primary-foreground"} onClick={() => void executar(async () => {
          const accessToken = await tokenConfiguracoesClinica();
          const modeloSalvo = tipo === "receita" ? { ...modelo, texto: limparOrientacoesPadraoReceita(modelo.texto) } : modelo;
          await salvarModeloDocumentoClinica({ data: { accessToken, clinicaId, tipo, modelo: modeloSalvo } });
          atualizar(modeloSalvo);
          toast.success("Padrão salvo para " + categoria.titulo.toLocaleLowerCase("pt-BR") + ".");
        })}><Save size={16} /> {ocupado ? "Processando…" : "Salvar padrão deste tipo"}</button>
      </fieldset>
    {tipo === "orcamento" ? <PreviaOrcamento identidade={identidade} modelo={modelo} logo={logoDocumentoPreview} />
      : <PreviaDocumento identidade={identidade} modelo={modelo} tipo={tipo} corpo={corpo} />}
  </section>;
}

function PreviaOrcamento({ identidade, modelo, logo }: { identidade: IdentidadeDocumento; modelo: ModeloDocumentoPadrao; logo: string }) {
  const tema = obterTemaDocumentoPremium(modelo.fundo);
  const fundoUrl = tema ? "" : urlFundoDocumento(modelo.fundo, true);
  const acento = tema?.acento || "#692b40";
  const quadro = tema?.quadro || modelo.corQuadros;
  return <section className="border-t pt-4" aria-label="Prévia do orçamento">
    <h3 className="mb-3 text-sm font-semibold">Prévia do orçamento</h3>
    <div className="mx-auto aspect-[210/297] w-full max-w-lg overflow-hidden rounded-lg border bg-white p-[6%] shadow-sm" style={{
      backgroundColor: tema?.papel || "#ffffff", color: tema?.texto || "#222222",
      ...(fundoUrl ? { backgroundImage: `url("${fundoUrl}")`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" } : {}),
    }}>
      <div className="h-1.5 w-full" style={{ backgroundColor: acento }} />
      <header className="flex items-center gap-3 border-b py-4">
        {logo && <img src={logo} alt="Logo da clínica" className="h-12 max-w-20 object-contain" />}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold sm:text-base">{identidade.nome || "Sua clínica veterinária"}</p>
          <p className="truncate text-[10px] text-muted-foreground sm:text-xs">{identidade.razaoSocial || identidade.endereco || "Dados da clínica"}</p>
        </div>
      </header>
      <div className="flex items-center justify-between gap-2 py-4 text-[10px] sm:text-xs">
        <div><h4 className="text-sm font-bold tracking-wide sm:text-lg" style={{ color: acento }}>ORÇAMENTO</h4><p>Emissão: {new Date().toLocaleDateString("pt-BR")}</p><p>Validade: 7 dias</p></div>
        <div className="text-right"><p className="font-bold">TUTOR</p><p>Marina Exemplo</p><p className="mt-2 font-bold">ANIMAL</p><p>Luna · Canina</p></div>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-2 text-[9px] font-bold sm:text-xs" style={{ backgroundColor: quadro, color: acento }}><span>DESCRIÇÃO</span><span>QTD.</span><span>TOTAL</span></div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b px-2 py-3 text-[10px] sm:text-xs"><span>Consulta veterinária</span><span>1</span><span>R$ 180,00</span></div>
      <div className="mt-4 text-right text-xs font-bold sm:text-base" style={{ color: acento }}>TOTAL: R$ 180,00</div>
      <p className="mt-10 text-[8px] text-muted-foreground sm:text-[10px]">Documento comercial informativo. Não confirma venda, pagamento ou reserva de estoque.</p>
    </div>
  </section>;
}

async function gerarPrevia(identidade: IdentidadeDocumento, modelo: ModeloDocumentoPadrao, tipo: TipoModeloDocumento, corpo: string) {
  const { prepararPapelDocumento, criarPdfComModelo } = await import("@/lib/modelos-documentos-pdf");
  const papel = await prepararPapelDocumento(identidade, modelo);
  if (tipo === "receita") {
    const { criarReceituario } = await import("@/lib/receituario");
    const { paciente, tutor } = identificacaoExemplo;
    return criarReceituario({
      demonstrativo: true, tipo: "normal", papel, paciente: paciente.nome, tutor: tutor.nome,
      telefoneTutor: tutor.telefone, enderecoTutor: tutor.endereco, cpfTutor: tutor.cpf, nascimentoTutor: tutor.nascimento,
      especie: paciente.especie, raca: paciente.raca, sexo: paciente.sexo, peso: "11", idade: paciente.idade,
      pelagem: paciente.pelagem, castrado: paciente.castrado, microchip: paciente.microchip, data: exemplo.data, endereco: identidade.endereco,
      itens: [{ id: "exemplo", medicamento: "Medicamento fictício", apresentacao: "Apresentação de exemplo",
        quantidade: "", forma: "", intervalo: "", dias: "", observacao: "" }],
      observacoes: "", textoFinalReceita: corpo, profissional: { nomeCompleto: "Dra. Ana Exemplo", crmv: "fictício", crmvUf: "MG" },
      posicoesSelos: {},
    });
  }
  return criarPdfComModelo({
    titulo: DOCUMENTOS[tipo].titulo, conteudo: corpo, papel, demonstrativo: true,
    identificacao: identificacaoExemplo,
    assinatura: [[identidade.municipio, exemplo.data].filter(Boolean).join(", "), profissionalExemplo],
  });
}

function PreviaDocumento({ identidade, modelo, tipo, corpo }: {
  identidade: IdentidadeDocumento; modelo: ModeloDocumentoPadrao; tipo: TipoModeloDocumento; corpo: string;
}) {
  const demoAlvorada = useDemoAlvorada();
  const { nome, razaoSocial, endereco, cnpj, crmv, telefone, email, municipio, logoUrl, logoAlternativa, site } = identidade;
  const { fundo, usarLogo, corQuadros } = modelo;
  const configuracao = useMemo(() => ({
    identidade: { nome, razaoSocial, endereco, cnpj, crmv, telefone, email, municipio, logoUrl, logoAlternativa, site },
    modelo: { fundo, usarLogo, corQuadros, texto: "" }, tipo, corpo,
  }), [nome, razaoSocial, endereco, cnpj, crmv, telefone, email, municipio, logoUrl, logoAlternativa, site, fundo, usarLogo, corQuadros, tipo, corpo]);
  const [resultado, setResultado] = useState<{
    configuracao: typeof configuracao; pdf?: Awaited<ReturnType<typeof gerarPrevia>>; erro?: string;
  } | null>(null);
  useEffect(() => {
    let ativo = true;
    const timer = window.setTimeout(() => {
      void gerarPrevia(configuracao.identidade, configuracao.modelo, configuracao.tipo, configuracao.corpo)
        .then(pdf => { if (ativo) setResultado({ configuracao, pdf }); })
        .catch(erro => { if (ativo) setResultado({ configuracao, erro: erro instanceof Error ? erro.message : "Não foi possível gerar a prévia." }); });
    }, 250);
    return () => { ativo = false; window.clearTimeout(timer); };
  }, [configuracao]);

  const atual = resultado?.configuracao === configuracao ? resultado : null;
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
      <h3 className="text-sm font-semibold">Prévia com os dados da clínica</h3>
      <button type="button" className={botao} disabled={demoAlvorada || !atual?.pdf}
        onClick={() => atual?.pdf?.save("previa-" + tipo + ".pdf")}>
        <Download size={16} /> Baixar prévia em PDF
      </button>
    </div>
    {atual?.erro && <p role="alert" className="text-sm text-destructive">{atual.erro}</p>}
    {!atual && <p role="status" className="text-sm text-muted-foreground">Atualizando prévia…</p>}
    {atual?.pdf && <PaginasPrevia pdf={atual.pdf} />}
  </>;
}

export function PaginasPrevia({ pdf }: { pdf: Awaited<ReturnType<typeof gerarPrevia>> }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const [paginaComErro, setPaginaComErro] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  const paginas = pdf.getNumberOfPages();

  useEffect(() => {
    let ativo = true;
    let tarefa: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    let renderizacao: import("pdfjs-dist").RenderTask | undefined;
    void (async () => {
      const [pdfjs, worker] = await Promise.all([
        import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      if (!ativo) return;
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      tarefa = pdfjs.getDocument({ data: new Uint8Array(pdf.output("arraybuffer")), isEvalSupported: false });
      const doc = await tarefa.promise;
      const folha = await doc.getPage(pagina);
      if (!ativo || !tela.current) return;
      const canvas = tela.current;
      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error("A prévia não está disponível neste navegador.");
      const viewport = folha.getViewport({ scale: 1.7 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderizacao = folha.render({ canvasContext: contexto, viewport });
      await renderizacao.promise;
      if (ativo) setPaginaComErro(null);
    })().catch(() => { if (ativo) setPaginaComErro(pagina); });
    return () => {
      ativo = false;
      renderizacao?.cancel();
      void tarefa?.destroy().catch(() => {});
    };
  }, [pdf, pagina]);

  return <div className="mx-auto w-full max-w-lg">
    {paginaComErro === pagina && <p role="alert" className="mb-2 text-sm text-destructive">A prévia na tela está indisponível. Você pode baixar o PDF acima.</p>}
    <canvas ref={tela} role="img" aria-label={`Prévia demonstrativa, página ${pagina} de ${paginas}`}
      className="aspect-[210/297] h-auto w-full rounded border bg-white shadow-sm" />
    {paginas > 1 && <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <button type="button" className={botao} disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
      <span className="text-sm">{pagina} de {paginas}</span>
      <button type="button" className={botao} disabled={pagina === paginas} onClick={() => setPagina(pagina + 1)}>Próxima</button>
    </div>}
  </div>;
}

import { useEffect, useState } from "react";
import { Download, ImagePlus, Save } from "lucide-react";
import { toast } from "sonner";
import {
  obterModelosDocumentoClinica, salvarDadosDocumentoClinica, salvarLogoDocumentoClinica, salvarModeloDocumentoClinica,
} from "@/lib/configuracoes-clinica.functions";
import { tokenConfiguracoesClinica } from "@/lib/configuracoes-clinica-ui";
import {
  DOCUMENTOS, FUNDOS_DOCUMENTOS, TIPOS_MODELO_DOCUMENTO, preencherTextoDocumento,
  urlFundoDocumento, valoresModeloDocumento, type TipoModeloDocumento,
} from "@/lib/modelos-documentos";

const botao = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50";
const exemplo = { paciente: "Luna", especie: "Canina", raca: "Sem raça definida", tutor: "Marina Exemplo", data: "13/11/2026" };
const identificacaoExemplo = [
  "Animal: Luna · Canina · Sem raça definida · Fêmea · 4 anos · 11 kg",
  "Responsável: Marina Exemplo · CPF fictício · Endereço de exemplo",
];
const assinaturaExemplo = ["Belo Horizonte/MG, 13/11/2026", "Dra. Ana Exemplo · CRMV-MG fictício"];
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
  const [dadosEditados, setDadosEditados] = useState<Partial<Omit<NonNullable<typeof dados>["identidade"], "logoUrl">>>({});

  useEffect(() => {
    let ativo = true;
    tokenConfiguracoesClinica()
      .then(accessToken => obterModelosDocumentoClinica({ data: { accessToken, clinicaId } }))
      .then(resposta => { if (ativo) setDados(resposta); })
      .catch((e: Error) => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, [clinicaId]);

  if (!dados) return <p className="rounded-xl border bg-card p-4 text-sm" role={erro ? "alert" : "status"}>
    {erro || "Carregando modelos e dados da clínica…"}
  </p>;

  const { modelos } = dados;
  const identidade = { ...dados.identidade, ...dadosEditados };
  const modelo = modelos[tipo];
  const categoria = DOCUMENTOS[tipo];
  const fundo = urlFundoDocumento(modelo.fundo);
  const corpo = preencherTextoDocumento(modelo.texto || categoria.exemplo, valoresModeloDocumento(identidade, exemplo));
  const logo = modelo.usarLogo ? identidade.logoUrl : "";

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

  async function baixarPrevia() {
    const { prepararPapelDocumento, criarPdfComModelo } = await import("@/lib/modelos-documentos-pdf");
    const papel = await prepararPapelDocumento(identidade, modelo);
    if (tipo === "receita") {
      const { criarReceituario } = await import("@/lib/receituario");
      const pdf = await criarReceituario({
        demonstrativo: true, tipo: "normal", papel, paciente: exemplo.paciente, tutor: exemplo.tutor,
        telefoneTutor: "Telefone fictício", enderecoTutor: "Endereço de exemplo", cpfTutor: "CPF fictício",
        especie: exemplo.especie, raca: exemplo.raca, sexo: "Fêmea", peso: "11", idade: "4 anos",
        pelagem: "Caramelo", data: exemplo.data, endereco: identidade.endereco,
        itens: [{ id: "exemplo", medicamento: "Medicamento fictício", apresentacao: "Apresentação de exemplo",
          quantidade: "", forma: "", intervalo: "", dias: "", observacao: "" }],
        observacoes: corpo, profissional: { nomeCompleto: "Dra. Ana Exemplo", crmv: "fictício", crmvUf: "MG" },
        posicoesSelos: {},
      });
      pdf.save("previa-receita.pdf");
      return;
    }
    const pdf = await criarPdfComModelo({
      titulo: categoria.titulo, conteudo: corpo, papel, demonstrativo: true,
      identificacao: identificacaoExemplo, assinatura: assinaturaExemplo,
    });
    pdf.save("previa-" + tipo + ".pdf");
  }

  return <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
    <div>
      <h2 className="text-lg font-semibold">Modelos e fundos de documentos</h2>
      <p className="mt-1 text-sm text-muted-foreground">Escolha o fundo e o texto padrão para cada tipo de documento da {identidade.nome}.</p>
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
        <legend className="mb-2 text-sm font-semibold">Fundo do documento</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
          {[["", "Sem fundo"], ...FUNDOS_DOCUMENTOS].map(([id, nome]) => (
            <button type="button" key={id} aria-pressed={modelo.fundo === id} onClick={() => atualizar({ fundo: id })}
              className={`rounded-lg border p-2 text-left text-xs ${modelo.fundo === id ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"}`}>
              <div className="aspect-[210/297] overflow-hidden rounded border bg-white">
                {id && <img src={urlFundoDocumento(id, true)} alt="" width={160} height={227} loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <span className="mt-1.5 block font-medium">{nome}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold">
        {["receita", "vacina", "vermifugo"].includes(tipo) ? "Orientações adicionais padrão" : "Texto padrão"}
        <textarea rows={6} maxLength={25000} value={modelo.texto} placeholder={categoria.exemplo}
          onChange={e => atualizar({ texto: e.target.value })} className="mt-1 w-full rounded-lg border bg-background p-3 font-normal" />
      </label>
      <div className="flex flex-wrap gap-1.5" aria-label="Inserir campo do documento">
        {campos.map(([chave, rotulo]) => <button key={chave} type="button" className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
          onClick={() => atualizar({ texto: modelo.texto + (modelo.texto ? " " : "") + "{{" + chave + "}}" })}>{rotulo}</button>)}
      </div>
      <button type="button" className={botao + " bg-primary text-primary-foreground"} onClick={() => void executar(async () => {
        const accessToken = await tokenConfiguracoesClinica();
        await salvarModeloDocumentoClinica({ data: { accessToken, clinicaId, tipo, modelo } });
        toast.success("Padrão salvo para " + categoria.titulo.toLocaleLowerCase("pt-BR") + ".");
      })}><Save size={16} /> {ocupado ? "Processando…" : "Salvar padrão deste tipo"}</button>
    </fieldset>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
      <h3 className="text-sm font-semibold">Prévia com os dados da clínica</h3>
      <button type="button" className={botao} disabled={ocupado} onClick={() => void executar(baixarPrevia)}>
        <Download size={16} /> Baixar prévia em PDF
      </button>
    </div>
    <div className="mx-auto min-h-[31rem] max-w-lg rounded-lg border bg-white bg-[length:100%_100%] p-[7%] text-[#252328] shadow-sm"
      style={fundo ? { backgroundImage: `url(${fundo})` } : undefined}>
      <article className="min-h-full rounded-md bg-white/80 p-3 sm:p-5">
        <header className="flex items-start gap-3 border-b border-[#ded6da] pb-3">
          {logo && <img src={logo} alt="" className="h-12 w-14 shrink-0 object-contain" />}
          <div className="min-w-0 break-words text-xs">
            <p className="text-base font-bold text-[#612b40]">{identidade.nome}</p>
            {identidade.razaoSocial && identidade.razaoSocial !== identidade.nome && <p>{identidade.razaoSocial}</p>}
            <p>{[identidade.cnpj && `CNPJ ${identidade.cnpj}`, identidade.crmv && `Registro CRMV ${identidade.crmv}`].filter(Boolean).join(" · ")}</p>
            <p>{identidade.endereco}</p>
            <p>{[identidade.telefone, identidade.email].filter(Boolean).join(" · ")}</p>
          </div>
        </header>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-[#612b40]">Prévia demonstrativa · Sem validade</p>
        <h4 className="mb-2 mt-1 text-lg font-bold text-[#612b40]">{categoria.titulo}</h4>
        <p className="text-xs leading-relaxed">{identificacaoExemplo.join(" / ")}</p>
        <p className="my-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{corpo}</p>
        <p className="mt-8 border-t border-[#ded6da] pt-2 text-xs">{assinaturaExemplo.join(" · ")}</p>
      </article>
    </div>
  </section>;
}

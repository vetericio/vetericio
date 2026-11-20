import { useDemoAlvorada } from "@/lib/demo-alvorada-context";
import { AVISO_DEMO_DOCUMENTOS } from "@/lib/demo-alvorada";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, FileDown, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { obterDadosReceituario } from "@/lib/receituario-contexto.functions";
import { obterPerfilPessoa } from "@/lib/admin-users.functions";
import { useAnamneses } from "@/hooks/useAnamneses";
import { lerSelos, type TipoSelo } from "@/lib/assinatura";
import { racasParaEspecie, type EspecieReceituario } from "@/lib/racas";
import { enviarAnexoPortal } from "@/lib/drive.functions";
import { obterModeloDocumentoEmissao } from "@/lib/configuracoes-clinica.functions";
import { formatarDataDocumento, limparOrientacoesPadraoReceita, preencherTextoDocumento, valoresModeloDocumento } from "@/lib/modelos-documentos";
import { hojeNoBrasil } from "@/lib/dados-preventivos";
import type { Database } from "@/integrations/supabase/types";
import { PreviaAssinaturaReceita } from "@/components/PreviaAssinaturaReceita";
import { prepararLogoDocumento, prepararPapelDocumento } from "@/lib/modelos-documentos-pdf";
import {
  criarReceituario,
  FORMAS_MEDICAMENTO,
  INTERVALOS_RECEITUARIO,
  frasePosologia,
  idadePacienteReceituario,
  type DadosReceituario,
  type TipoReceita,
  type ItemReceituario,
  type PosicaoSeloReceituario,
} from "@/lib/receituario";

const campo =
  "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring";
const rotulo = "text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
const escolha =
  "flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary";

const MOTIVOS_OCULTACAO = [
  ["receita_substituida", "Receita substituída"],
  ["receita_cancelada", "Receita cancelada"],
  ["erro_emissao", "Erro de emissão"],
  ["documento_incompleto", "Documento incompleto"],
  ["aguardando_assinatura", "Aguardando assinatura/carimbo"],
  ["uso_interno", "Uso interno da clínica"],
  ["orientacao_veterinario", "Orientação do veterinário"],
  ["solicitacao_tutor", "Solicitação do tutor"],
  ["duplicidade", "Duplicidade"],
  ["necessita_orientacao_presencial", "Necessita orientação presencial"],
  ["outro", "Outro"],
] as const;

const novoItem = (): ItemReceituario => ({
  id: crypto.randomUUID(),
  medicamento: "",
  apresentacao: "",
  quantidade: "",
  forma: "comprimido",
  intervalo: "12",
  dias: "",
  observacao: "",
});

const POSICOES_PADRAO: Record<TipoSelo, PosicaoSeloReceituario> = {
  assinatura: { x: 0.06, y: 0.2, largura: 0.32 },
  carimbo: { x: 0.58, y: 0.14, largura: 0.24 },
};

type AcaoReceita = "download" | "baixar-e-salvar" | "salvar";

type ReceitaGerada = {
  chave: string;
  documento: Awaited<ReturnType<typeof criarReceituario>>;
  salva: boolean;
  registro: Database["public"]["Tables"]["oricse_portal_receitas"]["Insert"] & { id: string };
  nome: string;
};

type PerfilEmissor = Awaited<ReturnType<typeof obterPerfilPessoa>>;

function identificarProfissional(perfil: PerfilEmissor | null, email?: string): DadosReceituario["profissional"] {
  if (!perfil?.nome_completo || !perfil.crmv || !perfil.crmv_uf) return undefined;
  return { nomeCompleto: perfil.nome_completo, crmv: perfil.crmv, crmvUf: perfil.crmv_uf,
    mapa: perfil.mapa, telefone: perfil.telefone, endereco: perfil.endereco, email };
}

function especieDaAnamnese(valor: string): EspecieReceituario {
  if (valor === "Cachorro") return "Canina";
  if (valor === "Gato") return "Felina";
  return "Outro";
}

async function emitirReceitaControladaNoBanco(dados: Record<string, unknown>): Promise<string> {
  const { data, error } = await (supabase as any).rpc("oricse_emitir_receita_controlada", { p_dados: dados });
  if (error || typeof data !== "string") throw new Error(error?.message || "Não foi possível registrar a receita no banco.");
  return data;
}

export function Receituario({
  embutido = false, animalIdInicial, tutorIdInicial, onSalva,
}: {
  embutido?: boolean;
  animalIdInicial?: string;
  tutorIdInicial?: string;
  onSalva?: () => void;
} = {}) {
  const Container = embutido ? "section" : "main";
  const demoAlvorada = useDemoAlvorada();
  const { anamneses } = useAnamneses();
  const racaAreaRef = useRef<HTMLDivElement>(null);
  const [paciente, setPaciente] = useState("");
  const [tutor, setTutor] = useState("");
  const [telefoneTutor, setTelefoneTutor] = useState("");
  const [nascimentoTutor, setNascimentoTutor] = useState("");
  const [cpfTutor, setCpfTutor] = useState("");
  const [enderecoTutor, setEnderecoTutor] = useState("");
  const [idade, setIdade] = useState("");
  const [especie, setEspecie] = useState<EspecieReceituario>("Canina");
  const [outraEspecie, setOutraEspecie] = useState("");
  const [raca, setRaca] = useState("");
  const [buscaRaca, setBuscaRaca] = useState("");
  const [racaAberta, setRacaAberta] = useState(false);
  const [sexo, setSexo] = useState("");
  const [peso, setPeso] = useState("");
  const [data, setData] = useState(() => new Date().toLocaleDateString("pt-BR"));
  const [itens, setItens] = useState<ItemReceituario[]>(() => [novoItem()]);
  const [observacoes, setObservacoes] = useState("");
  const [usarOrientacoesPadrao, setUsarOrientacoesPadrao] = useState(true);
  const [perfilEmissor, setPerfilEmissor] = useState<PerfilEmissor | null>(null);
  const [padraoReceita, setPadraoReceita] = useState<Awaited<ReturnType<typeof obterModeloDocumentoEmissao>> | null>(null);
  const [pelagem, setPelagem] = useState("");
  const [castrado, setCastrado] = useState("Não informado");
  const [microchip, setMicrochip] = useState("");
  const [endereco, setEndereco] = useState("");
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [mensagemDados, setMensagemDados] = useState("");
  const [vinculo, setVinculo] = useState<{ animalId: string; tutorId: string; clinicaId: string } | null>(null);
  const receitaGerada = useRef<ReceitaGerada | null>(null);
  const processando = useRef(false);
  const [erroRegistro, setErroRegistro] = useState("");
  const [selos, setSelos] = useState<Record<TipoSelo, string | null>>({ assinatura: null, carimbo: null });
  const [posicoesSelos, setPosicoesSelos] = useState<Partial<Record<TipoSelo, PosicaoSeloReceituario>>>({});
  const [acaoAtual, setAcaoAtual] = useState<AcaoReceita | null>(null);
  const [tipoReceita, setTipoReceita] = useState<TipoReceita>("normal");
  const [enviarPortal, setEnviarPortal] = useState(true);
  const [motivoOcultacao, setMotivoOcultacao] = useState("");
  const [motivoOutro, setMotivoOutro] = useState("");

  useEffect(() => {
    let ativo = true;
    async function preencher() {
      const params = new URLSearchParams(window.location.search);
      const animalId = animalIdInicial || params.get("animalId") || "";
      const tutorId = tutorIdInicial || params.get("tutorId") || "";
      try {
        const { data: sessao, error: erroSessao } = await supabase.auth.getSession();
        if (erroSessao || !sessao.session?.access_token)
          throw new Error("Sessão não encontrada. Entre novamente para preencher os dados.");

        const consultaPerfil = obterPerfilPessoa({ data: { accessToken: sessao.session.access_token } }).catch(() => null);
        const dados = await obterDadosReceituario({
          data: {
            accessToken: sessao.session.access_token,
            ...(animalId ? { animalId } : {}),
            ...(tutorId ? { tutorId } : {}),
          },
        });
        if (!ativo) return;
        setPelagem(dados.animal?.pelagem || "");
        setCastrado(dados.animal?.castrado || "Não informado");
        setMicrochip(dados.animal?.microchip || "");
        if (dados.animal && dados.tutor && dados.clinicaId) {
          setVinculo({ animalId: dados.animal.id, tutorId: dados.tutor.id, clinicaId: dados.clinicaId });
        }
        if (dados.clinicaEndereco) setEndereco(dados.clinicaEndereco);
        if (dados.animal) {
          const animal = dados.animal;
          setPaciente(animal.nome || "");
          setPeso(animal.peso ? animal.peso.replace(".", ",") : "");
          setSexo(animal.sexo || "");
          setRaca(animal.raca || "");
          setIdade(idadePacienteReceituario(animal.nascimento || "", animal.idade || "", hojeNoBrasil()));
          const especieSalva = String(animal.especie || "").toLocaleLowerCase("pt-BR");
          if (especieSalva.includes("gat") || especieSalva.includes("fel")) {
            setEspecie("Felina");
            setOutraEspecie("");
          } else if (especieSalva.includes("cão") || especieSalva.includes("cao") || especieSalva.includes("cach") || especieSalva.includes("can")) {
            setEspecie("Canina");
            setOutraEspecie("");
          } else if (especieSalva) {
            setEspecie("Outro");
            setOutraEspecie(animal.especie);
          }
        }
        setNascimentoTutor(formatarDataDocumento(dados.tutor?.nascimento));
        if (dados.tutor) {
          setTutor(dados.tutor.nome || "");
          setTelefoneTutor(dados.tutor.telefone || "");
          setCpfTutor(dados.tutor.cpf || "");
          setEnderecoTutor(dados.tutor.endereco || "");
        }
        if (!dados.clinicaEndereco) {
          setMensagemDados("Endereço da clínica não encontrado no cadastro. Confira e preencha antes de gerar o PDF.");
        } else if (animalId || tutorId) {
          setMensagemDados("Dados do atendimento e endereço cadastrado da clínica carregados. Confira antes de emitir.");
        } else {
          setMensagemDados("Endereço cadastrado da clínica carregado.");
        }
        if (dados.clinicaId) {
          const padrao = await obterModeloDocumentoEmissao({ data: {
            accessToken: sessao.session.access_token, clinicaId: dados.clinicaId, tipo: "receita",
          } });
          if (ativo) {
            setPadraoReceita(padrao);
            if (padrao.identidade.endereco) setEndereco(padrao.identidade.endereco);
          }
        }
        const perfil = await consultaPerfil;
        if (ativo) setPerfilEmissor(perfil);
      } catch (error) {
        if (ativo) {
          setMensagemDados(error instanceof Error ? error.message : "Não foi possível preencher os dados do atendimento.");
          toast.error("Preenchimento automático indisponível. Confira os dados antes de emitir.");
        }
      } finally {
        if (ativo) setCarregandoDados(false);
      }
    }
    void preencher();
    return () => { ativo = false; };
  }, [animalIdInicial, tutorIdInicial]);

  useEffect(() => {
    let pedido = 0;
    const atualizar = async () => {
      const atual = ++pedido;
      try {
        const selosDoPerfil = await lerSelos();
        if (pedido === atual) setSelos(selosDoPerfil);
      } catch (error) {
        if (pedido === atual) {
          setSelos({ assinatura: null, carimbo: null });
          toast.error(error instanceof Error ? error.message : "Não foi possível carregar as imagens do perfil.");
        }
      }
    };
    void atualizar();
    window.addEventListener("veterico-selos", atualizar);
    return () => {
      pedido++;
      window.removeEventListener("veterico-selos", atualizar);
    };
  }, []);

  useEffect(() => {
    if (!racaAberta) return;
    const fecharAoClicarFora = (evento: PointerEvent) => {
      if (!racaAreaRef.current?.contains(evento.target as Node)) setRacaAberta(false);
    };
    document.addEventListener("pointerdown", fecharAoClicarFora);
    return () => document.removeEventListener("pointerdown", fecharAoClicarFora);
  }, [racaAberta]);

  const escolherPaciente = (id: string) => {
    const anamnese = anamneses.find((item) => item.id === id);
    if (!anamnese) return;
    setPaciente(anamnese.animal);
    setEspecie(especieDaAnamnese(anamnese.especie));
    setOutraEspecie("");
    setPeso(anamnese.peso);
  };

  const mudarEspecie = (nova: EspecieReceituario) => {
    setEspecie(nova);
    if (nova !== "Outro") setOutraEspecie("");
    setRaca("");
    setBuscaRaca("");
    setRacaAberta(false);
  };

  const atualizarItem = <K extends Exclude<keyof ItemReceituario, "id">>(
    id: string, campoItem: K, valor: ItemReceituario[K],
  ) => setItens((atual) => atual.map((item) => (item.id === id ? { ...item, [campoItem]: valor } : item)));

  const adicionarSelo = (tipo: TipoSelo) => {
    if (!selos[tipo]) {
      const artigo = tipo === "assinatura" ? "a assinatura" : "o carimbo";
      toast.error("Cadastre primeiro " + artigo + " em Assinar um documento.");
      return;
    }
    setPosicoesSelos((atual) => ({ ...atual, [tipo]: atual[tipo] ?? POSICOES_PADRAO[tipo] }));
  };

  const rodapePrevia = useMemo(() => ({
    tipo: tipoReceita,
    data,
    endereco,
    profissional: identificarProfissional(perfilEmissor, padraoReceita?.identidade.email),
    papel: tipoReceita === "normal" && padraoReceita
      ? { clinica: padraoReceita.identidade, fundo: null, logo: "" }
      : undefined,
  }), [tipoReceita, data, endereco, perfilEmissor, padraoReceita]);

  async function registrarReceita({ registro, nome, documento }: ReceitaGerada, accessToken: string) {
    const anexo = await enviarAnexoPortal({ data: {
      accessToken, clinicaId: registro.clinica_id, animalId: registro.animal_id, registroId: registro.id,
      categoria: "receitas", tutorId: registro.tutor_id, nome, base64: documento.output("datauristring"),
    } });
    const { error } = await supabaseBanco.from("oricse_portal_receitas").upsert({
      ...registro, drive_arquivo_id: anexo.arquivoId,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error("O PDF foi anexado, mas o prontuário ainda não foi atualizado.");
  }

  const orientacoesPadrao = tipoReceita === "normal" && padraoReceita
    ? preencherTextoDocumento(limparOrientacoesPadraoReceita(padraoReceita.modelo.texto), valoresModeloDocumento(padraoReceita.identidade, {
        paciente, especie: especie === "Outro" ? outraEspecie : especie, raca, tutor, data,
      }))
    : "";

  const gerar = async (acao: AcaoReceita) => {
    if (demoAlvorada) return void toast.info(AVISO_DEMO_DOCUMENTOS);
    if (processando.current || carregandoDados || !vinculo) return;
    if (!paciente.trim()) return void toast.error("Informe o nome do paciente.");
    if (!endereco.trim()) return void toast.error("Confirme o endereço da clínica para o rodapé do receituário.");
    if (!telefoneTutor.trim()) return void toast.error("Informe o telefone do tutor.");
    if (!itens.some((item) => item.medicamento.trim())) return void toast.error("Informe ao menos um medicamento.");
    if (itens.some((item) => item.medicamento.trim() && item.intervalo === "outro" && !item.intervaloOutro?.trim())) {
      return void toast.error("Digite o intervalo dos medicamentos marcados como Outro.");
    }
    if (!especie) return void toast.error("Selecione a espécie.");
    if (especie === "Outro" && !outraEspecie.trim()) return void toast.error("Informe a outra espécie.");
    if (tipoReceita === "especial" && (!tutor.trim() || !enderecoTutor.trim() || !cpfTutor.trim())) return void toast.error("Receita de controle especial exige tutor, CPF/CNPJ e endereço do tutor.");
    if (!enviarPortal && !motivoOcultacao) return void toast.error("Selecione o motivo para não enviar a receita ao Portal do Tutor.");
    if (!enviarPortal && motivoOcultacao === "outro" && motivoOutro.trim().length < 3) return void toast.error("Explique o motivo em pelo menos 3 caracteres.");
    const textoPadraoSelecionado = usarOrientacoesPadrao ? orientacoesPadrao : "";
    if (/\{\{[a-z_]+\}\}/.test(textoPadraoSelecionado)) {
      return void toast.error("Revise as orientações padrão nas Configurações da clínica ou desmarque sua inclusão nesta receita.");
    }
    const textoFinal = [observacoes.trim(), textoPadraoSelecionado].filter(Boolean).join("\n\n");
    const dadosEmissao = {
      paciente, tutor, telefoneTutor, nascimentoTutor, cpfTutor, enderecoTutor, idade, especie, outraEspecie,
      raca, sexo, peso, data, itens, observacoes: textoFinal, endereco, pelagem, castrado, microchip,
    };
    const chave = JSON.stringify([
      vinculo, tipoReceita, dadosEmissao, selos, posicoesSelos, enviarPortal, motivoOcultacao, motivoOutro,
    ]);
    processando.current = true;
    setAcaoAtual(acao);
    setErroRegistro("");
    try {
      let receita = receitaGerada.current;
      if (receita?.chave !== chave || !receita.salva) {
        const { data: sessaoPerfil } = await supabase.auth.getSession();
        const token = sessaoPerfil.session?.access_token;
        if (!token) throw new Error("Entre novamente para salvar a receita.");
        if (receita?.chave !== chave) {
          const perfil = perfilEmissor ?? await obterPerfilPessoa({ data: { accessToken: token } });
          const profissional = identificarProfissional(perfil, padraoReceita?.identidade.email);
          if (!profissional) {
            throw new Error("Cadastre nome completo, CRMV e UF no cadastro pessoal antes de emitir receitas.");
          }
          if (!perfilEmissor) setPerfilEmissor(perfil);
          const especial = tipoReceita === "especial";
          const papel = !especial && padraoReceita
            ? await prepararPapelDocumento({ ...padraoReceita.identidade, endereco }, padraoReceita.modelo)
            : undefined;
          const logoClinica = especial && padraoReceita
            ? await prepararLogoDocumento(padraoReceita.identidade, padraoReceita.modelo.usarLogo)
            : undefined;
          const numero = especial ? await emitirReceitaControladaNoBanco(dadosEmissao) : undefined;
          const dadosPdf = {
            ...dadosEmissao, tipo: tipoReceita, numero, profissional,
            especie: especie === "Outro" ? outraEspecie.trim() : especie, posicoesSelos, selos, papel,
            logoClinica, nomeClinica: padraoReceita?.identidade.nome,
          };
          const documento = await criarReceituario(dadosPdf);
          const pacienteArquivo = paciente.trim().replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 120).toLowerCase();
          const titulo = especial ? "Receita de controle especial" : "Receita veterinária";
          const nome = `${especial ? "receita-controle-especial" : "receituario"}-${pacienteArquivo || "oricse"}.pdf`;
          receita = {
            chave, documento, nome, salva: false,
            registro: {
              id: crypto.randomUUID(), clinica_id: vinculo.clinicaId, animal_id: vinculo.animalId,
              tutor_id: vinculo.tutorId, tipo: tipoReceita, numero: numero || null, titulo,
              emitida_em: hojeNoBrasil(), resumo: itens.map(item => item.medicamento.trim()).filter(Boolean).join(", ") || null,
              visivel_tutor: enviarPortal, motivo_ocultacao: enviarPortal ? null : motivoOcultacao,
              motivo_outro: !enviarPortal && motivoOcultacao === "outro" ? motivoOutro.trim() : null,
            },
          };
          receitaGerada.current = receita;
        }
        await registrarReceita(receita, token);
        receita.salva = true;
        onSalva?.();
        toast.success(receita.registro.visivel_tutor
          ? "Receita salva no prontuário e disponível no Portal do Tutor."
          : "Receita salva no prontuário com acesso interno.");
      }
      if (acao !== "salvar") receita.documento.save(receita.nome);
    } catch (erro) {
      setErroRegistro(erro instanceof Error ? erro.message : "Não foi possível concluir a emissão da receita.");
    } finally {
      processando.current = false;
      setAcaoAtual(null);
    }
  };

  const racas = racasParaEspecie(especie);
  const termoBuscaRaca = buscaRaca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const racasFiltradas = racas.filter((opcao) => opcao.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(termoBuscaRaca));
  const escolherRaca = (opcao: string) => { setRaca(opcao); setBuscaRaca(""); setRacaAberta(false); };

  return (
    <Container className={embutido ? "mx-auto w-full max-w-3xl space-y-4 py-2 pb-5" : "mx-auto w-full max-w-3xl space-y-4 px-4 py-5 pb-28"}>
      {!embutido && <section>
        <h1 className="font-display text-xl font-semibold text-foreground">Receituário</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preencha somente o necessário e a receita sai completa.</p>
      </section>}

      {erroRegistro && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        {erroRegistro}
      </p>}
      <fieldset disabled={Boolean(acaoAtual)} className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-display font-semibold text-foreground">Tipo de receita</h2>
          <div className="mt-3 flex gap-2">
            {([ ["normal", "Normal"], ["especial", "Controle especial"] ] as const).map(([valor, nome]) => (
              <label key={valor} className={escolha}><input type="radio" name="tipo-receita" className="sr-only" checked={tipoReceita === valor} onChange={() => setTipoReceita(valor)} />{nome}</label>
            ))}
          </div>
          {tipoReceita === "especial" && <p className="mt-2 text-xs text-muted-foreground">Sai com número sequencial (ano) e exige tutor, CPF/CNPJ e endereço do tutor.</p>}
        </section>

        {vinculo ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-display font-semibold text-foreground">Portal do Tutor</h2><p className="mt-1 text-sm text-muted-foreground">Toda receita é salva no prontuário. Marque para liberar o PDF ao tutor deste animal.</p></div>
            <input type="checkbox" checked={enviarPortal} onChange={(e) => { setEnviarPortal(e.target.checked); if (e.target.checked) { setMotivoOcultacao(""); setMotivoOutro(""); } }} className="h-5 w-5 accent-primary" aria-label="Enviar para o Portal do Tutor" />
          </div>
          <div className={`mt-3 rounded-xl border p-3 ${enviarPortal ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <strong className="text-sm">Enviar para o Portal do Tutor: {enviarPortal ? "Sim" : "Não"}</strong>
            {!enviarPortal && <div className="mt-3 space-y-3"><label className="block"><span className={rotulo}>Motivo obrigatório</span><select value={motivoOcultacao} onChange={(e) => { setMotivoOcultacao(e.target.value); if (e.target.value !== "outro") setMotivoOutro(""); }} className={campo}><option value="">Selecione o motivo</option>{MOTIVOS_OCULTACAO.map(([valor,nome]) => <option key={valor} value={valor}>{nome}</option>)}</select></label>{motivoOcultacao === "outro" && <label className="block"><span className={rotulo}>Explique o motivo</span><textarea value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} rows={3} className={campo} placeholder="Descreva por que esta receita não deve aparecer no portal" /></label>}</div>}
          </div>
        </section>
        ) : !carregandoDados && (
          <p className="rounded-xl border bg-card p-4 text-sm">
            Selecione o paciente na <a href="/animais" className="font-semibold text-primary underline">lista de animais</a> e abra o receituário pela ficha dele.
          </p>
        )}

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-display font-semibold text-foreground">Paciente</h2>
          {(carregandoDados || mensagemDados) && <p role="status" className="mt-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-foreground">{carregandoDados ? "Buscando os dados do atendimento e da clínica..." : mensagemDados}</p>}
          {!vinculo && anamneses.length > 0 && <label className="mt-3 block"><span className={rotulo}>Puxar da Anamnese</span><select defaultValue="" onChange={(e) => escolherPaciente(e.target.value)} className={campo}><option value="">Preencher manualmente</option>{anamneses.map((item) => <option key={item.id} value={item.id}>{item.animal} {item.especie ? "· " + item.especie : ""}</option>)}</select></label>}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label><span className={rotulo}>Paciente</span><input readOnly={Boolean(vinculo)} value={paciente} onChange={(e) => setPaciente(e.target.value)} className={campo} placeholder="Nome do animal" /></label>
            <label><span className={rotulo}>Tutor</span><input readOnly={Boolean(vinculo)} value={tutor} onChange={(e) => { setTutor(e.target.value); setNascimentoTutor(""); }} className={campo} placeholder="Nome do responsável" /></label>
            <label><span className={rotulo}>Telefone do tutor</span><input type="tel" inputMode="tel" required value={telefoneTutor} onChange={(e) => setTelefoneTutor(e.target.value)} className={campo} placeholder="(31) 99999-9999" /></label>
          </div>
          <fieldset className="mt-4"><legend className={rotulo}>Espécie</legend><div className="mt-2 grid grid-cols-3 gap-2">{(["Canina", "Felina", "Outro"] as const).map((opcao) => <label key={opcao} className={escolha}><input type="radio" name="especie-receituario" checked={especie === opcao} onChange={() => mudarEspecie(opcao)} className="accent-primary" />{opcao}</label>)}</div></fieldset>
          {especie === "Outro" && <label className="mt-3 block"><span className={rotulo}>Qual espécie?</span><input value={outraEspecie} onChange={(e) => setOutraEspecie(e.target.value)} className={campo} placeholder="Ex.: Equina" /></label>}
          <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.7fr_0.55fr]">
            <div><span className={rotulo}>Raça</span><div ref={racaAreaRef} className="relative" onBlur={(evento) => { if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setRacaAberta(false); }}><div className="relative"><input value={racaAberta ? buscaRaca : raca} onChange={(evento) => { setBuscaRaca(evento.target.value); setRaca(evento.target.value); setRacaAberta(true); }} onFocus={() => { setBuscaRaca(""); setRacaAberta(true); }} onKeyDown={(evento) => { if (evento.key === "Escape") setRacaAberta(false); const primeiraRaca = racasFiltradas[0]; if (evento.key === "Enter" && primeiraRaca) { evento.preventDefault(); escolherRaca(primeiraRaca); } }} role="combobox" aria-label="Raça do animal" aria-expanded={racaAberta} aria-controls="lista-racas-receituario" aria-autocomplete="list" autoComplete="off" className={campo + " pr-11"} placeholder="Toque para ver as raças ou digite para buscar" /><button type="button" aria-label={racaAberta ? "Fechar lista de raças" : "Mostrar todas as raças"} aria-expanded={racaAberta} onPointerDown={(evento) => evento.preventDefault()} onClick={() => { setBuscaRaca(""); setRacaAberta((aberta) => !aberta); }} className="absolute inset-y-0 right-1 my-1 flex w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"><ChevronDown className="h-4 w-4" /></button></div>{racaAberta && <div id="lista-racas-receituario" role="listbox" aria-label="Raças disponíveis" className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"><p className="px-3 py-2 text-xs text-muted-foreground">{racasFiltradas.length ? racasFiltradas.length + " resultados" : "Nenhuma raça encontrada"}</p>{racasFiltradas.map((opcao) => <button key={opcao} type="button" role="option" aria-selected={raca === opcao} onPointerDown={(evento) => evento.preventDefault()} onClick={() => escolherRaca(opcao)} className={"block min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary " + (raca === opcao ? "bg-primary/10 font-semibold text-primary" : "")}>{opcao}</button>)}</div>}</div></div>
            <fieldset><legend className={rotulo}>Sexo</legend><div className="mt-1 flex gap-2">{["Macho", "Fêmea"].map((opcao) => <label key={opcao} className={escolha}><input type="radio" name="sexo-receituario" checked={sexo === opcao} onChange={() => setSexo(opcao)} className="accent-primary" />{opcao}</label>)}</div></fieldset>
            <label><span className={rotulo}>Peso</span><input value={peso} onChange={(e) => setPeso(e.target.value.replace(".", ","))} inputMode="decimal" className={campo} placeholder="kg" /></label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3"><label><span className={rotulo}>CPF/CNPJ do tutor</span><input value={cpfTutor} onChange={(e) => setCpfTutor(e.target.value)} className={campo} placeholder="Documento" /></label><label><span className={rotulo}>Idade do paciente</span><input value={idade} onChange={(e) => setIdade(e.target.value)} className={campo} placeholder="Ex.: 8 meses ou 5 anos" /></label><label><span className={rotulo}>Endereço do tutor</span><input value={enderecoTutor} onChange={(e) => setEnderecoTutor(e.target.value)} className={campo} placeholder="Endereço completo" /></label></div>
          {tipoReceita === "normal" && <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label><span className={rotulo}>Pelagem ou plumagem</span><input value={pelagem} onChange={e => setPelagem(e.target.value)} className={campo} maxLength={100} /></label>
            <label><span className={rotulo}>Castrado</span><select value={castrado} onChange={e => setCastrado(e.target.value)} className={campo}><option>Não informado</option><option>Sim</option><option>Não</option></select></label>
            <label><span className={rotulo}>Microchip</span><input value={microchip} onChange={e => setMicrochip(e.target.value)} className={campo} maxLength={45} /></label>
          </div>}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-display font-semibold text-foreground">Prescrição</h2>
          <div className="mt-3 space-y-3">
            {itens.map((item, indice) => (
              <article key={item.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{indice + 1}. Medicamento</p>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItens((atual) => atual.filter((medicamento) => medicamento.id !== item.id))}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                      aria-label={"Remover medicamento " + (indice + 1)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_0.48fr]">
                  <label><span className={rotulo}>Medicamento</span><input value={item.medicamento} onChange={(e) => atualizarItem(item.id, "medicamento", e.target.value)} className={campo} placeholder="Nome do medicamento" /></label>
                  <label><span className={rotulo}>Apresentação</span><input value={item.apresentacao} onChange={(e) => atualizarItem(item.id, "apresentacao", e.target.value)} className={campo} placeholder="Ex.: 500 mg" /></label>
                </div>
                <p className={"mt-4 " + rotulo}>Posologia</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label><span className="text-xs text-muted-foreground">Quantidade</span><input value={item.quantidade} onChange={(e) => atualizarItem(item.id, "quantidade", e.target.value)} inputMode="decimal" className={campo} placeholder="1" /></label>
                  <label>
                    <span className="text-xs text-muted-foreground">Forma</span>
                    <select value={item.forma} onChange={(e) => atualizarItem(item.id, "forma", e.target.value)} className={campo}>
                      {FORMAS_MEDICAMENTO.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.valor}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs text-muted-foreground">Intervalo</span>
                    <select value={item.intervalo} onChange={(e) => atualizarItem(item.id, "intervalo", e.target.value)} className={campo}>
                      {INTERVALOS_RECEITUARIO.map((horas) => <option key={horas} value={horas}>{"a cada " + horas + "h"}</option>)}
                      <option value="outro">Outro</option>
                    </select>
                  </label>
                  <label><span className="text-xs text-muted-foreground">Por quantos dias?</span><input value={item.dias} onChange={(e) => atualizarItem(item.id, "dias", e.target.value)} inputMode="numeric" className={campo} placeholder="7" /></label>
                  {item.intervalo === "outro" && (
                    <label className="col-span-full">
                      <span className="text-xs font-medium text-foreground">Digite o intervalo</span>
                      <input value={item.intervaloOutro ?? ""} onChange={(e) => atualizarItem(item.id, "intervaloOutro", e.target.value)}
                        className={campo} placeholder="Escreva o intervalo como deve aparecer na receita" />
                    </label>
                  )}
                </div>
                <div className="mt-3 rounded-xl bg-primary/5 p-3">
                  <label className="block">
                    <span className="text-xs font-medium text-foreground">Frase da posologia no PDF</span>
                    <textarea value={item.posologiaEditada ?? frasePosologia(item)} onChange={(e) => atualizarItem(item.id, "posologiaEditada", e.target.value)}
                      rows={2} className={campo} placeholder="Preencha os campos ou escreva a frase." />
                  </label>
                  {item.posologiaEditada !== undefined && (
                    <button type="button" onClick={() => atualizarItem(item.id, "posologiaEditada", undefined)}
                      className="mt-1 text-xs font-semibold text-primary underline underline-offset-2">
                      Voltar ao texto automático
                    </button>
                  )}
                </div>
                <label className="mt-3 block"><span className="text-xs text-muted-foreground">Observação desta medicação (opcional)</span><input value={item.observacao} onChange={(e) => atualizarItem(item.id, "observacao", e.target.value)} className={campo} placeholder="Ex.: administrar após alimentação" /></label>
              </article>
            ))}
          </div>
          <button type="button" onClick={() => setItens((atual) => [...atual, novoItem()])}
            className="mt-3 inline-flex min-h-10 items-center gap-1 rounded-xl bg-secondary px-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70">
            <Plus className="h-4 w-4" /> Adicionar medicamento
          </button>
          {orientacoesPadrao && <div className="mt-4 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={usarOrientacoesPadrao} onChange={e => setUsarOrientacoesPadrao(e.target.checked)} />
              Incluir as orientações padrão da clínica
            </label>
            {usarOrientacoesPadrao && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{orientacoesPadrao}</p>}
          </div>}
          <label className="mt-4 block"><span className={rotulo}>Orientações gerais</span><textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} className={campo} placeholder="Orientações adicionais para o tutor (opcional)" /></label>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-display font-semibold text-foreground">Assinatura e carimbo</h2><p className="mt-1 text-sm text-muted-foreground">Adicione e arraste para definir onde cada um ficará no final da receita.</p>
          {carregandoDados ? <p className="mt-3 text-xs text-muted-foreground">Carregando os dados do rodapé.</p> : (
            <PreviaAssinaturaReceita dados={rodapePrevia} selos={selos} posicoes={posicoesSelos} setPosicoes={setPosicoesSelos} />
          )}
          <div className="mt-3 flex flex-wrap gap-2">{(["assinatura", "carimbo"] as TipoSelo[]).map((tipo) => <button key={tipo} type="button" onClick={() => adicionarSelo(tipo)} className="rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70">{tipo === "assinatura" ? "+ Assinatura" : "+ Carimbo"}</button>)}</div>
          {!selos.assinatura && !selos.carimbo && <p className="mt-2 text-xs text-muted-foreground">Cadastre a assinatura e o carimbo em Assinar um documento.</p>}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h2 className="font-display font-semibold text-foreground">Final da receita</h2><div className="mt-3 grid gap-3 sm:grid-cols-[0.7fr_1.3fr]"><label><span className={rotulo}>Data</span><input value={data} onChange={(e) => setData(e.target.value)} className={campo} placeholder="dd/mm/aaaa" /></label><label><span className={rotulo}>Endereço da clínica</span><textarea value={endereco} onChange={(e) => setEndereco(e.target.value)} rows={2} className={campo} placeholder="Endereço cadastrado da clínica" /></label></div><p className="mt-2 text-xs text-muted-foreground">A data e o endereço da clínica aparecem no rodapé do PDF. O endereço pessoal do profissional não é utilizado.</p></section>

      </fieldset>
      {vinculo && !demoAlvorada && <div className={embutido ? "mt-4 grid w-full grid-cols-[1fr_1.45fr_1fr] gap-1.5 rounded-2xl border bg-card p-1.5 shadow-sm sm:gap-2 sm:p-2" : "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto grid max-w-3xl grid-cols-[1fr_1.45fr_1fr] gap-1.5 rounded-2xl border bg-card p-1.5 shadow-lg sm:gap-2 sm:p-2"}>
        {([
          ["download", "Download", Download],
          ["baixar-e-salvar", "Download e salvar", FileDown],
          ["salvar", "Salvar", Save],
        ] as const).map(([acao, rotuloAcao, Icone]) => (
          <button key={acao} type="button" onClick={() => void gerar(acao)} disabled={Boolean(acaoAtual) || carregandoDados}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold disabled:opacity-60 sm:gap-2 sm:px-3 sm:text-sm ${acao === "salvar" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border hover:bg-muted"}`}>
            <Icone className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />
            {acaoAtual === acao ? "Salvando…" : rotuloAcao}
          </button>
        ))}
      </div>}

    </Container>
  );
}

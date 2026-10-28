import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileDown, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { obterPerfilPessoa } from "@/lib/admin-users.functions";
import { useAnamneses } from "@/hooks/useAnamneses";
import { lerSelo, type TipoSelo } from "@/lib/assinatura";
import { racasParaEspecie, type EspecieReceituario } from "@/lib/racas";
import { enviarArquivoDrive } from "@/lib/drive.functions";
import {
  criarReceituario,
  ENDERECO_RECEITUARIO,
  FORMAS_MEDICAMENTO,
  INTERVALOS_RECEITUARIO,
  montarPosologia,
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

type CampoItem =
  "medicamento" | "apresentacao" | "quantidade" | "forma" | "intervalo" | "dias" | "observacao";

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

export function Receituario() {
  const { anamneses } = useAnamneses();
  const areaSelosRef = useRef<HTMLDivElement>(null);
  const racaAreaRef = useRef<HTMLDivElement>(null);
  const [paciente, setPaciente] = useState("");
  const [tutor, setTutor] = useState("");
  const [telefoneTutor, setTelefoneTutor] = useState("");
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
  const [endereco, setEndereco] = useState(ENDERECO_RECEITUARIO);
  const [selos, setSelos] = useState<Record<TipoSelo, string | null>>({ assinatura: null, carimbo: null });
  const [posicoesSelos, setPosicoesSelos] = useState<Partial<Record<TipoSelo, PosicaoSeloReceituario>>>({});
  const [gerando, setGerando] = useState(false);
  const [tipoReceita, setTipoReceita] = useState<TipoReceita>("normal");
  const [enviarPortal, setEnviarPortal] = useState(true);
  const [motivoOcultacao, setMotivoOcultacao] = useState("");
  const [motivoOutro, setMotivoOutro] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const animalId = params.get("animalId") || "";
    const tutorId = params.get("tutorId") || "";
    if (!animalId && !tutorId) return;
    try {
      const animais = JSON.parse(oricseStorage.getItem("oricse-animais-v1") || "[]") as any[];
      const tutores = JSON.parse(oricseStorage.getItem("oricse-tutores-v1") || "[]") as any[];
      const animal = animais.find((item) => String(item.id) === animalId);
      const tutorEncontrado = tutores.find((item) => String(item.id) === (tutorId || animal?.tutorId));
      if (animal) {
        setPaciente(animal.nome || ""); setPeso(animal.peso || ""); setSexo(animal.sexo || ""); setRaca(animal.raca || ""); setIdade(animal.idade || animal.nascimento || "");
        const esp = String(animal.especie || "").toLowerCase();
        setEspecie(esp.includes("gato") || esp.includes("fel") ? "Felina" : esp.includes("cão") || esp.includes("cach") || esp.includes("can") ? "Canina" : "Outro");
      }
      if (tutorEncontrado) {
        setTutor(tutorEncontrado.nome || ""); setTelefoneTutor(tutorEncontrado.telefone || tutorEncontrado.celular || ""); setCpfTutor(tutorEncontrado.cpfCnpj || tutorEncontrado.cpf || tutorEncontrado.cnpj || "");
        setEnderecoTutor([tutorEncontrado.endereco, tutorEncontrado.numero, tutorEncontrado.bairro, tutorEncontrado.cidade, tutorEncontrado.uf].filter(Boolean).join(", "));
      }
    } catch { /* mantém preenchimento manual */ }
  }, []);

  useEffect(() => {
    const atualizar = () => setSelos({ assinatura: lerSelo("assinatura"), carimbo: lerSelo("carimbo") });
    atualizar();
    window.addEventListener("veterico-selos", atualizar);
    window.addEventListener("storage", atualizar);
    return () => { window.removeEventListener("veterico-selos", atualizar); window.removeEventListener("storage", atualizar); };
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

  const atualizarItem = (id: string, campoItem: CampoItem, valor: string) =>
    setItens((atual) => atual.map((item) => (item.id === id ? { ...item, [campoItem]: valor } : item)));

  const adicionarSelo = (tipo: TipoSelo) => {
    if (!selos[tipo]) {
      const artigo = tipo === "assinatura" ? "a assinatura" : "o carimbo";
      toast.error("Cadastre primeiro " + artigo + " em Assinar um documento.");
      return;
    }
    setPosicoesSelos((atual) => ({ ...atual, [tipo]: atual[tipo] ?? POSICOES_PADRAO[tipo] }));
  };

  const iniciarGestoSelo = (evento: React.PointerEvent, tipo: TipoSelo, modo: "mover" | "tamanho") => {
    evento.preventDefault();
    evento.stopPropagation();
    const area = areaSelosRef.current;
    const inicial = posicoesSelos[tipo];
    if (!area || !inicial) return;
    const caixa = area.getBoundingClientRect();
    const xInicial = evento.clientX;
    const yInicial = evento.clientY;
    const alvo = evento.currentTarget as HTMLElement;
    alvo.setPointerCapture(evento.pointerId);
    const mover = (movimento: PointerEvent) => {
      const dx = (movimento.clientX - xInicial) / caixa.width;
      const dy = (movimento.clientY - yInicial) / caixa.height;
      setPosicoesSelos((atual) => {
        const item = atual[tipo] ?? inicial;
        if (modo === "tamanho") {
          const largura = Math.min(0.7, Math.max(0.12, inicial.largura + dx));
          return { ...atual, [tipo]: { ...item, largura, x: Math.min(item.x, 1 - largura) } };
        }
        return { ...atual, [tipo]: { ...item, x: Math.min(1 - item.largura, Math.max(0, inicial.x + dx)), y: Math.min(0.72, Math.max(0, inicial.y + dy)) } };
      });
    };
    const soltar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  async function publicarNoPortal(doc: Awaited<ReturnType<typeof criarReceituario>>, numero?: string) {
    const params = new URLSearchParams(window.location.search);
    const animalId = params.get("animalId") || "";
    const tutorId = params.get("tutorId") || "";
    if (!animalId || !tutorId) {
      toast.info("PDF gerado. Esta receita não foi vinculada ao Portal do Tutor porque não há animal/tutor canônico na URL.");
      return;
    }
    const { data: sessao } = await supabase.auth.getSession();
    const accessToken = sessao.session?.access_token;
    const userId = sessao.session?.user?.id;
    if (!accessToken || !userId) throw new Error("Sessão não encontrada para publicar a receita.");
    const { data: contexto, error: contextoError } = await (supabase as any).rpc("oricse_contexto_clinica_atual");
    if (contextoError) throw contextoError;
    const clinicaId = String(contexto?.[0]?.clinica_id || "");
    if (!clinicaId) throw new Error("Clínica atual não identificada.");
    const { data: animalCanonico, error: animalError } = await (supabase as any)
      .from("oricse_animais").select("id,tutor_id,nome").eq("id", animalId).eq("clinica_id", clinicaId).maybeSingle();
    if (animalError) throw animalError;
    if (!animalCanonico || String(animalCanonico.tutor_id) !== tutorId) {
      toast.info("PDF gerado. A receita não foi publicada porque o animal/tutor ainda não está vinculado ao banco desta clínica.");
      return;
    }
    const nomeSeguro = paciente.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "animal";
    const nomeArquivo = `${tipoReceita === "especial" ? "receita-especial" : "receita"}-${nomeSeguro}-${Date.now()}.pdf`;
    const base64 = doc.output("datauristring");
    const upload = await enviarArquivoDrive({
      data: {
        accessToken,
        clinicaId,
        categoria: "receitas",
        nome: nomeArquivo,
        mimeType: "application/pdf",
        base64,
        visibilidade: enviarPortal ? "tutor" : "interno",
        entidadeTipo: "receita",
        entidadeId: animalId,
        metadata: { animalId, tutorId, paciente, tutor, tipoReceita, numero: numero || null },
      },
    });
    const dados = { paciente, tutor, telefoneTutor, cpfTutor, enderecoTutor, idade, especie, outraEspecie, raca, sexo, peso, data, itens, observacoes, endereco };
    const { error } = await (supabase as any).from("oricse_portal_receitas").insert({
      clinica_id: clinicaId,
      tutor_id: tutorId,
      animal_id: animalId,
      drive_arquivo_id: upload.arquivo.id,
      tipo: tipoReceita,
      numero: numero || null,
      titulo: tipoReceita === "especial" ? "Receita de controle especial" : "Receita veterinária",
      emitida_em: new Date().toISOString(),
      visivel_tutor: enviarPortal,
      motivo_ocultacao: enviarPortal ? null : motivoOcultacao,
      motivo_outro: !enviarPortal && motivoOcultacao === "outro" ? motivoOutro.trim() : null,
      dados,
      criado_por: userId,
    });
    if (error) throw error;
  }

  const gerar = async () => {
    if (gerando) return;
    if (!paciente.trim()) return void toast.error("Informe o nome do paciente.");
    if (!telefoneTutor.trim()) return void toast.error("Informe o telefone do tutor.");
    if (!itens.some((item) => item.medicamento.trim())) return void toast.error("Informe ao menos um medicamento.");
    if (!especie) return void toast.error("Selecione a espécie.");
    if (especie === "Outro" && !outraEspecie.trim()) return void toast.error("Informe a outra espécie.");
    if (tipoReceita === "especial" && (!tutor.trim() || !enderecoTutor.trim() || !cpfTutor.trim())) return void toast.error("Receita de controle especial exige tutor, CPF/CNPJ e endereço do tutor.");
    if (!enviarPortal && !motivoOcultacao) return void toast.error("Selecione o motivo para não enviar a receita ao Portal do Tutor.");
    if (!enviarPortal && motivoOcultacao === "outro" && motivoOutro.trim().length < 3) return void toast.error("Explique o motivo em pelo menos 3 caracteres.");
    setGerando(true);
    try {
      // Os dados do prescritor vêm sempre da conta autenticada, não de outro usuário.
      const { data: sessaoPerfil } = await supabase.auth.getSession();
      const token = sessaoPerfil.session?.access_token;
      if (!token) throw new Error("Entre novamente para identificar o profissional.");
      const profissional = await obterPerfilPessoa({ data: { accessToken: token } });
      if (!profissional?.nome_completo || !profissional.crmv || !profissional.crmv_uf) {
        throw new Error("Cadastre nome completo, CRMV e UF no cadastro pessoal antes de emitir receitas.");
      }
      const especial = tipoReceita === "especial";
      const numero = especial ? await emitirReceitaControladaNoBanco({ paciente, tutor, telefoneTutor, cpfTutor, enderecoTutor, idade, especie, outraEspecie, raca, sexo, peso, data, itens, observacoes, endereco }) : undefined;
      const dadosPdf = {
        tipo: tipoReceita, numero, paciente, tutor, telefoneTutor, cpfTutor, enderecoTutor, idade,
        especie: especie === "Outro" ? outraEspecie.trim() : especie, raca, sexo, peso, data, itens,
        observacoes, endereco, posicoesSelos,
        profissional: {
          nomeCompleto: profissional.nome_completo,
          crmv: profissional.crmv, crmvUf: profissional.crmv_uf,
          mapa: profissional.mapa, telefone: profissional.telefone, endereco: profissional.endereco,
        },
      };
      const doc = await criarReceituario(dadosPdf);
      const pacienteArquivo = paciente.trim().replace(/\s+/g, "-").toLowerCase();
      doc.save(`${tipoReceita === "especial" ? "receita-controle-especial" : "receituario"}-${pacienteArquivo || "oricse"}.pdf`);
      try {
        await publicarNoPortal(doc, numero);
        toast.success(enviarPortal ? "Receituário gerado e enviado ao Portal do Tutor." : "Receituário gerado e mantido oculto do Portal do Tutor.");
      } catch (portalError) {
        console.error("Falha ao publicar receita no portal:", portalError);
        toast.warning("PDF gerado, mas não foi possível registrar esta receita no Portal do Tutor.");
      }
    } catch (erro) {
      console.error("Falha ao gerar receituário:", erro);
      toast.error(erro instanceof Error ? erro.message : "Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };

  const racas = racasParaEspecie(especie);
  const termoBuscaRaca = buscaRaca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const racasFiltradas = racas.filter((opcao) => opcao.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(termoBuscaRaca));
  const escolherRaca = (opcao: string) => { setRaca(opcao); setBuscaRaca(""); setRacaAberta(false); };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 pb-28">
      <section>
        <h1 className="font-display text-xl font-semibold text-foreground">Receituário</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preencha somente o necessário e a receita sai completa.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-display font-semibold text-foreground">Tipo de receita</h2>
        <div className="mt-3 flex gap-2">
          {([ ["normal", "Normal"], ["especial", "Controle especial"] ] as const).map(([valor, nome]) => (
            <label key={valor} className={escolha}><input type="radio" name="tipo-receita" className="sr-only" checked={tipoReceita === valor} onChange={() => setTipoReceita(valor)} />{nome}</label>
          ))}
        </div>
        {tipoReceita === "especial" && <p className="mt-2 text-xs text-muted-foreground">Sai com número sequencial (ano) e exige tutor, CPF/CNPJ e endereço do tutor.</p>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-display font-semibold text-foreground">Portal do Tutor</h2><p className="mt-1 text-sm text-muted-foreground">Por padrão, toda receita vinculada a um animal é disponibilizada ao tutor.</p></div>
          <input type="checkbox" checked={enviarPortal} onChange={(e) => { setEnviarPortal(e.target.checked); if (e.target.checked) { setMotivoOcultacao(""); setMotivoOutro(""); } }} className="h-5 w-5 accent-primary" aria-label="Enviar para o Portal do Tutor" />
        </div>
        <div className={`mt-3 rounded-xl border p-3 ${enviarPortal ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <strong className="text-sm">Enviar para o Portal do Tutor: {enviarPortal ? "Sim" : "Não"}</strong>
          {!enviarPortal && <div className="mt-3 space-y-3"><label className="block"><span className={rotulo}>Motivo obrigatório</span><select value={motivoOcultacao} onChange={(e) => { setMotivoOcultacao(e.target.value); if (e.target.value !== "outro") setMotivoOutro(""); }} className={campo}><option value="">Selecione o motivo</option>{MOTIVOS_OCULTACAO.map(([valor,nome]) => <option key={valor} value={valor}>{nome}</option>)}</select></label>{motivoOcultacao === "outro" && <label className="block"><span className={rotulo}>Explique o motivo</span><textarea value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} rows={3} className={campo} placeholder="Descreva por que esta receita não deve aparecer no portal" /></label>}</div>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-display font-semibold text-foreground">Paciente</h2>
        {anamneses.length > 0 && <label className="mt-3 block"><span className={rotulo}>Puxar da Anamnese</span><select defaultValue="" onChange={(e) => escolherPaciente(e.target.value)} className={campo}><option value="">Preencher manualmente</option>{anamneses.map((item) => <option key={item.id} value={item.id}>{item.animal} {item.especie ? "· " + item.especie : ""}</option>)}</select></label>}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label><span className={rotulo}>Paciente</span><input value={paciente} onChange={(e) => setPaciente(e.target.value)} className={campo} placeholder="Nome do animal" /></label>
          <label><span className={rotulo}>Tutor</span><input value={tutor} onChange={(e) => setTutor(e.target.value)} className={campo} placeholder="Nome do responsável" /></label>
          <label><span className={rotulo}>Telefone do tutor</span><input type="tel" inputMode="tel" required value={telefoneTutor} onChange={(e) => setTelefoneTutor(e.target.value)} className={campo} placeholder="(31) 99999-9999" /></label>
        </div>
        <fieldset className="mt-4"><legend className={rotulo}>Espécie</legend><div className="mt-2 grid grid-cols-3 gap-2">{(["Canina", "Felina", "Outro"] as const).map((opcao) => <label key={opcao} className={escolha}><input type="radio" name="especie-receituario" checked={especie === opcao} onChange={() => mudarEspecie(opcao)} className="accent-primary" />{opcao}</label>)}</div></fieldset>
        {especie === "Outro" && <label className="mt-3 block"><span className={rotulo}>Qual espécie?</span><input value={outraEspecie} onChange={(e) => setOutraEspecie(e.target.value)} className={campo} placeholder="Ex.: Equina" /></label>}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.7fr_0.55fr]">
          <div><span className={rotulo}>Raça</span><div ref={racaAreaRef} className="relative" onBlur={(evento) => { if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setRacaAberta(false); }}><div className="relative"><input value={racaAberta ? buscaRaca : raca} onChange={(evento) => { setBuscaRaca(evento.target.value); setRaca(evento.target.value); setRacaAberta(true); }} onFocus={() => { setBuscaRaca(""); setRacaAberta(true); }} onKeyDown={(evento) => { if (evento.key === "Escape") setRacaAberta(false); const primeiraRaca = racasFiltradas[0]; if (evento.key === "Enter" && primeiraRaca) { evento.preventDefault(); escolherRaca(primeiraRaca); } }} role="combobox" aria-label="Raça do animal" aria-expanded={racaAberta} aria-controls="lista-racas-receituario" aria-autocomplete="list" autoComplete="off" className={campo + " pr-11"} placeholder="Toque para ver as raças ou digite para buscar" /><button type="button" aria-label={racaAberta ? "Fechar lista de raças" : "Mostrar todas as raças"} aria-expanded={racaAberta} onPointerDown={(evento) => evento.preventDefault()} onClick={() => { setBuscaRaca(""); setRacaAberta((aberta) => !aberta); }} className="absolute inset-y-0 right-1 my-1 flex w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"><ChevronDown className="h-4 w-4" /></button></div>{racaAberta && <div id="lista-racas-receituario" role="listbox" aria-label="Raças disponíveis" className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"><p className="px-3 py-2 text-xs text-muted-foreground">{racasFiltradas.length ? racasFiltradas.length + " resultados" : "Nenhuma raça encontrada"}</p>{racasFiltradas.map((opcao) => <button key={opcao} type="button" role="option" aria-selected={raca === opcao} onPointerDown={(evento) => evento.preventDefault()} onClick={() => escolherRaca(opcao)} className={"block min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary " + (raca === opcao ? "bg-primary/10 font-semibold text-primary" : "")}>{opcao}</button>)}</div>}</div></div>
          <fieldset><legend className={rotulo}>Sexo</legend><div className="mt-1 flex gap-2">{["Macho", "Fêmea"].map((opcao) => <label key={opcao} className={escolha}><input type="radio" name="sexo-receituario" checked={sexo === opcao} onChange={() => setSexo(opcao)} className="accent-primary" />{opcao}</label>)}</div></fieldset>
          <label><span className={rotulo}>Peso</span><input value={peso} onChange={(e) => setPeso(e.target.value.replace(".", ","))} inputMode="decimal" className={campo} placeholder="kg" /></label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3"><label><span className={rotulo}>CPF/CNPJ do tutor</span><input value={cpfTutor} onChange={(e) => setCpfTutor(e.target.value)} className={campo} placeholder="Documento" /></label><label><span className={rotulo}>Idade do paciente</span><input value={idade} onChange={(e) => setIdade(e.target.value)} className={campo} placeholder="Ex.: 5 anos" /></label><label><span className={rotulo}>Endereço do tutor</span><input value={enderecoTutor} onChange={(e) => setEnderecoTutor(e.target.value)} className={campo} placeholder="Endereço completo" /></label></div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h2 className="font-display font-semibold text-foreground">Prescrição</h2><button type="button" onClick={() => setItens((atual) => [...atual, novoItem()])} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-secondary px-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"><Plus className="h-4 w-4" /> Medicamento</button></div>
        <div className="mt-3 space-y-3">{itens.map((item, indice) => { const posologia = montarPosologia(item); return <article key={item.id} className="rounded-xl border border-border p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-foreground">{indice + 1}. Medicamento</p>{itens.length > 1 && <button type="button" onClick={() => setItens((atual) => atual.filter((medicamento) => medicamento.id !== item.id))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive" aria-label={"Remover medicamento " + (indice + 1)}><Trash2 className="h-4 w-4" /></button>}</div><div className="mt-2 grid gap-2 sm:grid-cols-[1fr_0.48fr]"><label><span className={rotulo}>Medicamento</span><input value={item.medicamento} onChange={(e) => atualizarItem(item.id, "medicamento", e.target.value)} className={campo} placeholder="Dipirona" /></label><label><span className={rotulo}>Apresentação</span><input value={item.apresentacao} onChange={(e) => atualizarItem(item.id, "apresentacao", e.target.value)} className={campo} placeholder="500 mg" /></label></div><p className={"mt-4 " + rotulo}>Posologia</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><label><span className="text-xs text-muted-foreground">Quantidade</span><input value={item.quantidade} onChange={(e) => atualizarItem(item.id, "quantidade", e.target.value)} inputMode="decimal" className={campo} placeholder="1" /></label><label><span className="text-xs text-muted-foreground">Forma</span><select value={item.forma} onChange={(e) => atualizarItem(item.id, "forma", e.target.value)} className={campo}>{FORMAS_MEDICAMENTO.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.valor}</option>)}</select></label><label><span className="text-xs text-muted-foreground">Intervalo</span><select value={item.intervalo} onChange={(e) => atualizarItem(item.id, "intervalo", e.target.value)} className={campo}>{INTERVALOS_RECEITUARIO.map((horas) => <option key={horas} value={horas}>{"a cada " + horas + "h"}</option>)}</select></label><label><span className="text-xs text-muted-foreground">Por quantos dias?</span><input value={item.dias} onChange={(e) => atualizarItem(item.id, "dias", e.target.value)} inputMode="numeric" className={campo} placeholder="7" /></label></div><div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm leading-relaxed text-primary">{posologia || "A frase da posologia aparece aqui enquanto você preenche."}</div><label className="mt-3 block"><span className="text-xs text-muted-foreground">Observação desta medicação (opcional)</span><input value={item.observacao} onChange={(e) => atualizarItem(item.id, "observacao", e.target.value)} className={campo} placeholder="Ex.: administrar após alimentação" /></label></article>; })}</div>
        <label className="mt-4 block"><span className={rotulo}>Orientações gerais</span><textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} className={campo} placeholder="Orientações adicionais para o tutor (opcional)" /></label>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-display font-semibold text-foreground">Assinatura e carimbo</h2><p className="mt-1 text-sm text-muted-foreground">Adicione e arraste para definir onde cada um ficará no final da receita.</p>
        <div ref={areaSelosRef} className="relative mt-3 aspect-[595/150] touch-none select-none overflow-hidden rounded-xl border border-dashed border-primary/50 bg-white"><p className="absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Área de assinatura e carimbo</p>{(["assinatura", "carimbo"] as TipoSelo[]).map((tipo) => { const posicao = posicoesSelos[tipo]; const selo = selos[tipo]; if (!posicao || !selo) return null; return <div key={tipo} onPointerDown={(e) => iniciarGestoSelo(e, tipo, "mover")} className="absolute cursor-move rounded border border-dashed border-primary bg-white/40 p-0.5 shadow-sm" style={{ left: String(posicao.x * 100) + "%", top: String(posicao.y * 100) + "%", width: String(posicao.largura * 100) + "%" }}><img src={selo} alt={tipo === "assinatura" ? "Assinatura" : "Carimbo"} className="pointer-events-none max-h-16 w-full object-contain" /><button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setPosicoesSelos((atual) => { const proximo = { ...atual }; delete proximo[tipo]; return proximo; })} className="absolute -left-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground" aria-label={"Remover " + tipo}><X className="h-3 w-3" /></button><span onPointerDown={(e) => iniciarGestoSelo(e, tipo, "tamanho")} className="absolute -bottom-2 -right-2 h-5 w-5 cursor-se-resize rounded-full border border-background bg-primary" aria-label={"Ajustar tamanho de " + tipo} /></div>; })}</div>
        <div className="mt-3 flex flex-wrap gap-2">{(["assinatura", "carimbo"] as TipoSelo[]).map((tipo) => <button key={tipo} type="button" onClick={() => adicionarSelo(tipo)} className="rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70">{tipo === "assinatura" ? "+ Assinatura" : "+ Carimbo"}</button>)}</div>
        {!selos.assinatura && !selos.carimbo && <p className="mt-2 text-xs text-muted-foreground">Cadastre a assinatura e o carimbo em Assinar um documento.</p>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h2 className="font-display font-semibold text-foreground">Final da receita</h2><div className="mt-3 grid gap-3 sm:grid-cols-[0.7fr_1.3fr]"><label><span className={rotulo}>Data</span><input value={data} onChange={(e) => setData(e.target.value)} className={campo} placeholder="dd/mm/aaaa" /></label><label><span className={rotulo}>Endereço</span><textarea value={endereco} onChange={(e) => setEndereco(e.target.value)} rows={2} className={campo} placeholder="Endereço que aparecerá no final da folha" /></label></div><p className="mt-2 text-xs text-muted-foreground">A data aparece somente no final do PDF.</p></section>

      <button type="button" onClick={() => void gerar()} disabled={gerando} className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex min-h-14 w-auto max-w-3xl items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-60"><FileDown className="h-5 w-5" />{gerando ? "Gerando PDF…" : "Gerar receituário em PDF"}</button>
    </main>
  );
}

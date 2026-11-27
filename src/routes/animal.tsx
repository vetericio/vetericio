import { permissoesDaRota, usePermissoes } from "@/hooks/usePermissoes";
import { useDemoAlvorada } from "@/lib/demo-alvorada-context";
import { AVISO_DEMO_DOCUMENTOS } from "@/lib/demo-alvorada";
import { idAnimalDaFicha, mostrarEnderecoDaFichaNoHost, slugEnderecoFichaAnimal } from "@/lib/endereco-ficha-animal";
import { urlPortalDoTutor } from "@/lib/portal-tutor-url";
import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  ClipboardList,
  FileText,
  FileUp,
  Eye,
  Download,
  Trash2,
  FlaskConical,
  Image,
  ExternalLink,
  ShieldCheck,
  Pencil,
  Plus,
  ReceiptText,
  Scale,
  Scissors,
  Stethoscope,
  Syringe,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FotoAnimalDrive } from "@/components/animal/FotoAnimalDrive";
import { ComandaAtendimento } from "@/components/ComandaAtendimento";
import { baixarDocumentoPortal } from "@/lib/portal-document.functions";
import { PaginasArquivoPdf } from "@/components/PaginasArquivoPdf";
import { obterStatusTermosPaciente } from "@/lib/status-termos-paciente.functions";
import { consultarExclusaoRt, excluirTermoOuReceitaRt } from "@/lib/exclusao-documentos-rt.functions";
import { AgendamentosAnimal } from "@/components/animal/AgendamentosAnimal";
import { DocumentoPreventivo } from "@/components/animal/DocumentoPreventivo";
import { obterMomentoLocalAplicacao } from "@/lib/documento-preventivo.functions";
import { obterAutorClinico } from "@/lib/perfil-clinico";
import { camposPreventivos, dataDoRotulo, dataPreventivaBR, fimDaValidade, hojeNoBrasil, normalizarCamposPreventivos, pendenciasPreventivo, selecaoPreventivos, vacinasPredefinidas, type CamposPreventivos, type TipoPreventivo } from "@/lib/dados-preventivos";
import { ObservacoesAnimal } from "@/components/animal/ObservacoesAnimal";
import { TermosDoPaciente } from "@/components/animal/TermosDoPaciente";
import { codigoPublicoTutor } from "@/lib/codigo-tutor";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { enviarAnexoPortal } from "@/lib/drive.functions";
import { PORTAL_PDF_MAX_BYTES } from "@/lib/drive-storage";
import { registrarRetornoClinico } from "@/lib/crm-retornos.functions";
import { calcularDataRetorno, formatarDataRetorno, OPCOES_DIAS_RETORNO } from "@/lib/crm-prazos-retorno";

import { ehRegistroConsulta, resumirConsulta } from "@/lib/resumo-consulta";

export const Route = createFileRoute("/animal")({ component: FichaAnimalLegada });

type Tutor = {
  id: string;
  nome: string;
  telefone?: string;
  outroTelefone?: string;
  email?: string;
  cpfCnpj?: string;
  codigoPublico?: string;
  codigo?: string;
};
type Animal = {
  id: string;
  tutorId: string;
  nome: string;
  nascimento?: string;
  especie?: string;
  raca?: string;
  sexo?: string;
  cor?: string;
  pelagem?: string;
  porte?: string;
  peso?: string;
  escoreCorporal?: string;
  castrado?: string;
  microchip?: string;
  temperamentos?: string[];
  comportamento?: string;
  origem?: string;
  chegadaTutor?: string;
  tipoSanguineo?: string;
  alergias?: string;
  doencasCronicas?: string;
  medicamentosContinuos?: string;
  dieta?: string;
  restricoes?: string;
  necessidadesEspeciais?: string;
  veterinarioReferencia?: string;
  alerta?: string;
  observacoes?: string;
  criadoEm?: string;
};
type RegistroTipo =
  | "Registros clínicos"
  | "Vacinas"
  | "Vermífugos"
  | "Receitas"
  | "Exames"
  | "Agendamentos"
  | "Internações"
  | "Termos"
  | "Observações"
  | "Documentos"
  | "Galeria";
type FontePortal = "vacina" | "vermifugo" | "exame" | "documento" | "receita";
type Registro = {
  id: string;
  animalId: string;
  tipo: RegistroTipo;
  titulo: string;
  detalhe?: string;
  data: string;
  criadoEm: string;
  subtipo?: string;
  dados?: unknown;
  status?: string;
  autorId?: string;
  autorNome?: string;
  autorCrmv?: string;
  atualizadoEm?: string;
  visivelTutor?: boolean;
  fontePortal?: FontePortal;
  motivoOcultacao?: string | null;
  driveArquivoId?: string | null;
  preventivo?: { tipo: TipoPreventivo; linha: VacinaPortal | VermifugoPortal };
};
type PesoRegistro = { id: string; animalId: string; peso: number; data: string; criadoEm: string };
type VacinaPortal = import("@/integrations/supabase/types").Database["public"]["Tables"]["oricse_portal_vacinas"]["Row"];
type VermifugoPortal = import("@/integrations/supabase/types").Database["public"]["Tables"]["oricse_portal_vermifugos"]["Row"];
type ExamePortal = {
  id: string;
  animal_id: string;
  titulo: string;
  tipo: string;
  realizado_em: string | null;
  resultado_resumo: string | null;
  drive_arquivo_id: string | null;
  visivel_tutor: boolean;
  created_at: string;
};
type DocumentoPortal = {
  id: string;
  animal_id: string;
  titulo: string;
  tipo: string;
  data_documento: string | null;
  observacoes: string | null;
  drive_arquivo_id: string | null;
  visivel_tutor: boolean;
  created_at: string;
};
type ReceitaPortal = {
  id: string;
  animal_id: string;
  tipo: string;
  numero: string | null;
  titulo: string;
  emitida_em: string;
  visivel_tutor: boolean;
  motivo_ocultacao: string | null;
  motivo_outro: string | null;
  drive_arquivo_id: string | null;
  created_at: string;
};

const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";
const PRONTUARIO_KEY = "oricse-prontuario-animal-v1";
const PESOS_KEY = "oricse-pesos-animal-v1";
const ABAS = [
  "Visão geral",
  "Registros clínicos",
  "Vacinas",
  "Vermífugos",
  "Receitas",
  "Exames",
  "Agendamentos",
  "Internações",
  "Termos",
  "Observações",
  "Documentos",
  "Galeria",
] as const;
type Aba = (typeof ABAS)[number];

function ler<T>(chave: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const valor = JSON.parse(oricseStorage.getItem(chave) || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}
function idade(nascimento?: string) {
  if (!nascimento) return "Não informada";
  const n = new Date(`${nascimento}T12:00:00`);
  if (Number.isNaN(n.getTime())) return "Não informada";
  const hoje = new Date();
  let anos = hoje.getFullYear() - n.getFullYear();
  let meses = hoje.getMonth() - n.getMonth();
  if (hoje.getDate() < n.getDate()) meses--;
  if (meses < 0) {
    anos--;
    meses += 12;
  }
  if (anos <= 0) return `${Math.max(0, meses)} meses`;
  return meses ? `${anos}a ${meses}m` : `${anos} anos`;
}
function formatarData(data?: string) {
  if (!data) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR").format(new Date(`${data.slice(0, 10)}T12:00:00`));
  } catch {
    return data;
  }
}
function numeroPeso(valor?: string) {
  if (!valor) return NaN;
  const texto = String(valor).trim();
  return Number(texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto);
}
function formatarPeso(valor?: number | string) {
  const n = typeof valor === "number" ? valor : numeroPeso(valor);
  if (!Number.isFinite(n)) return "não informado";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
}
function pesoPorDigitacao(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  return digitos ? (Number(digitos) / 1000).toFixed(3) : "";
}
function pesoParaCampo(valor: string) {
  const n = Number(valor);
  return Number.isFinite(n) ? n.toFixed(3).replace(".", ",") : "";
}
function iconFor(tipo: Aba) {
  if (tipo === "Vacinas" || tipo === "Vermífugos") return Syringe;
  if (tipo === "Receitas") return ReceiptText;
  if (tipo === "Exames") return FlaskConical;
  if (tipo === "Agendamentos") return CalendarDays;
  if (tipo === "Internações") return BedDouble;
  if (tipo === "Documentos" || tipo === "Termos") return FileText;
  if (tipo === "Galeria") return Image;
  return ClipboardList;
}
function arquivoParaDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o PDF."));
    reader.readAsDataURL(file);
  });
}
function rotuloMotivo(codigo?: string | null) {
  const mapa: Record<string, string> = {
    receita_substituida: "Receita substituída",
    receita_cancelada: "Receita cancelada",
    erro_emissao: "Erro de emissão",
    documento_incompleto: "Documento incompleto",
    aguardando_assinatura: "Aguardando assinatura/carimbo",
    uso_interno: "Uso interno da clínica",
    orientacao_veterinario: "Orientação do veterinário",
    solicitacao_tutor: "Solicitação do tutor",
    duplicidade: "Duplicidade",
    necessita_orientacao_presencial: "Necessita orientação presencial",
    outro: "Outro",
  };
  return codigo ? mapa[codigo] || codigo : "";
}

const CAMPOS_VACINA = `id,animal_id,nome,aplicada_em,reforco_em,lote,observacoes,visivel_tutor,created_at,alvo_vacinacao,${selecaoPreventivos}` as const;
const CAMPOS_VERMIFUGO = `id,animal_id,nome,administrado_em,proxima_dose_em,lote,observacoes,visivel_tutor,created_at,principio_ativo,via,${selecaoPreventivos}` as const;

function registroPreventivo(linha: VacinaPortal | VermifugoPortal): Registro {
  const vacina = "aplicada_em" in linha;
  const retorno = vacina ? linha.reforco_em : linha.proxima_dose_em;
  const data = vacina ? linha.aplicada_em : linha.administrado_em;
  const validade = dataDoRotulo(linha.validade || "");
  return {
    id: linha.id, animalId: linha.animal_id, tipo: vacina ? "Vacinas" : "Vermífugos", titulo: linha.nome,
    detalhe: [
      linha.observacoes,
      linha.dose && `Dose: ${linha.dose}`,
      linha.hora_aplicacao && `Horário: ${linha.hora_aplicacao.slice(0, 5)}`,
      linha.local_aplicacao && `Local: ${linha.local_aplicacao}`,
      linha.fabricante && `Fabricante: ${linha.fabricante}`,
      linha.lote && `Lote: ${linha.lote}`,
      linha.fabricacao && `Fabricação: ${dataPreventivaBR(linha.fabricacao)}`,
      validade && `Validade: ${dataPreventivaBR(validade)}`,
      data && validade && data > fimDaValidade(validade) && "A data registrada é posterior à validade do produto.",
      linha.veterinario_nome && `Responsável: ${linha.veterinario_nome} · CRMV-${linha.veterinario_uf || ""} ${linha.veterinario_crmv || ""}`,
      retorno && `${vacina ? "Reforço" : "Próxima dose"}: ${formatarData(retorno)}`,
    ].filter(Boolean).join("\n"),
    data: data || "", criadoEm: linha.created_at, visivelTutor: linha.visivel_tutor,
    fontePortal: vacina ? "vacina" : "vermifugo",
    preventivo: { tipo: vacina ? "vacina" : "vermifugo", linha },
  };
}

function FichaAnimalLegada() {
  const busca = useSearch({ strict: false }) as { animalId?: unknown };
  return <AnimalFicha key={typeof busca.animalId === "string" ? busca.animalId : ""} atualizarEndereco />;
}

async function slugDaClinicaDaFicha(clinicaId: string, signal?: AbortSignal) {
  const consulta = supabaseBanco.from("clinicas").select("slug").eq("id", clinicaId);
  const { data, error } = await (signal ? consulta.abortSignal(signal) : consulta).maybeSingle();
  return error ? null : slugEnderecoFichaAnimal(data?.slug);
}

// A URL organiza a navegação; a autorização continua no banco. Nunca monta
// a ficha nem muda a clínica ativa enquanto o endereço não corresponder à clínica do animal.
export function FichaAnimalPorClinica({ slugClinica }: { slugClinica: string }) {
  const busca = useSearch({ strict: false }) as { animalId?: unknown };
  const animalId = idAnimalDaFicha(busca.animalId);
  const { carregando, clinicaId: clinicaAtiva, podeAlguma } = usePermissoes();
  const podeAbrirFicha = !carregando && Boolean(clinicaAtiva) && podeAlguma(permissoesDaRota("/animal") || []);
  const [resultado, setResultado] = useState<{ animalId: string; clinicaId: string | null } | null>(null);

  useEffect(() => {
    if (!animalId || !podeAbrirFicha) return;
    let ativo = true;
    void (async () => {
      try {
        const [resolucao, contexto] = await Promise.all([
          (supabaseBanco as any).rpc("oricse_resolver_clinica_cadastro_animal", { p_animal: animalId }),
          supabaseBanco.rpc("oricse_contexto_clinica_atual"),
        ]);
        const id = resolucao.data;
        if (resolucao.error || !id || contexto.error || contexto.data?.[0]?.clinica_id !== id ||
          id !== clinicaAtiva || await slugDaClinicaDaFicha(id) !== slugClinica) {
          if (ativo) setResultado({ animalId, clinicaId: null });
          return;
        }
        if (ativo) setResultado({ animalId, clinicaId: id });
      } catch {
        if (ativo) setResultado({ animalId, clinicaId: null });
      }
    })();
    return () => { ativo = false; };
  }, [animalId, clinicaAtiva, podeAbrirFicha, slugClinica]);

  if (!carregando && (!podeAbrirFicha || !animalId || (resultado?.animalId === animalId && !resultado.clinicaId))) {
    return (
      <main className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-black">Ficha não encontrada neste endereço</h1>
        <p className="mt-2 text-sm text-muted-foreground">Confira o link ou abra a ficha pela lista de animais.</p>
        <Link to="/animais" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Voltar à lista de animais
        </Link>
      </main>
    );
  }
  if (carregando || !resultado || resultado.animalId !== animalId || resultado.clinicaId !== clinicaAtiva) {
    return <p className="p-6 text-sm text-muted-foreground" role="status">Carregando ficha…</p>;
  }
  return <AnimalFicha key={animalId} clinicaConfirmada={resultado.clinicaId} />;
}

function AnimalFicha({
  atualizarEndereco = false,
  clinicaConfirmada,
}: {
  atualizarEndereco?: boolean;
  clinicaConfirmada?: string;
}) {
  const demoAlvorada = useDemoAlvorada();
  const navigate = useNavigate();
  const busca = useSearch({ strict: false }) as { animalId?: unknown; comandaId?: unknown };
  const animalId = typeof busca.animalId === "string" ? busca.animalId : "";
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [carregandoFicha, setCarregandoFicha] = useState(true);
  const [erroFicha, setErroFicha] = useState("");
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (!animalId)
          throw Error(
            "Identificação do animal ausente no link. Abra a ficha a partir da fila ou da lista de animais.",
          );
        let cid = clinicaConfirmada;
        if (!cid) {
          const { data, error } = await (supabaseBanco as any).rpc(
            "oricse_resolver_clinica_cadastro_animal",
            { p_animal: animalId },
          );
          if (!vivo) return;
          if (error || !data) throw Error(error?.message || "Clínica do animal não identificada.");
          cid = data;
        }
        if (!cid) return;
        const podePadronizar = atualizarEndereco && idAnimalDaFicha(animalId) &&
          mostrarEnderecoDaFichaNoHost(window.location.hostname) &&
          !new URLSearchParams(window.location.search).has("visual_editor");
        // Nunca usar o endereço novo para trocar a unidade ativa. Se a ficha
        // legada precisa alinhar a clínica (fluxo existente do Admin), fica no endereço antigo.
        let correspondeAoContexto = false;
        if (podePadronizar) {
          try {
            const contexto = await supabaseBanco.rpc("oricse_contexto_clinica_atual");
            correspondeAoContexto = !contexto.error && contexto.data?.[0]?.clinica_id === cid;
          } catch { /* mantém a rota legada */ }
        }
        if (!vivo) return;
        if (!clinicaConfirmada) {
          const { error: eAtiva } = await (supabaseBanco as any).rpc(
            "oricse_clinica_ativa_definir",
            { p_clinica: cid },
          );
          if (eAtiva) throw eAtiva;
        }
        const { data, error } = await (supabaseBanco as any).rpc("oricse_animal_cadastro_tela", {
          p_clinica: cid,
          p_animal: animalId,
        });
        if (error) throw error;
        if (!vivo) return;
        const a = data?.animal;
        // Resolve o endereço antes de mostrar a tela editável: uma resposta
        // tardia nunca pode desmontar a ficha com trabalho aberto.
        if (a && correspondeAoContexto) {
          try {
            const limite = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(1800) : undefined;
            const slug = await slugDaClinicaDaFicha(cid, limite);
            if (!vivo) return;
            if (slug) {
              await navigate({
                to: "/$tipo/$slug",
                params: { tipo: slug, slug: "animal" },
                search: true,
                hash: true,
                replace: true,
              });
              return;
            }
          } catch { /* fallback para a ficha legada */ }
        }
        if (!vivo) return;
        setErroFicha("");
        setAnimal(a ? { ...a, peso: a.peso == null ? "" : String(a.peso) } : null);
        setTutor(data?.tutor || null);
        setClinicaId(cid);
      } catch (e) {
        if (vivo) {
          const msg = e instanceof Error ? e.message : "Não foi possível abrir o prontuário.";
          setErroFicha(msg);
          toast.error(msg);
        }
      } finally {
        if (vivo) setCarregandoFicha(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [animalId, atualizarEndereco, clinicaConfirmada, navigate]);
  const [aba, setAba] = useState<Aba>(() => {
    const solicitada = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("aba") : null;
    return solicitada && (ABAS as readonly string[]).includes(solicitada) ? solicitada as Aba : "Visão geral";
  });
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [registrosPortal, setRegistrosPortal] = useState<Registro[]>([]);
  const [clinicaId, setClinicaId] = useState("");
  const [pesos, setPesos] = useState<PesoRegistro[]>([]);
  const [modalTipo, setModalTipo] = useState<RegistroTipo | null>(null);
  const [preventivoEmEdicao, setPreventivoEmEdicao] = useState<Registro["preventivo"]>(undefined);
  const [dadosPreventivos, setDadosPreventivos] = useState(camposPreventivos);
  const [tipoVacina, setTipoVacina] = useState("");
  const [documentoPreventivo, setDocumentoPreventivo] = useState<Registro["preventivo"]>(undefined);
  const [documentoEmVisualizacao, setDocumentoEmVisualizacao] = useState<{url:string;nome:string;mimeType:string;bytes:Uint8Array}|null>(null);
  const [termosGerados, setTermosGerados] = useState<{documentoId:string;codigoTermo:string|null;geradoPeloOricse:boolean;previaSalva:boolean}[]>([]);
  const [statusTermosCompleto, setStatusTermosCompleto] = useState(false);
  const [podeExcluirComoRt, setPodeExcluirComoRt] = useState(false);
  const [registroParaExcluir, setRegistroParaExcluir] = useState<Registro | null>(null);
  const [confirmacaoDelete, setConfirmacaoDelete] = useState("");
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [excluindoDocumento, setExcluindoDocumento] = useState(false);
  useEffect(() => () => { if (documentoEmVisualizacao) URL.revokeObjectURL(documentoEmVisualizacao.url); }, [documentoEmVisualizacao]);
  const [profissional, setProfissional] = useState<Awaited<ReturnType<typeof obterAutorClinico>> | null>(null);
  const [erroProfissional, setErroProfissional] = useState("");
  const tipoPreventivo = modalTipo === "Vacinas" ? "vacina" : modalTipo === "Vermífugos" ? "vermifugo" : null;
  const [modalPeso, setModalPeso] = useState(false);
  const [pesoNovo, setPesoNovo] = useState("");
  const [dataPeso, setDataPeso] = useState(() => new Date().toISOString().slice(0, 10));
  const [titulo, setTitulo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [visivelTutor, setVisivelTutor] = useState(false);
  const [reforcoEm, setReforcoEm] = useState("");
  const [retornoExameEm, setRetornoExameEm] = useState("");
  const [lote, setLote] = useState("");
  const [tipoDetalhe, setTipoDetalhe] = useState("");
  const [salvandoPortal, setSalvandoPortal] = useState(false);
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null);
  const anexoEmEdicao = useRef<{ arquivo: File; id: string; animalId: string } | null>(null);

  useEffect(() => {
    if (!tipoPreventivo || preventivoEmEdicao) return;
    let ativo = true;
    void obterAutorClinico().then(perfil => {
      if (!ativo) return;
      setProfissional(perfil);
      if (!perfil.nome || !perfil.crmv) setErroProfissional("Complete nome, CRMV e UF no cadastro profissional do seu perfil.");
    }).catch(erro => {
      if (ativo) setErroProfissional(erro instanceof Error ? erro.message : "Não foi possível carregar o perfil profissional.");
    });
    return () => { ativo = false; };
  }, [tipoPreventivo, preventivoEmEdicao]);

  // Prévia da cidade e do horário, sem confiar no relógio local na gravação.
  useEffect(() => {
    if (!tipoPreventivo || preventivoEmEdicao || !clinicaId) return;
    let ativo = true;
    void (async () => {
      const { data: sessao } = await supabaseBanco.auth.getSession();
      const accessToken = sessao.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente.");
      const momento = await obterMomentoLocalAplicacao({ data: { accessToken, clinicaId } });
      if (!ativo) return;
      setData(momento.data);
      setDadosPreventivos(atual => ({
        ...atual, hora_aplicacao: momento.hora, local_aplicacao: momento.local,
      }));
    })().catch(erro => {
      if (ativo) toast.error(erro instanceof Error ? erro.message : "Não foi possível identificar a clínica.");
    });
    return () => { ativo = false; };
  }, [tipoPreventivo, preventivoEmEdicao, clinicaId]);

  async function carregarConteudosPortal() {
    if (!animalId) return;
    try {
      const { data: cid, error: erroClinica } = await (supabaseBanco as any).rpc(
        "oricse_resolver_clinica_cadastro_animal",
        { p_animal: animalId },
      );
      if (erroClinica || !cid) throw Error(erroClinica?.message || "Clínica não identificada.");
      setClinicaId(cid);
      const [vacinasResult, vermifugosResult, examesResult, docsResult, receitasResult] = await Promise.all([
        (supabaseBanco as any)
          .from("oricse_portal_vacinas")
          .select(CAMPOS_VACINA)
          .eq("clinica_id", cid)
          .eq("animal_id", animalId)
          .order("aplicada_em", { ascending: false, nullsFirst: false }),
        (supabaseBanco as any)
          .from("oricse_portal_vermifugos")
          .select(CAMPOS_VERMIFUGO)
          .eq("clinica_id", cid)
          .eq("animal_id", animalId)
          .order("administrado_em", { ascending: false, nullsFirst: false }),
        (supabaseBanco as any)
          .from("oricse_portal_exames")
          .select(
            "id,animal_id,titulo,tipo,realizado_em,resultado_resumo,drive_arquivo_id,visivel_tutor,created_at",
          )
          .eq("clinica_id", cid)
          .eq("animal_id", animalId)
          .order("realizado_em", { ascending: false, nullsFirst: false }),
        (supabaseBanco as any)
          .from("oricse_portal_documentos")
          .select(
            "id,animal_id,titulo,tipo,data_documento,observacoes,drive_arquivo_id,visivel_tutor,created_at",
          )
          .eq("clinica_id", cid)
          .eq("animal_id", animalId)
          .is("excluido_em", null)
          .order("data_documento", { ascending: false, nullsFirst: false }),
        (supabaseBanco as any)
          .from("oricse_portal_receitas")
          .select(
            "id,animal_id,tipo,numero,titulo,emitida_em,visivel_tutor,motivo_ocultacao,motivo_outro,drive_arquivo_id,created_at",
          )
          .eq("clinica_id", cid)
          .eq("animal_id", animalId)
          .is("excluido_em", null)
          .order("emitida_em", { ascending: false }),
      ]);
      for (const r of [vacinasResult, vermifugosResult, examesResult, docsResult, receitasResult])
        if (r.error) throw r.error;
      const vacinas = (vacinasResult.data || []) as VacinaPortal[];
      const vermifugos = (vermifugosResult.data || []) as VermifugoPortal[];
      const exames = (examesResult.data || []) as ExamePortal[];
      const docs = (docsResult.data || []) as DocumentoPortal[];
      const receitas = (receitasResult.data || []) as ReceitaPortal[];
      const convertidos: Registro[] = [
        ...vacinas.map(registroPreventivo),
        ...vermifugos.map(registroPreventivo),
        ...exames.map((e) => ({
          id: e.id,
          animalId: e.animal_id,
          tipo: "Exames" as const,
          titulo: e.titulo,
          detalhe: [
            e.tipo && e.tipo !== "Exame" ? `Tipo: ${e.tipo}` : "",
            e.resultado_resumo || "",
            e.drive_arquivo_id ? "PDF anexado" : "",
          ]
            .filter(Boolean)
            .join("\n"),
          data: e.realizado_em || e.created_at.slice(0, 10),
          criadoEm: e.created_at,
          visivelTutor: e.visivel_tutor,
          fontePortal: "exame" as const,
          driveArquivoId: e.drive_arquivo_id,
        })),
        ...docs.map((d) => ({
          id: d.id,
          animalId: d.animal_id,
          tipo: (/^termo\b/i.test(d.tipo || "") ? "Termos" : "Documentos") as RegistroTipo,
          subtipo: d.tipo,
          titulo: d.titulo,
          detalhe: [d.tipo && d.tipo !== "Documento" ? `Tipo: ${d.tipo}` : "", d.observacoes || ""]
            .filter(Boolean)
            .join("\n"),
          data: d.data_documento || d.created_at.slice(0, 10),
          criadoEm: d.created_at,
          visivelTutor: d.visivel_tutor,
          fontePortal: "documento" as const,
          driveArquivoId: d.drive_arquivo_id,
        })),
        ...receitas.map((r) => ({
          id: r.id,
          animalId: r.animal_id,
          tipo: "Receitas" as const,
          titulo: r.titulo,
          detalhe: [
            r.tipo === "especial" ? "Controle especial" : "Receita normal",
            r.numero ? `Número: ${r.numero}` : "",
            !r.visivel_tutor
              ? `Oculta do portal: ${rotuloMotivo(r.motivo_ocultacao)}${r.motivo_outro ? ` — ${r.motivo_outro}` : ""}`
              : "Disponível no Portal do Tutor",
          ]
            .filter(Boolean)
            .join("\n"),
          data: r.emitida_em.slice(0, 10),
          criadoEm: r.created_at,
          visivelTutor: r.visivel_tutor,
          fontePortal: "receita" as const,
          motivoOcultacao: r.motivo_ocultacao,
          driveArquivoId: r.drive_arquivo_id,
        })),
      ];
      setRegistrosPortal(convertidos);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível carregar vacinas, vermífugos, exames, receitas e documentos do banco.");
    }
  }
  useEffect(() => {
    void carregarConteudosPortal();
  }, [animalId]);

  useEffect(() => {
    if (!clinicaId) { setPodeExcluirComoRt(false); return; }
    let ativo = true;
    setPodeExcluirComoRt(false);
    void (async () => {
      try {
        const accessToken = (await supabaseBanco.auth.getSession()).data.session?.access_token;
        if (!accessToken) return;
        const acesso = await consultarExclusaoRt({ data: { accessToken, clinicaId } });
        if (ativo) setPodeExcluirComoRt(acesso.podeExcluir);
      } catch {
        if (ativo) setPodeExcluirComoRt(false);
      }
    })();
    return () => { ativo = false; };
  }, [clinicaId]);

  useEffect(() => {
    if (aba !== "Termos" || !clinicaId || !animalId) return;
    let ativo = true;
    setStatusTermosCompleto(false);
    setTermosGerados([]);
    void (async () => {
      try {
        const token = (await supabaseBanco.auth.getSession()).data.session?.access_token;
        if (!token) throw new Error("Sessão expirada.");
        const resultado = await obterStatusTermosPaciente({ data: {
          accessToken: token, clinicaId, animalId,
        } });
        if (!ativo) return;
        setTermosGerados(resultado.documentos);
        setStatusTermosCompleto(resultado.completo);
      } catch (error) {
        if (ativo) {
          console.error("Não foi possível conferir a emissão dos termos do paciente:", error);
          setStatusTermosCompleto(false);
        }
      }
    })();
    return () => { ativo = false; };
  }, [aba, animalId, clinicaId, registrosPortal]);

  useEffect(() => {
    if (!animalId) return;
    let vivo = true;
    void (async () => {
      const { data, error } = await (supabaseBanco as any).rpc("oricse_animal_historico", {
        p_animal: animalId,
      });
      if (!vivo) return;
      if (error) {
        toast.error("Não foi possível carregar o histórico: " + error.message);
        return;
      }
      // Durante a migração, consultas e procedimentos legados ainda podem estar no Drive.
      // O animal já foi autorizado no banco antes de chegar a esta consulta.
      const registrosBanco = (data?.registros || []) as Registro[];
      const registrosDrive = ler<Registro>(PRONTUARIO_KEY).filter(
        (registro) => registro.animalId === animalId,
      );
      const unidos = new Map<string, Registro>();
      for (const registro of registrosDrive) unidos.set(registro.id, registro);
      for (const registro of registrosBanco) unidos.set(registro.id, registro);
      setRegistros(
        [...unidos.values()].sort(
          (a, b) => String(b.criadoEm || b.data || "").localeCompare(String(a.criadoEm || a.data || "")),
        ),
      );
      setPesos(data?.pesos || []);
    })();
    return () => {
      vivo = false;
    };
  }, [animalId]);

  const registrosLocaisSemPortal = useMemo(
    () =>
      registros.filter((r) => !["Vacinas", "Vermífugos", "Exames", "Documentos", "Receitas"].includes(r.tipo)),
    [registros],
  );
  const registrosAnimal = useMemo(
    () =>
      [...registrosLocaisSemPortal, ...registrosPortal]
        .filter((r) => r.animalId === animalId)
        .sort((a, b) => `${b.data}${b.criadoEm}`.localeCompare(`${a.data}${a.criadoEm}`)),
    [registrosLocaisSemPortal, registrosPortal, animalId],
  );
  const pesosAnimal = useMemo(
    () =>
      pesos
        .filter((p) => p.animalId === animalId)
        .sort((a, b) => `${b.data}${b.criadoEm}`.localeCompare(`${a.data}${a.criadoEm}`)),
    [pesos, animalId],
  );
  const codigoTutor = tutor && codigoPublicoTutor(tutor);
  const pesoAtual =
    pesosAnimal[0] ||
    (animal?.peso && Number.isFinite(numeroPeso(animal.peso))
      ? {
          id: "cadastro",
          animalId,
          peso: numeroPeso(animal.peso),
          data: animal.criadoEm?.slice(0, 10) || "",
          criadoEm: animal.criadoEm || "",
        }
      : null);
  const historicoPeso = pesosAnimal.length ? pesosAnimal.slice(1) : [];

  function abrirNovo(tipo: RegistroTipo) {
    if (tipo === "Agendamentos" && animal) {
      window.location.href = `/encaminhar?tutorId=${encodeURIComponent(animal.tutorId)}&animalId=${encodeURIComponent(animal.id)}`;
      return;
    }
    if (tipo === "Termos" && animal) {
      window.location.href = "/termos?tutorId=" + encodeURIComponent(animal.tutorId) +
        "&animalId=" + encodeURIComponent(animal.id);
      return;
    }
    if (tipo === "Receitas" && animal) {
      window.location.href = `/receituario?tutorId=${encodeURIComponent(animal.tutorId)}&animalId=${encodeURIComponent(animal.id)}`;
      return;
    }
    if (tipo === "Observações") {
      setAba("Observações");
      return;
    }
    setPreventivoEmEdicao(undefined);
    setProfissional(null);
    setErroProfissional("");
    setDadosPreventivos(camposPreventivos);
    setTipoVacina("");
    setModalTipo(tipo);
    setTitulo("");
    setDetalhe("");
    setData(hojeNoBrasil());
    setVisivelTutor(false);
    setReforcoEm("");
    setRetornoExameEm("");
    setLote("");
    setArquivoPdf(null);
    anexoEmEdicao.current = null;
    setTipoDetalhe(tipo === "Exames" ? "Exame" : tipo === "Documentos" ? "Documento" : "");
  }

  function abrirAnexoTermo(nome: string) {
    if (!animal) return;
    setModalTipo("Termos");
    setTitulo(nome);
    setTipoDetalhe("Termo");
    setDetalhe("");
    setData(hojeNoBrasil());
    setArquivoPdf(null);
    setVisivelTutor(false);
    anexoEmEdicao.current = null;
  }

  async function abrirDocumento(registro: Registro, acao: "visualizar" | "baixar") {
    if (!registro.driveArquivoId) {
      toast.error("Este documento ainda não possui arquivo anexado.");
      return;
    }
    try {
      const token = (await supabaseBanco.auth.getSession()).data.session?.access_token;
      if (!token || !clinicaId) throw new Error("Sessão expirada.");
      const arquivo = await baixarDocumentoPortal({ data: {
        accessToken: token, documentoId: registro.id,
        tipo: registro.fontePortal === "exame" ? "exame" : registro.fontePortal === "receita" ? "receita" : "documento",
        clinicaEquipeId: clinicaId,
      } });
      const bytes = Uint8Array.from(atob(arquivo.base64), letra => letra.charCodeAt(0));
      const mimeType = arquivo.mimeType || "application/pdf";
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      const nome = arquivo.nome || "documento.pdf";
      if (acao === "visualizar") {
        setDocumentoEmVisualizacao({ url, nome, mimeType, bytes });
      } else {
        const link = document.createElement("a");
        link.href = url; link.download = nome;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível abrir o documento.");
    }
  }

  function editarPreventivo(registro: Registro) {
    const item = registro.preventivo;
    if (!item || item.linha.animal_id !== animalId) return;
    const linha = item.linha;
    setPreventivoEmEdicao(item);
    setDadosPreventivos(normalizarCamposPreventivos(linha));
    setTipoVacina("");
    setTitulo(linha.nome);
    setData(("aplicada_em" in linha ? linha.aplicada_em : linha.administrado_em) || "");
    setReforcoEm(("reforco_em" in linha ? linha.reforco_em : linha.proxima_dose_em) || "");
    setLote(linha.lote || "");
    setDetalhe(linha.observacoes || "");
    setVisivelTutor(Boolean(registro.visivelTutor));
    setModalTipo(registro.tipo);
  }

  function selecionarVacina(id: string) {
    setTipoVacina(id);
    if (id === "outro") {
      setTitulo("");
      setDadosPreventivos(atual => ({
        ...camposPreventivos,
        hora_aplicacao: atual.hora_aplicacao,
        local_aplicacao: atual.local_aplicacao,
      }));
      setData(hojeNoBrasil());
      setReforcoEm("");
      setLote("");
      setDetalhe("");
      return;
    }

    const vacina = vacinasPredefinidas.flatMap(({ opcoes }) => opcoes).find(opcao => opcao.id === id);
    if (!vacina) return;
    setTitulo(vacina.nome);
    setDadosPreventivos(atual => ({ ...atual, alvo_vacinacao: vacina.alvo }));
  }

  async function salvarRegistro() {
    if (!animal || !modalTipo || salvandoPortal) return;
    if (demoAlvorada && (modalTipo === "Documentos" || modalTipo === "Termos" || (modalTipo === "Exames" && arquivoPdf))) {
      return void toast.info(AVISO_DEMO_DOCUMENTOS);
    }
    if (!titulo.trim()) return void toast.error("Informe o título do registro.");
    if (modalTipo === "Termos" && !arquivoPdf) return void toast.error("Anexe um arquivo PDF antes de registrar o termo.");
    if (["Vacinas", "Vermífugos", "Exames", "Documentos", "Termos"].includes(modalTipo)) {
      if (!clinicaId) return void toast.error("Não foi possível identificar a clínica atual.");
      if (
        (modalTipo === "Exames" || modalTipo === "Documentos") &&
        arquivoPdf &&
        (arquivoPdf.type !== "application/pdf" || arquivoPdf.size > PORTAL_PDF_MAX_BYTES)
      )
        return void toast.error("Envie um PDF de até 20 MB.");
      setSalvandoPortal(true);
      try {
        if (tipoPreventivo) {
          const anterior = preventivoEmEdicao?.linha;
          if (!anterior && (!profissional?.nome || !profissional.crmv || erroProfissional)) {
            throw new Error(erroProfissional || "Aguarde a identificação do perfil profissional.");
          }
          // Novos atos recebem o instante e a cidade do servidor ao salvar.
          // Edições preservam os dados históricos da aplicação.
          let momento: { data: string; hora: string; local: string } | null = null;
          if (!anterior) {
            const { data: sessao } = await supabaseBanco.auth.getSession();
            const accessToken = sessao.session?.access_token;
            if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente.");
            momento = await obterMomentoLocalAplicacao({ data: { accessToken, clinicaId } });
          }
          const campos = normalizarCamposPreventivos({
            ...dadosPreventivos,
            hora_aplicacao: anterior ? anterior.hora_aplicacao : momento?.hora,
            local_aplicacao: anterior ? anterior.local_aplicacao : momento?.local,
            veterinario_nome: anterior ? anterior.veterinario_nome : profissional?.nome,
            veterinario_crmv: anterior ? anterior.veterinario_crmv : profissional?.numeroCrmv,
            veterinario_uf: anterior ? anterior.veterinario_uf : profissional?.uf,
          });
          const dataAnterior = anterior ? ("aplicada_em" in anterior ? anterior.aplicada_em : anterior.administrado_em) : null;
          const dataAplicacao = anterior ? dataAnterior || "" : momento?.data || "";
          const retornoAnterior = anterior ? ("reforco_em" in anterior ? anterior.reforco_em : anterior.proxima_dose_em) : null;
          const legadoIncompleto = anterior && pendenciasPreventivo(tipoPreventivo, {
            ...normalizarCamposPreventivos(anterior), nome: anterior.nome, data: dataAnterior || "",
            lote: anterior.lote || "", retorno: retornoAnterior || "",
          }).length > 0;
          const pendencias = pendenciasPreventivo(tipoPreventivo, {
            ...campos, nome: titulo, data: dataAplicacao, lote, retorno: reforcoEm,
          }, !legadoIncompleto);
          if (pendencias.length) throw new Error("Confira: " + pendencias.join(", ") + ".");
          if (animal.id !== animalId || (anterior && anterior.animal_id !== animal.id)) {
            throw new Error("O registro não pertence à ficha aberta.");
          }
          const comuns = {
            nome: titulo.trim(), lote: lote.trim() || null, observacoes: detalhe.trim() || null,
            visivel_tutor: visivelTutor, fabricante: campos.fabricante || null, dose: campos.dose || null,
            fabricacao: dataDoRotulo(campos.fabricacao), validade: dataDoRotulo(campos.validade),
            hora_aplicacao: campos.hora_aplicacao || null, local_aplicacao: campos.local_aplicacao || null,
            updated_at: new Date().toISOString(),
          };
          const clinicaAnimal = { clinica_id: clinicaId, animal_id: animal.id };
          const vacinas = supabaseBanco.from("oricse_portal_vacinas");
          const vermifugos = supabaseBanco.from("oricse_portal_vermifugos");
          const camposVacina = { ...comuns, aplicada_em: dataAplicacao || null, reforco_em: reforcoEm || null, alvo_vacinacao: campos.alvo_vacinacao || null };
          const camposVermifugo = { ...comuns, administrado_em: dataAplicacao || null, proxima_dose_em: reforcoEm || null, principio_ativo: campos.principio_ativo || null, via: campos.via || null };
          const salvo = tipoPreventivo === "vacina"
            ? await (anterior
              ? vacinas.update(camposVacina).eq("id", anterior.id).match(clinicaAnimal)
              : vacinas.insert({ ...camposVacina, ...clinicaAnimal })).select(CAMPOS_VACINA).single()
            : await (anterior
              ? vermifugos.update(camposVermifugo).eq("id", anterior.id).match(clinicaAnimal)
              : vermifugos.insert({ ...camposVermifugo, ...clinicaAnimal })).select(CAMPOS_VERMIFUGO).single();
          if (salvo.error || !salvo.data) throw new Error(salvo.error?.code === "22023"
            ? salvo.error.message : "Não foi possível salvar. Confira sua permissão ou atualize a ficha.");
          const registro = registroPreventivo(salvo.data as VacinaPortal | VermifugoPortal);
          setRegistrosPortal(lista => [...lista.filter(item => item.fontePortal !== registro.fontePortal || item.id !== registro.id), registro]);
          setModalTipo(null);
          setPreventivoEmEdicao(undefined);
          toast.success(anterior ? "Registro atualizado." : "Registro adicionado.");
          return;
        } else {
          const exame = modalTipo === "Exames";
          let driveArquivoId: string | null = null;
          let registroId: string = crypto.randomUUID();
          if (arquivoPdf) {
            const anterior = anexoEmEdicao.current;
            if (anterior?.arquivo === arquivoPdf && anterior.animalId === animal.id) {
              registroId = anterior.id;
            }
            anexoEmEdicao.current = { arquivo: arquivoPdf, id: registroId, animalId: animal.id };
            const { data: sessao } = await supabase.auth.getSession();
            const accessToken = sessao.session?.access_token;
            if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente para enviar o PDF.");
            const anexo = await enviarAnexoPortal({ data: {
              accessToken, clinicaId, animalId: animal.id, registroId,
              categoria: exame ? "exames" : "documentos",
              nome: arquivoPdf.name, base64: await arquivoParaDataUrl(arquivoPdf),
            } });
            driveArquivoId = anexo.arquivoId;
          }
          const registro = {
            id: registroId,
            clinica_id: clinicaId,
            animal_id: animal.id,
            titulo: titulo.trim(),
            tipo: modalTipo === "Termos" ? "Termo" : (tipoDetalhe.trim() || (exame ? "Exame" : "Documento")),
            drive_arquivo_id: driveArquivoId,
            visivel_tutor: visivelTutor && !demoAlvorada,
          };
          const { error } = exame
            ? await (supabaseBanco as any).from("oricse_portal_exames").upsert({
                ...registro, realizado_em: data || null, resultado_resumo: detalhe.trim() || null,
                retorno_em: retornoExameEm || null, orientacoes_retorno: retornoExameEm ? "Confirmar reavaliação ou resultado com o tutor." : null,
              }, { onConflict: "id", ignoreDuplicates: true })
            : await supabaseBanco.from("oricse_portal_documentos").upsert({
                ...registro, data_documento: data || null, observacoes: detalhe.trim() || null,
              }, { onConflict: "id", ignoreDuplicates: true });
          if (error) {
            throw new Error(driveArquivoId
              ? "O PDF foi anexado, mas o registro não foi salvo. Tente salvar novamente."
              : "Não foi possível salvar o registro na ficha do animal.");
          }
        }
        await carregarConteudosPortal();
        setModalTipo(null);
        setArquivoPdf(null);
        toast.success(
          visivelTutor && !demoAlvorada && ["Exames", "Documentos", "Termos"].includes(modalTipo)
            ? `${modalTipo} disponível no Portal. O aviso com link foi adicionado ao CRM.`
            : `${modalTipo} adicionado no banco.`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Não foi possível salvar ${modalTipo.toLowerCase()}.`,
        );
      } finally {
        setSalvandoPortal(false);
      }
      return;
    }
    const { data: historico, error } = await (supabaseBanco as any).rpc("oricse_animal_historico", {
      p_animal: animal.id,
      p_tipo: modalTipo,
      p_titulo: titulo.trim(),
      p_detalhe: detalhe.trim(),
      p_data: data,
    });
    if (error) return void toast.error("Não foi possível salvar o registro: " + error.message);
    setRegistros(historico?.registros || []);
    setModalTipo(null);
    toast.success(`${modalTipo} registrado no ORICSE.`);
  }

  function solicitarExclusao(registro: Registro) {
    if (!podeExcluirComoRt || !["Termos", "Receitas"].includes(registro.tipo) ||
        !["documento", "receita"].includes(registro.fontePortal || "")) return;
    setRegistroParaExcluir(registro);
    setConfirmacaoDelete("");
    setMotivoExclusao("");
  }

  async function confirmarExclusaoRt() {
    const registro = registroParaExcluir;
    if (!registro || !podeExcluirComoRt || !clinicaId || excluindoDocumento ||
        confirmacaoDelete !== "DELETE" || motivoExclusao.trim().length < 5) return;
    const categoria = registro.tipo === "Termos" ? "termo" : "receita";
    setExcluindoDocumento(true);
    try {
      const accessToken = (await supabaseBanco.auth.getSession()).data.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");
      const resultado = await excluirTermoOuReceitaRt({ data: {
        accessToken, clinicaId, animalId: registro.animalId,
        documentoId: registro.id, categoria,
        confirmacao: "DELETE", motivo: motivoExclusao.trim(),
      } });
      if (!resultado.excluido) throw new Error("A exclusão não foi confirmada.");
      setRegistrosPortal(lista => lista.filter(item => item.id !== registro.id));
      setRegistroParaExcluir(null);
      setConfirmacaoDelete("");
      setMotivoExclusao("");
      toast.success((categoria === "termo" ? "Termo" : "Receita") +
        " removido da ficha ativa. Original preservado para auditoria do RT.");
      void carregarConteudosPortal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir o documento.");
    } finally {
      setExcluindoDocumento(false);
    }
  }

  async function alternarVisibilidade(registro: Registro, valor: boolean) {
    if (registro.subtipo === "Termo - Prévia demonstrativa") {
      toast.error("Prévia demonstrativa não pode ser publicada no Portal do Tutor.");
      return;
    }
    if (!registro.fontePortal || !clinicaId || registro.fontePortal === "receita") return;
    if (demoAlvorada && ["exame", "documento"].includes(registro.fontePortal)) {
      return void toast.info(AVISO_DEMO_DOCUMENTOS);
    }
    const tabela =
      registro.fontePortal === "vacina"
        ? "oricse_portal_vacinas"
        : registro.fontePortal === "vermifugo"
          ? "oricse_portal_vermifugos"
        : registro.fontePortal === "exame"
          ? "oricse_portal_exames"
          : "oricse_portal_documentos";
    const { data: confirmado, error } = await (supabaseBanco as any)
      .from(tabela)
      .update({ visivel_tutor: valor, updated_at: new Date().toISOString() })
      .eq("id", registro.id)
      .eq("clinica_id", clinicaId)
      .eq("animal_id", registro.animalId)
      .select("id").maybeSingle();
    if (error || !confirmado) {
      toast.error("Não foi possível alterar a visibilidade no portal.");
      return;
    }
    setRegistrosPortal(lista => lista.map(item => item.id===registro.id ? {...item,visivelTutor:valor} : item));
    toast.success(
      valor
        ? registro.fontePortal === "exame" || registro.fontePortal === "documento"
          ? "Registro liberado no Portal. O CRM criou o aviso com link seguro."
          : "Registro liberado no Portal do Tutor."
        : "Registro ocultado do Portal do Tutor.",
    );
  }

  async function salvarPeso() {
    if (!animal) return;
    const n = numeroPeso(pesoNovo);
    if (!Number.isFinite(n) || n <= 0) return void toast.error("Informe um peso válido.");
    const { data: historico, error } = await (supabaseBanco as any).rpc("oricse_animal_historico", {
      p_animal: animal.id,
      p_peso: n,
      p_data: dataPeso,
    });
    if (error) return void toast.error("Não foi possível salvar o peso: " + error.message);
    setPesos(historico?.pesos || []);
    setAnimal((a) => (a ? { ...a, peso: n.toFixed(3) } : a));
    setModalPeso(false);
    setPesoNovo("");
    toast.success(`Peso de ${formatarPeso(n)} registrado.`);
  }

  if (carregandoFicha)
    return (
      <main className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">
        Carregando prontuário no Supabase…
      </main>
    );
  if (!animal)
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link
          to="/animais"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft size={18} /> Voltar
        </Link>
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          {erroFicha || "Animal não encontrado no banco desta clínica."}
        </div>
      </main>
    );

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1760px] px-3 pb-28 pt-4 sm:px-5">
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <nav className="p-2">
              {ABAS.map((nome) => {
                const Icon = iconFor(nome);
                const ativo = aba === nome;
                return (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => setAba(nome)}
                    className={`relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${ativo ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
                  >
                    {ativo && (
                      <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />
                    )}
                    <Icon size={18} className={ativo ? "text-primary" : "text-muted-foreground"} />
                    <span>{nome}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Link
              to="/animais"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground"
            >
              <ArrowLeft size={18} /> Animais
            </Link>
            <Link
              to="/novo-animal"
              search={{ animalId: animal.id } as never}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold"
            >
              <Pencil size={16} /> Editar animal
            </Link>
          </div>
          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="grid gap-5 p-4 lg:grid-cols-[1.5fr_1fr] lg:p-5">
              <div className="flex items-start gap-4">
                <FotoAnimalDrive animalId={animal.id} nome={animal.nome} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-black">{animal.nome}</h1>
                    {animal.alerta && (
                      <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">
                        ⚠ {animal.alerta}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid gap-x-5 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                    <span>
                      <strong className="text-foreground">Espécie:</strong> {animal.especie || "—"}
                    </span>
                    <span>
                      <strong className="text-foreground">Raça:</strong> {animal.raca || "—"}
                    </span>
                    <span>
                      <strong className="text-foreground">Sexo:</strong> {animal.sexo || "—"}
                    </span>
                    <span>
                      <strong className="text-foreground">Idade:</strong> {idade(animal.nascimento)}
                    </span>
                    <span>
                      <strong className="text-foreground">Peso:</strong>{" "}
                      {pesoAtual ? formatarPeso(pesoAtual.peso) : "—"}
                    </span>
                    <span>
                      <strong className="text-foreground">Castrado:</strong>{" "}
                      {animal.castrado || "—"}
                    </span>
                    <span>
                      <strong className="text-foreground">Microchip:</strong>{" "}
                      {animal.microchip || "—"}
                    </span>
                    <span>
                      <strong className="text-foreground">Cor:</strong> {animal.cor || "—"}
                    </span>
                    <span>
                      <strong className="text-foreground">Tipo sanguíneo:</strong>{" "}
                      {animal.tipoSanguineo || "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-black">
                  <UserRound size={17} className="text-primary" /> Tutor
                </div>
                <div className="mt-2 text-lg font-black">
                  {tutor?.nome || "Tutor não encontrado"}{" "}
                  {codigoTutor && (
                    <span className="ml-1 font-mono text-sm text-primary">{codigoTutor}</span>
                  )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[tutor?.telefone, tutor?.outroTelefone].filter(Boolean).join(" · ") ||
                    "Sem telefone"}
                </div>
                {tutor?.email && (
                  <div className="mt-1 truncate text-sm text-muted-foreground">{tutor.email}</div>
                )}
                {tutor && (
                  <Link
                    to="/tutores"
                    className="mt-3 inline-flex rounded-lg border bg-white px-3 py-2 text-xs font-bold"
                  >
                    Ver cadastro do tutor
                  </Link>
                )}
              </div>
            </div>
            <div className="flex overflow-x-auto border-t bg-muted/10 px-2 lg:hidden">
              {ABAS.map((nome) => (
                <button
                  key={nome}
                  type="button"
                  onClick={() => setAba(nome)}
                  className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${aba === nome ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                >
                  {nome}
                </button>
              ))}
            </div>
          </section>

          {clinicaId && typeof busca.comandaId==="string" && <ComandaAtendimento key={busca.comandaId} id={busca.comandaId} clinicaId={clinicaId} />}
        {aba === "Visão geral" ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="space-y-4">
                <Painel titulo="Resumo clínico">
                  <Info rotulo="Alergias" valor={animal.alergias} />
                  <Info rotulo="Doenças crônicas" valor={animal.doencasCronicas} />
                  <Info rotulo="Medicamentos contínuos" valor={animal.medicamentosContinuos} />
                  <Info rotulo="Dieta" valor={animal.dieta} />
                  <Info rotulo="Restrições" valor={animal.restricoes} />
                  <Info rotulo="Necessidades especiais" valor={animal.necessidadesEspeciais} />
                </Painel>
                <Painel titulo="Histórico de peso" acao={() => setModalPeso(true)}>
                  <div className="py-2 text-center">
                    <Scale className="mx-auto mb-2 text-primary/35" />
                    <div className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Peso atual
                    </div>
                    <div className="mt-1 text-2xl font-black">
                      {pesoAtual ? formatarPeso(pesoAtual.peso) : "não informado"}
                    </div>
                    {pesoAtual?.data && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatarData(pesoAtual.data)}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 border-t pt-3">
                    <div className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                      Histórico de pesos
                    </div>
                    {historicoPeso.length ? (
                      <div className="space-y-1.5">
                        {historicoPeso.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="text-muted-foreground">{formatarData(p.data)}</span>
                            <strong>{formatarPeso(p.peso)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Nenhum peso anterior registrado.
                      </div>
                    )}
                  </div>
                </Painel>
                <Painel titulo="Próximos agendamentos" acao={() => abrirNovo("Agendamentos")}>
                  <div className="text-sm text-muted-foreground">
                    Abra a aba Agendamentos para consultar o histórico completo e marcar um novo
                    horário.
                  </div>
                </Painel>
                <Painel titulo="Acesso do Portal do Tutor">
                  <PortalTutorAcessoFicha animalId={animal.id} />
                </Painel>
              </aside>
              <section className="space-y-3">
                {(
                  [
                    "Registros clínicos",
                    "Vacinas",
                    "Vermífugos",
                    "Exames",
                    "Receitas",
                    "Termos",
                    "Observações",
                    "Documentos",
                    "Galeria",
                  ] as RegistroTipo[]
                ).map((tipo) => (
                  <ResumoSecao
                    key={tipo}
                    tipo={tipo}
                    registros={registrosAnimal.filter((r) => r.tipo === tipo).slice(0, 2)}
                    onAdd={
                      tipo === "Registros clínicos"
                        ? undefined
                        : tipo === "Observações"
                          ? () => setAba("Observações")
                          : () => abrirNovo(tipo)
                    }
                    onOpen={() => setAba(tipo as Aba)}
                    animalId={animal.id}
                  />
                ))}
              </section>
            </div>
          ) : aba === "Registros clínicos" ? (
            <RegistrosClinicos
              animalId={animal.id}
              clinicaId={clinicaId}
              registros={registrosAnimal.filter((r) => r.tipo === "Registros clínicos")}
            />
          ) : aba === "Agendamentos" ? (
            <AgendamentosAnimal animalId={animal.id} tutorId={animal.tutorId} />
          ) : aba === "Observações" ? (
            <ObservacoesAnimal
              animalId={animal.id}
              registros={registros}
              onChange={(proximos) => setRegistros(proximos as Registro[])}
            />
          ) : (
            <>
            {aba === "Termos" && <TermosDoPaciente
              animalId={animal.id}
              tutorId={animal.tutorId}
              documentos={registrosAnimal.filter(r => r.tipo === "Termos")}
              gerados={termosGerados}
              conferenciaCompleta={statusTermosCompleto}
              onAnexar={abrirAnexoTermo}
            />}
            <SecaoCompleta
              onBaixarDocumento={(registro) => void abrirDocumento(registro, "baixar")}
              onVisualizarDocumento={(registro) => void abrirDocumento(registro, "visualizar")}
              onExcluir={solicitarExclusao}
              podeExcluirComoRt={podeExcluirComoRt}
              aba={aba}
              registros={registrosAnimal.filter((r) => r.tipo === aba)}
              onAdd={() => abrirNovo(aba as RegistroTipo)}
              onTogglePortal={alternarVisibilidade}
              onEditarPreventivo={editarPreventivo}
              onDocumentoPreventivo={demoAlvorada ? undefined : registro => setDocumentoPreventivo(registro.preventivo)}
            />
            </>
          )}

          {documentoPreventivo && documentoPreventivo.linha.animal_id === animal.id && (
            <DocumentoPreventivo key={documentoPreventivo.linha.id} clinicaId={clinicaId} animalId={animal.id}
              registroId={documentoPreventivo.linha.id} tipo={documentoPreventivo.tipo}
              onClose={() => setDocumentoPreventivo(undefined)} />
          )}

          {registroParaExcluir && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4"
              onMouseDown={(event) => {
                if (!excluindoDocumento && event.target === event.currentTarget) setRegistroParaExcluir(null);
              }}>
              <section role="dialog" aria-modal="true" aria-labelledby="titulo-delete-rt"
                className="w-full max-w-lg rounded-2xl border bg-card p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-destructive">Somente Responsável Técnico</p>
                    <h2 id="titulo-delete-rt" className="mt-1 text-xl font-black">
                      Excluir {registroParaExcluir.tipo === "Termos" ? "termo" : "receita"}
                    </h2>
                  </div>
                  <button type="button" aria-label="Cancelar exclusão" disabled={excluindoDocumento}
                    onClick={() => setRegistroParaExcluir(null)} className="rounded-lg border p-2">
                    <X size={18} />
                  </button>
                </div>
                <p className="mt-4 text-sm font-semibold">{registroParaExcluir.titulo}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  O documento sairá da ficha ativa e do Portal do Tutor. O PDF original
                  e os dados de autoria, data e motivo ficarão preservados na auditoria da clínica.
                </p>
                <label className="mt-4 block text-sm font-semibold">
                  Motivo da exclusão *
                  <textarea rows={3} maxLength={500} value={motivoExclusao}
                    onChange={event => setMotivoExclusao(event.target.value)}
                    placeholder="Informe por que o documento deve ser retirado da ficha ativa"
                    className="mt-1 w-full rounded-xl border bg-background p-3 font-normal" />
                </label>
                <label className="mt-4 block text-sm font-semibold">
                  Digite DELETE para confirmar *
                  <input value={confirmacaoDelete} onChange={event => setConfirmacaoDelete(event.target.value)}
                    autoComplete="off" spellCheck={false} placeholder="DELETE"
                    className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 font-mono font-semibold" />
                </label>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={excluindoDocumento}
                    onClick={() => setRegistroParaExcluir(null)}
                    className="min-h-11 rounded-xl border px-4 text-sm font-semibold">
                    Cancelar
                  </button>
                  <button type="button"
                    disabled={excluindoDocumento || !podeExcluirComoRt ||
                      confirmacaoDelete !== "DELETE" || motivoExclusao.trim().length < 5}
                    onClick={() => void confirmarExclusaoRt()}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-destructive px-4 text-sm font-bold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-40">
                    <Trash2 size={16} /> {excluindoDocumento ? "Excluindo..." : "DELETE"}
                  </button>
                </div>
              </section>
            </div>
          )}

          {documentoEmVisualizacao && (
            <div role="dialog" aria-modal="true" aria-label={"Visualizar " + documentoEmVisualizacao.nome}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3"
              onMouseDown={(e) => { if (e.target === e.currentTarget) setDocumentoEmVisualizacao(null); }}>
              <div className="flex h-[min(90dvh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
                  <strong className="min-w-0 flex-1 truncate text-sm">{documentoEmVisualizacao.nome}</strong>
                  <div className="flex items-center gap-2">
                    <a href={documentoEmVisualizacao.url} download={documentoEmVisualizacao.nome}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold">
                      <Download size={16} /> Baixar
                    </a>
                    <button type="button" onClick={() => setDocumentoEmVisualizacao(null)}
                      aria-label="Fechar visualização" className="rounded-lg border p-2"><X size={19} /></button>
                  </div>
                </div>
                {documentoEmVisualizacao.mimeType === "application/pdf" ?
                  <div className="min-h-0 w-full flex-1 overflow-y-auto bg-muted/20 p-4">
                    <PaginasArquivoPdf bytes={documentoEmVisualizacao.bytes}
                      rotulo={"Documento: " + documentoEmVisualizacao.nome} />
                  </div>
                : documentoEmVisualizacao.mimeType.startsWith("image/") ?
                  <img alt={documentoEmVisualizacao.nome} src={documentoEmVisualizacao.url} className="min-h-0 w-full flex-1 object-contain" />
                : <div className="p-5 text-sm text-muted-foreground">
                    Este formato não possui visualização integrada. Use Baixar para acessar o arquivo.
                  </div>}
              </div>
            </div>
          )}

          {modalTipo && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
              onMouseDown={(e) => {
                if (!salvandoPortal && e.currentTarget === e.target) setModalTipo(null);
              }}
            >
              <div role="dialog" aria-modal="true" aria-labelledby="titulo-modal-registro" className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">
                      {animal.nome}
                    </p>
                    <h2 id="titulo-modal-registro" className="text-2xl font-black">
                      {preventivoEmEdicao ? (tipoPreventivo === "vacina" ? "Editar vacina" : "Editar vermifugação") : `Adicionar em ${modalTipo}`}
                    </h2>
                  </div>
                  <button
                    type="button"
                    disabled={salvandoPortal}
                    onClick={() => setModalTipo(null)}
                    className="rounded-lg p-2 hover:bg-muted"
                  >
                    <X />
                  </button>
                </div>
                <div className="mt-5 space-y-4">
                  {tipoPreventivo === "vacina" && (
                    <label className="block text-sm font-bold">
                      Tipo de vacina
                      <select value={tipoVacina} onChange={(e) => selecionarVacina(e.target.value)}
                        autoFocus
                        className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal">
                        <option value="" disabled>Selecione uma vacina</option>
                        {vacinasPredefinidas.map(({ grupo, opcoes }) => (
                          <optgroup key={grupo} label={grupo}>
                            {opcoes.map(({ id, nome }) => <option key={id} value={id}>{nome}</option>)}
                          </optgroup>
                        ))}
                        <option value="outro">Outro</option>
                      </select>
                    </label>
                  )}
                  <label className="block text-sm font-bold">
                    {tipoPreventivo ? "Data da aplicação" : "Data"}
                    <input
                      type="date"
                      value={data}
                      readOnly={Boolean(tipoPreventivo)}
                      onChange={tipoPreventivo ? undefined : (e) => setData(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border px-3"
                    />
                    {tipoPreventivo && <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      {preventivoEmEdicao ? "Data histórica do ato, preservada na edição." : "Data automática, confirmada no momento de salvar."}
                    </span>}
                  </label>
                  <label className="block text-sm font-bold">
                    {tipoPreventivo === "vacina" ? "Nome comercial da vacina" : tipoPreventivo === "vermifugo" ? "Produto administrado" : "Título"}
                    <input
                      autoFocus={tipoPreventivo !== "vacina"}
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder={
                        modalTipo === "Vacinas"
                          ? "Nome que consta no rótulo"
                          : modalTipo === "Vermífugos"
                            ? "Ex.: Drontal Plus"
                          : modalTipo === "Exames"
                            ? "Ex.: Hemograma"
                            : "Título do registro"
                      }
                      className="mt-1 min-h-11 w-full rounded-xl border px-3"
                    />
                  </label>
                  {modalTipo === "Exames" && (
                    <label className="block rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-sm font-semibold">
                      Retorno ou revisão do exame (opcional)
                      <input type="date" value={retornoExameEm} onChange={(e) => setRetornoExameEm(e.target.value)}
                        className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"/>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Se preencher, a Central de Relacionamento lembrará a equipe de confirmar a data com o tutor.
                      </span>
                    </label>
                  )}
                  {tipoPreventivo && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-bold">
                        {modalTipo === "Vermífugos" ? "Próxima dose" : "Próximo reforço"}
                        <input
                          type="date"
                          value={reforcoEm}
                          onChange={(e) => setReforcoEm(e.target.value)}
                          className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
                        />
                      </label>
                      <label className="block text-sm font-bold">
                        Lote
                        <input
                          value={lote}
                          onChange={(e) => setLote(e.target.value)}
                          className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
                        />
                      </label>
                    </div>
                  )}
                  {tipoPreventivo && (
                    <CamposDoPreventivo tipo={tipoPreventivo} valores={dadosPreventivos} onChange={setDadosPreventivos}
                      profissional={preventivoEmEdicao ? {
                        nome: preventivoEmEdicao.linha.veterinario_nome,
                        numeroCrmv: preventivoEmEdicao.linha.veterinario_crmv,
                        uf: preventivoEmEdicao.linha.veterinario_uf,
                      } : profissional}
                      erro={preventivoEmEdicao ? "" : erroProfissional} />
                  )}
                  {(modalTipo === "Exames" || modalTipo === "Documentos") && (
                    <label className="block text-sm font-bold">
                      Tipo
                      <input
                        value={tipoDetalhe}
                        onChange={(e) => setTipoDetalhe(e.target.value)}
                        placeholder={
                          modalTipo === "Exames" ? "Ex.: Hemograma" : "Ex.: Laudo, Atestado, Cartão de vacinação"
                        }
                        className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
                        list={modalTipo === "Documentos" ? "tipos-documento-portal" : undefined}
                      />
                      {modalTipo === "Documentos" && <datalist id="tipos-documento-portal">{["Laudo", "Atestado", "Atestado de vacinação", "Comprovante de vermifugação", "Cartão de vacinação", "Carteira de saúde", "Resultado de exame", "Termo", "Relatório", "Orientações", "Outros"].map(t=><option key={t} value={t}/>)}</datalist>}
                    </label>
                  )}
                  {(modalTipo === "Exames" || modalTipo === "Documentos" || modalTipo === "Termos") && (
                    <label className="block rounded-xl border border-dashed p-3 text-sm font-bold">
                      <span className="flex items-center gap-2">
                        <FileUp size={17} /> {modalTipo === "Termos" ? "PDF do termo já existente" : modalTipo === "Exames" ? "PDF do exame" : "PDF do documento ou laudo"} {modalTipo !== "Termos" && "(opcional)"}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="mt-2 block w-full text-sm font-normal"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (
                            file &&
                            (file.type !== "application/pdf" || file.size > PORTAL_PDF_MAX_BYTES)
                          ) {
                            toast.error("Selecione um PDF de até 20 MB.");
                            e.currentTarget.value = "";
                            setArquivoPdf(null);
                            return;
                          }
                          setArquivoPdf(file);
                        }}
                      />
                      {arquivoPdf && (
                        <span className="mt-2 block text-xs font-normal text-muted-foreground">
                          {arquivoPdf.name} · {(arquivoPdf.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      )}
                    </label>
                  )}
                  <label className="block text-sm font-bold">
                    {modalTipo === "Exames" ? "Resumo / resultado" : "Detalhes"}
                    <textarea
                      value={detalhe}
                      onChange={(e) => setDetalhe(e.target.value)}
                      rows={5}
                      className="mt-1 w-full rounded-xl border p-3"
                    />
                  </label>
                  {["Vacinas", "Vermífugos", "Exames", "Documentos", "Termos"].includes(modalTipo) && (
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
                      <div>
                        <div className="text-sm font-black">Visível no Portal do Tutor</div>
                        <div className="text-xs text-muted-foreground">
                          {modalTipo === "Exames" || modalTipo === "Documentos" || modalTipo === "Termos"
                            ? "Ao publicar, o CRM prepara um aviso com link seguro para o Portal do Tutor."
                            : "O tutor só verá este registro se esta opção estiver ativada."}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={visivelTutor}
                        onChange={(e) => setVisivelTutor(e.target.checked)}
                        className="h-5 w-5 accent-primary"
                      />
                    </label>
                  )}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={salvandoPortal}
                    onClick={() => setModalTipo(null)}
                    className="rounded-xl border px-4 py-2.5 font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={salvandoPortal || Boolean(tipoPreventivo && !preventivoEmEdicao && (!profissional || erroProfissional))}
                    onClick={() => void salvarRegistro()}
                    className="rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {salvandoPortal ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {modalPeso && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
              onMouseDown={(e) => {
                if (e.currentTarget === e.target) setModalPeso(false);
              }}
            >
              <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-primary">
                      {animal.nome}
                    </p>
                    <h2 className="text-2xl font-black">Adicionar peso</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalPeso(false)}
                    className="rounded-lg p-2 hover:bg-muted"
                  >
                    <X />
                  </button>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold">
                    Peso (kg)
                    <input
                      autoFocus
                      inputMode="numeric"
                      value={pesoParaCampo(pesoNovo)}
                      onChange={(e) => setPesoNovo(pesoPorDigitacao(e.target.value))}
                      placeholder="0,000"
                      className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-bold">
                    Data
                    <input
                      type="date"
                      value={dataPeso}
                      onChange={(e) => setDataPeso(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
                    />
                  </label>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Digite somente números: 1290 vira 1,290 kg; 12 vira 0,012 kg.
                </p>
                <button
                  type="button"
                  onClick={salvarPeso}
                  className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground"
                >
                  Salvar peso
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function CamposDoPreventivo({ tipo, valores, onChange, profissional, erro }: {
  tipo: TipoPreventivo;
  valores: CamposPreventivos;
  onChange: React.Dispatch<React.SetStateAction<CamposPreventivos>>;
  profissional: { nome: string | null; numeroCrmv: string | null; uf: string | null } | null;
  erro: string;
}) {
  const campos: [keyof CamposPreventivos, string, string?][] = [
    ...(tipo === "vacina"
      ? [["alvo_vacinacao", "Vacinação contra"]] as [keyof CamposPreventivos, string][]
      : [["principio_ativo", "Princípio ativo (quando disponível)"], ["via", "Via de administração"]] as [keyof CamposPreventivos, string][]),
    ["dose", "Dose aplicada e unidade"],
    ["fabricante", tipo === "vacina" ? "Fabricante" : "Fabricante (quando disponível)"],
    ["fabricacao", "Fabricação", "DD/MM/AAAA ou MM/AAAA"],
    ["validade", "Validade", "DD/MM/AAAA ou MM/AAAA"],
  ];
  function campo(chave: keyof CamposPreventivos, rotulo: string, dica?: string) {
    return <label key={chave} className="block text-sm font-bold">
      {rotulo}
      <input value={valores[chave]} type={chave === "hora_aplicacao" ? "time" : "text"}
        maxLength={180} placeholder={dica}
        aria-describedby={chave === "alvo_vacinacao" ? "alvo-vacinacao-ajuda" : undefined}
        onChange={e => onChange(atual => ({ ...atual, [chave]: e.target.value }))}
        className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" />
      {chave === "alvo_vacinacao" && (
        <span id="alvo-vacinacao-ajuda" className="mt-1 block text-xs font-normal text-muted-foreground">
          Confira e ajuste os alvos conforme a bula da vacina aplicada.
        </span>
      )}
    </label>;
  }
  return (
    <>
      <fieldset className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-black">Produto e aplicação</legend>
        {campos.map(([chave, rotulo, dica]) => campo(chave, rotulo, dica))}
        <div className="block text-sm font-bold">
          Horário da aplicação
          <div className="mt-1 flex min-h-11 items-center rounded-xl border bg-muted/30 px-3 font-normal">
            {valores.hora_aplicacao || "Automático ao salvar"}
          </div>
        </div>
        <div className="block text-sm font-bold">
          Município da aplicação
          <div className="mt-1 flex min-h-11 items-center rounded-xl border bg-muted/30 px-3 font-normal">
            {valores.local_aplicacao || "Cidade da clínica, ao salvar"}
          </div>
        </div>
        <p className="text-xs font-normal text-muted-foreground sm:col-span-2">
          Data, horário e município são preenchidos automaticamente. A edição preserva o registro original.
        </p>
      </fieldset>
      <fieldset className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-black">Médico-veterinário responsável pelo ato</legend>
        {erro ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{erro}</p>
          : profissional ? (
            <>
              <div className="sm:col-span-2"><Info rotulo="Nome completo" valor={profissional.nome || undefined} /></div>
              <Info rotulo="Número do CRMV" valor={profissional.numeroCrmv || undefined} />
              <Info rotulo="UF do CRMV" valor={profissional.uf || undefined} />
            </>
          ) : <p role="status" className="text-sm text-muted-foreground sm:col-span-2">Carregando seu cadastro profissional…</p>}
      </fieldset>
    </>
  );
}

function Painel({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
        <h3 className="font-black">{titulo}</h3>
        {acao && (
          <button
            type="button"
            onClick={acao}
            className="inline-flex items-center gap-1 text-xs font-bold text-primary"
          >
            <Plus size={14} /> Adicionar
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
type PortalTutorFicha = {
  clinica_id: string;
  clinica_slug: string;
  tutor_id: string;
  usuario: string | null;
  acesso_ativo: boolean;
  senha_definida: boolean;
  senha_atualizada_em: string | null;
};

function PortalTutorAcessoFicha({ animalId }: { animalId: string }) {
  const [acesso, setAcesso] = useState<PortalTutorFicha | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      setCarregando(true);
      const { data, error } = await (supabaseBanco as any).rpc(
        "oricse_portal_acesso_tutor_ficha",
        { p_animal_id: animalId },
      );
      if (!vivo) return;
      if (error) {
        setAcesso(null);
      } else {
        setAcesso((data?.[0] as PortalTutorFicha | undefined) ?? null);
      }
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [animalId]);

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Consultando acesso protegido…</p>;
  }

  if (!acesso) {
    return <p className="text-sm text-muted-foreground">Não foi possível consultar o acesso do Portal.</p>;
  }

  const portalUrl = urlPortalDoTutor(acesso.clinica_slug);
  if (!acesso.senha_definida) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Este tutor ainda não concluiu o primeiro acesso ao Portal.
        </div>
        <a href="/portal-tutores" className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold">
          Gerenciar ativação <ExternalLink size={15} />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-muted/20 p-3">
        <div className="flex items-center gap-2 text-sm font-black"><ShieldCheck size={16} className="text-primary" /> Portal ativo</div>
        <div className="mt-2 text-sm"><span className="text-muted-foreground">Login: </span><strong>{acesso.usuario || "Não informado"}</strong></div>
        <div className="mt-1 text-xs text-muted-foreground">A senha é protegida e não pode ser visualizada.</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <a href={portalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold">
          Abrir Portal <ExternalLink size={15} />
        </a>
        <a href={portalUrl + "?recuperar=1"} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground">
          Redefinir senha
        </a>
      </div>
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor?: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </div>
      <div className="mt-0.5 text-sm">{valor || "Não informado"}</div>
    </div>
  );
}
function CartaoRegistroClinico({
  registro,
  mostrarDetalhe = false,
}: {
  registro: Registro;
  mostrarDetalhe?: boolean;
}) {
  const resumoId = useId();
  const consulta = ehRegistroConsulta(registro);
  const data = formatarData(registro.data);
  return (
    <Link
      to="/consulta"
      search={{ animalId: registro.animalId, registroId: registro.id } as never}
      aria-label={`Abrir ${registro.titulo} de ${data}`}
      aria-describedby={consulta ? resumoId : undefined}
      className="block min-w-0 rounded-xl border p-3 transition hover:border-primary hover:bg-primary/[0.025] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="text-xs text-muted-foreground">{data}</div>
      <div className="font-bold">{registro.titulo}</div>
      {consulta ? (
        <p id={resumoId} className="mt-1 line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {resumirConsulta(registro)}
        </p>
      ) : mostrarDetalhe && registro.detalhe ? (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {registro.detalhe}
        </p>
      ) : null}
      <div className="mt-1.5 text-xs font-bold text-primary">{consulta ? "Abrir" : "Abrir registro"} →</div>
    </Link>
  );
}
function ListaMini({ registros, vazio }: { registros: Registro[]; vazio: string }) {
  return registros.length ? (
    <div className="space-y-2">
      {registros.map((r) =>
        r.tipo === "Registros clínicos" ? (
          <CartaoRegistroClinico key={r.id} registro={r} />
        ) : (
          <div key={r.id} className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-muted-foreground">{formatarData(r.data)}</div>
                <div className="font-bold">{r.titulo}</div>
              </div>
              {r.fontePortal && (
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-black ${r.visivelTutor ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}
                >
                  {r.visivelTutor ? "Portal" : "Oculto"}
                </span>
              )}
            </div>
          </div>
        ),
      )}
    </div>
  ) : (
    <div className="py-5 text-center text-sm text-muted-foreground">{vazio}</div>
  );
}
function ResumoSecao({
  tipo,
  registros,
  onAdd,
  onOpen,
  animalId,
}: {
  tipo: RegistroTipo;
  registros: Registro[];
  onAdd?: () => void;
  onOpen: () => void;
  animalId: string;
}) {
  const Icon = iconFor(tipo as Aba);
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2.5">
        <button type="button" onClick={onOpen} className="flex items-center gap-2 font-black">
          <Icon size={16} className="text-primary" />
          {tipo}
        </button>
        {tipo === "Registros clínicos" ? (
          <Link
            to="/registro-clinico"
            search={{ animalId } as never}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground"
          >
            <Plus size={13} /> Adicionar
          </Link>
        ) : (
          onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground"
            >
              <Plus size={13} /> Adicionar
            </button>
          )
        )}
      </div>
      <div className="p-3">
        <ListaMini registros={registros} vazio={`Nenhum registro em ${tipo.toLowerCase()}.`} />
      </div>
    </section>
  );
}
function SecaoCompleta({
  aba,
  registros,
  onAdd,
  onBaixarDocumento,
  onVisualizarDocumento,
  onExcluir,
  podeExcluirComoRt,
  onTogglePortal,
  onEditarPreventivo,
  onDocumentoPreventivo,
}: {
  aba: Aba;
  registros: Registro[];
  onAdd: () => void;
  onBaixarDocumento: (registro: Registro) => void;
  onVisualizarDocumento: (registro: Registro) => void;
  onExcluir: (registro: Registro) => void;
  podeExcluirComoRt: boolean;
  onTogglePortal: (registro: Registro, valor: boolean) => void;
  onEditarPreventivo: (registro: Registro) => void;
  onDocumentoPreventivo?: (registro: Registro) => void;
}) {
  const Icon = iconFor(aba);
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon size={19} className="text-primary" />
          <h2 className="text-xl font-black">{aba}</h2>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
        >
          <Plus size={15} /> Adicionar
        </button>
      </div>
      <div className="p-4">
        {registros.length ? (
          <div className="space-y-3">
            {registros.map((r) => (
              <article key={r.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-black">{r.titulo}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatarData(r.data)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.driveArquivoId ? <>
                      <button type="button" onClick={() => onVisualizarDocumento(r)}
                        aria-label={"Visualizar " + r.titulo}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-muted">
                        <Eye size={15} /> Visualizar
                      </button>
                      <button type="button" onClick={() => onBaixarDocumento(r)}
                        aria-label={"Baixar " + r.titulo}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-muted">
                        <Download size={15} /> Baixar
                      </button>
                    </> : (["Receitas", "Exames", "Documentos", "Termos"].includes(aba)
                        ? <span className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Sem arquivo anexado</span> : null)}
                    {podeExcluirComoRt && ["Termos", "Receitas"].includes(aba) &&
                      ((aba === "Termos" && r.fontePortal === "documento") ||
                       (aba === "Receitas" && r.fontePortal === "receita")) && (
                        <button type="button" onClick={() => onExcluir(r)}
                          aria-label={"Excluir " + r.titulo + " (somente RT)"}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-destructive/40 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/5">
                          <Trash2 size={15} /> Excluir
                        </button>
                      )}
                    {r.preventivo && (
                      <>
                      <button
                        type="button"
                        onClick={() => onEditarPreventivo(r)}
                        aria-label={`Editar ${r.titulo}`}
                        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-muted"
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      {onDocumentoPreventivo && <button type="button" onClick={() => onDocumentoPreventivo(r)}
                        aria-label={`Preparar PDF de ${r.titulo}`}
                        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-muted">
                        <FileText size={14} /> Preparar PDF
                      </button>}
                      </>
                    )}
                    {r.subtipo === "Termo - Prévia demonstrativa" ? (
                      <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
                        Prévia interna · não publicada
                      </span>
                    ) : r.fontePortal === "receita" ? (
                      <span
                        className={`rounded-full px-3 py-2 text-xs font-bold ${r.visivelTutor ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
                      >
                        {r.visivelTutor ? "Disponível no Portal" : "Oculta do Portal"}
                      </span>
                    ) : (
                      r.fontePortal && (
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold">
                          <input
                            type="checkbox"
                            checked={Boolean(r.visivelTutor)}
                            onChange={(e) => void onTogglePortal(r, e.target.checked)}
                            className="accent-primary"
                          />{" "}
                          Visível no Portal do Tutor
                        </label>
                      )
                    )}
                  </div>
                </div>
                {r.detalhe && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {r.detalhe}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="py-14 text-center text-muted-foreground">
            <Icon className="mx-auto mb-3 opacity-30" size={34} />
            <p>Nenhum registro em {aba.toLowerCase()}.</p>
          </div>
        )}
      </div>
    </section>
  );
}
function RegistrosClinicos({ animalId, clinicaId, registros }: { animalId: string; clinicaId: string; registros: Registro[] }) {
  const [enviandoAoCrm, setEnviandoAoCrm] = useState(false);
  const [escolhendoPrazo, setEscolhendoPrazo] = useState(false);
  async function enviarAoCrm(dias: number) {
    if (!clinicaId || enviandoAoCrm) return;
    const dataPrevista = calcularDataRetorno(dias);
    setEnviandoAoCrm(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      const resultado = await registrarRetornoClinico({ data: {
        accessToken: token, clinicaId, animalId, origem: "manual",
        titulo: "Retorno clínico", orientacoes: "", dataPrevista,
      } });
      setEscolhendoPrazo(false);
      toast.success(
        (resultado.criado ? "Novo retorno enviado ao CRM. " : "Retorno encontrado no CRM. ") +
        "Retorno previsto: " + formatarDataRetorno(dataPrevista) + "."
      );
    } catch (erro) { toast.error(erro instanceof Error ? erro.message : "Não foi possível enviar o retorno ao CRM."); }
    finally { setEnviandoAoCrm(false); }
  }
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b bg-muted/20 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><ClipboardList size={20} className="text-primary" /><h2 className="text-xl font-black">Registros clínicos</h2></div>
          <button type="button" disabled={!clinicaId || enviandoAoCrm} onClick={() => setEscolhendoPrazo(aberto => !aberto)} aria-expanded={escolhendoPrazo} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/40 bg-white px-3 text-sm font-bold text-primary disabled:opacity-50"><CalendarDays size={16} /> {enviandoAoCrm ? "Enviando..." : "Enviar para o CRM"}</button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre uma consulta, cirurgia ou procedimento no prontuário do animal.
        </p>
        {escolhendoPrazo && <div className="mt-4 rounded-xl border border-primary/20 bg-white p-4">
          <p className="text-sm font-bold">Quando o paciente deve retornar?</p>
          <p className="mt-1 text-xs text-muted-foreground">Selecione o prazo. A data é calculada a partir de hoje e o retorno é salvo no CRM automaticamente.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {OPCOES_DIAS_RETORNO.map(dias => <button key={dias} type="button" disabled={enviandoAoCrm}
              onClick={() => void enviarAoCrm(dias)}
              className="min-h-14 rounded-lg border border-primary/25 bg-background px-2 py-2 text-center text-sm font-bold transition hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">
              <span className="block">{dias} dias</span>
              <span className="block text-xs font-normal text-muted-foreground">{formatarDataRetorno(calcularDataRetorno(dias))}</span>
            </button>)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">A equipe verá o retorno na fila de acompanhamento 2 dias antes da data prevista.</p>
        </div>}
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid w-full min-w-0 auto-rows-fr grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
          <RegistroCard
            icon={Stethoscope}
            titulo="Consulta"
            texto="Anamnese, exame clínico, conduta, receita e exames."
            animalId={animalId}
            tipo="consulta"
          />
          <RegistroCard
            icon={Scissors}
            titulo="Cirurgia / Procedimento"
            texto="Indicação, equipe, anestesia, achados e pós-operatório."
            animalId={animalId}
            tipo="procedimento"
          />
        </div>
        {registros.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
              Últimos registros
            </div>
            <div className="space-y-2">
              {registros.map((r) => (
                <CartaoRegistroClinico key={r.id} registro={r} mostrarDetalhe />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
function RegistroCard({
  icon: Icon,
  titulo,
  texto,
  animalId,
  tipo,
}: {
  icon: typeof Stethoscope;
  titulo: string;
  texto: string;
  animalId: string;
  tipo: "consulta" | "procedimento";
}) {
  return (
    <Link
      to="/registro-clinico"
      search={{ animalId, tipo } as never}
      className="group flex h-full w-full min-w-0 flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon size={24} />
      </div>
      <h3 className="mt-4 text-lg font-bold">{titulo}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{texto}</p>
      <div className="mt-5 flex items-center justify-between border-t pt-3 text-sm font-semibold text-primary">
        <span>{tipo === "consulta" ? "Iniciar consulta" : "Registrar procedimento"}</span>
        <ArrowRight size={18} />
      </div>
    </Link>
  );
}

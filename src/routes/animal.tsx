import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  ClipboardList,
  FileText,
  FileUp,
  FlaskConical,
  Image,
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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FotoAnimalDrive } from "@/components/animal/FotoAnimalDrive";
import { AgendamentosAnimal } from "@/components/animal/AgendamentosAnimal";
import { ObservacoesAnimal } from "@/components/animal/ObservacoesAnimal";
import { codigoPublicoTutor } from "@/lib/codigo-tutor";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { enviarArquivoDrive } from "@/lib/drive.functions";

export const Route = createFileRoute("/animal")({ component: AnimalFicha });

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
  | "Receitas"
  | "Exames"
  | "Agendamentos"
  | "Internações"
  | "Termos"
  | "Observações"
  | "Documentos"
  | "Galeria";
type FontePortal = "vacina" | "exame" | "documento" | "receita";
type Registro = {
  id: string;
  animalId: string;
  tipo: RegistroTipo;
  titulo: string;
  detalhe?: string;
  data: string;
  criadoEm: string;
  subtipo?: string;
  autorId?: string;
  autorNome?: string;
  autorCrmv?: string;
  atualizadoEm?: string;
  visivelTutor?: boolean;
  fontePortal?: FontePortal;
  motivoOcultacao?: string | null;
  driveArquivoId?: string | null;
};
type PesoRegistro = { id: string; animalId: string; peso: number; data: string; criadoEm: string };
type VacinaPortal = {
  id: string;
  animal_id: string;
  nome: string;
  aplicada_em: string | null;
  reforco_em: string | null;
  lote: string | null;
  observacoes: string | null;
  visivel_tutor: boolean;
  created_at: string;
};
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
  if (tipo === "Vacinas") return Syringe;
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

function AnimalFicha() {
  const busca = useSearch({ strict: false }) as { animalId?: unknown };
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
        const { data: cid, error: eCid } = await (supabaseBanco as any).rpc(
          "oricse_resolver_clinica_cadastro_animal",
          { p_animal: animalId },
        );
        if (eCid || !cid) throw Error(eCid?.message || "Clínica do animal não identificada.");
        const { data, error } = await (supabaseBanco as any).rpc("oricse_animal_cadastro_tela", {
          p_clinica: cid,
          p_animal: animalId,
        });
        if (error) throw error;
        if (!vivo) return;
        const a = data?.animal;
        const t = data?.tutor;
        setErroFicha("");
        setAnimal(a ? { ...a, peso: a.peso == null ? "" : String(a.peso) } : null);
        setTutor(t || null);
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
  }, [animalId]);
  const [aba, setAba] = useState<Aba>("Visão geral");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [registrosPortal, setRegistrosPortal] = useState<Registro[]>([]);
  const [clinicaId, setClinicaId] = useState("");
  const [pesos, setPesos] = useState<PesoRegistro[]>([]);
  const [modalTipo, setModalTipo] = useState<RegistroTipo | null>(null);
  const [modalPeso, setModalPeso] = useState(false);
  const [pesoNovo, setPesoNovo] = useState("");
  const [dataPeso, setDataPeso] = useState(() => new Date().toISOString().slice(0, 10));
  const [titulo, setTitulo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [visivelTutor, setVisivelTutor] = useState(false);
  const [reforcoEm, setReforcoEm] = useState("");
  const [lote, setLote] = useState("");
  const [tipoDetalhe, setTipoDetalhe] = useState("");
  const [salvandoPortal, setSalvandoPortal] = useState(false);
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null);

  async function carregarConteudosPortal() {
    if (!animalId) return;
    try {
      const { data: cid, error: erroClinica } = await (supabaseBanco as any).rpc(
        "oricse_resolver_clinica_cadastro_animal",
        { p_animal: animalId },
      );
      if (erroClinica || !cid) throw Error(erroClinica?.message || "Clínica não identificada.");
      setClinicaId(cid);
      const [vacinasResult, examesResult, docsResult, receitasResult] = await Promise.all([
        (supabaseBanco as any)
          .from("oricse_portal_vacinas")
          .select(
            "id,animal_id,nome,aplicada_em,reforco_em,lote,observacoes,visivel_tutor,created_at",
          )
          .eq("clinica_id", cid)
          .eq("animal_id", animalId)
          .order("aplicada_em", { ascending: false, nullsFirst: false }),
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
          .order("data_documento", { ascending: false, nullsFirst: false }),
        (supabaseBanco as any)
          .from("oricse_portal_receitas")
          .select(
            "id,animal_id,tipo,numero,titulo,emitida_em,visivel_tutor,motivo_ocultacao,motivo_outro,drive_arquivo_id,created_at",
          )
          .eq("clinica_id", cid)
          .eq("animal_id", animalId)
          .order("emitida_em", { ascending: false }),
      ]);
      for (const r of [vacinasResult, examesResult, docsResult, receitasResult])
        if (r.error) throw r.error;
      const vacinas = (vacinasResult.data || []) as VacinaPortal[];
      const exames = (examesResult.data || []) as ExamePortal[];
      const docs = (docsResult.data || []) as DocumentoPortal[];
      const receitas = (receitasResult.data || []) as ReceitaPortal[];
      const convertidos: Registro[] = [
        ...vacinas.map((v) => ({
          id: v.id,
          animalId: v.animal_id,
          tipo: "Vacinas" as const,
          titulo: v.nome,
          detalhe: [
            v.observacoes,
            v.reforco_em ? `Reforço: ${formatarData(v.reforco_em)}` : "",
            v.lote ? `Lote: ${v.lote}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          data: v.aplicada_em || v.created_at.slice(0, 10),
          criadoEm: v.created_at,
          visivelTutor: v.visivel_tutor,
          fontePortal: "vacina" as const,
        })),
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
          tipo: "Documentos" as const,
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
      toast.error("Não foi possível carregar vacinas, exames, receitas e documentos do banco.");
    }
  }
  useEffect(() => {
    void carregarConteudosPortal();
  }, [animalId]);

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
      registros.filter((r) => !["Vacinas", "Exames", "Documentos", "Receitas"].includes(r.tipo)),
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
    if (tipo === "Receitas" && animal) {
      window.location.href = `/receituario?tutorId=${encodeURIComponent(animal.tutorId)}&animalId=${encodeURIComponent(animal.id)}`;
      return;
    }
    if (tipo === "Observações") {
      setAba("Observações");
      return;
    }
    setModalTipo(tipo);
    setTitulo("");
    setDetalhe("");
    setData(new Date().toISOString().slice(0, 10));
    setVisivelTutor(false);
    setReforcoEm("");
    setLote("");
    setArquivoPdf(null);
    setTipoDetalhe(tipo === "Exames" ? "Exame" : tipo === "Documentos" ? "Documento" : "");
  }

  async function salvarRegistro() {
    if (!animal || !modalTipo) return;
    if (!titulo.trim()) return void toast.error("Informe o título do registro.");
    if (["Vacinas", "Exames", "Documentos"].includes(modalTipo)) {
      if (!clinicaId) return void toast.error("Não foi possível identificar a clínica atual.");
      if (
        modalTipo === "Exames" &&
        arquivoPdf &&
        (arquivoPdf.type !== "application/pdf" || arquivoPdf.size > 20 * 1024 * 1024)
      )
        return void toast.error("O exame deve ser um PDF de até 20 MB.");
      setSalvandoPortal(true);
      try {
        if (modalTipo === "Vacinas") {
          const { error } = await (supabaseBanco as any).from("oricse_portal_vacinas").insert({
            clinica_id: clinicaId,
            animal_id: animal.id,
            nome: titulo.trim(),
            aplicada_em: data || null,
            reforco_em: reforcoEm || null,
            lote: lote.trim() || null,
            observacoes: detalhe.trim() || null,
            visivel_tutor: visivelTutor,
          });
          if (error) throw error;
        } else if (modalTipo === "Exames") {
          const exameId = crypto.randomUUID();
          let driveArquivoId: string | null = null;
          if (arquivoPdf) {
            const { data: sessao } = await supabase.auth.getSession();
            const accessToken = sessao.session?.access_token;
            if (!accessToken) throw new Error("Sessão não encontrada para enviar o PDF.");
            const base64 = await arquivoParaDataUrl(arquivoPdf);
            const upload = await enviarArquivoDrive({
              data: {
                accessToken,
                clinicaId,
                categoria: "exames",
                nome: arquivoPdf.name,
                mimeType: "application/pdf",
                base64,
                visibilidade: visivelTutor ? "tutor" : "interno",
                entidadeTipo: "exame",
                entidadeId: exameId,
                metadata: {
                  animalId: animal.id,
                  animalNome: animal.nome,
                  titulo: titulo.trim(),
                  tipo: tipoDetalhe.trim() || "Exame",
                },
              },
            });
            driveArquivoId = upload.arquivo.id;
          }
          const { error } = await (supabaseBanco as any).from("oricse_portal_exames").insert({
            id: exameId,
            clinica_id: clinicaId,
            animal_id: animal.id,
            titulo: titulo.trim(),
            tipo: tipoDetalhe.trim() || "Exame",
            realizado_em: data || null,
            resultado_resumo: detalhe.trim() || null,
            drive_arquivo_id: driveArquivoId,
            visivel_tutor: visivelTutor,
          });
          if (error) throw error;
        } else {
          const { error } = await (supabaseBanco as any).from("oricse_portal_documentos").insert({
            clinica_id: clinicaId,
            animal_id: animal.id,
            titulo: titulo.trim(),
            tipo: tipoDetalhe.trim() || "Documento",
            data_documento: data || null,
            observacoes: detalhe.trim() || null,
            visivel_tutor: visivelTutor,
          });
          if (error) throw error;
        }
        await carregarConteudosPortal();
        setModalTipo(null);
        setArquivoPdf(null);
        toast.success(`${modalTipo} adicionado no banco.`);
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

  async function alternarVisibilidade(registro: Registro, valor: boolean) {
    if (!registro.fontePortal || !clinicaId || registro.fontePortal === "receita") return;
    const tabela =
      registro.fontePortal === "vacina"
        ? "oricse_portal_vacinas"
        : registro.fontePortal === "exame"
          ? "oricse_portal_exames"
          : "oricse_portal_documentos";
    setRegistrosPortal((lista) =>
      lista.map((item) => (item.id === registro.id ? { ...item, visivelTutor: valor } : item)),
    );
    const { error } = await (supabaseBanco as any)
      .from(tabela)
      .update({ visivel_tutor: valor, updated_at: new Date().toISOString() })
      .eq("id", registro.id)
      .eq("clinica_id", clinicaId);
    if (error) {
      setRegistrosPortal((lista) =>
        lista.map((item) => (item.id === registro.id ? { ...item, visivelTutor: !valor } : item)),
      );
      toast.error("Não foi possível alterar a visibilidade no portal.");
      return;
    }
    toast.success(
      valor ? "Registro liberado no Portal do Tutor." : "Registro ocultado do Portal do Tutor.",
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
              </aside>
              <section className="space-y-3">
                {(
                  [
                    "Registros clínicos",
                    "Vacinas",
                    "Exames",
                    "Receitas",
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
            <SecaoCompleta
              aba={aba}
              registros={registrosAnimal.filter((r) => r.tipo === aba)}
              onAdd={() => abrirNovo(aba as RegistroTipo)}
              onTogglePortal={alternarVisibilidade}
            />
          )}

          {modalTipo && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
              onMouseDown={(e) => {
                if (e.currentTarget === e.target) setModalTipo(null);
              }}
            >
              <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">
                      {animal.nome}
                    </p>
                    <h2 className="text-2xl font-black">Adicionar em {modalTipo}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalTipo(null)}
                    className="rounded-lg p-2 hover:bg-muted"
                  >
                    <X />
                  </button>
                </div>
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-bold">
                    Data
                    <input
                      type="date"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border px-3"
                    />
                  </label>
                  <label className="block text-sm font-bold">
                    Título
                    <input
                      autoFocus
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder={
                        modalTipo === "Vacinas"
                          ? "Ex.: V10"
                          : modalTipo === "Exames"
                            ? "Ex.: Hemograma"
                            : "Título do registro"
                      }
                      className="mt-1 min-h-11 w-full rounded-xl border px-3"
                    />
                  </label>
                  {modalTipo === "Vacinas" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-bold">
                        Próximo reforço
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
                  {(modalTipo === "Exames" || modalTipo === "Documentos") && (
                    <label className="block text-sm font-bold">
                      Tipo
                      <input
                        value={tipoDetalhe}
                        onChange={(e) => setTipoDetalhe(e.target.value)}
                        placeholder={
                          modalTipo === "Exames" ? "Ex.: Hemograma" : "Ex.: Laudo, Termo"
                        }
                        className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
                      />
                    </label>
                  )}
                  {modalTipo === "Exames" && (
                    <label className="block rounded-xl border border-dashed p-3 text-sm font-bold">
                      <span className="flex items-center gap-2">
                        <FileUp size={17} /> PDF do exame (opcional)
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="mt-2 block w-full text-sm font-normal"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (
                            file &&
                            (file.type !== "application/pdf" || file.size > 20 * 1024 * 1024)
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
                  {["Vacinas", "Exames", "Documentos"].includes(modalTipo) && (
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
                      <div>
                        <div className="text-sm font-black">Visível no Portal do Tutor</div>
                        <div className="text-xs text-muted-foreground">
                          O tutor só verá este registro se esta opção estiver ativada.
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
                    onClick={() => setModalTipo(null)}
                    className="rounded-xl border px-4 py-2.5 font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={salvandoPortal}
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
function ListaMini({ registros, vazio }: { registros: Registro[]; vazio: string }) {
  return registros.length ? (
    <div className="space-y-2">
      {registros.map((r) =>
        r.tipo === "Registros clínicos" ? (
          <Link
            key={r.id}
            to="/consulta"
            search={{ animalId: r.animalId, registroId: r.id } as never}
            className="block rounded-xl border p-3 transition hover:border-primary hover:bg-primary/[0.025]"
          >
            <div className="text-xs text-muted-foreground">{formatarData(r.data)}</div>
            <div className="font-bold">{r.titulo}</div>
            <div className="mt-1 text-[11px] font-bold text-primary">Abrir consulta →</div>
          </Link>
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
  onTogglePortal,
}: {
  aba: Aba;
  registros: Registro[];
  onAdd: () => void;
  onTogglePortal: (registro: Registro, valor: boolean) => void;
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
                  {r.fontePortal === "receita" ? (
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
function RegistrosClinicos({ animalId, registros }: { animalId: string; registros: Registro[] }) {
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b bg-muted/20 px-4 py-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-primary" />
          <h2 className="text-xl font-black">Registros clínicos</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre uma consulta, cirurgia ou procedimento no prontuário do animal.
        </p>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
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
                <Link
                  key={r.id}
                  to="/consulta"
                  search={{ animalId, registroId: r.id } as never}
                  className="block rounded-xl border p-3 transition hover:border-primary hover:bg-primary/[0.025]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{r.titulo}</strong>
                    <span className="text-xs text-muted-foreground">{formatarData(r.data)}</span>
                  </div>
                  {r.detalhe && (
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {r.detalhe}
                    </p>
                  )}
                  <div className="mt-2 text-[11px] font-black text-primary">Abrir registro →</div>
                </Link>
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
      className="group flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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

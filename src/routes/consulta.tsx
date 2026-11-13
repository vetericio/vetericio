// Prontuário estruturado com versão original preservada e adendos.
import { descarregarOricseStorage, oricseStorage } from "@/lib/oricse-storage";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ClipboardList, History, Save, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { supabaseBanco } from "@/integrations/supabase/client";
import { codigoPublicoTutor } from "@/lib/codigo-tutor";
import { obterAutorClinico } from "@/lib/perfil-clinico";
import { toast } from "sonner";

export const Route = createFileRoute("/consulta")({ component: ConsultaSalva });

type Registro = {
  id: string;
  animalId: string;
  tipo: string;
  titulo: string;
  detalhe?: string;
  data: string;
  criadoEm: string;
  subtipo?: string;
  tutorId?: string;
  clinicaId?: string;
  autorId?: string;
  autorNome?: string;
  autorCrmv?: string;
  atualizadoEm?: string;
  status?: "rascunho" | "concluido" | "adendo";
  versao?: number;
  adendoDe?: string;
  dados?: unknown;
};

type Animal = { id: string; nome: string; especie?: string; raca?: string; tutorId: string };
type Tutor = { id: string; nome: string; telefone?: string; outroTelefone?: string; codigoPublico?: string; codigo?: string };

const PRONTUARIO_KEY = "oricse-prontuario-animal-v1";
const ANIMAIS_KEY = "oricse-animais-v1";
const TUTORES_KEY = "oricse-tutores-v1";

function ler<T>(chave: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const valor = JSON.parse(oricseStorage.getItem(chave) || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

function dataBR(valor?: string) {
  if (!valor) return "—";
  const [a, m, d] = valor.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : valor;
}

type CampoPreenchido = { titulo: string; itens: string[] };

// A visualização é filtrada; o conteúdo original nunca é editado ou descartado.
function semInformacao(valor: string) {
  const normalizado = valor.trim().toLocaleLowerCase("pt-BR")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.!?\s]+$/g, "");
  return !normalizado || [
    "nao informado", "nao informada", "nao preenchido", "nao preenchida",
    "sem informacao", "sem informacoes", "-", "—",
  ].includes(normalizado);
}

function camposPreenchidos(detalhe?: string): CampoPreenchido[] {
  const secoes: CampoPreenchido[] = [];
  let atual: CampoPreenchido | null = null;
  const cabecalho = /^(Queixa principal|Tutor relata|Observações por sistema|Exame clínico|Hipóteses\s*\/\s*suspeitas|Conduta\s*\/\s*orientações|Retorno|Medicações\s*\/\s*receita|Exames solicitados|Exames oftalmológicos)\s*:\s*(.*)$/i;
  for (const origem of (detalhe || "").split(/\r?\n/)) {
    const linha = origem.trim().replace(/^[-•]\s*/, "").trim();
    if (!linha) continue;
    const titulo = cabecalho.exec(linha);
    if (titulo) {
      atual = { titulo: titulo[1], itens: [] };
      secoes.push(atual);
      if (!semInformacao(titulo[2])) atual.itens.push(titulo[2].trim());
    } else if (!semInformacao(linha)) {
      if (!atual) {
        atual = { titulo: "Outras informações registradas", itens: [] };
        secoes.push(atual);
      }
      atual.itens.push(linha);
    }
  }
  return secoes.filter((secao) => secao.itens.length > 0);
}

function ConsultaSalva() {
  const busca = useSearch({ strict: false }) as { registroId?: unknown; animalId?: unknown };
  const registroId = typeof busca.registroId === "string" ? busca.registroId : "";
  const animalIdParam = typeof busca.animalId === "string" ? busca.animalId : "";
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [registrosRelacionados, setRegistrosRelacionados] = useState<Registro[]>([]);
  const [adendoTexto, setAdendoTexto] = useState("");
  const [salvandoAdendo, setSalvandoAdendo] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro("");
    setRegistro(null);
    setAnimal(null);
    setTutor(null);
    async function carregar() {
      try {
        if (!animalIdParam || !registroId) {
          throw new Error("O link da consulta não contém a identificação do animal ou do registro.");
        }
        // As fichas atuais são consultadas no PostgreSQL, a mesma fonte usada pela tela do animal.
        const { data: clinicaId, error: erroClinica } = await (supabaseBanco as any).rpc(
          "oricse_resolver_clinica_cadastro_animal",
          { p_animal: animalIdParam },
        );
        if (erroClinica || !clinicaId)
          throw new Error(erroClinica?.message || "Clínica do animal não identificada.");
        const [ficha, historico] = await Promise.all([
          (supabaseBanco as any).rpc("oricse_animal_cadastro_tela", {
            p_clinica: clinicaId,
            p_animal: animalIdParam,
          }),
          (supabaseBanco as any).rpc("oricse_animal_historico", {
            p_animal: animalIdParam,
          }),
        ]);
        if (ficha.error) throw ficha.error;
        if (historico.error) throw historico.error;
        if (!ficha.data?.animal) throw new Error("Animal não encontrado nesta clínica.");

        const registrosBanco: Registro[] = historico.data?.registros || [];
        const encontradoBanco = registrosBanco.find(
          (item) => item.id === registroId && item.animalId === animalIdParam,
        );
        // Compatibilidade somente para registros legados do MESMO animal autorizado pelo backend.
        const encontradoLegado = ler<Registro>(PRONTUARIO_KEY).find(
          (item) => item.id === registroId && item.animalId === animalIdParam,
        );
        const combinado = [...registrosBanco, ...ler<Registro>(PRONTUARIO_KEY).filter((item) => item.animalId === animalIdParam)];
        const porId = new Map(combinado.map((item) => [item.id, item]));
        const relacionado = [...porId.values()];
        const encontrado = encontradoBanco || encontradoLegado;
        if (!encontrado) throw new Error("Consulta não encontrada no histórico do animal.");
        if (!ativo) return;
        setAnimal({
          ...ficha.data.animal,
          id: animalIdParam,
          tutorId: ficha.data.animal.tutorId || ficha.data.tutor?.id || "",
        });
        setTutor(ficha.data.tutor || null);
        setRegistrosRelacionados(relacionado);
        setRegistro(encontrado);
      } catch (error) {
        if (ativo) setErro(error instanceof Error ? error.message : "Não foi possível abrir esta consulta.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, [animalIdParam, registroId]);

  const secoes = camposPreenchidos(registro?.detalhe);
  const adendos = registro ? registrosRelacionados.filter((item) => item.adendoDe === registro.id).sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm))) : [];

  async function salvarAdendo() {
    if (!registro || !animal || !adendoTexto.trim() || salvandoAdendo) return;
    setSalvandoAdendo(true);
    setErro("");
    try {
      const autor = await obterAutorClinico();
      const agora = new Date().toISOString();
      const novo: Registro = {
        id: crypto.randomUUID(), animalId: animal.id, tutorId: tutor?.id, clinicaId: registro.clinicaId,
        autorId: autor.id, autorNome: autor.identificacao, autorCrmv: autor.crmv || undefined, tipo: registro.tipo, subtipo: registro.subtipo, titulo: "Adendo — " + (registro.titulo || "Registro clínico"),
        detalhe: "ADENDO DO PRONTUÁRIO\n\n" + adendoTexto.trim(), data: agora.slice(0, 10), criadoEm: agora, atualizadoEm: agora,
        status: "adendo", versao: (registro.versao || 1) + adendos.length + 1, adendoDe: registro.id,
        dados: { tipo: "adendo", texto: adendoTexto.trim(), registroOriginalId: registro.id },
      };
      const atual = ler<Registro>(PRONTUARIO_KEY);
      oricseStorage.setItem(PRONTUARIO_KEY, JSON.stringify([novo, ...atual]));
      await descarregarOricseStorage();
      setRegistrosRelacionados((lista) => [...lista, novo]);
      setAdendoTexto("");
      toast.success("Adendo salvo no prontuário.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o adendo.");
    } finally {
      setSalvandoAdendo(false);
    }
  }

  if (carregando || !registro || !animal) {
    return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link to="/animais" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link>
      <div role={!carregando && erro ? "alert" : undefined} className="mt-6 rounded-2xl border p-6">
        {carregando ? "Carregando consulta…" : erro || "Consulta não encontrada."}
      </div>
    </main>;
  }

  return <main className="mx-auto min-h-screen w-full max-w-[940px] px-4 pb-24 pt-5 text-foreground sm:px-6 sm:pt-7">
    <Link
      to="/animal"
      search={{ animalId: animal.id } as never}
      className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ArrowLeft size={18} aria-hidden="true" />
      Voltar para {animal.nome}
    </Link>

    <article className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm" aria-labelledby="titulo-registro-clinico">
      <header className="border-b border-border bg-white px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex items-center gap-2 text-sm font-bold text-primary">
          <Stethoscope size={18} aria-hidden="true" />
          Registro clínico
        </div>
        <h1 id="titulo-registro-clinico" className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
          {registro.titulo || "Consulta"}
        </h1>
        <dl className="mt-5 grid grid-cols-1 gap-x-7 gap-y-3 rounded-xl bg-slate-50 px-4 py-4 sm:grid-cols-2">
          {registro.data && <div>
            <dt className="text-sm font-semibold text-slate-600">Data do atendimento</dt>
            <dd className="mt-1 text-base font-semibold text-slate-950">{dataBR(registro.data)}</dd>
          </div>}
          <div>
            <dt className="text-sm font-semibold text-slate-600">Paciente</dt>
            <dd className="mt-1 text-base font-semibold text-slate-950">{animal.nome}</dd>
          </div>
          {tutor?.nome && <div>
            <dt className="text-sm font-semibold text-slate-600">Tutor</dt>
            <dd className="mt-1 text-base font-semibold text-slate-950">{tutor.nome}</dd>
          </div>}
          {tutor && codigoPublicoTutor(tutor) && <div>
            <dt className="text-sm font-semibold text-slate-600">Identificação do tutor</dt>
            <dd className="mt-1 text-base font-medium text-slate-950">{codigoPublicoTutor(tutor)}</dd>
          </div>}
          {(tutor?.telefone || tutor?.outroTelefone) && <div>
            <dt className="text-sm font-semibold text-slate-600">Contato</dt>
            <dd className="mt-1 text-base font-medium text-slate-950">{[tutor.telefone, tutor.outroTelefone].filter(Boolean).join(" · ")}</dd>
          </div>}
          {registro.autorNome && <div>
            <dt className="text-sm font-semibold text-slate-600">Autor do registro</dt>
            <dd className="mt-1 text-base font-medium text-slate-950">{[registro.autorNome, registro.autorCrmv].filter(Boolean).join(" · ")}</dd>
          </div>}
        </dl>
      </header>

      <div className="px-5 py-5 sm:px-8 sm:py-7">
        <h2 className="text-lg font-bold text-slate-950">Informações registradas</h2>
        {secoes.length > 0 ? (
          <div className="mt-2 divide-y divide-slate-200">
            {secoes.map((secao, index) => (
              <section key={secao.titulo + index} className="py-4 first:pt-3 last:pb-0">
                <h3 className="text-base font-bold leading-6 text-primary sm:text-lg">{secao.titulo}</h3>
                <div className="mt-2 space-y-2">
                  {secao.itens.map((item, indice) => (
                    <p key={indice} className="whitespace-pre-wrap break-words text-base leading-7 text-slate-950">
                      {item}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-5 text-base text-slate-700">
            <ClipboardList size={20} aria-hidden="true" />
            Este registro não contém informações clínicas preenchidas.
          </div>
        )}
      </div>
    </article>

    <details className="group mt-4 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary sm:px-8 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3 text-base font-bold text-slate-950">
          <History size={19} className="shrink-0 text-primary" aria-hidden="true" />
          Histórico e adendos
          {adendos.length > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{adendos.length}</span>}
        </span>
        <ChevronDown size={20} className="shrink-0 text-slate-600 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-border px-5 pb-6 pt-5 sm:px-8">
        <p className="text-sm leading-6 text-slate-700">
          O registro original é preservado. Os complementos são adicionados em ordem cronológica, sem substituir informações anteriores.
        </p>

        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            Consultar texto original · v{registro.versao || 1} · {dataBR(registro.criadoEm || registro.data)}
          </summary>
          <p className="whitespace-pre-wrap break-words border-t border-slate-200 px-4 py-4 text-base leading-7 text-slate-900">
            {registro.detalhe || "Sem texto registrado."}
          </p>
        </details>

        {adendos.map((adendo) => (
          <article key={adendo.id} className="mt-3 border-b border-slate-200 py-4 last:border-b-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-bold text-slate-950">Adendo {adendo.versao ? "· v" + adendo.versao : ""}</h3>
              <time className="text-sm font-medium text-slate-600">{dataBR(adendo.criadoEm)}</time>
            </div>
            {adendo.autorNome && <p className="mt-1 text-sm text-slate-600">{[adendo.autorNome, adendo.autorCrmv].filter(Boolean).join(" · ")}</p>}
            <p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-slate-950">
              {adendo.detalhe?.replace(/^ADENDO DO PRONTUÁRIO\n\n/, "")}
            </p>
          </article>
        ))}

        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-lg font-bold text-slate-950">Adicionar adendo</h3>
          <p id="ajuda-adendo" className="mt-1 text-sm leading-6 text-slate-700">
            Registre correções ou informações complementares. O texto original não será alterado.
          </p>
          <label htmlFor="texto-adendo" className="mt-4 block text-sm font-semibold text-slate-950">Texto do adendo</label>
          <textarea
            id="texto-adendo"
            aria-describedby="ajuda-adendo"
            value={adendoTexto}
            onChange={(event) => setAdendoTexto(event.target.value)}
            rows={4}
            placeholder="Escreva a informação clínica adicional."
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base leading-7 text-slate-950 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {erro && <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{erro}</p>}
          <button
            type="button"
            disabled={!adendoTexto.trim() || salvandoAdendo}
            onClick={() => void salvarAdendo()}
            className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={17} aria-hidden="true" />
            {salvandoAdendo ? "Salvando..." : "Salvar adendo"}
          </button>
        </div>
      </div>
    </details>
  </main>;
}

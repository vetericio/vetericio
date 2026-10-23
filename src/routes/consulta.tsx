import { oricseStorage } from "@/lib/oricse-storage";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, ClipboardList, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { supabaseBanco } from "@/integrations/supabase/client";
import { codigoPublicoTutor } from "@/lib/codigo-tutor";

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

function separarDetalhe(detalhe?: string) {
  return (detalhe || "")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);
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
        const encontrado = encontradoBanco || encontradoLegado;
        if (!encontrado) throw new Error("Consulta não encontrada no histórico do animal.");
        if (!ativo) return;
        setAnimal({
          ...ficha.data.animal,
          id: animalIdParam,
          tutorId: ficha.data.animal.tutorId || ficha.data.tutor?.id || "",
        });
        setTutor(ficha.data.tutor || null);
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

  const linhas = separarDetalhe(registro?.detalhe);

  if (carregando || !registro || !animal) {
    return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link to="/animais" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link>
      <div role={!carregando && erro ? "alert" : undefined} className="mt-6 rounded-2xl border p-6">
        {carregando ? "Carregando consulta…" : erro || "Consulta não encontrada."}
      </div>
    </main>;
  }

  return <main className="mx-auto min-h-screen w-full max-w-[1100px] px-4 pb-28 pt-6 sm:px-6">
    <Link to="/animal" search={{ animalId: animal.id } as never} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar para {animal.nome}</Link>

    <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b bg-primary/[0.035] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary"><Stethoscope size={16}/> Registro clínico</div>
            <h1 className="mt-2 text-3xl font-black">{registro.titulo || "Consulta"}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={14}/> {dataBR(registro.data)}</span>
              <span><strong className="text-foreground">Animal:</strong> {animal.nome}</span>
              <span><strong className="text-foreground">Tutor:</strong> {tutor?.nome || "—"}</span>
              {tutor && codigoPublicoTutor(tutor) && <span><strong className="text-foreground">ID do tutor:</strong> {codigoPublicoTutor(tutor)}</span>}
              {(tutor?.telefone || tutor?.outroTelefone) && <span>{[tutor.telefone, tutor.outroTelefone].filter(Boolean).join(" · ")}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {linhas.length ? <div className="space-y-3">
          {linhas.map((linha, index) => {
            const ehTitulo = /^(Queixa principal|Tutor relata|Observações por sistema|Exames oftalmológicos|Exame clínico|Hipóteses \/ suspeitas|Exames solicitados|Medicações|Conduta|Retorno):/.test(linha);
            const [rotulo, ...resto] = linha.split(":");
            const valor = resto.join(":").trim();
            return ehTitulo ? <section key={`${linha}-${index}`} className="rounded-2xl border bg-slate-50/60 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-primary">{rotulo}</div>
              {valor && <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{valor}</div>}
            </section> : <div key={`${linha}-${index}`} className="rounded-xl border px-4 py-3 text-sm leading-relaxed">{linha.replace(/^[-•]\s*/, "")}</div>;
          })}
        </div> : <div className="py-16 text-center text-muted-foreground"><ClipboardList className="mx-auto mb-3 opacity-30" size={36}/><p>Este registro não possui detalhes salvos.</p></div>}
      </div>
    </section>
  </main>;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, ClipboardList, Stethoscope } from "lucide-react";
import { useMemo } from "react";
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
    const valor = JSON.parse(localStorage.getItem(chave) || "[]");
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
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const registroId = params.get("registroId") || "";
  const animalIdParam = params.get("animalId") || "";

  const registros = useMemo(() => ler<Registro>(PRONTUARIO_KEY), []);
  const animais = useMemo(() => ler<Animal>(ANIMAIS_KEY), []);
  const tutores = useMemo(() => ler<Tutor>(TUTORES_KEY), []);

  const registro = registros.find((item) => item.id === registroId && (!animalIdParam || item.animalId === animalIdParam));
  const animal = animais.find((item) => item.id === (registro?.animalId || animalIdParam));
  const tutor = tutores.find((item) => item.id === animal?.tutorId);
  const linhas = separarDetalhe(registro?.detalhe);

  if (!registro || !animal) {
    return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link to="/animais" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link>
      <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">Consulta não encontrada.</div>
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

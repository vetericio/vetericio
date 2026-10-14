import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PawPrint, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { codigoPublicoTutor } from "@/lib/codigo-tutor";

export const Route = createFileRoute("/animais")({ component: Animais });

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
  especie?: string;
  raca?: string;
  sexo?: string;
  nascimento?: string;
  peso?: string;
};

const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";

function ler<T>(chave: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const valor = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

function emojiEspecie(especie?: string) {
  const e = (especie || "").toLowerCase();
  if (e.includes("cão") || e.includes("cao") || e.includes("can")) return "🐶";
  if (e.includes("gato") || e.includes("fel")) return "🐱";
  if (e.includes("ave")) return "🦜";
  if (e.includes("serp") || e.includes("cobra")) return "🐍";
  if (e.includes("coelho")) return "🐰";
  if (e.includes("hamster") || e.includes("rato")) return "🐹";
  return "🐾";
}

function Animais() {
  const [busca, setBusca] = useState("");
  const animais = useMemo(() => ler<Animal>(ANIMAIS_KEY), []);
  const tutores = useMemo(() => ler<Tutor>(TUTORES_KEY), []);
  const tutorPorId = useMemo(() => new Map(tutores.map((t) => [t.id, t])), [tutores]);

  const resultados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    const lista = [...animais].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
    if (!q) return lista;
    return lista.filter((animal) => {
      const tutor = tutorPorId.get(animal.tutorId);
      return [animal.nome, animal.especie, animal.raca, tutor?.nome, tutor?.telefone, tutor?.outroTelefone, tutor?.cpfCnpj, tutor && codigoPublicoTutor(tutor)]
        .some((valor) => (valor || "").toLocaleLowerCase("pt-BR").includes(q));
    });
  }, [animais, busca, tutorPorId]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1350px] px-4 pb-28 pt-6 sm:px-6">
      <Link to="/recepcao" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar para Recepção</Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><PawPrint className="text-primary"/><h1 className="text-3xl font-black">Animais</h1></div>
          <p className="mt-1 text-muted-foreground">Procure primeiro pelo paciente. O tutor e os contatos aparecem junto para diferenciar animais com o mesmo nome.</p>
        </div>
        <Link to="/tutores" className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 font-bold"><UserRound size={17}/> Localizar tutor para cadastrar animal</Link>
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar animal por nome, tutor, telefone, CPF ou ID do tutor"
            className="min-h-13 w-full rounded-xl border bg-white pl-12 pr-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {resultados.length ? resultados.map((animal) => {
            const tutor = tutorPorId.get(animal.tutorId);
            const codigoTutor = tutor && codigoPublicoTutor(tutor);
            return (
              <Link
                key={animal.id}
                to="/animal"
                search={{ animalId: animal.id } as never}
                className="group flex min-h-[150px] flex-col rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">{emojiEspecie(animal.especie)}</div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-black group-hover:text-primary">{animal.nome}</h2>
                    <p className="truncate text-sm text-muted-foreground">{[animal.especie, animal.raca].filter(Boolean).join(" · ") || "Dados clínicos não informados"}</p>
                  </div>
                </div>
                <div className="mt-3 border-t pt-3 text-sm">
                  <div className="font-bold">{tutor?.nome || "Tutor não encontrado"} {codigoTutor && <span className="ml-1 font-mono text-xs text-primary">{codigoTutor}</span>}</div>
                  <div className="mt-1 text-muted-foreground">{[tutor?.telefone, tutor?.outroTelefone].filter(Boolean).join(" · ") || "Sem telefone"}</div>
                  {tutor?.email && <div className="mt-0.5 truncate text-muted-foreground">{tutor.email}</div>}
                </div>
              </Link>
            );
          }) : (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center text-muted-foreground md:col-span-2 xl:col-span-3">Nenhum animal encontrado.</div>
          )}
        </div>
      </section>
    </main>
  );
}

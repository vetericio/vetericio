import { useEffect, useMemo, useState } from "react";
import { Search, X, UserPlus, PawPrint } from "lucide-react";
import { normalizarBuscaAgenda } from "@/lib/agenda-operacional";

export type TutorAgenda = {
  id: string;
  nome: string;
  telefone?: string | null;
  codigo_publico?: string | null;
};
export type PetAgenda = { id: string; tutor_id: string; nome: string; especie?: string | null };
type Opcao = { t: TutorAgenda; a: PetAgenda | null };
type Props = {
  tutores: TutorAgenda[];
  animais: PetAgenda[];
  tutorId: string;
  animalId: string;
  aoEscolher: (tutor: TutorAgenda | null, pet: PetAgenda | null) => void;
  pesquisar?: (termo: string, tutorId: string) => Promise<Opcao[]>;
  aoNovoTutor?: () => void;
  aoNovoPet?: () => void;
  bloqueado?: boolean;
};
export function AgendaEscolherPaciente({
  tutores,
  animais,
  tutorId,
  animalId,
  aoEscolher,
  aoNovoTutor,
  aoNovoPet,
  bloqueado,
  pesquisar,
}: Props) {
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState(!animalId);
  const [remotas, setRemotas] = useState<{ chave: string; opcoes: Opcao[]; erro: boolean } | null>(
    null,
  );
  const termoRemoto = busca.trim();
  const chaveRemota = tutorId + ":" + termoRemoto;
  const consultaRemota =
    !!pesquisar && !bloqueado && aberta && (termoRemoto.length >= 2 || !!tutorId);
  useEffect(() => {
    if (!consultaRemota || !pesquisar) return;
    let ativa = true;
    const timer = setTimeout(
      () =>
        void pesquisar(termoRemoto, tutorId).then(
          (opcoes) => {
            if (ativa) setRemotas({ chave: chaveRemota, opcoes, erro: false });
          },
          () => {
            if (ativa) setRemotas({ chave: chaveRemota, opcoes: [], erro: true });
          },
        ),
      200,
    );
    return () => {
      ativa = false;
      clearTimeout(timer);
    };
  }, [chaveRemota, consultaRemota, pesquisar, termoRemoto, tutorId]);
  const tutor = tutores.find((t) => t.id === tutorId);
  const pet = animais.find((a) => a.id === animalId);
  const opcoes = useMemo(() => {
    const termo = normalizarBuscaAgenda(busca);
    const digitos = termo.replace(/\D/g, "");
    const porId = new Map(tutores.map((t) => [t.id, t]));
    const bate = (t?: TutorAgenda, a?: PetAgenda) =>
      !termo ||
      [t?.nome, t?.codigo_publico, a?.nome].some(
        (v) => v && normalizarBuscaAgenda(v).includes(termo),
      ) ||
      (digitos.length >= 3 && !!t?.telefone?.replace(/\D/g, "").includes(digitos));
    return [
      ...animais.flatMap((a) => {
        const t = porId.get(a.tutor_id);
        return t && bate(t, a) && (!tutorId || t.id === tutorId) ? [{ t, a }] : [];
      }),
      ...(tutorId || !termo ? [] : tutores.filter((t) => bate(t)).map((t) => ({ t, a: null }))),
    ].slice(0, 12);
  }, [busca, tutores, animais, tutorId]);
  const remotoAtual = consultaRemota && remotas?.chave === chaveRemota ? remotas : null;
  const exibir = remotoAtual && !remotoAtual.erro ? remotoAtual.opcoes : opcoes;
  return (
    <section className="mt-4 rounded-xl border bg-secondary/20 p-3" aria-label="Tutor e paciente">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">Tutor e paciente</p>
        {!bloqueado && (
          <div className="flex flex-wrap gap-2">
            {!tutor && aoNovoTutor && (
              <button
                type="button"
                onClick={aoNovoTutor}
                className="inline-flex items-center gap-1 rounded-lg border bg-card px-2 py-1 text-xs font-semibold"
              >
                <UserPlus size={14} /> Novo tutor
              </button>
            )}
            {tutor && aoNovoPet && (
              <button
                type="button"
                onClick={aoNovoPet}
                className="inline-flex items-center gap-1 rounded-lg border bg-card px-2 py-1 text-xs font-semibold"
              >
                <PawPrint size={14} /> Novo animal
              </button>
            )}
          </div>
        )}
      </div>
      {tutorId && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <span>
            <strong>{pet?.nome || "Selecione o animal"}</strong> ·{" "}
            {tutor?.nome || "Tutor vinculado"}
          </span>
          {!bloqueado && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary"
              onClick={() => {
                aoEscolher(null, null);
                setBusca("");
                setAberta(true);
              }}
            >
              <X size={14} /> Trocar tutor ou animal
            </button>
          )}
        </div>
      )}
      {!bloqueado && (!animalId || aberta) && (
        <>
          <label className="mt-3 block text-xs font-semibold">
            Buscar tutor ou animal
            <span className="relative mt-1 block">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-3 text-muted-foreground"
              />
              <input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setAberta(true);
                }}
                placeholder={tutorId ? "Nome do animal deste tutor" : "Nome, telefone ou código"}
                className="min-h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm"
              />
            </span>
          </label>
          <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
            {exibir.map(({ t, a }) => (
              <li key={a?.id || t.id}>
                <button
                  type="button"
                  onClick={() => {
                    aoEscolher(t, a);
                    setBusca("");
                    setAberta(!a);
                  }}
                  className="w-full rounded-lg border bg-card px-3 py-2 text-left text-xs hover:border-primary"
                >
                  <strong>{a?.nome || t.nome}</strong>
                  {a && <span> · {t.nome}</span>}
                  {!a && <span> · Tutor</span>}
                </button>
              </li>
            ))}
            {!exibir.length && (
              <li className="px-1 text-xs text-muted-foreground">
                {consultaRemota && !remotoAtual
                  ? "Buscando…"
                  : remotoAtual?.erro
                    ? "Não foi possível buscar no servidor. Altere o termo para tentar novamente."
                    : "Nenhum resultado. Confira a busca ou cadastre com a permissão de recepção."}
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}

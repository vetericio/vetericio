import { Search, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  codigoPublicoTutorComanda,
  filtrarTutoresComanda,
  LIMITE_TUTORES_VISIVEIS,
  ordenarTutoresComanda,
  type TutorOpcaoComanda,
} from "@/lib/tutor-comanda";

type Props = {
  tutores: readonly TutorOpcaoComanda[];
  tutorId: string;
  onSelecionar: (id: string) => void;
  disabled?: boolean;
};

export function SelecionarTutorComanda({ tutores, tutorId, onSelecionar, disabled }: Props) {
  const inputId = useId();
  const listaId = inputId + "-lista";
  const input = useRef<HTMLInputElement>(null);
  const opcaoAtiva = useRef<HTMLLIElement>(null);
  const [consulta, setConsulta] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(-1);

  const tutor = tutores.find((item) => item.id === tutorId);
  const ordenados = useMemo(() => ordenarTutoresComanda(tutores), [tutores]);
  const encontrados = useMemo(
    () => filtrarTutoresComanda(ordenados, consulta ?? ""),
    [ordenados, consulta],
  );
  const visiveis = encontrados.slice(0, LIMITE_TUTORES_VISIVEIS);
  const mostrarLista = aberto && !disabled;
  const idAtivo = mostrarLista && visiveis[indiceAtivo] ? `${listaId}-${indiceAtivo}` : undefined;
  const texto = consulta ?? tutor?.nome ?? "";
  const codigoSelecionado = tutor && consulta === null ? codigoPublicoTutorComanda(tutor) : "";

  useEffect(() => {
    if (idAtivo) opcaoAtiva.current?.scrollIntoView({ block: "nearest" });
  }, [idAtivo]);

  function fechar() {
    setConsulta(null);
    setAberto(false);
    setIndiceAtivo(-1);
  }

  function escolher(item: TutorOpcaoComanda) {
    if (disabled) return;
    onSelecionar(item.id);
    fechar();
  }

  function navegar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape" && mostrarLista) {
      e.preventDefault();
      e.stopPropagation();
      fechar();
    } else if (e.key === "Enter") {
      // Enter neste campo escolhe uma opção em destaque, nunca envia a comanda.
      e.preventDefault();
      if (mostrarLista && visiveis[indiceAtivo]) escolher(visiveis[indiceAtivo]);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAberto(true);
      if (!visiveis.length) return;
      const ultimo = visiveis.length - 1;
      setIndiceAtivo((atual) =>
        e.key === "ArrowDown" ? Math.min(atual + 1, ultimo) : atual <= 0 ? ultimo : atual - 1,
      );
    }
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) fechar();
      }}
    >
      <label htmlFor={inputId} className="block text-sm font-semibold">
        Tutor
      </label>
      <div className="relative mt-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={input}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={mostrarLista}
          aria-controls={mostrarLista ? listaId : undefined}
          aria-describedby={codigoSelecionado ? inputId + "-codigo" : undefined}
          aria-activedescendant={idAtivo}
          autoComplete="off"
          placeholder="Digite o nome do tutor"
          disabled={disabled}
          value={texto}
          className="min-h-11 w-full rounded-xl border-border bg-white pl-9 pr-12 text-base"
          onFocus={(e) => {
            setAberto(true);
            if (tutor && consulta === null) e.currentTarget.select();
          }}
          onClick={() => setAberto(true)}
          onChange={(e) => {
            setConsulta(e.target.value);
            setIndiceAtivo(-1);
            setAberto(true);
            if (tutorId) onSelecionar("");
          }}
          onKeyDown={navegar}
        />
        {!!texto && !disabled && (
          <button
            type="button"
            className="absolute right-0 top-0 grid min-h-11 min-w-11 place-items-center rounded-r-xl text-muted-foreground hover:text-foreground"
            aria-label="Limpar tutor"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onSelecionar("");
              setConsulta("");
              setIndiceAtivo(-1);
              setAberto(true);
              input.current?.focus();
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {codigoSelecionado && (
        <p id={inputId + "-codigo"} className="mt-1 text-xs text-muted-foreground">
          Código do tutor: {codigoSelecionado}
        </p>
      )}
      {mostrarLista && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <ul
            id={listaId}
            role="listbox"
            aria-label="Tutores da clínica"
            className="max-h-60 touch-pan-y overflow-y-auto p-1"
          >
            {visiveis.map((item, i) => {
              const codigo = codigoPublicoTutorComanda(item);
              return (
                <li
                  ref={i === indiceAtivo ? opcaoAtiva : undefined}
                  id={`${listaId}-${i}`}
                  key={item.id}
                  role="option"
                  aria-selected={i === indiceAtivo}
                  className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 rounded-lg px-3 py-2 text-sm hover:bg-accent aria-selected:bg-accent"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(item)}
                >
                  <span className="min-w-0 break-words font-semibold">{item.nome}</span>
                  {codigo && (
                    <span className="break-all text-xs text-muted-foreground">{codigo}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {encontrados.length === 0 && (
            <p role="status" className="px-3 pb-3 text-sm text-muted-foreground">
              Nenhum tutor encontrado.
            </p>
          )}
          {encontrados.length > LIMITE_TUTORES_VISIVEIS && (
            <p role="status" className="border-t px-3 py-2 text-xs text-muted-foreground">
              Digite mais letras para refinar a busca.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

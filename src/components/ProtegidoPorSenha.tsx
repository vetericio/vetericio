import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Delete } from "lucide-react";
import { toast } from "sonner";

type AreaProtegida = "assinar" | "receituario";
const HASH_PIN = "3e2dbcbf35006bbc50d89a28146b286a743fa54624e71bb1293d063ba6360fa6";
const TEMPO_LIBERADO_MS = 15 * 60 * 1000;
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

async function hash(texto: string) {
  const dados = new TextEncoder().encode(`vetericio-protecao:${texto}`);
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function chave(area: AreaProtegida) {
  return `vetericio-acesso-${area}`;
}

function lerLiberacao(area: AreaProtegida) {
  try {
    const ate = Number(window.sessionStorage.getItem(chave(area)) ?? 0);
    return Number.isFinite(ate) && ate > Date.now() ? ate : 0;
  } catch {
    return 0;
  }
}

export function ProtegidoPorSenha({
  area,
  titulo,
  children,
}: {
  area: AreaProtegida;
  titulo: string;
  children: ReactNode;
}) {
  const [liberadoAte, setLiberadoAte] = useState(0);
  const [pin, setPin] = useState("");
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    setLiberadoAte(lerLiberacao(area));
    setPin("");
  }, [area]);

  useEffect(() => {
    if (!liberadoAte) return;
    const expirar = () => {
      if (Date.now() >= liberadoAte) {
        setLiberadoAte(0);
        setPin("");
      }
    };
    const timer = window.setTimeout(expirar, Math.max(0, liberadoAte - Date.now()));
    window.addEventListener("focus", expirar);
    document.addEventListener("visibilitychange", expirar);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", expirar);
      document.removeEventListener("visibilitychange", expirar);
    };
  }, [liberadoAte]);

  const validar = useCallback(
    async (candidato: string) => {
      setVerificando(true);
      try {
        if ((await hash(candidato)) !== HASH_PIN) {
          setPin("");
          toast.error("Senha incorreta.");
          return;
        }
        const ate = Date.now() + TEMPO_LIBERADO_MS;
        window.sessionStorage.setItem(chave(area), String(ate));
        setPin("");
        setLiberadoAte(ate);
        toast.success("Acesso liberado neste aparelho por 15 minutos.");
      } catch {
        setPin("");
        toast.error("Não foi possível validar a senha.");
      } finally {
        setVerificando(false);
      }
    },
    [area],
  );

  const digitar = useCallback(
    (digito: string) => {
      if (verificando || pin.length >= 4) return;
      const proximo = `${pin}${digito}`;
      setPin(proximo);
      if (proximo.length === 4) void validar(proximo);
    },
    [pin, verificando, validar],
  );

  useEffect(() => {
    if (liberadoAte) return;
    const teclado = (evento: KeyboardEvent) => {
      if (evento.ctrlKey || evento.altKey || evento.metaKey || evento.repeat || verificando) return;
      if (/^\d$/.test(evento.key)) {
        evento.preventDefault();
        digitar(evento.key);
      } else if (evento.key === "Backspace") {
        evento.preventDefault();
        setPin((atual) => atual.slice(0, -1));
      }
    };
    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, [liberadoAte, digitar, verificando]);

  if (liberadoAte > Date.now()) return <>{children}</>;

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-sm items-center px-4 py-8">
      <section className="w-full rounded-3xl border border-border bg-card p-5 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Veterício</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-foreground">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Digite a senha de quatro números para continuar.
        </p>
        <div
          className="mx-auto mt-6 flex w-fit gap-3"
          aria-label={`${pin.length} de 4 números digitados`}
          aria-live="polite"
        >
          {Array.from({ length: 4 }, (_, indice) => (
            <span
              key={indice}
              className={`h-3 w-3 rounded-full ${indice < pin.length ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>
        <div className="mx-auto mt-7 grid max-w-[17rem] grid-cols-3 gap-2">
          {TECLAS.map((tecla) => (
            <button
              key={tecla}
              type="button"
              onClick={() => digitar(tecla)}
              disabled={tecla === "*" || tecla === "#" || verificando}
              className="min-h-14 rounded-2xl bg-secondary text-lg font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70 disabled:cursor-default disabled:opacity-45"
            >
              {tecla}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPin((atual) => atual.slice(0, -1))}
          disabled={!pin || verificando}
          className="mx-auto mt-3 flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-40"
        >
          <Delete className="h-4 w-4" /> Apagar
        </button>
      </section>
    </main>
  );
}

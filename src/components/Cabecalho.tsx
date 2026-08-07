import { Link } from "@tanstack/react-router";
import { useRegistros } from "@/hooks/useRegistros";

const base =
  "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm";

export function Cabecalho() {
  const { registros } = useRegistros();

  return (
    <header className="border-b border-border bg-card/60">
      <div className="mx-auto w-full max-w-5xl px-4 pb-3 pt-5 text-center">
        <h1 className="font-display text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
          Veterício Serviços Veterinários LTDA
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Ficha de Avaliação da Internação
        </p>

        <nav className="mt-3 flex flex-wrap justify-center gap-2">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: `${base} bg-primary text-primary-foreground` }}
            inactiveProps={{
              className: `${base} bg-secondary text-secondary-foreground hover:bg-secondary/70`,
            }}
          >
            Início
          </Link>
          <Link
            to="/registros"
            activeProps={{ className: `${base} bg-primary text-primary-foreground` }}
            inactiveProps={{
              className: `${base} bg-secondary text-secondary-foreground hover:bg-secondary/70`,
            }}
          >
            Animais registrados
          </Link>
        </nav>

        <p className="mt-2 text-xs font-semibold text-foreground sm:text-sm">
          Total de registros do plantão de hoje: {registros.length}
        </p>
      </div>
    </header>
  );
}

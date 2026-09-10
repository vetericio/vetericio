import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

import { DialogoTurno } from "@/components/DialogoTurno";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { GRUPOS_MENU, SO_COM_PLANTAO } from "@/lib/navegacao";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MenuLateral() {
  const [aberto, setAberto] = useState(false);
  const [turnoAberto, setTurnoAberto] = useState(false);
  const { plantao } = usePlantaoAtual();

  return (
    <>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menu"
            className="absolute left-3 top-3 z-30 flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          {!plantao && (
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                setTurnoAberto(true);
              }}
              className="mt-4 min-h-11 w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Iniciar plantão
            </button>
          )}

          {GRUPOS_MENU.map((grupo) => (
            <nav key={grupo.titulo} className="mt-5">
              <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {grupo.titulo}
              </p>
              <div className="flex flex-col gap-2">
                {grupo.itens.map((item) => {
                  const bloqueado = !plantao && SO_COM_PLANTAO.includes(item.to);
                  if (bloqueado)
                    return (
                      <button
                        key={item.to}
                        type="button"
                        onClick={() => {
                          setAberto(false);
                          setTurnoAberto(true);
                        }}
                        className="min-h-11 rounded-xl bg-secondary/40 px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground"
                      >
                        {item.rotulo}
                        <span className="block text-[11px] font-normal">
                          Precisa de plantão aberto — toque para iniciar
                        </span>
                      </button>
                    );
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      {...(item.to === "/" ? { activeOptions: { exact: true } } : {})}
                      onClick={() => setAberto(false)}
                      activeProps={{
                        className:
                          "min-h-11 flex items-center rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground",
                      }}
                      inactiveProps={{
                        className:
                          "min-h-11 flex items-center rounded-xl bg-secondary px-3 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70",
                      }}
                    >
                      {item.rotulo}
                    </Link>
                  );
                })}
              </div>
            </nav>
          ))}
        </SheetContent>
      </Sheet>

      <DialogoTurno aberto={turnoAberto} onFechar={() => setTurnoAberto(false)} />
    </>
  );
}

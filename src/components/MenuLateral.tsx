import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { LINKS_MENU, SO_COM_PLANTAO } from "@/lib/navegacao";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MenuLateral() {
  const [aberto, setAberto] = useState(false);
  const { plantao } = usePlantaoAtual();

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menu"
          className="absolute left-3 top-3 z-30 rounded-xl border border-border bg-card p-2 text-foreground shadow-sm hover:bg-secondary"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="mt-4 flex flex-col gap-2">
          {LINKS_MENU.map((item) => {
            const bloqueado = !plantao && SO_COM_PLANTAO.includes(item.to);
            if (bloqueado)
              return (
                <span
                  key={item.to}
                  aria-disabled="true"
                  title="Inicie o plantão para usar esta função"
                  className="cursor-not-allowed rounded-xl bg-secondary/40 px-3 py-2.5 text-sm font-semibold text-muted-foreground opacity-50"
                >
                  {item.rotulo}
                </span>
              );
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setAberto(false)}
                activeProps={{
                  className:
                    "rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground",
                }}
                inactiveProps={{
                  className:
                    "rounded-xl bg-secondary px-3 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70",
                }}
              >
                {item.rotulo}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setAberto(false);
              window.dispatchEvent(new Event("veterico-abrir-temas"));
            }}
            className="rounded-xl bg-secondary px-3 py-2.5 text-left text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            Temas
          </button>
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              window.dispatchEvent(new Event("veterico-abrir-sincronizacao"));
            }}
            className="rounded-xl bg-secondary px-3 py-2.5 text-left text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            Sincronização
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

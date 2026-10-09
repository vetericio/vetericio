import { useEffect } from "react";
import { Backup } from "@/components/Backup";
import { VERSAO } from "@/lib/versao";
import { aplicarTema, carregarCor, carregarTema } from "@/lib/tema";

export function Rodape() {
  useEffect(() => {
    aplicarTema(carregarTema(), carregarCor());
  }, []);

  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-center">
      <Backup mostrarBotao={false} />
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Oricse · Plataforma veterinária.
      </p>
      <p className="mt-1 text-center text-[9px] text-muted-foreground/70">Versão {VERSAO}</p>
    </footer>
  );
}

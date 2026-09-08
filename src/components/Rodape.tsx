import { useEffect } from "react";
import { Backup } from "@/components/Backup";
import { VERSAO } from "@/lib/versao";

import { aplicarTema, carregarCor, carregarTema } from "@/lib/tema";

export function Rodape() {
  // Aplica o tema salvo ao abrir o app.
  useEffect(() => {
    aplicarTema(carregarTema(), carregarCor());
  }, []);

  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-center">
      {/* Mantido montado para a sincronização automática continuar rodando. */}
      <Backup mostrarBotao={false} />

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Todos os direitos reservados a Veterício Serviços Veterinários LTDA. 31995512795.
      </p>
      <p className="mt-1 text-center text-[9px] text-muted-foreground/70">Versão {VERSAO}</p>
    </footer>
  );
}

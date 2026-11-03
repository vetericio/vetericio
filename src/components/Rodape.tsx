import { Backup } from "@/components/Backup";
import { VERSAO } from "@/lib/versao";

export function Rodape() {
  const anoAtual = new Date().getFullYear();

  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-center">
      <Backup mostrarBotao={false} />
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Oricse - Sistema Veterinário e Petshop
      </p>
      <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground/80">
        Desenvolvido por Veterício Serviços Veterinário LTDA
      </p>
      <p className="mt-1 text-center text-[9px] text-muted-foreground/70">
        © {anoAtual} · Versão {VERSAO}
      </p>
    </footer>
  );
}

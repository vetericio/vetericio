import { Backup } from "@/components/Backup";
import { VERSAO } from "@/lib/versao";

export function Rodape() {
  const anoAtual = new Date().getFullYear();

  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-center">
      <Backup mostrarBotao={false} />
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Oricse - Soluções para o mercado pet
      </p>
      <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground/80">
        Desenvolvido por:
      </p>
      <p className="text-[9px] leading-relaxed text-muted-foreground/80">
        DIRCE Tecnologia — Desenvolvimento, Inovação, Resultados, Conectividade e Evolução Tecnologia LTDA.
      </p>
      <p className="text-[9px] leading-relaxed text-muted-foreground/80">
        Veterício Serviços Veterinários LTDA.
      </p>
      <p className="mt-1 text-center text-[9px] text-muted-foreground/70">
        © {anoAtual} · Versão {VERSAO}
      </p>
    </footer>
  );
}

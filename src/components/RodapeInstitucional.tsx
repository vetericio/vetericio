import { ContatosAtendimentoOricse } from "@/components/ContatosAtendimentoOricse";
import { VERSAO } from "@/lib/versao";
import type { ReactNode } from "react";

/**
 * Rodapé institucional público, conforme arte aprovada.
 */
export function RodapeInstitucional({
  linkMarca = false,
  marcaDaClinica,
}: {
  linkMarca?: boolean;
  marcaDaClinica?: ReactNode;
}) {
  const creditos = (
    <div
      className={
        "mx-auto max-w-5xl " +
        (marcaDaClinica
          ? "text-[10px] leading-[1.35] sm:text-[11px]"
          : "text-[13px] leading-[1.55] sm:text-[14px]")
      }
    >
      <p
        className={
          "font-normal " +
          (marcaDaClinica
            ? "mb-1 text-[11px] text-[#4A1826] sm:text-[12px]"
            : "mb-2 text-[14px] text-[#5e4753] sm:text-[15px]")
        }
      >
        {linkMarca ? (
          <a href="https://oricse.com.br" className="underline underline-offset-2">
            Oricse - Soluções para o mercado pet
          </a>
        ) : (
          "Oricse - Soluções para o mercado pet"
        )}
      </p>
      <p>Desenvolvido por:</p>
      <p>
        DIRCE Tecnologia{marcaDaClinica ? " · " : " — "}Desenvolvimento, Inovação, Resultados,
        Conectividade e Evolução Tecnologia LTDA.
      </p>
      <p>Veterício Serviços Veterinários LTDA.</p>
      {!linkMarca && !marcaDaClinica && (
        <ContatosAtendimentoOricse className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 font-medium not-italic text-[#5e4753]" />
      )}
      <p className={marcaDaClinica ? "mt-1" : "mt-2"}>
        © {new Date().getFullYear()} · Versão {VERSAO}
      </p>
    </div>
  );

  return (
    <footer
      aria-label="Informações institucionais do Oricse"
      data-clinic-section={marcaDaClinica ? "rodape" : undefined}
      className={
        "relative z-10 w-full border-t px-4 text-center " +
        (marcaDaClinica
          ? "border-[#DCC8BD] bg-[#FBF7F1] pb-12 pt-3 text-[#092F38] max-[389px]:pb-16 sm:px-24 sm:py-4 md:px-6"
          : "border-[#ebe2db] bg-[#faf6f1] py-10 text-[#896d78] sm:px-6 sm:py-12")
      }
    >
      {marcaDaClinica ? (
        <div className="mx-auto grid max-w-7xl items-center gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,42rem)_minmax(0,1fr)] lg:gap-4">
          <div className="flex justify-center lg:justify-start">{marcaDaClinica}</div>
          {creditos}
        </div>
      ) : (
        creditos
      )}
    </footer>
  );
}

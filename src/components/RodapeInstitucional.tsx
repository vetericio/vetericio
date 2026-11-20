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
          "font-normal text-[#5e4753] " +
          (marcaDaClinica ? "mb-1 text-[11px] sm:text-[12px]" : "mb-2 text-[14px] sm:text-[15px]")
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
        "relative z-10 w-full border-t border-[#ebe2db] bg-[#faf6f1] px-4 text-center sm:px-6 " +
        (marcaDaClinica ? "pb-12 pt-3 text-[#36555B] sm:py-4" : "py-10 text-[#896d78] sm:py-12")
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

import { VERSAO } from "@/lib/versao";

/**
 * Rodapé institucional público, conforme arte aprovada.
 */
export function RodapeInstitucional({ linkMarca = false }: { linkMarca?: boolean }) {
  return (
    <footer
      aria-label="Informações institucionais do Oricse"
      className="relative z-10 w-full border-t border-[#ebe2db] bg-[#faf6f1] px-4 py-10 text-center text-[#896d78] sm:px-6 sm:py-12"
    >
      <div className="mx-auto max-w-5xl text-[13px] leading-[1.55] sm:text-[14px]">
        <p className="mb-2 text-[14px] font-normal text-[#5e4753] sm:text-[15px]">
          {linkMarca ? (
            <a href="https://oricse.com.br" className="underline underline-offset-2">
              Oricse - Soluções para o mercado pet
            </a>
          ) : "Oricse - Soluções para o mercado pet"}
        </p>
        <p>Desenvolvido por:</p>
        <p>DIRCE Tecnologia — Desenvolvimento, Inovação, Resultados, Conectividade e Evolução Tecnologia LTDA.</p>
        <p>Veterício Serviços Veterinários LTDA.</p>
        <p className="mt-2">© {new Date().getFullYear()} · Versão {VERSAO}</p>
      </div>
    </footer>
  );
}

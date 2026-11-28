import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Infinity as InfinityIcon,
  UserRoundPlus,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PromocaoPerfisPopupProps = {
  /** Autorize apenas na home institucional e enquanto o servidor indicar oferta disponível. */
  disponivel: boolean;
};

// Intencionalmente em memória: navegações e remontagens da SPA não repetem o aviso.
let exibidoNesteCarregamento = false;

export function PromocaoPerfisPopup({ disponivel }: PromocaoPerfisPopupProps) {
  const [aberto, setAberto] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const navegando = useRef(false);

  useEffect(() => {
    if (disponivel !== true || exibidoNesteCarregamento) return;
    focoAnterior.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    exibidoNesteCarregamento = true;
    setAberto(true);
  }, [disponivel]);

  function devolverFoco() {
    if (navegando.current) return;
    const anterior = focoAnterior.current;
    if (anterior?.isConnected && anterior !== document.body) {
      anterior.focus({ preventScroll: true });
      return;
    }
    const principal = document.querySelector<HTMLElement>(
      "main, [role='main'], h1",
    );
    if (!principal) return;
    const tinhaTabindex = principal.hasAttribute("tabindex");
    if (!tinhaTabindex) {
      principal.setAttribute("tabindex", "-1");
      principal.addEventListener(
        "blur",
        () => principal.removeAttribute("tabindex"),
        { once: true },
      );
    }
    principal.focus({ preventScroll: true });
  }

  return (
    <Dialog.Root
      open={disponivel === true && aberto}
      onOpenChange={(proximo) => {
        if (!proximo) setAberto(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-[#261017]/65 backdrop-blur-[3px]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[81] max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[510px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-[24px] border border-[#e8d4c5] bg-[#FBF7F2] text-[#4A1826] shadow-[0_26px_90px_#26101766] focus:outline-none"
          onOpenAutoFocus={(evento) => {
            evento.preventDefault();
            titulo.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(evento) => {
            evento.preventDefault();
            devolverFoco();
          }}
        >
          <header className="relative isolate overflow-hidden bg-[#4A1826] px-5 pb-5 pt-4 text-[#FBF7F2] sm:px-7 sm:pb-6 sm:pt-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-28 -z-10 size-[280px] rounded-full border border-[#ddab8e]/30 shadow-[0_0_0_20px_#ddab8e1f,0_0_0_42px_#ddab8e10]"
            />
            <button
              type="button"
              aria-label="Fechar oferta"
              onClick={() => setAberto(false)}
              className="absolute right-3 top-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-[#FBF7F2]/35 text-[#FBF7F2] hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FBF7F2]"
            >
              <X size={20} aria-hidden="true" />
            </button>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pr-12">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-[.18em]">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#FBF7F2]">
                  <img
                    src="/oricse-logo-oryx.svg?v=15"
                    alt=""
                    width={23}
                    height={23}
                  />
                </span>
                ORICSE
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#f4caae]">
                Contrate até 31/01/2027
              </span>
            </div>
            <Dialog.Title
              ref={titulo}
              tabIndex={-1}
              className="mt-4 max-w-[17ch] font-display text-[30px] font-semibold leading-[1.04] tracking-[-0.035em] outline-none sm:text-[42px]"
            >
              Mais perfis para sua equipe
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-snug text-[#f4dbcf]">
              Perfis adicionais sem custo nos planos elegíveis.
            </Dialog.Description>
          </header>

          <div className="space-y-2.5 p-5 sm:p-7">
            <section
              className="flex gap-3 rounded-xl border border-[#e7d2c6] bg-white/80 p-3"
              aria-label="Profissional e Master"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f4e4e9] text-[#6F293B]">
                <InfinityIcon size={21} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[.10em] text-[#6F293B]">
                  Profissional e Master
                </h3>
                <p className="mt-0.5 text-base font-semibold leading-snug">
                  Perfis de equipe ilimitados
                </p>
              </div>
            </section>

            <section
              className="flex gap-3 rounded-xl border border-[#e7d2c6] bg-white/80 p-3"
              aria-label="Essencial"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f7ecde] text-[#6F293B]">
                <UserRoundPlus size={19} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[.10em] text-[#6F293B]">
                  Essencial
                </h3>
                <p className="mt-0.5 text-base font-semibold leading-snug">
                  2 perfis extras gratuitos
                  <span className="ml-1 inline-block whitespace-nowrap text-sm font-medium">(3 no total)</span>
                </p>
              </div>
            </section>

            <p className="pt-1 text-xs leading-relaxed text-[#67454e]">
              Benefício liberado após a ativação, enquanto a assinatura elegível
              permanecer ativa.
            </p>
            <Link
              to="/planos"
              className="mt-1 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#6F293B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#562030] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F293B]"
              onClick={(evento) => {
                if (
                  evento.defaultPrevented ||
                  evento.button !== 0 ||
                  evento.metaKey ||
                  evento.ctrlKey ||
                  evento.shiftKey ||
                  evento.altKey
                )
                  return;
                navegando.current = true;
                setAberto(false);
              }}
            >
              Ver planos <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

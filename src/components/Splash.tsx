import { useEffect, useState } from "react";
import { useSiteBranding } from "@/hooks/useSiteBranding";

const CHAVE_SPLASH_SESSAO = "oricse-splash-v1";

export function Splash() {
  const { marca, logo_url } = useSiteBranding();
  // O servidor e o primeiro render do navegador precisam coincidir.
  // A leitura da sessão acontece só após a hidratação, evitando erro React #418.
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      setVisivel(window.sessionStorage.getItem(CHAVE_SPLASH_SESSAO) !== "1");
    } catch {
      setVisivel(true);
    }
  }, []);

  useEffect(() => {
    if (!visivel) return;
    window.sessionStorage.setItem(CHAVE_SPLASH_SESSAO, "1");
    const timer = window.setTimeout(() => setVisivel(false), 900);
    const seguranca = window.setTimeout(() => setVisivel(false), 1800);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(seguranca);
    };
  }, [visivel]);

  if (!visivel) return null;

  return (
    <button type="button" aria-label="Fechar tela de abertura" onClick={() => setVisivel(false)} className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-white">
      <img src={logo_url} alt={`${marca} — sistema veterinário e petshop`} className="h-auto w-full max-w-[300px] object-contain p-4 sm:max-w-[360px]" />
    </button>
  );
}

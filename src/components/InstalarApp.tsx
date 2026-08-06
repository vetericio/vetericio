import { useEffect, useState } from "react";
import { toast } from "sonner";

type PromptEvent = Event & { prompt: () => Promise<void> };

export function InstalarApp() {
  const [evento, setEvento] = useState<PromptEvent | null>(null);
  const [instalado, setInstalado] = useState(false);

  useEffect(() => {
    const aoPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as PromptEvent);
    };
    const aoInstalar = () => setInstalado(true);
    window.addEventListener("beforeinstallprompt", aoPrompt);
    window.addEventListener("appinstalled", aoInstalar);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalado(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPrompt);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (instalado) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
      <p className="text-sm font-semibold text-foreground">Instalar no celular</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Cria um ícone na tela inicial e funciona sem internet.
      </p>
      <button
        type="button"
        onClick={async () => {
          if (evento) {
            await evento.prompt();
            setEvento(null);
          } else {
            toast("No Android: menu do navegador → “Instalar app”. No iPhone: Compartilhar → “Adicionar à Tela de Início”.");
          }
        }}
        className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Instalar app
      </button>
    </div>
  );
}

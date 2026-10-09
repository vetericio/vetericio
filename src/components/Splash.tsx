import { useEffect, useState } from "react";

export function Splash() {
  const [visivel, setVisivel] = useState(true);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    const timerEsconder = setTimeout(() => setVisivel(false), 2500);
    const timerRemover = setTimeout(() => setOculto(true), 3100);
    return () => {
      clearTimeout(timerEsconder);
      clearTimeout(timerRemover);
    };
  }, []);

  if (oculto) return null;

  return (
    <div aria-hidden={!visivel} className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-500 ease-out ${visivel ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      <div className="rounded-3xl bg-white px-8 py-6 text-center">
        <div className="text-5xl font-black tracking-[0.18em] text-slate-900 sm:text-6xl">ORICSE</div>
        <div className="mt-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Plataforma veterinária</div>
      </div>
    </div>
  );
}

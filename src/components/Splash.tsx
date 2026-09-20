import { useEffect, useState } from "react";
import logoOficial from "@/assets/vetericio-logo-oficial.png.asset.json";

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
    <div
      aria-hidden={!visivel}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-500 ease-out ${
        visivel ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <img
        src={logoOficial.url}
        alt="Veterício Serviços Veterinários LTDA"
        className="h-auto w-full max-w-xs object-contain sm:max-w-sm"
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { CalculadoraNorep } from "@/components/CalculadoraNorep";
import { Cronometro } from "@/components/Cronometro";
import { TaxaInfusao } from "@/components/TaxaInfusao";
import { TransfusaoSanguinea } from "@/components/TransfusaoSanguinea";

/** Banner deslizável com as ferramentas clínicas (cronômetro/taxa, transfusão e NOREP). */
export function FerramentasClinicas() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });
  const [ativo, setAtivo] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const aoSelecionar = () => setAtivo(emblaApi.selectedScrollSnap());
    aoSelecionar();
    emblaApi.on("select", aoSelecionar);
    emblaApi.on("reInit", aoSelecionar);
    return () => {
      emblaApi.off("select", aoSelecionar);
      emblaApi.off("reInit", aoSelecionar);
    };
  }, [emblaApi]);

  const irPara = useCallback(
    (i: number) => {
      emblaApi?.scrollTo(i);
    },
    [emblaApi],
  );

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div ref={emblaRef} className="min-w-0 flex-1 overflow-hidden">
        <div className="flex h-full">
          <div className="min-w-0 flex-[0_0_100%]">
            <div className="flex h-full min-w-0 flex-col gap-2 sm:gap-3">
              <Cronometro />
              <TaxaInfusao />
            </div>
          </div>
          <div className="min-w-0 flex-[0_0_100%]">
            <div className="flex h-full min-w-0 flex-col">
              <TransfusaoSanguinea />
            </div>
          </div>
          <div className="min-w-0 flex-[0_0_100%]">
            <div className="flex h-full min-w-0 flex-col">
              <CalculadoraNorep />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ir para a ferramenta ${i + 1}`}
            aria-current={ativo === i}
            onClick={() => irPara(i)}
            className={`h-2 w-2 rounded-full border border-primary transition-colors ${
              ativo === i ? "bg-primary" : "bg-transparent"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

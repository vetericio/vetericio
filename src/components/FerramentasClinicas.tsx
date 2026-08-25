import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Calculadora } from "./Calculadora";
import { TransfusaoSanguinea } from "./TransfusaoSanguinea";

export function FerramentasClinicas() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });
  const [indice, setIndice] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setIndice(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const irPara = (i: number) => {
    if (!emblaApi) return;
    emblaApi.scrollTo(i);
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={emblaRef} className="flex-1 overflow-hidden">
        <div className="flex h-full">
          <div className="min-w-0 flex-[0_0_100%]">
            <Calculadora />
          </div>
          <div className="min-w-0 flex-[0_0_100%]">
            <TransfusaoSanguinea />
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-2">
        {[0, 1].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => irPara(i)}
            aria-label={i === 0 ? "Calculadora" : "Transfusão sanguínea"}
            className={`h-2 w-2 rounded-full transition-colors ${
              indice === i ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { TaxaInfusao } from "./TaxaInfusao";
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
    <div className="rounded-2xl border border-border bg-card p-2.5 shadow-sm sm:p-3">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          <div className="min-w-0 flex-[0_0_100%]">
            <TaxaInfusao />
          </div>
          <div className="min-w-0 flex-[0_0_100%] pl-2 sm:pl-3">
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
            aria-label={i === 0 ? "Taxa de infusão" : "Transfusão sanguínea"}
            className={`h-2 w-2 rounded-full transition-colors ${
              indice === i ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

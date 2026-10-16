import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtegidoPorSenha } from "@/components/ProtegidoPorSenha";
import { Receituario } from "@/components/Receituario";
import {
  definirPreferenciaReceitaPortal,
  motivoFinalReceitaPortal,
  MOTIVOS_NAO_ENVIAR_RECEITA,
  type PreferenciaReceitaPortal,
} from "@/lib/receita-portal-state";

export const Route = createFileRoute("/receituario")({
  head: () => ({
    meta: [
      { title: "Receituário — Oricse" },
      { name: "description", content: "Receituário veterinário em PDF com assinatura e carimbo." },
      { property: "og:title", content: "Receituário — Oricse" },
      { property: "og:description", content: "Receituário veterinário em PDF com assinatura e carimbo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaReceituario,
});

function PaginaReceituario() {
  const [preferencia, setPreferencia] = useState<PreferenciaReceitaPortal>({ enviar: true, motivo: "", outro: "" });
  const [temAnimal, setTemAnimal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTemAnimal(Boolean(params.get("animalId")));
  }, []);

  useEffect(() => {
    definirPreferenciaReceitaPortal(preferencia);
  }, [preferencia]);

  const motivoValido = preferencia.enviar || Boolean(motivoFinalReceitaPortal(preferencia));

  return (
    <ProtegidoPorSenha area="receituario" titulo="Receituário protegido">
      {temAnimal && (
        <section className="mx-auto mb-4 w-full max-w-3xl rounded-2xl border bg-card p-4 shadow-sm">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <div className="font-bold">Disponibilizar no Portal do Tutor</div>
              <p className="mt-1 text-xs text-muted-foreground">Ligado por padrão. O PDF emitido será vinculado ao animal e ficará disponível ao tutor.</p>
            </div>
            <input
              type="checkbox"
              checked={preferencia.enviar}
              onChange={(e) => setPreferencia((atual) => ({ ...atual, enviar: e.target.checked, motivo: e.target.checked ? "" : atual.motivo, outro: e.target.checked ? "" : atual.outro }))}
              className="h-5 w-5 accent-primary"
            />
          </label>

          {!preferencia.enviar && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <label className="block text-sm font-bold">
                Motivo para não disponibilizar ao tutor
                <select
                  value={preferencia.motivo}
                  onChange={(e) => setPreferencia((atual) => ({ ...atual, motivo: e.target.value, outro: e.target.value === "Outro" ? atual.outro : "" }))}
                  className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"
                >
                  <option value="">Selecione o motivo</option>
                  {MOTIVOS_NAO_ENVIAR_RECEITA.map((motivo) => <option key={motivo} value={motivo}>{motivo}</option>)}
                </select>
              </label>
              {preferencia.motivo === "Outro" && (
                <label className="block text-sm font-bold">
                  Descreva o motivo
                  <textarea
                    value={preferencia.outro}
                    onChange={(e) => setPreferencia((atual) => ({ ...atual, outro: e.target.value }))}
                    rows={3}
                    maxLength={500}
                    className="mt-1 w-full rounded-xl border bg-background p-3 font-normal"
                    placeholder="Informe o motivo"
                  />
                </label>
              )}
              {!motivoValido && <p className="text-xs font-bold text-destructive">É obrigatório informar o motivo para ocultar a receita do Portal do Tutor.</p>}
            </div>
          )}
        </section>
      )}
      <Receituario />
    </ProtegidoPorSenha>
  );
}

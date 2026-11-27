import {
  calcularPrecoOrcamento, PESO_MAXIMO_ORCAMENTO, type PerfilOrcamento,
} from "@/lib/preco-orcamento";
import { tituloFaixa, valorEmReais } from "@/lib/preco-por-peso";

const kg = (peso: number) => peso.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function PrecoPorPesoOrcamento({ perfil, preco, onChange }: {
  perfil: PerfilOrcamento;
  preco: ReturnType<typeof calcularPrecoOrcamento>;
  onChange: (campos: Partial<PerfilOrcamento>) => void;
}) {
  const { tabela, pesoKg, indice, mudancas, valor } = preco;
  return <fieldset className="min-w-0 space-y-3 rounded-xl border bg-background/60 px-3 pb-3 sm:col-span-4">
    <legend className="px-1 text-sm font-semibold">Preço por perfil do animal</legend>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <label className="text-sm font-medium">Espécie
        <select className="mt-1 w-full rounded-lg border bg-background p-2"
          value={perfil.especie ?? ""} onChange={e => onChange({ especie: (e.target.value || null) as PerfilOrcamento["especie"] })}>
          <option value="">Selecione</option>
          <option>Cão</option>
          <option>Gato</option>
        </select>
      </label>
      <label className="text-sm font-medium">Sexo
        <select className="mt-1 w-full rounded-lg border bg-background p-2"
          value={perfil.sexo ?? ""} onChange={e => onChange({ sexo: (e.target.value || null) as PerfilOrcamento["sexo"] })}>
          <option value="">Selecione</option>
          <option>Macho</option>
          <option>Fêmea</option>
        </select>
      </label>
      <label className="col-span-2 text-sm font-medium sm:col-span-1">Peso (kg)
        <input type="text" inputMode="decimal" className="mt-1 w-full rounded-lg border bg-background p-2"
          value={perfil.peso} onChange={e => onChange({ peso: e.target.value })} placeholder="Ex.: 4,5"
          aria-invalid={perfil.peso !== "" && pesoKg === null} />
      </label>
    </div>
    <div>
      <div className="relative flex h-9 items-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-2.5 top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary/20">
          {mudancas.map(({ aposKg }) => <span key={aposKg}
            className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-primary"
            style={{ left: `${100 * aposKg / PESO_MAXIMO_ORCAMENTO}%` }} />)}
        </div>
        <input type="range" min={0} max={PESO_MAXIMO_ORCAMENTO} step={0.001} value={pesoKg ?? 0}
          onChange={e => onChange({ peso: e.target.value.replace(".", ",") })}
          aria-label="Selecionar peso do animal na régua" aria-valuetext={pesoKg === null ? "Peso não selecionado" : `${kg(pesoKg)} kg`}
          className="relative m-0 h-9 w-full cursor-pointer appearance-none rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary" />
      </div>
      <div className="flex justify-between text-xs tabular-nums text-muted-foreground"><span>0 kg</span><span>{PESO_MAXIMO_ORCAMENTO} kg</span></div>
    </div>
    {tabela.length > 0 && <p className="text-xs text-muted-foreground">
      {mudancas.length > 0 ? <>
        <strong>Mudanças de valor</strong>{" · "}
        {mudancas.map(({ aposKg, valor }) => `Acima de ${kg(aposKg)} kg: ${valorEmReais(valor)}`).join(" · ")}
      </> : "Mesmo valor em toda a régua."}
    </p>}
    <p className="text-sm" role="status">
      {valor !== null ? <>{tituloFaixa(tabela, indice)} · <strong>{valorEmReais(valor)} por unidade</strong></>
        : !perfil.especie || !perfil.sexo ? "Selecione a espécie e o sexo."
        : tabela.length === 0 ? "Não há preço cadastrado para a espécie e o sexo selecionados."
        : "Selecione um peso maior que 0 kg e de até 60 kg."}
    </p>
  </fieldset>;
}

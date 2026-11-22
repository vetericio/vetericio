import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Scale } from "lucide-react";
import { toast } from "sonner";
import {
  type AprovacaoPrecoPeso, faixasParaAnimal, sugerirFaixaPeso, tituloFaixa, valorEmReais,
} from "@/lib/preco-por-peso";

type Item = { id: string; nome: string; faixas_peso?: unknown };

export function AprovarPrecoPorPeso({
  item, pesoInicial, especie, sexo, aprovadoPor, onAprovar, onCancelar,
}: {
  item: Item;
  pesoInicial: number | null;
  especie?: string;
  sexo?: string;
  aprovadoPor: string;
  onAprovar: (aprovacao: AprovacaoPrecoPeso) => void;
  onCancelar: () => void;
}) {
  const faixas = useMemo(() => faixasParaAnimal(item.faixas_peso, especie, sexo), [item.faixas_peso, especie, sexo]);
  const [pesoTexto, setPesoTexto] = useState(pesoInicial && pesoInicial > 0 ? String(pesoInicial) : "");
  const [escolha, setEscolha] = useState("sugerida");
  const [personalizar, setPersonalizar] = useState(false);
  const [precoTexto, setPrecoTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  useEffect(() => {
    setPesoTexto(pesoInicial && pesoInicial > 0 ? String(pesoInicial) : "");
    setEscolha("sugerida");
    setPersonalizar(false);
    setPrecoTexto("");
    setMotivo("");
  }, [item.id, pesoInicial]);

  const convertido = Number(pesoTexto.replace(",", "."));
  const peso = pesoTexto.trim() && Number.isFinite(convertido) && convertido > 0 ? convertido : null;
  const sugerida = sugerirFaixaPeso(faixas, peso);
  const escolhida = escolha === "sugerida" ? sugerida : Number(escolha);
  const valida = Number.isInteger(escolhida) && escolhida >= 0 && escolhida < faixas.length;
  const valorBase = valida ? faixas[escolhida].valor : null;
  const informado = Number(precoTexto.trim().replace(",", "."));
  const personalizado = personalizar ? informado : valorBase;
  const valorValido = typeof personalizado === "number" &&
    Number.isFinite(personalizado) && personalizado >= 0 && Math.abs(personalizado * 100 - Math.round(personalizado * 100)) < 0.00001;
  const diferente = valida && (personalizar || (sugerida >= 0 && sugerida !== escolhida));

  function aprovar() {
    if (!valida || !valorValido || personalizado === null)
      return void toast.error("Escolha uma faixa e informe um valor válido.");
    if (diferente && motivo.trim().length < 5)
      return void toast.error("Informe por que escolheu outra faixa ou alterou o preço.");
    if (!aprovadoPor.trim()) return void toast.error("Não foi possível identificar quem aprovou o preço.");
    onAprovar({
      pesoKg: peso,
      faixaSugerida: sugerida >= 0 ? tituloFaixa(faixas, sugerida) : null,
      valorSugerido: sugerida >= 0 ? faixas[sugerida].valor : null,
      faixaEscolhida: tituloFaixa(faixas, escolhida),
      valorAprovado: Math.round(personalizado * 100) / 100,
      justificativa: diferente ? motivo.trim() : "",
      aprovadoPor, aprovadoEm: new Date().toISOString(),
    });
  }

  return <section aria-label={"Aprovar preço por peso: " + item.nome}
    className="rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-sm">
    <div className="flex items-center gap-2">
      <Scale size={21} className="text-primary" />
      <div>
        <h3 className="text-sm font-black">{item.nome}: preço por peso</h3>
        <p className="text-xs text-muted-foreground">{[especie, sexo].filter(Boolean).join(" · ") || "Paciente sem espécie ou sexo informado"}. Confira e aprove antes de incluir na comanda.</p>
      </div>
    </div>
    {!faixas.length && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Não há preço cadastrado para a espécie e o sexo deste animal.</p>}
    <label className="mt-3 block text-xs font-semibold">Peso do animal (kg)
      <input inputMode="decimal" type="text" value={pesoTexto}
        onChange={e => { setPesoTexto(e.target.value); setEscolha("sugerida"); }}
        placeholder="Peso não registrado; escolha uma faixa manualmente"
        className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" />
      <span className="mt-1 block font-normal text-muted-foreground">
        {peso !== null
          ? sugerida >= 0 ? "Faixa identificada pelo peso do paciente." : "Sem faixa aplicável."
          : "Sem peso válido: selecione manualmente a faixa que deseja utilizar."}
      </span>
    </label>
    <div className="mt-3 space-y-2">
      {faixas.map((faixa, indice) => <label key={indice}
        className={"flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm " +
          ((escolha === "sugerida" ? sugerida === indice : escolhida === indice)
            ? "border-primary bg-primary/10" : "bg-background")}>
        <span className="flex items-center gap-2">
          <input type="radio" name={"faixa-peso-" + item.id} checked={escolha === "sugerida" ? sugerida === indice : escolhida === indice}
            onChange={() => setEscolha(String(indice))} />
          <span>{tituloFaixa(faixas, indice)} {sugerida === indice && <strong className="ml-1 text-xs text-primary">Sugerida</strong>}</span>
        </span>
        <strong className="tabular-nums">{valorEmReais(faixa.valor)}</strong>
      </label>)}
    </div>
    <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
      <input type="checkbox" checked={personalizar} onChange={e => setPersonalizar(e.target.checked)} />
      Cobrar outro valor
    </label>
    {personalizar && <label className="mt-2 block text-xs font-semibold">Valor aprovado (R$)
      <input type="text" inputMode="decimal" value={precoTexto} onChange={e=>setPrecoTexto(e.target.value)}
        placeholder="Ex.: 280,00" className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" />
    </label>}
    {diferente && <label className="mt-3 block text-xs font-semibold">Motivo da alteração *
      <textarea rows={2} maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)}
        placeholder="Ex.: valor autorizado pelo RT, cortesia parcial, atendimento especial"
        className="mt-1 w-full rounded-xl border bg-background p-3 text-sm font-normal" />
    </label>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
      <div>
        <p className="text-xs text-muted-foreground">Valor a aprovar</p>
        <p className="text-xl font-black tabular-nums">{valorValido && personalizado !== null ? valorEmReais(personalizado) : "Selecione uma faixa"}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="min-h-11 rounded-xl border px-3 text-sm font-semibold">Cancelar</button>
        <button type="button" onClick={aprovar} disabled={!valida || !valorValido || (diferente && motivo.trim().length < 5)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40">
          <CheckCircle2 size={17}/> Aprovar valor
        </button>
      </div>
    </div>
  </section>;
}

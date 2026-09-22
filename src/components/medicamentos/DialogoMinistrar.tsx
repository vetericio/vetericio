import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  calcularEntrada, doseDaEspecie, doseEfetiva, faixaDe, viasDe,
  especieBloqueada, numero, type Especie, type Medicamento,
} from "@/lib/medicamentos";
import { normalizarNomeMedicamento } from "@/lib/nomes";
import type { AplicacaoPendente } from "./DialogoAplicar";

type Props = {
  medicamento: Medicamento | null;
  especie: Especie;
  pesoInicial: string;
  onFechar: () => void;
  onConfirmar: (a: AplicacaoPendente) => void;
};

const campo = "w-full min-w-0 rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus:border-ring";
const rotulo = "block text-xs font-semibold text-muted-foreground";

export function DialogoMinistrar({ medicamento, especie, pesoInicial, onFechar, onConfirmar }: Props) {
  const [peso, setPeso] = useState(pesoInicial);
  const [via, setVia] = useState("");
  const [observacao, setObservacao] = useState("");
  const [dose, setDose] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [origem, setOrigem] = useState<"dose" | "quantidade">("dose");
  const [somenteMl, setSomenteMl] = useState(false);

  useEffect(() => {
    if (!medicamento) return;
    const padrao = doseEfetiva(doseDaEspecie(medicamento, especie));
    setPeso(pesoInicial);
    setVia(viasDe(medicamento)[0] ?? "");
    setObservacao("");
    setDose(padrao === null ? "" : String(padrao).replace(".", ","));
    setQuantidade("");
    setOrigem("dose");
    setSomenteMl(false);
  }, [medicamento, especie, pesoInicial]);

  if (!medicamento) return null;
  const cadastro = doseDaEspecie(medicamento, especie);
  const faixa = faixaDe(cadastro);
  const bloqueado = especieBloqueada(medicamento, especie);
  const entrada = calcularEntrada({
    peso, dose, quantidade, origem, unidadeDose: faixa.unidade,
    concentracaoValor: medicamento.concentracaoValor,
    concentracaoUnidade: medicamento.concentracaoUnidade,
  });
  const { resultado } = entrada;
  const quantidadeEmMl = numero(quantidade) !== null && (numero(quantidade) ?? 0) > 0;
  const podeConfirmar = !bloqueado && (resultado.ok || (somenteMl && quantidadeEmMl));
  const vias = viasDe(medicamento);
  const nome = [medicamento.nomeMenor, medicamento.nome]
    .map((n) => normalizarNomeMedicamento(n ?? "")).filter(Boolean).join(" ");

  const confirmar = () => {
    if (!podeConfirmar) return;
    onConfirmar({
      nome: medicamento.nome,
      ...(medicamento.nomeMenor ? { nomeMenor: medicamento.nomeMenor } : {}),
      dose: somenteMl ? "" : `${entrada.dose} ${faixa.unidade}`,
      quantidade: somenteMl
        ? `${quantidade} mL`
        : `${entrada.quantidade} ${entrada.unidadeQuantidade}`,
      via,
      duracao: cadastro.intervalo ? `a cada ${cadastro.intervalo}h` : "",
      ...(peso.trim() ? { peso: `${peso.trim()} kg` } : {}),
      ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
      ...(medicamento.especial ? { cobrada: true } : {}),
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Medições do animal</DialogTitle>
          <DialogDescription>{nome} — confira os dados antes de confirmar.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-secondary/60 p-3 text-sm">
          <p>Concentração cadastrada: {medicamento.concentracaoValor} {medicamento.concentracaoUnidade}</p>
          <p>Dose cadastrada: {faixa.min}{faixa.max ? ` – ${faixa.max}` : ""} {faixa.unidade}</p>
          <p>Intervalo: {cadastro.intervalo ? `${cadastro.intervalo}h` : "—"}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className={rotulo}>Peso (kg)
            <input value={peso} onChange={(e) => setPeso(e.target.value)} inputMode="decimal" className={campo} />
          </label>
          <label className={rotulo}>Via
            <select value={via} onChange={(e) => setVia(e.target.value)} className={campo}>
              {!vias.length && <option value="">Não cadastrada</option>}
              {vias.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-primary p-3">
          <label className={rotulo}>Dose ({faixa.unidade})
            <input aria-label={`Dose em ${faixa.unidade}`} value={somenteMl ? "" : entrada.dose}
              onChange={(e) => { setSomenteMl(false); setOrigem("dose"); setDose(e.target.value); }}
              inputMode="decimal" disabled={somenteMl} className={`${campo} disabled:opacity-50`} />
          </label>
          <label className={rotulo}>Quantidade ({entrada.unidadeQuantidade || "apresentação"})
            <input aria-label="Quantidade a ministrar" value={entrada.quantidade}
              onChange={(e) => { setOrigem("quantidade"); setQuantidade(e.target.value); }}
              inputMode="decimal" className={campo} />
          </label>
          <button
            type="button"
            onClick={() => {
              setSomenteMl((atual) => !atual);
              setOrigem("quantidade");
              setDose("");
            }}
            className="col-span-2 w-fit rounded-lg border border-input px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
          >
            {somenteMl ? "Calcular pela dose" : "Usar somente mL"}
          </button>
          <p className="col-span-2 text-xs text-muted-foreground">
            {somenteMl
              ? "Informe somente o volume em mL que será administrado. A dose não será exigida nem registrada."
              : "Edite qualquer campo. Dose por kg e dose total são valores diferentes."}
          </p>
        </div>
        {bloqueado ? <p className="text-destructive">Medicamento bloqueado no cadastro para esta espécie.</p>
          : somenteMl && quantidadeEmMl ? <p className="text-sm text-muted-foreground">Será registrada somente a quantidade: {quantidade} mL.</p>
          : resultado.ok ? <div className="text-sm">
            <p>Dose total: {resultado.doseTotalTexto}</p>
            <p>Quantidade: {entrada.quantidade} {entrada.unidadeQuantidade}</p>
            <p className="text-xs text-muted-foreground">{resultado.contaDose} · {resultado.contaVolume}</p>
          </div> : <p className="text-sm text-destructive">{resultado.motivo}</p>}
        <label className={rotulo}>Observação (opcional)
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} className={campo} />
        </label>
        <button type="button" onClick={confirmar} disabled={!podeConfirmar}
          className="w-full rounded-xl bg-primary px-3 py-3 font-bold text-primary-foreground disabled:opacity-50">
          Confirmar ministração
        </button>
      </DialogContent>
    </Dialog>
  );
}

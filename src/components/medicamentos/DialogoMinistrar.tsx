import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  calcularEntrada, doseDaEspecie, dosePadraoCadastrada, faixaDe, viasDe,
  especieBloqueada, numero, unidadesRegistroManual, type Especie, type Medicamento,
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

export function DialogoMinistrar(props: Props) {
  if (!props.medicamento) return null;
  return <DialogoMinistrarContexto key={JSON.stringify([props.medicamento, props.especie, props.pesoInicial])} {...props} />;
}

function DialogoMinistrarContexto({ medicamento, especie, pesoInicial, onFechar, onConfirmar }: Props) {
  const [peso, setPeso] = useState(pesoInicial);
  const [via, setVia] = useState("");
  const [observacao, setObservacao] = useState("");
  const [dose, setDose] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [origem, setOrigem] = useState<"dose" | "quantidade">("dose");
  const [manual, setManual] = useState(false);
  const [unidadeManual, setUnidadeManual] = useState("");

  useEffect(() => {
    if (!medicamento) return;
    const padrao = dosePadraoCadastrada(doseDaEspecie(medicamento, especie));
    setPeso(pesoInicial);
    setVia(viasDe(medicamento)[0] ?? "");
    setObservacao("");
    setDose(padrao === null ? "" : String(padrao).replace(".", ","));
    setQuantidade("");
    setOrigem("dose");
    setManual(false);
    setUnidadeManual("");
  }, [medicamento, especie, pesoInicial]);

  if (!medicamento) return null;
  const cadastro = doseDaEspecie(medicamento, especie);
  const temDoseCadastrada = dosePadraoCadastrada(cadastro) !== null;
  const faixa = faixaDe(cadastro);
  const bloqueado = especieBloqueada(medicamento, especie);
  const entrada = calcularEntrada({
    peso, dose, quantidade, origem, unidadeDose: faixa.unidade,
    concentracaoValor: medicamento.concentracaoValor,
    concentracaoUnidade: medicamento.concentracaoUnidade,
  });
  const { resultado } = entrada;
  const unidadesManuais = unidadesRegistroManual(medicamento.concentracaoUnidade);
  const quantidadeManualValida = unidadesManuais.includes(unidadeManual) && (numero(quantidade) ?? 0) > 0;
  const podeConfirmar = !bloqueado && (manual ? quantidadeManualValida : resultado.ok);
  const vias = viasDe(medicamento);
  const nome = [medicamento.nomeMenor, medicamento.nome]
    .map((n) => normalizarNomeMedicamento(n ?? "")).filter(Boolean).join(" ");

  const confirmar = () => {
    if (!podeConfirmar) return;
    onConfirmar({
      nome: medicamento.nome,
      ...(medicamento.nomeMenor ? { nomeMenor: medicamento.nomeMenor } : {}),
      dose: manual ? "" : `${entrada.dose} ${faixa.unidade}`,
      quantidade: manual
        ? `${quantidade.trim()} ${unidadeManual}`
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
          <p>Faixa cadastrada (referência): {faixa.min}{faixa.max ? ` – ${faixa.max}` : ""} {faixa.unidade}</p>
          <p>Intervalo: {cadastro.intervalo ? `${cadastro.intervalo}h` : "—"}</p>
        </div>
        {!temDoseCadastrada && <p className="text-sm">Dose padrão não cadastrada. Informe a dose prescrita para este paciente.</p>}
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
          {manual ? <>
            <label className={rotulo}>Unidade efetivamente administrada
              <select value={unidadeManual} disabled={bloqueado} className={campo}
                onChange={(e) => { setUnidadeManual(e.target.value); setQuantidade(""); }}>
                <option value="">Selecione a unidade</option>
                {unidadesManuais.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label className={rotulo}>Quantidade efetivamente administrada
              <input value={quantidade} onChange={(e) => setQuantidade(e.target.value)}
                disabled={bloqueado || !unidadeManual} inputMode="decimal" className={campo} />
            </label>
          </> : <>
            <label className={rotulo}>Dose ({faixa.unidade})
              <input aria-label={`Dose em ${faixa.unidade}`} value={entrada.dose}
                onChange={(e) => { setOrigem("dose"); setDose(e.target.value); }}
                disabled={bloqueado} inputMode="decimal" className={campo} />
            </label>
            <label className={rotulo}>Quantidade ({entrada.unidadeQuantidade || "sem unidade compatível"})
              <input aria-label="Quantidade calculada" value={entrada.quantidade}
                onChange={(e) => { setOrigem("quantidade"); setQuantidade(e.target.value); }}
                disabled={bloqueado || !entrada.unidadeQuantidade} inputMode="decimal" className={campo} />
            </label>
          </>}
          <button
            type="button" disabled={bloqueado}
            onClick={() => {
              setManual((atual) => !atual);
              setOrigem("dose");
              setDose("");
              setQuantidade("");
              setUnidadeManual("");
            }}
            className="col-span-2 w-fit rounded-lg border border-input px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-50"
          >
            {manual ? "Voltar ao cálculo pela dose" : "Registrar quantidade sem cálculo"}
          </button>
          <p className="col-span-2 text-xs text-muted-foreground">
            {manual
              ? "Selecione a unidade da apresentação e informe a quantidade já administrada. Não há conversão. Confira a mesma quantidade na ficha do paciente antes de registrar."
              : "Confira a unidade. Dose por kg e dose total são valores diferentes."}
          </p>
        </div>
        {bloqueado ? <p className="text-destructive">Medicamento bloqueado no cadastro para esta espécie.</p>
          : manual ? quantidadeManualValida && <p className="text-sm text-muted-foreground">
            Quantidade informada: {quantidade} {unidadeManual}. Sem cálculo.
          </p>
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
          Conferir paciente e aplicação
        </button>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";

import {
  aplicarBackup,
  baixarBackup,
  gerarImagemQr,
  lerArquivoBackup,
  montarBackup,
  resumirBackup,
  validarBackup,
  type Backup as DadosBackup,
  type ResumoBackup,
} from "@/lib/backup";
import {
  apagarTransferencia,
  buscarTransferencia,
  enviarTransferencia,
} from "@/lib/transferencia.functions";

type Aviso = { tipo: "ok" | "erro"; texto: string } | null;

function dataCurta(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function linhaResumo(r: ResumoBackup): string {
  return [
    `${r.registros} animal(is)`,
    `${r.plantoes} plantão(ões)`,
    `${r.curvas} curva(s)`,
    `${r.alarmes} alarme(s)`,
    `${r.medicamentos} medicamento(s)`,
  ].join(" · ");
}

function codigoDaUrl(texto: string): string | null {
  const direto = texto.trim().match(/^[0-9]{6}$/);
  if (direto) return direto[0];
  try {
    const url = new URL(texto.trim());
    const c = url.searchParams.get("transfer") ?? "";
    return /^[0-9]{6}$/.test(c) ? c : null;
  } catch {
    return null;
  }
}

export function Backup() {
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, setPendente] = useState<DadosBackup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [digitando, setDigitando] = useState(false);
  const [codigoManual, setCodigoManual] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lendo, setLendo] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const trilha = useRef<MediaStream | null>(null);

  const pararCamera = () => {
    trilha.current?.getTracks().forEach((t) => t.stop());
    trilha.current = null;
    setLendo(false);
  };

  useEffect(() => pararCamera, []);

  // Abre a restauração direto quando o link do QR foi aberto no navegador.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("transfer");
    if (c && /^[0-9]{6}$/.test(c)) {
      setAberto(true);
      void receberPorCodigo(c);
      const limpa = new URL(window.location.href);
      limpa.searchParams.delete("transfer");
      window.history.replaceState(null, "", limpa.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gerar = () => {
    baixarBackup();
    setAviso({ tipo: "ok", texto: "Backup gerado. Envie o arquivo para o outro aparelho." });
  };

  const escolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    const dados = await lerArquivoBackup(arquivo);
    if (!dados) {
      setAviso({ tipo: "erro", texto: "Arquivo inválido — nada foi alterado." });
      return;
    }
    setAviso(null);
    setPendente(dados);
  };

  const restaurar = (modo: "substituir" | "juntar") => {
    if (!pendente) return;
    aplicarBackup(pendente, modo);
    setPendente(null);
    if (codigo) void apagarTransferencia({ data: { codigo } }).catch(() => undefined);
    window.location.assign("/");
  };

  async function receberPorCodigo(valor: string) {
    setOcupado(true);
    setAviso(null);
    try {
      const { json } = await buscarTransferencia({ data: { codigo: valor } });
      if (!json) {
        setAviso({ tipo: "erro", texto: "Código não encontrado ou expirado (validade de 24h)." });
        return;
      }
      const dados = validarBackup(JSON.parse(json));
      if (!dados) {
        setAviso({ tipo: "erro", texto: "Esses dados não são um backup do app." });
        return;
      }
      setCodigo(valor);
      setDigitando(false);
      setPendente(dados);
    } catch {
      setAviso({ tipo: "erro", texto: "Sem internet ou falha ao baixar. Use o arquivo de backup." });
    } finally {
      setOcupado(false);
    }
  }

  const enviarNuvem = async () => {
    setQr(null);
    setCodigo(null);
    setAviso(null);
    setOcupado(true);
    try {
      const { codigo: novo } = await enviarTransferencia({ data: { dados: montarBackup() } });
      const link = `${window.location.origin}/?transfer=${novo}`;
      setCodigo(novo);
      setQr(await gerarImagemQr(link));
    } catch (e) {
      const motivo = e instanceof Error && e.message ? e.message : "";
      setAviso({
        tipo: "erro",
        texto: motivo
          ? `Não foi possível enviar. ${motivo}`
          : "Não foi possível enviar. Verifique a internet ou use o arquivo de backup.",
      });
    } finally {
      setOcupado(false);
    }
  };


  const apagarNuvem = async () => {
    if (!codigo) return;
    await apagarTransferencia({ data: { codigo } }).catch(() => undefined);
    setQr(null);
    setCodigo(null);
    setAviso({ tipo: "ok", texto: "Backup apagado da nuvem." });
  };

  const lerQr = async () => {
    setAviso(null);
    setQr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      trilha.current = stream;
      setLendo(true);
      const el = video.current;
      if (!el) return;
      el.srcObject = stream;
      await el.play();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const jsQR = (await import("jsqr")).default;

      const procurar = async () => {
        if (!trilha.current || !ctx) return;
        if (el.videoWidth > 0) {
          canvas.width = el.videoWidth;
          canvas.height = el.videoHeight;
          ctx.drawImage(el, 0, 0);
          const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const achado = jsQR(imagem.data, canvas.width, canvas.height);
          if (achado?.data) {
            const c = codigoDaUrl(achado.data);
            pararCamera();
            if (c) await receberPorCodigo(c);
            else setAviso({ tipo: "erro", texto: "Esse QR não é um backup do app." });
            return;
          }
        }
        requestAnimationFrame(() => void procurar());
      };
      void procurar();
    } catch {
      setLendo(false);
      setAviso({ tipo: "erro", texto: "Não foi possível abrir a câmera." });
    }
  };

  const botao =
    "rounded-lg bg-secondary px-3 py-2 text-[12px] font-semibold text-secondary-foreground hover:bg-secondary/70 disabled:opacity-50";

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/70"
      >
        Backup
      </button>


      {aberto && (
        <div className="mx-auto mt-2 max-w-md rounded-xl bg-secondary/60 p-3 text-left">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Backup:</span> uma cópia congelada dos
            dados (uma foto do momento), em arquivo ou por QR. Serve para guardar ou levar tudo para
            outro aparelho uma vez. Não fica se atualizando.
            <br />
            <span className="font-semibold text-foreground">Sincronização</span> é diferente: dois
            aparelhos com o mesmo código ficam sempre iguais, atualizando sozinhos.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Qual escolher? Guardar ou mudar de aparelho → Backup. Usar dois aparelhos ao mesmo tempo →
            Sincronização.
          </p>


          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={gerar}
              className="rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground"
            >
              Gerar backup
            </button>
            <button
              type="button"
              onClick={() => inputArquivo.current?.click()}
              className={botao}
            >
              Restaurar backup
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void enviarNuvem()}
              className={botao}
            >
              Enviar por QR
            </button>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void lerQr()}
              className="rounded-lg border border-input px-3 py-2 text-[12px] font-semibold text-foreground"
            >
              Ler QR
            </button>
            <button
              type="button"
              onClick={() => setDigitando((v) => !v)}
              className="rounded-lg border border-input px-3 py-2 text-[12px] font-semibold text-foreground"
            >
              Tenho um código
            </button>
          </div>

          {digitando && (
            <div className="mt-2 flex gap-2">
              <input
                value={codigoManual}
                onChange={(e) => setCodigoManual(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="000000"
                aria-label="Código de 6 dígitos"
                className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-center text-[13px] tracking-widest"
              />
              <button
                type="button"
                disabled={ocupado || codigoManual.length !== 6}
                onClick={() => void receberPorCodigo(codigoManual)}
                className="rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                Buscar
              </button>
            </div>
          )}

          <input
            ref={inputArquivo}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void escolherArquivo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {qr && (
            <div className="mt-3 text-center">
              <img
                src={qr}
                alt="QR com o link do backup"
                className="mx-auto w-48 rounded-lg bg-white p-2"
              />
              {codigo && (
                <p className="mt-1 text-[15px] font-bold tracking-[0.3em] text-foreground">
                  {codigo}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                No outro aparelho, toque em “Ler QR” ou digite o código. Válido por 24 horas. Precisa
                de internet nos dois aparelhos.
              </p>
              <button
                type="button"
                onClick={() => void apagarNuvem()}
                className="mt-1 text-[11px] font-semibold underline"
              >
                Apagar agora
              </button>
            </div>
          )}

          {lendo && (
            <div className="mt-3 text-center">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={video} playsInline muted className="mx-auto w-56 rounded-lg bg-black" />
              <button
                type="button"
                onClick={pararCamera}
                className="mt-1 text-[11px] font-semibold underline"
              >
                Cancelar leitura
              </button>
            </div>
          )}

          {pendente && (
            <div className="mt-3 rounded-lg border border-input p-3">
              <p className="text-[12px] font-semibold text-foreground">Backup encontrado</p>
              <p className="text-[11px] text-muted-foreground">
                {linhaResumo(resumirBackup(pendente))}
                {dataCurta(pendente.criadoEm) ? ` — de ${dataCurta(pendente.criadoEm)}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => restaurar("substituir")}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-[12px] font-semibold text-destructive-foreground"
                >
                  Substituir tudo
                </button>
                <button
                  type="button"
                  onClick={() => restaurar("juntar")}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
                >
                  Juntar
                </button>
                <button
                  type="button"
                  onClick={() => setPendente(null)}
                  className="rounded-lg bg-secondary px-3 py-1.5 text-[12px] font-semibold text-secondary-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {aviso && (
            <p
              className={`mt-2 text-[11px] font-semibold ${
                aviso.tipo === "erro" ? "text-destructive" : "text-foreground"
              }`}
            >
              {aviso.texto}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

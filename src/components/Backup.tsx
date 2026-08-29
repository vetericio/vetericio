import { useEffect, useRef, useState } from "react";

import {
  LIMITE_QR,
  aplicarBackup,
  backupParaTextoQr,
  baixarBackup,
  gerarImagemQr,
  lerArquivoBackup,
  montarBackup,
  resumirBackup,
  textoQrParaBackup,
  type Backup as DadosBackup,
  type ResumoBackup,
} from "@/lib/backup";

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
  const partes = [
    `${r.registros} animal(is)`,
    `${r.plantoes} plantão(ões)`,
    `${r.curvas} curva(s)`,
    `${r.alarmes} alarme(s)`,
  ];
  return partes.join(" · ");
}

export function Backup() {
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, setPendente] = useState<DadosBackup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
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
    window.location.assign("/");
  };

  const mostrarQr = async () => {
    setQr(null);
    setAviso(null);
    const texto = await backupParaTextoQr(montarBackup());
    if (texto.length > LIMITE_QR) {
      setAviso({
        tipo: "erro",
        texto: "Os dados são grandes para um QR. Use o arquivo de backup.",
      });
      return;
    }
    setQr(await gerarImagemQr(texto));
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
            const dados = await textoQrParaBackup(achado.data);
            pararCamera();
            if (dados) setPendente(dados);
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

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="text-[11px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Backup
      </button>

      {aberto && (
        <div className="mx-auto mt-2 max-w-md rounded-xl bg-secondary/60 p-3 text-left">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Transfira os dados para outro aparelho sem internet: gere o arquivo e envie como quiser
            (Bluetooth, cabo, WhatsApp, e-mail), ou use o QR na câmera.
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
              className="rounded-lg bg-secondary px-3 py-2 text-[12px] font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              Restaurar backup
            </button>
            <button
              type="button"
              onClick={() => void mostrarQr()}
              className="rounded-lg bg-secondary px-3 py-2 text-[12px] font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              Enviar por QR
            </button>
          </div>

          <button
            type="button"
            onClick={() => void lerQr()}
            className="mt-2 w-full rounded-lg border border-input px-3 py-2 text-[12px] font-semibold text-foreground"
          >
            Ler QR de outro aparelho
          </button>

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
                alt="QR com os dados do app"
                className="mx-auto w-48 rounded-lg bg-white p-2"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                No outro aparelho, toque em “Ler QR de outro aparelho”.
              </p>
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

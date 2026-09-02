import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSync } from "@/hooks/useSync";
import { gerarImagemQr } from "@/lib/backup";
import { codigoDoQr, quandoSync, textoQrSync } from "@/lib/sync";

const ROTULO: Record<string, string> = {
  "sem-codigo": "Não sincronizado",
  sincronizado: "Sincronizado ✓",
  sincronizando: "Sincronizando…",
  pendente: "Alterações pendentes",
  erro: "Erro ao sincronizar",
};

const COR: Record<string, string> = {
  "sem-codigo": "text-muted-foreground",
  sincronizado: "text-primary",
  sincronizando: "text-muted-foreground",
  pendente: "text-amber-600",
  erro: "text-destructive",
};

/** Sincronização entre dois aparelhos por código curto + QR. */
export function Sincronizacao() {
  const {
    codigo,
    estado,
    ultima,
    erro,
    temDesfazer,
    pausada,
    resumo,
    sincronizar,
    criarCodigo,
    usarCodigo,
    desfazer,
    desconectar,
  } = useSync();
  const [aberto, setAberto] = useState(false);
  const [qr, setQr] = useState("");
  const [digitado, setDigitado] = useState("");
  const [lendo, setLendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const trilha = useRef<MediaStream | null>(null);

  const pararCamera = () => {
    trilha.current?.getTracks().forEach((t) => t.stop());
    trilha.current = null;
    setLendo(false);
  };

  useEffect(() => pararCamera, []);

  useEffect(() => {
    if (!aberto || !codigo) {
      setQr("");
      return;
    }
    let ativo = true;
    void gerarImagemQr(textoQrSync(codigo)).then((imagem) => {
      if (ativo) setQr(imagem);
    });
    return () => {
      ativo = false;
    };
  }, [aberto, codigo]);

  const conectar = async (texto: string) => {
    const ok = await usarCodigo(codigoDoQr(texto));
    if (!ok) {
      toast.error("Código inválido. Confira o código do outro aparelho.");
      return;
    }
    setDigitado("");
    toast.success("Aparelhos conectados. Dados sincronizados.");
  };

  const lerQr = async () => {
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
            pararCamera();
            await conectar(achado.data);
            return;
          }
        }
        requestAnimationFrame(() => void procurar());
      };
      void procurar();
    } catch {
      setLendo(false);
      toast.error("Não foi possível abrir a câmera.");
    }
  };

  const confirmarDesfazer = () => {
    if (desfazer()) {
      toast.success("Sincronização desfeita. Os dados voltaram como estavam.");
      window.location.assign("/");
    } else {
      toast.error("Não há cópia anterior para desfazer.");
    }
    setConfirmando(false);
  };

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/70"
      >
        Sincronizar
      </button>

      {aberto && (
        <div className="mx-auto mt-2 max-w-md rounded-2xl border border-border bg-card p-3 text-left">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Sincronização:</span> dois aparelhos com o
            mesmo código ficam sempre iguais. Tudo que você registrar em um aparece no outro. Funciona
            offline: sobe sozinho quando a internet voltar.
            <br />
            <span className="font-semibold text-foreground">Backup</span> é diferente: é uma cópia
            congelada (uma foto do momento), em arquivo ou por QR, que não fica se atualizando.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Qual escolher? Guardar ou mudar de aparelho → Backup. Usar dois aparelhos ao mesmo tempo →
            Sincronização.
          </p>

          <p className={`mt-3 text-xs font-semibold ${COR[estado] ?? ""}`}>
            {ROTULO[estado] ?? estado}
            {ultima ? ` • ${quandoSync(ultima)}` : ""}
          </p>
          {erro && <p className="mt-1 text-[11px] text-muted-foreground">{erro}</p>}

          {codigo ? (
            <>
              <p className="mt-2 text-[11px] text-muted-foreground">
                No outro aparelho, escolha “Sincronizar”, leia este QR ou digite o código abaixo.
              </p>
              {qr && (
                <img
                  src={qr}
                  alt="QR com o código de sincronização"
                  className="mx-auto mt-2 h-40 w-40 rounded-lg bg-white p-1"
                />
              )}
              <p className="mt-2 break-all rounded-lg bg-secondary/60 px-2 py-2 text-center font-mono text-xl font-bold tracking-[0.25em]">
                {codigo}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(codigo)}
                  className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
                >
                  Copiar código
                </button>
                <button
                  type="button"
                  onClick={() => void sincronizar(true)}
                  className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                >
                  Sincronizar agora
                </button>
                <button
                  type="button"
                  onClick={desconectar}
                  className="rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
                >
                  Desconectar
                </button>
              </div>

              {temDesfazer && !confirmando && (
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  className="mt-2 w-full rounded-lg border border-input px-3 py-2 text-xs font-semibold text-foreground"
                >
                  Desfazer última sincronização
                </button>
              )}
              {confirmando && (
                <div className="mt-2 rounded-lg border border-destructive/40 p-2">
                  <p className="text-[11px] text-muted-foreground">
                    Os dados deste aparelho voltam como estavam antes da última junção. A
                    sincronização automática fica pausada até você tocar em “Sincronizar agora”.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={confirmarDesfazer}
                      className="rounded-lg bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground"
                    >
                      Desfazer mesmo
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(false)}
                      className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void criarCodigo()}
                className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                Gerar código deste aparelho
              </button>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Já tenho um código
              </p>
              <div className="mt-1 flex gap-2">
                <input
                  value={digitado}
                  onChange={(e) =>
                    setDigitado(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "")
                        .slice(0, 7),
                    )
                  }
                  inputMode="text"
                  maxLength={7}
                  placeholder="a123456"
                  aria-label="Código do outro aparelho"
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-2 text-center font-mono text-base tracking-[0.2em] outline-none focus:border-ring"
                />
                <button
                  type="button"
                  onClick={() => void conectar(digitado)}
                  className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground"
                >
                  Conectar
                </button>
              </div>
              <button
                type="button"
                onClick={() => void lerQr()}
                className="mt-2 w-full rounded-lg border border-input px-3 py-2 text-xs font-semibold text-foreground"
              >
                Ler QR do outro aparelho
              </button>
            </>
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

          <p className="mt-3 text-[11px] text-muted-foreground">
            Funciona offline: tudo fica salvo no aparelho e sobe sozinho quando a internet voltar.
          </p>
        </div>
      )}
    </div>
  );
}

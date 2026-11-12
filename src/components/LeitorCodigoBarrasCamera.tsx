import { Camera, ScanBarcode, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

type ResultadoCodigo = { rawValue: string };
type DetectorCodigo = { detect: (video: HTMLVideoElement) => Promise<ResultadoCodigo[]> };
type DetectorCodigoConstrutor = (new (opcoes: { formats: string[] }) => DetectorCodigo) & {
  getSupportedFormats?: () => Promise<string[]>;
};
const formatosPreferidos = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

function mensagemErroCamera(erro: unknown): string {
  const nome = erro instanceof Error ? erro.name : "";
  if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(nome)) {
    return "O Chrome bloqueou o uso da câmera. Confira a permissão do site e do aplicativo nas configurações do Android.";
  }
  if (["NotFoundError", "DevicesNotFoundError"].includes(nome)) {
    return "Nenhuma câmera disponível foi encontrada neste dispositivo.";
  }
  if (["NotReadableError", "TrackStartError"].includes(nome)) {
    return "A câmera está sendo utilizada por outro aplicativo. Feche-o e tente novamente.";
  }
  return erro instanceof Error ? erro.message : "Não foi possível iniciar a câmera.";
}

/** Captura local do código: não envia imagens ao servidor nem salva o formulário. */
export function LeitorCodigoBarrasCamera({ onCodigoLido, desabilitado = false }: {
  onCodigoLido: (codigo: string) => void;
  desabilitado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [erroCamera, setErroCamera] = useState("");
  const [sessao, setSessao] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const tentativaRef = useRef(0);
  const callbackRef = useRef(onCodigoLido);

  useEffect(() => { callbackRef.current = onCodigoLido; }, [onCodigoLido]);

  const encerrarStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);
  const fechar = useCallback(() => {
    tentativaRef.current += 1;
    encerrarStream();
    setAberto(false);
    setIniciando(false);
    setErroCamera("");
  }, [encerrarStream]);

  async function solicitarCamera() {
    if (iniciando || desabilitado || streamRef.current) return;
    setErroCamera("");
    if (typeof window === "undefined" || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setErroCamera("É necessário acessar o ORICSE por HTTPS em um navegador com suporte à câmera.");
      setAberto(true);
      return;
    }
    const Detector = (window as Window & { BarcodeDetector?: DetectorCodigoConstrutor }).BarcodeDetector;
    if (!Detector) {
      setErroCamera("Seu navegador não oferece leitura de código de barras por câmera. Atualize o Chrome ou digite o código com o teclado/leitor USB.");
      setAberto(true);
      return;
    }
    const tentativa = ++tentativaRef.current;
    setIniciando(true);
    try {
      // Chamada diretamente no clique, para o navegador apresentar a solicitação de permissão.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (tentativa !== tentativaRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      setSessao(anterior => anterior + 1);
      setAberto(true);
    } catch (erro) {
      if (tentativa !== tentativaRef.current) return;
      setErroCamera(mensagemErroCamera(erro));
      setAberto(true);
    } finally {
      if (tentativa === tentativaRef.current) setIniciando(false);
    }
  }

  useEffect(() => {
    if (!aberto || !streamRef.current) return;
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!video) return;
    let ativo = true;
    let intervalo: ReturnType<typeof setInterval> | undefined;

    async function iniciarLeitura() {
      try {
        video!.srcObject = stream;
        await video!.play();
        const Detector = (window as Window & { BarcodeDetector?: DetectorCodigoConstrutor }).BarcodeDetector;
        if (!Detector) throw new Error("O leitor não está disponível neste navegador.");
        const suportados = Detector.getSupportedFormats
          ? await Detector.getSupportedFormats()
          : formatosPreferidos;
        const formatos = formatosPreferidos.filter(formato => suportados.includes(formato));
        if (!formatos.length) throw new Error("Não há um formato de código de barras compatível neste navegador.");
        if (!ativo) return;
        const detector = new Detector({ formats: formatos });
        let processando = false;
        intervalo = setInterval(async () => {
          if (!ativo || processando || video!.readyState < 2) return;
          processando = true;
          try {
            const resultado = await detector.detect(video!);
            const codigo = resultado[0]?.rawValue?.trim();
            if (ativo && codigo) {
              fechar();
              callbackRef.current(codigo);
              toast.success("Código de barras lido. Confira e salve o produto.");
            }
          } catch {
            // Aguarda um próximo quadro mais nítido.
          } finally {
            processando = false;
          }
        }, 300);
      } catch (erro) {
        if (!ativo) return;
        encerrarStream();
        setErroCamera(mensagemErroCamera(erro));
      }
    }
    void iniciarLeitura();
    return () => {
      ativo = false;
      if (intervalo) clearInterval(intervalo);
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [aberto, sessao, encerrarStream, fechar]);

  useEffect(() => () => {
    tentativaRef.current += 1;
    encerrarStream();
  }, [encerrarStream]);

  return (
    <>
      <button type="button" onClick={() => void solicitarCamera()} disabled={desabilitado || iniciando}
        className="mt-1 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
        aria-label="Ler código de barras com a câmera">
        <Camera size={17} aria-hidden="true"/> {iniciando ? "Abrindo…" : "Câmera"}
      </button>
      {aberto && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-3" role="presentation">
          <section role="dialog" aria-modal="true" aria-label="Ler código de barras do produto"
            className="w-full max-w-lg space-y-3 rounded-2xl border bg-card p-4 shadow-2xl">
            <header className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-bold">
                <ScanBarcode size={19} className="text-primary"/> Código de barras do produto
              </h3>
              <button type="button" onClick={fechar} aria-label="Fechar leitor de código de barras"
                className="rounded-lg border p-2"><X size={18}/></button>
            </header>
            {erroCamera ? (
              <div role="alert" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">{erroCamera}</p>
                <p>No Chrome Android, toque no ícone ao lado do endereço do site → Permissões → Câmera → Permitir. Confira também Android → Apps → Chrome → Permissões → Câmera.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void solicitarCamera()} disabled={iniciando}
                    className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">
                    {iniciando ? "Solicitando…" : "Tentar novamente"}
                  </button>
                  <button type="button" onClick={fechar} className="rounded-lg border px-4 py-2 font-semibold">Digitar código</button>
                </div>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay muted playsInline className="max-h-[55vh] w-full rounded-xl bg-black object-cover"/>
                <p className="text-xs text-muted-foreground">
                  Aponte para o código de barras. O número será preenchido no cadastro, sem salvar o produto automaticamente.
                </p>
              </>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

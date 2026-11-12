import { Camera, Flashlight, Focus, ScanBarcode, Volume2, ZoomIn, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type CodigoLido = {
  rawValue: string;
  format: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
};
type Detector = { detect: (imagem: HTMLVideoElement) => Promise<CodigoLido[]> };
type ConstrutorDetector = (new (opcoes: { formats: string[] }) => Detector) & {
  getSupportedFormats?: () => Promise<string[]>;
};
type CapacidadesCamera = MediaTrackCapabilities & {
  torch?: boolean;
  focusMode?: string[];
  zoom?: { min: number; max: number; step?: number };
};
type RestricoesCamera = MediaTrackConstraintSet & {
  torch?: boolean;
  focusMode?: string;
  zoom?: number;
};
const formatos = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];
// GTIN com dígito verificador válido pode ser confirmado mais rapidamente.
const leiturasParaConfirmar = 2;
const intervaloMaximoLeitura = 1800;

function codigoGTINValido(codigo: string): boolean {
  if (!/^\d+$/.test(codigo) || ![8, 12, 13].includes(codigo.length)) return false;
  const digitos = [...codigo].map(Number);
  const verificador = digitos.pop()!;
  let soma = 0;
  for (let indice = digitos.length - 1, peso = 3; indice >= 0; indice--, peso = peso === 3 ? 1 : 3) {
    soma += digitos[indice] * peso;
  }
  return (10 - (soma % 10)) % 10 === verificador;
}

/**
 * OCR não aceita códigos internos não verificáveis: só GTIN 8/12/13 com
 * checksum, vistos pelo menos duas vezes. Evita confundir preços e números
 * impressos na embalagem com o identificador do produto.
 */
function candidatosNumericosOCR(texto: string): string[] {
  const linhas = texto.split(/\r?\n/);
  const valores = new Set<string>();
  for (const linha of linhas) {
    const grupos = linha.match(/\d+/g) || [];
    const juntos = grupos.join("");
    for (const valor of [...grupos, juntos]) {
      if (codigoGTINValido(valor)) valores.add(valor);
    }
  }
  return [...valores];
}

function resultadoValido(item: CodigoLido): string | null {
  const codigo = item.rawValue?.trim();
  if (!codigo || codigo.length > 80 || /[\x00-\x1f\x7f]/.test(codigo)) return null;
  const formato = item.format?.toLowerCase();
  if (!formatos.includes(formato)) return null;
  if (formato === "ean_13" && (codigo.length !== 13 || !codigoGTINValido(codigo))) return null;
  if (formato === "ean_8" && (codigo.length !== 8 || !codigoGTINValido(codigo))) return null;
  if (formato === "upc_a" && (codigo.length !== 12 || !codigoGTINValido(codigo))) return null;
  // UPC-E e códigos internos não têm o mesmo formato de dígito verificador
  // disponível no leitor. Confirmação em 3 quadros reduz falsos positivos.
  if (formato === "upc_e" && !/^\d{6,8}$/.test(codigo)) return null;
  if (formato === "itf" && (!/^\d+$/.test(codigo) || codigo.length < 4 || codigo.length % 2 !== 0)) return null;
  if (["code_128", "code_39"].includes(formato) && codigo.length < 3) return null;
  return codigo;
}

/**
 * Seleciona a etiqueta no centro da parte VISÍVEL da câmera.
 * object-cover pode recortar a imagem: usar videoWidth/Height sem esse ajuste
 * faria códigos fora do enquadramento serem aceitos incorretamente.
 */
function resultadoMaisCentral(resultados: CodigoLido[], video: HTMLVideoElement): CodigoLido | undefined {
  const largura = video.videoWidth || 1;
  const altura = video.videoHeight || 1;
  const wVisivel = video.clientWidth || largura;
  const hVisivel = video.clientHeight || altura;
  const escala = Math.max(wVisivel / largura, hVisivel / altura);
  const areaW = wVisivel / escala;
  const areaH = hVisivel / escala;
  const deslocX = (largura - areaW) / 2;
  const deslocY = (altura - areaH) / 2;
  const elegiveis = resultados.filter(item => {
    if (!resultadoValido(item)) return false;
    if (!item.boundingBox) return resultados.length === 1;
    const centroX = (item.boundingBox.x + item.boundingBox.width / 2 - deslocX) / areaW;
    const centroY = (item.boundingBox.y + item.boundingBox.height / 2 - deslocY) / areaH;
    // A região de confirmação é um pouco maior que a moldura visível, para
    // permitir etiquetas estreitas e pequenas sem ler outras embalagens.
    return centroX >= 0.09 && centroX <= 0.91 && centroY >= 0.24 && centroY <= 0.76;
  });
  return elegiveis.sort((a, b) => {
    const distancia = (item: CodigoLido) => {
      if (!item.boundingBox) return 1;
      const x = (item.boundingBox.x + item.boundingBox.width / 2 - deslocX) / areaW - 0.5;
      const y = (item.boundingBox.y + item.boundingBox.height / 2 - deslocY) / areaH - 0.5;
      return x * x + y * y;
    };
    return distancia(a) - distancia(b);
  })[0];
}

function erroDaCamera(erro: unknown): string {
  const nome = erro instanceof Error ? erro.name : "";
  if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(nome))
    return "A câmera foi bloqueada pelo navegador. Autorize o acesso ao site e tente novamente.";
  if (["NotFoundError", "DevicesNotFoundError"].includes(nome))
    return "Não foi encontrada uma câmera disponível neste dispositivo.";
  if (["NotReadableError", "TrackStartError"].includes(nome))
    return "A câmera está ocupada por outro aplicativo. Feche-o e tente novamente.";
  return erro instanceof Error ? erro.message : "Não foi possível abrir a câmera.";
}

/** Bip produzido localmente. O volume final depende do aparelho e do navegador. */
function bipConfirmacao(audio: AudioContext | null) {
  if (!audio) return;
  const tocar = () => {
    if (audio.state !== "running") return;
    try {
      const inicio = audio.currentTime + 0.005;
      const oscilador = audio.createOscillator();
      const ganho = audio.createGain();
      oscilador.type = "square";
      oscilador.frequency.setValueAtTime(1150, inicio);
      oscilador.frequency.setValueAtTime(1380, inicio + 0.095);
      ganho.gain.setValueAtTime(0.001, inicio);
      ganho.gain.linearRampToValueAtTime(0.58, inicio + 0.012);
      ganho.gain.setValueAtTime(0.58, inicio + 0.185);
      ganho.gain.exponentialRampToValueAtTime(0.001, inicio + 0.225);
      oscilador.connect(ganho);
      ganho.connect(audio.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + 0.23);
      oscilador.onended = () => { oscilador.disconnect(); ganho.disconnect(); };
    } catch { /* Áudio opcional quando o dispositivo bloqueia reprodução */ }
  };
  if (audio.state === "suspended") void audio.resume().then(tocar).catch(() => {});
  else tocar();
}

/** Um leitor reutilizável para PDV e cadastro, sem upload da imagem capturada. */
export function LeitorCodigoBarrasCamera({
  onCodigoLido, desabilitado = false, classeBotao, rotuloBotao = "Câmera",
}: {
  onCodigoLido: (codigo: string) => boolean | void;
  desabilitado?: boolean;
  classeBotao?: string;
  rotuloBotao?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [sessao, setSessao] = useState(0);
  const [lanternaDisponivel, setLanternaDisponivel] = useState(false);
  const [lanternaLigada, setLanternaLigada] = useState(false);
  const [faixaZoom, setFaixaZoom] = useState<{min:number;max:number;step:number}|null>(null);
  const [zoom, setZoom] = useState(1);
  const [focoDisponivel, setFocoDisponivel] = useState(false);
  const [refocando, setRefocando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [statusOCR, setStatusOCR] = useState<"carregando" | "ativo" | "indisponivel" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const tentativaRef = useRef(0);
  const callbackRef = useRef(onCodigoLido);
  const ultimoCodigoRef = useRef<{codigo:string;origem:"barras"|"numeros";quando:number}|null>(null);
  useEffect(() => { callbackRef.current = onCodigoLido; }, [onCodigoLido]);

  const parar = useCallback(() => {
    streamRef.current?.getTracks().forEach(trilha => trilha.stop());
    streamRef.current = null;
  }, []);
  const fechar = useCallback(() => {
    tentativaRef.current += 1;
    parar();
    setAberto(false);
    setAbrindo(false);
    setErro("");
    setAviso("");
    setLanternaLigada(false);
    setLanternaDisponivel(false);
    setFaixaZoom(null);
    setZoom(1);
    setFocoDisponivel(false);
    setRefocando(false);
    setProgresso(0);
    setStatusOCR(null);
  }, [parar]);

  const solicitarCamera = async () => {
    if (abrindo || desabilitado || streamRef.current) return;
    setErro(""); setAviso("");
    if (typeof window === "undefined" || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setErro("Abra o ORICSE por HTTPS em um navegador que permita usar a câmera.");
      setAberto(true);
      return;
    }
    if (!(window as Window & { BarcodeDetector?: ConstrutorDetector }).BarcodeDetector) {
      setErro("Este navegador não oferece leitura automática de códigos de barras. Experimente o Chrome atualizado ou digite o código.");
      setAberto(true);
      return;
    }
    const tentativa = ++tentativaRef.current;
    setAbrindo(true);
    try {
      // A chamada é feita no gesto do usuário, para disparar a permissão do Android.
      const requisicao = navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      // Desbloqueia o áudio no mesmo toque; não solicita microfone.
      if (!audioRef.current && typeof AudioContext !== "undefined") audioRef.current = new AudioContext();
      if (audioRef.current?.state === "suspended") void audioRef.current.resume().catch(() => {});
      const stream = await requisicao;
      if (tentativa !== tentativaRef.current) {
        stream.getTracks().forEach(trilha => trilha.stop());
        return;
      }
      streamRef.current = stream;
      const trilha = stream.getVideoTracks()[0];
      const capacidades = trilha?.getCapabilities?.() as CapacidadesCamera | undefined;
      setLanternaDisponivel(Boolean(capacidades?.torch));
      setLanternaLigada(false);
      const capacidadeZoom = capacidades?.zoom;
      if (capacidadeZoom && Number.isFinite(capacidadeZoom.min) && Number.isFinite(capacidadeZoom.max) && capacidadeZoom.max > capacidadeZoom.min) {
        const alcance = {min:capacidadeZoom.min,max:Math.min(capacidadeZoom.max,6),step:capacidadeZoom.step && capacidadeZoom.step>0?capacidadeZoom.step:0.1};
        if (alcance.max > alcance.min) {
          setFaixaZoom(alcance);
          setZoom(Math.max(alcance.min, Math.min(alcance.max, trilha.getSettings().zoom ?? 1)));
        } else setFaixaZoom(null);
      } else setFaixaZoom(null);
      setFocoDisponivel(Boolean(capacidades?.focusMode?.includes("single-shot") || capacidades?.focusMode?.includes("continuous")));
      setProgresso(0);
      if (capacidades?.focusMode?.includes("continuous")) {
        void trilha.applyConstraints({ advanced: [{ focusMode: "continuous" } as RestricoesCamera] }).catch(() => {});
      }
      setSessao(anterior => anterior + 1);
      setAberto(true);
    } catch (falha) {
      if (tentativa !== tentativaRef.current) return;
      setErro(erroDaCamera(falha));
      setAberto(true);
    } finally {
      if (tentativa === tentativaRef.current) setAbrindo(false);
    }
  };

  async function alternarLanterna() {
    const trilha = streamRef.current?.getVideoTracks()[0];
    if (!trilha) return;
    try {
      await trilha.applyConstraints({ advanced: [{ torch: !lanternaLigada } as RestricoesCamera] });
      setLanternaLigada(valor => !valor);
    } catch {
      setAviso("Lanterna indisponível neste dispositivo.");
    }
  }

  async function alterarZoom(novo: number) {
    const trilha = streamRef.current?.getVideoTracks()[0];
    if (!trilha || !faixaZoom) return;
    const valor = Math.max(faixaZoom.min,Math.min(faixaZoom.max,novo));
    setZoom(valor);
    try {
      await trilha.applyConstraints({advanced:[{zoom:valor} as RestricoesCamera]});
    } catch {
      setAviso("O zoom não pôde ser ajustado nesta câmera.");
    }
  }

  async function refocar() {
    const trilha = streamRef.current?.getVideoTracks()[0];
    if (!trilha || refocando) return;
    const capacidades = trilha.getCapabilities?.() as CapacidadesCamera | undefined;
    const modos = capacidades?.focusMode || [];
    setRefocando(true);
    try {
      if (modos.includes("single-shot")) {
        await trilha.applyConstraints({advanced:[{focusMode:"single-shot"} as RestricoesCamera]});
      } else if (modos.includes("continuous")) {
        await trilha.applyConstraints({advanced:[{focusMode:"continuous"} as RestricoesCamera]});
      } else {
        setAviso("O foco é automático neste aparelho. Afaste um pouco o código da câmera.");
      }
    } catch {
      setAviso("O ajuste de foco não é suportado por esta câmera.");
    } finally { setRefocando(false); }
  }

  useEffect(() => {
    if (!aberto || !streamRef.current || !videoRef.current) return;
    const stream = streamRef.current;
    const video = videoRef.current;
    let ativo = true;
    let intervalo: ReturnType<typeof setInterval> | undefined;
    let ultimo = "";
    let vezes = 0;
    let vistoEm = 0;
    let rejeitadoEm = 0;
    let ultimoOCR = "";
    let vezesOCR = 0;
    let vistoOCR = 0;
    let ocrOcupado = false;
    let ocrTimer: ReturnType<typeof setInterval> | undefined;
    let workerOCR: import("tesseract.js").Worker | null = null;
    let fechandoLeitura = false;
    let ultimaLeituraDeBarras = 0;
    const confirmarCodigo = (codigo: string, origem: "barras" | "numeros") => {
      if (!ativo || fechandoLeitura) return;
      let aceito = false;
      try { aceito = callbackRef.current(codigo) !== false; }
      catch { aceito = false; }
      if (aceito) {
        fechandoLeitura = true;
        ultimoCodigoRef.current = {codigo,origem,quando:Date.now()};
        bipConfirmacao(audioRef.current);
        if ("vibrate" in navigator) navigator.vibrate?.(70);
        fechar();
      } else {
        rejeitadoEm = Date.now();
        setProgresso(0);
        setAviso("Código " + codigo + " não aceito. Confira a etiqueta ou tente outro produto.");
      }
    };
    const criarRecorteNumeros = () => {
      if (video.videoWidth < 300 || video.videoHeight < 200) return null;
      // Região central, contendo barras e a linha de números sob elas.
      const x = Math.floor(video.videoWidth * 0.09);
      const y = Math.floor(video.videoHeight * 0.30);
      const w = Math.floor(video.videoWidth * 0.82);
      const h = Math.floor(video.videoHeight * 0.45);
      const canvas = document.createElement("canvas");
      const escala = Math.min(2, 1500 / w);
      canvas.width = Math.max(1, Math.floor(w * escala));
      canvas.height = Math.max(1, Math.floor(h * escala));
      const contexto = canvas.getContext("2d", {willReadFrequently:true});
      if (!contexto) return null;
      contexto.imageSmoothingEnabled = true;
      contexto.drawImage(video, x,y,w,h, 0,0,canvas.width,canvas.height);
      return canvas;
    };

    async function iniciar() {
      try {
        video.srcObject = stream;
        await video.play();
        const Construtor = (window as Window & { BarcodeDetector?: ConstrutorDetector }).BarcodeDetector;
        if (!Construtor) throw new Error("Leitor não disponível neste navegador.");
        const suportados = Construtor.getSupportedFormats
          ? await Construtor.getSupportedFormats() : formatos;
        const habilitados = formatos.filter(formato => suportados.includes(formato));
        if (!habilitados.length) throw new Error("O navegador não suporta leitura de códigos de barras.");
        if (!ativo) return;
        const detector = new Construtor({ formats: habilitados });
        let processando = false;
        intervalo = setInterval(async () => {
          if (!ativo || processando || video.readyState < 2) return;
          processando = true;
          try {
            const lista = await detector.detect(video);
            if (!ativo) return;
            const selecionado = resultadoMaisCentral(lista, video);
            const codigo = selecionado && resultadoValido(selecionado);
            if (!codigo) {
              if (vezes && Date.now() - vistoEm > 850) { vezes = 0; setProgresso(0); }
              return;
            }
            const agora = Date.now();
            ultimaLeituraDeBarras = agora;
            if (codigo === ultimo && agora - vistoEm <= intervaloMaximoLeitura) vezes += 1;
            else { ultimo = codigo; vezes = 1; }
            vistoEm = agora;
            setProgresso(Math.min(vezes,leiturasParaConfirmar));
            if (vezes < leiturasParaConfirmar || agora - rejeitadoEm < 2400) return;
            vezes = 0;
            confirmarCodigo(codigo,"barras");
          } catch {
            // Ignora um quadro com desfoque, reflexo ou movimento.
          } finally {
            processando = false;
          }
        }, 120);

        // OCR roda como segunda via, em baixa frequência e num worker separado.
        // O scanner de barras continua responsivo durante a análise de números.
        setStatusOCR("carregando");
        void (async () => {
          try {
            const {createWorker, PSM} = await import("tesseract.js");
            const worker = await createWorker("eng",1);
            if (!ativo) { await worker.terminate(); return; }
            workerOCR = worker;
            await worker.setParameters({
              tessedit_char_whitelist:"0123456789 ",
              tessedit_pageseg_mode:PSM.SPARSE_TEXT,
            });
            if (!ativo) return;
            setStatusOCR("ativo");
            ocrTimer = setInterval(() => {
              if (!ativo || fechandoLeitura || ocrOcupado || video.readyState < 2) return;
              // Evita gastar bateria quando o detector de barras já está lendo.
              if (Date.now() - ultimaLeituraDeBarras < 750) return;
              const recorte = criarRecorteNumeros();
              if (!recorte || !workerOCR) return;
              ocrOcupado = true;
              void workerOCR.recognize(recorte).then(({data})=>{
                if (!ativo || fechandoLeitura) return;
                const candidatos = candidatosNumericosOCR(data.text || "");
                if (candidatos.length !== 1) return; // número ambíguo não entra no caixa
                const codigo = candidatos[0];
                const agora = Date.now();
                if (codigo === ultimoOCR && agora - vistoOCR <= 6500) vezesOCR += 1;
                else {ultimoOCR = codigo;vezesOCR = 1;}
                vistoOCR = agora;
                if (vezesOCR >= 2 && agora - rejeitadoEm >= 2400) {
                  vezesOCR = 0;
                  confirmarCodigo(codigo,"numeros");
                }
              }).catch(()=>{
                if (ativo) setStatusOCR("indisponivel");
              }).finally(()=>{ ocrOcupado=false; });
            }, 1100);
          } catch {
            if (ativo) setStatusOCR("indisponivel");
          }
        })();
      } catch (falha) {
        if (!ativo) return;
        parar();
        setErro(erroDaCamera(falha));
      }
    }
    void iniciar();
    return () => {
      ativo = false;
      if (intervalo) clearInterval(intervalo);
      if (ocrTimer) clearInterval(ocrTimer);
      if (workerOCR) void workerOCR.terminate().catch(() => {});
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [aberto, sessao, fechar, parar]);

  useEffect(() => () => {
    tentativaRef.current += 1;
    parar();
    if (audioRef.current) void audioRef.current.close().catch(() => {});
  }, [parar]);

  return <>
    <button type="button" disabled={desabilitado || abrindo} onClick={() => void solicitarCamera()}
      aria-label="Ler código de barras com a câmera"
      className={classeBotao || "mt-1 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"}>
      <Camera size={18} aria-hidden="true"/> {abrindo ? "Abrindo…" : rotuloBotao}
    </button>
    {aberto && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-3" role="presentation">
        <section role="dialog" aria-modal="true" aria-label="Leitor de código de barras"
          className="w-full max-w-xl space-y-3 rounded-2xl border bg-card p-4 shadow-2xl">
          <header className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-bold">
              <ScanBarcode size={20} className="text-primary"/> Ler código de barras
            </h3>
            <button type="button" onClick={fechar} aria-label="Fechar câmera" className="rounded-lg border p-2"><X size={18}/></button>
          </header>
          {erro ? <div role="alert" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">{erro}</p>
            <p>No Chrome do Android, libere a câmera nas permissões de oricse.com.br e em Configurações do Android → Apps → Chrome → Permissões.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void solicitarCamera()} disabled={abrindo}
                className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">
                {abrindo ? "Solicitando…" : "Tentar novamente"}
              </button>
              <button type="button" onClick={fechar} className="rounded-lg border px-4 py-2">Digitar código</button>
            </div>
          </div> : <>
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} autoPlay muted playsInline className="max-h-[60vh] min-h-48 w-full object-cover"/>
              <div className="pointer-events-none absolute inset-x-[12%] top-[34%] h-[32%] rounded-lg border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.14)]">
                <div className="absolute inset-x-2 top-1/2 border-t border-red-400/90"/>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lanternaDisponivel && <button type="button" onClick={() => void alternarLanterna()}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold">
                <Flashlight size={18}/> {lanternaLigada ? "Desligar lanterna" : "Ligar lanterna"}
              </button>}
              {focoDisponivel && <button type="button" onClick={() => void refocar()} disabled={refocando}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">
                <Focus size={18}/> {refocando ? "Focando…" : "Refocar"}
              </button>}
            </div>
            {faixaZoom && <label className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold">
              <ZoomIn size={18} aria-hidden="true"/>
              <span className="shrink-0">Zoom {zoom.toFixed(1)}×</span>
              <input type="range" className="min-w-0 flex-1 accent-primary" min={faixaZoom.min}
                max={faixaZoom.max} step={faixaZoom.step} value={zoom}
                onChange={evento => void alterarZoom(Number(evento.target.value))}
                aria-label="Aproximação da câmera"/>
            </label>}
            <div className="space-y-1" role="status" aria-live="polite">
              <p className="text-xs font-medium">{progresso ? `Confirmando código: ${progresso} de ${leiturasParaConfirmar}` : "Procurando código no centro da imagem…"}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all duration-150"
                  style={{width:`${100*progresso/leiturasParaConfirmar}%`}}/>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => bipConfirmacao(audioRef.current)}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold">
                <Volume2 size={18}/> Testar bip
              </button>
              <span className="text-xs text-muted-foreground">A altura do som depende do volume de mídia do celular.</span>
            </div>
            <p className="text-sm font-medium">Centralize a etiqueta, afaste um pouco o celular e mantenha a câmera imóvel.</p>
            <p className="text-xs text-muted-foreground">Leitura dupla: barras + reconhecimento local dos números impressos. Códigos EAN/UPC passam por verificação e confirmação para evitar erros. O bip toca após leitura aceita.</p>
            <p className="text-xs text-muted-foreground" role="status">{statusOCR === "carregando" ? "Preparando reconhecimento dos números…" : statusOCR === "ativo" ? "Leitura dos números ativa · pode demorar um pouco mais em celulares lentos" : statusOCR === "indisponivel" ? "Leitura numérica indisponível. O leitor de barras permanece ativo." : "Procurando código…"}</p>
            {aviso && <p role="status" className="rounded-lg bg-secondary p-2 text-sm">{aviso}</p>}
          </>}
        </section>
      </div>, document.body,
    )}
  </>;
}

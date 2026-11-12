/**
 * Decodificador independente do BarcodeDetector nativo do navegador.
 * Executa na memória local sobre cada quadro do vídeo; não grava ou envia fotos.
 */
export type CodigoReconhecido = { rawValue: string; format: string };

export async function criarLeitorZXing(): Promise<(quadro: HTMLCanvasElement) => CodigoReconhecido | null> {
  const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);
  const formatos = new Map<number, string>([
    [BarcodeFormat.EAN_13, "ean_13"],
    [BarcodeFormat.EAN_8, "ean_8"],
    [BarcodeFormat.UPC_A, "upc_a"],
    [BarcodeFormat.UPC_E, "upc_e"],
    [BarcodeFormat.CODE_128, "code_128"],
    [BarcodeFormat.CODE_39, "code_39"],
    [BarcodeFormat.ITF, "itf"],
  ]);
  const dicas = new Map();
  dicas.set(DecodeHintType.POSSIBLE_FORMATS, [...formatos.keys()]);
  dicas.set(DecodeHintType.TRY_HARDER, true);
  const leitor = new BrowserMultiFormatOneDReader(dicas);

  return (quadro: HTMLCanvasElement): CodigoReconhecido | null => {
    try {
      const resultado = leitor.decodeFromCanvas(quadro);
      const formato = formatos.get(resultado.getBarcodeFormat());
      const codigo = resultado.getText()?.trim();
      if (!formato || !codigo) return null;
      return { rawValue: codigo, format: formato };
    } catch {
      // Um quadro sem código não é erro: o próximo quadro pode estar nítido.
      return null;
    }
  };
}

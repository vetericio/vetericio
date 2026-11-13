export async function prepararFotoDoPet(arquivo: File) {
  if (arquivo.size > 15 * 1024 * 1024) throw new Error("Escolha uma foto de até 15 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) {
    throw new Error("Escolha uma imagem JPG, PNG ou WebP.");
  }

  const imagem = await createImageBitmap(arquivo).catch(() => {
    throw new Error("Não foi possível abrir a imagem selecionada.");
  });
  try {
    const canvas = document.createElement("canvas");
    const escala = Math.min(1, 640 / Math.max(imagem.width, imagem.height));
    canvas.width = Math.max(1, Math.round(imagem.width * escala));
    canvas.height = Math.max(1, Math.round(imagem.height * escala));
    const desenho = canvas.getContext("2d");
    if (!desenho) throw new Error("Não foi possível preparar a foto.");
    desenho.fillStyle = "#fff";
    desenho.fillRect(0, 0, canvas.width, canvas.height);
    desenho.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    for (const qualidade of [0.84, 0.7, 0.55]) {
      const foto = canvas.toDataURL("image/jpeg", qualidade);
      if (foto.length <= 350000 && foto.startsWith("data:image/jpeg;base64,")) return foto;
    }
    throw new Error("A foto ficou grande demais. Escolha uma imagem menor.");
  } finally {
    imagem.close();
  }
}

import fs from 'node:fs';
const p='src/routes/admin.tsx';
let s=fs.readFileSync(p,'utf8');
if(!s.includes('enviarArquivoPublicoPlataforma')){
  s=s.replace('import { enviarLogoClinica } from "@/lib/clinic-logo.functions";','import { enviarLogoClinica } from "@/lib/clinic-logo.functions";\nimport { enviarArquivoPublicoPlataforma } from "@/lib/platform-drive.functions";');
}
const antigo=`      const extensao = logoArquivo.name.split(".").pop()?.toLowerCase() || "png";
      const caminho = \`site/logo-publica.\${extensao}\`;
      const { error: uploadError } = await supabase.storage.from("oricse-branding").upload(caminho, logoArquivo, { upsert: true, contentType: logoArquivo.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("oricse-branding").getPublicUrl(caminho);
      const novaConfig = { ...site, logo_url: \`\${data.publicUrl}?v=\${Date.now()}\` };`;
const novo=`      const accessToken = await tokenAtual();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Não foi possível ler a imagem."));
        reader.readAsDataURL(logoArquivo);
      });
      const upload = await enviarArquivoPublicoPlataforma({ data: { accessToken, nome: logoArquivo.name, mimeType: logoArquivo.type || "image/png", base64 } });
      const novaConfig = { ...site, logo_url: upload.url };`;
if(s.includes(antigo))s=s.replace(antigo,novo);

const marca=`      setSelecionada({ ...selecionada, logo_url: resultado.logoUrl });
      await carregarTudo();`;
const marcaNova=`      const { error: logoPersistError } = await (supabase as any).from("clinicas").update({ logo_url: resultado.logoUrl, updated_at: new Date().toISOString() }).eq("id", selecionada.id);
      if (logoPersistError) throw logoPersistError;
      setSelecionada({ ...selecionada, logo_url: resultado.logoUrl });
      await carregarTudo();`;
if(s.includes(marca))s=s.replace(marca,marcaNova);

fs.writeFileSync(p,s);
console.log('Branding e logos de clínicas persistem no Google Drive.');

import { Camera, Loader2, PawPrint } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { enviarArquivoDrive } from "@/lib/drive.functions";
import { carregarFotoAnimalDrive } from "@/lib/animal-photo.functions";

const ANIMAIS_KEY = "oricse-animais-v1";
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const LIMITE = 8 * 1024 * 1024;

type AnimalLocal = { id: string; nome: string; fotoDriveFileId?: string; fotoNome?: string };
function lerAnimais(): AnimalLocal[] { try { const valor = JSON.parse(localStorage.getItem(ANIMAIS_KEY) || "[]"); return Array.isArray(valor) ? valor : []; } catch { return []; } }
function arquivoParaDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(new Error("Não foi possível ler a imagem.")); reader.readAsDataURL(file); }); }
async function sessaoClinica() {
  const { data: sessao } = await supabase.auth.getSession(); const accessToken = sessao.session?.access_token; const userId = sessao.session?.user?.id; if (!accessToken || !userId) throw new Error("Sessão não encontrada.");
  const { data: vinculo, error } = await (supabase as any).from("clinica_usuarios").select("clinica_id").eq("user_id", userId).eq("ativo", true).limit(1).maybeSingle(); if (error) throw error; if (!vinculo?.clinica_id) throw new Error("Usuário não vinculado a uma clínica."); return { accessToken, clinicaId: String(vinculo.clinica_id) };
}

export function FotoAnimalDrive({ animalId, nome, tamanho = "md" }: { animalId: string; nome: string; tamanho?: "md" | "lg" }) {
  const inputRef = useRef<HTMLInputElement | null>(null); const [foto, setFoto] = useState<string | null>(null); const [enviando, setEnviando] = useState(false); const [carregando, setCarregando] = useState(false);
  useEffect(() => { let ativo = true; async function carregar() { const animal = lerAnimais().find((item) => item.id === animalId); if (!animal?.fotoDriveFileId) return; setCarregando(true); try { const { accessToken, clinicaId } = await sessaoClinica(); const resposta = await carregarFotoAnimalDrive({ data: { accessToken, clinicaId, animalId, driveFileId: animal.fotoDriveFileId } }); if (ativo) setFoto(resposta.dataUrl); } catch (e) { console.warn("[foto-animal]", e); } finally { if (ativo) setCarregando(false); } } void carregar(); return () => { ativo = false; }; }, [animalId]);
  async function escolher(file?: File) {
    if (!file) return; if (!TIPOS.includes(file.type)) return void toast.error("Use uma foto JPG, PNG ou WebP."); if (file.size > LIMITE) return void toast.error("A foto deve ter no máximo 8 MB."); setEnviando(true);
    try {
      const { accessToken, clinicaId } = await sessaoClinica(); const base64 = await arquivoParaDataUrl(file); const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"; const nomeArquivo = `foto-${nome.trim().toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "animal"}-${animalId.slice(0, 8)}.${ext}`;
      const resposta = await enviarArquivoDrive({ data: { accessToken, clinicaId, categoria: "animais", nome: nomeArquivo, mimeType: file.type, base64, visibilidade: "interno", entidadeTipo: "animal", entidadeId: animalId, metadata: { finalidade: "foto_perfil_animal", animalNome: nome } } });
      const lista = lerAnimais(); const atualizada = lista.map((item) => item.id === animalId ? { ...item, fotoDriveFileId: resposta.arquivo.driveId, fotoNome: resposta.arquivo.nome || nomeArquivo } : item); localStorage.setItem(ANIMAIS_KEY, JSON.stringify(atualizada)); setFoto(base64); toast.success("Foto do animal salva no Drive da clínica.");
    } catch (e) { toast.error((e as Error).message || "Não foi possível salvar a foto."); } finally { setEnviando(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  const dimensao = tamanho === "lg" ? "h-24 w-24" : "h-16 w-16";
  return <div className="relative shrink-0"><button type="button" onClick={() => inputRef.current?.click()} className={`group relative flex ${dimensao} items-center justify-center overflow-hidden rounded-2xl border bg-primary/10 text-primary shadow-sm`} title={foto ? "Trocar foto do animal" : "Adicionar foto do animal"}>{foto ? <img src={foto} alt={`Foto de ${nome}`} className="h-full w-full object-cover" /> : <PawPrint size={tamanho === "lg" ? 34 : 26} />}<span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100"><Camera size={11} /> {foto ? "Trocar" : "Foto"}</span>{(enviando || carregando) && <span className="absolute inset-0 flex items-center justify-center bg-white/75"><Loader2 className="animate-spin" size={20} /></span>}</button><button type="button" onClick={() => inputRef.current?.click()} className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border bg-white text-primary shadow" aria-label={foto ? "Trocar foto do animal" : "Adicionar foto do animal"}><Camera size={14} /></button><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void escolher(e.target.files?.[0])} /></div>;
}

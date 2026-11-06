import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Send,
  Trash2,
  CalendarClock,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { importMediaFromUrl, savePost } from "@/lib/posts.functions";
import { MediaPicker, type LibraryAsset } from "@/components/media-library";
import {
  contarHashtags,
  contarMencoes,
  toLocalInput,
  uploadMedia,
  type PostTipo,
} from "@/lib/media";
import { errorMessage, qk, useAccounts, useBrands, useSettings } from "@/lib/queries";

type Asset = {
  id: string;
  tipo: string;
  public_url: string | null;
  largura: number | null;
  altura: number | null;
  duracao_s: number | null;
  nome_original: string | null;
};

const TIPOS: { value: PostTipo; label: string; ajuda: string }[] = [
  { value: "imagem", label: "Imagem", ajuda: "1 imagem no feed (proporção de 4:5 a 1,91:1)." },
  { value: "carrossel", label: "Carrossel", ajuda: "2 a 20 imagens ou vídeos, na ordem abaixo." },
  {
    value: "reels",
    label: "Reels",
    ajuda: "1 vídeo MP4/MOV de 3 s a 15 min, até 300 MB. Capa opcional.",
  },
  {
    value: "story",
    label: "Story",
    ajuda: "1 imagem ou vídeo (até 60 s). A API não permite adesivos de link.",
  },
];

export const postQueryKey = (id: string) => ["post", id] as const;

export function PostEditor({ postId, isAdmin }: { postId?: string; isAdmin: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const accounts = useAccounts();
  const brands = useBrands();
  const settings = useSettings();
  const managed = (accounts.data ?? []).filter((a) => a.gerenciada);

  const [accountId, setAccountId] = useState("");
  const [tipo, setTipo] = useState<PostTipo>("imagem");
  const [titulo, setTitulo] = useState("");
  const [campanha, setCampanha] = useState("");
  const [legenda, setLegenda] = useState("");
  const [altText, setAltText] = useState("");
  const [media, setMedia] = useState<Asset[]>([]);
  const [capa, setCapa] = useState<Asset | null>(null);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [quando, setQuando] = useState(defaultQuando());
  const [uploading, setUploading] = useState(false);
  const [confirmNow, setConfirmNow] = useState(false);
  const [picker, setPicker] = useState<"midia" | "capa" | null>(null);

  const onPick = (assets: LibraryAsset[]) => {
    for (const a of assets) {
      if (picker === "capa") {
        if (a.tipo !== "imagem") {
          toast.error("A capa precisa ser uma imagem.");
          return;
        }
        setCapa(a as Asset);
        continue;
      }
      if (tipo === "reels" && a.tipo !== "video") {
        toast.error("Reels precisa de um vídeo.");
        return;
      }
      if (tipo === "imagem" && a.tipo !== "imagem") {
        toast.error("Este formato precisa de uma imagem.");
        return;
      }
      if (a.tipo === "imagem" && tipo !== "story" && a.largura && a.altura) {
        const r = a.largura / a.altura;
        if (r < 0.79 || r > 1.92) toast.warning(`"${a.nome_original}" está fora da proporção do feed (4:5 a 1,91:1); a Meta pode recusar.`);
      }
      setMedia((m) => (m.length >= maxItens || m.some((x) => x.id === a.id) ? m : [...m, a as Asset]));
    }
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const capaRef = useRef<HTMLInputElement>(null);

  const existing = useQuery({
    queryKey: postQueryKey(postId ?? "novo"),
    enabled: !!postId,
    queryFn: async () => {
      const { data: post, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", postId!)
        .single();
      if (error) throw error;
      const ids = [...post.media_asset_ids, ...(post.capa_asset_id ? [post.capa_asset_id] : [])];
      const { data: assets } = ids.length
        ? await supabase.from("media_assets").select("*").in("id", ids)
        : { data: [] };
      return { post, assets: assets ?? [] };
    },
  });

  useEffect(() => {
    if (!postId && !accountId && managed.length === 1) setAccountId(managed[0]!.id);
  }, [managed, postId, accountId]);

  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    const byId = new Map<string, Asset>(d.assets.map((a) => [a.id, a as Asset]));
    setAccountId(d.post.instagram_account_id);
    setTipo(d.post.tipo as PostTipo);
    setTitulo(d.post.titulo ?? "");
    setCampanha(d.post.campanha ?? "");
    setLegenda(d.post.legenda ?? "");
    setAltText(d.post.alt_text ?? "");
    setMedia(d.post.media_asset_ids.map((id) => byId.get(id)).filter((a): a is Asset => !!a));
    setCapa(d.post.capa_asset_id ? (byId.get(d.post.capa_asset_id) ?? null) : null);
    setShareToFeed(d.post.share_to_feed);
    if (d.post.agendado_para) setQuando(toLocalInput(d.post.agendado_para));
  }, [existing.data]);

  const account = managed.find((a) => a.id === accountId);
  const brand = (brands.data ?? []).find((b) => b.instagram_account_id === accountId);
  const hashtags = contarHashtags(legenda);
  const mencoes = contarMencoes(legenda);
  const editavel =
    !existing.data ||
    ["rascunho", "aguardando_aprovacao", "agendado", "falhou"].includes(existing.data.post.status);
  const maxItens = tipo === "carrossel" ? 20 : 1;

  const onFiles = async (files: FileList | null, finalidade: "midia" | "capa") => {
    if (!files?.length) return;
    if (!accountId) {
      toast.error("Escolha a conta antes de enviar arquivos.");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (finalidade === "midia" && media.length >= maxItens) {
          toast.error(
            tipo === "carrossel"
              ? "O carrossel aceita no máximo 20 itens."
              : "Este formato aceita só 1 arquivo. Remova o atual para trocar.",
          );
          break;
        }
        const asset = (await uploadMedia(file, accountId, tipo, finalidade)) as Asset;
        if (finalidade === "capa") setCapa(asset);
        else setMedia((m) => [...m, asset]);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (capaRef.current) capaRef.current.value = "";
    }
  };

  const onImport = async (url: string, finalidade: "midia" | "capa") => {
    if (!accountId) {
      toast.error("Escolha a conta antes de importar arquivos.");
      return false;
    }
    setUploading(true);
    try {
      const asset = (await importMediaFromUrl({
        data: { instagram_account_id: accountId, url: url.trim() },
      })) as Asset;
      if (finalidade === "capa" && asset.tipo !== "imagem")
        throw new Error("A capa do Reels precisa ser uma imagem JPEG.");
      if (finalidade === "midia" && tipo === "reels" && asset.tipo !== "video")
        throw new Error("Reels precisa de um vídeo.");
      if (finalidade === "midia" && tipo === "imagem" && asset.tipo !== "imagem")
        throw new Error("Para vídeo, escolha o formato Reels, Carrossel ou Story.");
      if (finalidade === "capa") setCapa(asset);
      else setMedia((m) => [...m, asset]);
      toast.success("Arquivo importado.");
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setUploading(false);
    }
  };

  const move = (i: number, d: -1 | 1) =>
    setMedia((m) => {
      const n = [...m];
      const j = i + d;
      if (j < 0 || j >= n.length) return m;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });

  const save = useMutation({
    mutationFn: (acao: "rascunho" | "agendar" | "publicar_agora") =>
      savePost({
        data: {
          ...(postId ? { id: postId } : {}),
          instagram_account_id: accountId,
          tipo,
          titulo: titulo.trim() || null,
          campanha: campanha.trim() || null,
          legenda: tipo === "story" ? null : legenda,
          alt_text: altText.trim() || null,
          media_asset_ids: media.map((m) => m.id),
          capa_asset_id: tipo === "reels" ? (capa?.id ?? null) : null,
          share_to_feed: shareToFeed,
          agendado_para: quando ? new Date(quando).toISOString() : null,
          acao,
        },
      }),
    onSuccess: (r, acao) => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: qk.audit });
      r.avisos.forEach((a) => toast.warning(a));
      if (acao === "rascunho") toast.success("Rascunho salvo.");
      else if (acao === "agendar")
        toast.success(
          r.status === "agendado"
            ? `Agendado para ${new Date(quando).toLocaleString("pt-BR")}.`
            : "Enviado para aprovação de um administrador.",
        );
      else if (r.resultado === "publicado") toast.success("Publicado no Instagram.");
      else if (r.resultado === "falhou")
        toast.error("A Meta recusou a publicação. Veja o motivo no histórico.");
      else
        toast.info(
          "A Meta ainda está processando a mídia. O sistema termina a publicação sozinho e o resultado aparece no histórico.",
        );
      navigate({
        to: acao === "rascunho" ? "/rascunhos" : acao === "agendar" ? "/agendadas" : "/historico",
      });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const preview = media[0];
  const busy = save.isPending || uploading;
  const canSubmit = !!accountId && media.length > 0 && !busy && editavel;

  if (postId && existing.isLoading)
    return <Loader2 className="size-5 animate-spin text-muted-foreground" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {!editavel ? (
          <Alert>
            <AlertDescription>
              Esta publicação está em processamento ou já foi publicada e não pode mais ser editada.
            </AlertDescription>
          </Alert>
        ) : null}
        {settings.data?.pausa_geral ? (
          <Alert variant="destructive">
            <AlertDescription>
              A pausa geral está ativa: dá para salvar e agendar, mas nada será publicado até você
              retomar.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conta e formato</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select
                value={accountId}
                onValueChange={(v) => {
                  setAccountId(v);
                  setMedia([]);
                  setCapa(null);
                }}
                disabled={!!postId || busy}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={managed.length ? "Escolha a conta" : "Nenhuma conta gerenciada"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {managed.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      @{a.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Formato</Label>
              <Select
                value={tipo}
                onValueChange={(v) => {
                  setTipo(v as PostTipo);
                  setMedia([]);
                  setCapa(null);
                }}
                disabled={busy || !editavel}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TIPOS.find((t) => t.value === tipo)?.ajuda}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="titulo">Nome interno (opcional)</Label>
              <Input
                id="titulo"
                value={titulo}
                maxLength={120}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Reel Ossos ao vivo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campanha">Campanha (opcional)</Label>
              <Input
                id="campanha"
                value={campanha}
                maxLength={120}
                onChange={(e) => setCampanha(e.target.value)}
                placeholder="Ex.: Lançamento da coleção"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mídia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {media.length ? (
              <ul className="space-y-2">
                {media.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-md border p-2">
                    <Thumb asset={m} />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate">{m.nome_original ?? m.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.tipo === "video"
                          ? `Vídeo${m.duracao_s ? ` · ${m.duracao_s}s` : ""}`
                          : "Imagem JPEG"}
                        {m.largura && m.altura ? ` · ${m.largura}×${m.altura}` : ""}
                      </p>
                    </div>
                    {tipo === "carrossel" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => move(i, -1)}
                          disabled={i === 0 || !editavel}
                          aria-label="Mover para cima"
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => move(i, 1)}
                          disabled={i === media.length - 1 || !editavel}
                          aria-label="Mover para baixo"
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMedia((x) => x.filter((a) => a.id !== m.id))}
                      disabled={!editavel}
                      aria-label="Remover"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {media.length < maxItens && editavel ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  multiple={tipo === "carrossel"}
                  accept={
                    tipo === "imagem"
                      ? "image/*"
                      : tipo === "reels"
                        ? "video/mp4,video/quicktime"
                        : "image/*,video/mp4,video/quicktime"
                  }
                  onChange={(e) => onFiles(e.target.files, "midia")}
                />
                <Button
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy || !accountId}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ImagePlus className="size-4" />
                  )}
                  {uploading ? "Enviando..." : "Adicionar arquivo"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Imagens são convertidas para JPEG automaticamente. Vídeos grandes podem levar
                  alguns minutos para enviar.
                </p>
                <LinkImport
                  id="link-midia"
                  label="Ou importar de um link público (JPEG, MP4 ou MOV, até 100 MB)"
                  disabled={busy || !accountId}
                  onImport={(url) => onImport(url, "midia")}
                />
                <Button variant="outline" size="sm" onClick={() => setPicker("midia")} disabled={busy || !accountId}>
                  Escolher da biblioteca
                </Button>
              </>
            ) : null}

            {tipo === "reels" ? (
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-medium">Capa do Reels (opcional)</p>
                    <p className="text-xs text-muted-foreground">
                      {capa ? capa.nome_original : "Sem capa: o Instagram usa o primeiro quadro."}
                    </p>
                  </div>
                  <input
                    ref={capaRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => onFiles(e.target.files, "capa")}
                  />
                  {capa ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCapa(null)}
                      disabled={!editavel}
                    >
                      Remover capa
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => capaRef.current?.click()}
                      disabled={busy || !accountId || !editavel}
                    >
                      Escolher capa
                    </Button>
                  )}
                </div>
                {!capa && editavel ? (
                  <Button variant="outline" size="sm" onClick={() => setPicker("capa")} disabled={busy || !accountId}>
                    Capa da biblioteca
                  </Button>
                ) : null}
                {!capa && editavel ? (
                  <LinkImport
                    id="link-capa"
                    label="Ou importar a capa de um link (JPEG)"
                    disabled={busy || !accountId}
                    onImport={(url) => onImport(url, "capa")}
                  />
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={shareToFeed}
                    onCheckedChange={setShareToFeed}
                    disabled={!editavel}
                  />
                  Mostrar também no feed (grade do perfil)
                </label>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {tipo !== "story" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={8}
                value={legenda}
                maxLength={2200}
                onChange={(e) => setLegenda(e.target.value)}
                disabled={!editavel}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {legenda.length}/2200 caracteres ·{" "}
                  <span className={hashtags > 30 ? "text-destructive" : ""}>
                    {hashtags}/30 hashtags
                  </span>{" "}
                  ·{" "}
                  <span className={mencoes > 20 ? "text-destructive" : ""}>
                    {mencoes}/20 menções
                  </span>
                </span>
                {brand?.hashtags_padrao.length ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setLegenda((l) => `${l.trimEnd()}\n\n${brand.hashtags_padrao.join(" ")}`)
                    }
                    disabled={!editavel}
                  >
                    Inserir hashtags padrão da marca
                  </Button>
                ) : null}
              </div>
              {tipo === "imagem" || tipo === "carrossel" ? (
                <div className="space-y-2">
                  <Label htmlFor="alt">Texto alternativo (acessibilidade, opcional)</Label>
                  <Input
                    id="alt"
                    value={altText}
                    maxLength={1000}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Descreva a imagem para quem usa leitor de tela"
                    disabled={!editavel}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quando publicar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="quando">Data e horário (horário de Brasília)</Label>
              <Input
                id="quando"
                type="datetime-local"
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
                disabled={!editavel}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => save.mutate("rascunho")}
                disabled={!accountId || busy || !editavel}
              >
                <Save className="size-4" />
                Salvar rascunho
              </Button>
              <Button onClick={() => save.mutate("agendar")} disabled={!canSubmit || !quando}>
                {save.isPending && save.variables === "agendar" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarClock className="size-4" />
                )}
                {isAdmin ? "Agendar" : "Enviar para aprovação"}
              </Button>
              {isAdmin ? (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmNow(true)}
                  disabled={!canSubmit || !!settings.data?.pausa_geral}
                >
                  <Send className="size-4" />
                  Publicar agora
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              O agendamento roda no servidor: pode fechar o navegador e desligar o celular. Uma
              publicação só aparece como “publicada” depois que a Meta confirma.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prévia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">
              {account ? `@${account.username}` : "Escolha a conta"}
            </p>
            <div
              className={`overflow-hidden rounded-md bg-muted ${tipo === "story" || tipo === "reels" ? "aspect-[9/16]" : "aspect-[4/5]"}`}
            >
              {preview?.public_url ? (
                preview.tipo === "video" ? (
                  <video
                    src={preview.public_url}
                    className="size-full object-cover"
                    controls
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={preview.public_url}
                    alt={altText || "Prévia"}
                    className="size-full object-cover"
                  />
                )
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                  Sem mídia
                </div>
              )}
            </div>
            {tipo === "carrossel" && media.length > 1 ? (
              <p className="text-xs text-muted-foreground">1 de {media.length} itens</p>
            ) : null}
            {tipo !== "story" && legenda ? (
              <p className="whitespace-pre-wrap text-sm">{legenda}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {accountId ? (
        <MediaPicker
          open={!!picker}
          onOpenChange={(o) => !o && setPicker(null)}
          accountId={accountId}
          only={picker === "capa" ? "imagem" : tipo === "reels" ? "video" : tipo === "imagem" ? "imagem" : "todos"}
          multiple={picker === "midia" && tipo === "carrossel"}
          onPick={onPick}
        />
      ) : null}
      <AlertDialog open={confirmNow} onOpenChange={setConfirmNow}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar agora em @{account?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              {TIPOS.find((t) => t.value === tipo)?.label} com {media.length} arquivo(s) vai ao ar
              imediatamente no Instagram. Isso não pode ser desfeito por este sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => save.mutate("publicar_agora")}>
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LinkImport({
  id,
  label,
  disabled,
  onImport,
}: {
  id: string;
  label: string;
  disabled: boolean;
  onImport: (url: string) => Promise<boolean>;
}) {
  const [url, setUrl] = useState("");
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="url"
          inputMode="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={disabled}
        />
        <Button
          variant="outline"
          onClick={async () => {
            if (await onImport(url)) setUrl("");
          }}
          disabled={disabled || !url.startsWith("https://")}
        >
          Importar
        </Button>
      </div>
    </div>
  );
}

function Thumb({ asset }: { asset: Asset }) {
  if (!asset.public_url) return <div className="size-14 rounded bg-muted" />;
  return asset.tipo === "video" ? (
    <video
      src={asset.public_url}
      className="size-14 rounded object-cover"
      muted
      playsInline
      preload="metadata"
    />
  ) : (
    <img src={asset.public_url} alt="" className="size-14 rounded object-cover" />
  );
}

function defaultQuando() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d.toISOString());
}

export function usePostsList(statuses: string[]) {
  return useQuery({
    queryKey: ["posts", ...statuses],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .in("status", statuses)
        .order("agendado_para", {
          ascending: statuses.includes("publicado") ? false : true,
          nullsFirst: false,
        })
        .limit(200);
      if (error) throw error;
      const ids = [
        ...new Set((data ?? []).map((p) => p.media_asset_ids[0]).filter((x): x is string => !!x)),
      ];
      const { data: assets } = ids.length
        ? await supabase.from("media_assets").select("id, tipo, public_url").in("id", ids)
        : { data: [] };
      const thumb = new Map((assets ?? []).map((a) => [a.id, a]));
      return (data ?? []).map((p) => ({
        ...p,
        thumb: p.media_asset_ids[0] ? (thumb.get(p.media_asset_ids[0]) ?? null) : null,
      }));
    },
  });
}

export const useManagedAccountsMap = () => {
  const accounts = useAccounts();
  return useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a])), [accounts.data]);
};

import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/page-header";
import { AccountFilter } from "@/components/filters";
import { AssetThumb, useLibrary, type LibraryAsset } from "@/components/media-library";
import { uploadMedia } from "@/lib/media";
import { deleteMedia, renameMedia } from "@/lib/posts.functions";
import { errorMessage, formatDateTime, useAccounts } from "@/lib/queries";

export const Route = createFileRoute("/_app/midias")({
  head: () => ({ meta: [{ title: "Mídias — Gestor Instagram" }] }),
  component: MediaPage,
});

function MediaPage() {
  const accounts = useAccounts();
  const managed = (accounts.data ?? []).filter((a) => a.gerenciada);
  const [conta, setConta] = useState("todas");
  const [tipo, setTipo] = useState<"todos" | "imagem" | "video">("todos");
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);
  const lib = useLibrary(conta, tipo, busca);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["media-library"] });

  const destino = conta !== "todas" ? conta : managed.length === 1 ? managed[0]!.id : null;
  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !destino) return;
    try {
      for (const [i, f] of Array.from(files).entries()) {
        setEnviando(`Enviando ${i + 1} de ${files.length}: ${f.name}`);
        await uploadMedia(f, destino, "carrossel", "biblioteca");
      }
      toast.success("Arquivos enviados para a biblioteca.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setEnviando(null);
      refresh();
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = useMutation({
    mutationFn: (id: string) => deleteMedia({ data: { id } }),
    onSuccess: () => {
      refresh();
      toast.success("Mídia apagada.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const nome = (id: string | null) => `@${managed.find((a) => a.id === id)?.username ?? "conta"}`;

  return (
    <>
      <PageHeader
        title="Biblioteca de mídias"
        description="Fotos e vídeos guardados no sistema, prontos para usar em publicações pelo painel ou pelo Claude (conector). Dê nomes claros: é por eles que o agente encontra os arquivos."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,video/mp4,video/quicktime"
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={!destino || !!enviando}
              title={destino ? undefined : "Escolha a conta primeiro"}
            >
              {enviando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              Enviar arquivos
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <AccountFilter value={conta} onChange={setConta} />
        <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Fotos e vídeos</SelectItem>
            <SelectItem value="imagem">Só fotos</SelectItem>
            <SelectItem value="video">Só vídeos</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar pelo nome"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:flex-1"
        />
      </div>
      {!destino ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Para enviar, escolha primeiro a conta dona dos arquivos.
        </p>
      ) : null}
      {enviando ? (
        <p className="mb-4 text-sm">{enviando} (vídeos grandes podem levar alguns minutos)</p>
      ) : null}

      {lib.isLoading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : !lib.data?.length ? (
        <EmptyState icon={<ImagePlus className="size-8" />} title="Nenhuma mídia ainda">
          Envie fotos e vídeos por aqui (inclusive do celular). Imagens viram JPEG automaticamente.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {lib.data.map((a) => (
            <Item
              key={a.id}
              asset={a}
              conta={nome(a.instagram_account_id)}
              onRenamed={refresh}
              onDelete={() => remove.mutate(a.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function Item({
  asset,
  conta,
  onRenamed,
  onDelete,
}: {
  asset: LibraryAsset;
  conta: string;
  onRenamed: () => void;
  onDelete: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(asset.nome_original ?? "");
  const rename = useMutation({
    mutationFn: () => renameMedia({ data: { id: asset.id, nome } }),
    onSuccess: () => {
      setEditando(false);
      onRenamed();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card className="overflow-hidden">
      <AssetThumb asset={asset} className="aspect-square w-full" />
      <CardContent className="space-y-1 p-2 text-xs">
        {editando ? (
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              rename.mutate();
            }}
          >
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-7 text-xs"
              autoFocus
              maxLength={255}
            />
            <Button size="sm" type="submit" className="h-7" disabled={!nome.trim()}>
              OK
            </Button>
          </form>
        ) : (
          <p className="truncate font-medium" title={asset.nome_original ?? ""}>
            {asset.nome_original ?? asset.id}
          </p>
        )}
        <p className="text-muted-foreground">
          {conta} ·{" "}
          {asset.tipo === "video"
            ? `vídeo${asset.duracao_s ? ` ${asset.duracao_s}s` : ""}`
            : "foto"}
          {asset.largura && asset.altura ? ` · ${asset.largura}×${asset.altura}` : ""}
          {asset.tamanho_bytes ? ` · ${(asset.tamanho_bytes / 1048576).toFixed(1)} MB` : ""}
        </p>
        <p className="text-muted-foreground">{formatDateTime(asset.created_at)}</p>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setEditando((v) => !v)}
            aria-label="Renomear"
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive"
            onClick={onDelete}
            aria-label="Apagar"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

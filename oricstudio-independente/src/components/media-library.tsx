import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type LibraryAsset = {
  id: string;
  tipo: string;
  public_url: string | null;
  largura: number | null;
  altura: number | null;
  duracao_s: number | null;
  nome_original: string | null;
  created_at: string;
  instagram_account_id: string | null;
  tamanho_bytes: number | null;
};

export function useLibrary(
  accountId: string | "todas",
  tipo: "todos" | "imagem" | "video",
  busca: string,
) {
  return useQuery({
    queryKey: ["media-library", accountId, tipo, busca],
    queryFn: async () => {
      let q = supabase
        .from("media_assets")
        .select(
          "id, tipo, public_url, largura, altura, duracao_s, nome_original, created_at, instagram_account_id, tamanho_bytes",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (accountId !== "todas") q = q.eq("instagram_account_id", accountId);
      if (tipo !== "todos") q = q.eq("tipo", tipo);
      if (busca.trim()) q = q.ilike("nome_original", `%${busca.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LibraryAsset[];
    },
  });
}

export function AssetThumb({ asset, className }: { asset: LibraryAsset; className?: string }) {
  if (!asset.public_url) return <div className={cn("bg-muted", className)} />;
  return asset.tipo === "video" ? (
    <div className={cn("relative", className)}>
      <video
        src={asset.public_url}
        className="size-full object-cover"
        muted
        playsInline
        preload="metadata"
      />
      <Film className="absolute right-1 bottom-1 size-4 text-white drop-shadow" />
    </div>
  ) : (
    <img
      src={asset.public_url}
      alt={asset.nome_original ?? ""}
      className={cn("object-cover", className)}
      loading="lazy"
    />
  );
}

/** Picks existing media of one account (used by the post editor). */
export function MediaPicker({
  open,
  onOpenChange,
  accountId,
  only,
  multiple,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accountId: string;
  only: "todos" | "imagem" | "video";
  multiple: boolean;
  onPick: (assets: LibraryAsset[]) => void;
}) {
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<LibraryAsset[]>([]);
  const lib = useLibrary(accountId, only, busca);
  const toggle = (a: LibraryAsset) =>
    setSel((s) =>
      s.some((x) => x.id === a.id) ? s.filter((x) => x.id !== a.id) : multiple ? [...s, a] : [a],
    );
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setSel([]);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Escolher da biblioteca</DialogTitle>
          <DialogDescription>
            Mídias já enviadas para esta conta (pelo painel, pelo celular ou pelo assistente).
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Buscar pelo nome"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {lib.isLoading ? <Loader2 className="size-5 animate-spin" /> : null}
          {(lib.data ?? []).map((a) => {
            const i = sel.findIndex((x) => x.id === a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a)}
                className={cn(
                  "relative overflow-hidden rounded border text-left",
                  i >= 0 && "ring-2 ring-primary",
                )}
              >
                <AssetThumb asset={a} className="aspect-square w-full" />
                <p className="truncate px-1 py-0.5 text-xs">{a.nome_original ?? a.id}</p>
                {i >= 0 ? (
                  <span className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {multiple ? i + 1 : <Check className="size-3" />}
                  </span>
                ) : null}
              </button>
            );
          })}
          {lib.data && !lib.data.length ? (
            <p className="col-span-full text-sm text-muted-foreground">Nenhuma mídia encontrada.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              onPick(sel);
              setSel([]);
              onOpenChange(false);
            }}
            disabled={!sel.length}
          >
            Usar {sel.length > 1 ? `${sel.length} arquivos` : "arquivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

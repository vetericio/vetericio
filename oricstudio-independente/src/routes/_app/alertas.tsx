import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/page-header";
import { AccountFilter } from "@/components/filters";
import { supabase } from "@/integrations/supabase/client";
import { resolveAlert, saveAlertLimits } from "@/lib/ops.functions";
import { errorMessage, formatDateTime, useAccounts, useBrands } from "@/lib/queries";
import { useIsAdmin } from "@/lib/session";

export const Route = createFileRoute("/_app/alertas")({
  head: () => ({ meta: [{ title: "Alertas — Gestor Instagram" }] }),
  component: AlertsPage,
});

const TIPO_LABEL: Record<string, string> = {
  falha_publicacao: "Falha de publicação",
  conexao: "Conexão",
  token_expirando: "Token expirando",
  coleta: "Coleta de dados",
  queda_alcance: "Queda de alcance",
  variacao_incomum: "Variação incomum",
  aprovacao_pendente: "Aprovação pendente",
  fila_atrasada: "Fila atrasada",
  automacao_suspensa: "Automação suspensa",
  comentario_sensivel: "Comentário sensível",
};

function AlertsPage() {
  const [aba, setAba] = useState("abertos");
  const [conta, setConta] = useState("todas");
  const accounts = useAccounts();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const alerts = useQuery({
    queryKey: ["alerts", aba, conta],
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("alerts")
        .select("*")
        .eq("resolvido", aba !== "abertos")
        .order("created_at", { ascending: false })
        .limit(200);
      if (conta !== "todas") q = q.eq("instagram_account_id", conta);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const resolve = useMutation({
    mutationFn: (id: string) => resolveAlert({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alerta marcado como resolvido.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const nome = (id: string | null) =>
    id ? `@${(accounts.data ?? []).find((a) => a.id === id)?.username ?? "conta"}` : "Geral";

  return (
    <>
      <PageHeader
        title="Alertas"
        description="Gerados pelo sistema sem duplicidade (um alerta aberto por ocorrência) e só com dados completos. Alertas de conexão, fila e aprovação se resolvem sozinhos quando o problema some."
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="abertos">Abertos</TabsTrigger>
            <TabsTrigger value="resolvidos">Resolvidos</TabsTrigger>
          </TabsList>
        </Tabs>
        <AccountFilter value={conta} onChange={setConta} />
      </div>
      {alerts.isLoading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : !alerts.data?.length ? (
        <EmptyState
          icon={<Bell className="size-8" />}
          title={aba === "abertos" ? "Nenhum alerta aberto" : "Nenhum alerta resolvido"}
        />
      ) : (
        <div className="space-y-2">
          {alerts.data.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <AlertTriangle
                  className={`size-5 shrink-0 ${a.severidade === "alta" ? "text-destructive" : a.severidade === "media" ? "text-amber-600" : "text-muted-foreground"}`}
                />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{TIPO_LABEL[a.tipo] ?? a.tipo}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {nome(a.instagram_account_id)} · {formatDateTime(a.created_at)}
                      {a.resolvido_em ? ` · resolvido em ${formatDateTime(a.resolvido_em)}` : ""}
                    </span>
                  </div>
                  <p className="mt-1">{a.mensagem}</p>
                </div>
                {!a.resolvido ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resolve.mutate(a.id)}
                    disabled={resolve.isPending}
                  >
                    <Check className="size-4" />
                    Resolvido
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {isAdmin ? <Limites /> : null}
    </>
  );
}

function Limites() {
  const accounts = useAccounts();
  const brands = useBrands();
  const qc = useQueryClient();
  const managed = (accounts.data ?? []).filter((a) => a.gerenciada);
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-base">Limites de alerta por conta</CardTitle>
        <CardDescription>
          Quedas de alcance só são avaliadas com 14 dias de dados e base mínima, para evitar alertas
          com dados incompletos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {managed.map((a) => (
          <LimiteConta
            key={a.id}
            accountId={a.id}
            username={a.username ?? ""}
            atual={
              ((brands.data ?? []).find((b) => b.instagram_account_id === a.id)?.limites_alerta ??
                {}) as Record<string, number>
            }
            temMarca={(brands.data ?? []).some((b) => b.instagram_account_id === a.id)}
            onSaved={() => qc.invalidateQueries({ queryKey: ["brands"] })}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function LimiteConta({
  accountId,
  username,
  atual,
  temMarca,
  onSaved,
}: {
  accountId: string;
  username: string;
  atual: Record<string, number>;
  temMarca: boolean;
  onSaved: () => void;
}) {
  const [v, setV] = useState({
    queda_alcance_pct: 30,
    aprovacao_horas: 12,
    variacao_incomum_pct: 150,
  });
  useEffect(() => setV((x) => ({ ...x, ...atual })), [atual]);
  const save = useMutation({
    mutationFn: () => saveAlertLimits({ data: { accountId, ...v } }),
    onSuccess: () => {
      onSaved();
      toast.success("Limites salvos.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end">
      <p className="w-40 font-medium">@{username}</p>
      <Campo
        label="Queda de alcance (%)"
        value={v.queda_alcance_pct}
        onChange={(n) => setV({ ...v, queda_alcance_pct: n })}
      />
      <Campo
        label="Aprovação pendente (h)"
        value={v.aprovacao_horas}
        onChange={(n) => setV({ ...v, aprovacao_horas: n })}
      />
      <Campo
        label="Alta incomum (%)"
        value={v.variacao_incomum_pct}
        onChange={(n) => setV({ ...v, variacao_incomum_pct: n })}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => save.mutate()}
        disabled={save.isPending || !temMarca}
        title={temMarca ? undefined : "Preencha o perfil da marca primeiro"}
      >
        Salvar
      </Button>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        className="w-32"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AlertTriangle, AtSign, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  getConfigStatus,
  metaConnectionCheck,
  metaDisconnect,
  metaOAuthStart,
  setAccountManaged,
} from "@/lib/app.functions";
import { META_SCOPES } from "@/lib/meta-permissions";
import {
  errorMessage,
  formatDateTime,
  qk,
  useAccounts,
  useConnections,
  usePages,
} from "@/lib/queries";

const searchSchema = z.object({
  conexao: z.enum(["ok", "erro"]).optional(),
  motivo: z.string().max(200).optional(),
});

export const Route = createFileRoute("/_app/contas")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Contas conectadas — Gestor Instagram" }] }),
  component: ContasPage,
});

const MOTIVOS: Record<string, string> = {
  state_ausente: "A resposta da Meta veio sem o parâmetro de segurança. Tente conectar novamente.",
  state_invalido:
    "O pedido de conexão não foi reconhecido. Inicie a conexão novamente por esta tela.",
  state_ja_usado: "Este pedido de conexão já foi usado. Inicie uma nova conexão.",
  state_expirado: "O pedido de conexão expirou (10 minutos). Tente novamente.",
  user_denied: "A autorização foi cancelada na Meta.",
  access_denied: "A autorização foi cancelada na Meta.",
  code_ausente: "A Meta não devolveu o código de autorização.",
  configuracao_incompleta: "Faltam secrets do app Meta no servidor.",
  falha_na_troca_do_token:
    "Não foi possível trocar o código por um token. Confira META_APP_ID, META_APP_SECRET e a URL de redirecionamento.",
  parametros_invalidos: "A resposta da Meta veio em um formato inesperado.",
};

const IG_SCOPES = META_SCOPES.filter((s) => s.startsWith("instagram_"));

function ContasPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const connections = useConnections();
  const accounts = useAccounts();
  const pages = usePages();
  const config = useQuery({
    queryKey: ["config-status"],
    queryFn: () => getConfigStatus(),
    retry: false,
  });
  const shown = useRef(false);

  useEffect(() => {
    if (!search.conexao || shown.current) return;
    shown.current = true;
    if (search.conexao === "ok")
      toast.success("Conexão com a Meta concluída. Confira as contas encontradas abaixo.");
    else
      toast.error(
        MOTIVOS[search.motivo ?? ""] ??
          `Falha na conexão: ${search.motivo ?? "motivo desconhecido"}`,
      );
    navigate({ to: "/contas", search: {}, replace: true });
  }, [search.conexao, search.motivo, navigate]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.connections });
    qc.invalidateQueries({ queryKey: qk.accounts });
    qc.invalidateQueries({ queryKey: qk.pages });
    qc.invalidateQueries({ queryKey: qk.audit });
  };

  const connect = useMutation({
    mutationFn: () => metaOAuthStart(),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const check = useMutation({
    mutationFn: (connectionId?: string) =>
      metaConnectionCheck({ data: connectionId ? { connectionId } : {} }),
    onSuccess: ({ results }) => {
      refresh();
      const problemas = results.filter((r) => r.status !== "ativa").length;
      if (problemas)
        toast.warning(`${problemas} conexão(ões) com problema. Veja os detalhes abaixo.`);
      else toast.success("Conexão verificada: tudo certo.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const missing = config.data?.missing ?? [];
  const pageName = (id: string | null) =>
    id ? (pages.data?.find((p) => p.id === id)?.nome ?? id) : "—";
  const activeConnections = (connections.data ?? []).filter((c) => c.status !== "desconectada");

  return (
    <>
      <PageHeader
        title="Contas conectadas"
        description="Conecte pelo login oficial da Meta. A senha do Instagram ou do Facebook nunca é pedida aqui."
        actions={
          <>
            {activeConnections.length ? (
              <Button
                variant="outline"
                onClick={() => check.mutate(undefined)}
                disabled={check.isPending}
              >
                {check.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Verificar todas
              </Button>
            ) : null}
            <Button
              onClick={() => connect.mutate()}
              disabled={connect.isPending || missing.length > 0}
            >
              {connect.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plug className="size-4" />
              )}
              Conectar com Facebook
            </Button>
          </>
        }
      />

      {config.isError ? (
        <Alert className="mb-6">
          <AlertTriangle className="size-4" />
          <AlertTitle>Somente administradores podem conectar contas</AlertTitle>
          <AlertDescription>{errorMessage(config.error)}</AlertDescription>
        </Alert>
      ) : missing.length ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="size-4" />
          <AlertTitle>Configuração do app Meta incompleta</AlertTitle>
          <AlertDescription>
            Preencha estes secrets no Lovable Cloud antes de conectar:{" "}
            <strong>{missing.join(", ")}</strong>. Veja o guia em Configurações.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="mb-8 space-y-3">
        <h2 className="text-lg font-semibold">Conexões Meta</h2>
        {connections.isLoading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : !connections.data?.length ? (
          <EmptyState icon={<Plug className="size-8" />} title="Nenhuma conexão com a Meta ainda">
            Clique em “Conectar com Facebook”, entre com a conta que administra as Páginas e as
            contas do Instagram e autorize os ativos que deseja gerenciar.
          </EmptyState>
        ) : (
          connections.data.map((c) => (
            <ConnectionCard
              key={c.id}
              connection={c}
              checking={check.isPending && check.variables === c.id}
              onCheck={() => check.mutate(c.id)}
              onReconnect={() => connect.mutate()}
              onChanged={refresh}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Contas do Instagram encontradas</h2>
        {accounts.isLoading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : !accounts.data?.length ? (
          <EmptyState
            icon={<AtSign className="size-8" />}
            title="Nenhuma conta do Instagram encontrada"
          >
            {connections.data?.length
              ? "A conexão existe, mas nenhuma conta profissional foi encontrada nas Páginas autorizadas."
              : "Conecte uma conta Meta para listar as contas."}
          </EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {accounts.data.map((a) => {
              const faltando = IG_SCOPES.filter((s) => !a.permissoes_efetivas.includes(s));
              return (
                <Card key={a.id}>
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="size-12">
                        {a.foto_url ? <AvatarImage src={a.foto_url} alt="" /> : null}
                        <AvatarFallback>
                          {(a.username ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">
                            @{a.username ?? "sem_usuario"}
                          </span>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{a.nome ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          ID {a.ig_user_id} · Página: {pageName(a.page_id)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Seguidores:{" "}
                          {a.seguidores != null
                            ? a.seguidores.toLocaleString("pt-BR")
                            : "não disponível"}
                        </p>
                      </div>
                    </div>
                    {a.ultimo_erro ? (
                      <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                        {a.ultimo_erro}
                      </p>
                    ) : null}
                    {faltando.length ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Permissões ausentes: {faltando.join(", ")}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                      <ManagedSwitch
                        accountId={a.id}
                        gerenciada={a.gerenciada}
                        onChanged={refresh}
                      />
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/marcas/$accountId" params={{ accountId: a.id }}>
                          Perfil da marca
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <Troubleshooting />
      </section>
    </>
  );
}

type Connection = NonNullable<ReturnType<typeof useConnections>["data"]>[number];

function ConnectionCard({
  connection: c,
  checking,
  onCheck,
  onReconnect,
  onChanged,
}: {
  connection: Connection;
  checking: boolean;
  onCheck: () => void;
  onReconnect: () => void;
  onChanged: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const disconnect = useMutation({
    mutationFn: () => metaDisconnect({ data: { tipo: "conexao", connectionId: c.id } }),
    onSuccess: ({ revogado }) => {
      onChanged();
      if (revogado) toast.success("Conexão removida e permissões revogadas na Meta.");
      else
        toast.warning(
          "Conexão removida aqui, mas a Meta não confirmou a revogação. Remova o app em Configurações do Facebook > Integrações empresariais.",
        );
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const desconectada = c.status === "desconectada";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">
            {c.meta_user_name ?? `Usuário Meta ${c.meta_user_id}`}
          </CardTitle>
          <StatusBadge status={c.status} />
        </div>
        <CardDescription>
          Conectada em {formatDateTime(c.created_at)} · Última verificação:{" "}
          {formatDateTime(c.ultima_verificacao)} · Token expira:{" "}
          {c.expira_em
            ? formatDateTime(c.expira_em)
            : c.ultima_verificacao
              ? "não expira (a Meta não informa data de expiração)"
              : "sem data informada"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {c.ultimo_erro ? (
          <p className="rounded bg-destructive/10 p-2 text-sm text-destructive">{c.ultimo_erro}</p>
        ) : null}
        {c.escopos_recusados.length ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Permissões recusadas na autorização: {c.escopos_recusados.join(", ")}. Use “Reconectar”
            e marque todas.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!desconectada ? (
            <Button variant="outline" size="sm" onClick={onCheck} disabled={checking}>
              {checking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Verificar conexão
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onReconnect}>
            <Plug className="size-4" />
            Reconectar
          </Button>
          {!desconectada ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirm(true)}
              disabled={disconnect.isPending}
            >
              <Unplug className="size-4" />
              Desconectar
            </Button>
          ) : null}
        </div>
      </CardContent>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar esta conta Meta?</AlertDialogTitle>
            <AlertDialogDescription>
              As permissões serão revogadas na Meta e os tokens apagados deste sistema. As contas do
              Instagram ligadas a ela deixam de ser gerenciadas. Perfis de marca e histórico são
              mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnect.mutate()}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ManagedSwitch({
  accountId,
  gerenciada,
  onChanged,
}: {
  accountId: string;
  gerenciada: boolean;
  onChanged: () => void;
}) {
  const mutation = useMutation({
    mutationFn: (value: boolean) => setAccountManaged({ data: { accountId, gerenciada: value } }),
    onSuccess: (_r, value) => {
      onChanged();
      toast.success(value ? "Conta passou a ser gerenciada." : "Conta deixou de ser gerenciada.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch
        checked={gerenciada}
        disabled={mutation.isPending}
        onCheckedChange={(v) => mutation.mutate(v)}
      />
      Gerenciar esta conta
    </label>
  );
}

function Troubleshooting() {
  return (
    <Collapsible className="rounded-lg border p-4">
      <CollapsibleTrigger className="text-sm font-medium underline-offset-4 hover:underline">
        Uma conta não apareceu? Veja as causas mais comuns
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Conta pessoal:</strong> só contas profissionais
          (Empresa ou Criador de conteúdo) são acessíveis pela API. Mude em Instagram &gt;
          Configurações &gt; Tipo de conta e ferramentas.
        </p>
        <p>
          <strong className="text-foreground">Sem Página vinculada:</strong> neste modo de
          integração, cada conta do Instagram precisa estar ligada a uma Página do Facebook.
        </p>
        <p>
          <strong className="text-foreground">Página não autorizada:</strong> na tela de autorização
          da Meta, a Página e a conta do Instagram precisam estar marcadas. Use “Reconectar” para
          escolher de novo.
        </p>
        <p>
          <strong className="text-foreground">Ativo não atribuído no portfólio:</strong> no Meta
          Business Suite, a pessoa que autoriza precisa ter acesso à Página e à conta do Instagram
          (Configurações do negócio &gt; Contas).
        </p>
        <p>
          <strong className="text-foreground">Permissão recusada:</strong> se alguma permissão foi
          desmarcada, ela aparece como recusada no cartão da conexão.
        </p>
        <p>
          <strong className="text-foreground">Função no app:</strong> enquanto o app Meta não tiver
          Acesso Avançado, só pessoas com função no app (administrador, desenvolvedor ou testador)
          conseguem autorizar.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

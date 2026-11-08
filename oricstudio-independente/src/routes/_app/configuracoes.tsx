import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader } from "@/components/page-header";
import { PauseToggle } from "@/components/pause-toggle";
import { getConfigStatus, updateSettings } from "@/lib/app.functions";
import { errorMessage, formatDateTime, qk, useSettings } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { revokeAssistantKey } from "@/lib/posts.functions";
import { revokeConnector } from "@/lib/oauth.functions";
import { useRoles, useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Gestor Instagram" }] }),
  component: SettingsPage,
});

const MODOS = [
  {
    value: "assistido",
    label: "Modo 1 — Assistido",
    desc: "O sistema prepara conteúdos, análises e agendamentos, mas pede aprovação antes de qualquer ação externa sensível.",
  },
  {
    value: "automatico_regras",
    label: "Modo 2 — Automático com regras",
    desc: "Cria, agenda e publica automaticamente, apenas dentro das regras de automação aprovadas (contas, formatos, horários, limites e temas).",
  },
  {
    value: "gestao_ampliada",
    label: "Modo 3 — Gestão ampliada",
    desc: "Também administra comentários, relatórios recorrentes e outras operações autorizadas. Exclusões, gastos com anúncios e ações de alto impacto continuam exigindo aprovação.",
  },
] as const;

const SECRETS: { nome: string; obrigatorio: boolean; onde: string }[] = [
  {
    nome: "META_APP_ID",
    obrigatorio: true,
    onde: "Meta for Developers > seu app > Configurações do app > Básico > ID do aplicativo",
  },
  {
    nome: "META_APP_SECRET",
    obrigatorio: true,
    onde: "Mesma tela, campo Chave secreta do aplicativo (clique em Mostrar)",
  },
  {
    nome: "TOKEN_ENCRYPTION_KEY",
    obrigatorio: true,
    onde: "Chave aleatória de 32 bytes em base64 gerada por você (nunca reutilize a de outro sistema)",
  },
  {
    nome: "APP_BASE_URL",
    obrigatorio: true,
    onde: "Endereço publicado deste app, sem barra no final",
  },
  {
    nome: "META_LOGIN_CONFIG_ID",
    obrigatorio: false,
    onde: "Opcional: ID da configuração do Login do Facebook para Empresas",
  },
  {
    nome: "META_GRAPH_VERSION",
    obrigatorio: false,
    onde: "Opcional: versão da Graph API (padrão v24.0)",
  },
];

function SettingsPage() {
  const { session } = useSession();
  const roles = useRoles(session?.user.id);
  const isAdmin = !!roles.data?.includes("admin");
  const settings = useSettings();
  const qc = useQueryClient();
  const config = useQuery({
    queryKey: ["config-status"],
    queryFn: () => getConfigStatus(),
    retry: false,
    enabled: isAdmin,
  });

  const modo = useMutation({
    mutationFn: (value: (typeof MODOS)[number]["value"]) =>
      updateSettings({ data: { modo_autonomia: value } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settings });
      qc.invalidateQueries({ queryKey: qk.audit });
      toast.success("Modo de autonomia atualizado.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const redirectUri = config.data?.redirectUri ?? null;
  const base = redirectUri ? redirectUri.replace(/\/api\/public\/meta-oauth-callback$/, "") : null;
  const urls = base
    ? [
        { label: "URI de redirecionamento do OAuth", value: redirectUri! },
        {
          label: "URL de retorno de exclusão de dados",
          value: `${base}/api/public/meta-data-deletion`,
        },
        { label: "URL da Política de Privacidade", value: `${base}/privacidade` },
        { label: "URL dos Termos de Serviço", value: `${base}/termos` },
        { label: "Domínio do app", value: new URL(base).host },
      ]
    : [];

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      toast.success("Copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <>
      <PageHeader title="Configurações" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modo de autonomia</CardTitle>
            <CardDescription>
              Define o que o sistema pode fazer sem pedir aprovação. Nenhum modo concede acesso
              irrestrito.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={settings.data?.modo_autonomia ?? "assistido"}
              onValueChange={(v) => modo.mutate(v as (typeof MODOS)[number]["value"])}
              disabled={!isAdmin || modo.isPending}
              className="gap-4"
            >
              {MODOS.map((m) => (
                <div key={m.value} className="flex items-start gap-3">
                  <RadioGroupItem value={m.value} id={m.value} className="mt-1" />
                  <Label htmlFor={m.value} className="grid gap-1 font-normal">
                    <span className="font-medium">{m.label}</span>
                    <span className="text-sm text-muted-foreground">{m.desc}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pausa geral</CardTitle>
            <CardDescription>
              Interrompe novas publicações e automações sem apagar dados, rascunhos ou histórico.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Estado atual:{" "}
              <strong>{settings.data?.pausa_geral ? "pausado" : "em operação"}</strong>
            </p>
            <PauseToggle isAdmin={isAdmin} />
          </CardContent>
        </Card>

        {isAdmin ? <ClaudeConnections /> : null}
        {isAdmin ? <AssistantKeys /> : null}

        {isAdmin ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">App Meta e secrets</CardTitle>
              <CardDescription>
                Os secrets são configurados no Lovable Cloud (Cloud &gt; Secrets), nunca no código
                nem neste formulário. Graph API: {config.data?.versao ?? "—"}
                {config.data?.usaConfigId ? " · usando configuração do Login para Empresas" : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-2">
                {SECRETS.map((s) => {
                  const faltando = config.data?.missing.includes(s.nome) ?? false;
                  return (
                    <li key={s.nome} className="flex items-start gap-2 text-sm">
                      {s.obrigatorio ? (
                        faltando ? (
                          <XCircle
                            className="mt-0.5 size-4 shrink-0 text-destructive"
                            aria-label="Ausente"
                          />
                        ) : (
                          <CheckCircle2
                            className="mt-0.5 size-4 shrink-0 text-emerald-600"
                            aria-label="Configurado"
                          />
                        )
                      ) : (
                        <span className="mt-0.5 size-4 shrink-0" />
                      )}
                      <span>
                        <code className="text-xs">{s.nome}</code>
                        {s.obrigatorio ? "" : " (opcional)"} —{" "}
                        <span className="text-muted-foreground">{s.onde}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              {urls.length ? (
                <div>
                  <p className="mb-2 text-sm font-medium">Valores para colar no painel da Meta</p>
                  <div className="space-y-2">
                    {urls.map((u) => (
                      <div
                        key={u.label}
                        className="flex flex-col gap-1 rounded-md border p-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{u.label}</p>
                          <p className="truncate font-mono text-xs">{u.value}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => copy(u.value)}>
                          <Copy className="size-4" />
                          Copiar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Configure APP_BASE_URL para ver as URLs que devem ser cadastradas no app Meta.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function AssistantKeys() {
  const qc = useQueryClient();
  const keys = useQuery({
    queryKey: ["assistant_keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_keys")
        .select("id, nome, created_at, ultimo_uso, revogada_em")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeAssistantKey({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant_keys"] });
      qc.invalidateQueries({ queryKey: qk.audit });
      toast.success("Chave revogada. O assistente perdeu o acesso imediatamente.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Assistente local</CardTitle>
        <CardDescription>
          Chaves que permitem ao assistente no seu computador enviar arquivos e agendar publicações.
          Ele segue as mesmas regras do painel: no modo “Assistido” tudo que ele agenda fica
          aguardando aprovação; nos outros modos, entra direto na fila. A pausa geral também vale
          para ele.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!keys.data?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma chave registrada.</p>
        ) : (
          <ul className="space-y-2">
            {keys.data.map((k) => (
              <li
                key={k.id}
                className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{k.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Criada em {formatDateTime(k.created_at)} · último uso:{" "}
                    {formatDateTime(k.ultimo_uso)}
                    {k.revogada_em ? ` · revogada em ${formatDateTime(k.revogada_em)}` : ""}
                  </p>
                </div>
                {!k.revogada_em ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => revoke.mutate(k.id)}
                    disabled={revoke.isPending}
                  >
                    Revogar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ClaudeConnections() {
  const qc = useQueryClient();
  const conns = useQuery({
    queryKey: ["oauth_tokens"],
    queryFn: async () => {
      const [{ data: tokens, error }, { data: clients }] = await Promise.all([
        supabase
          .from("oauth_tokens")
          .select("id, client_id, created_at, ultimo_uso, revogado_em, refresh_expires_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("oauth_clients").select("client_id, client_name, created_at"),
      ]);
      if (error) throw error;
      // One line per client: the most recent token tells whether the connection is still active.
      const now = new Date().toISOString();
      const byClient = new Map<
        string,
        {
          client_id: string;
          nome: string;
          desde: string;
          ultimo_uso: string | null;
          ativa: boolean;
        }
      >();
      for (const t of tokens ?? []) {
        const ativa = !t.revogado_em && !!t.refresh_expires_at && t.refresh_expires_at > now;
        const cur = byClient.get(t.client_id);
        const nome =
          (clients ?? []).find((c) => c.client_id === t.client_id)?.client_name ?? "Claude";
        if (!cur)
          byClient.set(t.client_id, {
            client_id: t.client_id,
            nome,
            desde: t.created_at,
            ultimo_uso: t.ultimo_uso,
            ativa,
          });
        else {
          cur.desde = t.created_at < cur.desde ? t.created_at : cur.desde;
          cur.ativa ||= ativa;
          if (t.ultimo_uso && (!cur.ultimo_uso || t.ultimo_uso > cur.ultimo_uso))
            cur.ultimo_uso = t.ultimo_uso;
        }
      }
      return [...byClient.values()];
    },
  });
  const revoke = useMutation({
    mutationFn: (client_id: string) => revokeConnector({ data: { client_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["oauth_tokens"] });
      qc.invalidateQueries({ queryKey: qk.audit });
      toast.success("Conexão revogada. O Claude perdeu o acesso imediatamente.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Conector do Claude</CardTitle>
        <CardDescription>
          Conexões autorizadas pelo app do Claude (celular, web ou desktop) em “Conectores →
          Adicionar conector personalizado” com o endereço{" "}
          <code className="text-xs">
            {typeof window === "undefined" ? "" : window.location.origin}/api/public/mcp
          </code>
          . Elas seguem as mesmas regras do assistente local.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!conns.data?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma conexão ainda.</p>
        ) : (
          <ul className="space-y-2">
            {conns.data.map((c) => (
              <li
                key={c.client_id}
                className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {c.nome} {c.ativa ? "" : "(revogada ou expirada)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Conectado em {formatDateTime(c.desde)} · último uso:{" "}
                    {formatDateTime(c.ultimo_uso)}
                  </p>
                </div>
                {c.ativa ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => revoke.mutate(c.client_id)}
                    disabled={revoke.isPending}
                  >
                    Revogar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

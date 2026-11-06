import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApplyTheme } from "@/components/theme-toggle";
import { decideOAuth, describeOAuthRequest } from "@/lib/oauth.functions";
import { errorMessage } from "@/lib/queries";
import { useSession } from "@/lib/session";

// Approval page of the Claude connector. The person logs in here (never inside Claude) and decides.
export const Route = createFileRoute("/oauth/autorizar")({
  head: () => ({ meta: [{ title: "Conectar o Claude — Gestor Instagram" }] }),
  component: AuthorizePage,
});

const CAMPOS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "code_challenge",
  "code_challenge_method",
  "state",
] as const;
type Params = {
  client_id: string;
  redirect_uri?: string;
  response_type: string;
  code_challenge: string;
  code_challenge_method: string;
  state?: string;
};

function readParams(): Params {
  const sp = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const out: Record<string, string> = {};
  for (const k of CAMPOS) {
    const v = sp.get(k);
    if (v != null) out[k] = v;
  }
  return {
    client_id: "",
    response_type: "",
    code_challenge: "",
    code_challenge_method: "",
    ...out,
  };
}

function AuthorizePage() {
  useApplyTheme();
  const { session, loading } = useSession();
  const [busy, setBusy] = useState(false);
  const [params] = useState(readParams);

  useEffect(() => {
    if (!loading && !session) {
      const volta = `/oauth/autorizar${window.location.search}`;
      window.location.assign(`/login?volta=${encodeURIComponent(volta)}`);
    }
  }, [loading, session]);

  const info = useQuery({
    queryKey: ["oauth-request", params],
    enabled: !!session,
    retry: false,
    queryFn: () => describeOAuthRequest({ data: params }),
  });

  const decide = async (aprovar: boolean) => {
    setBusy(true);
    try {
      const { redirect } = await decideOAuth({ data: { ...params, aprovar } });
      window.location.assign(redirect);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" /> Conectar o Claude ao Gestor
          </CardTitle>
          <CardDescription>
            {session?.user.email
              ? `Você entrou como ${session.user.email}.`
              : "Confira antes de autorizar."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!session || info.isLoading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : info.error ? (
            <p className="text-destructive">{errorMessage(info.error)}</p>
          ) : (
            <>
              <p>
                <strong>{info.data?.clientName}</strong> ({info.data?.redirectHost}) quer acesso ao
                Gestor Instagram em seu nome.
              </p>
              <div>
                <p className="font-medium">Ele poderá:</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>ver contas, publicações, mídias, métricas, comentários e alertas;</li>
                  <li>
                    importar mídias e criar rascunhos ou agendamentos, sempre sujeitos ao modo de
                    autonomia e às regras de automação;
                  </li>
                  <li>
                    gravar sugestões de resposta a comentários (publicar a resposta continua sendo
                    um clique seu).
                  </li>
                </ul>
              </div>
              <p className="text-muted-foreground">
                Ele não poderá publicar na hora, apagar nada nem mudar configurações. Você pode
                revogar o acesso em Configurações a qualquer momento.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => decide(true)} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Autorizar
                </Button>
                <Button variant="outline" onClick={() => decide(false)} disabled={busy}>
                  Recusar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApplyTheme } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { getSetupStatus } from "@/lib/app.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Gestor Instagram" }] }),
  component: LoginPage,
});

/** Only the connector approval page may be the return target (no open redirects). */
function destino() {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("volta");
  return v && v.startsWith("/oauth/autorizar?") ? v : null;
}

function LoginPage() {
  useApplyTheme();
  const navigate = useNavigate();
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const ir = () => {
    const volta = destino();
    if (volta) window.location.assign(volta);
    else navigate({ to: "/" });
  };
  const setup = useQuery({ queryKey: ["setup-status"], queryFn: () => getSetupStatus() });

  useEffect(() => {
    if (session) ir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error("E-mail ou senha incorretos.");
      return;
    }
    ir();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Gestor Instagram</CardTitle>
          <CardDescription>Acesso restrito à equipe.</CardDescription>
        </CardHeader>
        <CardContent>
          {setup.data?.disponivel ? (
            <div className="mb-4 rounded-md border bg-muted/50 p-3 text-sm">
              Nenhum usuário foi criado ainda.{" "}
              <Link to="/configuracao-inicial" className="font-medium underline">
                Fazer a configuração inicial
              </Link>
            </div>
          ) : null}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="text-right">
              <Link
                to="/recuperar-senha"
                className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Esqueci minha senha
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

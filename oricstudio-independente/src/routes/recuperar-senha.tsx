import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApplyTheme } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { recoveryRedirect } from "@/lib/password-recovery";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({ meta: [
    { title: "Recuperar senha — Gestor Instagram" },
    { name: "description", content: "Solicite um link seguro para recuperar seu acesso ao Gestor Instagram." },
    { property: "og:title", content: "Recuperar senha — Gestor Instagram" },
    { property: "og:description", content: "Recupere seu acesso por e-mail oficial de redefinição." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PasswordRecoveryPage,
});

function PasswordRecoveryPage() {
  useApplyTheme();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const redirectTo = recoveryRedirect(window.location.origin);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setSent(true);
    } catch {
      toast.error("Não foi possível enviar o e-mail de recuperação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>
            Informe seu e-mail para receber as instruções de redefinição de senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Se houver uma conta com este e-mail, você receberá em instantes um link para criar uma nova senha.
              </p>
              <Link to="/login" className="font-medium text-foreground underline">
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Enviar link de recuperação
              </Button>
              <Link to="/login" className="block text-center text-sm font-medium underline">
                Voltar para o login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

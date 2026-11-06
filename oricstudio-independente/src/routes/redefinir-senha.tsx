import { useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApplyTheme } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { usePasswordRecovery } from "@/components/password-recovery-provider";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [
    { title: "Redefinir senha — Gestor Instagram" },
    { name: "description", content: "Redefina sua senha do Gestor Instagram usando o link recebido por e-mail." },
    { property: "og:title", content: "Redefinir senha — Gestor Instagram" },
    { property: "og:description", content: "Redefinição segura de senha para acessar o Gestor Instagram." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPasswordPage,
});

export function ResetPasswordPage() {
  useApplyTheme();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const { validating, valid: validLink } = usePasswordRecovery();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validLink || busy) return;
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message || "Não foi possível redefinir a senha. Solicite outro link de recuperação.");
        return;
      }
      toast.success("Senha redefinida com sucesso.");
      void navigate({ to: "/", replace: true });
    } catch {
      toast.error("O serviço de acesso está indisponível. Tente novamente mais tarde.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>Crie uma nova senha para acessar sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          {validating ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : !validLink ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>Este link de recuperação expirou ou não é válido.</p>
              <Link to="/recuperar-senha" className="font-medium text-foreground underline">
                Solicitar novo link
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha (mínimo de 10 caracteres)</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={72}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar nova senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={72}
                  required
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Redefinir senha
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

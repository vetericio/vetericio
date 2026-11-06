import { useState, type FormEvent } from "react";
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
import { getSetupStatus, runInitialSetup } from "@/lib/app.functions";
import { errorMessage } from "@/lib/queries";

export const Route = createFileRoute("/configuracao-inicial")({
  head: () => ({ meta: [{ title: "Configuração inicial — OricStudio" }] }),
  component: SetupPage,
});

function SetupPage() {
  useApplyTheme();
  const navigate = useNavigate();
  const status = useQuery({ queryKey: ["setup-status"], queryFn: () => getSetupStatus() });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      await runInitialSetup({ data: { email: email.trim(), password } });
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      toast.success("Administrador criado.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Configuração inicial</CardTitle>
          <CardDescription>
            Crie a conta do primeiro administrador. Esta tela deixa de funcionar assim que existir
            um usuário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status.isLoading ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : !status.data?.disponivel ? (
            <p className="text-sm text-muted-foreground">
              A configuração inicial já foi concluída.{" "}
              <Link to="/login" className="font-medium text-foreground underline">
                Ir para o login
              </Link>
            </p>
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
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha (mínimo de 10 caracteres)</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={72}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Criar administrador
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

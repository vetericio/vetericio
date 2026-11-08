import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Contato, PublicPage } from "@/components/public-page";
import { getDeletionStatus } from "@/lib/app.functions";
import { formatDateTime } from "@/lib/queries";
import { LEGAL } from "@/lib/legal";

const CODE_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const Route = createFileRoute("/exclusao-de-dados")({
  validateSearch: (s) => z.object({ codigo: z.string().max(64).optional() }).parse(s),
  head: () => ({ meta: [{ title: `Exclusão de dados — ${LEGAL.nomeServico}` }] }),
  component: DeletionPage,
});

const STATUS: Record<string, string> = {
  recebida: "Recebida, em processamento",
  concluida: "Concluída: os dados recebidos da Meta foram apagados",
  erro: "Houve um erro ao processar. Entre em contato para concluir a exclusão manualmente.",
};

function DeletionPage() {
  const { codigo } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(codigo ?? "");
  const valid = !!codigo && CODE_RE.test(codigo);

  const status = useQuery({
    queryKey: ["deletion", codigo],
    enabled: valid,
    queryFn: () => getDeletionStatus({ data: { codigo: codigo! } }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate({ to: "/exclusao-de-dados", search: { codigo: input.trim() } });
  };

  return (
    <PublicPage title="Exclusão de dados">
      <p>Você pode pedir a exclusão dos dados que este serviço recebeu da Meta de três formas:</p>
      <ul>
        <li>
          <strong className="text-foreground">Pelo Facebook:</strong> em Configurações e privacidade
          &gt; Configurações &gt; Integrações empresariais, remova o app. A Meta nos notifica e a
          exclusão é feita automaticamente. Você recebe um código de confirmação.
        </li>
        <li>
          <strong className="text-foreground">Pelo sistema:</strong> um administrador pode
          desconectar a conta em “Contas conectadas”, o que revoga as permissões e apaga os tokens.
        </li>
        <li>
          <strong className="text-foreground">Por contato:</strong> escreva para <Contato />.
        </li>
      </ul>

      <h2>Consultar um pedido</h2>
      <Card>
        <CardContent className="space-y-4 p-4">
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="codigo">Código de confirmação</Label>
              <Input
                id="codigo"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={64}
              />
            </div>
            <Button type="submit">Consultar</Button>
          </form>
          {codigo && !valid ? (
            <p className="text-sm text-destructive">Código em formato inválido.</p>
          ) : null}
          {status.isLoading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : null}
          {status.data ? (
            status.data.encontrado ? (
              <div className="text-sm">
                <p className="font-medium">{STATUS[status.data.status] ?? status.data.status}</p>
                <p className="text-muted-foreground">
                  Pedido em {formatDateTime(status.data.created_at)}
                  {status.data.concluida_em
                    ? ` · concluído em ${formatDateTime(status.data.concluida_em)}`
                    : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum pedido encontrado com este código.
              </p>
            )
          ) : null}
          {status.isError ? (
            <p className="text-sm text-destructive">
              Não foi possível consultar agora. Tente novamente mais tarde.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </PublicPage>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { PERMISSION_MATRIX } from "@/lib/meta-permissions";
import { useConnections } from "@/lib/queries";

export const Route = createFileRoute("/_app/permissoes")({
  head: () => ({ meta: [{ title: "Permissões e segurança — Gestor Instagram" }] }),
  component: PermissionsPage,
});

function PermissionsPage() {
  const { data } = useConnections();
  const conns = (data ?? []).filter((c) => c.status !== "desconectada");

  return (
    <>
      <PageHeader
        title="Permissões e segurança"
        description="Permissões pedidas à Meta, para que servem e o que cada conexão realmente concedeu."
      />

      <Card className="mb-6">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionalidade</TableHead>
                <TableHead>Permissão</TableHead>
                <TableHead className="min-w-64">Finalidade</TableHead>
                {conns.map((c) => (
                  <TableHead key={c.id} className="text-center">
                    {c.meta_user_name ?? c.meta_user_id}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSION_MATRIX.map((p) => (
                <TableRow key={p.permissao}>
                  <TableCell className="font-medium">{p.funcionalidade}</TableCell>
                  <TableCell>
                    <code className="text-xs">{p.permissao}</code>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.finalidade}</TableCell>
                  {conns.map((c) => (
                    <TableCell key={c.id} className="text-center">
                      {c.escopos_concedidos.includes(p.permissao) ? (
                        <Check className="mx-auto size-4 text-emerald-600" aria-label="Concedida" />
                      ) : c.escopos_recusados.includes(p.permissao) ? (
                        <X className="mx-auto size-4 text-destructive" aria-label="Recusada" />
                      ) : (
                        <Minus
                          className="mx-auto size-4 text-muted-foreground"
                          aria-label="Não solicitada ou ausente"
                        />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nível de acesso na Meta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Com <strong className="text-foreground">Acesso Padrão</strong>, o app só funciona para
              pessoas que têm uma função no próprio app (administrador, desenvolvedor ou testador).
              Para uma ferramenta interna, que gerencia apenas as suas contas, isso costuma bastar.
            </p>
            <p>
              O <strong className="text-foreground">Acesso Avançado</strong>, que exige Análise do
              App e verificação da empresa, só é necessário se pessoas de fora dessas funções
              precisarem autorizar as próprias contas.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como os dados são protegidos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Tokens da Meta são criptografados (AES-256-GCM) e só o servidor consegue lê-los.
              </li>
              <li>Nenhum token aparece no navegador, em URLs ou nos registros de atividade.</li>
              <li>
                O login da Meta usa um parâmetro <code>state</code> de uso único, válido por 10
                minutos.
              </li>
              <li>
                Todas as tabelas usam políticas de acesso por papel (administrador, editor, leitor).
              </li>
              <li>
                Conexões, desconexões, mudanças de configuração e a pausa geral ficam registradas em
                Atividades.
              </li>
              <li>
                Pedidos de exclusão de dados da Meta são atendidos automaticamente e têm um código
                de acompanhamento.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

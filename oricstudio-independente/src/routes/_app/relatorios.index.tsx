import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/page-header";
import { AccountFilter } from "@/components/filters";
import { supabase } from "@/integrations/supabase/client";
import { generateReportNow } from "@/lib/ops.functions";
import { errorMessage, formatDateTime, useAccounts } from "@/lib/queries";
import { rangeDias } from "@/lib/metrics-data";

export const Route = createFileRoute("/_app/relatorios/")({
  head: () => ({ meta: [{ title: "Relatórios — Gestor Instagram" }] }),
  component: ReportsPage,
});

const TIPO_LABEL: Record<string, string> = {
  diario: "Diário",
  semanal: "Semanal",
  mensal: "Mensal",
  personalizado: "Personalizado",
};
const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

function ReportsPage() {
  const navigate = useNavigate();
  const accounts = useAccounts();
  const [tipo, setTipo] = useState("todos");
  const ini7 = rangeDias(7);
  const [novo, setNovo] = useState({
    tipo: "personalizado",
    inicio: ini7.inicio,
    fim: ini7.fim,
    conta: "todas",
  });

  const reports = useQuery({
    queryKey: ["reports", tipo],
    queryFn: async () => {
      let q = supabase
        .from("reports")
        .select("id, tipo, periodo_inicio, periodo_fim, instagram_account_id, gerado_em")
        .order("gerado_em", { ascending: false })
        .limit(100);
      if (tipo !== "todos") q = q.eq("tipo", tipo);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const gerar = useMutation({
    mutationFn: () =>
      generateReportNow({
        data: {
          tipo: novo.tipo as "personalizado",
          inicio: novo.inicio,
          fim: novo.fim,
          accountId: novo.conta === "todas" ? null : novo.conta,
        },
      }),
    onSuccess: (r) => {
      toast.success("Relatório gerado.");
      navigate({ to: "/relatorios/$reportId", params: { reportId: r.id } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const nome = (id: string | null) =>
    id
      ? `@${(accounts.data ?? []).find((a) => a.id === id)?.username ?? "conta"}`
      : "Todas as contas";

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Gerados automaticamente: diário todo dia às 9h, semanal às segundas e mensal no dia 1º (consolidado e por marca). Você também pode gerar para qualquer período."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Gerar agora</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="ini">Início</Label>
            <Input
              id="ini"
              type="date"
              value={novo.inicio}
              onChange={(e) => setNovo({ ...novo, inicio: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fim">Fim</Label>
            <Input
              id="fim"
              type="date"
              value={novo.fim}
              onChange={(e) => setNovo({ ...novo, fim: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Conta</Label>
            <AccountFilter
              value={novo.conta}
              onChange={(v) => setNovo({ ...novo, conta: v })}
              allLabel="Consolidado (todas)"
            />
          </div>
          <Button
            onClick={() => gerar.mutate()}
            disabled={gerar.isPending || !novo.inicio || !novo.fim}
          >
            {gerar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Gerar relatório
          </Button>
        </CardContent>
      </Card>

      <div className="mb-4">
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(TIPO_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {reports.isLoading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : !reports.data?.length ? (
        <EmptyState icon={<FileText className="size-8" />} title="Nenhum relatório ainda">
          O primeiro relatório diário é gerado amanhã às 9h. Ou gere um agora acima.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {reports.data.map((r) => (
            <Link key={r.id} to="/relatorios/$reportId" params={{ reportId: r.id }}>
              <Card className="hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <Badge variant="outline">{TIPO_LABEL[r.tipo] ?? r.tipo}</Badge>
                  <span className="font-medium">
                    {br(r.periodo_inicio)} a {br(r.periodo_fim)}
                  </span>
                  <span className="text-muted-foreground">{nome(r.instagram_account_id)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    gerado em {formatDateTime(r.gerado_em)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

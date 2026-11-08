import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/page-header";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, qk } from "@/lib/queries";

export const Route = createFileRoute("/_app/atividades")({
  head: () => ({ meta: [{ title: "Atividades — Gestor Instagram" }] }),
  component: ActivityPage,
});

const ACAO_LABEL: Record<string, string> = {
  configuracao_inicial: "Configuração inicial",
  conectar_meta: "Conectar Meta",
  desconectar_meta: "Desconectar Meta",
  verificar_conexao: "Verificar conexão",
  verificacao_diaria: "Verificação diária",
  gerenciar_conta: "Gerenciar conta",
  deixar_de_gerenciar_conta: "Deixar de gerenciar conta",
  desativar_conta: "Desativar conta",
  pausa_geral_ativada: "Pausa geral ativada",
  pausa_geral_desativada: "Pausa geral desativada",
  alterar_configuracao: "Alterar configuração",
  exclusao_de_dados_meta: "Exclusão de dados (Meta)",
};

const ALL = "__todas__";

function ActivityPage() {
  const [acao, setAcao] = useState(ALL);
  const [resultado, setResultado] = useState(ALL);
  const [busca, setBusca] = useState("");

  const log = useQuery({
    queryKey: [...qk.audit, acao, resultado],
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (acao !== ALL) q = q.eq("acao", acao);
      if (resultado !== ALL) q = q.eq("resultado", resultado);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return log.data ?? [];
    return (log.data ?? []).filter((r) =>
      [r.user_email, r.alvo, r.acao, JSON.stringify(r.detalhes)].some((v) =>
        (v ?? "").toLowerCase().includes(term),
      ),
    );
  }, [log.data, busca]);

  return (
    <>
      <PageHeader
        title="Atividades"
        description="Registro das operações administrativas. Visível apenas para administradores. Mostra os 300 registros mais recentes do filtro."
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select value={acao} onValueChange={setAcao}>
          <SelectTrigger className="sm:w-64" aria-label="Filtrar por ação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as ações</SelectItem>
            {Object.entries(ACAO_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={resultado} onValueChange={setResultado}>
          <SelectTrigger className="sm:w-44" aria-label="Filtrar por resultado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os resultados</SelectItem>
            <SelectItem value="sucesso">Sucesso</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar por usuário, alvo ou detalhe"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:flex-1"
        />
      </div>

      {log.isLoading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : !rows.length ? (
        <EmptyState icon={<Activity className="size-8" />} title="Nenhuma atividade encontrada">
          As operações aparecem aqui conforme forem acontecendo.
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>Alvo</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="min-w-56">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(r.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">{ACAO_LABEL[r.acao] ?? r.acao}</TableCell>
                    <TableCell className="text-sm">
                      {r.user_email ?? (r.user_id ? r.user_id.slice(0, 8) : "Sistema")}
                    </TableCell>
                    <TableCell
                      className="max-w-40 truncate text-xs text-muted-foreground"
                      title={r.alvo ?? ""}
                    >
                      {r.alvo ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.resultado === "erro"
                            ? "destructive"
                            : r.resultado === "parcial"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {r.resultado}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="max-w-80 truncate font-mono text-xs text-muted-foreground"
                      title={JSON.stringify(r.detalhes)}
                    >
                      {Object.keys(r.detalhes ?? {}).length ? JSON.stringify(r.detalhes) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

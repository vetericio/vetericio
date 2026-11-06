import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { supabase } from "@/integrations/supabase/client";
import { resumeAutomation, saveRules } from "@/lib/ops.functions";
import { errorMessage, formatDateTime, useAccounts, useSettings } from "@/lib/queries";
import { useIsAdmin } from "@/lib/session";

export const Route = createFileRoute("/_app/regras")({
  head: () => ({ meta: [{ title: "Regras de automação — Gestor Instagram" }] }),
  component: RulesPage,
});

const FORMATOS = [
  ["imagem", "Imagem"],
  ["carrossel", "Carrossel"],
  ["reels", "Reels"],
  ["story", "Story"],
] as const;
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function RulesPage() {
  const accounts = useAccounts();
  const settings = useSettings();
  const isAdmin = useIsAdmin();
  const rules = useQuery({
    queryKey: ["regras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("regras_publicacao").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
  const managed = (accounts.data ?? []).filter((a) => a.gerenciada);
  return (
    <>
      <PageHeader
        title="Regras de automação"
        description="Valem para o que o assistente agenda sozinho. Fora das regras, a publicação não é descartada: vai para aprovação humana. Para pessoas, as regras aparecem como avisos."
      />
      <Alert className="mb-6">
        <AlertDescription>
          Modo atual:{" "}
          <strong>
            {settings.data?.modo_autonomia === "assistido"
              ? "Assistido"
              : settings.data?.modo_autonomia === "gestao_ampliada"
                ? "Gestão ampliada"
                : "Automático com regras"}
          </strong>
          {settings.data?.pausa_geral ? " · PAUSA GERAL ATIVA" : ""}. No modo Assistido tudo o que o
          assistente agenda espera aprovação. Respostas automáticas a comentários só funcionam em
          Gestão ampliada. Exclusão de publicações, gastos com anúncios e mensagens em massa nunca
          são automáticos.
        </AlertDescription>
      </Alert>
      {rules.isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <div className="space-y-6">
          {managed.map((a) => (
            <RegraConta
              key={a.id}
              accountId={a.id}
              username={a.username ?? ""}
              regra={(rules.data ?? []).find((r) => r.instagram_account_id === a.id) ?? null}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </>
  );
}

type Regra = NonNullable<ReturnType<typeof useQuery>["data"]> & Record<string, any>;

function RegraConta({
  accountId,
  username,
  regra,
  isAdmin,
}: {
  accountId: string;
  username: string;
  regra: Regra | null;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    ativa: true,
    formatos: ["imagem", "carrossel", "reels", "story"] as string[],
    max_por_dia: 3,
    max_por_semana: 10,
    hora_inicio: 8,
    hora_fim: 22,
    dias_semana: [0, 1, 2, 3, 4, 5, 6] as number[],
    palavras: "",
    campanhas: "",
    suspender_apos_falhas: 3,
    respostas_automaticas: false,
  });
  useEffect(() => {
    if (!regra) return;
    setF({
      ativa: regra["ativa"],
      formatos: regra["formatos"],
      max_por_dia: regra["max_por_dia"],
      max_por_semana: regra["max_por_semana"],
      hora_inicio: regra["hora_inicio"],
      hora_fim: regra["hora_fim"],
      dias_semana: regra["dias_semana"],
      palavras: (regra["palavras_proibidas"] as string[]).join(", "),
      campanhas: (regra["campanhas_com_aprovacao"] as string[]).join(", "),
      suspender_apos_falhas: regra["suspender_apos_falhas"],
      respostas_automaticas: regra["respostas_automaticas"],
    });
  }, [regra]);
  const lista = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  const save = useMutation({
    mutationFn: () =>
      saveRules({
        data: {
          instagram_account_id: accountId,
          ativa: f.ativa,
          formatos: f.formatos as ("imagem" | "carrossel" | "reels" | "story")[],
          max_por_dia: f.max_por_dia,
          max_por_semana: f.max_por_semana,
          hora_inicio: f.hora_inicio,
          hora_fim: f.hora_fim,
          dias_semana: f.dias_semana,
          palavras_proibidas: lista(f.palavras),
          campanhas_com_aprovacao: lista(f.campanhas),
          suspender_apos_falhas: f.suspender_apos_falhas,
          respostas_automaticas: f.respostas_automaticas,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["regras"] });
      toast.success("Regras salvas.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const resume = useMutation({
    mutationFn: () => resumeAutomation({ data: { accountId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["regras"] });
      toast.success("Automação retomada.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = <T,>(arr: T[], v: T) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  const dis = !isAdmin;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          @{username}
          <label className="flex items-center gap-2 text-sm font-normal">
            <Switch
              checked={f.ativa}
              onCheckedChange={(v) => setF({ ...f, ativa: v })}
              disabled={dis}
            />
            Automação ativa
          </label>
        </CardTitle>
        {regra?.["suspensa_em"] ? (
          <CardDescription className="flex flex-wrap items-center gap-2 text-destructive">
            Suspensa em {formatDateTime(regra["suspensa_em"])}: {regra["motivo_suspensao"]}.
            {isAdmin ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => resume.mutate()}
                disabled={resume.isPending}
              >
                Retomar automação
              </Button>
            ) : null}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Formatos permitidos</Label>
          <div className="flex flex-wrap gap-3">
            {FORMATOS.map(([k, l]) => (
              <label key={k} className="flex items-center gap-1 text-sm">
                <Checkbox
                  checked={f.formatos.includes(k)}
                  onCheckedChange={() => setF({ ...f, formatos: toggle(f.formatos, k) })}
                  disabled={dis}
                />
                {l}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Dias permitidos</Label>
          <div className="flex flex-wrap gap-3">
            {DIAS.map((d, i) => (
              <label key={d} className="flex items-center gap-1 text-sm">
                <Checkbox
                  checked={f.dias_semana.includes(i)}
                  onCheckedChange={() => setF({ ...f, dias_semana: toggle(f.dias_semana, i) })}
                  disabled={dis}
                />
                {d}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <Num
            label="Máx. por dia"
            v={f.max_por_dia}
            on={(n) => setF({ ...f, max_por_dia: n })}
            dis={dis}
          />
          <Num
            label="Máx. por semana"
            v={f.max_por_semana}
            on={(n) => setF({ ...f, max_por_semana: n })}
            dis={dis}
          />
        </div>
        <div className="flex gap-3">
          <Num
            label="Das (h)"
            v={f.hora_inicio}
            on={(n) => setF({ ...f, hora_inicio: n })}
            dis={dis}
          />
          <Num label="Até (h)" v={f.hora_fim} on={(n) => setF({ ...f, hora_fim: n })} dis={dis} />
          <Num
            label="Suspender após falhas"
            v={f.suspender_apos_falhas}
            on={(n) => setF({ ...f, suspender_apos_falhas: n })}
            dis={dis}
          />
        </div>
        <div className="space-y-1">
          <Label>Palavras e temas proibidos (separados por vírgula)</Label>
          <Textarea
            rows={2}
            value={f.palavras}
            onChange={(e) => setF({ ...f, palavras: e.target.value })}
            disabled={dis}
            placeholder="política, promoção relâmpago"
          />
          <p className="text-xs text-muted-foreground">
            Os “temas proibidos” do perfil da marca também valem.
          </p>
        </div>
        <div className="space-y-1">
          <Label>Campanhas que sempre exigem aprovação (separadas por vírgula)</Label>
          <Textarea
            rows={2}
            value={f.campanhas}
            onChange={(e) => setF({ ...f, campanhas: e.target.value })}
            disabled={dis}
            placeholder="Lançamento, Parcerias"
          />
        </div>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <Switch
            checked={f.respostas_automaticas}
            onCheckedChange={(v) => setF({ ...f, respostas_automaticas: v })}
            disabled={dis}
          />
          Responder automaticamente elogios, perguntas e interesse comercial (só no modo Gestão
          ampliada; reclamações e casos sensíveis sempre vão para humano)
        </label>
        {isAdmin ? (
          <div className="md:col-span-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Salvar regras de @{username}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Num({
  label,
  v,
  on,
  dis,
}: {
  label: string;
  v: number;
  on: (n: number) => void;
  dis: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        className="w-24"
        value={v}
        onChange={(e) => on(Number(e.target.value))}
        disabled={dis}
      />
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage, qk } from "@/lib/queries";

export const Route = createFileRoute("/_app/marcas/$accountId")({
  head: () => ({ meta: [{ title: "Perfil da marca — Gestor Instagram" }] }),
  component: BrandPage,
});

const brandSchema = z.object({
  nome_marca: z.string().trim().min(1, "Informe o nome da marca").max(120),
  descricao: z.string().trim().max(2000),
  publico_alvo: z.string().trim().max(2000),
  tom_de_voz: z.string().trim().max(2000),
  objetivos: z.string().trim().max(2000),
  frequencia_semanal: z.union([z.literal(""), z.coerce.number().int().min(0).max(50)]),
  temas_proibidos: z.string().trim().max(2000),
  hashtags: z.string().max(2000),
  contato_resposta: z.string().trim().max(200),
});

type BrandForm = { [K in keyof z.input<typeof brandSchema>]: string };

const EMPTY: BrandForm = {
  nome_marca: "",
  descricao: "",
  publico_alvo: "",
  tom_de_voz: "",
  objetivos: "",
  frequencia_semanal: "",
  temas_proibidos: "",
  hashtags: "",
  contato_resposta: "",
};

function parseHashtags(raw: string): string[] {
  const tags = raw
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(/^#*/, ""))
    .filter(Boolean)
    .map((t) => `#${t}`);
  return Array.from(new Set(tags)).slice(0, 30);
}

function BrandPage() {
  const { accountId } = Route.useParams();
  const qc = useQueryClient();
  const [form, setForm] = useState<BrandForm>(EMPTY);

  const data = useQuery({
    queryKey: ["brand", accountId],
    queryFn: async () => {
      const [acc, brand] = await Promise.all([
        supabase
          .from("instagram_accounts")
          .select("id, username, nome")
          .eq("id", accountId)
          .maybeSingle(),
        supabase.from("brands").select("*").eq("instagram_account_id", accountId).maybeSingle(),
      ]);
      if (acc.error) throw acc.error;
      if (brand.error) throw brand.error;
      return { account: acc.data, brand: brand.data };
    },
  });

  useEffect(() => {
    const b = data.data?.brand;
    const a = data.data?.account;
    if (b) {
      setForm({
        nome_marca: b.nome_marca,
        descricao: b.descricao ?? "",
        publico_alvo: b.publico_alvo ?? "",
        tom_de_voz: b.tom_de_voz ?? "",
        objetivos: b.objetivos ?? "",
        frequencia_semanal: b.frequencia_semanal != null ? String(b.frequencia_semanal) : "",
        temas_proibidos: b.temas_proibidos ?? "",
        hashtags: b.hashtags_padrao.join(" "),
        contato_resposta: b.contato_resposta ?? "",
      });
    } else if (a) {
      setForm({ ...EMPTY, nome_marca: a.nome ?? a.username ?? "" });
    }
  }, [data.data]);

  const save = useMutation({
    mutationFn: async (values: BrandForm) => {
      const v = brandSchema.parse(values);
      const nullable = (s: string) => (s ? s : null);
      const { error } = await supabase.from("brands").upsert(
        {
          instagram_account_id: accountId,
          nome_marca: v.nome_marca,
          descricao: nullable(v.descricao),
          publico_alvo: nullable(v.publico_alvo),
          tom_de_voz: nullable(v.tom_de_voz),
          objetivos: nullable(v.objetivos),
          frequencia_semanal: v.frequencia_semanal === "" ? null : v.frequencia_semanal,
          temas_proibidos: nullable(v.temas_proibidos),
          hashtags_padrao: parseHashtags(v.hashtags),
          contato_resposta: nullable(v.contato_resposta),
        },
        { onConflict: "instagram_account_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand", accountId] });
      qc.invalidateQueries({ queryKey: qk.brands });
      toast.success("Perfil da marca salvo.");
    },
    onError: (e) => {
      if (e instanceof z.ZodError) toast.error(e.issues[0]?.message ?? "Dados inválidos.");
      else toast.error(errorMessage(e));
    },
  });

  const set = (k: keyof BrandForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(form);
  };

  if (data.isLoading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (!data.data?.account) {
    return (
      <p className="text-sm text-muted-foreground">
        Conta não encontrada.{" "}
        <Link to="/contas" className="underline">
          Voltar para contas
        </Link>
      </p>
    );
  }

  const acc = data.data.account;
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link to="/contas">
          <ArrowLeft className="size-4" />
          Contas
        </Link>
      </Button>
      <PageHeader
        title={`Perfil da marca — @${acc.username ?? "conta"}`}
        description="Estas orientações guiam legendas, hashtags e recomendações para esta conta. Cada marca tem o seu próprio perfil."
      />
      <Card>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
            <Field id="nome_marca" label="Nome da marca">
              <Input
                id="nome_marca"
                value={form.nome_marca}
                onChange={set("nome_marca")}
                maxLength={120}
                required
              />
            </Field>
            <Field id="frequencia_semanal" label="Publicações desejadas por semana">
              <Input
                id="frequencia_semanal"
                type="number"
                min={0}
                max={50}
                inputMode="numeric"
                value={form.frequencia_semanal}
                onChange={set("frequencia_semanal")}
              />
            </Field>
            <Field id="descricao" label="Descrição e posicionamento" wide>
              <Textarea
                id="descricao"
                rows={3}
                value={form.descricao}
                onChange={set("descricao")}
              />
            </Field>
            <Field id="publico_alvo" label="Público-alvo">
              <Textarea
                id="publico_alvo"
                rows={3}
                value={form.publico_alvo}
                onChange={set("publico_alvo")}
              />
            </Field>
            <Field id="tom_de_voz" label="Tom de voz">
              <Textarea
                id="tom_de_voz"
                rows={3}
                value={form.tom_de_voz}
                onChange={set("tom_de_voz")}
                placeholder="Ex.: próximo, sofisticado, sem gírias"
              />
            </Field>
            <Field id="objetivos" label="Objetivos de marketing">
              <Textarea
                id="objetivos"
                rows={3}
                value={form.objetivos}
                onChange={set("objetivos")}
              />
            </Field>
            <Field id="temas_proibidos" label="Temas proibidos">
              <Textarea
                id="temas_proibidos"
                rows={3}
                value={form.temas_proibidos}
                onChange={set("temas_proibidos")}
              />
            </Field>
            <Field
              id="hashtags"
              label="Hashtags padrão (separadas por espaço ou vírgula, até 30)"
              wide
            >
              <Input id="hashtags" value={form.hashtags} onChange={set("hashtags")} />
            </Field>
            <Field
              id="contato_resposta"
              label="Contato usado nas respostas a comentários (ex.: no WhatsApp (31) 99223-3295)"
              wide
            >
              <Input
                id="contato_resposta"
                value={form.contato_resposta}
                maxLength={200}
                onChange={set("contato_resposta")}
              />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Salvar perfil
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

function Field({
  id,
  label,
  wide,
  children,
}: {
  id: string;
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "space-y-2 md:col-span-2" : "space-y-2"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

import { useEffect, useState } from "react";
import { ClipboardCheck, RefreshCcw } from "lucide-react";
import { supabaseBanco } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  REGISTRATION_COLUMNS,
  REGISTRATION_GROUPS,
  originalRegistrationData,
  registrationValue,
  type RegistrationRecord,
} from "@/lib/clinic-registration-data";

export function ClinicRegistrationData({ clinicId }: { clinicId: string }) {
  const [state, setState] = useState<{
    clinicId: string;
    records: RegistrationRecord[];
    loading: boolean;
    error: boolean;
  }>({ clinicId, records: [], loading: true, error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ clinicId, records: [], loading: true, error: false });
    void (async () => {
      try {
        const records: RegistrationRecord[] = [];
        for (let start = 0; ; start += 100) {
          // Same client/RLS as the existing admin queries; generated schema predates clinic linkage.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabaseBanco as any)
            .from("oricse_contratacoes")
            .select(REGISTRATION_COLUMNS)
            .eq("clinica_criada_id", clinicId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(start, start + 99);
          if (error) throw error;
          const batch = (data || []) as unknown as RegistrationRecord[];
          records.push(...batch);
          if (!active) return;
          if (batch.length < 100) break;
        }
        if (active) setState({ clinicId, records, loading: false, error: false });
      } catch {
        if (active) setState({ clinicId, records: [], loading: false, error: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [clinicId, attempt]);

  const loading = state.clinicId !== clinicId || state.loading;
  const records = state.clinicId === clinicId ? state.records : [];
  const known = new Set<string>([
    "id",
    "created_at",
    ...REGISTRATION_GROUPS.flatMap((group) => group.fields.map(([key]) => key)),
  ]);
  return (
    <section
      className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm"
      aria-labelledby="clinic-registration-title"
    >
      <h2 id="clinic-registration-title" className="flex items-center gap-2 text-2xl font-bold">
        <ClipboardCheck size={22} />
        Dados
      </h2>
      {loading ? (
        <p className="mt-5 text-muted-foreground" role="status">
          Carregando dados da contratação...
        </p>
      ) : state.error ? (
        <div className="mt-5" role="alert">
          <p>
            Não foi possível consultar os dados da contratação. Nenhuma informação foi alterada.
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCcw />
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          {!records.length && (
            <p className="mt-5 text-muted-foreground">
              Nenhuma contratação vinculada a esta clínica foi encontrada.
            </p>
          )}
          {(records.length ? records : [{}]).map((record, index) => {
            const values = originalRegistrationData(record);
            const extras = Object.entries(values).filter(([key]) => !known.has(key));
            return (
              <div key={String(record.id || index)} className="mt-6 space-y-6">
                {records.length > 0 && (
                  <p className="border-b pb-3 text-sm text-muted-foreground">
                    Contratação {index + 1} ·{" "}
                    {typeof record.created_at === "string"
                      ? new Date(record.created_at).toLocaleString("pt-BR")
                      : "Não informado"}
                  </p>
                )}
                {REGISTRATION_GROUPS.map((group) => (
                  <section key={group.title}>
                    <h3 className="border-b pb-2 text-lg font-semibold">{group.title}</h3>
                    <dl className="mt-4 grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                      {group.fields.map(([key, label]) => (
                        <div key={key} className="min-w-0">
                          <dt className="text-sm text-muted-foreground">{label}</dt>
                          <dd
                            className={`mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${key.startsWith("responsavel_crmv") ? "text-lg font-bold text-primary" : "font-medium"}`}
                          >
                            {key === "logo_data_url" &&
                            typeof values[key] === "string" &&
                            /^data:image\/(png|jpeg|webp);base64,/.test(values[key] as string) ? (
                              <img
                                src={values[key] as string}
                                alt="Logo enviada na contratação"
                                className="h-24 max-w-full object-contain"
                              />
                            ) : (
                              registrationValue(values[key])
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
                {extras.length > 0 && (
                  <section>
                    <h3 className="border-b pb-2 text-lg font-semibold">
                      Outras informações salvas no formulário
                    </h3>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      {extras.map(([key, value]) => (
                        <div key={key} className="min-w-0">
                          <dt className="text-sm capitalize text-muted-foreground">
                            {key.replace(/_/g, " ")}
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap font-medium [overflow-wrap:anywhere]">
                            {registrationValue(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

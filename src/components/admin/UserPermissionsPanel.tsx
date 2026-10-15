import { RotateCcw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Permissao = {
  codigo: string;
  nome: string;
  grupo: string;
  descricao: string;
  permitido: boolean;
  origem: "cargo" | "usuario" | "plano" | string;
  ordem: number;
};

type Props = {
  clinicaId: string;
  userId: string;
  nomeUsuario: string;
};

export function UserPermissionsPanel({ clinicaId, userId, nomeUsuario }: Props) {
  const [aberto, setAberto] = useState(false);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Permissao[]>();
    for (const permissao of permissoes) {
      const lista = mapa.get(permissao.grupo) || [];
      lista.push(permissao);
      mapa.set(permissao.grupo, lista);
    }
    return Array.from(mapa.entries());
  }, [permissoes]);

  async function carregar() {
    setCarregando(true);
    try {
      const { data, error } = await (supabase as any).rpc("oricse_permissoes_efetivas", {
        p_clinica_id: clinicaId,
        p_user_id: userId,
      });
      if (error) throw error;
      setPermissoes((data || []) as Permissao[]);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível carregar as permissões.");
    } finally {
      setCarregando(false);
    }
  }

  async function abrir() {
    setAberto(true);
    await carregar();
  }

  async function definir(permissao: Permissao, permitido: boolean) {
    if (permissao.origem === "plano") {
      toast.error("Essa função está bloqueada pelo plano da clínica.");
      return;
    }
    setSalvando(permissao.codigo);
    try {
      const { error } = await (supabase as any).rpc("oricse_definir_permissao_usuario", {
        p_clinica_id: clinicaId,
        p_user_id: userId,
        p_codigo: permissao.codigo,
        p_permitido: permitido,
      });
      if (error) throw error;
      await carregar();
      toast.success(permitido ? "Permissão liberada para este usuário." : "Permissão bloqueada para este usuário.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível alterar a permissão.");
    } finally {
      setSalvando(null);
    }
  }

  async function restaurar(permissao: Permissao) {
    setSalvando(permissao.codigo);
    try {
      const { error } = await (supabase as any).rpc("oricse_restaurar_permissao_usuario", {
        p_clinica_id: clinicaId,
        p_user_id: userId,
        p_codigo: permissao.codigo,
      });
      if (error) throw error;
      await carregar();
      toast.success("Permissão restaurada para o padrão do cargo.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível restaurar a permissão.");
    } finally {
      setSalvando(null);
    }
  }

  return <>
    <button type="button" onClick={() => void abrir()} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold">
      <ShieldCheck size={15}/> Permissões
    </button>

    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck size={19}/> Permissões · {nomeUsuario}</DialogTitle>
          <DialogDescription>
            O cargo define o padrão. Aqui você pode liberar ou bloquear funções só para esta pessoa. O plano da clínica sempre prevalece.
          </DialogDescription>
        </DialogHeader>

        {carregando && permissoes.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">Carregando permissões...</div> : <div className="space-y-5">
          {grupos.map(([grupo, itens]) => <section key={grupo} className="rounded-xl border p-4">
            <h3 className="font-bold">{grupo}</h3>
            <div className="mt-3 divide-y">
              {itens.map((permissao) => {
                const bloqueadoPlano = permissao.origem === "plano";
                const personalizado = permissao.origem === "usuario";
                return <div key={permissao.codigo} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{permissao.nome}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{permissao.descricao}</div>
                    <div className="mt-1 text-[11px] font-medium text-muted-foreground">
                      {bloqueadoPlano ? "Bloqueado pelo plano" : personalizado ? "Personalizado para este usuário" : "Padrão do cargo"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {personalizado && <button type="button" disabled={salvando === permissao.codigo} onClick={() => void restaurar(permissao)} title="Restaurar padrão do cargo" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border disabled:opacity-50"><RotateCcw size={15}/></button>}
                    <button type="button" disabled={bloqueadoPlano || salvando === permissao.codigo} onClick={() => void definir(permissao, !permissao.permitido)}
                      className={`min-h-10 min-w-[104px] rounded-xl px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${permissao.permitido ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {permissao.permitido ? "Permitido" : "Bloqueado"}
                    </button>
                  </div>
                </div>;
              })}
            </div>
          </section>)}
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}

import { LockKeyhole, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  nome: string;
  descricao?: string;
  children?: React.ReactNode;
  bloqueado: boolean;
  motivo?: "plano" | "usuario";
  className?: string;
};

/**
 * Presentation only: the caller must enforce the permission in the route,
 * server actions and database policies. Never treat this component as security.
 */
export function RecursoProtegido({
  nome, descricao, children, bloqueado, motivo = "plano", className = "",
}: Props) {
  const [aberto, setAberto] = useState(false);
  if (bloqueado && motivo === "usuario") return null;
  if (!bloqueado) return <>{children}</>;
  return <>
    <button type="button" onClick={() => setAberto(true)}
      aria-label={`${nome}: recurso indisponível no plano atual`}
      className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-left text-sm text-muted-foreground opacity-75 hover:opacity-100 ${className}`}>
      <span>{nome}</span><LockKeyhole size={16} aria-hidden="true"/>
    </button>
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LockKeyhole size={19}/> {nome}</DialogTitle>
          <DialogDescription>{descricao || "Este recurso não está incluído no plano contratado pela sua clínica."}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Consulte os planos disponíveis ou converse com o administrador da clínica para solicitar a liberação.</p>
        <a href="/planos" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Conhecer os planos <ArrowUpRight size={16}/>
        </a>
      </DialogContent>
    </Dialog>
  </>;
}

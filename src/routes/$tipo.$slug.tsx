import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2 } from "lucide-react";
import { PortalTutorClinica } from "./pet/$slug/portal";

export const Route = createFileRoute("/$tipo/$slug")({ component: PortalParceiro });

function PortalParceiro() {
  const { tipo, slug } = Route.useParams();
  const segmentoValido = tipo === "vet" || tipo === "pet";
  const titulo = "Portal veterinário";

  if (tipo === "pet") return <PortalTutorClinica slugDaClinica={slug} />;

  if (!segmentoValido) {
    return <main className="grid min-h-screen place-items-center bg-muted/30 px-4"><section className="max-w-md rounded-2xl border bg-card p-7 text-center shadow-sm"><h1 className="text-2xl font-black">Página não encontrada</h1><Link to="/" className="mt-4 inline-flex rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">Ir para Oricse</Link></section></main>;
  }

  return <main className="grid min-h-screen place-items-center bg-gradient-to-b from-primary/10 to-background px-4 py-10">
    <section className="w-full max-w-lg rounded-3xl border bg-card p-7 text-center shadow-lg">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Building2 size={28} /></div>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-primary">Oricse</p>
      <h1 className="mt-2 text-3xl font-black text-foreground">{titulo}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Endereço da unidade: <strong className="text-foreground">/{tipo}/{slug}</strong></p>
      <p className="mt-6 text-sm leading-6 text-muted-foreground">Acesso exclusivo para a equipe veterinária.</p>
      <Link to="/login" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-black text-primary-foreground">Acessar sistema <ArrowRight size={18} /></Link>
    </section>
  </main>;
}

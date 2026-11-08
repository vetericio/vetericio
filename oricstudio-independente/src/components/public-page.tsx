import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useApplyTheme } from "@/components/theme-toggle";
import { LEGAL } from "@/lib/legal";

export function PublicPage({ title, children }: { title: string; children: ReactNode }) {
  useApplyTheme();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <span className="font-semibold">{LEGAL.nomeServico}</span>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <Link to="/termos" className="hover:text-foreground">
              Termos
            </Link>
            <Link to="/exclusao-de-dados" className="hover:text-foreground">
              Exclusão de dados
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {LEGAL.atualizadoEm}
        </p>
        <div className="mt-8 space-y-6 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:space-y-1 [&_ul]:text-muted-foreground">
          {children}
        </div>
      </main>
    </div>
  );
}

export function Contato() {
  return LEGAL.emailContato ? (
    <a href={`mailto:${LEGAL.emailContato}`} className="text-foreground underline">
      {LEGAL.emailContato}
    </a>
  ) : (
    <span className="text-foreground">o e-mail de contato do responsável pelo serviço</span>
  );
}

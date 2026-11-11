import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ORIGINAIS_EDITAVEIS } from "@/lib/admin-page-routes";
import { PortalTutorClinica } from "@/routes/pet/$slug/portal";
import { hostDaPagina } from "@/lib/tenant-context";

export const Route = createFileRoute("/$alias")({ component: AliasPagina });

/**
 * Um alias é apenas um atalho para a rota original.
 * Ele nunca concede acesso: todas as checagens de autenticação e permissão
 * continuam sendo executadas na rota real, inclusive quando o link é compartilhado.
 * A validação em lista fechada impede que uma entrada indevida no banco
 * transforme URLs personalizadas em redirecionamentos externos ou administrativos.
 */
function AliasPagina() {
  const { alias } = Route.useParams();
  const [erro, setErro] = useState("");
  const [portalAlvorada, setPortalAlvorada] = useState(false);

  useEffect(() => {
    let ativo = true;
    setErro("");
    // Decidir a clínica no efeito evita diferença de HTML entre SSR e browser.
    // O atalho não consulta aliases administrativos nem muda autenticação.
    const rotaPublicaAlvorada =
      alias === "portaldotutor" && hostDaPagina() === "alvorada.oricse.com.br";
    setPortalAlvorada(rotaPublicaAlvorada);
    if (rotaPublicaAlvorada) return;

    if (!/^[a-z0-9-]{1,65}$/.test(alias)) {
      setErro("Endereço inválido.");
      return;
    }

    void (async () => {
      const { data, error } = await (supabase as any)
        .from("oricse_rotas_personalizadas")
        .select("rota_original")
        .eq("rota_publica", "/" + alias)
        .maybeSingle();

      if (!ativo) return;
      if (error) {
        setErro("Não foi possível consultar este endereço.");
        return;
      }

      const destino = String(data?.rota_original || "");
      if (!ORIGINAIS_EDITAVEIS.has(destino)) {
        setErro("Página não encontrada.");
        return;
      }

      // O caminho original permanece acessível, e não se cria um ciclo
      // de redirecionamento entre a página e o alias personalizado.
      window.location.replace(destino + window.location.search + window.location.hash);
    })();

    return () => { ativo = false; };
  }, [alias]);

  if (portalAlvorada && alias === "portaldotutor")
    return <PortalTutorClinica slugDaClinica="alvorada" />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F5F2] p-6 text-center text-[#381724]">
      <div className="max-w-sm rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold">{erro || "Abrindo a página…"}</h1>
        {erro && <a href="/" className="mt-4 inline-block text-sm font-semibold underline">Voltar ao início</a>}
      </div>
    </main>
  );
}

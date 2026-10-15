import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Recepcao } from "./recepcao";
import { Estoque } from "./estoque";
import { Financeiro } from "./financeiro";
import { Comandas } from "./comandas";
import { MinhaAtividade } from "./minha-atividade";

export const Route = createFileRoute("/$alias")({ component: AliasPagina });
const paginas: Record<string, React.ComponentType> = {
  "/recepcao": Recepcao,
  "/estoque": Estoque,
  "/financeiro": Financeiro,
  "/comandas": Comandas,
  "/minha-atividade": MinhaAtividade,
};

function AliasPagina() {
  const { alias } = Route.useParams();
  const [pagina, setPagina] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let ativo = true;
    setPagina(null);
    setErro("");
    (async () => {
      const { data, error } = await (supabase as any).from("oricse_rotas_personalizadas")
        .select("rota_original").eq("rota_publica", "/" + alias).maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não foi possível consultar este endereço."); return; }
      if (data?.rota_original && paginas[data.rota_original]) setPagina(data.rota_original);
      else setErro("Página não encontrada.");
    })();
    return () => { ativo = false; };
  }, [alias]);
  const Pagina = pagina ? paginas[pagina] : null;
  if (Pagina) return <Pagina />;
  return <main className="flex min-h-screen items-center justify-center p-6 text-center">
    <div><h1 className="text-xl font-bold">{erro || "Abrindo página..."}</h1>
      {erro && <a href="/" className="mt-3 inline-block underline">Voltar ao início</a>}</div>
  </main>;
}

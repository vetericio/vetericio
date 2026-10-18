import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/api/mercadopago/callback")({component:RetornoMercadoPago});
function RetornoMercadoPago(){
 if(typeof window!=="undefined"){
  const params=new URLSearchParams(window.location.search);
  const next=new URL("https://mwrmfcyrdxfxssebgknz.supabase.co/functions/v1/oricse-mercadopago-oauth");
  next.searchParams.set("action","callback");
  for(const campo of ["code","state","error"])if(params.has(campo))next.searchParams.set(campo,params.get(campo)||"");
  window.location.replace(next.toString());
 }
 return <main className="p-6 text-foreground">Finalizando autorização no Mercado Pago…</main>;
}
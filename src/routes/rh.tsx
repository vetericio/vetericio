import { createFileRoute, useLocation } from "@tanstack/react-router";
import { Estoque } from "./estoque";
export const Route = createFileRoute("/rh")({ component: RecursosHumanos });
function RecursosHumanos(){
 const {hash}=useLocation();
 const aba=hash.replace(/^#/,"");
 return <Estoque area="rh" abaInicial={aba==="equipe"||aba==="comissoes"||aba==="pagamentos"?aba:"pagamentos"}/>;
}

import { createFileRoute } from "@tanstack/react-router";
import { OricStudio } from "./oricstudio";

// A mesma interface, funcionalidades e componentes do OricStúdio das clínicas.
// O escopo "sistema" troca apenas a fonte de dados e as permissões no servidor.
export const Route=createFileRoute("/admin-oricstudio-sistema")({
  head:()=>({meta:[{title:"OricStúdio do ORICSE"}]}),
  component:()=> <OricStudio ambiente="sistema"/>,
});

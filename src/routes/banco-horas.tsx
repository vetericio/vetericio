import { createFileRoute } from "@tanstack/react-router";
import { MinhaAtividade } from "./minha-atividade";
export const Route = createFileRoute("/banco-horas")({component: BancoHoras});
function BancoHoras(){return <MinhaAtividade somenteHistorico />;}

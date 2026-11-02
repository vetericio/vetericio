import { createFileRoute } from "@tanstack/react-router";
import { TodasAgendas } from "./todas-agendas";
export const Route = createFileRoute("/agenda-hotel")({ component: AgendaHotel });
function AgendaHotel() { return <TodasAgendas somenteHotel />; }

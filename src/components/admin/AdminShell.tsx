import { useLocation, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  BadgeDollarSign, Building2, ClipboardCheck, CreditCard, Gauge, Globe2,
  ImageUp, LayoutDashboard, Menu, PanelsTopLeft, Settings, ShieldCheck,
  Trash2, X,
} from "lucide-react";

export type AdminAba =
  | "dashboard" | "novas" | "lixeira" | "clinicas" | "planos"
  | "site" | "sistema" | "paginas" | "pagamentos" | "auditoria";

type Grupo = "Operação" | "Produto e conteúdo" | "Controle";
type Item = {
  id: string;
  nome: string;
  Icone: typeof Gauge;
  grupo: Grupo;
  aba?: AdminAba;
  rota?: "/admin-oricstudio" | "/admin-conteudo" | "/oricstudio";
};

const ITENS: Item[] = [
  { id: "dashboard", nome: "Visão geral", Icone: Gauge, grupo: "Operação", aba: "dashboard" },
  { id: "novas", nome: "Clínicas novas", Icone: ClipboardCheck, grupo: "Operação", aba: "novas" },
  { id: "lixeira", nome: "Lixeira · 360 dias", Icone: Trash2, grupo: "Operação", aba: "lixeira" },
  { id: "clinicas", nome: "Clínicas e equipe", Icone: Building2, grupo: "Operação", aba: "clinicas" },
  { id: "planos", nome: "Planos e cupons", Icone: BadgeDollarSign, grupo: "Operação", aba: "planos" },
  { id: "pagamentos", nome: "OricsePay", Icone: CreditCard, grupo: "Operação", aba: "pagamentos" },
  { id: "oricstudio-plataforma", nome: "Meu OricStúdio", Icone: ImageUp, grupo: "Produto e conteúdo", rota: "/oricstudio" },
  { id: "oricstudio", nome: "OricStúdio Geral", Icone: ImageUp, grupo: "Produto e conteúdo", rota: "/admin-oricstudio" },
  { id: "conteudo", nome: "Conteúdo público", Icone: PanelsTopLeft, grupo: "Produto e conteúdo", rota: "/admin-conteudo" },
  { id: "site", nome: "Marca, sites e domínios", Icone: PanelsTopLeft, grupo: "Produto e conteúdo", aba: "site" },
  { id: "paginas", nome: "Páginas e URLs", Icone: Globe2, grupo: "Produto e conteúdo", aba: "paginas" },
  { id: "auditoria", nome: "Controle e auditoria", Icone: ShieldCheck, grupo: "Controle", aba: "auditoria" },
  { id: "sistema", nome: "Sistema e integrações", Icone: Settings, grupo: "Controle", aba: "sistema" },
];

type Contexto = { aba: AdminAba; setAba: (aba: AdminAba) => void };
const AdminNavigationContext = createContext<Contexto | null>(null);

export function useAdminNavigation(): Contexto {
  const contexto = useContext(AdminNavigationContext);
  if (!contexto) throw new Error("Navegação administrativa fora do layout ORICSE.");
  return contexto;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [aba, setAba] = useState<AdminAba>("dashboard");
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

  function abrir(item: Item) {
    setMenuAberto(false);
    if (item.aba) {
      setAba(item.aba);
      void navigate({ to: "/admin" });
    } else if (item.rota === "/oricstudio") {
      void navigate({ to: "/oricstudio", search: { ambiente: "plataforma" } });
    } else if (item.rota) {
      void navigate({ to: item.rota });
    }
  }

  function ativo(item: Item) {
    if (item.rota === "/oricstudio") return location.pathname === "/oricstudio" && location.search?.ambiente === "plataforma";
    if (item.rota) return location.pathname === item.rota;
    if (location.pathname === "/admin-planos" && item.id === "planos") return true;
    return location.pathname === "/admin" && item.aba === aba;
  }

  const navegacao = (
    <nav aria-label="Navegação administrativa" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-2 pb-6">
      <div className="border-b px-2 pb-4 pt-1">
        <p className="text-sm font-black text-slate-900">Administração ORICSE</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Gestão central da plataforma</p>
      </div>
      {(["Operação", "Produto e conteúdo", "Controle"] as Grupo[]).map((grupo) => (
        <section key={grupo}>
          <p className="px-2 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{grupo}</p>
          <div className="mt-1 grid gap-1">
            {ITENS.filter((item) => item.grupo === grupo).map((item) => {
              const selecionado = ativo(item);
              const Icone = item.Icone;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => abrir(item)}
                  aria-current={selecionado ? "page" : undefined}
                  className={"flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition " + (
                    selecionado ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <Icone size={18} className="shrink-0" />
                  <span className="min-w-0 flex-1">{item.nome}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );

  return (
    <AdminNavigationContext.Provider value={{ aba, setAba }}>
      <div className="min-h-[100dvh] bg-[#f6f4ef] text-slate-900">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r bg-white px-3 pt-4 shadow-sm lg:flex">
          {navegacao}
        </aside>
        <div className="lg:pl-[280px]">
          <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b bg-white px-4 lg:hidden">
            <button type="button" onClick={() => setMenuAberto(true)} aria-label="Abrir menu da administração" aria-expanded={menuAberto} className="flex h-11 w-11 items-center justify-center rounded-xl border">
              <Menu size={22} />
            </button>
            <LayoutDashboard size={18} className="text-primary" />
            <span className="font-bold">Administração ORICSE</span>
          </header>
          <div className="min-w-0">{children}</div>
        </div>
        {menuAberto && (
          <div className="fixed inset-0 z-[80] lg:hidden">
            <button type="button" aria-label="Fechar menu da administração" onClick={() => setMenuAberto(false)} className="absolute inset-0 bg-black/50" />
            <aside className="absolute inset-y-0 left-0 flex w-[min(85vw,320px)] flex-col border-r bg-white px-3 pt-4 shadow-2xl" role="dialog" aria-modal="true" aria-label="Menu da administração">
              <div className="flex items-center justify-between px-2 pb-3">
                <span className="font-black">Administração ORICSE</span>
                <button type="button" onClick={() => setMenuAberto(false)} aria-label="Fechar menu" className="flex h-10 w-10 items-center justify-center rounded-lg border"><X size={19} /></button>
              </div>
              {navegacao}
            </aside>
          </div>
        )}
      </div>
    </AdminNavigationContext.Provider>
  );
}

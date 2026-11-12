import { useLocation, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  BadgeDollarSign, Building2, ClipboardCheck, CreditCard, Gauge, Globe2,
  ImageUp, LayoutDashboard, Menu, PanelsTopLeft, Settings, ShieldCheck,
  Presentation, Trash2, X, FileText,
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
  rota?: "/admin-oricstudio" | "/admin-conteudo" | "/admin-solicitacoes-demonstracao" | "/admin-contratos" | "/oricstudio";
};

const ITENS: Item[] = [
  { id: "dashboard", nome: "Visão geral", Icone: Gauge, grupo: "Operação", aba: "dashboard" },
  { id: "novas", nome: "Clínicas novas", Icone: ClipboardCheck, grupo: "Operação", aba: "novas" },
  { id: "demonstracoes", nome: "Solicitações de demonstração", Icone: Presentation, grupo: "Operação", rota: "/admin-solicitacoes-demonstracao" },
  { id: "contratos", nome: "Contratos", Icone: FileText, grupo: "Operação", rota: "/admin-contratos" },
  { id: "lixeira", nome: "Lixeira · 360 dias", Icone: Trash2, grupo: "Operação", aba: "lixeira" },
  { id: "clinicas", nome: "Clínicas e equipe", Icone: Building2, grupo: "Operação", aba: "clinicas" },
  { id: "planos", nome: "Planos e cupons", Icone: BadgeDollarSign, grupo: "Operação", aba: "planos" },
  { id: "pagamentos", nome: "OricsePay", Icone: CreditCard, grupo: "Operação", aba: "pagamentos" },
  { id: "oricstudio-plataforma", nome: "Meu OricStúdio", Icone: ImageUp, grupo: "Produto e conteúdo", rota: "/oricstudio" },
  { id: "oricstudio", nome: "OricStúdio Geral", Icone: ImageUp, grupo: "Produto e conteúdo", rota: "/admin-oricstudio" },
  { id: "conteudo", nome: "Conteúdo público", Icone: PanelsTopLeft, grupo: "Produto e conteúdo", rota: "/admin-conteudo" },
  { id: "site", nome: "Marca, sites, páginas e URLs", Icone: PanelsTopLeft, grupo: "Produto e conteúdo", aba: "site" },
  { id: "auditoria", nome: "Controle e auditoria", Icone: ShieldCheck, grupo: "Controle", aba: "auditoria" },
  { id: "sistema", nome: "Sistema e integrações", Icone: Settings, grupo: "Controle", aba: "sistema" },
];

type Contexto = {
  aba: AdminAba;
  setAba: (aba: AdminAba) => void;
  adminMenuRecolhido: boolean;
  alternarMenuAdmin: () => void;
};
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
  // Somente o Canva administrativo usa a versão expandida da área de trabalho.
  const [adminMenuRecolhido, setAdminMenuRecolhido] = useState(true);
  const noCanvasAdmin = location.pathname === "/admin-canvas";
  const menuLateralOculto = noCanvasAdmin && adminMenuRecolhido;

  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

  function abrir(item: Item) {
    setMenuAberto(false);
    if (item.aba) {
      setAba(item.aba === "paginas" ? "site" : item.aba);
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
    <nav aria-label="Navegação administrativa" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pb-6">
      <div className="border-b px-2 pb-3 pt-1">
        <p className="text-sm font-black text-slate-900">Administração ORICSE</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Gestão central da plataforma</p>
      </div>
      {(["Operação", "Produto e conteúdo", "Controle"] as Grupo[]).map((grupo) => (
        <section key={grupo}>
          <p className="px-2 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{grupo}</p>
          <div className="mt-1 grid gap-0.5">
            {ITENS.filter((item) => item.grupo === grupo).map((item) => {
              const selecionado = ativo(item);
              const Icone = item.Icone;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => abrir(item)}
                  aria-current={selecionado ? "page" : undefined}
                  className={"flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition " + (
                    selecionado ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <Icone size={16} className="shrink-0" />
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
    <AdminNavigationContext.Provider value={{ aba, setAba, adminMenuRecolhido: menuLateralOculto, alternarMenuAdmin: () => setAdminMenuRecolhido((valor) => !valor) }}>
      <div className="min-h-[100dvh] bg-[#f6f4ef] text-slate-900">
        <aside className={`fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r bg-white px-2 pt-3 shadow-sm ${menuLateralOculto ? "" : "lg:flex"}`}>
          {navegacao}
        </aside>
        <div className={menuLateralOculto ? "lg:pl-0" : "lg:pl-[240px]"}>
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

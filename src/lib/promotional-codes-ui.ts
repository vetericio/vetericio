import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "oricse-promo-aplicado-v1";
const ADMIN_ID = "oricse-promo-admin";
const CHECKOUT_ID = "oricse-promo-checkout";

type Promo = {
  id: string;
  codigo: string;
  tipo_desconto: "percentual" | "fixo";
  valor: number;
  planos: string[];
  valido_de: string | null;
  valido_ate: string | null;
  limite_usos: number | null;
  limite_por_documento: number | null;
  ativo: boolean;
  somente_primeira_assinatura: boolean;
  duracao: "primeiro_mes" | "recorrente";
};

type PromoAplicado = {
  codigo: string;
  plano: string;
  valor_original: number;
  desconto_aplicado: number;
  valor_final: number;
  duracao: string;
};

function txt(el: Element | null) { return (el?.textContent || "").replace(/\s+/g, " ").trim(); }
function esc(v: unknown) { return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)); }
function brl(v: number) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function dataBR(v?: string | null) { if (!v) return "Sem limite"; const d = new Date(v); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
function upper(v: string) { return v.trim().toUpperCase().replace(/\s+/g, "-"); }
function toIso(v: string) { return v ? new Date(v).toISOString() : null; }
function fromIso(v?: string | null) { if (!v) return ""; const d = new Date(v); const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); }

function lerPromoAplicado(): PromoAplicado | null {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
}
function salvarPromoAplicado(v: PromoAplicado | null) {
  if (!v) sessionStorage.removeItem(STORAGE_KEY); else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
}

function instalarInterceptadorRpc() {
  const cliente: any = supabase as any;
  if (cliente.__oricsePromoRpcPatched) return;
  const original = cliente.rpc.bind(cliente);
  cliente.rpc = (nome: string, args?: any, opts?: any) => {
    if (nome === "oricse_iniciar_contratacao" && args?.p_dados) {
      const promo = lerPromoAplicado();
      if (promo && promo.plano === args.p_dados.plano_codigo) {
        args = {
          ...args,
          p_dados: {
            ...args.p_dados,
            promo_codigo: promo.codigo,
            promo_valor_original: promo.valor_original,
            promo_desconto: promo.desconto_aplicado,
            promo_valor_final: promo.valor_final,
            promo_duracao: promo.duracao,
          },
        };
      }
    }
    return original(nome, args, opts);
  };
  cliente.__oricsePromoRpcPatched = true;
}

function estiloBase() {
  if (document.getElementById("oricse-promo-style")) return;
  const style = document.createElement("style");
  style.id = "oricse-promo-style";
  style.textContent = `
    .oricse-promo-box{border:1px solid hsl(var(--border));background:hsl(var(--card));border-radius:18px;padding:18px;margin:18px 0;box-shadow:0 1px 3px rgba(0,0,0,.05)}
    .oricse-promo-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.oricse-promo-title{font-size:1.05rem;font-weight:800}.oricse-promo-sub{font-size:.875rem;color:hsl(var(--muted-foreground));margin-top:3px}
    .oricse-promo-btn{border:0;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer;background:hsl(var(--primary));color:hsl(var(--primary-foreground))}.oricse-promo-btn.secondary{background:white;color:hsl(var(--foreground));border:1px solid hsl(var(--border))}.oricse-promo-btn.danger{background:#fff1f2;color:#b91c1c;border:1px solid #fecdd3}.oricse-promo-btn:disabled{opacity:.45;cursor:not-allowed}
    .oricse-promo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.oricse-promo-field{display:flex;flex-direction:column;gap:5px;font-size:.82rem;font-weight:700}.oricse-promo-field input,.oricse-promo-field select{min-height:44px;border:1px solid hsl(var(--border));border-radius:12px;background:hsl(var(--background));padding:0 12px;font:inherit;font-weight:500;color:hsl(var(--foreground))}.oricse-promo-checks{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0}.oricse-promo-checks label{display:flex;align-items:center;gap:7px;font-size:.88rem;font-weight:650}
    .oricse-promo-list{display:grid;gap:10px;margin-top:14px}.oricse-promo-row{border:1px solid hsl(var(--border));border-radius:14px;padding:13px;display:grid;grid-template-columns:minmax(150px,1.2fr) minmax(130px,.8fr) minmax(180px,1fr) auto;gap:10px;align-items:center}.oricse-promo-code{font-weight:900;letter-spacing:.04em}.oricse-promo-meta{font-size:.78rem;color:hsl(var(--muted-foreground));margin-top:3px}.oricse-promo-badge{display:inline-flex;border-radius:999px;padding:3px 8px;font-size:.72rem;font-weight:800;background:#dcfce7;color:#166534}.oricse-promo-badge.off{background:#f1f5f9;color:#475569}.oricse-promo-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .oricse-promo-checkout{border:1px dashed hsl(var(--primary));background:hsl(var(--primary)/.035);border-radius:16px;padding:14px;margin:16px 0}.oricse-promo-line{display:flex;gap:8px;align-items:center}.oricse-promo-line input{flex:1;min-width:0;min-height:44px;border:1px solid hsl(var(--border));border-radius:12px;padding:0 12px;text-transform:uppercase}.oricse-promo-result{margin-top:9px;font-size:.88rem}.oricse-promo-result.ok{color:#047857;font-weight:700}.oricse-promo-result.err{color:#b91c1c;font-weight:700}
    @media(max-width:720px){.oricse-promo-grid{grid-template-columns:1fr}.oricse-promo-row{grid-template-columns:1fr}.oricse-promo-actions{justify-content:flex-start}.oricse-promo-line{align-items:stretch;flex-direction:column}}
  `;
  document.head.appendChild(style);
}

async function montarAdmin(section: HTMLElement) {
  section.innerHTML = `<div class="oricse-promo-head"><div><div class="oricse-promo-title">Códigos promocionais</div><div class="oricse-promo-sub">Crie descontos para a contratação dos planos da Oricse.</div></div><button class="oricse-promo-btn" data-action="novo">+ Criar código</button></div><div data-area="form"></div><div data-area="list" class="oricse-promo-list"><div class="oricse-promo-sub">Carregando códigos...</div></div>`;

  const [{ data: planos }, { data: usos }] = await Promise.all([
    (supabase as any).from("oricse_planos").select("codigo,nome,ativo").order("ordem"),
    (supabase as any).from("oricse_codigo_promocional_usos").select("codigo_id"),
  ]);
  const planosLista = (planos || []).filter((p: any) => p.codigo !== "teste-gratis");
  const usoPorCodigo = new Map<string, number>();
  (usos || []).forEach((u: any) => usoPorCodigo.set(u.codigo_id, (usoPorCodigo.get(u.codigo_id) || 0) + 1));

  let promos: Promo[] = [];
  async function carregar() {
    const { data, error } = await (supabase as any).from("oricse_codigos_promocionais").select("*").order("created_at", { ascending: false });
    if (error) {
      const list = section.querySelector<HTMLElement>('[data-area="list"]');
      if (list) list.innerHTML = `<div class="oricse-promo-sub">Não foi possível carregar: ${esc(error.message)}</div>`;
      return;
    }
    promos = (data || []) as Promo[];
    desenharLista();
  }

  function desenharLista() {
    const list = section.querySelector<HTMLElement>('[data-area="list"]');
    if (!list) return;
    if (!promos.length) { list.innerHTML = `<div class="oricse-promo-sub">Nenhum código promocional criado.</div>`; return; }
    list.innerHTML = promos.map((p) => {
      const desconto = p.tipo_desconto === "percentual" ? `${Number(p.valor)}%` : brl(Number(p.valor));
      const nomesPlanos = p.planos?.length ? p.planos.join(", ") : "Todos os planos";
      const usosN = usoPorCodigo.get(p.id) || 0;
      return `<div class="oricse-promo-row"><div><div class="oricse-promo-code">${esc(p.codigo)}</div><div class="oricse-promo-meta">${esc(nomesPlanos)}</div></div><div><strong>${esc(desconto)}</strong><div class="oricse-promo-meta">${p.duracao === "recorrente" ? "Recorrente" : "Somente 1º mês"}</div></div><div><span class="oricse-promo-badge ${p.ativo ? "" : "off"}">${p.ativo ? "Ativo" : "Inativo"}</span><div class="oricse-promo-meta">${esc(dataBR(p.valido_de))} → ${esc(dataBR(p.valido_ate))}<br>Usos: ${usosN}${p.limite_usos ? `/${p.limite_usos}` : ""}</div></div><div class="oricse-promo-actions"><button class="oricse-promo-btn secondary" data-edit="${esc(p.id)}">Editar</button><button class="oricse-promo-btn secondary" data-toggle="${esc(p.id)}">${p.ativo ? "Pausar" : "Ativar"}</button><button class="oricse-promo-btn danger" data-del="${esc(p.id)}">Excluir</button></div></div>`;
    }).join("");
  }

  function abrirForm(p?: Promo) {
    const formArea = section.querySelector<HTMLElement>('[data-area="form"]');
    if (!formArea) return;
    const selected = new Set(p?.planos || []);
    formArea.innerHTML = `<form data-promo-form class="oricse-promo-box"><div class="oricse-promo-grid"><label class="oricse-promo-field">Código<input name="codigo" maxlength="40" required value="${esc(p?.codigo || "")}" placeholder="ORICSE20"></label><label class="oricse-promo-field">Tipo de desconto<select name="tipo"><option value="percentual" ${p?.tipo_desconto !== "fixo" ? "selected" : ""}>Percentual</option><option value="fixo" ${p?.tipo_desconto === "fixo" ? "selected" : ""}>Valor fixo</option></select></label><label class="oricse-promo-field">Valor<input name="valor" type="number" min="0" step="0.01" required value="${esc(p?.valor ?? "")}"></label><label class="oricse-promo-field">Duração<select name="duracao"><option value="primeiro_mes" ${p?.duracao !== "recorrente" ? "selected" : ""}>Somente primeiro mês</option><option value="recorrente" ${p?.duracao === "recorrente" ? "selected" : ""}>Recorrente</option></select></label><label class="oricse-promo-field">Válido a partir de<input name="inicio" type="datetime-local" value="${esc(fromIso(p?.valido_de))}"></label><label class="oricse-promo-field">Válido até<input name="fim" type="datetime-local" value="${esc(fromIso(p?.valido_ate))}"></label><label class="oricse-promo-field">Limite total de usos<input name="limite" type="number" min="1" value="${esc(p?.limite_usos ?? "")}" placeholder="Sem limite"></label><label class="oricse-promo-field">Limite por CPF/CNPJ<input name="limiteDoc" type="number" min="1" value="${esc(p?.limite_por_documento ?? "")}" placeholder="Sem limite"></label></div><div class="oricse-promo-box" style="margin:12px 0;padding:12px"><strong style="font-size:.86rem">Planos válidos</strong><div class="oricse-promo-checks"><label><input type="checkbox" data-all ${!p?.planos?.length ? "checked" : ""}> Todos</label>${planosLista.map((pl: any) => `<label><input type="checkbox" name="plano" value="${esc(pl.codigo)}" ${selected.has(pl.codigo) ? "checked" : ""}> ${esc(pl.nome)}</label>`).join("")}</div></div><div class="oricse-promo-checks"><label><input type="checkbox" name="ativo" ${p?.ativo !== false ? "checked" : ""}> Ativo</label><label><input type="checkbox" name="primeira" ${p?.somente_primeira_assinatura ? "checked" : ""}> Somente primeira assinatura</label></div><div class="oricse-promo-actions" style="justify-content:flex-start"><button class="oricse-promo-btn" type="submit">${p ? "Salvar alterações" : "Criar código"}</button><button class="oricse-promo-btn secondary" type="button" data-cancel>Cancelar</button></div></form>`;

    const form = formArea.querySelector<HTMLFormElement>("[data-promo-form]")!;
    const all = form.querySelector<HTMLInputElement>("[data-all]")!;
    all.addEventListener("change", () => { if (all.checked) form.querySelectorAll<HTMLInputElement>('input[name="plano"]').forEach((x) => x.checked = false); });
    form.querySelectorAll<HTMLInputElement>('input[name="plano"]').forEach((x) => x.addEventListener("change", () => { if (x.checked) all.checked = false; if (![...form.querySelectorAll<HTMLInputElement>('input[name="plano"]')].some(y => y.checked)) all.checked = true; }));
    form.querySelector("[data-cancel]")?.addEventListener("click", () => formArea.innerHTML = "");
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const tipo = String(fd.get("tipo")) as "percentual" | "fixo";
      const valor = Number(fd.get("valor") || 0);
      if (tipo === "percentual" && valor > 100) { alert("O desconto percentual não pode passar de 100%."); return; }
      const planosValidos = all.checked ? [] : [...form.querySelectorAll<HTMLInputElement>('input[name="plano"]:checked')].map(x => x.value);
      const payload = {
        codigo: upper(String(fd.get("codigo") || "")), tipo_desconto: tipo, valor, planos: planosValidos,
        valido_de: toIso(String(fd.get("inicio") || "")), valido_ate: toIso(String(fd.get("fim") || "")),
        limite_usos: fd.get("limite") ? Number(fd.get("limite")) : null,
        limite_por_documento: fd.get("limiteDoc") ? Number(fd.get("limiteDoc")) : null,
        ativo: Boolean(fd.get("ativo")), somente_primeira_assinatura: Boolean(fd.get("primeira")),
        duracao: String(fd.get("duracao")), updated_at: new Date().toISOString(),
      };
      const q = p ? (supabase as any).from("oricse_codigos_promocionais").update(payload).eq("id", p.id) : (supabase as any).from("oricse_codigos_promocionais").insert(payload);
      const { error } = await q;
      if (error) { alert(error.message); return; }
      formArea.innerHTML = "";
      await carregar();
    });
  }

  section.querySelector("[data-action='novo']")?.addEventListener("click", () => abrirForm());
  section.addEventListener("click", async (ev) => {
    const target = ev.target as HTMLElement;
    const edit = target.closest<HTMLElement>("[data-edit]")?.dataset.edit;
    const toggle = target.closest<HTMLElement>("[data-toggle]")?.dataset.toggle;
    const del = target.closest<HTMLElement>("[data-del]")?.dataset.del;
    if (edit) { const p = promos.find(x => x.id === edit); if (p) abrirForm(p); }
    if (toggle) { const p = promos.find(x => x.id === toggle); if (!p) return; await (supabase as any).from("oricse_codigos_promocionais").update({ ativo: !p.ativo, updated_at: new Date().toISOString() }).eq("id", p.id); await carregar(); }
    if (del) { const p = promos.find(x => x.id === del); if (!p || !confirm(`Excluir o código ${p.codigo}?`)) return; const { error } = await (supabase as any).from("oricse_codigos_promocionais").delete().eq("id", p.id); if (error) alert(error.message); else await carregar(); }
  });
  await carregar();
}

function garantirAdmin() {
  if (location.pathname !== "/admin" || document.getElementById(ADMIN_ID)) return;
  const titulo = [...document.querySelectorAll("h1,h2,h3")].find((el) => txt(el) === "Planos da Oricse");
  if (!titulo) return;
  const section = document.createElement("section");
  section.id = ADMIN_ID;
  section.className = "oricse-promo-box";
  const pai = titulo.parentElement?.parentElement || titulo.parentElement;
  if (!pai) return;
  const referencia = titulo.parentElement?.nextSibling || null;
  pai.insertBefore(section, referencia);
  void montarAdmin(section);
}

function acharTotalCheckout(botao: HTMLButtonElement) {
  const area = botao.closest("section") || document.body;
  const texto = txt(area);
  const matches = [...texto.matchAll(/Total:\s*R\$\s*([\d.]+,\d{2})/gi)];
  const raw = matches.at(-1)?.[1];
  if (!raw) return 0;
  return Number(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

function dadosContratacao() {
  try { return JSON.parse(localStorage.getItem("oricse-contratacao") || "{}"); } catch { return {}; }
}

function garantirCheckout() {
  if (location.pathname !== "/contratar" || document.getElementById(CHECKOUT_ID)) return;
  const botao = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => ["Ir para pagamento", "Preparando..."].includes(txt(b)));
  if (!botao) return;
  const params = new URLSearchParams(location.search);
  const plano = params.get("plano") || "essencial";
  if (plano === "teste-gratis") return;
  const box = document.createElement("div");
  box.id = CHECKOUT_ID;
  box.className = "oricse-promo-checkout";
  const salvo = lerPromoAplicado();
  if (salvo && salvo.plano !== plano) salvarPromoAplicado(null);
  box.innerHTML = `<div class="oricse-promo-title" style="font-size:.95rem">Tenho um código promocional</div><div class="oricse-promo-sub">Digite o código antes de seguir para o pagamento.</div><div class="oricse-promo-line" style="margin-top:10px"><input data-code placeholder="CÓDIGO" value="${esc(salvo?.plano === plano ? salvo.codigo : "")}"><button type="button" class="oricse-promo-btn" data-apply>Aplicar</button>${salvo?.plano === plano ? '<button type="button" class="oricse-promo-btn secondary" data-remove>Remover</button>' : ""}</div><div data-result class="oricse-promo-result ${salvo?.plano === plano ? "ok" : ""}">${salvo?.plano === plano ? `Código ${esc(salvo.codigo)} aplicado: −${brl(salvo.desconto_aplicado)} · Total com desconto: ${brl(salvo.valor_final)}${salvo.duracao === "recorrente" ? " · desconto recorrente" : " · somente no primeiro mês"}` : ""}</div>`;
  botao.parentElement?.insertBefore(box, botao);

  const aplicar = box.querySelector<HTMLButtonElement>("[data-apply]")!;
  const input = box.querySelector<HTMLInputElement>("[data-code]")!;
  const result = box.querySelector<HTMLElement>("[data-result]")!;
  aplicar.addEventListener("click", async () => {
    const codigo = upper(input.value);
    if (!codigo) return;
    const total = acharTotalCheckout(botao);
    if (total <= 0) { result.className = "oricse-promo-result err"; result.textContent = "Não foi possível identificar o valor da contratação."; return; }
    const dados = dadosContratacao();
    const documento = String(dados.cnpj || dados.responsavel_cpf || "");
    aplicar.disabled = true;
    result.className = "oricse-promo-result";
    result.textContent = "Validando código...";
    const { data, error } = await (supabase as any).rpc("oricse_validar_codigo_promocional", { p_codigo: codigo, p_plano_codigo: plano, p_documento: documento, p_valor_base: total });
    aplicar.disabled = false;
    if (error || !data?.valido) {
      salvarPromoAplicado(null);
      result.className = "oricse-promo-result err";
      result.textContent = error?.message || data?.mensagem || "Código inválido.";
      return;
    }
    const promo: PromoAplicado = { codigo: data.codigo, plano, valor_original: Number(data.valor_original), desconto_aplicado: Number(data.desconto_aplicado), valor_final: Number(data.valor_final), duracao: String(data.duracao || "primeiro_mes") };
    salvarPromoAplicado(promo);
    input.value = promo.codigo;
    result.className = "oricse-promo-result ok";
    result.textContent = `Código ${promo.codigo} aplicado: −${brl(promo.desconto_aplicado)} · Total com desconto: ${brl(promo.valor_final)}${promo.duracao === "recorrente" ? " · desconto recorrente" : " · somente no primeiro mês"}`;
    if (!box.querySelector("[data-remove]")) {
      const remover = document.createElement("button");
      remover.type = "button"; remover.className = "oricse-promo-btn secondary"; remover.dataset.remove = "1"; remover.textContent = "Remover";
      box.querySelector(".oricse-promo-line")?.appendChild(remover);
      remover.addEventListener("click", () => { salvarPromoAplicado(null); input.value = ""; result.textContent = ""; remover.remove(); });
    }
  });
  box.querySelector<HTMLButtonElement>("[data-remove]")?.addEventListener("click", (ev) => { salvarPromoAplicado(null); input.value = ""; result.textContent = ""; (ev.currentTarget as HTMLElement).remove(); });
}

function varrer() {
  estiloBase();
  garantirAdmin();
  garantirCheckout();
  if (location.pathname !== "/admin") document.getElementById(ADMIN_ID)?.remove();
  if (location.pathname !== "/contratar") document.getElementById(CHECKOUT_ID)?.remove();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  instalarInterceptadorRpc();
  const iniciar = () => {
    varrer();
    const observer = new MutationObserver(() => varrer());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", varrer);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true }); else iniciar();
}

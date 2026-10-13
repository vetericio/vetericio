import { supabase } from "@/integrations/supabase/client";

type PlanoPreco = { nome: string; preco?: string | null; preco_mensal?: string | null; preco_anual?: string | null };

let cache = new Map<string, PlanoPreco>();
let carregando = false;

function texto(el: Element | null) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function ehAdminPlanos() {
  return window.location.pathname === "/admin" && document.body.textContent?.includes("Planos da Oricse");
}

async function carregarPrecos() {
  if (carregando) return;
  carregando = true;
  try {
    const { data, error } = await (supabase as any)
      .from("oricse_planos")
      .select("nome,preco,preco_mensal,preco_anual");
    if (error) throw error;
    cache = new Map((data || []).map((p: PlanoPreco) => [p.nome, p]));
  } catch (error) {
    console.warn("Não foi possível carregar os valores anual/mensal dos planos:", error);
  } finally {
    carregando = false;
  }
}

function cardsDePlano() {
  return Array.from(document.querySelectorAll<HTMLElement>("section")).filter((section) => {
    const t = texto(section);
    return t.includes("Publicado") && t.includes("Remover") && section.querySelector("h3") && section.querySelector("input");
  });
}

function localizarCampoMensal(card: HTMLElement) {
  return Array.from(card.querySelectorAll<HTMLLabelElement>("label")).find((label) => {
    const t = texto(label);
    return t.startsWith("Preço / condição") || t.startsWith("Preço mensal");
  }) || null;
}

function prepararCard(card: HTMLElement) {
  const nome = texto(card.querySelector("h3"));
  if (!nome) return;

  const labelMensal = localizarCampoMensal(card);
  const inputMensal = labelMensal?.querySelector<HTMLInputElement>("input") || null;
  if (!labelMensal || !inputMensal) return;

  const gratis = /gr[áa]tis|teste/i.test(nome) || /gr[áa]tis/i.test(inputMensal.value);
  if (gratis) {
    const existente = card.querySelector<HTMLElement>("[data-oricse-preco-anual]");
    existente?.remove();
    return;
  }

  const noTexto = Array.from(labelMensal.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (noTexto) noTexto.textContent = "Preço mensal";

  if (card.querySelector("[data-oricse-preco-anual]")) return;

  const plano = cache.get(nome);
  const labelAnual = document.createElement("label");
  labelAnual.className = labelMensal.className;
  labelAnual.dataset.oricsePrecoAnual = "1";
  labelAnual.append("Preço anual");

  const inputAnual = document.createElement("input");
  inputAnual.type = "text";
  inputAnual.value = plano?.preco_anual || "";
  inputAnual.placeholder = "Ex.: R$ 499,00";
  inputAnual.className = inputMensal.className;
  inputAnual.dataset.oricsePrecoAnualInput = "1";
  labelAnual.appendChild(inputAnual);

  labelMensal.insertAdjacentElement("afterend", labelAnual);
}

async function salvarPrecosExtras() {
  const atualizacoes = cardsDePlano().map((card) => {
    const nome = texto(card.querySelector("h3"));
    const mensal = localizarCampoMensal(card)?.querySelector<HTMLInputElement>("input")?.value.trim() || "";
    const anual = card.querySelector<HTMLInputElement>("[data-oricse-preco-anual-input]")?.value.trim() || "";
    const gratis = /gr[áa]tis|teste/i.test(nome) || /gr[áa]tis/i.test(mensal);
    return { nome, mensal, anual, gratis };
  }).filter((p) => p.nome);

  for (const p of atualizacoes) {
    const valores = p.gratis
      ? { preco: p.mensal, preco_mensal: p.mensal, preco_anual: null }
      : { preco: p.mensal, preco_mensal: p.mensal, preco_anual: p.anual || null };
    const { error } = await (supabase as any).from("oricse_planos").update(valores).eq("nome", p.nome);
    if (error) console.error(`Falha ao salvar preços do plano ${p.nome}:`, error);
  }
  await carregarPrecos();
}

function prepararBotaoSalvar() {
  const botoes = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const botao = botoes.find((b) => texto(b) === "Salvar" && b.closest("main"));
  if (!botao || botao.dataset.oricsePrecosConfigurado === "1") return;
  botao.dataset.oricsePrecosConfigurado = "1";
  botao.addEventListener("click", () => {
    window.setTimeout(() => void salvarPrecosExtras(), 350);
  });
}

async function varrer() {
  if (!ehAdminPlanos()) return;
  if (!cache.size) await carregarPrecos();
  cardsDePlano().forEach(prepararCard);
  prepararBotaoSalvar();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const iniciar = () => {
    void varrer();
    const observer = new MutationObserver(() => void varrer());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
}

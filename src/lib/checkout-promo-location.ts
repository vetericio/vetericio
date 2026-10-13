import { supabase } from "@/integrations/supabase/client";

const BOX_ID = "oricse-promo-checkout";
const STORAGE_KEY = "oricse-promo-aplicado-v1";

type PromoAplicado = {
  codigo: string;
  plano: string;
  valor_original: number;
  desconto_aplicado: number;
  valor_final: number;
  duracao: string;
};

function texto(el: Element | null) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function brl(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function lerAplicado(): PromoAplicado | null {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function salvarAplicado(valor: PromoAplicado | null) {
  if (valor) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(valor));
  else sessionStorage.removeItem(STORAGE_KEY);
}

function dadosContratacao() {
  try {
    return JSON.parse(localStorage.getItem("oricse-contratacao") || "{}");
  } catch {
    return {};
  }
}

function parseValor(textoValor: string) {
  const achou = textoValor.match(/R\$\s*([\d.]+,\d{2})/i);
  if (!achou) return 0;
  return Number(achou[1].replace(/\./g, "").replace(",", ".")) || 0;
}

function acharTotal(section: Element) {
  const candidatos = [...section.querySelectorAll("p,div,span,strong")];
  const total = candidatos.find((el) => /^Total\s*:/i.test(texto(el)));
  return total ? parseValor(texto(total)) : 0;
}

function criarBox(plano: string, section: Element) {
  const box = document.createElement("div");
  box.id = BOX_ID;
  box.className = "oricse-promo-checkout";
  box.style.margin = "18px 0";

  const salvo = lerAplicado();
  if (salvo && salvo.plano !== plano) salvarAplicado(null);
  const aplicado = salvo?.plano === plano ? salvo : null;

  box.innerHTML = `
    <div class="oricse-promo-title" style="font-size:.95rem">Tenho um código promocional</div>
    <div class="oricse-promo-sub">Se você tiver um código, digite aqui antes de ir para o pagamento.</div>
    <div class="oricse-promo-line" style="margin-top:10px">
      <input data-code placeholder="DIGITE SEU CÓDIGO" value="${aplicado?.codigo || ""}" />
      <button type="button" class="oricse-promo-btn" data-apply>Aplicar</button>
      ${aplicado ? '<button type="button" class="oricse-promo-btn secondary" data-remove>Remover</button>' : ""}
    </div>
    <div data-result class="oricse-promo-result ${aplicado ? "ok" : ""}">
      ${aplicado ? `<strong>Código ${aplicado.codigo} aplicado.</strong><br>Valor original: ${brl(aplicado.valor_original)} · Desconto: −${brl(aplicado.desconto_aplicado)} · <strong>Novo total: ${brl(aplicado.valor_final)}</strong>${aplicado.duracao === "recorrente" ? " · desconto recorrente" : " · desconto no primeiro período"}` : ""}
    </div>
  `;

  const input = box.querySelector<HTMLInputElement>("[data-code]")!;
  const aplicar = box.querySelector<HTMLButtonElement>("[data-apply]")!;
  const result = box.querySelector<HTMLElement>("[data-result]")!;

  function ligarRemover() {
    const remover = box.querySelector<HTMLButtonElement>("[data-remove]");
    if (!remover || remover.dataset.bound === "1") return;
    remover.dataset.bound = "1";
    remover.addEventListener("click", () => {
      salvarAplicado(null);
      input.value = "";
      result.className = "oricse-promo-result";
      result.textContent = "";
      remover.remove();
    });
  }

  ligarRemover();

  aplicar.addEventListener("click", async () => {
    const codigo = input.value.trim().toUpperCase().replace(/\s+/g, "-");
    if (!codigo) return;

    const total = acharTotal(section);
    if (total <= 0) {
      result.className = "oricse-promo-result err";
      result.textContent = "Não foi possível identificar o valor da contratação.";
      return;
    }

    const dados = dadosContratacao();
    const documento = String(dados.cnpj || dados.responsavel_cpf || "");
    aplicar.disabled = true;
    result.className = "oricse-promo-result";
    result.textContent = "Validando código...";

    const { data, error } = await (supabase as any).rpc("oricse_validar_codigo_promocional", {
      p_codigo: codigo,
      p_plano_codigo: plano,
      p_documento: documento,
      p_valor_base: total,
    });

    aplicar.disabled = false;
    if (error || !data?.valido) {
      salvarAplicado(null);
      result.className = "oricse-promo-result err";
      result.textContent = error?.message || data?.mensagem || "Código inválido.";
      return;
    }

    const promo: PromoAplicado = {
      codigo: String(data.codigo || codigo),
      plano,
      valor_original: Number(data.valor_original || total),
      desconto_aplicado: Number(data.desconto_aplicado || 0),
      valor_final: Number(data.valor_final || total),
      duracao: String(data.duracao || "primeiro_mes"),
    };

    salvarAplicado(promo);
    input.value = promo.codigo;
    result.className = "oricse-promo-result ok";
    result.innerHTML = `<strong>Código ${promo.codigo} aplicado.</strong><br>Valor original: ${brl(promo.valor_original)} · Desconto: −${brl(promo.desconto_aplicado)} · <strong>Novo total: ${brl(promo.valor_final)}</strong>${promo.duracao === "recorrente" ? " · desconto recorrente" : " · desconto no primeiro período"}`;

    if (!box.querySelector("[data-remove]")) {
      const remover = document.createElement("button");
      remover.type = "button";
      remover.className = "oricse-promo-btn secondary";
      remover.dataset.remove = "1";
      remover.textContent = "Remover";
      box.querySelector(".oricse-promo-line")?.appendChild(remover);
    }
    ligarRemover();
  });

  return box;
}

function posicionarCupom() {
  if (location.pathname !== "/contratar") return;
  const params = new URLSearchParams(location.search);
  const plano = params.get("plano") || "essencial";
  if (plano === "teste-gratis") {
    document.getElementById(BOX_ID)?.remove();
    return;
  }

  const labels = [...document.querySelectorAll("label")];
  const termos = labels.find((label) => texto(label).includes("Termos de Uso"));
  if (!termos) return;
  const section = termos.closest("section");
  if (!section) return;

  let box = document.getElementById(BOX_ID) as HTMLElement | null;
  if (!box) box = criarBox(plano, section);

  // O cupom deve ficar dentro da etapa de revisão, imediatamente antes dos termos.
  if (box.parentElement !== termos.parentElement || box.nextElementSibling !== termos) {
    termos.parentElement?.insertBefore(box, termos);
  }
  box.style.display = "block";
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const iniciar = () => {
    posicionarCupom();
    const observer = new MutationObserver(() => posicionarCupom());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", posicionarCupom);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
}

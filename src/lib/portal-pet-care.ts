export type FonteCuidados = "carregando" | "completa" | "parcial" | "indisponivel";

type Pet = { id: string; nome: string };
type Registro = { id: string; animal_id: string; nome: string; realizado: string | null; proximo: string | null };
type Comanda = { id: string; animal_id: string; saldo: number };

export type PendenciaPet = {
  id: string;
  animal: Pet;
  secao: "vacinas" | "vermifugos" | "comanda";
  status: "Atrasado" | "Hoje" | "Nos próximos 15 dias" | "Em aberto" | "Sem informação";
  titulo: string;
  data?: string;
  saldo?: number;
};

function dia(valor: string | null) {
  const data = valor?.match(/^\d{4}-\d{2}-\d{2}(?=$|T)/)?.[0];
  if (!data) return undefined;
  const convertido = new Date(data + "T12:00:00Z");
  return Number.isNaN(convertido.getTime()) || convertido.toISOString().slice(0, 10) !== data ? undefined : data;
}

export function pendenciasDosPets(
  pets: Pet[],
  vacinas: Registro[],
  vermifugos: Registro[],
  comandas: Comanda[],
  fontes: { vacinas: FonteCuidados; vermifugos: FonteCuidados },
  hoje: string,
): PendenciaPet[] {
  const pendencias: PendenciaPet[] = [];
  const limite = new Date(`${hoje}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 15);
  const ate = limite.toISOString().slice(0, 10);

  for (const animal of pets) {
    for (const [secao, registros, nome] of [
      ["vacinas", vacinas, "vacinação"],
      ["vermifugos", vermifugos, "vermífugo"],
    ] as const) {
      const doPet = registros.filter(registro => registro.animal_id === animal.id);
      if (!doPet.length && fontes[secao] === "completa") {
        pendencias.push({ id: animal.id + secao, animal, secao, status: "Sem informação", titulo: `Sem registro de ${nome} no portal` });
      }

      const ultimos = new Map<string, Registro>();
      for (const registro of doPet) {
        const chave = registro.nome.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
        const anterior = ultimos.get(chave);
        if (!anterior || (dia(registro.realizado) || "") > (dia(anterior.realizado) || "") ||
          (dia(registro.realizado) === dia(anterior.realizado) && (dia(registro.proximo) || "") > (dia(anterior.proximo) || ""))) {
          ultimos.set(chave, registro);
        }
      }

      for (const registro of ultimos.values()) {
        const data = dia(registro.proximo);
        const proximo = secao === "vacinas" ? "Reforço" : "Próxima dose";
        if (!data && fontes[secao] === "completa") {
          pendencias.push({ id: secao + registro.id, animal, secao, status: "Sem informação", titulo: `${proximo} sem data · ${registro.nome}` });
        } else if (data && data <= ate) {
          pendencias.push({
            id: secao + registro.id, animal, secao, data,
            status: data < hoje ? "Atrasado" : data === hoje ? "Hoje" : "Nos próximos 15 dias",
            titulo: `${proximo} · ${registro.nome}`,
          });
        }
      }
    }

    const saldo = comandas.filter(comanda => comanda.animal_id === animal.id)
      .reduce((soma, comanda) => soma + Math.max(Number(comanda.saldo) || 0, 0), 0);
    if (saldo > 0) pendencias.push({
      id: animal.id + "comanda", animal, secao: "comanda", status: "Em aberto", titulo: "Saldo em aberto", saldo,
    });
  }

  const ordem = { Atrasado: 0, Hoje: 1, "Nos próximos 15 dias": 2, "Em aberto": 3, "Sem informação": 4 };
  return pendencias.sort((a, b) => ordem[a.status] - ordem[b.status] ||
    (a.data || "").localeCompare(b.data || "") || a.animal.nome.localeCompare(b.animal.nome, "pt-BR"));
}

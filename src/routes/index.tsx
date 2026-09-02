import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calculadora } from "@/components/Calculadora";
import { FerramentasClinicas } from "@/components/FerramentasClinicas";
import { FormAvaliacao } from "@/components/FormAvaliacao";
import { InstalarApp } from "@/components/InstalarApp";
import { useRegistros } from "@/hooks/useRegistros";
import { useCurvas } from "@/hooks/useCurvas";
import { definirAlarmes } from "@/hooks/useAlarmes";
import { criarAlarme, horaDe, horaDeAgoraMais } from "@/lib/alarmes";
import { chaveDoAnimal, type Curva } from "@/lib/curva";
import {
  REGISTRO_VAZIO,
  chaveAnimal,
  comLinha,
  fraseAtualizacao,
  mesclarValores,
  proximoNomeDuplicado,
  type ChaveNumerica,
  type Registro,
} from "@/lib/ficha";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veterício — Ficha de Avaliação da Internação" },
      {
        name: "description",
        content:
          "App offline da Veterício para registrar avaliações de internação: alimentação, comportamento, mucosas, sinais vitais, taxa de infusão e exportação em texto.",
      },
      { property: "og:title", content: "Veterício — Ficha de Avaliação da Internação" },
      {
        property: "og:description",
        content:
          "Registre avaliações de animais internados offline e exporte todos os dados em texto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const NUMS: ChaveNumerica[] = ["temperatura", "fc", "fr", "pas", "glicemia"];
const CATEGORIAS = ["alimentacao", "comportamento", "fezes", "mucosas", "urina", "vomito"] as const;

/** Acrescenta a nova informação ao registro existente, mantendo os dois valores. */
function mesclarAvaliacao(base: Registro, novos: Omit<Registro, "id">): Registro {
  const resultado: Registro = { ...base };
  let obs = base.observacoes;

  for (const chave of NUMS) {
    const novo = novos[chave].trim();
    if (!novo) continue;
    resultado[chave] = mesclarValores(base[chave], novo);
    obs = comLinha(obs, fraseAtualizacao(chave, novo));
  }
  for (const chave of CATEGORIAS) {
    const novo = novos[chave].trim();
    if (novo) resultado[chave] = mesclarValores(base[chave], novo);
  }

  const extra = novos.observacoes.trim();
  if (extra) obs = comLinha(obs, extra);
  resultado.observacoes = obs;
  return resultado;
}

function Index() {
  const { registros, setRegistros, carregado } = useRegistros();
  const [form, setForm] = useState<Omit<Registro, "id">>(REGISTRO_VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [anterior, setAnterior] = useState<Registro | null>(null);
  const [duplicado, setDuplicado] = useState<Registro | null>(null);
  const [fazerCurva, setFazerCurva] = useState(false);
  const { setCurvas } = useCurvas();

  const navigate = useNavigate();

  // Abre em modo edição ou atualização quando vem da página de registros.
  useEffect(() => {
    if (!carregado) return;
    const idEditar = window.localStorage.getItem("veterico-editar-id");
    const idAtualizar = window.localStorage.getItem("veterico-atualizar-id");
    window.localStorage.removeItem("veterico-editar-id");
    window.localStorage.removeItem("veterico-atualizar-id");

    if (idEditar) {
      const alvo = registros.find((r) => r.id === idEditar);
      if (alvo) {
        const { id: _ignorado, ...resto } = alvo;
        setForm(resto);
        setEditandoId(idEditar);
      }
      return;
    }
    if (idAtualizar) {
      const alvo = registros.find((r) => r.id === idAtualizar);
      if (alvo) {
        setAnterior(alvo);
        setForm({ ...REGISTRO_VAZIO, animal: alvo.animal, especie: alvo.especie ?? "" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado]);

  const limpar = () => {
    setEditandoId(null);
    setAnterior(null);
    setForm(REGISTRO_VAZIO);
    setDuplicado(null);
  };

  /** Cria a curva glicêmica do animal (a cada 2h) e o alarme correspondente. */
  const iniciarCurvaGlicemica = (r: Registro) => {
    const id = crypto.randomUUID();
    const intervalo = 2;
    const proximo = horaDeAgoraMais(intervalo);
    const alarme = criarAlarme({
      rotulo: `Curva ${r.animal.trim()} — glicemia`,
      hora: horaDe(proximo),
      toque: "urgente",
      intervaloHoras: intervalo,
      curvaId: id,
    });
    alarme.proximo = proximo.toISOString();
    definirAlarmes((lista) => [...lista, alarme]);

    const curva: Curva = {
      id,
      chave: chaveDoAnimal(r.animal, r.especie),
      animal: r.animal.trim(),
      especie: (r.especie ?? "") as Curva["especie"],
      parametros: ["glicemia"],
      intervaloHoras: intervalo,
      ativa: true,
      criadoEm: new Date().toISOString(),
      alarmeId: alarme.id,
      medicoes: r.glicemia.trim()
        ? [
            {
              id: crypto.randomUUID(),
              em: new Date().toISOString(),
              glicemia: r.glicemia.trim(),
              pas: "",
            },
          ]
        : [],
    };
    setCurvas((lista) => [curva, ...lista]);
  };

  const salvar = (valores: Omit<Registro, "id">) => {
    if (anterior) {
      const atualizado = mesclarAvaliacao(anterior, valores);
      setRegistros((rs) =>
        rs.map((r) =>
          r.id === anterior.id ? { ...atualizado, atualizadoEm: new Date().toISOString() } : r,
        ),
      );
      limpar();
      toast.success("Informações acrescentadas.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      navigate({ to: "/" });
      return;
    }
    if (editandoId) {
      setRegistros((rs) =>
        rs.map((r) =>
          r.id === editandoId
            ? {
                ...valores,
                id: editandoId,
                ...(r.plantaoId ? { plantaoId: r.plantaoId } : {}),
                atualizadoEm: new Date().toISOString(),
              }
            : r,
        ),
      );
      setEditandoId(null);
      toast.success("Registro atualizado.");
    } else {
      const novo: Registro = {
        ...valores,
        criadoEm: new Date().toISOString(),
        id: crypto.randomUUID(),
      };
      setRegistros((rs) => [...rs, novo]);
      if (fazerCurva) iniciarCurvaGlicemica(novo);
      setForm(REGISTRO_VAZIO);
      setFazerCurva(false);
      setDuplicado(null);
      // Recarrega o início: formulário limpo e total do cabeçalho atualizado.
      window.location.assign("/");
      return;
    }
    setForm(REGISTRO_VAZIO);
    setDuplicado(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    navigate({ to: "/" });
  };

  const enviar = () => {
    if (!form.animal.trim()) {
      toast.error("Informe o nome do animal.");
      return;
    }
    if (!editandoId && !anterior) {
      const chave = chaveAnimal(form);
      const existente = registros.find((r) => chaveAnimal(r) === chave);
      if (existente) {
        setDuplicado(existente);
        return;
      }
    }
    salvar(form);
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5">
      <section className="grid grid-cols-2 items-stretch gap-2 sm:gap-3">
        <div className="min-w-0">
          <Calculadora />
        </div>
        <FerramentasClinicas />
      </section>

      <div className="mt-5">
        <FormAvaliacao
          valores={form}
          onChange={setForm}
          onEnviar={enviar}
          editando={Boolean(editandoId)}
          anterior={anterior}
          fazerCurva={fazerCurva}
          onFazerCurva={setFazerCurva}
          onCancelar={limpar}
        />
      </div>

      <div className="mt-8">
        <InstalarApp />
      </div>

      <AlertDialog open={Boolean(duplicado)} onOpenChange={(o) => !o && setDuplicado(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>É o mesmo animal?</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe{" "}
              <strong>
                {duplicado?.animal.trim()}
                {duplicado?.especie ? ` (${duplicado.especie})` : ""}
              </strong>{" "}
              na lista. Se for o mesmo animal, esta avaliação entra na evolução dele. Se for outro,
              ele é salvo com um número depois do nome.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() =>
                salvar({
                  ...form,
                  animal: proximoNomeDuplicado(form.animal, registros),
                })
              }
            >
              Não, é outro animal
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => salvar(form)}>Sim, é o mesmo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

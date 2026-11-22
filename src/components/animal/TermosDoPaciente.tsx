import { FileCheck2, FileClock, FilePenLine, FilePlus2, ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BIBLIOTECA_TERMOS } from "@/lib/termos-clinicos-validacao";
import { TERMOS_CLINICOS_HOMOLOGADOS } from "@/lib/termos-clinicos-status";

type Documento = { id: string; titulo: string; driveArquivoId?: string | null; data: string };

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function TermosDoPaciente({
  animalId, tutorId, documentos, gerados, conferenciaCompleta, onAnexar,
}: {
  animalId: string;
  tutorId: string;
  documentos: Documento[];
  gerados: { documentoId: string; codigoTermo: string | null; geradoPeloOricse: boolean }[];
  conferenciaCompleta: boolean;
  onAnexar: (nome: string) => void;
}) {
  const emitidos = BIBLIOTECA_TERMOS.map((termo) => {
    const registros = documentos.filter((registro) =>
      [termo.nome, termo.titulo].some(nome => normalizar(registro.titulo) === normalizar(nome)) ||
      gerados.some(info => info.documentoId === registro.id && info.codigoTermo === termo.id));
    return { termo, registros };
  });
  const anexados = emitidos.filter(item => item.registros.some(registro => Boolean(registro.driveArquivoId))).length;
  const oficialmenteGerados = BIBLIOTECA_TERMOS.filter(termo => gerados.some(info => info.codigoTermo === termo.id && info.geradoPeloOricse)).length;

  return <section className="mt-5 space-y-4" aria-label="Biblioteca de termos do paciente">
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold"><FileCheck2 className="text-primary" size={21} /> Termos do paciente</h2>
          <p className="mt-1 text-sm text-muted-foreground">14 modelos · {oficialmenteGerados} emitidos pelo ORICSE · {anexados} tipos com PDF anexado.</p>
        </div>
        <Link to="/termos" search={{ animalId, tutorId } as never}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
          <FilePenLine size={17} /> Preparar termo
        </Link>
      </div>
      {!conferenciaCompleta && <p className="mt-3 text-xs text-muted-foreground">A conferência da origem de algumas emissões ainda não está completa.</p>}
      {!TERMOS_CLINICOS_HOMOLOGADOS && <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <ShieldAlert size={18} className="mt-0.5 shrink-0" />
        Os 14 modelos estão em revisão e ainda não podem ser emitidos como termos clínicos oficiais. É possível preencher e visualizar uma prévia demonstrativa. PDFs já existentes podem ser anexados ao prontuário como arquivos independentes, sem homologar o modelo.
      </p>}
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {emitidos.map(({ termo, registros }) => {
        const comPdf = registros.filter(registro => Boolean(registro.driveArquivoId));
        const emitidoNoSistema = gerados.some(info => info.codigoTermo === termo.id && info.geradoPeloOricse);
        const status = emitidoNoSistema ? "Gerado e registrado no ORICSE" : comPdf.length ? "PDF anexado · emissão pelo ORICSE não confirmada" : registros.length ? "Registrado sem PDF" : "Ainda não gerado ou anexado";
        return <article key={termo.id} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            {comPdf.length ? <FileCheck2 size={20} className="mt-0.5 shrink-0 text-emerald-700" />
              : <FileClock size={20} className="mt-0.5 shrink-0 text-muted-foreground" />}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{termo.nome}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{status}{registros.length ? " · " + registros.length + " registro(s)" : ""}</p>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <Link to="/termos" search={{ animalId, tutorId, termo: termo.id } as never}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted">
              <FilePenLine size={15} /> Preencher e conferir
            </Link>
            <button type="button" onClick={() => onAnexar(termo.nome)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted">
              <FilePlus2 size={15} /> Anexar PDF
            </button>
          </div>
        </article>;
      })}
    </div>
    {documentos.some(d => !BIBLIOTECA_TERMOS.some(t => [t.nome, t.titulo].some(n => normalizar(n) === normalizar(d.titulo)))) &&
      <p className="text-xs text-muted-foreground">
        Outros termos anexados, com nomes diferentes dos modelos, continuam disponíveis na lista abaixo.
      </p>}
  </section>;
}

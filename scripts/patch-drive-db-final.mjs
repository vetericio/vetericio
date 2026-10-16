import fs from 'node:fs';
const p='src/lib/drive-db.functions.ts';
let s=fs.readFileSync(p,'utf8');

s=s.replace('const PORTAL_DIRECT_WRITE = new Set<string>();','const PORTAL_DIRECT_WRITE = new Set<string>(["tutores", "oricse_agendamentos_online"]);');
s=s.replace('if (!a) { const rows = seedTabela(table); if (rows.length) await writeTable(t, table, f, null, rows); return { folderId: f, fileId: null as string | null, rows }; }','if (!a) { const rows = seedTabela(table); if (rows.length) { await writeTable(t, table, f, null, rows); const criado = await findFile(t, f, `${table}.json`); return { folderId: f, fileId: criado?.id || null, rows }; } return { folderId: f, fileId: null as string | null, rows }; }');

// Limpa repetições criadas por execuções anteriores do patch.
s=s.replace(/(?:    if \(table === "tutores"\) return portalTutors\.has\(String\(r\.id\)\);\n)+/g,'    if (table === "tutores") return portalTutors.has(String(r.id));\n');
if(!s.includes('if (table === "tutores") return portalTutors.has(String(r.id));')){
  s=s.replace('if (table === "oricse_animais") return portalTutors.has(String(r.tutor_id));','if (table === "tutores") return portalTutors.has(String(r.id));\n    if (table === "oricse_animais") return portalTutors.has(String(r.tutor_id));');
}

const blocoPortal=`  if (q.operation !== "select" && !ctx.admin && !ctx.clinicas.length && ctx.portal.length) {
    if (q.table === "tutores" && q.operation !== "update") throw new Error("O Portal do Tutor pode apenas atualizar o próprio cadastro.");
    if (q.table === "oricse_agendamentos_online" && q.operation !== "insert") throw new Error("O Portal do Tutor pode apenas criar agendamentos pelo fluxo autorizado.");
    if (q.table === "tutores") {
      const permitidos = new Set(ctx.portal.map((x) => x.tutorId));
      const alvo = q.filters.find((f) => f.kind === "eq" && f.column === "id")?.value;
      if (!alvo || !permitidos.has(String(alvo))) throw new Error("Tutor fora do escopo desta sessão.");
    }
    if (q.table === "oricse_agendamentos_online") {
      const lista = Array.isArray(q.payload) ? q.payload : [q.payload];
      const animais = await animalIdsPortal(await driveToken(), ctx);
      for (const item of lista.filter(Boolean) as any[]) {
        const identidade = ctx.portal.find((x) => x.clinicaId === String(item.clinica_id) && x.tutorId === String(item.tutor_id));
        if (!identidade || !animais.has(String(item.animal_id)) || String(item.tutor_auth_id || "") !== String(ctx.userId || "") || String(item.origem || "") !== "portal_tutor") throw new Error("Agendamento fora do escopo autorizado do tutor.");
      }
    }
  }
`;
// Mantém exatamente uma cópia do bloco de validação do portal.
const escaped=blocoPortal.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
s=s.replace(new RegExp(`(?:${escaped})+`,'g'),blocoPortal);
const gate='  if (q.operation !== "select" && !ctx.admin && !ctx.clinicas.length && ctx.portal.length && !PORTAL_DIRECT_WRITE.has(q.table)) throw new Error("O Portal do Tutor não pode alterar esta tabela diretamente.");\n';
if(!s.includes('Agendamento fora do escopo autorizado do tutor.')) s=s.replace(gate,gate+blocoPortal);

s=s.replace('async function executeDriveDb(q: z.infer<typeof querySchema>) {','export async function executarDriveDbInterno(q: z.infer<typeof querySchema>) {');
s=s.replace('executeDriveDb(data));','executarDriveDbInterno(data));');
fs.writeFileSync(p,s);
console.log('Patch idempotente do Drive DB concluído.');

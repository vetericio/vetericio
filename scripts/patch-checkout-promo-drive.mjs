import fs from 'node:fs';
const p='src/routes/contratar.tsx';
let s=fs.readFileSync(p,'utf8');
const old='    const payload = { ...dados, plano_codigo: plano, ciclo, quantidade_usuarios: quantidadeUsuarios, perfis_inclusos: perfisIncluidos, perfis_extras: perfisExtras, adicional_perfis_mensal: adicionalMensal, adicional_perfis_ciclo: adicionalCiclo, valor_base: valorBase, valor_total: valorTotal, aceitou_termos: true, aceitou_privacidade: true };';
const replacement=`    let promoCodigo: string | null = null;
    try {
      const promo = JSON.parse(oricseSession.getItem("oricse-promo-aplicado-v1") || "null");
      if (promo?.plano === plano && promo?.codigo) promoCodigo = String(promo.codigo);
    } catch {}
    const payload = { ...dados, plano_codigo: plano, ciclo, quantidade_usuarios: quantidadeUsuarios, perfis_inclusos: perfisIncluidos, perfis_extras: perfisExtras, adicional_perfis_mensal: adicionalMensal, adicional_perfis_ciclo: adicionalCiclo, valor_base: valorBase, valor_total: valorTotal, promo_codigo: promoCodigo, aceitou_termos: true, aceitou_privacidade: true };`;
if(!s.includes(old)) throw new Error('payload do checkout não encontrado');
s=s.replace(old,replacement);
fs.writeFileSync(p,s);
console.log('Checkout agora envia apenas o código promocional; valores são recalculados no backend Drive.');

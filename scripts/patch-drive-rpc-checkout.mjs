import fs from 'node:fs';
const p='src/lib/drive-rpc.ts';
let s=fs.readFileSync(p,'utf8');
if(!s.includes('case "oricse_iniciar_contratacao"')){
  const alvo='        case "oricse_validar_codigo_promocional": {';
  const bloco=`        case "oricse_iniciar_contratacao": {\n          const { iniciarContratacaoDrive } = await import("@/lib/checkout-drive.functions");\n          const data = await iniciarContratacaoDrive({ data: { dados: args.p_dados || {} } } as never);\n          return { data, error: null };\n        }\n        case "oricse_iniciar_teste_gratis": {\n          const { iniciarTesteGratisDrive } = await import("@/lib/checkout-drive.functions");\n          const data = await iniciarTesteGratisDrive({ data: { dados: args.p_dados || {} } } as never);\n          return { data, error: null };\n        }\n`;
  if(!s.includes(alvo))throw new Error('ponto de inserção não encontrado');
  s=s.replace(alvo,bloco+alvo);
}
fs.writeFileSync(p,s);
console.log('Checkout redirecionado para Drive.');

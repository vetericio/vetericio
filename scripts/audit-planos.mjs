import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(relative) { return fs.readFileSync(path.join(root,relative),"utf8"); }
function filesRecursively(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry => {
    const file = path.join(dir,entry.name);
    return entry.isDirectory()?filesRecursively(file):[file];
  });
}
const routes = filesRecursively(path.join(root,"src/routes")).filter(file=>/\.(ts|tsx)$/.test(file));
const components = filesRecursively(path.join(root,"src/components")).filter(file=>/\.tsx$/.test(file));
const serverFns = filesRecursively(path.join(root,"src/lib")).filter(file=>file.endsWith(".functions.ts"));
const source = [...routes,...components,...serverFns];
const hook = read("src/hooks/usePermissoes.ts");
const seed = read("src/lib/drive-seed.ts");
const routeMap = new Set([...hook.matchAll(/"\/(?:[a-z0-9-]+)?"\s*:\s*\[/g)].map(m=>m[0].split('"')[1]));
const declaredRoutes = [...new Set(routes.flatMap(file =>
  [...fs.readFileSync(file,"utf8").matchAll(/createFileRoute\(\s*["'`](\/[^"'`]+)["'`]\s*\)/g)].map(m=>m[1])
))].sort();
const publicRoutes = new Set(["/","/index","/login","/planos","/precos-portal","/contratar",
  "/privacidade","/termos-de-uso","/simulador-pagamentos"]);
const withoutGate = declaredRoutes.filter(route=>!routeMap.has(route) && !publicRoutes.has(route));
const permBlock = seed.split("const PERMISSOES = [")[1]?.split("] as const;")[0] || "";
const permissions = [...new Set([...permBlock.matchAll(/^\s*\["([a-z0-9._-]+)"/gm)].map(m=>m[1]))];
const baseBlock = seed.split("export const FUNCIONALIDADES_PADRAO = [")[1]?.split("].map(")[0] || "";
const bases = [...new Set([...baseBlock.matchAll(/\["([a-z0-9._-]+)","/g)].map(m=>m[1]))];
const usesActions = read("src/lib/drive-rpc.ts").includes('planoPermite(`acao.${p.codigo}`)');
const pageHasMatrix = read("src/routes/admin-planos.tsx").includes("FragmentoGrupo");
const hasAuditHistory = read("src/routes/admin-planos.tsx").includes("oricse_planos_auditoria");
const clinicPage = read("src/routes/plano-clinica.tsx");
const menu = read("src/components/MenuLateral.tsx");
const generalAdmin = read("src/routes/admin.tsx");
const driveDb = read("src/lib/drive-db.functions.ts");
const driveRpc = read("src/lib/drive-rpc.ts");
const hasTeamPermissionsPath = menu.includes('to: "/permissoes-equipe"') &&
  read("src/hooks/usePermissoes.ts").includes('"/permissoes-equipe"') &&
  read("src/routes/permissoes-equipe.tsx").includes("UserPermissionsPanel");
const hasWritePlanGuards = driveDb.includes("const permissoesEscrita:") &&
  driveDb.includes("matrizA") && driveDb.includes("baseOk && acaoOk && papelOk") &&
  driveDb.includes("oricse_hotel_estadias");
const hasClinicAdminLink = menu.includes('to: "/plano-clinica"') &&
  read("src/routes/perfil-clinica.tsx").includes('to="/plano-clinica"');
const hasGeneralAdminLink = generalAdmin.includes('to="/admin-planos"');
const hasAuthorizedClinicSummary = clinicPage.includes('oricse_plano_resumo_clinica') &&
  driveRpc.includes('case "oricse_plano_resumo_clinica"') &&
  driveRpc.includes("Somente a administração da clínica");
const hasServerPlanExceptionGuard = driveDb.includes('"oricse_clinica_funcionalidade_excecoes"') &&
  driveDb.includes('"oricse_permissoes_papel"') &&
  driveDb.includes('gestores.has(cid)');
const newPermissionsDefaultDenied = read("src/lib/drive-seed.ts").includes("ACOES_LEGADAS.has");
const newActionsDefaultDenied = read("src/routes/admin-planos.tsx").includes('item.catalogada;');
const handlers = source.reduce((sum,file)=>sum+[...fs.readFileSync(file,"utf8").matchAll(/\bonClick\s*=|\bonSubmit\s*=|\bcreateServerFn\(/g)].length,0);
const result = {
  arquivos: { rotas:routes.length, componentes:components.length, funcoesServidor:serverFns.length },
  rotasDeclaradas:declaredRoutes.length,
  rotasSemMapeamentoExplicito:withoutGate,
  funcionalidadesBaseDoSeed:bases.length,
  permissoesDeAcaoDoSeed:permissions.length,
  elementosComAcaoOuFuncoesServidorAproximados:handlers,
  verificacoes:{
    autorizacaoGranularDrive:usesActions,matrizAdmin:pageHasMatrix,historicoAdmin:hasAuditHistory,
    menuAdminClinica:hasClinicAdminLink,menuAdminGeral:hasGeneralAdminLink,
    consultaDePlanoAutorizada:hasAuthorizedClinicSummary,
    protecaoExcecoesEPermissoes:hasServerPlanExceptionGuard,
    novasPermissoesBloqueadas:newPermissionsDefaultDenied && newActionsDefaultDenied,
    adminLocalEquipe:hasTeamPermissionsPath, escritaClinicaProtegida:hasWritePlanGuards,
  },
  observacoes:[
    "Contagem de handlers é estática e aproximada; não equivale a funções completas auditadas.",
    "Rotas dinâmicas e endpoints podem ter regras de acesso próprias fora do menu.",
    "A presença de uma ação na matriz não prova que todos os endpoints a validam."
  ],
};
console.log(JSON.stringify(result,null,2));
if (Object.values(result.verificacoes).some((value) => !value)) process.exitCode=1;

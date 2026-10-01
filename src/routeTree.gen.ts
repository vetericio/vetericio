/* eslint-disable */
// @ts-nocheck
// Generated route registry. Updated when routes are added.
// Deployment synchronization marker.

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AlarmesRouteImport } from './routes/alarmes'
import { Route as AnamneseRouteImport } from './routes/anamnese'
import { Route as AssinarRouteImport } from './routes/assinar'
import { Route as CurvaRouteImport } from './routes/curva'
import { Route as MedicacoesRouteImport } from './routes/medicacoes'
import { Route as PendenciasRouteImport } from './routes/pendencias'
import { Route as PlantoesRouteImport } from './routes/plantoes'
import { Route as ReceituarioRouteImport } from './routes/receituario'
import { Route as RegistrosRouteImport } from './routes/registros'
import { Route as SincronizacaoRouteImport } from './routes/sincronizacao'
import { Route as TemasRouteImport } from './routes/temas'

const makeRoute = (route: any, id: string) => route.update({ id, path: id, getParentRoute: () => rootRouteImport } as any)
const IndexRoute = makeRoute(IndexRouteImport, '/')
const AlarmesRoute = makeRoute(AlarmesRouteImport, '/alarmes')
const AnamneseRoute = makeRoute(AnamneseRouteImport, '/anamnese')
const AssinarRoute = makeRoute(AssinarRouteImport, '/assinar')
const CurvaRoute = makeRoute(CurvaRouteImport, '/curva')
const MedicacoesRoute = makeRoute(MedicacoesRouteImport, '/medicacoes')
const PendenciasRoute = makeRoute(PendenciasRouteImport, '/pendencias')
const PlantoesRoute = makeRoute(PlantoesRouteImport, '/plantoes')
const ReceituarioRoute = makeRoute(ReceituarioRouteImport, '/receituario')
const RegistrosRoute = makeRoute(RegistrosRouteImport, '/registros')
const SincronizacaoRoute = makeRoute(SincronizacaoRouteImport, '/sincronizacao')
const TemasRoute = makeRoute(TemasRouteImport, '/temas')

const rootRouteChildren = { IndexRoute, AlarmesRoute, AnamneseRoute, AssinarRoute, CurvaRoute, MedicacoesRoute, PendenciasRoute, PlantoesRoute, ReceituarioRoute, RegistrosRoute, SincronizacaoRoute, TemasRoute }
export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)

import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
    config: Awaited<ReturnType<typeof startInstance.getOptions>>
  }
}

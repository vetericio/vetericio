// Supabase fica restrito à autenticação e aos registros de usuários/vínculos.
import { createClient } from '@supabase/supabase-js';
import { brokeredPreviewStorage } from './previewAuthStorage';
import { createDriveFrom } from '@/lib/drive-db';
import { createDriveRpc } from '@/lib/drive-rpc';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) headers.delete('Authorization');
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL'] || 'https://mwrmfcyrdxfxssebgknz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'] || 'sb_publishable_Y5qsG-0F69poaQjUnWxGKw_8WOydkZc';

export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
export const supabaseMensagemConfiguracao = 'A conexão segura do sistema ainda não foi configurada. Tente novamente em alguns instantes.';

function createSupabaseClient(storageKey?: string) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error(supabaseMensagemConfiguracao);
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY) },
    auth: {
      storage: brokeredPreviewStorage(),
      ...(storageKey ? { storageKey } : {}),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;
let _supabasePortal: ReturnType<typeof createSupabaseClient> | undefined;
// Estas tabelas são identidade/associação de usuários. Todo dado operacional vai para o Drive.
const TABELAS_USUARIOS = new Set(['app_users', 'clinica_usuarios', 'oricse_portal_tutores']);

type PollChannel = { on: (...args: any[]) => PollChannel; subscribe: (...args: any[]) => PollChannel; unsubscribe: () => Promise<'ok'>; __timer?: ReturnType<typeof setInterval>; __callbacks: Array<() => void> };
const canais = new Set<PollChannel>();
function canalDrive(): PollChannel {
  const canal: PollChannel = {
    __callbacks: [],
    on: (...args: any[]) => { const cb = args.find((x) => typeof x === 'function'); if (cb) canal.__callbacks.push(cb); return canal; },
    subscribe: () => { if (!canal.__timer) canal.__timer = setInterval(() => canal.__callbacks.forEach((cb) => { try { cb(); } catch {} }), 5000); canais.add(canal); return canal; },
    unsubscribe: async () => { if (canal.__timer) clearInterval(canal.__timer); canais.delete(canal); return 'ok'; },
  };
  return canal;
}

function rotaDoPortalTutor() {
  if (typeof window === 'undefined') return false;
  return /^\/pet\/[^/]+\/portal\/?$/.test(window.location.pathname);
}
function clientePrincipal() { if (!_supabase) _supabase = createSupabaseClient(); return _supabase; }
function clientePortal() { if (!_supabasePortal) _supabasePortal = createSupabaseClient('oricse-portal-auth'); return _supabasePortal; }

function proxyPara(client: ReturnType<typeof createSupabaseClient>) {
  const fromDrive = createDriveFrom(async () => {
    const { data } = await client.auth.getSession();
    return data.session?.access_token || null;
  });
  const fromIdentity = (table: string) => {
    if (!TABELAS_USUARIOS.has(table)) throw new Error(`A tabela ${table} não pertence à camada de identidade do Supabase.`);
    return (client as any).from(table);
  };
  const rpcDrive = createDriveRpc({ auth: client.auth as any, fromDrive, fromIdentity });
  return new Proxy(client as any, {
    get(target, prop, receiver) {
      if (prop === 'from') return (table: string) => TABELAS_USUARIOS.has(table) ? target.from(table) : fromDrive(table);
      if (prop === 'rpc') return (name: string, args?: Record<string, unknown>) => rpcDrive(name, args || {});
      if (prop === 'storage') return new Proxy({}, { get() { throw new Error('Supabase Storage está desativado. Use o Google Drive.'); } });
      if (prop === 'channel') return () => canalDrive();
      if (prop === 'removeChannel') return async (channel: PollChannel) => channel.unsubscribe();
      if (prop === 'removeAllChannels') return async () => { await Promise.all([...canais].map((c) => c.unsubscribe())); return []; };
      return Reflect.get(target, prop, receiver);
    },
  });
}

let _proxyPrincipal: any;
let _proxyPortal: any;
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop) {
    const portal = rotaDoPortalTutor();
    if (portal) { if (!_proxyPortal) _proxyPortal = proxyPara(clientePortal()); return Reflect.get(_proxyPortal, prop); }
    if (!_proxyPrincipal) _proxyPrincipal = proxyPara(clientePrincipal());
    return Reflect.get(_proxyPrincipal, prop);
  },
});
export const supabasePortal = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop) { if (!_proxyPortal) _proxyPortal = proxyPara(clientePortal()); return Reflect.get(_proxyPortal, prop); },
});

/** Acesso direto às tabelas operacionais que já foram migradas ao PostgreSQL. */
export const supabaseBanco = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    return Reflect.get(rotaDoPortalTutor() ? clientePortal() : clientePrincipal(), prop, receiver);
  },
});

import {
  FUNCIONALIDADES_POR_PLANO,
  PERMISSOES_PADRAO,
  PERMITIDAS_POR_PAPEL,
  PLANOS_PADRAO,
} from "@/lib/drive-seed";
import { lerContextoAdminClinica } from "@/lib/admin-clinic-context";

type FromFn = (table: string) => any;
type AuthLike = {
  getSession: () => Promise<any>;
  getUser: () => Promise<any>;
};
type FactoryArgs = { auth: AuthLike; fromDrive: FromFn; fromIdentity: FromFn; getSelectedClinicId: () => Promise<string | null> };

function erro(message: string, code = "DRIVE_RPC") {
  return { message, code };
}
function normalizarUsuario(valor: unknown) {
  return String(valor ?? "")
    .trim()
    .replace(/^@+/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "");
}
function soHost(valor: unknown) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/^www\./, "")
    .split(":")[0];
}
function dataHojeSP() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function numero(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function uuid() {
  return crypto.randomUUID();
}
async function sha256Hex(valor: string) {
  const bytes = new TextEncoder().encode(valor);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function tokenAleatorio() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function minutosHora(hora: string) {
  const [h = "0", m = "0"] = String(hora || "00:00")
    .slice(0, 5)
    .split(":");
  return Number(h) * 60 + Number(m);
}
function hhmm(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function offsetMinutos(timeZone: string, data: string) {
  try {
    const base = new Date(`${data}T12:00:00Z`);
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(base);
    const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
    const localComoUtc = Date.UTC(
      Number(mapa.year),
      Number(mapa.month) - 1,
      Number(mapa.day),
      Number(mapa.hour) % 24,
      Number(mapa.minute),
    );
    return (localComoUtc - base.getTime()) / 60000;
  } catch {
    return -180;
  }
}
function localParaIso(data: string, hora: string, timeZone: string) {
  const [a, m, d] = data.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  return new Date(
    Date.UTC(a, (m || 1) - 1, d || 1, h || 0, min || 0) - offsetMinutos(timeZone, data) * 60000,
  ).toISOString();
}

export function createDriveRpc({ auth, fromDrive, fromIdentity, getSelectedClinicId }: FactoryArgs) {
  async function user() {
    const { data, error } = await auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }
  async function sessao() {
    const { data, error } = await auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }
  async function membership(userId?: string) {
    const u = userId || (await user())?.id;
    if (!u) return null;
    const { data, error } = await fromIdentity("clinica_usuarios")
      .select("clinica_id,user_id,papel,ativo,created_at")
      .eq("user_id", u)
      .eq("ativo", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }
  async function isPlatformAdmin() {
    const u = await user();
    if (!u) return false;
    const { data } = await fromIdentity("app_users")
      .select("role")
      .eq("user_id", u.id)
      .maybeSingle();
    return data?.role === "admin";
  }
  async function clinic(clinicaId: string) {
    const { data, error } = await fromDrive("clinicas")
      .select("*")
      .eq("id", clinicaId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }
  async function currentContext() {
    if (await isPlatformAdmin()) {
      const selecionado = lerContextoAdminClinica();
      // A escolha do administrador também está salva no servidor e sobrevive ao refresh.
      // Nunca selecionar automaticamente a primeira clínica disponível.
      const clinicaId = selecionado?.clinicaId || (await getSelectedClinicId());
      if (!clinicaId) return null;
      const c = await clinic(clinicaId);
      if (!c) return null;
      const u = await user();
      return {
        membership: {
          clinica_id: c.id,
          user_id: u?.id || null,
          papel: selecionado?.clinicaId === clinicaId ? selecionado.perfil : "admin",
          ativo: true,
        },
        clinic: c,
      };
    }
    const m = await membership();
    if (!m?.clinica_id) return null;
    const c = await clinic(m.clinica_id);
    if (!c) return null;
    return { membership: m, clinic: c };
  }
  async function planCode(c: any) {
    const plano = PLANOS_PADRAO.find((p) => p.codigo === c?.plano || p.nome === c?.plano);
    return plano?.codigo || String(c?.plano || "");
  }
  async function featureAllowed(clinicaId: string, codigo: string) {
    if (await isPlatformAdmin()) return true;
    const c = await clinic(clinicaId);
    if (!c || c.status !== "ativa") return false;
    const { data: ex } = await fromDrive("oricse_clinica_funcionalidade_excecoes")
      .select("permitido,expira_em")
      .eq("clinica_id", clinicaId)
      .eq("funcionalidade_codigo", codigo)
      .maybeSingle();
    if (ex && (!ex.expira_em || new Date(ex.expira_em).getTime() > Date.now()))
      return Boolean(ex.permitido);
    const pc = await planCode(c);
    return Boolean(FUNCIONALIDADES_POR_PLANO[pc]?.includes(codigo));
  }
  async function canManagePermissions(clinicaId: string) {
    if (await isPlatformAdmin()) return true;
    const u = await user();
    if (!u) return false;
    const { data } = await fromIdentity("clinica_usuarios")
      .select("papel,ativo")
      .eq("clinica_id", clinicaId)
      .eq("user_id", u.id)
      .eq("ativo", true)
      .maybeSingle();
    return ["responsavel", "admin_clinica", "rt"].includes(String(data?.papel || ""));
  }
  async function effectivePermissions(clinicaId: string, userId?: string) {
    const alvo = userId || (await user())?.id;
    if (!alvo) throw new Error("Sessão inválida.");
    const eu = (await user())?.id;
    if (alvo !== eu && !(await canManagePermissions(clinicaId)))
      throw new Error("Sem permissão para consultar este usuário.");
    const { data: vinculo, error } = await fromIdentity("clinica_usuarios")
      .select("papel,ativo")
      .eq("clinica_id", clinicaId)
      .eq("user_id", alvo)
      .eq("ativo", true)
      .maybeSingle();
    if (error) throw error;
    if (!vinculo) throw new Error("Usuário sem vínculo ativo com esta clínica.");
    const papel = String(vinculo.papel);
    const defaults = new Set(PERMITIDAS_POR_PAPEL[papel] || []);
    const { data: overrides } = await fromDrive("oricse_permissoes_usuario")
      .select("permissao_codigo,permitido")
      .eq("clinica_id", clinicaId)
      .eq("user_id", alvo);
    const mapa = new Map(
      (overrides || []).map((x: any) => [String(x.permissao_codigo), Boolean(x.permitido)]),
    );
    const lista: Array<{
      codigo: string;
      nome: string;
      grupo: string;
      descricao: string;
      permitido: boolean;
      origem: "plano" | "usuario" | "cargo";
      ordem: number;
    }> = [];
    for (const p of PERMISSOES_PADRAO) {
      const planoOk = Boolean(
        !p.funcionalidade_codigo ||
        (await featureAllowed(clinicaId, String(p.funcionalidade_codigo))),
      );
      const personalizado = mapa.has(p.codigo);
      const permitido = Boolean(
        planoOk && (personalizado ? mapa.get(p.codigo)! : defaults.has(p.codigo)),
      );
      lista.push({
        codigo: p.codigo,
        nome: p.nome,
        grupo: p.grupo,
        descricao: p.descricao,
        permitido,
        origem: !planoOk ? "plano" : personalizado ? "usuario" : "cargo",
        ordem: p.ordem,
      });
    }
    return lista.sort(
      (a, b) =>
        Number(a.ordem) - Number(b.ordem) || String(a.codigo).localeCompare(String(b.codigo)),
    );
  }
  async function hasPermission(clinicaId: string, codigo: string) {
    if (await isPlatformAdmin()) return true;
    return Boolean(
      (await effectivePermissions(clinicaId)).find((p) => p.codigo === codigo)?.permitido,
    );
  }
  async function portalIdentity() {
    const u = await user();
    if (!u) return null;
    const { data, error } = await fromIdentity("oricse_portal_tutores")
      .select("*")
      .eq("auth_user_id", u.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function rpc(name: string, args: Record<string, any> = {}) {
    try {
      switch (name) {
        case "oricse_contexto_clinica_atual": {
          const ctx = await currentContext();
          if (!ctx) return { data: [], error: null };
          return {
            data: [
              {
                clinica_id: ctx.clinic.id,
                clinica_nome: ctx.clinic.nome,
                clinica_slug: ctx.clinic.slug,
                clinica_dominio: ctx.clinic.dominio || null,
                clinica_logo_url: ctx.clinic.logo_url || null,
              },
            ],
            error: null,
          };
        }
        case "oricse_meu_acesso": {
          const ctx = await currentContext();
          if (!ctx) return { data: [], error: null };
          const c = ctx.clinic;
          const teste = c.status_financeiro === "teste" && c.acesso_ate;
          const expira = teste ? new Date(c.acesso_ate).getTime() : 0;
          return {
            data: [
              {
                teste_ativo: Boolean(teste && expira >= Date.now()),
                teste_expirado: Boolean(teste && expira < Date.now()),
                dias_restantes: teste
                  ? Math.max(0, Math.ceil((expira - Date.now()) / 86400000))
                  : 0,
              },
            ],
            error: null,
          };
        }
        case "oricse_clinica_publica_portal": {
          const { data, error } = await fromDrive("clinicas").select("*");
          if (error) throw error;
          const slug = String(args.p_slug || "")
            .replace(/^\/+|\/+$/g, "")
            .toLowerCase();
          const host = soHost(args.p_host);
          const c = (data || [])
            .filter((x: any) => x.status === "ativa")
            .sort((a: any, b: any) =>
              soHost(a.dominio) === host ? -1 : soHost(b.dominio) === host ? 1 : 0,
            )
            .find(
              (x: any) =>
                (host && soHost(x.dominio) === host) ||
                (slug && String(x.slug || "").toLowerCase() === slug),
            );
          return {
            data: c
              ? [
                  {
                    clinica_id: c.id,
                    clinica_nome: c.nome,
                    clinica_slug: c.slug,
                    clinica_logo_url: c.logo_url || null,
                  },
                ]
              : [],
            error: null,
          };
        }
        case "oricse_usuario_pode_acessar_portal": {
          if (await isPlatformAdmin()) return { data: true, error: null };
          const m = await membership();
          return { data: Boolean(m?.clinica_id === args.p_clinica_id), error: null };
        }
        case "oricse_configurar_site_clinica": {
          const ctx = await currentContext();
          if (!ctx || !(await hasPermission(ctx.clinic.id, "administracao.site")))
            throw new Error("Sem permissão para configurar o site da clínica.");
          const slug = String(args.p_slug || "")
            .trim()
            .replace(/^\/+|\/+$/g, "")
            .toLowerCase();
          if (!/^[a-z0-9]+([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug))
            throw new Error("O link público deve conter apenas letras, números e hífens.");
          const dominio = args.p_dominio ? soHost(args.p_dominio) : null;
          if (
            dominio &&
            (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(dominio) || dominio.includes(".."))
          )
            throw new Error("Informe apenas o domínio, por exemplo clinica.com.br.");
          const { data: clinicas } = await fromDrive("clinicas").select("id,slug,dominio");
          if (
            (clinicas || []).some(
              (c: any) => c.id !== ctx.clinic.id && String(c.slug || "").toLowerCase() === slug,
            )
          )
            throw new Error("Este link público já está em uso.");
          if (
            dominio &&
            (clinicas || []).some(
              (c: any) => c.id !== ctx.clinic.id && soHost(c.dominio) === dominio,
            )
          )
            throw new Error("Este domínio já está vinculado a outra clínica.");
          const { error } = await fromDrive("clinicas")
            .update({ slug, dominio, updated_at: new Date().toISOString() })
            .eq("id", ctx.clinic.id);
          if (error) throw error;
          return { data: [{ clinica_slug: slug, clinica_dominio: dominio }], error: null };
        }
        case "set_my_clinic_agenda_settings": {
          const ctx = await currentContext();
          if (
            !ctx ||
            !(
              (await hasPermission(ctx.clinic.id, "recepcao.agenda")) ||
              (await hasPermission(ctx.clinic.id, "administracao.configuracoes"))
            )
          )
            throw new Error("Sem permissão para alterar as configurações da agenda.");
          const intervalo = Number(args.p_interval_minutes),
            duracoes = args.p_durations || {};
          const tipos = [
            "Consulta",
            "Retorno",
            "Cirurgia",
            "Banho e Tosa",
            "Vacina",
            "Procedimento",
          ];
          if (
            !Number.isInteger(intervalo) ||
            intervalo < 5 ||
            intervalo > 720 ||
            tipos.some(
              (t) =>
                !Number.isFinite(Number(duracoes[t])) ||
                Number(duracoes[t]) < 5 ||
                Number(duracoes[t]) > 720,
            )
          )
            throw new Error("Configuração de agenda inválida.");
          const { error } = await fromDrive("clinicas")
            .update({
              duracao_padrao_atendimento_min: intervalo,
              duracoes_atendimento_min: duracoes,
              updated_at: new Date().toISOString(),
            })
            .eq("id", ctx.clinic.id);
          if (error) throw error;
          return { data: null, error: null };
        }
        case "oricse_permissoes_efetivas":
          return {
            data: await effectivePermissions(
              String(args.p_clinica_id),
              args.p_user_id ? String(args.p_user_id) : undefined,
            ),
            error: null,
          };
        case "oricse_definir_permissao_usuario": {
          const cid = String(args.p_clinica_id);
          if (!(await canManagePermissions(cid)))
            throw new Error("Sem permissão para gerenciar acessos desta clínica.");
          const { data: alvo } = await fromIdentity("clinica_usuarios")
            .select("user_id")
            .eq("clinica_id", cid)
            .eq("user_id", args.p_user_id)
            .eq("ativo", true)
            .maybeSingle();
          if (!alvo) throw new Error("Usuário sem vínculo ativo com esta clínica.");
          const u = await user();
          const { error } = await fromDrive("oricse_permissoes_usuario").upsert(
            {
              clinica_id: cid,
              user_id: String(args.p_user_id),
              permissao_codigo: String(args.p_codigo),
              permitido: Boolean(args.p_permitido),
              atualizado_por: u?.id || null,
              atualizado_em: new Date().toISOString(),
            },
            { onConflict: "clinica_id,user_id,permissao_codigo" },
          );
          if (error) throw error;
          return { data: null, error: null };
        }
        case "oricse_restaurar_permissao_usuario": {
          const cid = String(args.p_clinica_id);
          if (!(await canManagePermissions(cid)))
            throw new Error("Sem permissão para gerenciar acessos desta clínica.");
          const { error } = await fromDrive("oricse_permissoes_usuario")
            .delete()
            .eq("clinica_id", cid)
            .eq("user_id", args.p_user_id)
            .eq("permissao_codigo", args.p_codigo);
          if (error) throw error;
          return { data: null, error: null };
        }
        case "oricse_movimentar_estoque": {
          const cid = String(args.p_clinica_id);
          if (!(await hasPermission(cid, "estoque.movimentar")))
            throw new Error("Sem permissão para movimentar estoque.");
          const delta = numero(args.p_delta);
          if (!delta) throw new Error("A quantidade da movimentação deve ser diferente de zero.");
          const { data: item, error } = await fromDrive("oricse_catalogo_itens")
            .select("*")
            .eq("id", args.p_item_id)
            .eq("clinica_id", cid)
            .maybeSingle();
          if (error) throw error;
          if (!item || item.tipo !== "produto" || item.ativo === false)
            throw new Error("Produto não encontrado nesta clínica.");
          const novo = Math.round((numero(item.estoque_atual) + delta) * 1000) / 1000;
          if (novo < 0) throw new Error("Saída maior que o estoque disponível.");
          const u = await fromDrive("oricse_catalogo_itens")
            .update({ estoque_atual: novo, updated_at: new Date().toISOString() })
            .eq("id", item.id)
            .eq("clinica_id", cid);
          if (u.error) throw u.error;
          return { data: novo, error: null };
        }
        case "oricse_registrar_atividade": {
          const cid = String(args.p_clinica),
            acao = String(args.p_acao);
          if (!(await hasPermission(cid, "atividade.ponto")))
            throw new Error("Sem permissão para registrar atividade nesta clínica");
          const u = await user();
          if (!u) throw new Error("Sessão inválida.");
          const { data: config } = await fromDrive("oricse_jornada_config")
            .select("*")
            .eq("clinica_id", cid)
            .eq("funcionario_id", u.id)
            .maybeSingle();
          if (!config)
            throw new Error("Modalidade e valor ainda não configurados pelo responsável");
          const { data: regs } = await fromDrive("oricse_jornada_registros")
            .select("*")
            .eq("clinica_id", cid)
            .eq("funcionario_id", u.id);
          const atual = (regs || []).find((r: any) => ["ativa", "pausada"].includes(r.estado));
          const agora = new Date().toISOString();
          const id = atual?.id || uuid();
          if (acao === "checkin" && config.modalidade === "diaria") {
            const r = await fromDrive("oricse_jornada_registros").insert({
              id,
              clinica_id: cid,
              funcionario_id: u.id,
              modalidade: "diaria",
              data: dataHojeSP(),
              valor_unitario: config.valor_unitario,
              estado: "diaria",
              segundos_trabalhados: 0,
              finalizado_em: agora,
              created_at: agora,
              updated_at: agora,
            });
            if (r.error) throw r.error;
          } else if (acao === "iniciar" && config.modalidade === "hora" && !atual) {
            const r = await fromDrive("oricse_jornada_registros").insert({
              id,
              clinica_id: cid,
              funcionario_id: u.id,
              modalidade: "hora",
              data: dataHojeSP(),
              valor_unitario: config.valor_unitario,
              estado: "ativa",
              segundos_trabalhados: 0,
              ultimo_inicio_em: agora,
              created_at: agora,
              updated_at: agora,
            });
            if (r.error) throw r.error;
          } else if (acao === "pausar" && atual?.estado === "ativa") {
            const segundos =
              numero(atual.segundos_trabalhados) +
              Math.max(
                0,
                Math.floor((Date.now() - new Date(atual.ultimo_inicio_em).getTime()) / 1000),
              );
            const r = await fromDrive("oricse_jornada_registros")
              .update({
                estado: "pausada",
                segundos_trabalhados: segundos,
                ultimo_inicio_em: null,
                updated_at: agora,
              })
              .eq("id", atual.id)
              .eq("clinica_id", cid);
            if (r.error) throw r.error;
          } else if (acao === "retomar" && atual?.estado === "pausada") {
            const r = await fromDrive("oricse_jornada_registros")
              .update({ estado: "ativa", ultimo_inicio_em: agora, updated_at: agora })
              .eq("id", atual.id)
              .eq("clinica_id", cid);
            if (r.error) throw r.error;
          } else if (acao === "finalizar" && atual) {
            const segundos =
              numero(atual.segundos_trabalhados) +
              (atual.estado === "ativa"
                ? Math.max(
                    0,
                    Math.floor((Date.now() - new Date(atual.ultimo_inicio_em).getTime()) / 1000),
                  )
                : 0);
            const r = await fromDrive("oricse_jornada_registros")
              .update({
                estado: "finalizada",
                finalizado_em: agora,
                segundos_trabalhados: segundos,
                ultimo_inicio_em: null,
                updated_at: agora,
              })
              .eq("id", atual.id)
              .eq("clinica_id", cid);
            if (r.error) throw r.error;
          } else throw new Error("Ação incompatível com a modalidade ou estado da atividade");
          return { data: id, error: null };
        }
        case "oricse_emitir_receita_controlada": {
          const ctx = await currentContext();
          if (!ctx || !(await hasPermission(ctx.clinic.id, "consultorio.receituario")))
            throw new Error("Sem permissão para emitir receita controlada.");
          const u = await user();
          const id = uuid();
          const agora = new Date().toISOString();
          const { error } = await fromDrive("oricse_receitas_controladas").insert({
            id,
            clinica_id: ctx.clinic.id,
            emitida_por: u?.id || null,
            dados: args.p_dados || {},
            created_at: agora,
            updated_at: agora,
          });
          if (error) throw error;
          return { data: id, error: null };
        }
        case "oricse_crm_processar_clinica":
          return { data: { ok: true, storage: "drive" }, error: null };
        case "oricse_portal_tutor_clinica": {
          const slug = String(args.p_slug || "")
            .trim()
            .toLowerCase();
          const { data } = await fromDrive("clinicas").select("id,nome,slug,logo_url,status,plano");
          const c = (data || []).find(
            (x: any) => x.status === "ativa" && String(x.slug || "").toLowerCase() === slug,
          );
          if (!c || !(await featureAllowed(c.id, "portal_tutor.acesso")))
            return { data: [], error: null };
          return {
            data: [{ clinica_id: c.id, nome: c.nome, slug: c.slug, logo_url: c.logo_url || null }],
            error: null,
          };
        }
        case "oricse_portal_meu_contexto": {
          const pt = await portalIdentity();
          if (!pt) return { data: [], error: null };
          const c = await clinic(pt.clinica_id);
          if (!c || c.status !== "ativa" || !(await featureAllowed(c.id, "portal_tutor.acesso")))
            return { data: [], error: null };
          const { data: tutor, error } = await fromDrive("tutores")
            .select("id,nome,telefone,email")
            .eq("clinica_id", c.id)
            .eq("id", pt.tutor_id)
            .maybeSingle();
          if (error) throw error;
          if (!tutor) return { data: [], error: null };
          return {
            data: [
              {
                clinica_id: c.id,
                clinica_nome: c.nome,
                clinica_slug: c.slug,
                clinica_logo_url: c.logo_url || null,
                tutor_id: tutor.id,
                tutor_nome: tutor.nome,
                tutor_telefone: tutor.telefone || null,
                tutor_email: tutor.email || null,
                usuario: pt.usuario,
              },
            ],
            error: null,
          };
        }
        case "oricse_portal_atualizar_perfil": {
          const pt = await portalIdentity();
          if (!pt) throw new Error("Acesso de tutor inválido.");
          const { error } = await fromDrive("tutores")
            .update({
              telefone: String(args.p_telefone || "").trim() || null,
              email:
                String(args.p_email || "")
                  .trim()
                  .toLowerCase() || null,
              updated_at: new Date().toISOString(),
            })
            .eq("clinica_id", pt.clinica_id)
            .eq("id", pt.tutor_id);
          if (error) throw error;
          return { data: null, error: null };
        }
        case "oricse_portal_agendas": {
          const pt = await portalIdentity();
          if (!pt || !(await featureAllowed(pt.clinica_id, "portal_tutor.agendamento_online")))
            return { data: [], error: null };
          const { data, error } = await fromDrive("oricse_agendas_online")
            .select(
              "id,nome,responsavel,inicio,fim,dias_semana,intervalo_min,modalidade,antecedencia_horas,timezone,tipo,cor",
            )
            .eq("clinica_id", pt.clinica_id)
            .eq("portal_ativo", true)
            .order("nome");
          if (error) throw error;
          return { data: data || [], error: null };
        }
        case "oricse_portal_horarios_disponiveis": {
          const pt = await portalIdentity();
          if (!pt || !(await featureAllowed(pt.clinica_id, "portal_tutor.agendamento_online")))
            throw new Error("Agendamento online indisponível no plano atual.");
          const { data: agenda, error } = await fromDrive("oricse_agendas_online")
            .select("*")
            .eq("id", args.p_agenda_id)
            .eq("clinica_id", pt.clinica_id)
            .eq("portal_ativo", true)
            .maybeSingle();
          if (error) throw error;
          if (!agenda) throw new Error("Agenda indisponível.");
          const data = String(args.p_data);
          const dow = new Date(`${data}T12:00:00Z`).getUTCDay();
          if (!Array.isArray(agenda.dias_semana) || !agenda.dias_semana.map(Number).includes(dow))
            return { data: [], error: null };
          const { data: ocupados } = await fromDrive("oricse_agendamentos_online")
            .select("inicio,fim,estado")
            .eq("clinica_id", pt.clinica_id)
            .eq("agenda_id", agenda.id);
          const lista: Array<{ inicio: string; fim: string; rotulo: string }> = [];
          for (
            let m = minutosHora(agenda.inicio);
            m + Number(agenda.intervalo_min) <= minutosHora(agenda.fim);
            m += Number(agenda.intervalo_min)
          ) {
            const rotulo = hhmm(m),
              inicio = localParaIso(data, rotulo, agenda.timezone || "America/Sao_Paulo"),
              fim = new Date(
                new Date(inicio).getTime() + Number(agenda.intervalo_min) * 60000,
              ).toISOString();
            if (
              new Date(inicio).getTime() <
              Date.now() + Number(agenda.antecedencia_horas || 0) * 3600000
            )
              continue;
            const conflita = (ocupados || []).some(
              (o: any) =>
                ["solicitado", "reservado", "confirmado"].includes(o.estado) &&
                new Date(o.inicio).getTime() < new Date(fim).getTime() &&
                new Date(o.fim).getTime() > new Date(inicio).getTime(),
            );
            if (!conflita) lista.push({ inicio, fim, rotulo });
          }
          return { data: lista, error: null };
        }
        case "oricse_portal_criar_agendamento": {
          const pt = await portalIdentity();
          if (!pt) throw new Error("Acesso de tutor inválido.");
          const slots = await rpc("oricse_portal_horarios_disponiveis", {
            p_agenda_id: args.p_agenda_id,
            p_data: String(args.p_inicio).slice(0, 10),
          });
          if (slots.error) throw slots.error;
          const escolhido = (slots.data || []).find(
            (s: any) => new Date(s.inicio).getTime() === new Date(args.p_inicio).getTime(),
          );
          if (!escolhido) throw new Error("Este horário não está mais disponível.");
          const { data: animal } = await fromDrive("oricse_animais")
            .select("id,nome,tutor_id")
            .eq("clinica_id", pt.clinica_id)
            .eq("id", args.p_animal_id)
            .eq("tutor_id", pt.tutor_id)
            .maybeSingle();
          if (!animal) throw new Error("Animal não pertence a este tutor.");
          const { data: agenda } = await fromDrive("oricse_agendas_online")
            .select("*")
            .eq("id", args.p_agenda_id)
            .eq("clinica_id", pt.clinica_id)
            .maybeSingle();
          if (!agenda) throw new Error("Agenda indisponível.");
          if (agenda.modalidade === "pagamento")
            throw new Error("Pagamento online ainda não foi liberado para esta agenda.");
          const estado = agenda.modalidade === "livre" ? "confirmado" : "solicitado",
            id = uuid(),
            u = await user();
          const ins = await fromDrive("oricse_agendamentos_online").insert({
            id,
            clinica_id: pt.clinica_id,
            agenda_id: agenda.id,
            tutor_auth_id: u?.id || null,
            tutor_id: pt.tutor_id,
            animal_id: animal.id,
            animal_referencia: animal.nome,
            inicio: escolhido.inicio,
            fim: escolhido.fim,
            estado,
            tipo: agenda.tipo,
            observacoes: String(args.p_observacoes || "").slice(0, 1000) || null,
            origem: "portal_tutor",
            dados: { tutor_portal: true },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          if (ins.error) throw ins.error;
          return { data: [{ agendamento_id: id, estado }], error: null };
        }
        case "oricse_portal_emitir_convite": {
          const tutorId = String(args.p_tutor_id),
            usuarioChave = normalizarUsuario(args.p_usuario);
          if (usuarioChave.length < 3 || usuarioChave.length > 40)
            throw new Error("O usuário deve ter entre 3 e 40 caracteres.");
          const ctx = await currentContext();
          if (!ctx || !(await hasPermission(ctx.clinic.id, "recepcao.cadastros.editar")))
            throw new Error("Sem permissão para ativar o portal deste tutor.");
          if (!(await featureAllowed(ctx.clinic.id, "portal_tutor.acesso")))
            throw new Error("O portal do tutor não está incluído no plano desta clínica.");
          const { data: tutor } = await fromDrive("tutores")
            .select("id")
            .eq("clinica_id", ctx.clinic.id)
            .eq("id", tutorId)
            .maybeSingle();
          if (!tutor) throw new Error("Tutor não encontrado.");
          const { data: usado } = await fromIdentity("oricse_portal_tutores")
            .select("id,tutor_id")
            .eq("clinica_id", ctx.clinic.id)
            .eq("usuario_chave", usuarioChave)
            .maybeSingle();
          if (usado && usado.tutor_id !== tutorId)
            throw new Error("Este usuário já está em uso nesta clínica.");
          const token = tokenAleatorio(),
            tokenHash = await sha256Hex(token),
            expira = new Date(Date.now() + 48 * 3600000).toISOString();
          const { data: existente } = await fromIdentity("oricse_portal_tutores")
            .select("*")
            .eq("clinica_id", ctx.clinic.id)
            .eq("tutor_id", tutorId)
            .maybeSingle();
          const payload = {
            id: existente?.id || uuid(),
            clinica_id: ctx.clinic.id,
            tutor_id: tutorId,
            auth_user_id: existente?.auth_user_id || null,
            usuario: `@${usuarioChave}`,
            usuario_chave: usuarioChave,
            clinica_slug: ctx.clinic.slug,
            ativo: true,
            convite_token_hash: tokenHash,
            convite_expira_em: expira,
            updated_at: new Date().toISOString(),
          };
          const q = existente
            ? fromIdentity("oricse_portal_tutores").update(payload).eq("id", existente.id)
            : fromIdentity("oricse_portal_tutores").insert(payload);
          const { error } = await q;
          if (error) throw error;
          return {
            data: [
              {
                usuario: `@${usuarioChave}`,
                token,
                expira_em: expira,
                clinica_slug: ctx.clinic.slug,
              },
            ],
            error: null,
          };
        }
        case "oricse_iniciar_contratacao": {
          const { iniciarContratacaoDrive } = await import("@/lib/checkout-drive.functions");
          const data = await iniciarContratacaoDrive({
            data: { dados: args.p_dados || {} },
          } as never);
          return { data, error: null };
        }
        case "oricse_iniciar_teste_gratis": {
          const { iniciarTesteGratisDrive } = await import("@/lib/checkout-drive.functions");
          const data = await iniciarTesteGratisDrive({
            data: { dados: args.p_dados || {} },
          } as never);
          return { data, error: null };
        }
        case "oricse_validar_codigo_promocional": {
          const codigo = String(args.p_codigo || "")
              .trim()
              .toUpperCase(),
            plano = String(args.p_plano_codigo || ""),
            base = numero(args.p_valor_base);
          const { data: promos, error } = await fromDrive("oricse_codigos_promocionais").select(
            "*",
          );
          if (error) throw error;
          const p = (promos || []).find(
            (x: any) => String(x.codigo || "").toUpperCase() === codigo && x.ativo !== false,
          );
          if (!p) return { data: { valido: false, mensagem: "Código inválido." }, error: null };
          const agora = Date.now();
          if (p.valido_de && new Date(p.valido_de).getTime() > agora)
            return {
              data: { valido: false, mensagem: "Código ainda não está válido." },
              error: null,
            };
          if (p.valido_ate && new Date(p.valido_ate).getTime() < agora)
            return { data: { valido: false, mensagem: "Código expirado." }, error: null };
          if (Array.isArray(p.planos) && p.planos.length && !p.planos.includes(plano))
            return {
              data: { valido: false, mensagem: "Código não disponível para este plano." },
              error: null,
            };
          const desconto =
            p.tipo_desconto === "percentual"
              ? Math.min(base, (base * numero(p.valor)) / 100)
              : Math.min(base, numero(p.valor));
          const final = Math.max(0, Math.round((base - desconto) * 100) / 100);
          return {
            data: {
              valido: true,
              codigo,
              valor_original: base,
              desconto_aplicado: Math.round(desconto * 100) / 100,
              valor_final: final,
              duracao: p.duracao || "primeiro_mes",
              mensagem: "Código aplicado.",
            },
            error: null,
          };
        }
        default:
          return {
            data: null,
            error: erro(
              `RPC ${name} ainda não possui implementação no Drive.`,
              "DRIVE_RPC_UNSUPPORTED",
            ),
          };
      }
    } catch (e: any) {
      return { data: null, error: erro(e?.message || String(e), e?.code || "DRIVE_RPC") };
    }
  }
  return rpc;
}

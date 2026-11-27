import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { driveAccessToken, driveFetch } from "./drive-kv.server";

const nomeManual = "Manual-ORICSE.pdf";
const driveId = "1cHJB7m1W3JhVNKpWaDVXBEIIE-N_JzPs";
const limiteBytes = 50 * 1024 * 1024;
const headersPrivados = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Authorization",
};
const resposta = (body: string, status: number, headers?: Record<string, string>) =>
  new Response(body, { status, headers: { ...headersPrivados, ...headers } });

// Uma capacidade temporária, restrita ao diagnóstico do arquivo oficial.
// Não concede acesso ao PDF, ao login, aos dados das clínicas ou a gravações.
const ativacaoManual = {
  expiraEm: Date.parse("2026-11-27T18:15:00Z"),
  digest: "35483767d2d4e43364abd54a996f874aaa06bb11fa40ce107e1f177d4fb82133",
};

async function autorizarAtivacao(chave: string | null) {
  if (Date.now() >= ativacaoManual.expiraEm || !chave || !/^[A-Za-z0-9_-]{43}$/.test(chave))
    return false;
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(chave)),
  );
  const esperado = ativacaoManual.digest.match(/../g)!;
  let diferenca = 0;
  for (let i = 0; i < bytes.length; i++) diferenca |= bytes[i] ^ parseInt(esperado[i], 16);
  return diferenca === 0;
}

type Acesso = { podeBaixar: boolean; admin: boolean };
type Dependencias = {
  autorizar: (jwt: string) => Promise<Acesso | null>;
  abrir: () => Promise<Response>;
  conexao: (exporConta: boolean) => Promise<{ conta: string; disponivel: boolean }>;
  ativar?: (chave: string | null) => Promise<boolean>;
};

export function criarEntregaManualSistema({
  autorizar,
  abrir,
  conexao,
  ativar = autorizarAtivacao,
}: Dependencias) {
  return async (request: Request) => {
    if (request.method !== "GET") return resposta("Método não disponível.", 405, { Allow: "GET" });
    const acao = new URL(request.url).searchParams.get("acao");
    if (acao === "ativar-conexao") {
      if (!(await ativar(request.headers.get("x-oricse-ativacao-manual"))))
        return resposta("Não encontrado.", 404);
      try {
        return resposta(JSON.stringify(await conexao(true)), 200, {
          "Content-Type": "application/json; charset=utf-8",
        });
      } catch {
        return resposta("Não foi possível verificar a conexão do manual.", 503);
      }
    }
    const jwt = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!jwt || jwt.length > 8192) return resposta("Entre no ORICSE para baixar o manual.", 401);
    try {
      const acesso = await autorizar(jwt);
      if (!acesso) return resposta("Entre no ORICSE para baixar o manual.", 401);
      if (acao === "conexao") {
        if (!acesso.admin) return resposta("Sem acesso a esta configuração.", 403);
        return resposta(JSON.stringify(await conexao(true)), 200, {
          "Content-Type": "application/json; charset=utf-8",
        });
      }
      if (!acesso.podeBaixar) return resposta("É preciso um vínculo ativo com uma clínica.", 403);
      if (acao === "disponibilidade") {
        const { disponivel } = await conexao(false);
        return resposta(JSON.stringify({ disponivel }), 200, {
          "Content-Type": "application/json; charset=utf-8",
        });
      }
      const arquivo = await abrir();
      const tipo = arquivo.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
      const tamanho = Number(arquivo.headers.get("Content-Length") || 0);
      if (!arquivo.ok || !arquivo.body || tipo !== "application/pdf" || tamanho > limiteBytes)
        return resposta("O manual não está disponível agora.", 503);
      return new Response(arquivo.body, {
        headers: {
          ...headersPrivados,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${nomeManual}"`,
          ...(tamanho > 0 ? { "Content-Length": String(tamanho) } : {}),
        },
      });
    } catch {
      return resposta("O manual não está disponível agora.", 503);
    }
  };
}

async function autorizar(jwt: string): Promise<Acesso | null> {
  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !data.user) return null;
  const [vinculo, perfil] = await Promise.all([
    supabaseAdmin
      .from("clinica_usuarios")
      .select("clinica_id")
      .eq("user_id", data.user.id)
      .eq("ativo", true),
    supabaseAdmin.from("app_users").select("role").eq("user_id", data.user.id).maybeSingle(),
  ]);
  if (vinculo.error || perfil.error) throw new Error("Não foi possível validar o acesso.");
  const admin = perfil.data?.role === "admin";
  const ids = [...new Set((vinculo.data || []).map(({ clinica_id }) => clinica_id))];
  if (!ids.length) return { admin, podeBaixar: false };
  // Em produção o vínculo não possui relacionamento declarado no PostgREST.
  const { data: ativas, error: erroClinica } = await supabaseAdmin
    .from("clinicas")
    .select("id")
    .in("id", ids)
    .eq("status", "ativa")
    .is("excluido_em", null)
    .limit(1);
  if (erroClinica) throw new Error("Não foi possível validar a clínica.");
  return { admin, podeBaixar: Boolean(ativas?.length) };
}

const arquivoApi = `https://www.googleapis.com/drive/v3/files/${driveId}`;
const tokenLeitura = () => driveAccessToken("https://www.googleapis.com/auth/drive.readonly");

export const baixarManualSistema = criarEntregaManualSistema({
  autorizar,
  abrir: async () => {
    const token = await tokenLeitura();
    return driveFetch(token, `${arquivoApi}?alt=media&supportsAllDrives=true`);
  },
  conexao: async (exporConta) => {
    const token = await tokenLeitura();
    let conta = "";
    if (exporConta) {
      const consulta = await driveFetch(
        token,
        "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)",
      );
      const info = (await consulta.json()) as { user?: { emailAddress?: string } };
      conta = info.user?.emailAddress || "";
    }
    let disponivel = false;
    try {
      const file = await driveFetch(
        token,
        `${arquivoApi}?fields=name,mimeType,size,trashed&supportsAllDrives=true`,
      );
      const f = (await file.json()) as {
        name?: string;
        mimeType?: string;
        size?: string;
        trashed?: boolean;
      };
      disponivel =
        !f.trashed &&
        f.name === nomeManual &&
        f.mimeType === "application/pdf" &&
        Number(f.size) > 0 &&
        Number(f.size) <= limiteBytes;
    } catch {
      // Um arquivo ainda não compartilhado não impede a leitura da conta técnica.
    }
    return { conta, disponivel };
  },
});

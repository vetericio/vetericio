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

type Acesso = { podeBaixar: boolean; admin: boolean };
type Dependencias = {
  autorizar: (jwt: string) => Promise<Acesso | null>;
  abrir: () => Promise<Response>;
  conexao: (exporConta: boolean) => Promise<{ conta: string; disponivel: boolean }>;
};

export function criarEntregaManualSistema({ autorizar, abrir, conexao }: Dependencias) {
  return async (request: Request) => {
    if (request.method !== "GET") return resposta("Método não disponível.", 405, { Allow: "GET" });
    const jwt = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!jwt || jwt.length > 8192) return resposta("Entre no ORICSE para baixar o manual.", 401);
    try {
      const acesso = await autorizar(jwt);
      if (!acesso) return resposta("Entre no ORICSE para baixar o manual.", 401);
      const acao = new URL(request.url).searchParams.get("acao");
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
      .select("clinica_id, clinicas!inner(id)")
      .eq("user_id", data.user.id)
      .eq("ativo", true)
      .eq("clinicas.status", "ativa")
      .is("clinicas.excluido_em", null)
      .limit(1),
    supabaseAdmin.from("app_users").select("role").eq("user_id", data.user.id).maybeSingle(),
  ]);
  if (vinculo.error || perfil.error) throw new Error("Não foi possível validar o acesso.");
  const admin = perfil.data?.role === "admin";
  return { admin, podeBaixar: Boolean(vinculo.data?.length) };
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {buildInstagramAuthorizeUrl,instagramDirectConfig} from "@/lib/server/instagram-direct.server";

beforeEach(()=>{
  // URLs e segredos ilustrativos. Nenhuma conta ou API real e chamada neste teste.
  vi.stubEnv("ORICSTUDIO_INSTANCE_ID","oricstudio");
  vi.stubEnv("SUPABASE_URL","https://oricstudio-test.example.invalid");
  vi.stubEnv("APP_BASE_URL","https://oricstudio-test.example.invalid");
  vi.stubEnv("IG_APP_ID","123456789012345");
  vi.stubEnv("IG_APP_SECRET","apenas-teste-sem-segredo-real");
  vi.stubEnv("TOKEN_ENCRYPTION_KEY","fake-key-for-url-tests");
});
afterEach(()=>vi.unstubAllEnvs());

describe("OAuth Instagram direto do OricStudio",()=>{
  it("gera login Instagram sem exigir Facebook ou config_id",()=>{
    const link=new URL(buildInstagramAuthorizeUrl("a".repeat(43)));
    expect(link.origin).toBe("https://www.instagram.com");
    expect(link.pathname).toBe("/oauth/authorize");
    expect(link.searchParams.get("redirect_uri")).toBe("https://oricstudio-test.example.invalid/api/public/instagram-oauth-callback");
    expect(link.searchParams.get("client_id")).toBe("123456789012345");
    expect(link.searchParams.get("response_type")).toBe("code");
    expect(link.searchParams.get("state")).toBe("a".repeat(43));
    expect(link.searchParams.get("scope")).toContain("instagram_business_content_publish");
    expect(link.searchParams.get("scope")).toContain("instagram_business_manage_insights");
    expect(link.searchParams.has("config_id")).toBe(false);
    expect(link.searchParams.has("client_secret")).toBe(false);
  });
  it("recusa conexao sem App ID, evitando pedido OAuth quebrado",()=>{
    vi.stubEnv("IG_APP_ID","");
    expect(instagramDirectConfig().missing).toContain("IG_APP_ID");
    expect(()=>buildInstagramAuthorizeUrl("a".repeat(43))).toThrow(/não configurada/);
  });
  it("recusa estado OAuth curto ou fora do formato esperado",()=>{
    expect(()=>buildInstagramAuthorizeUrl("1")).toThrow(/Estado OAuth inválido/);
    expect(()=>buildInstagramAuthorizeUrl("a".repeat(32)+"!")).toThrow(/Estado OAuth inválido/);
  });
  it("nao permite executar a copia apontando para o banco do Gestor original",()=>{
    vi.stubEnv("SUPABASE_URL","https://ytuhblegzqppcwqkdovg.supabase.co");
    expect(()=>instagramDirectConfig()).toThrow(/projeto Supabase próprio/);
  });
  it("nao permite executar a copia sem identificador da instancia",()=>{
    vi.stubEnv("ORICSTUDIO_INSTANCE_ID","");
    expect(()=>instagramDirectConfig()).toThrow(/Instância OricStudio não configurada/);
  });
});

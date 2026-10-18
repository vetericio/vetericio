import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Copy, ExternalLink, Globe2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { ClinicTenantInfo } from "@/lib/tenant-context";

export const Route = createFileRoute("/configuracao-site")({ component: ConfiguracaoSite });

function ConfiguracaoSite() {
  const [clinica, setClinica] = useState<ClinicTenantInfo | null>(null);
  const [slug, setSlug] = useState("");
  const [dominio, setDominio] = useState("");
  const [podeEditar, setPodeEditar] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const [contexto, usuario] = await Promise.all([
          supabase.rpc("oricse_contexto_clinica_atual"),
          supabase.auth.getUser(),
        ]);
        if (contexto.error) throw contexto.error;
        const dados = contexto.data?.[0];
        if (!dados) throw new Error("Não há uma clínica vinculada a este usuário.");
        const userId = usuario.data.user?.id;
        if (!userId) throw new Error("Faça login novamente.");
        const { data: vinculo, error } = await supabase
          .from("clinica_usuarios")
          .select("papel")
          .eq("clinica_id", dados.clinica_id)
          .eq("user_id", userId)
          .eq("ativo", true)
          .maybeSingle();
        if (error) throw error;
        if (!ativo) return;
        setClinica(dados);
        setSlug(dados.clinica_slug || "");
        setDominio(dados.clinica_dominio || "");
        setPodeEditar(["responsavel", "admin_clinica", "rt"].includes(vinculo?.papel || ""));
      } catch (error) {
        if (ativo)
          toast.error(error instanceof Error ? error.message : "Não foi possível carregar o site.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, []);

  async function salvar() {
    if (!podeEditar) return;
    const slugLimpo = slug
      .trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, "");
    const dominioLimpo = dominio
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/.test(slugLimpo)) {
      return void toast.error("Use letras sem acento, números ou hífen no link público.");
    }
    if (dominioLimpo && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(dominioLimpo)) {
      return void toast.error("Informe apenas o domínio, por exemplo: clinica.com.br.");
    }
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc("oricse_configurar_site_clinica", {
        p_slug: slugLimpo,
        p_dominio: dominioLimpo || null,
      });
      if (error) throw error;
      const resultado = data?.[0];
      if (!resultado) throw new Error("O servidor não confirmou a configuração.");
      setSlug(resultado.clinica_slug);
      setDominio(resultado.clinica_dominio || "");
      setClinica((atual) =>
        atual
          ? {
              ...atual,
              clinica_slug: resultado.clinica_slug,
              clinica_dominio: resultado.clinica_dominio,
            }
          : atual,
      );
      toast.success("Configuração do site salva.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a configuração.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function copiar(valor: string) {
    try {
      await navigator.clipboard.writeText(valor);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link. Selecione e copie manualmente.");
    }
  }

  const caminhoPublico = slug ? `/vet/${slug}` : "";
  const linkFallback =
    typeof window !== "undefined" && caminhoPublico
      ? `${window.location.origin}${caminhoPublico}`
      : "";
  const dominioPublico = dominio ? `https://${dominio}` : "";

  if (carregando)
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted-foreground">
        Carregando configurações do site…
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <a
        href="/inicio"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Voltar
      </a>
      <header className="mb-5 mt-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Configurações</p>
        <h1 className="mt-1 text-2xl font-bold">Site da clínica</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure o link de acesso e, se tiver, o domínio próprio.
        </p>
      </header>

      <section className="mb-5 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold text-foreground">Portal do Tutor — configurações do RT</h2>
        <p className="mt-1 text-sm text-muted-foreground">Personalize a mensagem de boas-vindas, contatos, orientações de agendamento e seções disponíveis aos tutores. O responsável técnico configura sem precisar alterar domínio ou infraestrutura.</p>
        <Link to="/configurar-portal-tutor" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Configurar Portal do Tutor</Link>
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Globe2 size={18} className="text-primary" />
          <h2 className="font-bold">{clinica?.clinica_nome}</h2>
        </div>
        <label className="block text-sm font-semibold">
          Link público da clínica
          <div className="mt-1 flex min-h-11 items-center rounded-xl border bg-background px-3">
            <span className="shrink-0 text-xs text-muted-foreground">/vet/</span>
            <input
              value={slug}
              disabled={!podeEditar}
              onChange={(event) =>
                setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder="nomedaclinica"
              className="min-w-0 flex-1 bg-transparent px-1.5 outline-none disabled:opacity-70"
            />
          </div>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Sem espaço ou acento. Exemplo: /vet/vetericio
          </span>
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Domínio próprio (opcional)
          <input
            value={dominio}
            disabled={!podeEditar}
            onChange={(event) => setDominio(event.target.value.toLowerCase())}
            placeholder="www.suaclinica.com.br"
            className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal disabled:opacity-70"
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Digite apenas o domínio; não inclua https:// nem caminhos.
          </span>
        </label>
        <button
          type="button"
          disabled={!podeEditar || salvando}
          onClick={() => void salvar()}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <Save size={16} /> {salvando ? "Salvando…" : "Salvar"}
        </button>
        {!podeEditar && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Somente o responsável da clínica ou o RT podem alterar o link e o domínio.
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="font-bold">Acesso da clínica</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A página abre o login da clínica. Sem domínio próprio, use o link /vet/ abaixo.
        </p>
        <div className="mt-3 grid gap-2">
          {linkFallback && (
            <LinkLinha
              titulo="Link público"
              valor={linkFallback}
              onCopy={() => void copiar(linkFallback)}
            />
          )}
          {dominioPublico && (
            <LinkLinha
              titulo="Domínio próprio"
              valor={dominioPublico}
              onCopy={() => void copiar(dominioPublico)}
            />
          )}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border bg-primary/[0.035] p-4 sm:p-5">
        <h2 className="font-bold">Conectar o domínio na KingHost</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs leading-5 text-muted-foreground">
          <li>
            Informe e salve o domínio neste cadastro da clínica antes de conectar. Assim o endereço
            já fica associado à página de login correta.
          </li>
          <li>
            Publique o sistema e abra o projeto Oricse no Lovable:{" "}
            <strong>Settings → Domains → Connect existing domain</strong>. Informe o domínio e deixe
            essa tela aberta.
          </li>
          <li>
            No painel KingHost, abra o domínio em <strong>Gerenciar DNS</strong>. Crie exatamente os
            registros <strong>A</strong> e <strong>TXT</strong> que o Lovable mostrar. O destino A
            atual é <code>185.158.133.1</code>; copie o valor único <code>lovable_verify=…</code>{" "}
            para o TXT. Não invente nem reutilize o token.
          </li>
          <li>
            Para o domínio raiz, use <code>@</code> no A e <code>_lovable</code> no TXT. Para{" "}
            <code>www</code>, configure também esse endereço se o Lovable solicitar: o TXT terá nome{" "}
            <code>_lovable.www</code>. Remova registros A/AAAA/CNAME conflitantes com o mesmo nome;
            mantenha MX/e-mail.
          </li>
          <li>
            Volte ao Lovable, clique em <strong>Check status</strong> e aguarde o status{" "}
            <strong>Live</strong> e o HTTPS. Sem domínio, o link /vet/ continua disponível.
          </li>
        </ol>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Os valores de verificação e o nome exato dos registros são fornecidos pelo Lovable para
          cada domínio e podem variar. Não altere os servidores DNS da KingHost se só precisa editar
          os registros.
        </p>
      </section>
    </main>
  );
}

function LinkLinha({
  titulo,
  valor,
  onCopy,
}: {
  titulo: string;
  valor: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground">{titulo}</p>
        <a
          href={valor}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm font-semibold text-primary hover:underline"
        >
          {valor}
        </a>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="rounded-md p-2 text-muted-foreground hover:bg-muted"
        aria-label={`Copiar ${titulo}`}
      >
        <Copy size={14} />
      </button>
      <ExternalLink size={14} className="shrink-0 text-muted-foreground" />
    </div>
  );
}

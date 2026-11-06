#!/usr/bin/env node
// Assistente local do OricStudio: envia arquivos do computador e agenda publicações
// pela API do assistente, com as mesmas regras do painel (fila, aprovação, pausa geral, registro).
//
//   node tools/assistente.mjs criar-chave            gera a chave local e mostra o hash para registrar
//   node tools/assistente.mjs lista [status,...]     publicações (padrão: agendadas e em processamento)
//   node tools/assistente.mjs publicar --conta minha_conta --tipo reels --arquivo video.mp4
//        [--capa capa.jpg] [--legenda "..." | --legenda-arquivo legenda.txt] [--titulo "..."]
//        [--campanha "..."] [--quando 2026-10-27T19:00 | --agora] [--rascunho] [--sem-feed]
//   (para carrossel, repita --arquivo; o horário é de Brasília)
//   node tools/assistente.mjs comentarios [--conta minha_conta]   comentários sem resposta, com contexto
//   node tools/assistente.mjs sugerir --id <id> --texto "..."      grava sugestão (publicar exige clique humano)
//
// A chave fica em %USERPROFILE%\.oricstudio\chave-assistente e nunca é enviada a outro lugar
// além do próprio sistema. Revogar: preencher revogada_em em assistant_keys.
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, extname, join } from "node:path";

const BASE = (process.env.ORICSTUDIO_URL || "").replace(/\/+$/, "");
function verificarDestino() {
  if (!BASE) throw new Error("Configure ORICSTUDIO_URL com o endereço da instância OricStudio.");
  const url = new URL(BASE);
  if (url.protocol !== "https:" || url.hostname === "gestor-insta-vetericio.lovable.app" ||
      url.hostname.endsWith(".gestor-insta-vetericio.lovable.app")) {
    throw new Error("Destino inválido: o OricStudio não pode enviar dados para o Gestor 2.0.");
  }
}
const KEY_DIR = join(homedir(), ".oricstudio");
const KEY_FILE = join(KEY_DIR, "chave-assistente");

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const k = a.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    if (k === "arquivo") (out.arquivo ??= []).push(v);
    else out[k] = v;
  }
  return out;
}

function key() {
  if (!existsSync(KEY_FILE))
    throw new Error("Chave não encontrada. Rode: node tools/assistente.mjs criar-chave");
  return readFileSync(KEY_FILE, "utf8").trim();
}

async function api(path, init = {}) {
  verificarDestino();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({ ok: false, erro: `HTTP ${res.status}` }));
  if (!res.ok || body.ok === false) throw new Error(body.erro ?? `HTTP ${res.status}`);
  return body;
}

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

/** PNG/WebP → JPEG with Windows' System.Drawing (white background, quality 92). */
function toJpeg(file) {
  const out = join(tmpdir(), `oricstudio-${randomBytes(6).toString("hex")}.jpg`);
  const ps = [
    "Add-Type -AssemblyName System.Drawing",
    `$src = [System.Drawing.Image]::FromFile($args[0])`,
    "$bmp = New-Object System.Drawing.Bitmap $src.Width, $src.Height",
    "$g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::White); $g.DrawImage($src, 0, 0, $src.Width, $src.Height)",
    "$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }",
    "$p = New-Object System.Drawing.Imaging.EncoderParameters 1",
    "$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 92L",
    "$bmp.Save($args[1], $codec, $p); $g.Dispose(); $bmp.Dispose(); $src.Dispose()",
  ].join("; ");
  execFileSync("powershell.exe", ["-NoProfile", "-Command", `& { ${ps} }`, file, out], {
    stdio: "pipe",
  });
  return out;
}

async function upload(conta, file) {
  if (!existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);
  let path = file;
  let temp = null;
  const ext = extname(file).toLowerCase();
  if ([".png", ".webp", ".bmp"].includes(ext)) path = temp = toJpeg(file);
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) throw new Error(`Formato não suportado: ${basename(file)} (use JPG, PNG, MP4 ou MOV)`);
  const size = statSync(path).size;
  if (size > 100 * 1024 * 1024)
    throw new Error(`${basename(file)} tem ${Math.round(size / 1048576)} MB; o limite é 100 MB.`);
  try {
    const r = await api("/api/public/assistente/media", {
      method: "POST",
      headers: {
        "Content-Type": mime,
        "X-Conta": conta,
        "X-Arquivo": encodeURIComponent(basename(file)),
      },
      body: readFileSync(path),
    });
    console.log(`  enviado: ${basename(file)} → ${r.media.id}`);
    return r.media;
  } finally {
    if (temp) rmSync(temp, { force: true });
  }
}

function brasilia(quando) {
  if (!quando || quando === true) return null;
  const iso = /[zZ]|[+-]\d\d:\d\d$/.test(quando)
    ? quando
    : `${quando.length === 16 ? `${quando}:00` : quando}-03:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Data inválida: ${quando} (use 2026-10-27T19:00)`);
  return d.toISOString();
}

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];

  if (cmd === "criar-chave") {
    if (existsSync(KEY_FILE) && !a.substituir)
      throw new Error(`Já existe uma chave em ${KEY_FILE} (use --substituir para trocar).`);
    mkdirSync(KEY_DIR, { recursive: true });
    const k = randomBytes(32).toString("base64url");
    writeFileSync(KEY_FILE, k, { mode: 0o600 });
    console.log(`Chave salva em ${KEY_FILE}`);
    console.log(`Hash para registrar: ${createHash("sha256").update(k).digest("hex")}`);
    return;
  }

  if (cmd === "lista") {
    const r = await api(`/api/public/assistente/posts${a._[1] ? `?status=${a._[1]}` : ""}`);
    console.log(
      `Pausa geral: ${r.settings?.pausa_geral ? "ATIVA" : "não"} · modo: ${r.settings?.modo_autonomia}`,
    );
    for (const p of r.posts) {
      const quando = p.publicado_em ?? p.agendado_para;
      console.log(
        `- [${p.status}] ${quando ? new Date(quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem data"} · ${p.tipo} · ${p.titulo ?? (p.legenda ?? "").slice(0, 40)}${p.permalink ? ` · ${p.permalink}` : ""}${p.ultimo_erro ? ` · ERRO: ${p.ultimo_erro}` : ""}`,
      );
    }
    return;
  }

  if (cmd === "comentarios") {
    const r = await api(
      `/api/public/assistente/comentarios${a.conta ? `?conta=${encodeURIComponent(a.conta)}` : ""}`,
    );
    const conta = new Map(r.accounts.map((x) => [x.id, x.username]));
    const media = new Map(r.media.map((m) => [m.ig_media_id, m]));
    for (const c of r.comments) {
      const m = media.get(c.ig_media_id);
      const flags = [
        c.categoria,
        c.precisa_humano ? "ATENÇÃO HUMANA" : null,
        c.parent_ig_comment_id ? "resposta em conversa" : null,
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`- ${c.id}`);
      console.log(`  @${c.autor} em @${conta.get(c.instagram_account_id)} [${flags}]: ${c.texto}`);
      console.log(`  post: ${(m?.caption ?? "").split(/\r?\n/)[0]}`);
      console.log(`  sugestão (${c.sugestao_por}): ${c.resposta_sugerida ?? "—"}`);
    }
    return;
  }

  if (cmd === "sugerir") {
    if (!a.id || !a.texto || a.texto === true)
      throw new Error('Use: sugerir --id <id> --texto "resposta"');
    await api("/api/public/assistente/comentarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, sugestao: a.texto }),
    });
    console.log(
      "Sugestão salva (a resposta só é publicada quando alguém clicar em Responder no painel).",
    );
    return;
  }

  if (cmd === "publicar") {
    const conta = a.conta;
    const tipo = a.tipo ?? "imagem";
    if (!conta) throw new Error("Informe --conta");
    if (!a.arquivo?.length) throw new Error("Informe ao menos um --arquivo");
    const legenda = a["legenda-arquivo"]
      ? readFileSync(a["legenda-arquivo"], "utf8").trim()
      : a.legenda && a.legenda !== true
        ? a.legenda
        : null;
    const acao = a.rascunho ? "rascunho" : a.agora ? "publicar_agora" : "agendar";
    const agendado_para = brasilia(a.quando);
    if (acao === "agendar" && !agendado_para)
      throw new Error("Informe --quando (horário de Brasília) ou use --agora / --rascunho.");

    console.log(
      `Enviando ${a.arquivo.length} arquivo(s) para @${String(conta).replace(/^@/, "")}...`,
    );
    const media = [];
    for (const f of a.arquivo) media.push(await upload(conta, f));
    const capa = a.capa ? await upload(conta, a.capa) : null;

    const r = await api("/api/public/assistente/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conta,
        tipo,
        titulo: a.titulo && a.titulo !== true ? a.titulo : null,
        campanha: a.campanha && a.campanha !== true ? a.campanha : null,
        legenda,
        media_asset_ids: media.map((m) => m.id),
        capa_asset_id: capa?.id ?? null,
        share_to_feed: !a["sem-feed"],
        agendado_para,
        acao,
      }),
    });
    console.log(`Publicação ${r.id}: ${r.status}${r.resultado ? ` (${r.resultado})` : ""}`);
    for (const aviso of r.avisos ?? []) console.log(`  aviso: ${aviso}`);
    return;
  }

  console.log(
    readFileSync(new URL(import.meta.url), "utf8")
      .split("\n")
      .slice(1, 13)
      .join("\n"),
  );
}

main().catch((e) => {
  console.error(`Erro: ${e.message}`);
  process.exit(1);
});

#Requires -Version 7.0
<#
.SYNOPSIS
  Backup manual do PostgreSQL da ORICSE (Supabase Free).
.DESCRIPTION
  Não publica, não altera o banco e não contém credenciais.
  Requer Supabase CLI, Docker, sessão supabase login e SUPABASE_DB_PASSWORD
  definido apenas na sessão do terminal, nunca gravado no Git.
  Guarde os resultados em armazenamento PRIVADO e criptografado.
  Não inclui arquivos reais do Google Drive ou do Supabase Storage.
#>
param(
  [string]$ProjectRef = "mwrmfcyrdxfxssebgknz",
  [string]$BackupRoot = (Join-Path $HOME "ORICSE-backups")
)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_PASSWORD)) {
  throw "Defina SUPABASE_DB_PASSWORD apenas na sessão atual, sem compartilhar a senha."
}
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI não encontrado. Instale o CLI v3 e o Docker Desktop."
}
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$destino = Join-Path $BackupRoot "db-$timestamp"
New-Item -ItemType Directory -Path $destino -Force | Out-Null
try {
  Write-Host "Gerando dump SQL somente leitura..."
  $alvo = "--remote=$ProjectRef"
  & supabase db dump $alvo --role-only -f (Join-Path $destino "roles.sql")
  if ($LASTEXITCODE -ne 0) { throw "Falha na exportação de papéis." }
  & supabase db dump $alvo -f (Join-Path $destino "schema.sql")
  if ($LASTEXITCODE -ne 0) { throw "Falha na exportação do esquema." }
  & supabase db dump $alvo --data-only --use-copy -x "storage.buckets_vectors" -x "storage.vector_indexes" -f (Join-Path $destino "data.sql")
  if ($LASTEXITCODE -ne 0) { throw "Falha na exportação dos dados." }

  $arquivos = @("roles.sql", "schema.sql", "data.sql")
  foreach ($nome in $arquivos) {
    $arquivo = Join-Path $destino $nome
    if (-not (Test-Path -LiteralPath $arquivo) -or (Get-Item $arquivo).Length -lt 8) {
      throw "Arquivo ausente ou vazio: $nome"
    }
  }
  Get-FileHash -Algorithm SHA256 -Path ($arquivos | ForEach-Object { Join-Path $destino $_ }) |
    Select-Object @{n="Arquivo";e={Split-Path $_.Path -Leaf}}, Hash |
    ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $destino "sha256.json")
  $instrucoes = @(
    "Projeto: $ProjectRef",
    "Gerado: $(Get-Date -Format o)",
    "Conteúdo: roles.sql, schema.sql, data.sql, sha256.json",
    "Estado: dump criado, mas restauração em instância isolada AINDA NÃO FOI TESTADA.",
    "Arquivos reais em Storage e Google Drive não estão incluídos.",
    "NUNCA envie estes arquivos por chat, e-mail ou repositório Git."
  )
  $instrucoes | Set-Content -Encoding UTF8 (Join-Path $destino "LEIA-ME.txt")
  Write-Host "Dump criado em $destino (não equivale a restauração verificada)."
} finally {
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
}

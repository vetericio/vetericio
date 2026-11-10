$configPath = Join-Path $PSScriptRoot 'oricse-agents.json'
$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json

$expected = @('henrique', 'lucas', 'rafael', 'andre', 'pedro', 'gabriel', 'marina', 'camila', 'bianca', 'sofia')
$actual = @($config.agents | ForEach-Object { $_.id })

if ($config.schema_version -ne '1.0.0') { throw 'Unexpected schema version.' }
if ($config.activation.confirmed -ne $false) { throw 'Activation must remain unconfirmed until externally verified.' }
if (@(Compare-Object $expected $actual -SyncWindow 0).Count -ne 0) { throw 'Agent roster does not match the requested ten agents.' }
if ($config.existing_agents.id -notcontains 'joao') { throw 'João must be preserved.' }
if ($config.orchestrator -ne 'henrique') { throw 'Henrique must be the orchestrator.' }

foreach ($agent in $config.agents) {
  foreach ($field in @('id', 'name', 'role', 'mission', 'skills', 'tools', 'permissions', 'deny', 'handoff')) {
    if ($null -eq $agent.$field -or @($agent.$field).Count -eq 0) { throw "Missing $field for $($agent.id)." }
  }
}

Write-Output "OK: $($actual.Count) unactivated agent definitions validated; João preserved."


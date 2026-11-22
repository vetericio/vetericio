$configPath = Join-Path $PSScriptRoot 'oricse-agents.json'
$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json

$expected = @('henrique', 'lucas', 'rafael', 'andre', 'pedro', 'gabriel', 'marina', 'camila', 'bianca', 'sofia', 'joao')
$actual = @($config.agents | ForEach-Object { $_.id })

if ($config.schema_version -ne '1.0.0') { throw 'Unexpected schema version.' }
if ($config.activation.confirmed -ne $false) { throw 'Activation must remain unconfirmed until externally verified.' }
if (@(Compare-Object $expected $actual -SyncWindow 0).Count -ne 0) { throw 'Integrated agent roster does not match the requested team.' }
if ($config.existing_agents.id -notcontains 'joao') { throw 'João must remain marked as preserved.' }
if ($config.orchestrator -ne 'henrique') { throw 'Henrique must be the orchestrator.' }

foreach ($agent in $config.agents) {
  foreach ($field in @('id', 'name', 'role', 'mission', 'skills', 'tools', 'permissions', 'deny', 'handoff')) {
    if ($null -eq $agent.$field -or @($agent.$field).Count -eq 0) { throw "Missing $field for $($agent.id)." }
  }
}

Write-Output "OK: $($actual.Count) unactivated integrated agent definitions validated; João preserved."


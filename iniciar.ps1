$ErrorActionPreference = 'Stop'

$appDirectory = $PSScriptRoot
$envFile = Join-Path $appDirectory '.env'
$serverFile = Join-Path $appDirectory 'server.js'
$speechSdkBundle = Join-Path $appDirectory 'node_modules\microsoft-cognitiveservices-speech-sdk\distrib\browser\microsoft.cognitiveservices.speech.sdk.bundle.js'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js não foi encontrado. Instale o Node.js 18 ou superior e tente novamente.'
}

if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
  throw "Arquivo .env não encontrado em $appDirectory. Crie-o usando .env.example como referência."
}

if (-not (Test-Path -LiteralPath $serverFile -PathType Leaf)) {
  throw "Arquivo server.js não encontrado em $appDirectory."
}

if (-not (Test-Path -LiteralPath $speechSdkBundle -PathType Leaf)) {
  throw 'Dependências do app não encontradas. Execute npm install e tente novamente.'
}

foreach ($line in Get-Content -LiteralPath $envFile -Encoding UTF8) {
  if ([string]::IsNullOrWhiteSpace($line) -or $line -match '^\s*#') {
    continue
  }

  if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
    throw 'O arquivo .env contém uma linha inválida. Verifique a configuração sem compartilhar suas chaves.'
  }

  $name = $matches[1]
  $value = $matches[2]
  if ($value.Length -ge 2) {
    $firstCharacter = $value.Substring(0, 1)
    $lastCharacter = $value.Substring($value.Length - 1, 1)
    if (($firstCharacter -eq '"' -and $lastCharacter -eq '"') -or
        ($firstCharacter -eq "'" -and $lastCharacter -eq "'")) {
      $value = $value.Substring(1, $value.Length - 2)
    }
  }

  [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

Set-Location -LiteralPath $appDirectory
Write-Host 'Iniciando A Sentinela em http://localhost:3000'
Write-Host 'Para encerrar o servidor, pressione Ctrl+C.'
& node $serverFile

if ($LASTEXITCODE -ne 0) {
  throw "O servidor encerrou com código $LASTEXITCODE."
}

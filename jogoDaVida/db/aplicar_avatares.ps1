# Script PowerShell para aplicar os novos avatares ao banco de dados

Write-Host "Aplicando novos avatares ao banco jogoDaVida..." -ForegroundColor Yellow

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptPath "seed_avatares_novos.sql"
$sqlContent = Get-Content -Path $sqlFile -Raw

# Executar o SQL no Docker
docker exec -i prospecto-ia-postgres-1 psql -U prospecto -d jogodavida @"
$sqlContent
"@

if ($LASTEXITCODE -eq 0) {
  Write-Host "✓ Avatares adicionados com sucesso!" -ForegroundColor Green
  Write-Host "Recarregue a página do jogo para ver as novas opções." -ForegroundColor Cyan
} else {
  Write-Host "✗ Erro ao aplicar os avatares." -ForegroundColor Red
  exit 1
}

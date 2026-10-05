#!/bin/bash
# Script para aplicar os novos avatares ao banco de dados

echo "Aplicando novos avatares ao banco jogoDaVida..."
docker exec -i prospecto-ia-postgres-1 psql -U prospecto -d jogodavida < "$(dirname "$0")/seed_avatares_novos.sql"

if [ $? -eq 0 ]; then
  echo "✓ Avatares adicionados com sucesso!"
  echo "Recarregue a página do jogo para ver as novas opções."
else
  echo "✗ Erro ao aplicar os avatares."
  exit 1
fi

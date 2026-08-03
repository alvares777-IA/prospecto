#!/usr/bin/env bash
# Backup diário dos bancos Postgres (n8n, typebot, evolution, leads) e dos
# workflows do n8n (export em JSON, além do dump do banco).
#
# Uso manual: ./scripts/backup.sh
# Cron (usuário producao): 0 3 * * * /home/producao/prospecto/scripts/backup.sh >> /home/producao/prospecto/backups/backup.log 2>&1
#
# Restaurar um banco:
#   gunzip -c backups/2026-08-03/n8n.sql.gz | docker exec -i prospecto-postgres-1 psql -U prospecto -d n8n
#
# Reimportar workflows do n8n a partir do export JSON:
#   docker cp backups/2026-08-03/n8n-workflows.json prospecto-n8n-1:/tmp/workflows.json
#   docker exec prospecto-n8n-1 n8n import:workflow --input=/tmp/workflows.json

set -euo pipefail

POSTGRES_CONTAINER="prospecto-postgres-1"
N8N_CONTAINER="prospecto-n8n-1"
DATABASES=(n8n typebot evolution leads)

BACKUP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
RETENTION_DAYS=14
STAMP="$(date +%F)"
DEST="${BACKUP_ROOT}/${STAMP}"

mkdir -p "${DEST}"

echo "[$(date '+%F %T')] Iniciando backup em ${DEST}"

for db in "${DATABASES[@]}"; do
    echo "  -> dump ${db}"
    docker exec "${POSTGRES_CONTAINER}" bash -c "pg_dump -U \"\$POSTGRES_USER\" -d ${db}" \
        | gzip > "${DEST}/${db}.sql.gz"
done

echo "  -> export workflows n8n"
docker exec "${N8N_CONTAINER}" n8n export:workflow --all --output=/tmp/backup-workflows.json
docker cp "${N8N_CONTAINER}:/tmp/backup-workflows.json" "${DEST}/n8n-workflows.json"
docker exec "${N8N_CONTAINER}" rm -f /tmp/backup-workflows.json

echo "  -> limpando backups com mais de ${RETENTION_DAYS} dias"
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} \;

echo "[$(date '+%F %T')] Backup concluído."

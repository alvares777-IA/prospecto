-- Executado automaticamente na primeira inicialização do container PostgreSQL.
-- Cria os bancos de dados para cada serviço do projeto.

\set n8n_db        'n8n'
\set typebot_db    'typebot'
\set evolution_db  'evolution'
\set leads_db      'leads'

SELECT 'CREATE DATABASE ' || :'n8n_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'n8n_db')\gexec

SELECT 'CREATE DATABASE ' || :'typebot_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'typebot_db')\gexec

SELECT 'CREATE DATABASE ' || :'evolution_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'evolution_db')\gexec

SELECT 'CREATE DATABASE ' || :'leads_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'leads_db')\gexec

-- Garante que o usuário padrão tem acesso total a todos os bancos
\c n8n
GRANT ALL PRIVILEGES ON DATABASE n8n TO CURRENT_USER;

\c typebot
GRANT ALL PRIVILEGES ON DATABASE typebot TO CURRENT_USER;

\c evolution
GRANT ALL PRIVILEGES ON DATABASE evolution TO CURRENT_USER;

\c leads
GRANT ALL PRIVILEGES ON DATABASE leads TO CURRENT_USER;

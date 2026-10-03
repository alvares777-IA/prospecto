---
name: prospecto-ia-db-producao-comando
description: Regra do usuário — toda operação de banco (INSERT/UPDATE/DDL/seed) no PROSPECTO-IA/jogoDaVida deve vir acompanhada do comando pronto pra ele rodar no docker da produção
metadata:
  type: feedback
---

Sempre que uma tarefa envolver qualquer operação de banco de dados (inserir jogo/enigma novo, UPDATE de parâmetro, ALTER/CREATE, seed), **entregar no fim o comando exato para o usuário executar no docker da produção** (192.168.210.7, `/home/producao/prospecto/`) — Claude não acessa o banco de produção.

**Why:** o dev roda local; produção é só via VPN/SSH do usuário. Pedido em 03/10/2026 ao criar o jogo Enduro ("qualquer operação de banco de dados, preciso do comando para executar no docker da produção").

**How to apply:** formato `docker exec -i prospecto-postgres-1 psql -U prospecto -d jogodavida <<'SQL' ... SQL` (containers: `prospecto-postgres-1`, `prospecto-jogodavida-1`, ver [[prospecto-ia-datacenter-deploy]]). Fazer idempotente (`ON CONFLICT`) quando possível. Se o arquivo do jogo/enigma também precisa ir pra produção (public/enigmas é gitignored; gerado por `db/publicar_enigmas.mjs` + rebuild da imagem), incluir esses passos juntos.

---
name: memorias-e-planos-na-pasta-do-projeto
description: Toda nova memória ou plano deste projeto deve ser criado em jogoDaVida/memorias_e_planos (memorias/ e planos/), não em ~/.claude
metadata:
  type: feedback
---

Memórias e planos do projeto PROSPECTO-IA ficam em `jogoDaVida/memorias_e_planos/memorias/` e `.../planos/`.

**Why:** o usuário quer tudo versionado/visível dentro da estrutura do projeto (pedido de 2026-10-03).
**How to apply:** ao salvar memória ou plano, escrever direto nessa pasta e atualizar `memorias_e_planos/MEMORY.md` (índice). O MEMORY.md em ~/.claude só aponta para cá.

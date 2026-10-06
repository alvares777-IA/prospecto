# TIM (enigma-105) — completar os 87 desafios do The Incredible Machine original

Pedido de 2026-10-05: criar os desafios que ainda faltam da lista de 87 (walkthrough Sierra Help).
Decisões do usuário:
- fazer os 76 de uma vez, numa entrega só;
- personagens (rato Mort, gato Pokey, peixe Bob, macaco Kelly) com comportamento simples e determinístico;
- as 16 fases atuais ficam como estão e as novas entram como 17–92, em ordem crescente de dificuldade.

Fonte: https://sierrahelp.com/Walkthroughs/TheIncredibleMachineWalkthrough.html.
Também GameBoomers e JustAdventure. Cada um traz objetivo, peças e solução, mas não as posições na tela: as montagens são recriadas.

## Já existiam (fases 1–16)
Correspondem aos originais #1, 2, 3, 4, 5, 6, 8, 11, 14, 15 e 21. As fases 1–3, 12 e 16 são criação nossa.

## Andamento
- [x] **Infra:** `tim-teste.mjs --fase A-B`.
- [x] **Motor:**
  - objetivos `cestos` (uma bola em cada cesto), `ratos` (todos correndo) e `cesto`/`zona` com `bolas: [...]`;
  - lanterna com `toque` (acende com bola);
  - cesto com `estilo: 'pote' | 'caixa'`.
- [x] **Lote 1, fases 17–26** (só peças que já existiam): #28, 42, 66, 31, 64, 35, 82, 38, 58, 49.
- [x] **Lote 2, fases 27–33** (revólver, caixa-surpresa, detonador; objetivos `armas` e `inteiras`; ambiente fixo trava o painel): #76, 17, 27, 7, 75, 23, 32.
- [x] **Lote 3, fases 34–39** (tomada, gerador, motor, painel, lâmpada, engrenagem colocável e encostada, correia de engrenagem; objetivo `girar`; zona `estilo: buraco`, cesto `balde`): #45, 40, 72, 12, 13, 34.
- [x] **Lote 4, fases 40–46** (vela, foguete, lâmpada + lupa; objetivo `foguetes`; teste confere grade de 10 px): #67, 63, 16, 50, 53, 87, 83.
- [x] **Lotes 5–6, fases 47–57** (corda com polias, balde que segura o que cai dentro, gancho; gatilho/lâmpada de cordinha; tesoura acionada corta corda; chama queima corda; objetivos `tempo`, `lampadas`, `balde`): #24, 10, 9, 55, 29, 25, 47, 56, 43, 69, 71. Ficaram para depois: 20, 36, 70, 79, 84, 85.
- [x] **Lote 7, fases 58–72** (Mort, Pokey, Bob no aquário, Kelly na bicicleta, gaiola; `presoEm`, `dorme`; objetivos `presos`, `salvos`, `quebrar`, zona `estilo: casa`): #18, 41, 61, 65, 36, 78, 60, 19, 39, 57, 86, 37, 22, 80, 48.
- [x] **Lote 8, fases 73–92** (os que juntam tudo e os que sobraram; objetivo `nosBaldes`; rato acorda com gato perto; bico do foguete estoura bexiga; aquário quebra com bola pesada e rápida): #20, 74, 85, 79, 70, 51, 46, 77, 44, 68, 52, 84, 59, 73, 81, 26, 62, 30, 33, 54.
- [x] Texto de ajuda do HTML reescrito; prints e jogadas reais por amostragem em todos os lotes.
- [ ] Comando de banco `niveis = 92` (passado ao usuário; produção é com ele).

Resultado: as 87 do original estão no jogo (11 nas fases 1–16 e 76 nas fases 17–92), mais as 5 criações nossas.

## Como cada fase é feita
1. Rascunho em `scratchpad/f/pNN.mjs`, exportando `nivel` (com `caixa`) e `sol`.
2. `node checa.mjs f/pNN.mjs` mostra:
   - se há peça encavalada;
   - se resolve sem peças;
   - se a solução resolve;
   - peças dispensáveis;
   - se a caixa confere.
3. `busca.mjs` (com `gerar()`) mede a tolerância de posições.
4. `gera.mjs loteN.json` gera o código das fases e o `.sol.json`. Depois, `gtestes.mjs` gera as linhas `fase(i, [...])` do teste.
5. Publicar com `node db/publicar_enigmas.mjs`. Prints com `shots.cjs`; jogada real com Playwright.

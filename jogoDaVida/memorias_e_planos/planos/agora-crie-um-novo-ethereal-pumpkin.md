# Plano — "Mundo": porta multiplayer estilo Minecraft 2D (ajuda × egoísmo → caráter + destino)

## Contexto

Hoje os jogos da sala são enigmas de texto/HTML e 4 arcades **solo** em iframe que só mandam
uma pontuação no fim (postMessage). Não existe estado compartilhado em tempo real entre jogadores,
e o motor de destino (`registrar_evento` → `regra_destino` → `destino_saldo`) está pronto no banco
mas **nenhum código chama**. O caráter é gravado só como positivo/negativo em `carater`.

O pedido: um jogo estilo Minecraft, no browser, onde os jogadores **coletam objetos que valem
pontos** e podem **se ajudar ou ser egoístas**, com isso registrado no caráter.

Decisões já tomadas com você:
- **Visual:** 2D top-down em canvas (mapa de blocos visto de cima).
- **Escassez (P01):** as quatro — recursos finitos no mapa, doar itens (quantidade escolhida),
  socorro/pacto a quem está com fome ou preso, e baú comunitário.
- **Encaixe:** nova porta de catálogo `tipo='mundo'`; todos da sala caem no mesmo mapa.
- **Registro:** `carater` **e** `registrar_evento` (tipos novos, pesos em tabela).

Avisos de regra (CLAUDE.md):
- **Aumenta o escopo da fatia vertical** — é o maior bloco novo do protótipo (tempo real, mapa,
  inventário). Você pediu explicitamente; registrando.
- **Canvas** está na lista de "deliberadamente ausentes"; os arcades já abriram exceção. O canvas
  aqui é só *render* — toda decisão fica no servidor (regra 1).
- Nenhum peso/limiar de destino no Node: pesos vão em `regra_destino` (seed, editável no `/admin`).
  Tunáveis de jogabilidade (duração, metas, fome) vão em `parametro` via `param()`.

## Desenho do jogo

- Mapa ~48×32 blocos gerado por RNG com semente (`sessaoId`+`ordem`): grama, árvores (madeira),
  pedra, veios de **minério** (vale mais), arbustos de **comida**, lagos (intransponíveis),
  **buracos/cavernas** (quem cai fica **preso**) e um **baú da equipe** no centro.
- **Nada renasce** durante o mundo: quem chega depois encontra menos — posição/tempo como escassez.
- Movimento WASD/setas; segurar clique num bloco adjacente = minerar (N tiques, com barra);
  botão direito = colocar bloco (serve pra fazer ponte e tirar alguém do buraco).
- **Pontos pessoais** = valor do inventário (minério > comida > madeira/pedra; valores em `parametro`).
- **Fome** cai com o tempo; minerar gasta mais. Zerou → **desmaiado** (não anda) até alguém dar comida.
- **Tempo pessoal** no mundo (`mundo_duracao_seg`, padrão 240s) a partir da entrada. Ao acabar
  (ou botão "Sair do mundo"), passa a porta se `pontos ≥ meta pessoal` (= `enigma.resposta`)
  **ou** se o baú da equipe atingiu `mundo_meta_equipe` (cooperar paga — e é aí que o saque tenta).
- Energia da porta continua decaindo como qualquer porta (mesma regra `decaimento_min`).

### Atos registrados (verbo público, peso oculto)

| Ato (servidor detecta) | `tipo_evento` | caráter | eixo (seed) |
|---|---|---|---|
| Doar item (1 / metade / tudo) a outro | `DOOU_ITEM` (contexto: item, qtd, **saldo do doador antes**) | + | GENEROSIDADE |
| Dar comida a desmaiado | `ALIMENTOU` | + | SOLIDARIEDADE |
| Tirar alguém do buraco / reanimar | `AJUDA_REERGUER` (já existe, reaproveita regra `REERGUER_ALIADO`) | + | SOLIDARIEDADE |
| Depositar no baú | `DEPOSITOU_BAU` | + | GENEROSIDADE |
| Sacar do baú além do que você mesmo depositou | `SAQUEOU_BAU` | − | GENEROSIDADE |
| Minerar bloco que outro estava minerando (progresso < 3s) | `ROUBOU_BLOCO` (alvo = quem minerava) | − | GENEROSIDADE |
| Pedir socorro | `PEDIU_SOCORRO` (sem regra, só log) | — | — |
| Recusar pedido | `RECUSOU` | − leve | CONFIABILIDADE |
| Não responder até o prazo | `IGNOROU` (gerado pelo vencimento) | − | CONFIABILIDADE |
| Aceitou e chegou/ajudou | `CUMPRIU_PACTO` | + | CONFIABILIDADE |
| Aceitou, andou em direção, não chegou a tempo | `TENTOU_CUMPRIR` | + leve | CONFIABILIDADE |
| Aceitou e não se aproximou | `ROMPEU_PACTO` | − forte | CONFIABILIDADE |

Cada ato: 1 linha em `carater` (reaproveita `marcarCarater`, hoje privada em
[server/jogo.js:623](jogoDaVida/server/jogo.js#L623) — exportar) + `registrar_evento(uuid, ...)` com
`crypto.randomUUID()` gerado no servidor (idempotência, regra 6). Só **no fim da ação**, nunca por
tique. Doador vê o próprio estoque; receptor não vê quanto o doador tinha.

## Implementação

### Banco — [db/schema_pg.sql](jogoDaVida/db/schema_pg.sql) (bloco novo, idempotente)
- `tipo_evento`: os códigos da tabela acima (`ON CONFLICT DO NOTHING`).
- `eixo_destino`: `GENEROSIDADE`, `CONFIABILIDADE` (SOLIDARIEDADE já existe).
- `regra_destino`: uma regra por ato com peso/janela/teto/`exige_alvo_distinto` (ex.: ROMPEU −15,
  CUMPRIU +10, SAQUEOU −6, DOOU +5...). Editáveis no `/admin` (tabela já está lá).
- `parametro` globais: `mundo_duracao_seg` 240, `mundo_meta_equipe` 120, `mundo_fome_seg` 3,
  `mundo_socorro_prazo_seg` 30, `mundo_valor_minerio` 5, `mundo_valor_comida` 2,
  `mundo_valor_madeira` 1, `mundo_valor_pedra` 1.
- `enigma`: 1 linha `origem='mundo:1'`, `tipo='mundo'`, `resposta='30'` (meta pessoal),
  `nivel='Mundo'`, `fase NULL`, `ordem` baixa pra aparecer cedo (ajustável no `/admin`).
- Sem tabela nova: o ledger `evento.contexto` (JSONB) guarda item/qtd/saldo/posições.

### Servidor
- **Novo `server/mundo.js`** (estado vivo em memória, como `sala.js`):
  - `Map` de mundos por `${sessaoId}:${ordem}`: grade de blocos, jogadores
    `{jogadorId, socketId, nome, x, y, inv, fome, preso, desmaiado, minerando, entrada, depositou}`,
    baú `{inv, total}`, pedidos de socorro `{id, de, prazo, aceitos:{jid→distInicial}}`.
  - `gerarMapa(semente)`, `entrar`, `input`, `minerar`, `colocar`, `doar`, `bauDepositar`,
    `bauSacar`, `pedirSocorro`, `responderSocorro`, `sair`.
  - Loop 10 Hz por mundo ativo: move, progresso de mineração, fome, colisão com buraco/lago,
    vencimento de pedidos (IGNOROU / avaliação do pacto por distância), fim de tempo pessoal.
    Emite `mundo_estado` (jogadores + blocos alterados) à sala Socket.IO `mundo:<sessao>:<ordem>`;
    mapa completo só na entrada (`mundo_mapa`). Some da memória quando o último sai.
  - Atos devolvem uma lista `{tipo_evento, ator, alvo, valor, contexto, carater}`; o `index.js`
    grava com retry assíncrono (padrão já usado em persistencia) sem travar o loop.
- **[server/jogo.js](jogoDaVida/server/jogo.js)**:
  - `acertouResposta`: `'mundo'` compara número ≥ limiar, igual `'jogo'`.
  - `responder(..., { servidor })`: se `st.tipo==='mundo'` e não veio do servidor → `erro`
    (cliente não pode mandar pontuação de mundo). Fim do mundo chama
    `responder(sessao, jogador, String(pontosCalculadosNoServidor), null, { servidor: true })`
    — reaproveita avanço de porta, bônus, `hall`, `jogo_terminado`.
  - `desistirEnigma` / `pedirAjuda` / `darAjuda`: recusam `tipo==='mundo'` (não há resposta a revelar).
  - Exportar `marcarCarater`; nova `registrarAto(sessaoId, ato)` que chama `registrar_evento`.
- **[server/index.js](jogoDaVida/server/index.js)**: handlers `mundo_entrar`, `mundo_input`,
  `mundo_minerar`, `mundo_colocar`, `mundo_doar`, `mundo_bau`, `mundo_socorro`,
  `mundo_socorro_resposta`, `mundo_sair` (todos via `ctxJogo()` e checando que a porta atual é
  `tipo='mundo'`). Guard no `responder` existente. No `disconnect`: `mundo.sair` mantém o
  jogador reconectável enquanto o mundo existir.

### Cliente
- **[public/index.html](jogoDaVida/public/index.html)**: novo `<div id="jogo-mundo" class="d-none">`
  no painel: canvas + painel lateral (jQuery/Bootstrap): tempo, pontos, meta, barra de fome,
  inventário com item selecionado, baú (total/meta, Depositar/Sacar com qtd), lista de jogadores
  com **Doar (1 / metade / tudo)**, **Pedir socorro**, pedidos recebidos (Aceitar / Recusar),
  Tela cheia (reaproveita `pedirTelaCheia`), Sair da sala. `<script src="/mundo.js">`.
- **Novo `public/mundo.js`**: só render + envio de intenção. Câmera seguindo o jogador (~20×14
  blocos de 32px), texturas procedurais estilo pixel (pontilhado por tipo), avatar/nome sobre
  cada jogador, barra de mineração, partículas ao quebrar, leve ciclo dia→noite pelo tempo.
  Input: teclas enviadas como direção atual (não posição); clique = `mundo_minerar {x,y}`.
- **[public/app.js](jogoDaVida/public/app.js)**: no `meu_enigma` (bloco ~L350), se
  `st.tipo==='mundo'` → esconde `#jogo-enigma`/`#jogo-fase`, mostra `#jogo-mundo`, `socket.emit('mundo_entrar')`.
  Ao `hall`/`jogo_terminado`, desmonta o mundo.

## Arquivos
Novos: `server/mundo.js`, `public/mundo.js`.
Alterados: `db/schema_pg.sql`, `server/jogo.js`, `server/index.js`, `public/index.html`,
`public/app.js`, `public/estilo.css` (layout do painel lateral), `docs/manual_do_jogo.md` (seção Mundo).

## Verificação
1. Reaplicar schema: `docker exec -i prospecto-ia-postgres-1 psql -U prospecto -d jogodavida < jogoDaVida/db/schema_pg.sql`.
2. No `/admin` → Enigmas: pôr o `mundo:1` com `ordem` 1 (ou desativar as fases) pra cair nele logo.
3. Duas janelas (uma anônima) na mesma sala; iniciar; ambos entram no mesmo mapa e se veem mexer.
4. Testar cada ato: minerar o bloco que o outro minera, doar metade, depositar/sacar do baú,
   cair no buraco → pedir socorro → aceitar e (a) ir até lá e colocar bloco, (b) ficar parado.
5. Conferir no banco:
   `select tipo_evento, ator_id, alvo_id, contexto from evento order by id desc limit 20;`
   `select * from destino_lancamento order by id desc limit 20;` (roll gravado)
   `select * from carater order by id desc limit 20;`
6. Tentar `socket.emit('responder',{resposta:'999'})` pelo DevTools numa porta mundo → deve ser ignorado.
7. Tempo acaba com pontos ≥ meta → vai pro hall da próxima porta; abaixo da meta com baú cheio → passa também.

Fora do escopo (anotado): entregar `consequencia` (outbox) ao cliente com recibo — o ledger passa
a ser alimentado, mas a exibição da consequência é o próximo passo.

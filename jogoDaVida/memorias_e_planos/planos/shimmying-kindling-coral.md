# Adicionar novo desafio ao jogo TIM (esteira + rato + rampa)

## Contexto

`jogoDaVida/db/enigmas/enigma-105.html` é o jogo "TIM" (clone simplificado do
The Incredible Machine): o jogador pega peças de uma caixa e monta uma máquina
num canvas 640×400 para levar uma bola até um cesto/zona, usando uma física
mínima de bola única (`tim-fisica.js`) e uma lista de desafios (`tim-niveis.js`,
hoje com 3 níveis: ventilador+bateria, rampa+trampolim, ventilador+rampa).

O usuário anexou duas capturas do jogo original (DOS "The Incredible Machine",
puzzle "PUT THE BALL IN THE HOOP") mostrando um desafio com peças que ainda não
existem no nosso clone: **esteira/correia** (correia transportadora com bolas
em cima), e uma **gaiola com um rato correndo** que gira a engrenagem da
esteira e a põe em movimento — junto com a **rampa**, que já existe. O
inventário do puzzle original tem exatamente 3 tipos de peça (esteira ×3,
gaiola-do-rato ×3, rampa ×3); a engrenagem é só o desenho da própria esteira,
não é um item separado — por isso o rato funciona como *ativador* da esteira,
no mesmo padrão que a bateria já usa para ligar o ventilador (peça colocada em
cima de outra peça, sem física própria).

Pedido: acrescentar esse tipo de peça ao motor do TIM e um novo desafio (4º
nível) que use esteira + rato + rampa, seguindo o padrão dos 3 desafios
existentes (verificado por simulação, cada peça realmente necessária).

## O que muda

### 1. `db/enigmas/tim-fisica.js` — nova peça `correia`
- `segmentosDe`: novo `case 'correia'` retornando os 4 segmentos de um
  retângulo `w×h` centrado em `(p.x, p.y)` (mesmo padrão do `case 'bloco'`).
- `criarMundo`: reúne `correias = todas.filter(p => p.tipo === 'correia' && p.ligada)`
  e guarda em `m.correias`.
- `passo`: dentro do laço de subpassos, depois de resolver colisões, para cada
  correia ligada verifica se a bola está apoiada no topo dela (posição e
  tolerância iguais ao `ESP` já usado) e aproxima `b.vx` da velocidade da
  esteira (`VELOCIDADE_CORREIA * c.dir`) com um ganho fixo por subpasso — é a
  mesma ideia do vento do ventilador, mas horizontal e só quando a bola está
  apoiada em cima, não numa zona à distância.
- Duas novas constantes de módulo: `VELOCIDADE_CORREIA` e `GANHO_CORREIA` (já
  adicionadas nesta sessão antes do modo de planejamento ligar — ver nota
  abaixo).
- `rato` **não** ganha `segmentosDe` nem entra em `pecas` como objeto de
  física — é tratado exatamente como a `bateria`: um modo de colocação que só
  liga um atributo (`ligada = true`) numa `correia` já existente.

Nota: no início desta tarefa, antes do modo de planejamento ser ativado, já
adicionei ao arquivo a constante `VELOCIDADE_CORREIA`/`GANHO_CORREIA` (uma
edição pontual e reversível, sem efeito no motor até o resto ser implementado).
Vou revisar esse trecho no início da implementação e ajustar se o valor final
dos testes pedir outro número.

### 2. `db/enigmas/enigma-105.html` — UI/render/interação da esteira e do rato
Seguindo o padrão existente do par ventilador/bateria:
- `NOMES`: `correia: 'Esteira'`, `rato: 'Rato'`.
- `novaPeca('correia', x, y)` → `{ tipo:'correia', x, y, w:110, h:10, dir:1, ligada:false }`.
  `rato` continua sem entrada em `novaPeca` (mesmo padrão da `bateria`).
- `acerta(p,x,y)`: novo caso retângulo para `correia`.
- Fluxo de colocação em `cv.addEventListener('mousedown', …)`: novo bloco
  `modo === 'rato'` espelhando o bloco `modo === 'bateria'` — procura uma
  `correia` sob o clique, recusa se não achar ou se já tiver rato, senão
  `c.ligada = true; caixa.rato--`.
- `renderCaixa()`: mensagem de dica específica quando `modo === 'rato'`.
- `girar()`: `correia` também inverte `dir` com R (mesmo padrão do `ventilador`).
- `remover()`: devolve o rato pra caixa se a correia removida estava ligada
  (mesmo padrão do ventilador devolvendo a bateria).
- Desenho: `desenharCorreia(p, t, destaque)` (esteira com polias, faixas
  animadas no sentido do `dir` quando ligada e rodando, uma engrenagem
  pequena na ponta) + `desenharRato(cx, cy, t)` (gaiola com roda, só
  desenhada quando `ligada`). Chamadas nos três lugares que já iteram peças:
  fixas, peças colocadas (com destaque de seleção) e o "fantasma" da peça
  sendo posicionada (excluindo `modo === 'rato'` do fantasma, assim como já
  exclui `'bateria'`).
- Texto de ajuda: acrescenta uma frase sobre o rato/esteira, no mesmo tom da
  frase existente sobre bateria/ventilador.

### 3. `db/enigmas/tim-niveis.js` — 4º desafio
Novo objeto no array `NIVEIS`, tema "esteira movida a rato": uma bola de
boliche cai sobre uma prateleira alta e precisa de uma esteira (ligada pelo
rato) para ganhar impulso horizontal, e de uma rampa pra passar por cima de um
muro fixo e cair no cesto — mesmo estilo do desafio 2 (rampa+trampolim sobre
muro), trocando o "empurrão inicial" por esteira+rato em vez de queda livre.
`caixa: { correia: 1, rato: 1, rampa: 1 }`.

As coordenadas exatas (posição da prateleira/queda da bola, dimensões do
muro, posição do cesto) serão calibradas durante a implementação com uma
busca por simulação (mesma técnica do arquivo de teste abaixo), não
adivinhadas — o objetivo é reproduzir o espírito do puzzle original (esteira
carrega a bola, rato é obrigatório, rampa é obrigatória pra vencer o muro)
com uma solução real e verificável, igual aos 3 desafios já existentes.

### 4. `db/enigmas/tim-teste.mjs` — 4º bloco de verificação
Novo bloco `// 4 — <título>`, no mesmo formato dos 3 existentes:
1. sem peças não resolve;
2. existe combinação de `correia` (com `rato` ligado) + `rampa` numa grade de
   posições/ângulos que resolve (`total > 0`, com exemplo);
3. correia sem rato (ligada:false) não resolve sozinha;
4. só a combinação completa resolve — nenhuma peça isolada é suficiente
   (mesmo espírito do `soRampa`/`soVentilador` dos desafios 2 e 3).

Only depois desse arquivo passar (`node jogoDaVida/db/enigmas/tim-teste.mjs`
sem falhas) é que os números finais entram em `tim-niveis.js`.

### 5. Ajustes de configuração (meta/quantidade de níveis)
- `enigma-105.html`: `data-answer="300"` → `data-answer="400"` (4 desafios ×
  100 pontos, mesma lógica documentada no comentário do `importar_jogos.mjs`).
- `db/importar_jogos.mjs`: `'enigma-105.html': { …, niveis: 3 }` → `niveis: 4`,
  e o comentário da linha 38 (`"a meta de 300 = 3 desafios de 100 pontos"`)
  atualizado para 400/4.
- Aviso ao usuário: o comentário do próprio `importar_jogos.mjs` diz que, se a
  linha do jogo já foi importada pro banco antes, `fase/ordem/meta/níveis`
  passam a ser controlados pelo `/admin` e o reimport **não** sobrescreve
  `niveis`/`resposta` de uma linha já existente (só idempotente por
  `origem`). Vou avisar no fim que, se o TIM já estiver importado no banco de
  produção/dev, é preciso ajustar manualmente `niveis` para 4 e a meta/resposta
  para 400 pelo painel `/admin` (ou um UPDATE direto) — o código-fonte sozinho
  não propaga isso para uma linha já existente.

## Fora de escopo
- Não vou mexer em `public/enigmas/*` (cópia gerada e ignorada pelo git via
  `.gitignore`, recriada pelo `importar_enigmas`/processo de publicação).
- Não vou tentar replicar múltiplas bolas simultâneas nem o sistema de cordas
  ligando várias esteiras do jogo original — o motor é de bola única; o novo
  desafio usa 1 esteira + 1 rato + 1 rampa, suficiente para capturar a mecânica
  pedida (esteira, rato que gira a engrenagem, rampa) dentro do que o motor
  atual suporta.

## Verificação
1. `node jogoDaVida/db/enigmas/tim-teste.mjs` — todos os 4 blocos passam
   (sem regressão nos 3 já existentes, novo bloco 4 confirma que rato e
   rampa são realmente necessários).
2. Checagem visual manual do novo desenho (`desenharCorreia`/`desenharRato`)
   lendo o código gerado — não há um jeito de abrir um browser real neste
   ambiente, então a verificação de UI é por revisão de código + a simulação
   determinística do passo 1 confirmando que a física bate com o desenho
   (mesma posição/dimensões usadas nos dois lugares).
3. `git diff` final revisando que só os arquivos listados acima mudaram e que
   `public/enigmas/` continua intocado.

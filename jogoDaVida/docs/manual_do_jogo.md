# Manual do Jogo — *Jogo da Vida* (protótipo)

*Rascunho — 2026-09-01. Descreve o protótipo como ele funciona hoje.*
*Público: **testador** (quem roda e avalia o protótipo), não o jogador.*

> **Leia isto primeiro.** A direção de design (`docs/loop_de_jogo.md`) é que
> o jogo final **não tenha manual nem tutorial** — descobrir o que fazer é o
> recurso mais escasso do jogo. Este documento é um **guia de teste**. A
> parte que descreve o *destino* (seção 7) existe aqui só para o testador
> entender o que está sendo medido; no jogo isso nunca aparece escrito.

Todos os números abaixo são **parâmetros** (`parametro` no banco, editáveis
em `/admin`). Valem os padrões globais; uma sala ou um enigma podem
sobrepor qualquer um deles.

---

## 1. O que é

Um jogo multiplayer social em navegador. Você entra numa **sala** com
outras pessoas e atravessa uma série de **enigmas**. Resolver enigma é a
tarefa visível — mas o que o jogo observa de verdade é **como você age com
os outros** enquanto resolve: se ajuda, se abandona, se cobra, se mente.

Não há gráficos, não há tutorial. Salas são páginas, ações são botões,
conversa é no chat.

---

## 2. Antes de começar

### Identidade

Três formas de entrar:

| Forma | O que guarda |
|---|---|
| **Sem conta (anônimo)** | Nada. Ao sair, tudo seu é apagado — progresso, energia e marcas. Na próxima vez você entra zerado. |
| **E-mail e senha** | Conta permanente. Sua energia e seu histórico seguem com você entre salas e entre sessões. |
| **Google** | Igual à conta por e-mail, sem senha para lembrar. |

### Figura

Escolha uma figura (círculo, quadrado, triângulo, losango). É só sua
identidade visual na sala. Anônimo também digita um nome.

---

## 3. Salas

Todas as salas são iguais: cada jogador corre a **sua própria sequência**
de enigmas, no seu ritmo. Vocês estão na mesma sala, conversam e podem
ajudar uns aos outros — mas quem resolve é cada um. Alguns trechos dessa
sequência são **fases**, resolvidas em conjunto (seção 6.3).

- **Criar uma sala nova** — você vira o **anfitrião**.
- **Entrar na sala de um amigo** — digite o **código** (5 letras/números,
  ex.: `K7Q2M`) ou abra o **link** (`.../sala/K7Q2M`).

Só o anfitrião vê **Iniciar jogo**, e só pode iniciar quando a entrada de
todos os presentes estiver salva. Antes disso a sala é um saguão. Quem
entra depois do início cai no hall da porta em que estaria. Uma sala que
deu **game over** (seção 6.4) não aceita mais ninguém.

---

## 4. Sua energia

Você tem uma **energia** que vai de 0 a 100. **Todo jogo começa com 100%
para todos** — não carrega o resultado do jogo anterior. Quem **entra com o
jogo já em andamento** não ganha 100%: começa com a **menor energia entre
os jogadores ainda ativos** (sem vantagem por chegar tarde). Ela persiste só
**dentro** do jogo (entre portas e dentro de uma fase) e **não se recupera
com o tempo** — só volta como prêmio por jogar bem.

| Acontece | Efeito |
|---|---|
| Passa o tempo | −1% por minuto |
| Erra uma resposta | −5% |
| **Resolve um enigma** | **+3%** |
| Doa energia a alguém | −10% para você, +10% para ele |
| Recebe uma doação | +10% (ou o que couber até 100%) |
| **Desiste** de um enigma (o jogo revela a resposta) | **−20%** |

- **Zerou a energia:** você trava naquele enigma — não responde nem pede
  mais nada. Não há socorro automático. A única saída é **outro jogador te
  doar energia** (seção 6.6) — aí você volta na hora. Se **todos** os
  jogadores que ainda precisam jogar travarem em 0 e ninguém doar, a sala
  dá **game over** (seção 6.4).
- **Anônimo:** igual — começa com 100% e não leva nada ao sair.

O topo do painel mostra a energia como barra (verde acima de 50%, amarela
até 20%, vermelha abaixo) e um relógio da sessão.

> O banco ainda guarda `jogador.energia` e o parâmetro `bonus_vitoria` (+10
> ao concluir) grava ali, mas nada disso é lido no início do jogo — a
> "energia que atravessa as salas" está desligada.

---

## 5. Os enigmas

Os enigmas vêm de um catálogo e aparecem **na ordem** (não é sorteio). Cada
um tem um nível (*Fácil*, *Intermediário*, *Difícil*). Há dois tipos:

- **Texto:** uma pergunta (conta aritmética, charada). Você digita a
  resposta e envia. Acentos, maiúsculas e pontuação não importam.
- **Interativo:** uma página dentro da sala (arrastar, clicar, montar). A
  própria página confirma o acerto. Quem valida é sempre o servidor — a
  resposta não fica exposta no navegador, e a ordem das opções é
  embaralhada.
- **Jogo (arcade):** um joguinho 2D de verdade dentro da sala (Paddle,
  Comilão — um Pac-Man simplificado). Joga-se pontos; o "gabarito" é um
  **limiar de pontuação** guardado no banco. A jogabilidade acontece toda
  no navegador (não tem como ser diferente num jogo de reflexo), mas quem
  **decide se resolveu** continua sendo o servidor, comparando a
  pontuação enviada com o limiar — igual a qualquer outra resposta.

No catálogo, um enigma pode ter uma **fase** (`enigma.fase`, um número,
editável no `/admin`). Enigmas com a mesma fase viram um **trecho
coletivo** da sequência (seção 6.3).

---

## 6. A sequência: portas e fases

### 6.1 Portas

Sua sequência tem N portas solo (padrão `qtd_enigmas` = 4) mais os trechos
de fase. Cada porta é um enigma. Acertou, passa para a próxima e a energia
sobe `+3%`. Errou, perde `−5%` e tenta de novo. Todos na sala veem em que
porta cada um está.

### 6.2 Hall de espera

Entre uma porta e a seguinte você cai num **hall**. Ali o chat está sempre
aberto, você vê o nível de cada jogador e decide: deixar uma mensagem e
**Prosseguir**, ou **aguardar** alguém. Ninguém te empurra.

### 6.3 Fase (trecho coletivo)

Quando sua porta cai numa fase, a tela vira um **tabuleiro compartilhado**:
os enigmas daquele trecho, cada um **aberto** ou **✓ resolvido por Fulano**.

- **Qualquer jogador na fase resolve qualquer enigma dela.** A resolução
  vale para **todos** — quem resolveu fica marcado.
- Os jogadores chegam à fase **em ritmos diferentes**. Quem correu na
  frente encara sozinho, gastando a própria energia; quem chega depois pode
  achar a fase meio-feita, toda feita (passa direto) ou um companheiro
  **morto** (energia 0) com alguns enigmas resolvidos.
- A **energia continua pessoal** dentro da fase. Errar custa a sua energia;
  resolver dá `+3%` a você. Se você zera, trava ali — e uma **doação**
  (seção 6.6) te revive.
- Quando **todos** os enigmas da fase estão resolvidos, você vê um recap
  (**quem resolveu o quê**) e clica **Prosseguir** para seguir sozinho na
  porta seguinte. Quem chega com a fase já pronta vê o mesmo recap.
- Dentro da fase o **chat é livre** e **não há penalidade de spoiler** —
  combinar respostas ali é esperado.

### 6.4 Game over da sala

Se, num dado momento, **ninguém está mais em pé** (todo mundo que ainda
tinha enigma para resolver zerou a energia) e a sala não foi concluída por
todos, a sala **acaba** — game over para quem restou. É o cenário de "todos
correram, todos morreram na fase, ninguém doou".

### 6.5 Ajuda

Os botões e o que cada um custa:

| Ação | Quem faz | Efeito |
|---|---|---|
| **Pedir ajuda** | quem está travado | −2% para você; os outros veem seu pedido |
| **Dar a resposta** | outro jogador | −5% para quem dá; a resposta chega **só** para quem pediu, num aviso privado (não pelo chat) |
| **Oferecer ajuda** | outro jogador | sem custo; abre o chat **entre vocês dois** para combinarem |
| **Não ajudar** | outro jogador | +2% para quem recusa (fica com o que o pedinte perdeu) |

Dar a resposta e oferecer ajuda deixam uma **marca positiva** no seu
caráter. Recusar deixa uma **marca negativa**. As marcas ficam registradas;
o jogo não te diz o que faz com elas (seção 7).

### 6.6 Doação de energia

Independente do enigma, você pode **transferir energia** para outro jogador.
Funciona na porta, no hall e dentro de uma fase.

- **Pedir doação de energia** — botão perto de "Pedir ajuda" (e no hall).
  Não custa nada; só sinaliza que você precisa. Aparece um "· pediu doação"
  ao lado do seu nome para todo mundo. Clicar de novo cancela o pedido.
- **Doar energia** — botão ao lado de cada outro jogador. Você **perde
  `doacao_energia` %** (padrão 10) e ele **ganha o mesmo tanto** (limitado
  pelo teto de 100 dele e pela sua energia). Doar não depende de a pessoa
  ter pedido, e **vários jogadores podem doar** para a mesma pessoa.

Doar deixa uma **marca positiva** de caráter. Não há botão de "não doar".
Uma doação pode **reviver** quem chegou a 0 e travou (desde que ainda não
tenha concluído a sala): ao receber energia, a pessoa volta ao jogo onde
parou.

### 6.7 Desistir (ver a resposta)

Botão **"Desistir e ver a resposta (-20%)"**, no enigma solo e em cada
enigma aberto da fase.

- Custa `custo_desistir` % (padrão 20) da sua energia. Se você não tem 20%,
  o botão nega.
- O jogo **revela a resposta** só para você. Você **ainda precisa digitar e
  enviar** — o acerto é validado como sempre.
- A sala vê no feed: *"Fulano preferiu a resposta do jogo"* — sem a resposta.
- Se **havia quem perguntar** — outro jogador já passou da fase / está à
  frente de você — e mesmo assim você preferiu gastar 20% e pedir ao jogo,
  isso deixa uma **marca de caráter negativa** (silenciosa; o jogo não te
  avisa). Sem ninguém à frente, é só uma dica cara, sem marca.

### 6.8 Chat e o spoiler

Fora das fases, o chat **começa fechado** e abre quando alguém te oferece
ajuda (ou no hall). Se a **resposta de um enigma cair no chat**, todo mundo
que está numa porta solo perde `−10%` de energia — inclusive quem escreveu.
Quem está numa fase não é penalizado (lá o chat é livre).

### 6.9 O Mundo (porta de blocos compartilhada)

Uma porta especial: em vez de pergunta, um **mapa de blocos visto de cima**
onde **todos da sala** que chegarem nela jogam **juntos, ao mesmo tempo**.
Quem chega depois encontra o que os outros deixaram — **nada renasce**.

- **Andar:** clique no chão (o boneco vai sozinho, desviando de água e buracos)
  ou WASD/setas. **Minerar:** segure o clique num bloco — se estiver longe, o
  boneco vai até ele e começa. Blocos
  que dão item: árvore → madeira, pedra → pedra, veio dourado → minério,
  arbusto → comida.
  Se outro cavar o mesmo bloco, o progresso soma — e **quem der o último golpe
  leva**.
- **Botão direito** usa o item escolhido (1–4): coloca bloco (enche buraco,
  faz muro), **tira do buraco** quem está preso ali, ou **alimenta** quem
  desmaiou. **E** come.
- **Pontos pessoais** = o que você carrega (minério vale mais).
- **Fome** cai com o tempo e ao cavar (aviso quando passa de 25); zerou, você
  **desmaia**. Com comida no inventário, **segure E por 5s** para comer e
  levantar; sem comida, só alguém te alimentando. **Buracos** prendem: peça socorro ou escale sozinho (segurar o
  clique em você mesmo, demora).
- **Baú da equipe** (centro do mapa): escolha o item e **segure o clique no
  baú** para depositar, um por vez. Depositar tira pontos seus e soma no
  coletivo; sacar faz o contrário. **Baú na meta = todos passam**, mesmo sem
  a meta pessoal.
- **Doar** (painel): escolha item e quantidade (1, metade, tudo) — funciona à
  distância.
- **Socorro:** "Pedir socorro" avisa a todos; cada um responde "Vou ajudar"
  ou "Não posso". Não responder também é uma resposta.
- Seu **tempo** no mundo é pessoal (padrão 4 min). Ao acabar — ou em "Sair do
  mundo" — passa a porta quem bateu a **meta pessoal** ou se o **baú** estiver
  na meta. Senão perde energia e pode entrar de novo (com o mapa como está).
- O chat fica **aberto** no mundo (combinar é parte do jogo).

Os atos formais (doar, alimentar, resgatar, depositar, sacar além do que
depositou, levar o bloco que outro cavava, aceitar/recusar/ignorar socorro e
cumprir ou não o que aceitou) ficam registrados. Quanto cada um pesa não é
divulgado.

---

## 7. O que o jogo lembra de você (*destino*) — só para o testador

Por trás dos enigmas há um **motor de destino**: regras ocultas de prêmio e
punição avaliadas sobre o seu **histórico de atos** (ajudou, recusou,
atravessou, traiu). O jogador **nunca vê a regra** — vê só a
**consequência**, quando ela chega, junto de um **recibo** que mostra qual
ato a causou. A consequência pode chegar **depois**, até em outra sala, e
**segue a sua conta** — não zera quando você recomeça.

No protótipo atual isso está ligado numa fatia mínima (um eixo,
"Solidariedade"; um efeito visível). Pesos, janelas, limiares e
probabilidades **vivem em tabela** e não são divulgados — nem aqui.

Para o teste, o que importa observar:

- O jogador percebe que **algo mudou** e entende **por causa de quê**?
- A escolha de ajudar ou seguir em frente **pesa**, mesmo sem o jogador
  saber a regra?
- O recibo aparece **só para o afetado**?

---

## 8. Situações comuns

**Perdi a conexão no meio.**
Conta: o progresso da sala (porta e energia) fica salvo; ao voltar você
retoma de onde parou — inclusive dentro de uma fase, com o que a equipe já
resolveu. Anônimo: perde tudo.

**Minha energia zerou.**
Você trava naquele enigma até **alguém te doar energia** (seção 6.6) — aí
você volta na hora — ou até se recuperar jogando bem numa próxima sala. Se
ninguém em pé sobrar na sala, é **game over** (seção 6.4). Não há
recuperação passiva; ajuste `piso_energia` se precisar destravar os testes.

**Corri na frente e caí sozinho numa fase.**
É o risco de acelerar: você encara o trecho coletivo sem ninguém para
dividir, gastando a sua energia. Se aguentar até os outros chegarem, eles
ajudam a fechar a fase (ou te doam energia).

**Cliquei "Desistir" — por que perdi 20% e ainda tenho que responder?**
"Desistir" só compra a resposta; digitar e enviar continua com você. E se
havia alguém à frente para perguntar, a escolha conta contra você em
silêncio (seção 6.7).

**Sou anônimo e saí sem querer.**
Não dá para recuperar. Tudo que era seu naquela sessão foi apagado. Para
manter progresso, use uma conta.

---

## 9. Glossário

| Termo | O que é |
|---|---|
| **Sala** | O espaço onde um grupo joga. Tem um código e um link. |
| **Sessão** | O registro da sala no banco (uma por código). |
| **Porta** | Um enigma solo na sua sequência. |
| **Fase** | Um trecho de enigmas resolvidos coletivamente (`enigma.fase` no catálogo). |
| **Hall** | Tela de espera entre portas. |
| **Enigma** | O desafio: pergunta de texto ou página interativa. |
| **Energia** | Recurso pessoal de 0 a 100, que segue a conta entre salas. |
| **Doação** | Transferência de energia de um jogador para outro. |
| **Desistir** | Pagar `custo_desistir` % para o jogo revelar a resposta de um enigma. |
| **Game over** | Fim da sala quando ninguém em pé resta e nem todos concluíram. |
| **Caráter** | Marcas positivas/negativas de comportamento social registradas no jogo. |
| **Recibo** | O texto que mostra qual ato causou uma consequência do destino. |
| **Destino** | O sistema oculto de prêmio/punição sobre o histórico do jogador. |
| **Anfitrião** | Quem criou a sala; único que inicia o jogo. |

---

## 10. Pontos ainda em aberto

- **Nome do jogo** — "Jogo da Vida" é o rótulo do protótipo, não decisão.
- **Tom / ficção** — este texto está seco e factual. Falta a voz do mundo.
- **Posição da fase na sequência** — hoje vem do `enigma.ordem` do trecho
  (a fase entra pela posição do menor `ordem` dos seus enigmas). Um
  parâmetro de posição explícito fica para depois.
- **Doação / desistir** — valores fixos (`doacao_energia`, `custo_desistir`),
  sem limite de repetições, sem "não doar". Doador pode se zerar doando.
  Rever se algo disso incomoda nos testes.
- **Reconexão numa fase** — retoma o tabuleiro, mas não reabre o enigma
  específico em que você estava digitando.

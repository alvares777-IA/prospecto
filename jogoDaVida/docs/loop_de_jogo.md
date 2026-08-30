# Loop de jogo — Descoberta coletiva e o dilema

*Registrado em: 2026-08-18*
*Estado: definição central. Resolve a questão em aberto mais urgente do GDD.*

---

## 1. O que foi definido

**Não há sistema de ajuda.** Nem tutorial, nem dica, nem objetivo escrito
na tela.

Os jogadores caem no mundo escolhido e precisam **conversar entre si**
para descobrir o que fazer, vencer obstáculos e sobreviver.

O caráter se prova numa escolha concreta e recorrente:

> Voltar para ajudar alguém — perdendo tempo e correndo risco —
> ou seguir em frente, ganhando tempo sem risco.

---

## 2. Por que isto resolve o projeto inteiro

Este era o buraco do GDD: *o que os jogadores fazem nas salas?* O motor
de destino estava medindo ações que ainda não existiam.

A resposta chegou junto com três outras coisas de graça:

**A escassez do P01 ficou concreta.** Não é uma barra de energia
inventada para justificar escolhas. É **tempo e risco** — recursos que
qualquer pessoa entende sem explicação, e que não precisam de nenhum
sistema novo. O pilar deixa de ser abstrato.

**A cooperação ficou custosa por natureza.** O motor de destino sempre
precisou que ajudar doesse. Aqui dói sozinho, sem regra artificial: quem
volta chega depois e chega mais exposto.

**A conversa virou o jogo.** Não é recurso de apoio, é a mecânica
principal. E isso torna o protótipo 2D não apenas suficiente, mas
adequado — texto e salas são exatamente o que essa ideia precisa.

---

## 3. O conhecimento é o recurso realmente escasso

Ao tirar o tutorial, você transformou **saber o que fazer** no bem mais
valioso do jogo. E ele não está em lugar nenhum do sistema: está
distribuído entre os jogadores.

Isso produz coisas que nenhum sistema de destino conseguiria forçar:

- Quem descobriu algo decide se conta ou guarda
- Contar custa tempo — o mesmo tempo do dilema
- Mentir sobre o que se sabe passa a ser possível, e é uma traição que
  não precisa de mecânica nenhuma para existir
- Jogadores veteranos ensinando novatos é cooperação real, com custo real

O último item é o mais valioso: **ensinar um novato é um ato cooperativo
caro e voluntário.** Se o motor de destino registrar isso, você tem um
sistema que recompensa exatamente o comportamento que mantém uma
comunidade viva.

---

## 4. O que o dilema precisa para continuar funcionando

Um dilema que sempre tem a mesma resposta certa deixa de ser dilema.
Quatro condições:

### O risco precisa ser real

Se voltar nunca custa de verdade, todo mundo volta e não há escolha.
Alguma fração das tentativas de resgate precisa **falhar** — e às vezes
custar os dois jogadores. Sem isso, é decoração moral.

### Seguir em frente precisa compensar de verdade

Se abandonar não trouxer vantagem palpável, ninguém abandona, e o motor
de destino fica sem material. A vantagem de tempo precisa ser sentida na
mesma sessão.

### A separação precisa acontecer sozinha

O dilema só existe se jogadores ficarem para trás com frequência
natural: alguém preso, ferido, atrasado, perdido. Isso exige que o mundo
produza separação — não que ela seja roteirizada uma vez por fase.

### Quem fica para trás não pode sair do jogo

Este é o ponto de retenção mais delicado, e o mesmo problema já apontado
no cativeiro. Ser abandonado tem que ser **uma situação**, não uma tela
de espera. Quem ficou precisa de verbos próprios: pedir ajuda, tentar
sair sozinho, sabotar, observar, guardar o que viu para depois.

Se ser abandonado for entediante, o jogo pune duas vezes quem já perdeu —
e essa pessoa não volta.

---

## 5. Não ter tutorial não é não ter entrada

Há uma diferença entre **não guiar** e **não acolher**.

Um jogador que cai num mundo sem entender nada, sem ninguém por perto e
sem nenhuma pista de affordance, não sente mistério — sente que o jogo
está quebrado. Fecha em dois minutos.

O que substitui o tutorial:

- **O mundo ensina pela forma.** Uma porta parece porta. Uma alavanca
  pede para ser puxada. O primeiro obstáculo deve ser resolvível sozinho,
  para provar ao jogador que ele consegue.
- **Outro jogador ensina.** É a solução mais forte e a mais alinhada ao
  tema. Novatos nunca entram sozinhos.
- **Os verbos são visíveis, o significado não.** Coerente com o P03: o
  jogador vê que pode "voltar" e "seguir"; não sabe o que o sistema pensa
  disso.

Um jogo sem tutorial precisa de mais desenho de entrada, não menos.

---

## 6. A conversa é infraestrutura

Se conversar é o jogo, o chat deixa de ser recurso acessório e vira a
interface principal. Consequências:

**Se os jogadores usarem Discord, você perde o jogo.** Toda a coordenação
acontece fora do sistema, e o motor de destino fica cego. O chat interno
precisa ser bom o bastante para competir — ou o desenho precisa dar razões
para falar dentro do jogo (mensagens que só alcançam quem está na mesma
sala, por exemplo).

**Promessa quebrada é a traição mais forte que existe.** Se o chat estiver
dentro do sistema, "espera aí que eu volto" é um dado. Um recibo que
mostra a própria frase do jogador, ao lado do que ele fez em seguida, é a
coisa mais poderosa que este projeto pode produzir.

**Isso exige transparência.** Se conversas são registradas e podem
reaparecer em recibos, o jogador precisa saber disso desde o início — na
tela de entrada, não em termos de uso. E é preciso pensar em moderação:
canal aberto entre desconhecidos, sem ferramenta de bloqueio e denúncia,
vira problema rápido.

---

## 7. Contradição a resolver com a monetização

`docs/monetizacao.md` registrou anúncio recompensado como preço da
**dica do sistema**. Este documento elimina as dicas do sistema.

O anúncio ficou sem nada para vender. Três saídas:

| Saída | Comentário |
|---|---|
| Dicas existem, mas são raras e vagas | Contradiz o espírito da descoberta coletiva |
| O anúncio compra outra coisa | Cosmético, rever recibo antigo, tentativa extra num desafio |
| Sem anúncios | Modelo diferente: pago, doação, licenciamento |

A segunda é a mais coerente. Mas nada disso é urgente — nenhuma rede
aceita um protótipo sem público.

---

## 8. Efeito no protótipo

Boa notícia: **isto ficou muito mais barato de construir do que o
esperado.**

Um jogo de conversa, salas, obstáculos e escolhas de tempo e risco não
precisa de sprites, animação, física nem movimento em tempo real.
Precisa de:

- Salas como estado no servidor
- Presença de jogadores
- Chat por sala
- Verbos como botões, com custo de tempo
- Um relógio que torna o tempo caro
- Eventos indo para o Oracle

Tudo isso é Node, Socket.IO e DOM. Está inteiramente dentro do que você
já sabe fazer.

E significa que a **fase 3 do roteiro — o recibo — pode chegar em
semanas**, não meses. É lá que se descobre se o jogo existe.

---

## 9. Decisões pendentes

- O que são os obstáculos, concretamente? Enigma, perigo físico,
  negociação, recurso a dividir?
- Como um jogador fica para trás? Por escolha alheia, por acidente, por
  falha própria?
- Qual o custo exato de voltar — tempo fixo, risco probabilístico, ambos?
- Quantos jogadores por mundo? A pressão social muda completamente entre
  4 e 12.
- Chat interno é global, por sala, ou por proximidade?
- Conversas entram nos recibos? (se sim, transparência obrigatória)
- Como um novato entra num mundo já em andamento?
- O que o anúncio vende, se não há dicas?

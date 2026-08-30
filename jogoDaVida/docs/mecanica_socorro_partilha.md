# Socorro, pacto e partilha — os atos que o motor mede

*Registrado em: 2026-08-18*

---

## 1. O que foi definido

**Força não atravessa a morte.** Cada encarnação começa fraca. O destino
atravessa; o corpo não.

**A conversa por voz fica sempre ativa e não é registrada.** Os jogadores
falam livremente.

**O que fica registrado são atos formais**, mediados por botão:

- **Pedido de socorro** → e sua **resposta**
- **Oferecimento de ajuda** → e seu **aceite**
- **Compartilhamento de itens** — água, comida

---

## 2. Por que esta é a melhor decisão do projeto até agora

Ela resolve, de uma vez, o problema que a voz tinha criado.

Eu havia apontado que o recibo perderia sua melhor munição: em texto,
"espera aí que eu volto" é uma string gravada; em voz, seria preciso
armazenar áudio ou transcrever. **Você encontrou uma terceira saída, e
ela é melhor que as duas.**

O ato formal é superior à frase gravada em todos os aspectos:

| | Frase gravada | Ato formal |
|---|---|---|
| Ambiguidade | "Eu disse isso de brincadeira" | Nenhuma. Ele clicou em aceitar. |
| Privacidade | Grava conversa; exige consentimento | Não grava nada além do clique |
| Custo | Armazenamento ou transcrição | Alguns bytes |
| Erro | Transcrição erra e o recibo mente | Impossível errar |
| Contestação | "Você tirou do contexto" | Não há contexto a tirar |

E a voz continua livre, que era o ponto de ter voz. Os jogadores
conversam, negociam, mentem, prometem — nada disso é gravado. **Só o que
foi formalmente assumido conta.**

Isso também é fiel ao tema: o mundo simulado não escuta o que você diz.
Ele registra o que você fez.

---

## 3. A promessa virou estrutura de dados

Um pedido de socorro aceito é um **pacto**. E um pacto tem estados:

```
PEDIDO
  ├─ ignorado          (ninguém respondeu)
  ├─ recusado          (resposta honesta: não vou)
  └─ aceito → PACTO
                ├─ cumprido      (chegou e ajudou)
                ├─ tentado       (moveu-se, não chegou a tempo)
                └─ rompido       (aceitou e nunca saiu do lugar)
```

**A distinção entre `tentado` e `rompido` é obrigatória.** Quem voltou e
morreu no caminho não traiu — arriscou e perdeu. É exatamente o
comportamento que o jogo quer premiar. Se o motor confundir os dois, ele
pune o herói.

E a distinção é objetivamente mensurável: o jogador se moveu em direção
ao outro depois de aceitar? O servidor sabe.

### Ignorar e recusar não são a mesma coisa

Recusar é honesto: o jogador diz não, e o outro pode procurar ajuda em
outro lugar imediatamente.

Ignorar deixa o outro esperando por algo que não vem — custa a ele o
recurso mais caro do jogo, que é tempo.

**Recusar deve pesar menos que ignorar.** É contraintuitivo e é a coisa
certa: o jogo recompensa quem se posiciona, mesmo quando a posição é
egoísta. Isso produz jogadores que falam, que é o que a voz existe para
provocar.

`rompido` é o mais grave dos três, e por larga margem. Aceitar e não ir
é a única forma de traição que consome o tempo do outro **em cima de uma
garantia**.

---

## 4. Água e comida — a escassez do P01 finalmente concreta

Itens consumíveis e transferíveis são o pilar P01 na sua forma mais
limpa. Não precisa de nenhuma justificativa: água é finita, você precisa
dela, dar significa não ter.

O que isso adiciona que "voltar para ajudar" não adicionava:

**Não há ambiguidade de intenção.** Voltar pode ser altruísmo ou pode ser
conveniência de rota. Dar metade da própria água não tem segunda leitura.

**Funciona à distância e sem risco físico.** Um jogador pode ser generoso
sem coragem, ou corajoso sem ser generoso. São dois eixos diferentes de
caráter, e o motor pode medir os dois separadamente.

**Cria o acúmulo silencioso.** Quem nunca compartilha e sempre recebe
constrói um histórico que ninguém percebe no momento — e que o motor
percebe.

### Três condições para funcionar

1. **A escassez precisa apertar de verdade.** Se ninguém nunca fica sem
   água, compartilhar é gratuito e o gesto não vale nada. Precisa haver
   sessões em que alguém realmente passa mal.
2. **A quantidade doada precisa ser escolhida.** Dar tudo, metade ou um
   gole são atos morais diferentes. Um botão único de "compartilhar"
   desperdiça a mecânica.
3. **O doador deve ver o próprio estoque; o receptor, não.** Isso abre a
   generosidade falsa: dar o resto de uma ração quase vazia parece
   generoso e não custa nada. É material riquíssimo para o motor — e para
   um recibo futuro.

---

## 5. Mundo livre — nenhum botão é bloqueado

**Decisão firme: o jogo não trava ação nenhuma.** Qualquer jogador pode
pedir socorro a qualquer momento, ajudar quem quiser, quantas vezes
quiser, doar o que tiver. A voz e o texto são livres e não registrados,
como uma sala de Discord. O que conta é o clique.

### Por que não há risco de fraude

**Ajudar já custa a coisa mais cara do jogo.** Quem volta perde tempo,
corre risco e não ganha força. Não existe farm gratuito de cooperação: o
preço é ficar para trás.

Isso significa que o jogador que ajuda o tempo todo não está explorando
o sistema — está **escolhendo uma forma de jogar**. É o santo que nunca
avança. Não é exploit; é personagem, e provavelmente um dos mais
interessantes de observar.

As proteções que já existem no schema (janela deslizante, teto de
ocorrências, alvo distinto) bastam, e nenhuma delas bloqueia nada. Elas
apenas fazem o retorno diminuir.

### O que substitui a trava: peso variável e invisível

Nada é proibido, mas nem todo ato pesa igual. O **contexto** entra como
multiplicador na regra, em tabela — nunca como impedimento na interface:

| Situação | Peso |
|---|---|
| Socorrer quem estava ferido, sem água ou preso | Cheio |
| Socorrer quem estava bem | Reduzido |
| Doar o último gole | Cheio |
| Doar de um estoque intacto | Reduzido |
| Ajudar sempre a mesma pessoa | Decrescente |

O jogador nunca é avisado disso. Ele clica, o ato acontece, o mundo
segue. É exatamente o P02 e o P03 operando: **o verbo é público, o peso é
oculto.**

E isso cria material que uma trava destruiria: ajudar repetidamente quem
não precisava, enquanto se ignora quem precisava, é um retrato de caráter
que o banco consegue desenhar — e que um recibo, um dia, consegue mostrar.

`situacao_apuro` deixa de ser um portão e passa a ser um **modificador**.

---

## 6. Força não atravessa — e isso é uma boa assimetria

O destino atravessa a morte. A força, não.

Isso produz uma figura específica e interessante: **o veterano em corpo
novo.** Alguém com um histórico longo — dívidas e créditos pendentes —
que recomeça sem nenhuma vantagem física.

Duas consequências:

- Não há acúmulo infinito de poder. A morte reseta a vantagem e preserva
  a responsabilidade. É o oposto do que quase todo jogo faz, e é
  coerente com o tema.
- Um jogador com destino pesado renasce fraco e **ainda deve**. A
  consequência pode chegar no pior momento possível — quando ele está
  mais vulnerável. O motor não precisa fazer nada de especial para isso
  acontecer; é consequência natural do desenho.

---

## 7. Deltas de modelo de dados

| Adição | Papel |
|---|---|
| `item` | Catálogo: água, comida |
| `inventario` | Quantidade por encarnação |
| `transferencia_item` | Doador, receptor, item, quantidade, saldo do doador no momento |
| `situacao_apuro` | Estado do jogador no momento: ferido, doente, sem água, preso. **Modificador de peso, nunca portão.** |
| `pedido_socorro` | Solicitante, situação, momento, prazo |
| `resposta_pedido` | Respondente, tipo (ignorado, recusado, aceito) |
| `pacto` | Pedido aceito, com estado final: cumprido, tentado, rompido |

Tipos de evento novos: `PEDIU_SOCORRO`, `RECUSOU`, `IGNOROU`,
`ACEITOU_PACTO`, `CUMPRIU_PACTO`, `TENTOU_CUMPRIR`, `ROMPEU_PACTO`,
`DOOU_ITEM`, `RECEBEU_ITEM`.

O campo **saldo do doador no momento da doação** é o que permite
distinguir generosidade real de generosidade barata. Sem ele, dar o
último gole e dar de um estoque cheio são idênticos no histórico.

`ignorado` não é gerado por clique — é gerado pelo **vencimento do
prazo** do pedido. Um job ou a própria avaliação do pedido resolve isso.
Vale registrar: ausência de ação é ação.

---

## 8. Decisões pendentes

- Prazo de um pedido de socorro antes de virar `ignorado`
- Peso de um socorro a quem não estava em apuros: reduzido ou zero?
- Um pedido é dirigido a alguém ou é aberto a todos na sala?
- Quantos podem aceitar o mesmo pedido?
- Quem cumpre um pacto que outro rompeu ganha algo extra?
- A quantidade doada é livre ou tem passos fixos?
- O receptor sabe quanto o doador tinha? (recomendação: não)
- Recusar em voz alta, sem clicar no botão, conta como ignorar?
  **(o mais importante da lista — é a fronteira entre a voz livre e o
  registro formal)**

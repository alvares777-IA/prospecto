# Mecânica — Eras, viagem no tempo, guerras e renascimento

*Registrado em: 2026-08-18*
*Estado: especificação. Fora do escopo da fatia vertical.*

---

## 1. O que foi definido

**Salas explicitadas.** Ao descrever uma sala, o jogo deixa claro o que
conta como traição e o que conta como ajuda naquele contexto. Isso
resolve a ambiguidade que tornaria o recibo contestável — a regra
continua oculta, mas os **verbos** são públicos.

**Eras.** O mundo tem um cenário de época, escolhido pelo grupo que o
populou: Grécia Antiga, anos 1800, era atual, ano 2500.

**Viagem no tempo.** Desafios vencidos dão à equipe o direito de viajar
para outra era. Ao viajar, **algumas habilidades se perdem e outras são
atribuídas** — decidido pelo banco, não pelo jogador.

**Fases narrativas.** Cada fase tem uma história própria a ser cumprida.

**Guerras.** Grupos desconhecidos entram em conflito. Jogadores podem ser
**levados como escravos** ou podem **se aliar ao grupo vencedor** e passar
a integrá-lo.

**Morte e renascimento.** Um jogador que morre renasce — no mesmo grupo
ou em outro, à escolha dele. Mas **ele não escolhe como nasce**. As
condições iniciais são sorteadas por uma fórmula no banco: a
aleatoriedade da vida.

---

## 2. A ideia mais forte do conjunto

**Você escolhe onde nascer, não como nascer.**

Isso é o pilar P01 (*alocação de recursos escassos*) levado à sua
conclusão: a primeira alocação, a que mais importa, você não fez. Recebeu.

E é a única mecânica do projeto que responde à premissa da simulação de
dentro dela — se há regras invisíveis governando o mundo, a mais
invisível de todas é a que decidiu com o que você começou.

Isso também abre a possibilidade mais interessante do modelo de dados: o
destino acumulado pode **atravessar encarnações**. O jogador morre, o
saldo não. Ele recomeça com outro corpo, outra era, outro grupo — e a
mesma conta pendente. Tecnicamente é trivial, porque `destino_saldo`
sempre esteve ligado ao jogador, não à sessão. Narrativamente, é o
coração do jogo.

### O perigo dessa ideia

Aleatoriedade de nascimento em jogo multiplayer competitivo é a fonte
clássica de "este jogo é injusto".

A distinção que salva a mecânica:

| Aleatorizar | Efeito |
|---|---|
| **O que** você recebe | Variedade lateral — habilidades diferentes, todas viáveis |
| **Quanto** você recebe | Vantagem vertical — alguns nascem melhores |

Aleatorize o *quê*, nunca o *quanto*. Nascer rápido e frágil versus
nascer lento e resistente é interessante. Nascer com 40% menos de tudo é
motivo para fechar o jogo.

Exceção defensável: se nascer em desvantagem **conceder algo em troca** —
mais destino por ação, progressão mais rápida, acesso a rotas fechadas
para quem nasceu bem. A desvantagem vira escolha de dificuldade, não
punição.

---

## 3. O problema central: quatro eras são quatro jogos

Cada era exige seu próprio conjunto de assets: arquitetura, vestuário,
objetos, som, iluminação, animação. Grécia Antiga e ano 2500 não
compartilham nada visualmente.

Para um desenvolvedor solo aprendendo Unity, isso não é uma
funcionalidade — é o item que decide se o projeto termina.

### Três caminhos, em ordem de viabilidade

**A — Uma era no lançamento, as outras como expansão.**
Escolha a mais barata de produzir (provavelmente a era atual: assets
abundantes, referências fáceis, público reconhece sem esforço). Viagem no
tempo existe na ficção desde o início, mas o portal temporal fica
fechado. Abre quando houver conteúdo.

**B — Eras como reskin do mesmo esqueleto.**
As mesmas salas, os mesmos verbos, a mesma estrutura de desafio — trocando
apenas materiais, props e som. Uma sala de julgamento é uma sala de
julgamento na Ágora, no tribunal de 1800 ou no conselho de 2500. Isso
multiplica conteúdo por quatro a um custo de arte, não de programação.

**C — Eras como abstração estilizada.**
Renuncie ao realismo histórico. Silhuetas, cores e formas sugerindo
época, sem reconstrução fiel. Muito mais barato, e envelhece melhor que
realismo mal executado.

**B e C combinam.** É provavelmente o caminho: mesmo esqueleto, arte
estilizada, uma era pronta antes da segunda começar.

---

## 4. Escravidão: a mecânica que precisa de mais cuidado

Um jogador capturado passa a ser escravo de outro grupo. Duas perguntas
precisam de resposta antes de qualquer linha de código.

### O que o jogador escravizado faz nos próximos vinte minutos?

Se a resposta for "obedece", "espera" ou "trabalha sem escolha", a
mecânica não é sobre servidão — é sobre remover um jogador do seu jogo.
Ele fecha o cliente e não volta. Perda de agência é a forma mais rápida
de perder jogador.

Para funcionar, a condição precisa ter **verbos próprios**: sabotar por
dentro, ganhar a confiança dos captores, organizar fuga com outros
cativos, negociar informação. Se o estado de escravo tiver um leque de
ações tão rico quanto o de livre — só que diferente —, vira uma das
partes mais memoráveis do jogo. Se não tiver, vira tela de espera.

### Quem é o captor?

Escravidão imposta por **facção controlada pelo sistema** é narrativa.
Escravidão imposta por **outro jogador**, com controle sobre o que a
vítima pode fazer, é uma ferramenta de assédio — e vai ser usada como
tal, principalmente contra jogadores novos.

Recomendação: os captores são grupos do sistema. Jogadores podem se
aliar a eles, se beneficiar da situação, até decidir o destino de um
cativo dentro de opções limitadas — mas ninguém recebe controle direto
sobre outro jogador.

Duas salvaguardas obrigatórias:

- **Duração limitada e conhecida.** O cativo sabe quanto falta, mesmo que
  possa encurtar agindo.
- **Saída sempre disponível.** Fuga, resgate, morte voluntária — sempre
  há um verbo que devolve agência.

### Nota sobre a Steam

Escravidão como tema em contexto histórico e narrativo é assunto
tratado normalmente em jogos. O que atrai revisão é representação
gratuita ou celebratória. Um sistema onde a servidão é condição a ser
superada, com agência preservada, não é problema. Vale manter a
descrição da loja explícita sobre o enquadramento.

---

## 5. Deltas de modelo de dados

O schema atual não cobre nada disto. Adições necessárias, em blocos
independentes:

### Eras e habilidades

| Tabela | Papel |
|---|---|
| `era` | Grécia Antiga, 1800, atual, 2500 — código, nome, ambientação |
| `habilidade` | Catálogo de habilidades, com era de origem |
| `matriz_transicao` | Ao ir da era A para a B: probabilidade de perder cada habilidade, probabilidade de ganhar cada outra |

A viagem no tempo é uma consulta à `matriz_transicao` — dado, não código.
Rebalancear o que se perde ao viajar é `UPDATE`, coerente com P04.

### Grupos e guerra

| Tabela | Papel |
|---|---|
| `grupo` | Facções, do sistema ou formadas por jogadores |
| `grupo_membro` | Vínculo, com data de entrada e forma de entrada (nasceu, aliou-se, foi capturado) |
| `conflito` | Guerras: partes, era, fase, desfecho |
| `condicao_jogador` | Estado atual: livre, cativo, aliado recente — com prazo |

O campo *forma de entrada* importa: um jogador que se aliou ao grupo
vencedor depois de perder deve ser tratado diferente de quem nasceu ali.
É material narrativo e material para o motor de destino.

### Encarnação — a peça central

| Tabela | Papel |
|---|---|
| `encarnacao` | Uma vida. Jogador, era, grupo, atributos sorteados, nascimento, morte |
| `matriz_nascimento` | A fórmula: distribuição dos atributos iniciais por era e grupo |

`jogador` é a conta e persiste. `encarnacao` é a vida e termina. **O
destino fica ligado ao `jogador`**, não à encarnação — é isso que faz a
conta pendente atravessar a morte.

`matriz_nascimento` é onde a "aleatoriedade da vida" vive como dado
auditável. E, como todo sorteio deste projeto, **o valor sorteado é
gravado** — se um jogador perguntar por que nasceu assim, existe resposta.

---

## 6. Ordem sugerida de implementação

Cada bloco é independente e testável sozinho. Fazer nesta ordem:

1. **Encarnação e renascimento** — funciona com uma era e um grupo.
   Testa a ideia mais forte primeiro, com o menor custo de arte.
2. **Grupos e filiação** — sem guerra ainda; apenas pertencer a algo.
3. **Traição e cooperação com recibo** — precisa de grupo para existir.
4. **Conflito entre grupos** — guerra, com desfecho e mudança de filiação.
5. **Condição de cativo** — só depois que o leque de verbos existir.
6. **Segunda era e viagem no tempo** — o mais caro. Por último.

O item 1 sozinho já é um jogo. Os demais são camadas.

---

## 7. Decisões pendentes

- O destino atravessa a morte integralmente, parcialmente, ou some?
- Se atravessa: o jogador sabe disso, ou descobre pelos recibos?
- Nascer em desvantagem concede alguma compensação? Qual?
- Quantas eras no lançamento? (recomendação: uma)
- Cativeiro é imposto por facção do sistema ou por jogadores?
- Quais os verbos disponíveis para um cativo?
- Fases narrativas são lineares, ou o grupo escolhe a ordem?
- Um grupo pode viajar no tempo e encontrar outro grupo já estabelecido
  naquela era?

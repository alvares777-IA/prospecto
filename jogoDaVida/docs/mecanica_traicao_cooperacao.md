# Mecânica — Traição, cooperação e revelação diferida

*Registrado em: 2026-08-18*
*Estado: especificação. Não implementado, fora do escopo da fatia vertical.*

---

## 1. O que foi definido

**Objetivo central:** o jogo existe para produzir cooperação entre
jogadores.

**Estrutura de times:** existem equipes. Em certos momentos, equipes se
enfrentam.

**Traição:** um jogador pode trair a própria equipe e receber um
**benefício imediato**. O ato fica registrado no banco.

**Consequência diferida:** em um momento aleatório posterior, o banco
dispara um prejuízo ao traidor.

**O recibo:** no instante da punição, abre-se **apenas na tela do jogador
punido** uma imagem do que ele fez. A consequência nunca é obscura — ela
vem acompanhada da sua causa.

**Simetria:** ações de cooperação seguem o mesmo caminho. Ficam
registradas, são recompensadas em momento aleatório, e o jogador recebe o
mesmo tipo de recibo mostrando o que motivou a recompensa.

---

## 2. Por que isso é forte

Esta mecânica resolve sozinha a tensão central do projeto, registrada em
`design_principios.md` como P02 (*regra oculta, consequência visível*).

O problema de sistemas morais ocultos é que o jogador não consegue formar
hipóteses e conclui que o jogo é injusto. **O recibo elimina esse
problema sem revelar a regra.** O jogador aprende *que aquele ato
importava*, mas continua sem saber o peso, a janela, o limiar ou a
probabilidade. Ele ganha causalidade sem ganhar a fórmula.

O atraso faz o resto do trabalho. Consequência imediata é sistema de
pontos — o jogador otimiza. Consequência diferida com causa revelada é
memória: ele para de calcular e começa a lembrar.

E a assimetria entre o ato e a lembrança é o que dá peso. Trair é rápido.
O recibo chega quando a traição já saiu da sua cabeça.

---

## 3. O problema que precisa ser resolvido antes de implementar

### Punição certa mata a mecânica

Se a consequência é aleatória apenas no **momento**, mas certa na
**ocorrência**, traição deixa de ser uma decisão. Vira um imposto com
data indefinida. Jogadores racionais simplesmente param de trair, a
mecânica morre por desuso, e todo o sistema fica sem função.

Uma mecânica de traição só está viva enquanto trair **às vezes compensa**.

Três saídas possíveis, nenhuma decidida:

| Saída | Como funciona | Custo |
|---|---|---|
| **Probabilidade de nunca disparar** | Parte das traições nunca gera consequência | Simples; o jogador aposta de verdade |
| **Consequência menor que o benefício** | O ato compensa; o preço é social, não numérico | Exige que o custo real seja reputação |
| **Escala com reincidência** | A primeira sai barata; a quinta é devastadora | Melhor de todas, mas exige tuning delicado |

A terceira é a mais alinhada com os pilares: preserva a traição
ocasional como escolha legítima e pune o padrão, não o ato. Também casa
com a estrutura já existente de janela deslizante e reincidência no
schema.

**Decisão pendente.** Não implementar antes de escolher.

### Assimetria de volume entre traição e cooperação

Traição é **um** ato dramático. Cooperação é **muitos** atos pequenos.

Se ambos alimentam a mesma escala numérica, o traidor compensa
cooperando bastante — e a mecânica vira lavagem de reputação. Duas
consequências para o modelo:

- O peso da traição precisa ser desproporcional ao de uma cooperação
  isolada
- Provavelmente traição e cooperação devem viver em **eixos separados**,
  não como sinal positivo e negativo do mesmo eixo. Um traidor solidário
  é um personagem, não um saldo zero.

### O momento aleatório não pode ser cego

"Momento aleatório" precisa de restrições, ou o recibo aparece com o
jogador parado num corredor vazio — ou, pior, no meio de um confronto,
onde vira ruído e não revelação.

Restrições sugeridas para a elegibilidade do disparo:

- Nunca nos primeiros segundos após entrar numa sala
- Nunca durante confronto ativo entre equipes
- Preferencialmente na presença de outros jogadores (o silêncio de quem
  não sabe o que você está vendo é parte do efeito)
- Nunca duas revelações na mesma sessão para o mesmo jogador

---

## 4. Como funciona tecnicamente

### O recibo não é uma imagem armazenada

Guardar um print por traição custa banda, custa armazenamento (o banco
Always Free tem 20 GB), e — o mais grave — uma imagem capturada no
cliente é uma imagem que o cliente pode forjar.

**O recibo é reconstruído, não gravado.**

O evento já carrega um campo `contexto` em JSON. Basta ele levar o que é
preciso para o cliente redesenhar aquele instante:

```json
{
  "sala": "SALA_A",
  "pos_ator":  [12.4, 0.0, -3.1],
  "pos_alvo":  [11.8, 0.0, -2.6],
  "camera":    { "pos": [12.0, 1.7, -2.0], "rot": [0, 145, 0] },
  "testemunhas": [3, 7],
  "acao": "ABANDONOU_ALIADO_SOB_ATAQUE"
}
```

No momento da revelação, o cliente monta a cena a partir desses dados e
apresenta o instante — como uma lembrança, não como uma captura. Sai mais
barato, é impossível de forjar, e visualmente fica melhor: você controla
enquadramento, iluminação e tratamento.

Custo de armazenamento: alguns bytes de JSON por evento. Contra megabytes
por print.

### Deltas necessários no schema

O modelo atual (`db/destino_fatia_vertical.sql`) não cobre times nem
atraso. Precisa de:

| Adição | Para quê |
|---|---|
| `equipe`, `equipe_membro` | Só existe traição onde existe pertencimento |
| `fase` ou `confronto` | Marca os momentos em que equipes se enfrentam |
| `consequencia.dt_elegivel` | O momento aleatório. O outbox só entrega depois desta data |
| `consequencia.evento_origem_id` | Liga a consequência ao fato que a causou — é isto que alimenta o recibo |
| Tipos de evento: `TRAICAO`, `COOPERACAO` | Catálogo |
| Eixos separados para os dois | Ver assimetria, seção 3 |

O `dt_elegivel` é a peça central: a aleatoriedade do momento é decidida
**na hora de gravar a consequência**, não na hora de entregá-la. O
servidor de zona continua fazendo poll simples; o banco é quem sabe se já
chegou a hora.

### Fluxo completo

```
Jogador trai
   │
   ▼  POST /evento  (tipo=TRAICAO, contexto com dados de reconstrução)
Banco grava o fato
   │
   ├─► benefício imediato aplicado pelo servidor de zona
   │
   ▼
pkg_destino avalia regras
   │
   ▼
Grava consequência com dt_elegivel = agora + intervalo aleatório
   │
   ⏳  (minutos, horas ou sessões depois)
   │
   ▼  POST /consequencias — agora dt_elegivel já passou
Servidor de zona recebe: efeito + evento_origem_id + contexto
   │
   ▼
Aplica o prejuízo E abre o recibo — só na tela daquele jogador
```

---

## 5. Decisões pendentes

- Traição é certa, provável ou apenas possível de gerar consequência?
  (ver seção 3 — bloqueia a implementação)
- Traição e cooperação em eixos separados ou no mesmo?
- Qual é o benefício imediato da traição, concretamente?
- O que constitui traição, mecanicamente? Precisa ser um ato inequívoco,
  ou o recibo será contestado pelo jogador — e ele terá razão.
- Intervalo do `dt_elegivel`: minutos? horas? sessões futuras?
- O recibo é jogável (pode-se olhar em volta) ou é um plano fixo?
- Outros jogadores percebem que alguém recebeu um recibo?

---

## 6. Nota de escopo

Nada disso entra na fatia vertical. A fatia continua com duas salas,
quatro jogadores e uma regra.

Mas esta mecânica é uma boa **Fase 5** — é ela que justifica ter
construído o motor de destino como event sourcing auditável em vez de um
contador simples. O recibo só é possível porque cada fato ficou gravado
com seu contexto e cada sorteio ficou registrado.

# Documento de Design — Projeto sem nome

*Versão 0.2 — 2026-08-18*
*Estado: pré-produção. Protótipo 2D em navegador.*

**Mudança desde a v0.1:** o protótipo deixou de ser Unity 3D e passou a
ser JavaScript 2D em navegador. O objetivo é validar história e sistemas
antes de investir em produção 3D com equipe. Nada do design mudou — só o
meio. O backend não mudou uma linha.

---

## 1. Conceito

Um jogo multiplayer social ambientado em um **mundo simulado**. Jogadores
habitam ambientes conectados por **portais**, pertencem a **grupos**,
cooperam, traem, guerreiam, morrem e renascem.

Atravessando tudo isso há um **motor de destino**: regras ocultas de
premiação e punição avaliadas continuamente sobre o histórico de ações do
jogador. As regras nunca são explicadas. Suas consequências chegam
depois — às vezes muito depois — acompanhadas de um **recibo** que mostra
o ato que as causou.

**E o destino atravessa a morte.**

### A pergunta que o jogo faz

*Se você não sabe qual é a regra, como decide agir?*

### O momento que o jogo existe para produzir

Um jogador está em outra era, em outro grupo, em outro corpo. Abre na
tela dele — só na dele — a lembrança de uma traição que ele cometeu antes
de morrer. Tudo o mais no projeto é suporte para esse momento.

### Referências de tom

Ficção de mundo simulado em geral. **Deliberadamente evitando** o
vocabulário e os elementos identificáveis da franquia Matrix — "Zion",
agentes, pílulas, chuva de código verde. O conceito de simulação é livre;
esses elementos específicos não são, e viram risco de takedown depois do
lançamento. Vocabulário próprio desde o primeiro asset.

---

## 2. Pilares de design

### P01 — A vida é um jogo de alocação de recursos escassos

Toda escolha significativa é uma escolha entre alternativas que não podem
ser todas tomadas. Se o jogador pode ter tudo, ele não escolhe — coleta.

**Este pilar é a condição de funcionamento do motor de destino, não um
sistema paralelo a ele.** Ajudar quando ajudar é gratuito não revela
caráter; revela que havia um botão disponível. Ajudar quando isso consome
algo que você queria para si é decisão moral — e é isso que o motor mede.

**Regra prática:** nenhuma regra de destino entra no jogo sem que se
declare qual escassez ela pressupõe.

A conclusão máxima do pilar está no renascimento: **você escolhe onde
nascer, não como nascer.** A alocação que mais importa é a que você não
fez.

### P02 — Regra oculta, consequência visível

O jogador nunca sabe a regra. Mas sempre percebe que algo mudou, e por
causa de quê.

O **recibo** resolve isso sozinho: o jogador aprende *que aquele ato
importava* sem aprender o peso, a janela, o limiar ou a probabilidade.
Ganha causalidade, não a fórmula.

### P03 — Verbos públicos, regra oculta

A descrição de cada sala deixa **claro** o que conta como traição e o que
conta como ajuda naquele contexto. Sem isso, o recibo é contestável — e o
jogador que pensa "mas eu não fiz isso de propósito" tem razão, e vai
embora.

O que fica escondido é o peso, o momento e a certeza. Não o significado
do ato.

### P04 — O servidor é a única autoridade

O cliente reporta intenção. Nunca calcula destino, nunca julga, nunca
fala com o banco. Em um jogo cuja premissa é que existem regras
invisíveis governando o mundo, um cliente capaz de forjá-las destrói a
premissa junto com o balanceamento.

### P05 — Balanceamento é dado, não código

Pesos, janelas, probabilidades, limiares, matrizes de nascimento e de
transição entre eras vivem em tabela. Ajustar o jogo é `UPDATE`.

---

## 3. Sistemas

### 3.1 Motor de destino

```
Ação → servidor valida → POST /evento (fato bruto, imutável)
     → pkg_destino avalia regras ativas contra o histórico
        ├ teto de ocorrências na janela?  → descarta
        ├ alvo repetido na janela?        → descarta
        ├ sorteio vs. probabilidade       → grava o roll SEMPRE
     → lançamento no ledger + saldo
     → cruzou limiar (com histerese)? → consequência no outbox
        com dt_elegivel = agora + intervalo aleatório
     → servidor faz poll → aplica efeito + abre o recibo
```

Decisões e motivos:

- **Event sourcing.** Evento é fato imutável; nunca se corrige, apenas se
  compensa. Ledger é a verdade, saldo é cache reconstruível.
- **Guardar o dado, não só o resultado.** O valor sorteado é gravado
  mesmo quando a regra não pontuou. Regra oculta com aleatoriedade é
  indepurável sem isso.
- **Anti-farm desde o dia zero.** Janela deslizante, teto de ocorrências,
  alvo distinto. Com poucos jogadores, loops cooperativos aparecem em
  minutos.
- **Histerese nos limiares.** Entra em 30, sai em 20. Sem isso o mundo
  pisca na fronteira — e o piscar entrega a existência da regra.
- **Outbox com `SKIP LOCKED`.** O banco nunca chama o jogo; o servidor
  consome o que o banco decidiu.
- **Idempotência.** GUID no servidor, `evento_uid` único.

### 3.2 Traição, cooperação e o recibo

Detalhe em `docs/mecanica_traicao_cooperacao.md`.

Traição dá **benefício imediato** e fica registrada. Em momento aleatório
posterior, gera prejuízo — acompanhado do recibo. Cooperação segue o
mesmo caminho, com recompensa.

**O recibo é reconstruído, não gravado.** O `contexto` JSON do evento
carrega o necessário para redesenhar o instante. Nada de imagem
armazenada: custa banda, custa espaço, e imagem capturada no cliente é
imagem que o cliente pode forjar. No protótipo 2D, texto e nomes bastam.

O recibo aparece **só na tela do jogador afetado**.

**Bloqueio conhecido:** se a consequência é aleatória apenas no *momento*
mas certa na *ocorrência*, traição vira imposto com data indefinida e
ninguém mais trai. A saída preferida é **escalar com reincidência** — a
primeira traição sai barata, a quinta é devastadora. Pune o padrão, não o
ato. Decisão ainda pendente.

### 3.3 Grupos, guerra e cativeiro

Existem grupos. Em certos momentos, eles se enfrentam.

Um jogador derrotado pode ser **levado como cativo** ou **aliar-se ao
grupo vencedor**. A *forma de entrada* num grupo — nasceu, aliou-se, foi
capturado — é registrada, e é material tanto narrativo quanto para o
motor de destino.

**Cativeiro exige cuidado especial.** Se o cativo não tem verbos
próprios, a mecânica não é sobre servidão: é sobre remover um jogador do
jogo, e ele não volta. Precisa de leque próprio de ações — sabotar,
ganhar confiança, organizar fuga, negociar. Salvaguardas obrigatórias:
duração conhecida e saída sempre disponível.

Recomendação: captores são **facções do sistema**, não jogadores.
Jogadores podem se beneficiar da situação, mas ninguém recebe controle
direto sobre outro jogador — isso vira ferramenta de assédio.

### 3.4 Eras e viagem no tempo

Quatro ambientações: Grécia Antiga, anos 1800, era atual, ano 2500. O
grupo que popula um mundo escolhe a era.

Desafios vencidos dão à equipe o direito de viajar. Ao viajar, **algumas
habilidades se perdem e outras são atribuídas** — decidido pela
`matriz_transicao` no banco. Dado, não código.

**Risco número um do projeto.** Cada era é um conjunto completo de
assets. Mesmo em 2D, são quatro vocabulários visuais e quatro conjuntos
de conteúdo narrativo. Estratégia: **uma era primeiro**, viagem no tempo
existindo na ficção com o portal fechado, e as demais como reskin do
mesmo esqueleto de salas e verbos.

### 3.5 Morte e renascimento

O jogador morre e renasce. **Escolhe o grupo. Não escolhe as condições.**
`matriz_nascimento` sorteia os atributos iniciais — a aleatoriedade da
vida como fórmula auditável no banco.

**O destino atravessa a morte.** `destino_saldo` está ligado ao
`jogador`, nunca à encarnação. O corpo termina; a conta pendente não.

**Cuidado obrigatório:** aleatorizar **o quê**, nunca **quanto**. Nascer
rápido e frágil versus lento e resistente é variedade lateral. Nascer com
40% menos de tudo é motivo para fechar o jogo. Se houver desvantagem, ela
deve conceder algo em troca — mais destino por ação, rotas fechadas para
quem nasceu bem.

---

## 4. Stack técnica

### Protótipo (agora)

| Camada | Escolha | Motivo |
|---|---|---|
| Cliente | HTML/CSS/JS puro, Bootstrap, jQuery | Território do desenvolvedor; iteração em segundos |
| Tempo real | Socket.IO | Reconexão e fallback resolvidos |
| Servidor | Node.js + Express | Guarda o segredo, valida, chama o ORDS |
| Dados | Oracle ADB Always Free | Custo zero; onde o desenvolvedor é sênior |
| API | ORDS REST + OAuth2 | Expõe PL/SQL direto |
| Hospedagem | OCI Always Free (ARM) | Mesmo tenancy do banco |

**Ausentes de propósito:** Phaser, Canvas, React, TypeScript, build step.
Salas são `div`, verbos são `button`. Feio é aceitável; lento de iterar
não é.

### Produção (depois, se o protótipo provar)

Unity 6 LTS + Netcode for GameObjects + Steam, com equipe especializada.
Documentado na v0.1 deste arquivo, no histórico do Git.

### O que sobrevive à migração

**Todo o backend.** O contrato REST envia apenas fatos e recebe apenas
códigos opacos de efeito. O cliente 2D e o cliente 3D falam a mesma
língua. `destino_fatia_vertical.sql` e `destino_ords_setup.sql` não mudam.

### Contrato REST

Base: `/ords/game/destino/v1/`

| Método | Rota | Uso |
|---|---|---|
| POST | `/sessao` | Abre instância de sala |
| POST | `/presenca` | Jogador entrou; devolve saldo |
| POST | `/evento` | Registra fato de gameplay |
| POST | `/consequencias` | Consome outbox (marca entregue — não é GET) |
| PUT | `/sessao/:id/encerrar` | Fecha instância |

### Separação de estado

| Tipo | Onde | Frequência |
|---|---|---|
| **Vivo** — presença, turno, posição | Memória do Node | Contínuo |
| **Persistente** — conta, destino, encarnação | Oracle | Ao fim de ações |

---

## 5. Escopo do protótipo

### Fatia vertical

- **Duas salas** ligadas por um portal
- **Quatro jogadores**
- **Uma** regra de destino: reerguer um aliado acumula algo invisível
  que, ao cruzar um limiar, muda o mundo de forma perceptível
- **Um** efeito visível

Fora do escopo: eras, guerras, cativeiro, viagem no tempo, progressão,
economia, múltiplas regras.

### Teste de fumaça

Token OAuth → abrir sessão → gravar evento → confirmar `roll` no ledger.
Caminho completo validado antes de existir jogo.

---

## 6. Roteiro

| Fase | Entrega | Comentário |
|---|---|---|
| 0 | Ambiente + teste de fumaça | `docs/setup_ambiente.md` |
| 1 | Duas salas, quatro jogadores, presença via Socket.IO | Sem destino ainda |
| 2 | A regra única + o efeito visível | Integração ORDS |
| 3 | **O recibo** | É aqui que se descobre se o jogo existe |
| 4 | Encarnação e renascimento | A ideia mais forte, com o menor custo |
| 5 | Grupos e filiação | Sem guerra ainda |
| 6 | Traição e cooperação | Precisa de grupo para existir |
| 7 | Conflito entre grupos | Guerra, desfecho, mudança de filiação |
| 8 | Cativeiro | Só depois que o leque de verbos existir |
| 9 | Segunda era e viagem no tempo | O mais caro. Por último. |

Cada fase é testável sozinha. A fase 4 sozinha já é um jogo.

---

## 7. Critério de sucesso

**Não use "quando eu tiver certeza de que é viral".** Esse portão nunca
abre, e prende o projeto em polimento infinito.

O portão verificável:

> Os jogadores voltam para uma segunda sessão sem que eu peça, e falam do
> recibo entre eles.

Se isso acontecer, há algo. Se não acontecer em 2D, não aconteceria em 3D
— gráfico não conserta sistema social que não engaja.

E uma possibilidade real: se o protótipo funcionar de verdade, talvez ele
já seja o jogo. Isso não seria fracasso.

---

## 8. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Quatro eras é quatro vezes o conteúdo | Alta | Uma era primeiro; reskin do mesmo esqueleto |
| Traição certa mata a própria mecânica | Alta | Escalar com reincidência; decisão pendente |
| Cativeiro remove o jogador do jogo | Alta | Verbos próprios, duração conhecida, saída sempre |
| Nascimento aleatório lido como injustiça | Alta | Aleatorizar o quê, nunca o quanto |
| Regra oculta lida como injustiça | Média | P02 e P03: verbos públicos, recibo sempre |
| Loop de farm entre poucos jogadores | Média | Anti-farm no schema desde o início |
| Semelhança com a franquia Matrix | Média | Vocabulário próprio agora — barato hoje, caro depois |
| Escopo crescer antes da fase 3 | Média | O roteiro é a defesa; respeitar a ordem |
| Sem comunidade para "ORDS + jogo" | Baixa | Terreno desconhecido em gamedev, dominado em banco |

---

## 9. Questões em aberto

- Traição é certa, provável ou apenas possível de gerar consequência?
  **(bloqueia a fase 6)**
- Traição e cooperação em eixos separados ou no mesmo?
- Qual escassez do P01 será a primeira? (candidato: atenção)
- O que os jogadores **fazem** nas salas, além de ajudar e trair?
  **(a pergunta mais urgente — o motor mede ações que ainda não existem)**
- Nascer em desvantagem concede compensação? Qual?
- O jogador sabe que o destino atravessa a morte, ou descobre pelos
  recibos?
- Cativeiro imposto por facção do sistema ou por jogadores?
- Fases narrativas lineares ou ordem escolhida pelo grupo?
- Nome do jogo, e vocabulário próprio no lugar dos termos da Matrix

---

## Arquivos do projeto

| Arquivo | Conteúdo |
|---|---|
| `CLAUDE.md` | Instruções persistentes para o Claude Code |
| `docs/design_principios.md` | Pilares em detalhe |
| `docs/mecanica_traicao_cooperacao.md` | Traição, cooperação, recibo |
| `docs/mecanica_eras_renascimento.md` | Eras, guerra, cativeiro, renascimento |
| `docs/setup_ambiente.md` | Passo a passo de instalação |
| `db/destino_fatia_vertical.sql` | Schema e `pkg_destino` |
| `db/destino_ords_setup.sql` | Módulo REST, OAuth2, privilégios |

# CLAUDE.md

Instruções persistentes para o Claude Code neste repositório.
Leia antes de propor ou escrever qualquer coisa.

---

## Contexto do desenvolvedor

Sou programador **PL/SQL sênior**. Domino HTML, CSS, JavaScript, jQuery e
Bootstrap, e desenvolvo páginas dinâmicas com `htp.p` em procedures
Oracle. Sou **iniciante em Node.js**.

Isso significa:

- **Não explique**: SQL, PL/SQL, modelagem relacional, índices,
  transações, HTML, CSS, jQuery, seletores, DOM, Bootstrap.
  Vá direto ao ponto.
- **Explique**: o ecossistema Node — `npm`, `package.json`, módulos ES vs
  CommonJS, `async/await`, Promises, o event loop, middleware do Express,
  e como o Socket.IO gerencia conexões e salas.
- Meu instinto vem de **requisição/resposta com estado no banco**. O que
  mais vai me pegar é estado vivo em memória entre requisições e código
  que não roda na ordem em que está escrito. Quando isso aparecer,
  sinalize.
- Analogias com PL/SQL e com web tradicional funcionam melhor comigo do
  que analogias com gamedev.
- Prefiro entender a ter pronto. Se um atalho me esconder um conceito
  importante, avise antes de tomá-lo.

---

## O projeto

Protótipo **2D em navegador** de um jogo multiplayer social ambientado em
um mundo simulado. O objetivo do protótipo é validar **história e
sistemas**, não gráficos.

Existe um **motor de destino**: regras ocultas de premiação e punição
avaliadas sobre o histórico de ações do jogador. As regras não são
explicadas. Suas consequências chegam depois, acompanhadas de um
**recibo** que mostra o ato que as causou.

Se o protótipo provar que os sistemas engajam, uma versão 3D com equipe
especializada vem depois. **Todo o backend foi desenhado para sobreviver
a essa migração sem alteração.**

### Stack

| Camada | Tecnologia |
|---|---|
| Cliente | HTML + CSS + JavaScript puro (DOM), Bootstrap, jQuery |
| Tempo real | Socket.IO |
| Servidor | Node.js + Express |
| Backend de dados | Oracle Autonomous Database (Always Free) |
| API de dados | ORDS REST, OAuth2 client_credentials |
| Hospedagem | OCI Always Free (instância ARM) |

**Deliberadamente ausentes:** Phaser, Canvas, WebGL, React, TypeScript,
build step. Salas são `div`. Verbos são `button`. Feio é aceitável;
lento de iterar não é.

### Estado atual

Fatia vertical: 2 salas, 4 jogadores, **1** regra de destino. Nada de
eras, guerras, facções, renascimento ou viagem no tempo ainda.

---

## Regras invioláveis

Se uma solicitação minha conflitar com uma destas, **aponte o conflito
antes de implementar**.

1. **O navegador nunca decide nada.** Toda validação e toda regra de
   destino ficam no servidor. O cliente envia intenção e renderiza
   resultado.
2. **O navegador nunca fala com o ORDS.** Só o servidor Node. Qualquer
   credencial que chegue ao browser está vazada — o usuário abre o
   DevTools e lê.
3. **Nenhum segredo versionado.** Credenciais em `.env`, que está no
   `.gitignore`. Se você me vir prestes a commitar uma, interrompa.
4. **Regras de destino vivem em tabela, não em código.** Balanceamento é
   `UPDATE`. Nem o Node nem o navegador contêm pesos ou limiares.
5. **Eventos são imutáveis.** Nunca se corrige um evento; compensa-se com
   outro. O ledger é a verdade, o saldo é cache.
6. **Toda escrita de gameplay é idempotente.** GUID gerado no servidor,
   `evento_uid` único. Retry de rede não pode duplicar destino.
7. **O destino atravessa a morte.** `destino_saldo` está ligado ao
   `jogador`, nunca à sessão ou à encarnação. Nada de zerar no
   renascimento.

---

## Design

Antes de propor mecânicas, leia os documentos em `docs/`.

**Toda regra de destino precisa de uma escassez associada (P01).** Regra
sem custo associado vira farm. Se eu pedir uma mecânica sem definir o que
ela consome, pergunte qual é a escassez antes de escrever o código.

Diretrizes que valem como restrição técnica:

- Regra oculta, **consequência visível**. O jogador nunca sabe a regra,
  mas sempre percebe que algo mudou e por causa de quê.
- Aleatoriedade decide a **forma** e o **momento** da consequência.
- Todo sorteio é gravado (`destino_lancamento.roll`), mesmo quando falha.
  Regra oculta sem auditoria é indepurável.
- O **recibo** é reconstruído a partir do `contexto` JSON do evento, nunca
  é uma imagem armazenada. No 2D isso fica ainda mais barato: texto,
  posições e nomes bastam.
- O recibo aparece **só para o jogador afetado**.
- Anti-farm desde o início: janela deslizante, teto de ocorrências, alvo
  distinto.
- Os **verbos são públicos, a regra é oculta.** A descrição da sala deixa
  claro o que conta como traição e o que conta como ajuda ali. O que fica
  escondido é o peso, a janela, o limiar e a probabilidade.
- Evitar termos e elementos identificáveis da franquia Matrix ("Zion",
  agentes, pílulas, chuva de código verde). Vocabulário próprio.

---

## Estrutura do repositório

```
server/
  index.js          # Express + Socket.IO, ponto de entrada
  ords.js           # cliente ORDS: cache de token, POSTs
  sala.js           # estado vivo de cada sala (em memória)
  verbos.js         # o que se pode fazer e o que cada coisa significa
  outbox.js         # poll de /consequencias e entrega ao socket certo
public/
  index.html
  app.js            # DOM, eventos, render
  estilo.css
db/
  destino_fatia_vertical.sql
  destino_ords_setup.sql
docs/
  game_design_document.md
  design_principios.md
  mecanica_traicao_cooperacao.md
  mecanica_eras_renascimento.md
  setup_ambiente.md
.env                # NUNCA versionado
```

Código em `public/` que contenha regra de jogo é bug de arquitetura.
Aponte quando vir.

---

## Contrato com o backend

Base: `https://<adb>.oraclecloudapps.com/ords/game/destino/v1/`

| Método | Rota | Uso |
|---|---|---|
| POST | `/sessao` | Abre instância de sala |
| POST | `/presenca` | Jogador entrou; devolve saldo |
| POST | `/evento` | Registra fato de gameplay |
| POST | `/consequencias` | Consome outbox (marca entregue — não é GET) |
| PUT | `/sessao/:id/encerrar` | Fecha instância |

O servidor envia **apenas fatos**: GUID, tipo, ator, alvo, timestamp,
contexto. Nunca pontos. Recebe **códigos opacos** de efeito
(`LUZ_QUENTE`), mapeados no cliente para a apresentação. Assim regra nova
não exige deploy novo.

Token OAuth deve ser cacheado e renovado ~60s antes de expirar. Não pedir
token por evento.

---

## Separação de estado

| Tipo | Onde vive | Frequência |
|---|---|---|
| **Vivo** — quem está na sala, turno, posição | Memória do processo Node | Contínuo |
| **Persistente** — conta, destino, encarnação | Oracle | Ao fim de ações, nunca em loop |

Estado vivo some quando o processo reinicia, e isso é aceitável. Se algo
**não** pode sumir, vai para o banco.

---

## Convenções de código

- JavaScript moderno: `const`/`let`, `async/await`, módulos ES.
  Sem callbacks aninhados, sem `var`.
- Nomes de tabelas, colunas e packages em **português** (padrão do
  schema). Código JS em português também — é protótipo, e coerência
  interna vale mais que convenção.
- jQuery é permitido no cliente. No servidor, dependências mínimas:
  `express`, `socket.io`, `dotenv`. Antes de adicionar qualquer outra,
  pergunte.
- Toda chamada ao ORDS com timeout e tratamento de falha explícito. Se o
  banco não responder, a sala continua funcionando e o evento entra numa
  fila de retry — o jogo nunca trava esperando o banco.
- Nada de build step, transpilador ou bundler.

---

## Como quero trabalhar

- Mudanças pequenas e verificáveis. Prefiro três passos que eu entendo a
  um passo que eu aceito no escuro.
- Ao criar arquivo novo, diga onde ele entra e o que preciso rodar para
  ver funcionando.
- Se eu pedir algo que aumenta o escopo da fatia vertical, diga isso
  antes de implementar.
- Se houver um jeito mais simples que o que pedi, proponha antes.
- Este é um protótipo para testar **história e sistemas**. Se você se
  pegar sugerindo polimento visual, animação ou otimização de
  performance, provavelmente é a hora errada. Diga isso.

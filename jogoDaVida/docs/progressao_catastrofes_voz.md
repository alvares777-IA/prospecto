# Progressão, catástrofes e comunicação por voz

*Registrado em: 2026-08-18*

---

## 1. O que foi definido

### Ações

O jogador age por botões. Dois verbos centrais:

- **Voltar para a posição do jogador X**
- **Avançar para o próximo obstáculo**

### A vantagem de avançar

Avançar acumula **poder de domínio** e **força**. Força serve para vencer
obstáculos maiores.

Isso cria o arco moral mais interessante do projeto até agora:

> O jogador pode não ajudar ninguém no nível 1 para ganhar força, e
> depois usar essa força para ajudar alguém no nível 2.

### O histórico governa o futuro

As consequências de cada escolha se acumulam. Em algum momento, o motor
do banco dispara: **desafios mais difíceis** para uns, **passagens
livres** para outros.

### Catástrofes com escopos diferentes

O mundo produz problemas que atingem grupos de tamanhos distintos:

| Escopo | Exemplo |
|---|---|
| Todos | Terremoto |
| Vários | Vírus |
| Um | Doença |

### Comunicação

**Por voz**, não por texto.

---

## 2. Por que a progressão está bem desenhada

### Egoísmo instrumental não é egoísmo moral

"Não ajudo agora para poder ajudar melhor depois" é uma posição
defensável — e o jogador que a adota não está mentindo para si mesmo
necessariamente. Às vezes é verdade. Às vezes é desculpa que ele conta
para si.

O jogo não precisa decidir qual das duas é. **O histórico decide, depois,
pelo que ele efetivamente fez no nível 2.** Isso é infinitamente mais
interessante que um medidor de bem e mal.

E é exatamente o tipo de coisa que só um motor de event sourcing
consegue avaliar: a pergunta não é "ele ajudou?", é "ele cumpriu o que a
escolha anterior prometia?".

### O antídoto elegante para o acúmulo

Há um risco óbvio: quem avança sempre fica mais forte, ajuda menos, e
dispara na frente. Bola de neve.

A solução já está no que você descreveu — desafios mais difíceis para
quem acumulou desse jeito. Mas a **forma** desses desafios decide se
funciona ou se irrita:

| Punição | Efeito |
|---|---|
| Números maiores | O jogador forte simplesmente vence. Não ensina nada. |
| **Obstáculo que exige outra pessoa** | O forte descobre que força não basta. |

A segunda é a resposta certa. **A consequência de não ajudar é um
obstáculo que não se vence sozinho.** Poético e mecanicamente sólido: o
jogador precisa pedir ajuda a alguém que ele deixou para trás — e o motor
de destino não precisa dizer uma palavra.

"Passagem livre" funciona pelo mesmo princípio ao contrário: quem ajudou
recebe um caminho que dispensa ajuda. Não é vantagem numérica, é
autonomia.

### As catástrofes resolvem um problema pendente

O documento anterior apontou que o dilema só existe se jogadores ficarem
para trás **com frequência natural**, sem roteiro. As catástrofes fazem
exatamente isso:

- **Terremoto (todos)** — dispersa o grupo; ninguém sabe onde os outros
  estão
- **Vírus (vários)** — cria subgrupos com problemas próprios
- **Doença (um)** — cria o retardatário. É o gerador direto do dilema.

Recomendação: o alvo da catástrofe deve ser **parcialmente sorteado e
parcialmente destinado**. Nem sempre aleatório, nem sempre merecido — e o
jogador nunca sabe qual foi o caso. Isso é o motor de destino operando na
sua forma mais pura.

---

## 3. A voz muda o jogo — para melhor e para pior

### O que a voz melhora

**A traição passa a doer de verdade.** Abandonar um nome numa tela é
barato. Abandonar alguém cuja voz você ouviu pedindo para esperar é outra
coisa. O jogo inteiro existe para produzir esse peso — e a voz o entrega
de graça.

**A descoberta coletiva fica muito mais rápida e viva.** Coordenar por
texto sob pressão de tempo é lento e frustrante. Falar é natural.

**A conversa vira performance.** Hesitação, tom, silêncio — coisas que
texto não carrega. Quem mente por voz se expõe mais.

### O que a voz custa

**O recibo perde sua melhor munição.** Em texto, "espera aí que eu volto"
é uma string gravada, trivial de mostrar depois. Em voz, para ter o mesmo
efeito você precisa de uma das duas:

- **Gravar trechos curtos de áudio** em torno de eventos-chave. É viável
  — poucos segundos por evento — e o efeito emocional é bem maior que
  texto: o jogador ouve a própria voz. Custa armazenamento e exige
  consentimento explícito.
- **Transcrever** com reconhecimento de fala. Custa por minuto, tem
  latência, e erra em português com ruído de fundo. Uma transcrição errada
  num recibo é pior que nenhum recibo.

A primeira é a melhor. E note que é a única parte do projeto onde
**armazenar mídia se justifica** — o inverso do que decidimos sobre
imagens.

**Exclui gente.** Sem microfone, em lugar barulhento, com timidez,
gaguez, sotaque, ou simplesmente sem vontade de falar com estranhos —
muita gente não vai usar voz. E jogadores surdos ficam de fora
inteiramente.

**Recomendação forte: voz como principal, texto sempre disponível.** Não
como recurso de acessibilidade escondido no menu, mas como canal de
primeira classe. Quem só digita precisa conseguir jogar.

**Idioma fragmenta.** Texto se traduz; voz não. Mundos precisarão ser
agrupados por idioma.

**Moderação fica séria.** Canal de voz aberto entre desconhecidos é vetor
de assédio, e voz é muito mais difícil de moderar que texto. O mínimo
inegociável: silenciar por jogador, denunciar, e sair do canal. Se houver
menores de idade jogando, isso deixa de ser recomendação e vira
obrigação.

### O que a voz custa tecnicamente

Voz em navegador é **WebRTC**. O Node e o Socket.IO fazem a sinalização —
apresentar os pares uns aos outros — e o áudio trafega direto entre
navegadores.

| Jogadores por mundo | Arquitetura | Custo |
|---|---|---|
| Até ~5 | Malha P2P: cada um conecta com cada um | Nenhum servidor de mídia |
| 6 a 12 | Malha começa a sufocar upload de conexões domésticas | Precisa de SFU |
| Acima disso | SFU obrigatório | Servidor dedicado, CPU e banda |

Um SFU (mediasoup, Janus, LiveKit) é infraestrutura de verdade — não cabe
no Always Free e não é território iniciante em Node.

Dois detalhes que sempre pegam:

- **STUN é grátis, TURN não.** Uma fração das conexões não fecha direto e
  precisa de um servidor relay. Sem TURN, alguns jogadores simplesmente
  não conseguem falar, e o erro é difícil de diagnosticar.
- **HTTPS é obrigatório.** O navegador não libera microfone em conexão
  insegura. Isso adianta a necessidade de domínio e certificado.

**Caminho recomendado para o protótipo:** um serviço gerenciado de voz
com camada gratuita, em vez de montar WebRTC do zero. Isso troca semanas
de infraestrutura por uma integração de algumas horas, e permite testar
a ideia antes de decidir se vale internalizar.

**E o número de jogadores por mundo passou a ser uma decisão técnica**,
não só de desenho. Até cinco é uma arquitetura; doze é outra bem mais
cara.

---

## 4. Deltas de modelo de dados

| Adição | Papel |
|---|---|
| `atributo` / `jogador_atributo` | Força e poder de domínio, por encarnação |
| `nivel`, `obstaculo` | Estrutura de progressão |
| `obstaculo_requisito` | O que o obstáculo exige: força, ou **outra pessoa** |
| `catastrofe`, `catastrofe_alvo` | Evento de mundo, com escopo e alvos |
| `passagem_livre` | Consequência positiva concedida pelo motor |
| Tipos de evento | `AVANCOU`, `VOLTOU_POR`, `ABANDONOU`, `AJUDOU_COM_FORCA` |

`obstaculo_requisito` é a peça central da seção 2: é ali que se define um
obstáculo que **força não resolve**. Como tudo neste projeto, isso é
dado, não código.

Se houver gravação de voz: uma tabela ligando o trecho de áudio ao
`evento_id` que o originou. O áudio vive em armazenamento de objetos, não
no banco.

---

## 5. Decisões pendentes

- Quantos jogadores por mundo? **Agora é decisão de arquitetura de voz,
  não só de desenho social.**
- Voz gravada em trechos para os recibos? (se sim: consentimento na
  entrada, não em termos de uso)
- Texto continua disponível como canal de primeira classe? (recomendação:
  sim)
- A catástrofe escolhe alvo por sorteio, por destino, ou pelos dois?
- Força é atributo da encarnação (some na morte) ou do jogador
  (atravessa)? O destino atravessa — e a força?
- Quantos níveis por mundo, e o que significa "vencer"?
- Voz por mundo, por sala, ou por proximidade?

# Primeira entrega — Entrada, avatar e ingresso no mundo

*Especificação para a primeira sessão de desenvolvimento.*

---

## 0. Antes de começar: levar os documentos para o projeto

O Claude Code não tem acesso à conversa em que este projeto foi
desenhado. Ele lê o disco. Monte a pasta assim:

```
meu-jogo/
  CLAUDE.md                          ← raiz, ele lê automaticamente
  docs/
    game_design_document.md
    design_principios.md
    loop_de_jogo.md
    mecanica_socorro_partilha.md
    mecanica_traicao_cooperacao.md
    mecanica_eras_renascimento.md
    progressao_catastrofes_voz.md
    monetizacao.md
    setup_ambiente.md
    primeira_entrega.md              ← este arquivo
  db/
    destino_fatia_vertical.sql
    destino_ords_setup.sql
```

```bash
git add . && git commit -m "docs: design do projeto"
```

Commitar antes de codar tem uma vantagem prática: a partir daqui, todo
diff que o Claude Code produzir é visível e reversível.

---

## 1. Escopo desta entrega

**Fazer:**

- Jogador entra com um nome
- Escolhe um avatar
- Entra num mundo e vê quem mais está lá
- Chat de texto funcionando na sala
- Tudo registrado no Oracle

**Não fazer ainda:**

- Escolha de era → **uma era fixa por enquanto**
- Voz → texto primeiro; WebRTC é outro problema
- Obstáculos, força, socorro, itens, destino
- Senha, cadastro, recuperação de conta
- Qualquer tela bonita

### Por que era fica de fora

O GDD já registra: quatro eras é quatro vezes o conteúdo, e é o risco
número um do projeto. A era existe no modelo de dados desde já, com **uma
linha**. A tela de escolha aparece quando houver uma segunda era para
escolher.

### Aviso de armadilha

Telas de entrada, lobby e seleção são o lugar clássico onde protótipos
morrem: passam-se semanas em menus e nunca se chega ao jogo. **O critério
de pronto desta entrega é rigoroso:** duas abas de navegador, dois nomes
diferentes, os dois se veem na mesma sala e conversam. Nada além disso.

Se aparecer vontade de fazer sala de espera, lista de mundos, contador de
jogadores online ou tela de carregamento — anote e siga.

---

## 2. Ajuste necessário no schema

O schema foi escrito para Steam. No protótipo web não há Steam ID.

```sql
-- Identificador vira livre (nome digitado), não mais Steam
ALTER TABLE jogador RENAME COLUMN steam_id TO identificador;
ALTER TABLE jogador MODIFY (identificador VARCHAR2(64));

-- Avatar
CREATE TABLE avatar (
  codigo     VARCHAR2(30) PRIMARY KEY,
  nome       VARCHAR2(60) NOT NULL,
  arquivo    VARCHAR2(120) NOT NULL,   -- caminho da imagem em public/
  ativo      CHAR(1) DEFAULT 'S' NOT NULL CHECK (ativo IN ('S','N'))
);

ALTER TABLE jogador ADD (avatar_codigo VARCHAR2(30) REFERENCES avatar(codigo));

-- Era: existe desde já, com uma linha só
CREATE TABLE era (
  codigo      VARCHAR2(30) PRIMARY KEY,
  nome        VARCHAR2(80) NOT NULL,
  descricao   VARCHAR2(400),
  disponivel  CHAR(1) DEFAULT 'N' NOT NULL CHECK (disponivel IN ('S','N'))
);

ALTER TABLE zona ADD (era_codigo VARCHAR2(30) REFERENCES era(codigo));

INSERT INTO era VALUES ('ATUAL','Era atual',
  'O mundo como ele e, ou como parece ser.','S');

UPDATE zona SET era_codigo = 'ATUAL';

INSERT INTO avatar VALUES ('A01','Figura 1','/img/av01.png','S');
INSERT INTO avatar VALUES ('A02','Figura 2','/img/av02.png','S');
INSERT INTO avatar VALUES ('A03','Figura 3','/img/av03.png','S');
INSERT INTO avatar VALUES ('A04','Figura 4','/img/av04.png','S');

COMMIT;
```

E um endpoint ORDS novo, no mesmo padrão do módulo existente:

- `GET /destino/v1/catalogo` → avatares ativos e eras disponíveis

O handler `POST /presenca` já existe e já faz o `MERGE` do jogador —
precisa apenas passar a receber `avatar_codigo`.

---

## 3. O avatar não é enfeite

Num jogo sobre quem ajudou quem, **reconhecer as pessoas é função, não
decoração.** O recibo de amanhã vai mostrar "você deixou *aquela figura*
para trás" — e só funciona se a figura for memorável.

Requisitos:

- Quatro a seis opções, bem distintas entre si
- Silhueta e cor diferentes o suficiente para distinguir de relance
- Um avatar por jogador dentro do mesmo mundo (sem repetição)
- Guardado no `jogador`, não na encarnação — a pessoa é reconhecível
  entre vidas

Fonte de arte: qualquer conjunto CC0 serve por ora. Quadrados coloridos
com iniciais também servem. Não gaste tempo aqui.

---

## 4. Critério de pronto

1. Abrir duas abas do navegador em `localhost:3000`
2. Entrar com nomes diferentes e avatares diferentes
3. Cada aba lista o outro jogador na sala
4. Mensagem digitada numa aba aparece na outra
5. Fechar uma aba: a outra percebe a saída
6. No banco: `SELECT * FROM jogador;` e `SELECT * FROM presenca;` mostram
   os dois

Se os seis passos rodarem, a entrega está feita.

---

## 5. O que pedir ao Claude Code

Cole isto na primeira sessão:

> Leia `CLAUDE.md` e `docs/primeira_entrega.md` antes de qualquer coisa.
>
> Implemente a primeira entrega. Vá por partes e pare para eu testar
> entre elas, nesta ordem:
>
> 1. Servidor Express servindo `public/`, com `.env` carregado.
> 2. `server/ords.js`: cliente do ORDS com cache de token OAuth2
>    client_credentials. Explique como o cache funciona.
> 3. Tela de entrada: nome + escolha de avatar, consumindo `/catalogo`.
> 4. Socket.IO: entrar numa sala, listar quem está presente, sair ao
>    desconectar. Explique como o Socket.IO gerencia salas — sou
>    iniciante em Node.
> 5. Chat de texto por sala.
> 6. Persistência: `POST /sessao` e `POST /presenca` no momento certo.
>
> Não implemente destino, obstáculos, força, itens nem voz.
> Se algo do que eu pedir aumentar o escopo, me avise antes.

Peça para ele parar entre os passos. Seis entregas pequenas que você
entende valem mais que uma grande que você aceita no escuro.

---

## 6. Duas armadilhas de Node que vão aparecer aqui

Registradas de antemão para você reconhecer quando acontecer:

**Estado vivo some no restart.** A lista de quem está na sala vive na
memória do processo. Toda vez que o `nodemon` reiniciar, todos "saem" da
sala. Isso é esperado — não é bug. O que não pode sumir vai para o
Oracle.

**Ordem de execução não é ordem de escrita.** Chamadas ao ORDS são
assíncronas. Um jogador pode aparecer na sala do Socket.IO antes de o
`INSERT` na `presenca` ter terminado. Decida cedo: a interface espera a
confirmação do banco, ou segue e reconcilia depois? Para protótipo,
seguir e reconciliar é mais fluido — mas precisa ser decisão consciente,
não acidente.

---

## 7. Próxima entrega (não fazer agora)

Obstáculos, o verbo "avançar", o verbo "voltar para X", e o relógio que
torna o tempo caro. É aí que o jogo começa a existir.

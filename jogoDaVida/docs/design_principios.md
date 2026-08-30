# Princípios de design

Documento vivo. Registra decisões de fundo que devem sobreviver a
mudanças de escopo, engine ou backend.

---

## P01 — A vida é um jogo de alocação de recursos escassos

*Registrado em: 2026-08-18*

### O axioma

Toda escolha significativa é uma escolha entre alternativas que não podem
ser todas tomadas. Se o jogador pode ter tudo, ele não escolhe — ele
apenas coleta.

### Por que isso é a base do motor de destino, e não um sistema à parte

O sistema de destino só produz sentido se as ações que ele mede
**custarem algo**. Ajudar alguém quando ajudar é gratuito não revela
caráter nenhum; é apenas clicar em um botão disponível. Ajudar quando
ajudar consome um recurso que você queria para si é uma decisão moral —
e é isso que o motor deve estar medindo.

Consequência prática: **antes de criar qualquer regra de destino nova,
identificar qual escassez ela pressupõe.** Regra sem custo associado é
regra que vira farm.

### As escassezes candidatas (nenhuma decidida ainda)

Ordenadas da mais fácil de implementar para a mais interessante:

| Recurso | Escasso porque | Observação |
|---|---|---|
| **Tempo de sessão** | A partida acaba | O mais barato de implementar; já existe de graça |
| **Energia / carga** | Regenera devagar | Clássico, funciona, mas é o mais preguiçoso |
| **Atenção** | Não se pode observar duas salas ao mesmo tempo | Casa com a arquitetura de portais |
| **Confiança alheia** | Outros jogadores decidem quem ajudar | Escassez social, não numérica — a mais difícil e a mais rica |
| **Posição no mundo** | Atravessar um portal é irreversível na sessão | Transforma o mapa em custo de oportunidade |

A escassez mais alinhada com a ficção é **atenção**: um mundo simulado
onde o que você escolhe olhar é o que você deixa de olhar em outro lugar.
Os portais já criam essa estrutura de graça.

### O que NÃO fazer

- Não implementar economia de recursos na fatia vertical. A fatia testa
  se uma regra oculta produz curiosidade. Escassez entra depois, quando
  houver o que alocar.
- Não transformar escassez em barreira de tempo real (esperar 4 horas
  para recarregar). Isso é monetização disfarçada de design, e mata o
  ritmo de um jogo de sessão.
- Não deixar o jogador sem informação suficiente para escolher. Escassez
  com informação é dilema; escassez sem informação é loteria.

### Teste para saber se está funcionando

Se o jogador consegue descrever, depois da partida, uma decisão da qual
ele ainda não tem certeza — o princípio está aplicado. Se ele descreve
apenas o que conseguiu acumular, não está.

---

## Como manter este documento útil

Referencie-o no `CLAUDE.md` do projeto para que o Claude Code leve os
princípios em conta ao gerar código:

```markdown
## Design
Antes de propor mecânicas, leia docs/design_principios.md.
Toda regra de destino precisa de uma escassez associada (P01).
```

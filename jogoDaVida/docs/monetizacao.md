# Monetização — Anúncio como preço da ajuda

*Registrado em: 2026-08-18*
*Estado: hipótese. Não implementável no protótipo.*

---

## 1. O que foi definido

Obter **ajuda** em qualquer momento do jogo custa a exibição de um
anúncio. O formato é o **rewarded video**: o jogador escolhe assistir e
recebe algo em troca.

---

## 2. Por que a ideia tem apelo aqui

O pilar P01 diz que o jogo é sobre alocação de recursos escassos, e a
escassez candidata mais alinhada com a ficção era **atenção**.

Um anúncio recompensado cobra exatamente isso: trinta segundos de
atenção. Não é uma metáfora — é literalmente o recurso do pilar sendo
gasto. Poucos jogos conseguem alinhar monetização e tema com essa
naturalidade.

---

## 3. A linha que não pode ser cruzada

**Anúncio nunca pode comprar nada que o motor de destino meça.**

Se puder, o sistema inteiro colapsa. Três exemplos do que isso
significaria:

| Se o anúncio comprar… | O que acontece |
|---|---|
| Pontos de destino | Virtude vira produto. O jogador farma bom destino assistindo vídeo. |
| Escapar de uma consequência | O recibo vira cobrança evitável. A premissa do jogo morre. |
| A ação de ajudar outro jogador | Cooperação deixa de custar algo próprio. P01 deixa de existir. |

O caso mais perigoso é o segundo. O jogo inteiro se apoia em
consequências que chegam sem aviso e não se negociam. Uma tela de "assista
um anúncio para anular esta consequência" destrói em um clique tudo o que
o motor de destino existe para construir.

### O que o anúncio pode comprar

Coisas que são **conveniência ou informação**, nunca posição moral nem
vantagem sobre outro jogador:

- Dica sobre o objetivo da fase (não sobre a regra oculta)
- Reduzir espera, atalho de deslocamento
- Cosmético, aparência, nome de destaque
- Uma tentativa extra num desafio de fase
- Rever um recibo antigo já recebido

Repare que "dica sobre o objetivo" é seguro e "dica sobre a regra oculta"
não é. Vender a regra é vender o jogo.

---

## 4. A armadilha da escassez comprável

Se atenção for a escassez do P01 **e** o anúncio recarregar atenção,
a escassez deixa de existir. Ela vira um pedágio de trinta segundos.

Escolha uma das duas:

- **Atenção é a escassez do P01** → o anúncio compra outra coisa, nunca
  atenção.
- **O anúncio compra atenção** → o P01 precisa de outra escassez.

As duas coisas ao mesmo tempo não funcionam. Decisão pendente.

---

## 5. Realidade prática

### Não dá para implementar agora

As redes de anúncio para jogos web exigem volume mínimo de tráfego —
uma das principais do setor pede 100 mil impressões mensais para aceitar
publicadores novos. Um protótipo com quatro jogadores não é aceito em
lugar nenhum.

**Consequência:** desenhe o gancho, não implemente o anúncio. Deixe a
função `pedirAjuda()` no servidor com um `TODO` no lugar do SDK. Trocar o
stub pela integração real é meio dia de trabalho quando houver público.

### As opções, quando houver público

| Rede | Observação |
|---|---|
| **Google H5 Games Ads** | Sucessor do AdSense for Games. Intersticiais e rewarded via Ad Placement API. Sujeito a aprovação. |
| **AppLixir** | Focada em web, não em mobile. Conformidade GDPR embutida. |
| **AdinPlay** | Só jogos de navegador. Comum em jogos `.io`. |
| **Playgama Bridge** | SDK único para anúncios, compras e saves; configuração por arquivo JSON, sem rebuild. |

Ordem de grandeza: rewarded video em web costuma render bem mais que
display comum, mas o número que importa é o volume de jogadores, não o
CPM. Com poucas centenas de sessões, a receita é simbólica.

### Detalhes que vão aparecer

- **AdBlock.** Parte relevante dos jogadores de desktop bloqueia
  anúncios. O código precisa tratar a falha de carregamento — nunca
  deixar o jogador travado esperando um vídeo que não vem. Ou concede a
  ajuda mesmo assim, ou oferece outro caminho.
- **LGPD e GDPR.** Consentimento antes de qualquer rastreamento, e
  política de privacidade publicada. Algumas redes já trazem isso pronto.
- **Menores de idade.** Se houver jogadores menores, as restrições de
  publicidade ficam bem mais rígidas. Vale decidir a faixa etária alvo
  antes de escolher a rede.
- **Frequência.** Limite de anúncios por sessão. Sem isso, o jogo vira
  máquina de vídeo com interlúdios de jogo.

---

## 6. Decisões pendentes

- "Ajuda" significa **dica do sistema** ou **a ação de ajudar outro
  jogador**? São mecânicas completamente diferentes e a segunda é
  perigosa.
- Se atenção for a escassez do P01, o que o anúncio compra em vez dela?
- Faixa etária alvo do jogo — determina o que é permitido em publicidade.
- Haverá alternativa paga ao anúncio, para quem prefere pagar a assistir?
- Limite de anúncios por sessão.

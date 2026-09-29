-- Seed dos enigmas do jogoDaVida (texto, html, jogo) — gerado a partir da base de dev em 2026-09-29.
-- Ignora tipo='mundo' (já existe no servidor). Roda numa transação: se algum origem já
-- existir (violação de UNIQUE), tudo é desfeito e nada muda — seguro pra tentar de novo
-- só depois de checar o que já está lá.

BEGIN;

COPY enigma (id, origem, tipo, nivel, ordem, pergunta, resposta, arquivo, ativo, fase, niveis) FROM stdin;
4	csv:4	texto	Fácil	7	O que corre, mas nunca anda; tem leito, mas nunca dorme?	Rio	\N	N	\N	1
5	csv:5	texto	Fácil	9	O que sobe e desce sem sair do lugar?	Escada	\N	N	\N	1
6	csv:6	texto	Fácil	11	O que tem mãos, mas não pode bater palmas?	Relógio	\N	N	\N	1
7	csv:7	texto	Fácil	13	O que tem olhos, mas não vê?	Batata	\N	N	\N	1
8	csv:8	texto	Fácil	15	O que fica molhado enquanto seca?	Toalha	\N	N	\N	1
9	csv:9	texto	Fácil	17	O que pode viajar pelo mundo inteiro sem sair do lugar?	Selo	\N	N	\N	1
10	csv:10	texto	Fácil	19	O que tem pescoço, mas não tem cabeça?	Garrafa	\N	N	\N	1
11	csv:11	texto	Fácil	21	O que nasce grande e morre pequeno?	Lápis	\N	N	\N	1
12	csv:12	texto	Fácil	23	O que tem quatro pernas, mas não anda?	Mesa	\N	N	\N	1
13	csv:13	texto	Fácil	25	O que quanto mais quente fica, mais fresco parece?	Pimenta	\N	N	\N	1
14	csv:14	texto	Fácil	27	O que você quebra antes de usar?	Ovo	\N	N	\N	1
15	csv:15	texto	Fácil	29	O que tem folhas, mas não é árvore?	Livro	\N	N	\N	1
16	csv:16	texto	Fácil	31	O que tem uma boca, mas não fala?	Garrafa	\N	N	\N	1
17	csv:17	texto	Fácil	33	O que desaparece assim que você fala seu nome?	Silêncio	\N	N	\N	1
18	csv:18	texto	Fácil	35	O que é cheio de buracos, mas consegue segurar água?	Esponja	\N	N	\N	1
19	csv:19	texto	Fácil	37	O que tem uma cabeça, uma cauda, mas não tem corpo?	Moeda	\N	N	\N	1
20	csv:20	texto	Fácil	39	O que sempre vem, mas nunca chega?	Amanhã	\N	N	\N	1
21	csv:21	texto	Fácil	41	O que fica no meio do ovo?	A letra V	\N	N	\N	1
22	csv:22	texto	Fácil	43	O que tem pernas e não anda, tem assento e não senta?	Cadeira	\N	N	\N	1
23	csv:23	texto	Fácil	45	O que é seu, mas outras pessoas usam mais do que você?	Seu nome	\N	N	\N	1
24	csv:24	texto	Fácil	47	O que tem teclas, mas não abre portas?	Teclado	\N	N	\N	1
25	csv:25	texto	Fácil	49	O que ilumina uma sala inteira sem ocupar espaço?	Luz	\N	N	\N	1
26	csv:26	texto	Fácil	51	O que tem asas, mas não é pássaro; voa, mas não tem vida?	Avião	\N	N	\N	1
27	csv:27	texto	Fácil	53	O que quanto mais cresce, menos você enxerga?	Escuridão	\N	N	\N	1
28	csv:28	texto	Fácil	55	O que cai em pé e corre deitado?	Chuva	\N	N	\N	1
29	csv:29	texto	Fácil	57	O que tem cordas, mas não é barco?	Violão	\N	N	\N	1
30	csv:30	texto	Fácil	59	O que é preto quando você compra, vermelho quando usa e cinza quando joga fora?	Carvão	\N	N	\N	1
31	csv:31	texto	Fácil	61	O que pode ser visto uma vez em um minuto, duas vezes em um momento e nenhuma vez em mil anos?	A letra M	\N	N	\N	1
32	csv:32	texto	Fácil	63	O que é que passa diante do sol sem fazer sombra?	O vento	\N	N	\N	1
33	csv:33	texto	Fácil	65	O que tem cidades, rios e montanhas, mas não tem casas, água ou pedras?	Mapa	\N	N	\N	1
34	csv:34	texto	Fácil	67	O que tem um pé, mas não anda?	Planta	\N	N	\N	1
35	csv:35	texto	Intermediário	69	Dois pais e dois filhos foram pescar. Cada um pescou um peixe, mas trouxeram apenas três peixes. Como?	Eram avô, pai e filho	\N	N	\N	1
36	csv:36	texto	Intermediário	71	Um homem entrou em uma casa sem porta, sem janela e sem quebrar nada. Como?	Entrou por uma porta que estava aberta	\N	N	\N	1
37	csv:37	texto	Intermediário	73	O que pode encher uma sala, mas não ocupa espaço?	Luz	\N	N	\N	1
38	csv:38	texto	Intermediário	75	Quanto mais você corre atrás de mim, mais eu fico longe. O que sou?	Horizonte	\N	N	\N	1
39	csv:39	texto	Intermediário	77	Tenho chaves, mas não abro fechaduras. Tenho espaço, mas não tenho quartos. O que sou?	Teclado	\N	N	\N	1
40	csv:40	texto	Intermediário	79	Um homem olha para uma fotografia e diz: “Irmãos e irmãs eu não tenho, mas o pai desse homem é filho do meu pai.” Quem está na foto?	O filho dele	\N	N	\N	1
41	csv:41	texto	Intermediário	81	Se você me tem, quer compartilhar. Se compartilhar, deixa de me ter. O que sou?	Segredo	\N	N	\N	1
42	csv:42	texto	Intermediário	83	O que pode quebrar sem ser tocado?	Promessa	\N	N	\N	1
43	csv:43	texto	Intermediário	85	O que tem 13 corações, mas nenhum outro órgão?	Baralho	\N	N	\N	1
44	csv:44	texto	Intermediário	87	O que tem palavras, mas nunca fala; páginas, mas nunca lê?	Livro	\N	N	\N	1
45	csv:45	texto	Intermediário	89	Você está em uma corrida e ultrapassa o segundo colocado. Em que posição fica?	Segundo	\N	N	\N	1
46	csv:46	texto	Intermediário	91	Um avião cai exatamente na fronteira entre dois países. Onde enterram os sobreviventes?	Não enterram sobreviventes	\N	N	\N	1
47	csv:47	texto	Intermediário	93	O que pode ser capturado, mas nunca lançado?	Resfriado	\N	N	\N	1
48	csv:48	texto	Intermediário	95	Tenho cabeça e cauda, sou marrom e não tenho pernas. O que sou?	Moeda	\N	N	\N	1
49	csv:49	texto	Intermediário	97	O que quanto mais você compartilha, mais você tem?	Conhecimento	\N	N	\N	1
50	csv:50	texto	Intermediário	99	O que está sempre na sua frente, mas você nunca consegue enxergar?	Futuro	\N	N	\N	1
51	csv:51	texto	Intermediário	101	Um relógio bate 6 vezes em 5 segundos. Quanto tempo leva para bater 12 vezes?	11 segundos	\N	N	\N	1
52	csv:52	texto	Intermediário	103	Um fazendeiro tinha 17 ovelhas. Todas, menos 9, morreram. Quantas sobraram?	9	\N	N	\N	1
53	csv:53	texto	Intermediário	105	Você tem uma caixa com fósforos, uma vela e um lampião. O que acende primeiro?	O fósforo	\N	N	\N	1
54	csv:54	texto	Intermediário	107	O que tem muitos anéis, mas nenhum dedo?	Árvore	\N	N	\N	1
55	csv:55	texto	Intermediário	109	O que pode correr sem pernas, chorar sem olhos e ter boca sem falar?	Nuvem	\N	N	\N	1
56	csv:56	texto	Intermediário	111	Uma mulher tem quatro filhas e cada filha tem um irmão. Quantos filhos ela tem?	5	\N	N	\N	1
57	csv:57	texto	Intermediário	113	O que é tão frágil que, quando você fala seu nome, o quebra?	Silêncio	\N	N	\N	1
58	csv:58	texto	Intermediário	115	O que sobe quando a chuva desce?	Guarda-chuva	\N	N	\N	1
59	csv:59	texto	Intermediário	117	Tenho um olho, mas não consigo enxergar. O que sou?	Agulha	\N	N	\N	1
60	csv:60	texto	Intermediário	119	Se ontem fosse amanhã, hoje seria sexta-feira. Que dia é hoje?	Quarta-feira	\N	N	\N	1
61	csv:61	texto	Intermediário	121	O que começa com E, termina com E e contém apenas uma letra?	Envelope	\N	N	\N	1
62	csv:62	texto	Intermediário	123	Um quarto tem quatro cantos. Em cada canto há um gato. Cada gato vê três gatos. Quantos gatos há?	4	\N	N	\N	1
63	csv:63	texto	Intermediário	125	O que você pode segurar sem usar as mãos?	A respiração	\N	N	\N	1
64	csv:64	texto	Intermediário	127	O que sempre aumenta e nunca diminui?	Idade	\N	N	\N	1
65	csv:65	texto	Intermediário	129	Tenho números, mas não sei contar; tenho ponteiros, mas não sei apontar. O que sou?	Relógio	\N	N	\N	1
66	csv:66	texto	Intermediário	131	Se há três maçãs e você pega duas, quantas você tem?	2	\N	N	\N	1
67	csv:67	texto	Intermediário	133	O que é mais pesado: 1 kg de ferro ou 1 kg de algodão?	Pesam o mesmo	\N	N	\N	1
68	csv:68	texto	Intermediário	135	Um homem nasceu em 2000 e morreu em 2000 aos 80 anos. Como isso é possível?	2000 era o número do quarto/endereço	\N	N	\N	1
69	csv:69	texto	Difícil	137	Você tem duas cordas. Cada uma leva exatamente uma hora para queimar, mas queimam de maneira irregular. Como medir exatamente 45 minutos?	Acenda uma corda pelas duas pontas e a outra por uma ponta; quando a primeira acabar, acenda a outra ponta da segunda	\N	N	\N	1
70	csv:70	texto	Difícil	139	Há três interruptores fora de uma sala e uma lâmpada dentro. Você pode entrar na sala apenas uma vez. Como descobrir qual interruptor acende a lâmpada?	Ligue um, espere, desligue; ligue outro e entre. Acesa = segundo; apagada quente = primeiro; apagada fria = terceiro	\N	N	\N	1
71	csv:71	texto	Difícil	141	Um homem precisa atravessar um rio com uma raposa, uma galinha e um saco de milho. Só pode levar um por vez. Como faz?	Leva galinha, volta; leva raposa, traz galinha; leva milho, volta; leva galinha	\N	N	\N	1
72	csv:72	texto	Difícil	143	Você tem 8 bolas idênticas, mas uma é mais pesada. Com uma balança de dois pratos, qual o menor número de pesagens para encontrá-la?	2	\N	N	\N	1
73	csv:73	texto	Difícil	145	Um homem está preso em uma sala com duas portas: uma leva à liberdade e outra à morte. Há dois guardas: um sempre mente e outro sempre diz a verdade. Você pode fazer uma pergunta. Qual?	“Qual porta o outro guarda diria que leva à liberdade?” e escolher a oposta	\N	N	\N	1
74	csv:74	texto	Difícil	147	Há cinco casas de cores diferentes, cinco pessoas, cinco bebidas, cinco animais e cinco profissões. Cada pista relaciona dois elementos. Qual é a forma clássica de resolver esse enigma?	Tabela de lógica/dedução	\N	N	\N	1
75	csv:75	texto	Difícil	149	Um pai e seu filho sofrem um acidente. O pai morre. No hospital, o cirurgião diz: “Não posso operar, ele é meu filho.” Como?	O cirurgião é a mãe	\N	N	\N	1
76	csv:76	texto	Difícil	151	Um homem empurra seu carro até um hotel e imediatamente perde toda sua fortuna. O que aconteceu?	Ele estava jogando Banco Imobiliário	\N	N	\N	1
77	csv:77	texto	Difícil	153	Há três caixas: “maçãs”, “laranjas” e “maçãs e laranjas”. Todas as etiquetas estão erradas. Você pode retirar apenas uma fruta de uma caixa. Como corrigir todas?	Retire da caixa “maçãs e laranjas” e use a fruta para deduzir as outras	\N	N	\N	1
78	csv:78	texto	Difícil	155	Você tem 100 prisioneiros e 100 caixas, cada uma contendo um número. Cada prisioneiro pode abrir 50 caixas. Existe uma estratégia que aumenta muito a chance de todos encontrarem seus números. Qual?	Seguir os ciclos/permutação começando pelo próprio número	\N	N	\N	1
79	csv:79	texto	Difícil	157	Um homem entra em um restaurante e pede água. O garçom aponta uma arma para ele. O homem agradece e vai embora. Por quê?	Ele estava com soluço; o susto resolveu	\N	N	\N	1
80	csv:80	texto	Difícil	159	Um relógio de ponteiros marca exatamente 3:15. Qual é o menor ângulo entre os ponteiros?	7,5°	\N	N	\N	1
81	csv:81	texto	Difícil	161	Você possui uma ampulheta de 7 minutos e outra de 11 minutos. Como medir exatamente 15 minutos?	Inicie ambas; ao acabar a de 7, vire-a; ao acabar a de 11, vire a de 7 novamente; quando ela acabar, terão passado 15 minutos	\N	N	\N	1
82	csv:82	texto	Difícil	163	Um homem olha para um prédio de 20 andares. Todos os dias ele pega o elevador até o 10º andar e sobe o restante pelas escadas. Em dias de chuva ele vai direto ao 20º. Por quê?	Ele é baixo e usa o guarda-chuva para alcançar o botão do 20º	\N	N	\N	1
83	csv:83	texto	Difícil	165	Você tem 12 moedas, uma falsa, que pode ser mais pesada ou mais leve. Como identificá-la em apenas 3 pesagens?	Usando uma estratégia de divisão em grupos e comparação sistemática	\N	N	\N	1
84	csv:84	texto	Difícil	167	Um prisioneiro recebe duas pílulas, uma venenosa e uma segura, visualmente idênticas. Ele deve escolher uma e o guarda fica com a outra. O prisioneiro sempre sobrevive. Como?	Ele toma uma e descarta a outra; o guarda fica com a restante	\N	N	\N	1
85	csv:85	texto	Difícil	169	Um homem tem quatro cartas: A, D, 4 e 7. Regra: “Se há uma vogal de um lado, então há número par do outro.” Quais cartas precisam ser viradas para testar a regra?	A e 7	\N	N	\N	1
86	csv:86	texto	Difícil	171	Você tem uma sala com 100 lâmpadas desligadas. Na primeira rodada liga todas; na segunda muda o estado das múltiplas de 2; na terceira das múltiplas de 3, e assim por diante. Quais ficam acesas?	As posições que são quadrados perfeitos	\N	N	\N	1
87	csv:87	texto	Difícil	173	Um relógio adianta 5 minutos a cada hora. Ele foi acertado ao meio-dia. Quando marcará novamente a hora correta?	Após 144 horas, ou 6 dias	\N	N	\N	1
88	csv:88	texto	Difícil	175	Um homem está em uma ilha e vê três pessoas usando chapéus. Existem três chapéus pretos e dois brancos. Cada pessoa vê os outros, mas não o próprio. Após silêncio, um deles descobre a cor do próprio chapéu. Como?	Pela cadeia de deduções baseada no silêncio dos outros	\N	N	\N	1
89	csv:89	texto	Difícil	177	Você tem dois recipientes, um de 5 litros e outro de 3 litros. Como medir exatamente 4 litros?	Encha o de 5, transfira para o de 3, esvazie o de 3, transfira os 2 restantes, encha o de 5 e complete o de 3	\N	N	\N	1
90	csv:90	texto	Difícil	179	Um homem precisa escolher entre três caminhos. Um tem leões que não comem há três anos, outro tem assassinos armados e o terceiro tem fogo intenso. Qual é o mais seguro?	O caminho dos leões, pois provavelmente já morreram	\N	N	\N	1
91	csv:91	texto	Difícil	181	Há uma sequência: 1, 11, 21, 1211, 111221... Qual é o próximo número?	312211	\N	N	\N	1
92	csv:92	texto	Difícil	183	Qual número continua a sequência: 2, 3, 5, 9, 17, 33, ?	65	\N	N	\N	1
93	csv:93	texto	Difícil	185	Um homem tem 10 sacos de moedas. Um saco contém moedas falsas que pesam 9 g, os demais pesam 10 g. Com uma única pesagem, como descobrir o saco?	Pegue 1 moeda do saco 1, 2 do saco 2 etc.; a diferença de peso indica o saco	\N	N	\N	1
94	csv:94	texto	Difícil	187	Você tem três relógios: um parado, um atrasado e um adiantado. Qual deles está certo duas vezes por dia?	O relógio parado	\N	N	\N	1
95	csv:95	texto	Difícil	189	Um barco está cheio de pessoas, mas não há uma única pessoa solteira a bordo. Como isso é possível?	Todos são casados	\N	N	\N	1
96	csv:96	texto	Difícil	191	Um homem diz: “Anteontem eu tinha 25 anos, mas no ano que vem farei 28.” Como?	Hoje é 1º de janeiro e o aniversário dele é 31 de dezembro	\N	N	\N	1
97	csv:97	texto	Difícil	193	Uma família tem cinco filhos. Cada filho tem uma irmã. Quantas crianças há na família?	6	\N	N	\N	1
98	csv:98	texto	Difícil	195	Você entra em uma sala escura com um fósforo. Há uma vela, um lampião e uma lareira. O que acende primeiro?	O fósforo	\N	N	\N	1
99	csv:99	texto	Difícil	197	Há uma palavra que, se escrita corretamente, fica “errada”. Qual é?	“Errada”	\N	N	\N	1
100	csv:100	texto	Difícil	199	Um homem precisa escolher uma senha de quatro dígitos. As pistas são: 682 — um número correto e na posição correta; 614 — um número correto, mas na posição errada; 206 — dois números corretos, mas nas posições erradas; 738 — nenhum correto; 780 — um número correto, mas na posição errada. Qual é a senha?	42	\N	N	\N	1
101	html:enigma-001	html	Fácil	60	Quanto mais se tira, maior fica.	Buraco	enigma-001.html	S	2	1
102	html:enigma-002	html	Fácil	70	Tenho dentes, mas não mordo.	Pente	enigma-002.html	S	2	1
103	html:enigma-003	html	Fácil	80	Tenho cabeça e tenho dente, mas não sou gente.	Alho	enigma-003.html	S	2	1
104	html:enigma-004	html	Fácil	8	Corro, mas nunca ando; tenho leito, mas nunca durmo.	Rio	enigma-004.html	N	\N	1
105	html:enigma-005	html	Fácil	10	Subo e desço sem sair do lugar.	Escada	enigma-005.html	N	\N	1
106	html:enigma-006	html	Fácil	12	Tenho mãos, mas não posso bater palmas.	Relógio	enigma-006.html	N	\N	1
107	html:enigma-007	html	Fácil	14	Tenho olhos, mas não vejo.	Batata	enigma-007.html	N	\N	1
108	html:enigma-008	html	Fácil	16	Fico molhada enquanto seco.	Toalha	enigma-008.html	N	\N	1
109	html:enigma-009	html	Fácil	18	Viajo pelo mundo inteiro sem sair do lugar.	Selo	enigma-009.html	N	\N	1
110	html:enigma-010	html	Fácil	20	Tenho pescoço, mas não tenho cabeça.	Garrafa	enigma-010.html	N	\N	1
111	html:enigma-011	html	Fácil	22	Nasço grande e morro pequeno.	Lápis	enigma-011.html	N	\N	1
112	html:enigma-012	html	Fácil	24	Tenho quatro pernas, mas não ando.	Mesa	enigma-012.html	N	\N	1
113	html:enigma-013	html	Fácil	26	Quanto mais quente fico, mais fresco pareço.	Pimenta	enigma-013.html	N	\N	1
114	html:enigma-014	html	Fácil	28	Você me quebra antes de me usar.	Ovo	enigma-014.html	N	\N	1
115	html:enigma-015	html	Fácil	30	Tenho folhas, mas não sou árvore.	Livro	enigma-015.html	N	\N	1
116	html:enigma-016	html	Fácil	32	Tenho uma boca, mas não falo.	Garrafa	enigma-016.html	N	\N	1
117	html:enigma-017	html	Fácil	34	Desapareço assim que você fala meu nome.	Silêncio	enigma-017.html	N	\N	1
118	html:enigma-018	html	Fácil	36	Sou cheio de buracos, mas consigo segurar água.	Esponja	enigma-018.html	N	\N	1
119	html:enigma-019	html	Fácil	38	Tenho cabeça e cauda, mas não tenho corpo.	Moeda	enigma-019.html	N	\N	1
120	html:enigma-020	html	Fácil	40	Sempre venho, mas nunca chego.	Amanhã	enigma-020.html	N	\N	1
121	html:enigma-021	html	Fácil	42	O que fica no meio do ovo?	A letra V	enigma-021.html	N	\N	1
122	html:enigma-022	html	Fácil	44	Tenho pernas e não ando; tenho assento e não sento.	Cadeira	enigma-022.html	N	\N	1
123	html:enigma-023	html	Fácil	46	Sou seu, mas outras pessoas usam mais do que você.	Seu nome	enigma-023.html	N	\N	1
124	html:enigma-024	html	Fácil	48	Tenho teclas, mas não abro portas.	Teclado	enigma-024.html	N	\N	1
125	html:enigma-025	html	Fácil	50	Ilumino uma sala inteira sem ocupar espaço.	Luz	enigma-025.html	N	\N	1
126	html:enigma-026	html	Fácil	52	Tenho asas, mas não sou pássaro; voo, mas não tenho vida.	Avião	enigma-026.html	N	\N	1
127	html:enigma-027	html	Fácil	54	Quanto mais cresço, menos você enxerga.	Escuridão	enigma-027.html	N	\N	1
128	html:enigma-028	html	Fácil	56	Caio em pé e corro deitado.	Chuva	enigma-028.html	N	\N	1
129	html:enigma-029	html	Fácil	58	Tenho cordas, mas não sou barco.	Violão	enigma-029.html	N	\N	1
130	html:enigma-030	html	Fácil	60	Sou preto quando compro, vermelho quando uso e cinza quando jogo fora.	Carvão	enigma-030.html	N	\N	1
131	html:enigma-031	html	Fácil	62	Apareço uma vez em &#39;minuto&#39;, duas em &#39;momento&#39; e nenhuma em &#39;mil anos&#39;.	A letra M	enigma-031.html	N	\N	1
132	html:enigma-032	html	Fácil	64	Passo diante do sol sem fazer sombra.	Vento	enigma-032.html	N	\N	1
133	html:enigma-033	html	Fácil	66	Tenho cidades, rios e montanhas, mas não tenho casas, água ou pedras.	Mapa	enigma-033.html	N	\N	1
134	html:enigma-034	html	Fácil	68	Tenho um pé, mas não ando.	Planta	enigma-034.html	N	\N	1
135	html:enigma-035	html	Intermediário	70	Dois pais e dois filhos foram pescar. Cada um pescou um peixe, mas trouxeram apenas três peixes.	Eram avô, pai e filho	enigma-035.html	N	\N	1
136	html:enigma-036	html	Intermediário	72	Um homem entrou em uma casa sem porta, sem janela e sem quebrar nada. Como?	A porta estava aberta	enigma-036.html	N	\N	1
137	html:enigma-037	html	Intermediário	74	Encho uma sala, mas não ocupo espaço.	Luz	enigma-037.html	N	\N	1
138	html:enigma-038	html	Intermediário	76	Quanto mais você corre atrás de mim, mais longe eu fico.	Horizonte	enigma-038.html	N	\N	1
139	html:enigma-039	html	Intermediário	78	Tenho chaves, espaço, mas não tenho quartos. O que sou?	Teclado	enigma-039.html	N	\N	1
140	html:enigma-040	html	Intermediário	80	Um homem olha para uma foto: &#39;Irmãos não tenho, mas o pai desse homem é filho do meu pai.&#39; Quem está na foto?	O filho dele	enigma-040.html	N	\N	1
141	html:enigma-041	html	Intermediário	82	Se me tem, quer compartilhar. Se compartilhar, deixa de me ter.	Segredo	enigma-041.html	N	\N	1
142	html:enigma-042	html	Intermediário	84	Posso quebrar sem ser tocada.	Promessa	enigma-042.html	N	\N	1
143	html:enigma-043	html	Intermediário	86	Tenho 13 corações, mas nenhum outro órgão.	Baralho	enigma-043.html	N	\N	1
144	html:enigma-044	html	Intermediário	88	Tenho palavras e páginas, mas nunca falo nem leio.	Livro	enigma-044.html	N	\N	1
145	html:enigma-045	html	Intermediário	90	Você está em uma corrida e ultrapassa o segundo colocado. Em que posição fica?	Segundo	enigma-045.html	N	\N	1
146	html:enigma-046	html	Intermediário	92	Um avião cai na fronteira entre dois países. Onde enterram os sobreviventes?	Não enterram sobreviventes	enigma-046.html	N	\N	1
147	html:enigma-047	html	Intermediário	94	Posso ser capturado, mas nunca lançado.	Resfriado	enigma-047.html	N	\N	1
148	html:enigma-048	html	Intermediário	96	Tenho cabeça e cauda, sou marrom e não tenho pernas.	Moeda	enigma-048.html	N	\N	1
149	html:enigma-049	html	Intermediário	98	Quanto mais você compartilha, mais você tem.	Conhecimento	enigma-049.html	N	\N	1
150	html:enigma-050	html	Intermediário	100	Estou sempre na sua frente, mas você nunca consegue me enxergar.	Futuro	enigma-050.html	N	\N	1
151	html:enigma-051	html	Intermediário	102	Um relógio bate 6 vezes em 5 segundos. Quanto leva para bater 12 vezes?	11 segundos	enigma-051.html	N	\N	1
152	html:enigma-052	html	Intermediário	104	Um fazendeiro tinha 17 ovelhas. Todas, menos 9, morreram. Quantas sobraram?	9	enigma-052.html	N	\N	1
153	html:enigma-053	html	Intermediário	106	Há fósforos, vela e lampião. O que você acende primeiro?	O fósforo	enigma-053.html	N	\N	1
154	html:enigma-054	html	Intermediário	108	Tenho muitos anéis, mas nenhum dedo.	Árvore	enigma-054.html	N	\N	1
155	html:enigma-055	html	Intermediário	110	Posso correr sem pernas, chorar sem olhos e ter boca sem falar.	Nuvem	enigma-055.html	N	\N	1
156	html:enigma-056	html	Intermediário	112	Uma mulher tem quatro filhas e cada filha tem um irmão. Quantos filhos ela tem?	5	enigma-056.html	N	\N	1
157	html:enigma-057	html	Intermediário	114	Sou tão frágil que, quando você fala meu nome, me quebra.	Silêncio	enigma-057.html	N	\N	1
158	html:enigma-058	html	Intermediário	116	Subo quando a chuva desce.	Guarda-chuva	enigma-058.html	N	\N	1
159	html:enigma-059	html	Intermediário	118	Tenho um olho, mas não consigo enxergar.	Agulha	enigma-059.html	N	\N	1
160	html:enigma-060	html	Intermediário	120	Se ontem fosse amanhã, hoje seria sexta-feira. Que dia é hoje?	Quarta-feira	enigma-060.html	N	\N	1
161	html:enigma-061	html	Intermediário	122	Começo com E, termino com E e contenho apenas uma letra.	Envelope	enigma-061.html	N	\N	1
162	html:enigma-062	html	Intermediário	124	Um quarto tem quatro cantos. Em cada canto há um gato. Cada gato vê três gatos. Quantos gatos?	4	enigma-062.html	N	\N	1
163	html:enigma-063	html	Intermediário	126	Posso ser segurada sem usar as mãos.	A respiração	enigma-063.html	N	\N	1
164	html:enigma-064	html	Intermediário	128	Sempre aumento e nunca diminuo.	Idade	enigma-064.html	N	\N	1
165	html:enigma-065	html	Intermediário	130	Tenho números e ponteiros, mas não sei contar nem apontar.	Relógio	enigma-065.html	N	\N	1
166	html:enigma-066	html	Intermediário	132	Se há três maçãs e você pega duas, quantas você tem?	2	enigma-066.html	N	\N	1
167	html:enigma-067	html	Intermediário	134	O que pesa mais: 1 kg de ferro ou 1 kg de algodão?	Pesam o mesmo	enigma-067.html	N	\N	1
168	html:enigma-068	html	Intermediário	136	Um homem nasceu em 2000 e morreu em 2000 aos 80 anos. Como?	2000 era o número do quarto/endereço	enigma-068.html	N	\N	1
169	html:enigma-069	html	Difícil	138	Duas cordas queimam em exatamente uma hora, mas de forma irregular. Como medir 45 minutos?	Acenda uma corda nas duas pontas e a outra em uma ponta; quando a primeira acabar, acenda a outra ponta da segunda.	enigma-069.html	N	\N	1
170	html:enigma-070	html	Difícil	140	Há três interruptores fora de uma sala e uma lâmpada dentro. Você entra apenas uma vez. Como descobrir o interruptor?	Ligue o primeiro por um tempo e desligue; ligue o segundo e entre. Acesa = segundo; apagada e quente = primeiro; apagada e fria = terceiro.	enigma-070.html	N	\N	1
171	html:enigma-071	html	Difícil	142	Atravesse um rio com raposa, galinha e milho, levando apenas um por vez.	Leve a galinha; volte; leve a raposa; traga a galinha; leve o milho; volte; leve a galinha.	enigma-071.html	N	\N	1
172	html:enigma-072	html	Difícil	144	Há 8 bolas idênticas e uma é mais pesada. Qual o menor número de pesagens?	2	enigma-072.html	N	\N	1
173	html:enigma-073	html	Difícil	146	Duas portas: uma leva à liberdade e outra à morte. Um guarda mente e outro diz a verdade. Uma pergunta.	Pergunte o que o outro guarda indicaria e escolha a porta oposta.	enigma-073.html	N	\N	1
174	html:enigma-074	html	Difícil	148	Há cinco casas, cinco pessoas, bebidas, animais e profissões, todas relacionadas por pistas. Como resolver?	Usando uma tabela de lógica e dedução.	enigma-074.html	N	\N	1
175	html:enigma-075	html	Difícil	150	Pai e filho sofrem acidente. O pai morre. O cirurgião diz: &#39;Não posso operar, ele é meu filho.&#39; Como?	O cirurgião é a mãe.	enigma-075.html	N	\N	1
176	html:enigma-076	html	Difícil	152	Um homem empurra seu carro até um hotel e perde toda a fortuna.	Ele está jogando Banco Imobiliário.	enigma-076.html	N	\N	1
177	html:enigma-077	html	Difícil	154	Três caixas estão etiquetadas &#39;maçãs&#39;, &#39;laranjas&#39; e &#39;mistura&#39;. Todas as etiquetas estão erradas. Uma fruta retirada resolve tudo.	Retire uma fruta da caixa &#39;mistura&#39; e use-a para corrigir as três etiquetas.	enigma-077.html	N	\N	1
178	html:enigma-078	html	Difícil	156	100 prisioneiros, 100 caixas, cada um pode abrir 50. Há uma estratégia que aumenta muito a chance de todos encontrarem seus números. Qual?	Seguir os ciclos da permutação, começando pela caixa com o próprio número.	enigma-078.html	N	\N	1
179	html:enigma-079	html	Difícil	158	Um homem pede água em um restaurante. O garçom aponta uma arma. O homem agradece e vai embora.	Ele estava com soluço; o susto resolveu.	enigma-079.html	N	\N	1
180	html:enigma-080	html	Difícil	160	Um relógio marca exatamente 3:15. Qual o menor ângulo entre os ponteiros?	7,5 graus	enigma-080.html	N	\N	1
181	html:enigma-081	html	Difícil	162	Ampulhetas de 7 e 11 minutos. Como medir exatamente 15 minutos?	Inicie ambas; ao acabar a de 7, vire-a; ao acabar a de 11, vire a de 7; quando ela acabar, passaram 15 minutos.	enigma-081.html	N	\N	1
182	html:enigma-082	html	Difícil	164	Um homem pega o elevador até o 10º andar e sobe até o 20º pelas escadas. Em dias de chuva vai direto ao 20º.	Ele é baixo e usa o guarda-chuva para alcançar o botão do 20º.	enigma-082.html	N	\N	1
183	html:enigma-083	html	Difícil	166	Há 12 moedas e uma falsa, mais pesada ou mais leve. Como identificar em 3 pesagens?	Divida e compare grupos sistematicamente, mantendo as possibilidades de pesada/leve.	enigma-083.html	N	\N	1
184	html:enigma-084	html	Difícil	168	Duas pílulas idênticas: uma venenosa e uma segura. O prisioneiro sempre sobrevive escolhendo uma.	Ele toma uma e deixa a outra para o guarda.	enigma-084.html	N	\N	1
185	html:enigma-085	html	Difícil	170	Cartas A, D, 4 e 7. Regra: &#39;Se há uma vogal de um lado, há número par do outro.&#39; Quais virar?	A e 7	enigma-085.html	N	\N	1
186	html:enigma-086	html	Difícil	172	100 lâmpadas desligadas. Na rodada 1 muda todas; na 2 as múltiplas de 2; na 3 as múltiplas de 3; e assim por diante. Quais ficam acesas?	As posições que são quadrados perfeitos.	enigma-086.html	N	\N	1
187	html:enigma-087	html	Difícil	174	Um relógio adianta 5 minutos a cada hora. Acertado ao meio-dia. Quando marcará novamente a hora correta?	Após 144 horas, ou 6 dias.	enigma-087.html	N	\N	1
188	html:enigma-088	html	Difícil	176	Três pessoas usam chapéus. Há três pretos e dois brancos. Cada um vê os outros. Após silêncio, um descobre a própria cor.	Pela cadeia de deduções baseada no silêncio dos outros.	enigma-088.html	N	\N	1
189	html:enigma-089	html	Difícil	178	Recipientes de 5 L e 3 L. Como medir exatamente 4 L?	Encha o de 5; passe ao de 3; esvazie o de 3; passe os 2 restantes; encha o de 5 e complete o de 3.	enigma-089.html	N	\N	1
190	html:enigma-090	html	Difícil	180	Três caminhos: leões que não comem há três anos, assassinos armados ou fogo intenso. Qual é seguro?	O dos leões, pois provavelmente já morreram.	enigma-090.html	N	\N	1
191	html:enigma-091	html	Difícil	182	Complete: 1, 11, 21, 1211, 111221, ?	312211	enigma-091.html	N	\N	1
192	html:enigma-092	html	Difícil	184	Complete: 2, 3, 5, 9, 17, 33, ?	65	enigma-092.html	N	\N	1
193	html:enigma-093	html	Difícil	186	10 sacos de moedas; um tem moedas falsas de 9 g, os demais 10 g. Uma pesagem identifica o saco.	Pegue 1 moeda do saco 1, 2 do saco 2, ..., 10 do saco 10. A diferença indica o saco.	enigma-093.html	N	\N	1
194	html:enigma-094	html	Difícil	188	Três relógios: um parado, um atrasado e um adiantado. Qual está certo duas vezes por dia?	O relógio parado.	enigma-094.html	N	\N	1
195	html:enigma-095	html	Difícil	190	Um barco está cheio de pessoas, mas não há uma única pessoa solteira a bordo.	Todos são casados.	enigma-095.html	N	\N	1
196	html:enigma-096	html	Difícil	192	Um homem diz: &#39;Anteontem tinha 25 anos, no ano que vem farei 28.&#39; Como?	Hoje é 1º de janeiro e ele faz aniversário em 31 de dezembro.	enigma-096.html	N	\N	1
197	html:enigma-097	html	Difícil	194	Uma família tem cinco filhos. Cada filho tem uma irmã. Quantas crianças?	6	enigma-097.html	N	\N	1
198	html:enigma-098	html	Difícil	196	Sala escura: vela, lampião e lareira. Você tem um fósforo. O que acende primeiro?	O fósforo	enigma-098.html	N	\N	1
199	html:enigma-099	html	Difícil	198	Existe uma palavra que, quando escrita corretamente, fica &#39;errada&#39;. Qual?	Errada	enigma-099.html	N	\N	1
200	html:enigma-100	html	Difícil	200	Senha de 4 dígitos: 682 tem um correto na posição; 614 tem um correto fora da posição; 206 tem dois corretos fora da posição; 738 nenhum correto; 780 um correto fora da posição. Qual a senha?	042	enigma-100.html	N	\N	1
203	jogo:enigma-101	jogo	Jogo	40	Jogo: Paddle — alcance 300 pontos.	300	enigma-101.html	S	1	1
204	jogo:enigma-102	jogo	Jogo	20	Jogo: Comilão — alcance 500 pontos.	500	enigma-102.html	S	1	2
413	jogo:enigma-103	jogo	Jogo	2	Jogo: Cobrinha — alcance 200 pontos.	200	enigma-103.html	S	1	1
414	jogo:enigma-104	jogo	Jogo	50	Jogo: Invasores — alcance 250 pontos.	250	enigma-104.html	S	1	2
424	jogo:enigma-105	jogo	Jogo	1	Jogo: TIM — alcance 300 pontos.	600	enigma-105.html	S	1	6
\.

-- realinha a sequence do id (identity) pra não colidir com os próximos inserts (ex.: pelo /admin)
SELECT setval(pg_get_serial_sequence('enigma','id'), (SELECT MAX(id) FROM enigma));

COMMIT;

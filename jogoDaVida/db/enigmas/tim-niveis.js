// TIM — os desafios. Coordenadas no mundo de 640 x 400 (chão em y = 392).
// `fixas`: peças do cenário (não se mexem). `caixa`: o que o jogador pode
// colocar. Cada desafio foi verificado por simulação (db/enigmas/tim-teste.mjs):
// resolve com as peças da caixa bem colocadas e NÃO resolve sem elas.
(function (raiz) {
    const NIVEIS = [
        {
            titulo: 'Sopro certeiro',
            texto: 'Faça a bola de basquete cair no cesto. O ventilador só funciona com bateria.',
            bola: { tipo: 'basquete', x: 130, y: 185 },
            fixas: [
                { tipo: 'bloco', x: 40, y: 200, w: 250, h: 12 },
                { tipo: 'cesto', x: 440, y: 346 },
            ],
            caixa: { ventilador: 1, bateria: 1 },
            objetivo: { tipo: 'cesto' },
        },
        {
            titulo: 'Por cima do muro',
            texto: 'A bola cai reto no chão. Leve-a por cima do muro até o cesto.',
            bola: { tipo: 'basquete', x: 90, y: 40 },
            fixas: [
                { tipo: 'bloco', x: 330, y: 250, w: 20, h: 142 },
                { tipo: 'cesto', x: 470, y: 346 },
            ],
            caixa: { rampa: 1, trampolim: 1 },
            objetivo: { tipo: 'cesto' },
        },
        {
            titulo: 'Balão preso',
            texto: 'O balão está preso sob a laje, e uma parede desce do teto no caminho. Faça ele chegar na estrela.',
            bola: { tipo: 'balao', x: 120, y: 330 },
            fixas: [
                { tipo: 'bloco', x: 30, y: 170, w: 250, h: 14 },
                { tipo: 'bloco', x: 280, y: 110, w: 14, h: 74 },
                { tipo: 'bloco', x: 400, y: 2, w: 16, h: 290 },
            ],
            caixa: { ventilador: 1, bateria: 1, rampa: 1 },
            objetivo: { tipo: 'zona', x: 460, y: 20, w: 150, h: 80 },
        },
        {
            titulo: 'A roda do rato',
            texto: 'Faça a bola de basquete descer pelo cano até o cesto. O rato só corre quando uma bola encosta na gaiola dele, e a correia leva o giro da roda até a engrenagem da esteira.',
            bolas: [
                { tipo: 'boliche', x: 30, y: 270 },    // cai sozinha
                { tipo: 'boliche', x: 100, y: 318 },   // em cima da esteira 1
                { tipo: 'boliche', x: 210, y: 218 },   // em cima da esteira 2
                { tipo: 'basquete', x: 300, y: 70 },   // em cima da esteira 3
            ],
            fixas: [
                { tipo: 'esteira', id: 'e1', x: 120, y: 340, dir: 1 },
                { tipo: 'esteira', id: 'e2', x: 250, y: 240, dir: 1 },
                { tipo: 'esteira', id: 'e3', x: 340, y: 90, dir: 1 },
                { tipo: 'cano', pontos: [[440, 100], [440, 170], [560, 290], [560, 345]], largura: 44 },
                { tipo: 'cesto', x: 528, y: 346 },
            ],
            caixa: { rato: 3, correia: 3, rampa: 3 },
            objetivo: { tipo: 'cesto', bola: 3 },
        },
        {
            titulo: 'Foles e bexigas',
            texto: 'Estoure todas as bexigas. Um fole só sopra quando uma bola cai em cima dele; a tesoura corta a bexiga que chega nela, e a engrenagem girando também.',
            bolas: [
                { tipo: 'boliche', x: 330, y: 28 },    // em cima da gaiola do rato
                { tipo: 'tenis', x: 90, y: 200 },      // em cima do fole da esquerda
                { tipo: 'bexiga', x: 385, y: 101 },     // presa sob a barra de cima
                { tipo: 'bexiga', x: 176, y: 231 },     // presa sob a barra da esquerda
                { tipo: 'bexiga', x: 491, y: 323 },     // presa sob a barra de baixo
            ],
            fixas: [
                { tipo: 'rato', id: 'r1', x: 330, y: 65 },
                { tipo: 'engrenagem', id: 'g1', x: 340, y: 104, r: 18 },
                { tipo: 'correia', id: 'c1', de: 'r1', para: 'g1' },
                { tipo: 'bloco', x: 359, y: 70, w: 52, h: 12 },
                { tipo: 'fole', x: 100, y: 244, dir: 1 },
                { tipo: 'bloco', x: 150, y: 200, w: 60, h: 12 },
                { tipo: 'tesoura', x: 232, y: 231, dir: -1 },
                { tipo: 'bloco', x: 460, y: 292, w: 72, h: 12 },
            ],
            caixa: { basquete: 1, tenis: 1, fole: 2, tesoura: 1 },
            objetivo: { tipo: 'estourar' },
        },
        {
            titulo: 'Espelho',
            texto: 'Coloque as duas bolas de boliche dentro dos canos em U. O lado direito é o espelho do esquerdo: monte igual, mas espelhe a gaiola do rato (⇋) para a roda girar ao contrário.',
            bolas: [
                { tipo: 'basquete', x: 95, y: 110 },   // dentro da caixa de tijolos, em cima da gaiola
                { tipo: 'boliche', x: 70, y: 228 },    // em cima da esteira da esquerda
                { tipo: 'boliche', x: 570, y: 228 },   // em cima da esteira da direita
            ],
            fixas: [
                // lado esquerdo, já montado: caixa de tijolos com a gaiola, correia até a esteira
                { tipo: 'bloco', x: 50, y: 50, w: 90, h: 10 },
                { tipo: 'bloco', x: 50, y: 170, w: 90, h: 10 },
                { tipo: 'bloco', x: 50, y: 60, w: 10, h: 110 },
                { tipo: 'bloco', x: 130, y: 60, w: 10, h: 110 },
                { tipo: 'rato', id: 'r1', x: 95, y: 152 },
                { tipo: 'esteira', id: 'e1', x: 95, y: 250, w: 90, dir: 1 },
                { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
                { tipo: 'cano', pontos: [[175, 262], [175, 350], [285, 350], [285, 262]], largura: 40 },
                // lado direito (espelho): caixa vazia, esteira e cano
                { tipo: 'bloco', x: 500, y: 50, w: 90, h: 10 },
                { tipo: 'bloco', x: 500, y: 170, w: 90, h: 10 },
                { tipo: 'bloco', x: 500, y: 60, w: 10, h: 110 },
                { tipo: 'bloco', x: 580, y: 60, w: 10, h: 110 },
                { tipo: 'esteira', id: 'e2', x: 545, y: 250, w: 90, dir: 1 },
                { tipo: 'cano', pontos: [[465, 262], [465, 350], [355, 350], [355, 262]], largura: 40 },
            ],
            caixa: { basquete: 1, correia: 1, rato: 1 },
            objetivo: { tipo: 'canos', bolas: [1, 2] },
        },
        // ── 7 a 16: inspirados nos desafios seguintes do TIM original ("Flip, Flip, Flip",
        // "Punch Out", "Bouncing over to Mort", "Tilting at Windmills", "Like a Hurricane",
        // "Lighting a Fuse", "Boom, Boom, Bang", "Climbing a Hill"...), cada vez mais difíceis.
        {
            titulo: 'Vira, vira, vira',
            texto: 'Faça a bola de tênis cair no cesto. Use gangorras: a bola que cai na ponta de cima arremessa a que está na ponta de baixo — e a bala de canhão é bem pesada. ⇋ (F) espelha a gangorra.',
            bolas: [
                { tipo: 'bala', x: 100, y: 40 },
                { tipo: 'basquete', x: 180, y: 367 },   // na altura da ponta baixa de uma gangorra
                { tipo: 'tenis', x: 550, y: 372 },
            ],
            fixas: [
                { tipo: 'bloco', x: 300, y: 210, w: 20, h: 182 },
                { tipo: 'cesto', x: 566, y: 346 },
            ],
            caixa: { gangorra: 2 },
            objetivo: { tipo: 'cesto', bola: 2 },
        },
        {
            titulo: 'Nocaute',
            texto: 'Leve a bola de beisebol até a estrela. A luva de boxe soca para a frente quando uma bola encosta na metade de trás dela (o botão vermelho).',
            bolas: [
                { tipo: 'beisebol', x: 210, y: 371 },
                { tipo: 'bala', x: 450, y: 135 },
                { tipo: 'basquete', x: 510, y: 40 },
            ],
            fixas: [
                { tipo: 'bloco', x: 420, y: 150, w: 218, h: 12 },
                { tipo: 'bloco', x: 110, y: 320, w: 14, h: 72 },
            ],
            caixa: { luva: 1, gangorra: 1 },
            objetivo: { tipo: 'zona', x: 4, y: 280, w: 104, h: 112 },
        },
        {
            titulo: 'Pulando até o cesto',
            texto: 'Faça a bola de basquete pular os três muros e cair no cesto. O teto é baixo: um pulo só não basta. Gire os trampolins com a alça ⟳.',
            bola: { tipo: 'basquete', x: 50, y: 160 },
            fixas: [
                { tipo: 'bloco', x: 2, y: 2, w: 636, h: 118 },
                { tipo: 'bloco', x: 160, y: 250, w: 14, h: 142 },
                { tipo: 'bloco', x: 320, y: 220, w: 14, h: 172 },
                { tipo: 'bloco', x: 480, y: 190, w: 14, h: 202 },
                { tipo: 'cesto', x: 556, y: 346 },
            ],
            caixa: { trampolim: 3 },
            objetivo: { tipo: 'cesto' },
        },
        {
            titulo: 'Moinhos de vento',
            texto: 'Estoure as duas bexigas. As engrenagens só estouram girando: o moinho gira com vento nas pás e, pela correia, gira a engrenagem.',
            bolas: [
                { tipo: 'tenis', x: 80, y: 40 },        // cai no fole
                { tipo: 'bexiga', x: 265, y: 231 },
                { tipo: 'bexiga', x: 515, y: 151 },
            ],
            fixas: [
                { tipo: 'fole', x: 80, y: 300, dir: 1 },
                { tipo: 'bloco', x: 225, y: 200, w: 80, h: 12 },
                { tipo: 'engrenagem', id: 'g1', x: 265, y: 266, r: 18 },
                { tipo: 'bloco', x: 470, y: 120, w: 90, h: 12 },
                { tipo: 'engrenagem', id: 'g2', x: 515, y: 186, r: 18 },
            ],
            caixa: { moinho: 2, correia: 2, ventilador: 1, bateria: 1 },
            objetivo: { tipo: 'estourar' },
        },
        {
            titulo: 'Furacão',
            texto: 'Leve o balão até a estrela. Aqui não tem bateria: os ventiladores só ligam pelo fio de um interruptor, e o interruptor liga quando uma bola bate nele.',
            bolas: [
                { tipo: 'balao', x: 560, y: 330 },
                { tipo: 'basquete', x: 50, y: 40 },
            ],
            fixas: [
                { tipo: 'bloco', x: 400, y: 240, w: 238, h: 12 },
                { tipo: 'bloco', x: 100, y: 150, w: 300, h: 12 },
                { tipo: 'bloco', x: 345, y: 205, w: 15, h: 95 },
            ],
            caixa: { ventilador: 2, interruptor: 1, fio: 2, rampa: 1 },
            objetivo: { tipo: 'zona', x: 4, y: 20, w: 92, h: 100 },
        },
        {
            titulo: 'Luz e fogo',
            texto: 'Ponha a bola de basquete no cesto. Um caixote está no caminho — só dinamite quebra. A lanterna acesa, passando por uma lupa, junta a luz num ponto que acende pavio.',
            bolas: [
                { tipo: 'basquete', x: 500, y: 290 },
                { tipo: 'tenis', x: 120, y: 40 },
            ],
            fixas: [
                { tipo: 'lanterna', id: 'l1', x: 60, y: 222, dir: 1 },
                { tipo: 'interruptor', id: 'i1', x: 220, y: 380 },
                { tipo: 'rampa', x: 480, y: 300, ang: 15, len: 140 },
                { tipo: 'caixote', x: 550, y: 230, w: 30, h: 100 },
                { tipo: 'dinamite', x: 565, y: 222 },
                { tipo: 'cesto', x: 540, y: 346 },
            ],
            caixa: { rampa: 1, fio: 1, lupa: 1 },
            objetivo: { tipo: 'cesto' },
        },
        {
            titulo: 'Fogo no canhão',
            texto: 'Acerte uma bala de canhão no cesto lá no alto. O canhão dispara quando o foco da lupa esquenta o pavio dele; mire girando o canhão.',
            bola: { tipo: 'basquete', x: 40, y: 40 },
            fixas: [
                { tipo: 'bloco', x: 300, y: 150, w: 16, h: 242 },
                { tipo: 'bloco', x: 520, y: 200, w: 118, h: 12 },
                { tipo: 'cesto', x: 550, y: 154 },
            ],
            caixa: { interruptor: 1, fio: 1, lanterna: 1, lupa: 1, canhao: 1 },
            objetivo: { tipo: 'cesto', qualquer: true },
        },
        {
            titulo: 'Bum, bum, bang',
            texto: 'Leve a bola até a estrela. Dois caixotes no caminho, longe demais um do outro e do facho da lanterna: uma dinamite que explode acende as outras por perto.',
            bola: { tipo: 'basquete', x: 50, y: 90 },
            fixas: [
                { tipo: 'rampa', x: 110, y: 120, ang: 10, len: 200 },
                { tipo: 'caixote', x: 200, y: 60, w: 30, h: 90 },
                { tipo: 'caixote', x: 440, y: 300, w: 30, h: 92 },
                { tipo: 'lanterna', id: 'l1', x: 40, y: 250, dir: 1, ligado: true },
            ],
            caixa: { lupa: 1, dinamite: 3 },
            objetivo: { tipo: 'zona', x: 540, y: 300, w: 96, h: 92 },
        },
        {
            titulo: 'Subindo o morro',
            texto: 'Leve a bola de boliche lá para cima, até a estrela. Os ratos já estão correndo; monte uma escada de esteiras inclinadas e ligue cada uma a um rato.',
            bolas: [
                { tipo: 'boliche', x: 110, y: 300 },
                { tipo: 'tenis', x: 50, y: 250 },      // em cima das gaiolas: os ratos começam correndo
                { tipo: 'tenis', x: 200, y: 330 },
                { tipo: 'tenis', x: 420, y: 280 },
            ],
            fixas: [
                { tipo: 'rato', id: 'r1', x: 50, y: 300 },
                { tipo: 'bloco', x: 20, y: 318, w: 60, h: 10 },
                { tipo: 'rato', id: 'r2', x: 200, y: 374 },
                { tipo: 'rato', id: 'r3', x: 420, y: 330 },
                { tipo: 'bloco', x: 390, y: 348, w: 60, h: 10 },
                { tipo: 'bloco', x: 415, y: 180, w: 223, h: 12 },
            ],
            caixa: { esteira: 3, correia: 3 },
            objetivo: { tipo: 'zona', x: 440, y: 100, w: 196, h: 80 },
        },
        {
            titulo: 'A máquina incrível',
            texto: 'Estoure as duas bexigas. Tudo começa com a bola de basquete caindo; a bola de tênis precisa voar até o interruptor lá no alto. Use tudo o que aprendeu.',
            bolas: [
                { tipo: 'tenis', x: 430, y: 372 },
                { tipo: 'bala', x: 190, y: 135 },
                { tipo: 'basquete', x: 130, y: 40 },
                { tipo: 'bexiga', x: 420, y: 199 },
                { tipo: 'bexiga', x: 240, y: 259 },
            ],
            fixas: [
                { tipo: 'bloco', x: 2, y: 150, w: 218, h: 12 },
                { tipo: 'interruptor', id: 'i1', x: 560, y: 100 },
                { tipo: 'ventilador', id: 'v1', x: 620, y: 250, dir: -1 },
                { tipo: 'bloco', x: 380, y: 170, w: 80, h: 10 },
                { tipo: 'engrenagem', id: 'g1', x: 420, y: 233, r: 18 },
                { tipo: 'lanterna', id: 'l1', x: 620, y: 330, dir: -1 },
                { tipo: 'bloco', x: 210, y: 230, w: 60, h: 10 },
                { tipo: 'dinamite', x: 240, y: 330 },
            ],
            caixa: { luva: 1, gangorra: 1, fio: 2, moinho: 1, correia: 1, lupa: 1 },
            objetivo: { tipo: 'estourar' },
        },
        // ── 17 em diante: os outros desafios do TIM original (são 87; fases 1–16 já cobrem
        // #1, 2, 3, 4, 5, 6, 8, 11, 14, 15 e 21). Montagens recriadas a partir da descrição e da
        // solução de cada desafio (walkthroughs Sierra Help / GameBoomers / JustAdventure).
        // Lote 1: só peças que já existiam.
        // #28 do TIM original: A Baseball in Every Pot
        {
            titulo: 'Uma bola em cada pote',
            texto: 'Ponha uma bola de beisebol em cada pote. As bolas de boliche vão cair: use as gangorras para arremessar o beisebol lá para cima.',
            bolas: [
                { tipo: 'beisebol', x: 230, y: 371 },
                { tipo: 'boliche', x: 295, y: 40 },
                { tipo: 'beisebol', x: 410, y: 371 },
                { tipo: 'boliche', x: 345, y: 90 },
            ],
            fixas: [
                { tipo: 'cesto', id: 'p1', x: 16, y: 150, estilo: 'pote' },
                { tipo: 'bloco', x: 20, y: 196, w: 56, h: 196 },
                { tipo: 'cesto', id: 'p2', x: 560, y: 150, estilo: 'pote' },
                { tipo: 'bloco', x: 564, y: 196, w: 56, h: 196 },
            ],
            caixa: { gangorra: 2 },
            objetivo: { tipo: 'cestos' },
        },
        // #42 do TIM original: Ring of Fire
        {
            titulo: 'Anel de fogo',
            texto: 'Quebre os dois caixotes. Basta acender uma dinamite: a explosão acende as vizinhas, uma a uma, em volta do anel. Esta lanterna acende quando uma bola bate nela.',
            bola: { tipo: 'tenis', x: 60, y: 40 },
            fixas: [
                { tipo: 'lanterna', id: 'l1', x: 240, y: 370, dir: 1, ang: -45, toque: true },
                { tipo: 'dinamite', x: 530, y: 200 },
                { tipo: 'dinamite', x: 501, y: 129 },
                { tipo: 'dinamite', x: 430, y: 100 },
                { tipo: 'dinamite', x: 359, y: 129 },
                { tipo: 'dinamite', x: 330, y: 200 },
                { tipo: 'dinamite', x: 359, y: 271 },
                { tipo: 'dinamite', x: 430, y: 300 },
                { tipo: 'dinamite', x: 501, y: 271 },
                { tipo: 'caixote', x: 510, y: 90, w: 24, h: 24 },
                { tipo: 'caixote', x: 326, y: 90, w: 24, h: 24 },
            ],
            caixa: { rampa: 1, lupa: 1 },
            objetivo: { tipo: 'caixotes' },
        },
        // #66 do TIM original: Knock it off
        {
            titulo: 'Derrube-a',
            texto: 'Derrube a bola de beisebol da prateleira para dentro do cesto. O rato lá em cima só corre se algo encostar na gaiola — e o balão está subindo.',
            bolas: [{ tipo: 'beisebol', x: 240, y: 143 }, { tipo: 'beisebol', x: 120, y: 40 }, { tipo: 'balao', x: 400, y: 330 }],
            fixas: [
                { tipo: 'bloco', x: 210, y: 155, w: 90, h: 12 },
                { tipo: 'rato', id: 'r1', x: 300, y: 60 },
                { tipo: 'cesto', x: 330, y: 346 },
            ],
            caixa: { esteira: 1, correia: 1, rampa: 1 },
            objetivo: { tipo: 'cesto', bola: 0 },
        },
        // #31 do TIM original: Put Away the Basketballs
        {
            titulo: 'Guardar as bolas de basquete',
            texto: 'Guarde na caixa as duas bolas de basquete lá de cima. A terceira bola pode servir para fazer um rato correr.',
            bolas: [
                { tipo: 'basquete', x: 520, y: 100 },
                { tipo: 'basquete', x: 575, y: 100 },
                { tipo: 'basquete', x: 420, y: 150 },
            ],
            fixas: [{ tipo: 'cesto', id: 'c1', x: 340, y: 346, estilo: 'caixa' }],
            caixa: { esteira: 1, rato: 1, correia: 1, rampa: 1 },
            objetivo: { tipo: 'cesto', bolas: [0, 1] },
        },
        // #64 do TIM original: Fire the Cannon
        {
            titulo: 'Disparar o canhão',
            texto: 'Acerte a bala de canhão no cesto. Esta lanterna acende quando uma bola bate nela, e a lupa já está no lugar certo.',
            bolas: [{ tipo: 'beisebol', x: 120, y: 100 }, { tipo: 'basquete', x: 340, y: 40 }],
            fixas: [
                { tipo: 'lanterna', id: 'l1', x: 280, y: 250, dir: 1, toque: true },
                { tipo: 'bloco', x: 270, y: 258, w: 20, h: 134 },
                { tipo: 'lupa', x: 400, y: 250 },
                { tipo: 'canhao', x: 470, y: 250, dir: 1, ang: -75 },
                { tipo: 'bloco', x: 450, y: 261, w: 40, h: 131 },
                { tipo: 'bloco', x: 540, y: 120, w: 98, h: 12 },
                { tipo: 'cesto', x: 560, y: 74 },
            ],
            caixa: { esteira: 1, rato: 1, correia: 1 },
            objetivo: { tipo: 'cesto', qualquer: true },
        },
        // #35 do TIM original: Wheeeeeee!
        {
            titulo: 'Uiiii!',
            texto: 'Leve a bola de boliche até a boca do cano: ele desce direto no cesto. A rampa desvia, o trampolim faz pular o muro.',
            bola: { tipo: 'boliche', x: 60, y: 40 },
            fixas: [
                { tipo: 'bloco', x: 270, y: 250, w: 16, h: 142 },
                { tipo: 'cano', pontos: [[430, 210], [430, 270], [520, 320], [520, 340]], largura: 60 },
                { tipo: 'cesto', x: 488, y: 346 },
            ],
            caixa: { rampa: 1, trampolim: 1 },
            objetivo: { tipo: 'cesto' },
        },
        // #82 do TIM original: Bounce, Bounce, Bounce Go the Balls
        {
            titulo: 'Quica, quica, quica',
            texto: 'Leve as duas bolas de basquete até o cano que desce no cesto. Uma delas cai dentro de um poço: faça ela pular para fora.',
            bolas: [{ tipo: 'basquete', x: 600, y: 40 }, { tipo: 'basquete', x: 400, y: 40 }],
            fixas: [
                { tipo: 'bloco', x: 556, y: 170, w: 14, h: 222 },
                { tipo: 'cano', pontos: [[150, 140], [150, 250], [60, 310], [60, 340]], largura: 56 },
                { tipo: 'cesto', x: 28, y: 346 },
            ],
            caixa: { trampolim: 2 },
            objetivo: { tipo: 'cesto', bolas: [0, 1] },
        },
        // #38 do TIM original: Inside the Walls
        {
            titulo: 'Dentro das paredes',
            texto: 'Ponha a bola de boliche no cesto cercado de tijolos. O fole sopra quando a bola de beisebol cai nele.',
            bolas: [{ tipo: 'boliche', x: 300, y: 100 }, { tipo: 'beisebol', x: 110, y: 40 }],
            fixas: [
                { tipo: 'fole', x: 110, y: 250, dir: 1 },
                { tipo: 'cesto', x: 540, y: 200 },
                { tipo: 'bloco', x: 540, y: 246, w: 64, h: 146 },
                { tipo: 'bloco', x: 520, y: 170, w: 14, h: 76 },
                { tipo: 'bloco', x: 610, y: 170, w: 14, h: 76 },
            ],
            caixa: { esteira: 1, moinho: 1, correia: 1, trampolim: 1 },
            objetivo: { tipo: 'cesto' },
        },
        // #58 do TIM original: Exercise All Four Mice
        {
            titulo: 'Exercitar os quatro ratos',
            texto: 'Faça os quatro ratos correrem. As esteiras levariam as bolas de tênis até as gaiolas de cima — se estivessem ligadas a alguém.',
            bolas: [
                { tipo: 'basquete', x: 300, y: 200 },
                { tipo: 'bala', x: 360, y: 40 },
                { tipo: 'basquete', x: 440, y: 367 },
                { tipo: 'tenis', x: 80, y: 184 },
                { tipo: 'tenis', x: 560, y: 184 },
            ],
            fixas: [
                { tipo: 'rato', id: 'r1', x: 80, y: 374 },
                { tipo: 'rato', id: 'r2', x: 600, y: 374 },
                { tipo: 'rato', id: 'r3', x: 45, y: 260 },
                { tipo: 'rato', id: 'r4', x: 595, y: 260 },
                { tipo: 'esteira', id: 'e1', x: 110, y: 200, dir: -1 },
                { tipo: 'esteira', id: 'e2', x: 530, y: 200, dir: 1 },
            ],
            caixa: { rampa: 1, gangorra: 1, correia: 2 },
            objetivo: { tipo: 'ratos' },
        },
        // #49 do TIM original: Feeling a Little out of Sorts
        {
            titulo: 'Meio fora de ordem',
            texto: 'Cada bola tem o seu pote: a de boliche vai no pote do meio, a de basquete no da direita e a de tênis no da esquerda.',
            bolas: [{ tipo: 'boliche', x: 100, y: 40 }, { tipo: 'basquete', x: 230, y: 40 }, { tipo: 'tenis', x: 360, y: 40 }],
            fixas: [
                { tipo: 'cesto', id: 'c1', x: 560, y: 346, estilo: 'pote' },
                { tipo: 'cesto', id: 'c2', x: 300, y: 346, estilo: 'pote' },
                { tipo: 'cesto', id: 'c3', x: 30, y: 346, estilo: 'pote' },
                { tipo: 'bloco', x: 180, y: 160, w: 120, h: 12 },
            ],
            caixa: { rampa: 3 },
            objetivo: {
                tipo: 'todos',
                lista: [
                    { tipo: 'cesto', cesto: 'c2', bola: 0 },
                    { tipo: 'cesto', cesto: 'c1', bola: 1 },
                    { tipo: 'cesto', cesto: 'c3', bola: 2 },
                ],
            },
        },
        // Lote 2: revólver, caixa-surpresa e detonador.
        // #76 do TIM original: Balloons in Danger
        {
            titulo: 'Bexigas em perigo',
            texto: 'Os dois revólveres vão disparar contra as bexigas da direita. Proteja as duas: um balão no caminho leva o tiro no lugar delas.',
            bolas: [
                { tipo: 'bexiga', x: 560, y: 149 },
                { tipo: 'bexiga', x: 560, y: 299 },
                { tipo: 'basquete', x: 60, y: 40 },
                { tipo: 'tenis', x: 60, y: 230 },
            ],
            fixas: [
                { tipo: 'arma', x: 80, y: 150, dir: 1 },
                { tipo: 'arma', x: 80, y: 300, dir: 1 },
                { tipo: 'bloco', x: 530, y: 118, w: 60, h: 12 },
                { tipo: 'bloco', x: 530, y: 268, w: 60, h: 12 },
                { tipo: 'bloco', x: 300, y: 118, w: 40, h: 12 },
                { tipo: 'bloco', x: 300, y: 268, w: 40, h: 12 },
            ],
            caixa: { balao: 2 },
            objetivo: { tipo: 'todos', lista: [{ tipo: 'armas' }, { tipo: 'inteiras', bolas: [0, 1] }] },
        },
        // #17 do TIM original: Doing Some Blasting
        {
            titulo: 'Fazendo umas explosões',
            texto: 'Quebre os três caixotes das prateleiras. Ligue dinamites ao detonador com fios: quando uma bola apertar a alavanca dele, elas explodem. Uma explosão quebra caixotes por perto — às vezes dois de uma vez.',
            bolas: [{ tipo: 'basquete', x: 140, y: 367 }, { tipo: 'boliche', x: 60, y: 40 }],
            fixas: [
                { tipo: 'bloco', x: 440, y: 120, w: 198, h: 12 },
                { tipo: 'caixote', x: 570, y: 90, w: 30, h: 30 },
                { tipo: 'bloco', x: 440, y: 220, w: 198, h: 12 },
                { tipo: 'caixote', x: 570, y: 190, w: 30, h: 30 },
                { tipo: 'bloco', x: 440, y: 330, w: 198, h: 12 },
                { tipo: 'caixote', x: 570, y: 300, w: 30, h: 30 },
                { tipo: 'detonador', id: 'd1', x: 270, y: 236 },
                { tipo: 'bloco', x: 255, y: 247, w: 30, h: 145 },
            ],
            caixa: { gangorra: 1, dinamite: 2, fio: 2 },
            objetivo: { tipo: 'caixotes' },
        },
        // #27 do TIM original: Popping Balloons on the Moon
        {
            titulo: 'Estourando bexigas na Lua',
            texto: 'Estoure as três bexigas. Estamos na Lua: tudo cai devagar. A engrenagem estoura girando, o revólver estoura com o tiro e a tesoura corta a bexiga que sobe até ela.',
            ambiente: { gravidade: 0.17 },
            bolas: [
                { tipo: 'bexiga', x: 100, y: 144 },
                { tipo: 'bexiga', x: 320, y: 81 },
                { tipo: 'bexiga', x: 540, y: 370 },
                { tipo: 'tenis', x: 100, y: 271 },
                { tipo: 'basquete', x: 455, y: 30 },
            ],
            fixas: [
                { tipo: 'bloco', x: 60, y: 113, w: 80, h: 12 },
                { tipo: 'engrenagem', id: 'g1', x: 100, y: 178, r: 18 },
                { tipo: 'rato', id: 'r1', x: 100, y: 300 },
                { tipo: 'bloco', x: 70, y: 318, w: 60, h: 10 },
                { tipo: 'bloco', x: 280, y: 50, w: 80, h: 12 },
            ],
            caixa: { correia: 1, arma: 1, tesoura: 1 },
            objetivo: { tipo: 'estourar' },
        },
        // #7 do TIM original: Jack Says, "Hi Bob"
        {
            titulo: 'João diz: Oi, Bob!',
            texto: 'Ponha a bola de tênis no cesto lá no alto. A caixa-surpresa, girada por uma correia, solta o boneco depois de um tempo — e ele arremessa o que estiver em cima. Gire a caixa para escolher a direção.',
            bolas: [{ tipo: 'tenis', x: 500, y: 345 }, { tipo: 'bala', x: 60, y: 300 }, { tipo: 'basquete', x: 180, y: 320 }],
            fixas: [
                { tipo: 'rato', id: 'r1', x: 60, y: 374 },
                { tipo: 'rampa', x: 310, y: 262, ang: 10, len: 140 },
                { tipo: 'bloco', x: 375, y: 270, w: 50, h: 12 },
                { tipo: 'rato', id: 'r2', x: 400, y: 252 },
                { tipo: 'surpresa', id: 'j2', x: 500, y: 377, ang: -10 },
                { tipo: 'cesto', id: 'c1', x: 330, y: 100 },
                { tipo: 'bloco', x: 330, y: 146, w: 64, h: 10 },
            ],
            caixa: { surpresa: 1, correia: 2 },
            objetivo: { tipo: 'cesto', bola: 0 },
        },
        // #75 do TIM original: Blow up
        {
            titulo: 'Explodir tudo',
            texto: 'Quebre os dois caixotes. O tiro de um revólver faz a dinamite explodir. O revólver dispara quando uma bola encosta no gatilho, atrás.',
            bolas: [{ tipo: 'boliche', x: 60, y: 40 }, { tipo: 'basquete', x: 350, y: 192 }],
            fixas: [
                { tipo: 'dinamite', x: 300, y: 200 },
                { tipo: 'bloco', x: 280, y: 208, w: 40, h: 12 },
                { tipo: 'caixote', x: 285, y: 140, w: 30, h: 40 },
                { tipo: 'bloco', x: 330, y: 208, w: 50, h: 12 },
                { tipo: 'dinamite', x: 600, y: 330 },
                { tipo: 'bloco', x: 580, y: 338, w: 40, h: 54 },
                { tipo: 'caixote', x: 590, y: 240, w: 40, h: 50 },
            ],
            caixa: { arma: 2 },
            objetivo: { tipo: 'caixotes' },
        },
        // #23 do TIM original: Trick Shooting
        {
            titulo: 'Tiro ao alvo',
            texto: 'Ponha uma bola de beisebol em cada caixa. Mire bem: o tiro sai reto e derruba a bola dos pedestais.',
            bolas: [{ tipo: 'beisebol', x: 300, y: 139 }, { tipo: 'beisebol', x: 300, y: 297 }, { tipo: 'boliche', x: 80, y: 40 }],
            fixas: [
                { tipo: 'bloco', x: 290, y: 150, w: 20, h: 12 },
                { tipo: 'bloco', x: 290, y: 309, w: 20, h: 12 },
                { tipo: 'cesto', id: 'k1', x: 140, y: 346, estilo: 'caixa' },
                { tipo: 'cesto', id: 'k2', x: 520, y: 346, estilo: 'caixa' },
            ],
            caixa: { arma: 2 },
            objetivo: { tipo: 'cestos' },
        },
        // #32 do TIM original: Five Gun Salute
        {
            titulo: 'Salva de cinco tiros',
            texto: 'Faça os cinco revólveres dispararem. Cada tiro derruba uma bola de beisebol, que pode cair no gatilho de outro revólver. Faltam dois.',
            bolas: [
                { tipo: 'boliche', x: 50, y: 20 },
                { tipo: 'beisebol', x: 120, y: 68 },
                { tipo: 'beisebol', x: 310, y: 128 },
                { tipo: 'beisebol', x: 360, y: 188 },
                { tipo: 'beisebol', x: 170, y: 248 },
            ],
            fixas: [
                { tipo: 'bloco', x: 110, y: 80, w: 20, h: 10 },
                { tipo: 'bloco', x: 300, y: 140, w: 20, h: 10 },
                { tipo: 'bloco', x: 350, y: 200, w: 20, h: 10 },
                { tipo: 'bloco', x: 160, y: 260, w: 20, h: 10 },
                { tipo: 'arma', x: 60, y: 70, dir: 1 },
                { tipo: 'arma', x: 420, y: 190, dir: -1 },
                { tipo: 'arma', x: 60, y: 310, dir: 1 },
            ],
            caixa: { arma: 2 },
            objetivo: { tipo: 'armas' },
        },
        // Lote 3: eletricidade (tomada, gerador, motor, painel solar, lâmpada) e engrenagens encostadas.
        // #45 do TIM original: You Gotta Smile
        {
            titulo: 'Sorria!',
            texto: 'Faça a engrenagem grande girar. O interruptor lá no alto liga o motor por um fio — se uma bola chegar até ele.',
            bola: { tipo: 'tenis', x: 120, y: 40 },
            fixas: [
                { tipo: 'interruptor', id: 'i1', x: 300, y: 110 },
                { tipo: 'bloco', x: 280, y: 90, w: 40, h: 12 },
                { tipo: 'motor', id: 'mt', x: 450, y: 300 },
                { tipo: 'engrenagem', id: 'gs', x: 560, y: 230, r: 26 },
            ],
            caixa: { trampolim: 1, fio: 1, correia: 1 },
            objetivo: { tipo: 'girar', ids: ['gs'] },
        },
        // #40 do TIM original: Going in the Hole
        {
            titulo: 'Indo para o buraco',
            texto: 'Ponha as duas bolas de basquete no buraco. O ventilador só liga pelo fio de um interruptor.',
            bolas: [{ tipo: 'basquete', x: 60, y: 100 }, { tipo: 'basquete', x: 520, y: 325 }],
            fixas: [
                { tipo: 'bloco', x: 2, y: 340, w: 298, h: 52 },
                { tipo: 'bloco', x: 360, y: 340, w: 278, h: 52 },
                { tipo: 'ventilador', id: 'v1', x: 610, y: 320, dir: -1 },
            ],
            caixa: { rampa: 1, interruptor: 1, fio: 1 },
            objetivo: { tipo: 'zona', x: 302, y: 330, w: 56, h: 62, bolas: [0, 1], estilo: 'buraco' },
        },
        // #72 do TIM original: Laying down a Bunt
        {
            titulo: 'Bola curtinha',
            texto: 'Ponha a bola de beisebol no balde. A bala de canhão aperta o interruptor e acende a lâmpada; um painel solar perto da luz gera energia.',
            bolas: [{ tipo: 'beisebol', x: 400, y: 329 }, { tipo: 'bala', x: 60, y: 40 }],
            fixas: [
                { tipo: 'bloco', x: 2, y: 340, w: 518, h: 52 },
                { tipo: 'interruptor', id: 'i1', x: 60, y: 333 },
                { tipo: 'lampada', id: 'lp', x: 200, y: 180 },
                { tipo: 'bloco', x: 190, y: 150, w: 20, h: 6 },
                { tipo: 'fio', id: 'ff', de: 'i1', para: 'lp' },
                { tipo: 'cesto', x: 570, y: 346, estilo: 'balde' },
            ],
            caixa: { painel: 1, fio: 1, ventilador: 1 },
            objetivo: { tipo: 'cesto' },
        },
        // #12 do TIM original: Generators and Motors
        {
            titulo: 'Geradores e motores',
            texto: 'Leve a bola de tênis pelo cano até o cesto. O vento gira o moinho, o moinho gira o gerador, o gerador manda energia pelo fio ao motor, e o motor gira a esteira.',
            bola: { tipo: 'tenis', x: 400, y: 189 },
            fixas: [
                { tipo: 'ventilador', id: 'v1', x: 60, y: 300, dir: 1, ligado: true },
                { tipo: 'esteira', id: 'e1', x: 420, y: 200, dir: 1 },
                { tipo: 'motor', id: 'mt', x: 420, y: 280 },
                { tipo: 'cano', pontos: [[500, 215], [500, 335]], largura: 40 },
                { tipo: 'cesto', x: 468, y: 346 },
            ],
            caixa: { moinho: 1, gerador: 1, correia: 2, fio: 1 },
            objetivo: { tipo: 'cesto' },
        },
        // #13 do TIM original: Putting the Gears in Motion
        {
            titulo: 'Pondo as engrenagens em movimento',
            texto: 'Estoure a bexiga com a engrenagem de cima. Engrenagens encostadas giram juntas. A lanterna acende com o toque da bola, e um painel solar na luz liga o motor.',
            bolas: [{ tipo: 'bexiga', x: 480, y: 215 }, { tipo: 'bala', x: 60, y: 40 }],
            fixas: [
                { tipo: 'lanterna', id: 'l1', x: 60, y: 200, dir: 1, toque: true },
                { tipo: 'motor', id: 'mt', x: 300, y: 330 },
                { tipo: 'engrenagem', id: 'ga', x: 380, y: 330, r: 18 },
                { tipo: 'correia', id: 'cf', de: 'mt', para: 'ga' },
                { tipo: 'bloco', x: 450, y: 184, w: 60, h: 12 },
                { tipo: 'engrenagem', id: 'gd', x: 480, y: 251, r: 18 },
            ],
            caixa: { painel: 1, fio: 1, engrenagem: 2 },
            objetivo: { tipo: 'estourar' },
        },
        // #34 do TIM original: Pop Goes the Weasel
        {
            titulo: 'Pop! vai a doninha',
            texto: 'Estoure a bexiga com o boneco da caixa-surpresa. Ligue o rato à caixa usando duas engrenagens encostadas e correias.',
            bolas: [{ tipo: 'bexiga', x: 480, y: 291 }, { tipo: 'basquete', x: 60, y: 330 }],
            fixas: [
                { tipo: 'rato', id: 'r1', x: 60, y: 374 },
                { tipo: 'engrenagem', id: 'ga', x: 150, y: 300, r: 18 },
                { tipo: 'correia', id: 'cf', de: 'r1', para: 'ga' },
                { tipo: 'engrenagem', id: 'gb', x: 330, y: 240, r: 18 },
                { tipo: 'surpresa', id: 'j1', x: 480, y: 340 },
                { tipo: 'bloco', x: 450, y: 260, w: 60, h: 12 },
            ],
            caixa: { engrenagem: 2, correia: 2 },
            objetivo: { tipo: 'estourar' },
        },
        // Lote 4: vela e foguete (e lâmpada + lupa).
        // #67 do TIM original: Ten, Nine, Eight, Ignition Sequence Start...
        {
            titulo: 'Dez, nove, oito... ignição!',
            texto: 'Faça o foguete subir e sumir lá no alto. Ele acende quando uma chama chega perto do pavio, embaixo dele. A vela já está acesa — falta levá-la até lá.',
            bolas: [
                { tipo: 'foguete', x: 598, y: 356 },
                { tipo: 'vela', x: 150, y: 370, acesa: true },
                { tipo: 'bala', x: 70, y: 40 },
            ],
            fixas: [{ tipo: 'bloco', x: 480, y: 290, w: 14, h: 102 }, { tipo: 'bloco', x: 590, y: 368, w: 16, h: 24 }],
            caixa: { gangorra: 1, trampolim: 1 },
            objetivo: { tipo: 'foguetes' },
        },
        // #63 do TIM original: Launch All the Rockets
        {
            titulo: 'Lançar todos os foguetes',
            texto: 'Lance os dois foguetes. A luz da lâmpada, passando por uma lupa, se junta num ponto que acende o pavio. A lâmpada liga pelo interruptor.',
            bolas: [{ tipo: 'foguete', x: 200, y: 237 }, { tipo: 'foguete', x: 440, y: 237 }, { tipo: 'beisebol', x: 40, y: 40 }],
            fixas: [
                { tipo: 'bloco', x: 192, y: 258, w: 16, h: 134 },
                { tipo: 'bloco', x: 432, y: 258, w: 16, h: 134 },
                { tipo: 'lampada', id: 'lp', x: 320, y: 250 },
                { tipo: 'bloco', x: 310, y: 263, w: 20, h: 129 },
                { tipo: 'interruptor', id: 'i1', x: 140, y: 383 },
                { tipo: 'fio', id: 'ff', de: 'i1', para: 'lp' },
            ],
            caixa: { rampa: 1, lupa: 2 },
            objetivo: { tipo: 'foguetes' },
        },
        // #16 do TIM original: Blastoff
        {
            titulo: 'Decolagem',
            texto: 'Faça o foguete sair pelo vão do teto. A lanterna acende com o toque da bola; a lupa junta a luz, e a luz acende a vela. Uma vela acesa acende o pavio do foguete.',
            bola: { tipo: 'boliche', x: 60, y: 160 },
            fixas: [
                { tipo: 'lanterna', id: 'l1', x: 60, y: 300, dir: 1, toque: true },
                { tipo: 'bloco', x: 300, y: 320, w: 220, h: 12 },
                { tipo: 'bloco', x: 2, y: 120, w: 398, h: 12 },
                { tipo: 'bloco', x: 440, y: 120, w: 198, h: 12 },
            ],
            caixa: { foguete: 1, vela: 1, lupa: 1 },
            objetivo: { tipo: 'foguetes' },
        },
        // #50 do TIM original: Pop, Pop, Pop, Pop, And... Pop
        {
            titulo: 'Pop, pop, pop, pop e... pop!',
            texto: 'Estoure as cinco bexigas. A chama de uma vela acesa estoura bexiga. Ponha a vela na esteira e acenda com a luz — antes que a esteira comece a andar.',
            bolas: [
                { tipo: 'bexiga', x: 200, y: 231 },
                { tipo: 'bexiga', x: 280, y: 231 },
                { tipo: 'bexiga', x: 360, y: 231 },
                { tipo: 'bexiga', x: 440, y: 231 },
                { tipo: 'bexiga', x: 520, y: 231 },
                { tipo: 'tenis', x: 60, y: 120 },
                { tipo: 'basquete', x: 600, y: 20 },
            ],
            fixas: [
                { tipo: 'bloco', x: 150, y: 200, w: 420, h: 12 },
                { tipo: 'esteira', id: 'e1', x: 360, y: 280, w: 360, dir: 1 },
                { tipo: 'lanterna', id: 'l1', x: 60, y: 260, dir: 1, toque: true },
                { tipo: 'rato', id: 'r1', x: 590, y: 330 },
            ],
            caixa: { vela: 1, lupa: 1, correia: 1 },
            objetivo: { tipo: 'estourar' },
        },
        // #53 do TIM original: Red Alert!
        {
            titulo: 'Alerta vermelho!',
            texto: 'Lance os três foguetes. A lâmpada já está acesa: uma lupa perto dela acende a vela, e a esteira leva a vela por baixo dos pavios.',
            bolas: [
                { tipo: 'foguete', x: 330, y: 237 },
                { tipo: 'foguete', x: 430, y: 237 },
                { tipo: 'foguete', x: 530, y: 237 },
                { tipo: 'vela', x: 250, y: 263 },
                { tipo: 'boliche', x: 40, y: 40 },
            ],
            fixas: [
                { tipo: 'esteira', id: 'e1', x: 420, y: 280, w: 360, dir: 1 },
                { tipo: 'tomada', id: 't1', x: 160, y: 120 },
                { tipo: 'lampada', id: 'lp', x: 250, y: 160 },
                { tipo: 'fio', id: 'ff', de: 't1', para: 'lp' },
                { tipo: 'rato', id: 'r1', x: 470, y: 374 },
            ],
            caixa: { lupa: 1, correia: 1, rampa: 1 },
            objetivo: { tipo: 'foguetes' },
        },
        // #87 do TIM original: Up, Up, and Away
        {
            titulo: 'Para o alto e avante!',
            texto: 'Faça o foguete subir. A lanterna acende com o toque de uma bola, e a lupa já está mirando o pavio. O rato já está correndo.',
            bolas: [
                { tipo: 'foguete', x: 350, y: 97 },
                { tipo: 'beisebol', x: 370, y: 371 },
                { tipo: 'bala', x: 140, y: 135 },
                { tipo: 'tenis', x: 60, y: 171 },
            ],
            fixas: [
                { tipo: 'rato', id: 'r1', x: 60, y: 200 },
                { tipo: 'bloco', x: 30, y: 218, w: 60, h: 10 },
                { tipo: 'lanterna', id: 'l1', x: 500, y: 110, dir: -1, toque: true },
                { tipo: 'lupa', x: 420, y: 110 },
            ],
            caixa: { esteira: 1, correia: 1, gangorra: 1 },
            objetivo: { tipo: 'foguetes' },
        },
        // #83 do TIM original: Light My Fire
        {
            titulo: 'Acenda meu fogo',
            texto: 'O foguete está deitado: faça ele voar de lado até a estrela. As velas se acendem umas às outras. Engrenagens encostadas giram juntas.',
            bolas: [
                { tipo: 'foguete', x: 520, y: 250, ang: -90 },
                { tipo: 'vela', x: 540, y: 257 },
                { tipo: 'vela', x: 556, y: 257 },
                { tipo: 'vela', x: 572, y: 257 },
                { tipo: 'tenis', x: 60, y: 330 },
                { tipo: 'basquete', x: 230, y: 269 },
            ],
            fixas: [
                { tipo: 'bloco', x: 530, y: 270, w: 60, h: 12 },
                { tipo: 'lanterna', id: 'l1', x: 572, y: 150, dir: 1, ang: 90 },
                { tipo: 'rato', id: 'r1', x: 60, y: 374 },
                { tipo: 'engrenagem', id: 'ga', x: 130, y: 330, r: 18 },
                { tipo: 'correia', id: 'c0', de: 'r1', para: 'ga' },
                { tipo: 'engrenagem', id: 'gb', x: 210, y: 330, r: 18 },
                { tipo: 'esteira', id: 'e1', x: 250, y: 290, dir: 1 },
                { tipo: 'correia', id: 'c1', de: 'gb', para: 'e1' },
                { tipo: 'interruptor', id: 'i1', x: 500, y: 383 },
                { tipo: 'fio', id: 'ff', de: 'i1', para: 'l1' },
            ],
            caixa: { engrenagem: 1, lupa: 1 },
            objetivo: { tipo: 'zona', x: 4, y: 210, w: 90, h: 80, bola: 0 },
        },
        // Lotes 5–6: corda, polia, balde, gancho (tesoura acionada corta corda; chama queima).
        // #24 do TIM original: Save the Balloons
        {
            titulo: 'Salve as bexigas',
            texto: 'Não deixe nenhuma bexiga subir até as tesouras do teto. A corda não estica: amarre uma bexiga na outra passando por uma polia lá embaixo, e uma segura a outra.',
            bolas: [
                { tipo: 'bexiga', id: 'b1', x: 120, y: 250 },
                { tipo: 'bexiga', id: 'b2', x: 240, y: 250 },
                { tipo: 'bexiga', id: 'b3', x: 400, y: 250 },
                { tipo: 'bexiga', id: 'b4', x: 520, y: 250 },
            ],
            fixas: [
                { tipo: 'tesoura', x: 60, y: 22, dir: 1, ang: -90 },
                { tipo: 'tesoura', x: 140, y: 22, dir: 1, ang: -90 },
                { tipo: 'tesoura', x: 220, y: 22, dir: 1, ang: -90 },
                { tipo: 'tesoura', x: 300, y: 22, dir: 1, ang: -90 },
                { tipo: 'tesoura', x: 380, y: 22, dir: 1, ang: -90 },
                { tipo: 'tesoura', x: 460, y: 22, dir: 1, ang: -90 },
                { tipo: 'tesoura', x: 540, y: 22, dir: 1, ang: -90 },
                { tipo: 'tesoura', x: 600, y: 22, dir: 1, ang: -90 },
                { tipo: 'polia', id: 'q1', x: 180, y: 360 },
                { tipo: 'polia', id: 'q2', x: 460, y: 360 },
            ],
            caixa: { corda: 2 },
            objetivo: { tipo: 'todos', lista: [{ tipo: 'inteiras', bolas: [0, 1, 2, 3] }, { tipo: 'tempo', quadros: 300 }] },
        },
        // #10 do TIM original: Bang, Bang, Bang
        {
            titulo: 'Bang, bang, bang',
            texto: 'Estoure a bexiga com o último revólver. Uma corda amarrada no gatilho dispara o revólver quando a outra ponta é puxada para longe.',
            bolas: [
                { tipo: 'bexiga', x: 600, y: 329 },
                { tipo: 'beisebol', id: 'm1', x: 200, y: 58 },
                { tipo: 'beisebol', id: 'm2', x: 300, y: 198 },
                { tipo: 'boliche', x: 70, y: 10 },
            ],
            fixas: [
                { tipo: 'arma', id: 'a1', x: 80, y: 60, dir: 1 },
                { tipo: 'bloco', x: 190, y: 70, w: 20, h: 10 },
                { tipo: 'arma', id: 'a2', x: 100, y: 200, dir: 1 },
                { tipo: 'bloco', x: 290, y: 210, w: 20, h: 10 },
                { tipo: 'arma', id: 'a3', x: 100, y: 330, dir: 1 },
                { tipo: 'bloco', x: 570, y: 298, w: 60, h: 12 },
            ],
            caixa: { corda: 2 },
            objetivo: { tipo: 'estourar' },
        },
        // #9 do TIM original: Lower All the Buckets
        {
            titulo: 'Desça todos os baldes',
            texto: 'Leve os dois baldes até o chão. A tesoura corta a corda que passa nas lâminas quando uma bola cai no cabo dela.',
            bolas: [
                { tipo: 'balde', id: 'bA', x: 150, y: 200 },
                { tipo: 'balde', id: 'bB', x: 450, y: 200 },
                { tipo: 'beisebol', x: 180, y: 40 },
                { tipo: 'bala', x: 340, y: 40 },
            ],
            fixas: [
                { tipo: 'gancho', id: 'gA', x: 150, y: 30 },
                { tipo: 'gancho', id: 'gB', x: 450, y: 30 },
                { tipo: 'corda', id: 'kA', de: 'gA', para: 'bA' },
                { tipo: 'corda', id: 'kB', de: 'gB', para: 'bB' },
            ],
            caixa: { tesoura: 2, rampa: 1 },
            objetivo: { tipo: 'zona', x: 2, y: 340, w: 636, h: 52, bolas: [0, 1] },
        },
        // #55 do TIM original: Punch the Bucket
        {
            titulo: 'Soque o balde',
            texto: 'Derrube o balde da prateleira até a área marcada. A luva soca quando uma bola encosta no botão de trás.',
            bolas: [{ tipo: 'balde', x: 470, y: 245 }, { tipo: 'basquete', x: 160, y: 367 }, { tipo: 'bala', x: 80, y: 40 }],
            fixas: [{ tipo: 'bloco', x: 440, y: 266, w: 80, h: 12 }],
            caixa: { gangorra: 1, luva: 1 },
            objetivo: { tipo: 'zona', x: 530, y: 320, w: 106, h: 72, bola: 0 },
        },
        // #29 do TIM original: Weighing the Situation
        {
            titulo: 'Pesando a situação',
            texto: 'Levante o balde da direita até a área marcada. Os dois baldes pesam igual; o que cair dentro de um deles fica lá e pesa.',
            bolas: [
                { tipo: 'balde', id: 'bB', x: 420, y: 300 },
                { tipo: 'balde', id: 'bA', x: 200, y: 160 },
                { tipo: 'bala', x: 80, y: 30 },
            ],
            fixas: [{ tipo: 'polia', id: 'h1', x: 420, y: 50 }],
            caixa: { corda: 1, polia: 1, rampa: 1 },
            objetivo: { tipo: 'zona', x: 380, y: 60, w: 80, h: 80, bola: 0 },
        },
        // #25 do TIM original: Pop Two Balloons
        {
            titulo: 'Estoure duas bexigas',
            texto: 'Estoure as duas bexigas na engrenagem girando. Os pesos pendurados nas polias de cima podem puxar as bexigas para baixo — se a corda passar por uma polia perto da engrenagem.',
            bolas: [
                { tipo: 'bexiga', id: 'b1', x: 100, y: 250 },
                { tipo: 'bexiga', id: 'b2', x: 500, y: 250 },
                { tipo: 'boliche', id: 'w1', x: 200, y: 120 },
                { tipo: 'bala', id: 'w2', x: 400, y: 120 },
                { tipo: 'tenis', x: 450, y: 330 },
            ],
            fixas: [
                { tipo: 'rato', id: 'r1', x: 450, y: 374 },
                { tipo: 'engrenagem', id: 'g1', x: 300, y: 330, r: 18 },
                { tipo: 'correia', id: 'cf', de: 'r1', para: 'g1' },
                { tipo: 'polia', id: 'h1', x: 200, y: 40 },
                { tipo: 'polia', id: 'h2', x: 400, y: 40 },
            ],
            caixa: { corda: 2, polia: 1 },
            objetivo: { tipo: 'estourar' },
        },
        // #47 do TIM original: Fetch a Pail
        {
            titulo: 'Busque o balde',
            texto: 'Leve o balde até a área marcada. Ele está amarrado num gancho, e as duas esteiras estão paradas.',
            bolas: [
                { tipo: 'balde', id: 'bd', x: 120, y: 124 },
                { tipo: 'tenis', x: 100, y: 30 },
                { tipo: 'tenis', x: 60, y: 270 },
                { tipo: 'beisebol', x: 420, y: 330 },
            ],
            fixas: [
                { tipo: 'esteira', id: 'e1', x: 150, y: 150, dir: 1 },
                { tipo: 'esteira', id: 'e2', x: 320, y: 260, dir: 1 },
                { tipo: 'gancho', id: 'gc', x: 60, y: 100 },
                { tipo: 'corda', id: 'kf', de: 'gc', para: 'bd' },
                { tipo: 'rato', id: 'r1', x: 60, y: 300 },
                { tipo: 'bloco', x: 30, y: 318, w: 60, h: 10 },
                { tipo: 'rato', id: 'r2', x: 420, y: 360 },
            ],
            caixa: { correia: 2, tesoura: 1 },
            objetivo: { tipo: 'zona', x: 490, y: 320, w: 120, h: 72, bola: 0 },
        },
        // #56 do TIM original: Happy Second Birthday
        {
            titulo: 'Feliz segundo aniversário',
            texto: 'Derrube o balde da prateleira até a área marcada. A bala de canhão precisa chegar na gangorra lá em cima.',
            bolas: [{ tipo: 'balde', x: 560, y: 165 }, { tipo: 'basquete', x: 340, y: 207 }, { tipo: 'bala', x: 60, y: 40 }],
            fixas: [
                { tipo: 'gangorra', id: 'g1', x: 300, y: 210, espelho: true },
                { tipo: 'bloco', x: 270, y: 230, w: 60, h: 12 },
                { tipo: 'bloco', x: 470, y: 186, w: 130, h: 12 },
            ],
            caixa: { trampolim: 1, luva: 1 },
            objetivo: { tipo: 'zona', x: 400, y: 320, w: 236, h: 72, bola: 0 },
        },
        // #43 do TIM original: Lower the Bucket
        {
            titulo: 'Desça o balde',
            texto: 'Leve o balde até o chão. A chama da vela queima corda; a esteira pode levar a vela até a corda — se o motor tiver energia. A lâmpada já está acesa.',
            bolas: [{ tipo: 'balde', id: 'bd', x: 500, y: 220 }, { tipo: 'vela', x: 260, y: 143, acesa: true }],
            fixas: [
                { tipo: 'gancho', id: 'gc', x: 500, y: 40 },
                { tipo: 'corda', id: 'kf', de: 'gc', para: 'bd' },
                { tipo: 'esteira', id: 'e1', x: 400, y: 160, w: 320, dir: 1 },
                { tipo: 'tomada', id: 't1', x: 200, y: 40 },
                { tipo: 'lampada', id: 'lp', x: 260, y: 60 },
                { tipo: 'fio', id: 'ff', de: 't1', para: 'lp' },
                { tipo: 'motor', id: 'mt', x: 560, y: 260 },
            ],
            caixa: { painel: 1, fio: 1, correia: 1 },
            objetivo: { tipo: 'zona', x: 440, y: 330, w: 120, h: 62, bola: 0 },
        },
        // #69 do TIM original: Shedding Some Light
        {
            titulo: 'Lançando luz',
            texto: 'Acenda as quatro lâmpadas. Puxar a cordinha acende a lâmpada: amarre cada uma em algo que vai se afastar dela. O que sobe só puxa se a corda passar por uma polia embaixo.',
            bolas: [
                { tipo: 'bala', x: 290, y: 40 },
                { tipo: 'basquete', id: 'm2', x: 210, y: 367 },
                { tipo: 'balde', id: 'm3', x: 470, y: 250 },
                { tipo: 'basquete', id: 'm4', x: 600, y: 250 },
                { tipo: 'beisebol', x: 560, y: 120 },
            ],
            fixas: [
                { tipo: 'lampada', id: 'L1', x: 380, y: 60 },
                { tipo: 'lampada', id: 'L2', x: 220, y: 60 },
                { tipo: 'lampada', id: 'L3', x: 420, y: 60 },
                { tipo: 'lampada', id: 'L4', x: 540, y: 60 },
                { tipo: 'gangorra', id: 'g1', x: 250, y: 370 },
                { tipo: 'polia', id: 'h1', x: 470, y: 140 },
                { tipo: 'polia', id: 'h2', x: 600, y: 140 },
                { tipo: 'corda', id: 'kf', de: 'm3', para: 'm4', polias: ['h1', 'h2'] },
                { tipo: 'rampa', x: 520, y: 200, ang: -35, len: 120 },
                { tipo: 'polia', id: 'h3', x: 600, y: 375 },
            ],
            caixa: { corda: 4 },
            objetivo: { tipo: 'lampadas' },
        },
        // #71 do TIM original: The Wooden Shaft
        {
            titulo: 'O poço de madeira',
            texto: 'Ponha a bola de basquete no cesto. O balão amarrado, se ficar livre, sobe e aperta o fole. O vento gira o moinho, o moinho gira o gerador, e o gerador liga o motor da esteira.',
            bolas: [
                { tipo: 'basquete', x: 420, y: 234 },
                { tipo: 'balao', id: 'bl', x: 200, y: 330 },
                { tipo: 'tenis', x: 234, y: 40 },
            ],
            fixas: [
                { tipo: 'gancho', id: 'gc', x: 200, y: 385 },
                { tipo: 'corda', id: 'kf', de: 'gc', para: 'bl' },
                { tipo: 'fole', x: 200, y: 60, dir: 1, ang: 180 },
                { tipo: 'gerador', id: 'gr', x: 60, y: 200 },
                { tipo: 'motor', id: 'mt', x: 350, y: 300 },
                { tipo: 'esteira', id: 'e1', x: 450, y: 250, dir: 1 },
                { tipo: 'correia', id: 'cf', de: 'mt', para: 'e1' },
                { tipo: 'cesto', x: 540, y: 346 },
            ],
            caixa: { tesoura: 1, moinho: 1, correia: 1, fio: 1 },
            objetivo: { tipo: 'cesto', bola: 0 },
        },
        // Lote 7: personagens (Mort, Pokey, Bob no aquário, Kelly na bicicleta, gaiola).
        // #18 do TIM original: Sending Mort the Mouse Home
        {
            titulo: 'Mandando o Mort para casa',
            texto: 'Leve o Mort até a casinha dele sem o Pokey pegar. O Mort anda sozinho, foge do gato e dá meia-volta quando topa com algo — mas não sobe muro.',
            bolas: [
                { tipo: 'mort', id: 'mort', x: 300, y: 379, dir: -1 },
                { tipo: 'pokey', id: 'pokey', x: 580, y: 374, dir: -1 },
            ],
            fixas: [{ tipo: 'bloco', x: 150, y: 330, w: 20, h: 62 }],
            caixa: { rampa: 1 },
            objetivo: {
                tipo: 'todos',
                lista: [{ tipo: 'zona', x: 4, y: 330, w: 100, h: 62, bola: 0, estilo: 'casa' }, { tipo: 'salvos', bolas: [0] }],
            },
        },
        // #41 do TIM original: Help Pokey Get Home
        {
            titulo: 'Ajude o Pokey a voltar para casa',
            texto: 'Leve o Pokey até a casa dele. O gato vai atrás do aquário do Bob quando enxerga um; sem nada para seguir, ele vai para o buraco.',
            bolas: [{ tipo: 'pokey', id: 'pk', x: 300, y: 322, dir: -1 }],
            fixas: [
                { tipo: 'bloco', x: 2, y: 340, w: 98, h: 52 },
                { tipo: 'bloco', x: 190, y: 340, w: 448, h: 52 },
                { tipo: 'bloco', x: 450, y: 300, w: 12, h: 40 },
            ],
            caixa: { aquario: 1, rampa: 1 },
            objetivo: { tipo: 'zona', x: 530, y: 270, w: 106, h: 70, bola: 0, estilo: 'casa' },
        },
        // #61 do TIM original: Put Mort in Prison
        {
            titulo: 'Ponha o Mort na prisão',
            texto: 'Prenda o Mort com a gaiola. A tesoura corta a corda quando a bola cai no cabo dela — e a altura da tesoura decide quando.',
            bolas: [
                { tipo: 'mort', id: 'mort', x: 220, y: 379, dir: 1 },
                { tipo: 'gaiola', id: 'gl', x: 300, y: 200 },
                { tipo: 'beisebol', x: 324, y: 40 },
            ],
            fixas: [
                { tipo: 'bloco', x: 140, y: 300, w: 14, h: 92 },
                { tipo: 'bloco', x: 460, y: 300, w: 14, h: 92 },
                { tipo: 'gancho', id: 'gc', x: 300, y: 40 },
                { tipo: 'corda', id: 'kf', de: 'gc', para: 'gl' },
            ],
            caixa: { tesoura: 1 },
            objetivo: { tipo: 'presos', bolas: [0] },
        },
        // #65 do TIM original: Break Bob's Fishbowl
        {
            titulo: 'Quebre o aquário do Bob',
            texto: 'Quebre o aquário do Bob (desta vez é para quebrar!). A lanterna acende com o toque de uma bola, e a luz pela lupa acende a dinamite.',
            bolas: [
                { tipo: 'aquario', id: 'bob', x: 570, y: 177 },
                { tipo: 'basquete', x: 180, y: 184 },
                { tipo: 'tenis', x: 100, y: 40 },
            ],
            fixas: [
                { tipo: 'bloco', x: 120, y: 200, w: 120, h: 12 },
                { tipo: 'lanterna', id: 'l1', x: 340, y: 190, dir: 1, toque: true },
                { tipo: 'bloco', x: 460, y: 198, w: 160, h: 12 },
                { tipo: 'dinamite', x: 500, y: 190 },
            ],
            caixa: { luva: 1, lupa: 1 },
            objetivo: { tipo: 'quebrar', bolas: [0] },
        },
        // #36 do TIM original: Pokey and Bob Shoot it out
        {
            titulo: 'Duelo no aquário',
            texto: 'Os dois revólveres vão disparar contra o aquário do Bob. Proteja o Bob: uma bola no caminho leva o tiro.',
            bolas: [
                { tipo: 'aquario', id: 'bob', x: 320, y: 372 },
                { tipo: 'tenis', x: 40, y: 300 },
                { tipo: 'tenis', x: 600, y: 300 },
            ],
            fixas: [{ tipo: 'arma', id: 'a1', x: 60, y: 372, dir: 1 }, { tipo: 'arma', id: 'a2', x: 580, y: 372, dir: -1 }],
            caixa: { boliche: 1, balde: 1 },
            objetivo: { tipo: 'todos', lista: [{ tipo: 'armas' }, { tipo: 'salvos', bolas: [0] }, { tipo: 'tempo', quadros: 150 }] },
        },
        // #78 do TIM original: Free Poor Pokey the Cat
        {
            titulo: 'Liberte o pobre Pokey',
            texto: 'Solte o Pokey e leve ele até a casa dele. A gaiola está presa por corda a um balde: o que cair dentro do balde pesa.',
            bolas: [
                { tipo: 'pokey', id: 'pk', x: 420, y: 374, dir: 1, presoEm: 'gl' },
                { tipo: 'gaiola', id: 'gl', x: 420, y: 370 },
                { tipo: 'balde', id: 'bd', x: 220, y: 200 },
                { tipo: 'bala', x: 90, y: 30 },
            ],
            fixas: [
                { tipo: 'polia', id: 'q1', x: 420, y: 50 },
                { tipo: 'polia', id: 'q2', x: 220, y: 50 },
                { tipo: 'corda', id: 'kf', de: 'gl', para: 'bd', polias: ['q1', 'q2'] },
            ],
            caixa: { rampa: 1 },
            objetivo: {
                tipo: 'todos',
                lista: [{ tipo: 'zona', x: 540, y: 330, w: 96, h: 62, bola: 0, estilo: 'casa' }, { tipo: 'salvos', bolas: [0] }],
            },
        },
        // #60 do TIM original: Cat-a-pulting
        {
            titulo: 'Gato-pulta',
            texto: 'O Pokey está cochilando. Mande ele para a casa lá no alto antes que acorde e vá atrás do Bob.',
            bolas: [
                { tipo: 'pokey', id: 'pk', x: 230, y: 362, dir: 1, dorme: true },
                { tipo: 'aquario', id: 'bob', x: 560, y: 372 },
                { tipo: 'bala', x: 310, y: 40 },
            ],
            fixas: [{ tipo: 'bloco', x: 2, y: 220, w: 178, h: 12 }],
            caixa: { gangorra: 1 },
            objetivo: {
                tipo: 'todos',
                lista: [{ tipo: 'zona', x: 4, y: 160, w: 176, h: 60, bola: 0, estilo: 'casa' }, { tipo: 'salvos', bolas: [1] }],
            },
        },
        // #19 do TIM original: Monkey Business
        {
            titulo: 'Negócio de macaco',
            texto: 'Solte o Mort da gaiola e leve ele para casa. A Kelly, pedalando a bicicleta, enrola a corda amarrada nela.',
            bolas: [
                { tipo: 'mort', id: 'mort', x: 300, y: 379, dir: -1, presoEm: 'gl' },
                { tipo: 'gaiola', id: 'gl', x: 300, y: 370 },
                { tipo: 'tenis', x: 490, y: 120 },
            ],
            fixas: [
                { tipo: 'polia', id: 'q1', x: 300, y: 60 },
                { tipo: 'macaco', id: 'kelly', x: 500, y: 200 },
                { tipo: 'bloco', x: 470, y: 220, w: 60, h: 10 },
            ],
            caixa: { corda: 1 },
            objetivo: {
                tipo: 'todos',
                lista: [{ tipo: 'zona', x: 4, y: 330, w: 90, h: 62, bola: 0, estilo: 'casa' }, { tipo: 'salvos', bolas: [0] }],
            },
        },
        // #39 do TIM original: Trap Pokey the Cat
        {
            titulo: 'Prenda o gato Pokey',
            texto: 'Prenda o Pokey com a gaiola antes que ele chegue no aquário do Bob. A tesoura corta a corda quando algo esbarra no cabo dela.',
            bolas: [
                { tipo: 'pokey', id: 'pk', x: 580, y: 374, dir: -1 },
                { tipo: 'aquario', id: 'bob', x: 60, y: 372 },
                { tipo: 'gaiola', id: 'gl', x: 300, y: 200 },
            ],
            fixas: [
                { tipo: 'polia', id: 'q1', x: 300, y: 40 },
                { tipo: 'polia', id: 'q2', x: 120, y: 40 },
                { tipo: 'polia', id: 'q3', x: 120, y: 375 },
                { tipo: 'gancho', id: 'gc', x: 620, y: 375 },
                { tipo: 'corda', id: 'kf', de: 'gl', para: 'gc', polias: ['q1', 'q2', 'q3'] },
            ],
            caixa: { tesoura: 1 },
            objetivo: { tipo: 'todos', lista: [{ tipo: 'presos', bolas: [0] }, { tipo: 'salvos', bolas: [1] }] },
        },
        // #57 do TIM original: Let Mort out of the Box
        {
            titulo: 'Tire o Mort da caixa',
            texto: 'O Mort está fechado entre caixotes. Abra caminho para ele chegar em casa: o detonador explode a dinamite ligada a ele por fio.',
            bolas: [{ tipo: 'mort', id: 'mort', x: 330, y: 379, dir: -1 }, { tipo: 'beisebol', x: 560, y: 200 }],
            fixas: [
                { tipo: 'caixote', x: 270, y: 330, w: 20, h: 62 },
                { tipo: 'caixote', x: 370, y: 330, w: 20, h: 62 },
                { tipo: 'caixote', x: 270, y: 314, w: 120, h: 16 },
                { tipo: 'detonador', id: 'd1', x: 560, y: 381 },
            ],
            caixa: { dinamite: 1, fio: 1 },
            objetivo: {
                tipo: 'todos',
                lista: [{ tipo: 'zona', x: 4, y: 330, w: 100, h: 62, bola: 0, estilo: 'casa' }, { tipo: 'salvos', bolas: [0] }],
            },
        },
        // #86 do TIM original: Save Mort from the Cats
        {
            titulo: 'Salve o Mort do gato',
            texto: 'O Pokey está chegando! Leve o Mort até a casinha lá no alto. Uma esteira ligada carrega o rato morro acima.',
            bolas: [
                { tipo: 'mort', id: 'mort', x: 220, y: 379, dir: 1 },
                { tipo: 'pokey', id: 'pk', x: 40, y: 374, dir: 1 },
                { tipo: 'tenis', x: 560, y: 320 },
            ],
            fixas: [{ tipo: 'bloco', x: 450, y: 290, w: 188, h: 12 }, { tipo: 'rato', id: 'r1', x: 560, y: 350 }],
            caixa: { esteira: 1, correia: 1 },
            objetivo: {
                tipo: 'todos',
                lista: [{ tipo: 'zona', x: 540, y: 230, w: 96, h: 60, bola: 0, estilo: 'casa' }, { tipo: 'salvos', bolas: [0] }],
            },
        },
        // #37 do TIM original: Mouse in the House
        {
            titulo: 'Um rato em casa',
            texto: 'Leve o Mort até a casinha. Sozinho ele cai no buraco; com um vento nas costas ele pula por cima.',
            bolas: [{ tipo: 'mort', id: 'mort', x: 570, y: 327, dir: -1 }, { tipo: 'tenis', x: 340, y: 280 }],
            fixas: [
                { tipo: 'bloco', x: 2, y: 362, w: 418, h: 30 },
                { tipo: 'bloco', x: 500, y: 340, w: 138, h: 52 },
                { tipo: 'interruptor', id: 'i1', x: 340, y: 355 },
            ],
            caixa: { ventilador: 1, fio: 1 },
            objetivo: {
                tipo: 'todos',
                lista: [{ tipo: 'zona', x: 4, y: 300, w: 110, h: 62, bola: 0, estilo: 'casa' }, { tipo: 'salvos', bolas: [0] }],
            },
        },
        // #22 do TIM original: Turn, Turn, Turn... Pop, Pop, Pop
        {
            titulo: 'Gira, gira, gira... pop, pop, pop',
            texto: 'Estoure as três bexigas nas engrenagens. A Kelly pedala quando a bola cai na bicicleta; engrenagens encostadas giram juntas.',
            bolas: [
                { tipo: 'bexiga', x: 240, y: 224 },
                { tipo: 'bexiga', x: 420, y: 224 },
                { tipo: 'bexiga', x: 480, y: 264 },
                { tipo: 'tenis', x: 80, y: 270 },
            ],
            fixas: [
                { tipo: 'macaco', id: 'kelly', x: 80, y: 330 },
                { tipo: 'engrenagem', id: 'ga', x: 160, y: 300, r: 18 },
                { tipo: 'correia', id: 'cf', de: 'kelly', para: 'ga' },
                { tipo: 'engrenagem', id: 'g1', x: 240, y: 260, r: 18 },
                { tipo: 'bloco', x: 210, y: 193, w: 60, h: 12 },
                { tipo: 'engrenagem', id: 'g2', x: 420, y: 260, r: 18 },
                { tipo: 'bloco', x: 390, y: 193, w: 60, h: 12 },
                { tipo: 'engrenagem', id: 'g3', x: 480, y: 300, r: 18 },
                { tipo: 'bloco', x: 460, y: 233, w: 60, h: 12 },
            ],
            caixa: { engrenagem: 2, correia: 1 },
            objetivo: { tipo: 'estourar' },
        },
        // #80 do TIM original: Basketball on the Moon
        {
            titulo: 'Basquete na Lua',
            texto: 'Na Lua, faça a cesta. A caixa-surpresa, girada pela bicicleta da Kelly, arremessa a bola — gire a caixa para mirar.',
            ambiente: { gravidade: 0.17 },
            bolas: [{ tipo: 'basquete', x: 230, y: 300 }, { tipo: 'tenis', x: 80, y: 290 }],
            fixas: [
                { tipo: 'macaco', id: 'kelly', x: 80, y: 350 },
                { tipo: 'cesto', x: 500, y: 200 },
                { tipo: 'bloco', x: 500, y: 246, w: 64, h: 146 },
            ],
            caixa: { surpresa: 1, correia: 1 },
            objetivo: { tipo: 'cesto', bola: 0 },
        },
        // #48 do TIM original: Exercise Kelly the Monkey
        {
            titulo: 'Exercite a macaca Kelly',
            texto: 'Faça a Kelly pedalar: uma bola precisa cair na bicicleta dela. A lanterna e a lupa já estão prontas para acender um pavio.',
            bolas: [{ tipo: 'beisebol', x: 200, y: 290 }, { tipo: 'tenis', x: 40, y: 60 }],
            fixas: [
                { tipo: 'lanterna', id: 'l1', x: 40, y: 140, dir: 1, ang: 90, toque: true },
                { tipo: 'lupa', x: 40, y: 220 },
                { tipo: 'bloco', x: 190, y: 301, w: 20, h: 10 },
                { tipo: 'macaco', id: 'kelly', x: 420, y: 370 },
            ],
            caixa: { foguete: 1 },
            objetivo: { tipo: 'ratos' },
        },
        // Lote 8: os desafios que juntam tudo (e os que tinham ficado para o fim).
        // #20 do TIM original: Bridging the Gap
        {
            titulo: 'Atravessando o vão',
            texto: 'Leve a bola de basquete até o cesto. O caminho tem dois poços: faça pontes para ela passar.',
            bola: { tipo: 'basquete', x: 40, y: 110 },
            fixas: [
                { tipo: 'rampa', x: 70, y: 160, ang: 30, len: 100 },
                { tipo: 'bloco', x: 110, y: 200, w: 90, h: 12 },
                { tipo: 'bloco', x: 280, y: 200, w: 120, h: 12 },
                { tipo: 'bloco', x: 480, y: 200, w: 80, h: 12 },
                { tipo: 'bloco', x: 190, y: 212, w: 10, h: 180 },
                { tipo: 'bloco', x: 280, y: 212, w: 10, h: 180 },
                { tipo: 'bloco', x: 390, y: 212, w: 10, h: 180 },
                { tipo: 'bloco', x: 480, y: 212, w: 10, h: 180 },
                { tipo: 'cesto', x: 566, y: 346 },
            ],
            caixa: { rampa: 2 },
            objetivo: { tipo: 'cesto' },
        },
        // #74 do TIM original: Chase Away the Mice
        {
            titulo: 'Espante os ratos',
            texto: 'Os dois ratos estão cochilando. Mande cada um para uma toca — um rato acorda e foge quando um gato chega perto.',
            bolas: [
                { tipo: 'mort', id: 'm1', x: 250, y: 327, dir: 1, dorme: true },
                { tipo: 'mort', id: 'm2', x: 390, y: 327, dir: -1, dorme: true },
            ],
            fixas: [{ tipo: 'bloco', x: 80, y: 340, w: 480, h: 52 }],
            caixa: { pokey: 1 },
            objetivo: {
                tipo: 'todos',
                lista: [
                    { tipo: 'zona', x: 4, y: 330, w: 74, h: 62, bola: 0, estilo: 'buraco' },
                    { tipo: 'zona', x: 562, y: 330, w: 74, h: 62, bola: 1, estilo: 'buraco' },
                    { tipo: 'salvos', bolas: [0, 1] },
                ],
            },
        },
        // #85 do TIM original: Put the Cage in the Hole
        {
            titulo: 'Ponha a gaiola no buraco',
            texto: 'Ponha a gaiola no buraco. Ela está pendurada por uma corda; a bola de tênis vai cair.',
            bolas: [{ tipo: 'gaiola', id: 'gl', x: 200, y: 160 }, { tipo: 'tenis', x: 222, y: 40 }],
            fixas: [
                { tipo: 'gancho', id: 'gc', x: 200, y: 40 },
                { tipo: 'corda', id: 'kf', de: 'gc', para: 'gl' },
                { tipo: 'bloco', x: 2, y: 340, w: 418, h: 52 },
                { tipo: 'bloco', x: 480, y: 340, w: 158, h: 52 },
            ],
            caixa: { tesoura: 1, rampa: 1 },
            objetivo: { tipo: 'zona', x: 422, y: 330, w: 56, h: 62, bola: 0, estilo: 'buraco' },
        },
        // #79 do TIM original: Put the Balls into the Baskets
        {
            titulo: 'Ponha as bolas nos cestos',
            texto: 'Uma bola em cada cesto. A esteira está parada, e a bala de canhão vai cair.',
            bolas: [
                { tipo: 'boliche', x: 420, y: 147 },
                { tipo: 'tenis', x: 330, y: 150 },
                { tipo: 'basquete', x: 180, y: 367 },
                { tipo: 'bala', x: 260, y: 40 },
            ],
            fixas: [
                { tipo: 'esteira', id: 'e1', x: 450, y: 170, dir: 1 },
                { tipo: 'rato', id: 'r1', x: 330, y: 200 },
                { tipo: 'bloco', x: 300, y: 218, w: 60, h: 10 },
                { tipo: 'cesto', id: 'c1', x: 540, y: 346 },
                { tipo: 'cesto', id: 'c2', x: 6, y: 230 },
                { tipo: 'bloco', x: 6, y: 276, w: 64, h: 116 },
            ],
            caixa: { correia: 1, gangorra: 1 },
            objetivo: { tipo: 'cestos' },
        },
        // #70 do TIM original: Save the Bob Squad
        {
            titulo: 'Salve o esquadrão do Bob',
            texto: 'Proteja os dois aquários. A vela vai queimar a corda da bala de canhão, e o revólver vai disparar.',
            bolas: [
                { tipo: 'aquario', id: 'bob1', x: 150, y: 372 },
                { tipo: 'aquario', id: 'bob2', x: 450, y: 372 },
                { tipo: 'bala', id: 'peso', x: 150, y: 200 },
                { tipo: 'vela', x: 300, y: 143, acesa: true },
                { tipo: 'tenis', x: 612, y: 300 },
                { tipo: 'tenis', x: 380, y: 60 },
            ],
            fixas: [
                { tipo: 'gancho', id: 'gc', x: 150, y: 40 },
                { tipo: 'corda', id: 'kf', de: 'gc', para: 'peso' },
                { tipo: 'esteira', id: 'e1', x: 230, y: 160, w: 200, dir: -1 },
                { tipo: 'rato', id: 'r1', x: 380, y: 110 },
                { tipo: 'correia', id: 'cf', de: 'r1', para: 'e1' },
                { tipo: 'arma', id: 'a1', x: 600, y: 372, dir: -1 },
            ],
            caixa: { rampa: 1, boliche: 1 },
            objetivo: { tipo: 'todos', lista: [{ tipo: 'salvos', bolas: [0, 1] }, { tipo: 'tempo', quadros: 400 }] },
        },
        // #51 do TIM original: Replacing Bob's Bowl
        {
            titulo: 'Trocando o aquário do Bob',
            texto: 'Leve o aquário até a prateleira marcada sem quebrar: um tombo forte quebra o vidro.',
            bolas: [{ tipo: 'aquario', id: 'bob', x: 90, y: 89 }, { tipo: 'tenis', x: 40, y: 140 }],
            fixas: [
                { tipo: 'esteira', id: 'e1', x: 110, y: 110, dir: 1 },
                { tipo: 'rato', id: 'r1', x: 40, y: 180 },
                { tipo: 'correia', id: 'cf', de: 'r1', para: 'e1' },
                { tipo: 'bloco', x: 10, y: 198, w: 60, h: 10 },
                { tipo: 'bloco', x: 380, y: 300, w: 200, h: 12 },
                { tipo: 'bloco', x: 570, y: 260, w: 10, h: 40 },
            ],
            caixa: { rampa: 2 },
            objetivo: {
                tipo: 'todos',
                lista: [{ tipo: 'zona', x: 400, y: 240, w: 170, h: 60, bola: 0 }, { tipo: 'salvos', bolas: [0] }],
            },
        },
        // #46 do TIM original: Save Bob the Fish
        {
            titulo: 'Salve o peixe Bob',
            texto: 'A bala de canhão vai rolar direto no aquário. Abra o caixote do meio do caminho a tempo — o detonador explode a dinamite ligada a ele.',
            bolas: [
                { tipo: 'aquario', id: 'bob', x: 600, y: 372 },
                { tipo: 'bala', x: 40, y: 80 },
                { tipo: 'tenis', x: 610, y: 120 },
            ],
            fixas: [
                { tipo: 'rampa', x: 140, y: 140, ang: 20, len: 220 },
                { tipo: 'bloco', x: 245, y: 178, w: 95, h: 12 },
                { tipo: 'caixote', x: 340, y: 178, w: 50, h: 12 },
                { tipo: 'bloco', x: 390, y: 178, w: 100, h: 12 },
                { tipo: 'detonador', id: 'd1', x: 610, y: 210 },
                { tipo: 'bloco', x: 590, y: 221, w: 40, h: 10 },
            ],
            caixa: { dinamite: 1, fio: 1 },
            objetivo: { tipo: 'todos', lista: [{ tipo: 'salvos', bolas: [0] }, { tipo: 'tempo', quadros: 400 }] },
        },
        // #77 do TIM original: Getting the Balls Together
        {
            titulo: 'Juntando as bolas',
            texto: 'Ponha as duas bolas no buraco. A de basquete precisa pular o muro; a de boliche está numa esteira parada.',
            bolas: [{ tipo: 'boliche', x: 500, y: 232 }, { tipo: 'basquete', x: 60, y: 40 }, { tipo: 'tenis', x: 560, y: 260 }],
            fixas: [
                { tipo: 'bloco', x: 2, y: 340, w: 298, h: 52 },
                { tipo: 'bloco', x: 360, y: 340, w: 278, h: 52 },
                { tipo: 'bloco', x: 200, y: 250, w: 12, h: 90 },
                { tipo: 'esteira', id: 'e1', x: 480, y: 250, dir: -1 },
                { tipo: 'rato', id: 'r1', x: 560, y: 300 },
            ],
            caixa: { correia: 1, trampolim: 1 },
            objetivo: { tipo: 'zona', x: 302, y: 330, w: 56, h: 62, bolas: [0, 1], estilo: 'buraco' },
        },
        // #44 do TIM original: Play a Set
        {
            titulo: 'Jogue um set',
            texto: 'Mande a bola de tênis para o outro lado da rede. A bola de boliche vai apertar o detonador; a explosão empurra o que estiver perto.',
            bolas: [{ tipo: 'tenis', x: 220, y: 381 }, { tipo: 'boliche', x: 40, y: 40 }],
            fixas: [
                { tipo: 'bloco', x: 318, y: 300, w: 4, h: 92 },
                { tipo: 'bloco', x: 316, y: 296, w: 8, h: 6 },
                { tipo: 'detonador', id: 'd1', x: 40, y: 381 },
            ],
            caixa: { dinamite: 1, fio: 1 },
            objetivo: { tipo: 'zona', x: 330, y: 300, w: 306, h: 92, bola: 0 },
        },
        // #68 do TIM original: Mort-trap
        {
            titulo: 'Ratoeira',
            texto: 'Prenda o Mort com a gaiola. A vela acesa queima corda — se chegar até ela na hora certa.',
            bolas: [
                { tipo: 'mort', id: 'mort', x: 440, y: 379, dir: -1 },
                { tipo: 'gaiola', id: 'gl', x: 330, y: 220 },
                { tipo: 'vela', x: 240, y: 368, acesa: true },
                { tipo: 'bala', x: 160, y: 40 },
            ],
            fixas: [
                { tipo: 'gancho', id: 'gc', x: 330, y: 40 },
                { tipo: 'corda', id: 'kf', de: 'gc', para: 'gl' },
                { tipo: 'bloco', x: 60, y: 330, w: 12, h: 62 },
                { tipo: 'bloco', x: 560, y: 330, w: 12, h: 62 },
            ],
            caixa: { gangorra: 1 },
            objetivo: { tipo: 'presos', bolas: [0] },
        },
        // #52 do TIM original: Trap Mort the Mouse
        {
            titulo: 'Prenda o Mort',
            texto: 'Prenda o Mort com a gaiola. O interruptor liga o que estiver no fio dele; a tesoura corta quando algo bate no cabo.',
            bolas: [
                { tipo: 'mort', id: 'mort', x: 220, y: 379, dir: 1 },
                { tipo: 'gaiola', id: 'gl', x: 340, y: 220 },
                { tipo: 'basquete', x: 180, y: 134 },
                { tipo: 'tenis', x: 60, y: 40 },
            ],
            fixas: [
                { tipo: 'gancho', id: 'gc', x: 340, y: 40 },
                { tipo: 'corda', id: 'kf', de: 'gc', para: 'gl' },
                { tipo: 'interruptor', id: 'i1', x: 60, y: 140 },
                { tipo: 'bloco', x: 40, y: 147, w: 40, h: 8 },
                { tipo: 'bloco', x: 150, y: 150, w: 150, h: 12 },
                { tipo: 'bloco', x: 40, y: 330, w: 12, h: 62 },
                { tipo: 'bloco', x: 600, y: 330, w: 12, h: 62 },
            ],
            caixa: { ventilador: 1, fio: 1, tesoura: 1 },
            objetivo: { tipo: 'presos', bolas: [0] },
        },
        // #84 do TIM original: Removing the Pattern
        {
            titulo: 'Removendo o padrão',
            texto: 'Cada bala de canhão em um balde. A vela na esteira vai queimar as cordas, uma de cada vez, e as rampas desviam as balas.',
            bolas: [
                { tipo: 'bala', id: 'a1', x: 220, y: 220 },
                { tipo: 'bala', id: 'a2', x: 360, y: 220 },
                { tipo: 'bala', id: 'a3', x: 500, y: 200 },
                { tipo: 'vela', x: 110, y: 133, acesa: true },
                { tipo: 'tenis', x: 560, y: 180 },
            ],
            fixas: [
                { tipo: 'gancho', id: 'h1', x: 220, y: 30 },
                { tipo: 'corda', id: 'k1', de: 'h1', para: 'a1' },
                { tipo: 'gancho', id: 'h2', x: 360, y: 30 },
                { tipo: 'corda', id: 'k2', de: 'h2', para: 'a2' },
                { tipo: 'gancho', id: 'h3', x: 500, y: 30 },
                { tipo: 'corda', id: 'k3', de: 'h3', para: 'a3' },
                { tipo: 'esteira', id: 'e1', x: 330, y: 150, w: 460, dir: 1 },
                { tipo: 'rato', id: 'r1', x: 560, y: 222 },
                { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
                { tipo: 'rampa', x: 240, y: 280, ang: -25, len: 80 },
                { tipo: 'rampa', x: 340, y: 290, ang: 30, len: 80 },
                { tipo: 'rampa', x: 500, y: 300, ang: 35, len: 80 },
            ],
            caixa: { balde: 3 },
            objetivo: { tipo: 'nosBaldes', bolas: [0, 1, 2] },
        },
        // #59 do TIM original: Lower the Boom
        {
            titulo: 'Abaixe a lança',
            texto: 'Derrube o balde no buraco. A lâmpada acende quando a bola aperta o interruptor; o canhão está carregado.',
            bolas: [{ tipo: 'balde', id: 'bd', x: 430, y: 200 }, { tipo: 'tenis', x: 60, y: 260 }],
            fixas: [
                { tipo: 'bloco', x: 2, y: 340, w: 398, h: 52 },
                { tipo: 'bloco', x: 460, y: 340, w: 178, h: 52 },
                { tipo: 'gancho', id: 'gc', x: 430, y: 40 },
                { tipo: 'corda', id: 'kf', de: 'gc', para: 'bd' },
                { tipo: 'interruptor', id: 'i1', x: 60, y: 333 },
                { tipo: 'lampada', id: 'lp', x: 120, y: 250 },
                { tipo: 'fio', id: 'ff', de: 'i1', para: 'lp' },
                { tipo: 'canhao', x: 200, y: 300, dir: 1, ang: -45 },
                { tipo: 'bloco', x: 180, y: 311, w: 40, h: 29 },
            ],
            caixa: { lupa: 1, tesoura: 1 },
            objetivo: { tipo: 'zona', x: 402, y: 330, w: 56, h: 62, bola: 0, estilo: 'buraco' },
        },
        // #73 do TIM original: A Pirate's Life for Me
        {
            titulo: 'Vida de pirata',
            texto: 'Solte o balão até a estrela. A vela acesa está presa atrás de um caixote; a esteira levaria ela até a corda.',
            bolas: [
                { tipo: 'balao', id: 'bl', x: 500, y: 250 },
                { tipo: 'vela', x: 200, y: 283, acesa: true },
                { tipo: 'tenis', x: 60, y: 160 },
                { tipo: 'beisebol', x: 420, y: 320 },
            ],
            fixas: [
                { tipo: 'esteira', id: 'e1', x: 340, y: 300, w: 360, dir: 1 },
                { tipo: 'rato', id: 'r1', x: 420, y: 360 },
                { tipo: 'correia', id: 'cf', de: 'r1', para: 'e1' },
                { tipo: 'caixote', x: 230, y: 250, w: 20, h: 45 },
                { tipo: 'gancho', id: 'gc', x: 500, y: 385 },
                { tipo: 'corda', id: 'kf', de: 'gc', para: 'bl' },
                { tipo: 'lanterna', id: 'l1', x: 60, y: 230, dir: 1, toque: true },
            ],
            caixa: { lupa: 1, dinamite: 1 },
            objetivo: { tipo: 'zona', x: 440, y: 4, w: 120, h: 80, bola: 0 },
        },
        // #81 do TIM original: Breaking down the Wall
        {
            titulo: 'Derrubando o muro',
            texto: 'Derrube o muro inteiro. Uma dinamite só não alcança tudo. A lâmpada de cordinha acende quando é puxada.',
            bolas: [{ tipo: 'bala', x: 200, y: 40 }],
            fixas: [
                { tipo: 'caixote', x: 400, y: 330, w: 40, h: 62 },
                { tipo: 'caixote', x: 400, y: 260, w: 40, h: 70 },
                { tipo: 'caixote', x: 400, y: 190, w: 40, h: 70 },
                { tipo: 'dinamite', id: 'd1', x: 370, y: 345 },
                { tipo: 'gangorra', id: 'g1', x: 150, y: 370 },
                { tipo: 'lampada', id: 'lp', x: 300, y: 250 },
            ],
            caixa: { corda: 1, lupa: 1, dinamite: 1 },
            objetivo: { tipo: 'caixotes' },
        },
        // #26 do TIM original: Dropping the Ball
        {
            titulo: 'Deixando a bola cair',
            texto: 'Acerte a bala de canhão no cesto. O balde com contrapeso desce se ficar mais pesado; a lâmpada de cordinha acende quando é puxada.',
            bolas: [
                { tipo: 'beisebol', x: 250, y: 98 },
                { tipo: 'tenis', x: 178, y: 20 },
                { tipo: 'balde', id: 'bd', x: 450, y: 250 },
                { tipo: 'basquete', id: 'cp', x: 570, y: 250 },
            ],
            fixas: [
                { tipo: 'bloco', x: 240, y: 109, w: 20, h: 10 },
                { tipo: 'polia', id: 'q1', x: 450, y: 60 },
                { tipo: 'polia', id: 'q2', x: 570, y: 60 },
                { tipo: 'corda', id: 'kf', de: 'bd', para: 'cp', polias: ['q1', 'q2'] },
                { tipo: 'lampada', id: 'lp', x: 300, y: 250 },
                { tipo: 'canhao', x: 200, y: 340, dir: -1, ang: 30 },
                { tipo: 'bloco', x: 180, y: 352, w: 40, h: 40 },
                { tipo: 'cesto', x: 4, y: 346 },
            ],
            caixa: { arma: 1, corda: 1, lupa: 1 },
            objetivo: { tipo: 'cesto', qualquer: true },
        },
        // #62 do TIM original: Eliminate the Balloons
        {
            titulo: 'Elimine as bexigas',
            texto: 'Estoure as três bexigas. A Kelly pedala quando a bola cai na bicicleta. Engrenagens girando estouram bexiga, e o boneco da caixa-surpresa também.',
            bolas: [
                { tipo: 'bexiga', x: 200, y: 224 },
                { tipo: 'bexiga', x: 284, y: 224 },
                { tipo: 'bexiga', x: 420, y: 290 },
                { tipo: 'tenis', x: 80, y: 270 },
            ],
            fixas: [
                { tipo: 'macaco', id: 'kelly', x: 80, y: 330 },
                { tipo: 'engrenagem', id: 'g1', x: 200, y: 260, r: 18 },
                { tipo: 'bloco', x: 170, y: 193, w: 60, h: 12 },
                { tipo: 'engrenagem', id: 'g2', x: 284, y: 260, r: 18 },
                { tipo: 'bloco', x: 254, y: 193, w: 60, h: 12 },
                { tipo: 'bloco', x: 390, y: 259, w: 60, h: 12 },
            ],
            caixa: { correia: 2, engrenagem: 1, surpresa: 1 },
            objetivo: { tipo: 'estourar' },
        },
        // #30 do TIM original: Pop All the Balloons
        {
            titulo: 'Estoure todas as bexigas',
            texto: 'Estoure todas as bexigas. Faça a Kelly pedalar; o giro precisa chegar nas engrenagens e na esteira da vela.',
            bolas: [
                { tipo: 'bexiga', x: 380, y: 214 },
                { tipo: 'bexiga', x: 530, y: 280 },
                { tipo: 'bexiga', x: 590, y: 280 },
                { tipo: 'vela', x: 430, y: 313, acesa: true },
                { tipo: 'beisebol', x: 120, y: 371 },
                { tipo: 'bala', x: 40, y: 40 },
            ],
            fixas: [
                { tipo: 'macaco', id: 'kelly', x: 340, y: 330 },
                { tipo: 'engrenagem', id: 'g1', x: 380, y: 250, r: 18 },
                { tipo: 'bloco', x: 350, y: 183, w: 60, h: 12 },
                { tipo: 'engrenagem', id: 'g2', x: 460, y: 250, r: 18 },
                { tipo: 'esteira', id: 'e1', x: 520, y: 330, w: 200, dir: 1 },
                { tipo: 'bloco', x: 500, y: 249, w: 120, h: 12 },
            ],
            caixa: { gangorra: 1, correia: 2, engrenagem: 1 },
            objetivo: { tipo: 'estourar' },
        },
        // #33 do TIM original: A Farewell to Balloons
        {
            titulo: 'Adeus às bexigas',
            texto: 'Lance o foguete — o bico dele estoura as bexigas no caminho. A tomada já tem energia; a vela ainda está apagada.',
            bolas: [
                { tipo: 'foguete', x: 430, y: 225 },
                { tipo: 'vela', x: 410, y: 258 },
                { tipo: 'boliche', x: 150, y: 135 },
                { tipo: 'bexiga', x: 430, y: 120 },
                { tipo: 'bexiga', x: 435, y: 60 },
            ],
            fixas: [
                { tipo: 'bloco', x: 60, y: 150, w: 140, h: 12 },
                { tipo: 'tomada', id: 't1', x: 30, y: 200 },
                { tipo: 'lanterna', id: 'l1', x: 290, y: 250, dir: 1, toque: true },
                { tipo: 'bloco', x: 400, y: 270, w: 20, h: 122 },
            ],
            caixa: { ventilador: 1, fio: 1, lupa: 1 },
            objetivo: { tipo: 'todos', lista: [{ tipo: 'foguetes' }, { tipo: 'estourar' }] },
        },
        // #54 do TIM original: Set off Fireworks
        {
            titulo: 'Solte os fogos',
            texto: 'Grand finale: lance os três foguetes! Quando a bola apertar o interruptor, a energia precisa virar vento, o vento virar giro, o giro virar luz e a luz virar fogo.',
            bolas: [
                { tipo: 'foguete', x: 400, y: 120 },
                { tipo: 'foguete', x: 432, y: 120 },
                { tipo: 'foguete', x: 464, y: 120 },
                { tipo: 'vela', x: 400, y: 158 },
                { tipo: 'vela', x: 416, y: 158 },
                { tipo: 'vela', x: 432, y: 158 },
                { tipo: 'vela', x: 448, y: 158 },
                { tipo: 'vela', x: 464, y: 158 },
                { tipo: 'tenis', x: 60, y: 300 },
            ],
            fixas: [
                { tipo: 'bloco', x: 380, y: 170, w: 110, h: 12 },
                { tipo: 'interruptor', id: 'i1', x: 60, y: 383 },
                { tipo: 'ventilador', id: 'v1', x: 120, y: 300, dir: 1 },
                { tipo: 'gerador', id: 'gr', x: 240, y: 200 },
                { tipo: 'lampada', id: 'lp', x: 320, y: 150 },
                { tipo: 'fio', id: 'ff', de: 'gr', para: 'lp' },
            ],
            caixa: { fio: 1, moinho: 1, correia: 1, lupa: 1 },
            objetivo: { tipo: 'foguetes' },
        },
    ];
    if (typeof module !== 'undefined' && module.exports) module.exports = NIVEIS;
    else raiz.TIM_NIVEIS = NIVEIS;
})(typeof window !== 'undefined' ? window : globalThis);

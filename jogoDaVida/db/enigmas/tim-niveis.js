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
    ];
    if (typeof module !== 'undefined' && module.exports) module.exports = NIVEIS;
    else raiz.TIM_NIVEIS = NIVEIS;
})(typeof window !== 'undefined' ? window : globalThis);

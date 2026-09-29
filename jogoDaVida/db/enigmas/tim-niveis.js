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
    ];
    if (typeof module !== 'undefined' && module.exports) module.exports = NIVEIS;
    else raiz.TIM_NIVEIS = NIVEIS;
})(typeof window !== 'undefined' ? window : globalThis);

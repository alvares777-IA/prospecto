// TIM — física mínima para os desafios estilo "The Incredible Machine".
// Sem biblioteca: bolas (e bexigas) contra segmentos estáticos e entre si,
// gravidade, vento de ventiladores e de foles, esteiras e engrenagens movidas
// por ratos (via correia), tesouras e engrenagens que estouram bexigas, e um
// objetivo. Determinística (sem aleatório), para os desafios poderem ser
// verificados fora do navegador.
// Funciona no browser (window.TimFisica) e no Node (module.exports).
(function (raiz) {
    const W = 640, H = 400;
    const SUBPASSOS = 4;
    const ESP = 4;                       // meia-espessura dos segmentos (colisão)

    const BOLAS = {
        basquete: { r: 11, g: 0.3, restit: 0.62, atrito: 0.004, massa: 1, arrasto: 0.999 },
        boliche:  { r: 13, g: 0.3, restit: 0.12, atrito: 0.002, massa: 3, arrasto: 0.999 },
        tenis:    { r: 6, g: 0.3, restit: 0.7, atrito: 0.004, massa: 0.4, arrasto: 0.998 },
        balao:    { r: 15, g: -0.09, restit: 0.3, atrito: 0.02, massa: 0.6, arrasto: 0.985 },
        bexiga:   { r: 15, g: -0.09, restit: 0.3, atrito: 0.02, massa: 0.6, arrasto: 0.97 },   // bexiga dos foles: mais freio do ar
        beisebol: { r: 7, g: 0.3, restit: 0.5, atrito: 0.004, massa: 0.6, arrasto: 0.998 },
        bala:     { r: 10, g: 0.3, restit: 0.08, atrito: 0.002, massa: 6, arrasto: 0.9995 },  // bala de canhão
        vela:     { r: 8, g: 0.3, restit: 0.05, atrito: 0.3, massa: 0.5, arrasto: 0.999 },     // vela: escorrega pouco, não quica
        foguete:  { r: 9, g: 0.3, restit: 0.2, atrito: 0.05, massa: 2, arrasto: 0.999 },
        balde:    { r: 16, g: 0.3, restit: 0.1, atrito: 0.05, massa: 1, arrasto: 0.999 },     // balde: o que cai dentro fica e pesa
        // personagens: andam sozinhos quando estão em pé em algum lugar
        mort:     { r: 9, g: 0.3, restit: 0.1, atrito: 0.02, massa: 0.6, arrasto: 0.999 },      // o rato Mort
        pokey:    { r: 14, g: 0.3, restit: 0.1, atrito: 0.02, massa: 2, arrasto: 0.999 },      // o gato Pokey
        aquario:  { r: 16, g: 0.3, restit: 0.05, atrito: 0.05, massa: 1.5, arrasto: 0.999 },   // aquário com o peixe Bob
        gaiola:   { r: 18, g: 0.3, restit: 0.05, atrito: 0.01, massa: 2, arrasto: 0.999 },     // gaiola: caindo em cima, prende o bicho
    };
    const FORCA_VENTO = 0.34, ALCANCE_VENTO = 250, ALTURA_VENTO = 40;
    const VELOCIDADE_ESTEIRA = 2.4, GANHO_ESTEIRA = 0.2;   // esteira ligada puxa a bola até essa velocidade
    const ESTEIRA = { w: 110, h: 10 };
    const GAIOLA = { w: 50, h: 36 };     // gaiola do rato, centrada em (x,y)
    const CORREIA_MAX = 180;             // correia mais comprida que isso fica frouxa e não transmite
    // fole (ventilador manual): uma bola caindo em cima aperta e ele dá um sopro
    const FOLE = { w: 44, h: 22 }, FORCA_FOLE = 0.4, ALCANCE_FOLE = 120, ALTURA_FOLE = 40, DURACAO_SOPRO = 30;
    const TESOURA = { w: 34, h: 14 };
    const VEL_CORTE = 0.3;               // bexiga parada encostada na tesoura não estoura; precisa chegar nela
    // Ambiente (painel de controle): gravidade 1 = Terra; ar 1 = pressão normal.
    // O ar escala o vento e a resistência do ar, e o empuxo das bexigas: no vácuo elas caem.
    const EMPUXO_BEXIGA = 0.15;
    // Gangorra: tábua sobre um apoio, sempre com uma ponta no baixo. Bola caindo
    // na ponta alta vira a gangorra e arremessa o que estiver na outra ponta —
    // quanto mais pesada e mais rápida a que cai, mais alto vai a arremessada.
    const GANGORRA = { meio: 50, ang: 18, apoio: 20 }, IMPACTO_MIN = 1.5, GANHO_GANGORRA = 0.25, LANCE_MAX = 12;
    // Luva de boxe: bola encostando na metade de trás (o botão) dá um soco para a frente.
    const LUVA = { w: 36, h: 20 }, ALCANCE_SOCO = 60, ALTURA_SOCO = 30, FORCA_SOCO = 8, RECARGA_SOCO = 45;
    const INTERRUPTOR = { w: 26, h: 14 };
    const FIO_MAX = 320;                 // fio do interruptor até o aparelho
    // Moinho: torre com pás no alto; o vento (ventilador ou fole) nas pás faz ele girar.
    // Ele move uma correia igual ao rato, e depois que pega embalo não para mais.
    const MOINHO = { w: 22, h: 50 }, PAS = 24;
    // Luz: a lanterna acesa solta um facho reto; a lupa no caminho junta a luz num
    // ponto (o foco) a FOCO px depois dela. Pavio (de dinamite ou canhão) no foco acende.
    const LANTERNA = { w: 28, h: 16 }, LUPA = 14, FOCO = 70, AQUECER = 15;
    const DINAMITE = { w: 30, h: 16 }, PAVIO_DINAMITE = 45, RAIO_EXPLOSAO = 110, FORCA_EXPLOSAO = 12, ALCANCE_CAIXOTE = 70;
    const CANHAO = { w: 44, h: 22 }, PAVIO_CANHAO = 25, VEL_BALA = 11;
    const PAVIOS = ['dinamite', 'canhao'];
    // Arma: bola encostando na metade de trás (o gatilho) dispara um tiro reto e instantâneo,
    // que estoura bexiga/balão, empurra a primeira bola que pegar e explode dinamite.
    const ARMA = { w: 34, h: 16 }, ALCANCE_TIRO = 700, FORCA_TIRO = 4, RECARGA_ARMA = 60;
    // Caixa-surpresa: movida por correia; depois de GIROS_SURPRESA quadros girando, o boneco
    // pula para "cima" (o lado de cima da peça, girada ou não) e arremessa o que estiver ali.
    const SURPRESA = { w: 30, h: 30 }, GIROS_SURPRESA = 40, ALCANCE_BONECO = 46, FORCA_BONECO = 11;
    // Detonador: bola apertando a alavanca (em cima) explode as dinamites ligadas a ele por fio.
    const DETONADOR = { w: 30, h: 22 };
    // Vela: acende com o foco da lupa ou com outra chama; a chama (em cima da vela) estoura
    // bexiga e acende pavio de dinamite, canhão e foguete. Foguete: fica parado até o pavio
    // (embaixo) acender; aí voa TEMPO_FOGUETE quadros para "cima" dele, e pode sair pelo alto da tela.
    // Corda: não estica e só puxa (nunca empurra). Liga duas pontas (bola, balde, bexiga, ponta de
    // gangorra, gatilho de revólver, lâmpada, gancho) e pode passar por polias. Puxar o gatilho
    // dispara; puxar a lâmpada acende; puxar para baixo a ponta alta da gangorra vira a gangorra.
    // Tesoura acionada (bola no cabo) corta a corda que passa nas lâminas; chama de vela queima.
    const POLIA = 10, GANCHO = { w: 12, h: 12 }, FOLGA_CORDA = 3;
    // Personagens. Mort anda e dá meia-volta quando trava; foge do gato que estiver perto.
    // Pokey vai atrás do Mort (ou, sem rato à vista, do aquário do Bob) — pegou o rato ou
    // derrubou o aquário, já era. Aquário quebra com tombo forte, explosão ou tiro.
    // Kelly (macaco na bicicleta) pedala quando uma bola encosta: move correia e enrola corda.
    const VEL_MORT = 1.3, VEL_POKEY = 1.1, MEDO = 170, FARO_RATO = 300, FARO_PEIXE = 420, TOMBO_AQUARIO = 6.5;
    const MACACO = { w: 44, h: 40 }, ENROLA = 0.6;
    const CHAMA = 8, TEMPO_FOGUETE = 150, EMPUXO_FOGUETE = 0.5;
    const chamaDe = b => [b.x, b.y - b.r - 5];
    const pavioFoguete = b => { const a = rad(b.ang || 0); return [b.x - Math.sin(a) * (b.r + 4), b.y + Math.cos(a) * (b.r + 4)]; };
    // Eletricidade: fontes (interruptor apertado, tomada sempre ligada, gerador girado por
    // correia, painel solar iluminado) mandam energia pelo fio para os aparelhos (ventilador,
    // lanterna, motor, lâmpada). O motor ligado move correias como o rato; a lâmpada acesa
    // ilumina os painéis solares por perto.
    const TOMADA = { w: 22, h: 20 }, GERADOR = { w: 36, h: 30 }, MOTOR = { w: 36, h: 24 }, PAINEL = { w: 44, h: 10 }, LAMPADA = { w: 18, h: 26 };
    const ALCANCE_LAMPADA = 140;
    const FONTES_ENERGIA = ['interruptor', 'tomada', 'gerador', 'painel'];
    const GIRAM = ['esteira', 'engrenagem', 'surpresa', 'gerador'];   // o que uma correia pode fazer girar

    const rad = g => (g * Math.PI) / 180;
    const ehBexiga = b => b.tipo === 'balao' || b.tipo === 'bexiga';

    // Peças retangulares podem ser giradas: `ang` em graus em volta do centro (x,y).
    // girarPt: ponto local (lx,ly) da peça → mundo. paraLocal: mundo → local.
    function girarPt(p, lx, ly) {
        const a = rad(p.ang || 0), c = Math.cos(a), s = Math.sin(a);
        return [p.x + lx * c - ly * s, p.y + lx * s + ly * c];
    }
    function paraLocal(p, x, y) {
        const a = rad(-(p.ang || 0)), c = Math.cos(a), s = Math.sin(a), dx = x - p.x, dy = y - p.y;
        return [dx * c - dy * s, dx * s + dy * c];
    }
    // Largura x altura das peças retangulares (as que dá para girar, menos a rampa).
    function tamanho(p) {
        switch (p.tipo) {
            case 'ventilador': return { w: 30, h: 30 };
            case 'esteira': return { w: p.w || ESTEIRA.w, h: p.h || ESTEIRA.h };
            case 'rato': return GAIOLA;
            case 'fole': return FOLE;
            case 'tesoura': return TESOURA;
            case 'trampolim': return { w: 72, h: 0 };
            case 'luva': return LUVA;
            case 'interruptor': return INTERRUPTOR;
            case 'moinho': return MOINHO;
            case 'lanterna': return LANTERNA;
            case 'dinamite': return DINAMITE;
            case 'canhao': return CANHAO;
            case 'arma': return ARMA;
            case 'surpresa': return SURPRESA;
            case 'detonador': return DETONADOR;
            case 'tomada': return TOMADA;
            case 'gerador': return GERADOR;
            case 'motor': return MOTOR;
            case 'painel': return PAINEL;
            case 'lampada': return LAMPADA;
            case 'gancho': return GANCHO;
            case 'macaco': return MACACO;
            case 'foguete': return { w: 18, h: 26 };   // só para a interface (girar); na física o foguete é um corpo redondo
            default: return null;
        }
    }
    const segsRetangulo = (p, { w, h }) => {
        const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([lx, ly]) => girarPt(p, lx, ly));
        return pts.map((q, i) => [...q, ...pts[(i + 1) % 4]]);
    };

    // Ponto onde a correia se prende: na esteira, perto da ponta direita; no
    // rato, no eixo da roda (canto de cima à direita da gaiola); na engrenagem, o centro.
    function engrenagem(p) {
        if (p.tipo === 'esteira') return girarPt(p, (p.w || ESTEIRA.w) * 0.2, 0);
        if (p.tipo === 'rato') return girarPt(p, p.espelho ? -14 : 14, -8);   // gaiola espelhada: roda do outro lado
        if (p.tipo === 'engrenagem') return [p.x, p.y];
        if (p.tipo === 'moinho') return eixoMoinho(p);
        if (p.tipo === 'surpresa') return girarPt(p, SURPRESA.w / 2 - 5, 4);   // manivela do lado
        if (p.tipo === 'gerador') return [p.x, p.y];
        if (p.tipo === 'macaco') return girarPt(p, 10, 8);   // pedal da bicicleta
        if (p.tipo === 'motor') return girarPt(p, MOTOR.w / 2 - 7, 0);         // eixo na frente
        return null;
    }
    const eixoMoinho = p => girarPt(p, 0, -MOINHO.h / 2 + 6);
    // Ponto onde o fio se prende: o meio do interruptor / do aparelho.
    const tomada = p => ['interruptor', 'ventilador', 'lanterna', 'detonador', 'dinamite', 'tomada', 'gerador', 'motor', 'painel', 'lampada'].includes(p.tipo) ? [p.x, p.y] : null;
    // Pontas de uma correia { de, para } (ids de um rato/moinho e de uma esteira/engrenagem)
    // ou de um fio (interruptor → ventilador/lanterna), ou null.
    function pontasCorreia(c, todas) {
        const a = todas.find(p => p.id === c.de), b = todas.find(p => p.id === c.para);
        if (!a || !b) return null;
        const ponto = c.tipo === 'fio' ? tomada : engrenagem;
        const ga = ponto(a), gb = ponto(b);
        if (!ga || !gb) return null;
        return { a, b, ga, gb, comprimento: Math.hypot(ga[0] - gb[0], ga[1] - gb[1]) };
    }

    // Cano: linha central `pontos` com largura `largura`; devolve as duas paredes
    // (polilinhas deslocadas, com junção em quina viva). Pontas abertas.
    function paredesCano(p) {
        const pts = p.pontos, m = (p.largura || 44) / 2;
        const normal = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; };
        const esq = [], dir = [];
        for (let i = 0; i < pts.length; i++) {
            let n;
            if (i === 0) n = normal(pts[0], pts[1]);
            else if (i === pts.length - 1) n = normal(pts[i - 1], pts[i]);
            else {
                const n1 = normal(pts[i - 1], pts[i]), n2 = normal(pts[i], pts[i + 1]);
                const mx = n1[0] + n2[0], my = n1[1] + n2[1], L = Math.hypot(mx, my) || 1;
                const k = (mx / L) * n1[0] + (my / L) * n1[1];
                n = [mx / L / k, my / L / k];
            }
            esq.push([pts[i][0] + n[0] * m, pts[i][1] + n[1] * m]);
            dir.push([pts[i][0] - n[0] * m, pts[i][1] - n[1] * m]);
        }
        return [esq, dir];
    }

    // Gangorra: `lado` -1 = ponta esquerda embaixo, 1 = direita (a peça espelhada começa com a direita embaixo).
    const ladoGangorra = p => p.lado ?? (p.espelho ? 1 : -1);
    function pontasGangorra(p) {
        const a = rad(GANGORRA.ang), dx = Math.cos(a) * GANGORRA.meio, dy = Math.sin(a) * GANGORRA.meio, l = ladoGangorra(p);
        return [[p.x - dx, p.y - l * dy], [p.x + dx, p.y + l * dy]];
    }

    const segsCaixa = ([x0, y0, x1, y1]) => [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]];

    // Segmentos [x1,y1,x2,y2,restit?] que uma peça ocupa.
    function segmentosDe(p) {
        switch (p.tipo) {
            case 'bloco': return segsCaixa([p.x, p.y, p.x + p.w, p.y + p.h]);
            case 'rampa': {
                const c = (p.len || 120) / 2, a = rad(p.ang || 0);
                const dx = Math.cos(a) * c, dy = Math.sin(a) * c;
                return [[p.x - dx, p.y - dy, p.x + dx, p.y + dy]];
            }
            case 'trampolim':
                return [[...girarPt(p, -36, 0), ...girarPt(p, 36, 0), 1.08]];
            case 'cesto': {   // U de 64 x 46, (x,y) = canto superior esquerdo
                const { x, y } = p;
                return [[x, y, x, y + 46], [x, y + 46, x + 64, y + 46], [x + 64, y + 46, x + 64, y]];
            }
            case 'ventilador': case 'esteira': case 'rato': case 'fole': case 'tesoura':
            case 'luva': case 'interruptor': case 'moinho': case 'lanterna': case 'dinamite': case 'canhao':
            case 'gancho': case 'macaco':
            case 'arma': case 'detonador': case 'tomada': case 'gerador': case 'motor': case 'painel': case 'lampada':
                return segsRetangulo(p, tamanho(p));
            case 'surpresa': {   // caixa + duas bordinhas na tampa, para a bola ficar em cima até o boneco pular
                const { w, h } = SURPRESA;
                return [...segsRetangulo(p, SURPRESA), [...girarPt(p, -w / 2, -h / 2), ...girarPt(p, -w / 2, -h / 2 - 7)], [...girarPt(p, w / 2, -h / 2), ...girarPt(p, w / 2, -h / 2 - 7)]];
            }
            case 'caixote': return segsCaixa([p.x, p.y, p.x + p.w, p.y + p.h]);
            case 'gangorra': {   // tábua inclinada (ponta baixa do lado `espelho`? direita : esquerda) + apoio triangular
                const [e, d] = pontasGangorra(p), a = GANGORRA.apoio;
                const L = Math.hypot(d[0] - e[0], d[1] - e[1]), nx = (d[1] - e[1]) / L * 7, ny = -(d[0] - e[0]) / L * 7;   // batentes nas pontas
                return [[...e, ...d], [...e, e[0] + nx, e[1] + ny], [...d, d[0] + nx, d[1] + ny],
                    [p.x, p.y + 3, p.x - 10, p.y + a], [p.x, p.y + 3, p.x + 10, p.y + a], [p.x - 10, p.y + a, p.x + 10, p.y + a]];
            }
            case 'polia': {
                const pts = [];
                for (let i = 0; i < 8; i++) pts.push([p.x + Math.cos(i * Math.PI / 4) * POLIA, p.y + Math.sin(i * Math.PI / 4) * POLIA]);
                return pts.map((q, i) => [...q, ...pts[(i + 1) % 8]]);
            }
            case 'engrenagem': {   // octógono no lugar do círculo
                const r = p.r || 18, pts = [];
                for (let i = 0; i < 8; i++) pts.push([p.x + Math.cos(i * Math.PI / 4) * r, p.y + Math.sin(i * Math.PI / 4) * r]);
                return pts.map((q, i) => [...q, ...pts[(i + 1) % 8]]);
            }
            case 'cano': {
                const segs = [];
                for (const parede of paredesCano(p)) {
                    for (let i = 0; i + 1 < parede.length; i++) segs.push([...parede[i], ...parede[i + 1]]);
                }
                return segs;
            }
            default:
                return [];
        }
    }

    // Bolas na posição inicial: as do desafio (`bolas`, ou a antiga `bola` única)
    // primeiro — `objetivo.bola` é um índice nelas — e depois as que o jogador
    // colocou como peça (tipo 'basquete', 'tenis'...).
    function bolasDoNivel(nivel, pecas) {
        const defs = [...(nivel.bolas || [nivel.bola]), ...(pecas || []).filter(p => BOLAS[p.tipo])];
        return defs.map(d => {
            const tipo = BOLAS[d.tipo] ? d.tipo : 'basquete';
            const b = { tipo, ...BOLAS[tipo], x: d.x, y: d.y, vx: 0, vy: 0, estourou: false, id: d.id };
            if (tipo === 'balde') b.carga = [];
            if (tipo === 'mort' || tipo === 'pokey') { b.andar = d.dir || 1; b.travado = 0; b.capturado = null; b.pego = false; b.presoEm = d.presoEm; b.dorme = !!d.dorme; }
            if (tipo === 'aquario') b.quebrado = false;
            if (tipo === 'vela') { b.acesa = !!d.acesa; b.calor = 0; }
            if (tipo === 'foguete') { b.ang = d.ang || 0; b.preso = true; b.fogo = 0; b.calor = 0; b.saiu = false; }
            return b;
        });
    }

    // A peça `p` encavala em alguma bola (ou, se `p` é bola, em alguma peça ou
    // bola) na posição inicial? Como no jogo original, isso não pode: a
    // interface recusa e os testes só usam posições livres.
    function sobrepoe(p, nivel, pecas) {
        const outras = pecas.filter(q => q !== p);
        const bolas = bolasDoNivel(nivel, outras);
        if (BOLAS[p.tipo]) {
            const r = BOLAS[p.tipo].r;
            if (bolas.some(b => Math.hypot(b.x - p.x, b.y - p.y) < b.r + r)) return true;
            return [...nivel.fixas, ...outras].some(q => segmentosDe(q).some(s => distSeg(p.x, p.y, s) < r + ESP));
        }
        const segs = segmentosDe(p);
        // nada pode ficar para fora do cenário (nem enfiado nas paredes da tela)
        if (segs.some(([x1, y1, x2, y2]) => Math.min(x1, x2) < 2 || Math.max(x1, x2) > W - 2 || Math.min(y1, y2) < 2 || Math.max(y1, y2) > H - 7)) return true;
        return bolas.some(b => segs.some(s => distSeg(b.x, b.y, s) < b.r + ESP));
    }
    function distSeg(x, y, [x1, y1, x2, y2]) {
        const ex = x2 - x1, ey = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * ex + (y - y1) * ey) / (ex * ex + ey * ey || 1)));
        return Math.hypot(x - (x1 + ex * t), y - (y1 + ey * t));
    }

    // Zona de vento saindo do bocal da peça (a `meio` do centro, do lado de `dir`),
    // na direção em que a peça aponta (girada por `ang`).
    function zonaVento(p, meio, alcance, altura) {
        const d = p.dir || 1, a = rad(p.ang || 0);
        return { boca: girarPt(p, d * meio, 0), ux: d * Math.cos(a), uy: d * Math.sin(a), alcance, altura };
    }
    // Retângulo girado de uma peça, para medir contato com as bolas.
    const retangulo = p => ({ p: { x: p.x, y: p.y, ang: p.ang || 0 }, ...tamanho(p) });
    function distRet(b, r) {   // distância do centro da bola até o retângulo girado (0 se dentro)
        const [lx, ly] = paraLocal(r.p, b.x, b.y);
        return Math.hypot(lx - Math.max(-r.w / 2, Math.min(lx, r.w / 2)), ly - Math.max(-r.h / 2, Math.min(ly, r.h / 2)));
    }

    // Ponta de corda: { tipo: 'bola' | 'gangorra' | 'arma' | 'lampada' | 'fixo', ... }. Para a gangorra,
    // `lado` diz qual ponta (-1 esquerda, 1 direita); bolas são achadas pelo `id`.
    function pontaCorda(ref, lado, todas, bolas) {
        const b = bolas.find(x => x.id && x.id === ref);
        if (b) return { tipo: 'bola', b };
        const p = todas.find(x => x.id === ref);
        if (!p) return null;
        if (p.tipo === 'gangorra') return { tipo: 'gangorra', p, lado: lado || 1 };
        if (p.tipo === 'arma' || p.tipo === 'lampada') return { tipo: p.tipo, p };
        if (p.tipo === 'macaco') return { tipo: 'macaco', p };
        return { tipo: 'fixo', p };
    }
    function criarMundo(nivel, pecas, ambiente) {
        const todas = [...nivel.fixas, ...pecas];
        const segs = [
            [0, H - 8, W, H - 8], [2, 0, 2, H], [W - 2, 0, W - 2, H], [0, 2, W, 2],   // chão, paredes e teto
        ];
        segs[3].teto = true;   // o foguete passa pelo teto e some lá em cima
        // cada segmento sabe de que peça é (`dono`): gangorra vira, dinamite e caixote somem
        for (const p of todas) for (const s of segmentosDe(p)) { s.dono = p; segs.push(s); }
        // fios: interruptor → ventilador/lanterna (fio comprido demais fica solto)
        const fios = [];
        for (const c of todas) {
            if (c.tipo !== 'fio') continue;
            const pc = pontasCorreia(c, todas);
            if (!pc || pc.comprimento > FIO_MAX) continue;
            const ehChave = p => FONTES_ENERGIA.includes(p.tipo) || p.tipo === 'detonador';
            const chave = [pc.a, pc.b].find(ehChave), aparelho = [pc.a, pc.b].find(p => !ehChave(p));
            if (chave && aparelho) fios.push({ chave: chave.id, aparelho: aparelho.id });
        }
        const ventos = todas.filter(p => p.tipo === 'ventilador').map(p => ({
            id: p.id, bateria: !!p.ligado, ativo: !!p.ligado, ...zonaVento(p, 15, ALCANCE_VENTO, ALTURA_VENTO),
        }));
        const foles = todas.filter(p => p.tipo === 'fole').map(p => ({
            ret: retangulo(p), vento: zonaVento(p, FOLE.w / 2, ALCANCE_FOLE, ALTURA_FOLE),
            sopro: 0, tocando: new Set(), soprou: 0,
        }));
        const tesouras = todas.filter(p => p.tipo === 'tesoura').map(p => ({ ...retangulo(p), dir: p.dir || 1 }));
        const esteiras = todas.filter(p => p.tipo === 'esteira').map(p => {
            const a = rad(p.ang || 0);
            return { id: p.id, ret: retangulo(p), dir: p.dir || 1, ux: Math.cos(a), uy: Math.sin(a) };
        });
        const engrenagens = todas.filter(p => p.tipo === 'engrenagem').map(p => ({ id: p.id, x: p.x, y: p.y, r: p.r || 18 }));
        const ratos = todas.filter(p => p.tipo === 'rato' || p.tipo === 'macaco').map(p => ({ id: p.id, ret: retangulo(p), macaco: p.tipo === 'macaco' }));
        const moinhos = todas.filter(p => p.tipo === 'moinho').map(p => ({ id: p.id, eixo: eixoMoinho(p) }));
        const correias = [];
        for (const c of todas) {
            if (c.tipo !== 'correia') continue;
            const pc = pontasCorreia(c, todas);
            if (!pc || pc.comprimento > CORREIA_MAX) continue;
            const fonte = [pc.a, pc.b].find(p => p.tipo === 'rato' || p.tipo === 'moinho' || p.tipo === 'motor' || p.tipo === 'macaco');
            const movida = [pc.a, pc.b].find(p => p.tipo === 'esteira' || p.tipo === 'engrenagem' || p.tipo === 'surpresa' || p.tipo === 'gerador');
            // gaiola (ou moinho) espelhada: a roda gira ao contrário, e a correia leva esse sentido para a esteira
            if (fonte && movida) correias.push({ rato: fonte.id, alvo: movida.id, sentido: fonte.espelho ? -1 : 1 });
            // correia saindo de uma engrenagem: quem estiver girando leva a outra ponta junto
            else if (!fonte && [pc.a, pc.b].some(p => p.tipo === 'engrenagem') && [pc.a, pc.b].every(p => GIRAM.includes(p.tipo))) correias.push({ a: pc.a.id, b: pc.b.id });
        }
        const gangorras = todas.filter(p => p.tipo === 'gangorra').map(p => ({ p, lado: ladoGangorra(p), recarga: 0, viradas: 0 }));
        const luvas = todas.filter(p => p.tipo === 'luva').map(p => {
            const a = rad(p.ang || 0), d = p.dir || 1;
            return { p, ret: retangulo(p), d, ux: d * Math.cos(a), uy: d * Math.sin(a), recarga: 0, socando: 0, socos: 0 };
        });
        const interruptores = todas.filter(p => p.tipo === 'interruptor').map(p => ({ id: p.id, ret: retangulo(p), ligado: false }));
        // lanterna com `toque` (como no TIM original): acende quando uma bola bate no botão dela
        const lanternas = todas.filter(p => p.tipo === 'lanterna').map(p => ({ p, id: p.id, bateria: !!p.ligado, ativo: !!p.ligado, ret: retangulo(p), toque: !!p.toque, tocada: false }));
        const lupas = todas.filter(p => p.tipo === 'lupa').map(p => ({ x: p.x, y: p.y }));
        const dinamites = todas.filter(p => p.tipo === 'dinamite').map(p => ({ p, ret: retangulo(p), calor: 0, pavio: -1, explodiu: false }));
        const canhoes = todas.filter(p => p.tipo === 'canhao').map(p => ({ p, ret: retangulo(p), calor: 0, pavio: -1, disparou: false }));
        const caixotes = todas.filter(p => p.tipo === 'caixote').map(p => ({ p, quebrou: false }));
        const armas = todas.filter(p => p.tipo === 'arma').map(p => {
            const a = rad(p.ang || 0), d = p.dir || 1;
            return { p, ret: retangulo(p), d, ux: d * Math.cos(a), uy: d * Math.sin(a), recarga: 0, tiros: 0 };
        });
        const surpresas = todas.filter(p => p.tipo === 'surpresa').map(p => ({ p, id: p.id, ret: retangulo(p), giro: 0, abriu: false, quadroAbriu: -1 }));
        const tomadas = todas.filter(p => p.tipo === 'tomada').map(p => p.id);
        const geradores = todas.filter(p => p.tipo === 'gerador').map(p => ({ p, id: p.id }));
        const motores = todas.filter(p => p.tipo === 'motor').map(p => ({ p, id: p.id }));
        const paineis = todas.filter(p => p.tipo === 'painel').map(p => ({ p, id: p.id, aceso: false }));
        const lampadas = todas.filter(p => p.tipo === 'lampada').map(p => ({ p, id: p.id, acesa: false }));
        const detonadores = todas.filter(p => p.tipo === 'detonador').map(p => ({ p, id: p.id, ret: retangulo(p), acionado: false }));
        const bolas = bolasDoNivel(nivel, pecas);
        for (const b of bolas) if (b.presoEm) b.capturado = bolas.find(g => g.id === b.presoEm) || null;   // bicho que já começa preso na gaiola
        const cordas = [];
        for (const c of todas) {
            if (c.tipo !== 'corda') continue;
            const A = pontaCorda(c.de, c.pontaDe, todas, bolas), B = pontaCorda(c.para, c.pontaPara, todas, bolas);
            if (!A || !B) continue;
            const polias = (c.polias || []).map(id => todas.find(p => p.id === id)).filter(Boolean).map(p => [p.x, p.y]);
            cordas.push({ id: c.id, A, B, polias, L: 0, tensa: false, cortada: false });
        }
        const amb = { ...(nivel.ambiente || {}), ...(ambiente || {}) };
        const mundo = {
            nivel, segs, ventos, foles, tesouras, esteiras, engrenagens, ratos, moinhos, correias, bolas,
            fios, gangorras, luvas, interruptores, lanternas, lupas, dinamites, canhoes, caixotes, armas, surpresas, detonadores, tiros: [], cordas, tomadas, geradores, motores, paineis, lampadas,
            gravidade: amb.gravidade ?? 1, ar: amb.ar ?? 1,
            bola: bolas[nivel.objetivo.bola || 0],   // a bola que precisa chegar no objetivo
            ratosAtivos: new Set(), ligadas: new Set(), sentido: new Map(),   // ratosAtivos: ratos e moinhos girando; ligadas: ids de esteiras/engrenagens girando
            luz: [], explosoes: [],   // para o desenho: fachos de luz do quadro e explosões que já aconteceram
            quadro: 0, dentro: 0, resolvido: false, esgotou: false,
        };
        medirCordas(mundo);
        return mundo;
    }
    function medirCordas(m) { for (const c of m.cordas) c.L = comprimento(caminho(m, c)) + FOLGA_CORDA; }   // uma folguinha: acomodar 1 px não puxa nada

    function posPonta(m, E) {
        if (E.tipo === 'bola') return [E.b.x, E.b.y - (E.b.tipo === 'balde' ? E.b.r : 0)];
        if (E.tipo === 'gangorra') {
            const g = m.gangorras.find(x => x.p === E.p), [e, d] = pontasGangorra({ ...E.p, lado: g ? g.lado : ladoGangorra(E.p) });
            return E.lado < 0 ? e : d;
        }
        if (E.tipo === 'arma') { const d = E.p.dir || 1; return girarPt(E.p, -d * (ARMA.w / 2 - 6), ARMA.h / 2 + 3); }
        if (E.tipo === 'lampada') return [E.p.x, E.p.y + LAMPADA.h / 2];
        if (E.tipo === 'macaco') return [E.p.x - 8, E.p.y - MACACO.h / 2];
        return [E.p.x, E.p.y];
    }
    const pesoInv = E => E.tipo === 'bola' && !E.b.preso && !E.b.dentro && !E.b.estourou ? 1 / E.b.massa : 0;
    const caminho = (m, c) => [posPonta(m, c.A), ...c.polias, posPonta(m, c.B)];
    const comprimento = pts => pts.reduce((s, q, i) => i ? s + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0, 0);
    // a ponta `E` (que não se mexe) foi puxada pela corda: gatilho, lâmpada, gangorra
    function puxou(m, E, u) {
        if (E.tipo === 'arma') { const a = m.armas.find(x => x.p === E.p); if (a && a.recarga <= 0) { a.recarga = RECARGA_ARMA * SUBPASSOS; a.tiros++; a.ultimoTiro = m.quadro; atirar(m, a); } }
        if (E.tipo === 'lampada') { const l = m.lampadas.find(x => x.p === E.p); if (l) l.puxada = true; }
        if (E.tipo === 'gangorra' && u[1] > 0.5) {   // puxada para baixo pela ponta que está em cima: vira
            const g = m.gangorras.find(x => x.p === E.p);
            if (g && g.recarga <= 0 && E.lado === -g.lado) virarGangorra(m, g, 8, m.bolas.filter(b => !b.estourou));
        }
    }
    // corda: se o caminho ficou maior que o comprimento, puxa as pontas de volta (peso a peso)
    function esticarCordas(m) {
        for (const c of m.cordas) {
            if (c.cortada || c.solta) continue;
            if ([c.A, c.B].some(E => E.tipo === 'macaco' && m.ratosAtivos.has(E.p.id))) c.L = Math.max(20, c.L - ENROLA / SUBPASSOS);
            const pts = caminho(m, c), len = comprimento(pts);
            if (len <= c.L + 0.01) { c.tensa = false; continue; }
            c.tensa = true;
            const n = pts.length, sobra = len - c.L;
            const dir = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
            const uA = dir(pts[0], pts[1]), uB = dir(pts[n - 1], pts[n - 2]), wA = pesoInv(c.A), wB = pesoInv(c.B);
            if (wA + wB === 0) {   // nada para mover (ex.: gangorra virou puxando a lâmpada): puxão, e a corda cede
                if (sobra > 0.5) { puxou(m, c.A, uA); puxou(m, c.B, uB); if ([c.A, c.B].some(E => E.tipo === 'arma' || E.tipo === 'lampada')) c.solta = true; }
                c.L = len; continue;
            }
            for (const [E, u, w] of [[c.A, uA, wA], [c.B, uB, wB]]) {
                if (!w) continue;
                E.b.x += u[0] * sobra * w / (wA + wB); E.b.y += u[1] * sobra * w / (wA + wB);
            }
            const vA = wA ? E2v(c.A) : [0, 0], vB = wB ? E2v(c.B) : [0, 0];
            const alonga = -(vA[0] * uA[0] + vA[1] * uA[1]) - (vB[0] * uB[0] + vB[1] * uB[1]);
            // a outra ponta tentou se afastar com a corda esticada: puxão na ponta que não se mexe
            if (alonga > 0.25 || sobra > 0.5) {
                if (!wA) puxou(m, c.A, uA); if (!wB) puxou(m, c.B, uB);
                // cordinha de gatilho/lâmpada: depois do puxão ela corre solta (não segura peso)
                if ([c.A, c.B].some(E => E.tipo === 'arma' || E.tipo === 'lampada')) { c.solta = true; continue; }
            }
            if (alonga > 0) {
                const j = alonga / (wA + wB);
                if (wA) { c.A.b.vx += uA[0] * j * wA; c.A.b.vy += uA[1] * j * wA; }
                if (wB) { c.B.b.vx += uB[0] * j * wB; c.B.b.vy += uB[1] * j * wB; }
            }
        }
    }
    const E2v = E => [E.b.vx, E.b.vy];
    // segmento atravessa o retângulo girado?
    function segRet(x1, y1, x2, y2, r) {
        const [ax, ay] = paraLocal(r.p, x1, y1), [bx, by] = paraLocal(r.p, x2, y2);
        let t0 = 0, t1 = 1;
        const dx = bx - ax, dy = by - ay;
        for (const [p, q] of [[-dx, ax + r.w / 2], [dx, r.w / 2 - ax], [-dy, ay + r.h / 2], [dy, r.h / 2 - ay]]) {
            if (p === 0) { if (q < 0) return false; continue; }
            const t = q / p;
            if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
        }
        return true;
    }
    function cortarCordas(m, zona) {   // zona: retângulo girado (lâminas da tesoura)
        for (const c of m.cordas) {
            if (c.cortada) continue;
            const pts = caminho(m, c);
            for (let i = 1; i < pts.length; i++) if (segRet(...pts[i - 1], ...pts[i], zona)) { c.cortada = true; break; }
        }
    }
    function colidir(b, s) {
        const [x1, y1, x2, y2, restitSeg] = s;
        const ex = x2 - x1, ey = y2 - y1;
        const L2 = ex * ex + ey * ey || 1;
        let t = ((b.x - x1) * ex + (b.y - y1) * ey) / L2;
        t = Math.max(0, Math.min(1, t));
        const px = x1 + ex * t, py = y1 + ey * t;
        let nx = b.x - px, ny = b.y - py;
        const d = Math.hypot(nx, ny);
        const lim = b.r + ESP;
        if (d >= lim || d === 0) return;
        nx /= d; ny /= d;
        if (ny < -0.6) b.apoio = true;
        b.x += nx * (lim - d); b.y += ny * (lim - d);
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
            const e = restitSeg ?? b.restit;
            // quique pequeno vira repouso (senão a bola "treme" no chão)
            const novoVn = Math.abs(vn) < 0.6 && !restitSeg ? 0 : -vn * e;
            b.vx += (novoVn - vn) * nx; b.vy += (novoVn - vn) * ny;
            // atrito tangencial (rolagem)
            const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty;
            b.vx -= vt * b.atrito * tx; b.vy -= vt * b.atrito * ty;
        }
    }

    function colidirBolas(a, b) {
        let nx = b.x - a.x, ny = b.y - a.y;
        const d = Math.hypot(nx, ny), lim = a.r + b.r;
        if (d >= lim || d === 0) return;
        nx /= d; ny /= d;
        const ma = a.preso ? 1e9 : a.massa, mb = b.preso ? 1e9 : b.massa;
        const total = ma + mb, sobra = lim - d;
        a.x -= nx * sobra * mb / total; a.y -= ny * sobra * mb / total;
        b.x += nx * sobra * ma / total; b.y += ny * sobra * ma / total;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel >= 0) return;
        const j = -(1 + Math.min(a.restit, b.restit)) * rel / (1 / ma + 1 / mb);
        a.vx -= j * nx / ma; a.vy -= j * ny / ma;
        b.vx += j * nx / mb; b.vy += j * ny / mb;
    }

    const encosta = (b, ret) => distRet(b, ret) <= b.r + ESP + 1;

    // Bola dentro de um cano (em U, por exemplo): abaixo da boca e dentro da largura dele.
    function dentroDoCano(b, c) {
        const xs = c.pontos.map(p => p[0]), ys = c.pontos.map(p => p[1]), meia = (c.largura || 44) / 2;
        return b.x > Math.min(...xs) - meia && b.x < Math.max(...xs) + meia && b.y > Math.min(...ys) + b.r && b.y < Math.max(...ys) + meia;
    }

    // A bola está dentro do cesto / da zona? (`o.qualquer`: vale qualquer bola, como a bala que o canhão dispara)
    const dentroDoCesto = (c, b) => b.x > c.x + 4 && b.x < c.x + 60 && b.y > c.y + 6 && b.y < c.y + 46;
    function dentroDe(o, m, b) {
        if (o.tipo === 'cesto') return dentroDoCesto(m.nivel.fixas.find(p => p.tipo === 'cesto' && (o.cesto == null || p.id === o.cesto)), b);
        return b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h;
    }
    function cumpre(m, o) {
        if (o.tipo === 'todos') return o.lista.every(x => cumpre(m, x));
        if (o.tipo === 'estourar') return m.bolas.every(x => !ehBexiga(x) || x.estourou);
        if (o.tipo === 'caixotes') return m.caixotes.every(c => c.quebrou);
        // uma bola (qualquer, menos bexiga) em cada cesto / pote do cenário
        if (o.tipo === 'cestos') return m.nivel.fixas.filter(p => p.tipo === 'cesto').every(c => m.bolas.some(b => !b.estourou && !ehBexiga(b) && dentroDoCesto(c, b)));
        if (o.tipo === 'ratos') return m.ratos.every(r => m.ratosAtivos.has(r.id));   // todos os ratos correndo
        if (o.tipo === 'armas') return m.armas.every(a => a.tiros > 0);               // todas as armas dispararam
        if (o.tipo === 'inteiras') return o.bolas.every(i => !m.bolas[i].estourou);   // essas bolas/bexigas continuam inteiras
        // `bolas` dentro do balde `balde` (id)
        if (o.tipo === 'presos') return o.bolas.every(i => !!m.bolas[i].capturado);            // bichos presos na gaiola
        if (o.tipo === 'salvos') return o.bolas.every(i => { const b = m.bolas[i]; return !b.estourou && !b.pego && !b.quebrado; });   // nada pegou o rato nem quebrou o aquário
        if (o.tipo === 'quebrar') return o.bolas.every(i => m.bolas[i].quebrado);              // aquário quebrado
        if (o.tipo === 'tempo') return m.quadro >= o.quadros;   // aguentar até esse quadro
        if (o.tipo === 'lampadas') return m.lampadas.length > 0 && m.lampadas.every(l => l.acesa);   // todas as lâmpadas acesas
        if (o.tipo === 'balde') return o.bolas.every(i => m.bolas[i].dentro && m.bolas[i].dentro.id === o.balde);
        if (o.tipo === 'nosBaldes') return o.bolas.every(i => !!m.bolas[i].dentro);            // cada uma dessas bolas dentro de algum balde
        if (o.tipo === 'foguetes') { const fg = m.bolas.filter(b => b.tipo === 'foguete'); return fg.length > 0 && fg.every(b => b.saiu); }   // todos os foguetes subiram e sumiram
        if (o.tipo === 'girar') return o.ids.every(id => m.ligadas.has(id));          // essas engrenagens/esteiras girando
        if (o.tipo === 'canos') return o.bolas.every(i => m.nivel.fixas.some(c => c.tipo === 'cano' && dentroDoCano(m.bolas[i], c)));
        if (o.tipo === 'cesto' || o.tipo === 'zona') {
            // `bolas: [i, j...]`: todas essas bolas precisam estar lá dentro
            if (o.bolas) return o.bolas.every(i => m.bolas[i] && !m.bolas[i].estourou && dentroDe(o, m, m.bolas[i]));
            const candidatas = o.qualquer ? m.bolas.filter(x => !ehBexiga(x) && !x.estourou) : [m.bolas[o.bola || 0]];
            return candidatas.some(b => b && !b.estourou && dentroDe(o, m, b));
        }
        return false;
    }
    const objetivoCumprido = m => cumpre(m, m.nivel.objetivo);

    // ponto (x,y) dentro da zona de vento v (com folga de lado)?
    function naZona(x, y, v, folga) {
        const dx = x - v.boca[0], dy = y - v.boca[1];
        const frente = dx * v.ux + dy * v.uy, lado = -dx * v.uy + dy * v.ux;
        return frente > 0 && frente < v.alcance && Math.abs(lado) < v.altura / 2 + (folga || 0);
    }
    function empurrarVento(b, v, forcaBase, f) {
        const dx = b.x - v.boca[0], dy = b.y - v.boca[1];
        const frente = dx * v.ux + dy * v.uy, lado = -dx * v.uy + dy * v.ux;   // ao longo do sopro / de lado
        if (frente > 0 && frente < v.alcance && Math.abs(lado) < v.altura / 2) {
            const empurra = forcaBase * (1 - 0.6 * frente / v.alcance) / b.massa * f;
            b.vx += v.ux * empurra; b.vy += v.uy * empurra;
        }
    }

    // Raio (ox,oy)+t(ux,uy) contra os segmentos: o menor t > 0 (até `max`), ignorando os da peça `dono`
    // (ou, com dono = 'pavios', os da dinamite e do canhão: o foco pode cair dentro deles).
    function raio(m, ox, oy, ux, uy, max, dono) {
        let melhor = max; raio.dono = null;
        for (const s of m.segs) {
            if (dono && (dono === 'pavios' ? PAVIOS.includes(s.dono?.tipo) : s.dono === dono)) continue;
            const [x1, y1, x2, y2] = s, ex = x2 - x1, ey = y2 - y1, den = ux * ey - uy * ex;
            if (Math.abs(den) < 1e-9) continue;
            const t = ((x1 - ox) * ey - (y1 - oy) * ex) / den, u = ((x1 - ox) * uy - (y1 - oy) * ux) / den;
            if (t > 0.5 && t < melhor && u >= 0 && u <= 1) { melhor = t; raio.dono = s.dono || null; }
        }
        return melhor;
    }
    // Fachos das lanternas acesas; devolve os pontos de foco (luz passando por uma lupa).
    function iluminar(m) {
        m.luz = [];
        const focos = [];
        for (const l of m.lanternas) {
            if (!l.ativo) continue;
            const p = l.p, d = p.dir || 1, a = rad(p.ang || 0), ux = d * Math.cos(a), uy = d * Math.sin(a);
            const [ox, oy] = girarPt(p, d * (LANTERNA.w / 2 + 1), 0);
            const parede = raio(m, ox, oy, ux, uy, 900, p);
            const naParede = raio.dono;
            let lupa = null, tl = parede;
            for (const q of m.lupas) {   // a primeira lupa que o facho atravessa
                const t = (q.x - ox) * ux + (q.y - oy) * uy;
                if (t <= 0 || t >= tl) continue;
                if (Math.hypot(ox + ux * t - q.x, oy + uy * t - q.y) <= LUPA) { lupa = q; tl = t; }
            }
            if (!lupa) {
                m.luz.push({ de: [ox, oy], ate: [ox + ux * parede, oy + uy * parede], foco: null });
                const pn = naParede && naParede.tipo === 'painel' && m.paineis.find(q => q.p === naParede);
                if (pn) pn.aceso = true;
                continue;
            }
            const ate = Math.min(FOCO, raio(m, lupa.x, lupa.y, ux, uy, FOCO, 'pavios'));
            const foco = ate >= FOCO - 0.01 ? [lupa.x + ux * FOCO, lupa.y + uy * FOCO] : null;   // parede antes do foco: não esquenta
            m.luz.push({ de: [ox, oy], ate: [lupa.x, lupa.y], lupa: [lupa.x, lupa.y], cone: [lupa.x + ux * ate, lupa.y + uy * ate], foco });
            if (foco) focos.push(foco);
        }
        for (const l of m.lampadas || []) {
            if (!l.acesa) continue;
            for (const q of m.lupas) {
                const dx = q.x - l.p.x, dy = q.y - l.p.y, d = Math.hypot(dx, dy);
                if (d > 80 || d < 1) continue;
                const ux = dx / d, uy = dy / d, ate = Math.min(FOCO, raio(m, q.x, q.y, ux, uy, FOCO, 'pavios'));
                const foco = ate >= FOCO - 0.01 ? [q.x + ux * FOCO, q.y + uy * FOCO] : null;
                m.luz.push({ de: [l.p.x, l.p.y], ate: [q.x, q.y], lupa: [q.x, q.y], cone: [q.x + ux * ate, q.y + uy * ate], foco, lampada: true });
                if (foco) focos.push(foco);
            }
        }
        return focos;
    }
    const noFoco = (ret, focos) => focos.some(([x, y]) => distRet({ x, y }, ret) <= 6);

    function acenderFoguete(b) { if (b.preso) { b.preso = false; b.fogo = TEMPO_FOGUETE * SUBPASSOS; } }
    // fogo: foco da lupa acende vela e foguete; chama da vela acesa estoura bexiga e acende pavios
    function fogo(m, focos) {
        const perto = (x, y, px, py, r) => Math.hypot(x - px, y - py) <= r;
        for (const b of m.bolas) {
            if (b.estourou) continue;
            if (b.tipo === 'vela' && !b.acesa && focos.some(([x, y]) => perto(x, y, b.x, b.y - b.r, 10)) && ++b.calor >= AQUECER) b.acesa = true;
            if (b.tipo === 'foguete' && b.preso && focos.some(([x, y]) => perto(x, y, ...pavioFoguete(b), 10)) && ++b.calor >= AQUECER) acenderFoguete(b);
        }
        for (const v of m.bolas) {
            if (v.tipo !== 'vela' || !v.acesa || v.estourou) continue;
            const [cx, cy] = chamaDe(v);
            for (const b of m.bolas) {
                if (b === v || b.estourou) continue;
                if (ehBexiga(b) && perto(b.x, b.y, cx, cy, b.r + CHAMA)) b.estourou = true;
                if (b.tipo === 'vela' && !b.acesa && perto(...chamaDe(b), cx, cy, CHAMA + 10)) b.acesa = true;
                if (b.tipo === "foguete" && b.preso && perto(...pavioFoguete(b), cx, cy, CHAMA + 14)) acenderFoguete(b);
            }
            for (const o of [...m.dinamites, ...m.canhoes]) {
                if (o.explodiu || o.disparou || o.pavio >= 0) continue;
                if (distRet({ x: cx, y: cy }, o.ret) <= CHAMA) o.pavio = o.p.tipo === 'canhao' ? PAVIO_CANHAO : PAVIO_DINAMITE;
            }
        }
    }
    function explodir(m, d) {
        d.explodiu = true;
        const [cx, cy] = [d.p.x, d.p.y];
        m.explosoes.push({ x: cx, y: cy, quadro: m.quadro });
        m.segs = m.segs.filter(s => s.dono !== d.p);
        for (const b of m.bolas) {
            if (b.estourou) continue;
            const dx = b.x - cx, dy = b.y - cy, dist = Math.hypot(dx, dy) || 1;
            if (dist >= RAIO_EXPLOSAO) continue;
            if (ehBexiga(b)) { b.estourou = true; continue; }
            if (b.tipo === 'aquario') b.quebrado = true;
            const v = Math.min(14, FORCA_EXPLOSAO * (1 - dist / RAIO_EXPLOSAO) / b.massa);
            b.vx += dx / dist * v; b.vy += dy / dist * v;
        }
        for (const c of m.caixotes) {
            if (c.quebrou) continue;
            const { x, y, w, h } = c.p, px = Math.max(x, Math.min(cx, x + w)), py = Math.max(y, Math.min(cy, y + h));
            if (Math.hypot(cx - px, cy - py) < ALCANCE_CAIXOTE) { c.quebrou = true; m.segs = m.segs.filter(s => s.dono !== c.p); }
        }
        for (const b of m.bolas) if (b.tipo === 'foguete' && b.preso && Math.hypot(b.x - cx, b.y - cy) < RAIO_EXPLOSAO) acenderFoguete(b);
        // a explosão acende o pavio de outras dinamites e canhões por perto
        for (const o of [...m.dinamites, ...m.canhoes]) {
            if (o.explodiu || o.disparou || o.pavio >= 0) continue;
            if (Math.hypot(o.p.x - cx, o.p.y - cy) < RAIO_EXPLOSAO) o.pavio = 10;
        }
    }
    // o boneco sai da caixa: o que estiver em cima (no lado de cima da peça) voa; bexiga estoura
    function abrirSurpresa(m, sp) {
        const a = rad(sp.p.ang || 0), ux = Math.sin(a), uy = -Math.cos(a);   // "para cima" da peça
        for (const b of m.bolas) {
            if (b.estourou) continue;
            const [lx, ly] = paraLocal(sp.p, b.x, b.y);
            if (Math.abs(lx) > SURPRESA.w / 2 + b.r || ly > -SURPRESA.h / 2 + 2 || ly < -SURPRESA.h / 2 - ALCANCE_BONECO - b.r) continue;
            if (ehBexiga(b)) { b.estourou = true; continue; }
            const v = Math.min(14, FORCA_BONECO / Math.sqrt(b.massa));
            b.vx = ux * v + lx * 0.02; b.vy = uy * v;
        }
    }
    function atirar(m, a) {
        const [ox, oy] = girarPt(a.p, a.d * (ARMA.w / 2 + 1), -2);
        let t = ALCANCE_TIRO, alvo = null, dono = null;
        for (const s of m.segs) {
            if (s.dono === a.p) continue;
            const [x1, y1, x2, y2] = s, ex = x2 - x1, ey = y2 - y1, den = a.ux * ey - a.uy * ex;
            if (Math.abs(den) < 1e-9) continue;
            const tt = ((x1 - ox) * ey - (y1 - oy) * ex) / den, u = ((x1 - ox) * a.uy - (y1 - oy) * a.ux) / den;
            if (tt > 0.5 && tt < t && u >= 0 && u <= 1) { t = tt; dono = s.dono || null; alvo = null; }
        }
        for (const b of m.bolas) {
            if (b.estourou) continue;
            const ct = (b.x - ox) * a.ux + (b.y - oy) * a.uy, d = Math.hypot(ox + a.ux * ct - b.x, oy + a.uy * ct - b.y);
            if (ct <= 0 || d > b.r) continue;
            const tt = ct - Math.sqrt(b.r * b.r - d * d);
            if (tt < t) { t = tt; alvo = b; dono = null; }
        }
        m.tiros.push({ de: [ox, oy], ate: [ox + a.ux * t, oy + a.uy * t], quadro: m.quadro });
        if (alvo) {
            if (alvo.tipo === 'aquario') alvo.quebrado = true;
            if (ehBexiga(alvo)) alvo.estourou = true;
            else { const v = FORCA_TIRO / alvo.massa; alvo.vx += a.ux * v; alvo.vy += a.uy * v; }
        } else if (dono && dono.tipo === 'dinamite') {
            const d = m.dinamites.find(x => x.p === dono);
            if (d && !d.explodiu) explodir(m, d);
        }
    }
    function disparar(m, c) {
        c.disparou = true;
        const p = c.p, d = p.dir || 1, a = rad(p.ang || 0), ux = d * Math.cos(a), uy = d * Math.sin(a);
        const [x, y] = girarPt(p, d * (CANHAO.w / 2 + BOLAS.bala.r + ESP + 2), 0);
        m.bolas.push({ tipo: 'bala', ...BOLAS.bala, x, y, vx: ux * VEL_BALA, vy: uy * VEL_BALA, estourou: false, disparada: true });
        m.explosoes.push({ x, y, quadro: m.quadro, tiro: true });
    }

    // Gangorra: bola caindo na ponta alta (impacto = massa × velocidade de queda) vira a
    // tábua, se o impacto vencer o peso parado na outra ponta; o que estava na ponta
    // baixa é arremessado para cima e um pouco para fora.
    function virarGangorras(m, vivas) {
        for (const g of m.gangorras) {
            if (g.recarga > 0) { g.recarga--; continue; }
            const [ini, fim] = pontasGangorra({ ...g.p, lado: g.lado }), tabua = [...ini, ...fim];
            const naTabua = b => !b.estourou && !ehBexiga(b) && distSeg(b.x, b.y, tabua) <= b.r + ESP + 8 && b.y < g.p.y + GANGORRA.apoio;
            const alta = -g.lado;   // lado (sinal de x) da ponta que está em cima
            let impacto = 0, quem = null;
            for (const b of vivas) {
                if (!naTabua(b) || Math.sign(b.x - g.p.x) !== alta || Math.abs(b.x - g.p.x) < 8) continue;
                const i = b.massa * Math.max(0, b.pvy);
                if (i > impacto) { impacto = i; quem = b; }
            }
            if (!quem || impacto < IMPACTO_MIN) continue;
            const doOutroLado = vivas.filter(b => b !== quem && naTabua(b) && Math.sign(b.x - g.p.x) === g.lado);
            const peso = doOutroLado.reduce((s, b) => s + b.massa, 0);
            if (impacto < 2 * peso) continue;
            virarGangorra(m, g, impacto, vivas, doOutroLado);
            quem.vy *= 0.3;
        }
    }
    function virarGangorra(m, g, impacto, vivas, doOutroLado) {
        {
            if (!doOutroLado) {
                const [ini, fim] = pontasGangorra({ ...g.p, lado: g.lado }), tabua = [...ini, ...fim];
                doOutroLado = vivas.filter(b => !b.estourou && !ehBexiga(b) && !b.dentro && distSeg(b.x, b.y, tabua) <= b.r + ESP + 8 && b.y < g.p.y + GANGORRA.apoio && Math.sign(b.x - g.p.x) === g.lado);
            }
            g.lado = -g.lado; g.recarga = 12 * SUBPASSOS; g.viradas++;
            m.segs = m.segs.filter(s => s.dono !== g.p);
            for (const s of segmentosDe({ ...g.p, lado: g.lado })) { s.dono = g.p; m.segs.push(s); }
            const tg = Math.tan(rad(GANGORRA.ang));
            for (const b of doOutroLado) {
                const v = Math.min(LANCE_MAX, GANHO_GANGORRA * impacto / b.massa);
                b.y = g.p.y + g.lado * (b.x - g.p.x) * tg - b.r - ESP - 1;   // em cima da tábua na posição nova
                b.vy = -v; b.vx = Math.sign(b.x - g.p.x) * v * 0.3;
            }
        }
    }

    function personagens(m, vivas) {
        const bichos = vivas.filter(b => (b.tipo === 'mort' || b.tipo === 'pokey') && !b.estourou);
        // gaiola caindo por cima de um bicho: prende
        for (const g of vivas) if (g.tipo === 'gaiola' && !g.estourou && g.vy > 0.5) for (const b of bichos) {
            if (!b.capturado && Math.abs(b.x - g.x) < g.r && b.y > g.y - 4 && Math.hypot(b.x - g.x, b.y - g.y) < g.r + b.r) b.capturado = g;
        }
        for (const b of bichos) {
            if (b.capturado && b.capturado.y + b.capturado.r < b.y - b.r) b.capturado = null;   // a gaiola subiu acima do bicho: ele sai por baixo
            if (b.capturado) { const g = b.capturado; b.x = g.x; b.y = Math.max(b.y, g.y + g.r - b.r - 2); b.vx = g.vx; b.vy = Math.max(b.vy, g.vy); continue; }
            if (b.pego) continue;
            // cochilando: acorda quando é jogado longe (ou, se é rato, quando um gato chega perto)
            if (b.dorme) { if (Math.hypot(b.vx, b.vy) > 3 || (b.tipo === 'mort' && bichos.some(x => x.tipo === 'pokey' && !x.capturado && Math.abs(x.y - b.y) < 50 && Math.abs(x.x - b.x) < MEDO))) b.dorme = false; else continue; }
            if (b.tipo === 'mort') {   // foge do gato que estiver perto
                const gato = bichos.filter(x => x.tipo === 'pokey' && !x.capturado && Math.abs(x.y - b.y) < 50 && Math.abs(x.x - b.x) < MEDO).sort((p, q) => Math.abs(p.x - b.x) - Math.abs(q.x - b.x))[0];
                if (gato) b.andar = Math.sign(b.x - gato.x) || b.andar;
            } else {                   // o gato vai atrás do rato, ou do aquário
                const rato = bichos.filter(x => x.tipo === 'mort' && !x.capturado && !x.pego && Math.abs(x.y - b.y) < 60 && Math.abs(x.x - b.x) < FARO_RATO).sort((p, q) => Math.abs(p.x - b.x) - Math.abs(q.x - b.x))[0];
                const peixe = !rato && vivas.filter(x => x.tipo === 'aquario' && !x.quebrado && Math.abs(x.y - b.y) < 80 && Math.abs(x.x - b.x) < FARO_PEIXE).sort((p, q) => Math.abs(p.x - b.x) - Math.abs(q.x - b.x))[0];
                const alvo = rato || peixe;
                if (alvo) b.andar = Math.sign(alvo.x - b.x) || b.andar;
                if (rato && Math.hypot(rato.x - b.x, rato.y - b.y) < rato.r + b.r + 3) rato.pego = true;
                if (peixe && Math.hypot(peixe.x - b.x, peixe.y - b.y) < peixe.r + b.r + 3) peixe.quebrado = true;
            }
            if (!b.apoio) continue;
            const vel = b.tipo === 'mort' ? VEL_MORT : VEL_POKEY;
            if (b.andar * b.vx < vel) b.vx += (b.andar * vel - b.vx) * 0.25;   // só empurra (vento e rampa podem levar mais rápido)
            // travou (parede, bloco): dá meia-volta
            const andou = Math.abs(b.x - (b.xAntes ?? b.x)); b.xAntes = b.x;
            if (andou < 0.05) { if (++b.travado > 12 * SUBPASSOS) { b.andar = -b.andar; b.travado = 0; } } else b.travado = 0;
        }
        for (const a of vivas) if (a.tipo === 'aquario' && !a.quebrado) {
            if (a.apoio && a.pvy > TOMBO_AQUARIO) a.quebrado = true;                         // tombo
            // bola pesada e rápida batendo no aquário
            if (vivas.some(b => b !== a && !b.estourou && b.massa >= 3 && Math.hypot(b.vx - a.vx, b.vy - a.vy) > 3 && Math.hypot(b.x - a.x, b.y - a.y) < a.r + b.r + 1)) a.quebrado = true;
        }
    }
    function passo(m) {
        if (m.resolvido || m.esgotou) return;
        const f = 1 / SUBPASSOS;
        // energia: interruptor ligado acende os aparelhos no fio dele; luz → foco → pavios
        // detonador apertado: as dinamites no fio dele explodem na hora
        for (const dt of m.detonadores) if (dt.acionado) for (const x of m.fios) if (x.chave === dt.id) {
            const d = m.dinamites.find(q => q.p.id === x.aparelho);
            if (d && !d.explodiu && d.pavio < 0) d.pavio = 1;
        }
        // caixa-surpresa girando pela correia: depois de um tempo o boneco pula
        for (const sp of m.surpresas) if (!sp.abriu && m.ligadas.has(sp.id) && ++sp.giro >= GIROS_SURPRESA) { sp.abriu = true; sp.quadroAbriu = m.quadro; abrirSurpresa(m, sp); }
const ligada = id => m.interruptores.some(i => i.ligado && i.id === id) || m.tomadas.includes(id)
            || m.geradores.some(g => g.id === id && m.ligadas.has(id)) || m.paineis.some(pn => pn.aceso && pn.id === id);
        const energizados = new Set(m.fios.filter(x => ligada(x.chave)).map(x => x.aparelho));
        for (const mt of m.motores) if (energizados.has(mt.id)) m.ratosAtivos.add(mt.id);   // motor ligado gira (e as correias dele)
        for (const l of m.lampadas) l.acesa = energizados.has(l.id) || !!l.puxada;   // lâmpada de cordinha: puxou, acendeu
        // lâmpada acesa ilumina painel solar por perto (se nada tapar a luz)
        for (const l of m.lampadas) if (l.acesa) for (const pn of m.paineis) {
            if (pn.aceso) continue;
            const dx = pn.p.x - l.p.x, dy = pn.p.y - l.p.y, d = Math.hypot(dx, dy);
            if (d > ALCANCE_LAMPADA) continue;
            const t = raio(m, l.p.x, l.p.y, dx / d, dy / d, d, l.p);
            if (t >= d - 0.5 || raio.dono === pn.p) pn.aceso = true;
        }
        for (const v of m.ventos) v.ativo = v.bateria || energizados.has(v.id);
        for (const l of m.lanternas) l.ativo = l.bateria || l.tocada || energizados.has(l.id);
        const focos = iluminar(m);
        fogo(m, focos);
        for (const o of [...m.dinamites, ...m.canhoes]) {
            if (o.explodiu || o.disparou) continue;
            if (o.pavio < 0) { if (noFoco(o.ret, focos) && ++o.calor >= AQUECER) o.pavio = o.p.tipo === 'canhao' ? PAVIO_CANHAO : PAVIO_DINAMITE; }
            else if (o.pavio-- === 0) { if (o.p.tipo === 'canhao') disparar(m, o); else explodir(m, o); }
        }
        // moinhos: vento nas pás faz girar (e não para mais)
        for (const mo of m.moinhos) {
            if (m.ratosAtivos.has(mo.id)) continue;
            const ventando = m.ventos.some(v => v.ativo && naZona(mo.eixo[0], mo.eixo[1], v, PAS / 2))
                || m.foles.some(fo => fo.sopro > 0 && naZona(mo.eixo[0], mo.eixo[1], fo.vento, PAS / 2));
            if (ventando && m.ar > 0) m.ratosAtivos.add(mo.id);
        }

        const vivas = m.bolas.filter(b => !b.estourou);
        for (let k = 0; k < SUBPASSOS; k++) {
            for (const b of vivas) {
                if (b.estourou || b.preso || b.dentro) continue;
                if (b.fogo > 0) { const a = rad(b.ang || 0); b.vx += Math.sin(a) * EMPUXO_FOGUETE * f; b.vy -= Math.cos(a) * EMPUXO_FOGUETE * f; b.fogo--; }
                if (!(b.fogo > 0)) b.vy += m.gravidade * (b.g + (ehBexiga(b) ? EMPUXO_BEXIGA * (1 - m.ar) : 0)) * f;   // foguete queimando voa reto
                for (const v of m.ventos) if (v.ativo) empurrarVento(b, v, FORCA_VENTO * m.ar, f);
                for (const fo of m.foles) if (fo.sopro > 0) empurrarVento(b, fo.vento, FORCA_FOLE * m.ar, f);
                const arrasto = Math.pow(b.arrasto, f * m.ar);
                b.vx *= arrasto; b.vy *= arrasto;
                b.x += b.vx * f; b.y += b.vy * f;
                b.pvy = b.vy;   // velocidade antes de bater (a gangorra mede o impacto com ela)
                b.apoio = false;
                for (const s of m.segs) if (!(s.teto && b.tipo === 'foguete')) colidir(b, s);
            }
            // bola caindo pela boca do balde fica lá dentro (e o balde fica mais pesado)
            for (const bd of vivas) {
                if (bd.tipo !== 'balde' || bd.estourou) continue;
                for (const x of vivas) {
                    if (x === bd || x.dentro || x.estourou || ehBexiga(x) || x.tipo === 'balde' || x.preso) continue;
                    if (x.vy > -0.5 && Math.abs(x.x - bd.x) < bd.r - 3 && x.y < bd.y && x.y > bd.y - bd.r - x.r - 4) {
                        x.dentro = bd; bd.carga.push(x); bd.massa += x.massa;
                    }
                }
                bd.carga.forEach((x, i) => { x.x = bd.x + (i % 2 ? 4 : -4); x.y = bd.y + 4 - x.r - i * 3; x.vx = bd.vx; x.vy = bd.vy; });
            }
            personagens(m, vivas);
            for (let i = 0; i < vivas.length; i++) for (let j = i + 1; j < vivas.length; j++) {
                if (!vivas[i].estourou && !vivas[j].estourou && !vivas[i].dentro && !vivas[j].dentro && !vivas[i].capturado && !vivas[j].capturado) colidirBolas(vivas[i], vivas[j]);
            }
            esticarCordas(m); esticarCordas(m);
            virarGangorras(m, vivas);
            // tesoura: bola no cabo (metade de trás) fecha as lâminas e corta a corda que passa nelas
            for (const t of m.tesouras) {
                const d = t.dir || 1;
                if (!vivas.some(b => !b.estourou && !ehBexiga(b) && !b.dentro && encosta(b, t) && paraLocal(t.p, b.x, b.y)[0] * d < 0)) continue;
                const [lx] = [d * TESOURA.w / 4];
                cortarCordas(m, { p: { x: girarPt(t.p, lx, 0)[0], y: girarPt(t.p, lx, 0)[1], ang: t.p.ang || 0 }, w: TESOURA.w / 2 + 8, h: TESOURA.h + 6 });
                t.fechou = m.quadro;
            }
            // chama de vela queima a corda
            // foguete voando: o bico estoura a bexiga em que bater
            for (const fg of vivas) if (fg.tipo === 'foguete' && fg.fogo > 0) for (const b of vivas) if (ehBexiga(b) && !b.estourou && Math.hypot(b.x - fg.x, b.y - fg.y) < b.r + fg.r + 3) b.estourou = true;
            for (const v of vivas) if (v.tipo === 'vela' && v.acesa && !v.estourou) {
                const [cx, cy] = chamaDe(v);
                cortarCordas(m, { p: { x: cx, y: cy, ang: 0 }, w: CHAMA * 2, h: CHAMA * 2 });
            }

            // bola bateu num dos cabos do fole (faces largas; encostou agora): ele sopra.
            // Vale dos dois lados, então o fole girado de ponta-cabeça funciona igual.
            for (const fo of m.foles) {
                vivas.forEach((b, i) => {
                    const toca = !b.estourou && b.tipo !== 'bexiga' && !b.dentro && Math.abs(paraLocal(fo.ret.p, b.x, b.y)[1]) > fo.ret.h / 2 && encosta(b, fo.ret);
                    if (toca && !fo.tocando.has(i)) { fo.sopro = DURACAO_SOPRO * SUBPASSOS; fo.soprou++; }
                    if (toca) fo.tocando.add(i); else fo.tocando.delete(i);
                });
            }

            // luva de boxe: bola encostou na metade de trás (o botão) → soco no que estiver na frente
            for (const l of m.luvas) {
                if (l.socando > 0) l.socando--;
                if (l.recarga > 0) { l.recarga--; continue; }
                const botao = vivas.some(b => !b.estourou && encosta(b, l.ret) && paraLocal(l.ret.p, b.x, b.y)[0] * l.d < 0);
                if (!botao) continue;
                l.recarga = RECARGA_SOCO * SUBPASSOS; l.socando = 15 * SUBPASSOS; l.socos++;
                for (const b of vivas) {
                    if (b.estourou) continue;
                    const [lx, ly] = paraLocal(l.ret.p, b.x, b.y), frente = lx * l.d - LUVA.w / 2;
                    if (frente < -b.r || frente > ALCANCE_SOCO + b.r || Math.abs(ly) > ALTURA_SOCO / 2 + b.r) continue;
                    if (ehBexiga(b)) { b.estourou = true; continue; }
                    const v = Math.min(12, FORCA_SOCO / Math.sqrt(b.massa));
                    b.vx = l.ux * v; b.vy = l.uy * v - 1;
                }
            }

            for (const l of m.lanternas) if (l.toque && !l.tocada && vivas.some(b => !b.estourou && !ehBexiga(b) && encosta(b, l.ret))) l.tocada = true;
            // arma: bola encostou no gatilho (metade de trás) → tiro
            for (const a of m.armas) {
                if (a.recarga > 0) { a.recarga--; continue; }
                if (!vivas.some(b => !b.estourou && encosta(b, a.ret) && paraLocal(a.ret.p, b.x, b.y)[0] * a.d < 0)) continue;
                a.recarga = RECARGA_ARMA * SUBPASSOS; a.tiros++; a.ultimoTiro = m.quadro;
                atirar(m, a);
            }
            // detonador: bola encostou na alavanca (em cima)
            for (const dt of m.detonadores) if (!dt.acionado && vivas.some(b => !b.estourou && !ehBexiga(b) && encosta(b, dt.ret) && paraLocal(dt.ret.p, b.x, b.y)[1] < -DETONADOR.h / 2)) dt.acionado = true;
            // interruptor: bola encostou → liga (e fica ligado); bexiga é leve demais para apertar
            for (const it of m.interruptores) if (!it.ligado && vivas.some(b => !b.estourou && !ehBexiga(b) && encosta(b, it.ret))) it.ligado = true;

            // bola encostou na gaiola: o rato começa a correr (e não para mais)
            for (const r of m.ratos) {
                if (m.ratosAtivos.has(r.id)) continue;
                if (vivas.some(b => !b.estourou && encosta(b, r.ret))) m.ratosAtivos.add(r.id);
            }
            for (const c of m.correias) if (c.rato && m.ratosAtivos.has(c.rato)) { m.ligadas.add(c.alvo); m.sentido.set(c.alvo, c.sentido); }
            for (let mudou = true; mudou;) {
                mudou = false;
                for (const c of m.correias) if (!c.rato) for (const [x, y] of [[c.a, c.b], [c.b, c.a]]) {
                    if (m.ligadas.has(x) && !m.ligadas.has(y)) { m.ligadas.add(y); m.sentido.set(y, m.sentido.get(x) || 1); mudou = true; }
                }
                for (const a of m.engrenagens) if (m.ligadas.has(a.id)) for (const b of m.engrenagens) {
                    if (m.ligadas.has(b.id) || Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r + 6) continue;
                    m.ligadas.add(b.id); m.sentido.set(b.id, -(m.sentido.get(a.id) || 1)); mudou = true;
                }
            }

            // bexigas: tesoura (chegando nela) ou engrenagem girando estouram
            for (const b of vivas) {
                if (!ehBexiga(b) || b.estourou) continue;
                const rapida = Math.hypot(b.vx, b.vy) > VEL_CORTE;
                if ((rapida && m.tesouras.some(t => encosta(b, t)))
                    || m.engrenagens.some(e => m.ligadas.has(e.id) && Math.hypot(b.x - e.x, b.y - e.y) <= e.r + b.r + ESP + 1)) {
                    b.estourou = true;
                }
            }

            // bola apoiada numa face da esteira ligada: puxa até a velocidade dela, ao
            // longo da esteira (a face de cima anda para `dir`, a de baixo ao contrário)
            for (const e of m.esteiras) {
                if (!m.ligadas.has(e.id)) continue;
                const { w, h } = e.ret;
                for (const b of vivas) {
                    if (b.estourou) continue;
                    const [lx, ly] = paraLocal(e.ret.p, b.x, b.y);
                    if (lx <= -w / 2 - b.r || lx >= w / 2 + b.r) continue;
                    const face = Math.abs(-ly - b.r - h / 2) <= ESP + 1 ? 1 : Math.abs(ly - b.r - h / 2) <= ESP + 1 ? -1 : 0;
                    if (!face) continue;
                    const alvo = face * e.dir * m.sentido.get(e.id) * VELOCIDADE_ESTEIRA, agora = b.vx * e.ux + b.vy * e.uy;
                    const dv = (alvo - agora) * GANHO_ESTEIRA;
                    b.vx += dv * e.ux; b.vy += dv * e.uy;
                }
            }
            for (const fo of m.foles) if (fo.sopro > 0) fo.sopro--;
        }
        // bola que saiu da tela (a bala do canhão, por exemplo) some
        for (const b of m.bolas) if (!b.estourou && (b.x < -50 || b.x > W + 50 || b.y > H + 50 || b.y < -40)) { b.estourou = true; if (b.tipo === 'foguete') b.saiu = true; }
        m.quadro++;
        if (objetivoCumprido(m)) { if (++m.dentro >= 20) m.resolvido = true; }
        else m.dentro = 0;
        if (m.quadro > 60 * 20) m.esgotou = true;   // 20 s de simulação
    }

    // Roda até resolver ou esgotar (uso nos testes).
    function simular(nivel, pecas, ambiente) {
        const m = criarMundo(nivel, pecas, ambiente);
        while (!m.resolvido && !m.esgotou) passo(m);
        return m;
    }

    const api = {
        W, H, BOLAS, ALCANCE_VENTO, ALTURA_VENTO, ALCANCE_FOLE, ALTURA_FOLE, ESTEIRA, GAIOLA, FOLE, TESOURA, CORREIA_MAX,
        MACACO, POLIA, GANCHO, posPonta, caminho, medirCordas, segRet,
        CHAMA, chamaDe, pavioFoguete,
        TOMADA, GERADOR, MOTOR, PAINEL, LAMPADA, ALCANCE_LAMPADA,
        GANGORRA, LUVA, INTERRUPTOR, ARMA, SURPRESA, DETONADOR, ALCANCE_BONECO, FIO_MAX, MOINHO, PAS, LANTERNA, LUPA, FOCO, DINAMITE, CANHAO, RAIO_EXPLOSAO,
        segmentosDe, engrenagem, pontasCorreia, paredesCano, bolasDoNivel, sobrepoe, criarMundo, passo, simular,
        girarPt, paraLocal, tamanho, pontasGangorra, eixoMoinho, iluminar,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else raiz.TimFisica = api;
})(typeof window !== 'undefined' ? window : globalThis);

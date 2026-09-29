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
        return null;
    }
    // Pontas de uma correia { de, para } (ids de um rato e de uma esteira/engrenagem), ou null.
    function pontasCorreia(c, todas) {
        const a = todas.find(p => p.id === c.de), b = todas.find(p => p.id === c.para);
        if (!a || !b) return null;
        const ga = engrenagem(a), gb = engrenagem(b);
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
                return segsRetangulo(p, tamanho(p));
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
            return { tipo, ...BOLAS[tipo], x: d.x, y: d.y, vx: 0, vy: 0, estourou: false };
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

    function criarMundo(nivel, pecas, ambiente) {
        const todas = [...nivel.fixas, ...pecas];
        const segs = [
            [0, H - 8, W, H - 8], [2, 0, 2, H], [W - 2, 0, W - 2, H], [0, 2, W, 2],   // chão, paredes e teto
        ];
        for (const p of todas) for (const s of segmentosDe(p)) segs.push(s);
        const ventos = todas.filter(p => p.tipo === 'ventilador' && p.ligado).map(p => zonaVento(p, 15, ALCANCE_VENTO, ALTURA_VENTO));
        const foles = todas.filter(p => p.tipo === 'fole').map(p => ({
            ret: retangulo(p), vento: zonaVento(p, FOLE.w / 2, ALCANCE_FOLE, ALTURA_FOLE),
            sopro: 0, tocando: new Set(), soprou: 0,
        }));
        const tesouras = todas.filter(p => p.tipo === 'tesoura').map(retangulo);
        const esteiras = todas.filter(p => p.tipo === 'esteira').map(p => {
            const a = rad(p.ang || 0);
            return { id: p.id, ret: retangulo(p), dir: p.dir || 1, ux: Math.cos(a), uy: Math.sin(a) };
        });
        const engrenagens = todas.filter(p => p.tipo === 'engrenagem').map(p => ({ id: p.id, x: p.x, y: p.y, r: p.r || 18 }));
        const ratos = todas.filter(p => p.tipo === 'rato').map(p => ({ id: p.id, ret: retangulo(p) }));
        const correias = [];
        for (const c of todas) {
            if (c.tipo !== 'correia') continue;
            const pc = pontasCorreia(c, todas);
            if (!pc || pc.comprimento > CORREIA_MAX) continue;
            const rato = [pc.a, pc.b].find(p => p.tipo === 'rato'), movida = [pc.a, pc.b].find(p => p.tipo === 'esteira' || p.tipo === 'engrenagem');
            // gaiola espelhada: a roda gira ao contrário, e a correia leva esse sentido para a esteira
            if (rato && movida) correias.push({ rato: rato.id, alvo: movida.id, sentido: rato.espelho ? -1 : 1 });
        }
        const bolas = bolasDoNivel(nivel, pecas);
        const amb = { ...(nivel.ambiente || {}), ...(ambiente || {}) };
        return {
            nivel, segs, ventos, foles, tesouras, esteiras, engrenagens, ratos, correias, bolas,
            gravidade: amb.gravidade ?? 1, ar: amb.ar ?? 1,
            bola: bolas[nivel.objetivo.bola || 0],   // a bola que precisa chegar no objetivo
            ratosAtivos: new Set(), ligadas: new Set(), sentido: new Map(),   // ligadas: ids de esteiras/engrenagens girando
            quadro: 0, dentro: 0, resolvido: false, esgotou: false,
        };
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
        const total = a.massa + b.massa, sobra = lim - d;
        a.x -= nx * sobra * b.massa / total; a.y -= ny * sobra * b.massa / total;
        b.x += nx * sobra * a.massa / total; b.y += ny * sobra * a.massa / total;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel >= 0) return;
        const j = -(1 + Math.min(a.restit, b.restit)) * rel / (1 / a.massa + 1 / b.massa);
        a.vx -= j * nx / a.massa; a.vy -= j * ny / a.massa;
        b.vx += j * nx / b.massa; b.vy += j * ny / b.massa;
    }

    const encosta = (b, ret) => distRet(b, ret) <= b.r + ESP + 1;

    // Bola dentro de um cano (em U, por exemplo): abaixo da boca e dentro da largura dele.
    function dentroDoCano(b, c) {
        const xs = c.pontos.map(p => p[0]), ys = c.pontos.map(p => p[1]), meia = (c.largura || 44) / 2;
        return b.x > Math.min(...xs) - meia && b.x < Math.max(...xs) + meia && b.y > Math.min(...ys) + b.r && b.y < Math.max(...ys) + meia;
    }

    function objetivoCumprido(m) {
        const o = m.nivel.objetivo, b = m.bola;
        if (o.tipo === 'estourar') return m.bolas.every(x => !ehBexiga(x) || x.estourou);
        if (o.tipo === 'canos') return o.bolas.every(i => m.nivel.fixas.some(c => c.tipo === 'cano' && dentroDoCano(m.bolas[i], c)));
        if (o.tipo === 'cesto') {
            const c = m.nivel.fixas.find(p => p.tipo === 'cesto');
            return b.x > c.x + 4 && b.x < c.x + 60 && b.y > c.y + 6 && b.y < c.y + 46;
        }
        if (o.tipo === 'zona') return b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h;
        return false;
    }

    function empurrarVento(b, v, forcaBase, f) {
        const dx = b.x - v.boca[0], dy = b.y - v.boca[1];
        const frente = dx * v.ux + dy * v.uy, lado = -dx * v.uy + dy * v.ux;   // ao longo do sopro / de lado
        if (frente > 0 && frente < v.alcance && Math.abs(lado) < v.altura / 2) {
            const empurra = forcaBase * (1 - 0.6 * frente / v.alcance) / b.massa * f;
            b.vx += v.ux * empurra; b.vy += v.uy * empurra;
        }
    }

    function passo(m) {
        if (m.resolvido || m.esgotou) return;
        const f = 1 / SUBPASSOS;
        const vivas = m.bolas.filter(b => !b.estourou);
        for (let k = 0; k < SUBPASSOS; k++) {
            for (const b of vivas) {
                if (b.estourou) continue;
                b.vy += m.gravidade * (b.g + (ehBexiga(b) ? EMPUXO_BEXIGA * (1 - m.ar) : 0)) * f;
                for (const v of m.ventos) empurrarVento(b, v, FORCA_VENTO * m.ar, f);
                for (const fo of m.foles) if (fo.sopro > 0) empurrarVento(b, fo.vento, FORCA_FOLE * m.ar, f);
                const arrasto = Math.pow(b.arrasto, f * m.ar);
                b.vx *= arrasto; b.vy *= arrasto;
                b.x += b.vx * f; b.y += b.vy * f;
                for (const s of m.segs) colidir(b, s);
            }
            for (let i = 0; i < vivas.length; i++) for (let j = i + 1; j < vivas.length; j++) {
                if (!vivas[i].estourou && !vivas[j].estourou) colidirBolas(vivas[i], vivas[j]);
            }

            // bola bateu num dos cabos do fole (faces largas; encostou agora): ele sopra.
            // Vale dos dois lados, então o fole girado de ponta-cabeça funciona igual.
            for (const fo of m.foles) {
                vivas.forEach((b, i) => {
                    const toca = !b.estourou && !ehBexiga(b) && Math.abs(paraLocal(fo.ret.p, b.x, b.y)[1]) > fo.ret.h / 2 && encosta(b, fo.ret);
                    if (toca && !fo.tocando.has(i)) { fo.sopro = DURACAO_SOPRO * SUBPASSOS; fo.soprou++; }
                    if (toca) fo.tocando.add(i); else fo.tocando.delete(i);
                });
            }

            // bola encostou na gaiola: o rato começa a correr (e não para mais)
            for (const r of m.ratos) {
                if (m.ratosAtivos.has(r.id)) continue;
                if (vivas.some(b => !b.estourou && encosta(b, r.ret))) m.ratosAtivos.add(r.id);
            }
            for (const c of m.correias) if (m.ratosAtivos.has(c.rato)) { m.ligadas.add(c.alvo); m.sentido.set(c.alvo, c.sentido); }

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
        segmentosDe, engrenagem, pontasCorreia, paredesCano, bolasDoNivel, sobrepoe, criarMundo, passo, simular,
        girarPt, paraLocal, tamanho,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else raiz.TimFisica = api;
})(typeof window !== 'undefined' ? window : globalThis);

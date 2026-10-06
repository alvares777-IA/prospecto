// MUNDO — porta multiplayer em mapa de blocos 2D (vista de cima).
//
// Estado VIVO em memória (como sala.js): some se o processo reiniciar, e
// tudo bem — o que importa (os atos) já foi para o banco. O navegador só
// manda INTENÇÃO (direção, "minerar ali", "doar metade") e desenha o que
// recebe; quem decide movimento, colisão, mineração, pontos e atos é o loop
// daqui (regra 1).
//
// Nada de peso de destino aqui: este módulo só DETECTA atos (doou, saqueou,
// rompeu pacto...) e os entrega ao index.js, que grava via registrar_evento.
// Quanto cada ato vale está em regra_destino.

import { randomUUID } from 'node:crypto';

export const T = {
    GRAMA: 0, ARVORE: 1, PEDRA: 2, MINERIO: 3, ARBUSTO: 4, AGUA: 5,
    BURACO: 6, TERRA: 7, BAU: 8, TABUA: 9, MURO: 10, PORTA: 11,
};
const ANDAVEL = new Set([T.GRAMA, T.TERRA, T.BURACO]);
// bloco -> [tiques para quebrar, item que dá, qtd, bloco que fica no lugar]
const MINERAVEL = {
    [T.ARVORE]:  [12, 'madeira', 1, T.GRAMA],
    [T.PEDRA]:   [16, 'pedra',   1, T.TERRA],
    [T.MINERIO]: [28, 'minerio', 1, T.TERRA],
    [T.ARBUSTO]: [6,  'comida',  2, T.GRAMA],
    [T.TABUA]:   [6,  'madeira', 1, T.TERRA],
    [T.MURO]:    [10, 'pedra',   1, T.TERRA],
};
const TIQUES_ESCALAR = 60;    // sair do buraco sozinho: 6s segurando
const TIQUES_REANIMAR = 50;   // desmaiado comendo a própria comida: 5s segurando E
const FOME_ALERTA = 25;
const TIQUES_DEPOSITO = 3;    // segurando no baú: 1 item a cada 0,3s
const ITENS = ['minerio', 'comida', 'madeira', 'pedra'];
const VIZ8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const TICK_MS = 100;
const PASSO_TIQUES = 2;       // anda 1 bloco a cada 2 tiques (5 blocos/s)
const ROUBO_MS = 3000;        // janela em que o bloco "ainda era" de quem minerava
export const LARG = 48, ALT = 32;

// Adversários. O servidor decide tudo (perseguição, golpe, flecha, dano);
// o cliente só desenha. Matar dá o item direto no inventário de quem matou.
// Valores-base; vida/velocidade/dano/quantidade vêm de `parametro` (mundo_*), ver parametrosMundo.
const COMBATE_PADRAO = { vidaJogador: 10, vidaPct: 100, velPct: 100, danoPct: 100, qtdInicial: 9, qtdMax: 12 };
const cmb = m => m.params.combate || COMBATE_PADRAO;
const vidaMaxDe = m => cmb(m).vidaJogador;
const REGEN_TIQUES = 50;      // +1 de vida a cada 5s (se não estiver faminto)
const INVUL_TIQUES = 6;       // pausa entre dois danos no mesmo jogador
const CD_GOLPE = 5;           // jogador: 1 golpe a cada 0,5s
const SPAWN_TIQUES = 250;     // 1 mob novo a cada 25s (até qtdMax)
const MOBS = {
    zumbi:     { vida: 4, dano: 1, vel: 6, cd: 9,  aggro: 9,  drop: ['comida', 1] },
    esqueleto: { vida: 3, dano: 1, vel: 5, cd: 22, aggro: 10, drop: ['madeira', 1], distancia: true },
    soldado:   { vida: 6, dano: 2, vel: 3, cd: 10, aggro: 8,  drop: ['minerio', 1] },
};
const TIPOS_MOB = Object.keys(MOBS);

const mundos = new Map();     // `${sessaoId}:${ordem}` -> mundo
let cb = { emitirSala() {}, emitirPara() {}, aoAto() {}, aoFim() {} };

export function configurar(callbacks) { cb = { ...cb, ...callbacks }; }

// ── geração do mapa ────────────────────────────────────────────────
function rng(semente) {
    let h = 1779033703 ^ semente.length;
    for (let i = 0; i < semente.length; i++) {
        h = Math.imul(h ^ semente.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function gerarMapa(semente) {
    const r = rng(semente);
    const g = new Uint8Array(LARG * ALT).fill(T.GRAMA);
    const set = (x, y, v) => { if (x > 0 && y > 0 && x < LARG - 1 && y < ALT - 1) g[y * LARG + x] = v; };
    const get = (x, y) => g[y * LARG + x];
    const ri = (a, b) => a + Math.floor(r() * (b - a + 1));

    // borda de água
    for (let x = 0; x < LARG; x++) { g[x] = T.AGUA; g[(ALT - 1) * LARG + x] = T.AGUA; }
    for (let y = 0; y < ALT; y++) { g[y * LARG] = T.AGUA; g[y * LARG + LARG - 1] = T.AGUA; }

    const mancha = (cx, cy, raio, v, dens = 1) => {
        for (let y = cy - raio; y <= cy + raio; y++) for (let x = cx - raio; x <= cx + raio; x++) {
            const d = Math.hypot(x - cx, y - cy);
            if (d <= raio + r() * 0.8 - 0.4 && r() < dens) set(x, y, v);
        }
    };
    for (let i = 0; i < 3; i++) mancha(ri(6, LARG - 7), ri(5, ALT - 6), ri(2, 3), T.AGUA);
    for (let i = 0; i < 7; i++) mancha(ri(4, LARG - 5), ri(4, ALT - 5), ri(2, 3), T.ARVORE, 0.55);
    for (let i = 0; i < 5; i++) {
        const cx = ri(5, LARG - 6), cy = ri(5, ALT - 6);
        mancha(cx, cy, ri(2, 3), T.PEDRA, 0.8);
        for (let k = 0; k < ri(3, 6); k++) set(cx + ri(-2, 2), cy + ri(-2, 2), T.MINERIO);
    }
    for (let i = 0; i < 18; i++) { const x = ri(2, LARG - 3), y = ri(2, ALT - 3); if (get(x, y) === T.GRAMA) set(x, y, T.ARBUSTO); }

    // centro: clareira com o baú (spawn em volta)
    const cx = LARG >> 1, cy = ALT >> 1;
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 4; x <= cx + 4; x++) set(x, y, T.GRAMA);
    set(cx, cy, T.BAU);

    // porta de saída na borda de cima (alinhada ao baú), com a passagem limpa
    g[cx] = T.PORTA;
    for (let y = 1; y <= 3; y++) g[y * LARG + cx] = T.GRAMA;

    // buracos longe do centro
    for (let i = 0; i < 12; i++) {
        const x = ri(2, LARG - 3), y = ri(2, ALT - 3);
        if (Math.abs(x - cx) + Math.abs(y - cy) > 7 && get(x, y) === T.GRAMA) set(x, y, T.BURACO);
    }
    return { g, bau: { x: cx, y: cy } };
}

// ── ciclo de vida ──────────────────────────────────────────────────
const chave = (sessaoId, ordem) => `${sessaoId}:${ordem}`;
export const salaSocket = (sessaoId, ordem) => `mundo:${sessaoId}:${ordem}`;

function obterMundo(sessaoId, ordem, params) {
    const k = chave(sessaoId, ordem);
    let m = mundos.get(k);
    if (!m) {
        const { g, bau } = gerarMapa(k);
        m = {
            k, sessaoId, ordem, params, g, bauPos: bau,
            bau: { minerio: 0, comida: 0, madeira: 0, pedra: 0 },
            jogadores: new Map(),     // jogadorId -> jogador
            mineracao: new Map(),     // idx do bloco -> { jid, ult } (primeiro que começou)
            pedidos: new Map(),       // id -> pedido de socorro
            mudados: [],              // blocos alterados desde o último envio
            tique: 0,
            mobs: new Map(), flechas: [], proxMob: 1,
        };
        for (let i = 0; i < cmb(m).qtdInicial; i++) gerarMob(m, TIPOS_MOB[i % 3], 8);
        mundos.set(k, m);
    }
    m.params = params;
    return m;
}

const idx = (x, y) => y * LARG + x;
const dentro = (x, y) => x >= 0 && y >= 0 && x < LARG && y < ALT;
const vizinho = (a, x, y) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) <= 1;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function pontosDe(inv, valores) {
    return Object.entries(inv).reduce((s, [it, q]) => s + q * (valores[it] || 0), 0);
}
const totalBau = m => pontosDe(m.bau, m.params.valores);

function mudar(m, x, y, v) {
    m.g[idx(x, y)] = v;
    m.mudados.push([x, y, v]);
}

// Entra (ou volta) no mundo. Devolve o pacote inicial para o socket.
export function entrar(sessaoId, ordem, params, { jogadorId, socketId, nome, anonimo }) {
    const m = obterMundo(sessaoId, ordem, params);
    let j = m.jogadores.get(jogadorId);
    if (j && !j.finalizado) {
        j.socketId = socketId; j.ausente = false;          // reconexão: mantém tudo
    } else {
        const livres = [];
        for (let y = m.bauPos.y - 2; y <= m.bauPos.y + 2; y++)
            for (let x = m.bauPos.x - 3; x <= m.bauPos.x + 3; x++)
                if (m.g[idx(x, y)] === T.GRAMA) livres.push({ x, y });
        const p = livres[Math.floor(Math.random() * livres.length)] || { x: m.bauPos.x + 1, y: m.bauPos.y };
        j = {
            jogadorId, socketId, nome, anonimo, x: p.x, y: p.y,
            dir: { dx: 0, dy: 0 }, passo: 0,
            inv: { minerio: 0, comida: 0, madeira: 0, pedra: 0 },
            vida: vidaMaxDe(m), invul: 0, golpeCd: 0, regen: 0,
            fome: 100, fomeAcum: 0, preso: false, desmaiado: false, ausente: false,
            minerando: null, entrada: Date.now(), fim: Date.now() + params.duracaoSeg * 1000,
            depositou: 0, sacou: 0, finalizado: false,
        };
        m.jogadores.set(jogadorId, j);
    }
    return { mapa: pacoteMapa(m), eu: pacoteEu(m, j) };
}

function pacoteMapa(m) {
    return { larg: LARG, alt: ALT, blocos: Buffer.from(m.g).toString('base64'), bau: m.bauPos };
}

function pacoteEu(m, j) {
    return {
        jogadorId: j.jogadorId, inv: j.inv, pontos: pontosDe(j.inv, m.params.valores),
        metaPessoal: m.params.metaPessoal, metaEquipe: m.params.metaEquipe, valores: m.params.valores,
        fome: Math.round(j.fome), vida: j.vida, vidaMax: vidaMaxDe(m), fim: j.fim, agora: Date.now(),
    };
}

export function mundoDe(sessaoId, ordem) { return mundos.get(chave(sessaoId, ordem)) || null; }

function jogadorAtivo(sessaoId, ordem, jogadorId) {
    const m = mundoDe(sessaoId, ordem);
    const j = m?.jogadores.get(jogadorId);
    return j && !j.finalizado ? { m, j } : null;
}

// ── intenções do cliente ───────────────────────────────────────────
export function input(sessaoId, ordem, jogadorId, dx, dy) {
    const a = jogadorAtivo(sessaoId, ordem, jogadorId); if (!a) return;
    a.j.dir = { dx: Math.sign(Number(dx) || 0), dy: Math.sign(Number(dy) || 0) };
    if (a.j.dir.dx || a.j.dir.dy) { a.j.caminho = null; a.j.querMinerar = null; }   // tecla manda mais que o clique
}

// Clique esquerdo (segurando). O servidor decide o que ele significa:
//   - em mim, preso num buraco      -> escalar
//   - bloco/baú vizinho             -> minerar / depositar o item escolhido
//   - bloco/baú longe               -> andar até o lado e, chegando, agir
//   - chão                          -> andar até lá (caminho calculado aqui)
// Soltar (alvo null) para a ação, mas não o caminho já em andamento.
export function minerar(sessaoId, ordem, jogadorId, alvo, item) {
    const a = jogadorAtivo(sessaoId, ordem, jogadorId); if (!a) return;
    const { m, j } = a;
    if (!alvo) { j.minerando = null; j.querMinerar = null; return; }
    const x = Number(alvo.x), y = Number(alvo.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || !dentro(x, y)) return;
    if (j.desmaiado) return;
    const b = m.g[idx(x, y)];
    if (j.preso) {
        if (x === j.x && y === j.y && !j.minerando?.escalar) j.minerando = { x, y, escalar: true, prog: 0, precisa: TIQUES_ESCALAR };
        return;
    }
    const temAcao = MINERAVEL[b] || b === T.BAU || b === T.PORTA;
    if (temAcao) {
        if (vizinho(j, x, y)) { j.caminho = null; j.querMinerar = null; iniciarAcao(m, j, x, y, item); return; }
        const r = rota(m, j, x, y, true);
        if (!r) return cb.emitirPara(j.socketId, 'mundo_aviso', { texto: 'Não tem caminho até lá.' });
        j.caminho = r; j.querMinerar = { x, y, item }; j.minerando = null;
    } else if (ANDAVEL.has(b) && (x !== j.x || y !== j.y)) {
        const r = rota(m, j, x, y, false);
        if (!r) return cb.emitirPara(j.socketId, 'mundo_aviso', { texto: 'Não tem caminho até lá.' });
        j.caminho = r; j.querMinerar = null; j.minerando = null;
    }
}

function iniciarAcao(m, j, x, y, item) {
    const b = m.g[idx(x, y)];
    if (b === T.PORTA) {
        cb.emitirPara(j.socketId, 'mundo_porta', {});
    } else if (b === T.BAU) {
        if (!ITENS.includes(item)) return;
        if (j.inv[item] < 1) return cb.emitirPara(j.socketId, 'mundo_aviso', { texto: `Você não tem ${item} para depositar.` });
        if (j.minerando?.bau && j.minerando.item === item) return;
        j.minerando = { x, y, bau: true, item, prog: 0, precisa: TIQUES_DEPOSITO };
    } else if (MINERAVEL[b]) {
        if (j.minerando && j.minerando.x === x && j.minerando.y === y) return;
        j.minerando = { x, y, escalar: false, prog: 0, precisa: MINERAVEL[b][0] };
    }
}

// Caminho mais curto (BFS, 8 direções, sem cortar quina, sem pisar em
// buraco — a não ser que o buraco seja o próprio destino clicado).
// paraAcao: basta chegar colado no alvo. Devolve [[x,y], ...] ou null.
function rota(m, j, tx, ty, paraAcao) {
    const chegou = (x, y) => paraAcao ? Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 1 : (x === tx && y === ty);
    if (chegou(j.x, j.y)) return [];
    const pode = (x, y) => dentro(x, y) && ANDAVEL.has(m.g[idx(x, y)])
        && (m.g[idx(x, y)] !== T.BURACO || (!paraAcao && x === tx && y === ty));
    const veio = new Int32Array(LARG * ALT).fill(-1);
    const ini = idx(j.x, j.y);
    veio[ini] = ini;
    const fila = [ini];
    for (let h = 0; h < fila.length; h++) {
        const k = fila[h], x = k % LARG, y = (k - x) / LARG;
        for (const [dx, dy] of VIZ8) {
            const nx = x + dx, ny = y + dy;
            if (!pode(nx, ny)) continue;
            if (dx && dy && (!pode(x + dx, y) || !pode(x, y + dy))) continue;
            const nk = idx(nx, ny);
            if (veio[nk] !== -1) continue;
            veio[nk] = k;
            if (chegou(nx, ny)) {
                const r = [];
                for (let c = nk; c !== ini; c = veio[c]) r.push([c % LARG, Math.floor(c / LARG)]);
                return r.reverse();
            }
            fila.push(nk);
        }
    }
    return null;
}

function flushDeposito(m, j) {
    const buf = j.depBuf; j.depBuf = null;
    if (!buf || !Object.keys(buf.itens).length) return;
    const desc = Object.entries(buf.itens).map(([it, q]) => `${q} ${it}`).join(', ');
    ato(m, j, null, 'DEPOSITOU_BAU', buf.valor, { itens: buf.itens, bau_total: totalBau(m) },
        { tipo: 'positivo', descricao: `depositou ${desc} no baú da equipe` });
}

// Progresso de um bloco é COMPARTILHADO: quem cavar junto acelera, e quem
// der o último golpe leva o item. Se a maior parte do trabalho era de outro
// (que ainda estava cavando), é ROUBOU_BLOCO. Bloco largado por ROUBO_MS zera.
function progressoBloco(m, x, y) {
    const k = idx(x, y), agora = Date.now();
    let reg = m.mineracao.get(k);
    if (!reg || agora - reg.ult > ROUBO_MS) {
        reg = { prog: 0, precisa: MINERAVEL[m.g[k]][0], contrib: new Map(), ult: agora };
        m.mineracao.set(k, reg);
    }
    return reg;
}

export function segurarComer(sessaoId, ordem, jogadorId, ativo) {
    const a = jogadorAtivo(sessaoId, ordem, jogadorId); if (!a) return;
    a.j.segurandoComer = !!ativo;
    if (!ativo) a.j.reanimando = 0;
}

export function comer(sessaoId, ordem, jogadorId) {
    const a = jogadorAtivo(sessaoId, ordem, jogadorId); if (!a) return;
    const { m, j } = a;
    if (j.inv.comida < 1 || j.desmaiado) return;
    j.inv.comida--; j.fome = Math.min(100, j.fome + 25);
    enviarEu(m, j);
}

// Botão direito num bloco: resgatar quem está preso ali, alimentar quem
// desmaiou ali, ou colocar um bloco (pedra/madeira) — encher buraco = ponte.
export function usar(sessaoId, ordem, jogadorId, alvo) {
    const a = jogadorAtivo(sessaoId, ordem, jogadorId); if (!a) return;
    const { m, j } = a;
    if (j.desmaiado) return;
    const x = Number(alvo?.x), y = Number(alvo?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || !dentro(x, y) || !vizinho(j, x, y)) return;
    const item = alvo?.item === 'madeira' ? 'madeira' : alvo?.item === 'comida' ? 'comida' : 'pedra';
    const outro = [...m.jogadores.values()].find(o => o !== j && !o.finalizado && o.x === x && o.y === y);

    if (outro?.preso) {
        const mat = j.inv[item] > 0 && item !== 'comida' ? item : (j.inv.pedra > 0 ? 'pedra' : j.inv.madeira > 0 ? 'madeira' : null);
        if (!mat) return;
        j.inv[mat]--;
        outro.preso = false; outro.minerando = null;
        mudar(m, x, y, T.TERRA);
        ajudou(m, j, outro, 'AJUDA_REERGUER', { material: mat, x, y },
            { tipo: 'positivo', descricao: `tirou ${outro.nome} do buraco` });
        enviarEu(m, j); enviarEu(m, outro);
        return;
    }
    if (outro?.desmaiado) {
        if (j.inv.comida < 1) return;
        alimentar(m, j, outro, 1);
        return;
    }
    if (item === 'comida' || j.inv[item] < 1) return;
    const b = m.g[idx(x, y)];
    if (!ANDAVEL.has(b) || outro || (x === j.x && y === j.y)) return;
    j.inv[item]--;
    mudar(m, x, y, b === T.BURACO ? T.TERRA : item === 'madeira' ? T.TABUA : T.MURO);
    enviarEu(m, j);
}

// Doação pelo painel (à distância). Quantidade decidida AQUI a partir do
// modo — o cliente nunca manda número de itens.
export function doar(sessaoId, ordem, jogadorId, paraId, item, modo) {
    const a = jogadorAtivo(sessaoId, ordem, jogadorId); if (!a) return { erro: 'fora' };
    const { m, j } = a;
    const para = m.jogadores.get(Number(paraId));
    if (!para || para === j || para.finalizado) return { erro: 'alvo' };
    if (!['minerio', 'comida', 'madeira', 'pedra'].includes(item)) return { erro: 'item' };
    const tem = j.inv[item];
    if (tem < 1) return { erro: 'vazio' };
    const qtd = modo === 'tudo' ? tem : modo === 'metade' ? Math.ceil(tem / 2) : 1;

    if (item === 'comida' && para.desmaiado) { alimentar(m, j, para, qtd); return { ok: true }; }

    const saldoAntes = { ...j.inv }, pontosAntes = pontosDe(j.inv, m.params.valores);
    j.inv[item] -= qtd; para.inv[item] += qtd;
    ajudou(m, j, para, 'DOOU_ITEM', {
        item, qtd, modo, saldo_item_antes: tem, pontos_antes: pontosAntes,
        fracao: +(qtd / tem).toFixed(2), inventario_antes: saldoAntes,
        alvo_fome: Math.round(para.fome), alvo_preso: para.preso,
    }, { tipo: 'positivo', descricao: `doou ${qtd} ${item} a ${para.nome}` }, qtd);
    enviarEu(m, j); enviarEu(m, para);
    cb.emitirPara(para.socketId, 'mundo_aviso', { texto: `${j.nome} te deu ${qtd} ${item}.` });
    return { ok: true };
}

function alimentar(m, de, para, qtd) {
    de.inv.comida -= qtd;
    para.inv.comida += qtd - 1;
    para.desmaiado = false; para.reanimando = 0;
    para.fome = Math.min(100, 40 + (qtd - 1) * 25);
    ajudou(m, de, para, 'ALIMENTOU', { qtd, comida_antes: de.inv.comida + qtd },
        { tipo: 'positivo', descricao: `deu comida a ${para.nome}, que tinha desmaiado` }, qtd);
    enviarEu(m, de); enviarEu(m, para);
    cb.emitirPara(para.socketId, 'mundo_aviso', { texto: `${de.nome} te alimentou.` });
}

export function bau(sessaoId, ordem, jogadorId, operacao, item, modo) {
    const a = jogadorAtivo(sessaoId, ordem, jogadorId); if (!a) return;
    const { m, j } = a;
    if (dist(j, m.bauPos) > 2.9 || j.desmaiado) return cb.emitirPara(j.socketId, 'mundo_aviso', { texto: 'Chegue perto do baú.' });
    if (!['minerio', 'comida', 'madeira', 'pedra'].includes(item)) return;
    const origem = operacao === 'depositar' ? j.inv : m.bau;
    const tem = origem[item];
    if (tem < 1) return;
    const qtd = modo === 'tudo' ? tem : modo === 'metade' ? Math.ceil(tem / 2) : 1;
    const valor = qtd * (m.params.valores[item] || 0);

    if (operacao === 'depositar') {
        j.inv[item] -= qtd; m.bau[item] += qtd; j.depositou += valor;
        ato(m, j, null, 'DEPOSITOU_BAU', valor, { item, qtd, bau_total: totalBau(m) },
            { tipo: 'positivo', descricao: `depositou ${qtd} ${item} no baú da equipe` });
    } else {
        const excessoAntes = Math.max(0, j.sacou - j.depositou);
        m.bau[item] -= qtd; j.inv[item] += qtd; j.sacou += valor;
        const excesso = Math.max(0, j.sacou - j.depositou) - excessoAntes;
        if (excesso > 0) {
            ato(m, j, null, 'SAQUEOU_BAU', excesso, { item, qtd, depositou: j.depositou, sacou: j.sacou, bau_total: totalBau(m) },
                { tipo: 'negativo', descricao: `sacou do baú da equipe mais do que depositou` });
        }
    }
    enviarEu(m, j);
}

// ── socorro e pacto ────────────────────────────────────────────────
export function pedirSocorro(sessaoId, ordem, jogadorId) {
    const a = jogadorAtivo(sessaoId, ordem, jogadorId); if (!a) return;
    const { m, j } = a;
    if ([...m.pedidos.values()].some(p => p.de === jogadorId && !p.fechado)) return;
    const presentes = [...m.jogadores.values()].filter(o => o !== j && !o.finalizado).map(o => o.jogadorId);
    const p = {
        id: randomUUID().slice(0, 8), de: jogadorId, nome: j.nome, criado: Date.now(),
        prazo: Date.now() + m.params.socorroPrazoSeg * 1000,
        situacao: { preso: j.preso, desmaiado: j.desmaiado, fome: Math.round(j.fome) },
        presentes, respostas: new Map(),   // jid -> { tipo:'recusou'|'aceitou', dist0, menor, prazo, fechado }
        fechado: false,
    };
    m.pedidos.set(p.id, p);
    ato(m, j, null, 'PEDIU_SOCORRO', null, { situacao: p.situacao, x: j.x, y: j.y }, null);
    cb.emitirSala(salaSocket(sessaoId, ordem), 'mundo_socorro', { id: p.id, de: jogadorId, nome: j.nome, situacao: p.situacao });
}

export function responderSocorro(sessaoId, ordem, jogadorId, pedidoId, aceitar) {
    const a = jogadorAtivo(sessaoId, ordem, jogadorId); if (!a) return;
    const { m, j } = a;
    const p = m.pedidos.get(String(pedidoId));
    if (!p || p.fechado || p.de === jogadorId || p.respostas.has(jogadorId)) return;
    const pedinte = m.jogadores.get(p.de);
    if (!aceitar) {
        p.respostas.set(jogadorId, { tipo: 'recusou' });
        ato(m, j, p.de, 'RECUSOU', null, { pedido: p.id, situacao: p.situacao },
            { tipo: 'negativo', descricao: `recusou o socorro pedido por ${p.nome}` });
    } else {
        const d0 = pedinte ? dist(j, pedinte) : 0;
        p.respostas.set(jogadorId, { tipo: 'aceitou', dist0: d0, menor: d0, prazo: Date.now() + m.params.socorroPrazoSeg * 2000, fechado: false });
        ato(m, j, p.de, 'ACEITOU_PACTO', null, { pedido: p.id, distancia: +d0.toFixed(1), situacao: p.situacao }, null);
        if (pedinte) cb.emitirPara(pedinte.socketId, 'mundo_aviso', { texto: `${j.nome} aceitou vir te ajudar.` });
    }
    cb.emitirSala(salaSocket(sessaoId, ordem), 'mundo_socorro_resposta', { id: p.id, nome: j.nome, aceitou: !!aceitar });
}

// Ato de ajuda de `de` para `para`: registra, cumpre o pacto de `de` (se
// houver) e dá o pedido de `para` por atendido.
function ajudou(m, de, para, tipoEvento, contexto, carater, valor = null) {
    ato(m, de, para.jogadorId, tipoEvento, valor, contexto, carater);
    for (const p of m.pedidos.values()) {
        if (p.de !== para.jogadorId) continue;
        const r = p.respostas.get(de.jogadorId);
        if (r?.tipo === 'aceitou' && !r.fechado) {
            r.fechado = true;
            ato(m, de, para.jogadorId, 'CUMPRIU_PACTO', null, { pedido: p.id, como: tipoEvento },
                { tipo: 'positivo', descricao: `cumpriu o socorro prometido a ${para.nome}` });
        }
        fecharPedido(m, p, true);
    }
}

// Fecha um pedido antes do prazo (atendido, ou o pedinte saiu do mundo):
// quem aceitou e não cumpriu é avaliado agora (tentou/rompeu); quem não
// respondeu não é punido — IGNOROU só nasce do vencimento (passoPedidos).
function fecharPedido(m, p, atendido) {
    for (const [jid, r] of p.respostas) if (r.tipo === 'aceitou' && !r.fechado) avaliarPacto(m, p, jid, r);
    if (p.fechado) return;
    p.fechado = true;
    cb.emitirSala(salaSocket(m.sessaoId, m.ordem), 'mundo_socorro_fim', { id: p.id, atendido });
}

function avaliarPacto(m, p, jid, r) {
    r.fechado = true;
    const o = m.jogadores.get(jid);
    if (!o) return;
    const aproximou = r.dist0 - r.menor;
    if (aproximou >= 2 || r.menor <= 1.5) {
        ato(m, o, p.de, 'TENTOU_CUMPRIR', null, { pedido: p.id, dist0: +r.dist0.toFixed(1), menor: +r.menor.toFixed(1) },
            { tipo: 'positivo', descricao: `tentou chegar a tempo de socorrer ${p.nome}` });
    } else {
        ato(m, o, p.de, 'ROMPEU_PACTO', null, { pedido: p.id, dist0: +r.dist0.toFixed(1), menor: +r.menor.toFixed(1) },
            { tipo: 'negativo', descricao: `prometeu socorro a ${p.nome} e não foi` });
    }
}

// ── atos -> banco (via index.js) ───────────────────────────────────
function ato(m, jogador, alvoId, tipoEvento, valor, contexto, carater) {
    const alvo = alvoId != null ? m.jogadores.get(alvoId) : null;
    cb.aoAto(m.sessaoId, {
        uid: randomUUID(), tipoEvento, ator: jogador.jogadorId, atorAnonimo: jogador.anonimo,
        alvo: alvo && !alvo.anonimo ? alvoId : null, valor,
        contexto: { ...contexto, mundo: m.k, alvo_nome: alvo?.nome, x: jogador.x, y: jogador.y },
        carater, porta: m.params.porta, dt: new Date(),
    });
}

// ── saída ──────────────────────────────────────────────────────────
export function sair(sessaoId, ordem, jogadorId, paraHall = false) {
    const a = jogadorAtivo(sessaoId, ordem, jogadorId); if (!a) return;
    a.j.paraHall = !!paraHall;
    finalizar(a.m, a.j);
}

// Tira o jogador de qualquer mundo da sessão SEM contar como fim (salto de
// porta feito pelo admin de teste): não responde a porta nem gera ato.
export function remover(sessaoId, jogadorId) {
    for (const m of mundos.values()) {
        if (m.sessaoId === sessaoId) m.jogadores.delete(jogadorId);
    }
}

export function desconectou(jogadorId) {
    for (const m of mundos.values()) {
        const j = m.jogadores.get(jogadorId);
        if (j && !j.finalizado) { j.ausente = true; j.dir = { dx: 0, dy: 0 }; j.minerando = null; }
    }
}

function finalizar(m, j) {
    if (j.finalizado) return;
    j.finalizado = true;
    flushDeposito(m, j);
    for (const p of m.pedidos.values()) {
        if (p.de === j.jogadorId) fecharPedido(m, p, false);
        const r = p.respostas.get(j.jogadorId);
        if (r?.tipo === 'aceitou' && !r.fechado) avaliarPacto(m, p, j.jogadorId, r);
    }
    const pontos = pontosDe(j.inv, m.params.valores);
    const equipeCompleta = totalBau(m) >= m.params.metaEquipe;
    m.jogadores.delete(j.jogadorId);
    cb.aoFim(m.sessaoId, m.ordem, j, { pontos, equipeCompleta, bau: totalBau(m), paraHall: !!j.paraHall });
}

// ── loop ───────────────────────────────────────────────────────────
function passoJogador(m, j) {
    const agora = Date.now();
    if (agora >= j.fim) return finalizar(m, j);
    if (j.depBuf && !j.minerando?.bau) flushDeposito(m, j);   // soltou o baú: 1 evento com o total

    if (j.golpeCd > 0) j.golpeCd--;
    if (j.vida < vidaMaxDe(m) && j.fome > FOME_ALERTA && !j.desmaiado && ++j.regen >= REGEN_TIQUES) { j.regen = 0; j.vida++; enviarEu(m, j); }

    // fome
    j.fomeAcum += TICK_MS / 1000;
    if (j.fomeAcum >= m.params.fomeSeg) { j.fomeAcum = 0; j.fome = Math.max(0, j.fome - 1); }
    if (j.fome > FOME_ALERTA) j.avisouFome = false;
    else if (!j.avisouFome && !j.desmaiado) {
        j.avisouFome = true;
        cb.emitirPara(j.socketId, 'mundo_aviso', { texto: 'Com fome! Aperte E para comer (gasta 1 comida). Se zerar, você desmaia.', tipo: 'warning' });
    }
    if (j.fome <= 0 && !j.desmaiado) {
        j.desmaiado = true; j.minerando = null; j.reanimando = 0;
        enviarEu(m, j);
        cb.emitirPara(j.socketId, 'mundo_aviso', {
            tipo: 'danger', fixo: true,
            texto: j.inv.comida > 0
                ? 'Você desmaiou de fome. Segure E por 5s para comer e se levantar — ou peça socorro.'
                : 'Você desmaiou de fome e não tem comida. Peça socorro: alguém precisa te alimentar.',
        });
    }
    if (j.desmaiado) {
        // levantar sozinho custa tempo parado e 1 comida — quem guardou comida tem saída
        if (j.segurandoComer && j.inv.comida > 0 && !j.ausente) {
            if (++j.reanimando >= TIQUES_REANIMAR) {
                j.inv.comida--; j.fome = 30; j.desmaiado = false; j.reanimando = 0; j.segurandoComer = false;
                enviarEu(m, j);
                cb.emitirPara(j.socketId, 'mundo_aviso', { texto: 'Você comeu e se levantou.', tipo: 'success' });
            }
        } else j.reanimando = 0;
        return;
    }
    if (j.ausente) return;

    // chegou perto do que clicou de longe (segurando): começa a agir
    if (j.querMinerar && !j.preso && vizinho(j, j.querMinerar.x, j.querMinerar.y)) {
        const q = j.querMinerar;
        j.querMinerar = null; j.caminho = null;
        iniciarAcao(m, j, q.x, q.y, q.item);
    }

    // mineração / depósito
    if (j.minerando?.bau) {
        const mm = j.minerando;
        if (!vizinho(j, mm.x, mm.y)) j.minerando = null;
        else if (++mm.prog >= mm.precisa) {
            mm.prog = 0;
            if (j.inv[mm.item] < 1) {
                j.minerando = null;
                cb.emitirPara(j.socketId, 'mundo_aviso', { texto: `Acabou ${mm.item} no seu inventário.` });
            } else {
                const v = m.params.valores[mm.item] || 0;
                j.inv[mm.item]--; m.bau[mm.item]++; j.depositou += v;
                j.depBuf = j.depBuf || { itens: {}, valor: 0 };
                j.depBuf.itens[mm.item] = (j.depBuf.itens[mm.item] || 0) + 1;
                j.depBuf.valor += v;
                enviarEu(m, j);
                cb.emitirSala(salaSocket(m.sessaoId, m.ordem), 'mundo_bau_som', { item: mm.item, id: j.jogadorId });
            }
        }
    } else if (j.minerando) {
        const mm = j.minerando;
        const b = m.g[idx(mm.x, mm.y)];
        if (!vizinho(j, mm.x, mm.y) || (!mm.escalar && !MINERAVEL[b]) || (mm.escalar && !j.preso)) {
            j.minerando = null;
        } else if (mm.escalar) {
            if (++mm.prog >= mm.precisa) {
                j.minerando = null;
                j.preso = false; mudar(m, mm.x, mm.y, T.TERRA); j.fome = Math.max(0, j.fome - 5);
                enviarEu(m, j);
            }
        } else {
            const reg = progressoBloco(m, mm.x, mm.y);
            reg.prog++; reg.ult = agora;
            reg.contrib.set(j.jogadorId, (reg.contrib.get(j.jogadorId) || 0) + 1);
            mm.prog = reg.prog; mm.precisa = reg.precisa;
            if (reg.prog >= reg.precisa) {
                const [, item, qtd, resto] = MINERAVEL[b];
                m.mineracao.delete(idx(mm.x, mm.y));
                j.inv[item] += qtd;
                j.fome = Math.max(0, j.fome - 1);
                mudar(m, mm.x, mm.y, resto);
                for (const o of m.jogadores.values()) if (o.minerando?.x === mm.x && o.minerando?.y === mm.y) o.minerando = null;
                // quem trabalhou mais nesse bloco, fora eu?
                let dono = null, maior = 0;
                for (const [jid, n] of reg.contrib) if (jid !== j.jogadorId && n > maior) { maior = n; dono = m.jogadores.get(jid); }
                const meu = reg.contrib.get(j.jogadorId) || 0;
                if (dono && maior > meu) {
                    ato(m, j, dono.jogadorId, 'ROUBOU_BLOCO', qtd * (m.params.valores[item] || 0),
                        { item, qtd, bloco: b, bx: mm.x, by: mm.y, trabalho_dele: maior, meu_trabalho: meu },
                        { tipo: 'negativo', descricao: `tomou o bloco que ${dono.nome} estava minerando` });
                    cb.emitirPara(dono.socketId, 'mundo_aviso', { texto: `${j.nome} deu o último golpe e levou o bloco que você minerava.` });
                }
                enviarEu(m, j);
            }
        }
    }

    // movimento: tecla tem prioridade; sem tecla, segue o caminho do clique
    if (j.preso) return;
    const porTecla = !!(j.dir.dx || j.dir.dy);
    if (!porTecla && !j.caminho?.length) return;
    if (++j.passo < PASSO_TIQUES) return;
    j.passo = 0;
    const tenta = porTecla
        ? [[j.dir.dx, j.dir.dy], [j.dir.dx, 0], [0, j.dir.dy]].filter(([dx, dy]) => dx || dy)
        : [[j.caminho[0][0] - j.x, j.caminho[0][1] - j.y]];
    let andou = false;
    for (const [dx, dy] of tenta) {
        const nx = j.x + dx, ny = j.y + dy;
        if (dentro(nx, ny) && m.g[idx(nx, ny)] === T.PORTA) {   // bateu na porta de saída: o cliente pergunta se quer sair
            j.dir = { dx: 0, dy: 0 }; j.caminho = null;
            if (!j.portaAte || agora_() > j.portaAte) { j.portaAte = agora_() + 3000; cb.emitirPara(j.socketId, 'mundo_porta', {}); }
            break;
        }
        if (!dentro(nx, ny) || !ANDAVEL.has(m.g[idx(nx, ny)])) continue;
        if (dx && dy && (!ANDAVEL.has(m.g[idx(j.x + dx, j.y)]) || !ANDAVEL.has(m.g[idx(j.x, j.y + dy)]))) continue;
        j.x = nx; j.y = ny; j.minerando = null; andou = true;
        if (!porTecla) j.caminho.shift();
        if (m.g[idx(nx, ny)] === T.BURACO) {
            j.preso = true; j.dir = { dx: 0, dy: 0 };
            cb.emitirPara(j.socketId, 'mundo_aviso', { texto: 'Você caiu num buraco! Peça socorro ou segure o clique em você mesmo para escalar.' });
        }
        break;
    }
    // caminho bloqueado no meio (alguém pôs um bloco): recalcula até o mesmo destino
    if (!andou && !porTecla && j.caminho?.length) {
        const [fx, fy] = j.caminho[j.caminho.length - 1];
        j.caminho = j.querMinerar ? rota(m, j, j.querMinerar.x, j.querMinerar.y, true) : rota(m, j, fx, fy, false);
    }
}

const agora_ = () => Date.now();

function passoPedidos(m) {
    const agora = Date.now();
    for (const p of m.pedidos.values()) {
        const pedinte = m.jogadores.get(p.de);
        for (const [jid, r] of p.respostas) {
            if (r.tipo !== 'aceitou' || r.fechado) continue;
            const o = m.jogadores.get(jid);
            if (o && pedinte) r.menor = Math.min(r.menor, dist(o, pedinte));
            if (agora >= r.prazo) avaliarPacto(m, p, jid, r);
        }
        if (!p.fechado && agora >= p.prazo) {
            // prazo do pedido: quem não respondeu ignorou. Os pactos aceitos
            // seguem até o prazo deles (o dobro) ou até o pedinte ser atendido.
            const naoResponderam = p.presentes.filter(jid => !p.respostas.has(jid));
            for (const jid of naoResponderam) {
                const o = m.jogadores.get(jid);
                if (o) ato(m, o, p.de, 'IGNOROU', null, { pedido: p.id, situacao: p.situacao },
                    { tipo: 'negativo', descricao: `ignorou o socorro pedido por ${p.nome}` });
                p.respostas.set(jid, { tipo: 'ignorou' });
            }
            const pendentes = [...p.respostas.values()].some(r => r.tipo === 'aceitou' && !r.fechado);
            if (!pendentes) { p.fechado = true; cb.emitirSala(salaSocket(m.sessaoId, m.ordem), 'mundo_socorro_fim', { id: p.id, atendido: false }); }
        }
        if (p.fechado && agora - p.criado > 5 * 60 * 1000) m.pedidos.delete(p.id);
    }
}

// ── adversários ────────────────────────────────────────────────────
const livre = (m, x, y) => dentro(x, y) && (m.g[idx(x, y)] === T.GRAMA || m.g[idx(x, y)] === T.TERRA);

function gerarMob(m, tipo, distMin) {
    for (let t = 0; t < 40; t++) {
        const x = 1 + Math.floor(Math.random() * (LARG - 2)), y = 1 + Math.floor(Math.random() * (ALT - 2));
        if (!livre(m, x, y)) continue;
        if (Math.hypot(x - m.bauPos.x, y - m.bauPos.y) < distMin) continue;
        if ([...m.jogadores.values()].some(j => Math.hypot(j.x - x, j.y - y) < distMin)) continue;
        if ([...m.mobs.values()].some(o => o.x === x && o.y === y)) continue;
        const id = m.proxMob++, vm = Math.max(1, Math.round(MOBS[tipo].vida * cmb(m).vidaPct / 100));
        m.mobs.set(id, { id, tipo, x, y, vida: vm, vm, face: 1, cd: 0, passo: 0, atq: 0 });
        return;
    }
}

// Linha reta sem parede entre dois pontos (água e buraco não bloqueiam flecha).
function linhaLivre(m, a, b) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
    for (let i = 1; i < n; i++) {
        const x = Math.round(a.x + (b.x - a.x) * i / n), y = Math.round(a.y + (b.y - a.y) * i / n);
        const bl = m.g[idx(x, y)];
        if (!ANDAVEL.has(bl) && bl !== T.AGUA) return false;
    }
    return true;
}

function machucar(m, j, n) {
    if (j.finalizado || j.ausente || m.tique < j.invul) return;
    j.invul = m.tique + INVUL_TIQUES;
    j.vida -= n;
    if (j.vida > 0) { enviarEu(m, j); return; }
    // nocaute: acorda junto ao baú, perde um quarto do que carregava
    const perdas = [];
    for (const it of ITENS) {
        const p = Math.floor(j.inv[it] / 4);
        if (p > 0) { j.inv[it] -= p; perdas.push(`${p} ${it}`); }
    }
    const livres = [];
    for (let y = m.bauPos.y - 2; y <= m.bauPos.y + 2; y++)
        for (let x = m.bauPos.x - 3; x <= m.bauPos.x + 3; x++) if (m.g[idx(x, y)] === T.GRAMA) livres.push({ x, y });
    const p = livres[Math.floor(Math.random() * livres.length)] || { x: m.bauPos.x + 1, y: m.bauPos.y };
    j.x = p.x; j.y = p.y; j.vida = vidaMaxDe(m); j.invul = m.tique + 30;
    j.preso = false; j.desmaiado = false; j.fome = Math.max(j.fome, 30);
    j.caminho = null; j.querMinerar = null; j.minerando = null; j.dir = { dx: 0, dy: 0 };
    enviarEu(m, j);
    cb.emitirPara(j.socketId, 'mundo_aviso', { tipo: 'danger', texto: `Você foi derrubado e acordou junto ao baú${perdas.length ? ` — perdeu ${perdas.join(', ')}` : ''}.` });
}

// Derrubar um adversário que estava atrás de OUTRO jogador (ainda por perto) é proteger um aliado.
function protegeu(m, j, o) {
    const aliado = o.alvoId != null && o.alvoId !== j.jogadorId ? m.jogadores.get(o.alvoId) : null;
    if (!aliado || aliado.finalizado || aliado.ausente || dist(aliado, o) > 4) return;
    ato(m, j, aliado.jogadorId, 'PROTEGEU_ALIADO', aliado.vida, { adversario: o.tipo, vida_aliado: aliado.vida, vida_max: vidaMaxDe(m), distancia: +dist(aliado, o).toFixed(1) },
        { tipo: 'positivo', descricao: `defendeu ${aliado.nome} de um ${o.tipo}` });
    cb.emitirPara(aliado.socketId, 'mundo_aviso', { texto: `${j.nome} te defendeu de um ${o.tipo}.`, tipo: 'success' });
}

// Golpe do jogador num adversário vizinho (clique no bicho ou Espaço).
export function atacar(sessaoId, ordem, jogadorId, mobId) {
    const a = jogadorAtivo(sessaoId, ordem, jogadorId); if (!a) return;
    const { m, j } = a;
    if (j.desmaiado || j.preso || j.golpeCd > 0) return;
    let o = mobId != null ? m.mobs.get(Number(mobId)) : null;
    if (!o || !vizinho(j, o.x, o.y)) {   // sem alvo válido: o mais próximo ao alcance
        o = null;
        for (const c of m.mobs.values()) if (vizinho(j, c.x, c.y) && (!o || dist(j, c) < dist(j, o))) o = c;
    }
    if (!o) return;
    j.golpeCd = CD_GOLPE; j.minerando = null;
    o.vida--; o.face = Math.sign(j.x - o.x) || o.face;
    if (o.vida > 0) return;
    m.mobs.delete(o.id);
    protegeu(m, j, o);
    const [item, qtd] = MOBS[o.tipo].drop;
    j.inv[item] += qtd;
    enviarEu(m, j);
    cb.emitirPara(j.socketId, 'mundo_aviso', { tipo: 'success', texto: `${o.tipo} derrotado: +${qtd} ${item}.` });
}

const danoDe = (m, def) => Math.max(1, Math.round(def.dano * cmb(m).danoPct / 100));

function alvoMaisPerto(m, o, raio) {
    let melhor = null, md = raio;
    for (const j of m.jogadores.values()) {
        if (j.finalizado || j.ausente) continue;
        const d = dist(o, j);
        if (d <= md) { md = d; melhor = j; }
    }
    return melhor;
}

function passoMobs(m) {
    m.flechas = m.flechas.filter(f => {
        f.x += f.vx; f.y += f.vy;
        const rx = Math.round(f.x), ry = Math.round(f.y);
        if (++f.idade > 30 || !dentro(rx, ry)) return false;
        const bl = m.g[idx(rx, ry)];
        if (!ANDAVEL.has(bl) && bl !== T.AGUA) return false;
        for (const j of m.jogadores.values()) {
            if (!j.finalizado && !j.ausente && Math.hypot(j.x - f.x, j.y - f.y) < 0.7) { machucar(m, j, f.dano); return false; }
        }
        return true;
    });

    for (const o of m.mobs.values()) {
        const def = MOBS[o.tipo];
        if (o.cd > 0) o.cd--;
        if (o.atq > 0) o.atq--;
        const alvo = alvoMaisPerto(m, o, def.aggro);
        if (alvo) { o.face = Math.sign(alvo.x - o.x) || o.face; o.alvoId = alvo.jogadorId; }
        const d = alvo ? dist(o, alvo) : Infinity;

        if (def.distancia && alvo) {
            if (d <= 7 && o.cd === 0 && linhaLivre(m, o, alvo)) {
                m.flechas.push({ x: o.x, y: o.y, vx: (alvo.x - o.x) / d * 0.6, vy: (alvo.y - o.y) / d * 0.6, idade: 0, dano: danoDe(m, def) });
                o.cd = def.cd; o.atq = 3;
            }
        } else if (alvo && vizinho(o, alvo.x, alvo.y)) {
            if (o.cd === 0) { o.cd = def.cd; o.atq = 3; machucar(m, alvo, danoDe(m, def)); }
            continue;
        }

        if (++o.passo < Math.max(1, Math.round(def.vel * 100 / cmb(m).velPct))) continue;
        o.passo = 0;
        let destino = null;
        if (alvo && !(def.distancia && d <= 4 && d >= 3)) {
            if (def.distancia && d < 3) {   // arqueiro recua
                const dx = Math.sign(o.x - alvo.x), dy = Math.sign(o.y - alvo.y);
                for (const [ax, ay] of [[dx, dy], [dx, 0], [0, dy]]) if ((ax || ay) && livre(m, o.x + ax, o.y + ay)) { destino = [o.x + ax, o.y + ay]; break; }
            } else {
                const r = rota(m, o, alvo.x, alvo.y, true);
                if (r?.length) destino = r[0];
            }
        } else if (!alvo && Math.random() < 0.25) {
            const [dx, dy] = VIZ8[Math.floor(Math.random() * 4)];
            destino = [o.x + dx, o.y + dy];
        }
        if (destino && livre(m, destino[0], destino[1])
            && ![...m.mobs.values()].some(c => c !== o && c.x === destino[0] && c.y === destino[1])
            && ![...m.jogadores.values()].some(j => j.x === destino[0] && j.y === destino[1])) {
            o.x = destino[0]; o.y = destino[1];
        }
    }

    if (m.tique % SPAWN_TIQUES === 0 && m.mobs.size < cmb(m).qtdMax) gerarMob(m, TIPOS_MOB[Math.floor(Math.random() * 3)], 10);
}

function enviarEu(m, j) {
    if (j.socketId && !j.ausente) cb.emitirPara(j.socketId, 'mundo_eu', pacoteEu(m, j));
}

function instantaneo(m) {
    return {
        agora: Date.now(),
        jogadores: [...m.jogadores.values()].map(j => ({
            id: j.jogadorId, nome: j.nome, x: j.x, y: j.y,
            preso: j.preso, desmaiado: j.desmaiado, ausente: j.ausente, fome: Math.round(j.fome), vida: j.vida, vm: vidaMaxDe(m),
            rean: j.desmaiado && j.reanimando ? +(j.reanimando / TIQUES_REANIMAR).toFixed(2) : 0,
            dest: j.caminho?.length ? j.caminho[j.caminho.length - 1] : null,
            min: j.minerando ? { x: j.minerando.x, y: j.minerando.y, p: +(j.minerando.prog / j.minerando.precisa).toFixed(2) } : null,
        })),
        blocos: m.mudados.splice(0),
        mobs: [...m.mobs.values()].map(o => ({ id: o.id, t: o.tipo, x: o.x, y: o.y, v: o.vida, vm: o.vm, f: o.face, a: o.atq > 0 ? 1 : 0 })),
        flechas: m.flechas.map(f => ({ x: +f.x.toFixed(2), y: +f.y.toFixed(2), vx: f.vx, vy: f.vy })),
        bau: { total: totalBau(m), meta: m.params.metaEquipe, inv: m.bau },
        pedidos: [...m.pedidos.values()].filter(p => !p.fechado || [...p.respostas.values()].some(r => r.tipo === 'aceitou' && !r.fechado))
            .map(p => ({
                id: p.id, de: p.de, nome: p.nome, fechado: p.fechado,
                restante: Math.max(0, Math.round((p.prazo - Date.now()) / 1000)),
                respondeu: [...p.respostas.keys()],
                aceitos: [...p.respostas.entries()].filter(([, r]) => r.tipo === 'aceitou').map(([jid]) => m.jogadores.get(jid)?.nome).filter(Boolean),
            })),
    };
}

setInterval(() => {
    for (const m of mundos.values()) {
        if (!m.jogadores.size) {
            if (!m.vazioDesde) m.vazioDesde = Date.now();
            else if (Date.now() - m.vazioDesde > 60 * 60 * 1000) mundos.delete(m.k);
            continue;
        }
        m.vazioDesde = null;
        m.tique++;
        try {
            for (const j of [...m.jogadores.values()]) passoJogador(m, j);
            passoPedidos(m);
            passoMobs(m);
            // fome muda devagar: manda o "eu" de cada um 1x/s
            if (m.tique % 10 === 0) for (const j of m.jogadores.values()) enviarEu(m, j);
            cb.emitirSala(salaSocket(m.sessaoId, m.ordem), 'mundo_estado', instantaneo(m));
        } catch (err) {
            console.warn('[mundo] tique:', err.message);
        }
    }
}, TICK_MS);

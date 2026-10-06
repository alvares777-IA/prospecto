import { readFileSync } from 'node:fs';
// Verifica os desafios do TIM por simulação (não é publicado em public/).
// Só usa posições que a interface permite (grade de 10 px), senão uma
// "solução" verificada poderia ser impossível de montar no jogo.
//   1) sem nenhuma peça do jogador, o desafio NÃO pode se resolver sozinho;
//   2) existe pelo menos uma forma de resolver com as peças da caixa;
//   3) ventilador sem bateria não resolve (a bateria é necessária).
//   node jogoDaVida/db/enigmas/tim-teste.mjs                 (todas)
//   node jogoDaVida/db/enigmas/tim-teste.mjs --fase 17-26   (só uma faixa)
// Os dois arquivos são scripts de navegador; no Node (projeto "type": "module")
// eles se registram em globalThis, igual fariam em window.
await import('./tim-fisica.js');
await import('./tim-niveis.js');
const F = globalThis.TimFisica, NIVEIS = globalThis.TIM_NIVEIS;

const faixa = (a, b, p) => { const r = []; for (let v = a; v <= b; v += p) r.push(v); return r; };
const ok = (n, pecas) => F.simular(n, pecas).resolvido;
// --fase N ou --fase A-B: verifica só essas fases (a suíte inteira demora bastante)
const argFase = process.argv.includes('--fase') ? process.argv[process.argv.indexOf('--fase') + 1] : null;
const [faseDe, faseAte] = !argFase ? [1, Infinity] : argFase.includes('-') ? argFase.split('-').map(Number) : [Number(argFase), Number(argFase)];
const quer = n => n >= faseDe && n <= faseAte;
let falhas = 0;
const relato = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) falhas++; };

// 1 — Sopro certeiro: ventilador (com bateria) na laje, atrás da bola
if (quer(1)) {
    const n = NIVEIS[0];
    console.log('1. ' + n.titulo);
    relato(!ok(n, []), 'sem peças não resolve');
    const boas = faixa(50, 100, 10).filter(x => ok(n, [{ tipo: 'ventilador', x, y: 190, dir: 1, ligado: true }]));
    relato(boas.length > 0, `ventilador ligado resolve em x = ${boas.join(', ') || '—'}`);
    relato(!faixa(50, 100, 10).some(x => ok(n, [{ tipo: 'ventilador', x, y: 190, dir: 1, ligado: false }])), 'ventilador sem bateria não resolve');
}

// 2 — Por cima do muro: rampa + trampolim
if (quer(2)) {
    const n = NIVEIS[1];
    console.log('2. ' + n.titulo);
    relato(!ok(n, []), 'sem peças não resolve');
    let achou = null, total = 0;
    for (const ang of [15, 30, 45]) for (const rx of faixa(60, 200, 20)) for (const ry of faixa(80, 300, 20)) {
        for (const tx of faixa(120, 300, 20)) for (const ty of [370, 380]) {
            if (ok(n, [{ tipo: 'rampa', x: rx, y: ry, ang }, { tipo: 'trampolim', x: tx, y: ty }])) {
                total++; if (!achou) achou = { rampa: { x: rx, y: ry, ang }, trampolim: { x: tx, y: ty } };
            }
        }
    }
    relato(total > 0, `rampa + trampolim resolvem (${total} combinações), ex.: ${JSON.stringify(achou)}`);
    const soRampa = faixa(60, 200, 20).some(rx => faixa(80, 300, 20).some(ry => [15, 30, 45].some(ang => ok(n, [{ tipo: 'rampa', x: rx, y: ry, ang }]))));
    relato(!soRampa, 'só a rampa não resolve');
}

// 3 — Balão preso: ventilador (com bateria) + rampa como "teto guia"
if (quer(3)) {
    const n = NIVEIS[2];
    console.log('3. ' + n.titulo);
    relato(!ok(n, []), 'sem peças não resolve');
    let achou = null, total = 0, soVentilador = 0;
    for (const fx of faixa(50, 110, 20)) for (const fy of faixa(200, 370, 20)) {
        const fan = { tipo: 'ventilador', x: fx, y: fy, dir: 1, ligado: true };
        if (ok(n, [fan])) { soVentilador++; continue; }
        for (const ang of [-15, -30, -45]) for (const rx of faixa(300, 460, 20)) for (const ry of faixa(160, 360, 20)) {
            if (ok(n, [fan, { tipo: 'rampa', x: rx, y: ry, ang }])) {
                total++; if (!achou) achou = { ventilador: { x: fx, y: fy }, rampa: { x: rx, y: ry, ang } };
            }
        }
    }
    relato(total > 0, `ventilador + rampa resolvem (${total} combinações), ex.: ${JSON.stringify(achou)}`);
    relato(soVentilador === 0, 'só o ventilador não resolve (a rampa é necessária)');
}

// 4 — A roda do rato (reação em cadeia): a bola 1 cai na gaiola do rato 1, que
// pela correia move a esteira 1; ela leva a bola 2 até o rato 2 → esteira 2 →
// bola 3 → rato 3 → esteira 3, que derruba a bola de basquete no cano até o cesto.
// As rampas da caixa são sobra (como no original) e não entram na solução.
if (quer(4)) {
    const n = NIVEIS[3];
    console.log('4. ' + n.titulo);
    const rato = (id, x, y) => ({ tipo: 'rato', id, x, y });
    const correia = (id, de, para) => ({ tipo: 'correia', id, de, para });
    const R = [rato('r1', 40, 310), rato('r2', 200, 310), rato('r3', 330, 220)];
    const C = [correia('c1', 'r1', 'e1'), correia('c2', 'r2', 'e2'), correia('c3', 'r3', 'e3')];

    relato(!ok(n, []), 'sem peças não resolve');
    relato(ok(n, [...R, ...C]), '3 ratos + 3 correias resolvem');
    relato(!ok(n, R), 'ratos sem correia não resolvem');
    relato([0, 1, 2].every(i => !ok(n, [...R.filter((_, j) => j !== i), ...C])), 'faltando qualquer um dos ratos não resolve');
    relato([0, 1, 2].every(i => !ok(n, [...R, ...C.filter((_, j) => j !== i)])), 'faltando qualquer uma das correias não resolve');
    relato(!ok(n, [...R, correia('c1', 'r1', 'e2'), correia('c2', 'r2', 'e1'), C[2]]), 'correias ligadas nas esteiras erradas não resolvem');
    const longe = rato('r3', 330, 380);   // gaiola no chão: correia até a esteira 3 passa do limite
    relato(F.pontasCorreia(C[2], [...n.fixas, longe]).comprimento > F.CORREIA_MAX && !ok(n, [R[0], R[1], longe, ...C]),
        'correia mais comprida que o limite fica frouxa e não transmite');

    // tolerância: cada rato mexido pela grade, com os outros na posição boa
    const grades = [[faixa(10, 80, 10), faixa(280, 370, 10)], [faixa(170, 240, 10), faixa(280, 340, 10)], [faixa(300, 370, 10), faixa(190, 250, 10)]];
    const posicoes = grades.map(([xs, ys], i) => {
        let boas = 0;
        for (const x of xs) for (const y of ys) if (ok(n, [...R.map((r, j) => j === i ? rato(r.id, x, y) : r), ...C])) boas++;
        return boas;
    });
    relato(posicoes.every(v => v >= 10), `cada rato funciona em várias posições (${posicoes.join(' / ')})`);
}

// 5 — Foles e bexigas: a bexiga da esquerda estoura sozinha (bola de tênis fixa
// no fole fixo, tesoura fixa); a de cima precisa de um fole soprando ela contra a
// engrenagem (que gira porque a bola de boliche cai na gaiola do rato); a de baixo
// precisa de fole + tesoura. Peças encavaladas em bolas/bexigas não valem.
if (quer(5)) {
    const n = NIVEIS[4];
    console.log('5. ' + n.titulo);
    const valida = p => !p.some(q => F.sobrepoe(q, n, p));
    const foleC = { tipo: 'fole', x: 450, y: 104, dir: -1 }, bolaC = { tipo: 'basquete', x: 450, y: 60 };
    const tes = { tipo: 'tesoura', x: 440, y: 323, dir: 1 };
    const foleB = { tipo: 'fole', x: 560, y: 324, dir: -1 }, bolaB = { tipo: 'tenis', x: 560, y: 280 };
    const sol = [foleC, bolaC, tes, foleB, bolaB];

    relato(!ok(n, []), 'sem peças não resolve (só a bexiga da esquerda estoura)');
    relato(valida(sol) && ok(n, sol), '2 foles + 2 bolas + tesoura resolvem');
    relato(sol.every((_, i) => !ok(n, sol.filter((__, j) => j !== i))), 'faltando qualquer uma das 5 peças não resolve');
    relato(ok(n, [foleC, { ...bolaB, x: 450, y: 60 }, tes, foleB, { ...bolaC, x: 560, y: 280 }]), 'tanto faz qual bola vai em qual fole');
    const girados = [{ ...foleC, dir: 1, ang: 180 }, bolaC, { ...tes, ang: 90 }, { ...foleB, dir: 1, ang: 180 }, bolaB];
    relato(valida(girados) && ok(n, girados), 'foles girados 180° (em vez de invertidos) e tesoura girada 90° também resolvem');
    relato(!ok(n, [foleC, bolaC, tes, { ...foleB, dir: 1, ang: -90 }, bolaB]), 'fole de baixo apontado para cima não resolve');
    const n2 = { ...n, fixas: n.fixas.filter(p => p.tipo !== 'correia') };
    relato(!ok(n2, sol), 'engrenagem parada (sem a correia do rato) não estoura a bexiga de cima');
    let atalhos = 0;
    for (const x of faixa(380, 600, 10)) for (const y of faixa(280, 380, 10)) {
        const p = [foleC, bolaC, { tipo: 'tesoura', x, y, dir: 1 }, bolaB];
        if (valida(p) && ok(n, p)) atalhos++;
    }
    relato(atalhos === 0, 'tesoura encostada na bexiga parada (sem fole embaixo) não estoura');

    const conta = gerar => { let boas = 0, total = 0; for (const p of gerar()) { if (!valida(p)) continue; total++; if (ok(n, p)) boas++; } return `${boas}/${total}`; };
    const posC = conta(function* () { for (const x of faixa(420, 520, 10)) for (const y of faixa(90, 120, 10)) yield [{ ...foleC, x, y }, { ...bolaC, x, y: y - 44 }, tes, foleB, bolaB]; });
    const posB = conta(function* () { for (const x of faixa(520, 620, 10)) for (const y of faixa(310, 340, 10)) yield [foleC, bolaC, tes, { ...foleB, x, y }, { ...bolaB, x, y: y - 44 }]; });
    const posT = conta(function* () { for (const x of faixa(380, 460, 10)) for (const y of faixa(300, 350, 10)) yield [foleC, bolaC, { ...tes, x, y }, foleB, bolaB]; });
    relato([posC, posB, posT].every(s => Number(s.split('/')[0]) >= 10), `fole de cima, fole de baixo e tesoura funcionam em várias posições (${posC} · ${posB} · ${posT})`);
}

// 6 — Espelho: o lado esquerdo já funciona sozinho; no direito o jogador monta a
// gaiola + bola de basquete + correia, e a gaiola precisa estar ESPELHADA (a roda
// gira ao contrário e a esteira leva a bola para a esquerda, até o cano).
if (quer(6)) {
    const n = NIVEIS[5];
    console.log('6. ' + n.titulo);
    const valida = p => !p.some(q => F.sobrepoe(q, n, p));
    const monta = (espelho, x = 545, y = 150, ang = 0) => [
        { tipo: 'rato', id: 'p1', x, y, ang, espelho }, { tipo: 'basquete', x, y: y - 40 }, { tipo: 'correia', id: 'c2', de: 'p1', para: 'e2' }];
    relato(!ok(n, []), 'sem peças não resolve (só a bola da esquerda cai no cano)');
    relato(valida(monta(true)) && ok(n, monta(true)), 'gaiola espelhada + bola + correia resolvem');
    relato(!ok(n, monta(false)), 'gaiola sem espelhar leva a bola para o lado errado');
    relato(!ok(n, monta(false, 545, 150, 180)), 'girar 180° não substitui espelhar (a roda continua girando no mesmo sentido)');
    relato(!ok(n, monta(true).slice(0, 2)), 'sem a correia não resolve');
    relato(!ok(n, [monta(true)[0], monta(true)[2]]), 'sem a bola de basquete o rato não corre');
    let soBola = 0;
    for (const x of faixa(300, 630, 20)) for (const y of faixa(20, 230, 20)) { const p = [{ tipo: 'basquete', x, y }]; if (valida(p) && ok(n, p)) soBola++; }
    relato(soBola === 0, 'só a bola de basquete (sem rato) não empurra a bola de boliche para o cano');
    let boas = 0, total = 0;
    for (const x of faixa(520, 570, 10)) for (const y of faixa(130, 160, 10)) {
        const p = monta(true, x, y); if (!valida(p)) continue; total++; if (ok(n, p)) boas++;
    }
    relato(boas >= 10, `a gaiola funciona em várias posições dentro da caixa (${boas}/${total})`);
    relato([{ gravidade: 0.17 }, { gravidade: 2.5 }, { ar: 0 }, { ar: 3 }].every(a => F.simular(n, monta(true), a).resolvido),
        'continua resolvendo na Lua, em Júpiter, no vácuo e com ar denso');
}

// Fases 7 a 16: cada uma resolve com a montagem de referência (só posições da grade,
// sem encavalar), não resolve sem peças, e cada peça da montagem é necessária.
function fase(i, solucao, extras = {}) {
    if (!quer(i + 1)) return;
    const n = NIVEIS[i];
    console.log(`${i + 1}. ${n.titulo}`);
    const valida = p => !p.some(q => F.sobrepoe(q, n, p));
    relato(!ok(n, []), 'sem peças não resolve');
    relato(valida(solucao) && ok(n, solucao), 'a montagem de referência resolve');
    // a interface encaixa as peças na grade de 10 px: a solução precisa ser montável de verdade
    relato(solucao.every(p => p.x == null || (p.x % 10 === 0 && p.y % 10 === 0)), 'as peças da montagem estão na grade de 10 px');
    // a caixa tem exatamente as peças da montagem (fio/correia/bateria contam como peças)
    const conta = {};
    for (const p of solucao) conta[p.tipo] = (conta[p.tipo] || 0) + 1;
    for (const p of solucao) if (p.ligado) conta.bateria = (conta.bateria || 0) + 1;
    relato(Object.entries(n.caixa).every(([t, q]) => conta[t] === q) && Object.keys(conta).every(t => n.caixa[t]), 'a montagem usa exatamente as peças da caixa');
    const presas = p => solucao.filter(q => (q.tipo === 'correia' || q.tipo === 'fio') && (q.de === p.id || q.para === p.id));
    const faltando = solucao.filter(p => p.tipo !== 'correia' && p.tipo !== 'fio').map(p => solucao.filter(q => q !== p && !presas(p).includes(q)))
        .concat(solucao.filter(p => p.tipo === 'correia' || p.tipo === 'fio').map(p => solucao.filter(q => q !== p)));
    relato(faltando.every(p => !ok(n, p)), 'faltando qualquer peça não resolve');
    for (const [msg, cond] of Object.entries(extras)) relato(cond(n, valida), msg);
}
const contaBoas = (n, valida, gerar) => { let boas = 0; for (const p of gerar()) if (valida(p) && ok(n, p)) boas++; return boas; };

fase(6, [{ tipo: 'gangorra', x: 140, y: 370, espelho: true }, { tipo: 'gangorra', x: 510, y: 370, espelho: true }], {
    'gangorra sem espelhar (tênis voa para o lado errado) não resolve': n => !ok(n, [{ tipo: 'gangorra', x: 140, y: 370, espelho: true }, { tipo: 'gangorra', x: 510, y: 370 }]),
    'a gangorra da direita funciona em mais de uma posição': (n, v) => contaBoas(n, v, function* () {
        for (let x = 450; x <= 560; x += 10) for (const y of [360, 370]) yield [{ tipo: 'gangorra', x: 140, y: 370, espelho: true }, { tipo: 'gangorra', x, y, espelho: true }];
    }) >= 2,
});
fase(7, [{ tipo: 'luva', x: 500, y: 140, dir: -1 }, { tipo: 'gangorra', x: 250, y: 370 }], {
    'luva virada para o lado errado não resolve': n => !ok(n, [{ tipo: 'luva', x: 500, y: 140, dir: 1 }, { tipo: 'gangorra', x: 250, y: 370 }]),
    'gangorra espelhada (beisebol voa para a direita) não resolve': n => !ok(n, [{ tipo: 'luva', x: 500, y: 140, dir: -1 }, { tipo: 'gangorra', x: 250, y: 370, espelho: true }]),
});
{
    const T = (x, y, ang) => ({ tipo: 'trampolim', x, y, ang });
    fase(8, [T(50, 380, 10), T(270, 370, 5), T(380, 370, 5)], {
        'o último trampolim funciona em várias posições': (n, v) => contaBoas(n, v, function* () {
            for (let x = 350; x <= 470; x += 10) for (const y of [370, 380]) for (let a = -20; a <= 10; a += 5) yield [T(50, 380, 10), T(270, 370, 5), T(x, y, a)];
        }) >= 10,
        'um trampolim só, em qualquer lugar, não resolve': (n, v) => contaBoas(n, v, function* () {
            for (let x = 40; x <= 600; x += 20) for (let y = 140; y <= 380; y += 20) for (let a = -60; a <= 60; a += 10) yield [T(x, y, a)];
        }) === 0,
    });
}
{
    const sol = [
        { tipo: 'moinho', id: 'm1', x: 170, y: 320 }, { tipo: 'correia', id: 'c1', de: 'm1', para: 'g1' },
        { tipo: 'moinho', id: 'm2', x: 500, y: 360 }, { tipo: 'correia', id: 'c2', de: 'm2', para: 'g2' },
        { tipo: 'ventilador', id: 'v1', x: 420, y: 340, dir: 1, ligado: true },
    ];
    fase(9, sol, {
        'ventilador sem bateria não gira o moinho': n => !ok(n, sol.map(p => p.tipo === 'ventilador' ? { ...p, ligado: false } : p)),
        'no vácuo não há vento: o moinho não gira': n => !F.simular(n, sol, { ar: 0 }).resolvido,
    });
}
{
    const sol = [
        { tipo: 'rampa', x: 70, y: 340, ang: 20, len: 120 },
        { tipo: 'interruptor', id: 'i1', x: 480, y: 380 },
        { tipo: 'ventilador', id: 'v1', x: 610, y: 270, dir: -1 }, { tipo: 'ventilador', id: 'v2', x: 420, y: 180, dir: -1 },
        { tipo: 'fio', id: 'f1', de: 'i1', para: 'v1' }, { tipo: 'fio', id: 'f2', de: 'i1', para: 'v2' },
    ];
    fase(10, sol, {
        'ventiladores virados para a direita não resolvem': n => !ok(n, sol.map(p => p.tipo === 'ventilador' ? { ...p, dir: 1 } : p)),
        'fio comprido demais (interruptor longe) fica solto': n => {
            const longe = sol.map(p => p.tipo === 'interruptor' ? { ...p, x: 60 } : p);
            return F.pontasCorreia(longe[4], [...n.fixas, ...longe]).comprimento > F.FIO_MAX && !ok(n, longe);
        },
        'os ventiladores funcionam em várias posições': (n, v) => contaBoas(n, v, function* () {
            for (let x = 590; x <= 620; x += 10) for (let y = 260; y <= 290; y += 10) for (let x2 = 410; x2 <= 460; x2 += 10) for (let y2 = 170; y2 <= 200; y2 += 10)
                yield [sol[0], sol[1], { ...sol[2], x, y }, { ...sol[3], x: x2, y: y2 }, sol[4], sol[5]];
        }) >= 30,
    });
}
{
    const sol = [{ tipo: 'rampa', x: 140, y: 300, ang: 20, len: 120 }, { tipo: 'fio', id: 'f1', de: 'i1', para: 'l1' }, { tipo: 'lupa', x: 490, y: 220 }];
    fase(11, sol, {
        'lupa fora do facho não acende a dinamite': n => !ok(n, [sol[0], sol[1], { tipo: 'lupa', x: 490, y: 260 }]),
        'lupa longe demais (foco antes da dinamite) não acende': n => !ok(n, [sol[0], sol[1], { tipo: 'lupa', x: 400, y: 220 }]),
    });
}
{
    const mk = (cx, cy, ang) => [
        { tipo: 'interruptor', id: 'i1', x: 40, y: 380 }, { tipo: 'lanterna', id: 'l1', x: cx - 140, y: cy, dir: 1 },
        { tipo: 'fio', id: 'f1', de: 'i1', para: 'l1' }, { tipo: 'lupa', x: cx - 70, y: cy }, { tipo: 'canhao', x: cx, y: cy, dir: 1, ang },
    ];
    fase(12, mk(200, 200, -45), {
        'canhão na horizontal acerta o muro': n => !ok(n, mk(200, 200, 0)),
        'há várias miras que funcionam': (n, v) => contaBoas(n, v, function* () {
            for (let cx = 160; cx <= 280; cx += 20) for (let cy = 200; cy <= 370; cy += 30) for (let a = -70; a <= -20; a += 5) yield mk(cx, cy, a);
        }) >= 5,
    });
}
{
    const D = (x, y) => ({ tipo: 'dinamite', x, y });
    const sol = [{ tipo: 'lupa', x: 260, y: 250 }, D(330, 250), D(250, 190), D(410, 320)];
    fase(13, sol, {
        'duas dinamites (uma no foco) não quebram os dois caixotes': (n, v) => contaBoas(n, v, function* () {
            for (let lx = 100; lx <= 560; lx += 20) for (let x = 150; x <= 620; x += 20) for (let y = 40; y <= 380; y += 20)
                yield [{ tipo: 'lupa', x: lx, y: 250 }, D(lx + 70, 250), D(x, y)];
        }) === 0,
    });
}
{
    const E = (id, x, y, ang = -35, dir = 1) => ({ tipo: 'esteira', id, x, y, ang, dir });
    const C = (id, de, para) => ({ tipo: 'correia', id, de, para });
    const sol = [E('e1', 140, 330), E('e2', 250, 260), E('e3', 360, 190), C('c1', 'r1', 'e1'), C('c2', 'r2', 'e2'), C('c3', 'r3', 'e3')];
    fase(14, sol, {
        'esteira andando para o lado errado não sobe': n => !ok(n, sol.map(p => p.id === 'e2' ? { ...p, dir: -1 } : p)),
        'esteiras deitadas (sem inclinar) não sobem o morro': n => !ok(n, sol.map(p => p.tipo === 'esteira' ? { ...p, ang: 0 } : p)),
    });
}
{
    const sol = [
        { tipo: 'luva', x: 140, y: 140, dir: 1 }, { tipo: 'gangorra', x: 390, y: 370, espelho: true },
        { tipo: 'fio', id: 'f1', de: 'i1', para: 'v1' }, { tipo: 'fio', id: 'f2', de: 'i1', para: 'l1' },
        { tipo: 'moinho', id: 'm1', x: 520, y: 270 }, { tipo: 'correia', id: 'c1', de: 'm1', para: 'g1' },
        { tipo: 'lupa', x: 310, y: 330 },
    ];
    fase(15, sol, {
        'o moinho funciona em várias posições no vento': (n, v) => contaBoas(n, v, function* () {
            for (let x = 480; x <= 600; x += 10) for (let y = 250; y <= 290; y += 10) yield [...sol.slice(0, 4), { ...sol[4], x, y }, ...sol.slice(5)];
        }) >= 20,
    });
}

// Fases 17 em diante (lote 1 dos outros desafios do TIM original): montagem de referência
// de cada uma; o helper fase() confere sem peças, a solução, a caixa e cada peça necessária.
fase(16, [   // Uma bola em cada pote
    { tipo: 'gangorra', x: 270, y: 370 },
    { tipo: 'gangorra', x: 370, y: 370, espelho: true },
]);
fase(17, [   // Anel de fogo
    { tipo: 'rampa', x: 90, y: 300, ang: 20, len: 120 },
    { tipo: 'lupa', x: 300, y: 320 },
]);
fase(18, [   // Derrube-a
    { tipo: 'esteira', id: 'e1', x: 150, y: 160, dir: 1, ang: 0 },
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
    { tipo: 'rampa', x: 370, y: 100, ang: 30, len: 120 },
]);
fase(19, [   // Guardar as bolas de basquete
    { tipo: 'esteira', id: 'e1', x: 540, y: 200, ang: 0, dir: -1 },
    { tipo: 'rato', id: 'r1', x: 420, y: 250 },
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
    { tipo: 'rampa', x: 450, y: 300, ang: -30, len: 120 },
]);
fase(20, [   // Disparar o canhão
    { tipo: 'esteira', id: 'e1', x: 160, y: 130, dir: 1, ang: 0 },
    { tipo: 'rato', id: 'r1', x: 340, y: 120 },
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
]);
fase(21, [   // Uiiii!
    { tipo: 'rampa', len: 120, x: 70, y: 200, ang: 30 },
    { tipo: 'trampolim', x: 180, y: 330, ang: -25 },
]);
fase(22, [   // Quica, quica, quica
    { tipo: 'trampolim', x: 600, y: 370, ang: -15 },
    { tipo: 'trampolim', x: 420, y: 290, ang: -10 },
]);
fase(23, [   // Dentro das paredes
    { tipo: 'esteira', id: 'e1', x: 320, y: 130, ang: 0, dir: 1 },
    { tipo: 'moinho', id: 'm1', x: 220, y: 270 },
    { tipo: 'correia', id: 'c1', de: 'm1', para: 'e1' },
    { tipo: 'trampolim', x: 420, y: 290, ang: -15 },
]);
fase(24, [   // Exercitar os quatro ratos
    { tipo: 'rampa', x: 260, y: 300, ang: -20, len: 120 },
    { tipo: 'gangorra', x: 400, y: 370, espelho: true },
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
    { tipo: 'correia', id: 'c2', de: 'r2', para: 'e2' },
]);
fase(25, [   // Meio fora de ordem
    { tipo: 'rampa', x: 80, y: 80, ang: 10, len: 120 },
    { tipo: 'rampa', x: 220, y: 80, ang: 25, len: 120 },
    { tipo: 'rampa', x: 120, y: 300, ang: 30, len: 120 },
]);

// Lote 2: revólver, caixa-surpresa e detonador.
fase(26, [   // Bexigas em perigo
    { tipo: 'balao', x: 320, y: 170 },
    { tipo: 'balao', x: 320, y: 320 },
]);
fase(27, [   // Fazendo umas explosões
    { tipo: 'gangorra', x: 100, y: 370, espelho: true },
    { tipo: 'dinamite', id: 'x1', x: 540, y: 160 },
    { tipo: 'dinamite', id: 'x2', x: 540, y: 290 },
    { tipo: 'fio', id: 'f1', de: 'd1', para: 'x1' },
    { tipo: 'fio', id: 'f2', de: 'd1', para: 'x2' },
]);
fase(28, [   // Estourando bexigas na Lua
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'g1' },
    { tipo: 'arma', x: 440, y: 80, dir: -1 },
    { tipo: 'tesoura', x: 540, y: 200, dir: 1, ang: 90 },
]);
fase(29, [   // João diz: Oi, Bob!
    { tipo: 'surpresa', id: 'j1', x: 180, y: 360, ang: 10 },
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'j1' },
    { tipo: 'correia', id: 'c2', de: 'r2', para: 'j2' },
]);
fase(30, [   // Explodir tudo
    { tipo: 'arma', x: 70, y: 200, dir: 1 },
    { tipo: 'arma', x: 440, y: 330, dir: 1 },
]);
fase(31, [   // Tiro ao alvo
    { tipo: 'arma', x: 90, y: 140, dir: 1 },
    { tipo: 'arma', x: 500, y: 300, dir: -1 },
]);
fase(32, [   // Salva de cinco tiros
    { tipo: 'arma', x: 250, y: 130, dir: 1 },
    { tipo: 'arma', x: 230, y: 250, dir: -1 },
]);

// Lote 3: eletricidade (tomada, gerador, motor, painel solar, lâmpada) e engrenagens encostadas.
fase(33, [   // Sorria!
    { tipo: 'trampolim', x: 130, y: 330, ang: 15 },
    { tipo: 'fio', id: 'f1', de: 'i1', para: 'mt' },
    { tipo: 'correia', id: 'c1', de: 'mt', para: 'gs' },
]);
fase(34, [   // Indo para o buraco
    { tipo: 'rampa', x: 60, y: 150, ang: 40, len: 120 },
    { tipo: 'interruptor', id: 'i1', x: 330, y: 380 },
    { tipo: 'fio', id: 'f1', de: 'i1', para: 'v1' },
]);
fase(35, [   // Bola curtinha
    { tipo: 'painel', id: 'p1', x: 260, y: 290 },
    { tipo: 'fio', id: 'f1', de: 'p1', para: 'v1' },
    { tipo: 'ventilador', id: 'v1', x: 360, y: 320, dir: 1 },
]);
fase(36, [   // Geradores e motores
    { tipo: 'moinho', id: 'm1', x: 200, y: 320 },
    { tipo: 'gerador', id: 'g1', x: 280, y: 370 },
    { tipo: 'correia', id: 'c1', de: 'm1', para: 'g1' },
    { tipo: 'fio', id: 'f1', de: 'g1', para: 'mt' },
    { tipo: 'correia', id: 'c2', de: 'mt', para: 'e1' },
]);
fase(37, [   // Pondo as engrenagens em movimento
    { tipo: 'painel', id: 'p1', x: 300, y: 200, ang: 90 },
    { tipo: 'fio', id: 'f1', de: 'p1', para: 'mt' },
    { tipo: 'engrenagem', id: 'g1', x: 410, y: 300, r: 22 },
    { tipo: 'engrenagem', id: 'g2', x: 450, y: 270, r: 22 },
]);
fase(38, [   // Pop! vai a doninha
    { tipo: 'engrenagem', id: 'g1', x: 180, y: 270, r: 22 },
    { tipo: 'correia', id: 'c1', de: 'g1', para: 'gb' },
    { tipo: 'engrenagem', id: 'g2', x: 360, y: 270, r: 22 },
    { tipo: 'correia', id: 'c2', de: 'g2', para: 'j1' },
]);

// Lote 4: vela e foguete (e lâmpada + lupa).
fase(39, [   // Dez, nove, oito... ignição!
    { tipo: 'gangorra', x: 110, y: 370, espelho: true },
    { tipo: 'trampolim', x: 370, y: 260, ang: 20 },
]);
fase(40, [   // Lançar todos os foguetes
    { tipo: 'rampa', x: 70, y: 300, ang: 25, len: 120 },
    { tipo: 'lupa', x: 270, y: 250 },
    { tipo: 'lupa', x: 370, y: 250 },
]);
fase(41, [   // Decolagem
    { tipo: 'foguete', x: 420, y: 290 },
    { tipo: 'vela', x: 440, y: 300 },
    { tipo: 'lupa', x: 370, y: 300 },
]);
fase(42, [   // Pop, pop, pop, pop e... pop!
    { tipo: 'vela', x: 200, y: 260 },
    { tipo: 'lupa', x: 130, y: 260 },
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
]);
fase(43, [   // Alerta vermelho!
    { tipo: 'lupa', x: 250, y: 180 },
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
    { tipo: 'rampa', x: 90, y: 280, ang: 20, len: 120 },
]);
fase(44, [   // Para o alto e avante!
    { tipo: 'esteira', id: 'e1', x: 150, y: 160, dir: 1, ang: 0 },
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
    { tipo: 'gangorra', x: 330, y: 370, espelho: true },
]);
fase(45, [   // Acenda meu fogo
    { tipo: 'engrenagem', id: 'g1', x: 170, y: 330, r: 22 },
    { tipo: 'lupa', x: 570, y: 180 },
]);

// Lotes 5–6: corda, polia, balde, gancho (tesoura acionada corta corda; chama queima).
fase(46, [   // Salve as bexigas
    { tipo: 'corda', id: 'k1', de: 'b1', para: 'b2', polias: ['q1'] },
    { tipo: 'corda', id: 'k2', de: 'b3', para: 'b4', polias: ['q2'] },
]);
fase(47, [   // Bang, bang, bang
    { tipo: 'corda', id: 'k1', de: 'm1', para: 'a2' },
    { tipo: 'corda', id: 'k2', de: 'm2', para: 'a3' },
]);
fase(48, [   // Desça todos os baldes
    { tipo: 'tesoura', x: 170, y: 120, dir: -1, ang: 0 },
    { tipo: 'rampa', x: 340, y: 100, ang: 20, len: 120 },
    { tipo: 'tesoura', x: 440, y: 120, dir: 1, ang: 0 },
]);
fase(49, [   // Soque o balde
    { tipo: 'gangorra', x: 120, y: 370, espelho: true },
    { tipo: 'luva', x: 410, y: 250, dir: 1 },
]);
fase(50, [   // Pesando a situação
    { tipo: 'polia', id: 'q1', x: 200, y: 50 },
    { tipo: 'corda', id: 'k1', de: 'bA', para: 'bB', polias: ['q1', 'h1'] },
    { tipo: 'rampa', x: 100, y: 80, ang: 20, len: 120 },
]);
fase(51, [   // Estoure duas bexigas
    { tipo: 'polia', id: 'q1', x: 300, y: 370 },
    { tipo: 'corda', id: 'k1', de: 'b1', para: 'w1', polias: ['q1', 'h1'] },
    { tipo: 'corda', id: 'k2', de: 'b2', para: 'w2', polias: ['q1', 'h2'] },
]);
fase(52, [   // Busque o balde
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
    { tipo: 'correia', id: 'c2', de: 'r2', para: 'e2' },
    { tipo: 'tesoura', x: 90, y: 100, dir: -1, ang: 0 },
]);
fase(53, [   // Feliz segundo aniversário
    { tipo: 'trampolim', x: 60, y: 330, ang: 5 },
    { tipo: 'luva', x: 480, y: 170, dir: 1 },
]);
fase(54, [   // Desça o balde
    { tipo: 'painel', id: 'p1', x: 330, y: 100 },
    { tipo: 'fio', id: 'f1', de: 'p1', para: 'mt' },
    { tipo: 'correia', id: 'c1', de: 'mt', para: 'e1' },
]);
fase(55, [   // Lançando luz
    { tipo: 'corda', id: 'k2', de: 'L2', para: 'g1', pontaPara: 1 },
    { tipo: 'corda', id: 'k1', de: 'L1', para: 'm2' },
    { tipo: 'corda', id: 'k3', de: 'L3', para: 'm3' },
    { tipo: 'corda', id: 'k4', de: 'L4', para: 'm4', polias: ['h3'] },
]);
fase(56, [   // O poço de madeira
    { tipo: 'tesoura', x: 220, y: 360, dir: -1, ang: 0 },
    { tipo: 'moinho', id: 'mo', x: 120, y: 80 },
    { tipo: 'correia', id: 'c1', de: 'mo', para: 'gr' },
    { tipo: 'fio', id: 'f1', de: 'gr', para: 'mt' },
]);

// Lote 7: personagens (Mort, Pokey, Bob no aquário, Kelly na bicicleta, gaiola).
fase(57, [   // Mandando o Mort para casa
    { tipo: 'rampa', x: 220, y: 360, ang: 30, len: 120 },
]);
fase(58, [   // Ajude o Pokey a voltar para casa
    { tipo: 'aquario', id: 'iscar', x: 600, y: 320 },
    { tipo: 'rampa', x: 400, y: 320, ang: -25, len: 120 },
]);
fase(59, [   // Ponha o Mort na prisão
    { tipo: 'tesoura', x: 310, y: 150, dir: -1, ang: 0 },
]);
fase(60, [   // Quebre o aquário do Bob
    { tipo: 'luva', x: 120, y: 190, dir: 1 },
    { tipo: 'lupa', x: 430, y: 190 },
]);
fase(61, [   // Duelo no aquário
    { tipo: 'boliche', id: 's1', x: 180, y: 370 },
    { tipo: 'balde', id: 's2', x: 460, y: 370 },
]);
fase(62, [   // Liberte o pobre Pokey
    { tipo: 'rampa', x: 100, y: 70, ang: 15, len: 120 },
]);
fase(63, [   // Gato-pulta
    { tipo: 'gangorra', x: 270, y: 370 },
]);
fase(64, [   // Negócio de macaco
    { tipo: 'corda', id: 'k1', de: 'gl', para: 'kelly', polias: ['q1'] },
]);
fase(65, [   // Prenda o gato Pokey
    { tipo: 'tesoura', x: 260, y: 370, dir: -1, ang: 0 },
]);
fase(66, [   // Tire o Mort da caixa
    { tipo: 'dinamite', id: 'x1', x: 250, y: 360 },
    { tipo: 'fio', id: 'f1', de: 'd1', para: 'x1' },
]);
fase(67, [   // Salve o Mort do gato
    { tipo: 'esteira', id: 'e1', x: 410, y: 340, ang: -55, dir: 1 },
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
]);
fase(68, [   // Um rato em casa
    { tipo: 'ventilador', id: 'v1', x: 610, y: 310, dir: -1, ang: -10 },
    { tipo: 'fio', id: 'f1', de: 'i1', para: 'v1' },
]);
fase(69, [   // Gira, gira, gira... pop, pop, pop
    { tipo: 'engrenagem', id: 'p1', x: 200, y: 280, r: 22 },
    { tipo: 'correia', id: 'c1', de: 'g1', para: 'g2' },
    { tipo: 'engrenagem', id: 'p2', x: 440, y: 300, r: 22 },
]);
fase(70, [   // Basquete na Lua
    { tipo: 'surpresa', id: 'j1', x: 230, y: 370, ang: 25 },
    { tipo: 'correia', id: 'c1', de: 'kelly', para: 'j1' },
]);
fase(71, [   // Exercite a macaca Kelly
    { tipo: 'foguete', id: 'fg', x: 50, y: 290, ang: 90 },
]);

// Lote 8: os desafios que juntam tudo (e os que tinham ficado para o fim).
fase(72, [   // Atravessando o vão
    { tipo: 'rampa', x: 240, y: 190, ang: 0, len: 120 },
    { tipo: 'rampa', x: 440, y: 200, ang: 0, len: 120 },
]);
fase(73, [   // Espante os ratos
    { tipo: 'pokey', id: 'gato', x: 320, y: 320 },
]);
fase(74, [   // Ponha a gaiola no buraco
    { tipo: 'tesoura', x: 210, y: 100, dir: -1, ang: 0 },
    { tipo: 'rampa', x: 240, y: 230, ang: 30, len: 120 },
]);
fase(75, [   // Ponha as bolas nos cestos
    { tipo: 'correia', id: 'k1', de: 'r1', para: 'e1' },
    { tipo: 'gangorra', x: 220, y: 370 },
]);
fase(76, [   // Salve o esquadrão do Bob
    { tipo: 'rampa', x: 150, y: 290, ang: -30, len: 120 },
    { tipo: 'boliche', id: 's1', x: 530, y: 370 },
]);
fase(77, [   // Trocando o aquário do Bob
    { tipo: 'rampa', x: 180, y: 130, ang: 15, len: 120 },
    { tipo: 'rampa', x: 320, y: 230, ang: 15, len: 120 },
]);
fase(78, [   // Salve o peixe Bob
    { tipo: 'dinamite', id: 'x1', x: 360, y: 240 },
    { tipo: 'fio', id: 'f1', de: 'd1', para: 'x1' },
]);
fase(79, [   // Juntando as bolas
    { tipo: 'correia', id: 'c1', de: 'r1', para: 'e1' },
    { tipo: 'trampolim', x: 70, y: 330, ang: 20 },
]);
fase(80, [   // Jogue um set
    { tipo: 'dinamite', id: 'x1', x: 210, y: 340 },
    { tipo: 'fio', id: 'f1', de: 'd1', para: 'x1' },
]);
fase(81, [   // Ratoeira
    { tipo: 'gangorra', x: 200, y: 370, espelho: true },
]);
fase(82, [   // Prenda o Mort
    { tipo: 'ventilador', id: 'v1', x: 140, y: 130, dir: 1 },
    { tipo: 'fio', id: 'f1', de: 'i1', para: 'v1' },
    { tipo: 'tesoura', x: 330, y: 140, dir: 1, ang: 0 },
]);
fase(83, [   // Removendo o padrão
    { tipo: 'balde', id: 'b1', x: 150, y: 370 },
    { tipo: 'balde', id: 'b2', x: 420, y: 370 },
    { tipo: 'balde', id: 'b3', x: 570, y: 370 },
]);
fase(84, [   // Abaixe a lança
    { tipo: 'lupa', x: 150, y: 270 },
    { tipo: 'tesoura', x: 420, y: 170, dir: 1, ang: 0 },
]);
fase(85, [   // Vida de pirata
    { tipo: 'lupa', x: 230, y: 230 },
    { tipo: 'dinamite', id: 'x1', x: 300, y: 230 },
]);
fase(86, [   // Derrubando o muro
    { tipo: 'corda', id: 'k1', de: 'lp', para: 'g1', pontaPara: 1 },
    { tipo: 'lupa', x: 330, y: 290 },
    { tipo: 'dinamite', id: 'd2', x: 380, y: 250 },
]);
fase(87, [   // Deixando a bola cair
    { tipo: 'arma', x: 190, y: 100, dir: 1 },
    { tipo: 'corda', id: 'k1', de: 'lp', para: 'bd' },
    { tipo: 'lupa', x: 250, y: 290 },
]);
fase(88, [   // Elimine as bexigas
    { tipo: 'correia', id: 'c1', de: 'kelly', para: 'g1' },
    { tipo: 'engrenagem', id: 'p1', x: 240, y: 260, r: 22 },
    { tipo: 'surpresa', id: 'j1', x: 420, y: 350 },
    { tipo: 'correia', id: 'c2', de: 'g2', para: 'j1' },
]);
fase(89, [   // Estoure todas as bexigas
    { tipo: 'gangorra', x: 80, y: 370, espelho: true },
    { tipo: 'correia', id: 'c1', de: 'kelly', para: 'g1' },
    { tipo: 'engrenagem', id: 'p1', x: 420, y: 250, r: 22 },
    { tipo: 'correia', id: 'c2', de: 'g2', para: 'e1' },
]);
fase(90, [   // Adeus às bexigas
    { tipo: 'ventilador', id: 'v1', x: 80, y: 130, dir: 1 },
    { tipo: 'fio', id: 'f1', de: 't1', para: 'v1' },
    { tipo: 'lupa', x: 340, y: 250 },
]);
fase(91, [   // Solte os fogos
    { tipo: 'fio', id: 'f1', de: 'i1', para: 'v1' },
    { tipo: 'moinho', id: 'mo', x: 220, y: 320 },
    { tipo: 'correia', id: 'c1', de: 'mo', para: 'gr' },
    { tipo: 'lupa', x: 330, y: 150 },
]);

// Soluções que o servidor entrega quando o jogador desiste (server/solucoes/enigma-105.json):
// toda fase tem uma, ela resolve, está na grade, não encavala e cabe na caixa.
{
    console.log('Soluções do "Desistir"');
    const SOL = JSON.parse(readFileSync(new URL('../../server/solucoes/enigma-105.json', import.meta.url), 'utf8'));
    const ruins = [];
    NIVEIS.forEach((n, i) => {
        const p = SOL[i + 1];
        if (!p) return ruins.push(`${i + 1} (sem solução)`);
        const conta = {};
        for (const q of p) { conta[q.tipo] = (conta[q.tipo] || 0) + 1; if (q.ligado) conta.bateria = (conta.bateria || 0) + 1; }
        const cabe = Object.entries(conta).every(([t, k]) => (n.caixa[t] || 0) >= k);
        const grade = p.every(q => q.x == null || (q.x % 10 === 0 && q.y % 10 === 0));
        if (!cabe || !grade || p.some(q => F.sobrepoe(q, n, p)) || !ok(n, p)) ruins.push(String(i + 1));
    });
    relato(ruins.length === 0, 'cada fase tem uma solução que resolve' + (ruins.length ? ` — falharam: ${ruins.join(', ')}` : ''));
}

// Painel de ambiente: o padrão (gravidade 1, ar 1) é exatamente a física sem ambiente
{
    console.log('Ambiente');
    const m1 = F.simular(NIVEIS[2], [{ tipo: 'ventilador', x: 50, y: 200, dir: 1, ligado: true }, { tipo: 'rampa', x: 320, y: 160, ang: -30 }]);
    const m2 = F.simular(NIVEIS[2], [{ tipo: 'ventilador', x: 50, y: 200, dir: 1, ligado: true }, { tipo: 'rampa', x: 320, y: 160, ang: -30 }], { gravidade: 1, ar: 1 });
    relato(m1.quadro === m2.quadro && m1.bola.x === m2.bola.x && m1.bola.y === m2.bola.y, 'gravidade 1 e ar 1 dão o mesmo resultado, quadro a quadro');
    const semGrav = F.criarMundo({ bola: { tipo: 'basquete', x: 100, y: 100 }, fixas: [], objetivo: { tipo: 'zona', x: 0, y: 0, w: 1, h: 1 } }, [], { gravidade: 0 });
    for (let i = 0; i < 60; i++) F.passo(semGrav);
    relato(semGrav.bola.y === 100, 'sem gravidade a bola fica parada no ar');
    const vacuo = F.criarMundo({ bola: { tipo: 'balao', x: 100, y: 200 }, fixas: [], objetivo: { tipo: 'zona', x: 0, y: 0, w: 1, h: 1 } }, [], { ar: 0 });
    for (let i = 0; i < 30; i++) F.passo(vacuo);
    relato(vacuo.bola.y > 200, 'no vácuo o balão cai em vez de subir');
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\nTodos os desafios verificados.');
process.exit(falhas ? 1 : 0);

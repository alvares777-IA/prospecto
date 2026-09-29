// Verifica os desafios do TIM por simulação (não é publicado em public/).
// Só usa posições que a interface permite (grade de 10 px), senão uma
// "solução" verificada poderia ser impossível de montar no jogo.
//   1) sem nenhuma peça do jogador, o desafio NÃO pode se resolver sozinho;
//   2) existe pelo menos uma forma de resolver com as peças da caixa;
//   3) ventilador sem bateria não resolve (a bateria é necessária).
//   node jogoDaVida/db/enigmas/tim-teste.mjs
// Os dois arquivos são scripts de navegador; no Node (projeto "type": "module")
// eles se registram em globalThis, igual fariam em window.
await import('./tim-fisica.js');
await import('./tim-niveis.js');
const F = globalThis.TimFisica, NIVEIS = globalThis.TIM_NIVEIS;

const faixa = (a, b, p) => { const r = []; for (let v = a; v <= b; v += p) r.push(v); return r; };
const ok = (n, pecas) => F.simular(n, pecas).resolvido;
let falhas = 0;
const relato = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) falhas++; };

// 1 — Sopro certeiro: ventilador (com bateria) na laje, atrás da bola
{
    const n = NIVEIS[0];
    console.log('1. ' + n.titulo);
    relato(!ok(n, []), 'sem peças não resolve');
    const boas = faixa(50, 100, 10).filter(x => ok(n, [{ tipo: 'ventilador', x, y: 190, dir: 1, ligado: true }]));
    relato(boas.length > 0, `ventilador ligado resolve em x = ${boas.join(', ') || '—'}`);
    relato(!faixa(50, 100, 10).some(x => ok(n, [{ tipo: 'ventilador', x, y: 190, dir: 1, ligado: false }])), 'ventilador sem bateria não resolve');
}

// 2 — Por cima do muro: rampa + trampolim
{
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
{
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
{
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
{
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
{
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

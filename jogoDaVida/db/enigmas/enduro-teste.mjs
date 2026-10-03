// Teste headless do Enduro (enigma-106.html): roda a simulação sem navegador
// com um "bot" que desvia dos carros e confere que as 3 fases são completáveis
// e que o desenho não lança exceção. Não é publicado em public/.
//   node jogoDaVida/db/enigmas/enduro-teste.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'enigma-106.html'), 'utf8');
const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1]
  .replace('if (!embutido) avisar(', `window.__e = { novoJogo, passo, desenhar, estado: () => ({ estado, nivel, pontos, passados, cota, tempo, vel, px, cars, fimDeJogo }), tecla: t => { tecla = t; } };\n  if (!embutido) avisar(`)
  .replace('requestAnimationFrame(quadro);\n})();', '})();');

const noop = () => {};
const ctx = new Proxy({}, { get: (_, k) => (k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop), set: () => true });
const el = () => ({ style: {}, textContent: '', offsetHeight: 20, children: [], addEventListener: noop, getContext: () => ctx, width: 480, height: 320, setAttribute: noop });
const elementos = {};
const janela = {
  innerWidth: 900, innerHeight: 700, addEventListener: noop, parent: null, AudioContext: undefined,
  requestAnimationFrame: noop,
};
janela.parent = janela;
const sandbox = {
  window: janela, requestAnimationFrame: noop, performance: { now: () => 0 }, console, Math, Float32Array, Number, String, Array,
  location: { origin: 'http://x' },
  FimJogo: { esconder: noop, mostrar: o => { sandbox.__fim = o; }, resultado: noop },
  document: {
    documentElement: { getAttribute: () => '500' },
    getElementById: id => (elementos[id] ||= el()),
    querySelector: () => ({ children: [el()], offsetHeight: 10 }),
    addEventListener: noop,
  },
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const e = sandbox.window.__e;

// bot: sempre acelera; desvia do carro mais próximo na sua faixa
function bot(s) {
  const t = { cima: true };
  const alvo = s.cars.filter(c => c.z > -5 && c.z < 230 && Math.abs(c.x - s.px) < 0.55).sort((a, b) => a.z - b.z)[0];
  let desejado = Math.max(-0.667, Math.min(0.667, Math.round(s.px / 0.667) * 0.667));
  if (alvo) {
    const livres = [-0.667, 0, 0.667].filter(l => !s.cars.some(c => c.z > -10 && c.z < 260 && Math.abs(c.x - l) < 0.45));
    if (livres.length) desejado = livres.sort((a, b) => Math.abs(a - s.px) - Math.abs(b - s.px))[0];
  }
  const erro = desejado - s.px;
  if (erro > 0.12) t.dir = true; else if (erro < -0.12) t.esq = true;
  return t;
}

const resumo = [];
let falhou = false;
for (let rodada = 1; rodada <= 3; rodada++) {
  e.tecla({});
  let guard = 0, ult = null;
  e.novoJogo();
  while (guard++ < 20000) {
    const s = e.estado();
    if (s.fimDeJogo) break;
    e.tecla(bot(s));
    e.passo(1 / 60);
    if (guard % 6 === 0) e.desenhar(0.1);
    if (process.env.DBG && guard % 60 === 0) console.log(guard/60 | 0, s.estado, s.vel.toFixed(0), s.px.toFixed(2), s.passados, s.cars.length);
    if (s.nivel !== ult) { ult = s.nivel; }
  }
  const s = e.estado();
  resumo.push(`[passados ${s.passados}/${s.cota}] rodada ${rodada}: fase ${s.nivel}, pontos ${s.pontos}, ${s.fimDeJogo ? 'fim' : 'NÃO TERMINOU'} (venceu=${sandbox.__fim?.venceu})`);
}
console.log(resumo.join('\n'));

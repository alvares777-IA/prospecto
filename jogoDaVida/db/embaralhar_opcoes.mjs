// Embaralha a ordem das opções em cada db/enigmas/enigma-###.html.
// As páginas vinham com a resposta certa sempre na 1ª opção. A validação é
// no servidor (enigma.resposta), então reordenar o HTML não quebra nada.
// Garante que a opção correta não fique na 1ª posição.
//
//   node jogoDaVida/db/embaralhar_opcoes.mjs
//   node jogoDaVida/db/publicar_enigmas.mjs   # regenera public/enigmas/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'enigmas');
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

let ok = 0, pulados = 0;
for (const f of fs.readdirSync(DIR).filter(n => /^enigma-\d+\.html$/.test(n))) {
    const p = path.join(DIR, f);
    let html = fs.readFileSync(p, 'utf8');
    const correta = norm((html.match(/<html[^>]*\sdata-answer="([^"]*)"/i) || [])[1]);

    const novo = html.replace(
        /(<div class="row g-2(?: mb-4)?">)(\s*)([\s\S]*?)(\s*)(<\/div>)(?=\s*<div id="(?:feedback|answerBox)")/,
        (m, abre, ws1, meio, ws2, fecha) => {
            const blocos = meio.split(/(?<=<\/div>)(?=<div class="col-12 col-md-6">)/g);
            if (blocos.length < 2) return m;
            shuffle(blocos);
            // opção correta não pode ficar em primeiro
            const ehCorreta = b => {
                const v = norm((b.match(/data-(?:answer|value)="([^"]*)"/) || [])[1]);
                return v && v === correta;
            };
            if (correta && ehCorreta(blocos[0]) && blocos.length > 1) {
                const j = 1 + Math.floor(Math.random() * (blocos.length - 1));
                [blocos[0], blocos[j]] = [blocos[j], blocos[0]];
            }
            return abre + ws1 + blocos.join('') + ws2 + fecha;
        },
    );

    if (novo === html) { pulados++; continue; }
    fs.writeFileSync(p, novo);
    ok++;
}
console.log(`opções embaralhadas em ${ok} arquivos (${pulados} sem alteração)`);

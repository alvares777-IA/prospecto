// Copia as páginas de enigma de db/enigmas/ para public/enigmas/ (servido pelo
// jogo), REMOVENDO `data-answer` das tags <html> e <body> — o gabarito não pode
// ir para o navegador. A fonte em db/enigmas/ mantém `data-answer` (o
// db/importar_enigmas.mjs lê dali para gravar enigma.resposta).
//
//   node jogoDaVida/db/publicar_enigmas.mjs
// Rode após alterar as páginas fonte ou o game.js.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ORIG = path.join(AQUI, 'enigmas');
const DEST = path.join(AQUI, '..', 'public', 'enigmas');

fs.mkdirSync(DEST, { recursive: true });

// só das tags <html ...> e <body ...>; nas opções, data-answer é o rótulo visível
const stripData = html => html.replace(
  /(<(?:html|body)\b[^>]*?)\s+data-answer="[^"]*"([^>]*>)/gi,
  '$1$2',
);

let htmls = 0;
for (const f of fs.readdirSync(ORIG)) {
  const src = path.join(ORIG, f);
  if (f === 'texto.csv') continue;
  if (/^enigma-\d+\.html$/.test(f)) {
    fs.writeFileSync(path.join(DEST, f), stripData(fs.readFileSync(src, 'utf8')));
    htmls++;
  } else if (/\.(html|js|css)$/.test(f)) {
    fs.copyFileSync(src, path.join(DEST, f));
  }
}
console.log(`publicados ${htmls} enigmas + game.js/style.css/index.html em public/enigmas/ (sem data-answer)`);

// Importa os 200 enigmas para a tabela `enigma`:
//   - db/enigmas/texto.csv                  -> tipo 'texto'  (pergunta + resposta)
//   - db/enigmas/enigma-###.html (x100)     -> tipo 'html'   (página interativa)
//
// Sequência: intercala texto#n (ordem 2n-1) e html#n (ordem 2n).
// Idempotente por `enigma.origem`. Rode sempre que a fonte mudar.
//
// No container:
//   docker cp jogoDaVida/db/enigmas prospecto-ia-jogodavida-1:/tmp/enigmas
//   docker exec -i prospecto-ia-jogodavida-1 node --input-type=module - /tmp/enigmas \
//     < jogoDaVida/db/importar_enigmas.mjs
// (as páginas .html/.css/.js também são copiadas para public/enigmas/ p/ serem servidas)

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const DIR = process.argv[2] || 'db/enigmas';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function parseCsv(txt) {
    txt = txt.replace(/^﻿/, '');
    const linhas = txt.split(/\r?\n/).filter(l => l.trim());
    linhas.shift();                              // cabeçalho
    return linhas.map(l => {
        const c = []; let cur = '', q = false;
        for (let i = 0; i < l.length; i++) {
            const ch = l[i];
            if (q) {
                if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; }
                else cur += ch;
            } else if (ch === '"') q = true;
            else if (ch === ';') { c.push(cur); cur = ''; }
            else cur += ch;
        }
        c.push(cur);
        return { num: +c[0], nivel: c[1] || null, enigma: c[2], resposta: c[3] };
    });
}

function lerHtml(html, arquivo) {
    const num = +arquivo.match(/(\d+)/)[1];
    const answer = (html.match(/<html[^>]*\sdata-answer="([^"]*)"/i) || [])[1] || '';
    const riddle = ((html.match(/<h1[^>]*class="riddle[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '')
        .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const nivel = (html.match(/badge-level"[^>]*>([^<]+)</i) || [])[1]?.trim() || null;
    return { num, resposta: answer, pergunta: riddle || `Enigma ${arquivo}`, nivel, arquivo };
}

const csv = parseCsv(fs.readFileSync(path.join(DIR, 'texto.csv'), 'utf8'));
// só os 100 enigmas de quiz (enigma-001..100.html); enigma-101+ são jogos
// arcade (tipo 'jogo'), importados à parte por db/importar_jogos.mjs.
const htmls = fs.readdirSync(DIR)
    .filter(f => { const m = f.match(/^enigma-(\d+)\.html$/); return m && Number(m[1]) <= 100; })
    .sort()
    .map(f => lerHtml(fs.readFileSync(path.join(DIR, f), 'utf8'), f));

const linhas = [];
for (const t of csv) {
    linhas.push({
        origem: `csv:${t.num}`, tipo: 'texto', nivel: t.nivel, ordem: t.num * 2 - 1,
        pergunta: t.enigma, resposta: t.resposta, arquivo: null,
    });
}
for (const h of htmls) {
    linhas.push({
        origem: `html:enigma-${String(h.num).padStart(3, '0')}`, tipo: 'html', nivel: h.nivel,
        ordem: h.num * 2, pergunta: h.pergunta, resposta: h.resposta, arquivo: h.arquivo,
    });
}

let ins = 0, upd = 0;
for (const r of linhas) {
    const res = await pool.query(
        `INSERT INTO enigma (origem, tipo, nivel, ordem, pergunta, resposta, arquivo)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (origem) DO UPDATE SET
           tipo = EXCLUDED.tipo, nivel = EXCLUDED.nivel, ordem = EXCLUDED.ordem,
           pergunta = EXCLUDED.pergunta, resposta = EXCLUDED.resposta,
           arquivo = EXCLUDED.arquivo, ativo = 'S'
         RETURNING (xmax = 0) AS inserido`,
        [r.origem, r.tipo, r.nivel, r.ordem, r.pergunta, r.resposta, r.arquivo],
    );
    res.rows[0].inserido ? ins++ : upd++;
}

// Enigmas sem `origem` (ex.: aritméticos de scaffolding) saem de circulação.
await pool.query(`UPDATE enigma SET ativo = 'N' WHERE origem IS NULL`);

const ativos = (await pool.query(`SELECT count(*)::int c FROM enigma WHERE ativo='S'`)).rows[0].c;
const maior = (await pool.query(`SELECT max(length(resposta)) m FROM enigma`)).rows[0].m;
console.log(`enigmas: ${ins} inseridos, ${upd} atualizados | ativos = ${ativos} | maior resposta = ${maior} chars`);
await pool.end();

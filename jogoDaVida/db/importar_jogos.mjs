// Importa os jogos-arcade (tipo 'jogo') para a tabela `enigma`:
//   db/enigmas/enigma-101.html (Paddle), enigma-102.html (Comilão), ...
//
// Cada um já vem com `fase` marcada: quem chega nesse trecho da sequência
// entra num tabuleiro coletivo, joga o jogo dentro de um <iframe> (a
// jogabilidade roda no navegador) e manda a PONTUAÇÃO alcançada como
// "resposta"; o servidor decide se resolveu comparando com o limiar
// numérico gravado em `data-answer` no <html> do jogo (ver jogo.js
// `acertouResposta`). Some pontos: mesma FASE = mesmo trecho coletivo dos
// enigmas de quiz — dá pra intercalar "1 fase de enigma, 1 fase de jogos"
// marcando enigmas de quiz com uma fase e os jogos com outra (no /admin).
//
// Idempotente por `enigma.origem`. Só INSERE o que ainda não está no catálogo:
// depois de importado, quem manda em fase/ordem/meta/níveis/ativo é o /admin
// (reimportar não desfaz o que foi ajustado lá). Para jogo já existente, só
// confere `tipo` e `arquivo`.
//
// No container:
//   docker cp jogoDaVida/db/enigmas prospecto-ia-jogodavida-1:/tmp/enigmas
//   docker exec -i prospecto-ia-jogodavida-1 node --input-type=module - /tmp/enigmas \
//     < jogoDaVida/db/importar_jogos.mjs

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const DIR = process.argv[2] || 'db/enigmas';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// arquivo -> posição no catálogo. `fase` agrupa os jogos num só trecho
// coletivo; `ordem` decide a ordem deles dentro do trecho e, junto com o
// `ordem` dos enigmas de quiz, onde o trecho entra na sequência da sala
// (ver jogo.js `iniciarSala` — o trecho entra pela posição do menor ordem).
// fase 2: já existe uma fase 1 de enigmas de quiz no catálogo (marcada no
// /admin); os jogos entram como a fase SEGUINTE, pra intercalar de verdade
// "1 fase de enigma, 1 fase de jogos" em vez de misturar tudo numa fase só.
// `niveis`: quantas fases o jogo tem por dentro (TIM = nº de desafios jogados;
// a meta de 600 = 6 desafios de 100 pontos).
const JOGOS = {
    'enigma-101.html': { fase: 2, ordem: 201, niveis: 1 },   // Paddle
    'enigma-102.html': { fase: 2, ordem: 202, niveis: 1 },   // Comilão (Pac-Man simplificado)
    'enigma-103.html': { fase: 2, ordem: 203, niveis: 1 },   // Cobrinha (Snake)
    'enigma-104.html': { fase: 2, ordem: 204, niveis: 1 },   // Invasores (Space Invaders)
    'enigma-105.html': { fase: 2, ordem: 90,  niveis: 6 },   // TIM (The Incredible Machine)
};

function lerJogo(html, arquivo) {
    const limiar = (html.match(/<html[^>]*\sdata-answer="([^"]*)"/i) || [])[1] || '0';
    const nivel = (html.match(/<html[^>]*\sdata-nivel="([^"]*)"/i) || [])[1] || 'Jogo';
    const titulo = (html.match(/<html[^>]*\sdata-titulo="([^"]*)"/i) || [])[1] || arquivo;
    return { resposta: limiar, nivel, pergunta: `Jogo: ${titulo} — alcance ${limiar} pontos.` };
}

let ins = 0, upd = 0;
for (const [arquivo, pos] of Object.entries(JOGOS)) {
    const caminho = path.join(DIR, arquivo);
    if (!fs.existsSync(caminho)) { console.warn(`(pulado, não encontrei) ${arquivo}`); continue; }
    const j = lerJogo(fs.readFileSync(caminho, 'utf8'), arquivo);
    const origem = `jogo:${arquivo.replace(/\.html$/, '')}`;
    const res = await pool.query(
        `INSERT INTO enigma (origem, tipo, nivel, ordem, fase, niveis, pergunta, resposta, arquivo)
         VALUES ($1, 'jogo', $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (origem) DO UPDATE SET tipo = 'jogo', arquivo = EXCLUDED.arquivo
         RETURNING (xmax = 0) AS inserido`,
        [origem, j.nivel, pos.ordem, pos.fase, pos.niveis, j.pergunta, j.resposta, arquivo],
    );
    res.rows[0].inserido ? ins++ : upd++;
}

console.log(`jogos: ${ins} inseridos, ${upd} já existiam (mantidos como estão no /admin)`);
await pool.end();

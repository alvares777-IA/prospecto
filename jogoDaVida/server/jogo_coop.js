// Modo em equipe (coop). Espelha a forma de jogo.js, mas:
//   - o tabuleiro é COMPARTILHADO: enigmas por fase, qualquer jogador resolve
//     qualquer enigma da fase; resolvidos todos, a equipe avança de fase.
//   - a energia é UMA barra da equipe (partida_equipe), fresca em 100%.
//     Decai no tempo, cai a cada erro de qualquer um, sobe a cada enigma
//     resolvido e na vitória.
//   - ao sair, cada jogador leva de volta para jogador.energia:
//     energia_entrada * (energia_da_equipe_no_momento / 100).
//
// Parâmetros resolvidos no banco (função `param`): enigma -> sala -> global.

import { pool } from './db.js';

// Normaliza p/ comparar respostas (mesma regra de jogo.js e das páginas html).
const norm = s => String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

async function num(chave, enigmaId, sessaoId, padrao) {
    const r = await pool.query(`SELECT param($1, $2, $3) AS v`, [chave, enigmaId, sessaoId]);
    const v = Number(r.rows[0]?.v);
    return Number.isFinite(v) ? v : padrao;
}

// Gera o tabuleiro (qtd_fases * enigmas_por_fase enigmas, na ordem do catálogo)
// e cria a barra da equipe. Idempotente.
export async function iniciarCoop(sessaoId) {
    const fases   = await num('qtd_fases', null, sessaoId, 3);
    const porFase = await num('enigmas_por_fase', null, sessaoId, 3);
    const total   = fases * porFase;

    await pool.query(
        `INSERT INTO sessao_enigma (sessao_id, ordem, enigma_id, fase)
         SELECT $1, r.rn, r.id, ceil(r.rn::numeric / $3)
           FROM (SELECT t.id,
                        row_number() OVER (ORDER BY t.ordem NULLS LAST, t.id) AS rn
                   FROM (SELECT id, ordem FROM enigma WHERE ativo = 'S'
                          ORDER BY ordem NULLS LAST, id LIMIT $2) t) r
          WHERE NOT EXISTS (SELECT 1 FROM sessao_enigma WHERE sessao_id = $1)`,
        [sessaoId, total, porFase],
    );

    await pool.query(
        `INSERT INTO partida_equipe (sessao_id, energia)
         VALUES ($1, param('energia_inicial', NULL, $1))
         ON CONFLICT (sessao_id) DO NOTHING`,
        [sessaoId],
    );

    return { fases, porFase, total };
}

// Registra a participação do jogador na sala coop e guarda o snapshot da
// energia pessoal dele (energia_entrada). partida_jogador.energia/porta não são
// usados no coop — só energia_entrada e a existência da linha importam.
export async function garantirJogadorCoop(sessaoId, jogadorId) {
    await pool.query(
        `INSERT INTO partida_jogador (sessao_id, jogador_id, energia, energia_entrada)
         SELECT $1, $2, e.ini, e.ini
           FROM (SELECT GREATEST(
                   COALESCE((SELECT energia FROM jogador WHERE id = $2),
                            param('energia_inicial', NULL, $1)),
                   COALESCE(param('piso_energia', NULL, $1), 0)
                 ) AS ini) e
         ON CONFLICT (sessao_id, jogador_id) DO NOTHING`,
        [sessaoId, jogadorId],
    );
}

// Energia corrente da equipe = energia registrada menos o decaimento desde
// dt_energia. O relógio para em dt_fim (vitória/derrota). Clampada [0,100].
// Devolve { energia, dt_fim } ou null.
async function energiaEquipe(sessaoId) {
    const r = await pool.query(
        `SELECT GREATEST(0, LEAST(100, pe.energia
                 - COALESCE(param('decaimento_min', NULL, pe.sessao_id), 1)
                   * (EXTRACT(EPOCH FROM LEAST(now(), COALESCE(pe.dt_fim, now())) - pe.dt_energia) / 60.0))) AS energia,
                pe.dt_fim
           FROM partida_equipe pe
          WHERE pe.sessao_id = $1`,
        [sessaoId],
    );
    return r.rows[0] || null;
}

// "Settla" o decaimento acumulado e aplica um delta (+/-). Clampa [0,100].
// Marca dt_fim se a barra zerou (derrota). Devolve a nova energia ou null.
async function settleEquipe(sessaoId, delta) {
    const r = await pool.query(
        `UPDATE partida_equipe pe
            SET energia = GREATEST(0, LEAST(100,
                  GREATEST(0, pe.energia
                    - COALESCE(param('decaimento_min', NULL, pe.sessao_id), 1)
                      * (EXTRACT(EPOCH FROM now() - pe.dt_energia) / 60.0))
                  + $2)),
                dt_energia = now()
          WHERE pe.sessao_id = $1 AND pe.dt_fim IS NULL
        RETURNING pe.energia`,
        [sessaoId, delta],
    );
    if (!r.rows[0]) return null;
    const energia = Number(r.rows[0].energia);
    if (energia <= 0) {
        await pool.query(
            `UPDATE partida_equipe SET dt_fim = now()
              WHERE sessao_id = $1 AND dt_fim IS NULL`,
            [sessaoId],
        );
    }
    return energia;
}

// Estado do jogo coop para o cliente (só os enigmas da fase atual).
export async function estadoCoop(sessaoId) {
    const s = await pool.query(
        `SELECT s.fase_atual,
                param('qtd_fases', NULL, s.id)      AS qtd_fases,
                param('decaimento_min', NULL, s.id) AS decaimento_min
           FROM sessao s WHERE s.id = $1`,
        [sessaoId],
    );
    if (!s.rows[0]) return null;
    const fase = Number(s.rows[0].fase_atual);
    const totalFases = Number(s.rows[0].qtd_fases) || 3;

    const eq = await energiaEquipe(sessaoId);
    const energia = eq ? Math.round(Number(eq.energia) * 10) / 10 : 0;
    const venceu  = fase > totalFases;
    const derrota = !venceu && !!eq && Number(eq.energia) <= 0 && eq.dt_fim != null;

    const en = await pool.query(
        `SELECT se.ordem, se.resolvido_por, e.tipo, e.nivel, e.pergunta, e.arquivo,
                j.apelido AS por_quem
           FROM sessao_enigma se
           JOIN enigma e ON e.id = se.enigma_id
           LEFT JOIN jogador j ON j.id = se.resolvido_por
          WHERE se.sessao_id = $1 AND se.fase = $2
          ORDER BY se.ordem`,
        [sessaoId, fase],
    );
    const enigmas = en.rows.map(r => ({
        ordem: r.ordem,
        tipo: r.tipo,
        nivel: r.nivel,
        pergunta: r.resolvido_por ? null : r.pergunta,
        arquivo:  r.resolvido_por ? null : r.arquivo,
        resolvido: !!r.resolvido_por,
        porQuem: r.por_quem || null,
    }));
    const faseCompleta = enigmas.length > 0 && enigmas.every(e => e.resolvido);

    return {
        modo: 'coop',
        fase,
        totalFases,
        energia,
        decaimentoMin: Number(s.rows[0].decaimento_min) || 1,
        faseCompleta,
        terminou: venceu,
        esgotado: derrota,
        enigmas,
    };
}

// Responde um enigma da fase atual. Devolve:
//   { correta:true, resolvido:true, energia, faseCompleta }  -> foi este jogador
//   { correta:true, jaResolvido:true }                        -> alguém chegou antes
//   { correta:false, energia }                                -> errou (barra caiu)
//   { erro }                                                  -> estado inválido
export async function responderCoop(sessaoId, jogadorId, ordem, resposta) {
    const est = await estadoCoop(sessaoId);
    if (!est) return { erro: 'sem_jogo' };
    if (est.terminou) return { erro: 'ja_terminou' };
    if (est.esgotado) return { erro: 'sem_energia' };

    const cur = await pool.query(
        `SELECT se.enigma_id, se.resolvido_por, e.resposta, e.tipo
           FROM sessao_enigma se JOIN enigma e ON e.id = se.enigma_id
          WHERE se.sessao_id = $1 AND se.ordem = $2 AND se.fase = $3`,
        [sessaoId, ordem, est.fase],
    );
    if (!cur.rows[0]) return { erro: 'sem_enigma' };
    if (cur.rows[0].resolvido_por) return { correta: false, jaResolvido: true };

    const { enigma_id, resposta: correta, tipo } = cur.rows[0];
    const a = norm(resposta), c = norm(correta);
    const acertou = a === c || (tipo === 'html' && a.length >= 3 && c.includes(a));

    await pool.query(
        `INSERT INTO tentativa (sessao_id, jogador_id, ordem, porta, enigma_id, resposta, correta)
         VALUES ($1, $2, $3, $3, $4, $5, $6)`,
        [sessaoId, jogadorId, ordem, enigma_id, String(resposta).slice(0, 120), acertou],
    );

    if (!acertou) {
        const pen = await num('penalidade_erro', enigma_id, sessaoId, 5);
        const energia = await settleEquipe(sessaoId, -pen);
        return { correta: false, energia };
    }

    // claim atômico: a 1ª resposta certa fica com o enigma
    const claim = await pool.query(
        `UPDATE sessao_enigma SET resolvido_por = $3, dt_resolvido = now()
          WHERE sessao_id = $1 AND ordem = $2 AND resolvido_por IS NULL
        RETURNING id`,
        [sessaoId, ordem, jogadorId],
    );
    if (!claim.rows[0]) return { correta: true, jaResolvido: true };

    const bonus = await num('bonus_enigma', enigma_id, sessaoId, 3);
    const energia = await settleEquipe(sessaoId, +bonus);
    const depois = await estadoCoop(sessaoId);
    return { correta: true, resolvido: true, energia, faseCompleta: depois.faseCompleta };
}

// Avança a equipe da fase `deFase` para a seguinte. 1ª chamada vence (guarda
// atômica em fase_atual). Se passar da última fase: soma bonus_vitoria e
// encerra a barra (vitória). Devolve { mudou, fase, venceu } ou { erro }.
export async function avancarFase(sessaoId, deFase) {
    const est = await estadoCoop(sessaoId);
    if (!est || est.terminou) return { mudou: false };
    if (est.fase !== Number(deFase)) return { mudou: false };
    if (!est.faseCompleta) return { erro: 'fase_incompleta' };

    const r = await pool.query(
        `UPDATE sessao SET fase_atual = fase_atual + 1
          WHERE id = $1 AND fase_atual = $2
        RETURNING fase_atual`,
        [sessaoId, deFase],
    );
    if (!r.rows[0]) return { mudou: false };
    const fase = Number(r.rows[0].fase_atual);

    const totalFases = await num('qtd_fases', null, sessaoId, 3);
    let venceu = false;
    if (fase > totalFases) {
        const bonus = await num('bonus_vitoria', null, sessaoId, 10);
        await settleEquipe(sessaoId, +bonus);
        await pool.query(
            `UPDATE partida_equipe SET dt_fim = now()
              WHERE sessao_id = $1 AND dt_fim IS NULL`,
            [sessaoId],
        );
        venceu = true;
    }
    return { mudou: true, fase, venceu };
}

// Só aplica o decaimento (usado pelo relógio). Devolve a energia da equipe.
export async function tiqueCoop(sessaoId) {
    return settleEquipe(sessaoId, 0);
}

// Grava a energia pessoal de volta ao sair da sala coop:
//   jogador.energia = energia_entrada * (energia_da_equipe_agora / 100)
// Só contas. Idempotente (guarda em partida_jogador.dt_fim). Devolve a energia
// pessoal gravada ou null.
export async function sairCoop(sessaoId, jogadorId) {
    const eq = await energiaEquipe(sessaoId);
    if (!eq) return null;
    const fracao = Number(eq.energia) / 100;

    const r = await pool.query(
        `UPDATE jogador j
            SET energia = GREATEST(0, LEAST(100, COALESCE(pj.energia_entrada, 100) * $3))
           FROM partida_jogador pj
          WHERE pj.sessao_id = $1 AND pj.jogador_id = $2 AND pj.dt_fim IS NULL
            AND j.id = $2 AND j.anonimo = 'N'
        RETURNING j.energia`,
        [sessaoId, jogadorId, fracao],
    );
    await pool.query(
        `UPDATE partida_jogador SET dt_fim = now()
          WHERE sessao_id = $1 AND jogador_id = $2 AND dt_fim IS NULL`,
        [sessaoId, jogadorId],
    );
    return r.rows[0] ? Number(r.rows[0].energia) : null;
}

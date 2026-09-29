// Protótipo de jogo: sequência de enigmas por sala ("portas"), energia por
// jogador, ajuda, doação. Parâmetros resolvidos no banco (função `param`):
//   enigma -> sala (sessao) -> global.
//
// Energia é guardada em partida_jogador.energia + dt_energia; o decaimento
// por minuto é aplicado ("settled") a cada evento e a cada tique do relógio.
//
// FASE CO-OP: alguns enigmas do catálogo têm `enigma.fase` (número). Enigmas
// com a mesma fase formam um TRECHO da sequência resolvido COLETIVAMENTE
// (sessao_enigma.resolvido_por). Cada jogador chega no seu ritmo, resolve o
// que ainda está aberto, e quando a fase inteira cai ele clica Prosseguir e
// segue sozinho. Energia continua PESSOAL o tempo todo.

import { pool } from './db.js';

// Monta a sequência da sala, se ainda não existe. Intercala enigmas solo
// (por `ordem`) com grupos-fase (posição = menor `ordem` do grupo); um
// grupo-fase entra inteiro e contíguo. Devolve o total de slots.
export async function iniciarSala(sessaoId) {
    const jaTem = (await pool.query(
        `SELECT 1 FROM sessao_enigma WHERE sessao_id = $1 LIMIT 1`, [sessaoId])).rowCount;
    if (jaTem) return contarSlots(sessaoId);

    const qtd = Number((await pool.query(
        `SELECT param('qtd_enigmas', NULL, $1) AS q`, [sessaoId])).rows[0].q) || 4;

    const solo = (await pool.query(
        `SELECT id, ordem FROM enigma
          WHERE ativo = 'S' AND (fase IS NULL OR tipo = 'mundo')   -- o Mundo é sempre porta própria
          ORDER BY ordem NULLS LAST, id
          LIMIT $1`, [qtd])).rows;

    const fasesRows = (await pool.query(
        `SELECT fase, id, ordem FROM enigma
          WHERE ativo = 'S' AND fase IS NOT NULL AND tipo <> 'mundo'
          ORDER BY fase, ordem NULLS LAST, id`)).rows;

    const grupos = new Map();
    for (const r of fasesRows) {
        if (!grupos.has(r.fase)) grupos.set(r.fase, { fase: r.fase, ids: [], k: Infinity });
        const g = grupos.get(r.fase);
        g.ids.push(r.id);
        const o = r.ordem == null ? Infinity : Number(r.ordem);
        if (o < g.k) g.k = o;
    }
    const fases = [...grupos.values()].sort((a, b) => Number(a.fase) - Number(b.fase));

    // merge por chave de `ordem`
    const seq = [];
    const soloKey = i => (solo[i].ordem == null ? Infinity : Number(solo[i].ordem));
    let si = 0, fi = 0;
    while (si < solo.length || fi < fases.length) {
        const kSolo = si < solo.length ? soloKey(si) : Infinity;
        const kFase = fi < fases.length ? fases[fi].k : Infinity;
        if (fi < fases.length && kFase <= kSolo) {
            for (const eid of fases[fi].ids) seq.push({ enigma_id: eid, fase: fases[fi].fase });
            fi++;
        } else {
            seq.push({ enigma_id: solo[si].id, fase: null });
            si++;
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`seq:${sessaoId}`]);
        const dup = (await client.query(
            `SELECT 1 FROM sessao_enigma WHERE sessao_id = $1 LIMIT 1`, [sessaoId])).rowCount;
        if (!dup) {
            for (let i = 0; i < seq.length; i++) {
                await client.query(
                    `INSERT INTO sessao_enigma (sessao_id, ordem, enigma_id, fase)
                     VALUES ($1, $2, $3, $4)`,
                    [sessaoId, i + 1, seq[i].enigma_id, seq[i].fase],
                );
            }
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }

    return contarSlots(sessaoId);
}

async function contarSlots(sessaoId) {
    return (await pool.query(
        `SELECT count(*)::int AS n FROM sessao_enigma WHERE sessao_id = $1`, [sessaoId])).rows[0].n;
}

// Cria a partida do jogador (porta 1) se ainda não existe.
//   - No início do jogo (ninguém ainda com partida): energia cheia
//     (`energia_inicial`, 100).
//   - Entrou com o jogo já rolando: começa com a MENOR energia entre os
//     jogadores ainda ativos (dt_fim IS NULL) — sem vantagem de chegar tarde.
// A energia não carrega de jogos anteriores; persiste só DENTRO do jogo.
export async function garantirPartida(sessaoId, jogadorId) {
    await pool.query(
        `INSERT INTO partida_jogador (sessao_id, jogador_id, energia)
         SELECT $1, $2, COALESCE(
                  (SELECT MIN(energia_atual(pj.id))
                     FROM partida_jogador pj
                    WHERE pj.sessao_id = $1 AND pj.dt_fim IS NULL),
                  param('energia_inicial', NULL, $1))
         ON CONFLICT (sessao_id, jogador_id) DO NOTHING`,
        [sessaoId, jogadorId],
    );
    return estado(sessaoId, jogadorId);
}

const SQL_ESTADO = `
    SELECT pj.id, pj.porta, pj.dt_energia, pj.dt_fim,
           energia_atual(pj.id) AS energia,
           (SELECT count(*)::int FROM sessao_enigma WHERE sessao_id = pj.sessao_id) AS total,
           se.fase,
           param('decaimento_min', se.enigma_id, pj.sessao_id) AS decaimento_min,
           param('chat_aberto',    se.enigma_id, pj.sessao_id) AS chat_aberto,
           e.id AS enigma_id, e.pergunta, e.tipo, e.nivel, e.arquivo
      FROM partida_jogador pj
      LEFT JOIN sessao_enigma se ON se.sessao_id = pj.sessao_id AND se.ordem = pj.porta
      LEFT JOIN enigma e ON e.id = se.enigma_id
     WHERE pj.sessao_id = $1 AND pj.jogador_id = $2`;

// A sequência de uma sala é fixada em iniciarSala(); se um enigma que já
// entrou nela for excluído do catálogo depois, a porta correspondente fica
// sem linha em `sessao_enigma`. Repara preenchendo a porta com o menor
// enigma solo ativo ainda não usado nessa sala, em vez de deixar a porta
// muda. Precisa do mesmo lock de iniciarSala pra não colidir com ela.
async function repararPorta(sessaoId, ordem) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`seq:${sessaoId}`]);
        const jaTem = (await client.query(
            `SELECT 1 FROM sessao_enigma WHERE sessao_id = $1 AND ordem = $2`,
            [sessaoId, ordem])).rowCount;
        if (!jaTem) {
            const usados = (await client.query(
                `SELECT enigma_id FROM sessao_enigma WHERE sessao_id = $1`, [sessaoId])).rows
                .map(row => row.enigma_id);
            const fallback = (await client.query(
                `SELECT id FROM enigma
                  WHERE ativo = 'S' AND fase IS NULL AND NOT (id = ANY($1::bigint[]))
                  ORDER BY ordem NULLS LAST, id LIMIT 1`,
                [usados.length ? usados : [-1]])).rows[0];
            if (fallback) {
                await client.query(
                    `INSERT INTO sessao_enigma (sessao_id, ordem, enigma_id, fase)
                     VALUES ($1, $2, $3, NULL)
                     ON CONFLICT (sessao_id, ordem) DO NOTHING`,
                    [sessaoId, ordem, fallback.id]);
            }
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// Estado do jogador para o cliente. Numa fase, devolve tipo:'fase' + o
// tabuleiro compartilhado do trecho.
export async function estado(sessaoId, jogadorId) {
    let r = await pool.query(SQL_ESTADO, [sessaoId, jogadorId]);
    if (!r.rows[0]) return null;
    let p = r.rows[0];
    if (p.enigma_id == null && p.fase == null && p.porta <= p.total) {
        await repararPorta(sessaoId, p.porta);
        r = await pool.query(SQL_ESTADO, [sessaoId, jogadorId]);
        p = r.rows[0];
    }
    const terminou = p.porta > p.total;
    const base = {
        porta: p.porta,
        total: p.total,
        energia: Math.round(Number(p.energia) * 10) / 10,
        decaimentoMin: Number(p.decaimento_min),
        chatAberto: Number(p.chat_aberto) > 0,
        dtEnergia: p.dt_energia,
        terminou,
        esgotado: Number(p.energia) <= 0 && !terminou,
    };
    if (terminou) return { ...base, tipo: null, pergunta: null, nivel: null, arquivo: null };

    if (p.fase != null) {
        const br = await pool.query(
            `SELECT se.ordem, se.resolvido_por, e.tipo, e.nivel, e.pergunta, e.arquivo,
                    j.apelido AS por_quem
               FROM sessao_enigma se
               JOIN enigma e ON e.id = se.enigma_id
               LEFT JOIN jogador j ON j.id = se.resolvido_por
              WHERE se.sessao_id = $1 AND se.fase = $2
              ORDER BY se.ordem`,
            [sessaoId, p.fase],
        );
        const enigmas = br.rows.map(x => ({
            ordem: x.ordem,
            tipo: x.tipo,
            nivel: x.nivel,
            pergunta: x.resolvido_por ? null : x.pergunta,
            arquivo:  x.resolvido_por ? null : x.arquivo,
            resolvido: !!x.resolvido_por,
            porQuem: x.por_quem || null,
        }));
        const ords = br.rows.map(x => Number(x.ordem));
        return {
            ...base,
            tipo: 'fase',
            fase: Number(p.fase),
            faseInicio: Math.min(...ords),
            faseFim: Math.max(...ords),
            faseCompleta: enigmas.length > 0 && enigmas.every(e => e.resolvido),
            enigmas,
        };
    }

    return {
        ...base,
        tipo: p.tipo,
        enigmaId: p.enigma_id,
        pergunta: p.pergunta,
        nivel: p.nivel,
        arquivo: p.arquivo,
    };
}

// "Settla" o decaimento acumulado e aplica um delta (+/-). Clampa [0,100].
// Marca dt_fim se zerou. Devolve a nova energia.
async function settle(sessaoId, jogadorId, delta) {
    const r = await pool.query(
        `UPDATE partida_jogador pj
            SET energia = GREATEST(0, LEAST(100, energia_atual(pj.id) + $3)),
                dt_energia = now()
          WHERE pj.sessao_id = $1 AND pj.jogador_id = $2 AND pj.dt_fim IS NULL
        RETURNING pj.id, pj.energia`,
        [sessaoId, jogadorId, delta],
    );
    if (!r.rows[0]) return null;
    if (Number(r.rows[0].energia) <= 0) {
        await pool.query(`UPDATE partida_jogador SET dt_fim = now() WHERE id = $1 AND dt_fim IS NULL`,
            [r.rows[0].id]);
    }
    return Number(r.rows[0].energia);
}

// Só aplica o decaimento (usado pelo relógio). Devolve energia atual ou null.
export async function tique(sessaoId, jogadorId) {
    return settle(sessaoId, jogadorId, 0);
}

// Grava a energia da partida de volta na energia PESSOAL do jogador (só contas;
// anônimo some ao sair). Se concluiu todas as portas, soma `bonus_vitoria`
// antes. Idempotente: pode ser chamada ao terminar, ao esgotar e no disconnect.
export async function finalizarPartida(sessaoId, jogadorId) {
    const r = await pool.query(
        `SELECT pj.energia AS reg, energia_atual(pj.id) AS agora, pj.dt_fim, pj.porta,
                (SELECT count(*)::int FROM sessao_enigma WHERE sessao_id = pj.sessao_id) AS total
           FROM partida_jogador pj
          WHERE pj.sessao_id = $1 AND pj.jogador_id = $2`,
        [sessaoId, jogadorId],
    );
    const p = r.rows[0];
    if (!p) return null;
    let energia = Number(p.dt_fim ? p.reg : p.agora);
    if (p.dt_fim && p.porta > p.total) {
        const bonus = Number((await pool.query(
            `SELECT param('bonus_vitoria', NULL, $1) AS v`, [sessaoId],
        )).rows[0].v) || 0;
        energia += bonus;
    }
    energia = Math.max(0, Math.min(100, energia));
    await pool.query(
        `UPDATE jogador SET energia = $2 WHERE id = $1 AND anonimo = 'N'`,
        [jogadorId, energia],
    );
    return energia;
}

// Sala perdida: ninguém vivo (dt_fim IS NULL) e ao menos um morto por
// esgotamento (não por conclusão). Vale para solo e para fase.
export async function checarDerrota(sessaoId) {
    const total = await contarSlots(sessaoId);
    const r = await pool.query(
        `SELECT count(*) FILTER (WHERE dt_fim IS NULL)                         AS vivos,
                count(*) FILTER (WHERE dt_fim IS NOT NULL AND porta <= $2)     AS mortos,
                count(*)                                                       AS n
           FROM partida_jogador WHERE sessao_id = $1`,
        [sessaoId, total],
    );
    const { vivos, mortos, n } = r.rows[0];
    return Number(n) > 0 && Number(vivos) === 0 && Number(mortos) > 0;
}

// Nível (porta) de cada jogador da sessão — para o hall de espera e para o
// cliente. `fim` = dt_fim setado (concluiu OU esgotou); quem decide qual é o
// caller, comparando `porta` com `total`. `na_fase` = a porta é um slot de fase.
export async function niveis(sessaoId) {
    return (await pool.query(
        `SELECT pj.jogador_id, pj.porta, (pj.dt_fim IS NOT NULL) AS fim,
                (SELECT count(*)::int FROM sessao_enigma WHERE sessao_id = pj.sessao_id) AS total,
                (se.fase IS NOT NULL) AS na_fase
           FROM partida_jogador pj
           LEFT JOIN sessao_enigma se ON se.sessao_id = pj.sessao_id AND se.ordem = pj.porta
          WHERE pj.sessao_id = $1`,
        [sessaoId],
    )).rows;
}

// Confere uma resposta contra o gabarito do enigma. `tipo`:
//   'jogo'  -> gabarito é um limiar numérico de pontuação (ex.: enigmas
//              arcade em <iframe> que mandam a pontuação alcançada); a
//              jogabilidade roda no navegador, mas SÓ o servidor decide
//              se ela é suficiente pra contar como resolvido.
//   'html'  -> tolera resposta parcial (como as páginas interativas já faziam).
//   default -> igualdade exata após normalizar (sem acento/maiúscula/pontuação).
function acertouResposta(tipo, resposta, correta) {
    if (tipo === 'jogo' || tipo === 'mundo') {
        const pontos = Number(resposta), limiar = Number(correta);
        return Number.isFinite(pontos) && Number.isFinite(limiar) && pontos >= limiar;
    }
    const a = norm(resposta), c = norm(correta);
    return a === c || (tipo === 'html' && a.length >= 3 && c.includes(a));
}

// Responde. Numa porta solo usa a porta atual; numa fase usa `ordemAlvo`
// (qual enigma do trecho). Devolve formas diferentes p/ solo e fase.
// Porta 'mundo': a pontuação é calculada pelo SERVIDOR (server/mundo.js); o
// cliente não pode responder por ela — só entra com opts.servidor. Com
// opts.equipeCompleta (baú da equipe na meta) passa independente dos pontos.
export async function responder(sessaoId, jogadorId, resposta, ordemAlvo = null, opts = {}) {
    const st = await estado(sessaoId, jogadorId);
    if (!st) return { erro: 'sem_partida' };
    if (st.terminou) return { erro: 'ja_terminou' };
    if (st.esgotado) return { erro: 'sem_energia' };
    if (st.tipo === 'mundo' && !opts.servidor) return { erro: 'via_mundo' };

    if (st.tipo === 'fase') return responderFase(sessaoId, jogadorId, st, resposta, ordemAlvo);

    const cur = await pool.query(
        `SELECT se.enigma_id, e.resposta
           FROM sessao_enigma se JOIN enigma e ON e.id = se.enigma_id
          WHERE se.sessao_id = $1 AND se.ordem = $2`,
        [sessaoId, st.porta],
    );
    if (!cur.rows[0]) return { erro: 'sem_enigma' };
    const { enigma_id, resposta: correta } = cur.rows[0];
    const acertou = (st.tipo === 'mundo' && opts.equipeCompleta)
        || acertouResposta(st.tipo, resposta, correta);

    const pj = await pool.query(
        `SELECT id FROM partida_jogador WHERE sessao_id = $1 AND jogador_id = $2`,
        [sessaoId, jogadorId],
    );
    await pool.query(
        `INSERT INTO tentativa (partida_id, sessao_id, jogador_id, ordem, porta, enigma_id, resposta, correta)
         VALUES ($1, $2, $3, $4, $4, $5, $6, $7)`,
        [pj.rows[0].id, sessaoId, jogadorId, st.porta, enigma_id, String(resposta).slice(0, 120), acertou],
    );

    if (acertou) {
        const nova = st.porta + 1;
        const terminou = nova > st.total;
        const bonus = Number((await pool.query(
            `SELECT param('bonus_enigma', $1, $2) AS v`, [enigma_id, sessaoId],
        )).rows[0].v) || 0;
        await pool.query(
            `UPDATE partida_jogador
                SET porta = $3::int,
                    energia = GREATEST(0, LEAST(100, energia_atual(id) + $5)),
                    dt_energia = now(),
                    dt_fim = CASE WHEN $4 THEN now() ELSE dt_fim END
              WHERE sessao_id = $1 AND jogador_id = $2`,
            [sessaoId, jogadorId, nova, terminou, bonus],
        );
        const depois = await estado(sessaoId, jogadorId);
        return { correta: true, porta: nova, terminou, energia: depois.energia };
    }

    const pen = Number((await pool.query(
        `SELECT param('penalidade_erro', $1, $2) AS v`, [enigma_id, sessaoId],
    )).rows[0].v);
    const energia = await settle(sessaoId, jogadorId, -pen);
    return { correta: false, energia };
}

// Um enigma do trecho de fase. Resolução coletiva (claim atômico em
// sessao_enigma). Energia e bônus/penalidade continuam PESSOAIS.
async function responderFase(sessaoId, jogadorId, st, resposta, ordemAlvo) {
    const ordem = Number(ordemAlvo);
    if (!Number.isInteger(ordem) || ordem < st.faseInicio || ordem > st.faseFim) {
        return { erro: 'ordem_invalida', fase: true };
    }
    const cur = await pool.query(
        `SELECT se.enigma_id, se.resolvido_por, e.resposta, e.tipo
           FROM sessao_enigma se JOIN enigma e ON e.id = se.enigma_id
          WHERE se.sessao_id = $1 AND se.ordem = $2`,
        [sessaoId, ordem],
    );
    if (!cur.rows[0]) return { erro: 'sem_enigma', fase: true };
    if (cur.rows[0].tipo === 'mundo') return { erro: 'via_mundo', fase: true };
    if (cur.rows[0].resolvido_por) return { correta: true, jaResolvido: true, fase: true };
    const { enigma_id, resposta: correta, tipo } = cur.rows[0];
    const acertou = acertouResposta(tipo, resposta, correta);

    await pool.query(
        `INSERT INTO tentativa (sessao_id, jogador_id, ordem, porta, enigma_id, resposta, correta)
         VALUES ($1, $2, $3, $3, $4, $5, $6)`,
        [sessaoId, jogadorId, ordem, enigma_id, String(resposta).slice(0, 120), acertou],
    );

    if (!acertou) {
        const pen = Number((await pool.query(
            `SELECT param('penalidade_erro', $1, $2) AS v`, [enigma_id, sessaoId],
        )).rows[0].v) || 0;
        const energia = await settle(sessaoId, jogadorId, -pen);
        return { correta: false, fase: true, energia };
    }

    const claim = await pool.query(
        `UPDATE sessao_enigma SET resolvido_por = $3, dt_resolvido = now()
          WHERE sessao_id = $1 AND ordem = $2 AND resolvido_por IS NULL
        RETURNING id`,
        [sessaoId, ordem, jogadorId],
    );
    if (!claim.rows[0]) return { correta: true, jaResolvido: true, fase: true };

    const bonus = Number((await pool.query(
        `SELECT param('bonus_enigma', $1, $2) AS v`, [enigma_id, sessaoId],
    )).rows[0].v) || 0;
    const energia = await settle(sessaoId, jogadorId, +bonus);
    const depois = await estado(sessaoId, jogadorId);
    return { correta: true, resolvido: true, fase: true, ordem, energia, faseCompleta: depois.faseCompleta };
}

// Prosseguir a partir de uma fase concluída: pula para depois do trecho.
export async function prosseguirFase(sessaoId, jogadorId) {
    const st = await estado(sessaoId, jogadorId);
    if (!st || st.tipo !== 'fase' || !st.faseCompleta) return st;
    const nova = st.faseFim + 1;
    const terminou = nova > st.total;
    await pool.query(
        `UPDATE partida_jogador
            SET porta = $3::int,
                dt_fim = CASE WHEN $4 THEN now() ELSE dt_fim END
          WHERE sessao_id = $1 AND jogador_id = $2 AND dt_fim IS NULL`,
        [sessaoId, jogadorId, nova, terminou],
    );
    if (terminou) await finalizarPartida(sessaoId, jogadorId);
    return estado(sessaoId, jogadorId);
}

// Desistir: o jogo revela a resposta por `custo_desistir` % da energia
// pessoal. O jogador ainda precisa digitar e enviar. Marca de caráter
// NEGATIVA (silenciosa) só se havia outro jogador à frente (já passou da
// fase) — "preferiu o jogo a pedir a um parceiro".
// Devolve { resposta, energia, custo, ordem } ou { erro }.
export async function desistirEnigma(sessaoId, jogadorId, ordemAlvo = null) {
    const st = await estado(sessaoId, jogadorId);
    if (!st) return { erro: 'sem_partida' };
    if (st.terminou) return { erro: 'ja_terminou' };
    if (st.esgotado) return { erro: 'sem_energia' };
    if (st.tipo === 'mundo') return { erro: 'via_mundo' };

    let ordem, enigmaId;
    if (st.tipo === 'fase') {
        ordem = Number(ordemAlvo);
        if (!Number.isInteger(ordem) || ordem < st.faseInicio || ordem > st.faseFim) {
            return { erro: 'ordem_invalida' };
        }
        const alvo = st.enigmas.find(e => e.ordem === ordem);
        if (!alvo || alvo.resolvido) return { erro: 'ja_resolvido' };
        enigmaId = await enigmaIdDaPorta(sessaoId, ordem);
    } else {
        ordem = st.porta;
        enigmaId = st.enigmaId ?? await enigmaIdDaPorta(sessaoId, ordem);
    }
    if (!enigmaId) return { erro: 'sem_enigma' };

    const custo = Number((await pool.query(
        `SELECT param('custo_desistir', $1, $2) AS v`, [enigmaId, sessaoId],
    )).rows[0].v) || 0;
    if (st.energia < custo) return { erro: 'sem_energia_para_desistir' };

    const energia = await settle(sessaoId, jogadorId, -custo);
    if (energia === null) return { erro: 'sem_partida' };

    const orgulho = (await pool.query(
        `SELECT EXISTS (SELECT 1 FROM partida_jogador
                         WHERE sessao_id = $1 AND jogador_id <> $2 AND porta > $3) AS x`,
        [sessaoId, jogadorId, st.porta],
    )).rows[0].x;

    const resposta = (await pool.query(
        `SELECT resposta FROM enigma WHERE id = $1`, [enigmaId])).rows[0].resposta;

    await pool.query(
        `INSERT INTO desistencia (sessao_id, jogador_id, enigma_id, ordem, custo, orgulho, porta)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sessaoId, jogadorId, enigmaId, ordem, custo, orgulho, st.porta],
    );
    if (orgulho) {
        await marcarCarater(sessaoId, jogadorId, 'negativo',
            'preferiu a resposta do jogo a pedir a um parceiro', st.porta);
    }
    return { resposta, energia, custo, ordem };
}

// Pedir ajuda: custo do próprio pedinte. Devolve { energia, porta }.
export async function pedirAjuda(sessaoId, jogadorId) {
    const st = await estado(sessaoId, jogadorId);
    if (!st || st.terminou || st.esgotado || st.tipo === 'mundo') return { erro: 'indisponivel' };
    const enigmaId = await enigmaIdDaPorta(sessaoId, st.porta);
    const custo = Number((await pool.query(
        `SELECT param('custo_pedir_ajuda', $1, $2) AS v`, [enigmaId, sessaoId],
    )).rows[0].v);
    const energia = await settle(sessaoId, jogadorId, -custo);
    await pool.query(
        `INSERT INTO ajuda (sessao_id, para_jogador_id, tipo, porta) VALUES ($1, $2, 'pedido', $3)`,
        [sessaoId, jogadorId, st.porta],
    );
    return { energia, porta: st.porta };
}

// Dar a resposta a alguém: custo de quem ajuda; o alvo recebe a resposta da
// porta em que ELE está. Devolve { energiaDe, resposta, portaPara } ou { erro }.
export async function darAjuda(sessaoId, deJogadorId, paraJogadorId) {
    const alvo = await estado(sessaoId, paraJogadorId);
    if (!alvo || alvo.terminou || alvo.tipo === 'mundo') return { erro: 'alvo_indisponivel' };
    const enigmaId = await enigmaIdDaPorta(sessaoId, alvo.porta);
    if (!enigmaId) return { erro: 'sem_enigma' };

    const custo = Number((await pool.query(
        `SELECT param('custo_ajudar', $1, $2) AS v`, [enigmaId, sessaoId],
    )).rows[0].v);
    const energiaDe = await settle(sessaoId, deJogadorId, -custo);
    if (energiaDe === null) return { erro: 'sem_partida' };

    const resp = (await pool.query(`SELECT resposta FROM enigma WHERE id = $1`, [enigmaId])).rows[0].resposta;
    await pool.query(
        `INSERT INTO ajuda (sessao_id, de_jogador_id, para_jogador_id, tipo, porta)
         VALUES ($1, $2, $3, 'resposta', $4)`,
        [sessaoId, deJogadorId, paraJogadorId, alvo.porta],
    );
    await marcarCarater(sessaoId, deJogadorId, 'positivo', 'deu a resposta ao parceiro', alvo.porta);
    return { energiaDe, resposta: resp, portaPara: alvo.porta };
}

// Oferecer ajuda a quem pediu: sem custo, libera o chat da sala. Marca caráter +.
export async function oferecerAjuda(sessaoId, deJogadorId, paraJogadorId) {
    const alvo = await estado(sessaoId, paraJogadorId);
    if (!alvo || alvo.terminou) return { erro: 'alvo_indisponivel' };
    await pool.query(
        `INSERT INTO ajuda (sessao_id, de_jogador_id, para_jogador_id, tipo, porta)
         VALUES ($1, $2, $3, 'oferta', $4)`,
        [sessaoId, deJogadorId, paraJogadorId, alvo.porta],
    );
    await marcarCarater(sessaoId, deJogadorId, 'positivo', 'ofereceu ajuda', alvo.porta);
    return { portaPara: alvo.porta };
}

// Não ajudar: quem recusa GANHA o % que o parceiro perdeu ao pedir ajuda, e
// leva uma marca de caráter negativo. Devolve { energia, portaPara }.
export async function recusarAjuda(sessaoId, deJogadorId, paraJogadorId) {
    const alvo = await estado(sessaoId, paraJogadorId);
    if (!alvo) return { erro: 'alvo_indisponivel' };
    const enigmaId = await enigmaIdDaPorta(sessaoId, alvo.porta);
    const ganho = Number((await pool.query(
        `SELECT param('custo_pedir_ajuda', $1, $2) AS v`, [enigmaId, sessaoId],
    )).rows[0].v);

    const energia = await settle(sessaoId, deJogadorId, +ganho);
    if (energia === null) return { erro: 'sem_partida' };

    await pool.query(
        `INSERT INTO ajuda (sessao_id, de_jogador_id, para_jogador_id, tipo, porta)
         VALUES ($1, $2, $3, 'recusa', $4)`,
        [sessaoId, deJogadorId, paraJogadorId, alvo.porta],
    );
    await marcarCarater(sessaoId, deJogadorId, 'negativo',
        'negou ajuda e ganhou a energia do parceiro', alvo.porta);
    return { energia, portaPara: alvo.porta };
}

// Doar energia a outro jogador. Transfere `doacao_energia` %, limitado pela
// energia do doador e pelo teto de 100 do alvo. Sem concluir, destrava o alvo
// esgotado. Devolve { valor, energiaDe, energiaPara, revivido } ou { erro }.
export async function doarEnergia(sessaoId, deJogadorId, paraJogadorId) {
    if (deJogadorId === paraJogadorId) return { erro: 'alvo_invalido' };
    const de = await estado(sessaoId, deJogadorId);
    const para = await estado(sessaoId, paraJogadorId);
    if (!de || !para) return { erro: 'sem_partida' };
    if (para.terminou) return { erro: 'alvo_concluiu' };

    const valor = Number((await pool.query(
        `SELECT param('doacao_energia', NULL, $1) AS v`, [sessaoId],
    )).rows[0].v) || 0;
    const real = Math.max(0, Math.min(valor, de.energia, 100 - para.energia));
    if (real <= 0) return { erro: 'sem_efeito' };

    const energiaDe = await settle(sessaoId, deJogadorId, -real);
    if (energiaDe === null) return { erro: 'sem_partida' };

    const total = await contarSlots(sessaoId);
    const r = await pool.query(
        `UPDATE partida_jogador
            SET energia = LEAST(100, GREATEST(0, energia_atual(id)) + $3),
                dt_energia = now(),
                dt_fim = CASE WHEN porta > $4 THEN dt_fim ELSE NULL END
          WHERE sessao_id = $1 AND jogador_id = $2
        RETURNING energia`,
        [sessaoId, paraJogadorId, real, total],
    );
    const energiaPara = r.rows[0] ? Number(r.rows[0].energia) : null;

    await pool.query(
        `INSERT INTO doacao (sessao_id, de_jogador_id, para_jogador_id, valor, porta)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessaoId, deJogadorId, paraJogadorId, real, para.porta],
    );
    await marcarCarater(sessaoId, deJogadorId, 'positivo', 'doou energia ao parceiro', para.porta);
    return { valor: real, energiaDe, energiaPara, revivido: para.esgotado };
}

// Ações de energia pedidas por um jogo arcade. Só vale em porta 'jogo' ou
// numa fase (onde o jogo aberto é um enigma do trecho). O VALOR vem de
// `parametro` (enigma -> sala -> global); aqui só qual parâmetro e o sinal.
//   gasto: sem energia suficiente, recusa — o jogo só age depois do ok.
//   ganho: o servidor não vê o jogo (a fruta foi comida mesmo?), então há
//          teto por porta (`teto_ganho_jogo`) além do limite de ritmo no socket.
const ACOES_ENERGIA = {
    tiro:   { chave: 'custo_tiro',   sinal: -1, padrao: 1 },
    grudar: { chave: 'custo_grudar', sinal: -1, padrao: 5 },
    fruta:  { chave: 'ganho_fruta',  sinal: +1, padrao: 5 },
    escudo: { chave: 'custo_escudo', sinal: -1, padrao: 5 },
};
const ganhosPorPorta = new Map();   // `${sessao}:${jogador}:${porta}` -> % já ganho (vivo; zera se reiniciar)

// Qual enigma de jogo está aberto. Porta solo: o da porta. Fase: a página
// informa a `ordem` do enigma aberto, e aqui se confere que ela é do trecho
// atual e que é mesmo um jogo. Devolve { id, niveis } ou null.
async function enigmaDoJogo(sessaoId, st, ordem) {
    if (st.tipo === 'jogo') {
        const r = await pool.query(`SELECT id, niveis FROM enigma WHERE id = $1`, [st.enigmaId]);
        return r.rows[0] || null;
    }
    if (st.tipo !== 'fase') return null;
    const o = Number(ordem);
    if (!Number.isInteger(o) || o < st.faseInicio || o > st.faseFim) return null;
    const r = await pool.query(
        `SELECT e.id, e.niveis FROM sessao_enigma se JOIN enigma e ON e.id = se.enigma_id
          WHERE se.sessao_id = $1 AND se.ordem = $2 AND e.tipo = 'jogo'`, [sessaoId, o]);
    return r.rows[0] || null;
}

async function lerParamJogo(chave, padrao, enigmaId, sessaoId) {
    const v = (await pool.query(`SELECT param($1, $2, $3) AS v`, [chave, enigmaId ?? null, sessaoId])).rows[0].v;
    return v == null ? padrao : Number(v);
}

// Configuração do jogo aberto (só leitura): quantos níveis ele tem e os
// valores das ações de energia, para os textos mostrarem o número certo.
export async function configJogo(sessaoId, jogadorId, ordem) {
    const st = await estado(sessaoId, jogadorId);
    if (!st) return {};
    const en = await enigmaDoJogo(sessaoId, st, ordem);
    const cfg = { niveis: en?.niveis || 1 };
    for (const [motivo, a] of Object.entries(ACOES_ENERGIA)) {
        cfg[motivo] = await lerParamJogo(a.chave, a.padrao, en?.id, sessaoId);
    }
    return cfg;
}

export async function energiaJogo(sessaoId, jogadorId, motivo, ordem) {
    const acao = ACOES_ENERGIA[motivo];
    if (!acao) return { erro: 'motivo' };
    const st = await estado(sessaoId, jogadorId);
    if (!st || st.terminou || st.esgotado) return { erro: 'indisponivel' };
    if (st.tipo !== 'jogo' && st.tipo !== 'fase') return { erro: 'nao_e_jogo' };
    const en = await enigmaDoJogo(sessaoId, st, ordem);
    if (!en) return { erro: 'nao_e_jogo' };
    let valor = await lerParamJogo(acao.chave, acao.padrao, en.id, sessaoId);

    if (acao.sinal < 0) {
        if (st.energia < valor) return { erro: 'sem_energia', energia: st.energia };
    } else {
        const k = `${sessaoId}:${jogadorId}:${st.porta}`;
        const teto = await lerParamJogo('teto_ganho_jogo', 30, en.id, sessaoId);
        const ja = ganhosPorPorta.get(k) || 0;
        valor = Math.min(valor, teto - ja, 100 - st.energia);
        if (valor <= 0) return { erro: ja >= teto ? 'teto' : 'cheio', energia: st.energia };
        ganhosPorPorta.set(k, ja + valor);
    }
    const energia = await settle(sessaoId, jogadorId, acao.sinal * valor);
    if (energia === null) return { erro: 'indisponivel' };
    return { ok: true, energia: Math.round(energia * 10) / 10, valor: acao.sinal * valor };
}

export async function marcarCarater(sessaoId, jogadorId, tipo, descricao, porta) {
    await pool.query(
        `INSERT INTO carater (sessao_id, jogador_id, tipo, descricao, porta)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessaoId, jogadorId, tipo, descricao, porta],
    );
}

// Um ato do mundo: vai para o ledger (registrar_evento -> motor de destino)
// e, se tiver `carater`, também para a tabela de caráter. `ato.uid` é gerado
// no servidor ANTES da primeira tentativa — retry não duplica (idempotente).
export async function registrarAto(sessaoId, ato) {
    await pool.query(
        `SELECT registrar_evento($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [ato.uid, sessaoId, ato.tipoEvento, ato.ator, ato.alvo ?? null,
         ato.valor ?? null, JSON.stringify(ato.contexto || {}), ato.dt || new Date()],
    );
    if (ato.carater) {
        await marcarCarater(sessaoId, ato.ator, ato.carater.tipo, ato.carater.descricao, ato.porta ?? null);
    }
}

// Parâmetros do mundo (resolvidos enigma -> sala -> global) + a meta pessoal.
export async function parametrosMundo(sessaoId, jogadorId) {
    const st = await estado(sessaoId, jogadorId);
    if (!st || st.tipo !== 'mundo' || st.terminou) return null;
    const chaves = ['mundo_duracao_seg', 'mundo_meta_equipe', 'mundo_fome_seg', 'mundo_socorro_prazo_seg',
        'mundo_valor_minerio', 'mundo_valor_comida', 'mundo_valor_madeira', 'mundo_valor_pedra'];
    const r = await pool.query(
        `SELECT k, param(k, $1, $2) AS v FROM unnest($3::text[]) AS k`,
        [st.enigmaId, sessaoId, chaves],
    );
    const p = Object.fromEntries(r.rows.map(x => [x.k, Number(x.v)]));
    const meta = Number((await pool.query(`SELECT resposta FROM enigma WHERE id = $1`, [st.enigmaId])).rows[0].resposta);
    return {
        porta: st.porta,
        duracaoSeg: p.mundo_duracao_seg || 240,
        metaEquipe: p.mundo_meta_equipe || 120,
        fomeSeg: p.mundo_fome_seg || 3,
        socorroPrazoSeg: p.mundo_socorro_prazo_seg || 30,
        valores: {
            minerio: p.mundo_valor_minerio ?? 5, comida: p.mundo_valor_comida ?? 2,
            madeira: p.mundo_valor_madeira ?? 1, pedra: p.mundo_valor_pedra ?? 1,
        },
        metaPessoal: Number.isFinite(meta) ? meta : 30,
    };
}

async function enigmaIdDaPorta(sessaoId, ordem) {
    const r = await pool.query(
        `SELECT enigma_id FROM sessao_enigma WHERE sessao_id = $1 AND ordem = $2`,
        [sessaoId, ordem],
    );
    return r.rows[0]?.enigma_id || null;
}

// Uma resposta caiu no chat? Se sim, desconta de TODOS os jogadores em jogo.
// Devolve { acertou, penalidade, jogadores:[{jogadorId, energia}] } ou { acertou:false }.
export async function penalizarSpoiler(sessaoId, texto) {
    const linhas = (await pool.query(
        `SELECT e.resposta FROM sessao_enigma se JOIN enigma e ON e.id = se.enigma_id
          WHERE se.sessao_id = $1 AND e.tipo <> 'mundo'`, [sessaoId],
    )).rows;
    if (!linhas.length) return { acertou: false };

    const respostas = linhas.map(r => ({ n: norm(r.resposta), multi: /\s/.test(r.resposta) }));
    const normMsg = norm(texto);
    const tokens = new Set(
        String(texto).split(/[^\p{L}\p{N}]+/u).map(norm).filter(Boolean),
    );
    const bateu = respostas.some(r => tokens.has(r.n) || (r.multi && normMsg.includes(r.n)));
    if (!bateu) return { acertou: false };

    const pen = Number((await pool.query(
        `SELECT param('penalidade_chat', NULL, $1) AS v`, [sessaoId],
    )).rows[0].v) || 10;

    const alvos = (await pool.query(
        `SELECT jogador_id FROM partida_jogador WHERE sessao_id = $1 AND dt_fim IS NULL`,
        [sessaoId],
    )).rows.map(r => r.jogador_id);

    const jogadores = [];
    for (const jid of alvos) {
        jogadores.push({ jogadorId: jid, energia: await settle(sessaoId, jid, -pen) });
    }
    return { acertou: true, penalidade: pen, jogadores };
}

// Normaliza p/ comparar respostas: sem acento, minúsculas, só letras e dígitos.
// (Mesma regra do game.js das páginas interativas.)
const norm = s => String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

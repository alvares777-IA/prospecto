// Protótipo de jogo: sequência de enigmas por sala ("portas"), energia por
// jogador, ajuda. Parâmetros resolvidos no banco (função `param`):
//   enigma -> sala (sessao) -> global.
//
// Energia é guardada em partida_jogador.energia + dt_energia; o decaimento
// por minuto é aplicado ("settled") a cada evento e a cada tique do relógio.

import { pool } from './db.js';

// Gera a sequência de enigmas da sala, se ainda não existe. Devolve o total.
export async function iniciarSala(sessaoId) {
    const qtd = Number((await pool.query(
        `SELECT param('qtd_enigmas', NULL, $1) AS q`, [sessaoId],
    )).rows[0].q) || 4;

    // Sequência: na ordem do catálogo (não aleatório).
    await pool.query(
        `INSERT INTO sessao_enigma (sessao_id, ordem, enigma_id)
         SELECT $1, row_number() OVER (ORDER BY t.ordem NULLS LAST, t.id), t.id
           FROM (SELECT id, ordem FROM enigma WHERE ativo = 'S'
                  ORDER BY ordem NULLS LAST, id LIMIT $2) t
          WHERE NOT EXISTS (SELECT 1 FROM sessao_enigma WHERE sessao_id = $1)`,
        [sessaoId, qtd],
    );

    return (await pool.query(
        `SELECT count(*)::int AS n FROM sessao_enigma WHERE sessao_id = $1`, [sessaoId],
    )).rows[0].n;
}

// Cria a partida do jogador (energia inicial, porta 1) se ainda não existe.
export async function garantirPartida(sessaoId, jogadorId) {
    await pool.query(
        `INSERT INTO partida_jogador (sessao_id, jogador_id, energia)
         VALUES ($1, $2, param('energia_inicial', NULL, $1))
         ON CONFLICT (sessao_id, jogador_id) DO NOTHING`,
        [sessaoId, jogadorId],
    );
    return estado(sessaoId, jogadorId);
}

// Estado do jogador para o cliente.
export async function estado(sessaoId, jogadorId) {
    const r = await pool.query(
        `SELECT pj.id, pj.porta, pj.dt_energia, pj.dt_fim,
                energia_atual(pj.id) AS energia,
                (SELECT count(*)::int FROM sessao_enigma WHERE sessao_id = pj.sessao_id) AS total,
                param('decaimento_min', se.enigma_id, pj.sessao_id) AS decaimento_min,
                param('chat_aberto',    se.enigma_id, pj.sessao_id) AS chat_aberto,
                e.id AS enigma_id, e.pergunta, e.tipo, e.nivel, e.arquivo
           FROM partida_jogador pj
           LEFT JOIN sessao_enigma se ON se.sessao_id = pj.sessao_id AND se.ordem = pj.porta
           LEFT JOIN enigma e ON e.id = se.enigma_id
          WHERE pj.sessao_id = $1 AND pj.jogador_id = $2`,
        [sessaoId, jogadorId],
    );
    if (!r.rows[0]) return null;
    const p = r.rows[0];
    const terminou = p.porta > p.total;
    return {
        porta: p.porta,
        total: p.total,
        enigmaId: p.enigma_id,
        energia: Math.round(Number(p.energia) * 10) / 10,
        decaimentoMin: Number(p.decaimento_min),
        chatAberto: Number(p.chat_aberto) > 0,
        dtEnergia: p.dt_energia,
        terminou,
        esgotado: Number(p.energia) <= 0 && !terminou,
        pergunta: terminou ? null : p.pergunta,
        tipo: terminou ? null : p.tipo,
        nivel: terminou ? null : p.nivel,
        arquivo: terminou ? null : p.arquivo,
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

// Nível (porta) de cada jogador da sessão — para o hall de espera.
export async function niveis(sessaoId) {
    return (await pool.query(
        `SELECT jogador_id, porta, (dt_fim IS NOT NULL) AS terminou
           FROM partida_jogador WHERE sessao_id = $1`,
        [sessaoId],
    )).rows;
}

// Responde a porta atual. Devolve { correta, porta, terminou, energia } ou { erro }.
export async function responder(sessaoId, jogadorId, resposta) {
    const st = await estado(sessaoId, jogadorId);
    if (!st) return { erro: 'sem_partida' };
    if (st.terminou) return { erro: 'ja_terminou' };
    if (st.esgotado) return { erro: 'sem_energia' };

    const cur = await pool.query(
        `SELECT se.enigma_id, e.resposta
           FROM sessao_enigma se JOIN enigma e ON e.id = se.enigma_id
          WHERE se.sessao_id = $1 AND se.ordem = $2`,
        [sessaoId, st.porta],
    );
    if (!cur.rows[0]) return { erro: 'sem_enigma' };
    const { enigma_id, resposta: correta } = cur.rows[0];

    const acertou = norm(resposta) === norm(correta);

    const pj = await pool.query(
        `SELECT id FROM partida_jogador WHERE sessao_id = $1 AND jogador_id = $2`,
        [sessaoId, jogadorId],
    );
    await pool.query(
        `INSERT INTO tentativa (partida_id, porta, enigma_id, resposta, correta)
         VALUES ($1, $2, $3, $4, $5)`,
        [pj.rows[0].id, st.porta, enigma_id, String(resposta).slice(0, 120), acertou],
    );

    if (acertou) {
        const nova = st.porta + 1;
        const terminou = nova > st.total;
        await pool.query(
            `UPDATE partida_jogador
                SET porta = $3::int,
                    energia = energia_atual(id),
                    dt_energia = now(),
                    dt_fim = CASE WHEN $4 THEN now() ELSE dt_fim END
              WHERE sessao_id = $1 AND jogador_id = $2`,
            [sessaoId, jogadorId, nova, terminou],
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

// Pedir ajuda: custo do próprio pedinte. Devolve { energia, porta }.
export async function pedirAjuda(sessaoId, jogadorId) {
    const st = await estado(sessaoId, jogadorId);
    if (!st || st.terminou || st.esgotado) return { erro: 'indisponivel' };
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
    if (!alvo || alvo.terminou) return { erro: 'alvo_indisponivel' };
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

async function marcarCarater(sessaoId, jogadorId, tipo, descricao, porta) {
    await pool.query(
        `INSERT INTO carater (sessao_id, jogador_id, tipo, descricao, porta)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessaoId, jogadorId, tipo, descricao, porta],
    );
}

async function enigmaIdDaPorta(sessaoId, porta) {
    const r = await pool.query(
        `SELECT enigma_id FROM sessao_enigma WHERE sessao_id = $1 AND ordem = $2`,
        [sessaoId, porta],
    );
    return r.rows[0]?.enigma_id || null;
}

// Uma resposta caiu no chat? Se sim, desconta de TODOS os jogadores em jogo.
// Devolve { acertou, penalidade, jogadores:[{jogadorId, energia}] } ou { acertou:false }.
export async function penalizarSpoiler(sessaoId, texto) {
    const linhas = (await pool.query(
        `SELECT e.resposta FROM sessao_enigma se JOIN enigma e ON e.id = se.enigma_id
          WHERE se.sessao_id = $1`, [sessaoId],
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

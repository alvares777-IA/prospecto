const router = require('express').Router();
const { pool } = require('../db');

// ── GET /api/leads ──────────────────────────────────────────────────────────
router.get('/leads', async (req, res) => {
    try {
        const { status, busca, campanha_id, pagina = 1 } = req.query;
        const limit = Math.min(parseInt(req.query.por_pagina) || 20, 100);
        const offset = (Math.max(parseInt(pagina), 1) - 1) * limit;

        const cond = [];
        const params = [];

        if (status) {
            params.push(status);
            cond.push(`l.status = $${params.length}`);
        }
        if (busca) {
            params.push(`%${busca}%`);
            const p = params.length;
            cond.push(`(l.nome ILIKE $${p} OR l.telefone ILIKE $${p} OR l.empresa ILIKE $${p})`);
        }
        if (campanha_id) {
            params.push(parseInt(campanha_id));
            cond.push(`l.campanha_id = $${params.length}`);
        }

        const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';

        const [{ rows }, { rows: ct }] = await Promise.all([
            pool.query(
                `SELECT l.id, l.telefone, l.nome, l.empresa, l.cargo, l.email,
                        l.status, l.origem, l.observacoes, l.campanha_id,
                        c.descricao AS campanha_descricao, l.criado_em
                 FROM leads l
                 LEFT JOIN campanhas c ON c.id = l.campanha_id
                 ${where}
                 ORDER BY l.criado_em DESC
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limit, offset]
            ),
            pool.query(`SELECT COUNT(*) AS total FROM leads l ${where}`, params),
        ]);

        res.json({
            total: parseInt(ct[0].total),
            pagina: Math.max(parseInt(pagina), 1),
            por_pagina: limit,
            dados: rows,
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── GET /api/leads/:id ──────────────────────────────────────────────────────
router.get('/leads/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT l.id, l.telefone, l.nome, l.empresa, l.cargo, l.email,
                    l.status, l.origem, l.observacoes, l.campanha_id,
                    c.descricao AS campanha_descricao, l.criado_em
             FROM leads l
             LEFT JOIN campanhas c ON c.id = l.campanha_id
             WHERE l.id = $1`,
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ erro: 'Lead não encontrado.' });

        const { rows: historico } = await pool.query(
            `SELECT status_lead, dt_status FROM leads_status WHERE id_lead = $1 ORDER BY dt_status DESC`,
            [req.params.id]
        );

        res.json({ ...rows[0], historico_status: historico });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── GET /api/campanhas ──────────────────────────────────────────────────────
router.get('/campanhas', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT c.id, c.descricao, c.texto, c.criado_em,
                    COUNT(l.id)::int AS total_leads
             FROM campanhas c
             LEFT JOIN leads l ON l.campanha_id = c.id
             GROUP BY c.id
             ORDER BY c.id`
        );
        res.json({ total: rows.length, dados: rows });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── GET /api/campanhas/:id ──────────────────────────────────────────────────
router.get('/campanhas/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT c.id, c.descricao, c.texto, c.criado_em,
                    COUNT(l.id)::int AS total_leads
             FROM campanhas c
             LEFT JOIN leads l ON l.campanha_id = c.id
             WHERE c.id = $1
             GROUP BY c.id`,
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ erro: 'Campanha não encontrada.' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── GET /api/usuarios ──────────────────────────────────────────────────────
router.get('/usuarios', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, nome, email, perfil, ativo, avatar,
                    google_id IS NOT NULL AS tem_google
             FROM usuarios
             ORDER BY id`
        );
        res.json({ total: rows.length, dados: rows });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── GET /api/usuarios/:id ──────────────────────────────────────────────────
router.get('/usuarios/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, nome, email, perfil, ativo, avatar,
                    google_id IS NOT NULL AS tem_google
             FROM usuarios WHERE id = $1`,
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ── GET /api/leads-status ──────────────────────────────────────────────────
router.get('/leads-status', async (req, res) => {
    try {
        const { lead_id, pagina = 1 } = req.query;
        const limit = 50;
        const offset = (Math.max(parseInt(pagina), 1) - 1) * limit;

        const cond = [];
        const params = [];

        if (lead_id) {
            params.push(parseInt(lead_id));
            cond.push(`ls.id_lead = $${params.length}`);
        }

        const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';

        const [{ rows }, { rows: ct }] = await Promise.all([
            pool.query(
                `SELECT ls.id, ls.id_lead, ls.status_lead, ls.dt_status,
                        l.nome AS lead_nome, l.telefone AS lead_telefone
                 FROM leads_status ls
                 JOIN leads l ON l.id = ls.id_lead
                 ${where}
                 ORDER BY ls.dt_status DESC
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limit, offset]
            ),
            pool.query(
                `SELECT COUNT(*) AS total FROM leads_status ls ${where}`,
                params
            ),
        ]);

        res.json({
            total: parseInt(ct[0].total),
            pagina: Math.max(parseInt(pagina), 1),
            por_pagina: limit,
            dados: rows,
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

module.exports = router;

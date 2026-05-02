const router = require('express').Router();
const { pool } = require('../db');
const { requireLogin } = require('../middleware/auth');

router.get('/', requireLogin, async (req, res) => {
    const { rows } = await pool.query(
        `SELECT status, COUNT(*)::int AS total FROM leads GROUP BY status`
    );
    const totais = {};
    let geral = 0;
    rows.forEach(r => { totais[r.status] = r.total; geral += r.total; });
    res.render('dashboard', { title: 'Dashboard', page: 'dashboard', totais, geral });
});

router.get('/periodo', requireLogin, async (req, res) => {
    const dias = Math.max(1, Math.min(365, parseInt(req.query.dias) || 30));
    const { rows } = await pool.query(
        `SELECT status, COUNT(*)::int AS total FROM leads
         WHERE criado_em >= NOW() - INTERVAL '1 day' * $1
         GROUP BY status`,
        [dias]
    );
    res.json(rows);
});

module.exports = router;

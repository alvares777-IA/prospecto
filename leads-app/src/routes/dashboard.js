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

module.exports = router;

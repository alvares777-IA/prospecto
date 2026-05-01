const router = require('express').Router();
const { pool } = require('../db');
const { requireLogin, requirePerfil } = require('../middleware/auth');

// ── Listagem ───────────────────────────────────────────────────
router.get('/', requireLogin, requirePerfil('supervisor'), async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM campanhas ORDER BY id');
    res.render('campanhas/index', { title: 'Campanhas', page: 'campanhas', campanhas: rows });
});

// ── Nova ───────────────────────────────────────────────────────
router.get('/nova', requireLogin, requirePerfil('supervisor'), (req, res) => {
    res.render('campanhas/form', { title: 'Nova Campanha', page: 'campanhas', campanha: null, erro: null });
});

router.post('/nova', requireLogin, requirePerfil('supervisor'), async (req, res) => {
    const { descricao, texto } = req.body;
    if (!descricao?.trim() || !texto?.trim()) {
        return res.render('campanhas/form', { title: 'Nova Campanha', page: 'campanhas', campanha: req.body, erro: 'Descrição e texto são obrigatórios.' });
    }
    await pool.query('INSERT INTO campanhas (descricao, texto) VALUES ($1, $2)', [descricao.trim(), texto.trim()]);
    req.session.flash = { sucesso: 'Campanha criada com sucesso.' };
    res.redirect('/campanhas');
});

// ── Editar ─────────────────────────────────────────────────────
router.get('/:id/editar', requireLogin, requirePerfil('supervisor'), async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM campanhas WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.redirect('/campanhas');
    res.render('campanhas/form', { title: 'Editar Campanha', page: 'campanhas', campanha: rows[0], erro: null });
});

router.post('/:id/editar', requireLogin, requirePerfil('supervisor'), async (req, res) => {
    const { descricao, texto } = req.body;
    if (!descricao?.trim() || !texto?.trim()) {
        const { rows } = await pool.query('SELECT * FROM campanhas WHERE id = $1', [req.params.id]);
        return res.render('campanhas/form', { title: 'Editar Campanha', page: 'campanhas', campanha: { ...rows[0], ...req.body }, erro: 'Descrição e texto são obrigatórios.' });
    }
    await pool.query('UPDATE campanhas SET descricao=$1, texto=$2 WHERE id=$3', [descricao.trim(), texto.trim(), req.params.id]);
    req.session.flash = { sucesso: 'Campanha atualizada com sucesso.' };
    res.redirect('/campanhas');
});

// ── Excluir ────────────────────────────────────────────────────
router.post('/:id/excluir', requireLogin, requirePerfil('admin'), async (req, res) => {
    try {
        await pool.query('DELETE FROM campanhas WHERE id = $1', [req.params.id]);
        req.session.flash = { sucesso: 'Campanha excluída.' };
    } catch (err) {
        req.session.flash = { erro: 'Não é possível excluir uma campanha que possui leads vinculados.' };
    }
    res.redirect('/campanhas');
});

module.exports = router;

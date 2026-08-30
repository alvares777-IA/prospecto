const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
    res.redirect(req.session.usuario ? '/jogo' : '/entrar');
});

router.get('/entrar', (req, res) => {
    if (req.session.usuario) return res.redirect('/jogo');
    res.render('entrar', { layout: false, erro: null });
});

router.post('/entrar', async (req, res) => {
    const render = (erro) => res.render('entrar', { layout: false, erro });
    const { email, senha } = req.body;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM jv_usuarios WHERE email = $1 AND ativo = true',
            [String(email || '').toLowerCase().trim()]
        );
        const u = rows[0];
        if (!u || !(await bcrypt.compare(senha || '', u.senha_hash))) {
            return render('E-mail ou senha incorretos.');
        }
        req.session.usuario = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
        res.redirect('/jogo');
    } catch (err) {
        console.error(err);
        render('Erro interno. Tente novamente.');
    }
});

router.post('/sair', (req, res) => {
    req.session.destroy(() => res.redirect('/entrar'));
});

module.exports = router;

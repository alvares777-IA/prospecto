const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

router.get('/', (req, res) => res.redirect('/dashboard'));

router.get('/login', (req, res) => {
    if (req.session.usuario) return res.redirect('/dashboard');
    res.render('login', { layout: false, erro: null });
});

router.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1 AND ativo = true',
            [email.toLowerCase().trim()]
        );
        const u = rows[0];
        if (!u || !await bcrypt.compare(senha, u.senha_hash)) {
            return res.render('login', { layout: false, erro: 'E-mail ou senha incorretos.' });
        }
        req.session.usuario = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.render('login', { layout: false, erro: 'Erro interno. Tente novamente.' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;

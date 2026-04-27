const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireLogin, requirePerfil } = require('../middleware/auth');

const PERFIS = ['admin', 'supervisor', 'operador'];

router.get('/', requireLogin, requirePerfil('admin'), async (req, res) => {
    const { rows } = await pool.query('SELECT id, nome, email, perfil, ativo FROM usuarios ORDER BY nome');
    res.render('usuarios/index', { title: 'Usuários', page: 'usuarios', usuarios: rows });
});

router.get('/novo', requireLogin, requirePerfil('admin'), (req, res) => {
    res.render('usuarios/form', { title: 'Novo Usuário', page: 'usuarios', usuario: null, PERFIS, erro: null });
});

router.post('/novo', requireLogin, requirePerfil('admin'), async (req, res) => {
    const { nome, email, senha, perfil } = req.body;
    try {
        const hash = await bcrypt.hash(senha, 12);
        await pool.query(
            'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1,$2,$3,$4)',
            [nome.trim(), email.toLowerCase().trim(), hash, perfil]
        );
        req.session.flash = { sucesso: 'Usuário criado com sucesso.' };
        res.redirect('/usuarios');
    } catch (err) {
        const erro = err.code === '23505' ? 'E-mail já cadastrado.' : 'Erro ao salvar.';
        res.render('usuarios/form', { title: 'Novo Usuário', page: 'usuarios', usuario: req.body, PERFIS, erro });
    }
});

router.get('/:id/editar', requireLogin, requirePerfil('admin'), async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.redirect('/usuarios');
    res.render('usuarios/form', { title: 'Editar Usuário', page: 'usuarios', usuario: rows[0], PERFIS, erro: null });
});

router.post('/:id/editar', requireLogin, requirePerfil('admin'), async (req, res) => {
    const { nome, email, senha, perfil, ativo } = req.body;
    const id = req.params.id;
    try {
        if (senha && senha.trim()) {
            const hash = await bcrypt.hash(senha, 12);
            await pool.query(
                'UPDATE usuarios SET nome=$1, email=$2, senha_hash=$3, perfil=$4, ativo=$5 WHERE id=$6',
                [nome.trim(), email.toLowerCase().trim(), hash, perfil, ativo === 'true', id]
            );
        } else {
            await pool.query(
                'UPDATE usuarios SET nome=$1, email=$2, perfil=$3, ativo=$4 WHERE id=$5',
                [nome.trim(), email.toLowerCase().trim(), perfil, ativo === 'true', id]
            );
        }
        req.session.flash = { sucesso: 'Usuário atualizado.' };
        res.redirect('/usuarios');
    } catch (err) {
        const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        const erro = err.code === '23505' ? 'E-mail já cadastrado.' : 'Erro ao salvar.';
        res.render('usuarios/form', { title: 'Editar Usuário', page: 'usuarios', usuario: { ...rows[0], ...req.body }, PERFIS, erro });
    }
});

module.exports = router;

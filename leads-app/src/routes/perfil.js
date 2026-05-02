const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { pool } = require('../db');
const { requireLogin } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/avatars');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
        cb(null, `avatar_${req.session.usuario.id}_${Date.now()}${ext || '.jpg'}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype)) return cb(null, true);
        cb(new Error('Somente imagens são permitidas (JPEG, PNG, GIF, WebP).'));
    },
});

async function loadUser(id) {
    const { rows } = await pool.query(
        `SELECT id, nome, email, perfil, avatar,
                google_id IS NOT NULL                AS tem_google,
                (senha_hash LIKE '$2%')              AS tem_senha_local
         FROM usuarios WHERE id = $1`, [id]);
    return rows[0];
}

function render(res, u, erro, sucesso, section) {
    res.render('perfil', {
        title: 'Meu Perfil',
        page: 'perfil',
        usuario_perfil: u,
        erro, sucesso, section: section || null,
    });
}

// GET /perfil
router.get('/', requireLogin, async (req, res) => {
    const u = await loadUser(req.session.usuario.id);
    render(res, u, null, null, null);
});

// POST /perfil/nome
router.post('/nome', requireLogin, async (req, res) => {
    const { nome } = req.body;
    let erro = null, sucesso = null;
    try {
        if (!nome || !nome.trim()) throw new Error('O nome não pode estar vazio.');
        await pool.query('UPDATE usuarios SET nome = $1 WHERE id = $2', [nome.trim(), req.session.usuario.id]);
        req.session.usuario.nome = nome.trim();
        sucesso = 'Nome atualizado com sucesso.';
    } catch (err) {
        erro = err.message || 'Erro ao atualizar nome.';
    }
    const u = await loadUser(req.session.usuario.id);
    render(res, u, erro, sucesso, 'nome');
});

// POST /perfil/senha
router.post('/senha', requireLogin, async (req, res) => {
    const { senha_atual, senha_nova, senha_confirmacao } = req.body;
    let erro = null, sucesso = null;
    try {
        const { rows } = await pool.query('SELECT senha_hash FROM usuarios WHERE id = $1', [req.session.usuario.id]);
        const hash = rows[0]?.senha_hash || '';
        if (!/^\$2[ab]\$/.test(hash)) throw new Error('Sua conta não usa senha local. Use o método de login original.');
        const ok = await bcrypt.compare(senha_atual, hash);
        if (!ok) throw new Error('Senha atual incorreta.');
        if (!senha_nova || senha_nova.length < 8) throw new Error('A nova senha deve ter pelo menos 8 caracteres.');
        if (senha_nova !== senha_confirmacao) throw new Error('As senhas não coincidem.');
        const novoHash = await bcrypt.hash(senha_nova, 12);
        await pool.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [novoHash, req.session.usuario.id]);
        sucesso = 'Senha alterada com sucesso.';
    } catch (err) {
        erro = err.message || 'Erro ao alterar senha.';
    }
    const u = await loadUser(req.session.usuario.id);
    render(res, u, erro, sucesso, 'senha');
});

// POST /perfil/avatar
router.post('/avatar', requireLogin, (req, res) => {
    upload.single('avatar')(req, res, async (err) => {
        let erro = null, sucesso = null;
        try {
            if (err) throw err;
            if (!req.file) throw new Error('Nenhum arquivo enviado.');

            // Remove avatar anterior se existir
            const { rows } = await pool.query('SELECT avatar FROM usuarios WHERE id = $1', [req.session.usuario.id]);
            const avatarAntigo = rows[0]?.avatar;
            if (avatarAntigo) {
                const oldFile = path.join(__dirname, '../../uploads', avatarAntigo.replace(/^\/uploads\//, ''));
                fs.unlink(oldFile, () => {});
            }

            const avatarPath = `/uploads/avatars/${req.file.filename}`;
            await pool.query('UPDATE usuarios SET avatar = $1 WHERE id = $2', [avatarPath, req.session.usuario.id]);
            req.session.usuario.avatar = avatarPath;
            sucesso = 'Foto atualizada com sucesso.';
        } catch (err2) {
            erro = err2.message || 'Erro ao fazer upload.';
        }
        const u = await loadUser(req.session.usuario.id);
        render(res, u, erro, sucesso, 'avatar');
    });
});

// POST /perfil/desvincular-google
router.post('/desvincular-google', requireLogin, async (req, res) => {
    const { senha_nova, senha_confirmacao } = req.body;
    let erro = null, sucesso = null;
    try {
        const { rows } = await pool.query(
            'SELECT google_id, senha_hash FROM usuarios WHERE id = $1',
            [req.session.usuario.id]);
        const u = rows[0];
        if (!u?.google_id) throw new Error('Esta conta não está vinculada ao Google.');
        if (/^\$2[ab]\$/.test(u.senha_hash)) throw new Error('Esta conta já tem senha local. Use "Trocar senha".');
        if (!senha_nova || senha_nova.length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
        if (senha_nova !== senha_confirmacao) throw new Error('As senhas não coincidem.');

        const novoHash = await bcrypt.hash(senha_nova, 12);
        await pool.query(
            'UPDATE usuarios SET senha_hash = $1, google_id = NULL WHERE id = $2',
            [novoHash, req.session.usuario.id]);
        sucesso = 'Google desvinculado. Agora você pode fazer login com e-mail e senha.';
    } catch (err) {
        erro = err.message || 'Erro ao desvincular.';
    }
    const user = await loadUser(req.session.usuario.id);
    render(res, user, erro, sucesso, 'senha');
});

// POST /perfil/avatar/remover
router.post('/avatar/remover', requireLogin, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT avatar FROM usuarios WHERE id = $1', [req.session.usuario.id]);
        if (rows[0]?.avatar) {
            const oldFile = path.join(__dirname, '../../uploads', rows[0].avatar.replace(/^\/uploads\//, ''));
            fs.unlink(oldFile, () => {});
        }
        await pool.query('UPDATE usuarios SET avatar = NULL WHERE id = $1', [req.session.usuario.id]);
        req.session.usuario.avatar = null;
        req.session.flash = { sucesso: 'Foto removida.' };
    } catch {
        req.session.flash = { erro: 'Erro ao remover foto.' };
    }
    res.redirect('/perfil');
});

module.exports = router;

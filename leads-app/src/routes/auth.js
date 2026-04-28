const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const nodemailer = require('nodemailer');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { pool } = require('../db');

const SALT_ROUNDS  = 12;
const BCRYPT_RE    = /^\$2[ab]\$/;

// ── Email ─────────────────────────────────────────────────────────────────────
async function sendMail(to, subject, html) {
    if (!process.env.SMTP_HOST) {
        console.warn('[email] SMTP_HOST não configurado — e-mail não enviado para', to);
        return;
    }
    const transport = nodemailer.createTransport({
        host:   process.env.SMTP_HOST,
        port:   Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
}

// ── Google OAuth ──────────────────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID) {
    passport.use(new GoogleStrategy({
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  `${process.env.APP_URL}/auth/google/callback`,
    }, async (_at, _rt, profile, done) => {
        try {
            const email    = profile.emails?.[0]?.value;
            const googleId = profile.id;
            const nome     = profile.displayName;

            // 1. Já tem conta vinculada ao Google
            let { rows } = await pool.query(
                'SELECT * FROM usuarios WHERE google_id = $1 AND ativo = true', [googleId]);
            if (rows[0]) {
                const u = rows[0];
                return done(null, { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil });
            }

            // 2. Tem conta com o mesmo e-mail → vincula o Google
            ({ rows } = await pool.query(
                'SELECT * FROM usuarios WHERE email = $1 AND ativo = true', [email]));
            if (rows[0]) {
                const u = rows[0];
                await pool.query('UPDATE usuarios SET google_id = $1 WHERE id = $2', [googleId, u.id]);
                return done(null, { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil });
            }

            // 3. Cria conta nova com perfil padrão
            const { rows: nr } = await pool.query(
                `INSERT INTO usuarios (nome, email, senha_hash, google_id, perfil, ativo)
                 VALUES ($1, $2, $3, $4, 'usuario', true) RETURNING *`,
                [nome, email, '$google$', googleId]);
            const u = nr[0];
            return done(null, { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil });
        } catch (err) { return done(err); }
    }));
}

// ── Rotas básicas ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => res.redirect('/dashboard'));

router.get('/login', (req, res) => {
    if (req.session.usuario) return res.redirect('/dashboard');
    const erroGoogle = req.query.erro === 'google' ? 'Não foi possível autenticar com o Google.' : null;
    res.render('login', {
        layout: false,
        erro: erroGoogle,
        sucesso: null,
        googleEnabled: !!process.env.GOOGLE_CLIENT_ID,
    });
});

router.post('/login', async (req, res) => {
    const render = (erro) => res.render('login', { layout: false, erro, sucesso: null, googleEnabled: !!process.env.GOOGLE_CLIENT_ID });
    const { email, senha } = req.body;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1 AND ativo = true',
            [email.toLowerCase().trim()]);
        const u = rows[0];
        if (!u) return render('E-mail ou senha incorretos.');

        const isHash = BCRYPT_RE.test(u.senha_hash);
        let ok = false;

        if (isHash) {
            ok = await bcrypt.compare(senha, u.senha_hash);
        } else {
            // Senha em texto puro — compara e faz upgrade automático para hash
            ok = senha === u.senha_hash;
            if (ok) {
                const hash = await bcrypt.hash(senha, SALT_ROUNDS);
                await pool.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, u.id]);
            }
        }

        if (!ok) return render('E-mail ou senha incorretos.');

        req.session.usuario = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        render('Erro interno. Tente novamente.');
    }
});

// ── Esqueci minha senha ───────────────────────────────────────────────────────
router.get('/esqueci-senha', (req, res) => {
    if (req.session.usuario) return res.redirect('/dashboard');
    res.render('esqueci-senha', { layout: false, erro: null, sucesso: null });
});

router.post('/esqueci-senha', async (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    const ok = () => res.render('esqueci-senha', {
        layout: false, erro: null,
        sucesso: 'Se o e-mail estiver cadastrado você receberá o link em instantes.',
    });
    try {
        const { rows } = await pool.query(
            'SELECT id, nome FROM usuarios WHERE email = $1 AND ativo = true', [email]);
        if (!rows[0]) return ok(); // não revelamos se o e-mail existe

        const u     = rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expira = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await pool.query(
            `INSERT INTO tokens_senha (usuario_id, token, expira_em) VALUES ($1, $2, $3)`,
            [u.id, token, expira]);

        const link = `${process.env.APP_URL}/redefinir-senha/${token}`;
        await sendMail(email, 'Redefinição de senha — Prospecto-IA', `
            <p>Olá, <strong>${u.nome}</strong>!</p>
            <p>Clique no link abaixo para redefinir sua senha.
               O link expira em <strong>1 hora</strong>.</p>
            <p><a href="${link}" style="font-size:1.1em">${link}</a></p>
            <p style="color:#888;font-size:.9em">Se você não solicitou a redefinição, ignore este e-mail.</p>
        `);

        ok();
    } catch (err) {
        console.error(err);
        res.render('esqueci-senha', { layout: false, erro: 'Erro ao enviar e-mail. Tente novamente.', sucesso: null });
    }
});

// ── Redefinir senha ───────────────────────────────────────────────────────────
router.get('/redefinir-senha/:token', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id FROM tokens_senha WHERE token = $1 AND usado = false AND expira_em > NOW()`,
            [req.params.token]);
        if (!rows[0]) {
            return res.render('redefinir-senha', { layout: false, token: null, erro: 'Link inválido ou expirado.', sucesso: null });
        }
        res.render('redefinir-senha', { layout: false, token: req.params.token, erro: null, sucesso: null });
    } catch (err) {
        console.error(err);
        res.render('redefinir-senha', { layout: false, token: null, erro: 'Erro interno.', sucesso: null });
    }
});

router.post('/redefinir-senha/:token', async (req, res) => {
    const renderErro = (erro) => res.render('redefinir-senha', { layout: false, token: req.params.token, erro, sucesso: null });
    const { senha, confirmacao } = req.body;

    if (!senha || senha.length < 6) return renderErro('A senha deve ter pelo menos 6 caracteres.');
    if (senha !== confirmacao)       return renderErro('As senhas não coincidem.');

    try {
        const { rows } = await pool.query(
            `SELECT id, usuario_id FROM tokens_senha
             WHERE token = $1 AND usado = false AND expira_em > NOW()`,
            [req.params.token]);
        if (!rows[0]) return renderErro('Link inválido ou expirado.');

        const hash = await bcrypt.hash(senha, SALT_ROUNDS);
        await pool.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, rows[0].usuario_id]);
        await pool.query('UPDATE tokens_senha SET usado = true WHERE id = $1', [rows[0].id]);

        res.render('redefinir-senha', { layout: false, token: null, erro: null, sucesso: 'Senha atualizada! Faça login.' });
    } catch (err) {
        console.error(err);
        renderErro('Erro interno. Tente novamente.');
    }
});

// ── Google OAuth routes ───────────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID) {
    router.get('/auth/google',
        passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

    router.get('/auth/google/callback',
        passport.authenticate('google', { session: false, failureRedirect: '/login?erro=google' }),
        (req, res) => {
            req.session.usuario = req.user;
            res.redirect('/dashboard');
        });
}

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;

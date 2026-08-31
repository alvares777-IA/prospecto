// Sessão HTTP + login. Três formas de entrar:
//   - anônimo: sem conta, sem sessão (o socket cria um jogador efêmero)
//   - e-mail + senha: /cadastro, /login  -> sessão
//   - Google: /auth/google  -> sessão   (só se GOOGLE_CLIENT_* estiverem no .env
//     E a redirect URI estiver liberada no Google Cloud Console)
//
// A sessão é compartilhada com o Socket.IO (ver server/index.js), então o
// socket sabe quem é o jogador logado.

import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { pool } from './db.js';
import * as persistencia from './persistencia.js';

const PgStore = connectPgSimple(session);

export const sessionMiddleware = session({
    name: 'jv.sid',
    store: new PgStore({ pool, tableName: 'sessoes', createTableIfMissing: false }),
    secret: process.env.JV_SESSION_SECRET || 'dev-inseguro',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    },
});

export const googleAtivo = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (googleAtivo) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: (process.env.JV_APP_URL || 'http://localhost:3004') + '/auth/google/callback',
    }, async (_accessToken, _refreshToken, profile, done) => {
        try {
            const { jogador } = await persistencia.upsertGoogle({
                sub: profile.id,
                email: profile.emails?.[0]?.value,
                apelido: profile.displayName,
            });
            done(null, jogador);
        } catch (err) {
            done(err);
        }
    }));
}

function logar(req, jogador) {
    req.session.jogadorId = jogador.id;
    req.session.apelido = jogador.apelido;
    req.session.identificador = jogador.identificador;
}

export function montarAuth(app) {
    app.use(sessionMiddleware);
    app.use(passport.initialize());

    app.get('/eu', (req, res) => {
        if (req.session.jogadorId) {
            res.json({ logado: true, apelido: req.session.apelido, googleAtivo });
        } else {
            res.json({ logado: false, googleAtivo });
        }
    });

    app.post('/cadastro', async (req, res) => {
        const { email, senha, apelido } = req.body || {};
        if (!email || !senha || String(senha).length < 6 || !apelido) {
            return res.status(400).json({ erro: 'Preencha apelido, e-mail e senha (mínimo 6 caracteres).' });
        }
        try {
            const r = await persistencia.criarConta({ email, senha, apelido });
            if (r.erro) return res.status(409).json({ erro: r.erro });
            logar(req, r.jogador);
            res.json({ ok: true });
        } catch (err) {
            console.error('[auth] cadastro:', err);
            res.status(500).json({ erro: 'Erro interno.' });
        }
    });

    app.post('/login', async (req, res) => {
        const { email, senha } = req.body || {};
        if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });
        try {
            const r = await persistencia.loginPorEmail({ email, senha });
            if (r.erro) return res.status(401).json({ erro: r.erro });
            logar(req, r.jogador);
            res.json({ ok: true });
        } catch (err) {
            console.error('[auth] login:', err);
            res.status(500).json({ erro: 'Erro interno.' });
        }
    });

    app.post('/sair', (req, res) => {
        req.session.destroy(() => res.json({ ok: true }));
    });

    // Google — guarda a sala de retorno (se veio de um link /sala/X) na sessão.
    app.get('/auth/google', (req, res, next) => {
        if (!googleAtivo) return res.redirect('/?erro=google_desligado');
        if (req.query.sala) req.session.retornoSala = String(req.query.sala).toUpperCase().slice(0, 12);
        next();
    }, (req, res, next) => passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next));

    app.get('/auth/google/callback',
        (req, res, next) => {
            if (!googleAtivo) return res.redirect('/');
            passport.authenticate('google', { session: false, failureRedirect: '/?erro=google' })(req, res, next);
        },
        (req, res) => {
            logar(req, req.user);
            const sala = req.session.retornoSala;
            delete req.session.retornoSala;
            res.redirect(sala ? '/sala/' + sala : '/');
        });
}

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { pool } = require('./db');

const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    // Nome próprio: o leads-app roda no mesmo domínio (app.prospect.rssc.com.br)
    // com o cookie padrão connect.sid — os dois precisam de nomes distintos.
    name: 'jv.sid',
    store: new pgSession({ pool, tableName: 'jv_sessoes' }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' },
}));

app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    res.locals.flash = req.session.flash || {};
    delete req.session.flash;
    next();
});

app.use('/', require('./routes/auth'));      // /entrar, /sair, GET / (redirect)
app.use('/jogo', require('./routes/jogo'));  // tudo autenticado

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`jogoDaVida rodando na porta ${PORT}`));

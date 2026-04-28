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
    store: new pgSession({ pool, tableName: 'sessoes' }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' }
}));

app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    res.locals.flash = req.session.flash || {};
    delete req.session.flash;
    next();
});

app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/leads', require('./routes/leads'));
app.use('/usuarios', require('./routes/usuarios'));
app.use('/whatsapp', require('./routes/whatsapp'));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`leads-app rodando na porta ${PORT}`));

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const expressLayouts = require('express-ejs-layouts');
const passport = require('passport');
const path = require('path');
const { pool } = require('./db');
const { basicAuth, spec, swaggerUi } = require('./swagger');

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

app.use(passport.initialize());

app.use(async (req, res, next) => {
    try {
        // Sessões criadas antes do campo avatar existir não têm a chave —
        // busca uma vez no banco e persiste na sessão para requisições seguintes.
        if (req.session.usuario && !('avatar' in req.session.usuario)) {
            const { rows } = await pool.query(
                'SELECT avatar FROM usuarios WHERE id = $1', [req.session.usuario.id]);
            req.session.usuario.avatar = rows[0]?.avatar || null;
        }
    } catch { /* se falhar, avatar fica undefined — não quebra o app */ }
    res.locals.usuario = req.session.usuario || null;
    res.locals.flash = req.session.flash || {};
    delete req.session.flash;
    next();
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rota de logout do Swagger — retorna 401 para forçar o browser a limpar as credenciais Basic Auth
app.get('/api-docs/logout', (_req, res) => {
    res.set('WWW-Authenticate', 'Basic realm="Swagger Docs", charset="UTF-8"');
    res.status(401).send('<script>location.href="/api-docs"</script>');
});

const swaggerLogoutJs = `
(function poll() {
  var wrapper = document.querySelector('.topbar-wrapper');
  if (!wrapper) { setTimeout(poll, 300); return; }
  if (document.getElementById('swagger-logout-btn')) return;
  var btn = document.createElement('a');
  btn.id = 'swagger-logout-btn';
  btn.innerText = 'Sair';
  btn.href = '#';
  btn.style.cssText = 'color:#fff;margin-left:auto;padding:6px 16px;background:#c0392b;border-radius:4px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block;';
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    fetch('/api-docs/logout', {
      headers: { 'Authorization': 'Basic ' + btoa('logout:logout') }
    }).finally(function () { location.href = '/api-docs'; });
  });
  wrapper.appendChild(btn);
})();
`;

app.use('/api-docs', basicAuth, swaggerUi.serve, swaggerUi.setup(spec, {
    customSiteTitle: 'Prospecto-IA — API Docs',
    customJsStr: swaggerLogoutJs,
}));
app.use('/api', basicAuth, require('./routes/api'));

app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/leads', require('./routes/leads'));
app.use('/campanhas', require('./routes/campanhas'));
app.use('/usuarios', require('./routes/usuarios'));
app.use('/whatsapp', require('./routes/whatsapp'));
app.use('/perfil', require('./routes/perfil'));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`leads-app rodando na porta ${PORT}`));

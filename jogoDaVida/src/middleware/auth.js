function requireLogin(req, res, next) {
    if (!req.session.usuario) return res.redirect('/entrar');
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.usuario) return res.redirect('/entrar');
    if (req.session.usuario.perfil !== 'admin') {
        req.session.flash = { erro: 'Acesso restrito a administradores.' };
        return res.redirect('/jogo');
    }
    next();
}

module.exports = { requireLogin, requireAdmin };

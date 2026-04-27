const NIVEL = { admin: 3, supervisor: 2, operador: 1 };

function requireLogin(req, res, next) {
    if (!req.session.usuario) return res.redirect('/login');
    next();
}

function requirePerfil(minPerfil) {
    return (req, res, next) => {
        const nivel = NIVEL[req.session.usuario?.perfil] || 0;
        if (nivel >= NIVEL[minPerfil]) return next();
        req.session.flash = { erro: 'Acesso negado.' };
        res.redirect('/dashboard');
    };
}

module.exports = { requireLogin, requirePerfil };

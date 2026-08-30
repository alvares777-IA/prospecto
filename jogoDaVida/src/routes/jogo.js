const express = require('express');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// Landing autenticada. Ponto de partida do desenvolvimento — novas rotas do
// jogo entram todas aqui, sob o prefixo /jogo.
router.get('/', requireLogin, (req, res) => {
    res.render('jogo', { title: 'Jogo da Vida', page: 'jogo' });
});

module.exports = router;

const router = require('express').Router();
const { requireLogin } = require('../middleware/auth');

const EVO_URL  = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
const EVO_KEY  = process.env.EVOLUTION_API_KEY  || '';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'prospecto-wa';

async function evo(path, opts = {}) {
    const res = await fetch(`${EVO_URL}${path}`, {
        ...opts,
        headers: { apikey: EVO_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error(`Evolution API ${res.status}`);
    return res.json();
}

router.get('/', requireLogin, async (req, res) => {
    // Se vier de um desconectar, usa o estado do flash para evitar flicker
    let state = res.locals.flash?.state || null;
    if (!state) {
        try {
            const data = await evo(`/instance/connectionState/${INSTANCE}`);
            state = data?.instance?.state || 'close';
        } catch (_) {
            state = 'close';
        }
    }
    res.render('whatsapp/index', { title: 'WhatsApp', page: 'whatsapp', state });
});

router.get('/status', requireLogin, async (req, res) => {
    try {
        const data = await evo(`/instance/connectionState/${INSTANCE}`);
        res.json({ state: data?.instance?.state || 'close' });
    } catch (_) {
        res.json({ state: 'erro' });
    }
});

router.get('/qrcode', requireLogin, async (req, res) => {
    try {
        const data = await evo(`/instance/connect/${INSTANCE}`);
        res.json({ base64: data?.base64 || null, count: data?.count || 0 });
    } catch (_) {
        res.json({ base64: null, count: 0 });
    }
});

router.post('/desconectar', requireLogin, async (req, res) => {
    try {
        await evo(`/instance/logout/${INSTANCE}`, { method: 'DELETE' });
        req.session.flash = { sucesso: 'WhatsApp desconectado com sucesso.', state: 'close' };
    } catch (_) {
        req.session.flash = { erro: 'Erro ao desconectar. Tente novamente.' };
    }
    res.redirect('/whatsapp');
});

module.exports = router;

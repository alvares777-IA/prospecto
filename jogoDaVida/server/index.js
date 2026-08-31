// Ponto de entrada do servidor.
// Passo 1: Express serve public/.        Passo 2: pool pg + GET /catalogo.
// Passo 4: Socket.IO (presença).         Passo 5: chat por sala.
// Passo 6: persistência.                 Entrega B: salas por código + link.

import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { pool, ping } from './db.js';
import * as sala from './sala.js';
import * as persistencia from './persistencia.js';
import * as jogo from './jogo.js';
import { montarAuth, sessionMiddleware } from './auth.js';
import { montarAdmin } from './admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));   // forms do /admin
app.use(express.static(PUBLIC_DIR));
montarAuth(app);    // sessão + /eu /cadastro /login /sair /auth/google
montarAdmin(app);   // /admin — manutenção das tabelas de apoio

app.get('/health', async (_req, res) => {
    let db = 'ok';
    try { await ping(); } catch { db = 'sem conexão'; }
    res.json({ ok: true, servico: 'jogodavida', db, ts: new Date().toISOString() });
});

app.get('/catalogo', async (_req, res, next) => {
    try {
        const [avatares, eras] = await Promise.all([
            pool.query(`SELECT codigo, nome, arquivo FROM avatar WHERE ativo = 'S' ORDER BY codigo`),
            pool.query(`SELECT codigo, nome, descricao FROM era WHERE disponivel = 'S' ORDER BY codigo`),
        ]);
        res.json({ avatares: avatares.rows, eras: eras.rows });
    } catch (err) {
        next(err);
    }
});

// O link de uma sala é servido pelo mesmo index.html; o cliente lê o código
// da URL e já entra pedindo nome + figura.
app.get('/sala/:codigo', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, _req, res, _next) => {
    console.error('[http] erro não tratado:', err);
    res.status(500).json({ erro: 'interno' });
});

// ── Socket.IO ────────────────────────────────────────────────────────
const httpServer = http.createServer(app);
const io = new Server(httpServer);

// O socket enxerga a mesma sessão HTTP -> sabe se há conta logada.
io.engine.use(sessionMiddleware);

// Código de sala: 5 caracteres, sem 0/O/1/I/L para não confundir na fala.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function gerarCodigo() {
    let c = '';
    do {
        c = Array.from({ length: 5 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
    } while (sala.existe(c));
    return c;
}

// Quem é este socket: conta logada (via sessão) ou anônimo efêmero.
// O anônimo ganha um identificador 'anon:'<uuid> UMA vez por socket, para o
// retry ser idempotente e o disconnect saber o que apagar.
function identidade(socket, dados) {
    const avatar_codigo = String(dados?.avatar_codigo || '').slice(0, 30);
    if (!avatar_codigo) return null;

    const sess = socket.request?.session;
    if (sess?.jogadorId) {
        return {
            identificador: sess.identificador,
            apelido: sess.apelido,
            avatar_codigo,
            anonimo: false,
        };
    }
    const nome = String(dados?.nome || '').trim().slice(0, 64);
    if (!nome) return null;
    if (!socket.data.anonIdent) socket.data.anonIdent = 'anon:' + randomUUID();
    return {
        identificador: socket.data.anonIdent,
        apelido: nome,
        avatar_codigo,
        anonimo: true,
    };
}

async function avatarOk(codigo) {
    try {
        return (await persistencia.avataresValidos()).has(codigo);
    } catch (err) {
        console.warn('[persistencia] catálogo indisponível:', err.message);
        return false;
    }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Grava a entrada e FICA TENTANDO até conseguir (docs: "não pode ter falhas").
// A sala já respondeu ao vivo; isto só destrava o "Iniciar jogo".
async function gravarEntradaComRetry(socket, codigo, ident, criando) {
    const espera = [1000, 2000, 4000, 8000];
    for (let i = 0; socket.connected; i++) {
        try {
            const r = await persistencia.registrarEntradaEmSala({ ...ident, salaCodigo: codigo, criando });
            if (r.erro) { console.warn(`[persistencia] ${codigo}: ${r.erro}`); return; }
            sala.anotarGravacao(socket.id, { presencaId: r.presencaId, jogadorId: r.jogadorId, anonimo: r.anonimo });
            sala.anotarSala(codigo, { sessaoId: r.sessaoId, souCriador: r.souCriador, socketId: socket.id });
            sala.marcarEstado(codigo, r.estado);
            socket.emit('presenca_confirmada', { codigo });
            // entrou numa sala que já começou -> vai pro hall da porta atual
            if (r.estado === 'em_jogo') {
                await entregarHall(socket, r.sessaoId, r.jogadorId);
                transmitirNiveis(codigo, r.sessaoId);
            }
            return;
        } catch (err) {
            console.warn(`[persistencia] ${codigo}: entrada não gravada (tentativa ${i + 1}), repetindo:`, err.message);
            await sleep(espera[Math.min(i, espera.length - 1)]);
        }
    }
}

// Coloca o socket na sala (estado vivo + broadcast) e grava atrás.
function ingressar(socket, codigo, ident, { criando, souCriador, estado }) {
    const jogador = { nome: ident.apelido, avatar_codigo: ident.avatar_codigo };
    socket.join(codigo);
    sala.entrar(codigo, socket.id, jogador, estado);
    socket.emit('sala_pronta', {
        codigo,
        souCriador,
        estado,
        anonimo: ident.anonimo,
        voce: { socketId: socket.id, ...jogador },
        lista: sala.presentes(codigo),
    });
    io.to(codigo).emit('presentes', { codigo, lista: sala.presentes(codigo) });
    console.log(`[io] ${jogador.nome} ${criando ? 'criou' : 'entrou em'} ${codigo} (${sala.presentes(codigo).length})`);

    gravarEntradaComRetry(socket, codigo, ident, criando);
}

// Pedidos de ajuda abertos: `${sessaoId}:${jogadorId do pedinte}` -> { socketId, porta }.
// Some quando o pedinte avança de porta, resolve, ou sai.
const pedidos = new Map();
const chavePedido = (sessaoId, jogadorId) => `${sessaoId}:${jogadorId}`;

function limparPedido(codigo, sessaoId, jogadorId, socketIdPedinte) {
    if (pedidos.delete(chavePedido(sessaoId, jogadorId))) {
        io.to(codigo).emit('ajuda_resolvida', { socketId: socketIdPedinte });
    }
}

// Garante a partida e coloca o jogador no HALL da porta atual (ele decide
// quando "prosseguir" para o enigma).
async function entregarHall(socket, sessaoId, jogadorId) {
    try {
        const st = await jogo.garantirPartida(sessaoId, jogadorId);
        if (st.terminou) return socket.emit('jogo_terminado', { porta: st.total, energia: st.energia });
        socket.emit('hall', { porta: st.porta, total: st.total });
    } catch (err) {
        console.warn('[jogo] entregarHall:', err.message);
    }
}

// Envia a todos da sala o nível (porta) de cada jogador presente.
async function transmitirNiveis(codigo, sessaoId) {
    try {
        const rows = await jogo.niveis(sessaoId);
        const porJid = new Map(rows.map(r => [String(r.jogador_id), r]));
        const lista = [...(io.sockets.adapter.rooms.get(codigo) || [])].map(sid => {
            const mb = sala.buscar(sid);
            if (!mb?.jogadorId) return null;
            const n = porJid.get(String(mb.jogadorId));
            return { socketId: sid, nome: mb.nome, porta: n?.porta ?? null, terminou: !!n?.terminou };
        }).filter(Boolean);
        io.to(codigo).emit('niveis', { lista });
    } catch (err) {
        console.warn('[jogo] transmitirNiveis:', err.message);
    }
}

io.on('connection', (socket) => {
    console.log(`[io] conectou ${socket.id}`);

    socket.on('criar_sala', async (dados) => {
        const ident = identidade(socket, dados);
        if (!ident || !(await avatarOk(ident.avatar_codigo))) return;
        ingressar(socket, gerarCodigo(), ident, { criando: true, souCriador: true, estado: 'aguardando' });
    });

    socket.on('entrar_sala', async (dados) => {
        const ident = identidade(socket, dados);
        if (!ident || !(await avatarOk(ident.avatar_codigo))) return;

        const codigo = String(dados?.codigo || '').trim().toUpperCase().slice(0, 12);
        if (!codigo) return socket.emit('erro_sala', { motivo: 'Digite o código da sala.' });

        // Aceita se a sala está viva na memória; senão confirma no banco.
        let estado = sala.metaDe(codigo)?.estado;
        if (estado === undefined) {
            const info = await persistencia.salaInfo(codigo);
            if (!info) return socket.emit('erro_sala', { motivo: 'Sala não encontrada.' });
            estado = info.estado;
        }
        ingressar(socket, codigo, ident, { criando: false, souCriador: false, estado });
    });

    socket.on('iniciar_jogo', async () => {
        const codigo = sala.salaDe(socket.id);
        if (!codigo || !sala.ehCriador(socket.id)) return;          // só o criador
        if (sala.presencaDe(socket.id) == null) return;             // presença ainda não confirmada
        const m = sala.metaDe(codigo);
        if (!m || m.estado === 'em_jogo' || !m.sessaoId) return;

        try {
            await persistencia.iniciarJogo(m.sessaoId);
            await jogo.iniciarSala(m.sessaoId);        // gera a sequência de enigmas
        } catch (err) {
            console.warn('[jogo] iniciar falhou:', err.message);
            return socket.emit('erro_sala', { motivo: 'Não consegui iniciar agora. Tente de novo.' });
        }
        sala.marcarEstado(codigo, 'em_jogo');
        io.to(codigo).emit('jogo_iniciado', { codigo });
        console.log(`[io] jogo iniciado em ${codigo}`);

        // cada jogador presente e confirmado vai pro hall da porta 1
        for (const sid of io.sockets.adapter.rooms.get(codigo) || []) {
            const jid = sala.buscar(sid)?.jogadorId;
            if (jid) await entregarHall(io.sockets.sockets.get(sid), m.sessaoId, jid);
        }
        transmitirNiveis(codigo, m.sessaoId);
    });

    // contexto de jogo do socket, ou null
    function ctxJogo() {
        const codigo = sala.salaDe(socket.id);
        const eu = sala.buscar(socket.id);
        const m = sala.metaDe(codigo || '');
        if (!codigo || !eu?.jogadorId || m?.estado !== 'em_jogo') return null;
        return { codigo, eu, sessaoId: m.sessaoId };
    }

    socket.on('responder', async (dados) => {
        const c = ctxJogo();
        if (!c) return;
        try {
            const r = await jogo.responder(c.sessaoId, c.eu.jogadorId, String(dados?.resposta ?? '').slice(0, 120));
            if (r.erro) return;
            if (r.correta) {
                limparPedido(c.codigo, c.sessaoId, c.eu.jogadorId, socket.id);   // avançou -> pedido some
                io.to(c.codigo).emit('porta_alcancada', { jogador: c.eu.nome, socketId: socket.id, porta: r.porta });
                if (r.terminou) socket.emit('jogo_terminado', { porta: r.porta - 1, energia: r.energia });
                else socket.emit('hall', { porta: r.porta });   // hall antes da próxima porta
                transmitirNiveis(c.codigo, c.sessaoId);
            } else {
                socket.emit('resposta_errada', { energia: r.energia });
            }
        } catch (err) { console.warn('[jogo] responder:', err.message); }
    });

    socket.on('prosseguir', async () => {
        const c = ctxJogo();
        if (!c) return;
        try {
            socket.emit('meu_enigma', await jogo.estado(c.sessaoId, c.eu.jogadorId));
        } catch (err) { console.warn('[jogo] prosseguir:', err.message); }
    });

    socket.on('pedir_ajuda', async () => {
        const c = ctxJogo();
        if (!c) return;
        try {
            const r = await jogo.pedirAjuda(c.sessaoId, c.eu.jogadorId);
            if (r.erro) return;
            pedidos.set(chavePedido(c.sessaoId, c.eu.jogadorId), { socketId: socket.id, porta: r.porta });
            socket.emit('energia', { energia: r.energia });
            io.to(c.codigo).emit('pediu_ajuda', { jogador: c.eu.nome, socketId: socket.id, porta: r.porta });
        } catch (err) { console.warn('[jogo] pedir_ajuda:', err.message); }
    });

    // Alvo de uma ação de ajuda: valida que ele tem um pedido aberto.
    function alvoComPedido(sessaoId, paraSocketId) {
        const s = io.sockets.sockets.get(String(paraSocketId || ''));
        const a = sala.buscar(s?.id || '');
        if (!a?.jogadorId) return null;
        if (!pedidos.has(chavePedido(sessaoId, a.jogadorId))) return null;
        return { socket: s, jogadorId: a.jogadorId, nome: a.nome };
    }

    socket.on('dar_ajuda', async (dados) => {
        const c = ctxJogo();
        const alvoSocket = io.sockets.sockets.get(String(dados?.paraSocketId || ''));
        const alvo = sala.buscar(alvoSocket?.id || '');
        if (!c || !alvo?.jogadorId || alvo.jogadorId === c.eu.jogadorId) return;
        try {
            const r = await jogo.darAjuda(c.sessaoId, c.eu.jogadorId, alvo.jogadorId);
            if (r.erro) return;
            socket.emit('energia', { energia: r.energiaDe });
            // a resposta vai SÓ para quem pediu (não abre o chat da sala)
            alvoSocket.emit('ajuda_recebida', { de: c.eu.nome, porta: r.portaPara, resposta: r.resposta });
            io.to(c.codigo).emit('ajudou', { de: c.eu.nome, para: alvo.nome });   // feed: sem a resposta
        } catch (err) { console.warn('[jogo] dar_ajuda:', err.message); }
    });

    socket.on('oferecer_ajuda', async (dados) => {
        const c = ctxJogo();
        if (!c) return;
        const alvo = alvoComPedido(c.sessaoId, dados?.paraSocketId);
        if (!alvo || alvo.jogadorId === c.eu.jogadorId) return;
        try {
            const r = await jogo.oferecerAjuda(c.sessaoId, c.eu.jogadorId, alvo.jogadorId);
            if (r.erro) return;
            // chat abre só para os dois envolvidos na ajuda, não para a sala toda
            socket.emit('chat_liberado', { codigo: c.codigo });
            alvo.socket.emit('chat_liberado', { codigo: c.codigo });
            io.to(c.codigo).emit('ofereceu_ajuda', { de: c.eu.nome, para: alvo.nome, socketId: socket.id });
        } catch (err) { console.warn('[jogo] oferecer_ajuda:', err.message); }
    });

    socket.on('nao_ajudar', async (dados) => {
        const c = ctxJogo();
        if (!c) return;
        const alvo = alvoComPedido(c.sessaoId, dados?.paraSocketId);
        if (!alvo || alvo.jogadorId === c.eu.jogadorId) return;
        try {
            const r = await jogo.recusarAjuda(c.sessaoId, c.eu.jogadorId, alvo.jogadorId);
            if (r.erro) return;
            socket.emit('energia', { energia: r.energia });
            io.to(c.codigo).emit('recusou_ajuda', {
                de: c.eu.nome, para: alvo.nome, socketId: socket.id, alvoSocketId: alvo.socket.id,
            });
        } catch (err) { console.warn('[jogo] nao_ajudar:', err.message); }
    });

    socket.on('mensagem', async (dados) => {
        const codigo = sala.salaDe(socket.id);
        const jogador = sala.buscar(socket.id);
        if (!codigo || !jogador) return;
        const texto = String(dados?.texto || '').trim().slice(0, 500);
        if (!texto) return;
        io.to(codigo).emit('mensagem', {
            de: jogador.nome,
            avatar_codigo: jogador.avatar_codigo,
            texto,
            ts: Date.now(),
        });

        // Resposta no chat -> desconto de TODOS os jogadores da sala.
        const m = sala.metaDe(codigo);
        if (m?.estado !== 'em_jogo') return;
        try {
            const r = await jogo.penalizarSpoiler(m.sessaoId, texto);
            if (!r.acertou) return;
            io.to(codigo).emit('spoiler_chat', { jogador: jogador.nome, penalidade: r.penalidade });
            for (const { jogadorId, energia } of r.jogadores) {
                if (energia == null) continue;
                const sid = [...(io.sockets.adapter.rooms.get(codigo) || [])]
                    .find(s => sala.buscar(s)?.jogadorId === jogadorId);
                const s = sid && io.sockets.sockets.get(sid);
                s?.emit('energia', { energia: Math.round(energia * 10) / 10 });
                if (energia <= 0) s?.emit('sem_energia');
            }
        } catch (err) { console.warn('[jogo] spoiler:', err.message); }
    });

    socket.on('disconnect', () => {
        const saiu = sala.sair(socket.id);
        if (saiu) {
            io.to(saiu.codigo).emit('presentes', { codigo: saiu.codigo, lista: sala.presentes(saiu.codigo) });
            const m = saiu.membro;
            const meta = sala.metaDe(saiu.codigo);
            if (meta?.sessaoId && m.jogadorId) limparPedido(saiu.codigo, meta.sessaoId, m.jogadorId, socket.id);
            if (m.anonimo) {
                // anônimo "perde tudo ao sair"
                persistencia.apagarAnonimo(m.jogadorId);
            } else {
                persistencia.registrarSaida(m.presencaId)
                    .catch(err => console.warn('[persistencia] saída não gravada:', err.message));
            }
        }
        console.log(`[io] desconectou ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3004;
httpServer.listen(PORT, () => {
    console.log(`jogoDaVida — servidor no ar em http://localhost:${PORT}`);
});

// Relógio de energia: a cada 20s aplica o decaimento e avisa cada jogador em
// jogo. Quem zera recebe `sem_energia` (o settle já marca dt_fim).
setInterval(async () => {
    for (const { codigo, sessaoId } of sala.emJogo()) {
        for (const sid of io.sockets.adapter.rooms.get(codigo) || []) {
            const jid = sala.buscar(sid)?.jogadorId;
            if (!jid) continue;
            try {
                const energia = await jogo.tique(sessaoId, jid);
                if (energia === null) continue;
                const s = io.sockets.sockets.get(sid);
                s?.emit('energia', { energia: Math.round(energia * 10) / 10 });
                if (energia <= 0) s?.emit('sem_energia');
            } catch (err) {
                console.warn('[jogo] tique:', err.message);
            }
        }
    }
}, 20000);

// Shutdown limpo: fecha as sessões abertas deste processo. Dispara no
// `docker stop` (SIGTERM); não no reload do nodemon (SIGUSR2) — a sessão
// sobrevive ao hot-reload, que é o que queremos.
for (const sinal of ['SIGTERM', 'SIGINT']) {
    process.on(sinal, async () => {
        try { await persistencia.encerrarSessoes(); }
        catch (err) { console.warn('[persistencia] não encerrou sessões:', err.message); }
        process.exit(0);
    });
}

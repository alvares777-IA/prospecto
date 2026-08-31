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
import { montarAuth, sessionMiddleware } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));
montarAuth(app);   // sessão + /eu /cadastro /login /sair /auth/google

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
        } catch (err) {
            console.warn('[persistencia] iniciarJogo falhou:', err.message);
            return socket.emit('erro_sala', { motivo: 'Não consegui iniciar agora. Tente de novo.' });
        }
        sala.marcarEstado(codigo, 'em_jogo');
        io.to(codigo).emit('jogo_iniciado', { codigo });
        console.log(`[io] jogo iniciado em ${codigo}`);
    });

    socket.on('mensagem', (dados) => {
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
    });

    socket.on('disconnect', () => {
        const saiu = sala.sair(socket.id);
        if (saiu) {
            io.to(saiu.codigo).emit('presentes', { codigo: saiu.codigo, lista: sala.presentes(saiu.codigo) });
            const m = saiu.membro;
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

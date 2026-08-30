// Ponto de entrada do servidor.
// Passo 1: Express serve public/.        Passo 2: pool pg + GET /catalogo.
// Passo 4: Socket.IO (presença).         Passo 5: chat por sala.
// Passo 6: persistência.                 Entrega B: salas por código + link.

import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { pool, ping } from './db.js';
import * as sala from './sala.js';
import * as persistencia from './persistencia.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.use(express.static(PUBLIC_DIR));

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

// Código de sala: 5 caracteres, sem 0/O/1/I/L para não confundir na fala.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function gerarCodigo() {
    let c = '';
    do {
        c = Array.from({ length: 5 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
    } while (sala.existe(c));
    return c;
}

function lerJogador(dados) {
    const j = {
        nome: String(dados?.nome || '').trim().slice(0, 64),
        avatar_codigo: String(dados?.avatar_codigo || '').slice(0, 30),
    };
    return (j.nome && j.avatar_codigo) ? j : null;
}

async function avatarOk(codigo) {
    try {
        return (await persistencia.avataresValidos()).has(codigo);
    } catch (err) {
        console.warn('[persistencia] catálogo indisponível:', err.message);
        return false;
    }
}

// Coloca o socket na sala (estado vivo + broadcast) e grava atrás.
function ingressar(socket, codigo, jogador, { criando, souCriador }) {
    socket.join(codigo);
    sala.entrar(codigo, socket.id, jogador);
    socket.emit('sala_pronta', {
        codigo,
        souCriador,
        voce: { socketId: socket.id, ...jogador },
        lista: sala.presentes(codigo),
    });
    io.to(codigo).emit('presentes', { codigo, lista: sala.presentes(codigo) });
    console.log(`[io] ${jogador.nome} ${criando ? 'criou' : 'entrou em'} ${codigo} (${sala.presentes(codigo).length})`);

    persistencia.registrarEntradaEmSala({ ...jogador, salaCodigo: codigo, criando })
        .then(r => { if (!r.erro) sala.anotarPresenca(socket.id, r.presencaId); })
        .catch(err => console.warn('[persistencia] entrada não gravada:', err.message));
}

io.on('connection', (socket) => {
    console.log(`[io] conectou ${socket.id}`);

    socket.on('criar_sala', async (dados) => {
        const jogador = lerJogador(dados);
        if (!jogador || !(await avatarOk(jogador.avatar_codigo))) return;
        ingressar(socket, gerarCodigo(), jogador, { criando: true, souCriador: true });
    });

    socket.on('entrar_sala', async (dados) => {
        const jogador = lerJogador(dados);
        if (!jogador || !(await avatarOk(jogador.avatar_codigo))) return;

        const codigo = String(dados?.codigo || '').trim().toUpperCase().slice(0, 12);
        if (!codigo) return socket.emit('erro_sala', { motivo: 'Digite o código da sala.' });

        // Aceita se a sala está viva na memória; senão confirma no banco.
        if (!sala.existe(codigo) && !(await persistencia.salaAberta(codigo))) {
            return socket.emit('erro_sala', { motivo: 'Sala não encontrada.' });
        }
        ingressar(socket, codigo, jogador, { criando: false, souCriador: false });
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
            persistencia.registrarSaida(saiu.membro.presencaId)
                .catch(err => console.warn('[persistencia] saída não gravada:', err.message));
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

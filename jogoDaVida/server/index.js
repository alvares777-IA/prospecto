// Ponto de entrada do servidor.
// Passo 1: Express serve public/.
// Passo 2: pool pg + GET /catalogo.
// Passo 3: (só cliente).
// Passo 4: Socket.IO — entrar na sala, listar presentes, sair ao desconectar.
// Passo 5: chat de texto por sala.
// Passo 6: persistência — jogador + sessao + presenca no Postgres.

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

// §1: um mundo só, sem lista de mundos nem lobby. Sala fixa por enquanto.
const SALA_PADRAO = 'SALA_A';

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

app.use((err, _req, res, _next) => {
    console.error('[http] erro não tratado:', err);
    res.status(500).json({ erro: 'interno' });
});

// ── Socket.IO ────────────────────────────────────────────────────────
const httpServer = http.createServer(app);
const io = new Server(httpServer);

io.on('connection', (socket) => {
    console.log(`[io] conectou ${socket.id}`);

    socket.on('entrar', async (dados) => {
        // O servidor valida — o cliente só manda intenção.
        const jogador = {
            nome: String(dados?.nome || '').trim().slice(0, 64),
            avatar_codigo: String(dados?.avatar_codigo || '').slice(0, 30),
        };
        if (!jogador.nome || !jogador.avatar_codigo) return;

        // Regra 1: o avatar tem que existir no catálogo (não confia no cliente).
        try {
            const validos = await persistencia.avataresValidos();
            if (!validos.has(jogador.avatar_codigo)) return;
        } catch (err) {
            console.warn('[persistencia] catálogo indisponível, entrada recusada:', err.message);
            return;
        }

        // --- estado vivo: imediato ---
        socket.join(SALA_PADRAO);
        sala.entrar(SALA_PADRAO, socket.id, jogador);
        socket.emit('entrou', { voce: { socketId: socket.id, ...jogador } });
        io.to(SALA_PADRAO).emit('presentes', { lista: sala.presentes(SALA_PADRAO) });
        console.log(`[io] ${jogador.nome} entrou em ${SALA_PADRAO} (${sala.presentes(SALA_PADRAO).length})`);

        // --- persistência: segue atrás, não trava a sala (docs §6) ---
        persistencia.registrarEntrada({ ...jogador, salaCodigo: SALA_PADRAO })
            .then(({ presencaId }) => sala.anotarPresenca(socket.id, presencaId))
            .catch(err => console.warn('[persistencia] entrada não gravada:', err.message));
    });

    socket.on('mensagem', (dados) => {
        const jogador = sala.buscar(socket.id);
        if (!jogador) return;                       // não entrou na sala — ignora
        const texto = String(dados?.texto || '').trim().slice(0, 500);
        if (!texto) return;

        io.to(SALA_PADRAO).emit('mensagem', {
            de: jogador.nome,
            avatar_codigo: jogador.avatar_codigo,
            texto,
            ts: Date.now(),                         // relógio do servidor
        });
    });

    socket.on('disconnect', () => {
        const saiu = sala.sair(socket.id);          // { sala, membro } | null
        if (saiu) {
            io.to(saiu.sala).emit('presentes', { lista: sala.presentes(saiu.sala) });
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
// `docker stop` (SIGTERM); não dispara no reload do nodemon (SIGUSR2), então a
// sessão sobrevive ao hot-reload — é o comportamento que queremos.
for (const sinal of ['SIGTERM', 'SIGINT']) {
    process.on(sinal, async () => {
        try { await persistencia.encerrarSessoes(); }
        catch (err) { console.warn('[persistencia] não encerrou sessões:', err.message); }
        process.exit(0);
    });
}

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
import * as mundo from './mundo.js';
import { montarAuth, sessionMiddleware } from './auth.js';
import { montarAdmin } from './admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));   // forms do /admin
app.use(express.static(PUBLIC_DIR));
montarAuth(app);    // sessão + /eu /cadastro /login /sair /auth/google
montarAdmin(app, { aoPular: (sessaoId, codigo) => avisarPulo(sessaoId, codigo) });   // /admin — manutenção + ferramentas de teste

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

// Pedidos de doação de energia abertos: mesma chave. Não fecham na 1ª doação
// (vários podem doar); somem quando o pedinte avança de porta, ou sai.
const doacoesPedidas = new Map();

// Foco numa fase: qual enigma do trecho cada jogador está com aberto agora.
// `${sessaoId}:${jogadorId}` -> rótulo curto ('enigma 2 da fase'). Some ao
// voltar ao tabuleiro, ao resolver, ao avançar da fase ou ao sair.
const focosFase = new Map();

// Quem está agora no hall (mesma chave). Entra ao receber 'hall'; sai ao prosseguir.
const noHall = new Set();

function limparDoacao(codigo, sessaoId, jogadorId, socketIdPedinte) {
    if (doacoesPedidas.delete(chavePedido(sessaoId, jogadorId))) {
        io.to(codigo).emit('doacao_resolvida', { socketId: socketIdPedinte });
    }
}

// Garante a partida e coloca o jogador no HALL da porta atual (ele decide
// quando "prosseguir" para o enigma).
async function entregarHall(socket, sessaoId, jogadorId) {
    try {
        const st = await jogo.garantirPartida(sessaoId, jogadorId);
        if (st.terminou) return socket.emit('jogo_terminado', { porta: st.total, energia: st.energia });
        noHall.add(chavePedido(sessaoId, jogadorId));
        socket.emit('hall', { porta: st.porta, total: st.total });
    } catch (err) {
        console.warn('[jogo] entregarHall:', err.message);
    }
}

// Game over da sala: ninguém vivo e nem todos concluíram. Encerra a sessão.
async function checarEEncerrar(codigo, sessaoId) {
    try {
        if (!(await jogo.checarDerrota(sessaoId))) return false;
        sala.marcarEstado(codigo, 'encerrada');
        await persistencia.encerrarSessao(sessaoId);
        io.to(codigo).emit('sala_derrota');
        return true;
    } catch (err) {
        console.warn('[jogo] checarDerrota:', err.message);
        return false;
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
            const concluiu = !!n?.fim && Number(n.porta) > Number(n.total);
            return {
                socketId: sid, nome: mb.nome,
                porta: n?.porta ?? null,
                terminou: concluiu,                          // concluiu a sala de verdade
                travado: !!n?.fim && !concluiu,              // dt_fim por esgotamento (sem energia)
                naFase: !!n?.na_fase,
                noHall: noHall.has(chavePedido(sessaoId, mb.jogadorId)),
                foco: focosFase.get(chavePedido(sessaoId, mb.jogadorId)) || null,
            };
        }).filter(Boolean);
        io.to(codigo).emit('niveis', { lista });
    } catch (err) {
        console.warn('[jogo] transmitirNiveis:', err.message);
    }
}

// Depois de uma resposta de porta solo (inclui o fim do mundo): avança ou
// pune, e avisa. `sock` pode ser null (jogador desconectado quando o tempo
// do mundo acabou) — o banco anda igual, e ele vê o resultado ao voltar.
async function aposRespostaSolo(codigo, sessaoId, jogadorId, nome, sock, r) {
    if (r.correta) {
        limparPedido(codigo, sessaoId, jogadorId, sock?.id);    // avançou -> pedido some
        limparDoacao(codigo, sessaoId, jogadorId, sock?.id);
        io.to(codigo).emit('porta_alcancada', { jogador: nome, socketId: sock?.id, porta: r.porta });
        if (r.terminou) {
            await jogo.finalizarPartida(sessaoId, jogadorId);   // grava a energia pessoal
            sock?.emit('jogo_terminado', { porta: r.porta - 1, energia: r.energia });
        } else {
            noHall.add(chavePedido(sessaoId, jogadorId));
            sock?.emit('hall', { porta: r.porta });   // hall antes da próxima porta
        }
        transmitirNiveis(codigo, sessaoId);
    } else {
        sock?.emit('resposta_errada', { energia: r.energia });
        if (r.energia != null && r.energia <= 0) {
            sock?.emit('sem_energia');
            await jogo.finalizarPartida(sessaoId, jogadorId);
            await checarEEncerrar(codigo, sessaoId);
        }
    }
}

// Admin de teste pulou a sala para outra porta: quem estava num mundo sai dele
// (sem contar como fim) e todo mundo vai para o hall da porta nova.
async function avisarPulo(sessaoId, codigo) {
    for (const sid of io.sockets.adapter.rooms.get(codigo) || []) {
        const sock = io.sockets.sockets.get(sid);
        const jid = sala.buscar(sid)?.jogadorId;
        if (!sock || !jid) continue;
        mundo.remover(sessaoId, jid);
        if (sock.data.mundo) { sock.leave(mundo.salaSocket(sessaoId, sock.data.mundo.ordem)); sock.data.mundo = null; }
        limparPedido(codigo, sessaoId, jid, sid);
        limparDoacao(codigo, sessaoId, jid, sid);
        focosFase.delete(chavePedido(sessaoId, jid));
        await entregarHall(sock, sessaoId, jid);
    }
    transmitirNiveis(codigo, sessaoId);
}

// ── Mundo: o loop de server/mundo.js avisa por estes callbacks ─────
const codigoDaSessao = new Map();   // sessaoId -> código da sala (preenchido no mundo_entrar)

// Ato do mundo -> banco, com retry (o uid já vem fixo: repetir não duplica).
// Anônimo não entra no ledger: ele some ao sair e o `evento` é imutável.
async function gravarAto(sessaoId, ato) {
    const espera = [1000, 2000, 4000, 8000, 15000];
    const registro = ato.atorAnonimo ? { ...ato, tipoEvento: null } : ato;
    for (let i = 0; i < 8; i++) {
        try {
            if (registro.tipoEvento) await jogo.registrarAto(sessaoId, registro);
            else if (ato.carater) await jogo.marcarCarater(sessaoId, ato.ator, ato.carater.tipo, ato.carater.descricao, ato.porta);
            return;
        } catch (err) {
            console.warn(`[mundo] ato ${ato.tipoEvento} não gravado (tentativa ${i + 1}):`, err.message);
            await sleep(espera[Math.min(i, espera.length - 1)]);
        }
    }
}

mundo.configurar({
    emitirSala: (sala_, evento, dados) => io.to(sala_).emit(evento, dados),
    emitirPara: (socketId, evento, dados) => { if (socketId) io.to(socketId).emit(evento, dados); },
    aoAto: (sessaoId, ato) => { gravarAto(sessaoId, ato); },
    aoFim: async (sessaoId, ordem, j, res) => {
        const sock = j.socketId ? io.sockets.sockets.get(j.socketId) : null;
        sock?.leave(mundo.salaSocket(sessaoId, ordem));
        if (sock) sock.data.mundo = null;
        sock?.emit('mundo_fim', { pontos: res.pontos, equipeCompleta: res.equipeCompleta, bau: res.bau });
        const codigo = codigoDaSessao.get(sessaoId);
        try {
            const r = await jogo.responder(sessaoId, j.jogadorId, String(res.pontos), null,
                { servidor: true, equipeCompleta: res.equipeCompleta });
            if (r.erro) return console.warn('[mundo] fim:', r.erro);
            if (codigo) await aposRespostaSolo(codigo, sessaoId, j.jogadorId, j.nome, sock, r);
        } catch (err) { console.warn('[mundo] fim:', err.message); }
    },
});

io.on('connection', (socket) => {
    console.log(`[io] conectou ${socket.id}`);

    // ── Mundo (porta tipo 'mundo') ──────────────────────────────────
    // Entrar valida no banco que a porta atual é mesmo um mundo; as demais
    // intenções usam o que ficou em socket.data.mundo (sem ir ao banco por tecla).
    socket.on('mundo_entrar', async () => {
        const c = ctxJogo();
        if (!c) return;
        try {
            const params = await jogo.parametrosMundo(c.sessaoId, c.eu.jogadorId);
            if (!params) return;
            codigoDaSessao.set(c.sessaoId, c.codigo);
            const ordem = params.porta;
            socket.data.mundo = { sessaoId: c.sessaoId, ordem, jogadorId: c.eu.jogadorId };
            socket.join(mundo.salaSocket(c.sessaoId, ordem));
            const pacote = mundo.entrar(c.sessaoId, ordem, params, {
                jogadorId: c.eu.jogadorId, socketId: socket.id, nome: c.eu.nome, anonimo: !!c.eu.anonimo,
            });
            socket.emit('mundo_mapa', pacote);
        } catch (err) { console.warn('[mundo] entrar:', err.message); }
    });
    const noMundo = fn => (dados) => {
        const w = socket.data.mundo;
        if (w) { try { fn(w, dados || {}); } catch (err) { console.warn('[mundo]', err.message); } }
    };
    socket.on('mundo_input',   noMundo((w, d) => mundo.input(w.sessaoId, w.ordem, w.jogadorId, d.dx, d.dy)));
    socket.on('mundo_minerar', noMundo((w, d) => mundo.minerar(w.sessaoId, w.ordem, w.jogadorId, d.alvo || null, d.item)));
    socket.on('mundo_usar',    noMundo((w, d) => mundo.usar(w.sessaoId, w.ordem, w.jogadorId, d)));
    socket.on('mundo_comer',   noMundo(w => mundo.comer(w.sessaoId, w.ordem, w.jogadorId)));
    socket.on('mundo_comer_segurar', noMundo((w, d) => mundo.segurarComer(w.sessaoId, w.ordem, w.jogadorId, !!d.ativo)));
    socket.on('mundo_doar',    noMundo((w, d) => mundo.doar(w.sessaoId, w.ordem, w.jogadorId, d.para, d.item, d.modo)));
    socket.on('mundo_bau',     noMundo((w, d) => mundo.bau(w.sessaoId, w.ordem, w.jogadorId, d.operacao, d.item, d.modo)));
    socket.on('mundo_socorro', noMundo(w => mundo.pedirSocorro(w.sessaoId, w.ordem, w.jogadorId)));
    socket.on('mundo_socorro_resposta', noMundo((w, d) => mundo.responderSocorro(w.sessaoId, w.ordem, w.jogadorId, d.id, !!d.aceitar)));
    socket.on('mundo_sair',    noMundo(w => mundo.sair(w.sessaoId, w.ordem, w.jogadorId)));

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
        if (estado === 'encerrada') {
            return socket.emit('erro_sala', { motivo: 'Essa sala já encerrou.' });
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
            await jogo.iniciarSala(m.sessaoId);   // gera a sequência (portas solo + trechos de fase)
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
        const resposta = String(dados?.resposta ?? '').slice(0, 120);
        const ordem = Number.isInteger(Number(dados?.ordem)) ? Number(dados.ordem) : null;
        try {
            const r = await jogo.responder(c.sessaoId, c.eu.jogadorId, resposta, ordem);
            if (r.erro) return;

            if (r.fase) {
                if (r.correta && r.resolvido) {
                    focosFase.delete(chavePedido(c.sessaoId, c.eu.jogadorId));   // resolveu -> some o foco
                    io.to(c.codigo).emit('fase_resolvida', {
                        ordem: r.ordem, por: c.eu.nome, faseCompleta: r.faseCompleta,
                    });
                    socket.emit('energia', { energia: r.energia });
                } else if (r.correta && r.jaResolvido) {
                    socket.emit('meu_enigma', await jogo.estado(c.sessaoId, c.eu.jogadorId));   // resync
                } else if (!r.correta) {
                    socket.emit('resposta_errada', { energia: r.energia, fase: true });
                    if (r.energia != null && r.energia <= 0) {
                        socket.emit('sem_energia');
                        await jogo.finalizarPartida(c.sessaoId, c.eu.jogadorId);
                        await checarEEncerrar(c.codigo, c.sessaoId);
                    }
                }
                transmitirNiveis(c.codigo, c.sessaoId);
                return;
            }

            await aposRespostaSolo(c.codigo, c.sessaoId, c.eu.jogadorId, c.eu.nome, socket, r);
        } catch (err) { console.warn('[jogo] responder:', err.message); }
    });

    // Desistir de um enigma: -custo_desistir % e o jogo revela a resposta
    // (só para quem pediu). O jogador ainda precisa digitar e enviar.
    // Jogo arcade pediu uma ação de energia (tiro, grudar a bola, fruta).
    // Responde por ack: o jogo só age com ok. Limite de ritmo por motivo.
    socket.on('config_jogo', async (dados, ack) => {
        if (typeof ack !== 'function') return;
        const c = ctxJogo();
        if (!c) return ack({});
        try { ack(await jogo.configJogo(c.sessaoId, c.eu.jogadorId, dados?.ordem)); }
        catch (err) { console.warn('[jogo] config_jogo:', err.message); ack({}); }
    });

    const RITMO_MS = { tiro: 200, grudar: 500, fruta: 800, escudo: 1000 };
    socket.on('energia_jogo', async (dados, ack) => {
        const responde = typeof ack === 'function' ? ack : () => {};
        const motivo = String(dados?.motivo || '');
        const c = ctxJogo();
        if (!c || !RITMO_MS[motivo]) return responde({ erro: 'fora' });
        const agora = Date.now();
        socket.data.ultimaAcao = socket.data.ultimaAcao || {};
        if (agora - (socket.data.ultimaAcao[motivo] || 0) < RITMO_MS[motivo]) return responde({ erro: 'rapido' });
        socket.data.ultimaAcao[motivo] = agora;
        try {
            const r = await jogo.energiaJogo(c.sessaoId, c.eu.jogadorId, motivo, dados?.ordem);
            responde(r);
            if (!r.ok) return;
            socket.emit('energia', { energia: r.energia });
            if (r.energia <= 0) {
                socket.emit('sem_energia');
                await jogo.finalizarPartida(c.sessaoId, c.eu.jogadorId);
                await checarEEncerrar(c.codigo, c.sessaoId);
            }
        } catch (err) {
            console.warn('[jogo] energia_jogo:', err.message);
            responde({ erro: 'interno' });
        }
    });

    socket.on('desistir', async (dados) => {
        const c = ctxJogo();
        if (!c) return;
        const ordem = Number.isInteger(Number(dados?.ordem)) ? Number(dados.ordem) : null;
        try {
            const r = await jogo.desistirEnigma(c.sessaoId, c.eu.jogadorId, ordem);
            if (r.erro) return socket.emit('desistir_negado', { motivo: r.erro });
            socket.emit('energia', { energia: r.energia });
            // ordem = null quando é porta solo; número quando é enigma de fase
            socket.emit('resposta_revelada', { ordem, resposta: r.resposta, custo: r.custo });
            io.to(c.codigo).emit('desistiu', { jogador: c.eu.nome });   // feed, sem a resposta
        } catch (err) { console.warn('[jogo] desistir:', err.message); }
    });

    // Foco na fase: o cliente avisa qual enigma do trecho abriu (ou null ao
    // voltar ao tabuleiro). Reflete no quadrante "Jogadores" de todos.
    socket.on('foco_fase', (dados) => {
        const c = ctxJogo();
        if (!c) return;
        const chave = chavePedido(c.sessaoId, c.eu.jogadorId);
        const ordem = Number(dados?.ordem);
        if (Number.isInteger(ordem)) {
            focosFase.set(chave, String(dados?.rotulo || `enigma da ordem ${ordem}`).slice(0, 40));
        } else {
            focosFase.delete(chave);
        }
        transmitirNiveis(c.codigo, c.sessaoId);
    });

    // Volta ao hall sem perder nada: o progresso fica no banco, "prosseguir" retoma.
    socket.on('voltar_hall', async () => {
        const c = ctxJogo();
        if (!c || socket.data.mundo) return;
        focosFase.delete(chavePedido(c.sessaoId, c.eu.jogadorId));
        await entregarHall(socket, c.sessaoId, c.eu.jogadorId);
        transmitirNiveis(c.codigo, c.sessaoId);
    });

    socket.on('prosseguir', async () => {
        const c = ctxJogo();
        if (!c) return;
        try {
            const st = await jogo.estado(c.sessaoId, c.eu.jogadorId);
            if (st && st.tipo === 'fase' && st.faseCompleta) {
                focosFase.delete(chavePedido(c.sessaoId, c.eu.jogadorId));   // saiu da fase
                const depois = await jogo.prosseguirFase(c.sessaoId, c.eu.jogadorId);
                if (depois.terminou) {
                    socket.emit('jogo_terminado', { porta: depois.total, energia: depois.energia });
                } else {
                    noHall.add(chavePedido(c.sessaoId, c.eu.jogadorId));
                    socket.emit('hall', { porta: depois.porta, total: depois.total });
                }
                transmitirNiveis(c.codigo, c.sessaoId);
                return;
            }
            noHall.delete(chavePedido(c.sessaoId, c.eu.jogadorId));
            socket.emit('meu_enigma', st);
            transmitirNiveis(c.codigo, c.sessaoId);
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

    // Pedir doação de energia. Sem custo; só sinaliza. Clicar de novo cancela.
    // Vale na porta, no hall e na fase.
    socket.on('pedir_doacao', async () => {
        const c = ctxJogo();
        if (!c) return;
        const chave = chavePedido(c.sessaoId, c.eu.jogadorId);
        if (doacoesPedidas.has(chave)) {   // toggle: cancela
            limparDoacao(c.codigo, c.sessaoId, c.eu.jogadorId, socket.id);
            return;
        }
        try {
            const st = await jogo.estado(c.sessaoId, c.eu.jogadorId);
            if (!st || st.terminou) return;
            doacoesPedidas.set(chave, { socketId: socket.id, porta: st.porta });
            io.to(c.codigo).emit('pediu_doacao', { jogador: c.eu.nome, socketId: socket.id, porta: st.porta });
        } catch (err) { console.warn('[jogo] pedir_doacao:', err.message); }
    });

    // Doar energia a outro jogador. Qualquer um pode; vários podem.
    socket.on('doar_energia', async (dados) => {
        const c = ctxJogo();
        if (!c) return;
        const alvoSocket = io.sockets.sockets.get(String(dados?.paraSocketId || ''));
        const alvo = sala.buscar(alvoSocket?.id || '');
        if (!alvo?.jogadorId || alvo.jogadorId === c.eu.jogadorId) return;
        try {
            const r = await jogo.doarEnergia(c.sessaoId, c.eu.jogadorId, alvo.jogadorId);
            if (r.erro) return;
            socket.emit('energia', { energia: r.energiaDe });
            alvoSocket?.emit('energia', { energia: r.energiaPara });
            alvoSocket?.emit('doacao_recebida', { de: c.eu.nome, valor: r.valor, revivido: r.revivido });
            io.to(c.codigo).emit('doou_energia', {
                de: c.eu.nome, para: alvo.nome, socketId: socket.id, alvoSocketId: alvoSocket?.id, valor: r.valor,
            });
            transmitirNiveis(c.codigo, c.sessaoId);
        } catch (err) { console.warn('[jogo] doar_energia:', err.message); }
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

        // Resposta no chat -> desconto de TODOS os jogadores da sala. Dentro de
        // uma fase (co-op) o chat é colaborativo: sem penalidade de spoiler.
        const m = sala.metaDe(codigo);
        if (m?.estado !== 'em_jogo') return;
        try {
            const meu = jogador.jogadorId ? await jogo.estado(m.sessaoId, jogador.jogadorId) : null;
            if (meu?.tipo === 'fase') return;
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
            if (m.jogadorId) mundo.desconectou(m.jogadorId);   // fica "ausente"; volta se reconectar a tempo
            const meta = sala.metaDe(saiu.codigo);
            if (meta?.sessaoId && m.jogadorId) {
                limparPedido(saiu.codigo, meta.sessaoId, m.jogadorId, socket.id);
                limparDoacao(saiu.codigo, meta.sessaoId, m.jogadorId, socket.id);
                focosFase.delete(`${meta.sessaoId}:${m.jogadorId}`);
                noHall.delete(`${meta.sessaoId}:${m.jogadorId}`);
            }
            if (m.anonimo) {
                // anônimo "perde tudo ao sair"
                persistencia.apagarAnonimo(m.jogadorId);
            } else {
                // grava a energia pessoal de volta antes de carimbar a saída
                if (meta?.sessaoId && m.jogadorId && meta.estado === 'em_jogo') {
                    jogo.finalizarPartida(meta.sessaoId, m.jogadorId)
                        .then(() => checarEEncerrar(saiu.codigo, meta.sessaoId))
                        .catch(err => console.warn('[jogo] energia pessoal não gravada:', err.message));
                }
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
        let alguemZerou = false;
        for (const sid of io.sockets.adapter.rooms.get(codigo) || []) {
            const jid = sala.buscar(sid)?.jogadorId;
            if (!jid) continue;
            try {
                const energia = await jogo.tique(sessaoId, jid);
                if (energia === null) continue;
                const s = io.sockets.sockets.get(sid);
                s?.emit('energia', { energia: Math.round(energia * 10) / 10 });
                if (energia <= 0) {
                    s?.emit('sem_energia');
                    await jogo.finalizarPartida(sessaoId, jid);   // grava a energia pessoal (0)
                    alguemZerou = true;
                }
            } catch (err) {
                console.warn('[jogo] tique:', err.message);
            }
        }
        if (alguemZerou) await checarEEncerrar(codigo, sessaoId);
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

// Estado vivo das salas — vive SÓ na memória deste processo.
// Cada sala é identificada por um código curto (o mesmo da URL /sala/CODIGO
// e da coluna sessao.codigo). Reinício do servidor = salas vazias; o que não
// pode sumir está no Postgres (server/persistencia.js).

// codigo -> Map<socketId, { nome, avatar_codigo, presencaId }>
const salas = new Map();
// codigo -> { sessaoId, criadorSocketId, estado }
const meta = new Map();

export function entrar(codigo, socketId, jogador, estado = 'aguardando') {
    if (!salas.has(codigo)) {
        salas.set(codigo, new Map());
        meta.set(codigo, { sessaoId: null, criadorSocketId: null, estado });
    }
    salas.get(codigo).set(socketId, { ...jogador, presencaId: null });
}

export function existe(codigo) {
    return salas.has(codigo);
}

export function metaDe(codigo) {
    return meta.get(codigo) || null;
}

// Chamado quando a gravação confirma: guarda o id da sessão e quem é o criador.
export function anotarSala(codigo, { sessaoId, souCriador, socketId }) {
    const m = meta.get(codigo);
    if (!m) return;
    if (sessaoId) m.sessaoId = sessaoId;
    if (souCriador && socketId) m.criadorSocketId = socketId;
}

export function marcarEstado(codigo, estado) {
    const m = meta.get(codigo);
    if (m) m.estado = estado;
}

export function ehCriador(socketId) {
    const codigo = salaDe(socketId);
    return !!codigo && meta.get(codigo)?.criadorSocketId === socketId;
}

// Salas atualmente em jogo, com id de sessão — para o relógio de energia.
export function emJogo() {
    const out = [];
    for (const [codigo, m] of meta) {
        if (m.estado === 'em_jogo' && m.sessaoId) out.push({ codigo, sessaoId: m.sessaoId });
    }
    return out;
}

// A gravação no banco é assíncrona; quando confirma, anota aqui o id da
// presença (para o disconnect carimbar) e a identidade (para apagar o anônimo).
export function anotarGravacao(socketId, { presencaId, jogadorId, anonimo }) {
    for (const membros of salas.values()) {
        const m = membros.get(socketId);
        if (m) {
            m.presencaId = presencaId;
            m.jogadorId = jogadorId;
            m.anonimo = anonimo;
            return;
        }
    }
}

export function presencaDe(socketId) {
    for (const membros of salas.values()) {
        const m = membros.get(socketId);
        if (m) return m.presencaId;
    }
    return null;
}

export function salaDe(socketId) {
    for (const [codigo, membros] of salas) {
        if (membros.has(socketId)) return codigo;
    }
    return null;
}

// Devolve { codigo, membro } de onde o socket saiu.
export function sair(socketId) {
    for (const [codigo, membros] of salas) {
        const membro = membros.get(socketId);
        if (membro) {
            membros.delete(socketId);
            if (membros.size === 0) { salas.delete(codigo); meta.delete(codigo); }
            return { codigo, membro };
        }
    }
    return null;
}

// Lista para o cliente — sem ids internos (presencaId não sai daqui).
export function presentes(codigo) {
    const membros = salas.get(codigo);
    if (!membros) return [];
    return [...membros.entries()].map(([socketId, m]) => ({
        socketId,
        nome: m.nome,
        avatar_codigo: m.avatar_codigo,
    }));
}

// Quem é o dono deste socket (nome + avatar), esteja em que sala estiver.
export function buscar(socketId) {
    for (const membros of salas.values()) {
        const m = membros.get(socketId);
        if (m) return m;
    }
    return null;
}

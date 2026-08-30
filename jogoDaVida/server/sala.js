// Estado vivo das salas — vive SÓ na memória deste processo.
// Cada sala é identificada por um código curto (o mesmo da URL /sala/CODIGO
// e da coluna sessao.codigo). Reinício do servidor = salas vazias; o que não
// pode sumir está no Postgres (server/persistencia.js).

// codigo (string) -> Map<socketId, { nome, avatar_codigo, presencaId }>
const salas = new Map();

export function entrar(codigo, socketId, jogador) {
    if (!salas.has(codigo)) salas.set(codigo, new Map());
    salas.get(codigo).set(socketId, { ...jogador, presencaId: null });
}

export function existe(codigo) {
    return salas.has(codigo);
}

// A gravação no banco é assíncrona; quando o id da presença chega, anota aqui
// para o disconnect saber qual linha carimbar.
export function anotarPresenca(socketId, presencaId) {
    for (const membros of salas.values()) {
        const m = membros.get(socketId);
        if (m) { m.presencaId = presencaId; return; }
    }
}

// De qual sala é este socket.
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
            if (membros.size === 0) salas.delete(codigo);
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

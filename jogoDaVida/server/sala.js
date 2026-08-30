// Estado vivo das salas — vive SÓ na memória deste processo.
// Reinício do servidor = todas as salas vazias, todo mundo reconecta. Isso é
// esperado, não é bug (docs/primeira_entrega.md §6). O que não pode sumir vai
// para o Postgres (server/persistencia.js).

// sala (string) -> Map<socketId, { nome, avatar_codigo, presencaId }>
const salas = new Map();

export function entrar(sala, socketId, jogador) {
    if (!salas.has(sala)) salas.set(sala, new Map());
    salas.get(sala).set(socketId, { ...jogador, presencaId: null });
}

// A gravação no banco é assíncrona; quando o id da presença chega, anota aqui
// para o disconnect saber qual linha carimbar.
export function anotarPresenca(socketId, presencaId) {
    for (const membros of salas.values()) {
        const m = membros.get(socketId);
        if (m) { m.presencaId = presencaId; return; }
    }
}

// Não recebemos a sala — o socket pode estar em qualquer uma. São poucas e
// pequenas, varrer é barato. Devolve { sala, membro } de onde saiu.
export function sair(socketId) {
    for (const [sala, membros] of salas) {
        const membro = membros.get(socketId);
        if (membro) {
            membros.delete(socketId);
            if (membros.size === 0) salas.delete(sala);
            return { sala, membro };
        }
    }
    return null;
}

// Lista para o cliente — sem ids internos (presencaId não sai daqui).
export function presentes(sala) {
    const membros = salas.get(sala);
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

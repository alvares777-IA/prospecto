// Cliente.
// Passo 3: tela de entrada — nome + escolha de avatar, consumindo /catalogo.
// Passo 4: ao "Entrar", conecta ao Socket.IO, entra na sala e mostra os presentes.
// O navegador só coleta intenção e renderiza resultado. Nada de regra de jogo aqui.

const estado = {
    catalogo: { avatares: [], eras: [] },
    avatarSelecionado: null,
    jogador: null,            // { nome, avatar_codigo }
};

let socket = null;

$(async function () {
    await carregarCatalogo();
    $('#btn-entrar').on('click', entrar);
    $('#campo-nome').on('keydown', (e) => { if (e.key === 'Enter') entrar(); });
});

async function carregarCatalogo() {
    try {
        const r = await fetch('/catalogo');
        if (!r.ok) throw new Error('status ' + r.status);
        estado.catalogo = await r.json();
    } catch (e) {
        $('#grade-avatares').html('<span class="text-danger small">falha ao carregar o catálogo</span>');
        return;
    }

    $('#rotulo-era').text(estado.catalogo.eras[0]?.nome || '—');

    const $grade = $('#grade-avatares').empty();
    for (const av of estado.catalogo.avatares) {
        const $tile = $(
            `<button type="button" class="tile-avatar" data-codigo="${av.codigo}" title="${av.nome}">` +
            `<img src="${av.arquivo}" width="56" height="56" alt="${av.nome}"></button>`
        );
        $tile.on('click', () => selecionarAvatar(av.codigo));
        $grade.append($tile);
    }
}

function selecionarAvatar(codigo) {
    estado.avatarSelecionado = codigo;
    $('#grade-avatares .tile-avatar').removeClass('selecionado');
    $(`#grade-avatares .tile-avatar[data-codigo="${codigo}"]`).addClass('selecionado');
}

function entrar() {
    const nome = $('#campo-nome').val().trim();
    const erro = validar(nome, estado.avatarSelecionado);
    if (erro) return mostrarErro(erro);

    estado.jogador = { nome, avatar_codigo: estado.avatarSelecionado };

    const av = avatarPorCodigo(estado.jogador.avatar_codigo);
    $('#eu-nome').text(estado.jogador.nome);
    $('#eu-avatar').attr('src', av ? av.arquivo : '').attr('alt', av ? av.nome : '');
    $('#tela-entrada').addClass('d-none');
    $('#tela-sala').removeClass('d-none');

    conectarSala();
}

function conectarSala() {
    socket = io();                                   // conecta ao host que serviu a página

    socket.on('connect', () => {
        $('#status-conexao').text('conectado');
        socket.emit('entrar', estado.jogador);       // manda a intenção; o servidor valida
    });

    socket.on('disconnect', () => {
        $('#status-conexao').text('desconectado');
    });

    // Lista completa dos presentes — reenviada pelo servidor a cada entrada/saída.
    socket.on('presentes', ({ lista }) => renderPresentes(lista));

    // Chat da sala.
    socket.on('mensagem', (m) => renderMensagem(m));
    $('#form-msg').on('submit', (e) => {
        e.preventDefault();
        const texto = $('#campo-msg').val().trim();
        if (!texto) return;
        socket.emit('mensagem', { texto });
        $('#campo-msg').val('');
    });
}

function renderMensagem(m) {
    const hora = new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const $linha = $('<div class="mb-1">');
    $('<span class="text-secondary small">').text(`[${hora}] `).appendTo($linha);
    $('<strong>').text(m.de + ': ').appendTo($linha);
    $('<span>').text(m.texto).appendTo($linha);          // .text() escapa
    const chat = $('#chat').append($linha)[0];
    chat.scrollTop = chat.scrollHeight;
}

function renderPresentes(lista) {
    $('#contador-presentes').text(lista.length);
    const $ul = $('#lista-presentes').empty();
    for (const p of lista) {
        const av = avatarPorCodigo(p.avatar_codigo);
        const sou = socket && p.socketId === socket.id ? ' (você)' : '';
        const $li = $('<li class="d-flex align-items-center gap-2 mb-1">');
        $('<img width="20" height="20" alt="">')
            .attr('src', av ? av.arquivo : '')
            .appendTo($li);
        $('<span>').text(p.nome + sou).appendTo($li);   // .text() escapa o nome
        $ul.append($li);
    }
}

function avatarPorCodigo(codigo) {
    return estado.catalogo.avatares.find(a => a.codigo === codigo) || null;
}

function validar(nome, avatar) {
    if (nome.length < 2) return 'Digite um nome (ao menos 2 letras).';
    if (!avatar) return 'Escolha uma figura.';
    return null;
}

function mostrarErro(msg) {
    $('#erro-entrada').text(msg).removeClass('d-none');
}

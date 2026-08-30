// Cliente.
// Fluxo: nome + figura  ->  criar sala / entrar em sala  ->  dentro da sala.
// Se a URL for /sala/CODIGO, pula a escolha e entra direto naquela sala.
// O navegador só coleta intenção e renderiza resultado. Nada de regra aqui.

const estado = {
    catalogo: { avatares: [], eras: [] },
    avatarSelecionado: null,
    jogador: null,            // { nome, avatar_codigo }
    salaAlvo: null,           // código vindo da URL, se houver
    codigo: null,
    souCriador: false,
    persistido: false,        // a minha entrada já foi gravada no banco?
    jogoIniciado: false,
};

let socket = null;

$(async function () {
    // /sala/ABCDE  ->  entra direto nessa sala depois do nome+figura
    const m = location.pathname.match(/^\/sala\/([A-Za-z0-9]{1,12})$/);
    if (m) estado.salaAlvo = m[1].toUpperCase();

    await carregarCatalogo();

    $('#btn-continuar').on('click', continuar);
    $('#campo-nome').on('keydown', e => { if (e.key === 'Enter') continuar(); });
    $('#btn-criar').on('click', () => { conectar(); socket.emit('criar_sala', estado.jogador); });
    $('#btn-entrar-sala').on('click', entrarNaSalaDigitada);
    $('#campo-codigo').on('keydown', e => { if (e.key === 'Enter') entrarNaSalaDigitada(); });
    $('#btn-copiar').on('click', copiarLink);
    $('#btn-iniciar').on('click', () => socket && socket.emit('iniciar_jogo'));
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

// Passo 1 -> valida nome/figura e decide a próxima tela.
function continuar() {
    const nome = $('#campo-nome').val().trim();
    if (nome.length < 2) return mostrar('#erro-entrada', 'Digite um nome (ao menos 2 letras).');
    if (!estado.avatarSelecionado) return mostrar('#erro-entrada', 'Escolha uma figura.');
    estado.jogador = { nome, avatar_codigo: estado.avatarSelecionado };

    if (estado.salaAlvo) {
        conectar();
        socket.emit('entrar_sala', { ...estado.jogador, codigo: estado.salaAlvo });
    } else {
        trocarTela('#tela-sala-escolha');
        $('#campo-codigo').trigger('focus');
    }
}

function entrarNaSalaDigitada() {
    const codigo = $('#campo-codigo').val().trim().toUpperCase();
    if (!codigo) return mostrar('#erro-sala', 'Digite o código da sala.');
    conectar();
    socket.emit('entrar_sala', { ...estado.jogador, codigo });
}

// Cria o socket e registra os ouvintes uma vez.
function conectar() {
    if (socket) return;
    socket = io();

    socket.on('connect', () => $('#status-conexao').text('conectado'));
    socket.on('disconnect', () => $('#status-conexao').text('desconectado'));

    socket.on('erro_sala', ({ motivo }) => {
        trocarTela('#tela-sala-escolha');
        mostrar('#erro-sala', motivo || 'Não foi possível entrar.');
    });

    socket.on('sala_pronta', ({ codigo, souCriador, estado: est, voce, lista }) => {
        estado.codigo = codigo;
        estado.souCriador = !!souCriador;
        estado.persistido = false;
        estado.jogoIniciado = est === 'em_jogo';
        history.replaceState(null, '', '/sala/' + codigo);
        const av = avatarPorCodigo(voce.avatar_codigo);
        $('#eu-nome').text(voce.nome);
        $('#eu-avatar').attr('src', av ? av.arquivo : '').attr('alt', av ? av.nome : '');
        $('#rotulo-codigo').text(codigo);
        trocarTela('#tela-sala');
        renderPresentes(lista);
        atualizarInicio();
        $('#campo-msg').trigger('focus');
    });

    socket.on('presenca_confirmada', () => { estado.persistido = true; atualizarInicio(); });
    socket.on('jogo_iniciado', () => { estado.jogoIniciado = true; atualizarInicio(); });

    socket.on('presentes', ({ lista }) => renderPresentes(lista));

    socket.on('mensagem', m => renderMensagem(m));
    $('#form-msg').on('submit', e => {
        e.preventDefault();
        const texto = $('#campo-msg').val().trim();
        if (!texto) return;
        socket.emit('mensagem', { texto });
        $('#campo-msg').val('');
    });
}

function renderPresentes(lista) {
    if (!lista) return;
    $('#contador-presentes').text(lista.length);
    const $ul = $('#lista-presentes').empty();
    for (const p of lista) {
        const av = avatarPorCodigo(p.avatar_codigo);
        const sou = socket && p.socketId === socket.id ? ' (você)' : '';
        const $li = $('<li class="d-flex align-items-center gap-2 mb-1">');
        $('<img width="20" height="20" alt="">').attr('src', av ? av.arquivo : '').appendTo($li);
        $('<span>').text(p.nome + sou).appendTo($li);
        $ul.append($li);
    }
}

// Estado do bloco "Iniciar jogo" / painel de controles.
function atualizarInicio() {
    if (estado.jogoIniciado) {
        $('#area-inicio').addClass('d-none');
        $('#painel-controles').removeClass('d-none');
        return;
    }
    $('#painel-controles').addClass('d-none');
    $('#area-inicio').removeClass('d-none');

    if (estado.souCriador) {
        $('#btn-iniciar').removeClass('d-none').prop('disabled', !estado.persistido);
        $('#aviso-inicio').text(estado.persistido ? '' : 'salvando sua entrada…');
    } else {
        $('#btn-iniciar').addClass('d-none');
        $('#aviso-inicio').text(estado.persistido
            ? 'aguardando o anfitrião iniciar…'
            : 'salvando sua entrada…');
    }
}

function renderMensagem(m) {
    const hora = new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const $linha = $('<div class="mb-1">');
    $('<span class="text-secondary small">').text(`[${hora}] `).appendTo($linha);
    $('<strong>').text(m.de + ': ').appendTo($linha);
    $('<span>').text(m.texto).appendTo($linha);
    const chat = $('#chat').append($linha)[0];
    chat.scrollTop = chat.scrollHeight;
}

function copiarLink() {
    const url = location.origin + '/sala/' + (estado.codigo || '');
    navigator.clipboard?.writeText(url).then(
        () => { $('#btn-copiar').text('copiado!'); setTimeout(() => $('#btn-copiar').text('copiar link'), 1500); },
        () => { window.prompt('Copie o link da sala:', url); }
    );
}

function avatarPorCodigo(codigo) {
    return estado.catalogo.avatares.find(a => a.codigo === codigo) || null;
}

function trocarTela(sel) {
    $('#tela-entrada, #tela-sala-escolha, #tela-sala').addClass('d-none');
    $(sel).removeClass('d-none');
}

function mostrar(sel, msg) {
    $(sel).text(msg).removeClass('d-none');
}

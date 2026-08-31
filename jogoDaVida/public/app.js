// Cliente.
// Fluxo: identidade (anônimo / login / Google) + figura -> criar/entrar sala
//        -> dentro da sala.  /sala/CODIGO pula a escolha da sala.
// O navegador só coleta intenção e renderiza resultado. Nada de regra aqui.

const estado = {
    catalogo: { avatares: [], eras: [] },
    avatarSelecionado: null,
    jogador: null,            // { nome?, avatar_codigo }
    salaAlvo: null,           // código vindo da URL, se houver
    logado: false,
    apelido: null,
    codigo: null,
    souCriador: false,
    persistido: false,        // a minha entrada já foi gravada no banco?
    jogoIniciado: false,
};

let socket = null;

$(async function () {
    const m = location.pathname.match(/^\/sala\/([A-Za-z0-9]{1,12})$/);
    if (m) estado.salaAlvo = m[1].toUpperCase();

    const errOAuth = new URLSearchParams(location.search).get('erro');
    if (errOAuth === 'google') mostrar('#aviso-oauth', 'Não foi possível entrar com o Google.');
    if (errOAuth === 'google_desligado') mostrar('#aviso-oauth', 'Login com Google não está configurado.');

    await Promise.all([carregarEu(), carregarCatalogo()]);

    // modo (não logado)
    $('#btn-modo-anon').on('click', () => { trocarSecao('#bloco-figura'); $('#campo-nome').trigger('focus'); });
    $('#btn-modo-login').on('click', () => trocarSecao('#form-login'));
    $('#link-cadastro').on('click', e => { e.preventDefault(); trocarSecao('#form-cadastro'); });
    $('#link-login').on('click', e => { e.preventDefault(); trocarSecao('#form-login'); });
    $('#btn-login').on('click', fazerLogin);
    $('#btn-cadastro').on('click', fazerCadastro);
    $('#login-senha').on('keydown', e => { if (e.key === 'Enter') fazerLogin(); });
    $('#cad-senha').on('keydown', e => { if (e.key === 'Enter') fazerCadastro(); });
    $('#btn-sair-conta').on('click', async e => { e.preventDefault(); await fetch('/sair', { method: 'POST' }); location.reload(); });

    // figura + sala
    $('#btn-continuar').on('click', continuar);
    $('#campo-nome').on('keydown', e => { if (e.key === 'Enter') continuar(); });
    $('#btn-criar').on('click', () => { conectar(); socket.emit('criar_sala', payloadJogador()); });
    $('#btn-entrar-sala').on('click', entrarNaSalaDigitada);
    $('#campo-codigo').on('keydown', e => { if (e.key === 'Enter') entrarNaSalaDigitada(); });
    $('#btn-copiar').on('click', copiarLink);
    $('#btn-iniciar').on('click', () => socket && socket.emit('iniciar_jogo'));
});

async function carregarEu() {
    let eu = { logado: false, googleAtivo: false };
    try { eu = await (await fetch('/eu')).json(); } catch { /* segue deslogado */ }

    if (!eu.googleAtivo) {
        $('#btn-modo-google').addClass('disabled')
            .attr('title', 'Configure GOOGLE_CLIENT_ID/SECRET e a redirect URI').removeAttr('href');
    } else if (estado.salaAlvo) {
        $('#btn-modo-google').attr('href', '/auth/google?sala=' + estado.salaAlvo);
    }

    if (eu.logado) {
        estado.logado = true;
        estado.apelido = eu.apelido;
        $('#saud-nome').text(eu.apelido);
        $('#painel-nao-logado, #form-login, #form-cadastro').addClass('d-none');
        $('#campo-nome-wrap').addClass('d-none');   // já tem apelido da conta
        $('#painel-logado, #bloco-figura').removeClass('d-none');
    }
}

// Mostra uma seção de #tela-entrada e esconde as irmãs (menos #painel-logado).
function trocarSecao(sel) {
    $('#painel-nao-logado, #form-login, #form-cadastro, #bloco-figura').addClass('d-none');
    $(sel).removeClass('d-none');
}

async function fazerLogin() {
    const body = { email: $('#login-email').val().trim(), senha: $('#login-senha').val() };
    const r = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return location.reload();
    mostrar('#erro-login', (await r.json().catch(() => ({}))).erro || 'Não foi possível entrar.');
}

async function fazerCadastro() {
    const body = {
        apelido: $('#cad-apelido').val().trim(),
        email: $('#cad-email').val().trim(),
        senha: $('#cad-senha').val(),
    };
    const r = await fetch('/cadastro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return location.reload();
    mostrar('#erro-cadastro', (await r.json().catch(() => ({}))).erro || 'Não foi possível criar a conta.');
}

// Payload para criar_sala / entrar_sala. Logado -> só a figura (o servidor usa
// a sessão); anônimo -> nome digitado + figura.
function payloadJogador(extra) {
    const p = { avatar_codigo: estado.jogador.avatar_codigo, ...extra };
    if (!estado.logado) p.nome = estado.jogador.nome;
    return p;
}

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

// Valida figura (+ nome, se anônimo) e decide a próxima tela.
function continuar() {
    const nome = $('#campo-nome').val().trim();
    if (!estado.logado && nome.length < 2) {
        return mostrar('#erro-entrada', 'Digite um nome (ao menos 2 letras).');
    }
    if (!estado.avatarSelecionado) return mostrar('#erro-entrada', 'Escolha uma figura.');
    estado.jogador = { nome, avatar_codigo: estado.avatarSelecionado };

    if (estado.salaAlvo) {
        conectar();
        socket.emit('entrar_sala', payloadJogador({ codigo: estado.salaAlvo }));
    } else {
        trocarTela('#tela-sala-escolha');
        $('#campo-codigo').trigger('focus');
    }
}

function entrarNaSalaDigitada() {
    const codigo = $('#campo-codigo').val().trim().toUpperCase();
    if (!codigo) return mostrar('#erro-sala', 'Digite o código da sala.');
    conectar();
    socket.emit('entrar_sala', payloadJogador({ codigo }));
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

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
    jogo: {                   // estado do protótipo de jogo
        inicio: null, porta: 0, total: 0,
        energiaBase: null, energiaDt: 0, decaimentoMin: 1,
        portas: {}, ultimaLista: [],
        chatAberto: false, chatLiberado: false,
        pedidos: {},          // socketId -> { jogador, porta }  (pedidos de ajuda abertos)
        recusei: new Set(),   // socketIds que EU recusei ajudar
    },
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

    // ── jogo ──────────────────────────────────────────────────────────
    socket.on('meu_enigma', st => {
        if (!estado.jogo.inicio) estado.jogo.inicio = Date.now();
        estado.jogo.porta = st.porta;
        estado.jogo.total = st.total;
        estado.jogo.chatAberto = !!st.chatAberto;
        atualizarChat();
        setEnergia(st.energia, st.decaimentoMin);
        if (st.terminou) return;
        $('#jogo-enigma').removeClass('d-none');
        $('#jogo-fim').addClass('d-none');
        $('#jogo-porta').text(`Porta ${st.porta} de ${st.total}`);
        $('#jogo-pergunta').text(st.pergunta);
        $('#jogo-resposta').val('').prop('disabled', false).trigger('focus');
        $('#jogo-aviso').text('');
    });
    socket.on('chat_liberado', () => {
        if (estado.jogo.chatLiberado) return;
        estado.jogo.chatLiberado = true;
        atualizarChat();
        feed('o chat foi liberado');
    });
    socket.on('energia', ({ energia }) => setEnergia(energia));
    socket.on('resposta_errada', ({ energia }) => {
        setEnergia(energia);
        $('#jogo-aviso').removeClass('text-success').addClass('text-danger').text('Resposta errada. -5% de energia.');
        $('#jogo-resposta').val('').trigger('focus');
    });
    socket.on('porta_alcancada', ({ jogador, socketId, porta }) => {
        estado.jogo.portas[socketId] = porta;
        renderJogadores();
        feed(`${jogador} chegou na porta ${porta}`);
    });
    socket.on('pediu_ajuda', ({ jogador, socketId, porta }) => {
        estado.jogo.pedidos[socketId] = { jogador, porta };
        estado.jogo.recusei.delete(socketId);
        renderJogadores();
        feed(`${jogador} pediu ajuda na porta ${porta}`);
    });
    socket.on('ajuda_resolvida', ({ socketId }) => {
        delete estado.jogo.pedidos[socketId];
        estado.jogo.recusei.delete(socketId);
        renderJogadores();
    });
    socket.on('ofereceu_ajuda', ({ de, para }) => feed(`${de} ofereceu ajuda a ${para}`));
    socket.on('recusou_ajuda', ({ de, para, socketId, alvoSocketId }) => {
        feed(`${de} não quis ajudar ${para}`);
        if (socketId === socket.id) { estado.jogo.recusei.add(alvoSocketId); renderJogadores(); }
    });
    socket.on('ajudou', ({ de, para }) => feed(`${de} deu a resposta a ${para}`));
    socket.on('spoiler_chat', ({ jogador, penalidade }) => {
        feed(`⚠️ ${jogador} colocou uma resposta no chat — todos perderam ${penalidade}%`);
        $('#jogo-aviso').removeClass('text-success').addClass('text-danger')
            .text(`Resposta no chat: -${penalidade}% de energia para todos.`);
    });
    socket.on('ajuda_recebida', ({ de, porta, resposta }) => {
        feed(`${de} te passou a resposta da porta ${porta}: ${resposta}`);
        $('#jogo-aviso').removeClass('text-danger').addClass('text-success').text(`Dica de ${de}: ${resposta}`);
    });
    socket.on('jogo_terminado', ({ porta, energia }) => {
        setEnergia(energia);
        $('#jogo-enigma').addClass('d-none');
        $('#jogo-fim').removeClass('d-none').text(`Você concluiu as ${porta} portas! Energia final: ${Math.round(energia)}%`);
    });
    socket.on('sem_energia', () => {
        $('#jogo-resposta, #jogo-pedir').prop('disabled', true);
        $('#jogo-aviso').removeClass('text-success').addClass('text-danger').text('Sua energia acabou.');
    });

    $('#jogo-form').on('submit', e => {
        e.preventDefault();
        const r = $('#jogo-resposta').val().trim();
        if (r) socket.emit('responder', { resposta: r });
    });
    $('#jogo-pedir').on('click', () => socket.emit('pedir_ajuda'));
}

function setEnergia(valor, decaimentoMin) {
    estado.jogo.energiaBase = valor;
    estado.jogo.energiaDt = Date.now();
    if (decaimentoMin != null) estado.jogo.decaimentoMin = decaimentoMin;
    pintarEnergia();
}

function energiaAgora() {
    const j = estado.jogo;
    if (j.energiaBase == null) return 100;
    const min = (Date.now() - j.energiaDt) / 60000;
    return Math.max(0, j.energiaBase - (j.decaimentoMin || 1) * min);
}

function pintarEnergia() {
    const e = energiaAgora();
    $('#jogo-energia-num').text(Math.round(e) + '%');
    $('#jogo-energia-barra').css('width', e + '%')
        .toggleClass('bg-success', e > 50).toggleClass('bg-warning', e <= 50 && e > 20)
        .toggleClass('bg-danger', e <= 20);
}

// relógio + energia local, 1x por segundo
setInterval(() => {
    if (!estado.jogo.inicio) return;
    const s = Math.floor((Date.now() - estado.jogo.inicio) / 1000);
    $('#jogo-relogio').text(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    pintarEnergia();
}, 1000);

function feed(msg) {
    const el = $('#jogo-feed').append($('<div>').text(msg))[0];
    el.scrollTop = el.scrollHeight;
}

function atualizarChat() {
    const aberto = estado.jogo.chatAberto || estado.jogo.chatLiberado;
    $('#chat-area').toggleClass('d-none', !aberto);
    $('#chat-fechado').toggleClass('d-none', aberto);
}

function renderJogadores() {
    const $ul = $('#jogo-jogadores').empty();
    for (const p of estado.jogo.ultimaLista || []) {
        const sou = socket && p.socketId === socket.id;
        const porta = estado.jogo.portas[p.socketId];
        const $li = $('<li class="d-flex align-items-center flex-wrap gap-2 mb-1">');
        $('<span>').text(p.nome + (sou ? ' (você)' : '') + (porta ? ` — porta ${porta}` : '')).appendTo($li);
        if (sou) { $ul.append($li); continue; }

        $('<button class="btn btn-sm btn-outline-warning py-0">')
            .text('Dar resposta (-5%)')
            .on('click', () => socket.emit('dar_ajuda', { paraSocketId: p.socketId }))
            .appendTo($li);

        const pediu = estado.jogo.pedidos[p.socketId] && !estado.jogo.recusei.has(p.socketId);
        if (pediu) {
            $('<button class="btn btn-sm btn-outline-info py-0">')
                .text('Oferecer ajuda')
                .on('click', () => socket.emit('oferecer_ajuda', { paraSocketId: p.socketId }))
                .appendTo($li);
            $('<button class="btn btn-sm btn-outline-danger py-0">')
                .text('Não ajudar (+2%)')
                .on('click', () => socket.emit('nao_ajudar', { paraSocketId: p.socketId }))
                .appendTo($li);
        }
        $ul.append($li);
    }
}

function renderPresentes(lista) {
    if (!lista) return;
    estado.jogo.ultimaLista = lista;
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
    renderJogadores();
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

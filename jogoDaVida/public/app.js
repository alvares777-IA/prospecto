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
        modo: 'individual',
        inicio: null, porta: 0, total: 0,
        energiaBase: null, energiaDt: 0, decaimentoMin: 1,
        portas: {}, ultimaLista: [],
        chatAberto: false, chatLiberado: false,
        noHall: false, niveisLista: [],
        pedidos: {},          // socketId -> { jogador, porta }  (pedidos de ajuda abertos)
        recusei: new Set(),   // socketIds que EU recusei ajudar
        coop: {               // modo em equipe
            fase: 1, totalFases: 1, enigmas: [], ordemAberta: null,
            energiaBase: null, energiaDt: 0, decaimentoMin: 1,
        },
    },
};

let socket = null;

// Enigma interativo (iframe /enigmas/*): a página manda só a escolha do jogador;
// quem valida é o servidor. O resultado volta para o iframe (mostra ✓/✗).
window.addEventListener('message', e => {
    if (e.origin !== location.origin) return;
    const d = e.data || {};
    if (d.tipo === 'tentativa' && socket) {
        if (estado.jogo.modo === 'coop') {
            socket.emit('responder', { ordem: estado.jogo.coop.ordemAberta, resposta: d.valor ?? '' });
        } else {
            estado.jogo._htmlPendente = true;
            socket.emit('responder', { resposta: d.valor ?? '' });
        }
    }
});

function avisarIframe(correto) {
    const w = document.getElementById('jogo-iframe')?.contentWindow;
    try { w && w.postMessage({ tipo: 'resultado', correto }, location.origin); } catch (e) {}
}

function avisarIframeCoop(correto) {
    const w = document.getElementById('coop-iframe')?.contentWindow;
    try { w && w.postMessage({ tipo: 'resultado', correto }, location.origin); } catch (e) {}
}

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
    $('#btn-criar').on('click', () => { conectar(); socket.emit('criar_sala', payloadJogador({ modo: 'individual' })); });
    $('#btn-criar-coop').on('click', () => { conectar(); socket.emit('criar_sala', payloadJogador({ modo: 'coop' })); });
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

    socket.on('sala_pronta', ({ codigo, souCriador, estado: est, modo, voce, lista }) => {
        estado.codigo = codigo;
        estado.souCriador = !!souCriador;
        estado.persistido = false;
        estado.jogoIniciado = est === 'em_jogo';
        if (modo) aplicarModo(modo);
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

    socket.on('presenca_confirmada', ({ modo, energiaPessoal } = {}) => {
        estado.persistido = true;
        if (modo) aplicarModo(modo);
        if (energiaPessoal != null) $('#minha-energia').text(`Sua energia: ${Math.round(energiaPessoal)}%`);
        atualizarInicio();
    });
    socket.on('jogo_iniciado', ({ modo } = {}) => {
        estado.jogoIniciado = true;
        if (modo) aplicarModo(modo);
        atualizarInicio();
    });

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
    socket.on('hall', ({ porta }) => {
        // acerto de enigma html: mostra o ✓ no iframe antes de trocar de tela
        if (estado.jogo._htmlPendente) {
            estado.jogo._htmlPendente = false;
            avisarIframe(true);
            setTimeout(() => aplicarHall(porta), 700);
            return;
        }
        aplicarHall(porta);
    });
    $('#btn-prosseguir').on('click', () => socket.emit('prosseguir'));

    function aplicarHall(porta) {
        if (!estado.jogo.inicio) estado.jogo.inicio = Date.now();
        estado.jogo.noHall = true;
        estado.jogo.porta = porta;
        $('#jogo-enigma').addClass('d-none');
        $('#jogo-iframe').attr('src', 'about:blank');
        $('#resposta-recebida').addClass('d-none').empty();
        $('#jogo-fim').addClass('d-none');
        $('#hall').removeClass('d-none');
        $('#hall-proxima').text(`próxima: porta ${porta}${estado.jogo.total ? ' de ' + estado.jogo.total : ''}`);
        renderHall();
        atualizarChat();
        $('#campo-msg').trigger('focus');
    }
    $('#btn-prosseguir').on('click', () => socket.emit('prosseguir'));

    socket.on('meu_enigma', st => {
        if (!estado.jogo.inicio) estado.jogo.inicio = Date.now();
        estado.jogo.noHall = false;
        estado.jogo.porta = st.porta;
        estado.jogo.total = st.total;
        estado.jogo.chatAberto = !!st.chatAberto;
        $('#hall').addClass('d-none');
        atualizarChat();
        setEnergia(st.energia, st.decaimentoMin);
        if (st.terminou) return;
        $('#jogo-enigma').removeClass('d-none');
        $('#jogo-fim').addClass('d-none');
        $('#jogo-porta').text(`Porta ${st.porta} de ${st.total}${st.nivel ? ' · ' + st.nivel : ''}`);
        $('#jogo-aviso').text('');
        $('#resposta-recebida').addClass('d-none').empty();

        if (st.tipo === 'html' && st.arquivo) {
            // enigma interativo: a própria página valida e avisa por postMessage
            $('#jogo-pergunta, #jogo-form').addClass('d-none');
            $('#jogo-iframe')
                .attr('src', '/enigmas/' + st.arquivo + '?t=' + Date.now())
                .removeClass('d-none');
        } else {
            $('#jogo-iframe').addClass('d-none').attr('src', 'about:blank');
            $('#jogo-pergunta').removeClass('d-none').text(st.pergunta);
            $('#jogo-form').removeClass('d-none');
            $('#jogo-resposta').val('').prop('disabled', false).trigger('focus');
        }
    });
    socket.on('niveis', ({ lista }) => {
        estado.jogo.niveisLista = lista || [];
        for (const p of estado.jogo.niveisLista) {
            if (p.porta != null) estado.jogo.portas[p.socketId] = p.porta;
        }
        renderRosters();
    });
    socket.on('chat_liberado', () => {
        if (estado.jogo.chatLiberado) return;
        estado.jogo.chatLiberado = true;
        atualizarChat();
        feed('o chat foi liberado');
    });
    socket.on('energia', ({ energia }) => {
        if (estado.jogo.modo === 'coop') setEnergiaCoop(energia);
        else setEnergia(energia);
    });
    socket.on('resposta_errada', ({ energia }) => {
        if (estado.jogo.modo === 'coop') {
            setEnergiaCoop(energia);
            $('#coop-aviso').removeClass('text-success').addClass('text-danger')
                .text('Resposta errada — a equipe perdeu energia.');
            $('#coop-resposta').val('').trigger('focus');
            avisarIframeCoop(false);
            return;
        }
        setEnergia(energia);
        $('#jogo-aviso').removeClass('text-success').addClass('text-danger').text('Resposta errada. -5% de energia.');
        $('#jogo-resposta').val('').trigger('focus');
        if (estado.jogo._htmlPendente) { avisarIframe(false); estado.jogo._htmlPendente = false; }
    });
    socket.on('porta_alcancada', ({ jogador, socketId, porta }) => {
        estado.jogo.portas[socketId] = porta;
        renderRosters();
        feed(`${jogador} chegou na porta ${porta}`);
    });
    socket.on('pediu_ajuda', ({ jogador, socketId, porta }) => {
        estado.jogo.pedidos[socketId] = { jogador, porta };
        estado.jogo.recusei.delete(socketId);
        renderRosters();
        feed(`${jogador} pediu ajuda na porta ${porta}`);
    });
    socket.on('ajuda_resolvida', ({ socketId }) => {
        delete estado.jogo.pedidos[socketId];
        estado.jogo.recusei.delete(socketId);
        renderRosters();
    });
    socket.on('ofereceu_ajuda', ({ de, para }) => feed(`${de} ofereceu ajuda a ${para}`));
    socket.on('recusou_ajuda', ({ de, para, socketId, alvoSocketId }) => {
        feed(`${de} não quis ajudar ${para}`);
        if (socketId === socket.id) { estado.jogo.recusei.add(alvoSocketId); renderRosters(); }
    });
    socket.on('ajudou', ({ de, para }) => feed(`${de} deu a resposta a ${para}`));
    socket.on('spoiler_chat', ({ jogador, penalidade }) => {
        feed(`⚠️ ${jogador} colocou uma resposta no chat — todos perderam ${penalidade}%`);
        $('#jogo-aviso').removeClass('text-success').addClass('text-danger')
            .text(`Resposta no chat: -${penalidade}% de energia para todos.`);
    });
    socket.on('ajuda_recebida', ({ de, porta, resposta }) => {
        feed(`${de} te passou a resposta da porta ${porta}`);
        // elemento próprio, visível só para quem recebeu — não passa pelo chat
        const $b = $('#resposta-recebida').empty().removeClass('d-none');
        $('<span>').text('🔑 ').appendTo($b);
        $('<strong>').text(de).appendTo($b);
        $('<span>').text(` te passou a resposta da porta ${porta}: `).appendTo($b);
        $('<strong>').text(resposta).appendTo($b);
    });
    socket.on('jogo_terminado', ({ porta, energia, modo }) => {
        if (modo === 'coop') {
            setEnergiaCoop(energia);
            $('#coop-tabuleiro, #coop-resolver, #coop-avancar, #coop-hall').addClass('d-none');
            $('#coop-fim').removeClass('d-none alert-danger').addClass('alert-success')
                .text(`A equipe venceu! Energia final da equipe: ${Math.round(energia)}%`);
            return;
        }
        estado.jogo.noHall = false;
        setEnergia(energia);
        $('#jogo-enigma, #hall').addClass('d-none');
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

    // ── modo em equipe (coop) ────────────────────────────────────────
    socket.on('estado_coop', est => {
        if (!estado.jogo.inicio) estado.jogo.inicio = Date.now();
        aplicarModo('coop');
        const c = estado.jogo.coop;
        c.fase = est.fase;
        c.totalFases = est.totalFases;
        c.enigmas = est.enigmas || [];
        c.faseCompleta = !!est.faseCompleta;
        setEnergiaCoop(est.energia, est.decaimentoMin);
        $('#coop-fase').text(`Fase ${est.fase} de ${est.totalFases}`);
        atualizarChat();

        if (est.terminou) {
            $('#coop-tabuleiro, #coop-resolver, #coop-avancar, #coop-hall').addClass('d-none');
            $('#coop-fim').removeClass('d-none alert-danger').addClass('alert-success')
                .text(`A equipe venceu! Energia final da equipe: ${Math.round(est.energia)}%`);
            return;
        }
        if (est.esgotado) {
            $('#coop-tabuleiro, #coop-resolver, #coop-avancar, #coop-hall').addClass('d-none');
            $('#coop-fim').removeClass('d-none alert-success').addClass('alert-danger')
                .text('A energia da equipe acabou. Fim de jogo.');
            return;
        }
        // se eu estava resolvendo um enigma que já foi resolvido, volto ao tabuleiro
        const aberta = c.ordemAberta;
        const aindaAberta = aberta != null && c.enigmas.some(e => e.ordem === aberta && !e.resolvido);
        if (!aindaAberta && !$('#coop-hall').is(':visible')) {
            c.ordemAberta = null;
            $('#coop-iframe').attr('src', 'about:blank');
            $('#coop-resolver').addClass('d-none');
            $('#coop-tabuleiro').removeClass('d-none');
        }
        renderCoopTabuleiro(est);
    });

    socket.on('enigma_resolvido', ({ ordem, por }) => {
        coopFeed(`✓ enigma resolvido por ${por}`);
        if (estado.jogo.coop.ordemAberta === ordem) avisarIframeCoop(true);
        // o estado_coop vem logo atrás e re-renderiza
    });

    socket.on('fase_avancou', ({ fase, venceu }) => {
        coopFeed(venceu ? 'A equipe concluiu a última fase!' : `A equipe avançou para a fase ${fase}`);
        estado.jogo.coop.ordemAberta = null;
        $('#coop-iframe').attr('src', 'about:blank');
        $('#coop-resolver, #coop-hall, #coop-avancar').addClass('d-none');
        $('#coop-tabuleiro').removeClass('d-none');
    });

    socket.on('coop_no_hall', () => {
        $('#coop-tabuleiro, #coop-resolver, #coop-avancar').addClass('d-none');
        $('#coop-hall').removeClass('d-none');
    });

    socket.on('hall_coop', ({ noHall, naSala }) => {
        const $ul = $('#coop-hall-lista').empty();
        for (const p of noHall || []) $('<li class="text-success">').text(`${p.nome} — pronto`).appendTo($ul);
        for (const p of naSala || []) $('<li class="text-secondary">').text(`${p.nome} — ainda no tabuleiro`).appendTo($ul);
    });

    socket.on('equipe_esgotada', ({ energia }) => {
        setEnergiaCoop(energia ?? 0);
        $('#coop-tabuleiro, #coop-resolver, #coop-avancar, #coop-hall').addClass('d-none');
        $('#coop-fim').removeClass('d-none alert-success').addClass('alert-danger')
            .text('A energia da equipe acabou. Fim de jogo.');
    });

    $('#coop-form').on('submit', e => {
        e.preventDefault();
        const r = $('#coop-resposta').val().trim();
        if (r) socket.emit('responder', { ordem: estado.jogo.coop.ordemAberta, resposta: r });
    });
    $('#coop-voltar').on('click', voltarCoopTabuleiro);
    $('#btn-avancar-fase').on('click', () => socket.emit('avancar_fase'));
    $('#btn-comecar-fase').on('click', () => socket.emit('comecar_fase'));
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
    pintarBarra('#jogo-energia-num', '#jogo-energia-barra', energiaAgora());
}

function pintarBarra(selNum, selBarra, e) {
    $(selNum).text(Math.round(e) + '%');
    $(selBarra).css('width', e + '%')
        .toggleClass('bg-success', e > 50).toggleClass('bg-warning', e <= 50 && e > 20)
        .toggleClass('bg-danger', e <= 20);
}

// ── energia da equipe (coop) ────────────────────────────────────────
function setEnergiaCoop(valor, decaimentoMin) {
    const c = estado.jogo.coop;
    c.energiaBase = valor;
    c.energiaDt = Date.now();
    if (decaimentoMin != null) c.decaimentoMin = decaimentoMin;
    pintarEnergiaCoop();
}

function energiaCoopAgora() {
    const c = estado.jogo.coop;
    if (c.energiaBase == null) return 100;
    const min = (Date.now() - c.energiaDt) / 60000;
    return Math.max(0, c.energiaBase - (c.decaimentoMin || 1) * min);
}

function pintarEnergiaCoop() {
    pintarBarra('#coop-energia-num', '#coop-energia-barra', energiaCoopAgora());
}

// relógio + energia local, 1x por segundo
setInterval(() => {
    if (!estado.jogo.inicio) return;
    const s = Math.floor((Date.now() - estado.jogo.inicio) / 1000);
    const relogio = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (estado.jogo.modo === 'coop') {
        $('#coop-relogio').text(relogio);
        pintarEnergiaCoop();
    } else {
        $('#jogo-relogio').text(relogio);
        pintarEnergia();
    }
}, 1000);

// Aplica o modo da sala (individual | coop) no estado e nos rótulos.
function aplicarModo(modo) {
    estado.jogo.modo = modo === 'coop' ? 'coop' : 'individual';
    $('#rotulo-modo').toggleClass('d-none', estado.jogo.modo !== 'coop');
}

function coopFeed(msg) {
    const el = $('#coop-feed').append($('<div>').text(msg))[0];
    if (el) el.scrollTop = el.scrollHeight;
}

function renderCoopTabuleiro(est) {
    const enigmas = est.enigmas || [];
    const feitos = enigmas.filter(e => e.resolvido).length;
    $('#coop-progresso').text(`${feitos} de ${enigmas.length} enigmas resolvidos nesta fase`);
    const $ul = $('#coop-enigmas').empty();
    enigmas.forEach((e, i) => {
        const $li = $('<li class="d-flex align-items-center flex-wrap gap-2 mb-1">');
        if (e.resolvido) {
            $('<span class="text-success">')
                .text(`✓ enigma ${i + 1}${e.porQuem ? ' — ' + e.porQuem : ''}`).appendTo($li);
        } else {
            $('<span>').text(`enigma ${i + 1}${e.nivel ? ' · ' + e.nivel : ''}`).appendTo($li);
            $('<button class="btn btn-sm btn-outline-primary py-0" type="button">')
                .text('Resolver').on('click', () => abrirCoopEnigma(e)).appendTo($li);
        }
        $ul.append($li);
    });
    $('#coop-avancar').toggleClass('d-none', !est.faseCompleta);
    if (!est.faseCompleta) $('#coop-hall').addClass('d-none');
}

function abrirCoopEnigma(e) {
    estado.jogo.coop.ordemAberta = e.ordem;
    $('#coop-tabuleiro, #coop-avancar, #coop-hall').addClass('d-none');
    $('#coop-resolver').removeClass('d-none');
    $('#coop-aviso').text('');
    $('#coop-enigma-nivel').text(e.nivel || '');
    if (e.tipo === 'html' && e.arquivo) {
        $('#coop-enigma-pergunta, #coop-form').addClass('d-none');
        $('#coop-iframe').attr('src', '/enigmas/' + e.arquivo + '?t=' + Date.now()).removeClass('d-none');
    } else {
        $('#coop-iframe').addClass('d-none').attr('src', 'about:blank');
        $('#coop-enigma-pergunta').removeClass('d-none').text(e.pergunta);
        $('#coop-form').removeClass('d-none');
        $('#coop-resposta').val('').trigger('focus');
    }
}

function voltarCoopTabuleiro() {
    estado.jogo.coop.ordemAberta = null;
    $('#coop-iframe').attr('src', 'about:blank');
    $('#coop-resolver').addClass('d-none');
    $('#coop-tabuleiro').removeClass('d-none');
    $('#coop-avancar').toggleClass('d-none', !estado.jogo.coop.faseCompleta);
}

function feed(msg) {
    const el = $('#jogo-feed').append($('<div>').text(msg))[0];
    el.scrollTop = el.scrollHeight;
}

function atualizarChat() {
    // no hall (e no modo em equipe) o chat sempre aparece
    const aberto = estado.jogo.modo === 'coop'
        || estado.jogo.noHall || estado.jogo.chatAberto || estado.jogo.chatLiberado;
    $('#chat-area').toggleClass('d-none', !aberto);
    $('#chat-fechado').toggleClass('d-none', aberto);
}

function renderRosters() {
    renderHall();
    renderJogadores();
}

function renderHall() {
    const $ul = $('#hall-jogadores').empty();
    for (const p of estado.jogo.niveisLista) {
        const sou = socket && p.socketId === socket.id;
        const nivel = p.terminou ? 'concluiu' : (p.porta != null ? `nível ${p.porta}` : '—');
        const $li = $('<li class="d-flex align-items-center flex-wrap gap-2 mb-1">');
        $('<span>').text(`${p.nome}${sou ? ' (você)' : ''} — ${nivel}`).appendTo($li);

        const pediu = !sou && estado.jogo.pedidos[p.socketId] && !estado.jogo.recusei.has(p.socketId);
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
    renderRosters();
}

// Estado do bloco "Iniciar jogo" / painel de controles.
function atualizarInicio() {
    if (estado.jogoIniciado) {
        $('#area-inicio').addClass('d-none');
        if (estado.jogo.modo === 'coop') {
            $('#painel-controles').addClass('d-none');
            $('#painel-coop').removeClass('d-none');
        } else {
            $('#painel-coop').addClass('d-none');
            $('#painel-controles').removeClass('d-none');
        }
        return;
    }
    $('#painel-controles, #painel-coop').addClass('d-none');
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

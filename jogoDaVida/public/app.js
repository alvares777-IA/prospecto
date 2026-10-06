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
    modo: 'desafios',         // 'desafios' (sequência) | 'livre' (lista de portas) — vem do servidor
    persistido: false,        // a minha entrada já foi gravada no banco?
    jogoIniciado: false,
    jogo: {                   // estado do protótipo de jogo
        inicio: null, porta: 0, total: 0,
        energiaBase: null, energiaDt: 0, decaimentoMin: 1,
        portas: {}, ultimaLista: [],
        chatAberto: false, chatLiberado: false,
        noHall: false, niveisLista: [],
        pedidos: {},          // socketId -> { jogador, porta }  (pedidos de ajuda abertos)
        doacoesPedidas: {},   // socketId -> { jogador, porta }  (pedidos de doação de energia)
        recusei: new Set(),   // socketIds que EU recusei ajudar
        semEnergia: false,    // meu estado esgotado (para reabilitar ao receber energia)
        fase: {               // trecho co-op da sequência, quando eu estou nele
            ativa: false, inicio: 0, fim: 0, enigmas: [], ordemAberta: null, completa: false,
        },
    },
};

let socket = null;

// Enigma interativo (iframe /enigmas/*): a página manda só a escolha do jogador;
// quem valida é o servidor. O resultado volta para o iframe (mostra ✓/✗).
window.addEventListener('message', e => {
    if (e.origin !== location.origin) return;
    const d = e.data || {};
    // jogo pediu para gastar energia (tiro): o servidor decide; o jogo só
    // dispara com a resposta ok
    if (d.tipo === 'pedir_config' && socket && e.source) {
        socket.emit('config_jogo', { ordem: ordemDoJogoAberto() }, cfg => {
            try { e.source.postMessage({ tipo: 'config', valores: cfg || {} }, location.origin); } catch (err) { /* iframe já saiu */ }
        });
        return;
    }
    if (d.tipo === 'pedir_gasto' && socket && e.source) {
        socket.emit('energia_jogo', { motivo: d.motivo, ordem: ordemDoJogoAberto() }, r => {
            try {
                e.source.postMessage({ tipo: r?.ok ? 'gasto_ok' : 'gasto_negado', pedido: d.motivo, motivo: r?.erro, valor: r?.valor }, location.origin);
            } catch (err) { /* iframe já saiu */ }
        });
        return;
    }
    // modo livre: o jogo concluiu um nível interno; o servidor grava e devolve a lista
    if (d.tipo === 'nivel_concluido' && socket && e.source) {
        socket.emit('nivel_concluido', { nivel: d.nivel, ordem: ordemDoJogoAberto() }, r => {
            try { e.source.postMessage({ tipo: 'niveis_concluidos', concluidos: r?.concluidos || null }, location.origin); } catch (err) { /* iframe já saiu */ }
        });
        return;
    }
    if (d.tipo === 'tentativa' && socket) {
        estado.jogo._htmlPendente = true;
        if (estado.jogo.fase.ativa && estado.jogo.fase.ordemAberta != null) {
            socket.emit('responder', { ordem: estado.jogo.fase.ordemAberta, resposta: d.valor ?? '' });
        } else {
            socket.emit('responder', { resposta: d.valor ?? '' });
        }
    }
});

// Numa fase, o servidor precisa saber QUAL jogo do trecho está aberto.
function ordemDoJogoAberto() {
    return estado.jogo.fase.ativa ? estado.jogo.fase.ordemAberta : null;
}

function avisarIframe(correto, sel = '#jogo-iframe') {
    const w = document.querySelector(sel)?.contentWindow;
    try { w && w.postMessage({ tipo: 'resultado', correto }, location.origin); } catch (e) {}
}

// Jogo/enigma interativo terminou de carregar: foco nele, para setas e espaço
// irem direto pro jogo sem o jogador ter de clicar dentro antes.
$('#jogo-iframe, #jogo-fase-iframe').on('load', function () {
    if (!this.src || this.src === 'about:blank') return;
    try { this.contentWindow.focus(); } catch (e) { /* outra origem: sem foco */ }
    this.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

function pedirTelaCheia(id) {
    const el = document.getElementById(id);
    const pedir = el?.requestFullscreen || el?.webkitRequestFullscreen;
    try { pedir && pedir.call(el); } catch (e) {}
}

// ── Ambiente: cor de fundo do painel + da página. Hall tem cor fixa
// (corredor), cada sala tem uma cor sorteada e estável por porta. ──
const CORES_SALA = [
    { painel: '#1b1230', body: '#0f0a1c' },  // roxo
    { painel: '#0e2129', body: '#07141a' },  // teal
    { painel: '#28141c', body: '#180a0f' },  // vinho
    { painel: '#102a1d', body: '#08160f' },  // verde
    { painel: '#282011', body: '#161109' },  // âmbar
    { painel: '#131c33', body: '#090e1f' },  // azul
];
const COR_HALL = { painel: '#222c40', body: '#151b2a' };   // corredor: mais claro e neutro
const COR_PADRAO = { painel: '#0d1224', body: '#0b1020' };

function aplicarAmbiente(c) {
    $('#painel-controles').css('background-color', c.painel);
    document.body.style.backgroundColor = c.body;
}
function corDaSala(chave) {
    const cache = estado.jogo._cores || (estado.jogo._cores = {});
    if (!cache[chave]) {
        let i;
        do { i = Math.floor(Math.random() * CORES_SALA.length); }
        while (CORES_SALA.length > 1 && i === estado.jogo._ultimaCor);
        estado.jogo._ultimaCor = i;
        cache[chave] = CORES_SALA[i];
    }
    return cache[chave];
}

// ── Som de alerta (WebAudio, sem arquivo). Precisa de um gesto do usuário
// para "acordar" o contexto — chamamos iniciarAudio() no primeiro clique. ──
let _actx = null;
function iniciarAudio() {
    try {
        _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
        if (_actx.state === 'suspended') _actx.resume();
    } catch (e) {}
}
function bip(freq, dur, atraso) {
    iniciarAudio();
    if (!_actx) return;
    try {
        if (_actx.state === 'suspended') _actx.resume();
        const t = _actx.currentTime + (atraso || 0);
        const o = _actx.createOscillator(), g = _actx.createGain();
        o.type = 'triangle'; o.frequency.value = freq;
        o.connect(g); g.connect(_actx.destination);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
}
function somPedido()   { bip(600, 0.16); bip(920, 0.18, 0.17); }   // atenção: dois toques subindo
function somRecebido() { bip(880, 0.13); bip(1320, 0.18, 0.12); }  // chegou algo p/ você
// "acorda" o áudio em qualquer clique (resume é no-op se já estiver rodando)
document.addEventListener('pointerdown', iniciarAudio, true);

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
    // nova sala: primeiro pergunta o modo (desafios ou livre)
    $('#btn-criar').on('click', () => $('#escolha-modo').removeClass('d-none'));
    $('.btn-modo-jogo').on('click', function () {
        conectar();
        socket.emit('criar_sala', payloadJogador({ modo: $(this).data('modo') }));
    });
    $('#btn-entrar-sala').on('click', entrarNaSalaDigitada);
    $('#campo-codigo').on('keydown', e => { if (e.key === 'Enter') entrarNaSalaDigitada(); });
    $('#btn-copiar').on('click', copiarLink);
    $('#btn-iniciar').on('click', () => socket && socket.emit('iniciar_jogo'));
    // volta pro início pra criar/entrar numa sala nova — a sala concluída não
    // se reinicia sozinha (outros podem ainda estar jogando nela).
    $('#btn-jogar-de-novo').on('click', () => { location.href = '/'; });
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
        carregarSalasRecentes();
        $('#campo-codigo').trigger('focus');
    }
}

function entrarNaSala(codigo) {
    conectar();
    socket.emit('entrar_sala', payloadJogador({ codigo }));
}

function entrarNaSalaDigitada() {
    const codigo = $('#campo-codigo').val().trim().toUpperCase();
    if (!codigo) return mostrar('#erro-sala', 'Digite o código da sala.');
    entrarNaSala(codigo);
}

// Portas das 10 salas abertas mais recentes — clicar entra direto nelas.
async function carregarSalasRecentes() {
    const $portas = $('#salas-recentes-portas').empty();
    try {
        const r = await fetch('/salas-recentes');
        if (!r.ok) throw new Error('status ' + r.status);
        const { salas } = await r.json();
        if (!salas || !salas.length) {
            $portas.html('<span class="text-secondary small">nenhuma sala aberta no momento</span>');
            return;
        }
        for (const s of salas) {
            const $p = $('<button class="hall-porta" type="button">')
                .attr('title', `sala ${s.codigo} — ${s.modo === 'livre' ? 'modo livre' : 'desafios'} — ${s.estado === 'em_jogo' ? 'em jogo' : 'aguardando'}`);
            $('<span class="hall-porta-folha"><span class="hall-porta-macaneta"></span></span>').appendTo($p);
            $('<span class="hall-porta-placa">').text(s.codigo).appendTo($p);
            $p.on('click', () => entrarNaSala(s.codigo));
            $portas.append($p);
        }
    } catch (e) {
        $portas.html('<span class="text-danger small">falha ao carregar salas recentes</span>');
    }
}

// Cria o socket e registra os ouvintes uma vez.
function conectar() {
    if (socket) return;
    iniciarAudio();   // chamado a partir de um clique -> "acorda" o áudio
    socket = io();

    // Reconexão (servidor reiniciou ou a rede caiu): o socket novo não está em
    // sala nenhuma e o servidor perdeu o estado vivo. Entra de novo na mesma
    // sala — o servidor retoma pelo banco e manda para o hall da porta atual.
    let jaConectou = false;
    socket.on('connect', () => {
        $('#status-conexao').text('conectado');
        if (jaConectou && estado.codigo) {
            socket.emit('entrar_sala', payloadJogador({ codigo: estado.codigo }));
            feed('reconectado — voltando para a sala');
        }
        jaConectou = true;
    });
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
        aplicarAmbiente(COR_PADRAO);   // saguão: fundo neutro até começar
        trocarTela('#tela-sala');
        renderPresentes(lista);
        atualizarInicio();
        $('#campo-msg').trigger('focus');
    });

    socket.on('presenca_confirmada', ({ modo }) => {
        definirModo(modo);
        estado.persistido = true;
        atualizarInicio();
    });
    socket.on('jogo_iniciado', () => {
        estado.jogoIniciado = true;
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
            setTimeout(() => aplicarHall(porta), 1500);
            return;
        }
        aplicarHall(porta);
    });
    $('#btn-prosseguir').on('click', () => socket.emit('prosseguir'));

    // Modo livre: o "hall" é a lista de todas as portas (rótulo = pergunta).
    socket.on('lista_livre', dados => {
        if (!dados) return;
        definirModo('livre');
        if (estado.jogo._htmlPendente) {
            estado.jogo._htmlPendente = false;
            avisarIframe(true);
            setTimeout(() => aplicarListaLivre(dados), 1500);
            return;
        }
        aplicarListaLivre(dados);
    });

    function aplicarListaLivre({ portas, total }) {
        aplicarHall(null);
        estado.jogo.total = total;
        const feitas = portas.filter(p => p.resolvida).length;
        $('#hall-proxima').text(`modo livre — ${feitas} de ${total} resolvidas`);
        $('#btn-prosseguir').addClass('d-none');
        const $l = $('#hall-livre').empty().removeClass('d-none');
        for (const p of portas) {
            const rotulo = p.pergunta || `Porta ${p.ordem}`;
            const $p = $('<button class="hall-porta" type="button">')
                .attr('title', `${p.resolvida ? '✓ resolvida — ' : ''}${rotulo}${p.nivel ? ' · ' + p.nivel : ''}`)
                .toggleClass('fase-porta-aberta', p.resolvida)
                .prop('disabled', estado.jogo.semEnergia)
                .on('click', () => socket.emit('escolher_porta', { ordem: p.ordem }));
            $('<span class="hall-porta-folha"><span class="hall-porta-macaneta"></span></span>').appendTo($p);
            $('<span class="hall-porta-placa">').text((p.resolvida ? '✓ ' : '') + rotulo).appendTo($p);
            $l.append($p);
        }
    }

    function aplicarHall(porta) {
        if (!estado.jogo.inicio) estado.jogo.inicio = Date.now();
        $('#hall-livre').addClass('d-none');
        $('#btn-prosseguir').removeClass('d-none');
        estado.jogo.noHall = true;
        estado.jogo.fase.ativa = false;
        estado.jogo.fase.ordemAberta = null;
        estado.jogo.porta = porta;
        pararMundo();
        $('#jogo-enigma, #jogo-fase, #jogo-fim, #btn-jogar-de-novo').addClass('d-none');
        $('#jogo-iframe, #jogo-fase-iframe').attr('src', 'about:blank');
        $('#resposta-recebida').addClass('d-none').empty();
        $('#hall').removeClass('d-none');
        $('#hall-proxima').text(`próxima: porta ${porta}${estado.jogo.total ? ' de ' + estado.jogo.total : ''}`);
        $('#hall-porta-num').text(`PORTA ${porta}`);
        aplicarAmbiente(COR_HALL);
        renderHall();
        sincDoacaoBtn();
        atualizarChat();
        $('#campo-msg').trigger('focus');
    }
    $('#btn-prosseguir').on('click', () => socket.emit('prosseguir'));

    socket.on('meu_enigma', st => {
        if (!st) return;
        if (!estado.jogo.inicio) estado.jogo.inicio = Date.now();
        estado.jogo.noHall = false;
        estado.jogo.porta = st.porta;
        estado.jogo.total = st.total;
        estado.jogo.chatAberto = !!st.chatAberto;
        $('#hall').addClass('d-none');
        setEnergia(st.energia, st.decaimentoMin);
        if (st.energia > 0 && estado.jogo.semEnergia) {
            estado.jogo.semEnergia = false;
            $('#jogo-resposta, #jogo-pedir, #jogo-pedir-doacao, #jogo-desistir').prop('disabled', false);
        }
        if (st.terminou) { estado.jogo.fase.ativa = false; atualizarChat(); return; }

        if (st.tipo === 'fase') { entrarNaFase(st); return; }
        if (st.tipo === 'mundo') { entrarNoMundo(st); return; }
        pararMundo();

        estado.jogo.fase.ativa = false;
        aplicarAmbiente(corDaSala('p' + st.porta));
        atualizarChat();
        sincDoacaoBtn();
        $('#jogo-fase').addClass('d-none');
        $('#jogo-enigma').removeClass('d-none');
        $('#jogo-fim, #btn-jogar-de-novo').addClass('d-none');
        $('#jogo-porta').text(estado.modo === 'livre'
            ? `Modo livre · porta ${st.porta} de ${st.total}${st.nivel ? ' · ' + st.nivel : ''}`
            : `Porta ${st.porta} de ${st.total}${st.nivel ? ' · ' + st.nivel : ''}`);
        $('#jogo-aviso').text('');
        $('#resposta-recebida').addClass('d-none').empty();

        if ((st.tipo === 'html' || st.tipo === 'jogo') && st.arquivo) {
            $('#jogo-pergunta, #jogo-form').addClass('d-none');
            $('#jogo-iframe')
                .attr('src', '/enigmas/' + st.arquivo + '?t=' + Date.now())
                .removeClass('d-none');
            $('#jogo-tela-cheia').removeClass('d-none');
        } else {
            $('#jogo-iframe').addClass('d-none').attr('src', 'about:blank');
            $('#jogo-tela-cheia').addClass('d-none');
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
        if (estado.jogo.fase.ativa) renderFase();
    });
    socket.on('chat_liberado', () => {
        if (estado.jogo.chatLiberado) return;
        estado.jogo.chatLiberado = true;
        atualizarChat();
        feed('o chat foi liberado');
    });
    socket.on('energia', ({ energia }) => {
        setEnergia(energia);
        if (estado.jogo.semEnergia && energia > 0) {   // alguém me doou energia -> destravou
            estado.jogo.semEnergia = false;
            $('#jogo-resposta, #jogo-pedir, #jogo-pedir-doacao, #jogo-desistir').prop('disabled', false);
            $('#jogo-aviso, #jogo-fase-aviso').removeClass('text-danger').text('');
        }
    });
    socket.on('resposta_errada', ({ energia, fase }) => {
        setEnergia(energia);
        if (estado.jogo._htmlPendente) { avisarIframe(false, fase ? '#jogo-fase-iframe' : '#jogo-iframe'); estado.jogo._htmlPendente = false; }
        if (fase) {
            $('#jogo-fase-aviso').removeClass('text-success').addClass('text-danger').text('Resposta errada — você perdeu energia.');
            $('#jogo-fase-resposta').val('').trigger('focus');
            return;
        }
        $('#jogo-aviso').removeClass('text-success').addClass('text-danger').text('Resposta errada. -5% de energia.');
        $('#jogo-resposta').val('').trigger('focus');
    });
    socket.on('porta_alcancada', ({ jogador, socketId, porta }) => {
        estado.jogo.portas[socketId] = porta;
        renderRosters();
        feed(`${jogador} chegou na porta ${porta}`);
    });
    socket.on('porta_resolvida_livre', ({ jogador, porta }) => feed(`${jogador} resolveu a porta ${porta}`));
    socket.on('pediu_ajuda', ({ jogador, socketId, porta }) => {
        estado.jogo.pedidos[socketId] = { jogador, porta };
        estado.jogo.recusei.delete(socketId);
        renderRosters();
        feed(`${jogador} pediu ajuda na porta ${porta}`);
        somPedido();
    });
    socket.on('ajuda_resolvida', ({ socketId }) => {
        delete estado.jogo.pedidos[socketId];
        estado.jogo.recusei.delete(socketId);
        renderRosters();
    });

    socket.on('pediu_doacao', ({ jogador, socketId, porta }) => {
        estado.jogo.doacoesPedidas[socketId] = { jogador, porta };
        sincDoacaoBtn();
        renderRosters();
        feed(`${jogador} pediu doação de energia`);
        somPedido();
    });
    socket.on('doacao_resolvida', ({ socketId }) => {
        delete estado.jogo.doacoesPedidas[socketId];
        sincDoacaoBtn();
        renderRosters();
    });
    socket.on('doou_energia', ({ de, para, valor }) => {
        feed(`${de} doou ${Math.round(valor)}% de energia a ${para}`);
    });
    socket.on('doacao_recebida', ({ de, valor, revivido }) => {
        somRecebido();
        // a barra já foi atualizada pelo evento 'energia' que vem logo antes
        const alvo = estado.jogo.fase.ativa ? '#jogo-fase-aviso' : '#jogo-aviso';
        $(alvo).removeClass('text-danger').addClass('text-success')
            .text(`${de} te doou ${Math.round(valor)}% de energia${revivido ? ' — você voltou ao jogo!' : ''}.`);
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
        somRecebido();
        // elemento próprio, visível só para quem recebeu — não passa pelo chat
        const $b = $('#resposta-recebida').empty().removeClass('d-none');
        $('<span>').text('🔑 ').appendTo($b);
        $('<strong>').text(de).appendTo($b);
        $('<span>').text(` te passou a resposta da porta ${porta}: `).appendTo($b);
        $('<strong>').text(resposta).appendTo($b);
    });
    socket.on('jogo_terminado', ({ porta, energia }) => {
        estado.jogo.noHall = false;
        estado.jogo.fase.ativa = false;
        setEnergia(energia);
        aplicarAmbiente(COR_PADRAO);
        pararMundo();
        $('#jogo-enigma, #jogo-fase, #hall').addClass('d-none');
        $('#jogo-fim').removeClass('d-none alert-danger').addClass('alert-success')
            .text(`Você concluiu as ${porta} portas! Energia final: ${Math.round(energia)}%`);
        $('#btn-jogar-de-novo').removeClass('d-none');
    });
    socket.on('sala_derrota', () => {
        estado.jogo.semEnergia = true;
        aplicarAmbiente(COR_PADRAO);
        pararMundo();
        $('#jogo-enigma, #jogo-fase, #hall').addClass('d-none');
        $('#jogo-fim').removeClass('d-none alert-success').addClass('alert-danger')
            .text('Fim de jogo — a sala acabou. Ninguém em pé para continuar.');
        $('#btn-jogar-de-novo').removeClass('d-none');
        $('#jogo-resposta, #jogo-pedir, #jogo-pedir-doacao, #jogo-desistir, #jogo-fase-resposta').prop('disabled', true);
    });
    socket.on('sem_energia', () => {
        estado.jogo.semEnergia = true;
        $('#jogo-resposta, #jogo-pedir, #jogo-desistir, #jogo-fase-resposta').prop('disabled', true);
        const alvo = estado.jogo.fase.ativa ? '#jogo-fase-aviso' : '#jogo-aviso';
        $(alvo).removeClass('text-success').addClass('text-danger')
            .text('Sua energia acabou. Peça uma doação de energia para voltar.');
    });

    $('#jogo-form').on('submit', e => {
        e.preventDefault();
        const r = $('#jogo-resposta').val().trim();
        if (r) socket.emit('responder', { resposta: r });
    });
    $('#jogo-pedir').on('click', () => socket.emit('pedir_ajuda'));
    $('#jogo-pedir-doacao, #hall-pedir-doacao').on('click', () => socket.emit('pedir_doacao'));
    $('#jogo-desistir').on('click', () => socket.emit('desistir', {}));
    $('#jogo-sair, #hall-sair, #mundo-sair-sala').on('click', () => {
        if (window.confirm('Sair da sala e voltar à tela inicial?')) location.href = '/';
    });
    $('#jogo-tela-cheia').on('click', () => pedirTelaCheia('jogo-iframe'));
    $('#jogo-fase-tela-cheia').on('click', () => pedirTelaCheia('jogo-fase-iframe'));

    // ── trecho de fase (co-op) ──────────────────────────────────────
    $('#jogo-fase-form').on('submit', e => {
        e.preventDefault();
        const r = $('#jogo-fase-resposta').val().trim();
        if (r) socket.emit('responder', { ordem: estado.jogo.fase.ordemAberta, resposta: r });
    });
    $('#jogo-fase-voltar').on('click', voltarAoTabuleiro);
    $('#jogo-fase-desistir').on('click', () => socket.emit('desistir', { ordem: estado.jogo.fase.ordemAberta }));
    $('#jogo-fase-prosseguir').on('click', () => socket.emit('prosseguir'));
    $(document).on('click', '.btn-voltar-hall', () => socket.emit('voltar_hall'));

    socket.on('fase_resolvida', ({ ordem, por, faseCompleta }) => {
        feed(`✓ enigma da fase resolvido por ${por}`);
        const f = estado.jogo.fase;
        if (!f.ativa) return;
        const alvo = f.enigmas.find(e => e.ordem === ordem);
        if (alvo) { alvo.resolvido = true; alvo.porQuem = por; alvo.pergunta = null; alvo.arquivo = null; }
        f.completa = !!faseCompleta;
        if (f.ordemAberta === ordem) {
            // fui eu que enviei: o jogo mostra "✓ enviado" por um instante antes de voltar
            const fuiEu = estado.jogo._htmlPendente;
            if (fuiEu) avisarIframe(true, '#jogo-fase-iframe');
            estado.jogo._htmlPendente = false;
            const fechar = () => {
                if (f.ordemAberta !== ordem) return;   // já abriu outro enigma nesse meio-tempo
                f.ordemAberta = null;
                socket.emit('foco_fase', { ordem: null });
                $('#jogo-fase-iframe').attr('src', 'about:blank');
                $('#jogo-fase-resolver').addClass('d-none');
                renderFase();
            };
            if (fuiEu) setTimeout(fechar, 1500); else fechar();
        }
        renderFase();
    });

    socket.on('resposta_revelada', ({ resposta, custo }) => {
        const txt = `O jogo revelou a resposta (-${Math.round(custo)}%): `;
        if (estado.jogo.fase.ativa) {
            $('#jogo-fase-aviso').removeClass('text-danger').addClass('text-success')
                .text('🗝️ ' + txt + resposta + ' — você ainda precisa respondê-la.');
            $('#jogo-fase-resposta').trigger('focus');
        } else {
            const $b = $('#resposta-recebida').empty().removeClass('d-none');
            $('<span>').text('🗝️ ' + txt).appendTo($b);
            $('<strong>').text(resposta).appendTo($b);
            $('<span>').text(' — você ainda precisa respondê-la.').appendTo($b);
            $('#jogo-resposta').trigger('focus');
        }
    });

    socket.on('desistir_negado', ({ motivo }) => {
        const alvo = estado.jogo.fase.ativa ? '#jogo-fase-aviso' : '#jogo-aviso';
        const msg = motivo === 'sem_energia_para_desistir'
            ? 'Você não tem energia suficiente para desistir.'
            : 'Não dá para desistir deste enigma agora.';
        $(alvo).removeClass('text-success').addClass('text-danger').text(msg);
    });

    socket.on('desistiu', ({ jogador }) => feed(`${jogador} preferiu a resposta do jogo`));
}

// Modo da sala. No livre, "voltar" leva à lista de jogos, não ao hall de espera.
function definirModo(modo) {
    if (!modo) return;
    estado.modo = modo;
    const livre = modo === 'livre';
    $('#rotulo-modo').toggleClass('d-none', !livre);
    $('.btn-rotulo-voltar').text(livre ? '🚪 Voltar à lista de jogos' : '🚪 Voltar ao hall');
}

// Entra no tabuleiro do trecho de fase (tipo:'fase' vindo de meu_enigma).
// Porta 'mundo': o chat fica aberto (combinar é parte do jogo; só o clique
// num ato conta). O desenho e as intenções ficam em public/mundo.js.
function entrarNoMundo(st) {
    estado.jogo.fase.ativa = false;
    estado.jogo.chatAberto = true;
    aplicarAmbiente(corDaSala('p' + st.porta));
    atualizarChat();
    sincDoacaoBtn();
    $('#jogo-enigma, #jogo-fase, #jogo-fim, #btn-jogar-de-novo').addClass('d-none');
    $('#jogo-mundo').removeClass('d-none');
    $('#mundo-porta').text(`Porta ${st.porta} de ${st.total} · Mundo`);
    if (!Mundo.ativo()) Mundo.iniciar(socket);
}

function pararMundo() {
    if (typeof Mundo !== 'undefined') Mundo.parar();
    if (document.fullscreenElement?.id === 'jogo-mundo') document.exitFullscreen?.();
    $('#jogo-mundo').addClass('d-none');
}

function entrarNaFase(st) {
    const f = estado.jogo.fase;
    f.ativa = true;
    f.inicio = st.faseInicio;
    f.fim = st.faseFim;
    f.enigmas = st.enigmas || [];
    f.completa = !!st.faseCompleta;
    // mantém o enigma aberto só se ainda não foi resolvido
    if (f.ordemAberta != null && !f.enigmas.some(e => e.ordem === f.ordemAberta && !e.resolvido)) {
        f.ordemAberta = null;
        socket.emit('foco_fase', { ordem: null });
    }
    estado.jogo.chatAberto = true;   // dentro da fase o chat é livre
    aplicarAmbiente(corDaSala('f' + st.faseInicio));
    atualizarChat();
    sincDoacaoBtn();
    $('#jogo-enigma, #jogo-fim, #hall, #btn-jogar-de-novo').addClass('d-none');
    $('#jogo-fase').removeClass('d-none');
    renderFase();
}

function renderFase() {
    const f = estado.jogo.fase;
    const feitos = f.enigmas.filter(e => e.resolvido).length;
    $('#jogo-fase-prog').text(`${feitos} de ${f.enigmas.length} resolvidos`);

    const $ul = $('#jogo-fase-lista').empty();
    f.enigmas.forEach((e, i) => {
        const $p = $('<button class="hall-porta" type="button">');
        $('<span class="hall-porta-folha"><span class="hall-porta-macaneta"></span></span>').appendTo($p);
        const $placa = $('<span class="hall-porta-placa">').appendTo($p);
        if (e.resolvido) {
            $p.addClass('fase-porta-aberta').prop('disabled', true)
                .attr('title', `Resolvido${e.porQuem ? ' por ' + e.porQuem : ''}`);
            $placa.text(`✓ ${i + 1}${e.porQuem ? ' · ' + e.porQuem : ''}`);
        } else {
            $p.attr('title', `Enigma ${i + 1}${e.nivel ? ' · ' + e.nivel : ''} — clique para abrir`)
                .prop('disabled', estado.jogo.semEnergia)
                .on('click', () => abrirFaseEnigma(e));
            $placa.text(`ENIGMA ${i + 1}`);
        }
        $ul.append($p);
    });

    // quem mais está nesta fase (mesma porta de entrada do trecho)
    const comigo = (estado.jogo.niveisLista || [])
        .filter(p => socket && p.socketId !== socket.id && p.porta === f.inicio)
        .map(p => p.nome);
    $('#jogo-fase-quem').text(comigo.length ? 'Na fase com você: ' + comigo.join(', ') : 'Você está sozinho nesta fase.');

    if (f.completa) {
        $('#jogo-fase-resolver').addClass('d-none');
        const $r = $('#jogo-fase-recap').empty();
        f.enigmas.forEach((e, i) => $('<li>').text(`enigma ${i + 1}: ${e.porQuem || '—'}`).appendTo($r));
        $('#jogo-fase-avancar').removeClass('d-none');
    } else {
        $('#jogo-fase-avancar').addClass('d-none');
    }
}

function abrirFaseEnigma(e) {
    estado.jogo.fase.ordemAberta = e.ordem;
    const pos = e.ordem - estado.jogo.fase.inicio + 1;
    socket.emit('foco_fase', { ordem: e.ordem, rotulo: `enigma ${pos} da fase` });
    $('#jogo-fase-avancar').addClass('d-none');
    $('#jogo-fase-resolver').removeClass('d-none');
    $('#jogo-fase-aviso').text('');
    $('#jogo-fase-nivel').text(e.nivel || '');
    if ((e.tipo === 'html' || e.tipo === 'jogo') && e.arquivo) {
        $('#jogo-fase-pergunta, #jogo-fase-form').addClass('d-none');
        $('#jogo-fase-iframe').attr('src', '/enigmas/' + e.arquivo + '?t=' + Date.now()).removeClass('d-none');
        $('#jogo-fase-tela-cheia').removeClass('d-none');
    } else {
        $('#jogo-fase-iframe').addClass('d-none').attr('src', 'about:blank');
        $('#jogo-fase-tela-cheia').addClass('d-none');
        $('#jogo-fase-pergunta').removeClass('d-none').text(e.pergunta);
        $('#jogo-fase-form').removeClass('d-none');
        $('#jogo-fase-resposta').val('').trigger('focus');
    }
}

function voltarAoTabuleiro() {
    if (estado.jogo.fase.ordemAberta != null) socket.emit('foco_fase', { ordem: null });
    estado.jogo.fase.ordemAberta = null;
    $('#jogo-fase-iframe').attr('src', 'about:blank');
    $('#jogo-fase-resolver').addClass('d-none');
    renderFase();
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
    // no hall e dentro de uma fase (co-op) o chat sempre aparece
    const aberto = estado.jogo.fase.ativa
        || estado.jogo.noHall || estado.jogo.chatAberto || estado.jogo.chatLiberado;
    $('#chat-area').toggleClass('d-none', !aberto);
    $('#chat-fechado').toggleClass('d-none', aberto);
}

function renderRosters() {
    renderHall();
    renderJogadores();
}

// Botão "Doar energia" para outro jogador (sempre disponível no modo sozinho).
function botaoDoar($li, p) {
    $('<button class="btn btn-sm btn-outline-info py-0">')
        .text('Doar energia')
        .on('click', () => socket.emit('doar_energia', { paraSocketId: p.socketId }))
        .appendTo($li);
}

function pediuDoacao(socketId, sou) {
    return !sou && !!estado.jogo.doacoesPedidas[socketId];
}

// Texto do meu botão "Pedir doação" conforme eu tenha ou não um pedido aberto.
function sincDoacaoBtn() {
    const ativo = socket && !!estado.jogo.doacoesPedidas[socket.id];
    $('#jogo-pedir-doacao')
        .text(ativo ? 'Cancelar pedido de doação' : 'Pedir doação de energia');
    $('#hall-pedir-doacao').toggleClass('ativo', ativo)
        .attr('title', ativo ? 'Cancelar pedido de doação' : 'Pedir doação de energia');
}

// Onde o jogador está: concluiu > sem energia > enigma da fase > na fase > porta N.
function descLocal(n, portaFallback) {
    if (n) {
        if (n.terminou) return 'concluiu';
        if (n.travado) return 'sem energia';
        if (n.foco) return n.foco;
        if (n.naFase) return 'na fase';
        if (n.porta != null) return `porta ${n.porta}`;
    }
    return portaFallback ? `porta ${portaFallback}` : '';
}

// Hall gráfico: cada jogador é seu avatar com o nome em cima. "Na sala" = no
// hall (em pé no chão); "fora" = num enigma/fase/mundo (esmaecido, na faixa de baixo).
function renderHall() {
    const $chao = $('#hall-jogadores').empty();
    const $fora = $('#hall-fora').empty();
    let nFora = 0;
    for (const p of estado.jogo.niveisLista) {
        const sou = socket && p.socketId === socket.id;
        const dentro = sou ? estado.jogo.noHall : !!p.noHall;
        const lp = (estado.jogo.ultimaLista || []).find(x => x.socketId === p.socketId);
        const av = avatarPorCodigo(lp?.avatar_codigo);
        const pedeDoacao = pediuDoacao(p.socketId, sou);
        const estadoTxt = dentro ? 'na sala' : (descLocal(p) || 'fora');

        const $j = $('<div class="hall-jogador">').toggleClass('eu', !!sou).toggleClass('fora', !dentro)
            .attr('title', `${p.nome} — ${estadoTxt}${pedeDoacao ? ' · pediu doação' : ''}`);
        $('<div class="hall-nome">').text(p.nome + (pedeDoacao ? ' 🔋' : '')).appendTo($j);
        $('<img alt="">').attr('src', av ? av.arquivo : '').appendTo($j);
        $('<div class="hall-estado">').text(estadoTxt).appendTo($j);

        if (!sou) {
            const $ac = $('<div class="hall-acoes">').appendTo($j);
            const pediu = estado.jogo.pedidos[p.socketId] && !estado.jogo.recusei.has(p.socketId);
            if (pediu) {
                $('<button type="button" title="Oferecer ajuda">🤝</button>')
                    .on('click', () => socket.emit('oferecer_ajuda', { paraSocketId: p.socketId })).appendTo($ac);
                $('<button type="button" title="Não ajudar (+2%)">✋</button>')
                    .on('click', () => socket.emit('nao_ajudar', { paraSocketId: p.socketId })).appendTo($ac);
            }
            if (!p.terminou) {
                $('<button type="button" title="Doar energia">⚡</button>')
                    .on('click', () => socket.emit('doar_energia', { paraSocketId: p.socketId })).appendTo($ac);
            }
        }
        if (dentro) $chao.append($j); else { $fora.append($j); nFora++; }
    }
    $('#hall-fora-box').toggleClass('d-none', !nFora);
}

function renderJogadores() {
    const $ul = $('#jogo-jogadores').empty();
    for (const p of estado.jogo.ultimaLista || []) {
        const sou = socket && p.socketId === socket.id;
        const n = (estado.jogo.niveisLista || []).find(x => x.socketId === p.socketId);
        const local = descLocal(n, estado.jogo.portas[p.socketId]);
        const pedeDoacao = pediuDoacao(p.socketId, sou);
        const $li = $('<li class="d-flex align-items-center flex-wrap gap-2 mb-1">');
        $('<span>').text(p.nome + (sou ? ' (você)' : '') + (local ? ` — ${local}` : '')
            + (pedeDoacao ? ' · pediu doação' : '')).appendTo($li);
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
        botaoDoar($li, p);
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
        const sou = socket && p.socketId === socket.id;
        const $li = $('<div class="hall-jogador">').toggleClass('eu', !!sou);
        $('<span class="hall-nome">').text(p.nome + (sou ? ' (você)' : '')).appendTo($li);
        $('<img alt="">').attr('src', av ? av.arquivo : '').appendTo($li);
        $ul.append($li);
    }
    renderRosters();
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
    const $linha = $('<div class="nota">');
    $('<b>').text(m.de + ' ').appendTo($linha);
    $('<small>').text(hora).appendTo($linha);
    $('<div>').text(m.texto).appendTo($linha);
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

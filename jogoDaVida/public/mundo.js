// Cliente do MUNDO (porta tipo 'mundo'). Só desenha e manda intenção:
// direção das teclas, "minerar este bloco", "usar aqui", "doar metade".
// Posição, colisão, pontos, fome e atos são decididos no servidor
// (server/mundo.js). Nada aqui é regra.

const Mundo = (() => {
    const T = { GRAMA: 0, ARVORE: 1, PEDRA: 2, MINERIO: 3, ARBUSTO: 4, AGUA: 5, BURACO: 6, TERRA: 7, BAU: 8, TABUA: 9, MURO: 10, PORTA: 11 };
    const TAM = 32;                        // lado das texturas
    // Vista 3/4 ("2.5D"): o chão é achatado (TY < TX) e os blocos sólidos
    // ganham altura (AL) — topo + face da frente — com ordenação por fileira.
    const TX = 32, TY = 24, AL = 14;
    const ALTURA_PICK = { [T.PORTA]: 42, [T.ARVORE]: 18, [T.PEDRA]: AL, [T.MINERIO]: AL, [T.MURO]: AL, [T.BAU]: AL, [T.ARBUSTO]: 8 };
    const CUBOS = new Set([T.PEDRA, T.MINERIO, T.MURO]);
    const ITENS = ['pedra', 'madeira', 'comida', 'minerio'];
    const NOME_ITEM = { pedra: 'Pedra', madeira: 'Madeira', comida: 'Comida', minerio: 'Minério' };
    const COR_PARTICULA = { [T.ARVORE]: '#3f7d2c', [T.PEDRA]: '#8b8f98', [T.MINERIO]: '#f5c542', [T.ARBUSTO]: '#c0392b', [T.TABUA]: '#b0793f', [T.MURO]: '#8b8f98' };

    let sock = null, ligado = false, ativo = false;
    let cv, ctx, texturas = null;
    let mapa = null;                       // { larg, alt, g: Uint8Array, bau }
    let eu = null;                         // pacote privado (inventário, pontos, fim)
    let jogadores = new Map();             // id -> { alvo:{x,y}, vis:{x,y}, ... }
    let bau = { total: 0, meta: 0 };
    let pedidos = [];
    let particulas = [];
    let mobs = new Map();                  // id -> { t, alvo:{x,y}, vis:{x,y}, v, vm, f, a, fase }
    let flechas = [];
    let golpeEm = 0, vidaAnt = null, piscarAte = 0;
    let dirAtual = { dx: 0, dy: 0 };
    const teclas = new Set();
    let mouse = null, segurando = false, minerandoEm = null;
    let itemSel = 'pedra', qtdSel = 'um';
    let deltaRelogio = 0;                  // servidor - cliente (ms)
    let duracao = 240000;
    let raf = null;
    let saiuParaHall = false;              // saiu pela porta: sem a tela "Não deu", o servidor leva ao hall

    // ── texturas procedurais (pixel-art 8×8 ampliada) ─────────────────
    function rngDe(s) { let a = s | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function pixel(cores, semente, desenhoExtra) {
        const c = document.createElement('canvas'); c.width = c.height = TAM;
        const g = c.getContext('2d'); const r = rngDe(semente); const p = TAM / 8;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = cores[Math.floor(r() * cores.length)]; g.fillRect(x * p, y * p, p, p); }
        if (desenhoExtra) desenhoExtra(g, p, r);
        return c;
    }
    function criarTexturas() {
        const grama = ['#5fa543', '#58a03d', '#67ad4b', '#4f9436', '#6cb350'];
        const t = {};
        t[T.GRAMA] = [0, 1, 2].map(i => pixel(grama, 11 + i));
        t[T.TERRA] = [pixel(['#8a5a34', '#7d5130', '#946340', '#6f4628'], 21)];
        t[T.PEDRA] = [pixel(['#8b8f98', '#7c808a', '#9a9ea7', '#6e727b'], 31)];
        t[T.MINERIO] = [pixel(['#8b8f98', '#7c808a', '#9a9ea7'], 41, (g, p, r) => {
            for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#f5c542' : '#ffe38a'; g.fillRect(Math.floor(r() * 7) * p, Math.floor(r() * 7) * p, p, p); }
        })];
        t[T.ARVORE] = [pixel(grama, 51, (g, p) => {
            g.fillStyle = '#6b4423'; g.fillRect(3 * p, 5 * p, 2 * p, 3 * p);
            const folhas = ['#2f6b22', '#3f7d2c', '#285c1c', '#35752a'];
            for (let y = 0; y < 5; y++) for (let x = 1; x < 7; x++) if (!((y === 0 || y === 4) && (x === 1 || x === 6))) { g.fillStyle = folhas[(x * 7 + y * 3) % 4]; g.fillRect(x * p, y * p, p, p); }
        })];
        t[T.ARBUSTO] = [pixel(grama, 61, (g, p) => {
            const f = ['#2f7d32', '#388e3c', '#2e6b2f'];
            for (let y = 2; y < 7; y++) for (let x = 1; x < 7; x++) { g.fillStyle = f[(x + y) % 3]; g.fillRect(x * p, y * p, p, p); }
            g.fillStyle = '#e53935'; [[2, 3], [5, 3], [3, 5], [5, 5], [2, 5]].forEach(([x, y]) => g.fillRect(x * p, y * p, p, p));
        })];
        t[T.AGUA] = [0, 1].map(i => pixel(['#2f6fd0', '#3a7bdc', '#2a63bd', '#4486e0'], 71 + i, (g, p, r) => {
            g.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 3; k++) g.fillRect(Math.floor(r() * 6) * p, Math.floor(r() * 8) * p, 2 * p, p / 2);
        }));
        t[T.BURACO] = [pixel(['#8a5a34', '#7d5130'], 81, (g, p) => {
            g.fillStyle = '#2b1a0e'; g.fillRect(p, p, 6 * p, 6 * p);
            g.fillStyle = '#120a05'; g.fillRect(2 * p, 2 * p, 4 * p, 4 * p);
        })];
        t[T.BAU] = [pixel(grama, 91, (g, p) => {
            g.fillStyle = '#7a4a1f'; g.fillRect(p, 2 * p, 6 * p, 5 * p);
            g.fillStyle = '#9c6230'; g.fillRect(p, 2 * p, 6 * p, 2 * p);
            g.fillStyle = '#3d240e'; g.fillRect(p, 4 * p, 6 * p, p / 2);
            g.fillStyle = '#f5c542'; g.fillRect(3.5 * p, 3.5 * p, p, 1.5 * p);
        })];
        t[T.TABUA] = [pixel(['#b0793f', '#a36f38', '#bb8447'], 101, (g, p) => {
            g.fillStyle = '#6b4423'; for (let y = 2; y < 8; y += 3) g.fillRect(0, y * p, TAM, p / 2);
        })];
        t[T.MURO] = [pixel(['#7f838c', '#8b8f98', '#747881'], 111, (g, p) => {
            g.fillStyle = '#4b4e55';
            for (let y = 0; y < 8; y += 2) { g.fillRect(0, y * p, TAM, p / 3); for (let x = (y / 2) % 2 ? 0 : 2; x < 8; x += 4) g.fillRect(x * p, y * p, p / 3, 2 * p); }
        })];
        // sprites em pé (árvore, arbusto, baú): desenhados sobre a grama, ancorados na base
        const sprite = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), rngDe(w * 31 + h)); return c; };
        const celulas = (g, r, x, y, w, h, cores, c = 3) => { for (let j = 0; j < h; j += c) for (let i = 0; i < w; i += c) { g.fillStyle = cores[Math.floor(r() * cores.length)]; g.fillRect(x + i, y + j, c, c); } };
        t.arvore = sprite(32, 46, (g, r) => {
            g.fillStyle = '#6b4423'; g.fillRect(12, 26, 8, 20);
            g.fillStyle = '#4e3018'; g.fillRect(17, 26, 3, 20);
            celulas(g, r, 3, 12, 26, 16, ['#2a5f1e', '#2f6b22', '#285c1c']);
            g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(3, 12, 26, 16);
            celulas(g, r, 3, 12, 26, 16, ['#2f6b22', '#35752a', '#3f7d2c']);
            g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(3, 21, 26, 7);
            celulas(g, r, 3, 2, 26, 11, ['#4a9a38', '#52a63f', '#5db048']);
            g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(25, 12, 4, 16);
        });
        t.arbusto = sprite(32, 22, (g, r) => {
            celulas(g, r, 4, 8, 24, 13, ['#2f7d32', '#388e3c', '#2e6b2f'], 3);
            g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(4, 15, 24, 6);
            celulas(g, r, 4, 3, 24, 6, ['#4caf50', '#43a047', '#56b85a'], 3);
            g.fillStyle = '#e53935'; [[8, 12], [18, 10], [23, 15], [12, 17], [6, 16]].forEach(([x, y]) => g.fillRect(x, y, 3, 3));
        });
        t.bau = sprite(32, 30, (g) => {
            g.fillStyle = '#6a3f19'; g.fillRect(3, 14, 26, 14);
            g.fillStyle = '#7a4a1f'; g.fillRect(3, 14, 26, 8);
            g.fillStyle = '#9c6230'; g.fillRect(3, 6, 26, 9);
            g.fillStyle = '#b87a40'; g.fillRect(3, 6, 26, 3);
            g.fillStyle = '#3d240e'; g.fillRect(3, 14, 26, 2); g.fillRect(3, 27, 26, 1);
            g.fillStyle = '#f5c542'; g.fillRect(14, 13, 4, 6);
            g.fillStyle = '#c99a1e'; g.fillRect(14, 17, 4, 2);
        });
        t.porta = sprite(32, 44, (g) => {
            g.fillStyle = '#3d240e'; g.fillRect(2, 2, 28, 42);          // batente
            g.fillStyle = '#7a4a1f'; g.fillRect(5, 5, 22, 39);          // folha
            g.fillStyle = '#9c6230'; g.fillRect(5, 5, 10, 39);
            g.fillStyle = '#5a3414'; g.fillRect(15, 5, 2, 39); g.fillRect(5, 22, 22, 2);
            g.fillStyle = '#f5c542'; g.fillRect(22, 26, 3, 3);          // maçaneta
            g.fillStyle = '#16a34a'; g.fillRect(8, 8, 16, 9);           // placa verde
            g.fillStyle = '#fff'; g.fillRect(10, 10, 8, 5); g.fillRect(16, 12, 4, 1); g.fillRect(14, 10, 4, 1); g.fillRect(14, 14, 4, 1);
        });
        return t;
    }

    // ── conexão ───────────────────────────────────────────────────────
    function ligar(s) {
        if (ligado) return;
        ligado = true; sock = s;
        s.on('mundo_mapa', ({ mapa: m, eu: e }) => {
            const bin = atob(m.blocos); const g = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) g[i] = bin.charCodeAt(i);
            mapa = { larg: m.larg, alt: m.alt, g, bau: m.bau };
            jogadores.clear(); particulas = []; pedidos = []; mobs.clear(); flechas = []; vidaAnt = null;
            aplicarEu(e);
            duracao = e.fim - e.agora;
            $('#mundo-overlay').addClass('d-none').empty();
            renderPainel();
        });
        s.on('mundo_eu', aplicarEu);
        s.on('mundo_estado', st => {
            if (!mapa) return;
            deltaRelogio = st.agora - Date.now();
            for (const [x, y, v] of st.blocos) {
                const antes = mapa.g[y * mapa.larg + x];
                mapa.g[y * mapa.larg + x] = v;
                if (COR_PARTICULA[antes] && v !== antes) estourar(x, y, COR_PARTICULA[antes]);
            }
            const vistos = new Set();
            for (const j of st.jogadores) {
                vistos.add(j.id);
                const atual = jogadores.get(j.id);
                if (atual) Object.assign(atual, j, { alvo: { x: j.x, y: j.y } });
                else jogadores.set(j.id, { ...j, alvo: { x: j.x, y: j.y }, vis: { x: j.x, y: j.y } });
            }
            for (const id of [...jogadores.keys()]) if (!vistos.has(id)) jogadores.delete(id);

            const mvistos = new Set();
            for (const o of st.mobs || []) {
                mvistos.add(o.id);
                const a = mobs.get(o.id);
                if (a) {
                    if (o.v < a.v) { sangrar(o.x, o.y, '#c0392b'); somGolpe(); }
                    Object.assign(a, o, { alvo: { x: o.x, y: o.y } });
                } else mobs.set(o.id, { ...o, alvo: { x: o.x, y: o.y }, vis: { x: o.x, y: o.y }, fase: 0 });
            }
            for (const [id, a] of [...mobs]) if (!mvistos.has(id)) { sangrar(a.alvo.x, a.alvo.y, '#d4d4d4', 14); mobs.delete(id); }
            flechas = st.flechas || [];
            const meu = st.jogadores.find(j => j.id === eu?.jogadorId);
            if (meu) {
                if (vidaAnt != null && meu.vida < vidaAnt) { piscarAte = performance.now() + 350; somGolpe(); }
                vidaAnt = meu.vida;
            }
            bau = st.bau;
            pedidos = st.pedidos;
            if (avisoFixo && !meuJogador()?.desmaiado) { avisoFixo = false; $('#mundo-aviso').attr('class', 'd-none'); }
            renderPainelDinamico();
        });
        s.on('mundo_porta', () => {
            if (!ativo) return;
            if (confirmarSaida()) sair(true);
        });
        s.on('mundo_aviso', ({ texto, tipo, fixo }) => aviso(texto, tipo, fixo));
        s.on('mundo_bau_som', ({ item, id }) => { if (ativo) somDeposito(item, id === eu?.jogadorId ? 1 : 0.3); });
        s.on('mundo_socorro', ({ nome, de }) => {
            if (eu && de === eu.jogadorId) return;
            aviso(`${nome} pediu socorro!`, 'warning');
            if (typeof somPedido === 'function') somPedido();
        });
        s.on('mundo_socorro_resposta', ({ nome, aceitou }) => feedMundo(`${nome} ${aceitou ? 'aceitou' : 'recusou'} um pedido de socorro`));
        s.on('mundo_fim', ({ pontos, equipeCompleta }) => {
            ativo = false;
            pararLoop();
            const passou = equipeCompleta || pontos >= (eu?.metaPessoal ?? Infinity);
            if (saiuParaHall && !passou) { saiuParaHall = false; $('#mundo-overlay').removeClass('d-none').html(`<div class="text-center">${estado.modo === 'livre' ? 'Voltando à lista de jogos…' : 'Voltando ao hall…'}</div>`); return; }
            saiuParaHall = false;
            $('#mundo-overlay').removeClass('d-none').html(passou
                ? `<div class="text-center"><div class="h4 mb-1">Fim do mundo</div><div>Você saiu com <b>${pontos}</b> pontos${equipeCompleta ? ' e o baú da equipe cheio' : ''}.</div><div class="small text-secondary mt-1">${estado.modo === 'livre' ? 'Voltando à lista de jogos…' : 'Seguindo para a próxima porta…'}</div></div>`
                : `<div class="text-center"><div class="h4 mb-1">Não deu</div><div>Você saiu com <b>${pontos}</b> de ${eu?.metaPessoal} pontos e o baú não encheu.</div>
                   <button class="btn btn-primary mt-2" id="mundo-tentar">Entrar de novo</button></div>`);
            $('#mundo-tentar').on('click', () => { $('#mundo-overlay').addClass('d-none'); iniciar(sock); });
        });
    }

    function aplicarEu(e) {
        const antes = eu?.pontos;
        eu = e;
        deltaRelogio = e.agora - Date.now();
        if (antes != null && e.pontos > antes) somColeta();
        renderPainel();
    }

    // ── ciclo ─────────────────────────────────────────────────────────
    function iniciar(s) {
        ligar(s);
        if (!texturas) texturas = criarTexturas();
        cv = document.getElementById('mundo-canvas');
        ctx = cv.getContext('2d');
        ajustarCanvas();
        mapa = null; eu = null;
        teclas.clear(); dirAtual = { dx: 0, dy: 0 };
        // Na 1ª vez neste navegador, as instruções vêm ANTES de entrar: o
        // tempo pessoal só começa (no servidor) quando o jogador clica Começar.
        let viu = false;
        try { viu = localStorage.getItem('mundo_ajuda_vista') === '1'; } catch (e) { /* sem storage */ }
        if (viu) entrarDeFato(); else mostrarAjuda(true);
    }

    function entrarDeFato() {
        ativo = true;
        $('#mundo-overlay').removeClass('d-none').html('<div class="text-center">Entrando no mundo…</div>');
        sock.emit('mundo_entrar');
        if (!raf) raf = requestAnimationFrame(quadro);
    }

    const AJUDA = `
<div class="mundo-ajuda">
  <h2 class="h5 mb-2">⛏ Bem-vindo ao Mundo</h2>
  <p class="small mb-2">Todos da sala estão neste mesmo mapa, ao mesmo tempo. <b>Nada renasce</b>: o que um pega, o outro não acha mais.</p>
  <div class="row g-3 small">
    <div class="col-sm-6">
      <div class="fw-bold mb-1">Coletar</div>
      <ul class="ps-3 mb-2">
        <li><b>Clique no chão</b> para andar até lá — ou use <b>WASD / setas</b> (você tem contorno branco e nome amarelo).</li>
        <li><b>Segure o clique</b> num bloco até a barra encher. Se estiver longe, o boneco vai até ele e começa sozinho.</li>
        <li><span class="mundo-ico mundo-ico-minerio"></span> pedra com dourado = <b>minério, 5 pts</b> (o melhor)</li>
        <li><span class="mundo-ico mundo-ico-comida"></span> arbusto = comida, 2 pts · <span class="mundo-ico mundo-ico-madeira"></span> árvore = madeira, 1 · <span class="mundo-ico mundo-ico-pedra"></span> pedra, 1</li>
        <li>Se dois cavam o mesmo bloco, <b>quem dá o último golpe leva</b>.</li>
      </ul>
      <div class="fw-bold mb-1">Adversários</div>
      <ul class="ps-3 mb-2">
        <li><b>Zumbis</b> (lentos), <b>esqueletos</b> (atiram flechas) e <b>soldados medievais</b> (fortes) rondam o mapa. Seus corações ficam no canto da tela.</li>
        <li><b>Clique no bicho</b> (segure) ou aperte <b>Espaço</b> para bater. Cada um derrubado deixa um item: comida, madeira ou minério.</li>
        <li>Se zerar a vida, você acorda junto ao baú e perde ¼ do que carregava. Em grupo é bem mais fácil.</li>
      </ul>
      <div class="fw-bold mb-1">Sobreviver</div>
      <ul class="ps-3 mb-0">
        <li><b>Fome</b> cai com o tempo. <b>E</b> come (gasta a comida e os pontos dela). Zerou, você <b>desmaia</b>: segure <b>E</b> por 5s para comer a sua comida e levantar — sem comida, só alguém te alimentando.</li>
        <li><b>Buracos</b> prendem. Segure o clique em você mesmo pra escalar (demora) — ou peça socorro.</li>
      </ul>
    </div>
    <div class="col-sm-6">
      <div class="fw-bold mb-1">Os outros</div>
      <ul class="ps-3 mb-2">
        <li><b>Baú</b> no centro: escolha o item (1–4) e <b>segure o clique no baú</b> — deposita um por vez enquanto segurar. Tira pontos seus e soma no coletivo. <b>Baú na meta = todos passam.</b> Sacar é pelo botão do painel.</li>
        <li><b>Doar</b> (painel): escolha item e quantidade — 1, metade ou tudo.</li>
        <li><b>Botão direito</b> num vizinho: com pedra/madeira tira do buraco; com comida levanta quem desmaiou. Em casa vazia, coloca bloco.</li>
        <li><b>Pedir socorro</b> avisa todos; cada um responde “Vou ajudar” ou “Não posso”.</li>
      </ul>
      <div class="fw-bold mb-1">Como passa</div>
      <p class="mb-0">Você tem <b>tempo próprio</b> aqui dentro. Ao acabar (ou em “Sair do mundo”), passa quem bateu a <b>meta pessoal</b> — ou todos, se o <b>baú</b> estiver cheio.</p>
    </div>
  </div>
  <p class="small text-secondary mt-2 mb-2">Teclas 1–4 escolhem o item. O chat fica aberto. O que você faz com os outros fica registrado.</p>
  <button type="button" class="btn btn-primary" id="mundo-ajuda-ok"></button>
</div>`;

    function mostrarAjuda(inicial) {
        $('#mundo-overlay').removeClass('d-none').html(AJUDA);
        $('#mundo-ajuda-ok').text(inicial ? 'Começar (o tempo começa agora)' : 'Voltar ao jogo').trigger('focus')
            .on('click', () => {
                try { localStorage.setItem('mundo_ajuda_vista', '1'); } catch (e) { /* sem storage */ }
                $('#mundo-overlay').addClass('d-none').empty();
                if (inicial) entrarDeFato();
            });
    }
    function parar() {
        if (ativo && sock) sock.emit('mundo_input', { dx: 0, dy: 0 });
        ativo = false;
        pararLoop();
    }
    function pararLoop() { if (raf) cancelAnimationFrame(raf); raf = null; }
    // Sem a meta pessoal e com o baú da equipe incompleto, sair não passa: avisa que o que está na mochila se perde.
    function confirmarSaida() {
        const faltaMeta = eu && eu.pontos < eu.metaPessoal;
        const baucheio = bau.total >= (bau.meta || eu?.metaEquipe || Infinity);
        if (faltaMeta && !baucheio) {
            return window.confirm(`Você ainda não atingiu a meta (${eu.pontos} de ${eu.metaPessoal} pontos) e o baú da equipe não está cheio.

Se sair agora, TUDO o que você coletou e não depositou no baú será perdido e você não passa desta porta.

Sair mesmo assim?`);
        }
        return window.confirm('Sair do mundo e entregar seus pontos?');
    }
    function sair(hall = false) { if (sock && ativo) { saiuParaHall = hall; sock.emit('mundo_sair', { hall }); } }

    function ajustarCanvas() {
        if (!cv) return;
        const palco = document.getElementById('mundo-palco');
        const cheio = document.fullscreenElement === document.getElementById('jogo-mundo');
        const w = palco.clientWidth || 640;
        const h = cheio ? Math.max(300, window.innerHeight - 190) : Math.round(Math.min(480, Math.max(300, w * 0.62)));
        const dpr = window.devicePixelRatio || 1;
        cv.style.width = w + 'px'; cv.style.height = h + 'px';
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
    }

    // ── desenho ───────────────────────────────────────────────────────
    function meuJogador() { return eu ? jogadores.get(eu.jogadorId) : null; }

    function camera() {
        const w = cv.clientWidth, h = cv.clientHeight;
        const me = meuJogador();
        const cx = me ? me.vis.x * TX + TX / 2 : (mapa ? mapa.bau.x * TX : 0);
        const cy = me ? me.vis.y * TY + TY / 2 : (mapa ? mapa.bau.y * TY : 0);
        const mw = mapa.larg * TX, mh = mapa.alt * TY;
        return {
            x: Math.round(Math.max(0, Math.min(mw - w, cx - w / 2))),
            y: Math.round(Math.max(0, Math.min(mh - h, cy - h / 2))), w, h,
        };
    }

    const bloco = (x, y) => (x < 0 || y < 0 || x >= mapa.larg || y >= mapa.alt) ? T.AGUA : mapa.g[y * mapa.larg + x];
    const ehAlto = b => b === T.PORTA || b === T.ARVORE || b === T.ARBUSTO || b === T.BAU || CUBOS.has(b);

    // Cubo: topo (achatado) + face da frente escurecida, com realce na quina.
    function cubo(tex, sx, sy) {
        ctx.drawImage(tex, 0, 0, TAM, TAM, sx, sy - AL, TX, TY);
        ctx.drawImage(tex, 0, 0, TAM, TAM, sx, sy + TY - AL, TX, AL);
        ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.fillRect(sx, sy + TY - AL, TX, AL);
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(sx, sy - AL, TX, 1);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(sx + TX - 2, sy + TY - AL, 2, AL);
    }

    function sombraChao(sx, sy, larg = TX - 6, alt = 7) {
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.beginPath(); ctx.ellipse(sx + TX / 2, sy + TY - 4, larg / 2, alt / 2, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Boneco de blocos (estilo Minecraft): cabeça, tronco, braços e pernas que
    // balançam ao andar. `p` = paleta/estilo; `o` = { x, y (pés), dir, fase, atq, afund }.
    function boneco(p, o) {
        const { x, y } = o, d = o.dir || 1, af = o.afund || 0;
        const fino = p.fino ? 1 : 0;
        const bal = Math.sin(o.fase) * (o.andando ? 4 : 0);
        const pw = 5 - fino, py = y - 11 + af;
        // pernas
        ctx.fillStyle = p.calca;
        ctx.fillRect(x - 5, py + bal * 0.6, pw, 11 - af); ctx.fillRect(x + 0 + fino, py - bal * 0.6, pw, 11 - af);
        ctx.fillStyle = p.bota || 'rgba(0,0,0,.35)';
        ctx.fillRect(x - 5, y - 3 + bal * 0.6, pw, 3); ctx.fillRect(x + fino, y - 3 - bal * 0.6, pw, 3);
        const ty = y - 23 + af;      // topo do tronco
        // braço de trás
        const braco = (bx, frente) => {
            ctx.fillStyle = p.manga || p.camisa;
            const ba = o.atq ? -5 : (frente ? bal : -bal) * 0.9;
            if (p.bracoFrente) ctx.fillRect(bx, ty + 2, 4 - fino, 9 - fino * 2);     // zumbi: braços para a frente
            else ctx.fillRect(bx, ty + 1 + ba * 0.3, 4 - fino, 11);
            ctx.fillStyle = p.pele;
            if (p.bracoFrente) ctx.fillRect(bx + (d > 0 ? 3 : -5), ty + 3, 8, 3);
            else ctx.fillRect(bx, ty + 10 + ba * 0.3, 4 - fino, 3);
        };
        braco(x - 9 + fino, false);
        // tronco
        ctx.fillStyle = p.camisa; ctx.fillRect(x - 6, ty, 12, 12);
        if (p.costelas) { ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 2; k < 11; k += 3) ctx.fillRect(x - 5, ty + k, 10, 1); }
        if (p.cinto) { ctx.fillStyle = p.cinto; ctx.fillRect(x - 6, ty + 9, 12, 2); }
        if (p.tunica) { ctx.fillStyle = p.tunica; ctx.fillRect(x - 3, ty, 6, 12); ctx.fillStyle = '#e8c96a'; ctx.fillRect(x - 1, ty + 2, 2, 5); }
        // braço da frente (com arma na mão)
        braco(x + 5 - fino, true);
        const mx = x + (d > 0 ? 8 : -8), my = ty + 8 + (o.atq ? -6 : 0);
        if (p.arma === 'espada') {
            ctx.fillStyle = '#d6dbe3'; ctx.fillRect(mx - 1 + (d > 0 ? 2 : -2), my - 14, 2, 16);
            ctx.fillStyle = '#7a4a1f'; ctx.fillRect(mx - 3 + (d > 0 ? 2 : -2), my + 1, 6, 2);
        } else if (p.arma === 'arco') {
            ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(mx + d * 2, my - 3, 8, d > 0 ? -1.3 : Math.PI - 1.3 + 0.0, d > 0 ? 1.3 : Math.PI + 1.3, d < 0 ? false : false); ctx.stroke();
            ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(mx + d * 2 + d * Math.cos(1.3) * 8, my - 3 - Math.sin(1.3) * 8); ctx.lineTo(mx + d * 2 + d * Math.cos(1.3) * 8, my - 3 + Math.sin(1.3) * 8); ctx.stroke();
        }
        if (p.escudo) {   // escudo no braço de trás
            const ex = x - d * 8 - 4;
            ctx.fillStyle = p.escudo; ctx.fillRect(ex, ty + 3, 8, 11);
            ctx.fillStyle = '#d9d9d9'; ctx.fillRect(ex, ty + 3, 8, 1); ctx.fillRect(ex, ty + 13, 8, 1); ctx.fillRect(ex, ty + 3, 1, 11); ctx.fillRect(ex + 7, ty + 3, 1, 11);
            ctx.fillStyle = '#f5c542'; ctx.fillRect(ex + 3, ty + 6, 2, 5);
        }
        // cabeça
        const hy = ty - 10;
        ctx.fillStyle = p.pele; ctx.fillRect(x - 5, hy, 10, 10);
        if (p.cabelo) { ctx.fillStyle = p.cabelo; ctx.fillRect(x - 5, hy, 10, 3); ctx.fillRect(x - 5, hy, 2, 6); ctx.fillRect(x + 3, hy, 2, 6); }
        if (p.elmo) {
            ctx.fillStyle = p.elmo; ctx.fillRect(x - 6, hy - 2, 12, 6); ctx.fillRect(x - 6, hy + 2, 2, 6); ctx.fillRect(x + 4, hy + 2, 2, 6);
            ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - 6, hy - 2, 12, 1);
            ctx.fillStyle = '#6c717a'; ctx.fillRect(x - 1, hy + 3, 2, 5);     // nasal
            ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 1, hy - 5, 2, 3);     // penacho
        }
        ctx.fillStyle = p.olho || '#111';
        if (o.apagado) { ctx.fillRect(x - 3, hy + 6, 2, 1); ctx.fillRect(x + 1, hy + 6, 2, 1); }
        else { ctx.fillRect(x - 3 + d, hy + 5, 2, 2); ctx.fillRect(x + 1 + d, hy + 5, 2, 2); }
        if (p.boca) { ctx.fillStyle = p.boca; ctx.fillRect(x - 2 + d, hy + 8, 4, 1); }
    }

    const PALETA = {
        zumbi: { pele: '#5d8c4a', camisa: '#2f7f89', calca: '#363b8c', bracoFrente: true, olho: '#1b1b1b', boca: '#2c4a22', cinto: null },
        esqueleto: { pele: '#e8e8e2', camisa: '#d9d9d1', calca: '#cfcfc7', costelas: true, fino: true, olho: '#222', arma: 'arco', bota: '#bdbdb4' },
        soldado: { pele: '#e0b890', camisa: '#7d838c', manga: '#7d838c', calca: '#4a3a2a', tunica: '#a32d2d', cinto: '#3d2a14', elmo: '#9aa0a8', arma: 'espada', escudo: '#2b4a9a', bota: '#2a1d10' },
    };
    const NOME_MOB = { zumbi: 'Zumbi', esqueleto: 'Esqueleto', soldado: 'Soldado' };

    function paletaJogador(id) {
        return { pele: '#f1c9a0', cabelo: '#4a2f1b', camisa: corDe(id), calca: '#3b4a8c', bota: '#2a2a33' };
    }

    function barraVida(sx, sy, v, vm, larg = 22) {
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(sx - larg / 2 - 1, sy - 1, larg + 2, 5);
        ctx.fillStyle = v / vm > 0.5 ? '#22c55e' : v / vm > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(sx - larg / 2, sy, larg * Math.max(0, v) / vm, 3);
    }

    function quadro(ts) {
        raf = requestAnimationFrame(quadro);
        if (!ativo || !mapa || !ctx) return;
        const w = cv.clientWidth, h = cv.clientHeight;
        ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, w, h);

        for (const j of jogadores.values()) {   // interpolação suave até a posição do servidor
            const ax = j.vis.x, ay = j.vis.y;
            j.vis.x += (j.alvo.x - j.vis.x) * 0.35; j.vis.y += (j.alvo.y - j.vis.y) * 0.35;
            if (Math.abs(j.alvo.x - j.vis.x) < 0.01) j.vis.x = j.alvo.x;
            if (Math.abs(j.alvo.y - j.vis.y) < 0.01) j.vis.y = j.alvo.y;
            const dx = j.vis.x - ax;
            j.andando = Math.abs(dx) + Math.abs(j.vis.y - ay) > 0.004;
            if (Math.abs(dx) > 0.003) j.dir = Math.sign(dx);
            if (j.andando || j.min) j.fase = (j.fase || 0) + (j.min ? 0.55 : 0.5);
        }
        for (const o of mobs.values()) {
            const ax = o.vis.x, ay = o.vis.y;
            o.vis.x += (o.alvo.x - o.vis.x) * 0.2; o.vis.y += (o.alvo.y - o.vis.y) * 0.2;
            if (Math.abs(o.alvo.x - o.vis.x) < 0.01) o.vis.x = o.alvo.x;
            if (Math.abs(o.alvo.y - o.vis.y) < 0.01) o.vis.y = o.alvo.y;
            o.andando = Math.abs(o.vis.x - ax) + Math.abs(o.vis.y - ay) > 0.004;
            if (o.andando) o.fase += 0.4;
        }

        const cam = camera();
        const x0 = Math.max(0, Math.floor(cam.x / TX) - 1), y0 = Math.max(0, Math.floor(cam.y / TY) - 1);
        const x1 = Math.min(mapa.larg - 1, x0 + Math.ceil(w / TX) + 3), y1 = Math.min(mapa.alt - 1, y0 + Math.ceil(h / TY) + 4);
        const quadroAgua = Math.floor(ts / 600) % 2;

        // 1) chão (tudo que é plano, e grama sob árvores/arbustos/baú)
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const b = mapa.g[y * mapa.larg + x];
            const sx = x * TX - cam.x, sy = y * TY - cam.y;
            if (b === T.AGUA) {
                ctx.drawImage(texturas[T.AGUA][quadroAgua], 0, 0, TAM, TAM, sx, sy + 2, TX, TY);
                ctx.fillStyle = 'rgba(0,0,40,.18)'; ctx.fillRect(sx, sy + 2, TX, 3);
                continue;
            }
            const plano = (ehAlto(b) && !CUBOS.has(b)) || b === T.GRAMA ? T.GRAMA : (CUBOS.has(b) ? T.TERRA : b);
            const vs = texturas[plano];
            ctx.drawImage(vs[(x * 7 + y * 13) % vs.length], 0, 0, TAM, TAM, sx, sy, TX, TY);
            if (b === T.BURACO) {
                ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(sx + 3, sy + 3, TX - 6, TY - 5);
                ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(sx + 3, sy + 3, TX - 6, 5);
            }
            // sombra projetada pelo vizinho alto da esquerda
            if (x > 0 && ehAlto(bloco(x - 1, y)) && b !== T.AGUA) { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(sx, sy, 9, TY); }
        }

        // 2) em pé, ordenados por fileira (quem está mais ao sul cobre quem está ao norte)
        const fila = [];
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const b = mapa.g[y * mapa.larg + x];
            if (!ehAlto(b)) continue;
            fila.push({ k: y, fn: () => {
                const sx = x * TX - cam.x, sy = y * TY - cam.y;
                if (b === T.ARVORE) { sombraChao(sx, sy, 26, 8); ctx.drawImage(texturas.arvore, sx, sy + TY - 44); }
                else if (b === T.ARBUSTO) { sombraChao(sx, sy, 24, 6); ctx.drawImage(texturas.arbusto, sx, sy + TY - 20); }
                else if (b === T.PORTA) {
                    sombraChao(sx, sy, 30, 8); ctx.drawImage(texturas.porta, sx, sy + TY - 42);
                    ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
                    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
                    ctx.strokeText('SAÍDA', sx + TX / 2, sy + TY - 46); ctx.fillText('SAÍDA', sx + TX / 2, sy + TY - 46); ctx.textAlign = 'start';
                }
                else if (b === T.BAU) { sombraChao(sx, sy, 28, 8); ctx.drawImage(texturas.bau, sx, sy + TY - 28); }
                else { sombraChao(sx, sy, TX, 8); cubo(texturas[b][0], sx, sy); }
            } });
        }

        for (const j of jogadores.values()) {
            const souEu = j.id === eu?.jogadorId;
            fila.push({ k: j.vis.y + 0.02, fn: () => {
                const sx = j.vis.x * TX - cam.x + TX / 2, sy = j.vis.y * TY - cam.y + TY - 3;
                sombraChao(sx - TX / 2, sy - TY + 3, 16, 5);
                if (souEu) { ctx.strokeStyle = 'rgba(250,204,21,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 11, 4, 0, 0, Math.PI * 2); ctx.stroke(); }
                ctx.globalAlpha = j.ausente ? 0.4 : 1;
                boneco(paletaJogador(j.id), { x: sx, y: sy, dir: j.dir || 1, fase: j.fase || 0, andando: j.andando, atq: !!j.min && Math.sin((j.fase || 0)) > 0.3, afund: j.preso ? 9 : 0, apagado: j.desmaiado });
                ctx.globalAlpha = 1;
                rotuloJogador(j, sx, sy, souEu, ts);
            } });
        }
        for (const o of mobs.values()) {
            fila.push({ k: o.vis.y + 0.02, fn: () => {
                const sx = o.vis.x * TX - cam.x + TX / 2, sy = o.vis.y * TY - cam.y + TY - 3;
                sombraChao(sx - TX / 2, sy - TY + 3, 16, 5);
                boneco(PALETA[o.t], { x: sx, y: sy, dir: o.f || 1, fase: o.fase, andando: o.andando, atq: !!o.a });
                if (o.v < o.vm) barraVida(sx, sy - 41, o.v, o.vm);
                ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(255,200,200,.9)'; ctx.fillText(NOME_MOB[o.t], sx, sy - (o.v < o.vm ? 45 : 38)); ctx.textAlign = 'start';
            } });
        }
        fila.sort((a, b) => a.k - b.k);
        for (const e of fila) e.fn();

        // mineração em andamento: rachaduras + barra (sobre o bloco)
        for (const j of jogadores.values()) {
            if (!j.min) continue;
            const alto = ehAlto(bloco(j.min.x, j.min.y)) ? AL : 0;
            const px = j.min.x * TX - cam.x, py = j.min.y * TY - cam.y - alto;
            ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2;
            const n = Math.ceil(j.min.p * 5);
            for (let k = 0; k < n; k++) { ctx.beginPath(); ctx.moveTo(px + 6 + k * 5, py + 4 + (k % 2) * 8); ctx.lineTo(px + 14 + k * 3, py + 16 + (k % 3) * 4); ctx.stroke(); }
            ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(px + 2, py + TY + alto - 6, TX - 4, 4);
            ctx.fillStyle = j.id === eu?.jogadorId ? '#facc15' : '#f97316'; ctx.fillRect(px + 2, py + TY + alto - 6, (TX - 4) * j.min.p, 4);
        }

        // flechas
        for (const f of flechas) {
            const fx = f.x * TX - cam.x + TX / 2, fy = f.y * TY - cam.y + TY / 2 - 12, ang = Math.atan2(f.vy * TY, f.vx * TX);
            ctx.save(); ctx.translate(fx, fy); ctx.rotate(ang);
            ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-7, -1, 12, 2);
            ctx.fillStyle = '#e5e5e5'; ctx.fillRect(5, -2, 3, 4);
            ctx.fillStyle = '#ddd'; ctx.fillRect(-8, -2, 2, 4);
            ctx.restore();
        }

        // mira do mouse (no chão sob o bloco apontado)
        const me = meuJogador();
        if (mouse && me) {
            const al = mobSobMouse() ? null : alvoMouse();
            if (al) {
                const perto = Math.max(Math.abs(al.x - me.alvo.x), Math.abs(al.y - me.alvo.y)) <= 1;
                const alto = ehAlto(bloco(al.x, al.y)) ? ALTURA_PICK[bloco(al.x, al.y)] || AL : 0;
                ctx.strokeStyle = perto ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
                ctx.strokeRect(al.x * TX - cam.x + 1, al.y * TY - cam.y + 1 - Math.min(alto, AL), TX - 2, TY - 2 + Math.min(alto, AL));
            }
        }
        if (me?.dest) {   // para onde estou indo (clique)
            const dx = me.dest[0] * TX - cam.x, dy = me.dest[1] * TY - cam.y;
            ctx.strokeStyle = 'rgba(250,204,21,.9)'; ctx.lineWidth = 2;
            const r = 6 + (Math.sin(ts / 150) + 1) * 2;
            ctx.beginPath(); ctx.ellipse(dx + TX / 2, dy + TY / 2, r, r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
        }

        // partículas
        particulas = particulas.filter(p => (p.vida -= 16) > 0);
        for (const p of particulas) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.15;
            ctx.fillStyle = p.cor; ctx.globalAlpha = Math.max(0, p.vida / 600);
            ctx.fillRect(p.x - cam.x, p.y - cam.y, 4, 4);
        }
        ctx.globalAlpha = 1;

        // profundidade: névoa no horizonte (topo da tela) e canto escuro
        const gv = ctx.createLinearGradient(0, 0, 0, h);
        gv.addColorStop(0, 'rgba(120,150,210,.16)'); gv.addColorStop(0.35, 'rgba(120,150,210,0)'); gv.addColorStop(1, 'rgba(0,0,0,.12)');
        ctx.fillStyle = gv; ctx.fillRect(0, 0, w, h);

        // entardecer: escurece com o tempo, com luz em volta de mim
        if (eu && me) {
            const restante = Math.max(0, eu.fim - (Date.now() + deltaRelogio));
            const escuro = Math.min(0.55, (1 - restante / duracao) * 0.6);
            if (escuro > 0.02) {
                const lx = me.vis.x * TX + TX / 2 - cam.x, ly = me.vis.y * TY + TY / 2 - cam.y;
                const gr = ctx.createRadialGradient(lx, ly, TX * 1.5, lx, ly, TX * 6);
                gr.addColorStop(0, 'rgba(8,10,30,0)'); gr.addColorStop(1, `rgba(8,10,30,${escuro})`);
                ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
            }
        }
        if (ts < piscarAte) { ctx.fillStyle = `rgba(220,20,20,${0.35 * (piscarAte - ts) / 350})`; ctx.fillRect(0, 0, w, h); }
        desenharVida(me);
        if (me?.desmaiado) {
            const txt = eu?.inv.comida > 0 ? 'Desmaiado de fome — SEGURE E por 5s para comer e levantar' : 'Desmaiado de fome — sem comida. Peça socorro.';
            ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center';
            const tw = ctx.measureText(txt).width + 24;
            ctx.fillStyle = 'rgba(127,29,29,.85)'; ctx.fillRect(w / 2 - tw / 2, h - 48, tw, 30);
            ctx.fillStyle = '#fff'; ctx.fillText(txt, w / 2, h - 28); ctx.textAlign = 'start';
        } else if (eu && eu.fome <= 25) {
            ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
            ctx.fillStyle = Math.floor(ts / 500) % 2 ? '#f59e0b' : '#fde68a';
            ctx.fillText(`Fome ${eu.fome} — aperte E para comer`, w / 2, h - 16); ctx.textAlign = 'start';
        }
        desenharMinimapa(w, h);
        atualizarRelogio();
    }

    function corDe(id) { const h = (Number(id) * 137) % 360; return `hsl(${h} 70% 55%)`; }

    function rotuloJogador(j, sx, sy, souEu, ts) {
        ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
        const topo = sy - 36 + (j.preso ? 9 : 0);
        const rotulo = j.nome + (j.ausente ? ' (ausente)' : '');
        const lw = ctx.measureText(rotulo).width + 8;
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(sx - lw / 2, topo - 12, lw, 13);
        ctx.fillStyle = souEu ? '#facc15' : '#fff'; ctx.fillText(rotulo, sx, topo - 2);
        if (!souEu && j.vida != null && j.vida < (j.vm || 10)) barraVida(sx, topo - 18, j.vida, j.vm || 10);
        if (j.preso || j.desmaiado) {
            ctx.font = 'bold 13px system-ui'; ctx.fillStyle = Math.floor(ts / 400) % 2 ? '#ef4444' : '#fff';
            ctx.fillText(j.preso ? 'SOCORRO!' : 'desmaiado', sx, topo - 18);
        }
        if (j.rean > 0) {   // comendo para levantar
            ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(sx - 16, sy + 4, 32, 5);
            ctx.fillStyle = '#22c55e'; ctx.fillRect(sx - 16, sy + 4, 32 * j.rean, 5);
        }
        ctx.textAlign = 'start';
    }

    function desenharVida(me) {
        const v = me?.vida ?? eu?.vida; if (v == null) return;
        const vm = eu?.vidaMax || 10;
        const hm = [[0, 1, 1, 0, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1], [0, 1, 1, 1, 1, 1, 0], [0, 0, 1, 1, 1, 0, 0], [0, 0, 0, 1, 0, 0, 0]];
        for (let i = 0; i < vm; i++) {
            const ox = 8 + i * 17, oy = 8, cheio = i < v;
            ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(ox - 1, oy - 1, 16, 14);
            hm.forEach((lin, yy) => lin.forEach((c, xx) => { if (c) { ctx.fillStyle = cheio ? (yy < 2 && xx < 3 ? '#ff7b7b' : '#e02b2b') : '#4a2a2a'; ctx.fillRect(ox + xx * 2, oy + yy * 2, 2, 2); } }));
        }
    }

    function desenharMinimapa(w, h) {
        const e = 2, mw = mapa.larg * e, mh = mapa.alt * e, ox = w - mw - 8, oy = 8;
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(ox - 2, oy - 2, mw + 4, mh + 4);
        const cores = { [T.GRAMA]: '#4f9436', [T.ARVORE]: '#285c1c', [T.PEDRA]: '#7c808a', [T.MINERIO]: '#f5c542', [T.ARBUSTO]: '#c0392b', [T.AGUA]: '#2f6fd0', [T.BURACO]: '#120a05', [T.TERRA]: '#7d5130', [T.BAU]: '#fff', [T.TABUA]: '#b0793f', [T.MURO]: '#5b5e66', [T.PORTA]: '#a0622d' };
        for (let y = 0; y < mapa.alt; y++) for (let x = 0; x < mapa.larg; x++) {
            ctx.fillStyle = cores[mapa.g[y * mapa.larg + x]]; ctx.fillRect(ox + x * e, oy + y * e, e, e);
        }
        for (const o of mobs.values()) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(ox + o.alvo.x * e - 1, oy + o.alvo.y * e - 1, 3, 3); }
        for (const j of jogadores.values()) {
            ctx.fillStyle = j.id === eu?.jogadorId ? '#facc15' : (j.preso || j.desmaiado ? '#ef4444' : '#fff');
            ctx.fillRect(ox + j.alvo.x * e - 1, oy + j.alvo.y * e - 1, 4, 4);
        }
    }

    function estourar(x, y, cor) {
        for (let i = 0; i < 10; i++) particulas.push({ x: x * TX + TX / 2, y: y * TY + TY / 2 - 6, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3, cor, vida: 600 });
    }
    function sangrar(x, y, cor, n = 8) {
        for (let i = 0; i < n; i++) particulas.push({ x: x * TX + TX / 2, y: y * TY + TY / 2 - 12, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2.5, cor, vida: 500 });
    }

    // ── mira: converte o ponteiro em bloco (levando a altura dos blocos em conta) ──
    function alvoMouse() {
        if (!mouse || !mapa) return null;
        const cam = camera();
        const px = mouse.x + cam.x, py = mouse.y + cam.y;
        const tx = Math.floor(px / TX), ty = Math.floor(py / TY);
        // um bloco alto logo ao sul cobre a parte de baixo desta fileira
        for (const k of [1, 2]) {
            const b = bloco(tx, ty + k);
            if (ehAlto(b) && py >= (ty + k) * TY - (ALTURA_PICK[b] || AL) + (k === 2 ? 0 : 0) && py < (ty + k + 1) * TY) return { x: tx, y: ty + k };
        }
        return { x: tx, y: ty };
    }
    function mobSobMouse() {
        if (!mouse || !mapa) return null;
        const cam = camera();
        let achou = null;
        for (const o of mobs.values()) {
            const sx = o.vis.x * TX - cam.x + TX / 2, sy = o.vis.y * TY - cam.y + TY - 3;
            if (Math.abs(mouse.x - sx) <= 9 && mouse.y >= sy - 34 && mouse.y <= sy + 2) achou = o;
        }
        return achou ? { id: achou.id, x: achou.alvo.x, y: achou.alvo.y } : null;
    }

    // ── painel (HTML) ─────────────────────────────────────────────────
    function atualizarRelogio() {
        if (!eu) return;
        const s = Math.max(0, Math.ceil((eu.fim - (Date.now() + deltaRelogio)) / 1000));
        $('#mundo-tempo').text(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`).toggleClass('text-danger', s <= 30);
    }

    function renderPainel() {
        if (!eu) return;
        $('#mundo-pontos').text(eu.pontos);
        $('#mundo-meta').text(eu.metaPessoal);
        $('#mundo-fome').css('width', eu.fome + '%').toggleClass('bg-danger', eu.fome < 25).toggleClass('bg-warning', eu.fome >= 25 && eu.fome < 50);
        $('#mundo-fome-num').text(eu.fome);
        const $inv = $('#mundo-inv').empty();
        ITENS.forEach((it, i) => {
            const q = eu.inv[it] || 0;
            $('<button type="button" class="btn btn-sm mundo-item">')
                .toggleClass('btn-light', itemSel === it).toggleClass('btn-outline-light', itemSel !== it)
                .html(`<span class="mundo-ico mundo-ico-${it}"></span> ${NOME_ITEM[it]} <b>${q}</b> <span class="text-secondary small">[${i + 1}] ${eu.valores[it]}pt</span>`)
                .on('click', () => { itemSel = it; renderPainel(); })
                .appendTo($inv);
        });
        renderPainelDinamico();
    }

    function renderPainelDinamico() {
        if (!eu) return;
        $('#mundo-bau').text(bau.total);
        $('#mundo-bau-meta').text(bau.meta || eu.metaEquipe);
        $('#mundo-bau-barra').css('width', Math.min(100, (bau.total / (bau.meta || eu.metaEquipe || 1)) * 100) + '%');

        const $js = $('#mundo-jogadores').empty();
        const outros = [...jogadores.values()].filter(j => j.id !== eu.jogadorId);
        if (!outros.length) $js.append('<li class="text-secondary">Ninguém mais neste mundo agora.</li>');
        for (const j of outros) {
            const st = j.preso ? ' <span class="badge text-bg-danger">preso</span>' : j.desmaiado ? ' <span class="badge text-bg-warning">desmaiado</span>' : '';
            const $li = $(`<li class="d-flex align-items-center gap-2 mb-1"><span class="mundo-bolinha" style="background:${corDe(j.id)}"></span><span class="flex-grow-1">${escapeHtml(j.nome)}${st}</span></li>`);
            $('<button type="button" class="btn btn-sm btn-outline-success">')
                .text(`Doar ${NOME_ITEM[itemSel].toLowerCase()}`)
                .prop('disabled', !(eu.inv[itemSel] > 0))
                .on('click', () => sock.emit('mundo_doar', { para: j.id, item: itemSel, modo: qtdSel }))
                .appendTo($li);
            $js.append($li);
        }

        const $ps = $('#mundo-pedidos').empty();
        for (const p of pedidos) {
            if (p.de === eu.jogadorId) { $ps.append(`<li class="text-warning small mb-1">Seu pedido de socorro${p.fechado ? '' : ` · ${p.restante}s`}${p.aceitos.length ? ` — vindo: ${p.aceitos.map(escapeHtml).join(', ')}` : ''}</li>`); continue; }
            if (p.fechado) continue;
            const jaRespondi = p.respondeu.includes(eu.jogadorId);
            const $li = $(`<li class="small mb-1"><b>${escapeHtml(p.nome)}</b> pede socorro · ${p.restante}s </li>`);
            if (!jaRespondi) {
                $('<button type="button" class="btn btn-sm btn-success ms-1">Vou ajudar</button>')
                    .on('click', () => sock.emit('mundo_socorro_resposta', { id: p.id, aceitar: true })).appendTo($li);
                $('<button type="button" class="btn btn-sm btn-outline-secondary ms-1">Não posso</button>')
                    .on('click', () => sock.emit('mundo_socorro_resposta', { id: p.id, aceitar: false })).appendTo($li);
            } else {
                $li.append('<span class="text-secondary">(respondido)</span>');
            }
            $ps.append($li);
        }
        if (!$ps.children().length) $ps.append('<li class="text-secondary small">Nenhum pedido aberto.</li>');
        $('#mundo-btn-socorro').prop('disabled', pedidos.some(p => p.de === eu.jogadorId && !p.fechado));
        $('#mundo-btn-sacar').prop('disabled', !(bau.inv?.[itemSel] > 0));
    }

    const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    let avisoTimer = null, avisoFixo = false;
    function aviso(texto, tipo = 'info', fixo = false) {
        if (avisoFixo && !fixo && tipo !== 'success') return;   // não esconde o "desmaiou" com recado menor
        $('#mundo-aviso').attr('class', `alert alert-${tipo} py-1 px-2 small mb-2`).text(texto);
        clearTimeout(avisoTimer);
        avisoFixo = fixo;
        if (!fixo) avisoTimer = setTimeout(() => $('#mundo-aviso').attr('class', 'd-none'), 5000);
    }
    // E: come na hora; desmaiado, SEGURAR E por 5s come a própria comida e levanta.
    let segurandoE = false;
    function comecarComer() {
        if (!ativo) return;
        if (meuJogador()?.desmaiado) { if (!segurandoE) { segurandoE = true; sock.emit('mundo_comer_segurar', { ativo: true }); } }
        else sock.emit('mundo_comer');
    }
    function pararComer() { if (segurandoE) { segurandoE = false; sock.emit('mundo_comer_segurar', { ativo: false }); } }
    function feedMundo(t) { if (typeof feed === 'function') feed(t); }

    // Item caindo dentro do baú: um "tum" de madeira oca (o baú) em comum +
    // o timbre do que caiu. Tudo sintetizado, sem arquivo de áudio.
    let ruido = null;
    function bufferRuido(ac) {
        if (ruido) return ruido;
        ruido = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
        const d = ruido.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return ruido;
    }
    function tom(ac, saida, { tipo = 'sine', f0, f1, t, dur, ganho }) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = tipo;
        o.frequency.setValueAtTime(f0, t);
        if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(ganho, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(saida);
        o.start(t); o.stop(t + dur + 0.02);
    }
    function chiado(ac, saida, { filtro, freq, q = 1, t, dur, ganho }) {
        const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        src.buffer = bufferRuido(ac);
        f.type = filtro; f.frequency.value = freq; f.Q.value = q;
        g.gain.setValueAtTime(ganho, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(saida);
        src.start(t); src.stop(t + dur + 0.02);
    }
    function somDeposito(item, volume) {
        try {
            actx = actx || new (window.AudioContext || window.webkitAudioContext)();
            const ac = actx, t = ac.currentTime + 0.01;
            const saida = ac.createGain(); saida.gain.value = volume; saida.connect(ac.destination);
            const v = 0.9 + Math.random() * 0.2;   // cada unidade soa um pouco diferente
            // o baú: batida grave de madeira oca, um tico depois (o item "chega no fundo")
            tom(ac, saida, { f0: 140 * v, f1: 70, t: t + 0.04, dur: 0.16, ganho: 0.35 });
            chiado(ac, saida, { filtro: 'lowpass', freq: 500, t: t + 0.04, dur: 0.08, ganho: 0.25 });
            if (item === 'pedra') {             // pedra: "clonc" seco e pesado
                chiado(ac, saida, { filtro: 'bandpass', freq: 900 * v, q: 2, t, dur: 0.09, ganho: 0.6 });
                tom(ac, saida, { tipo: 'triangle', f0: 220 * v, f1: 90, t, dur: 0.12, ganho: 0.3 });
            } else if (item === 'madeira') {    // madeira: "toc" oco
                tom(ac, saida, { tipo: 'triangle', f0: 520 * v, f1: 300, t, dur: 0.07, ganho: 0.35 });
                tom(ac, saida, { f0: 780 * v, t, dur: 0.04, ganho: 0.12 });
                chiado(ac, saida, { filtro: 'bandpass', freq: 1800, q: 4, t, dur: 0.03, ganho: 0.25 });
            } else if (item === 'minerio') {    // minério: "tlim" metálico que ressoa
                tom(ac, saida, { f0: 1870 * v, t, dur: 0.45, ganho: 0.18 });
                tom(ac, saida, { f0: 2780 * v, t, dur: 0.3, ganho: 0.1 });
                tom(ac, saida, { f0: 4120 * v, t, dur: 0.18, ganho: 0.06 });
                chiado(ac, saida, { filtro: 'highpass', freq: 5000, t, dur: 0.02, ganho: 0.2 });
            } else if (item === 'comida') {     // comida: "ploft" macio
                tom(ac, saida, { f0: 620 * v, f1: 220, t, dur: 0.09, ganho: 0.25 });
                chiado(ac, saida, { filtro: 'lowpass', freq: 1200, t, dur: 0.06, ganho: 0.18 });
            }
        } catch (e) { /* sem áudio */ }
    }

    let actx = null;
    function somGolpe() {
        try {
            const agora = performance.now(); if (agora - golpeEm < 80) return; golpeEm = agora;
            actx = actx || new (window.AudioContext || window.webkitAudioContext)();
            const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
            o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.1);
            o.connect(g); g.connect(actx.destination);
            g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
            o.start(t); o.stop(t + 0.13);
        } catch (e) { /* sem áudio */ }
    }
    function somColeta() {
        try {
            actx = actx || new (window.AudioContext || window.webkitAudioContext)();
            const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
            o.type = 'square'; o.frequency.value = 660; o.connect(g); g.connect(actx.destination);
            g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
            o.start(t); o.stop(t + 0.09);
        } catch (e) { /* sem áudio */ }
    }

    // ── entrada (teclado / mouse) ─────────────────────────────────────
    const digitando = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    const DIRS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
    function enviarDirecao() {
        let dx = 0, dy = 0;
        for (const k of teclas) { const d = DIRS[k]; if (d) { dx += d[0]; dy += d[1]; } }
        dx = Math.sign(dx); dy = Math.sign(dy);
        if (dx !== dirAtual.dx || dy !== dirAtual.dy) { dirAtual = { dx, dy }; sock.emit('mundo_input', dirAtual); }
    }
    window.addEventListener('keydown', e => {
        if (!ativo || digitando()) return;
        if (DIRS[e.code]) { e.preventDefault(); teclas.add(e.code); enviarDirecao(); return; }
        const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
        if (n >= 0) { itemSel = ITENS[n]; renderPainel(); return; }
        if (e.code === 'KeyE' && !e.repeat) comecarComer();
        if (e.code === 'Space') { e.preventDefault(); sock.emit('mundo_atacar', {}); }   // golpeia o adversário mais próximo
    });
    window.addEventListener('keyup', e => {
        if (e.code === 'KeyE') pararComer();
        if (teclas.delete(e.code) && ativo) enviarDirecao();
    });
    window.addEventListener('blur', () => { teclas.clear(); pararComer(); if (ativo) enviarDirecao(); });

    function blocoSobMouse(ev) {
        const r = cv.getBoundingClientRect();
        mouse = { x: ev.clientX - r.left, y: ev.clientY - r.top };
        return alvoMouse();
    }
    let timerGolpe = null;
    function pararGolpe() { clearInterval(timerGolpe); timerGolpe = null; }
    function pararMinerar() { pararGolpe(); if (segurando) { segurando = false; minerandoEm = null; sock.emit('mundo_minerar', { alvo: null }); } }

    $(document).on('mousedown', '#mundo-canvas', ev => {
        if (!ativo || !mapa) return;
        ev.preventDefault();
        document.activeElement?.blur();
        const b = blocoSobMouse(ev);
        if (ev.button === 2) { sock.emit('mundo_usar', { x: b.x, y: b.y, item: itemSel }); return; }
        if (ev.button !== 0) return;
        const mob = mobSobMouse();
        if (mob) {   // clique num adversário: vai até ele e bate enquanto segurar
            segurando = true; minerandoEm = null;
            pararGolpe();
            const bater = () => { const p = meuJogador(); if (p && Math.max(Math.abs(p.alvo.x - mob.x), Math.abs(p.alvo.y - mob.y)) > 1) { const m = mobs.get(mob.id); if (m) sock.emit('mundo_minerar', { alvo: m.alvo }); } else sock.emit('mundo_atacar', { id: mob.id }); };
            bater(); timerGolpe = setInterval(bater, 250);
            return;
        }
        segurando = true; minerandoEm = b;
        sock.emit('mundo_minerar', { alvo: b, item: itemSel });
    });
    $(document).on('mousemove', '#mundo-canvas', ev => {
        if (!ativo || !mapa) return;
        const b = blocoSobMouse(ev);
        if (segurando && !timerGolpe && (b.x !== minerandoEm?.x || b.y !== minerandoEm?.y)) { minerandoEm = b; sock.emit('mundo_minerar', { alvo: b, item: itemSel }); }
    });
    $(document).on('mouseleave', '#mundo-canvas', () => { mouse = null; pararMinerar(); });
    window.addEventListener('mouseup', () => { if (ativo) pararMinerar(); });
    $(document).on('contextmenu', '#mundo-canvas', ev => ev.preventDefault());

    // ── botões do painel ──────────────────────────────────────────────
    $(document).on('change', 'input[name=mundo-qtd]', function () { qtdSel = this.value; });
    $(document).on('click', '#mundo-btn-sacar', () => sock.emit('mundo_bau', { operacao: 'sacar', item: itemSel, modo: qtdSel }));
    $(document).on('mousedown', '#mundo-btn-comer', comecarComer);
    $(document).on('mouseup mouseleave', '#mundo-btn-comer', pararComer);
    $(document).on('click', '#mundo-btn-ajuda', () => { if (ativo) mostrarAjuda(false); });
    $(document).on('click', '#mundo-btn-socorro', () => sock.emit('mundo_socorro'));
    $(document).on('click', '#mundo-btn-sair', () => {
        if (confirmarSaida()) sair();
    });
    // mesma saída da porta do mapa: entrega os pontos e volta ao hall (ou à lista, no modo livre)
    $(document).on('click', '#mundo-btn-hall', () => {
        if (ativo && confirmarSaida()) sair(true);
    });
    $(document).on('click', '#mundo-btn-tela-cheia', () => {
        const el = document.getElementById('jogo-mundo');
        if (document.fullscreenElement) document.exitFullscreen?.();
        else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    });
    document.addEventListener('fullscreenchange', () => setTimeout(ajustarCanvas, 50));
    window.addEventListener('resize', () => { if (ativo) ajustarCanvas(); });

    return { iniciar, parar, ativo: () => ativo };
})();

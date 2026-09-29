// Painel de manutenção das tabelas de apoio — /admin.
// Login próprio (ADMIN_USER / ADMIN_SENHA no .env), separado das contas do jogo.
// Renderiza HTML no servidor; sem build, sem framework de view.
//
// Só as tabelas listadas em TABELAS são acessíveis; nome de tabela e de
// coluna vêm sempre desse whitelist (nunca da requisição), então é seguro
// interpolar os identificadores. Valores são sempre parametrizados.

import { pool } from './db.js';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_SENHA = process.env.ADMIN_SENHA || 'trocar';

const TABELAS = {
    parametro: {
        titulo: 'Parâmetros do jogo', pk: 'id', auto: true, ordem: 'escopo, chave, escopo_id',
        colunas: [
            { c: 'escopo', tipo: 'select', opcoes: ['global', 'sala', 'enigma'] },
            { c: 'escopo_id', tipo: 'number' },
            { c: 'chave', tipo: 'text' },
            { c: 'valor', tipo: 'number' },
        ],
    },
    enigma: {
        titulo: 'Enigmas', pk: 'id', auto: true, ordem: 'ordem NULLS LAST, id', paginar: 40,
        filtroAtivo: true,   // lista só ativo='S' por padrão; ?todos=1 mostra tudo
        // Excluir um enigma leva com ele o próprio histórico de quem o jogou
        // (tentativa/desistencia) e as portas que o usaram (sessao_enigma).
        // Nada referencia essas três tabelas, então não há cascata além disso.
        dependentes: [
            { tabela: 'tentativa', coluna: 'enigma_id' },
            { tabela: 'sessao_enigma', coluna: 'enigma_id' },
            { tabela: 'desistencia', coluna: 'enigma_id' },
        ],
        // A fase co-op é um tabuleiro de perguntas com campo de resposta; o
        // Mundo lá viraria "digite a meta e passe". Ele já é coletivo por si.
        validar: d => {
            if (d.niveis == null) d.niveis = 1;
            if (!(Number(d.niveis) >= 1)) return '"niveis" precisa ser 1 ou mais.';
            return (d.tipo === 'mundo' && d.fase != null)
                ? 'O Mundo não pode ser fase: ele já junta todos da sala. Deixe "fase" vazio e use "ordem" para posicioná-lo na sequência.'
                : null;
        },
        colunas: [
            { c: 'origem', tipo: 'text', ro: true },
            { c: 'tipo', tipo: 'select', opcoes: ['texto', 'html', 'jogo', 'mundo', 'aritmetica'] },
            { c: 'nivel', tipo: 'text' },
            { c: 'ordem', tipo: 'number' },
            { c: 'fase', tipo: 'number' },   // nº da fase co-op (vazio = enigma solo)
            { c: 'niveis', tipo: 'number' }, // tipo 'jogo': quantas fases o jogo tem por dentro (1 = só a primeira)
            { c: 'pergunta', tipo: 'textarea' },
            { c: 'resposta', tipo: 'text' },
            { c: 'arquivo', tipo: 'text' },
            { c: 'ativo', tipo: 'select', opcoes: ['S', 'N'] },
        ],
    },
    avatar: {
        titulo: 'Avatares', pk: 'codigo', ordem: 'codigo',
        colunas: [
            { c: 'codigo', tipo: 'text' }, { c: 'nome', tipo: 'text' },
            { c: 'arquivo', tipo: 'text' }, { c: 'ativo', tipo: 'select', opcoes: ['S', 'N'] },
        ],
    },
    era: {
        titulo: 'Eras', pk: 'codigo', ordem: 'codigo',
        colunas: [
            { c: 'codigo', tipo: 'text' }, { c: 'nome', tipo: 'text' },
            { c: 'descricao', tipo: 'textarea' }, { c: 'disponivel', tipo: 'select', opcoes: ['S', 'N'] },
        ],
    },
    zona: {
        titulo: 'Zonas', pk: 'id', auto: true, ordem: 'codigo',
        colunas: [
            { c: 'codigo', tipo: 'text' }, { c: 'nome', tipo: 'text' },
            { c: 'capacidade', tipo: 'number' }, { c: 'era_codigo', tipo: 'text' },
        ],
    },
    eixo_destino: {
        titulo: 'Eixos de destino', pk: 'codigo', ordem: 'codigo',
        colunas: [
            { c: 'codigo', tipo: 'text' }, { c: 'nome', tipo: 'text' },
            { c: 'pontos_min', tipo: 'number' }, { c: 'pontos_max', tipo: 'number' },
        ],
    },
    tipo_evento: {
        titulo: 'Tipos de evento', pk: 'codigo', ordem: 'codigo',
        colunas: [
            { c: 'codigo', tipo: 'text' }, { c: 'descricao', tipo: 'text' },
            { c: 'ativo', tipo: 'select', opcoes: ['S', 'N'] },
        ],
    },
    regra_destino: {
        titulo: 'Regras de destino', pk: 'id', auto: true, ordem: 'codigo',
        colunas: [
            { c: 'codigo', tipo: 'text' }, { c: 'eixo', tipo: 'text' }, { c: 'tipo_evento', tipo: 'text' },
            { c: 'peso', tipo: 'number' }, { c: 'janela_seg', tipo: 'number' },
            { c: 'max_ocorrencias', tipo: 'number' },
            { c: 'exige_alvo_distinto', tipo: 'select', opcoes: ['S', 'N'] },
            { c: 'probabilidade', tipo: 'number' }, { c: 'ativo', tipo: 'select', opcoes: ['S', 'N'] },
        ],
    },
    limiar: {
        titulo: 'Limiares', pk: 'id', auto: true, ordem: 'eixo, ordem',
        colunas: [
            { c: 'eixo', tipo: 'text' }, { c: 'codigo', tipo: 'text' }, { c: 'ordem', tipo: 'number' },
            { c: 'pontos_entrada', tipo: 'number' }, { c: 'pontos_saida', tipo: 'number' },
            { c: 'efeito_codigo', tipo: 'text' }, { c: 'descricao', tipo: 'text' },
        ],
    },
};

// ── HTML ────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pagina(titulo, corpo) {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)} — manutenção</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<style>body{background:#0b1020;color:#e2e8f0}.table{color:#e2e8f0}.form-control,.form-select{background:#0d1224;border-color:#1e2a45;color:#e2e8f0}
.form-control:focus,.form-select:focus{background:#0d1224;color:#e2e8f0}td{vertical-align:middle}
#ov{position:fixed;inset:0;background:rgba(6,10,26,.6);z-index:1050;display:none;align-items:center;justify-content:center}
#ov.on{display:flex}#flash{display:none;position:sticky;top:0;z-index:1040}</style>
</head><body>
<div id="ov"><div class="text-center"><div class="spinner-border mb-2"></div><div>salvando…</div></div></div>
<main class="container-fluid py-4" style="max-width:1200px"><div id="flash" class="alert py-2"></div>${corpo}</main>
${SCRIPT_AJAX}
</body></html>`;
}

// Submete os formulários da tabela por AJAX: esmaece a tela enquanto o BD
// responde e volta ao normal em sucesso, erro ou timeout (15s). Sem AJAX
// (JS desligado) os forms ainda funcionam por POST normal — o servidor
// responde JSON só quando o Accept pede.
const SCRIPT_AJAX = `<script>
(function () {
  var ov = document.getElementById('ov'), flash = document.getElementById('flash'), t;
  function mostra(msg, tipo) {
    flash.className = 'alert py-2 alert-' + (tipo || 'success');
    flash.textContent = msg; flash.style.display = 'block';
    clearTimeout(t); t = setTimeout(function () { flash.style.display = 'none'; }, 4000);
  }
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches || !form.matches('form[data-ajax]')) return;
    e.preventDefault();
    var btn = e.submitter || form.querySelector('button');
    var acao = (btn && btn.getAttribute('formaction')) || form.getAttribute('action');
    var confirmar = btn && btn.getAttribute('data-confirm');
    if (confirmar && !window.confirm(confirmar)) return;
    var recarrega = /\\/(inserir|excluir)$/.test(acao);
    var ac = new AbortController();
    var prazo = setTimeout(function () { ac.abort(); }, 15000);
    ov.classList.add('on');
    fetch(acao, {
      method: 'POST', signal: ac.signal,
      headers: { 'Accept': 'application/json' },
      body: new URLSearchParams(new FormData(form))
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false, msg: 'resposta inválida (' + r.status + ')', tipo: 'danger' }; }); })
      .then(function (d) {
        mostra(d.msg || (d.ok ? 'ok' : 'erro'), d.tipo || (d.ok ? 'success' : 'danger'));
        if (d.ok && recarrega) {
          var u = new URL(location.href);
          u.searchParams.set('m', d.msg); u.searchParams.set('tipo', d.tipo || 'success');
          setTimeout(function () { location.href = u.toString(); }, 400);
        }
      })
      .catch(function (err) {
        mostra(err && err.name === 'AbortError'
          ? 'Tempo esgotado — o resultado é incerto, recarregue para conferir.'
          : 'Falha de rede.', 'danger');
      })
      .then(function () { clearTimeout(prazo); ov.classList.remove('on'); });
  });
})();
</script>`;

function campo(col, valor, prefixo = '') {
    const nome = prefixo + col.c;
    const v = valor ?? '';
    if (col.ro) return `<input class="form-control form-control-sm" value="${esc(v)}" readonly>`;
    if (col.tipo === 'select') {
        // valor do banco fora da lista continua selecionável — senão o Salvar
        // manda vazio e apaga (ou viola NOT NULL) sem o usuário perceber
        const opcoes = v !== '' && !col.opcoes.map(String).includes(String(v)) ? [...col.opcoes, v] : col.opcoes;
        return `<select name="${nome}" class="form-select form-select-sm">` +
            ['', ...opcoes].map(o => `<option${String(o) === String(v) ? ' selected' : ''}>${esc(o)}</option>`).join('') +
            `</select>`;
    }
    if (col.tipo === 'textarea') {
        return `<textarea name="${nome}" rows="2" class="form-control form-control-sm">${esc(v)}</textarea>`;
    }
    const t = col.tipo === 'number' ? 'number' : 'text';
    return `<input name="${nome}" type="${t}" step="any" class="form-control form-control-sm" value="${esc(v)}">`;
}

// ── Rotas ───────────────────────────────────────────────────────────
// `hooks.aoPular(sessaoId, codigo)`: avisa o jogo ao vivo (socket) depois de
// um salto de porta — o admin é HTTP e não enxerga o Socket.IO.
export function montarAdmin(app, hooks = {}) {
    const exigeAdmin = (req, res, next) => {
        if (req.session?.admin) return next();
        res.redirect('/admin/entrar');
    };

    app.get('/admin/entrar', (req, res) => {
        const erro = req.query.e ? '<div class="alert alert-danger py-2">Usuário ou senha incorretos.</div>' : '';
        res.send(pagina('Entrar', `<div class="mx-auto" style="max-width:360px">
<h1 class="h4 mb-3">Manutenção</h1>${erro}
<form method="post" action="/admin/entrar">
<div class="mb-2"><input name="usuario" class="form-control" placeholder="usuário" autofocus></div>
<div class="mb-3"><input name="senha" type="password" class="form-control" placeholder="senha"></div>
<button class="btn btn-primary w-100">Entrar</button></form></div>`));
    });

    app.post('/admin/entrar', (req, res) => {
        const { usuario, senha } = req.body || {};
        if (usuario === ADMIN_USER && senha === ADMIN_SENHA) {
            req.session.admin = true;
            return res.redirect('/admin');
        }
        res.redirect('/admin/entrar?e=1');
    });

    app.get('/admin/sair', (req, res) => {
        if (req.session) req.session.admin = false;
        res.redirect('/admin/entrar');
    });

    app.get('/admin', exigeAdmin, (_req, res) => {
        const links = Object.entries(TABELAS).map(([t, cfg]) =>
            `<li class="mb-1"><a href="/admin/t/${t}">${esc(cfg.titulo)}</a> <span class="text-secondary small">(${t})</span></li>`).join('');
        res.send(pagina('Manutenção', `<div class="d-flex justify-content-between align-items-center mb-3">
<h1 class="h4 mb-0">Tabelas de apoio</h1><a href="/admin/sair" class="btn btn-sm btn-outline-secondary">sair</a></div>
<ul class="list-unstyled">${links}</ul>
<h2 class="h6 mt-4">Ferramentas de teste</h2>
<ul class="list-unstyled"><li><a href="/admin/pular">Pular de porta numa sala em jogo</a></li></ul>`));
    });

    // ── Pular de porta (teste) ───────────────────────────────────────
    // Leva TODOS os jogadores de uma sala em jogo para a porta escolhida.
    // Ferramenta de testador: não gera evento nem caráter.
    app.get('/admin/pular', exigeAdmin, async (req, res, next) => {
        try {
            const msg = req.query.m ? `<div class="alert alert-${req.query.tipo || 'success'} py-2">${esc(req.query.m)}</div>` : '';
            const salas = (await pool.query(
                `SELECT id, codigo, dt_abertura FROM sessao
                  WHERE estado = 'em_jogo' ORDER BY dt_abertura DESC LIMIT 15`)).rows;
            let corpo = '';
            for (const s of salas) {
                const seq = (await pool.query(
                    `SELECT se.ordem, se.fase, e.id, e.tipo, e.nivel, left(e.pergunta, 60) AS pergunta
                       FROM sessao_enigma se JOIN enigma e ON e.id = se.enigma_id
                      WHERE se.sessao_id = $1 ORDER BY se.ordem`, [s.id])).rows;
                const jog = (await pool.query(
                    `SELECT j.apelido, pj.porta, pj.dt_fim, round(energia_atual(pj.id)) AS energia
                       FROM partida_jogador pj JOIN jogador j ON j.id = pj.jogador_id
                      WHERE pj.sessao_id = $1 ORDER BY j.apelido`, [s.id])).rows;
                const jogs = jog.map(j => `${esc(j.apelido)} — porta ${j.porta}, ${j.energia}%${j.dt_fim ? ' (fim)' : ''}`).join(' · ') || 'ninguém com partida';
                const linhas = seq.map(x => `<tr>
<td>${x.ordem}</td><td>${esc(x.tipo)}${x.fase != null ? ` <span class="badge text-bg-info">fase ${x.fase}</span>` : ''}</td>
<td>${esc(x.nivel)}</td><td class="small">${esc(x.pergunta)}</td>
<td><form method="post" action="/admin/pular" class="m-0">
<input type="hidden" name="sessao" value="${s.id}"><input type="hidden" name="porta" value="${x.ordem}">
<label class="small me-2"><input type="checkbox" name="recarregar" value="1" checked> energia 100%</label>
<button class="btn btn-sm btn-primary">Ir para</button></form></td></tr>`).join('');
                const portaMundo = seq.find(x => x.tipo === 'mundo')?.ordem;
                const atalho = `<form method="post" action="/admin/pular" class="d-inline m-0">
<input type="hidden" name="sessao" value="${s.id}"><input type="hidden" name="recarregar" value="1">
${portaMundo ? `<input type="hidden" name="porta" value="${portaMundo}"><button class="btn btn-sm btn-success">⛏ Ir para o Mundo (porta ${portaMundo})</button>`
        : `<input type="hidden" name="mundo" value="1"><button class="btn btn-sm btn-outline-success">⛏ Adicionar o Mundo nesta sala e ir</button>`}
</form>`;
                corpo += `<div class="mb-4"><h2 class="h6 d-flex align-items-center gap-2">Sala <b>${esc(s.codigo)}</b> <span class="text-secondary small">(sessão ${s.id})</span> ${atalho}</h2>
<p class="small text-secondary mb-1">${jogs}</p>
<table class="table table-sm table-dark align-middle"><thead><tr><th>porta</th><th>tipo</th><th>nível</th><th>pergunta</th><th></th></tr></thead>
<tbody>${linhas}</tbody></table></div>`;
            }
            res.send(pagina('Pular de porta', `<div class="d-flex justify-content-between align-items-center mb-3">
<h1 class="h5 mb-0">Pular de porta <span class="text-secondary small">teste</span></h1>
<a href="/admin" class="btn btn-sm btn-outline-secondary">← admin</a></div>${msg}
<p class="small text-secondary">Crie a sala, clique em Iniciar jogo e escolha aqui a porta. Todos os jogadores da sala vão
para o hall dessa porta na hora. Não gera evento nem caráter.</p>
${corpo || '<p>Nenhuma sala em jogo agora.</p>'}`));
        } catch (err) { next(err); }
    });

    app.post('/admin/pular', exigeAdmin, async (req, res) => {
        const sessaoId = Number(req.body.sessao);
        let porta = Number(req.body.porta);
        const volta = (m, tipo) => res.redirect(`/admin/pular?m=${encodeURIComponent(m)}${tipo ? '&tipo=' + tipo : ''}`);
        if (!Number.isInteger(sessaoId)) return volta('Parâmetros inválidos.', 'danger');
        try {
            const s = (await pool.query(`SELECT codigo, estado FROM sessao WHERE id = $1`, [sessaoId])).rows[0];
            if (!s || s.estado !== 'em_jogo') return volta('Essa sala não está em jogo.', 'danger');
            // Sala iniciada antes do Mundo existir: acrescenta o Mundo como última porta.
            if (req.body.mundo === '1') {
                const r = await pool.query(
                    `INSERT INTO sessao_enigma (sessao_id, ordem, enigma_id)
                     SELECT $1, COALESCE(MAX(se.ordem), 0) + 1,
                            (SELECT id FROM enigma WHERE tipo = 'mundo' AND ativo = 'S' ORDER BY ordem NULLS LAST, id LIMIT 1)
                       FROM sessao_enigma se WHERE se.sessao_id = $1
                     RETURNING ordem, enigma_id`, [sessaoId]);
                if (!r.rows[0]?.enigma_id) return volta('Não há enigma do tipo mundo ativo no catálogo.', 'danger');
                porta = r.rows[0].ordem;
            }
            if (!Number.isInteger(porta)) return volta('Parâmetros inválidos.', 'danger');
            const existe = (await pool.query(
                `SELECT 1 FROM sessao_enigma WHERE sessao_id = $1 AND ordem = $2`, [sessaoId, porta])).rowCount;
            if (!existe) return volta(`A sala não tem a porta ${porta}.`, 'danger');
            const r = await pool.query(
                `UPDATE partida_jogador
                    SET porta = $2,
                        energia = CASE WHEN $3 THEN 100 ELSE energia_atual(id) END,
                        dt_energia = now(),
                        dt_fim = NULL
                  WHERE sessao_id = $1`,
                [sessaoId, porta, req.body.recarregar === '1']);
            await hooks.aoPular?.(sessaoId, s.codigo);
            volta(`Sala ${s.codigo}: ${r.rowCount} jogador(es) levados para a porta ${porta}.`);
        } catch (err) { volta('Erro: ' + err.message, 'danger'); }
    });

    app.get('/admin/t/:tabela', exigeAdmin, async (req, res, next) => {
        const cfg = TABELAS[req.params.tabela];
        if (!cfg) return res.status(404).send('tabela não configurada');
        const tabela = req.params.tabela;
        const msg = req.query.m ? `<div class="alert alert-${req.query.tipo || 'success'} py-2">${esc(req.query.m)}</div>` : '';
        try {
            const cols = cfg.colunas.map(x => x.c);
            const uniq = [...new Set([cfg.pk, ...cols])];
            const pag = Math.max(0, parseInt(req.query.p) || 0);
            const todos = !cfg.filtroAtivo || req.query.todos === '1';
            const where = todos ? '' : ` WHERE "ativo" = 'S'`;
            const qs = extra => { const u = new URLSearchParams(extra); if (cfg.filtroAtivo && todos) u.set('todos', '1'); return '?' + u; };
            let sql = `SELECT ${uniq.map(q => `"${q}"`).join(', ')} FROM "${tabela}"${where} ORDER BY ${cfg.ordem}`;
            if (cfg.paginar) sql += ` LIMIT ${cfg.paginar} OFFSET ${pag * cfg.paginar}`;
            const { rows } = await pool.query(sql);
            const total = cfg.paginar
                ? (await pool.query(`SELECT count(*)::int c FROM "${tabela}"${where}`)).rows[0].c : rows.length;
            const toggle = !cfg.filtroAtivo ? '' : `<div class="btn-group btn-group-sm" role="group">
<a class="btn ${todos ? 'btn-outline-light' : 'btn-light'}" href="/admin/t/${tabela}">ATIVOS</a>
<a class="btn ${todos ? 'btn-light' : 'btn-outline-light'}" href="/admin/t/${tabela}?todos=1">TODOS</a></div>`;

            const th = cfg.colunas.map(x => `<th class="small text-secondary">${esc(x.c)}</th>`).join('') + '<th></th>';

            const linhaNova = `<tr><form method="post" data-ajax action="/admin/t/${tabela}/inserir">` +
                cfg.colunas.map(x => `<td>${x.ro && cfg.auto ? '<span class="text-secondary small">auto</span>' : campo(x)}</td>`).join('') +
                `<td><button class="btn btn-sm btn-success">+ Adicionar</button></td></form></tr>`;

            const trs = rows.map(r => {
                const id = r[cfg.pk];
                return `<tr><form method="post" data-ajax action="/admin/t/${tabela}/${encodeURIComponent(id)}/salvar">` +
                    cfg.colunas.map(x => `<td>${x.c === cfg.pk ? `<span class="small">${esc(r[x.c])}</span><input type="hidden" name="${x.c}" value="${esc(r[x.c])}">` : campo(x, r[x.c])}</td>`).join('') +
                    `<td class="text-nowrap"><button class="btn btn-sm btn-primary">Salvar</button>
<button class="btn btn-sm btn-outline-danger ms-1" formaction="/admin/t/${tabela}/${encodeURIComponent(id)}/excluir"
 data-confirm="Excluir ${esc(id)}?">×</button></td></form></tr>`;
            }).join('');

            let paginacao = '';
            if (cfg.paginar) {
                const ult = Math.floor((total - 1) / cfg.paginar);
                paginacao = `<div class="d-flex gap-2 my-2">
${pag > 0 ? `<a class="btn btn-sm btn-outline-secondary" href="${qs({ p: pag - 1 })}">← anterior</a>` : ''}
<span class="align-self-center small text-secondary">${pag + 1} / ${Math.max(ult, 0) + 1} · ${total} linhas${cfg.filtroAtivo ? (todos ? ' (todos)' : ' ativas') : ''}</span>
${pag < ult ? `<a class="btn btn-sm btn-outline-secondary" href="${qs({ p: pag + 1 })}">próxima →</a>` : ''}</div>`;
            }

            // Enigma: linha grande e fácil de editar sem notar — o botão avisa
            // que há alteração não salva antes que a pessoa mude de página.
            const destaqueEdicao = tabela !== 'enigma' ? '' : `<script>
(function () {
  document.querySelectorAll('tbody form[action*="/salvar"]').forEach(function (form) {
    var btn = form.querySelector('button.btn-primary');
    if (!btn) return;
    ['input', 'change'].forEach(function (ev) {
      form.addEventListener(ev, function () { btn.classList.replace('btn-primary', 'btn-warning'); });
    });
    form.addEventListener('submit', function () { btn.classList.replace('btn-warning', 'btn-primary'); });
  });
})();
</script>`;

            res.send(pagina(cfg.titulo, `<div class="d-flex justify-content-between align-items-center mb-3">
<h1 class="h5 mb-0">${esc(cfg.titulo)} <span class="text-secondary small">${esc(tabela)}</span></h1>
<div class="d-flex gap-2 align-items-center">${toggle}<a href="/admin" class="btn btn-sm btn-outline-secondary">← tabelas</a></div></div>${msg}${paginacao}
<div class="table-responsive"><table class="table table-sm table-dark align-middle">
<thead><tr>${th}</tr></thead>
<tbody>${linhaNova}${trs}</tbody></table></div>${paginacao}${destaqueEdicao}`));
        } catch (err) { next(err); }
    });

    const coletar = (cfg, body) => {
        const d = {};
        for (const col of cfg.colunas) {
            if (col.ro) continue;
            let v = body[col.c];
            d[col.c] = (v === undefined || v === '') ? null : v;
        }
        return d;
    };
    // Responde JSON quando o cliente pede (AJAX da tabela); senão, redirect
    // com a mensagem na query (fallback sem JS).
    const responder = (req, res, tabela, m, tipo) => {
        if (req.accepts(['html', 'json']) === 'json') {
            return res.json({ ok: tipo !== 'danger', msg: m, tipo: tipo || 'success' });
        }
        res.redirect(`/admin/t/${tabela}?m=${encodeURIComponent(m)}${tipo ? '&tipo=' + tipo : ''}`);
    };

    app.post('/admin/t/:tabela/inserir', exigeAdmin, async (req, res) => {
        const cfg = TABELAS[req.params.tabela]; if (!cfg) return res.status(404).end();
        const tabela = req.params.tabela;
        try {
            const d = coletar(cfg, req.body);
            const invalido = cfg.validar?.(d);
            if (invalido) return responder(req, res, tabela, invalido, 'danger');
            const ks = Object.keys(d).filter(k => !(cfg.auto && k === cfg.pk));
            await pool.query(
                `INSERT INTO "${tabela}" (${ks.map(k => `"${k}"`).join(',')}) VALUES (${ks.map((_, i) => '$' + (i + 1)).join(',')})`,
                ks.map(k => d[k]));
            responder(req, res, tabela, 'Linha adicionada.');
        } catch (err) { responder(req, res, tabela, 'Erro ao adicionar: ' + err.message, 'danger'); }
    });

    app.post('/admin/t/:tabela/:id/salvar', exigeAdmin, async (req, res) => {
        const cfg = TABELAS[req.params.tabela]; if (!cfg) return res.status(404).end();
        const tabela = req.params.tabela;
        try {
            const d = coletar(cfg, req.body);
            const invalido = cfg.validar?.(d);
            if (invalido) return responder(req, res, tabela, invalido, 'danger');
            delete d[cfg.pk];
            const ks = Object.keys(d);
            await pool.query(
                `UPDATE "${tabela}" SET ${ks.map((k, i) => `"${k}"=$${i + 1}`).join(',')} WHERE "${cfg.pk}"=$${ks.length + 1}`,
                [...ks.map(k => d[k]), req.params.id]);
            responder(req, res, tabela, 'Linha salva.');
        } catch (err) { responder(req, res, tabela, 'Erro ao salvar: ' + err.message, 'danger'); }
    });

    app.post('/admin/t/:tabela/:id/excluir', exigeAdmin, async (req, res) => {
        const cfg = TABELAS[req.params.tabela]; if (!cfg) return res.status(404).end();
        const tabela = req.params.tabela;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const dep of cfg.dependentes || []) {
                await client.query(`DELETE FROM "${dep.tabela}" WHERE "${dep.coluna}"=$1`, [req.params.id]);
            }
            await client.query(`DELETE FROM "${tabela}" WHERE "${cfg.pk}"=$1`, [req.params.id]);
            await client.query('COMMIT');
            responder(req, res, tabela, 'Linha excluída.');
        } catch (err) {
            await client.query('ROLLBACK');
            const m = err.code === '23503'
                ? 'Não dá para excluir: há registros que dependem desta linha.'
                : 'Erro ao excluir: ' + err.message;
            responder(req, res, tabela, m, 'danger');
        } finally {
            client.release();
        }
    });
}

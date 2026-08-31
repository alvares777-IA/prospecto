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
        colunas: [
            { c: 'origem', tipo: 'text', ro: true },
            { c: 'tipo', tipo: 'select', opcoes: ['texto', 'html', 'aritmetica'] },
            { c: 'nivel', tipo: 'text' },
            { c: 'ordem', tipo: 'number' },
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
.form-control:focus,.form-select:focus{background:#0d1224;color:#e2e8f0}td{vertical-align:middle}</style>
</head><body><main class="container-fluid py-4" style="max-width:1200px">${corpo}</main></body></html>`;
}

function campo(col, valor, prefixo = '') {
    const nome = prefixo + col.c;
    const v = valor ?? '';
    if (col.ro) return `<input class="form-control form-control-sm" value="${esc(v)}" readonly>`;
    if (col.tipo === 'select') {
        return `<select name="${nome}" class="form-select form-select-sm">` +
            ['', ...col.opcoes].map(o => `<option${String(o) === String(v) ? ' selected' : ''}>${esc(o)}</option>`).join('') +
            `</select>`;
    }
    if (col.tipo === 'textarea') {
        return `<textarea name="${nome}" rows="2" class="form-control form-control-sm">${esc(v)}</textarea>`;
    }
    const t = col.tipo === 'number' ? 'number' : 'text';
    return `<input name="${nome}" type="${t}" step="any" class="form-control form-control-sm" value="${esc(v)}">`;
}

// ── Rotas ───────────────────────────────────────────────────────────
export function montarAdmin(app) {
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
<ul class="list-unstyled">${links}</ul>`));
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
            let sql = `SELECT ${uniq.map(q => `"${q}"`).join(', ')} FROM "${tabela}" ORDER BY ${cfg.ordem}`;
            if (cfg.paginar) sql += ` LIMIT ${cfg.paginar} OFFSET ${pag * cfg.paginar}`;
            const { rows } = await pool.query(sql);
            const total = cfg.paginar
                ? (await pool.query(`SELECT count(*)::int c FROM "${tabela}"`)).rows[0].c : rows.length;

            const th = cfg.colunas.map(x => `<th class="small text-secondary">${esc(x.c)}</th>`).join('') + '<th></th>';

            const linhaNova = `<tr><form method="post" action="/admin/t/${tabela}/inserir">` +
                cfg.colunas.map(x => `<td>${x.ro && cfg.auto ? '<span class="text-secondary small">auto</span>' : campo(x)}</td>`).join('') +
                `<td><button class="btn btn-sm btn-success">+ Adicionar</button></td></form></tr>`;

            const trs = rows.map(r => {
                const id = r[cfg.pk];
                return `<tr><form method="post" action="/admin/t/${tabela}/${encodeURIComponent(id)}/salvar">` +
                    cfg.colunas.map(x => `<td>${x.c === cfg.pk ? `<span class="small">${esc(r[x.c])}</span><input type="hidden" name="${x.c}" value="${esc(r[x.c])}">` : campo(x, r[x.c])}</td>`).join('') +
                    `<td class="text-nowrap"><button class="btn btn-sm btn-primary">Salvar</button>
<button class="btn btn-sm btn-outline-danger ms-1" formaction="/admin/t/${tabela}/${encodeURIComponent(id)}/excluir"
 onclick="return confirm('Excluir ${esc(id)}?')">×</button></td></form></tr>`;
            }).join('');

            let paginacao = '';
            if (cfg.paginar) {
                const ult = Math.floor((total - 1) / cfg.paginar);
                paginacao = `<div class="d-flex gap-2 my-2">
${pag > 0 ? `<a class="btn btn-sm btn-outline-secondary" href="?p=${pag - 1}">← anterior</a>` : ''}
<span class="align-self-center small text-secondary">${pag + 1} / ${ult + 1} · ${total} linhas</span>
${pag < ult ? `<a class="btn btn-sm btn-outline-secondary" href="?p=${pag + 1}">próxima →</a>` : ''}</div>`;
            }

            res.send(pagina(cfg.titulo, `<div class="d-flex justify-content-between align-items-center mb-3">
<h1 class="h5 mb-0">${esc(cfg.titulo)} <span class="text-secondary small">${esc(tabela)}</span></h1>
<a href="/admin" class="btn btn-sm btn-outline-secondary">← tabelas</a></div>${msg}${paginacao}
<div class="table-responsive"><table class="table table-sm table-dark align-middle">
<thead><tr>${th}</tr></thead>
<tbody>${linhaNova}${trs}</tbody></table></div>${paginacao}`));
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
    const volta = (res, tabela, m, tipo) =>
        res.redirect(`/admin/t/${tabela}?m=${encodeURIComponent(m)}${tipo ? '&tipo=' + tipo : ''}`);

    app.post('/admin/t/:tabela/inserir', exigeAdmin, async (req, res) => {
        const cfg = TABELAS[req.params.tabela]; if (!cfg) return res.status(404).end();
        const tabela = req.params.tabela;
        try {
            const d = coletar(cfg, req.body);
            const ks = Object.keys(d).filter(k => !(cfg.auto && k === cfg.pk));
            await pool.query(
                `INSERT INTO "${tabela}" (${ks.map(k => `"${k}"`).join(',')}) VALUES (${ks.map((_, i) => '$' + (i + 1)).join(',')})`,
                ks.map(k => d[k]));
            volta(res, tabela, 'Linha adicionada.');
        } catch (err) { volta(res, tabela, 'Erro ao adicionar: ' + err.message, 'danger'); }
    });

    app.post('/admin/t/:tabela/:id/salvar', exigeAdmin, async (req, res) => {
        const cfg = TABELAS[req.params.tabela]; if (!cfg) return res.status(404).end();
        const tabela = req.params.tabela;
        try {
            const d = coletar(cfg, req.body);
            delete d[cfg.pk];
            const ks = Object.keys(d);
            await pool.query(
                `UPDATE "${tabela}" SET ${ks.map((k, i) => `"${k}"=$${i + 1}`).join(',')} WHERE "${cfg.pk}"=$${ks.length + 1}`,
                [...ks.map(k => d[k]), req.params.id]);
            volta(res, tabela, 'Linha salva.');
        } catch (err) { volta(res, tabela, 'Erro ao salvar: ' + err.message, 'danger'); }
    });

    app.post('/admin/t/:tabela/:id/excluir', exigeAdmin, async (req, res) => {
        const cfg = TABELAS[req.params.tabela]; if (!cfg) return res.status(404).end();
        const tabela = req.params.tabela;
        try {
            await pool.query(`DELETE FROM "${tabela}" WHERE "${cfg.pk}"=$1`, [req.params.id]);
            volta(res, tabela, 'Linha excluída.');
        } catch (err) {
            const m = err.code === '23503'
                ? 'Não dá para excluir: há registros que dependem desta linha.'
                : 'Erro ao excluir: ' + err.message;
            volta(res, tabela, m, 'danger');
        }
    });
}

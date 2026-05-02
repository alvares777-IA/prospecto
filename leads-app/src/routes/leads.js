const router = require('express').Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const { parse } = require('csv-parse/sync');
const { pool } = require('../db');
const { requireLogin, requirePerfil } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const STATUS_VALIDOS = ['novo', 'contactado', 'interessado', 'convertido', 'descartado', 'sem_interesse'];
const POR_PAGINA = 20;

function norm(str) {
    return str?.toString().toLowerCase().trim()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '_') || '';
}

function mapCol(obj, candidates) {
    for (const c of candidates) {
        const val = obj[norm(c)];
        if (val != null && val !== '') return val.toString().trim();
    }
    return null;
}

function normalizarTelefone(raw) {
    const digits = raw?.toString().replace(/\D/g, '') || '';
    if (digits.length === 9)  return '5511' + digits;
    if (digits.length === 11) return '55'   + digits;
    return digits;
}

async function maxCampanhaId() {
    const { rows } = await pool.query('SELECT MAX(id) AS max_id FROM campanhas');
    return rows[0].max_id || 1;
}

// ── Listagem ───────────────────────────────────────────────────
router.get('/', requireLogin, async (req, res) => {
    const { status, busca, pagina = 1 } = req.query;
    const p = [];
    const cond = [];

    if (status && STATUS_VALIDOS.includes(status)) {
        p.push(status); cond.push(`l.status = $${p.length}`);
    }
    if (busca && busca.trim()) {
        p.push(`%${busca.trim()}%`);
        const n = p.length;
        cond.push(`(l.nome ILIKE $${n} OR l.telefone ILIKE $${n} OR l.empresa ILIKE $${n})`);
    }

    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const offset = (Number(pagina) - 1) * POR_PAGINA;

    const [countRes, leadsRes] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS total FROM leads l ${where}`, p),
        pool.query(`SELECT l.*, c.descricao AS campanha_descricao FROM leads l LEFT JOIN campanhas c ON c.id = l.campanha_id ${where} ORDER BY l.criado_em DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, POR_PAGINA, offset])
    ]);

    const total = countRes.rows[0].total;
    res.render('leads/index', {
        title: 'Leads', page: 'leads-lista',
        leads: leadsRes.rows, status, busca,
        pagina: Number(pagina), totalPaginas: Math.ceil(total / POR_PAGINA), total, STATUS_VALIDOS
    });
});

// ── Upload ─────────────────────────────────────────────────────
router.get('/upload', requireLogin, requirePerfil('operador'), async (req, res) => {
    const { rows: campanhas } = await pool.query('SELECT id, descricao FROM campanhas ORDER BY id');
    const defaultCampanha = await maxCampanhaId();
    res.render('leads/upload', { title: 'Upload de Leads', page: 'leads-upload', resultado: null, erro: null, campanhas, defaultCampanha });
});

router.post('/upload', requireLogin, requirePerfil('operador'), upload.single('arquivo'), async (req, res) => {
    const { rows: campanhas } = await pool.query('SELECT id, descricao FROM campanhas ORDER BY id');
    const defaultCampanha = await maxCampanhaId();
    const render = (resultado, erro) =>
        res.render('leads/upload', { title: 'Upload de Leads', page: 'leads-upload', resultado, erro, campanhas, defaultCampanha });

    if (!req.file) return render(null, 'Nenhum arquivo enviado.');

    const campanhaFallback = parseInt(req.body.campanha_id) || defaultCampanha;

    try {
        const nome = req.file.originalname.toLowerCase();
        let registros = [];

        if (nome.endsWith('.csv')) {
            const texto = req.file.buffer.toString('utf-8');
            const raw = parse(texto, { columns: true, skip_empty_lines: true, trim: true });
            registros = raw.map(row => {
                const n = {};
                for (const k of Object.keys(row)) n[norm(k)] = row[k];
                return n;
            });
        } else if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(req.file.buffer);
            const ws = wb.worksheets[0];
            const headers = [];
            ws.getRow(1).eachCell(cell => headers.push(norm(cell.value?.toString() || '')));
            ws.eachRow((row, i) => {
                if (i === 1) return;
                const obj = {};
                row.eachCell((cell, j) => { if (headers[j - 1]) obj[headers[j - 1]] = cell.value?.toString().trim() || null; });
                registros.push(obj);
            });
        } else {
            return render(null, 'Formato inválido. Use .csv, .xlsx ou .xls.');
        }

        let inseridos = 0, duplicados = 0, erros = 0;
        for (const r of registros) {
            const telefone = mapCol(r, ['telefone', 'fone', 'celular', 'whatsapp', 'phone', 'tel']);
            if (!telefone) { erros++; continue; }
            const campanha_id = parseInt(mapCol(r, ['campanha_id', 'campanha'])) || campanhaFallback;
            try {
                const result = await pool.query(
                    `INSERT INTO leads (telefone, nome, empresa, cargo, email, status, origem, observacoes, campanha_id)
                     VALUES ($1,$2,$3,$4,$5,'novo',$6,$7,$8)
                     ON CONFLICT (telefone) DO NOTHING`,
                    [
                        normalizarTelefone(telefone),
                        mapCol(r, ['nome', 'name', 'contato', 'cliente']),
                        mapCol(r, ['empresa', 'company', 'razao_social']),
                        mapCol(r, ['cargo', 'funcao', 'title', 'role']),
                        mapCol(r, ['email', 'e-mail', 'mail']),
                        mapCol(r, ['origem', 'source', 'procedencia']) || 'upload',
                        mapCol(r, ['observacoes', 'obs', 'notes', 'nota']),
                        campanha_id
                    ]
                );
                if (result.rowCount > 0) inseridos++; else duplicados++;
            } catch { erros++; }
        }
        render({ total: registros.length, inseridos, duplicados, erros }, null);
    } catch (err) {
        console.error(err);
        render(null, 'Erro ao processar o arquivo.');
    }
});

// ── Novo ───────────────────────────────────────────────────────
router.get('/novo', requireLogin, requirePerfil('operador'), async (req, res) => {
    const [{ rows: campanhas }, defaultCampanha] = await Promise.all([
        pool.query('SELECT id, descricao FROM campanhas ORDER BY id'),
        maxCampanhaId()
    ]);
    res.render('leads/form', { title: 'Novo Lead', page: 'leads-novo', lead: null, STATUS_VALIDOS, erro: null, campanhas, defaultCampanha, historico: [] });
});

router.post('/novo', requireLogin, requirePerfil('operador'), async (req, res) => {
    const { telefone, nome, empresa, cargo, email, status, origem, observacoes, campanha_id } = req.body;
    try {
        await pool.query(
            `INSERT INTO leads (telefone, nome, empresa, cargo, email, status, origem, observacoes, campanha_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [normalizarTelefone(telefone), nome || null, empresa || null, cargo || null, email || null, status || 'novo', origem || null, observacoes || null, campanha_id]
        );
        req.session.flash = { sucesso: 'Lead cadastrado com sucesso.' };
        res.redirect('/leads');
    } catch (err) {
        const [{ rows: campanhas }, defaultCampanha] = await Promise.all([
            pool.query('SELECT id, descricao FROM campanhas ORDER BY id'),
            maxCampanhaId()
        ]);
        const erro = err.code === '23505' ? 'Este telefone já está cadastrado.' : 'Erro ao salvar.';
        res.render('leads/form', { title: 'Novo Lead', page: 'leads-novo', lead: req.body, STATUS_VALIDOS, erro, campanhas, defaultCampanha, historico: [] });
    }
});

// ── Editar ─────────────────────────────────────────────────────
router.get('/:id/editar', requireLogin, requirePerfil('operador'), async (req, res) => {
    const [leadRes, campRes, histRes] = await Promise.all([
        pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]),
        pool.query('SELECT id, descricao FROM campanhas ORDER BY id'),
        pool.query('SELECT status_lead, dt_status FROM leads_status WHERE id_lead = $1 ORDER BY dt_status ASC', [req.params.id])
    ]);
    if (!leadRes.rows[0]) return res.redirect('/leads');
    res.render('leads/form', { title: 'Editar Lead', page: 'leads-lista', lead: leadRes.rows[0], STATUS_VALIDOS, erro: null, campanhas: campRes.rows, defaultCampanha: null, historico: histRes.rows });
});

router.post('/:id/editar', requireLogin, requirePerfil('operador'), async (req, res) => {
    const { telefone, nome, empresa, cargo, email, status, origem, observacoes, campanha_id } = req.body;
    try {
        await pool.query(
            `UPDATE leads SET telefone=$1, nome=$2, empresa=$3, cargo=$4, email=$5, status=$6, origem=$7, observacoes=$8, campanha_id=$9 WHERE id=$10`,
            [normalizarTelefone(telefone), nome || null, empresa || null, cargo || null, email || null, status, origem || null, observacoes || null, campanha_id, req.params.id]
        );
        req.session.flash = { sucesso: 'Lead atualizado com sucesso.' };
        res.redirect('/leads');
    } catch (err) {
        const [leadRes, campRes, histRes] = await Promise.all([
            pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]),
            pool.query('SELECT id, descricao FROM campanhas ORDER BY id'),
            pool.query('SELECT status_lead, dt_status FROM leads_status WHERE id_lead = $1 ORDER BY dt_status ASC', [req.params.id])
        ]);
        const erro = err.code === '23505' ? 'Este telefone já está cadastrado.' : 'Erro ao salvar.';
        res.render('leads/form', { title: 'Editar Lead', page: 'leads-lista', lead: { ...leadRes.rows[0], ...req.body }, STATUS_VALIDOS, erro, campanhas: campRes.rows, defaultCampanha: null, historico: histRes.rows });
    }
});

// ── Excluir ────────────────────────────────────────────────────
router.post('/:id/excluir', requireLogin, requirePerfil('supervisor'), async (req, res) => {
    await pool.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    req.session.flash = { sucesso: 'Lead excluído.' };
    res.redirect('/leads');
});

module.exports = router;

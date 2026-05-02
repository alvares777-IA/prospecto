const swaggerUi = require('swagger-ui-express');

function basicAuth(req, res, next) {
    const user = process.env.SWAGGER_USER || 'admin';
    const pass = process.env.SWAGGER_PASS || 'swagger';
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="Swagger Docs", charset="UTF-8"');
        return res.status(401).send('Autenticação necessária.');
    }
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const colonIdx = decoded.indexOf(':');
    const u = decoded.slice(0, colonIdx);
    const p = decoded.slice(colonIdx + 1);
    if (u !== user || p !== pass) {
        res.set('WWW-Authenticate', 'Basic realm="Swagger Docs", charset="UTF-8"');
        return res.status(401).send('Credenciais inválidas.');
    }
    next();
}

const spec = {
    openapi: '3.0.0',
    info: {
        title: 'Prospecto-IA API',
        version: '1.0.0',
        description:
            'Documentação da API do sistema de gerenciamento de leads.\n\n' +
            'A maioria das rotas requer autenticação via sessão (cookie `connect.sid`). ' +
            'Use `POST /login` para autenticar.\n\n' +
            '**Perfis de acesso:**\n' +
            '- `operador` — CRUD de leads e upload\n' +
            '- `supervisor` — + campanhas e exclusão de leads\n' +
            '- `admin` — + gerenciamento de usuários',
    },
    servers: [
        { url: process.env.APP_URL || 'http://localhost:3003', description: 'Servidor' },
    ],
    components: {
        securitySchemes: {
            sessionCookie: {
                type: 'apiKey',
                in: 'cookie',
                name: 'connect.sid',
                description: 'Cookie de sessão obtido após login em POST /login',
            },
            basicAuth: {
                type: 'http',
                scheme: 'basic',
                description: 'HTTP Basic Auth — mesmas credenciais do Swagger (SWAGGER_USER / SWAGGER_PASS)',
            },
        },
        schemas: {
            Lead: {
                type: 'object',
                properties: {
                    id:                  { type: 'integer' },
                    telefone:            { type: 'string', example: '5511999999999' },
                    nome:                { type: 'string', example: 'João Silva' },
                    empresa:             { type: 'string', example: 'Empresa LTDA' },
                    cargo:               { type: 'string', example: 'Gerente' },
                    email:               { type: 'string', format: 'email' },
                    status:              { type: 'string', enum: ['novo','contactado','interessado','convertido','descartado','sem_interesse'] },
                    origem:              { type: 'string', example: 'upload' },
                    observacoes:         { type: 'string' },
                    campanha_id:         { type: 'integer' },
                    campanha_descricao:  { type: 'string' },
                    criado_em:           { type: 'string', format: 'date-time' },
                },
            },
            Campanha: {
                type: 'object',
                properties: {
                    id:       { type: 'integer' },
                    descricao:{ type: 'string', example: 'Campanha Maio 2025' },
                    texto:    { type: 'string', example: 'Olá {nome}, temos uma oferta especial!' },
                },
            },
            Usuario: {
                type: 'object',
                properties: {
                    id:     { type: 'integer' },
                    nome:   { type: 'string' },
                    email:  { type: 'string', format: 'email' },
                    perfil: { type: 'string', enum: ['admin','supervisor','operador'] },
                    ativo:  { type: 'boolean' },
                },
            },
            StatusCount: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['novo','contactado','interessado','convertido','descartado','sem_interesse'] },
                    total:  { type: 'integer' },
                },
            },
        },
    },
    security: [{ sessionCookie: [] }],
    tags: [
        { name: 'Auth',      description: 'Autenticação e controle de sessão' },
        { name: 'Dashboard', description: 'Estatísticas gerais' },
        { name: 'Leads',     description: 'Gerenciamento de leads (operador+)' },
        { name: 'Campanhas', description: 'Gerenciamento de campanhas (supervisor+)' },
        { name: 'Usuários',  description: 'Gerenciamento de usuários (admin)' },
        { name: 'Perfil',    description: 'Perfil do usuário logado' },
        { name: 'WhatsApp',  description: 'Integração WhatsApp via Evolution API' },
        { name: 'API JSON',  description: 'Endpoints que retornam JSON puro — autenticação via HTTP Basic Auth (SWAGGER_USER / SWAGGER_PASS)' },
    ],
    paths: {
        // ── Auth ────────────────────────────────────────────────────────────────
        '/login': {
            get: {
                tags: ['Auth'], summary: 'Página de login', security: [],
                responses: { '200': { description: 'HTML da página de login' } },
            },
            post: {
                tags: ['Auth'], summary: 'Autenticar usuário', security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['email','senha'],
                                properties: {
                                    email: { type: 'string', format: 'email' },
                                    senha: { type: 'string', format: 'password' },
                                },
                            },
                        },
                    },
                },
                responses: { '302': { description: 'Redireciona para /dashboard (sucesso) ou reexibe formulário (erro)' } },
            },
        },
        '/logout': {
            post: {
                tags: ['Auth'], summary: 'Encerrar sessão',
                responses: { '302': { description: 'Redireciona para /login' } },
            },
        },
        '/esqueci-senha': {
            get: {
                tags: ['Auth'], summary: 'Formulário de recuperação de senha', security: [],
                responses: { '200': { description: 'HTML do formulário' } },
            },
            post: {
                tags: ['Auth'], summary: 'Enviar e-mail de recuperação', security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['email'],
                                properties: { email: { type: 'string', format: 'email' } },
                            },
                        },
                    },
                },
                responses: { '200': { description: 'Sempre exibe mensagem genérica (não revela se e-mail existe)' } },
            },
        },
        '/redefinir-senha/{token}': {
            get: {
                tags: ['Auth'], summary: 'Formulário de redefinição de senha', security: [],
                parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { '200': { description: 'HTML do formulário se token válido, ou mensagem de erro' } },
            },
            post: {
                tags: ['Auth'], summary: 'Redefinir senha com token', security: [],
                parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['senha','confirmacao'],
                                properties: {
                                    senha:       { type: 'string', format: 'password', minLength: 6 },
                                    confirmacao: { type: 'string', format: 'password' },
                                },
                            },
                        },
                    },
                },
                responses: { '200': { description: 'Senha redefinida ou erro exibido' } },
            },
        },

        // ── Dashboard ────────────────────────────────────────────────────────────
        '/dashboard': {
            get: {
                tags: ['Dashboard'], summary: 'Página de dashboard com totais por status',
                responses: { '200': { description: 'HTML com totais de leads por status' } },
            },
        },
        '/dashboard/periodo': {
            get: {
                tags: ['Dashboard'], summary: 'Totais de leads por status em período — retorna JSON',
                parameters: [{
                    name: 'dias', in: 'query',
                    description: 'Número de dias anteriores (1–365, padrão: 30)',
                    schema: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
                }],
                responses: {
                    '200': {
                        description: 'Array de contagens por status',
                        content: {
                            'application/json': {
                                schema: { type: 'array', items: { $ref: '#/components/schemas/StatusCount' } },
                            },
                        },
                    },
                },
            },
        },

        // ── Leads ────────────────────────────────────────────────────────────────
        '/leads': {
            get: {
                tags: ['Leads'], summary: 'Listar leads com paginação e filtros',
                parameters: [
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['novo','contactado','interessado','convertido','descartado','sem_interesse'] } },
                    { name: 'busca',  in: 'query', schema: { type: 'string' }, description: 'Busca por nome, telefone ou empresa' },
                    { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
                ],
                responses: { '200': { description: 'HTML com lista paginada de leads (20 por página)' } },
            },
        },
        '/leads/upload': {
            get: {
                tags: ['Leads'], summary: 'Página de upload de leads (CSV/Excel)',
                responses: { '200': { description: 'HTML do formulário de upload' } },
            },
            post: {
                tags: ['Leads'], summary: 'Importar leads via CSV ou Excel (operador+)',
                description: 'Aceita .csv, .xlsx ou .xls (máx 10 MB). Colunas reconhecidas: telefone/fone/celular, nome, empresa, cargo, email, origem, observacoes, campanha_id.',
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object', required: ['arquivo'],
                                properties: {
                                    arquivo:     { type: 'string', format: 'binary' },
                                    campanha_id: { type: 'integer', description: 'Campanha padrão para leads sem campanha no arquivo' },
                                },
                            },
                        },
                    },
                },
                responses: { '200': { description: 'HTML com resultado: inseridos, duplicados, erros' } },
            },
        },
        '/leads/novo': {
            get: {
                tags: ['Leads'], summary: 'Formulário de novo lead (operador+)',
                responses: { '200': { description: 'HTML do formulário' } },
            },
            post: {
                tags: ['Leads'], summary: 'Criar novo lead (operador+)',
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['telefone'],
                                properties: {
                                    telefone:    { type: 'string', example: '11999999999' },
                                    nome:        { type: 'string' },
                                    empresa:     { type: 'string' },
                                    cargo:       { type: 'string' },
                                    email:       { type: 'string', format: 'email' },
                                    status:      { type: 'string', enum: ['novo','contactado','interessado','convertido','descartado','sem_interesse'], default: 'novo' },
                                    origem:      { type: 'string' },
                                    observacoes: { type: 'string' },
                                    campanha_id: { type: 'integer' },
                                },
                            },
                        },
                    },
                },
                responses: { '302': { description: 'Redireciona para /leads em caso de sucesso' } },
            },
        },
        '/leads/{id}/editar': {
            get: {
                tags: ['Leads'], summary: 'Formulário de edição de lead (operador+)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { '200': { description: 'HTML do formulário preenchido com histórico de status' } },
            },
            post: {
                tags: ['Leads'], summary: 'Atualizar lead (operador+)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['telefone'],
                                properties: {
                                    telefone:    { type: 'string' },
                                    nome:        { type: 'string' },
                                    empresa:     { type: 'string' },
                                    cargo:       { type: 'string' },
                                    email:       { type: 'string', format: 'email' },
                                    status:      { type: 'string', enum: ['novo','contactado','interessado','convertido','descartado','sem_interesse'] },
                                    origem:      { type: 'string' },
                                    observacoes: { type: 'string' },
                                    campanha_id: { type: 'integer' },
                                },
                            },
                        },
                    },
                },
                responses: { '302': { description: 'Redireciona para /leads em caso de sucesso' } },
            },
        },
        '/leads/{id}/excluir': {
            post: {
                tags: ['Leads'], summary: 'Excluir lead (supervisor+)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { '302': { description: 'Redireciona para /leads' } },
            },
        },

        // ── Campanhas ────────────────────────────────────────────────────────────
        '/campanhas': {
            get: {
                tags: ['Campanhas'], summary: 'Listar campanhas (supervisor+)',
                responses: { '200': { description: 'HTML com lista de campanhas' } },
            },
        },
        '/campanhas/nova': {
            get: {
                tags: ['Campanhas'], summary: 'Formulário de nova campanha (supervisor+)',
                responses: { '200': { description: 'HTML do formulário' } },
            },
            post: {
                tags: ['Campanhas'], summary: 'Criar campanha (supervisor+)',
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['descricao','texto'],
                                properties: {
                                    descricao: { type: 'string', example: 'Campanha Maio 2025' },
                                    texto:     { type: 'string', description: 'Texto WhatsApp. Use {nome} para personalizar.', example: 'Olá {nome}, temos uma oferta!' },
                                },
                            },
                        },
                    },
                },
                responses: { '302': { description: 'Redireciona para /campanhas' } },
            },
        },
        '/campanhas/{id}/editar': {
            get: {
                tags: ['Campanhas'], summary: 'Formulário de edição de campanha (supervisor+)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { '200': { description: 'HTML do formulário' } },
            },
            post: {
                tags: ['Campanhas'], summary: 'Atualizar campanha (supervisor+)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['descricao','texto'],
                                properties: {
                                    descricao: { type: 'string' },
                                    texto:     { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: { '302': { description: 'Redireciona para /campanhas' } },
            },
        },
        '/campanhas/{id}/excluir': {
            post: {
                tags: ['Campanhas'], summary: 'Excluir campanha (admin). Falha se houver leads vinculados.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { '302': { description: 'Redireciona para /campanhas' } },
            },
        },

        // ── Usuários ────────────────────────────────────────────────────────────
        '/usuarios': {
            get: {
                tags: ['Usuários'], summary: 'Listar usuários (admin)',
                responses: { '200': { description: 'HTML com lista de usuários' } },
            },
        },
        '/usuarios/novo': {
            get: {
                tags: ['Usuários'], summary: 'Formulário de novo usuário (admin)',
                responses: { '200': { description: 'HTML do formulário' } },
            },
            post: {
                tags: ['Usuários'], summary: 'Criar usuário (admin)',
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['nome','email','senha','perfil'],
                                properties: {
                                    nome:   { type: 'string' },
                                    email:  { type: 'string', format: 'email' },
                                    senha:  { type: 'string', format: 'password', minLength: 6 },
                                    perfil: { type: 'string', enum: ['admin','supervisor','operador'] },
                                },
                            },
                        },
                    },
                },
                responses: { '302': { description: 'Redireciona para /usuarios' } },
            },
        },
        '/usuarios/{id}/editar': {
            get: {
                tags: ['Usuários'], summary: 'Formulário de edição de usuário (admin)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { '200': { description: 'HTML do formulário' } },
            },
            post: {
                tags: ['Usuários'], summary: 'Atualizar usuário (admin)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['nome','email','perfil'],
                                properties: {
                                    nome:   { type: 'string' },
                                    email:  { type: 'string', format: 'email' },
                                    senha:  { type: 'string', format: 'password', description: 'Deixar em branco para manter a senha atual' },
                                    perfil: { type: 'string', enum: ['admin','supervisor','operador'] },
                                    ativo:  { type: 'string', enum: ['true','false'] },
                                },
                            },
                        },
                    },
                },
                responses: { '302': { description: 'Redireciona para /usuarios' } },
            },
        },
        '/usuarios/{id}/excluir': {
            post: {
                tags: ['Usuários'], summary: 'Excluir usuário (admin). Não pode excluir a si mesmo nem o único admin.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: { '302': { description: 'Redireciona para /usuarios' } },
            },
        },

        // ── Perfil ───────────────────────────────────────────────────────────────
        '/perfil': {
            get: {
                tags: ['Perfil'], summary: 'Página do perfil do usuário logado',
                responses: { '200': { description: 'HTML da página de perfil' } },
            },
        },
        '/perfil/nome': {
            post: {
                tags: ['Perfil'], summary: 'Atualizar nome do usuário',
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['nome'],
                                properties: { nome: { type: 'string' } },
                            },
                        },
                    },
                },
                responses: { '200': { description: 'HTML do perfil com mensagem de sucesso ou erro' } },
            },
        },
        '/perfil/senha': {
            post: {
                tags: ['Perfil'], summary: 'Alterar senha (requer conta com senha local)',
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['senha_atual','senha_nova','senha_confirmacao'],
                                properties: {
                                    senha_atual:       { type: 'string', format: 'password' },
                                    senha_nova:        { type: 'string', format: 'password', minLength: 8 },
                                    senha_confirmacao: { type: 'string', format: 'password' },
                                },
                            },
                        },
                    },
                },
                responses: { '200': { description: 'HTML do perfil com mensagem de sucesso ou erro' } },
            },
        },
        '/perfil/avatar': {
            post: {
                tags: ['Perfil'], summary: 'Atualizar foto de perfil (max 2 MB — JPEG/PNG/GIF/WebP)',
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object', required: ['avatar'],
                                properties: { avatar: { type: 'string', format: 'binary' } },
                            },
                        },
                    },
                },
                responses: { '200': { description: 'HTML do perfil com mensagem de sucesso ou erro' } },
            },
        },
        '/perfil/avatar/remover': {
            post: {
                tags: ['Perfil'], summary: 'Remover foto de perfil',
                responses: { '302': { description: 'Redireciona para /perfil' } },
            },
        },
        '/perfil/desvincular-google': {
            post: {
                tags: ['Perfil'], summary: 'Desvincular login Google e definir senha local',
                requestBody: {
                    required: true,
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object', required: ['senha_nova','senha_confirmacao'],
                                properties: {
                                    senha_nova:        { type: 'string', format: 'password', minLength: 8 },
                                    senha_confirmacao: { type: 'string', format: 'password' },
                                },
                            },
                        },
                    },
                },
                responses: { '200': { description: 'HTML do perfil com mensagem de sucesso ou erro' } },
            },
        },

        // ── WhatsApp ────────────────────────────────────────────────────────────
        '/whatsapp': {
            get: {
                tags: ['WhatsApp'], summary: 'Status da conexão WhatsApp',
                responses: { '200': { description: 'HTML com status da instância Evolution API' } },
            },
        },
        '/whatsapp/qrcode': {
            get: {
                tags: ['WhatsApp'], summary: 'QR Code para conectar WhatsApp',
                responses: { '200': { description: 'HTML com QR Code para autenticação' } },
            },
        },
        '/whatsapp/desconectar': {
            post: {
                tags: ['WhatsApp'], summary: 'Desconectar instância WhatsApp',
                responses: { '302': { description: 'Redireciona para /whatsapp' } },
            },
        },

        // ── API JSON ─────────────────────────────────────────────────────────────
        '/api/leads': {
            get: {
                tags: ['API JSON'], summary: 'Listar leads (JSON)',
                security: [{ basicAuth: [] }],
                parameters: [
                    { name: 'status',      in: 'query', schema: { type: 'string', enum: ['novo','contactado','interessado','convertido','descartado','sem_interesse'] } },
                    { name: 'busca',       in: 'query', schema: { type: 'string' }, description: 'Busca por nome, telefone ou empresa' },
                    { name: 'campanha_id', in: 'query', schema: { type: 'integer' } },
                    { name: 'pagina',      in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'por_pagina',  in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
                ],
                responses: {
                    '200': {
                        description: 'Lista paginada de leads',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        total:     { type: 'integer' },
                                        pagina:    { type: 'integer' },
                                        por_pagina:{ type: 'integer' },
                                        dados:     { type: 'array', items: { $ref: '#/components/schemas/Lead' } },
                                    },
                                },
                            },
                        },
                    },
                    '401': { description: 'Credenciais inválidas' },
                },
            },
        },
        '/api/leads/{id}': {
            get: {
                tags: ['API JSON'], summary: 'Buscar lead por ID com histórico de status (JSON)',
                security: [{ basicAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: {
                    '200': {
                        description: 'Dados do lead com historico_status',
                        content: {
                            'application/json': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/Lead' },
                                        {
                                            type: 'object',
                                            properties: {
                                                historico_status: {
                                                    type: 'array',
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            status_lead: { type: 'string' },
                                                            dt_status:   { type: 'string', format: 'date-time' },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    '404': { description: 'Lead não encontrado' },
                    '401': { description: 'Credenciais inválidas' },
                },
            },
        },
        '/api/campanhas': {
            get: {
                tags: ['API JSON'], summary: 'Listar campanhas com total de leads (JSON)',
                security: [{ basicAuth: [] }],
                responses: {
                    '200': {
                        description: 'Lista de campanhas',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        total: { type: 'integer' },
                                        dados: {
                                            type: 'array',
                                            items: {
                                                allOf: [
                                                    { $ref: '#/components/schemas/Campanha' },
                                                    { type: 'object', properties: { total_leads: { type: 'integer' }, criado_em: { type: 'string', format: 'date-time' } } },
                                                ],
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '401': { description: 'Credenciais inválidas' },
                },
            },
        },
        '/api/campanhas/{id}': {
            get: {
                tags: ['API JSON'], summary: 'Buscar campanha por ID (JSON)',
                security: [{ basicAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: {
                    '200': {
                        description: 'Dados da campanha',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Campanha' } } },
                    },
                    '404': { description: 'Campanha não encontrada' },
                    '401': { description: 'Credenciais inválidas' },
                },
            },
        },
        '/api/usuarios': {
            get: {
                tags: ['API JSON'], summary: 'Listar usuários (JSON)',
                security: [{ basicAuth: [] }],
                responses: {
                    '200': {
                        description: 'Lista de usuários (sem senha)',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        total: { type: 'integer' },
                                        dados: { type: 'array', items: { $ref: '#/components/schemas/Usuario' } },
                                    },
                                },
                            },
                        },
                    },
                    '401': { description: 'Credenciais inválidas' },
                },
            },
        },
        '/api/usuarios/{id}': {
            get: {
                tags: ['API JSON'], summary: 'Buscar usuário por ID (JSON)',
                security: [{ basicAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                responses: {
                    '200': {
                        description: 'Dados do usuário (sem senha)',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Usuario' } } },
                    },
                    '404': { description: 'Usuário não encontrado' },
                    '401': { description: 'Credenciais inválidas' },
                },
            },
        },
        '/api/leads-status': {
            get: {
                tags: ['API JSON'], summary: 'Histórico de mudanças de status dos leads (JSON)',
                security: [{ basicAuth: [] }],
                parameters: [
                    { name: 'lead_id', in: 'query', schema: { type: 'integer' }, description: 'Filtrar pelo ID do lead' },
                    { name: 'pagina',  in: 'query', schema: { type: 'integer', default: 1 } },
                ],
                responses: {
                    '200': {
                        description: 'Histórico paginado de status',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        total:     { type: 'integer' },
                                        pagina:    { type: 'integer' },
                                        por_pagina:{ type: 'integer' },
                                        dados: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id:             { type: 'integer' },
                                                    id_lead:        { type: 'integer' },
                                                    status_lead:    { type: 'string' },
                                                    dt_status:      { type: 'string', format: 'date-time' },
                                                    lead_nome:      { type: 'string' },
                                                    lead_telefone:  { type: 'string' },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '401': { description: 'Credenciais inválidas' },
                },
            },
        },
    },
};

module.exports = { basicAuth, spec, swaggerUi };

// Cria o primeiro usuário administrador.
// Uso: docker compose exec leads-app node scripts/criar-admin.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const email = 'admin@prospect.local';
    const senha = 'Mudar@2026';
    const hash = await bcrypt.hash(senha, 12);

    try {
        const { rowCount } = await pool.query(
            `INSERT INTO usuarios (nome, email, senha_hash, perfil)
             VALUES ('Administrador', $1, $2, 'admin')
             ON CONFLICT (email) DO NOTHING`,
            [email, hash]
        );
        if (rowCount > 0) {
            console.log('\n✓ Admin criado com sucesso!\n');
            console.log(`  E-mail : ${email}`);
            console.log(`  Senha  : ${senha}`);
            console.log('\n  ALTERE A SENHA APÓS O PRIMEIRO LOGIN!\n');
        } else {
            console.log('Admin já existe — nenhuma alteração feita.');
        }
    } finally {
        await pool.end();
    }
}

main().catch(err => { console.error(err.message); process.exit(1); });

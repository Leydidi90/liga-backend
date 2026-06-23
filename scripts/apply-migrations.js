/**
 * Aplica migraciones SQL al proyecto Supabase configurado en .env
 * Uso: node scripts/apply-migrations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('kpfhypfeirjhpfffyzwn')) {
    return process.env.DATABASE_URL;
  }
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error('SUPABASE_URL inválida en .env');
  const ref = match[1];
  const password = process.env.PGPASSWORD || process.env.SUPABASE_DB_PASSWORD;
  if (!password) throw new Error('Falta PGPASSWORD o SUPABASE_DB_PASSWORD en .env');
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres?sslmode=require`;
}

async function main() {
  const migrationsDir = path.join(__dirname, '../db/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = new Client({
    connectionString: getDatabaseUrl(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Conectado a Supabase PostgreSQL');

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Aplicando ${file}...`);
    await client.query(sql);
    console.log(`  OK`);
  }

  await client.end();
  console.log('Migraciones aplicadas.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

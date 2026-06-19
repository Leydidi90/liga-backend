/**
 * Sincroniza datos de db/local-tenants.json y db/local-league-data.json hacia Supabase.
 * Requiere: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y tablas creadas (migraciones 001 + 002).
 * Uso: node scripts/sync-local-to-supabase.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const supabase = require('../supabaseClient');

const TENANTS_PATH = path.join(__dirname, '../db/local-tenants.json');
const LEAGUE_PATH = path.join(__dirname, '../db/local-league-data.json');

const TYPE_TO_TABLE = {
  equipos: 'equipo',
  partidos: 'partido',
  torneos: 'torneo',
  arbitros: 'arbitro',
  canchas: 'cancha',
  representantes: 'representante',
  inscripciones: 'inscripcion',
  multas: 'multa'
};

const INSERT_ORDER = [
  'equipos',
  'torneos',
  'arbitros',
  'canchas',
  'representantes',
  'inscripciones',
  'partidos',
  'multas'
];

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stripHeavyPhotos(item, type) {
  if (type !== 'inscripciones' || !Array.isArray(item.jugadores)) return item;
  return {
    ...item,
    jugadores: item.jugadores.map((j) => {
      const foto = String(j.foto_jugador || '');
      if (foto.length > 2000) return { ...j, foto_jugador: '' };
      return j;
    })
  };
}

async function upsertBatch(table, rows) {
  if (!rows.length) return;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`  ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en back/.env');
  }

  const tenantsData = readJson(TENANTS_PATH, { tenants: [] });
  const leagueData = readJson(LEAGUE_PATH, {});

  console.log(`Sincronizando ${tenantsData.tenants.length} ligas...`);

  await upsertBatch('tenant', tenantsData.tenants);

  for (const type of INSERT_ORDER) {
    const table = TYPE_TO_TABLE[type];
    const rows = (leagueData[type] || []).map((row) => stripHeavyPhotos(row, type));
    console.log(`Subiendo ${rows.length} registros a ${table}...`);
    await upsertBatch(table, rows);
  }

  console.log('Sincronización completada.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

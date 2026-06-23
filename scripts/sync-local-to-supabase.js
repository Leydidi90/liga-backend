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

const TABLE_COLUMNS = {
  tenant: [
    'id', 'nombre_liga', 'subdominio_o_slug', 'fecha_registro', 'estatus_pago',
    'plan', 'fecha_vencimiento', 'dueno_nombre', 'dueno_email', 'password'
  ],
  equipo: [
    'id', 'tenant_id', 'nombre', 'delegado', 'escudo', 'puntos', 'partidos_jugados',
    'partidos_ganados', 'partidos_empatados', 'partidos_perdidos', 'goles_favor', 'goles_contra'
  ],
  torneo: [
    'id', 'tenant_id', 'nombre', 'categoria', 'formato', 'fecha_inicio', 'fecha_fin',
    'estatus', 'premio', 'cobros'
  ],
  arbitro: ['id', 'tenant_id', 'nombre', 'rol', 'matricula', 'categoria', 'equipo_id'],
  cancha: [
    'id', 'tenant_id', 'nombre', 'direccion', 'tipo_superficie', 'capacidad', 'notas', 'activa', 'fecha_registro'
  ],
  representante: [
    'id', 'tenant_id', 'nombre_representante', 'email', 'password', 'equipo_principal', 'fecha_registro'
  ],
  inscripcion: [
    'id', 'tenant_id', 'torneo_id', 'representante_id', 'nombre_equipo', 'uniforme', 'jugadores',
    'desglose_cobro', 'total_cobro', 'pago', 'estatus_pago', 'fecha_registro'
  ],
  partido: [
    'id', 'tenant_id', 'jornada', 'fase', 'equipo_local_id', 'equipo_visitante_id', 'goles_local',
    'goles_visitante', 'estatus', 'stats', 'sede', 'horario', 'arbitro_id'
  ],
  multa: [
    'id', 'tenant_id', 'tipo', 'equipo_nombre', 'jugador_nombre', 'motivo', 'monto', 'jornada',
    'arbitro_id', 'arbitro_nombre', 'estatus', 'fecha'
  ]
};

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

function pickColumns(table, item) {
  const allowed = TABLE_COLUMNS[table];
  if (!allowed) return item;
  const row = {};
  allowed.forEach((key) => {
    if (item[key] !== undefined) row[key] = item[key];
  });
  if (table === 'inscripcion') {
    if (row.uniforme == null) row.uniforme = {};
    if (row.jugadores == null) row.jugadores = [];
    if (row.desglose_cobro == null) row.desglose_cobro = {};
    if (row.pago == null) row.pago = {};
    if (row.total_cobro == null) row.total_cobro = 0;
  }
  if (table === 'torneo' && row.cobros == null) row.cobros = { costo_total: 0 };
  return row;
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

  await upsertBatch('tenant', tenantsData.tenants.map((t) => pickColumns('tenant', t)));

  for (const type of INSERT_ORDER) {
    const table = TYPE_TO_TABLE[type];
    const rows = (leagueData[type] || [])
      .map((row) => stripHeavyPhotos(row, type))
      .map((row) => pickColumns(table, row));
    console.log(`Subiendo ${rows.length} registros a ${table}...`);
    await upsertBatch(table, rows);
  }

  console.log('Sincronización completada.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

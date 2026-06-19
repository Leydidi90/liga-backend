/**
 * Seed: Eliminatoria Santa Ana — eliminación directa, 8 equipos × 20 jugadores.
 * Mitad del torneo: cuartos jugados; semifinales y final pendientes.
 * Contraseñas: admin (organizador y representantes).
 * Uso: node scripts/seed-eliminatoria-santa-ana.js
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const TENANTS_PATH = path.join(__dirname, '../db/local-tenants.json');
const LEAGUE_PATH = path.join(__dirname, '../db/local-league-data.json');

const SLUG = 'eliminatoria-santa-ana';
const NOMBRE_LIGA = 'Eliminatoria Santa Ana';
const PASSWORD = 'admin';
const EMAIL_DOMAIN = 'eliminatoria-santa-ana.test';

const EQUIPOS = [
  'Guerreros de Santa Ana',
  'Los Portales FC',
  'Rayo del Atardecer',
  'Halcones del Centro',
  'La Congregación United',
  'Truenos Rojos',
  'Atlético La Plaza',
  'Gallos del Pueblo'
];

const NOMBRES = [
  'Juan', 'José', 'Luis', 'Carlos', 'Miguel', 'Francisco', 'Jesús', 'Antonio', 'Pedro', 'Alejandro',
  'Manuel', 'Roberto', 'Fernando', 'Ricardo', 'Eduardo', 'Sergio', 'Raúl', 'Arturo', 'Enrique', 'Jorge',
  'Alberto', 'Héctor', 'Óscar', 'Rafael', 'Mario', 'Guillermo', 'Salvador', 'Víctor', 'Martín', 'Iván',
  'Gerardo', 'Rubén', 'Hugo', 'Alonso', 'Emilio', 'César', 'Armando', 'Esteban', 'Adrián', 'Gael',
  'Mateo', 'Santiago', 'Sebastián', 'Leonardo', 'Diego', 'Daniel', 'Andrés', 'David', 'Javier', 'Marco',
  'Rodrigo', 'Pablo', 'Felipe', 'Isaac', 'Joel', 'Axel', 'Bryan', 'Kevin', 'Jonathan', 'Emmanuel',
  'Cristian', 'Brandon', 'Alan', 'Josué', 'Saúl', 'Efraín', 'Ulises', 'Mauricio', 'Ramón', 'Ignacio',
  'Nicolás', 'Benjamín', 'Maximiliano', 'Erick', 'Omar', 'Julio', 'Ángel', 'Ismael', 'Rogelio', 'Fabián',
  'Edgar', 'Reynaldo', 'Homero', 'Neftalí', 'Tadeo', 'Horacio', 'Rodolfo', 'Vicente', 'Agustín', 'Camilo',
  'Dante', 'Elías', 'Hiram', 'Iker', 'Jairo', 'Noé', 'Patricio', 'Uriel', 'Yael', 'Zacarías'
];

const APELLIDOS_P = [
  'Ramírez', 'García', 'López', 'Martínez', 'Hernández', 'Torres', 'Flores', 'Vargas', 'Mendoza', 'Castro',
  'Ruiz', 'Morales', 'Silva', 'Rojas', 'Navarro', 'Cruz', 'Ortega', 'Delgado', 'Pineda', 'Soto',
  'Vega', 'Reyes', 'Campos', 'Aguilar', 'Medina', 'Guerrero', 'Ibarra', 'Salinas', 'Ponce', 'Valdez',
  'Núñez', 'Carrillo', 'Zamora', 'Mejía', 'Ríos', 'Fuentes', 'Acosta', 'Bravo', 'Cortés', 'Luna'
];

const APELLIDOS_M = [
  'Gutiérrez', 'Jiménez', 'Romero', 'Herrera', 'Juárez', 'Álvarez', 'Castillo', 'Ramos', 'Vázquez', 'Méndez',
  'Castañeda', 'Orozco', 'Trejo', 'Solís', 'Rivas', 'Cervantes', 'Domínguez', 'Franco', 'León', 'Miranda',
  'Padilla', 'Quintana', 'Rosales', 'Serrano', 'Tapia', 'Uribe', 'Villalobos', 'Zárate', 'Arriaga', 'Blanco',
  'Cabrera', 'Durán', 'Escobar', 'Figueroa', 'Gil', 'Huerta', 'Ibáñez', 'Lara', 'Mora', 'Nieto'
];

const CANCHAS = [
  { nombre: 'Cancha Municipal Santa Ana', direccion: 'Centro, Santa Ana', tipo_superficie: 'Sintética', capacidad: 700 },
  { nombre: 'Unidad Deportiva Los Portales', direccion: 'Col. Portales, Santa Ana', tipo_superficie: 'Sintética', capacidad: 1100 },
  { nombre: 'Campo La Congregación', direccion: 'Barrio La Congregación', tipo_superficie: 'Natural', capacidad: 500 }
];

const ARBITROS = [
  { nombre: 'Antonio Ríos Vega', rol: 'Central', matricula: 'SAN-1001', categoria: 'Libre' },
  { nombre: 'Miguel Castro Luna', rol: 'Central', matricula: 'SAN-1002', categoria: 'Libre' },
  { nombre: 'Rafael Ortega Gil', rol: 'Asistente 1', matricula: 'SAN-2001', categoria: 'Libre' },
  { nombre: 'Daniel Paredes Soto', rol: 'Cuarto Árbitro', matricula: 'SAN-3001', categoria: 'Libre' }
];

const DOMINGOS = [
  '2026-06-01', // Cuartos
  '2026-06-08', // Semifinales (pendiente)
  '2026-06-15'  // Final (pendiente)
];

const HORARIOS_DOMINGO = ['10:00', '12:00', '14:00', '16:00'];

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function buildCurp(globalIdx) {
  return `SANA${String(globalIdx).padStart(6, '0')}HMSANX${globalIdx % 10}`;
}

function buildJugadores(teamIdx) {
  const jugadores = [];
  for (let p = 0; p < 20; p += 1) {
    const globalIdx = teamIdx * 20 + p;
    jugadores.push({
      nombre: NOMBRES[(teamIdx * 13 + p * 7) % NOMBRES.length],
      apellido_paterno: APELLIDOS_P[(teamIdx * 5 + p * 3) % APELLIDOS_P.length],
      apellido_materno: APELLIDOS_M[(teamIdx * 9 + p * 11) % APELLIDOS_M.length],
      numero_playera: p + 1,
      curp: buildCurp(globalIdx),
      rol_liderazgo: p === 0 ? 'Capitán' : p === 1 ? 'Subcapitán' : 'Ninguno',
      foto_jugador: ''
    });
  }
  return jugadores;
}

function formatDomingo(fechaISO, hora) {
  const [y, m, d] = fechaISO.split('-');
  return `Dom ${d}/${m}/${y} · ${hora}`;
}

function buildMatchStats(seed, golesLocal, golesVisitante) {
  const posesionLocal = 43 + (seed % 15);
  return {
    faltas: { local: 8 + (seed % 6), vis: 7 + ((seed + 2) % 7) },
    amarillas: { local: seed % 3, vis: (seed + 1) % 4 },
    rojas: { local: 0, vis: seed % 12 === 0 ? 1 : 0 },
    corners: { local: 3 + (seed % 5), vis: 2 + ((seed + 1) % 6) },
    remates: { local: 9 + golesLocal * 3, vis: 8 + golesVisitante * 3 },
    remates_arco: { local: 4 + golesLocal * 2, vis: 3 + golesVisitante * 2 },
    posesion: { local: posesionLocal, vis: 100 - posesionLocal }
  };
}

function buildEliminationResult(seed) {
  let golesLocal = (seed * 5 + 2) % 4 + 1;
  let golesVisitante = (seed * 9 + 1) % 3;
  if (golesLocal === golesVisitante) golesLocal += 1;
  return {
    goles_local: golesLocal,
    goles_visitante: golesVisitante,
    stats: buildMatchStats(seed, golesLocal, golesVisitante)
  };
}

function getWinner(partido) {
  return partido.goles_local > partido.goles_visitante
    ? partido.equipo_local_id
    : partido.equipo_visitante_id;
}

function applyStandings(equipos, partidos) {
  const byId = new Map(equipos.map((e) => [e.id, e]));
  partidos.forEach((p) => {
    if (p.estatus !== 'Finalizado') return;
    const local = byId.get(p.equipo_local_id);
    const visit = byId.get(p.equipo_visitante_id);
    if (!local || !visit) return;
    const gl = p.goles_local;
    const gv = p.goles_visitante;
    local.partidos_jugados += 1;
    visit.partidos_jugados += 1;
    local.goles_favor += gl;
    local.goles_contra += gv;
    visit.goles_favor += gv;
    visit.goles_contra += gl;
    if (gl > gv) {
      local.partidos_ganados += 1;
      local.puntos += 3;
      visit.partidos_perdidos += 1;
    } else {
      visit.partidos_ganados += 1;
      visit.puntos += 3;
      local.partidos_perdidos += 1;
    }
  });
}

function buildBracketPartido({
  tenantId, jornada, fase, localId, visitId, cancha, arbitroId,
  fechaDomingo, horario, seed, jugado
}) {
  const resultado = jugado ? buildEliminationResult(seed) : { goles_local: 0, goles_visitante: 0, stats: null };
  return {
    id: uuidv4(),
    tenant_id: tenantId,
    jornada,
    fase,
    equipo_local_id: localId,
    equipo_visitante_id: visitId,
    goles_local: resultado.goles_local,
    goles_visitante: resultado.goles_visitante,
    estatus: jugado ? 'Finalizado' : 'Pendiente',
    stats: resultado.stats,
    sede: cancha,
    horario: formatDomingo(fechaDomingo, horario),
    arbitro_id: arbitroId
  };
}

async function main() {
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);
  const tenantsData = readJson(TENANTS_PATH, { tenants: [] });
  let tenant = tenantsData.tenants.find((t) => t.subdominio_o_slug === SLUG);

  if (!tenant) {
    tenant = {
      id: uuidv4(),
      nombre_liga: NOMBRE_LIGA,
      subdominio_o_slug: SLUG,
      fecha_registro: new Date().toISOString(),
      estatus_pago: true,
      plan: 'Oro',
      fecha_vencimiento: new Date('2027-06-19').toISOString(),
      dueno_nombre: 'Organizador Santa Ana',
      dueno_email: `organizador@${EMAIL_DOMAIN}`,
      password: hashedPassword
    };
    tenantsData.tenants.push(tenant);
    writeJson(TENANTS_PATH, tenantsData);
    console.log(`Tenant creado: ${NOMBRE_LIGA} (slug: ${SLUG})`);
  } else {
    tenant.password = hashedPassword;
    tenant.dueno_email = `organizador@${EMAIL_DOMAIN}`;
    writeJson(TENANTS_PATH, tenantsData);
    console.log(`Liga "${NOMBRE_LIGA}" ya existe. Actualizando datos...`);
  }

  const tenantId = tenant.id;
  const leagueData = readJson(LEAGUE_PATH, {
    equipos: [], partidos: [], torneos: [], arbitros: [], canchas: [],
    representantes: [], inscripciones: [], multas: []
  });

  ['equipos', 'partidos', 'torneos', 'arbitros', 'canchas', 'representantes', 'inscripciones', 'multas'].forEach((key) => {
    leagueData[key] = (leagueData[key] || []).filter((item) => item.tenant_id !== tenantId);
  });

  const now = new Date().toISOString();
  const torneoId = uuidv4();

  leagueData.torneos.push({
    id: torneoId,
    tenant_id: tenantId,
    nombre: 'Eliminatoria Santa Ana 2026',
    categoria: 'Libre Varonil',
    formato: 'Eliminación Directa',
    fecha_inicio: '2026-06-01',
    fecha_fin: '2026-06-15',
    estatus: 'Activo',
    premio: 'Copa Santa Ana',
    cobros: { costo_total: 0 }
  });

  const canchasCreadas = CANCHAS.map((c) => ({
    id: uuidv4(),
    tenant_id: tenantId,
    nombre: c.nombre,
    direccion: c.direccion,
    tipo_superficie: c.tipo_superficie,
    capacidad: c.capacidad,
    notas: 'Partidos los domingos',
    activa: true,
    fecha_registro: now
  }));
  leagueData.canchas.push(...canchasCreadas);

  const arbitrosCreados = ARBITROS.map((a) => ({
    id: uuidv4(),
    tenant_id: tenantId,
    nombre: a.nombre,
    rol: a.rol,
    matricula: a.matricula,
    categoria: a.categoria,
    disponibilidad: true
  }));
  leagueData.arbitros.push(...arbitrosCreados);
  const centrales = arbitrosCreados.filter((a) => a.rol === 'Central');

  const equiposCreados = [];
  EQUIPOS.forEach((nombreEquipo, teamIdx) => {
    const equipoId = uuidv4();
    const repId = uuidv4();
    const slugRep = nombreEquipo.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);

    const equipo = {
      id: equipoId,
      tenant_id: tenantId,
      nombre: nombreEquipo,
      delegado: `Rep. ${nombreEquipo}`,
      escudo: '',
      puntos: 0,
      partidos_jugados: 0,
      partidos_ganados: 0,
      partidos_empatados: 0,
      partidos_perdidos: 0,
      goles_favor: 0,
      goles_contra: 0
    };
    leagueData.equipos.push(equipo);
    equiposCreados.push(equipo);

    leagueData.representantes.push({
      id: repId,
      tenant_id: tenantId,
      nombre_representante: `Representante ${nombreEquipo}`,
      email: `rep.${slugRep}${teamIdx}@${EMAIL_DOMAIN}`,
      password: hashedPassword,
      equipo_principal: nombreEquipo,
      fecha_registro: now
    });

    leagueData.inscripciones.push({
      id: uuidv4(),
      tenant_id: tenantId,
      torneo_id: torneoId,
      representante_id: repId,
      nombre_equipo: nombreEquipo,
      uniforme: {
        color_playera: ['rojo', 'azul', 'verde', 'amarillo', 'naranja', 'morado', 'blanco', 'negro'][teamIdx],
        color_short: 'negro',
        color_medias: 'blanco'
      },
      jugadores: buildJugadores(teamIdx),
      desglose_cobro: { costo_total: 0, total_jugadores: 20 },
      total_cobro: 0,
      pago: { metodo: 'Efectivo', estado: 'Aprobado (seed)', referencia: `SEED-SAN-${teamIdx + 1}` },
      estatus_pago: 'Pagado',
      fecha_registro: now
    });
  });

  const teamIds = equiposCreados.map((e) => e.id);
  const partidos = [];
  let matchSeed = 1;

  // Cuartos de final (4 partidos, jugados — mitad del torneo de 7)
  const cuartosPairs = [
    [teamIds[0], teamIds[7]],
    [teamIds[3], teamIds[4]],
    [teamIds[2], teamIds[5]],
    [teamIds[1], teamIds[6]]
  ];
  const cuartos = [];
  cuartosPairs.forEach(([localId, visitId], i) => {
    const p = buildBracketPartido({
      tenantId,
      jornada: 1,
      fase: 'Cuartos de Final',
      localId,
      visitId,
      cancha: canchasCreadas[i % canchasCreadas.length].nombre,
      arbitroId: centrales[i % centrales.length].id,
      fechaDomingo: DOMINGOS[0],
      horario: HORARIOS_DOMINGO[i],
      seed: matchSeed,
      jugado: true
    });
    matchSeed += 1;
    cuartos.push(p);
    partidos.push(p);
  });

  const ganadoresCuartos = cuartos.map(getWinner);

  // Semifinales (pendientes)
  const semiPairs = [
    [ganadoresCuartos[0], ganadoresCuartos[1]],
    [ganadoresCuartos[2], ganadoresCuartos[3]]
  ];
  semiPairs.forEach(([localId, visitId], i) => {
    partidos.push(buildBracketPartido({
      tenantId,
      jornada: 2,
      fase: 'Semifinal',
      localId,
      visitId,
      cancha: canchasCreadas[i % canchasCreadas.length].nombre,
      arbitroId: centrales[i % centrales.length].id,
      fechaDomingo: DOMINGOS[1],
      horario: HORARIOS_DOMINGO[i + 1],
      seed: matchSeed,
      jugado: false
    }));
    matchSeed += 1;
  });

  // Final (pendiente)
  partidos.push({
    id: uuidv4(),
    tenant_id: tenantId,
    jornada: 3,
    fase: 'Final',
    equipo_local_id: null,
    equipo_visitante_id: null,
    goles_local: 0,
    goles_visitante: 0,
    estatus: 'Pendiente',
    stats: null,
    sede: canchasCreadas[0].nombre,
    horario: formatDomingo(DOMINGOS[2], '12:00'),
    arbitro_id: centrales[0].id
  });

  applyStandings(equiposCreados, partidos);
  leagueData.partidos.push(...partidos);
  writeJson(LEAGUE_PATH, leagueData);

  const finalizados = partidos.filter((p) => p.estatus === 'Finalizado').length;
  console.log('Seed completado:');
  console.log(`  Liga: ${NOMBRE_LIGA} (${SLUG})`);
  console.log(`  Formato: Eliminación Directa — 8 equipos × 20 jugadores`);
  console.log(`  Progreso: ${finalizados}/${partidos.length} partidos (cuartos jugados)`);
  console.log(`  Pendiente: 2 semifinales + final`);
  console.log(`  Organizador: organizador@${EMAIL_DOMAIN} / ${PASSWORD}`);
  console.log(`  Representantes: rep.<equipo>N@${EMAIL_DOMAIN} / ${PASSWORD}`);
}

main().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});

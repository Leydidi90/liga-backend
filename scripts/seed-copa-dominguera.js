/**
 * Seed: Copa Dominguera — eliminación directa, 16 equipos, partidos los domingos.
 * Mitad del torneo: octavos y cuartos jugados; semifinales y final pendientes.
 * Uso: node scripts/seed-copa-dominguera.js
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const TENANTS_PATH = path.join(__dirname, '../db/local-tenants.json');
const LEAGUE_PATH = path.join(__dirname, '../db/local-league-data.json');

const SLUG = 'copa-dominguera';
const NOMBRE_LIGA = 'Copa Dominguera';

const EQUIPOS = [
  'Titanes del Domingo',
  'Los Sin Lunes',
  'Descanso Eterno FC',
  'Alarmas Apagadas',
  'Café y Balón',
  'Pijamas FC',
  'Siesta United',
  'Los Relojes Rotos',
  'Barbacoa Athletic',
  'Sopita de Gol',
  'Domingueros FC',
  'La Familia en la Tribuna',
  'Chanclas de Oro',
  'El Tráfico Perdón',
  'Sábanas Calientes SC',
  'Último Domingo del Mes'
];

const NOMBRES = [
  'Juan', 'José', 'Luis', 'Carlos', 'Miguel', 'Francisco', 'Antonio', 'Pedro', 'Alejandro', 'Manuel',
  'Roberto', 'Fernando', 'Ricardo', 'Eduardo', 'Sergio', 'Raúl', 'Arturo', 'Enrique', 'Jorge', 'Alberto',
  'Héctor', 'Óscar', 'Rafael', 'Mario', 'Guillermo', 'Víctor', 'Martín', 'Iván', 'Gerardo', 'Rubén',
  'Hugo', 'Alonso', 'Emilio', 'César', 'Armando', 'Esteban', 'Adrián', 'Gael', 'Mateo', 'Santiago',
  'Sebastián', 'Leonardo', 'Diego', 'Daniel', 'Andrés', 'David', 'Javier', 'Marco', 'Rodrigo', 'Pablo'
];

const APELLIDOS_P = [
  'Ramírez', 'García', 'López', 'Martínez', 'Hernández', 'Torres', 'Flores', 'Vargas', 'Mendoza', 'Castro',
  'Ruiz', 'Morales', 'Silva', 'Rojas', 'Navarro', 'Cruz', 'Ortega', 'Delgado', 'Pineda', 'Soto',
  'Vega', 'Reyes', 'Campos', 'Aguilar', 'Medina', 'Guerrero', 'Ibarra', 'Salinas', 'Ponce', 'Valdez'
];

const APELLIDOS_M = [
  'Gutiérrez', 'Jiménez', 'Romero', 'Herrera', 'Juárez', 'Álvarez', 'Castillo', 'Ramos', 'Vázquez', 'Méndez',
  'Castañeda', 'Orozco', 'Trejo', 'Solís', 'Rivas', 'Cervantes', 'Domínguez', 'Franco', 'León', 'Miranda',
  'Padilla', 'Quintana', 'Rosales', 'Serrano', 'Tapia', 'Uribe', 'Villalobos', 'Zárate', 'Arriaga', 'Blanco'
];

const CANCHAS = [
  { nombre: 'Estadio Domingo Sabio', direccion: 'Av. Reforma 120, CDMX', tipo_superficie: 'Sintética', capacidad: 2000 },
  { nombre: 'Cancha Parque Alameda', direccion: 'Centro Histórico, CDMX', tipo_superficie: 'Sintética', capacidad: 600 },
  { nombre: 'Unidad Deportiva El Sol', direccion: 'Col. Del Valle, CDMX', tipo_superficie: 'Natural', capacidad: 900 },
  { nombre: 'Campo Los Familiares', direccion: 'Coyoacán, CDMX', tipo_superficie: 'Sintética', capacidad: 450 }
];

const ARBITROS = [
  { nombre: 'Felipe Cordero Ríos', rol: 'Central', matricula: 'DOM-1001', categoria: 'Libre' },
  { nombre: 'Gustavo Peña Lara', rol: 'Central', matricula: 'DOM-1002', categoria: 'Libre' },
  { nombre: 'Iván Montoya Cruz', rol: 'Central', matricula: 'DOM-1003', categoria: 'Libre' },
  { nombre: 'Luis Arredondo Vega', rol: 'Asistente 1', matricula: 'DOM-2001', categoria: 'Libre' },
  { nombre: 'Marco Durán Soto', rol: 'Asistente 2', matricula: 'DOM-2002', categoria: 'Libre' },
  { nombre: 'Pablo Nieto Gil', rol: 'Cuarto Árbitro', matricula: 'DOM-3001', categoria: 'Libre' }
];

// Domingos del torneo (octavos → final)
const DOMINGOS = [
  '2026-06-01', // Jornada 1 — Octavos
  '2026-06-08', // Jornada 2 — Cuartos
  '2026-06-15', // Jornada 3 — Semifinales (pendiente)
  '2026-06-22'  // Jornada 4 — Final (pendiente)
];

const HORARIOS_DOMINGO = ['10:00', '12:00', '14:00', '16:00', '18:00'];

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function buildCurp(prefix, globalIdx) {
  return `${prefix}${String(globalIdx).padStart(6, '0')}HMDMNX${globalIdx % 10}`;
}

function buildJugadores(teamIdx, prefix) {
  const jugadores = [];
  for (let p = 0; p < 15; p += 1) {
    const globalIdx = teamIdx * 15 + p;
    jugadores.push({
      nombre: NOMBRES[(teamIdx * 11 + p * 5) % NOMBRES.length],
      apellido_paterno: APELLIDOS_P[(teamIdx * 7 + p * 2) % APELLIDOS_P.length],
      apellido_materno: APELLIDOS_M[(teamIdx * 13 + p * 3) % APELLIDOS_M.length],
      numero_playera: p + 1,
      curp: buildCurp(prefix, globalIdx),
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
  const posesionLocal = 44 + (seed % 13);
  return {
    faltas: { local: 9 + (seed % 5), vis: 8 + ((seed + 2) % 6) },
    amarillas: { local: seed % 3, vis: (seed + 1) % 4 },
    rojas: { local: 0, vis: seed % 15 === 0 ? 1 : 0 },
    corners: { local: 4 + (seed % 4), vis: 3 + ((seed + 2) % 5) },
    remates: { local: 10 + golesLocal * 3, vis: 9 + golesVisitante * 3 },
    remates_arco: { local: 5 + golesLocal * 2, vis: 4 + golesVisitante * 2 },
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
  if (partido.goles_local > partido.goles_visitante) return partido.equipo_local_id;
  return partido.equipo_visitante_id;
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
  const tenantsData = readJson(TENANTS_PATH, { tenants: [] });
  let tenant = tenantsData.tenants.find((t) => t.subdominio_o_slug === SLUG);

  if (!tenant) {
    const hashedPassword = await bcrypt.hash('Domingo2026!', 10);
    tenant = {
      id: uuidv4(),
      nombre_liga: NOMBRE_LIGA,
      subdominio_o_slug: SLUG,
      fecha_registro: new Date().toISOString(),
      estatus_pago: true,
      plan: 'Oro',
      fecha_vencimiento: new Date('2027-06-19').toISOString(),
      dueno_nombre: 'Organizador Copa Dominguera',
      dueno_email: 'organizador@copa-dominguera.test',
      password: hashedPassword
    };
    tenantsData.tenants.push(tenant);
    writeJson(TENANTS_PATH, tenantsData);
    console.log(`Tenant creado: ${NOMBRE_LIGA} (slug: ${SLUG})`);
  } else {
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
  const repPassword = await bcrypt.hash('RepDom2026!', 10);

  const torneoId = uuidv4();
  leagueData.torneos.push({
    id: torneoId,
    tenant_id: tenantId,
    nombre: 'Copa Dominguera 2026',
    categoria: 'Libre Varonil',
    formato: 'Eliminación Directa',
    fecha_inicio: '2026-06-01',
    fecha_fin: '2026-06-22',
    estatus: 'Activo',
    premio: 'Copa y medallas al campeón',
    cobros: { costo_total: 0 }
  });

  const canchasCreadas = CANCHAS.map((c) => ({
    id: uuidv4(),
    tenant_id: tenantId,
    nombre: c.nombre,
    direccion: c.direccion,
    tipo_superficie: c.tipo_superficie,
    capacidad: c.capacidad,
    notas: 'Partidos programados los domingos',
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
      email: `rep.${slugRep}${teamIdx}@copa-dominguera.test`,
      password: repPassword,
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
        color_playera: ['rojo', 'azul', 'verde', 'amarillo'][teamIdx % 4],
        color_short: 'negro',
        color_medias: 'blanco'
      },
      jugadores: buildJugadores(teamIdx, 'DOMG'),
      desglose_cobro: { costo_total: 0, total_jugadores: 15 },
      total_cobro: 0,
      pago: { metodo: 'Efectivo', estado: 'Aprobado (seed)', referencia: `SEED-DOM-${teamIdx + 1}` },
      estatus_pago: 'Pagado',
      fecha_registro: now
    });
  });

  const teamIds = equiposCreados.map((e) => e.id);
  const partidos = [];
  let matchSeed = 1;

  // —— Octavos de final (jornada 1, todos jugados) ——
  const octavos = [];
  for (let i = 0; i < 8; i += 1) {
    const p = buildBracketPartido({
      tenantId,
      jornada: 1,
      fase: 'Octavos de Final',
      localId: teamIds[i],
      visitId: teamIds[15 - i],
      cancha: canchasCreadas[i % canchasCreadas.length].nombre,
      arbitroId: centrales[i % centrales.length].id,
      fechaDomingo: DOMINGOS[0],
      horario: HORARIOS_DOMINGO[i % HORARIOS_DOMINGO.length],
      seed: matchSeed,
      jugado: true
    });
    matchSeed += 1;
    octavos.push(p);
    partidos.push(p);
  }

  const ganadoresOctavos = octavos.map(getWinner);

  // —— Cuartos de final (jornada 2, todos jugados) ——
  const cuartosPairs = [
    [ganadoresOctavos[0], ganadoresOctavos[7]],
    [ganadoresOctavos[3], ganadoresOctavos[4]],
    [ganadoresOctavos[2], ganadoresOctavos[5]],
    [ganadoresOctavos[1], ganadoresOctavos[6]]
  ];
  const cuartos = [];
  cuartosPairs.forEach(([localId, visitId], i) => {
    const p = buildBracketPartido({
      tenantId,
      jornada: 2,
      fase: 'Cuartos de Final',
      localId,
      visitId,
      cancha: canchasCreadas[i % canchasCreadas.length].nombre,
      arbitroId: centrales[i % centrales.length].id,
      fechaDomingo: DOMINGOS[1],
      horario: HORARIOS_DOMINGO[i % HORARIOS_DOMINGO.length],
      seed: matchSeed,
      jugado: true
    });
    matchSeed += 1;
    cuartos.push(p);
    partidos.push(p);
  });

  const ganadoresCuartos = cuartos.map(getWinner);

  // —— Semifinales (jornada 3, pendientes — próximo domingo) ——
  const semiPairs = [
    [ganadoresCuartos[0], ganadoresCuartos[1]],
    [ganadoresCuartos[2], ganadoresCuartos[3]]
  ];
  semiPairs.forEach(([localId, visitId], i) => {
    partidos.push(buildBracketPartido({
      tenantId,
      jornada: 3,
      fase: 'Semifinal',
      localId,
      visitId,
      cancha: canchasCreadas[i % canchasCreadas.length].nombre,
      arbitroId: centrales[i % centrales.length].id,
      fechaDomingo: DOMINGOS[2],
      horario: HORARIOS_DOMINGO[i + 1],
      seed: matchSeed,
      jugado: false
    }));
    matchSeed += 1;
  });

  // —— Final (jornada 4, pendiente) ——
  partidos.push({
    id: uuidv4(),
    tenant_id: tenantId,
    jornada: 4,
    fase: 'Final',
    equipo_local_id: null,
    equipo_visitante_id: null,
    goles_local: 0,
    goles_visitante: 0,
    estatus: 'Pendiente',
    stats: null,
    sede: canchasCreadas[0].nombre,
    horario: formatDomingo(DOMINGOS[3], '12:00'),
    arbitro_id: centrales[0].id
  });

  applyStandings(equiposCreados, partidos);
  leagueData.partidos.push(...partidos);
  writeJson(LEAGUE_PATH, leagueData);

  const finalizados = partidos.filter((p) => p.estatus === 'Finalizado').length;
  console.log('Seed completado:');
  console.log(`  Liga: ${NOMBRE_LIGA} (${SLUG})`);
  console.log(`  Formato: Eliminación Directa — 16 equipos`);
  console.log(`  Progreso: ${finalizados}/${partidos.length} partidos (octavos y cuartos jugados)`);
  console.log(`  Pendiente: 2 semifinales + final (domingos 15 y 22 jun 2026)`);
  console.log(`  Canchas: ${canchasCreadas.length} | Árbitros: ${arbitrosCreados.length}`);
  console.log(`  Organizador: organizador@copa-dominguera.test / Domingo2026!`);
}

main().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});

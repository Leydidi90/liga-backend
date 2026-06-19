/**
 * Seed: Liga Jocotitlan — 16 equipos × 20 jugadores (torneo Juvenil Menor)
 * Uso: node scripts/seed-jocotitlan.js
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const TENANTS_PATH = path.join(__dirname, '../db/local-tenants.json');
const LEAGUE_PATH = path.join(__dirname, '../db/local-league-data.json');

const SLUG = 'jocotitlan';
const NOMBRE_LIGA = 'Jocotitlan';

const EQUIPOS = [
  'Volcán Dormido FC',
  'Los Magueyosos',
  'Rayo de Joco',
  'Cebollas en Lágrimas',
  'Halcones del Cerro Pelón',
  'Trigal 86',
  'Los que Madrugan Tarde',
  'Panzas de Acero',
  'Chipotes del Valle',
  'La Banda del Silbato',
  'Niños del Norte',
  'Atlético La Concha',
  'Piedras Negras SC',
  'Gallos de Plata',
  'Lobos del Maguey',
  'La Máquina del Campo'
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
  'Núñez', 'Carrillo', 'Zamora', 'Mejía', 'Ríos', 'Fuentes', 'Acosta', 'Bravo', 'Cortés', 'Luna',
  'Galván', 'Montoya', 'Espinoza', 'Cárdenas', 'Velázquez', 'Contreras', 'Sandoval', 'Estrada', 'Bautista', 'Palacios'
];

const APELLIDOS_M = [
  'Gutiérrez', 'Jiménez', 'Romero', 'Herrera', 'Juárez', 'Álvarez', 'Castillo', 'Ramos', 'Vázquez', 'Méndez',
  'Castañeda', 'Orozco', 'Trejo', 'Solís', 'Rivas', 'Cervantes', 'Domínguez', 'Franco', 'León', 'Miranda',
  'Padilla', 'Quintana', 'Rosales', 'Serrano', 'Tapia', 'Uribe', 'Villalobos', 'Zárate', 'Arriaga', 'Blanco',
  'Cabrera', 'Durán', 'Escobar', 'Figueroa', 'Gil', 'Huerta', 'Ibáñez', 'Lara', 'Mora', 'Nieto',
  'Olvera', 'Paredes', 'Quezada', 'Rangel', 'Saucedo', 'Toledo', 'Urbina', 'Valencia', 'Xoconostle', 'Yáñez'
];

const COLORES = [
  { color_playera: 'rojo', color_short: 'blanco', color_medias: 'rojo' },
  { color_playera: 'azul', color_short: 'negro', color_medias: 'azul' },
  { color_playera: 'verde', color_short: 'blanco', color_medias: 'verde' },
  { color_playera: 'amarillo', color_short: 'azul', color_medias: 'amarillo' },
  { color_playera: 'naranja', color_short: 'negro', color_medias: 'naranja' },
  { color_playera: 'morado', color_short: 'blanco', color_medias: 'morado' },
  { color_playera: 'negro', color_short: 'dorado', color_medias: 'negro' },
  { color_playera: 'blanco', color_short: 'rojo', color_medias: 'blanco' },
  { color_playera: 'celeste', color_short: 'blanco', color_medias: 'celeste' },
  { color_playera: 'vino', color_short: 'dorado', color_medias: 'vino' },
  { color_playera: 'turquesa', color_short: 'negro', color_medias: 'turquesa' },
  { color_playera: 'gris', color_short: 'rojo', color_medias: 'gris' },
  { color_playera: 'rosa', color_short: 'negro', color_medias: 'rosa' },
  { color_playera: 'cafe', color_short: 'beige', color_medias: 'cafe' },
  { color_playera: 'lima', color_short: 'negro', color_medias: 'lima' },
  { color_playera: 'azul marino', color_short: 'blanco', color_medias: 'azul marino' }
];

const CANCHAS = [
  { nombre: 'Cancha Municipal Jocotitlán', direccion: 'Av. Hidalgo s/n, Jocotitlán', tipo_superficie: 'Sintética', capacidad: 800 },
  { nombre: 'Unidad Deportiva El Volcán', direccion: 'Carretera al Volcán km 2', tipo_superficie: 'Sintética', capacidad: 1200 },
  { nombre: 'Campo La Concha', direccion: 'Barrio La Concha, Jocotitlán', tipo_superficie: 'Natural', capacidad: 500 },
  { nombre: 'Estadio Trigal 86', direccion: 'Zona Norte, Jocotitlán', tipo_superficie: 'Sintética', capacidad: 1500 }
];

const ARBITROS = [
  { nombre: 'Eduardo Morales Ríos', rol: 'Central', matricula: 'JOC-1001', categoria: 'Juvenil' },
  { nombre: 'Sergio Vega Campos', rol: 'Central', matricula: 'JOC-1002', categoria: 'Juvenil' },
  { nombre: 'Ricardo Delgado Soto', rol: 'Central', matricula: 'JOC-1003', categoria: 'Juvenil' },
  { nombre: 'Arturo Núñez Lara', rol: 'Central', matricula: 'JOC-1004', categoria: 'Juvenil' },
  { nombre: 'Héctor Ibarra Ponce', rol: 'Asistente 1', matricula: 'JOC-2001', categoria: 'Juvenil' },
  { nombre: 'Mario Salinas Cruz', rol: 'Asistente 2', matricula: 'JOC-2002', categoria: 'Juvenil' },
  { nombre: 'Roberto Fuentes Mejía', rol: 'Asistente 1', matricula: 'JOC-2003', categoria: 'Juvenil' },
  { nombre: 'Jorge Acosta Bravo', rol: 'Cuarto Árbitro', matricula: 'JOC-3001', categoria: 'Juvenil' }
];

const HORARIOS_BASE = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function buildCurp(globalIdx) {
  return `JOCO${String(globalIdx).padStart(6, '0')}HMOCNX${globalIdx % 10}`;
}

function buildJugadores(teamIdx) {
  const jugadores = [];
  for (let p = 0; p < 20; p += 1) {
    const globalIdx = teamIdx * 20 + p;
    const nombre = NOMBRES[(teamIdx * 13 + p * 7) % NOMBRES.length];
    const apellido_paterno = APELLIDOS_P[(teamIdx * 5 + p * 3) % APELLIDOS_P.length];
    const apellido_materno = APELLIDOS_M[(teamIdx * 9 + p * 11) % APELLIDOS_M.length];
    jugadores.push({
      nombre,
      apellido_paterno,
      apellido_materno,
      numero_playera: p + 1,
      curp: buildCurp(globalIdx),
      rol_liderazgo: p === 0 ? 'Capitán' : p === 1 ? 'Subcapitán' : 'Ninguno',
      foto_jugador: ''
    });
  }
  return jugadores;
}

function generateRoundRobin(equipoIds) {
  const ids = [...equipoIds];
  if (ids.length % 2 !== 0) ids.push(null);
  const numRondas = ids.length - 1;
  const mitad = ids.length / 2;
  const partidos = [];

  for (let ronda = 0; ronda < numRondas; ronda += 1) {
    for (let i = 0; i < mitad; i += 1) {
      const local = ids[i];
      const visitante = ids[ids.length - 1 - i];
      if (local !== null && visitante !== null) {
        partidos.push({ jornada: ronda + 1, equipo_local_id: local, equipo_visitante_id: visitante });
      }
    }
    ids.splice(1, 0, ids.pop());
  }
  return partidos;
}

function buildMatchStats(seed, golesLocal, golesVisitante) {
  const posesionLocal = 42 + (seed % 17);
  return {
    faltas: { local: 8 + (seed % 7), vis: 7 + ((seed + 3) % 8) },
    amarillas: { local: seed % 4, vis: (seed + 2) % 5 },
    rojas: { local: seed % 11 === 0 ? 1 : 0, vis: seed % 13 === 0 ? 1 : 0 },
    corners: { local: 3 + (seed % 6), vis: 2 + ((seed + 1) % 7) },
    remates: { local: 8 + golesLocal * 4 + (seed % 5), vis: 7 + golesVisitante * 4 + (seed % 4) },
    remates_arco: { local: 4 + golesLocal * 2, vis: 3 + golesVisitante * 2 },
    posesion: { local: posesionLocal, vis: 100 - posesionLocal }
  };
}

function buildMatchResult(seed) {
  const golesLocal = (seed * 7 + 3) % 5;
  const golesVisitante = (seed * 11 + 5) % 5;
  return {
    goles_local: golesLocal,
    goles_visitante: golesVisitante,
    stats: buildMatchStats(seed, golesLocal, golesVisitante)
  };
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
    } else if (gv > gl) {
      visit.partidos_ganados += 1;
      visit.puntos += 3;
      local.partidos_perdidos += 1;
    } else {
      local.partidos_empatados += 1;
      visit.partidos_empatados += 1;
      local.puntos += 1;
      visit.puntos += 1;
    }
  });
}

async function main() {
  const tenantsData = readJson(TENANTS_PATH, { tenants: [] });
  let tenant = tenantsData.tenants.find((t) => t.subdominio_o_slug === SLUG);

  if (tenant) {
    console.log(`Liga "${NOMBRE_LIGA}" ya existe (id: ${tenant.id}). Actualizando datos de liga...`);
  } else {
    const hashedPassword = await bcrypt.hash('Joco2026!', 10);
    tenant = {
      id: uuidv4(),
      nombre_liga: NOMBRE_LIGA,
      subdominio_o_slug: SLUG,
      fecha_registro: new Date().toISOString(),
      estatus_pago: true,
      plan: 'Oro',
      fecha_vencimiento: new Date('2027-06-19').toISOString(),
      dueno_nombre: 'Organizador Jocotitlan',
      dueno_email: 'organizador@jocotitlan.test',
      password: hashedPassword
    };
    tenantsData.tenants.push(tenant);
    writeJson(TENANTS_PATH, tenantsData);
    console.log(`Tenant creado: ${NOMBRE_LIGA} (slug: ${SLUG})`);
  }

  const tenantId = tenant.id;
  const leagueData = readJson(LEAGUE_PATH, {
    equipos: [], partidos: [], torneos: [], arbitros: [], canchas: [],
    representantes: [], inscripciones: [], multas: []
  });

  // Eliminar datos previos de esta liga para re-seed limpio
  ['equipos', 'partidos', 'torneos', 'arbitros', 'canchas', 'representantes', 'inscripciones', 'multas'].forEach((key) => {
    leagueData[key] = (leagueData[key] || []).filter((item) => item.tenant_id !== tenantId);
  });

  const repPassword = await bcrypt.hash('Rep2026!', 10);
  const now = new Date().toISOString();

  const torneoId = uuidv4();
  leagueData.torneos.push({
    id: torneoId,
    tenant_id: tenantId,
    nombre: 'Apertura Jocotitlan 2026',
    categoria: 'Juvenil Menor',
    formato: 'Liga (Todos contra todos)',
    fecha_inicio: '2026-07-01',
    fecha_fin: '2026-12-15',
    estatus: 'Activo',
    premio: 'Trofeo al campeón',
    cobros: { costo_total: 0 }
  });

  const canchasCreadas = CANCHAS.map((c) => ({
    id: uuidv4(),
    tenant_id: tenantId,
    nombre: c.nombre,
    direccion: c.direccion,
    tipo_superficie: c.tipo_superficie,
    capacidad: c.capacidad,
    notas: '',
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
    const inscripcionId = uuidv4();
    const slugRep = nombreEquipo.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);

    leagueData.equipos.push({
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
    });
    equiposCreados.push(leagueData.equipos[leagueData.equipos.length - 1]);

    leagueData.representantes.push({
      id: repId,
      tenant_id: tenantId,
      nombre_representante: `Representante ${nombreEquipo}`,
      email: `rep.${slugRep}${teamIdx}@jocotitlan.test`,
      password: repPassword,
      equipo_principal: nombreEquipo,
      fecha_registro: now
    });

    const jugadores = buildJugadores(teamIdx);
    const colores = COLORES[teamIdx % COLORES.length];

    leagueData.inscripciones.push({
      id: inscripcionId,
      tenant_id: tenantId,
      torneo_id: torneoId,
      representante_id: repId,
      nombre_equipo: nombreEquipo,
      uniforme: colores,
      jugadores,
      desglose_cobro: { costo_total: 0, total_jugadores: jugadores.length },
      total_cobro: 0,
      pago: {
        metodo: 'Efectivo',
        estado: 'Aprobado (seed)',
        referencia: `SEED-JOCO-${teamIdx + 1}`
      },
      estatus_pago: 'Pagado',
      fecha_registro: now
    });
  });

  const equipoIds = equiposCreados.map((e) => e.id);
  const rolBase = generateRoundRobin(equipoIds);
  const partidosPorJornada = 8;
  const jornadasCompletas = 7;
  const partidosExtraJornada8 = 4;
  const partidosJugadosMeta = jornadasCompletas * partidosPorJornada + partidosExtraJornada8;
  const usoPorJornada = {};

  const partidos = rolBase.map((p, idx) => {
    const jornadaKey = String(p.jornada);
    const usados = usoPorJornada[jornadaKey] || 0;
    usoPorJornada[jornadaKey] = usados + 1;
    const canchaIndex = usados % canchasCreadas.length;
    const bloqueHorario = Math.floor(usados / canchasCreadas.length);
    const horario = HORARIOS_BASE[bloqueHorario % HORARIOS_BASE.length];
    const arbitro = centrales[idx % centrales.length];

    const jugado = idx < partidosJugadosMeta;
    const resultado = jugado ? buildMatchResult(idx + 1) : { goles_local: 0, goles_visitante: 0, stats: null };

    return {
      id: uuidv4(),
      tenant_id: tenantId,
      jornada: p.jornada,
      equipo_local_id: p.equipo_local_id,
      equipo_visitante_id: p.equipo_visitante_id,
      goles_local: resultado.goles_local,
      goles_visitante: resultado.goles_visitante,
      estatus: jugado ? 'Finalizado' : 'Pendiente',
      stats: resultado.stats,
      sede: canchasCreadas[canchaIndex].nombre,
      horario,
      arbitro_id: arbitro.id
    };
  });

  applyStandings(equiposCreados, partidos);
  leagueData.partidos.push(...partidos);

  writeJson(LEAGUE_PATH, leagueData);

  const totalJugadores = EQUIPOS.length * 20;
  const finalizados = partidos.filter((p) => p.estatus === 'Finalizado').length;
  console.log('Seed completado:');
  console.log(`  Liga: ${NOMBRE_LIGA} (${SLUG})`);
  console.log(`  Torneo: Juvenil Menor — ${EQUIPOS.length} equipos (estatus: Activo)`);
  console.log(`  Canchas: ${canchasCreadas.length} | Árbitros: ${arbitrosCreados.length}`);
  console.log(`  Partidos: ${partidos.length} total | ${finalizados} finalizados (${Math.round(finalizados / partidos.length * 100)}% de la temporada)`);
  console.log(`  Jugadores: ${totalJugadores} (${NOMBRES.length} nombres distintos en rotación)`);
  console.log(`  Organizador: organizador@jocotitlan.test / Joco2026!`);
  console.log(`  Representantes: rep.<equipo>N@jocotitlan.test / Rep2026!`);
}

main().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});

const supabase = require('../supabaseClient');
        const { v4: uuidv4 } = require('uuid');
        const bcrypt = require('bcryptjs');
        const jwt = require('jsonwebtoken');
        const localTenantStore = require('../db/localTenantStore');
        const leagueDataStore = require('../db/leagueDataStore');
        const { sortTenants } = require('../db/localTenantStore');
        const useLocalDevMode = String(process.env.LOCAL_DEV_MODE || 'false').toLowerCase() === 'true';
        const skipCurpValidation = String(process.env.SKIP_CURP_VALIDATION || 'false').toLowerCase() === 'true';
        const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
        const CURP_ALPHABET = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
        const ALLOWED_TOURNAMENT_CATEGORIES = [
    'Chupones',
    'Infantil Menor',
    'Infantil Mayor',
    'Juvenil Menor',
    'Juvenil Mayor',
    'Sub-7',
    'Sub-9',
    'Sub-11',
    'Sub-13',
    'Sub-15',
    'Sub-17',
    'Sub-20',
    'Primera División',
    'Segunda División',
    'Libre Varonil',
    'Libre Femenil',
    'Veteranos',
    'Master'
];

        const getTenantIdBySlug = async (slug) => {
    if (useLocalDevMode) {
        const tenant = await localTenantStore.getTenantBySlug(slug);
        return tenant ? tenant.id : null;
    }
    const { data, error } = await supabase
        .from('tenant')
        .select('id')
        .eq('subdominio_o_slug', slug)
        .single();
    if (error || !data) return null;
    return data.id;
};

        const listAllTenants = async () => {
    if (useLocalDevMode) return localTenantStore.listTenants();
    const { data, error } = await supabase.from('tenant').select('*');
    if (error) throw error;
    return sortTenants(data || []);
};

        const getTenantBySlugFull = async (slug) => {
    if (useLocalDevMode) return localTenantStore.getTenantBySlug(slug);
    const { data, error } = await supabase
        .from('tenant')
        .select('*')
        .eq('subdominio_o_slug', slug)
        .single();
    if (error || !data) return null;
    return data;
};

        const applyStandingsAfterMatch = async (partido, goles_local, goles_visitante) => {
    let ptsLocal = 0; let ptsVis = 0;
    let pG_local = 0; let pG_vis = 0;
    let pE_local = 0; let pE_vis = 0;
    let pP_local = 0; let pP_vis = 0;

    if (goles_local > goles_visitante) { ptsLocal = 3; pG_local = 1; pP_vis = 1; }
    else if (goles_visitante > goles_local) { ptsVis = 3; pG_vis = 1; pP_local = 1; }
    else { ptsLocal = 1; ptsVis = 1; pE_local = 1; pE_vis = 1; }

    const updateEquipo = async (equipoId, g, e, p, gf, gc, pts) => {
        const eq = await leagueDataStore.getById('equipos', equipoId, partido.tenant_id);
        if (!eq) return;
        await leagueDataStore.update('equipos', equipoId, partido.tenant_id, {
            partidos_jugados: (eq.partidos_jugados || 0) + 1,
            partidos_ganados: (eq.partidos_ganados || 0) + g,
            partidos_empatados: (eq.partidos_empatados || 0) + e,
            partidos_perdidos: (eq.partidos_perdidos || 0) + p,
            goles_favor: (eq.goles_favor || 0) + gf,
            goles_contra: (eq.goles_contra || 0) + gc,
            puntos: (eq.puntos || 0) + pts
        });
    };

    await updateEquipo(partido.equipo_local_id, pG_local, pE_local, pP_local, goles_local, goles_visitante, ptsLocal);
    await updateEquipo(partido.equipo_visitante_id, pG_vis, pE_vis, pP_vis, goles_visitante, goles_local, ptsVis);
};

        const validatePasswordPolicy = (password) => {
    const raw = String(password || '');
    return (
        raw.length >= 8 &&
        /[A-Z]/.test(raw) &&
        /[a-z]/.test(raw) &&
        /\d/.test(raw) &&
        /[^A-Za-z0-9]/.test(raw)
    );
};

        const calculateCurpCheckDigit = (curp17) => {
    const upper = String(curp17 || '').toUpperCase();
    let sum = 0;
    for (let i = 0; i < 17; i += 1) {
        const char = upper[i];
        const value = CURP_ALPHABET.indexOf(char);
        if (value < 0) return null;
        sum += value * (18 - i);
    }
    const digit = (10 - (sum % 10)) % 10;
    return String(digit);
};

        const isValidCurp = (curp) => {
    const value = String(curp || '').toUpperCase().trim();
    if (skipCurpValidation) return value.length >= 5;
    if (!CURP_REGEX.test(value)) return false;
    const expected = calculateCurpCheckDigit(value.slice(0, 17));
    return expected !== null && expected === value.slice(17);
};

        const defaultCobrosTorneo = {
    costo_total: 0
};

// Normaliza la estructura de cobros a un único pago general (costo_total).
// Mantiene compatibilidad con torneos antiguos que tenían el desglose.
        const normalizeCobros = (cobros) => {
    const c = cobros || {};
    if (c.costo_total !== undefined && c.costo_total !== null) {
        return { costo_total: Number(c.costo_total) || 0 };
    }
    const legacyTotal = Number(c.mantenimiento_cancha || 0) +
        Number(c.arbitraje || 0) +
        Number(c.inscripcion_equipo || 0) +
        Number(c.costo_por_jugador || 0);
    return { costo_total: Number(legacyTotal.toFixed(2)) };
};

exports.getEquipos = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        const equiposActuales = await leagueDataStore.list('equipos', tenant_id);
        const inscripciones = await leagueDataStore.list('inscripciones', tenant_id);
        const normalizedExisting = new Set(
            equiposActuales.map((e) => String(e.nombre || '').toLowerCase().trim())
        );

        for (const ins of inscripciones) {
            const nombreEquipo = String(ins.nombre_equipo || '').trim();
            if (!nombreEquipo) continue;
            const key = nombreEquipo.toLowerCase();
            if (normalizedExisting.has(key)) continue;

            const nuevoEquipo = {
                id: uuidv4(),
                tenant_id,
                nombre: nombreEquipo,
                delegado: '',
                escudo: '',
                puntos: 0,
                partidos_jugados: 0,
                partidos_ganados: 0,
                partidos_empatados: 0,
                partidos_perdidos: 0,
                goles_favor: 0,
                goles_contra: 0
            };
            await leagueDataStore.insert('equipos', nuevoEquipo);
            equiposActuales.push(nuevoEquipo);
            normalizedExisting.add(key);
        }

        const data = equiposActuales.sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.addEquipo = async (req, res) => {
    const { slug } = req.params;
    const { nombre, delegado, escudo } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        const id = uuidv4();
        const created = await leagueDataStore.insert('equipos', {
            id, tenant_id, nombre, delegado: delegado || '', escudo: escudo || '',
            puntos: 0, partidos_jugados: 0, partidos_ganados: 0, partidos_empatados: 0, partidos_perdidos: 0,
            goles_favor: 0, goles_contra: 0
        });
        return res.json(created);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Algoritmo Matemático Round Robin
exports.generateRoundRobin = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        let equipos = [];
        const equiposActuales = await leagueDataStore.list('equipos', tenant_id);
        let equiposSincronizados = [...equiposActuales];

        if (equiposSincronizados.length < 2) {
            const inscripciones = await leagueDataStore.list('inscripciones', tenant_id);
            const normalizedExisting = new Set(
                equiposSincronizados.map((e) => String(e.nombre || '').toLowerCase().trim())
            );

            for (const ins of inscripciones) {
                const nombreEquipo = String(ins.nombre_equipo || '').trim();
                if (!nombreEquipo) continue;
                const key = nombreEquipo.toLowerCase();
                if (normalizedExisting.has(key)) continue;

                const representanteNombre = ins.representante?.nombre_representante || '';
                const nuevoEquipo = {
                    id: uuidv4(),
                    tenant_id,
                    nombre: nombreEquipo,
                    delegado: representanteNombre,
                    escudo: '',
                    puntos: 0,
                    partidos_jugados: 0,
                    partidos_ganados: 0,
                    partidos_empatados: 0,
                    partidos_perdidos: 0,
                    goles_favor: 0,
                    goles_contra: 0
                };
                await leagueDataStore.insert('equipos', nuevoEquipo);
                equiposSincronizados.push(nuevoEquipo);
                normalizedExisting.add(key);
            }
        }

        equipos = equiposSincronizados.map((e) => ({ id: e.id }));
        if (equipos.length < 2) return res.status(400).json({ error: "Se necesitan al menos 2 equipos registrados" });

        await leagueDataStore.replaceAll('partidos', tenant_id, []);

        let equipoIds = equipos.map(e => e.id);
        
        // Compensación de impares para el Round Robin
        if (equipoIds.length % 2 !== 0) {
            equipoIds.push(null); // El equipo emparejado con 'null' descansa
        }
        
        const numRondas = equipoIds.length - 1;
        const mitad = equipoIds.length / 2;
        let partidos = [];

        for (let ronda = 0; ronda < numRondas; ronda++) {
            for (let i = 0; i < mitad; i++) {
                const local = equipoIds[i];
                const visitante = equipoIds[equipoIds.length - 1 - i];
                
                // Ignorar el partido que involucre al equipo 'Dummy / null' (Descanso)
                if (local !== null && visitante !== null) {
                    partidos.push({
                        id: uuidv4(),
                        tenant_id,
                        jornada: ronda + 1,
                        equipo_local_id: local,
                        equipo_visitante_id: visitante
                    });
                }
            }
            // Rotar equipos (El primero se fija, los demás rotan como manecillas de reloj)
            equipoIds.splice(1, 0, equipoIds.pop());
        }

        const canchasDisponibles = (await leagueDataStore.list('canchas', tenant_id))
            .filter((c) => c && c.activa !== false && String(c.nombre || '').trim())
            .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
        const horariosBase = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];
        const usoPorJornada = {};

        await leagueDataStore.replaceAll(
            'partidos',
            tenant_id,
            partidos.map((p) => {
                const autoProgramacion = (function assignCanchaYHorario() {
                    if (canchasDisponibles.length === 0) return {};
                    const jornadaKey = String(p.jornada);
                    const usados = usoPorJornada[jornadaKey] || 0;
                    usoPorJornada[jornadaKey] = usados + 1;
                    const canchaIndex = usados % canchasDisponibles.length;
                    const bloqueHorario = Math.floor(usados / canchasDisponibles.length);
                    const horario = horariosBase[bloqueHorario % horariosBase.length];
                    return {
                        sede: canchasDisponibles[canchaIndex].nombre,
                        horario
                    };
                })();
                return {
                    ...p,
                    goles_local: 0,
                    goles_visitante: 0,
                    estatus: 'Pendiente',
                    stats: null,
                    sede: autoProgramacion.sede || null,
                    horario: autoProgramacion.horario || null
                };
            })
        );
        return res.json({
            message: canchasDisponibles.length > 0
                ? "Calendario generado con asignación automática de canchas."
                : "Calendario generado exitosamente",
            partidos_generados: partidos.length,
            canchas_asignadas: canchasDisponibles.length
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.getCalendario = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        const equipos = await leagueDataStore.list('equipos', tenant_id);
        const partidos = (await leagueDataStore.list('partidos', tenant_id)).sort((a, b) => a.jornada - b.jornada);
        const byId = new Map(equipos.map((e) => [e.id, e]));
        const arbById = new Map((await leagueDataStore.list('arbitros', tenant_id)).map((a) => [a.id, a]));
        const result = partidos.map((p) => ({
            ...p,
            local_nombre: p.equipo_local_id
                ? (byId.get(p.equipo_local_id)?.nombre || 'Local')
                : (p.fase ? 'Por definir' : 'Local'),
            local_escudo: p.equipo_local_id ? (byId.get(p.equipo_local_id)?.escudo || '') : '',
            visitante_nombre: p.equipo_visitante_id
                ? (byId.get(p.equipo_visitante_id)?.nombre || 'Visitante')
                : (p.fase ? 'Por definir' : 'Visitante'),
            visitante_escudo: p.equipo_visitante_id ? (byId.get(p.equipo_visitante_id)?.escudo || '') : '',
            arbitro_id: p.arbitro_id || null,
            arbitro_nombre: arbById.get(p.arbitro_id)?.nombre || ''
        }));
        return res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.updatePartido = async (req, res) => {
    const { slug, id } = req.params;
    const { goles_local, goles_visitante, stats } = req.body;
    
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        const partido = await leagueDataStore.getById('partidos', id, tenant_id);
        if (!partido) return res.status(404).json({ error: "Partido no encontrado" });

        if (partido.estatus === 'Finalizado') {
            await leagueDataStore.update('partidos', id, tenant_id, { stats });
            return res.json({ message: "Acta estadística editada exitosamente." });
        }

        await leagueDataStore.update('partidos', id, tenant_id, {
            goles_local,
            goles_visitante,
            estatus: 'Finalizado',
            stats
        });

        if (!useLocalDevMode) {
            await applyStandingsAfterMatch({ ...partido, tenant_id }, goles_local, goles_visitante);
        }

        return res.json({ message: "Marcador y estadísticas cargadas oficialmente." });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateProgramacion = async (req, res) => {
    const { slug, id } = req.params;
    const { sede, horario, arbitro_id } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        const updated = await leagueDataStore.update('partidos', id, tenant_id, { sede: sede || null, horario: horario || null, arbitro_id: arbitro_id || null });
        if (!updated) return res.status(404).json({ error: "Partido no encontrado" });
        return res.json({ message: "Programación actualizada exitosamente." });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getArbitros = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        const data = (await leagueDataStore.list('arbitros', tenant_id)).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
        return res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addArbitro = async (req, res) => {
    const { slug } = req.params;
    const { nombre, rol, matricula, categoria } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });
        const id = uuidv4();

        const created = await leagueDataStore.insert('arbitros', {
                id,
                tenant_id,
                nombre,
                rol: rol || 'Central',
                matricula: matricula || '',
                categoria: categoria || 'General'
            });
            return res.json(created);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateArbitro = async (req, res) => {
    const { slug, id } = req.params;
    const { nombre, rol, matricula, categoria } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });
        
        const updated = await leagueDataStore.update('arbitros', id, tenant_id, { nombre, rol, matricula, categoria });
        if (!updated) return res.status(404).json({ error: "Árbitro no encontrado" });
        return res.json({ message: "Árbitro actualizado exitosamente" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteArbitro = async (req, res) => {
    const { slug, id } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });
        
        const deleted = await leagueDataStore.remove('arbitros', id, tenant_id);
        if (!deleted) return res.status(404).json({ error: "Árbitro no encontrado" });
        return res.json({ message: "Registro eliminado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getCanchas = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });
        const data = (await leagueDataStore.list('canchas', tenant_id))
            .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
        return res.json(data);
    } catch (err) { return res.status(500).json({ error: err.message }); }
};

exports.addCancha = async (req, res) => {
    const { slug } = req.params;
    const { nombre, direccion, tipo_superficie, capacidad, notas } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });
        const nombreTrim = String(nombre || '').trim();
        if (!nombreTrim) return res.status(400).json({ error: "El nombre de la cancha es obligatorio." });

        const existing = (await leagueDataStore.list('canchas', tenant_id))
            .find((c) => String(c.nombre || '').toLowerCase() === nombreTrim.toLowerCase());
        if (existing) return res.status(409).json({ error: "Ya existe una cancha con ese nombre." });

        const capacidadNum = Number(capacidad);
        const created = await leagueDataStore.insert('canchas', {
            id: uuidv4(),
            tenant_id,
            nombre: nombreTrim,
            direccion: String(direccion || '').trim(),
            tipo_superficie: String(tipo_superficie || '').trim() || 'Sintética',
            capacidad: Number.isFinite(capacidadNum) && capacidadNum > 0 ? Math.trunc(capacidadNum) : null,
            notas: String(notas || '').trim(),
            activa: true,
            fecha_registro: new Date().toISOString()
        });

        return res.status(201).json(created);
    } catch (err) { return res.status(500).json({ error: err.message }); }
};

exports.deleteCancha = async (req, res) => {
    const { slug, id } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });
        const deleted = await leagueDataStore.remove('canchas', id, tenant_id);
        if (!deleted) return res.status(404).json({ error: "Cancha no encontrada." });
        return res.json({ message: "Cancha eliminada." });
    } catch (err) { return res.status(500).json({ error: err.message }); }
};

exports.getTorneos = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        return res.json(await leagueDataStore.list('torneos', tenant_id));
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addTorneo = async (req, res) => {
    const { slug } = req.params;
    const { nombre, categoria, formato, fecha_inicio, fecha_fin, estatus, premio } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });
        if (!categoria || !String(categoria).trim()) {
            return res.status(400).json({ error: "La categoría del torneo es obligatoria" });
        }
        const categoriaNormalizada = String(categoria).trim();
        if (!ALLOWED_TOURNAMENT_CATEGORIES.includes(categoriaNormalizada)) {
            return res.status(400).json({ error: "Categoría no válida para torneo" });
        }
        const id = uuidv4();

        const created = await leagueDataStore.insert('torneos', {
                id,
                tenant_id,
                nombre,
                categoria: categoriaNormalizada,
                formato: formato || 'Liga (Todos contra todos)',
                fecha_inicio: fecha_inicio || null,
                fecha_fin: fecha_fin || null,
                estatus: estatus || 'En Registro',
                premio: premio || '',
                cobros: defaultCobrosTorneo
            });
            return res.json(created);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getTournamentEnrollments = async (req, res) => {
    const { slug, torneoId } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: 'Liga no encontrada' });
        const torneo = await leagueDataStore.getById('torneos', torneoId, tenant_id);
        if (!torneo) return res.status(404).json({ error: 'Torneo no encontrado' });

        const representatives = await leagueDataStore.list('representantes', tenant_id);
        const byRep = new Map(representatives.map((r) => [r.id, r]));

        const inscripciones = (await leagueDataStore.list('inscripciones', tenant_id))
            .filter((i) => i.torneo_id === torneoId)
            .map((i) => ({
                ...i,
                representante: byRep.get(i.representante_id)
                    ? {
                        id: byRep.get(i.representante_id).id,
                        nombre_representante: byRep.get(i.representante_id).nombre_representante,
                        email: byRep.get(i.representante_id).email
                    }
                    : null
            }));

        return res.json({ torneo: { id: torneo.id, nombre: torneo.nombre }, inscripciones });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.updateTorneoEnrollmentConfig = async (req, res) => {
    const { slug, id } = req.params;
    const { costo_total } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: 'Liga no encontrada' });
        const torneo = await leagueDataStore.getById('torneos', id, tenant_id);
        if (!torneo) return res.status(404).json({ error: 'Torneo no encontrado' });

        const toMoney = (v) => {
            const n = Number(v);
            return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : 0;
        };

        const cobros = {
            costo_total: toMoney(costo_total)
        };

        const updated = await leagueDataStore.update('torneos', id, tenant_id, { cobros });
        return res.json({ message: 'Cobros de inscripción actualizados', torneo: updated });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.getPublicEnrollmentInfo = async (req, res) => {
    const { slug, torneoId } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: 'Liga no encontrada' });
        const torneo = await leagueDataStore.getById('torneos', torneoId, tenant_id);
        if (!torneo) return res.status(404).json({ error: 'Torneo no encontrado' });

        return res.json({
            torneo: {
                id: torneo.id,
                nombre: torneo.nombre,
                categoria: torneo.categoria,
                estatus: torneo.estatus,
                cobros: normalizeCobros(torneo.cobros)
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.registerRepresentativeInTournament = async (req, res) => {
    const { slug, torneoId } = req.params;
    const { nombre_representante, email, password, nombre_equipo, jugadores } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: 'Liga no encontrada' });
if (!nombre_representante || !email || !password || !nombre_equipo) {
            return res.status(400).json({ error: 'Faltan datos obligatorios del representante/equipo.' });
        }
        if (!validatePasswordPolicy(password)) {
            return res.status(400).json({ error: 'La contraseña no cumple la política de seguridad.' });
        }
        const payment = req.body.payment || {};
        const cleanCard = String(payment.cardNumber || '').replace(/\s+/g, '');
        const holder = String(payment.holder || '').trim();
        const expiry = String(payment.expiry || '').trim();
        const cvv = String(payment.cvv || '').trim();
        if (!/^\d{16}$/.test(cleanCard)) {
            return res.status(400).json({ error: 'Número de tarjeta inválido (16 dígitos).' });
        }
        if (!holder) {
            return res.status(400).json({ error: 'Debes ingresar el titular de la tarjeta.' });
        }
        if (!/^\d{2}\/\d{2}$/.test(expiry)) {
            return res.status(400).json({ error: 'Vencimiento inválido. Usa MM/AA.' });
        }
        const [expiryMonthRaw, expiryYearRaw] = expiry.split('/');
        const expiryMonth = Number(expiryMonthRaw);
        const expiryYear2d = Number(expiryYearRaw);
        if (!Number.isFinite(expiryMonth) || expiryMonth < 1 || expiryMonth > 12) {
            return res.status(400).json({ error: 'Mes de vencimiento inválido. Debe estar entre 01 y 12.' });
        }
        const now = new Date();
        const currentYear2d = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;
        if (expiryYear2d < currentYear2d || (expiryYear2d === currentYear2d && expiryMonth < currentMonth)) {
            return res.status(400).json({ error: 'La tarjeta está vencida.' });
        }
        if (!/^\d{3,4}$/.test(cvv)) {
            return res.status(400).json({ error: 'CVV inválido.' });
        }

        const torneo = await leagueDataStore.getById('torneos', torneoId, tenant_id);
        if (!torneo) return res.status(404).json({ error: 'Torneo no encontrado' });

        const estatusTorneo = String(torneo.estatus || '').toLowerCase();
        if (estatusTorneo === 'finalizado' || estatusTorneo === 'pausado') {
            return res.status(400).json({ error: 'Este torneo no acepta nuevas inscripciones.' });
        }

        const emailNorm = String(email).toLowerCase().trim();
        const representatives = await leagueDataStore.list('representantes', tenant_id);
        let representative = representatives.find((r) => String(r.email).toLowerCase() === emailNorm);
        if (!representative) {
            representative = await leagueDataStore.insert('representantes', {
                id: uuidv4(),
                tenant_id,
                nombre_representante: String(nombre_representante).trim(),
                email: emailNorm,
                password: await bcrypt.hash(password, 10),
                equipo_principal: String(nombre_equipo).trim(),
                fecha_registro: new Date().toISOString()
            });
        } else {
            const valid = await bcrypt.compare(password, representative.password);
            if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta para ese representante.' });
        }

        const yaInscrito = (await leagueDataStore.list('inscripciones', tenant_id))
            .find((i) => i.torneo_id === torneoId && i.representante_id === representative.id);
        if (yaInscrito) {
            return res.status(409).json({ error: 'El representante ya está inscrito en este torneo.' });
        }

        const jugadoresList = Array.isArray(jugadores)
            ? jugadores
                .map((j) => {
                    if (typeof j === 'string') {
                        const nombre = String(j).trim();
                        return nombre ? { nombre, numero_playera: null } : null;
                    }
                    if (j && typeof j === 'object') {
                        const nombre = String(j.nombre || '').trim();
                        const apellido_paterno = String(j.apellido_paterno || '').trim();
                        const apellido_materno = String(j.apellido_materno || '').trim();
                        const numeroParsed = Number(j.numero_playera);
                        const numero_playera = Number.isFinite(numeroParsed) && numeroParsed > 0 ? Math.trunc(numeroParsed) : null;
                        const curp = String(j.curp || '').toUpperCase().trim();
                        const rol_liderazgo = String(j.rol_liderazgo || 'Ninguno').trim();
                        const foto_jugador = String(j.foto_jugador || '').trim();
                        return nombre ? { nombre, apellido_paterno, apellido_materno, numero_playera, curp, rol_liderazgo, foto_jugador } : null;
                    }
                    return null;
                })
                .filter(Boolean)
            : [];
        if (jugadoresList.some((j) => !j.apellido_paterno || !j.apellido_materno)) {
            return res.status(400).json({ error: 'Todos los jugadores deben incluir apellido paterno y materno.' });
        }
        if (jugadoresList.some((j) => !isValidCurp(j.curp))) {
            return res.status(400).json({ error: 'Alguna CURP de jugador no es válida.' });
        }
        const curpsSet = new Set(jugadoresList.map((j) => String(j.curp).toUpperCase()));
        if (curpsSet.size !== jugadoresList.length) {
            return res.status(400).json({ error: 'No se permiten CURPs repetidas en la misma inscripción.' });
        }
        const capitanes = jugadoresList.filter((j) => j.rol_liderazgo === 'Capitán').length;
        const subcapitanes = jugadoresList.filter((j) => j.rol_liderazgo === 'Subcapitán').length;
        if (capitanes > 1) return res.status(400).json({ error: 'Solo se permite un capitán por equipo.' });
        if (subcapitanes > 1) return res.status(400).json({ error: 'Solo se permite un subcapitán por equipo.' });

        const color_playera = String(req.body.color_playera || '').trim();
        const color_short = String(req.body.color_short || '').trim();
        const color_medias = String(req.body.color_medias || '').trim();
        if (!color_playera || !color_short || !color_medias) {
            return res.status(400).json({ error: 'Debes indicar color de playera, short y medias.' });
        }

        const cobros = normalizeCobros(torneo.cobros);
        const total = Number((Number(cobros.costo_total || 0)).toFixed(2));

        const inscripcion = await leagueDataStore.insert('inscripciones', {
            id: uuidv4(),
            tenant_id,
            torneo_id: torneoId,
            representante_id: representative.id,
            nombre_equipo: String(nombre_equipo).trim(),
            uniforme: {
                color_playera,
                color_short,
                color_medias
            },
            jugadores: jugadoresList,
            desglose_cobro: {
                costo_total: total,
                total_jugadores: jugadoresList.length
            },
            total_cobro: total,
            pago: {
                metodo: 'Tarjeta',
                estado: 'Aprobado (simulación)',
                tarjeta_ultimos4: cleanCard.slice(-4),
                titular: holder,
                referencia: `SIM-REP-${Date.now().toString().slice(-6)}`
            },
            estatus_pago: 'Pagado',
            fecha_registro: new Date().toISOString()
        });

        return res.status(201).json({
            message: 'Inscripción creada. Pendiente de pago con el organizador.',
            representative: {
                id: representative.id,
                nombre_representante: representative.nombre_representante,
                email: representative.email
            },
            inscripcion
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.loginRepresentative = async (req, res) => {
    const { slug } = req.params;
    const { email, password } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: 'Liga no encontrada' });
        const emailNorm = String(email || '').toLowerCase().trim();
        const representative = (await leagueDataStore.list('representantes', tenant_id))
            .find((r) => String(r.email).toLowerCase() === emailNorm);
        if (!representative) return res.status(404).json({ error: 'Representante no encontrado' });

        const valid = await bcrypt.compare(String(password || ''), representative.password);
        if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

        const token = jwt.sign(
            { representativeId: representative.id, tenantId: tenant_id, slug, role: 'Representative' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.json({
            token,
            representative: {
                id: representative.id,
                nombre_representante: representative.nombre_representante,
                email: representative.email
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.getRepresentativeDashboard = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: 'Liga no encontrada' });
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Token de representante requerido.' });
        if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Configuración JWT incompleta.' });

        let decoded = null;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(403).json({ error: 'Token inválido o expirado.' });
        }
        if (decoded.role !== 'Representative' || decoded.slug !== slug || decoded.tenantId !== tenant_id) {
            return res.status(403).json({ error: 'No autorizado para esta liga.' });
        }

        const representatives = await leagueDataStore.list('representantes', tenant_id);
        const representative = representatives.find((r) => r.id === decoded.representativeId);
        if (!representative) return res.status(404).json({ error: 'Representante no encontrado.' });

        const torneos = await leagueDataStore.list('torneos', tenant_id);
        const byTorneo = new Map(torneos.map((t) => [t.id, t]));
        const inscripciones = (await leagueDataStore.list('inscripciones', tenant_id))
            .filter((i) => i.representante_id === representative.id)
            .map((i) => ({
                ...i,
                torneo: byTorneo.get(i.torneo_id)
                    ? {
                        id: byTorneo.get(i.torneo_id).id,
                        nombre: byTorneo.get(i.torneo_id).nombre,
                        categoria: byTorneo.get(i.torneo_id).categoria,
                        estatus: byTorneo.get(i.torneo_id).estatus
                    }
                    : null
            }));

        return res.json({
            representative: {
                id: representative.id,
                nombre_representante: representative.nombre_representante,
                email: representative.email,
                equipo_principal: representative.equipo_principal
            },
            inscripciones
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.addPlayersToEnrollment = async (req, res) => {
    const { slug, inscripcionId } = req.params;
    const { jugadores } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: 'Liga no encontrada' });
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Token de representante requerido.' });
        if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Configuración JWT incompleta.' });

        let decoded = null;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(403).json({ error: 'Token inválido o expirado.' });
        }
        if (decoded.role !== 'Representative' || decoded.slug !== slug || decoded.tenantId !== tenant_id) {
            return res.status(403).json({ error: 'No autorizado para esta liga.' });
        }

        const inscripcion = await leagueDataStore.getById('inscripciones', inscripcionId, tenant_id);
        if (!inscripcion) return res.status(404).json({ error: 'Inscripción no encontrada.' });
        if (inscripcion.representante_id !== decoded.representativeId) {
            return res.status(403).json({ error: 'No autorizado para esta inscripción.' });
        }

        const torneo = await leagueDataStore.getById('torneos', inscripcion.torneo_id, tenant_id);
        const estatusTorneo = String(torneo?.estatus || '').toLowerCase();
        if (estatusTorneo === 'finalizado' || estatusTorneo === 'pausado') {
            return res.status(400).json({ error: 'Este torneo no acepta cambios en las inscripciones.' });
        }

        const nuevosJugadores = Array.isArray(jugadores)
            ? jugadores
                .map((j) => {
                    if (!j || typeof j !== 'object') return null;
                    const nombre = String(j.nombre || '').trim();
                    const apellido_paterno = String(j.apellido_paterno || '').trim();
                    const apellido_materno = String(j.apellido_materno || '').trim();
                    const numeroParsed = Number(j.numero_playera);
                    const numero_playera = Number.isFinite(numeroParsed) && numeroParsed > 0 ? Math.trunc(numeroParsed) : null;
                    const curp = String(j.curp || '').toUpperCase().trim();
                    const rol_liderazgo = String(j.rol_liderazgo || 'Ninguno').trim();
                    const foto_jugador = String(j.foto_jugador || '').trim();
                    return nombre ? { nombre, apellido_paterno, apellido_materno, numero_playera, curp, rol_liderazgo, foto_jugador } : null;
                })
                .filter(Boolean)
            : [];

        if (nuevosJugadores.length === 0) {
            return res.status(400).json({ error: 'Debes enviar al menos un jugador válido.' });
        }
        if (nuevosJugadores.some((j) => !j.apellido_paterno || !j.apellido_materno)) {
            return res.status(400).json({ error: 'Todos los jugadores deben incluir apellido paterno y materno.' });
        }
        if (nuevosJugadores.some((j) => !isValidCurp(j.curp))) {
            return res.status(400).json({ error: 'Alguna CURP de jugador no es válida.' });
        }

        const jugadoresActuales = Array.isArray(inscripcion.jugadores) ? inscripcion.jugadores : [];
        const jugadoresFinal = [...jugadoresActuales, ...nuevosJugadores];

        const curpsSet = new Set(jugadoresFinal.map((j) => String(j.curp).toUpperCase()));
        if (curpsSet.size !== jugadoresFinal.length) {
            return res.status(400).json({ error: 'No se permiten CURPs repetidas en el equipo.' });
        }
        const numeros = jugadoresFinal.map((j) => j.numero_playera).filter((n) => n != null);
        if (new Set(numeros).size !== numeros.length) {
            return res.status(400).json({ error: 'No se permiten números de playera repetidos en el equipo.' });
        }
        const capitanes = jugadoresFinal.filter((j) => j.rol_liderazgo === 'Capitán').length;
        const subcapitanes = jugadoresFinal.filter((j) => j.rol_liderazgo === 'Subcapitán').length;
        if (capitanes > 1) return res.status(400).json({ error: 'Solo se permite un capitán por equipo.' });
        if (subcapitanes > 1) return res.status(400).json({ error: 'Solo se permite un subcapitán por equipo.' });

        const desglose = { ...(inscripcion.desglose_cobro || {}), total_jugadores: jugadoresFinal.length };
        const updated = await leagueDataStore.update('inscripciones', inscripcionId, tenant_id, {
            jugadores: jugadoresFinal,
            desglose_cobro: desglose
        });

        return res.json({
            message: `Se agregaron ${nuevosJugadores.length} jugador(es) al equipo.`,
            inscripcion: updated
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

        const decodeArbitroToken = (req) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return { error: { status: 401, message: 'Token de árbitro requerido.' } };
    if (!process.env.JWT_SECRET) return { error: { status: 500, message: 'Configuración JWT incompleta.' } };
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'Arbitro') return { error: { status: 403, message: 'No autorizado.' } };
        return { decoded };
    } catch {
        return { error: { status: 403, message: 'Token inválido o expirado.' } };
    }
};

// Devuelve todas las ligas donde la matrícula está registrada
const findArbitroLigas = async (matricula) => {
    const matriculaNorm = String(matricula || '').trim().toLowerCase();
    const tenants = await listAllTenants();
    const ligas = [];
    for (const tenant of tenants) {
        const arbitro = (await leagueDataStore.list('arbitros', tenant.id))
            .find((a) => String(a.matricula || '').trim().toLowerCase() === matriculaNorm);
        if (arbitro) {
            ligas.push({ slug: tenant.subdominio_o_slug, nombre: tenant.nombre_liga, tenantId: tenant.id, arbitro });
        }
    }
    return ligas;
};

// Resuelve el contexto (tenant + árbitro) de la liga seleccionada validando la matrícula del token
const resolveArbitroContext = async (decoded, slug) => {
    const slugNorm = String(slug || '').trim();
    if (!slugNorm) return { error: { status: 400, message: 'Debes seleccionar una liga.' } };
    const tenant = await getTenantBySlugFull(slugNorm);
    if (!tenant) return { error: { status: 404, message: 'Liga no encontrada.' } };
    const matriculaNorm = String(decoded.matricula || '').trim().toLowerCase();
    const arbitro = (await leagueDataStore.list('arbitros', tenant.id))
        .find((a) => String(a.matricula || '').trim().toLowerCase() === matriculaNorm);
    if (!arbitro) return { error: { status: 403, message: 'No perteneces al padrón de árbitros de esta liga.' } };
    return { tenant, arbitro };
};

exports.loginArbitro = async (req, res) => {
    const { matricula } = req.body;
    try {
if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Configuración JWT incompleta.' });

        const matriculaNorm = String(matricula || '').trim();
        if (!matriculaNorm) return res.status(400).json({ error: 'Ingresa tu matrícula.' });

        const ligas = await findArbitroLigas(matriculaNorm);
        if (ligas.length === 0) return res.status(404).json({ error: 'Matrícula no registrada en ningún padrón de árbitros.' });

        const token = jwt.sign(
            { matricula: matriculaNorm, role: 'Arbitro' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.json({
            token,
            arbitro: { nombre: ligas[0].arbitro.nombre, matricula: ligas[0].arbitro.matricula },
            ligas: ligas.map((l) => ({ slug: l.slug, nombre: l.nombre }))
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.getArbitroDashboard = async (req, res) => {
    try {
        const { decoded, error } = decodeArbitroToken(req);
        if (error) return res.status(error.status).json({ error: error.message });

        const ligas = await findArbitroLigas(decoded.matricula);
        if (ligas.length === 0) return res.status(404).json({ error: 'Árbitro no encontrado.' });

        const slug = req.query.slug || ligas[0].slug;
        const ctx = await resolveArbitroContext(decoded, slug);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });
        const { tenant, arbitro } = ctx;
        const tenant_id = tenant.id;
        const equipos = await leagueDataStore.list('equipos', tenant_id);
        const byId = new Map(equipos.map((e) => [e.id, e]));
        const excludedTeamId = arbitro.equipo_id || null;

        const partidos = (await leagueDataStore.list('partidos', tenant_id))
            .sort((a, b) => a.jornada - b.jornada)
            .filter((p) => p.arbitro_id === arbitro.id)
            .map((p) => ({
                id: p.id,
                jornada: p.jornada,
                estatus: p.estatus,
                sede: p.sede || null,
                horario: p.horario || null,
                goles_local: p.goles_local,
                goles_visitante: p.goles_visitante,
                stats: p.stats || {},
                local_nombre: byId.get(p.equipo_local_id)?.nombre || 'Local',
                local_escudo: byId.get(p.equipo_local_id)?.escudo || '',
                visitante_nombre: byId.get(p.equipo_visitante_id)?.nombre || 'Visitante',
                visitante_escudo: byId.get(p.equipo_visitante_id)?.escudo || ''
            }));

        // Tabla general: estadísticas de TODOS los equipos con TODOS los partidos de la liga
        const num = (v) => Number(v || 0);
        const statsMap = {};
        const ensureTeam = (nombre, escudo) => {
            if (!nombre) return null;
            if (!statsMap[nombre]) statsMap[nombre] = { nombre, escudo: escudo || '', pj: 0, gf: 0, gc: 0, faltas: 0, amarillas: 0, rojas: 0, corners: 0 };
            if (escudo && !statsMap[nombre].escudo) statsMap[nombre].escudo = escudo;
            return statsMap[nombre];
        };
        const allPartidos = await leagueDataStore.list('partidos', tenant_id);
        for (const p of allPartidos) {
            const st = p.stats || {};
            const faltas = st.faltas || { local: 0, vis: 0 };
            const amarillas = st.amarillas || { local: 0, vis: 0 };
            const rojas = st.rojas || { local: 0, vis: 0 };
            const corners = st.corners || { local: 0, vis: 0 };
            const finalizado = p.estatus === 'Finalizado';
            const local = ensureTeam(byId.get(p.equipo_local_id)?.nombre, byId.get(p.equipo_local_id)?.escudo);
            const visit = ensureTeam(byId.get(p.equipo_visitante_id)?.nombre, byId.get(p.equipo_visitante_id)?.escudo);
            if (local) {
                local.gf += num(p.goles_local); local.gc += num(p.goles_visitante);
                local.faltas += num(faltas.local); local.amarillas += num(amarillas.local); local.rojas += num(rojas.local);
                local.corners += num(corners.local);
                if (finalizado) local.pj++;
            }
            if (visit) {
                visit.gf += num(p.goles_visitante); visit.gc += num(p.goles_local);
                visit.faltas += num(faltas.vis); visit.amarillas += num(amarillas.vis); visit.rojas += num(rojas.vis);
                visit.corners += num(corners.vis);
                if (finalizado) visit.pj++;
            }
        }
        const tablaGeneral = Object.values(statsMap).sort((a, b) => (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf);

        // Jugadores por equipo (desde inscripciones) para poder multar jugadores
        const inscripciones = await leagueDataStore.list('inscripciones', tenant_id);
        const jugadoresPorEquipo = {};
        inscripciones.forEach((ins) => {
            const nombreEquipo = String(ins.nombre_equipo || '').trim();
            if (!nombreEquipo) return;
            const lista = (ins.jugadores || []).map((j) => [j.nombre, j.apellido_paterno, j.apellido_materno].filter(Boolean).join(' '));
            jugadoresPorEquipo[nombreEquipo] = [...(jugadoresPorEquipo[nombreEquipo] || []), ...lista];
        });

        // Lista de equipos (de equipos oficiales + inscripciones)
        const nombresEquipos = new Set(equipos.map((e) => e.nombre).filter(Boolean));
        Object.keys(jugadoresPorEquipo).forEach((n) => nombresEquipos.add(n));

        const multas = (await leagueDataStore.list('multas', tenant_id))
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        return res.json({
            arbitro: {
                id: arbitro.id,
                nombre: arbitro.nombre,
                rol: arbitro.rol,
                matricula: arbitro.matricula,
                categoria: arbitro.categoria,
                equipo_excluido: excludedTeamId ? (byId.get(excludedTeamId)?.nombre || null) : null
            },
            liga: { slug: tenant.subdominio_o_slug, nombre: tenant.nombre_liga || tenant.subdominio_o_slug },
            ligas: ligas.map((l) => ({ slug: l.slug, nombre: l.nombre })),
            partidos,
            tablaGeneral,
            equipos: [...nombresEquipos].sort((a, b) => a.localeCompare(b)),
            jugadoresPorEquipo,
            multas
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.createArbitroMulta = async (req, res) => {
    try {
        const { decoded, error } = decodeArbitroToken(req);
        if (error) return res.status(error.status).json({ error: error.message });

        const ctx = await resolveArbitroContext(decoded, req.body.slug);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });
        const { tenant, arbitro } = ctx;
        const tenant_id = tenant.id;

        const tipo = String(req.body.tipo || '').toLowerCase() === 'jugador' ? 'jugador' : 'equipo';
        const equipo_nombre = String(req.body.equipo_nombre || '').trim();
        const jugador_nombre = String(req.body.jugador_nombre || '').trim();
        const motivo = String(req.body.motivo || '').trim();
        const monto = Number(req.body.monto);
        const jornada = req.body.jornada != null && req.body.jornada !== '' ? Number(req.body.jornada) : null;

        if (!equipo_nombre) return res.status(400).json({ error: 'Debes seleccionar un equipo.' });
        if (tipo === 'jugador' && !jugador_nombre) return res.status(400).json({ error: 'Debes indicar el jugador a multar.' });
        if (!motivo) return res.status(400).json({ error: 'Debes indicar el motivo de la multa.' });
        if (!Number.isFinite(monto) || monto <= 0) return res.status(400).json({ error: 'El monto de la multa debe ser mayor a 0.' });

        const multa = await leagueDataStore.insert('multas', {
            id: uuidv4(),
            tenant_id,
            tipo,
            equipo_nombre,
            jugador_nombre: tipo === 'jugador' ? jugador_nombre : null,
            motivo,
            monto: Number(monto.toFixed(2)),
            jornada: Number.isFinite(jornada) ? jornada : null,
            arbitro_id: arbitro.id,
            arbitro_nombre: arbitro.nombre,
            estatus: 'Pendiente',
            fecha: new Date().toISOString()
        });

        return res.status(201).json({ message: 'Multa registrada correctamente.', multa });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.deleteArbitroMulta = async (req, res) => {
    try {
        const { decoded, error } = decodeArbitroToken(req);
        if (error) return res.status(error.status).json({ error: error.message });

        const ctx = await resolveArbitroContext(decoded, req.query.slug);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });
        const { tenant, arbitro } = ctx;
        const tenant_id = tenant.id;
        const { id } = req.params;
        const multa = await leagueDataStore.getById('multas', id, tenant_id);
        if (!multa) return res.status(404).json({ error: 'Multa no encontrada.' });
        if (multa.arbitro_id !== arbitro.id) {
            return res.status(403).json({ error: 'Solo puedes eliminar multas que tú registraste.' });
        }
        await leagueDataStore.remove('multas', id, tenant_id);
        return res.json({ message: 'Multa eliminada.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.updateArbitroPartido = async (req, res) => {
    try {
        const { decoded, error } = decodeArbitroToken(req);
        if (error) return res.status(error.status).json({ error: error.message });

        const ctx = await resolveArbitroContext(decoded, req.body.slug);
        if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });
        const { tenant, arbitro } = ctx;
        const tenant_id = tenant.id;
        const { id } = req.params;

        const partido = await leagueDataStore.getById('partidos', id, tenant_id);
        if (!partido) return res.status(404).json({ error: 'Partido no encontrado.' });

        // Un árbitro no puede registrar resultados de partidos de su propio equipo
        const excludedTeamId = arbitro.equipo_id || null;
        if (excludedTeamId && (partido.equipo_local_id === excludedTeamId || partido.equipo_visitante_id === excludedTeamId)) {
            return res.status(403).json({ error: 'No puedes registrar resultados de partidos de tu equipo.' });
        }

        const toInt = (v) => {
            const n = Math.trunc(Number(v));
            return Number.isFinite(n) && n >= 0 ? n : 0;
        };

        const goles_local = toInt(req.body.goles_local);
        const goles_visitante = toInt(req.body.goles_visitante);

        const b = req.body || {};
        // Se preservan otras estadísticas que el organizador pudiera haber cargado
        const prevStats = partido.stats && typeof partido.stats === 'object' ? partido.stats : {};
        const stats = {
            ...prevStats,
            faltas: { local: toInt(b.faltas_local), vis: toInt(b.faltas_visitante) },
            amarillas: { local: toInt(b.amarillas_local), vis: toInt(b.amarillas_visitante) },
            rojas: { local: toInt(b.rojas_local), vis: toInt(b.rojas_visitante) },
            corners: { local: toInt(b.corners_local), vis: toInt(b.corners_visitante) }
        };

        const updated = await leagueDataStore.update('partidos', id, tenant_id, {
            goles_local,
            goles_visitante,
            estatus: 'Finalizado',
            stats
        });
        if (!updated) return res.status(404).json({ error: 'Partido no encontrado.' });

        return res.json({ message: 'Resultado y estadísticas registrados correctamente.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

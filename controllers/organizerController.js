const supabase = require('../supabaseClient');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const localTenantStore = require('../db/localTenantStore');
const localLeagueDataStore = require('../db/localLeagueDataStore');
const useLocalDevMode = String(process.env.LOCAL_DEV_MODE || 'false').toLowerCase() === 'true';
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
    if (!CURP_REGEX.test(value)) return false;
    const expected = calculateCurpCheckDigit(value.slice(0, 17));
    return expected !== null && expected === value.slice(17);
};

const defaultCobrosTorneo = {
    mantenimiento_cancha: 0,
    arbitraje: 0,
    inscripcion_equipo: 0,
    costo_por_jugador: 0
};

exports.getEquipos = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        if (useLocalDevMode) {
            const equiposActuales = localLeagueDataStore.list('equipos', tenant_id);
            const inscripciones = localLeagueDataStore.list('inscripciones', tenant_id);
            const normalizedExisting = new Set(
                equiposActuales.map((e) => String(e.nombre || '').toLowerCase().trim())
            );

            inscripciones.forEach((ins) => {
                const nombreEquipo = String(ins.nombre_equipo || '').trim();
                if (!nombreEquipo) return;
                const key = nombreEquipo.toLowerCase();
                if (normalizedExisting.has(key)) return;

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
                localLeagueDataStore.insert('equipos', nuevoEquipo);
                equiposActuales.push(nuevoEquipo);
                normalizedExisting.add(key);
            });

            const data = equiposActuales.sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
            return res.json(data);
        }

        const { data, error } = await supabase
            .from('equipo')
            .select('*')
            .eq('tenant_id', tenant_id)
            .order('puntos', { ascending: false });

        if (error) throw error;
        res.json(data);
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
        if (useLocalDevMode) {
            const created = localLeagueDataStore.insert('equipos', {
                id, tenant_id, nombre, delegado: delegado || '', escudo: escudo || '',
                puntos: 0, partidos_jugados: 0, partidos_ganados: 0, partidos_empatados: 0, partidos_perdidos: 0,
                goles_favor: 0, goles_contra: 0
            });
            return res.json(created);
        }

        const { data, error } = await supabase
            .from('equipo')
            .insert([{ id, tenant_id, nombre, delegado: delegado || '', escudo: escudo || '' }])
            .select();

        if (error) throw error;
        res.json(data[0]);
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
        if (useLocalDevMode) {
            const equiposActuales = localLeagueDataStore.list('equipos', tenant_id);
            let equiposSincronizados = [...equiposActuales];

            // Si no hay suficientes equipos creados manualmente, tomar equipos desde inscripciones.
            if (equiposSincronizados.length < 2) {
                const inscripciones = localLeagueDataStore.list('inscripciones', tenant_id);
                const normalizedExisting = new Set(
                    equiposSincronizados.map((e) => String(e.nombre || '').toLowerCase().trim())
                );

                inscripciones.forEach((ins) => {
                    const nombreEquipo = String(ins.nombre_equipo || '').trim();
                    if (!nombreEquipo) return;
                    const key = nombreEquipo.toLowerCase();
                    if (normalizedExisting.has(key)) return;

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
                    localLeagueDataStore.insert('equipos', nuevoEquipo);
                    equiposSincronizados.push(nuevoEquipo);
                    normalizedExisting.add(key);
                });
            }

            equipos = equiposSincronizados.map((e) => ({ id: e.id }));
        } else {
            const { data: dataEquipos, error: eError } = await supabase
                .from('equipo')
                .select('id')
                .eq('tenant_id', tenant_id);
            if (eError) throw eError;
            equipos = dataEquipos;
        }
        if (equipos.length < 2) return res.status(400).json({ error: "Se necesitan al menos 2 equipos registrados" });

        if (useLocalDevMode) {
            localLeagueDataStore.replaceAll('partidos', tenant_id, []);
        } else {
            const { error: dError } = await supabase
                .from('partido')
                .delete()
                .eq('tenant_id', tenant_id);
            if (dError) throw dError;
        }

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

        // Inserción multi-fila en BD
        if (useLocalDevMode) {
            localLeagueDataStore.replaceAll(
                'partidos',
                tenant_id,
                partidos.map((p) => ({
                    ...p,
                    goles_local: 0,
                    goles_visitante: 0,
                    estatus: 'Pendiente',
                    stats: null,
                    sede: null,
                    horario: null
                }))
            );
        } else {
            const { error: iError } = await supabase
                .from('partido')
                .insert(partidos);
            if (iError) throw iError;
        }

        res.json({ message: "Calendario generado exitosamente", partidos_generados: partidos.length });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.getCalendario = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        if (useLocalDevMode) {
            const equipos = localLeagueDataStore.list('equipos', tenant_id);
            const partidos = localLeagueDataStore.list('partidos', tenant_id).sort((a, b) => a.jornada - b.jornada);
            const byId = new Map(equipos.map((e) => [e.id, e]));
            const result = partidos.map((p) => ({
                ...p,
                local_nombre: byId.get(p.equipo_local_id)?.nombre || 'Local',
                local_escudo: byId.get(p.equipo_local_id)?.escudo || '',
                visitante_nombre: byId.get(p.equipo_visitante_id)?.nombre || 'Visitante',
                visitante_escudo: byId.get(p.equipo_visitante_id)?.escudo || ''
            }));
            return res.json(result);
        }

        // En Supabase, para joins usamos la sintaxis select con relaciones
        const { data, error } = await supabase
            .from('partido')
            .select(`
                id, jornada, goles_local, goles_visitante, estatus, stats, sede, horario,
                local:equipo_local_id (nombre, escudo),
                visitante:equipo_visitante_id (nombre, escudo)
            `)
            .eq('tenant_id', tenant_id)
            .order('jornada', { ascending: true });

        if (error) throw error;

        // Mapear para mantener el formato que espera el frontend
        const result = data.map(p => ({
            ...p,
            local_nombre: p.local.nombre,
            local_escudo: p.local.escudo,
            visitante_nombre: p.visitante.nombre,
            visitante_escudo: p.visitante.escudo
        }));

        res.json(result);
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

        if (useLocalDevMode) {
            const partidoLocal = localLeagueDataStore.getById('partidos', id, tenant_id);
            if (!partidoLocal) return res.status(404).json({ error: "Partido no encontrado" });
            localLeagueDataStore.update('partidos', id, tenant_id, {
                goles_local,
                goles_visitante,
                estatus: 'Finalizado',
                stats
            });
            return res.json({ message: "Marcador y estadísticas cargadas oficialmente." });
        }

        const { data: partido, error: pError } = await supabase
            .from('partido')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', tenant_id)
            .single();

        if (pError || !partido) return res.status(404).json({ error: "Partido no encontrado" });
        
        if (partido.estatus === 'Finalizado') {
            await supabase
                .from('partido')
                .update({ stats })
                .eq('id', id);
            return res.json({ message: "Acta estadística editada exitosamente." });
        }
        
        const { error: uError } = await supabase
            .from('partido')
            .update({ 
                goles_local, 
                goles_visitante, 
                estatus: 'Finalizado', 
                stats 
            })
            .eq('id', id);

        if (uError) throw uError;
        
        let ptsLocal = 0, ptsVis = 0, pG_local = 0, pG_vis = 0, pE_local = 0, pE_vis = 0, pP_local = 0, pP_vis = 0;
        
        if (goles_local > goles_visitante) { ptsLocal = 3; pG_local = 1; pP_vis = 1; }
        else if (goles_visitante > goles_local) { ptsVis = 3; pG_vis = 1; pP_local = 1; }
        else { ptsLocal = 1; ptsVis = 1; pE_local = 1; pE_vis = 1; }
        
        // Actualización de equipos con lógica de incremento
        // Nota: RPC o actualizaciones individuales son necesarias para incrementos atómicos en Supabase
        // Aquí usaremos una combinación
        
        const updateEquipo = async (equipoId, g, e, p, gf, gc, pts) => {
            const { data: eq } = await supabase.from('equipo').select('*').eq('id', equipoId).single();
            await supabase.from('equipo').update({
                partidos_jugados: eq.partidos_jugados + 1,
                partidos_ganados: eq.partidos_ganados + g,
                partidos_empatados: eq.partidos_empatados + e,
                partidos_perdidos: eq.partidos_perdidos + p,
                goles_favor: eq.goles_favor + gf,
                goles_contra: eq.goles_contra + gc,
                puntos: eq.puntos + pts
            }).eq('id', equipoId);
        };

        await updateEquipo(partido.equipo_local_id, pG_local, pE_local, pP_local, goles_local, goles_visitante, ptsLocal);
        await updateEquipo(partido.equipo_visitante_id, pG_vis, pE_vis, pP_vis, goles_visitante, goles_local, ptsVis);

        res.json({ message: "Marcador y estadísticas cargadas oficialmente." });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateProgramacion = async (req, res) => {
    const { slug, id } = req.params;
    const { sede, horario } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        if (useLocalDevMode) {
            const updated = localLeagueDataStore.update('partidos', id, tenant_id, { sede: sede || null, horario: horario || null });
            if (!updated) return res.status(404).json({ error: "Partido no encontrado" });
            return res.json({ message: "Programación actualizada exitosamente." });
        }

        const { error } = await supabase
            .from('partido')
            .update({ sede: sede || null, horario: horario || null })
            .eq('id', id)
            .eq('tenant_id', tenant_id);

        if (error) throw error;
        res.json({ message: "Programación actualizada exitosamente." });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getArbitros = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        if (useLocalDevMode) {
            const data = localLeagueDataStore.list('arbitros', tenant_id).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
            return res.json(data);
        }

        const { data, error } = await supabase
            .from('arbitro')
            .select('*')
            .eq('tenant_id', tenant_id)
            .order('nombre', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addArbitro = async (req, res) => {
    const { slug } = req.params;
    const { nombre, rol, matricula, categoria } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });
        const id = uuidv4();

        if (useLocalDevMode) {
            const created = localLeagueDataStore.insert('arbitros', {
                id,
                tenant_id,
                nombre,
                rol: rol || 'Central',
                matricula: matricula || '',
                categoria: categoria || 'General',
                disponibilidad: true
            });
            return res.json(created);
        }

        const { data, error } = await supabase
            .from('arbitro')
            .insert([{ 
                id, 
                tenant_id, 
                nombre, 
                rol: rol || 'Central', 
                matricula: matricula || '', 
                categoria: categoria || 'General', 
                disponibilidad: true 
            }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateArbitro = async (req, res) => {
    const { slug, id } = req.params;
    const { nombre, rol, matricula, categoria } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });
        
        if (useLocalDevMode) {
            const updated = localLeagueDataStore.update('arbitros', id, tenant_id, { nombre, rol, matricula, categoria });
            if (!updated) return res.status(404).json({ error: "Árbitro no encontrado" });
            return res.json({ message: "Árbitro actualizado exitosamente" });
        }

        const { error } = await supabase
            .from('arbitro')
            .update({ nombre, rol, matricula, categoria })
            .eq('id', id)
            .eq('tenant_id', tenant_id);

        if (error) throw error;
        res.json({ message: "Árbitro actualizado exitosamente" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteArbitro = async (req, res) => {
    const { slug, id } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });
        
        if (useLocalDevMode) {
            const deleted = localLeagueDataStore.remove('arbitros', id, tenant_id);
            if (!deleted) return res.status(404).json({ error: "Árbitro no encontrado" });
            return res.json({ message: "Registro eliminado" });
        }

        const { error } = await supabase
            .from('arbitro')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenant_id);

        if (error) throw error;
        res.json({ message: "Registro eliminado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getTorneos = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

        if (useLocalDevMode) {
            return res.json(localLeagueDataStore.list('torneos', tenant_id));
        }

        const { data, error } = await supabase
            .from('torneo')
            .select('*')
            .eq('tenant_id', tenant_id);

        if (error) throw error;
        res.json(data);
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

        if (useLocalDevMode) {
            const created = localLeagueDataStore.insert('torneos', {
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
        }

        const { data, error } = await supabase
            .from('torneo')
            .insert([{ 
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
            }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getTournamentEnrollments = async (req, res) => {
    const { slug, torneoId } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: 'Liga no encontrada' });

        if (!useLocalDevMode) {
            return res.status(501).json({ error: 'Consulta de inscripciones disponible en modo local por ahora.' });
        }

        const torneo = localLeagueDataStore.getById('torneos', torneoId, tenant_id);
        if (!torneo) return res.status(404).json({ error: 'Torneo no encontrado' });

        const representatives = localLeagueDataStore.list('representantes', tenant_id);
        const byRep = new Map(representatives.map((r) => [r.id, r]));

        const inscripciones = localLeagueDataStore
            .list('inscripciones', tenant_id)
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
    const { mantenimiento_cancha, arbitraje, inscripcion_equipo, costo_por_jugador } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: 'Liga no encontrada' });

        if (!useLocalDevMode) {
            return res.status(501).json({ error: 'Configuración de cobros disponible en modo local por ahora.' });
        }

        const torneo = localLeagueDataStore.getById('torneos', id, tenant_id);
        if (!torneo) return res.status(404).json({ error: 'Torneo no encontrado' });

        const toMoney = (v) => {
            const n = Number(v);
            return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : 0;
        };

        const cobros = {
            mantenimiento_cancha: toMoney(mantenimiento_cancha),
            arbitraje: toMoney(arbitraje),
            inscripcion_equipo: toMoney(inscripcion_equipo),
            costo_por_jugador: toMoney(costo_por_jugador)
        };

        const updated = localLeagueDataStore.update('torneos', id, tenant_id, { cobros });
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

        if (!useLocalDevMode) {
            return res.status(501).json({ error: 'Inscripción pública disponible en modo local por ahora.' });
        }

        const torneo = localLeagueDataStore.getById('torneos', torneoId, tenant_id);
        if (!torneo) return res.status(404).json({ error: 'Torneo no encontrado' });

        return res.json({
            torneo: {
                id: torneo.id,
                nombre: torneo.nombre,
                categoria: torneo.categoria,
                estatus: torneo.estatus,
                cobros: { ...defaultCobrosTorneo, ...(torneo.cobros || {}) }
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

        if (!useLocalDevMode) {
            return res.status(501).json({ error: 'Inscripción pública disponible en modo local por ahora.' });
        }

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
        if (!/^\d{3,4}$/.test(cvv)) {
            return res.status(400).json({ error: 'CVV inválido.' });
        }

        const torneo = localLeagueDataStore.getById('torneos', torneoId, tenant_id);
        if (!torneo) return res.status(404).json({ error: 'Torneo no encontrado' });

        const estatusTorneo = String(torneo.estatus || '').toLowerCase();
        if (estatusTorneo === 'finalizado' || estatusTorneo === 'pausado') {
            return res.status(400).json({ error: 'Este torneo no acepta nuevas inscripciones.' });
        }

        const emailNorm = String(email).toLowerCase().trim();
        const representatives = localLeagueDataStore.list('representantes', tenant_id);
        let representative = representatives.find((r) => String(r.email).toLowerCase() === emailNorm);
        if (!representative) {
            representative = localLeagueDataStore.insert('representantes', {
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

        const yaInscrito = localLeagueDataStore
            .list('inscripciones', tenant_id)
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
        if (jugadoresList.some((j) => !j.foto_jugador)) {
            return res.status(400).json({ error: 'Todos los jugadores deben incluir foto.' });
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

        const cobros = { ...defaultCobrosTorneo, ...(torneo.cobros || {}) };
        const costoUnitarioPorJugador = Number(cobros.mantenimiento_cancha || 0) +
            Number(cobros.arbitraje || 0) +
            Number(cobros.inscripcion_equipo || 0) +
            Number(cobros.costo_por_jugador || 0);
        const total = Number(
            (
                costoUnitarioPorJugador * jugadoresList.length
            ).toFixed(2)
        );

        const inscripcion = localLeagueDataStore.insert('inscripciones', {
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
                mantenimiento_cancha: Number(cobros.mantenimiento_cancha || 0),
                arbitraje: Number(cobros.arbitraje || 0),
                inscripcion_equipo: Number(cobros.inscripcion_equipo || 0),
                costo_por_jugador: Number(cobros.costo_por_jugador || 0),
                costo_unitario_por_jugador: Number(costoUnitarioPorJugador.toFixed(2)),
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

        if (!useLocalDevMode) {
            return res.status(501).json({ error: 'Login de representante disponible en modo local por ahora.' });
        }

        const emailNorm = String(email || '').toLowerCase().trim();
        const representative = localLeagueDataStore
            .list('representantes', tenant_id)
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

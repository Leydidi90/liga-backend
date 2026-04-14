const supabase = require('../supabaseClient');
const { v4: uuidv4 } = require('uuid');

const getTenantIdBySlug = async (slug) => {
    const { data, error } = await supabase
        .from('tenant')
        .select('id')
        .eq('subdominio_o_slug', slug)
        .single();
    if (error || !data) return null;
    return data.id;
};

exports.getEquipos = async (req, res) => {
    const { slug } = req.params;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });

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

        const { data: equipos, error: eError } = await supabase
            .from('equipo')
            .select('id')
            .eq('tenant_id', tenant_id);

        if (eError) throw eError;
        if (equipos.length < 2) return res.status(400).json({ error: "Se necesitan al menos 2 equipos registrados" });

        // Limpiar el calendario actual estrictamente de ESTE TENANT
        const { error: dError } = await supabase
            .from('partido')
            .delete()
            .eq('tenant_id', tenant_id);
            
        if (dError) throw dError;

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
        const { error: iError } = await supabase
            .from('partido')
            .insert(partidos);

        if (iError) throw iError;

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
    const { nombre, formato, fecha_inicio, fecha_fin, estatus, premio } = req.body;
    try {
        const tenant_id = await getTenantIdBySlug(slug);
        if (!tenant_id) return res.status(404).json({ error: "Liga no encontrada" });
        const id = uuidv4();

        const { data, error } = await supabase
            .from('torneo')
            .insert([{ 
                id, 
                tenant_id, 
                nombre, 
                formato: formato || 'Liga (Todos contra todos)', 
                fecha_inicio: fecha_inicio || null, 
                fecha_fin: fecha_fin || null, 
                estatus: estatus || 'En Registro', 
                premio: premio || '' 
            }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

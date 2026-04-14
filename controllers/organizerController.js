const db = require('../db/database.js');
const { v4: uuidv4 } = require('uuid');

exports.getEquipos = async (req, res) => {
    const { slug } = req.params;
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        const tenant_id = tRows[0].id;

        const { rows } = await db.query(`SELECT * FROM Equipo WHERE tenant_id = $1 ORDER BY puntos DESC`, [tenant_id]);
        res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.addEquipo = async (req, res) => {
    const { slug } = req.params;
    const { nombre, delegado, escudo } = req.body;
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        const tenant_id = tRows[0].id;

        const id = uuidv4();
        await db.query(`INSERT INTO Equipo (id, tenant_id, nombre, delegado, escudo) VALUES ($1, $2, $3, $4, $5)`, [id, tenant_id, nombre, delegado || '', escudo || '']);
        res.json({ id, tenant_id, nombre, delegado, escudo, puntos: 0, partidos_jugados: 0 });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Algoritmo Matemático Round Robin
exports.generateRoundRobin = async (req, res) => {
    const { slug } = req.params;
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        const tenant_id = tRows[0].id;

        const { rows: equipos } = await db.query(`SELECT id FROM Equipo WHERE tenant_id = $1`, [tenant_id]);
        if (equipos.length < 2) return res.status(400).json({ error: "Se necesitan al menos 2 equipos registrados" });

        // Limpiar el calendario actual estrictamente de ESTE TENANT
        await db.query(`DELETE FROM Partido WHERE tenant_id = $1`, [tenant_id]);

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
        for (let p of partidos) {
            await db.query(
                `INSERT INTO Partido (id, tenant_id, jornada, equipo_local_id, equipo_visitante_id) VALUES ($1, $2, $3, $4, $5)`,
                [p.id, p.tenant_id, p.jornada, p.equipo_local_id, p.equipo_visitante_id]
            );
        }

        res.json({ message: "Calendario generado exitosamente", partidos_generados: partidos.length });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.getCalendario = async (req, res) => {
    const { slug } = req.params;
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        const tenant_id = tRows[0].id;

        const query = `
            SELECT p.id, p.jornada, p.goles_local, p.goles_visitante, p.estatus, p.stats, p.sede, p.horario,
                   loc.nombre AS local_nombre, vis.nombre AS visitante_nombre, loc.escudo AS local_escudo, vis.escudo AS visitante_escudo
            FROM Partido p
            JOIN Equipo loc ON p.equipo_local_id = loc.id
            JOIN Equipo vis ON p.equipo_visitante_id = vis.id
            WHERE p.tenant_id = $1
            ORDER BY p.jornada ASC
        `;
        const { rows } = await db.query(query, [tenant_id]);
        res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.updatePartido = async (req, res) => {
    const { slug, id } = req.params;
    const { goles_local, goles_visitante, stats } = req.body;
    
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        const tenant_id = tRows[0].id;

        const { rows: pRows } = await db.query(`SELECT * FROM Partido WHERE id = $1 AND tenant_id = $2`, [id, tenant_id]);
        if (pRows.length === 0) return res.status(404).json({ error: "Partido no encontrado" });
        
        const partido = pRows[0];
        
        if (partido.estatus === 'Finalizado') {
            await db.query(`UPDATE Partido SET stats = $1 WHERE id = $2`, [stats ? JSON.stringify(stats) : null, id]);
            return res.json({ message: "Acta estadística editada exitosamente." });
        }
        
        await db.query(
            `UPDATE Partido SET goles_local = $1, goles_visitante = $2, estatus = 'Finalizado', stats = $3 WHERE id = $4`, 
            [goles_local, goles_visitante, stats ? JSON.stringify(stats) : null, id]
        );
        
        let ptsLocal = 0, ptsVis = 0, pG_local = 0, pG_vis = 0, pE_local = 0, pE_vis = 0, pP_local = 0, pP_vis = 0;
        
        if (goles_local > goles_visitante) { ptsLocal = 3; pG_local = 1; pP_vis = 1; }
        else if (goles_visitante > goles_local) { ptsVis = 3; pG_vis = 1; pP_local = 1; }
        else { ptsLocal = 1; ptsVis = 1; pE_local = 1; pE_vis = 1; }
        
        await db.query(`UPDATE Equipo SET 
            partidos_jugados = partidos_jugados + 1, partidos_ganados = partidos_ganados + $1, partidos_empatados = partidos_empatados + $2, partidos_perdidos = partidos_perdidos + $3, goles_favor = goles_favor + $4, goles_contra = goles_contra + $5, puntos = puntos + $6
            WHERE id = $7`, [pG_local, pE_local, pP_local, goles_local, goles_visitante, ptsLocal, partido.equipo_local_id]);
            
        await db.query(`UPDATE Equipo SET 
            partidos_jugados = partidos_jugados + 1, partidos_ganados = partidos_ganados + $1, partidos_empatados = partidos_empatados + $2, partidos_perdidos = partidos_perdidos + $3, goles_favor = goles_favor + $4, goles_contra = goles_contra + $5, puntos = puntos + $6
            WHERE id = $7`, [pG_vis, pE_vis, pP_vis, goles_visitante, goles_local, ptsVis, partido.equipo_visitante_id]);

        res.json({ message: "Marcador y estadísticas cargadas oficialmente." });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateProgramacion = async (req, res) => {
    const { slug, id } = req.params;
    const { sede, horario } = req.body;
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        await db.query(
            `UPDATE Partido SET sede = $1, horario = $2 WHERE id = $3 AND tenant_id = $4`,
            [sede || null, horario || null, id, tRows[0].id]
        );
        res.json({ message: "Programación actualizada exitosamente." });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getArbitros = async (req, res) => {
    const { slug } = req.params;
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        const { rows } = await db.query(`
            SELECT a.*, e.nombre AS equipo_asignado_nombre 
            FROM Arbitro a
            LEFT JOIN Equipo e ON a.equipo_id = e.id
            WHERE a.tenant_id = $1
            ORDER BY a.nombre ASC
        `, [tRows[0].id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addArbitro = async (req, res) => {
    const { slug } = req.params;
    const { nombre, rol, matricula, categoria, equipo_id } = req.body;
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        const id = uuidv4();
        
        let equipo = equipo_id && equipo_id !== '' ? equipo_id : null;
        let disponibilidad = equipo ? false : true; // If assigned to a team, he's basically taken

        await db.query(
            `INSERT INTO Arbitro (id, tenant_id, nombre, rol, matricula, categoria, equipo_id, disponibilidad) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, 
            [id, tRows[0].id, nombre, rol || 'Central', matricula || '', categoria || 'General', equipo, disponibilidad]
        );
        res.json({ id, nombre, rol, matricula, categoria, equipo_id: equipo, disponibilidad });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateArbitro = async (req, res) => {
    const { slug, id } = req.params;
    const { nombre, rol, matricula, categoria, equipo_id } = req.body;
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        
        let equipo = equipo_id && equipo_id !== '' ? equipo_id : null;
        let disponibilidad = equipo ? false : true;

        await db.query(
            `UPDATE Arbitro SET nombre = COALESCE($1, nombre), rol = COALESCE($2, rol), matricula = COALESCE($3, matricula), categoria = COALESCE($4, categoria), equipo_id = $5, disponibilidad = $6 WHERE id = $7 AND tenant_id = $8`,
            [nombre, rol, matricula, categoria, equipo, disponibilidad, id, tRows[0].id]
        );
        res.json({ message: "Árbitro actualizado exitosamente" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteArbitro = async (req, res) => {
    const { slug, id } = req.params;
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        
        await db.query(`DELETE FROM Arbitro WHERE id = $1 AND tenant_id = $2`, [id, tRows[0].id]);
        res.json({ message: "Registro eliminado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getTorneos = async (req, res) => {
    const { slug } = req.params;
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        const { rows } = await db.query(`SELECT * FROM Torneo WHERE tenant_id = $1`, [tRows[0].id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addTorneo = async (req, res) => {
    const { slug } = req.params;
    const { nombre, formato, fecha_inicio, fecha_fin, estatus, premio } = req.body;
    try {
        const { rows: tRows } = await db.query(`SELECT id FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (tRows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        const id = uuidv4();
        await db.query(
            `INSERT INTO Torneo (id, tenant_id, nombre, formato, fecha_inicio, fecha_fin, estatus, premio) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, 
            [id, tRows[0].id, nombre, formato || 'Liga (Todos contra todos)', fecha_inicio || null, fecha_fin || null, estatus || 'En Registro', premio || '']
        );
        res.json({ id, nombre, formato: formato || 'Liga (Todos contra todos)', fecha_inicio, fecha_fin, estatus: estatus || 'En Registro', premio });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

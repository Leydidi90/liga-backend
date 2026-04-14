const db = require('../db/database.js');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Alta de liga
exports.createTenant = async (req, res) => {
    const { nombre_liga, subdominio_o_slug, plan, dueno_nombre, dueno_email, password } = req.body;
    
    // Generar datos default
    const id = uuidv4();
    const fecha_registro = new Date().toISOString();
    
    // Sumar 30 días default
    const fecha_obj = new Date();
    fecha_obj.setDate(fecha_obj.getDate() + 30);
    const fecha_vencimiento = fecha_obj.toISOString();
    const estatus_pago = true; // Activo (booleano Postgres)

    try {
        // Hashear contraseña antes de guardar
        const hashedPassword = await bcrypt.hash(password || 'ligamaster2026', 10);

        const query = `INSERT INTO Tenant (id, nombre_liga, subdominio_o_slug, fecha_registro, estatus_pago, plan, fecha_vencimiento, dueno_nombre, dueno_email, password)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
                       
        await db.query(query, [id, nombre_liga, subdominio_o_slug, fecha_registro, estatus_pago, plan, fecha_vencimiento, dueno_nombre, dueno_email, hashedPassword]);
        res.status(201).json({ id, nombre_liga, subdominio_o_slug, estatus_pago: true, plan, fecha_vencimiento, dueno_nombre, dueno_email });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Obtener todas las ligas
exports.getTenants = async (req, res) => {
    const query = `SELECT * FROM Tenant ORDER BY fecha_registro DESC`;
    try {
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Baja/Suspensión - Cambiar estatus de pago / acceso
exports.updateTenantStatus = async (req, res) => {
    const { id } = req.params;
    const { estatus_pago } = req.body; // boolean

    const query = `UPDATE Tenant SET estatus_pago = $1 WHERE id = $2`;
    try {
        const result = await db.query(query, [estatus_pago, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Tenant no encontrado" });
        res.json({ message: "Estatus actualizado", id, estatus_pago });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Simulación de Pago - Extender vida mes
exports.simulatePayment = async (req, res) => {
    const { id } = req.params;
    
    try {
        const { rows } = await db.query(`SELECT fecha_vencimiento FROM Tenant WHERE id = $1`, [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Tenant no encontrado" });
        
        const row = rows[0];
        const currentDate = new Date();
        let vencimiento = new Date(row.fecha_vencimiento);
        
        if (currentDate > vencimiento) {
             vencimiento = new Date();
        }
        vencimiento.setDate(vencimiento.getDate() + 30);
        const nuevaFechaStr = vencimiento.toISOString();

        await db.query(`UPDATE Tenant SET fecha_vencimiento = $1, estatus_pago = true WHERE id = $2`, [nuevaFechaStr, id]);
        res.json({ message: "Pago registrado exitosamente", id, nueva_fecha_vencimiento: nuevaFechaStr, estatus_pago: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Middleware para verificar dominio
exports.verifyTenantMiddleware = async (req, res, next) => {
    const slug = req.params.slug;
    
    try {
        const { rows } = await db.query(`SELECT id, nombre_liga, estatus_pago, fecha_vencimiento, plan, dueno_nombre, dueno_email FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (rows.length === 0) return res.status(404).json({ error: "Liga no encontrada" });
        
        const row = rows[0];
        if (!row.estatus_pago) {
            return res.status(403).json({ error: "Servicio Suspendido", data: row });
        }
        
        const currentDate = new Date();
        const expirationDate = new Date(row.fecha_vencimiento);
        if (currentDate > expirationDate) {
            await db.query(`UPDATE Tenant SET estatus_pago = false WHERE id = $1`, [row.id]);
            return res.status(403).json({ error: "Servicio Suspendido por falta de pago", data: {...row, estatus_pago: false} });
        }
        
        res.json({ message: "Tenant Activo", data: row });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Edición: Modificar datos de contacto o cambiar plan
exports.updateTenant = async (req, res) => {
    const { id } = req.params;
    const { dueno_nombre, dueno_email, plan, password } = req.body;

    try {
        let query;
        let params;

        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            query = `UPDATE Tenant SET dueno_nombre = $1, dueno_email = $2, plan = $3, password = $4 WHERE id = $5`;
            params = [dueno_nombre, dueno_email, plan, hashedPassword, id];
        } else {
            query = `UPDATE Tenant SET dueno_nombre = $1, dueno_email = $2, plan = $3 WHERE id = $4`;
            params = [dueno_nombre, dueno_email, plan, id];
        }

        const result = await db.query(query, params);
        if (result.rowCount === 0) return res.status(404).json({ error: "Tenant no encontrado" });
        res.json({ message: "Tenant actualizado", id });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Login de Organizador (Tenant)
exports.loginTenant = async (req, res) => {
    const { slug, password } = req.body;

    try {
        const { rows } = await db.query(`SELECT id, subdominio_o_slug, password, nombre_liga FROM Tenant WHERE subdominio_o_slug = $1`, [slug]);
        if (rows.length === 0) return res.status(401).json({ error: "Liga no registrada" });

        const tenant = rows[0];
        const valid = await bcrypt.compare(password, tenant.password);
        if (!valid) return res.status(401).json({ error: "Contraseña incorrecta" });

        // Token firmado con el SLUG para validación multi-tenant
        const token = jwt.sign(
            { tenantId: tenant.id, slug: tenant.subdominio_o_slug, role: 'Organizer' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, nombre_liga: tenant.nombre_liga, slug: tenant.subdominio_o_slug });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Middleware de Autenticación para Organizadores (Multi-Tenant Isolation)
exports.authTenantMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const slugParams = req.params.slug; // El slug que el usuario intenta acceder

    if (!token) return res.status(401).json({ error: "Token de acceso faltante" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // SEGURIDAD CRÍTICA: Validar que el token pertenezca al SLUG de la URL
        if (decoded.role !== 'Organizer' || decoded.slug !== slugParams) {
            return res.status(403).json({ error: "No tienes permiso para gestionar esta liga" });
        }

        req.tenant = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: "Token inválido o expirado" });
    }
};

// Enviar Correos con Nodemailer
exports.sendReminder = async (req, res) => {
    const { id } = req.params;

    try {
        const { rows } = await db.query(`SELECT nombre_liga, dueno_nombre, dueno_email, plan, estatus_pago, fecha_vencimiento FROM Tenant WHERE id = $1`, [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Tenant no encontrado" });
        
        const tenant = rows[0];
        if (!tenant.dueno_email) {
             return res.status(400).json({ error: "El Tenant no tiene un correo asignado." });
        }

        // Configuración de Servidor SMTP de Gmail
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS
            }
        });

        // Contenido Dinámico de la Factura
        const costo = tenant.plan === 'Oro' ? 200 : (tenant.plan === 'Plata' ? 100 : 50);
        const vencimiento = new Date(tenant.fecha_vencimiento).toLocaleDateString();

        const mailOptions = {
            from: `"LigaMaster SuperAdmin" <${process.env.GMAIL_USER}>`,
            to: tenant.dueno_email,
            subject: `LigaMaster - Factura y Recordatorio de Pago (${tenant.nombre_liga})`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                  <h2 style="color: #ec4899; text-align: center;">LigaMaster - Aviso de Cobro</h2>
                  <p>Hola <strong>${tenant.dueno_nombre || 'Organizador'}</strong>,</p>
                  <p>Te hacemos llegar este recordatorio referente a tu suscripción de la liga <strong>${tenant.nombre_liga}</strong>.</p>
                  <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 15px 0;">
                      <p style="margin: 5px 0;"><strong>Plan:</strong> ${tenant.plan}</p>
                      <p style="margin: 5px 0;"><strong>Estatus Actual:</strong> <span style="color: ${tenant.estatus_pago ? '#10b981' : '#ef4444'}">${tenant.estatus_pago ? 'Activo' : 'Suspendido'}</span></p>
                      <p style="margin: 5px 0;"><strong>Vencimiento:</strong> ${vencimiento}</p>
                      <h3 style="margin-top: 15px; border-top: 1px solid #ccc; padding-top: 10px;">Total a Pagar: $${costo}.00 MXN</h3>
                  </div>
                  <p style="font-size: 0.9em; color: #555;">Por favor ignora este mensaje si el pago ya ha sido procesado del lado administrativo.</p>
                  <br>
                  <p>Saludos cordiales,<br>El equipo de LigaMaster</p>
              </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: "Correo enviado exitosamente a " + tenant.dueno_email });
    } catch (err) {
        console.error("Error al enviar correo:", err);
        return res.status(500).json({ error: "Fallo al enviar correo. Verifica tus credenciales de Gmail." });
    }
};


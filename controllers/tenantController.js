const supabase = require('../supabaseClient');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper para enviar correos
const sendEmail = async ({ to, subject, html }) => {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
        throw new Error("Configuración de correo incompleta en el servidor (.env)");
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        }
    });

    const mailOptions = {
        from: `"LigaMaster SuperAdmin" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html
    };

    return transporter.sendMail(mailOptions);
};

const getTenantBySlug = async (slug) => {
    const { data: tenantData, error } = await supabase
        .from('tenant')
        .select('id, nombre_liga, estatus_pago, fecha_vencimiento, plan, dueno_nombre, dueno_email')
        .eq('subdominio_o_slug', slug)
        .single();

    if (error || !tenantData) return null;
    return tenantData;
};

const ALLOWED_PLANS = ['Bronce', 'Plata', 'Oro'];

const normalizeSlug = (value) => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

/** Renueva suscripción + correo de confirmación (SuperAdmin y primer pago del organizador). */
async function executeSubscriptionPayment(tenantId) {
    const { data: tenantData, error: fetchError } = await supabase
        .from('tenant')
        .select('nombre_liga, dueno_nombre, dueno_email, plan, fecha_vencimiento')
        .eq('id', tenantId)
        .single();

    if (fetchError || !tenantData) {
        const e = new Error('Tenant no encontrado');
        e.statusCode = 404;
        throw e;
    }

    const currentDate = new Date();
    let vencimiento = new Date(tenantData.fecha_vencimiento);
    if (currentDate > vencimiento) {
        vencimiento = new Date();
    }
    vencimiento.setDate(vencimiento.getDate() + 30);
    const nuevaFechaStr = vencimiento.toISOString();

    const { error: updateError } = await supabase
        .from('tenant')
        .update({ fecha_vencimiento: nuevaFechaStr, estatus_pago: true })
        .eq('id', tenantId);

    if (updateError) throw updateError;

    try {
        const costo = tenantData.plan === 'Oro' ? 200 : (tenantData.plan === 'Plata' ? 100 : 50);
        await sendEmail({
            to: tenantData.dueno_email,
            subject: `LigaMaster - Confirmación de Pago Recibido (${tenantData.nombre_liga})`,
            html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                      <h2 style="color: #10b981; text-align: center;">✅ Pago Confirmado</h2>
                      <p>Hola <strong>${tenantData.dueno_nombre || 'Organizador'}</strong>,</p>
                      <p>Te confirmamos que hemos recibido satisfactoriamente el pago de tu suscripción para la liga <strong>${tenantData.nombre_liga}</strong>.</p>
                      <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #bbf7d0;">
                          <p style="margin: 5px 0;"><strong>Monto Pagado:</strong> $${costo}.00 MXN</p>
                          <p style="margin: 5px 0;"><strong>Nueva Fecha de Vencimiento:</strong> ${new Date(nuevaFechaStr).toLocaleDateString()}</p>
                          <p style="margin: 5px 0;"><strong>Estatus:</strong> <span style="color: #10b981; font-weight: bold;">Activo</span></p>
                      </div>
                      <p>Tu servicio ha sido renovado por 30 días adicionales. ¡Gracias por confiar en LigaMaster!</p>
                      <br>
                      <p>Saludos,<br>El equipo de LigaMaster</p>
                  </div>
                `
        });
    } catch (mailErr) {
        console.error('Error enviando correo de confirmación de pago:', mailErr);
    }

    return { nueva_fecha_vencimiento: nuevaFechaStr, estatus_pago: true };
}

// Registro público (organizador crea su liga; queda pendiente de pago)
exports.registerOrganizerPublic = async (req, res) => {
    const { nombre_liga, subdominio_o_slug, plan, dueno_nombre, dueno_email, password } = req.body;

    if (!nombre_liga || !dueno_nombre || !dueno_email || !password) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }
    if (!ALLOWED_PLANS.includes(plan)) {
        return res.status(400).json({ error: 'Plan no válido' });
    }

    const slug = normalizeSlug(subdominio_o_slug);

    if (slug.length < 3) {
        return res.status(400).json({ error: 'El código de liga debe tener al menos 3 caracteres (letras, números o guiones)' });
    }

    try {
        const taken = await getTenantBySlug(slug);
        if (taken) {
            return res.status(409).json({ error: 'Ese código de liga ya está en uso. Elige otro.' });
        }

        const id = uuidv4();
        const fecha_registro = new Date().toISOString();
        const fecha_vencimiento = new Date(0).toISOString();
        const estatus_pago = false;
        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('tenant')
            .insert([
                {
                    id,
                    nombre_liga,
                    subdominio_o_slug: slug,
                    fecha_registro,
                    estatus_pago,
                    plan,
                    fecha_vencimiento,
                    dueno_nombre,
                    dueno_email,
                    password: hashedPassword
                }
            ])
            .select('id, nombre_liga, subdominio_o_slug, plan, dueno_nombre, dueno_email, estatus_pago, fecha_registro');

        if (error) throw error;

        res.status(201).json(data[0]);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Alta (SuperAdmin): crear liga y asignar dueño/organizador
exports.createTenantBySuperAdmin = async (req, res) => {
    const { nombre_liga, subdominio_o_slug, plan, dueno_nombre, dueno_email, password } = req.body;

    if (!nombre_liga || !dueno_nombre || !dueno_email || !password) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }
    if (!ALLOWED_PLANS.includes(plan)) {
        return res.status(400).json({ error: 'Plan no válido' });
    }

    const slug = normalizeSlug(subdominio_o_slug);
    if (slug.length < 3) {
        return res.status(400).json({ error: 'El código de liga debe tener al menos 3 caracteres (letras, números o guiones)' });
    }

    try {
        const taken = await getTenantBySlug(slug);
        if (taken) {
            return res.status(409).json({ error: 'Ese código de liga ya está en uso. Elige otro.' });
        }

        const id = uuidv4();
        const fecha_registro = new Date().toISOString();
        const fecha_vencimiento = new Date(0).toISOString();
        const estatus_pago = false;
        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('tenant')
            .insert([
                {
                    id,
                    nombre_liga,
                    subdominio_o_slug: slug,
                    fecha_registro,
                    estatus_pago,
                    plan,
                    fecha_vencimiento,
                    dueno_nombre,
                    dueno_email,
                    password: hashedPassword
                }
            ])
            .select('id, nombre_liga, subdominio_o_slug, plan, dueno_nombre, dueno_email, estatus_pago, fecha_registro');

        if (error) throw error;

        return res.status(201).json({
            message: 'Liga creada y organizador asignado',
            data: data[0]
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.checkSlugAvailable = async (req, res) => {
    const raw = String(req.params.slug || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    if (raw.length < 3) {
        return res.json({ available: true, slug: raw, validLength: false });
    }
    const t = await getTenantBySlug(raw);
    res.json({ available: !t, slug: raw, validLength: true });
};

exports.listPublicLigasForPortal = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tenant')
            .select('id, nombre_liga, subdominio_o_slug, fecha_vencimiento, estatus_pago')
            .order('fecha_registro', { ascending: false });

        if (error) throw error;

        const now = new Date();
        const filtered = (data || []).filter(
            (d) => d.estatus_pago && new Date(d.fecha_vencimiento) > now
        );
        res.json(filtered);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Primer pago del organizador tras el registro (valida contraseña)
exports.organizerFirstPayment = async (req, res) => {
    const { tenantId } = req.params;
    const { password, slug } = req.body;

    if (!password || !slug) {
        return res.status(400).json({ error: 'Contraseña y código de liga son obligatorios' });
    }

    try {
        const { data: tenant, error } = await supabase
            .from('tenant')
            .select('id, subdominio_o_slug, password')
            .eq('id', tenantId)
            .single();

        if (error || !tenant) {
            return res.status(404).json({ error: 'Liga no encontrada' });
        }
        if (tenant.subdominio_o_slug !== String(slug).toLowerCase().trim()) {
            return res.status(403).json({ error: 'El código de liga no coincide con el registro' });
        }

        const valid = await bcrypt.compare(password, tenant.password);
        if (!valid) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        const result = await executeSubscriptionPayment(tenantId);
        res.json({
            message: 'Pago confirmado. Tu liga está activa.',
            id: tenantId,
            nueva_fecha_vencimiento: result.nueva_fecha_vencimiento,
            estatus_pago: true
        });
    } catch (err) {
        if (err.statusCode === 404) {
            return res.status(404).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message });
    }
};

// Obtener todas las ligas
exports.getTenants = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tenant')
            .select('*')
            .order('fecha_registro', { ascending: false });
            
        if (error) throw error;
        res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Baja/Suspensión - Cambiar estatus de pago / acceso
exports.updateTenantStatus = async (req, res) => {
    const { id } = req.params;
    const { estatus_pago } = req.body; // boolean

    try {
        const { data, error } = await supabase
            .from('tenant')
            .update({ estatus_pago })
            .eq('id', id)
            .select();

        if (error) throw error;
        if (data.length === 0) return res.status(404).json({ error: "Tenant no encontrado" });
        
        res.json({ message: "Estatus actualizado", id, estatus_pago });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Simulación de Pago (SuperAdmin) - Extender vida mes
exports.simulatePayment = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await executeSubscriptionPayment(id);
        res.json({
            message: 'Pago registrado exitosamente',
            id,
            nueva_fecha_vencimiento: result.nueva_fecha_vencimiento,
            estatus_pago: true
        });
    } catch (err) {
        if (err.statusCode === 404) {
            return res.status(404).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message });
    }
};

// Webhook de prueba: simula confirmación automática de pasarela (SuperAdmin)
exports.simulatePaymentWebhook = async (req, res) => {
    const { id } = req.params;
    const { payment_status } = req.body;

    if (payment_status !== 'paid') {
        return res.status(400).json({ error: "Estado de pago no soportado. Usa payment_status='paid'" });
    }

    try {
        const result = await executeSubscriptionPayment(id);
        return res.json({
            message: 'Webhook de prueba procesado correctamente',
            id,
            estatus_pago: true,
            fecha_vencimiento: result.nueva_fecha_vencimiento
        });
    } catch (err) {
        if (err.statusCode === 404) {
            return res.status(404).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message });
    }
};

// Middleware para verificar dominio
exports.verifyTenantMiddleware = async (req, res, next) => {
    const slug = req.params.slug;
    
    try {
        const tenantData = await getTenantBySlug(slug);
        if (!tenantData) return res.status(404).json({ error: "Liga no encontrada" });
        
        if (!tenantData.estatus_pago) {
            return res.status(403).json({ error: "Servicio Suspendido", data: tenantData });
        }
        
        const currentDate = new Date();
        const expirationDate = new Date(tenantData.fecha_vencimiento);
        if (currentDate > expirationDate) {
            await supabase
                .from('tenant')
                .update({ estatus_pago: false })
                .eq('id', tenantData.id);

            return res.status(403).json({ error: "Suscripción Expirada. Por favor realiza tu pago.", data: {...tenantData, estatus_pago: false} });
        }
        
        res.json({ message: "Tenant Activo", data: tenantData });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Verificar tenant usando host real (subdominio) o slug explícito de fallback
exports.verifyTenantByHost = async (req, res) => {
    const explicitSlug = normalizeSlug(req.query.slug || req.headers['x-tenant-slug']);
    const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
    const hostname = hostHeader.split(':')[0];
    const hostParts = hostname.split('.').filter(Boolean);
    const hostSlug = hostParts.length >= 3 ? hostParts[0] : '';
    const slug = explicitSlug || normalizeSlug(hostSlug);

    if (!slug) {
        return res.status(400).json({
            error: 'No se pudo determinar la liga desde el host. En desarrollo usa ?slug=mi-liga o header x-tenant-slug.'
        });
    }

    try {
        const tenantData = await getTenantBySlug(slug);
        if (!tenantData) return res.status(404).json({ error: 'Liga no encontrada' });

        if (!tenantData.estatus_pago) {
            return res.status(403).json({ error: 'Servicio Suspendido', data: tenantData });
        }

        const currentDate = new Date();
        const expirationDate = new Date(tenantData.fecha_vencimiento);
        if (currentDate > expirationDate) {
            await supabase
                .from('tenant')
                .update({ estatus_pago: false })
                .eq('id', tenantData.id);

            return res.status(403).json({
                error: 'Pendiente de Pago',
                data: { ...tenantData, estatus_pago: false }
            });
        }

        return res.json({
            message: 'Tenant Activo',
            slug_detectado: slug,
            data: tenantData
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Middleware real para proteger cualquier endpoint por slug
exports.ensureTenantActive = async (req, res, next) => {
    const { slug } = req.params;

    try {
        const tenantData = await getTenantBySlug(slug);
        if (!tenantData) return res.status(404).json({ error: "Liga no encontrada" });

        if (!tenantData.estatus_pago) {
            return res.status(403).json({ error: "Servicio Suspendido", data: tenantData });
        }

        const currentDate = new Date();
        const expirationDate = new Date(tenantData.fecha_vencimiento);
        if (currentDate > expirationDate) {
            await supabase
                .from('tenant')
                .update({ estatus_pago: false })
                .eq('id', tenantData.id);

            return res.status(403).json({
                error: "Pendiente de Pago",
                data: { ...tenantData, estatus_pago: false }
            });
        }

        req.tenantStatus = tenantData;
        next();
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Edición: Modificar datos de contacto o cambiar plan
exports.updateTenant = async (req, res) => {
    const { id } = req.params;
    const { dueno_nombre, dueno_email, plan, password } = req.body;

    try {
        if (plan !== undefined && plan !== null && !ALLOWED_PLANS.includes(plan)) {
            return res.status(400).json({ error: 'Plan no válido' });
        }

        const updateData = { dueno_nombre, dueno_email, plan };

        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }

        const { data, error } = await supabase
            .from('tenant')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;
        if (data.length === 0) return res.status(404).json({ error: "Tenant no encontrado" });
        
        res.json({ message: "Tenant actualizado", id });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Login de Organizador (Tenant)
exports.loginTenant = async (req, res) => {
    const { slug, password } = req.body;

    try {
        const { data: tenant, error } = await supabase
            .from('tenant')
            .select('id, subdominio_o_slug, password, nombre_liga, estatus_pago, fecha_vencimiento')
            .eq('subdominio_o_slug', slug)
            .single();

        if (error || !tenant) return res.status(401).json({ error: "Liga no registrada" });

        // Verificación de suspensión por pago o vencimiento
        const currentDate = new Date();
        const expirationDate = new Date(tenant.fecha_vencimiento);
        
        if (!tenant.estatus_pago) {
            return res.status(403).json({ error: "Servicio Suspendido Administrativamente", data: tenant });
        }

        if (currentDate > expirationDate) {
            return res.status(403).json({ error: "Suscripción Expirada por falta de pago", data: tenant });
        }

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
        const { data: tenant, error } = await supabase
            .from('tenant')
            .select('nombre_liga, dueno_nombre, dueno_email, plan, estatus_pago, fecha_vencimiento')
            .eq('id', id)
            .single();

        if (error || !tenant) return res.status(404).json({ error: "Tenant no encontrado" });
        
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

        await sendEmail({
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
        });

        res.json({ message: "Correo enviado exitosamente a " + tenant.dueno_email });
    } catch (err) {
        console.error("Error al enviar correo:", err);
        return res.status(500).json({ error: "Fallo al enviar correo. Verifica tus credenciales de Gmail." });
    }
};

exports.deleteTenant = async (req, res) => {
    const { id } = req.params;
    try {
        // Eliminar registros vinculados para evitar errores de integridad (si no hay CASCADE)
        await supabase.from('partido').delete().eq('tenant_id', id);
        await supabase.from('equipo').delete().eq('tenant_id', id);
        await supabase.from('arbitro').delete().eq('tenant_id', id);
        await supabase.from('torneo').delete().eq('tenant_id', id);

        // Finalmente eliminar el tenant
        const { error } = await supabase.from('tenant').delete().eq('id', id);

        if (error) throw error;
        res.json({ message: "Liga eliminada permanentemente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

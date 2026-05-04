require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const tenantRoutes = require('./routes/tenantRoutes');
const organizerRoutes = require('./routes/organizerRoutes');
const jwt = require('jsonwebtoken');

// LOGS DE DEPURACIÓN (Solo para ver si las variables existen en Render)
console.log('--- Verificando variables de entorno ---');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'OK' : 'FALTA');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'OK' : 'FALTA');
console.log('ADMIN_USER:', process.env.ADMIN_USER ? 'OK' : 'FALTA');

// Captura de errores críticos para que no se apague sin avisar
process.on('uncaughtException', (err) => {
    console.error('❌ ERROR CRÍTICO NO CAPTURADO:', err.message);
    console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ PROMESA NO MANEJADA:', reason);
});

app.get('/', (req, res) => {
    res.json({ status: 'active', message: 'LigaMaster API is running safely' });
});

const configuredOrigins = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = configuredOrigins.length
    ? configuredOrigins
    : ['http://localhost:5173'];

app.use(cors({
    origin: (origin, callback) => {
        // Permitir herramientas locales (Postman/curl) sin origin
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS bloqueado para origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '20mb' }));
app.use('/api', tenantRoutes);
app.use('/api/organizer', organizerRoutes);

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!process.env.JWT_SECRET) return res.status(500).json({error: 'Configuración de servidor incompleta (JWT_SECRET)'});
    
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        const token = jwt.sign({ role: 'SuperAdmin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ token, message: 'Autenticación exitosa' });
    }
    return res.status(401).json({ error: 'Credenciales inválidas' });
});

const PORT = process.env.PORT || 10000; // Render usa el 10000 por defecto si no se especifica
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor listo y escuchando en el puerto ${PORT}`);
});

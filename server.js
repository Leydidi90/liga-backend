const express = require('express');
const cors = require('cors');
const app = express();
const tenantRoutes = require('./routes/tenantRoutes');
const organizerRoutes = require('./routes/organizerRoutes');
const jwt = require('jsonwebtoken');

// Configuración de CORS más flexible para producción
app.use(cors({
    origin: '*', // En producción real, se recomienda cambiar esto por el dominio de tu frontend en Vercel
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api', tenantRoutes);
app.use('/api/organizer', organizerRoutes);

// Endpoint de Inicio de Sesión
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        const token = jwt.sign({ role: 'SuperAdmin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ token, message: 'Autenticación exitosa' });
    }
    
    return res.status(401).json({ error: 'Credenciales inválidas' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server corriendo en http://localhost:${PORT}`);
});

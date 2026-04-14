const jwt = require('jsonwebtoken');

module.exports = function requireSuperAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de administrador requerido' });
    }
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ error: 'Configuración de servidor incompleta (JWT_SECRET)' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'SuperAdmin') {
            return res.status(403).json({ error: 'Solo el panel SuperAdmin puede realizar esta acción' });
        }
        req.superAdmin = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }
};

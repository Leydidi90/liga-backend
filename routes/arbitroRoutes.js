const express = require('express');
const router = express.Router();
const organizerController = require('../controllers/organizerController');

// Login solo con matrícula (busca en todas las ligas)
router.post('/login', organizerController.loginArbitro);

// Panel del árbitro (autenticación por token dentro del controlador)
router.get('/dashboard', organizerController.getArbitroDashboard);

// Registro de resultados de partidos (goles, faltas, tarjetas)
router.put('/partidos/:id', organizerController.updateArbitroPartido);

// Multas
router.post('/multas', organizerController.createArbitroMulta);
router.delete('/multas/:id', organizerController.deleteArbitroMulta);

module.exports = router;

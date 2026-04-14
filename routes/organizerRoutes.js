const express = require('express');
const router = express.Router();
const organizerController = require('../controllers/organizerController');
const tenantController = require('../controllers/tenantController');

// Rutas de administración de Liga (Organizador)

// Login de Organizador (PÚBLICO)
router.post('/:slug/login', tenantController.loginTenant);

// Validación de estatus/pago para TODO acceso por liga
router.use('/:slug', tenantController.ensureTenantActive);

// === RUTAS PÚBLICAS (Lectura para aficionados) ===
router.get('/:slug/equipos', organizerController.getEquipos);
router.get('/:slug/calendario', organizerController.getCalendario);
router.get('/:slug/torneos', organizerController.getTorneos);

// === MIDDLEWARE DE PROTECCIÓN (Privado de aquí en adelante) ===
router.use('/:slug', tenantController.authTenantMiddleware);

// === RUTAS PRIVADAS (Solo dueños) ===
router.post('/:slug/equipos', organizerController.addEquipo);

router.post('/:slug/generar-calendario', organizerController.generateRoundRobin);
router.put('/:slug/partidos/:id', organizerController.updatePartido);
router.put('/:slug/partidos/:id/programacion', organizerController.updateProgramacion);

router.get('/:slug/arbitros', organizerController.getArbitros);
router.post('/:slug/arbitros', organizerController.addArbitro);
router.put('/:slug/arbitros/:id', organizerController.updateArbitro);
router.delete('/:slug/arbitros/:id', organizerController.deleteArbitro);
router.post('/:slug/torneos', organizerController.addTorneo);

module.exports = router;

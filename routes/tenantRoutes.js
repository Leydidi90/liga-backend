const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');

// Rutas de administración (SuperAdmin)
router.get('/tenants', tenantController.getTenants);
router.post('/tenants', tenantController.createTenant);
router.put('/tenants/:id/status', tenantController.updateTenantStatus);
router.put('/tenants/:id', tenantController.updateTenant);
router.post('/tenants/:id/payment', tenantController.simulatePayment);
router.post('/tenants/:id/send-reminder', tenantController.sendReminder);
router.delete('/tenants/:id', tenantController.deleteTenant);

// Ruta de validación pública
router.get('/verify-tenant/:slug', tenantController.verifyTenantMiddleware);

module.exports = router;

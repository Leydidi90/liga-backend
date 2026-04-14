const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');

// --- Público (sin token SuperAdmin) ---
router.get('/public/ligas', tenantController.listPublicLigasForPortal);
router.get('/public/slug-available/:slug', tenantController.checkSlugAvailable);
router.post('/public/register-organizer', tenantController.registerOrganizerPublic);
router.post('/public/organizer/:tenantId/first-payment', tenantController.organizerFirstPayment);
router.get('/verify-tenant/:slug', tenantController.verifyTenantMiddleware);

// --- SuperAdmin (JWT role SuperAdmin) ---
router.get('/tenants', requireSuperAdmin, tenantController.getTenants);
router.put('/tenants/:id', requireSuperAdmin, tenantController.updateTenant);
router.put('/tenants/:id/status', requireSuperAdmin, tenantController.updateTenantStatus);
router.post('/tenants/:id/payment', requireSuperAdmin, tenantController.simulatePayment);
router.post('/tenants/:id/payment-webhook-test', requireSuperAdmin, tenantController.simulatePaymentWebhook);
router.post('/tenants/:id/send-reminder', requireSuperAdmin, tenantController.sendReminder);
router.delete('/tenants/:id', requireSuperAdmin, tenantController.deleteTenant);

module.exports = router;

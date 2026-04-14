/**
 * NOTA: Este proyecto ha sido migrado a Supabase.
 * Para nuevas funcionalidades, utilizar require('../supabaseClient.js').
 */

const supabase = require('../supabaseClient');

// Exportamos el cliente de Supabase para mantener compatibilidad básica 
// si algún otro archivo aún lo importa como 'db'.
module.exports = supabase;

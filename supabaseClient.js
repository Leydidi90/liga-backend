const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in backend environment variables');
}

// Inicializamos el cliente con la Service Role Key para tener bypass de RLS en el backend
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = supabase;

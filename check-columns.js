const supabase = require('./supabaseClient');

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'tenant' });
  
  // Si RPC no está disponible, intentamos un select simple y vemos qué campos trae
  const { data: rows, error: sError } = await supabase.from('tenant').select('*').limit(1);
  
  if (sError) {
    console.error('Error al consultar:', sError.message);
  } else {
    console.log('Campos detectados en la tabla tenant:', Object.keys(rows[0] || {}));
    if (rows.length === 0) {
        console.log('La tabla está vacía, no puedo deducir las columnas así.');
    }
  }
}

checkColumns();

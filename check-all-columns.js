const supabase = require('./supabaseClient');

async function checkAllColumns() {
  const tables = ['tenant', 'equipo', 'partido', 'torneo', 'arbitro'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error en tabla ${table}:`, error.message);
    } else {
      console.log(`Columnas en '${table}':`, Object.keys(data[0] || {}));
    }
  }
}

checkAllColumns();

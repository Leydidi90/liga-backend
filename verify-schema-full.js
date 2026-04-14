const supabase = require('./supabaseClient');

async function getFullSchema() {
  // Intentamos obtener el esquema usando una consulta SQL (si el usuario tiene permisos de RPC o similar)
  // Como no sabemos si hay RPC, usaremos la información del archivo SQL original 
  // y lo compararemos con lo que requiere el código.
  
  console.log('--- Comparación de Esquema Requerido ---');
  
  const schema = {
    tenant: ['id', 'nombre_liga', 'subdominio_o_slug', 'fecha_registro', 'estatus_pago', 'plan', 'fecha_vencimiento', 'dueno_nombre', 'dueno_email', 'password'],
    equipo: ['id', 'tenant_id', 'nombre', 'puntos', 'partidos_jugados', 'partidos_ganados', 'partidos_empatados', 'partidos_perdidos', 'goles_favor', 'goles_contra', 'delegado', 'escudo'],
    torneo: ['id', 'tenant_id', 'nombre', 'estatus', 'formato', 'fecha_inicio', 'fecha_fin', 'premio'],
    arbitro: ['id', 'tenant_id', 'nombre', 'rol', 'matricula', 'categoria', 'disponibilidad', 'equipo_id'],
    partido: ['id', 'tenant_id', 'jornada', 'equipo_local_id', 'equipo_visitante_id', 'goles_local', 'goles_visitante', 'estatus', 'sede', 'horario', 'stats']
  };

  for (const [table, requiredCols] of Object.entries(schema)) {
     console.log(`Verificando tabla: ${table}...`);
     // Hacemos una consulta que pida una columna que sospechamos que falta
     // Si falla, es que falta.
     for (const col of requiredCols) {
        const { error } = await supabase.from(table).select(col).limit(1);
        if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
            console.log(`  ❌ Falta columna: ${col}`);
        }
     }
  }
}

getFullSchema();

const supabase = require('./supabaseClient');

async function checkDirect() {
  console.log('--- Re-intentando Comprobación Directa de Datos ---');
  
  const testId = 'test-tenant-' + Date.now();
  
  // 1. Intentar Insertar
  console.log('Intentando insertar un registro en la tabla tenant (incluyendo password)...');
  const { data: insertData, error: insertError } = await supabase
    .from('tenant')
    .insert([
      { 
        id: testId, 
        nombre_liga: 'Liga de Prueba Post-Arreglo',
        subdominio_o_slug: 'liga-ok-' + Date.now(),
        fecha_registro: new Date().toISOString(),
        estatus_pago: true,
        plan: 'Pro',
        fecha_vencimiento: '2026-12-31',
        password: 'test-password-123' // Campo recién agregado
      }
    ])
    .select();

  if (insertError) {
    console.error('❌ ERROR de inserción:', insertError.message);
    return;
  }

  console.log('✅ Registro insertado correctamente:', insertData[0].nombre_liga);

  // 2. Intentar Leer
  console.log('Consultando la tabla tenant...');
  const { data: fetchData, error: fetchError } = await supabase
    .from('tenant')
    .select('id, nombre_liga, password')
    .eq('id', testId);

  if (fetchError) {
    console.error('❌ ERROR de lectura:', fetchError.message);
  } else {
    console.log(`✅ ¡Éxito! Lectura confirmada.`);
    console.log('Datos recuperados:', fetchData[0]);
  }
}

checkDirect();

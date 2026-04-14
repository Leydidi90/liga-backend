const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function runMigration() {
    try {
        console.log('--- Iniciando Migración: Agregar columna password a Tenant ---');
        
        // 1. Agregar columna password
        await pool.query('ALTER TABLE Tenant ADD COLUMN IF NOT EXISTS password TEXT');
        console.log('✅ Columna password agregada exitosamente.');

        // 2. Establecer una contraseña default para los existentes (opcional, pero recomendado para evitar nulos)
        // Usaremos "ligamaster2026" como temporal si ya hay datos, el SuperAdmin podrá cambiarla después.
        await pool.query("UPDATE Tenant SET password = 'ligamaster2026' WHERE password IS NULL");
        console.log('✅ Valores default establecidos para registros existentes.');

        console.log('--- Migración Finalizada con Éxito ---');
    } catch (err) {
        console.error('❌ Error en la migración:', err);
    } finally {
        await pool.end();
    }
}

runMigration();

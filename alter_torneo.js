require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();

async function alterTorneo() {
    try {
        console.log("Conectando...");
        await pool.query('ALTER TABLE Torneo ADD COLUMN IF NOT EXISTS formato VARCHAR(100);');
        await pool.query('ALTER TABLE Torneo ADD COLUMN IF NOT EXISTS fecha_inicio DATE;');
        await pool.query('ALTER TABLE Torneo ADD COLUMN IF NOT EXISTS fecha_fin DATE;');
        await pool.query('ALTER TABLE Torneo ADD COLUMN IF NOT EXISTS estatus VARCHAR(50) DEFAULT \'En Registro\';');
        await pool.query('ALTER TABLE Torneo ADD COLUMN IF NOT EXISTS premio VARCHAR(200);');
        console.log("Columnas de formato añadidas a Torneo.");
    } catch(err) {
        console.log("Error:", err.message);
    } finally {
        pool.end();
    }
}
alterTorneo();

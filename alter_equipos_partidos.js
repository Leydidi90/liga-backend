require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();

async function alterDB() {
    try {
        console.log("Conectando...");
        await pool.query('ALTER TABLE Equipo ADD COLUMN IF NOT EXISTS delegado VARCHAR(150);');
        await pool.query('ALTER TABLE Equipo ADD COLUMN IF NOT EXISTS escudo TEXT;');
        await pool.query('ALTER TABLE Partido ADD COLUMN IF NOT EXISTS sede VARCHAR(150);');
        await pool.query('ALTER TABLE Partido ADD COLUMN IF NOT EXISTS horario VARCHAR(50);');
        console.log("Migración estructural completada exitosamente.");
    } catch(err) {
        console.log("Error:", err.message);
    } finally {
        pool.end();
    }
}
alterDB();

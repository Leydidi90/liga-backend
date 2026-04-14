require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();

async function alterDB() {
    try {
        console.log("Conectando...");
        await pool.query('ALTER TABLE Arbitro ADD COLUMN matricula VARCHAR(50);');
        await pool.query('ALTER TABLE Arbitro ADD COLUMN categoria VARCHAR(50);');
        await pool.query('ALTER TABLE Arbitro ADD COLUMN disponibilidad BOOLEAN DEFAULT TRUE;');
        console.log("Tabla Arbitro alterada exitosamente con las nuevas columnas.");
    } catch(err) {
        console.log("Error o las columnas ya existen:", err.message);
    } finally {
        pool.end();
    }
}
alterDB();

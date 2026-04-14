require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();

async function alterDB() {
    try {
        console.log("Conectando...");
        await pool.query('ALTER TABLE Arbitro ADD COLUMN equipo_id VARCHAR(50) REFERENCES Equipo(id) ON DELETE SET NULL;');
        console.log("Columna equipo_id añadida.");
    } catch(err) {
        console.log("Error o la columna ya existe:", err.message);
    } finally {
        pool.end();
    }
}
alterDB();

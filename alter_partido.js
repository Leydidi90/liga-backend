require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();

async function alterDB() {
    try {
        console.log("Conectando...");
        await pool.query('ALTER TABLE Partido ADD COLUMN stats JSON;');
        console.log("Columna stats añadida a Partido.");
    } catch(err) {
        console.log("Error:", err.message);
    } finally {
        pool.end();
    }
}
alterDB();

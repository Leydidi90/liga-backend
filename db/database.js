require('dotenv').config();
const { Pool, Client } = require('pg');

const dbConfig = {
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'ligamaster'
};

const pool = new Pool(dbConfig);

const initDB = async () => {
    try {
        const client = await pool.connect();
        console.log('Conectado a la base de datos PostgreSQL.');
        await createTable(client);
        client.release();
    } catch (err) {
        if (err.code === '3D000') {
            console.log('Base de datos no existe. Intentando crearla...');
            const rootClient = new Client({ ...dbConfig, database: 'postgres' });
            await rootClient.connect();
            await rootClient.query(`CREATE DATABASE ${dbConfig.database}`);
            await rootClient.end();
            console.log('Base de datos ligamaster creada exitosamente.');

            const client = await pool.connect();
            await createTable(client);
            client.release();
        } else {
            console.error('Error al conectar con PostgreSQL:', err.message);
        }
    }
};

const createTable = async (client) => {
    const queryTenant = `
        CREATE TABLE IF NOT EXISTS Tenant (
            id VARCHAR(50) PRIMARY KEY,
            nombre_liga VARCHAR(255) NOT NULL,
            subdominio_o_slug VARCHAR(255) UNIQUE NOT NULL,
            fecha_registro VARCHAR(100) NOT NULL,
            estatus_pago BOOLEAN NOT NULL,
            plan VARCHAR(50) NOT NULL,
            fecha_vencimiento VARCHAR(100) NOT NULL,
            dueno_nombre VARCHAR(255),
            dueno_email VARCHAR(255)
        )
    `;
    await client.query(queryTenant);

    const queryEquipo = `
        CREATE TABLE IF NOT EXISTS Equipo (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50) NOT NULL REFERENCES Tenant(id) ON DELETE CASCADE,
            nombre VARCHAR(255) NOT NULL,
            puntos INT DEFAULT 0,
            partidos_jugados INT DEFAULT 0,
            partidos_ganados INT DEFAULT 0,
            partidos_empatados INT DEFAULT 0,
            partidos_perdidos INT DEFAULT 0,
            goles_favor INT DEFAULT 0,
            goles_contra INT DEFAULT 0
        )
    `;
    await client.query(queryEquipo);

    const queryPartido = `
        CREATE TABLE IF NOT EXISTS Partido (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50) NOT NULL REFERENCES Tenant(id) ON DELETE CASCADE,
            jornada INT NOT NULL,
            equipo_local_id VARCHAR(50) NOT NULL REFERENCES Equipo(id) ON DELETE CASCADE,
            equipo_visitante_id VARCHAR(50) NOT NULL REFERENCES Equipo(id) ON DELETE CASCADE,
            goles_local INT DEFAULT NULL,
            goles_visitante INT DEFAULT NULL,
            estatus VARCHAR(50) DEFAULT 'Pendiente'
        )
    `;
    await client.query(queryPartido);

    const queryTorneo = `
        CREATE TABLE IF NOT EXISTS Torneo (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50) NOT NULL REFERENCES Tenant(id) ON DELETE CASCADE,
            nombre VARCHAR(255) NOT NULL,
            estatus VARCHAR(50) DEFAULT 'Activo'
        )
    `;
    await client.query(queryTorneo);

    const queryArbitro = `
        CREATE TABLE IF NOT EXISTS Arbitro (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50) NOT NULL REFERENCES Tenant(id) ON DELETE CASCADE,
            nombre VARCHAR(255) NOT NULL,
            rol VARCHAR(100) DEFAULT 'Árbitro Central'
        )
    `;
    await client.query(queryArbitro);
    
    console.log("Tablas SaaS completas (Tenant, Equipo, Partido, Torneo, Arbitro) aseguradas en Postgres.");
};

initDB();

module.exports = pool;

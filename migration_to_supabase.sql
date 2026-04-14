-- Esquema de base de datos para LigaMaster
-- Ejecutar en Supabase SQL Editor

-- Tabla Tenant
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
);

-- Tabla Equipo
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
    goles_contra INT DEFAULT 0,
    delegado VARCHAR(150),
    escudo TEXT
);

-- Tabla Torneo
CREATE TABLE IF NOT EXISTS Torneo (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES Tenant(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    estatus VARCHAR(50) DEFAULT 'Activo',
    formato VARCHAR(100),
    fecha_inicio DATE,
    fecha_fin DATE,
    premio VARCHAR(200)
);

-- Tabla Arbitro
CREATE TABLE IF NOT EXISTS Arbitro (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES Tenant(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    rol VARCHAR(100) DEFAULT 'Árbitro Central',
    matricula VARCHAR(50),
    categoria VARCHAR(50),
    disponibilidad BOOLEAN DEFAULT TRUE
);

-- Tabla Partido
CREATE TABLE IF NOT EXISTS Partido (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES Tenant(id) ON DELETE CASCADE,
    jornada INT NOT NULL,
    equipo_local_id VARCHAR(50) NOT NULL REFERENCES Equipo(id) ON DELETE CASCADE,
    equipo_visitante_id VARCHAR(50) NOT NULL REFERENCES Equipo(id) ON DELETE CASCADE,
    goles_local INT DEFAULT NULL,
    goles_visitante INT DEFAULT NULL,
    estatus VARCHAR(50) DEFAULT 'Pendiente',
    sede VARCHAR(150),
    horario VARCHAR(50),
    stats JSON
);
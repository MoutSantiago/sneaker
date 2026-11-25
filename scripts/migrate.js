/**
 * @file Script de migraciones de base de datos.
 *
 * Excepción justificada al DEV_GUIDE §2 (acceso a datos solo con Prisma): este script usa el
 * driver `pg` y SQL crudo porque debe ejecutar archivos `.sql` completos, con varias
 * sentencias, y conectarse a una base de datos secundaria distinta de la que gestiona
 * PrismaService.
 */

const { readdir } = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DATABASE_NOT_FOUND_CODE = '3D000';
const MAINTENANCE_DATABASE = 'postgres';
const MIGRATION_FILE_PATTERN = /^\d{3}_.+\.sql$/;

/**
 * Lista los archivos de migración de una carpeta.
 * Solo considera archivos con formato NNN_nombre.sql, por ejemplo 001_product_table.sql.
 * @param {string} [dataDir] - Ruta de la carpeta con las migraciones. Por defecto, `data/` en la raíz del repo.
 * @returns {Promise<string[]>} Nombres de archivo ordenados alfabéticamente.
 * @throws {Error} Si la carpeta no existe o no se puede leer.
 */
async function listMigrationFiles(dataDir = DATA_DIR) {
  let entries;

  try {
    entries = await readdir(dataDir);
  } catch (error) {
    throw new Error(`No se pudo leer la carpeta de migraciones "${dataDir}": ${error.message}`);
  }

  return entries.filter((name) => MIGRATION_FILE_PATTERN.test(name)).sort();
}

/**
 * Obtiene el nombre con el que se registra una migración: el nombre del archivo sin `.sql`.
 * @param {string} fileName - Nombre del archivo, por ejemplo `001_product_table.sql`.
 * @returns {string} Nombre sin extensión, por ejemplo `001_product_table`.
 */
function getMigrationName(fileName) {
  return path.basename(fileName, '.sql');
}

/**
 * Filtra las migraciones que todavía no fueron ejecutadas.
 * @param {string[]} fileNames - Nombres de archivo de las migraciones disponibles.
 * @param {Set<string>} executedNames - Nombres (sin `.sql`) de las migraciones ya registradas.
 * @returns {string[]} Archivos pendientes, en el mismo orden en que se recibieron.
 */
function filterPendingMigrations(fileNames, executedNames) {
  return fileNames.filter((fileName) => !executedNames.has(getMigrationName(fileName)));
}

/**
 * Crea la tabla de historial de migraciones si todavía no existe.
 * @param {import('pg').Client} client - Cliente conectado a la base de datos secundaria.
 * @returns {Promise<void>}
 * @throws {Error} Si la consulta falla.
 */
async function ensureHistoryTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migration (
      name VARCHAR(255) PRIMARY KEY,
      execute_date TIMESTAMPTZ NOT NULL
    )
  `);
}

/**
 * Obtiene los nombres de las migraciones ya registradas en el historial.
 * @param {import('pg').Client} client - Cliente conectado a la base de datos secundaria.
 * @returns {Promise<Set<string>>} Nombres registrados, sin la extensión `.sql`.
 * @throws {Error} Si la consulta falla.
 */
async function getExecutedMigrations(client) {
  const result = await client.query('SELECT name FROM migration');

  return new Set(result.rows.map((row) => row.name));
}

/**
 * Abre una conexión a PostgreSQL.
 * @param {string} connectionString - URL de conexión.
 * @returns {Promise<import('pg').Client>} Cliente conectado.
 * @throws {Error} Si la conexión falla; el error de `pg` conserva su propiedad `code`.
 */
async function openClient(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();

  return client;
}

/**
 * Crea una base de datos conectándose a la base de mantenimiento `postgres` del mismo servidor.
 * @param {string} connectionString - URL de conexión de la base de datos que se quiere crear.
 * @returns {Promise<void>}
 * @throws {Error} Si no se puede conectar al servidor o el usuario no tiene permiso para crearla.
 */
async function createDatabase(connectionString) {
  const url = new URL(connectionString);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  url.pathname = `/${MAINTENANCE_DATABASE}`;

  const admin = await openClient(url.toString());

  try {
    await admin.query(`CREATE DATABASE ${admin.escapeIdentifier(databaseName)}`);
  } finally {
    await admin.end();
  }
}

/**
 * Se conecta a la base de datos secundaria (la del historial de migraciones).
 * Si la base no existe, la crea y se vuelve a conectar. El llamador debe cerrar el cliente.
 * @param {string} connectionString - URL de conexión de la base de datos secundaria.
 * @returns {Promise<import('pg').Client>} Cliente conectado.
 * @throws {Error} Si no se puede acceder al servidor o no se puede crear la base.
 */
async function connectToHistoryDatabase(connectionString) {
  try {
    return await openClient(connectionString);
  } catch (error) {
    if (error.code !== DATABASE_NOT_FOUND_CODE) {
      throw new Error(`No se pudo acceder a la base de datos secundaria: ${error.message}`);
    }
  }

  try {
    await createDatabase(connectionString);

    return await openClient(connectionString);
  } catch (error) {
    throw new Error(`No se pudo crear la base de datos secundaria: ${error.message}`);
  }
}

module.exports = {
  connectToHistoryDatabase,
  createDatabase,
  ensureHistoryTable,
  filterPendingMigrations,
  getExecutedMigrations,
  getMigrationName,
  listMigrationFiles,
};

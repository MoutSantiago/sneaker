/**
 * @file Script de migraciones de base de datos.
 *
 * Excepción justificada al DEV_GUIDE §2 (acceso a datos solo con Prisma): este script usa el
 * driver `pg` y SQL crudo porque debe ejecutar archivos `.sql` completos, con varias
 * sentencias, y conectarse a una base de datos secundaria distinta de la que gestiona
 * PrismaService.
 */

const { readdir, readFile } = require('node:fs/promises');
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

/**
 * Ejecuta un archivo de migración dentro de una transacción.
 * Si el SQL falla, se revierte la transacción y no queda ningún cambio parcial.
 * Los archivos no deben incluir sus propios BEGIN ni COMMIT.
 * @param {import('pg').Client} client - Cliente conectado a la base de datos principal.
 * @param {string} dataDir - Carpeta que contiene la migración.
 * @param {string} fileName - Nombre del archivo, por ejemplo `001_product_table.sql`.
 * @returns {Promise<void>}
 * @throws {Error} Si no se puede leer el archivo o si el SQL falla (tras el ROLLBACK).
 */
async function runMigration(client, dataDir, fileName) {
  const sql = await readFile(path.join(dataDir, fileName), 'utf8');

  await client.query('BEGIN');

  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    // Si el ROLLBACK también falla (por ejemplo, conexión caída), igual informamos el error original.
    await client.query('ROLLBACK').catch(() => {});
    throw new Error(`La migración ${fileName} falló: ${error.message}`);
  }
}

/**
 * Registra una migración ya aplicada en el historial.
 * Guarda el nombre sin `.sql` y la fecha de ejecución.
 * @param {import('pg').Client} client - Cliente conectado a la base de datos secundaria.
 * @param {string} fileName - Nombre del archivo, por ejemplo `001_product_table.sql`.
 * @returns {Promise<void>}
 * @throws {Error} Si no se puede registrar; la migración ya quedó aplicada en la base principal.
 */
async function registerMigration(client, fileName) {
  try {
    await client.query('INSERT INTO migration (name, execute_date) VALUES ($1, now())', [
      getMigrationName(fileName),
    ]);
  } catch (error) {
    throw new Error(
      `La migración ${fileName} se aplicó, pero no se pudo registrar en el historial: ${error.message}`,
    );
  }
}

/**
 * Ejecuta, en orden, todas las migraciones pendientes de la carpeta de migraciones.
 * Cada migración corre en su propia transacción sobre la base principal y, una vez aplicada,
 * se registra en la base secundaria. Se detiene en el primer error.
 * @param {object} options - Configuración de la ejecución.
 * @param {string} options.databaseUrl - URL de conexión de la base de datos principal.
 * @param {string} options.historyDatabaseUrl - URL de conexión de la base de datos secundaria.
 * @param {string} [options.dataDir] - Carpeta con las migraciones. Por defecto, `data/` en la raíz del repo.
 * @returns {Promise<string[]>} Nombres de los archivos aplicados en esta ejecución.
 * @throws {Error} Si falta la carpeta, no se puede acceder a alguna base o una migración falla.
 */
async function runMigrations({ databaseUrl, historyDatabaseUrl, dataDir = DATA_DIR }) {
  const fileNames = await listMigrationFiles(dataDir);
  const historyClient = await connectToHistoryDatabase(historyDatabaseUrl);
  let mainClient;

  try {
    await ensureHistoryTable(historyClient);
    const executedNames = await getExecutedMigrations(historyClient);
    const pending = filterPendingMigrations(fileNames, executedNames);

    if (pending.length === 0) {
      console.log('No hay migraciones pendientes.');

      return [];
    }

    try {
      mainClient = await openClient(databaseUrl);
    } catch (error) {
      throw new Error(`No se pudo acceder a la base de datos principal: ${error.message}`);
    }

    for (const fileName of pending) {
      await runMigration(mainClient, dataDir, fileName);
      await registerMigration(historyClient, fileName);
      console.log(`Migración aplicada: ${fileName}`);
    }

    return pending;
  } finally {
    await mainClient?.end();
    await historyClient.end();
  }
}

/**
 * Punto de entrada del script: valida la configuración, ejecuta las migraciones pendientes
 * y devuelve el código de salida del proceso.
 * @param {Record<string, string | undefined>} env - Variables de entorno.
 * @param {string} [dataDir] - Carpeta con las migraciones. Por defecto, `data/` en la raíz del repo.
 * @returns {Promise<number>} `0` si terminó bien; `1` si hubo algún error.
 */
async function main(env, dataDir) {
  const { DATABASE_URL, MIGRATIONS_DATABASE_URL } = env;

  if (!DATABASE_URL || !MIGRATIONS_DATABASE_URL) {
    console.error('Error: definí las variables de entorno DATABASE_URL y MIGRATIONS_DATABASE_URL.');

    return 1;
  }

  try {
    await runMigrations({
      databaseUrl: DATABASE_URL,
      historyDatabaseUrl: MIGRATIONS_DATABASE_URL,
      dataDir,
    });

    return 0;
  } catch (error) {
    console.error(`Error: ${error.message}`);

    return 1;
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
  main,
  registerMigration,
  runMigration,
  runMigrations,
};

if (require.main === module) {
  void main(process.env).then((exitCode) => {
    process.exitCode = exitCode;
  });
}

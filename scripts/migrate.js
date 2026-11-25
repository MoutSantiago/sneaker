const { readdir } = require('node:fs/promises');
const path = require('node:path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
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

module.exports = { filterPendingMigrations, getMigrationName, listMigrationFiles };

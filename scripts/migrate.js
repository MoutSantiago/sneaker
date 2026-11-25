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

module.exports = { listMigrationFiles };

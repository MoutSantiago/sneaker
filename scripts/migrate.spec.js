const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { listMigrationFiles } = require('./migrate');

describe('listMigrationFiles', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'migrations-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('devuelve solo los archivos NNN_nombre.sql, ordenados', async () => {
    const names = ['002_orders.sql', '001_products.sql', '.gitkeep', 'notas.txt', '1_mala.sql'];
    for (const name of names) {
      await writeFile(path.join(tmpDir, name), '');
    }

    const result = await listMigrationFiles(tmpDir);

    expect(result).toEqual(['001_products.sql', '002_orders.sql']);
  });

  it('devuelve una lista vacía si no hay migraciones', async () => {
    await writeFile(path.join(tmpDir, '.gitkeep'), '');

    const result = await listMigrationFiles(tmpDir);

    expect(result).toEqual([]);
  });

  it('lanza un error controlado si la carpeta no existe', async () => {
    const missingDir = path.join(tmpDir, 'no-existe');

    await expect(listMigrationFiles(missingDir)).rejects.toThrow(
      'No se pudo leer la carpeta de migraciones',
    );
  });
});

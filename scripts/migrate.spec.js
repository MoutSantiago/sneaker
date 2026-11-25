const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { filterPendingMigrations, getMigrationName, listMigrationFiles } = require('./migrate');

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

describe('getMigrationName', () => {
  it('quita la extensión .sql del nombre del archivo', () => {
    expect(getMigrationName('001_product_table.sql')).toBe('001_product_table');
  });
});

describe('filterPendingMigrations', () => {
  const files = ['001_products.sql', '002_orders.sql', '003_users.sql'];

  it('devuelve solo las migraciones que no están registradas', () => {
    const executed = new Set(['001_products']);

    expect(filterPendingMigrations(files, executed)).toEqual(['002_orders.sql', '003_users.sql']);
  });

  it('devuelve todas si no hay ninguna registrada', () => {
    expect(filterPendingMigrations(files, new Set())).toEqual(files);
  });

  it('devuelve una lista vacía si todas ya fueron ejecutadas', () => {
    const executed = new Set(['001_products', '002_orders', '003_users']);

    expect(filterPendingMigrations(files, executed)).toEqual([]);
  });
});

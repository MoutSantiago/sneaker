const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('pg');
const {
  connectToHistoryDatabase,
  createDatabase,
  ensureHistoryTable,
  filterPendingMigrations,
  getExecutedMigrations,
  getMigrationName,
  listMigrationFiles,
} = require('./migrate');

jest.mock('pg', () => ({ Client: jest.fn() }));

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

describe('ensureHistoryTable', () => {
  it('crea la tabla migration si no existe', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };

    await ensureHistoryTable(client);

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS migration');
  });
});

describe('getExecutedMigrations', () => {
  it('devuelve un Set con los nombres registrados', async () => {
    const rows = [{ name: '001_products' }, { name: '002_orders' }];
    const client = { query: jest.fn().mockResolvedValue({ rows }) };

    const result = await getExecutedMigrations(client);

    expect(result).toEqual(new Set(['001_products', '002_orders']));
    expect(client.query).toHaveBeenCalledWith('SELECT name FROM migration');
  });

  it('devuelve un Set vacío si el historial está vacío', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    const result = await getExecutedMigrations(client);

    expect(result).toEqual(new Set());
  });
});

const DATABASE_URL = 'postgresql://user:pass@localhost:5432/sneaker_migrations';

/**
 * Crea un cliente falso con los métodos que usa createDatabase.
 * @returns {object} Cliente simulado.
 */
function buildAdminMock() {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({}),
    end: jest.fn().mockResolvedValue(undefined),
    escapeIdentifier: jest.fn((name) => `"${name}"`),
  };
}

describe('createDatabase', () => {
  let admin;

  beforeEach(() => {
    admin = buildAdminMock();
    Client.mockReset();
    Client.mockImplementation(() => admin);
  });

  it('crea la base conectándose a la base postgres del mismo servidor', async () => {
    await createDatabase(DATABASE_URL);

    expect(Client).toHaveBeenCalledWith({
      connectionString: 'postgresql://user:pass@localhost:5432/postgres',
    });
    expect(admin.query).toHaveBeenCalledWith('CREATE DATABASE "sneaker_migrations"');
    expect(admin.end).toHaveBeenCalledTimes(1);
  });

  it('cierra la conexión aunque CREATE DATABASE falle', async () => {
    admin.query.mockRejectedValue(new Error('permission denied to create database'));

    await expect(createDatabase(DATABASE_URL)).rejects.toThrow(
      'permission denied to create database',
    );
    expect(admin.end).toHaveBeenCalledTimes(1);
  });
});

describe('connectToHistoryDatabase', () => {
  const notFoundError = Object.assign(new Error('database "sneaker_migrations" does not exist'), {
    code: '3D000',
  });

  beforeEach(() => {
    Client.mockReset();
  });

  it('devuelve el cliente conectado si la base existe', async () => {
    const client = { connect: jest.fn().mockResolvedValue(undefined) };
    Client.mockImplementation(() => client);

    const result = await connectToHistoryDatabase(DATABASE_URL);

    expect(result).toBe(client);
    expect(Client).toHaveBeenCalledTimes(1);
    expect(Client).toHaveBeenCalledWith({ connectionString: DATABASE_URL });
  });

  it('crea la base y se vuelve a conectar si no existe', async () => {
    const missing = { connect: jest.fn().mockRejectedValue(notFoundError) };
    const admin = buildAdminMock();
    const created = { connect: jest.fn().mockResolvedValue(undefined) };
    Client.mockImplementationOnce(() => missing)
      .mockImplementationOnce(() => admin)
      .mockImplementationOnce(() => created);

    const result = await connectToHistoryDatabase(DATABASE_URL);

    expect(result).toBe(created);
    expect(admin.query).toHaveBeenCalledWith('CREATE DATABASE "sneaker_migrations"');
  });

  it('lanza un error controlado si no se puede acceder al servidor', async () => {
    const failing = { connect: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) };
    Client.mockImplementation(() => failing);

    await expect(connectToHistoryDatabase(DATABASE_URL)).rejects.toThrow(
      'No se pudo acceder a la base de datos secundaria: connect ECONNREFUSED',
    );
    expect(Client).toHaveBeenCalledTimes(1);
  });

  it('lanza un error controlado si no se puede crear la base', async () => {
    const missing = { connect: jest.fn().mockRejectedValue(notFoundError) };
    const admin = buildAdminMock();
    admin.query.mockRejectedValue(new Error('permission denied to create database'));
    Client.mockImplementationOnce(() => missing).mockImplementationOnce(() => admin);

    await expect(connectToHistoryDatabase(DATABASE_URL)).rejects.toThrow(
      'No se pudo crear la base de datos secundaria: permission denied to create database',
    );
  });
});

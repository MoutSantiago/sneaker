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
  registerMigration,
  runMigration,
  runMigrations,
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

describe('runMigration', () => {
  const sql = 'CREATE TABLE product (id INT);';
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'migrations-'));
    await writeFile(path.join(tmpDir, '001_product.sql'), sql);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('ejecuta el archivo dentro de una transacción confirmada', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };

    await runMigration(client, tmpDir, '001_product.sql');

    expect(client.query.mock.calls).toEqual([['BEGIN'], [sql], ['COMMIT']]);
  });

  it('revierte la transacción y lanza un error si el SQL falla', async () => {
    const client = {
      query: jest.fn().mockImplementation(async (text) => {
        if (text === sql) {
          throw new Error('syntax error');
        }

        return {};
      }),
    };

    await expect(runMigration(client, tmpDir, '001_product.sql')).rejects.toThrow(
      'La migración 001_product.sql falló: syntax error',
    );
    expect(client.query.mock.calls).toEqual([['BEGIN'], [sql], ['ROLLBACK']]);
  });

  it('informa el error original aunque el ROLLBACK también falle', async () => {
    const client = {
      query: jest.fn().mockImplementation(async (text) => {
        if (text === sql) {
          throw new Error('syntax error');
        }
        if (text === 'ROLLBACK') {
          throw new Error('connection lost');
        }

        return {};
      }),
    };

    await expect(runMigration(client, tmpDir, '001_product.sql')).rejects.toThrow(
      'La migración 001_product.sql falló: syntax error',
    );
  });
});
describe('registerMigration', () => {
  it('inserta el nombre sin .sql y la fecha de ejecución', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };

    await registerMigration(client, '001_product.sql');

    expect(client.query).toHaveBeenCalledWith(
      'INSERT INTO migration (name, execute_date) VALUES ($1, now())',
      ['001_product'],
    );
  });

  it('aclara que la migración ya se aplicó si el registro falla', async () => {
    const client = { query: jest.fn().mockRejectedValue(new Error('connection lost')) };

    await expect(registerMigration(client, '001_product.sql')).rejects.toThrow(
      'La migración 001_product.sql se aplicó, pero no se pudo registrar en el historial: connection lost',
    );
  });
});

/**
 * Crea un cliente falso que simula una conexión a PostgreSQL.
 * @returns {object} Cliente simulado; toda consulta devuelve `{ rows: [] }` por defecto.
 */
function buildClientMock() {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };
}

describe('runMigrations', () => {
  const MAIN_DATABASE_URL = 'postgresql://user:pass@localhost:5432/sneaker';
  const SQL_FILES = {
    '001_products.sql': 'SQL-001;',
    '002_orders.sql': 'SQL-002;',
    '003_users.sql': 'SQL-003;',
  };
  const INSERT_HISTORY = expect.stringContaining('INSERT INTO migration');
  let tmpDir;
  let history;
  let main;

  const buildOptions = () => ({
    databaseUrl: MAIN_DATABASE_URL,
    historyDatabaseUrl: DATABASE_URL,
    dataDir: tmpDir,
  });

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'migrations-'));
    for (const [name, content] of Object.entries(SQL_FILES)) {
      await writeFile(path.join(tmpDir, name), content);
    }
    history = buildClientMock();
    main = buildClientMock();
    Client.mockReset();
    Client.mockImplementationOnce(() => history).mockImplementationOnce(() => main);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('aplica solo las pendientes, en orden, y las registra', async () => {
    history.query.mockResolvedValue({ rows: [{ name: '001_products' }] });

    const applied = await runMigrations(buildOptions());

    expect(applied).toEqual(['002_orders.sql', '003_users.sql']);
    expect(main.query.mock.calls).toEqual([
      ['BEGIN'],
      ['SQL-002;'],
      ['COMMIT'],
      ['BEGIN'],
      ['SQL-003;'],
      ['COMMIT'],
    ]);
    expect(history.query).toHaveBeenCalledWith(INSERT_HISTORY, ['002_orders']);
    expect(history.query).toHaveBeenCalledWith(INSERT_HISTORY, ['003_users']);
    expect(history.end).toHaveBeenCalledTimes(1);
    expect(main.end).toHaveBeenCalledTimes(1);
  });

  it('no se conecta a la base principal si no hay pendientes', async () => {
    history.query.mockResolvedValue({
      rows: [{ name: '001_products' }, { name: '002_orders' }, { name: '003_users' }],
    });

    const applied = await runMigrations(buildOptions());

    expect(applied).toEqual([]);
    expect(Client).toHaveBeenCalledTimes(1);
    expect(history.end).toHaveBeenCalledTimes(1);
  });

  it('se detiene en el primer error y no registra la migración fallida', async () => {
    main.query.mockImplementation(async (text) => {
      if (text === 'SQL-002;') {
        throw new Error('syntax error');
      }

      return { rows: [] };
    });

    await expect(runMigrations(buildOptions())).rejects.toThrow(
      'La migración 002_orders.sql falló: syntax error',
    );

    expect(main.query.mock.calls).toEqual([
      ['BEGIN'],
      ['SQL-001;'],
      ['COMMIT'],
      ['BEGIN'],
      ['SQL-002;'],
      ['ROLLBACK'],
    ]);
    expect(history.query).toHaveBeenCalledWith(INSERT_HISTORY, ['001_products']);
    expect(history.query).not.toHaveBeenCalledWith(INSERT_HISTORY, ['002_orders']);
    expect(history.end).toHaveBeenCalledTimes(1);
    expect(main.end).toHaveBeenCalledTimes(1);
  });

  it('lanza un error controlado, sin conectarse a ninguna base, si no existe la carpeta', async () => {
    const options = { ...buildOptions(), dataDir: path.join(tmpDir, 'no-existe') };

    await expect(runMigrations(options)).rejects.toThrow(
      'No se pudo leer la carpeta de migraciones',
    );
    expect(Client).not.toHaveBeenCalled();
  });

  it('lanza un error controlado si no se puede acceder a la base principal', async () => {
    main.connect.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(runMigrations(buildOptions())).rejects.toThrow(
      'No se pudo acceder a la base de datos principal: connect ECONNREFUSED',
    );
    expect(history.end).toHaveBeenCalledTimes(1);
  });
});

import { Module } from '@nestjs/common';

/**
 * Mock de PrismaService para tests.
 *
 * No intenta conectarse a ninguna base de datos real. Simula los métodos
 * base de PrismaClient ($connect, $disconnect, $transaction, etc.) como
 * funciones jest.fn() para que puedan ser inspeccionadas en los tests.
 *
 * Como el schema de Prisma aún no define modelos, este mock expone solo la
 * superficie de API común a todo cliente Prisma. Cuando se agreguen modelos,
 * se puede extender con los mocks de esos modelos (p. ej. user, product).
 */
export class PrismaServiceMock {
  $connect = jest.fn().mockResolvedValue(undefined);
  $disconnect = jest.fn().mockResolvedValue(undefined);
  $transaction = jest.fn().mockImplementation(async (fn: any) => fn(this));
  $executeRaw = jest.fn().mockResolvedValue(undefined);
  $queryRaw = jest.fn().mockResolvedValue([]);

  // Marca para identificar fácilmente el mock en tests
  readonly __isPrismaServiceMock = true;
}

/**
 * Proveedor de prueba para usar en Test.createTestingModule.
 * Sustituye al PrismaService real por el mock, evitando cualquier conexión
 * a PostgreSQL durante los tests.
 */
export const mockPrismaProvider = {
  provide: PrismaServiceMock,
  useClass: PrismaServiceMock,
};

/**
 * Módulo de prueba aislado que proporciona el mock de PrismaService.
 * Se usa en los specs para evitar importar PrismaModule real (que a su vez
 * importa PrismaService y el cliente generado de Prisma, requiriendo DB).
 */
@Module({
  providers: [mockPrismaProvider],
  exports: [mockPrismaProvider.provide],
})
export class PrismaTestModule {}

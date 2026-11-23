import { Test, TestingModule } from '@nestjs/testing';
import { PrismaServiceMock, PrismaTestModule } from './prisma.service.mock';

describe('PrismaService (no DB required)', () => {
  let module: TestingModule;
  let prisma: PrismaServiceMock;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaTestModule],
    }).compile();

    prisma = module.get(PrismaServiceMock);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(prisma).toBeDefined();
  });

  it('should be the mock, not a real DB connection', () => {
    expect((prisma as any).__isPrismaServiceMock).toBe(true);
  });

  describe('$connect', () => {
    it('should be callable without a real database', async () => {
      await prisma.$connect();
      expect(prisma.$connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('$disconnect', () => {
    it('should be callable without a real database', async () => {
      await prisma.$disconnect();
      expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('$transaction', () => {
    it('should run a callback inside a mocked transaction', async () => {
      const result = await prisma.$transaction(async (_tx: any) => {
        return 'ok';
      });
      expect(result).toBe('ok');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('PrismaTestModule', () => {
    it('should compile with the mocked provider', () => {
      expect(module).toBeDefined();
    });

    it('should provide the PrismaServiceMock', () => {
      expect(module.get(PrismaServiceMock)).toBe(prisma);
    });
  });
});

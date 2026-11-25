import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsQueryDto } from './dto/products-query.dto';

// Mock de los módulos generados de Prisma para evitar cargar el cliente real
// (usa imports .js con moduleFormat cjs que Jest no resuelve en este entorno).
jest.mock('../generated/prisma/client', () => ({}));
jest.mock('../generated/prisma/models', () => ({}));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { product, product_variant } from '../generated/prisma/client';

/**
 * Mock del servicio. El controlador se testa de forma aislada,
 * sin llamar a la base de datos ni instalar el módulo real.
 */
const mockService = {
  getMany: jest.fn(),
  getOne: jest.fn(),
  getManyVariants: jest.fn(),
  getOneVariant: jest.fn(),
  getVariants: jest.fn(),
};

describe('ProductsController', () => {
  let controller: ProductsController;

  const baseProduct: product = {
    id: 1,
    model: 'Air Max 90',
    description: 'Zapatilla clásica',
    brand: 'Nike',
    price: 120.0,
    type: 'SHOE',
    usage: 'running',
    material: 'cuero',
  };

  const baseVariant: product_variant = {
    id: 1,
    product_id: 1,
    size: 42,
    color: 'blanco',
    stock: 10,
    priority: 3,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockService }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  describe('getMany', () => {
    it('should call service.getMany with the query and return its result', async () => {
      const query: ProductsQueryDto = { brand: 'nike', page: 1, limit: 10 };
      const expected = {
        data: [baseProduct],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockService.getMany.mockResolvedValue(expected);

      const result = await controller.getMany(query);

      expect(mockService.getMany).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });
  });

  describe('getOne', () => {
    it('should call service.getOne with the parsed id and return its result', async () => {
      const expected = {
        data: [baseProduct],
        pagination: { total: 1, page: 0, limit: 1, totalPages: 0 },
      };
      mockService.getOne.mockResolvedValue(expected);

      const result = await controller.getOne(1);

      expect(mockService.getOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('getManyVariants', () => {
    it('should call service.getManyVariants with the query and return its result', async () => {
      const query: ProductsQueryDto = { size: '42' };
      const expected = {
        data: [baseVariant],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockService.getManyVariants.mockResolvedValue(expected);

      const result = await controller.getManyVariants(query);

      expect(mockService.getManyVariants).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });
  });

  describe('getOneVariant', () => {
    it('should call service.getOneVariant with the parsed id and return its result', async () => {
      const variantWithProduct = { ...baseVariant, product: baseProduct };
      const expected = {
        data: [variantWithProduct],
        pagination: { total: 1, page: 0, limit: 1, totalPages: 0 },
      };
      mockService.getOneVariant.mockResolvedValue(expected);

      const result = await controller.getOneVariant(1);

      expect(mockService.getOneVariant).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('getVariants', () => {
    it('should call service.getVariants with the parsed id and return its result', async () => {
      const variants = [baseVariant];
      const expected = {
        data: variants,
        pagination: { total: 1, page: 0, limit: 1, totalPages: 0 },
      };
      mockService.getVariants.mockResolvedValue(expected);

      const result = await controller.getVariants(1);

      expect(mockService.getVariants).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });
});

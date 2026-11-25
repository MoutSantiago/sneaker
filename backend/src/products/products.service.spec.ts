import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
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
 * Mock de PrismaService. No se usa una base de datos real.
 * Cada test puede redefinir los valores de retorno de los métodos mock.
 */
const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  product_variant: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ProductsService', () => {
  let service: ProductsService;

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
      providers: [ProductsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('getMany', () => {
    const defaultQuery: ProductsQueryDto = {};

    it('should return products with pagination when no filters are applied', async () => {
      const products = [baseProduct];
      mockPrisma.product.findMany.mockResolvedValue(products);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockResolvedValue([products, 1]);

      const result = await service.getMany(defaultQuery);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { model: 'asc' },
        skip: 0,
        take: 10,
      });
      expect(mockPrisma.product.count).toHaveBeenCalledWith({ where: {} });
      expect(result.data).toEqual(products);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter by brand case-insensitive', async () => {
      const query: ProductsQueryDto = { brand: 'nike' };
      mockPrisma.product.findMany.mockResolvedValue([baseProduct]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockResolvedValue([[baseProduct], 1]);

      await service.getMany(query);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          brand: { contains: 'nike', mode: 'insensitive' },
        },
        orderBy: { model: 'asc' },
        skip: 0,
        take: 10,
      });
    });

    it('should filter by size and color using product_variant.some', async () => {
      const query: ProductsQueryDto = { size: '42', color: 'blanco' };
      mockPrisma.product.findMany.mockResolvedValue([baseProduct]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockResolvedValue([[baseProduct], 1]);

      await service.getMany(query);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          product_variant: {
            some: {
              size: '42',
              color: { contains: 'blanco', mode: 'insensitive' },
            },
          },
        },
        orderBy: { model: 'asc' },
        skip: 0,
        take: 10,
      });
    });

    it('should filter by minPrice and maxPrice', async () => {
      const query: ProductsQueryDto = { minPrice: 50, maxPrice: 200 };
      mockPrisma.product.findMany.mockResolvedValue([baseProduct]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockResolvedValue([[baseProduct], 1]);

      await service.getMany(query);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          price: { gte: 50, lte: 200 },
        },
        orderBy: { model: 'asc' },
        skip: 0,
        take: 10,
      });
    });

    it('should apply sorting by price descending', async () => {
      const query: ProductsQueryDto = { sortBy: 'price', order: 'desc' };
      mockPrisma.product.findMany.mockResolvedValue([baseProduct]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockResolvedValue([[baseProduct], 1]);

      await service.getMany(query);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { price: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should apply pagination skip and take correctly', async () => {
      const query: ProductsQueryDto = { page: 2, limit: 5 };
      mockPrisma.product.findMany.mockResolvedValue([baseProduct]);
      mockPrisma.product.count.mockResolvedValue(12);
      mockPrisma.$transaction.mockResolvedValue([[baseProduct], 12]);

      const result = await service.getMany(query);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { model: 'asc' },
        skip: 5,
        take: 5,
      });
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.total).toBe(12);
    });

    it('should combine multiple filters at once', async () => {
      const query: ProductsQueryDto = {
        brand: 'adidas',
        size: '41',
        color: 'negro',
        minPrice: 80,
        maxPrice: 150,
        page: 1,
        limit: 20,
      };
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await service.getMany(query);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          brand: { contains: 'adidas', mode: 'insensitive' },
          product_variant: {
            some: {
              size: '41',
              color: { contains: 'negro', mode: 'insensitive' },
            },
          },
          price: { gte: 80, lte: 150 },
        },
        orderBy: { model: 'asc' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter by type', async () => {
      const query: ProductsQueryDto = { type: 'SHOE' };
      mockPrisma.product.findMany.mockResolvedValue([baseProduct]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockResolvedValue([[baseProduct], 1]);

      await service.getMany(query);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          type: 'SHOE',
        },
        orderBy: { model: 'asc' },
        skip: 0,
        take: 10,
      });
      expect(mockPrisma.product.count).toHaveBeenCalledWith({
        where: { type: 'SHOE' },
      });
    });
  });

  describe('getOne', () => {
    it('should return the product when found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(baseProduct);

      const result = await service.getOne(1);

      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result.data).toEqual([baseProduct]);
      expect(result.pagination.total).toBe(1);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.getOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.getOne(999)).rejects.toThrow('Product with id 999 not found.');
    });
  });

  describe('getManyVariants', () => {
    const variantsWithProduct = [
      { ...baseVariant, product: baseProduct },
      { ...baseVariant, id: 2, product_id: 2, product: { ...baseProduct, id: 2 } },
    ];

    it('should return variants filtered by priority > 0 with product included', async () => {
      mockPrisma.product_variant.findMany.mockResolvedValue(variantsWithProduct);

      const result = await service.getManyVariants({});

      expect(mockPrisma.product_variant.findMany).toHaveBeenCalledWith({
        where: {
          product: {},
          priority: { gt: 0 },
        },
        include: { product: true },
      });
      expect(result.data).toHaveLength(2);
    });

    it('should filter variants by brand, size and color via buildProductVariantFilters', async () => {
      const query: ProductsQueryDto = { brand: 'nike', size: '42', color: 'blanco' };
      mockPrisma.product_variant.findMany.mockResolvedValue([variantsWithProduct[0]]);

      await service.getManyVariants(query);

      expect(mockPrisma.product_variant.findMany).toHaveBeenCalledWith({
        where: {
          product: {
            brand: { contains: 'nike', mode: 'insensitive' },
          },
          size: '42',
          color: { contains: 'blanco', mode: 'insensitive' },
          priority: { gt: 0 },
        },
        include: { product: true },
      });
    });

    it('should filter variants by type through product relation', async () => {
      const query: ProductsQueryDto = { type: 'SHOE' };
      mockPrisma.product_variant.findMany.mockResolvedValue([variantsWithProduct[0]]);

      await service.getManyVariants(query);

      expect(mockPrisma.product_variant.findMany).toHaveBeenCalledWith({
        where: {
          product: {
            type: 'SHOE',
          },
          priority: { gt: 0 },
        },
        include: { product: true },
      });
    });

    it('should select at most one variant per product', async () => {
      // Dos variantes del mismo producto, una del otro
      const variants = [
        { ...baseVariant, id: 1, product_id: 1, product: baseProduct },
        { ...baseVariant, id: 2, product_id: 1, product: baseProduct }, // mismo product_id
        { ...baseVariant, id: 3, product_id: 2, product: { ...baseProduct, id: 2 } },
      ];
      mockPrisma.product_variant.findMany.mockResolvedValue(variants);

      const result = await service.getManyVariants({});

      const productIds = result.data.map((v) => v.product_id);
      expect(productIds).toEqual([expect.any(Number), expect.any(Number)]);
      expect(new Set(productIds).size).toBe(productIds.length);
    });

    it('should paginate selected variants', async () => {
      const variants = Array.from({ length: 25 }, (_, i) => ({
        ...baseVariant,
        id: i + 1,
        product_id: i + 1,
        product: { ...baseProduct, id: i + 1 },
      }));
      mockPrisma.product_variant.findMany.mockResolvedValue(variants);

      const result = await service.getManyVariants({ page: 2, limit: 10 });

      expect(result.pagination.total).toBe(25);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.data).toHaveLength(10);
    });

    it('should return empty data when no variants match filters', async () => {
      mockPrisma.product_variant.findMany.mockResolvedValue([]);

      const result = await service.getManyVariants({ brand: 'inexistente' });

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('getOneVariant', () => {
    it('should return the variant with its product when found', async () => {
      const variantWithProduct = { ...baseVariant, product: baseProduct };
      mockPrisma.product_variant.findUnique.mockResolvedValue(variantWithProduct);

      const result = await service.getOneVariant(1);

      expect(mockPrisma.product_variant.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { product: true },
      });
      expect(result.data).toEqual([variantWithProduct]);
      expect(result.pagination.total).toBe(1);
    });

    it('should throw NotFoundException when variant does not exist', async () => {
      mockPrisma.product_variant.findUnique.mockResolvedValue(null);

      await expect(service.getOneVariant(999)).rejects.toThrow(NotFoundException);
      await expect(service.getOneVariant(999)).rejects.toThrow('Variant with id 999 not found.');
    });
  });

  describe('getVariants', () => {
    it('should return all variants of a product with priority > 0', async () => {
      const variants = [baseVariant, { ...baseVariant, id: 2, priority: 1 }];
      mockPrisma.product_variant.findMany.mockResolvedValue(variants);

      const result = await service.getVariants(1);

      expect(mockPrisma.product_variant.findMany).toHaveBeenCalledWith({
        where: {
          product_id: 1,
          priority: { gt: 0 },
        },
      });
      expect(result.data).toEqual(variants);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.limit).toBe(2);
    });

    it('should return empty array when product has no variants with priority > 0', async () => {
      mockPrisma.product_variant.findMany.mockResolvedValue([]);

      const result = await service.getVariants(1);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });
});

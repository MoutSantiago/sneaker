import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnProductsDto } from './dto/return-product.dto';
import { ProductsQueryDto } from './dto/products-query.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMany(query: ProductsQueryDto): Promise<ReturnProductsDto> {
    const {
      brand,
      size,
      color,
      minPrice,
      maxPrice,
      sortBy = 'name',
      order = 'asc',
      page = 1,
      limit = 10,
    } = query;

    const where: Prisma.ProductWhereInput = {
      ...(brand && {
        brand: {
          name: { contains: brand, mode: 'insensitive' },
        },
      }),

      ...(size && {
        size: {
          equals: size,
        },
      }),

      ...(color && {
        color: {
          equals: color,
        },
      }),

      ...((minPrice !== undefined || maxPrice !== undefined) && {
        price: {
          ...(minPrice !== undefined && { gte: minPrice }),
          ...(maxPrice !== undefined && { lte: maxPrice }),
        },
      }),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: {
          [sortBy]: order,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),

      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

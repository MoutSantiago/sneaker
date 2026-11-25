import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnProductsDto } from './dto/return-product.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { productWhereInput } from '../generated/prisma/models';
import { product } from '../generated/prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca en la base de datos mediante Prisma.
   *
   * Guarda toda la información de filtrado en una constante where, que luego
   * es usada para hacer la consulta a la base de datos.
   * Por ultimo genera una estructura de retorno con la lista de los productos
   * y con la información de paginación.
   *
   * @param query Queries de filtrado.
   * @returns Lista con los productos encontrados.
   */
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

    const where: productWhereInput = {
      ...(brand && {
        brand: {
          contains: brand,
          mode: 'insensitive',
        },
      }),

      ...((size !== undefined || color !== undefined) && {
        product_variant: {
          some: {
            ...(size !== undefined && { size }),
            ...(color && { color }),
          },
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

  /**
   * Busca un unico producto en la base de datos.
   *
   * Utiliza un where simple para filtrar por la id del producto.
   *
   * @param id Id del producto buscado.
   * @throws NotFoundException si el producto no se encuentra en la base de datos.
   * @returns Producto encontrado.
   */
  async getOne(id: number): Promise<ReturnProductsDto> {
    const product: product | null = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found.`);
    }

    return {
      data: [product],
      pagination: {
        total: 1,
        page: 0,
        limit: 1,
        totalPages: 0,
      },
    };
  }
}

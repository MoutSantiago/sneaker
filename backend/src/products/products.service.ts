import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnProductsDto } from './dto/return-product.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { product_variantWhereInput, productWhereInput } from '../generated/prisma/models';
import { product, product_variant } from '../generated/prisma/client';
import { ReturnVariantsDto } from './dto/return-variant.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera los filtros de las variantes en base a las queries de filtrado.
   *
   * @param query Datos de filtrado.
   * @returns Filtros generados.
   */
  private buildProductVariantFilters(query: ProductsQueryDto): product_variantWhereInput {
    const { brand, size, color, minPrice, maxPrice } = query;

    return {
      product: {
        ...(brand && {
          brand: {
            contains: brand,
            mode: 'insensitive',
          },
        }),

        ...((minPrice !== undefined || maxPrice !== undefined) && {
          price: {
            ...(minPrice !== undefined && { gte: minPrice }),
            ...(maxPrice !== undefined && { lte: maxPrice }),
          },
        }),
      },

      ...(size !== undefined && { size }),

      ...(color && {
        color: {
          contains: color,
          mode: 'insensitive',
        },
      }),
    };
  }

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

  /**
   * Consigue muchas variantes aleatorias.
   *
   * Guarda la información de filtrado en una constante where, usada luego para
   * la consulta a la base de datos.
   * Calcula el peso de cada prioridad, prioridad 0 no aparece, las siguientes se multiplican
   * (ej: prioridad 4 tiene x4 mas posibilidades de aparecer que prioridad 1).
   * Por ultimo genera una estructura de retorno con la lista de las variantes
   * y con la información de paginación.
   *
   * @param query Quieries de filtrado.
   * @returns Lista con las variantes encontradas.
   */
  async getManyVariants(query: ProductsQueryDto) {
    const { page = 1, limit = 10 } = query;

    const where: product_variantWhereInput = {
      ...this.buildProductVariantFilters(query),
      priority: { gt: 0 },
    };

    const variants = await this.prisma.product_variant.findMany({
      where,
      include: {
        product: true,
      },
    });

    const weightedVariants = variants
      .map((variant) => ({
        variant,
        weight: Math.random() ** (1 / variant.priority),
      }))
      .sort((a, b) => b.weight - a.weight);

    // Seleccionar como máximo una variante por producto.
    const selectedVariants = [];
    const selectedProducts = new Set<number>();

    for (const { variant } of weightedVariants) {
      if (selectedProducts.has(variant.product_id)) {
        continue;
      }

      selectedProducts.add(variant.product_id);
      selectedVariants.push(variant);
    }

    const start = (page - 1) * limit;

    const data = selectedVariants.slice(start, start + limit);

    return {
      data,
      pagination: {
        total: selectedVariants.length,
        page,
        limit,
        totalPages: Math.ceil(selectedVariants.length / limit),
      },
    };
  }

  /**
   * Busca en la base de datos una variante especifica.
   *
   * Utiliza el id como unico parametro del where para filtrado.
   *
   * @param id Id de la variante buscada.
   * @throws NotFoundException Cuando no se encuentra la variante buscada.
   * @returns Variante buscada.
   */
  async getOneVariant(id: number): Promise<ReturnVariantsDto> {
    const variant: product_variant | null = await this.prisma.product_variant.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!variant) {
      throw new NotFoundException(`Variant with id ${id} not found.`);
    }

    return {
      data: [variant],
      pagination: {
        total: 1,
        page: 0,
        limit: 1,
        totalPages: 0,
      },
    };
  }
}

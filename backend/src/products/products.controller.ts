import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ReturnProductsDto } from './dto/return-product.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { ReturnVariantsDto } from './dto/return-variant.dto';

/**
 * Controlador de las rutas del CRUD de productos.
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  /**
   * Busca varios productos en la base de datos.
   *
   * @param query Queries para el filtrado de prodctos.
   * @returns Lista de productos.
   */
  @Get()
  async getMany(@Query() query: ProductsQueryDto): Promise<ReturnProductsDto> {
    return await this.service.getMany(query);
  }

  /**
   * Busca varias variable sde producto aleatorias.
   *
   * @param query Queries de filtrado.
   * @returns Lista de variables de producto.
   */
  @Get('variants')
  async getManyVariants(@Query() query: ProductsQueryDto): Promise<ReturnVariantsDto> {
    return await this.service.getManyVariants(query);
  }

  /**
   * Busca una variante especifia a la base de datos.
   *
   * @param id Id de la variante buscada.
   * @returns La variante buscada.
   */
  @Get('variants/:id')
  async getOneVariant(@Param('id', ParseIntPipe) id: number): Promise<ReturnVariantsDto> {
    return await this.service.getOneVariant(id);
  }

  /**
   * Busca un unico producto mediante su id.
   *
   * @param id Id del producto buscado.
   * @returns Producto buscado.
   */
  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number): Promise<ReturnProductsDto> {
    return await this.service.getOne(id);
  }

  /**
   * Obtiene todas las variantes de un producto especifico.
   *
   * @param id Id del producto.
   * @returns Variantes del producto.
   */
  @Get(':id/variants')
  async getVariants(@Param('id', ParseIntPipe) id: number): Promise<ReturnVariantsDto> {
    return await this.service.getVariants(id);
  }
}

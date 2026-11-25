import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ReturnProductsDto } from './dto/return-product.dto';
import { ProductsQueryDto } from './dto/products-query.dto';

/**
 * Controlador de las rutas del CRUD de productos.
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  /**
   * Busca varios productos en la base de datos.
   * @param query Queries para el filtrado de prodctos.
   * @returns Lista de productos.
   */
  @Get()
  async getMany(@Query() query: ProductsQueryDto): Promise<ReturnProductsDto> {
    return await this.service.getMany(query);
  }

  /**
   * Busca un unico producto mediante su id.
   * @param id Id del producto buscado.
   * @returns Producto buscado.
   */
  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number): Promise<ReturnProductsDto> {
    return await this.service.getOne(id);
  }
}

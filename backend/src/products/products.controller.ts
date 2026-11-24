import { Controller, Get, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ReturnProductsDto } from './dto/return-product.dto';
import { ProductsQueryDto } from './dto/products-query.dto';

/**
 * Controlador de las rutas del CRUD de productos.
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  async getMany(@Query() query: ProductsQueryDto): Promise<ReturnProductsDto> {
    return await this.service.getMany(query);
  }
}

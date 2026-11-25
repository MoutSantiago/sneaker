import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { product_variant } from '../../generated/prisma/client';
import { PaginationDto } from './return-product.dto';

/**
 * DTO con los datos de las variantes de los productos retornados al cliente.
 */
export class ReturnVariantsDto {
  @IsArray()
  @IsNotEmpty()
  data: product_variant[];

  @ValidateNested()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}

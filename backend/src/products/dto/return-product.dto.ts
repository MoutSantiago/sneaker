import { IsArray, IsInt, IsNotEmpty, IsPositive, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { product } from '../../generated/prisma/client';

/**
 * DTO con los datos de paginación.
 */
export class PaginationDto {
  @IsInt()
  @IsPositive()
  total: number;

  @IsInt()
  @IsPositive()
  page: number;

  @IsInt()
  @IsPositive()
  limit: number;

  @IsInt()
  @IsPositive()
  totalPages: number;
}

/**
 * DTO con los datos de los productos retornados al cliente.
 */
export class ReturnProductsDto {
  @IsArray()
  @IsNotEmpty()
  data: product[];

  @ValidateNested()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}

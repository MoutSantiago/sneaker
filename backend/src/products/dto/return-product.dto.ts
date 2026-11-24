import { IsArray, IsInt, IsNotEmpty, IsNumber, IsPositive, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
export class ReturnProductsDto<T = unknown> {
  @IsArray()
  @IsNotEmpty()
  data: T[];

  @ValidateNested()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}

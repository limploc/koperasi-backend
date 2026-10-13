import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from 'class-validator';
import { ProductCategory } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name!: string;

  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @IsInt()
  @Min(0)
  price!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  unit!: string;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  short_description?: string;

  @IsOptional()
  @IsUrl()
  image_url?: string;
}

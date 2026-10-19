import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PricingType } from '@prisma/client';

export class CreateRentalItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  images?: string[];

  @IsInt()
  @Min(0)
  available_units!: number;

  @IsEnum(PricingType)
  pricing_type!: PricingType;

  @IsOptional()
  @IsInt()
  @Min(0)
  price_per_hour?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  price_per_day?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  price_per_week?: number | null;
}

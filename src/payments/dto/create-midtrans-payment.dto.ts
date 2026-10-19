import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateMidtransPaymentDto {
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  gross_amount!: number;

  @IsOptional()
  @IsObject()
  customer_details?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  item_details?: Array<Record<string, unknown>>;
}

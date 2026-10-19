import { CartItemType, RentalDurationType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AddToCartDto {
  @IsOptional()
  @IsUUID('4', { message: 'product_id must be a valid UUID' })
  product_id?: string;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity!: number;

  @IsOptional()
  @IsUUID('4', { message: 'rental_item_id must be a valid UUID' })
  rental_item_id?: string;

  @IsOptional()
  @IsEnum(RentalDurationType, { message: 'Invalid duration_type' })
  duration_type?: RentalDurationType;

  @IsOptional()
  @IsEnum(CartItemType, { message: 'Invalid item_type' })
  item_type?: CartItemType;
}

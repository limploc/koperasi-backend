import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MidtransWebhookDto {
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @IsString()
  @IsNotEmpty()
  transaction_status!: string;

  @IsNotEmpty()
  gross_amount!: string | number;

  @IsString()
  @IsNotEmpty()
  signature_key!: string;

  @IsOptional()
  @IsString()
  status_code?: string;

  @IsOptional()
  @IsString()
  payment_type?: string;

  @IsOptional()
  @IsString()
  transaction_id?: string;

  @IsOptional()
  @IsString()
  transaction_time?: string;

  @IsOptional()
  @IsString()
  fraud_status?: string;

  @IsOptional()
  @IsString()
  status_message?: string;

  @IsOptional()
  @IsString()
  merchant_id?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  settlement_time?: string;
}

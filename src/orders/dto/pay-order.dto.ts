import { IsIn, IsOptional } from 'class-validator';

export class PayOrderDto {
  @IsOptional()
  @IsIn(['success', 'failure'])
  simulate?: 'success' | 'failure' = 'success';
}

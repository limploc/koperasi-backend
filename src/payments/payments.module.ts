import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { MidtransService } from './midtrans/midtrans.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    JwtModule.register({}),
    AuthModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, MidtransService],
  exports: [PaymentsService, MidtransService],
})
export class PaymentsModule {}

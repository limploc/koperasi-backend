import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersController } from './orders.controller.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { OrdersService } from './orders.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    JwtModule.register({}),
    AuthModule,
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    JwtModule.register({}),
    AuthModule,
  ],
  controllers: [AdminUsersController, AdminOrdersController],
  providers: [AdminUsersService, AdminOrdersService],
  exports: [AdminUsersService, AdminOrdersService],
})
export class AdminModule {}

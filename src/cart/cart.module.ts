import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    JwtModule.register({}),
    AuthModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}

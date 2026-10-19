import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RentalController } from './rental.controller.js';
import { RentalService } from './rental.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    JwtModule.register({}),
    AuthModule,
  ],
  controllers: [RentalController],
  providers: [RentalService],
  exports: [RentalService],
})
export class RentalModule {}

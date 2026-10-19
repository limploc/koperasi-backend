import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { OrdersService } from './orders.service.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { PayOrderDto } from './dto/pay-order.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AccessTokenPayload } from '../common/types/auth.types.js';

const UUID_PIPE = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.BAD_REQUEST,
  exceptionFactory: () =>
    new BadRequestException({
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: { id: ['Invalid UUID format'] },
    }),
});

@Controller('api/ecommerce/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.BUYER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async checkout(@Req() req: Request & { user: AccessTokenPayload }) {
    const data = await this.ordersService.checkout(req.user.sub);
    return {
      success: true,
      message: 'Order created',
      data,
    };
  }

  @Get()
  @Roles(UserRole.BUYER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async listOrders(
    @Query() query: OrderQueryDto,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.ordersService.findAllBuyerOrders(req.user.sub, query);
    return {
      success: true,
      message: 'Order history',
      data,
    };
  }

  @Get(':id')
  @Roles(UserRole.BUYER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getOrderById(
    @Param('id', UUID_PIPE) id: string,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.ordersService.findById(id, {
      sub: req.user.sub,
      role: req.user.role,
    });
    return {
      success: true,
      message: 'Order detail',
      data,
    };
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.BUYER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async payOrder(
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: PayOrderDto,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.ordersService.payOrder(
      id,
      {
        sub: req.user.sub,
        role: req.user.role,
      },
      dto,
    );
    return {
      success: true,
      message: 'Payment processed',
      data,
    };
  }
}

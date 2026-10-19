import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto.js';
import { AdminUpdateOrderStatusDto } from './dto/admin-update-order-status.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';

const UUID_PIPE = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.BAD_REQUEST,
  exceptionFactory: () =>
    new BadRequestException({
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: { id: ['Invalid UUID format'] },
    }),
});

@Controller('api/admin/orders')
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @Get()
  @Roles(UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async adminListOrders(@Query() query: AdminOrderQueryDto) {
    const data = await this.adminOrdersService.findAll(query);
    return {
      success: true,
      message: 'All orders',
      data,
    };
  }

  @Put(':id/status')
  @Roles(UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async adminUpdateOrderStatus(
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: AdminUpdateOrderStatusDto,
  ) {
    const data = await this.adminOrdersService.updateStatus(id, dto);
    return {
      success: true,
      message: 'Order status updated',
      data,
    };
  }
}

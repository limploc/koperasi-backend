import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { RentalService } from './rental.service.js';
import { CreateRentalItemDto } from './dto/create-rental-item.dto.js';
import { UpdateRentalItemDto } from './dto/update-rental-item.dto.js';
import { RentalItemQueryDto } from './dto/rental-item-query.dto.js';
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

@Controller('api/rental/items')
export class RentalController {
  constructor(private readonly rentalService: RentalService) {}

  @Get()
  async listRentalItems(@Query() query: RentalItemQueryDto) {
    const data = await this.rentalService.findAll(query);
    return {
      success: true,
      message: 'List of rental items',
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createRentalItem(
    @Body() dto: CreateRentalItemDto,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.rentalService.create(dto, req.user.sub);
    return {
      success: true,
      message: 'Rental item created',
      data,
    };
  }

  @Get(':id')
  async getRentalItemById(@Param('id', UUID_PIPE) id: string) {
    const data = await this.rentalService.findById(id);
    return {
      success: true,
      message: 'Rental item detail',
      data,
    };
  }

  @Put(':id')
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateRentalItem(
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: UpdateRentalItemDto,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.rentalService.update(id, dto, {
      sub: req.user.sub,
      role: req.user.role,
    });
    return {
      success: true,
      message: 'Rental item updated',
      data,
    };
  }

  @Delete(':id')
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteRentalItem(
    @Param('id', UUID_PIPE) id: string,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.rentalService.delete(id, {
      sub: req.user.sub,
      role: req.user.role,
    });
    return {
      success: true,
      message: 'Rental item deleted',
      data,
    };
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { AdminUsersService } from './admin-users.service.js';
import { AdminUserQueryDto } from './dto/admin-user-query.dto.js';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto.js';
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

@Controller(['api/admin/users', 'api/users'])
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @Roles(UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async adminListUsers(@Query() query: AdminUserQueryDto) {
    const data = await this.adminUsersService.findAll(query);
    return {
      success: true,
      message: 'List of users',
      data,
    };
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async adminGetUser(@Param('id', UUID_PIPE) id: string) {
    const data = await this.adminUsersService.findById(id);
    return {
      success: true,
      message: 'User detail',
      data,
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async adminUpdateUser(
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: AdminUpdateUserDto,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.adminUsersService.update(id, dto, req.user.sub);
    return {
      success: true,
      message: 'User updated',
      data,
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async adminDeleteUser(
    @Param('id', UUID_PIPE) id: string,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.adminUsersService.delete(id, req.user.sub);
    return {
      success: true,
      message: 'User deactivated',
      data,
    };
  }
}

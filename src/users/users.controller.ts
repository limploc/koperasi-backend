import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service.js';
import { UserQueryDto } from './dto/user-query.dto.js';
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

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async listUsers(@Query() query: UserQueryDto) {
    const data = await this.usersService.findAll(query);
    return {
      success: true,
      message: 'List of users',
      data,
    };
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getUserById(@Param('id', UUID_PIPE) id: string) {
    const data = await this.usersService.findById(id);
    return {
      success: true,
      message: 'User detail',
      data,
    };
  }
}

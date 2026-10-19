import { Injectable } from '@nestjs/common';
import { AdminUsersService } from '../admin/admin-users.service.js';
import { UserQueryDto } from './dto/user-query.dto.js';
import { UserResponse } from '../admin/admin.mapper.js';
import { PaginationMetaResponse } from '../products/products.mapper.js';

@Injectable()
export class UsersService {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  async findAll(
    query: UserQueryDto,
  ): Promise<{ data: UserResponse[]; meta: PaginationMetaResponse }> {
    return this.adminUsersService.findAll(query);
  }

  async findById(id: string): Promise<UserResponse> {
    return this.adminUsersService.findById(id);
  }
}

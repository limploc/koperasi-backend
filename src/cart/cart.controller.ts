import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { CartService } from './cart.service.js';
import { AddToCartDto } from './dto/add-to-cart.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';
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
      details: { productId: ['Invalid UUID format'] },
    }),
});

@Controller('api/ecommerce/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Roles(UserRole.BUYER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getCart(@Req() req: Request & { user: AccessTokenPayload }) {
    const data = await this.cartService.getCart(req.user.sub);
    return {
      success: true,
      message: 'Current cart',
      data,
    };
  }

  @Delete()
  @Roles(UserRole.BUYER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async clearCart(@Req() req: Request & { user: AccessTokenPayload }) {
    const data = await this.cartService.clearCart(req.user.sub);
    return {
      success: true,
      message: 'Cart cleared',
      data,
    };
  }

  @Post('items')
  @Roles(UserRole.BUYER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async addCartItem(
    @Body() dto: AddToCartDto,
    @Req() req: Request & { user: AccessTokenPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { cart, isNew } = await this.cartService.addItem(req.user.sub, dto);
    if (isNew) {
      res.status(HttpStatus.CREATED);
    } else {
      res.status(HttpStatus.OK);
    }
    return {
      success: true,
      message: isNew ? 'Item added to cart (created)' : 'Item added to cart',
      data: cart,
    };
  }

  @Put('items/:productId')
  @Roles(UserRole.BUYER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateCartItem(
    @Param('productId', UUID_PIPE) productId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.cartService.updateItem(req.user.sub, productId, dto);
    return {
      success: true,
      message: 'Cart item updated',
      data,
    };
  }

  @Delete('items/:productId')
  @Roles(UserRole.BUYER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async removeCartItem(
    @Param('productId', UUID_PIPE) productId: string,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.cartService.removeItem(req.user.sub, productId);
    return {
      success: true,
      message: 'Item removed',
      data,
    };
  }
}

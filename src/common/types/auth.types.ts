import { UserRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  sid: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  role: UserRole;
  sid: string;
  type: 'refresh';
}

export interface AuthenticatedRequestUser {
  id: string;
  role: UserRole;
  sessionId: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  enabled: boolean;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionPayload {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

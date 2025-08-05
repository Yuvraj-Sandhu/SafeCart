export interface User {
  uid: string;
  username: string;
  email: string;
  role: 'member' | 'admin';
  passwordHash: string;
}

export interface UserInfo {
  uid: string;
  username: string;
  email: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: Omit<User, 'passwordHash'>;
}

export interface JWTPayload {
  uid: string;
  username: string;
  email: string;
  role: 'member' | 'admin';
}
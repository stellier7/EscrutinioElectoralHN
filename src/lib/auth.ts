import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import type { User } from '@/types';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export class AuthUtils {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'escrutinio-transparente',
      audience: 'escrutinio-users',
    });
  }

  static verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        issuer: 'escrutinio-transparente',
        audience: 'escrutinio-users',
      }) as JWTPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  // Device ID generation removed - no longer needed

  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return true;
      
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  static generateSessionToken(): string {
    return Math.random().toString(36).substr(2) + Date.now().toString(36);
  }
} 
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

import { env } from '@/config/env';

export function verifyToken(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  
  if (!token) {
    throw new Error('No token provided')
  }

  return jwt.verify(token, env.JWT_SECRET)
}

export function extractTokenFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
} 